// scripts/audit-bluecard-fields.js
//
// Read-only production audit. Makes no writes. Reports exactly what the
// blueCardNumber/blueCardExpiresAt -> driverLicenceNumber/driverLicenceExpiry
// swap needs to know before it lands: does any tutors/{uid} document
// currently hold a real value in the old optional blueCardNumber/
// blueCardExpiresAt fields? If so, those values must be preserved
// (never auto-migrated into driver-licence fields — a Blue Card number is
// not a driver's licence number) until their meaning is confirmed with Lily.
//
// The blueCardNumber value itself is masked in this report (only the last 4
// characters are shown) since it's a real compliance ID — this script is for
// deciding whether ANY data exists, not for reading the values themselves.
//
// Usage: node scripts/audit-bluecard-fields.js

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

function mask(value) {
  const s = String(value);
  if (s.length <= 4) return "*".repeat(s.length);
  return `${"*".repeat(s.length - 4)}${s.slice(-4)}`;
}

async function main() {
  const snap = await db.collection("tutors").get();
  console.log(`Total tutors/{uid} documents: ${snap.size}`);

  const withNumber = [];
  const withExpiry = [];

  snap.forEach((doc) => {
    const d = doc.data();
    const num = d.blueCardNumber;
    const exp = d.blueCardExpiresAt;
    if (typeof num === "string" && num.trim().length > 0) {
      withNumber.push({ uid: doc.id, masked: mask(num.trim()) });
    }
    if (exp && typeof exp.toDate === "function") {
      withExpiry.push({ uid: doc.id, date: exp.toDate().toISOString().slice(0, 10) });
    }
  });

  console.log("");
  console.log(`Tutors with a non-empty blueCardNumber: ${withNumber.length}`);
  withNumber.forEach((r) => console.log(`  uid=${r.uid} blueCardNumber=${r.masked}`));

  console.log("");
  console.log(`Tutors with a non-null blueCardExpiresAt: ${withExpiry.length}`);
  withExpiry.forEach((r) => console.log(`  uid=${r.uid} blueCardExpiresAt=${r.date}`));

  console.log("");
  if (withNumber.length === 0 && withExpiry.length === 0) {
    console.log("RESULT: No tutor has any data in the old optional blueCardNumber/blueCardExpiresAt fields. Safe to remove the fields from the model/UI cleanly — no preservation needed.");
  } else {
    console.log(
      `RESULT: ${withNumber.length} tutor(s) have a blueCardNumber value and/or ${withExpiry.length} have a blueCardExpiresAt value. Do NOT auto-migrate these into driver-licence fields. Preserve them (keep the fields readable, just remove them from the editable/required allowlists and UI) until their meaning is confirmed with Lily.`
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
