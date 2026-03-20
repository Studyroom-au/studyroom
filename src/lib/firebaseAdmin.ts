// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

let app: admin.app.App | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[firebaseAdmin] Missing env var: ${name}`);
  }
  return value;
}

export function getAdminApp(): admin.app.App {
  if (app) return app;

  const projectId = getRequiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
  const rawKey = getRequiredEnv("FIREBASE_PRIVATE_KEY");

  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;

  if (admin.apps.length === 0) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    app = admin.app();
  }

  return app;
}

export function getAdminAuth(): admin.auth.Auth {
  return admin.auth(getAdminApp());
}

export function getAdminDb(): admin.firestore.Firestore {
  return admin.firestore(getAdminApp());
}

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

export async function verifyIdTokenFromRequest(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization token.");

  return await getAdminAuth().verifyIdToken(token);
}