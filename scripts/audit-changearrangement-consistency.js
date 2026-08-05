// scripts/audit-changearrangement-consistency.js
//
// Read-only production audit. Verifies that the earlier failed
// Casual -> package changeArrangement attempt (which hit the now-fixed
// "reads after writes" transaction-ordering bug) left no partial state.
// Firestore transactions are all-or-nothing — a thrown error inside the
// transaction callback means NOTHING commits — but this check verifies
// that empirically against real production data rather than relying on
// that guarantee alone.
//
// Checks, across every plan/entitlement/student:
//   1. Any plan with status "expired" whose owning student's activePlanId
//      does NOT point at a different, currently-active plan (an orphaned
//      expiry — the old plan flipped but no new one replaced it).
//   2. Any entitlement document with no matching plan document.
//   3. Any plan of type package_5/package_10/package_12 with no matching
//      entitlement document.
//   4. Any student whose activePlanId points at a plan document that does
//      not exist.
//   5. Any package_purchase invoice with no matching plan document.
//
// Usage: node scripts/audit-changearrangement-consistency.js

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

async function main() {
  const [studentsSnap, plansSnap, entitlementsSnap, invoicesSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("plans").get(),
    db.collection("entitlements").get(),
    db.collection("invoices").get(),
  ]);

  const plansById = new Map();
  plansSnap.forEach((d) => plansById.set(d.id, d.data()));
  const entitlementsById = new Map();
  entitlementsSnap.forEach((d) => entitlementsById.set(d.id, d.data()));
  const studentsById = new Map();
  studentsSnap.forEach((d) => studentsById.set(d.id, d.data()));

  console.log(`Students: ${studentsSnap.size}  Plans: ${plansSnap.size}  Entitlements: ${entitlementsSnap.size}  Invoices: ${invoicesSnap.size}\n`);

  // 1. Orphaned expiries: an expired plan whose student's activePlanId does
  // not point at a different, currently-existing, active plan.
  console.log("── Check 1: orphaned expired plans (expired but student has no other active plan) ──");
  let orphanedExpiries = 0;
  plansSnap.forEach((d) => {
    const plan = d.data();
    if (plan.status !== "expired") return;
    const studentId = plan.studentId;
    if (!studentId) return;
    const student = studentsById.get(studentId);
    if (!student) {
      console.log(`  EXPIRED plan ${d.id} references missing student ${studentId}`);
      orphanedExpiries++;
      return;
    }
    const activePlanId = student.activePlanId;
    if (!activePlanId || activePlanId === d.id) {
      console.log(`  ORPHANED: plan ${d.id} (student ${studentId}) is expired but student.activePlanId = ${activePlanId ?? "null"}`);
      orphanedExpiries++;
      return;
    }
    const activePlan = plansById.get(activePlanId);
    if (!activePlan) {
      console.log(`  ORPHANED: plan ${d.id} (student ${studentId}) is expired but activePlanId ${activePlanId} does not exist`);
      orphanedExpiries++;
      return;
    }
    if (activePlan.status !== "active") {
      console.log(`  SUSPECT: plan ${d.id} (student ${studentId}) is expired; student's activePlanId ${activePlanId} exists but has status "${activePlan.status}"`);
      orphanedExpiries++;
    }
  });
  console.log(`  Total flagged: ${orphanedExpiries}\n`);

  // 2. Entitlements with no matching plan.
  console.log("── Check 2: entitlements with no matching plan document ──");
  let orphanedEntitlements = 0;
  entitlementsSnap.forEach((d) => {
    if (!plansById.has(d.id)) {
      console.log(`  entitlement ${d.id} has no matching plans/${d.id}`);
      orphanedEntitlements++;
    }
  });
  console.log(`  Total flagged: ${orphanedEntitlements}\n`);

  // 3. Package plans with no matching entitlement.
  console.log("── Check 3: package_5/package_10/package_12 plans with no matching entitlement ──");
  let missingEntitlements = 0;
  plansSnap.forEach((d) => {
    const plan = d.data();
    if (!["package_5", "package_10", "package_12"].includes(plan.type)) return;
    if (!entitlementsById.has(d.id)) {
      console.log(`  plan ${d.id} (type ${plan.type}, status ${plan.status}) has no matching entitlements/${d.id}`);
      missingEntitlements++;
    }
  });
  console.log(`  Total flagged: ${missingEntitlements}\n`);

  // 4. Students whose activePlanId points at nothing.
  console.log("── Check 4: students whose activePlanId points at a nonexistent plan ──");
  let danglingActivePlanId = 0;
  studentsSnap.forEach((d) => {
    const s = d.data();
    if (s.activePlanId && !plansById.has(s.activePlanId)) {
      console.log(`  student ${d.id} (${s.studentName ?? "?"}) activePlanId=${s.activePlanId} does not exist`);
      danglingActivePlanId++;
    }
  });
  console.log(`  Total flagged: ${danglingActivePlanId}\n`);

  // 5. package_purchase invoices with no matching plan.
  console.log("── Check 5: package_purchase invoices with no matching plan ──");
  let orphanedInvoices = 0;
  invoicesSnap.forEach((d) => {
    const inv = d.data();
    if (inv.invoiceKind !== "package_purchase") return;
    if (inv.planId && !plansById.has(inv.planId)) {
      console.log(`  invoice ${d.id} (studentId ${inv.studentId}) references missing plan ${inv.planId}`);
      orphanedInvoices++;
    }
  });
  console.log(`  Total flagged: ${orphanedInvoices}\n`);

  const total = orphanedExpiries + orphanedEntitlements + missingEntitlements + danglingActivePlanId + orphanedInvoices;
  console.log(`═══ TOTAL INCONSISTENCIES FOUND: ${total} ═══`);

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
