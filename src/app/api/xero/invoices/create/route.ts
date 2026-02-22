import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ensureXeroToken, ymd } from "@/lib/xero";
import { Invoice, LineAmountTypes } from "xero-node";

type Role = "student" | "tutor" | "admin";

type SessionData = {
  tutorId?: string;
  clientId?: string;
  studentId?: string;
  startAt?: { toDate?: () => Date };
  durationMinutes?: number;
  amountCents?: number;
  status?: string;
};

type ClientData = {
  parentName?: string;
  parentEmail?: string;
};

type StudentData = {
  studentName?: string;
};

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
  if ((email || "").toLowerCase() === "lily.studyroom@gmail.com") return { role: "admin" as const };

  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");

  const roleSnap = await db.collection("roles").doc(uid).get();
  const role = (roleSnap.exists ? (roleSnap.data()?.role as Role) : "student") ?? "student";
  if (role !== "tutor" && role !== "admin") throw new Error("Not permitted.");
  return { role };
}

function safeJsonError(e: unknown): { message: string; details?: unknown } {
  if (e instanceof Error) return { message: e.message };
  return { message: "Unknown error" };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { role } = await requireTutorOrAdmin(user.uid, user.email ?? null);

    const body: unknown = await req.json();
    const sessionId = String((body as { sessionId?: unknown })?.sessionId ?? "");
    const modeRaw = String((body as { mode?: unknown })?.mode ?? "DRAFT").toUpperCase();
    const mode = (modeRaw === "AUTHORISED" ? "AUTHORISED" : "DRAFT") as "DRAFT" | "AUTHORISED";

    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const sessionRef = db.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const session = (sessionSnap.data() ?? {}) as SessionData;

    // Tutors can only invoice their own session
    if (role !== "admin" && session.tutorId !== user.uid) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const clientId = String(session.clientId ?? "");
    const studentId = String(session.studentId ?? "");
    if (!clientId || !studentId) {
      return NextResponse.json({ error: "Session missing clientId/studentId" }, { status: 400 });
    }

    const [clientSnap, studentSnap] = await Promise.all([
      db.collection("clients").doc(clientId).get(),
      db.collection("students").doc(studentId).get(),
    ]);

    if (!clientSnap.exists) return NextResponse.json({ error: "Client not found" }, { status: 400 });
    if (!studentSnap.exists) return NextResponse.json({ error: "Student not found" }, { status: 400 });

    const client = (clientSnap.data() ?? {}) as ClientData;
    const student = (studentSnap.data() ?? {}) as StudentData;

    const parentName = String(client.parentName || "Parent");
    const parentEmail = String(client.parentEmail || "");
    const studentName = String(student.studentName || "Student");

    const durationMinutes = Number(session.durationMinutes || 60);
    const hours = durationMinutes / 60;

    const defaultRate = 75;
    const amount = Number(((session.amountCents ? session.amountCents / 100 : defaultRate * hours)).toFixed(2));

    const startDate = session.startAt?.toDate ? session.startAt.toDate() : new Date();
    const invoiceDate = ymd(startDate);
    const dueDate = invoiceDate;

    const salesAccountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
    const { xero, tenantId } = await ensureXeroToken();

    // Find or create contact
    let contactId: string | null = null;

    if (parentEmail) {
      const existing = await xero.accountingApi.getContacts(
        tenantId,
        undefined,
        `EmailAddress=="${parentEmail.replace(/"/g, '\\"')}"`
      );
      const found = existing.body.contacts?.[0];
      if (found?.contactID) contactId = found.contactID;
    }

    if (!contactId) {
      const created = await xero.accountingApi.createContacts(tenantId, {
        contacts: [{ name: parentName, emailAddress: parentEmail || undefined }],
      });
      contactId = created.body.contacts?.[0]?.contactID ?? null;
    }

    if (!contactId) return NextResponse.json({ error: "Could not create/find Xero contact" }, { status: 500 });

    const invoiceStatus = mode === "AUTHORISED" ? Invoice.StatusEnum.AUTHORISED : Invoice.StatusEnum.DRAFT;

    const createdInvoices = await xero.accountingApi.createInvoices(tenantId, {
      invoices: [
        {
          type: Invoice.TypeEnum.ACCREC,
          contact: { contactID: contactId },
          status: invoiceStatus,
          date: invoiceDate,
          dueDate,
          lineAmountTypes: LineAmountTypes.Inclusive,
          reference: `Studyroom • ${studentName} • ${invoiceDate}`,
          lineItems: [
            {
              description: `Tutoring session (${durationMinutes} min) • ${studentName}`,
              quantity: 1,
              unitAmount: amount,
              accountCode: salesAccountCode,
            },
          ],
        },
      ],
    });

    const invoiceId = createdInvoices.body.invoices?.[0]?.invoiceID ?? null;
    if (!invoiceId) return NextResponse.json({ error: "Xero did not return invoiceID" }, { status: 500 });

    await sessionRef.update({
      xeroInvoiceId: invoiceId,
      billingStatus: "INVOICED",
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, invoiceId, status: invoiceStatus });
  } catch (e: unknown) {
    console.error("[xero/invoices/create]", e);
    const { message } = safeJsonError(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
