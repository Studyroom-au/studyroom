import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { ensureXeroToken, ymd } from "@/lib/xero";
import { Invoice, LineAmountTypes } from "xero-node";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";

type LineItem = {
  // Current schema (serverBilling.ts post-fix, invoiceEngine.ts)
  description?: string | null;
  quantity?: number | null;
  unitAmount?: number | null;    // dollars
  accountCode?: string | null;
  // Legacy schema (serverBilling.ts pre-fix — kept for backward compat with existing Firestore docs)
  desc?: string | null;
  amountCents?: number | null;   // cents
};

type InvoiceDoc = {
  clientId?: string | null;
  studentId?: string | null;
  sessionId?: string | null;
  sessionIds?: string[] | null;
  amountCents?: number | null;
  totalCents?: number | null;
  issuedAt?: { toDate?: () => Date } | null;
  dueAt?: { toDate?: () => Date } | null;
  status?: string | null;
  xeroInvoiceId?: string | null;
  description?: string | null;
  lineItems?: LineItem[] | null;
  dateKey?: string | null;
};

type ClientData = {
  parentName?: string | null;
  parentEmail?: string | null;
};

type StudentData = {
  studentName?: string | null;
};

// ---------------------------------------------------------------------------
// Xero error extraction
// ---------------------------------------------------------------------------

type XeroDebug = {
  message: string;
  name?: string;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  responseStatus?: unknown;
  responseStatusText?: unknown;
  responseData?: unknown;
  responseBody?: unknown;
  responseText?: unknown;
  body?: unknown;
  data?: unknown;
  payload?: unknown;
};

/**
 * Extract every safe, useful field from a Xero SDK / Axios error.
 * Does NOT include auth headers, tokens, or secrets.
 * For Xero 400s the key field is usually responseData (axios) or responseBody (xero-node).
 */
function extractXeroDebug(e: unknown, payload?: unknown): XeroDebug {
  const err = e as Record<string, unknown>;
  const response = err?.response as Record<string, unknown> | undefined;
  return {
    message: e instanceof Error ? e.message : String(e),
    name:    e instanceof Error ? e.name : undefined,
    code:    err?.code,
    status:  err?.status,
    statusCode: err?.statusCode,
    responseStatus:     response?.status,
    responseStatusText: response?.statusText,
    responseData:  response?.data,   // axios: parsed JSON body (most useful for Xero 400s)
    responseBody:  response?.body,   // xero-node: sometimes here instead
    responseText:  response?.text,
    body: err?.body,
    data: err?.data,
    payload,
  };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

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
  if (role !== "admin") throw new Error("Forbidden");
}

// ---------------------------------------------------------------------------
// Error persistence
// ---------------------------------------------------------------------------

/**
 * Persist the failure to both the invoice doc and all linked sessions.
 * Stores the human-readable message on sessions (shown in admin UI)
 * and the full debug object on the invoice doc for investigation.
 */
async function markXeroError(
  invoiceRef: DocumentReference,
  sessionIds: string[],
  message: string,
  debug: unknown
) {
  const db = getAdminDb();
  await invoiceRef.set(
    {
      status: "xero_failed",
      xeroError: message,
      xeroDebug: debug ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  if (sessionIds.length > 0) {
    await Promise.all(
      sessionIds.map((sid) =>
        db.collection("sessions").doc(sid).set(
          { billingStatus: "ERROR", xeroError: message, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        )
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Extract every safe field from any thrown value for diagnostics. */
function extractOuterError(e: unknown): {
  type: string;
  stringValue: string;
  isError: boolean;
  message: string;
  stack?: string;
  keys: string[];
  jsonValue?: unknown;
} {
  const type = typeof e;
  const isError = e instanceof Error;
  let stringValue = "(could not stringify)";
  let jsonValue: unknown;
  try { stringValue = String(e); } catch { /* ignore */ }
  try { jsonValue = JSON.parse(JSON.stringify(e)); } catch { /* ignore */ }
  const keys: string[] = [];
  try {
    if (e !== null && typeof e === "object") {
      keys.push(...Object.keys(e as object));
    }
  } catch { /* ignore */ }
  return {
    type,
    stringValue,
    isError,
    message: isError ? (e as Error).message : stringValue,
    stack:   isError ? (e as Error).stack : undefined,
    keys,
    jsonValue,
  };
}

export async function POST(req: Request) {
  // Declared outside the try block so the outer catch can reference them.
  let invoiceRef: DocumentReference | null = null;
  const sessionIds: string[] = [];
  let step = "start";

  try {
    step = "auth";
    if (!isInternalCall(req)) {
      await verifyUserIsAllowed(req);
    }

    step = "parse-body";
    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoiceId ?? "").trim();
    console.log("[push-invoice-to-xero] received invoiceId:", invoiceId || "(empty)");
    if (!invoiceId) return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 });

    step = "load-invoice";
    const db = getAdminDb();
    if (!db) throw new Error("Admin DB not configured.");

    invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const invoice = (invoiceSnap.data() ?? {}) as InvoiceDoc;
    console.log("[push-invoice-to-xero] loaded invoice doc — status:", invoice.status, "amountCents:", invoice.amountCents, "lineItems:", invoice.lineItems?.length ?? 0);

    step = "build-session-list";
    if (invoice.sessionId) sessionIds.push(invoice.sessionId);
    if (Array.isArray(invoice.sessionIds)) sessionIds.push(...invoice.sessionIds);

    // Skip if already in Xero.
    if (
      invoice.xeroInvoiceId &&
      (invoice.status === "draft_created" || invoice.status === "approved" || invoice.status === "sent")
    ) {
      return NextResponse.json({ ok: true, skipped: true, xeroInvoiceId: invoice.xeroInvoiceId });
    }

    step = "load-client";
    const clientId = String(invoice.clientId ?? "");
    if (!clientId) {
      return NextResponse.json({ error: "Invoice missing clientId" }, { status: 400 });
    }

    const clientSnap = await db.collection("clients").doc(clientId).get();
    const client = (clientSnap.data() ?? {}) as ClientData;
    const parentName = String(client.parentName || "Parent");
    const parentEmail = String(client.parentEmail || "");
    console.log("[push-invoice-to-xero] loaded client — parentEmail:", parentEmail || "(none)");

    step = "load-student";
    const studentId = String(invoice.studentId ?? "");
    let studentName = "Student";
    if (studentId) {
      const studentSnap = await db.collection("students").doc(studentId).get();
      studentName = String((studentSnap.data() as StudentData | undefined)?.studentName || "Student");
    }
    console.log("[push-invoice-to-xero] loaded student — studentName:", studentName);

    step = "calc-amounts";
    const amountCents = Number(invoice.amountCents ?? invoice.totalCents ?? 0);
    const amount = Number((amountCents / 100).toFixed(2));
    const issuedAt = invoice.issuedAt?.toDate ? invoice.issuedAt.toDate() : new Date();
    const dueAt   = invoice.dueAt?.toDate   ? invoice.dueAt.toDate()   : issuedAt;
    const invoiceDateStr = ymd(issuedAt);
    const dueDateStr     = ymd(dueAt);

    step = "ensure-xero-token";
    const salesAccountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
    const { xero, tenantId } = await ensureXeroToken();
    console.log("[push-invoice-to-xero] Xero token ready — tenantId:", tenantId);

    step = "resolve-contact";
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
      const msg = "Could not create/find Xero contact";
      await markXeroError(invoiceRef, sessionIds, msg, null);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    console.log("[push-invoice-to-xero] resolved contactId:", contactId);

    step = "build-line-items";
    // Supports two schemas:
    //   Current: { description, quantity, unitAmount (dollars), accountCode }
    //   Legacy:  { desc, amountCents (cents) }  — from old serverBilling invoices in Firestore
    const xeroLineItems: { description: string; quantity: number; unitAmount: number; accountCode: string }[] =
      invoice.lineItems && invoice.lineItems.length > 0
        ? invoice.lineItems.map((li) => {
            const description = String(li.description ?? li.desc ?? `Tutoring session · ${studentName}`);
            const quantity    = Number(li.quantity ?? 1);
            const unitAmount  =
              li.unitAmount != null
                ? Number(li.unitAmount)
                : Number((Number(li.amountCents ?? 0) / 100).toFixed(2));
            const accountCode = String(li.accountCode || salesAccountCode);
            return { description, quantity, unitAmount, accountCode };
          })
        : [
            {
              description: String(invoice.description || `Tutoring session · ${studentName}`),
              quantity:    1,
              unitAmount:  amount,
              accountCode: salesAccountCode,
            },
          ];
    console.log("[push-invoice-to-xero] built line items:", JSON.stringify(xeroLineItems));

    step = "zero-guard";
    const lineItemsTotal = xeroLineItems.reduce((sum, li) => sum + li.unitAmount, 0);
    if (lineItemsTotal <= 0) {
      const msg = `Refusing to create $0 Xero draft — line items total $0.00 (invoice.amountCents=${amountCents})`;
      await markXeroError(invoiceRef, sessionIds, msg, { xeroLineItems, amountCents });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    console.log("[push-invoice-to-xero] passed $0 guard — total:", lineItemsTotal);

    step = "build-payload";
    const referenceLabel = invoice.dateKey
      ? `Studyroom · Family · ${invoice.dateKey}`
      : `Studyroom · ${studentName} · ${invoiceDateStr}`;

    const xeroPayload = {
      tenantId,
      contactId,
      type:            "ACCREC",
      status:          "DRAFT",
      date:            invoiceDateStr,
      dueDate:         dueDateStr,
      lineAmountTypes: "Inclusive",
      reference:       referenceLabel,
      lineItems:       xeroLineItems,
    };

    step = "create-xero-invoice";
    console.log("[push-invoice-to-xero] calling createInvoices...");
    let xeroInvoiceId: string | null = null;
    try {
      const created = await xero.accountingApi.createInvoices(tenantId, {
        invoices: [
          {
            type:            Invoice.TypeEnum.ACCREC,
            contact:         { contactID: contactId },
            status:          Invoice.StatusEnum.DRAFT,
            date:            invoiceDateStr,
            dueDate:         dueDateStr,
            lineAmountTypes: LineAmountTypes.Inclusive,
            reference:       referenceLabel,
            lineItems:       xeroLineItems,
          },
        ],
      });
      xeroInvoiceId = created.body.invoices?.[0]?.invoiceID ?? null;
      console.log("[push-invoice-to-xero] createInvoices succeeded — xeroInvoiceId:", xeroInvoiceId);
    } catch (xeroErr: unknown) {
      const debug = extractXeroDebug(xeroErr, xeroPayload);
      console.error("[XERO DRAFT ERROR]", JSON.stringify({
        message:            debug.message,
        status:             debug.status,
        responseStatus:     debug.responseStatus,
        responseStatusText: debug.responseStatusText,
        responseData:       debug.responseData,
        responseBody:       debug.responseBody,
        responseText:       debug.responseText,
        body:               debug.body,
        data:               debug.data,
        payload:            debug.payload,
      }, null, 2));

      try {
        await markXeroError(invoiceRef, sessionIds, debug.message, debug);
      } catch (markErr) {
        console.error("[push-invoice-to-xero] markXeroError failed after createInvoices error:", markErr);
      }

      return NextResponse.json({ error: debug.message, xeroDebug: debug }, { status: 500 });
    }

    step = "check-invoice-id";
    if (!xeroInvoiceId) {
      const msg = "Xero did not return invoiceID";
      await markXeroError(invoiceRef, sessionIds, msg, { payload: xeroPayload });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    step = "update-invoice-doc";
    await invoiceRef.set(
      {
        xeroInvoiceId,
        xeroInvoiceStatus: "DRAFT",
        status:            "draft_created",
        updatedAt:         FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    step = "update-sessions";
    if (sessionIds.length > 0) {
      await Promise.all(
        sessionIds.map((sid) =>
          db.collection("sessions").doc(sid).set(
            { xeroInvoiceId, billingStatus: "DRAFT_CREATED", updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          )
        )
      );
    }

    console.log("[push-invoice-to-xero] done — xeroInvoiceId:", xeroInvoiceId);
    return NextResponse.json({ ok: true, xeroInvoiceId });

  } catch (e: unknown) {
    // Outer catch: anything NOT covered by the inner Xero try/catch.
    // Extracts every available field so the thrown value is never silently lost.
    const outerDebug = extractOuterError(e);
    console.error("[push-invoice-to-xero] outer error at step:", step, JSON.stringify(outerDebug, null, 2));

    if (invoiceRef) {
      try {
        await markXeroError(invoiceRef, sessionIds, outerDebug.message, { step, ...outerDebug });
      } catch (markErr) {
        console.error("[push-invoice-to-xero] markXeroError failed in outer catch:", markErr);
      }
    }

    return NextResponse.json(
      {
        error: outerDebug.message,
        debug: {
          step,
          type:        outerDebug.type,
          stringValue: outerDebug.stringValue,
          isError:     outerDebug.isError,
          message:     outerDebug.message,
          stack:       outerDebug.stack,
          keys:        outerDebug.keys,
        },
      },
      { status: 500 }
    );
  }
}
