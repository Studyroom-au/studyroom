// src/lib/xero.ts
import * as admin from "firebase-admin";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getXeroClient } from "@/lib/xeroAuthClient";

type StoredXero = {
  tenantId?: string;
  tokenSet?: any; // xero-node TokenSet shape
};

let cached: { tenantId: string; tokenSet: any; updatedAt: number } | null = null;

function envTenant() {
  return process.env.XERO_TENANT_ID || "";
}
function envTokenSetJson() {
  return process.env.XERO_TOKEN_SET_JSON || ""; // optional if you ever want env-based storage
}

export async function loadXeroStored(): Promise<StoredXero> {
  // (Optional) allow env-based token storage
  const t = envTenant();
  const tokenJson = envTokenSetJson();
  if (t && tokenJson) {
    try {
      return { tenantId: t, tokenSet: JSON.parse(tokenJson) };
    } catch {
      // ignore
    }
  }

  const db = getAdminDb();
  if (!db) return {};

  const snap = await db.collection("integrations").doc("xero").get();
  if (!snap.exists) return {};

  const data = snap.data() as any;
  return {
    tenantId: String(data.tenantId || ""),
    tokenSet: data.tokenSet || null,
  };
}

function isExpiredSoon(tokenSet: any) {
  // tokenSet.expires_at is usually unix seconds
  const expiresAt = Number(tokenSet?.expires_at || 0);
  if (!expiresAt) return true;

  const msLeft = expiresAt * 1000 - Date.now();
  return msLeft < 60_000; // refresh if less than 60s left
}

export async function ensureXeroToken() {
  // small cache to avoid hammering Firestore
  if (cached && Date.now() - cached.updatedAt < 30_000 && !isExpiredSoon(cached.tokenSet)) {
    const xero = getXeroClient();
    await xero.setTokenSet(cached.tokenSet);
    return { xero, tenantId: cached.tenantId };
  }

  const stored = await loadXeroStored();

  if (!stored.tenantId) {
    throw new Error("Missing XERO_TENANT_ID (Firestore integrations/xero.tenantId not found).");
  }
  if (!stored.tokenSet) {
    throw new Error("Missing Xero tokenSet (Firestore integrations/xero.tokenSet not found).");
  }

  const xero = getXeroClient();

  // IMPORTANT: setTokenSet MUST include access_token (not just refresh_token)
  await xero.setTokenSet(stored.tokenSet);

  // Refresh if expired/soon
  if (isExpiredSoon(stored.tokenSet)) {
    // xero-node refreshToken() requires openIdClient initialization.
    await xero.initialize();
    let refreshed: any;
    try {
      refreshed = await xero.refreshToken();
    } catch {
      const clientId = process.env.XERO_CLIENT_ID;
      const clientSecret = process.env.XERO_CLIENT_SECRET;
      const refreshToken = String(stored.tokenSet?.refresh_token || "");
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          "Unable to refresh Xero token: missing client credentials or refresh_token."
        );
      }
      refreshed = await xero.refreshWithRefreshToken(clientId, clientSecret, refreshToken);
    }
    await xero.setTokenSet(refreshed);

    const db = getAdminDb();
    if (db) {
      await db.collection("integrations").doc("xero").set(
        {
          tenantId: stored.tenantId,
          tokenSet: refreshed,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    cached = { tenantId: stored.tenantId, tokenSet: refreshed, updatedAt: Date.now() };
    return { xero, tenantId: stored.tenantId };
  }

  cached = { tenantId: stored.tenantId, tokenSet: stored.tokenSet, updatedAt: Date.now() };
  return { xero, tenantId: stored.tenantId };
}

export function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
