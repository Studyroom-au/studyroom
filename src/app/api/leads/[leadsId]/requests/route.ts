import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminApp, verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

const ADMIN_EMAILS = new Set([
  "lily.studyroom@gmail.com",
  "contact.studyroomaustralia@gmail.com",
]);

export async function GET(
  req: Request,
  context: { params: Promise<{ leadsId: string }> }
) {
  try {
    const app = getAdminApp();
    const db = admin.firestore(app);

    const decoded = await verifyIdTokenFromRequest(req);
    const callerEmail = (decoded.email ?? "").toLowerCase();
    const isAdmin =
      decoded.role === "admin" || ADMIN_EMAILS.has(callerEmail);

    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      );
    }

    const params = await Promise.resolve(context.params);
    const { leadsId: leadId } = params;

    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Missing leadId." }, { status: 400 });
    }

    const snap = await db
      .collection("leads")
      .doc(leadId)
      .collection("tutorRequests")
      .orderBy("requestedAt", "asc")
      .get();

    const requests = snap.docs.map((d) => {
      const data = d.data();
      const ts = data.requestedAt as admin.firestore.Timestamp | null;
      return {
        tutorId: d.id,
        tutorName: typeof data.tutorName === "string" ? data.tutorName : null,
        tutorEmail: typeof data.tutorEmail === "string" ? data.tutorEmail : null,
        status: typeof data.status === "string" ? data.status : "pending",
        requestedAt: ts instanceof admin.firestore.Timestamp ? ts.toDate().toISOString() : null,
        message: typeof data.message === "string" ? data.message : null,
      };
    });

    return NextResponse.json({ ok: true, requests });
  } catch (err: unknown) {
    console.error("[lead requests] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load requests.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
