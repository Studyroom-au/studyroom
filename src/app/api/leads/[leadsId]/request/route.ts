import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

const ADMIN_EMAILS = new Set([
  "lily.studyroom@gmail.com",
  "contact.studyroomaustralia@gmail.com",
]);

export async function POST(
  req: Request,
  context: { params: Promise<{ leadsId: string }> }
) {
  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    const decoded = await verifyIdTokenFromRequest(req);
    const tutorUid = decoded.uid;
    const tutorEmail = (decoded.email ?? "").toLowerCase();

    const params = await Promise.resolve(context.params);
    const { leadsId: leadId } = params;

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Missing leadId." }, { status: 400 });
    }

    // ── Role check ────────────────────────────────────────────────────────────
    const isAdminEmail = ADMIN_EMAILS.has(tutorEmail);

    if (!isAdminEmail) {
      const roleSnap = await db.collection("roles").doc(tutorUid).get();
      let role: string | undefined = roleSnap.exists
        ? (roleSnap.data()?.role as string | undefined)
        : undefined;

      if (role !== "tutor") {
        const redeemedSnap = await db
          .collection("tutorAccessCodes")
          .where("redeemedByUid", "==", tutorUid)
          .limit(1)
          .get();
        if (!redeemedSnap.empty) {
          await db.collection("roles").doc(tutorUid).set({ role: "tutor" }, { merge: true });
          role = "tutor";
        }
      }

      if (role !== "tutor") {
        return NextResponse.json(
          { ok: false, error: "Only tutors can request leads." },
          { status: 403 }
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const leadRef = db.collection("leads").doc(leadId);
    const userRef = db.collection("users").doc(tutorUid);

    const [leadSnap, userSnap] = await Promise.all([leadRef.get(), userRef.get()]);

    if (!leadSnap.exists) {
      return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
    }

    const lead = leadSnap.data() as Record<string, unknown>;

    if (lead.status !== "new") {
      return NextResponse.json(
        { ok: false, error: "This lead is not available for requests." },
        { status: 400 }
      );
    }

    // ── Duplicate request guard ───────────────────────────────────────────────
    const existingIds = Array.isArray(lead.tutorRequestIds)
      ? (lead.tutorRequestIds as string[])
      : [];
    if (existingIds.includes(tutorUid)) {
      return NextResponse.json(
        { ok: false, error: "You have already requested this student." },
        { status: 409 }
      );
    }

    // ── Resolve tutor name ────────────────────────────────────────────────────
    const udata = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    const tutorName =
      typeof udata.name === "string" ? udata.name :
      typeof udata.displayName === "string" ? udata.displayName :
      typeof udata.fullName === "string" ? udata.fullName :
      null;

    // ── Write subcollection doc + update lead atomically ─────────────────────
    const requestRef = db
      .collection("leads")
      .doc(leadId)
      .collection("tutorRequests")
      .doc(tutorUid);

    const batch = db.batch();

    batch.set(requestRef, {
      tutorId: tutorUid,
      tutorName,
      tutorEmail: decoded.email ?? null,
      status: "pending",
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      message: null,
    });

    batch.update(leadRef, {
      tutorRequestIds: admin.firestore.FieldValue.arrayUnion(tutorUid),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[lead request] failed:", err);
    const message = err instanceof Error ? err.message : "Request failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
