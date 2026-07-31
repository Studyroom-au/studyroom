// scripts/audit-packages.js
//
// Read-only production audit. Makes no writes. Reports exactly what Release 1B's
// package_12 -> package_10 rename needs to know before it lands:
//   - how many plans currently have type == "package_12" (if any)
//   - their plan IDs, client/student IDs, status, and creation date
//   - whether each has a corresponding entitlements doc, and its balance
//   - a full breakdown of every plan type currently in production, for context
//
// This does not migrate, modify, or delete anything. Legacy package_12 records
// (if any exist) are explicitly out of scope for automatic migration per the
// Release 1B plan — Lily tracks those manually. This script only reports.
//
// Usage: node scripts/audit-packages.js

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
  const legacySnap = await db.collection("plans").where("type", "==", "package_12").get();

  console.log(`Plans with type == "package_12": ${legacySnap.size}`);

  const legacyPlanIds = [];
  legacySnap.forEach((doc) => {
    const d = doc.data();
    legacyPlanIds.push(doc.id);
    const createdAt = d.createdAt && typeof d.createdAt.toDate === "function" ? d.createdAt.toDate().toISOString() : "n/a";
    console.log(
      `  planId=${doc.id} clientId=${d.clientId ?? "n/a"} studentId=${d.studentId ?? "n/a"} status=${d.status ?? "n/a"} createdAt=${createdAt}`
    );
  });

  if (legacyPlanIds.length > 0) {
    console.log("");
    console.log("Corresponding entitlements:");
    for (const planId of legacyPlanIds) {
      const entSnap = await db.collection("entitlements").doc(planId).get();
      if (entSnap.exists) {
        const e = entSnap.data();
        console.log(
          `  entitlement ${planId}: remainingSessions=${e.remainingSessions ?? "n/a"} bonusRemaining=${e.bonusRemaining ?? "n/a"}`
        );
      } else {
        console.log(`  entitlement ${planId}: NO entitlement doc found`);
      }
    }
  }

  console.log("");
  console.log("All plan types currently in production (for context):");
  const allPlansSnap = await db.collection("plans").select("type").get();
  const counts = {};
  allPlansSnap.forEach((doc) => {
    const t = doc.data().type || "(none)";
    counts[t] = (counts[t] || 0) + 1;
  });
  console.log(`  Total plans: ${allPlansSnap.size}`);
  Object.entries(counts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log("");
  console.log(
    legacyPlanIds.length > 0
      ? `RESULT: ${legacyPlanIds.length} legacy package_12 plan(s) found. These are explicitly out of scope for migration into package_10 — do not touch them. The package_10 rename only needs to add "package_12" to code that must still recognize/display legacy plans (read-only), never write it as a new value.`
      : "RESULT: No package_12 plans found in production. The rename is a safe, direct code change with no legacy-compatibility concern."
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
