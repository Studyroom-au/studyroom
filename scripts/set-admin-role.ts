// scripts/set-admin-role.ts
import * as admin from "firebase-admin";

// POINT THIS TO YOUR SERVICE ACCOUNT JSON
import serviceAccount from "../serviceAccount.json";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

async function main() {
  const uid = "9HQdXDFsiXYDfVNOoPoAB0e0Y142";

  // Set custom claim
  await admin.auth().setCustomUserClaims(uid, { role: "admin" });

  // Optional: mirror into Firestore roles/{uid}
  const db = admin.firestore();
  await db.collection("roles").doc(uid).set({ role: "admin" }, { merge: true });

  console.log("Done. You are now admin.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
