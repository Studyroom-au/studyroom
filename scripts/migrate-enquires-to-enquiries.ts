import "dotenv/config";
import * as admin from "firebase-admin";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = must("FIREBASE_PROJECT_ID");
  const clientEmail = must("FIREBASE_CLIENT_EMAIL");
  const privateKey = must("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function run() {
  const app = initAdmin();
  const db = admin.firestore(app);
  const dryRun = process.argv.includes("--dry-run");
  const keepSource = process.argv.includes("--keep-source");

  const sourceCol = db.collection("enquires");
  const targetCol = db.collection("enquiries");

  const snap = await sourceCol.get();
  if (snap.empty) {
    console.log("No docs found in 'enquires'.");
    return;
  }

  let moved = 0;
  for (const d of snap.docs) {
    const src = d.data();
    const targetRef = targetCol.doc(d.id);
    const targetSnap = await targetRef.get();

    if (targetSnap.exists) {
      console.log(`Skip ${d.id}: already exists in enquiries`);
      continue;
    }

    if (!dryRun) {
      await targetRef.set({
        ...src,
        migratedFrom: "enquires",
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (!keepSource) await d.ref.delete();
    }
    moved += 1;
    console.log(`${dryRun ? "Would move" : "Moved"} ${d.id}`);
  }

  console.log(
    `${dryRun ? "Dry run complete" : "Done"}. ${moved} document(s) ${dryRun ? "would be moved" : "moved"}.`
  );
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

