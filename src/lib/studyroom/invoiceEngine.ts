import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { classifyAndPriceSessions, type SessionForPricing, type PricedSession } from "./siblingPricing";
import { CASUAL_INVOICE_DUE_DAYS } from "./billing";

type RawSession = {
  studentId?: string | null;
  clientId?: string | null;
  planId?: string | null;
  startAt?: FirebaseFirestore.Timestamp | null;
  endAt?: FirebaseFirestore.Timestamp | null;
  status?: string | null;
};

type PlanDoc = {
  type?: string | null;
};

type StudentDoc = {
  studentName?: string | null;
};

type ClientDoc = {
  parentName?: string | null;
  parentEmail?: string | null;
};

function brisbaneTimeStr(ms: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

function brisbaneDateLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function rateLabelFor(rateType: string): string {
  if (rateType === "backToBack") return "Sibling – back to back";
  if (rateType === "sameTime") return "Sibling – same time";
  return "Standard";
}

/** Parse "YYYY-MM-DD" → Brisbane midnight boundaries as Firestore Timestamps */
function brisbaneDayBounds(dateKey: string): { startOfDay: Timestamp; endOfDay: Timestamp } {
  const [year, month, day] = dateKey.split("-").map(Number);
  // Brisbane is UTC+10 — midnight AEST = (dateKey 00:00:00) - 10h offset = (dateKey-1 14:00:00 UTC)
  const brisbaneMidnightMs = Date.UTC(year, month - 1, day) - 10 * 3600 * 1000;
  return {
    startOfDay: Timestamp.fromMillis(brisbaneMidnightMs),
    endOfDay: Timestamp.fromMillis(brisbaneMidnightMs + 24 * 3600 * 1000),
  };
}

export async function generateFamilyInvoice(params: {
  clientId: string;
  dateKey: string;
  triggeredBy: "completion" | "eod_fallback";
}): Promise<{ invoiceDocId: string; skippedPackageSessions: number }> {
  const { clientId, dateKey } = params;
  const db = getAdminDb();
  const { startOfDay, endOfDay } = brisbaneDayBounds(dateKey);

  const sessionSnap = await db.collection("sessions")
    .where("clientId", "==", clientId)
    .where("startAt", ">=", startOfDay)
    .where("startAt", "<", endOfDay)
    .get();

  let skippedPackageSessions = 0;

  // Batch-fetch all unique planIds
  const planIds = Array.from(
    new Set(sessionSnap.docs.map((d) => String(d.data().planId ?? "")).filter(Boolean))
  );
  const planMap: Record<string, PlanDoc> = {};
  await Promise.all(
    planIds.map(async (pid) => {
      const snap = await db.collection("plans").doc(pid).get();
      if (snap.exists) planMap[pid] = snap.data() as PlanDoc;
    })
  );

  // Separate casual from package sessions
  const casualSessionIds: string[] = [];
  const sessionsForPricing: SessionForPricing[] = [];

  for (const docSnap of sessionSnap.docs) {
    const data = docSnap.data() as RawSession;
    const planId = String(data.planId ?? "");
    const planType = String(planMap[planId]?.type ?? "").toLowerCase();

    if (planType === "package_5" || planType === "package_12") {
      console.log(`[invoiceEngine] Skipping package session ${docSnap.id} (${planType})`);
      skippedPackageSessions++;
      continue;
    }

    casualSessionIds.push(docSnap.id);
    sessionsForPricing.push({
      id: docSnap.id,
      startMs: data.startAt?.toMillis() ?? 0,
      endMs: data.endAt?.toMillis() ?? 0,
      planType: planMap[planId]?.type ?? null,
    });
  }

  if (sessionsForPricing.length === 0) {
    return { invoiceDocId: "", skippedPackageSessions };
  }

  const pricedSessions: PricedSession[] = classifyAndPriceSessions(sessionsForPricing);
  const totalCents = pricedSessions.reduce((sum, s) => sum + s.rateCents, 0);

  // Batch-fetch student names
  const studentIds = Array.from(
    new Set(
      sessionSnap.docs
        .filter((d) => casualSessionIds.includes(d.id))
        .map((d) => String((d.data() as RawSession).studentId ?? ""))
        .filter(Boolean)
    )
  );
  const studentMap: Record<string, StudentDoc> = {};
  await Promise.all(
    studentIds.map(async (sid) => {
      const snap = await db.collection("students").doc(sid).get();
      if (snap.exists) studentMap[sid] = snap.data() as StudentDoc;
    })
  );

  // Build a lookup from sessionId → raw session data
  const rawBySessionId: Record<string, RawSession> = {};
  for (const docSnap of sessionSnap.docs) {
    if (casualSessionIds.includes(docSnap.id)) {
      rawBySessionId[docSnap.id] = docSnap.data() as RawSession;
    }
  }

  // Create the invoice doc as pending_xero — admin will generate the Xero draft manually
  const invoiceRef = db.collection("invoices").doc();
  const now = new Date();
  const dueAt = new Date(now.getTime() + CASUAL_INVOICE_DUE_DAYS * 86400000);

  // Build line item descriptions for later use when admin pushes to Xero
  const salesAccountCode = process.env.XERO_SALES_ACCOUNT_CODE || "200";
  const lineItems = pricedSessions.map((priced) => {
    const raw = rawBySessionId[priced.id];
    const studentName = studentMap[String(raw?.studentId ?? "")]?.studentName ?? "Student";
    const dateLabel = brisbaneDateLabel(priced.startMs);
    const timeRange = `${brisbaneTimeStr(priced.startMs)}–${brisbaneTimeStr(priced.endMs)}`;
    const rateLabel = rateLabelFor(priced.rateType);
    return {
      description: `${studentName} · ${dateLabel} · ${timeRange} · ${rateLabel}`,
      quantity: 1,
      unitAmount: Number((priced.rateCents / 100).toFixed(2)),
      accountCode: salesAccountCode,
    };
  });

  await invoiceRef.set({
    clientId,
    dateKey,
    sessionIds: casualSessionIds,
    status: "pending_xero",
    rateSummary: pricedSessions,
    lineItems,
    totalCents,
    dueAt: Timestamp.fromDate(dueAt),
    issuedAt: Timestamp.fromDate(now),
    triggeredBy: params.triggeredBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Mark each casual session as ready for admin invoice review
  await Promise.all(
    casualSessionIds.map((sid) =>
      db.collection("sessions").doc(sid).set(
        {
          invoiceId: invoiceRef.id,
          billingStatus: "READY_TO_INVOICE",
          billingOutcome: "invoice",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );

  return { invoiceDocId: invoiceRef.id, skippedPackageSessions };
}
