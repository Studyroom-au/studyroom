import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

// ── Validation ────────────────────────────────────────────────────────────────

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ── POST /api/signup/family ───────────────────────────────────────────────────
//
// Public route (no auth token required).
// Creates or links a parent Firebase Auth user, creates a student Firebase Auth
// user, ensures a clients/{id} record exists for the parent, then creates a
// students/{id} record linked to both.
//
// Body:
//   parentName      string  required
//   parentEmail     string  required
//   parentPassword  string  required for new parent accounts (min 6 chars)
//   parentPhone     string  optional
//   studentName     string  required
//   studentEmail    string  required
//   studentPassword string  required (min 8 chars)
//   yearLevel       string  required
//   dob             string  optional (YYYY-MM-DD)
//   school          string  optional
//   subjects        string[] optional
//   promoCode       string  optional
//
// Response:
//   { ok, parentUid, studentUid, clientId, studentId, accountWasNew, promoApplied? }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      parentName?: unknown;
      parentEmail?: unknown;
      parentPassword?: unknown;
      parentPhone?: unknown;
      studentName?: unknown;
      studentEmail?: unknown;
      studentPassword?: unknown;
      yearLevel?: unknown;
      dob?: unknown;
      school?: unknown;
      subjects?: unknown;
      promoCode?: unknown;
    };

    // ── Input validation ──────────────────────────────────────────────────────
    const parentName = String(body.parentName ?? "").trim();
    const parentEmail = String(body.parentEmail ?? "").trim().toLowerCase();
    const parentPassword = String(body.parentPassword ?? "").trim();
    const parentPhone = String(body.parentPhone ?? "").trim();
    const studentName = String(body.studentName ?? "").trim();
    const studentEmail = String(body.studentEmail ?? "").trim().toLowerCase();
    const studentPassword = String(body.studentPassword ?? "").trim();
    const yearLevel = String(body.yearLevel ?? "").trim();
    const dob = String(body.dob ?? "").trim();
    const school = String(body.school ?? "").trim();
    const subjects = Array.isArray(body.subjects)
      ? (body.subjects as unknown[]).map((s) => String(s)).filter(Boolean)
      : [];
    const promoCode = String(body.promoCode ?? "").trim().toUpperCase();

    if (!parentName) return NextResponse.json({ error: "parentName is required" }, { status: 400 });
    if (!parentEmail) return NextResponse.json({ error: "parentEmail is required" }, { status: 400 });
    if (!isValidEmail(parentEmail)) return NextResponse.json({ error: "parentEmail is invalid" }, { status: 400 });
    if (!studentName) return NextResponse.json({ error: "studentName is required" }, { status: 400 });
    if (!studentEmail) return NextResponse.json({ error: "studentEmail is required" }, { status: 400 });
    if (!isValidEmail(studentEmail)) return NextResponse.json({ error: "studentEmail is invalid" }, { status: 400 });
    if (studentPassword.length < 8) return NextResponse.json({ error: "studentPassword must be at least 8 characters" }, { status: 400 });
    if (studentEmail === parentEmail) return NextResponse.json({ error: "Student and parent email must be different" }, { status: 400 });
    if (!yearLevel) return NextResponse.json({ error: "yearLevel is required" }, { status: 400 });

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // ── Step 0 (optional): Pre-validate promo code before creating accounts ───
    // We validate first so that an invalid code never results in orphaned accounts.
    let promoDocRef: FirebaseFirestore.DocumentReference | null = null;
    let promoData: FirebaseFirestore.DocumentData | null = null;
    let promoDurationDays = 0;
    let promoEndsAt: Date | null = null;

    if (promoCode) {
      const promoSnap = await db
        .collection("promoCodes")
        .where("code", "==", promoCode)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (promoSnap.empty) {
        return NextResponse.json(
          { error: "Invalid promo code. Please check and try again." },
          { status: 400 }
        );
      }

      promoDocRef = promoSnap.docs[0].ref;
      promoData = promoSnap.docs[0].data();

      if (promoData.expiresAt) {
        const expiry = promoData.expiresAt.toDate?.() ?? new Date(promoData.expiresAt);
        if (new Date() > expiry) {
          return NextResponse.json({ error: "This promo code has expired." }, { status: 400 });
        }
      }

      // Check capacity before creating accounts — not atomic, but good enough to
      // fail fast. The real atomic check happens in Step 8.
      const maxR = promoData.maxRedemptions ?? promoData.maxUses ?? null;
      const countR = promoData.redemptionCount ?? promoData.usedCount ?? 0;
      if (maxR !== null && countR >= maxR) {
        return NextResponse.json(
          { error: "This promo code has reached its maximum uses." },
          { status: 400 }
        );
      }

      const promoType: string = promoData.type ?? "free_trial";
      promoDurationDays =
        promoType === "full_access"
          ? 3650
          : (promoData.durationDays ?? promoData.trialDays ?? 7);

      promoEndsAt = new Date();
      promoEndsAt.setDate(promoEndsAt.getDate() + promoDurationDays);
    }

    // ── Step 1: Get or create the parent Firebase Auth account ────────────────
    let parentUid: string;
    let accountWasNew: boolean;

    try {
      const existing = await adminAuth.getUserByEmail(parentEmail);
      parentUid = existing.uid;
      accountWasNew = false;
    } catch (lookupErr: unknown) {
      if ((lookupErr as { code?: string })?.code !== "auth/user-not-found") {
        throw lookupErr;
      }
      if (parentPassword.length < 6) {
        return NextResponse.json({ error: "parentPassword must be at least 6 characters" }, { status: 400 });
      }
      const newParent = await adminAuth.createUser({
        email: parentEmail,
        password: parentPassword,
        displayName: parentName,
      });
      parentUid = newParent.uid;
      accountWasNew = true;
    }

    // ── Step 1b: Per-parent eligibility checks (requires parentUid) ──────────
    // Now that we know the parentUid we can check whether this parent is already
    // in redeemedBy or whether the code's eligibility rules block them.
    // We only do this for existing parents — brand-new parents are never in
    // redeemedBy, and the new_users_only check trivially passes.
    let skipPromo = false;
    let skipPromoReason: string | null = null;

    if (promoCode && promoDocRef && promoData && !accountWasNew) {
      const alreadyRedeemed: string[] = promoData.redeemedBy ?? [];
      if (alreadyRedeemed.includes(parentUid)) {
        skipPromo = true;
        skipPromoReason = "You have already used this promo code.";
      }

      if (!skipPromo) {
        const eligibility: string = promoData.eligibility ?? "new_users_only";
        if (eligibility === "new_users_only") {
          const parentUserSnap = await db.collection("users").doc(parentUid).get();
          const parentUserData = parentUserSnap.data() ?? {};
          const subStatus: string = parentUserData.subscriptionStatus ?? "";
          const hasActiveSub = subStatus === "active";
          const hasActiveTrial =
            subStatus === "trial" &&
            parentUserData.trialEndsAt &&
            new Date() < (parentUserData.trialEndsAt.toDate?.() ?? new Date(parentUserData.trialEndsAt));
          if (hasActiveSub || hasActiveTrial) {
            skipPromo = true;
            skipPromoReason = "This code is for new users only.";
          }
        }
      }
    }

    // ── Step 2: Create the student Firebase Auth account ─────────────────────
    let studentUid: string;

    try {
      const newStudent = await adminAuth.createUser({
        email: studentEmail,
        password: studentPassword,
        displayName: studentName,
      });
      studentUid = newStudent.uid;
    } catch (studentErr: unknown) {
      if ((studentErr as { code?: string })?.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "A student account already exists with this email. Please use a different email address for the student." },
          { status: 409 }
        );
      }
      throw studentErr;
    }

    // ── Step 3: Write parent roles and users docs ─────────────────────────────
    if (accountWasNew) {
      await Promise.all([
        db.collection("roles").doc(parentUid).set({ role: "parent" }),
        db.collection("users").doc(parentUid).set({
          displayName: parentName,
          parentEmail,
          role: "parent",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
    } else {
      const roleDoc = await db.collection("roles").doc(parentUid).get();
      if (!roleDoc.exists) {
        await db.collection("roles").doc(parentUid).set({ role: "parent" });
      }
      await db.collection("users").doc(parentUid).set({
        displayName: parentName,
        parentEmail,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // ── Step 4: Write student roles and users docs ────────────────────────────
    await Promise.all([
      db.collection("roles").doc(studentUid).set({ role: "student" }),
      db.collection("users").doc(studentUid).set({
        displayName: studentName,
        parentEmail,
        parentUid,
        role: "student",
        onboardingComplete: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);

    // ── Step 5: Find or create the client (family) record ────────────────────
    let clientId: string;

    const existingClientSnap = await db
      .collection("clients")
      .where("parentUid", "==", parentUid)
      .limit(1)
      .get();

    if (!existingClientSnap.empty) {
      clientId = existingClientSnap.docs[0].id;
      await db.collection("clients").doc(clientId).set({
        parentName,
        parentEmail,
        parentPhone: parentPhone || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      const clientRef = db.collection("clients").doc();
      await clientRef.set({
        parentName,
        parentEmail,
        parentPhone: parentPhone || null,
        parentUid,
        type: "family",
        pricingPlan: "CASUAL",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      clientId = clientRef.id;
    }

    // ── Step 6: Create the student record ────────────────────────────────────
    const studentRef = db.collection("students").doc();
    await studentRef.set({
      studentName,
      yearLevel,
      dob: dob || null,
      school: school || null,
      subjects,
      clientId,
      hubUid: studentUid,
      hubEmail: studentEmail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const studentId = studentRef.id;

    // ── Step 7: Back-link student record into users/{studentUid} ─────────────
    await db.collection("users").doc(studentUid).set({
      studentId,
      clientId,
    }, { merge: true });

    // ── Step 8 (optional): Atomically redeem promo code ───────────────────────
    // Grants trial access on both parent and student user documents.
    // Skipped when Step 1b determined the parent is ineligible (existing users).
    let promoApplied = false;
    let promoError: string | null = skipPromoReason;

    if (promoCode && promoDocRef && promoData && promoEndsAt && !skipPromo) {
      const txResult = await db.runTransaction(async (tx) => {
        const freshDoc = await tx.get(promoDocRef!);
        if (!freshDoc.exists) return { error: "Promo code no longer exists." };

        const fresh = freshDoc.data()!;

        // Race-condition safety: re-check redeemedBy inside the transaction
        const freshRedeemedBy: string[] = fresh.redeemedBy ?? [];
        if (freshRedeemedBy.includes(parentUid)) {
          return { error: "You have already used this promo code." };
        }

        const maxR = fresh.maxRedemptions ?? fresh.maxUses ?? null;
        const countR = fresh.redemptionCount ?? fresh.usedCount ?? 0;
        if (maxR !== null && countR >= maxR) {
          return { error: "This promo code has reached its maximum uses." };
        }

        tx.update(promoDocRef!, {
          redemptionCount: FieldValue.increment(1),
          redeemedBy: FieldValue.arrayUnion(parentUid),
        });

        const accessFields = {
          subscriptionStatus: "trial",
          trialEndsAt: promoEndsAt,
          trialStartedAt: FieldValue.serverTimestamp(),
          promoCode,
          trialWarningEmailSent: false,
        };

        tx.set(db.collection("users").doc(parentUid), accessFields, { merge: true });
        tx.set(db.collection("users").doc(studentUid), accessFields, { merge: true });

        return { ok: true };
      });

      if ("error" in txResult && txResult.error) {
        promoError = txResult.error;
      } else {
        promoApplied = true;
        promoError = null;
      }
    }

    return NextResponse.json({
      ok: true,
      parentUid,
      studentUid,
      clientId,
      studentId,
      accountWasNew,
      promoApplied,
      ...(promoError ? { promoError } : {}),
    });
  } catch (err) {
    console.error("[signup/family]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
