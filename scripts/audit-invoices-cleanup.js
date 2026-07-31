// scripts/audit-invoices-cleanup.js
//
// Read-only production audit. Makes no writes. Reports every invoice record
// currently visible on /hub/admin/invoices (the same three queries that page
// runs), whether its referenced student/client/session still exist, and
// cross-references every other collection that could hold a dangling
// pointer to an invoice ID, before any cleanup is proposed or performed.
//
// Usage: node scripts/audit-invoices-cleanup.js

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").includes("\\n")
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : process.env.FIREBASE_PRIVATE_KEY;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();

function fmt(ts) {
  if (!ts || !ts.toDate) return "n/a";
  return ts.toDate().toISOString();
}

async function exists(collection, id) {
  if (!id) return false;
  const snap = await db.collection(collection).doc(id).get();
  return snap.exists;
}

async function main() {
  // ── Exactly the three queries /hub/admin/invoices/page.tsx runs ──────────
  const needsActionQ = db
    .collection("invoices")
    .where("status", "in", ["pending_xero", "xero_failed"])
    .orderBy("issuedAt", "desc");
  const draftQ = db.collection("invoices").where("status", "==", "draft_created").orderBy("issuedAt", "desc");
  const awaitingPaymentQ = db
    .collection("invoices")
    .where("status", "in", ["sent", "overdue"])
    .orderBy("issuedAt", "desc");

  const [naSnap, draftSnap, awaitingSnap] = await Promise.all([
    needsActionQ.get(),
    draftQ.get(),
    awaitingPaymentQ.get(),
  ]);

  const sections = [
    { name: "Needs Attention (pending_xero / xero_failed)", snap: naSnap },
    { name: "In Xero — Drafts (draft_created)", snap: draftSnap },
    { name: "Sent / Overdue — Awaiting Payment", snap: awaitingSnap },
  ];

  console.log("── /hub/admin/invoices — visible record counts ───────────────");
  sections.forEach((s) => console.log(`  ${s.name}: ${s.snap.size}`));
  const totalVisible = naSnap.size + draftSnap.size + awaitingSnap.size;
  console.log(`  TOTAL visible: ${totalVisible}\n`);

  // Preload every session (to find any session.invoiceId reference back to
  // any invoice, not just ones this page happens to show) and every
  // invoice-referencing collection we know of.
  const [allSessionsSnap, allPlansSnap, allEntitlementsSnap] = await Promise.all([
    db.collection("sessions").get(),
    db.collection("plans").get(),
    db.collection("entitlements").get(),
  ]);

  const sessionsByInvoiceId = new Map();
  allSessionsSnap.forEach((d) => {
    const iid = d.data().invoiceId;
    if (iid) {
      if (!sessionsByInvoiceId.has(iid)) sessionsByInvoiceId.set(iid, []);
      sessionsByInvoiceId.get(iid).push(d.id);
    }
  });

  const allRows = [];
  for (const section of sections) {
    for (const docSnap of section.snap.docs) {
      const inv = docSnap.data();
      const id = docSnap.id;

      const studentExists = await exists("students", inv.studentId);
      const clientExists = await exists("clients", inv.clientId);
      const sessionExists = inv.sessionId ? await exists("sessions", inv.sessionId) : null;
      const planExists = inv.planId ? await exists("plans", inv.planId) : null;

      let studentName = null;
      if (studentExists) {
        const s = await db.collection("students").doc(inv.studentId).get();
        studentName = s.data().studentName ?? null;
      }
      let parentName = null;
      if (clientExists) {
        const c = await db.collection("clients").doc(inv.clientId).get();
        parentName = c.data().parentName ?? null;
      }

      const referencingSessions = sessionsByInvoiceId.get(id) ?? [];
      // Cross-check: does the session this invoice claims to belong to
      // (inv.sessionId) actually point back at this invoice?
      let sessionBackrefMatches = null;
      if (inv.sessionId) {
        const sSnap = await db.collection("sessions").doc(inv.sessionId).get();
        sessionBackrefMatches = sSnap.exists ? sSnap.data().invoiceId === id : false;
      }

      const looksLikeTest =
        (studentName && /test|fake|dummy/i.test(studentName)) ||
        (parentName && /test|fake|dummy/i.test(parentName)) ||
        (!inv.studentId && !inv.clientId) ||
        (inv.studentId && !studentExists) ||
        (inv.clientId && !clientExists) ||
        (inv.sessionId && !sessionExists) ||
        (inv.planId && !planExists);

      allRows.push({
        section: section.name,
        id,
        status: inv.status ?? null,
        amountCents: inv.amountCents ?? null,
        totalCents: inv.totalCents ?? null,
        balanceCents: inv.balanceCents ?? null,
        issuedAt: fmt(inv.issuedAt),
        studentId: inv.studentId ?? null,
        studentName,
        studentExists,
        clientId: inv.clientId ?? null,
        parentName,
        clientExists,
        sessionId: inv.sessionId ?? null,
        sessionExists,
        sessionBackrefMatches,
        planId: inv.planId ?? null,
        planExists,
        invoiceKind: inv.invoiceKind ?? "session",
        xeroInvoiceId: inv.xeroInvoiceId ?? null,
        xeroError: inv.xeroError ?? null,
        referencingSessions,
        looksLikeTest,
      });
    }
  }

  console.log("── Per-record detail ──────────────────────────────────────────\n");
  allRows.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.section}`);
    console.log(`    invoice id:          ${r.id}`);
    console.log(`    status:              ${r.status}`);
    console.log(`    invoiceKind:         ${r.invoiceKind}`);
    console.log(`    amountCents:         ${r.amountCents}  totalCents: ${r.totalCents}  balanceCents: ${r.balanceCents}`);
    console.log(`    issuedAt:            ${r.issuedAt}`);
    console.log(`    studentId:           ${r.studentId}  (exists: ${r.studentExists})  name: ${r.studentName}`);
    console.log(`    clientId:            ${r.clientId}  (exists: ${r.clientExists})  parent: ${r.parentName}`);
    console.log(`    sessionId:           ${r.sessionId}  (exists: ${r.sessionExists})  session.invoiceId matches this doc: ${r.sessionBackrefMatches}`);
    console.log(`    planId:              ${r.planId}  (exists: ${r.planExists})`);
    console.log(`    xeroInvoiceId:       ${r.xeroInvoiceId}`);
    console.log(`    xeroError:           ${r.xeroError}`);
    console.log(`    other sessions pointing invoiceId at this doc: ${JSON.stringify(r.referencingSessions)}`);
    console.log(`    looksLikeTest (heuristic only): ${r.looksLikeTest}`);
    console.log("");
  });

  // ── Reverse cross-reference: any entitlements/plans docs mentioning any
  // of these invoice IDs anywhere in their own fields (defensive check —
  // current schema doesn't store invoiceId on plans/entitlements, but a
  // read-only scan costs nothing and catches any surprise). ────────────────
  const visibleIds = new Set(allRows.map((r) => r.id));
  const planHits = [];
  allPlansSnap.forEach((d) => {
    const data = d.data();
    if (data.invoiceId && visibleIds.has(data.invoiceId)) planHits.push({ planId: d.id, invoiceId: data.invoiceId });
  });
  const entitlementHits = [];
  allEntitlementsSnap.forEach((d) => {
    const data = d.data();
    if (data.invoiceId && visibleIds.has(data.invoiceId)) entitlementHits.push({ entitlementId: d.id, invoiceId: data.invoiceId });
  });

  console.log("── Reverse-reference scan (plans/entitlements storing an invoiceId field) ──");
  console.log(`  plans referencing a visible invoice:        ${JSON.stringify(planHits)}`);
  console.log(`  entitlements referencing a visible invoice: ${JSON.stringify(entitlementHits)}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
