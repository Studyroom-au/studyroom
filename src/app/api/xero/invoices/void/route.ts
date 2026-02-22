// src/app/api/xero/invoices/void/route.ts
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ensureXeroToken } from "@/lib/xero";
import { Invoice } from "xero-node";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

async function requireUser(req: Request) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin not configured.");

  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization token.");

  return await auth.verifyIdToken(token);
}

async function requireTutorOrAdmin(uid: string, email?: string | null) {
  if ((email || "").toLowerCase() === "lily.studyroom@gmail.com") return { role: "admin" };

  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const roleSnap = await db.collection("roles").doc(uid).get();
  const role = roleSnap.exists ? (roleSnap.data()?.role as string) : "student";
  if (role !== "tutor" && role !== "admin") throw new Error("Not permitted.");
  return { role };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { role } = await requireTutorOrAdmin(user.uid, user.email ?? null);

    const body = await req.json();
    const sessionId = String(body?.sessionId ?? "");
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const session = sessionSnap.data() as any;

    if (role !== "admin" && session.tutorId !== user.uid) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const xeroInvoiceId = String(session.xeroInvoiceId ?? "");
    if (!xeroInvoiceId) {
      return NextResponse.json({ error: "Session has no xeroInvoiceId" }, { status: 400 });
    }

    const { xero, tenantId } = await ensureXeroToken();

    await xero.accountingApi.updateInvoice(tenantId, xeroInvoiceId, {
      invoices: [{ status: Invoice.StatusEnum.VOIDED } as any],
    });

    await sessionRef.update({
      xeroInvoiceId: null,
      billingStatus: "READY_TO_INVOICE",
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[xero/invoices/void]", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", details: e?.response?.body ?? null },
      { status: 500 }
    );
  }
}
