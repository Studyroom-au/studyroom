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

// ---------------------------------------------------------------------------
// Shared admin identity — Release 1A, Stage 1 (A8)
//
// Single source of truth for "which emails count as Admin", consolidating what
// used to be independently redeclared (and disagreeing — one email vs. two,
// or one vs. two) across every route that gates on admin email. Matches the
// two admin emails already recognized by firestore.rules' isAdmin().
//
// The actual constant/function live in src/lib/adminEmails.ts (zero
// dependencies, so it's also safely importable from client components like
// useUserRole and hub/layout.tsx) — re-exported here so every server route
// that already imports from "@/lib/firebaseAdmin" keeps working unchanged.
//
// This only fixes the email-allowlist disagreement. Each call site's existing
// secondary fallback (custom-claim role==="admin", or a Firestore roles/{uid}
// lookup) is left exactly as it was — homogenizing those is out of scope here.
// ---------------------------------------------------------------------------

export { ADMIN_EMAILS, isAdminEmail } from "./adminEmails";

// ---------------------------------------------------------------------------
// Merge-safe role claim setter — Release 1A, Stage 2 follow-up
//
// role is confirmed as the only custom claim ever set anywhere in this
// codebase today (verified by grepping every setCustomUserClaims call site).
// setCustomUserClaims() replaces the ENTIRE claims object, not just the given
// key — so calling it directly with only { role } would silently discard any
// other claim the moment a second one is ever introduced. This helper reads
// the user's existing claims first and merges, so every call site is safe
// regardless of what else might be set on the account, now or in the future.
// ---------------------------------------------------------------------------

export async function setUserRoleClaim(uid: string, role: string): Promise<void> {
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  const existingClaims = user.customClaims ?? {};
  await auth.setCustomUserClaims(uid, { ...existingClaims, role });
}