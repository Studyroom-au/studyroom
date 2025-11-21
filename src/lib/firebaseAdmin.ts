// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

let app: admin.app.App | null = null;
let warnedMissing = false;

function hasAdminEnv() {
  return (
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getAdminApp(): admin.app.App | null {
  if (app) return app;

  if (!hasAdminEnv()) {
    if (!warnedMissing && process.env.NODE_ENV !== "production") {
      console.warn(
        "[firebaseAdmin] Firebase Admin env vars missing. Admin features are disabled in this environment."
      );
    }
    warnedMissing = true;
    return null;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID as string;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY as string;

  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;

  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (err) {
    console.error("[firebaseAdmin] init failed:", err);
    return null;
  }

  return app;
}

export function getAdminAuth(): admin.auth.Auth | null {
  const a = getAdminApp();
  return a ? admin.auth(a) : null;
}
