import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ensureXeroToken, ymd } from "@/lib/xero";
import { Invoice, LineAmountTypes } from "xero-node";
import { FieldValue } from "firebase-admin/firestore";

type InvoiceDoc = {
  clientId?: string | null;
  studentId?: string | null;
  sessionId?: string | null;
  amountCents?: number | null;
  issuedAt?: { toDate?: () => Date } | null;
  dueAt?: { toDate?: () => Date } | null;
  status?: string | null;
  xeroInvoiceId?: string | null;
  description?: string | null;
};

type ClientData = {
  parentName?: string | null;
  parentEmail?: string | null;
};

type StudentData = {
  studentName?: string | null;
};

function isInternalCall(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return req.headers.get("x-internal-call") === secret;
}

async function verifyUserIsAllowed(req: Request) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin not configured.");
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  const token = m?.[1];
  if (!token) throw new Error("Unauthorized");
  const decoded = await auth.verifyIdToken(token);
  const email = (decoded.email || "").toLowerCase();
  if (email === "lily.studyroom@gmail.com") return;
  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");
  const snap = await db.collection("roles").doc(decoded.uid).get();
  const role = snap.exists ? String(snap.data()?.role ?? "") : "";
  if (role !== "tutor" && role !== "admin") throw new Error("Forbidden");
}

export async function POST(req: Request) {
  try {
    // Accept internal calls (from sessions/status auto-push) or authenticated user calls
    if (!isInternalCall(req)) {
      await verifyUserIsAllowed(req);
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoiceId ?? "").trim();
    if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });

    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const invoice = (invoiceSnap.data() ?? {}) as InvoiceDoc;

    // Skip if already pushed
    if (invoice.xeroInvoiceId && invoice.status === "sent") {
      return NextResponse.json({ ok: true, skipped: true, xeroInvoiceId: invoice.xeroInvoiceId });
    }

    const clientId = String(invoice.clientId ?? "");
    const studentId = String(invoice.studentId ?? "");
    if (!clientId || !studentId) {
      return NextResponse.json({ error: "Invoice missing clientId/studentId" }, { status: 400 });
    }

    const [clientSnap, studentSnap] = await Promise.all([
      db.collection("clients").doc(clientId).get(),
      db.collection("students").doc(studentId).get(),
    ]);

    const client = (clientSnap.data() ?? {}) as ClientData;
    const student = (studentSnap.data() ?? {}) as StudentData;

    const parentName = String(client.parentName || "Parent");
    const parentEmail = String(client.parentEmail || "");
    const studentName = String(student.studentName || "Student");

    const amountCents = Number(invoice.amountCents ?? 0);
    const amount = Number((amountCents / 100).toFixed(2));
    const issuedAt = invoice.issuedAt?.toDate ? invoice.issuedAt.toDate() : new Date();
    const dueAt = invoice.dueAt?.toDate ? invoice.dueAt.toDate() : issuedAt;
    const invoiceDateStr = ymd(issuedAt);
    const dueDateStr = ymd(dueAt);

    const salesAccountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
    const { xero, tenantId } = await ensureXeroToken();

    // Find or create Xero contact
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

    if (!contactId) {
      await invoiceRef.set({ status: "xero_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ error: "Could not create/find Xero contact" }, { status: 500 });
    }

    // Create ACCREC AUTHORISED invoice in Xero
    const created = await xero.accountingApi.createInvoices(tenantId, {
      invoices: [
        {
          type: Invoice.TypeEnum.ACCREC,
          contact: { contactID: contactId },
          status: Invoice.StatusEnum.AUTHORISED,
          date: invoiceDateStr,
          dueDate: dueDateStr,
          lineAmountTypes: LineAmountTypes.Inclusive,
          reference: `Studyroom • ${studentName} • ${invoiceDateStr}`,
          lineItems: [
            {
              description: String(invoice.description || `Tutoring session • ${studentName}`),
              quantity: 1,
              unitAmount: amount,
              accountCode: salesAccountCode,
            },
          ],
        },
      ],
    });

    const xeroInvoiceId = created.body.invoices?.[0]?.invoiceID ?? null;
    if (!xeroInvoiceId) {
      await invoiceRef.set({ status: "xero_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ error: "Xero did not return invoiceID" }, { status: 500 });
    }

    await invoiceRef.set(
      { xeroInvoiceId, status: "sent", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true, xeroInvoiceId });
  } catch (e: unknown) {
    console.error("[push-invoice-to-xero]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
