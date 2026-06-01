import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// POST /api/parent/add-child
// Authenticated: requires parent idToken in Authorization header.
// Adds a new student to the authenticated parent's existing family record.
//
// Body: { studentName, studentEmail, studentPassword, yearLevel, dob?, school?, promoCode? }

export async function POST(req: NextRequest) {
  try {
    let decoded: Awaited<ReturnType<typeof verifyIdTokenFromRequest>>;
    try {
      decoded = await verifyIdTokenFromRequest(req);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parentUid = decoded.uid;
    const parentEmail = decoded.email?.toLowerCase() ?? "";

    const body = await req.json() as {
      studentName?: unknown;
      studentEmail?: unknown;
      studentPassword?: unknown;
      yearLevel?: unknown;
      dob?: unknown;
      school?: unknown;
      promoCode?: unknown;
    };

    const studentName = String(body.studentName ?? "").trim();
    const studentEmail = String(body.studentEmail ?? "").trim().toLowerCase();
    const studentPassword = String(body.studentPassword ?? "").trim();
    const yearLevel = String(body.yearLevel ?? "").trim();
    const dob = String(body.dob ?? "").trim();
    const school = String(body.school ?? "").trim();
    const promoCode = String(body.promoCode ?? "").trim().toUpperCase();

    if (!studentName) return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    if (!studentEmail) return NextResponse.json({ error: "Student email is required." }, { status: 400 });
    if (!isValidEmail(studentEmail)) return NextResponse.json({ error: "Student email is invalid." }, { status: 400 });
    if (parentEmail && studentEmail === parentEmail) {
      return NextResponse.json({ error: "Student and parent email must be different." }, { status: 400 });
    }
    if (studentPassword.length < 8) {
      return NextResponse.json({ error: "Student password must be at least 8 characters." }, { status: 400 });
    }
    if (!yearLevel) return NextResponse.json({ error: "Year level is required." }, { status: 400 });

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // Find parent's client record
    let clientSnap = await db.collection("clients").where("parentUid", "==", parentUid).limit(1).get();
    if (clientSnap.empty && parentEmail) {
      clientSnap = await db.collection("clients").where("parentEmail", "==", parentEmail).limit(1).get();
    }
    if (clientSnap.empty) {
      return NextResponse.json({ error: "Parent account is not linked to a family record." }, { status: 404 });
    }
    const clientId = clientSnap.docs[0].id;

    // Validate promo code before creating accounts
    let promoDocRef: FirebaseFirestore.DocumentReference | null = null;
    let promoData: FirebaseFirestore.DocumentData | null = null;
    let promoEndsAt: Date | null = null;

    if (promoCode) {
      const promoSnap = await db
        .collection("promoCodes")
        .where("code", "==", promoCode)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (promoSnap.empty) {
        return NextResponse.json({ error: "Invalid promo code. Please check and try again." }, { status: 400 });
      }

      promoDocRef = promoSnap.docs[0].ref;
      promoData = promoSnap.docs[0].data();

      if (promoData.expiresAt) {
        const expiry = promoData.expiresAt.toDate?.() ?? new Date(promoData.expiresAt);
        if (new Date() > expiry) {
          return NextResponse.json({ error: "This promo code has expired." }, { status: 400 });
        }
      }

      const maxR = promoData.maxRedemptions ?? promoData.maxUses ?? null;
      const countR = promoData.redemptionCount ?? promoData.usedCount ?? 0;
      if (maxR !== null && countR >= maxR) {
        return NextResponse.json(
          { error: "This promo code has reached its maximum uses." },
          { status: 400 }
        );
      }

      const promoType: string = promoData.type ?? "free_trial";
      const promoDurationDays =
        promoType === "full_access" ? 3650 : (promoData.durationDays ?? promoData.trialDays ?? 7);
      promoEndsAt = new Date();
      promoEndsAt.setDate(promoEndsAt.getDate() + promoDurationDays);
    }

    // Create the student Firebase Auth account
    let studentUid: string;
    try {
      const newStudent = await adminAuth.createUser({
        email: studentEmail,
        password: studentPassword,
        displayName: studentName,
      });
      studentUid = newStudent.uid;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "An account already exists with this email. Please use a different student email address." },
          { status: 409 }
        );
      }
      throw err;
    }

    // Write student role and user docs
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

    // Create student record linked to existing client
    const studentRef = db.collection("students").doc();
    await studentRef.set({
      studentName,
      yearLevel,
      dob: dob || null,
      school: school || null,
      subjects: [],
      clientId,
      hubUid: studentUid,
      hubEmail: studentEmail,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const studentId = studentRef.id;

    // Back-link student and client IDs into the student's user doc
    await db.collection("users").doc(studentUid).set({ studentId, clientId }, { merge: true });

    // Apply promo code to the new student only (transactional)
    let promoApplied = false;
    let promoError: string | null = null;

    if (promoCode && promoDocRef && promoData && promoEndsAt) {
      const txResult = await db.runTransaction(async (tx) => {
        const freshDoc = await tx.get(promoDocRef!);
        if (!freshDoc.exists) return { error: "Promo code no longer exists." };

        const fresh = freshDoc.data()!;
        const maxR = fresh.maxRedemptions ?? fresh.maxUses ?? null;
        const countR = fresh.redemptionCount ?? fresh.usedCount ?? 0;
        if (maxR !== null && countR >= maxR) {
          return { error: "This promo code has reached its maximum uses." };
        }

        const freshRedeemedBy: string[] = fresh.redeemedBy ?? [];
        if (freshRedeemedBy.includes(studentUid)) {
          return { error: "This student has already redeemed this promo code." };
        }

        tx.update(promoDocRef!, {
          redemptionCount: FieldValue.increment(1),
          redeemedBy: FieldValue.arrayUnion(studentUid),
        });

        tx.set(
          db.collection("users").doc(studentUid),
          {
            subscriptionStatus: "trial",
            trialEndsAt: promoEndsAt,
            trialStartedAt: FieldValue.serverTimestamp(),
            promoCode,
            trialWarningEmailSent: false,
          },
          { merge: true }
        );

        return { ok: true };
      });

      if ("error" in txResult && txResult.error) {
        promoError = txResult.error;
      } else {
        promoApplied = true;
      }
    }

    return NextResponse.json({
      ok: true,
      studentUid,
      studentId,
      clientId,
      promoApplied,
      ...(promoError ? { promoError } : {}),
    });
  } catch (err) {
    console.error("[parent/add-child]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
