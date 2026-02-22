import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getXeroClient } from "@/lib/xeroAuthClient";

type TokenSet = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  [k: string]: unknown;
};

type XeroConnection = { tenantId?: string };

function htmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[c] || c;
  });
}

function readCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  const hit = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.split("=").slice(1).join("=")) : null;
}

async function exchangeCodeForToken(code: string): Promise<TokenSet> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Xero env vars (XERO_CLIENT_ID / XERO_CLIENT_SECRET / XERO_REDIRECT_URI).");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const r = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json: unknown = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  }

  const token = (json ?? {}) as TokenSet;

  if (!token.expires_at && typeof token.expires_in === "number") {
    token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
  }

  if (!token.refresh_token) {
    throw new Error("Xero token exchange returned no refresh_token. Check scopes / app setup.");
  }

  return token;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) return new NextResponse("Missing code", { status: 400 });
    if (!state) return new NextResponse("Missing state", { status: 400 });

    // Validate state cookie
    const cookieState = readCookie(req, "xero_oauth_state");
    if (!cookieState || cookieState !== state) {
      return new NextResponse("Invalid state. Please restart Xero connection.", { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      throw new Error(
        "Firebase Admin DB not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
      );
    }

    // Exchange code -> tokenSet
    const tokenSet = await exchangeCodeForToken(code);

    // Fetch tenantId using xero client
    const xero = getXeroClient();
    await xero.setTokenSet(tokenSet);

    const connectionsUnknown: unknown = await xero.updateTenants();
    const connections = Array.isArray(connectionsUnknown)
      ? (connectionsUnknown as XeroConnection[])
      : [];

    const tenantId = connections?.[0]?.tenantId;

    if (!tenantId) {
      return new NextResponse("No tenantId found. Check Xero connection.", { status: 400 });
    }

    await db.collection("integrations").doc("xero").set(
      {
        tenantId,
        tokenSet,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const res = new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"/><title>Xero Connected</title>
<style>
body{font-family:ui-sans-serif,system-ui;background:#f7f7fb;padding:24px}
.card{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e6e6ef;border-radius:16px;padding:18px}
h1{margin:8px 0 10px;font-size:20px}
pre{background:#0b1020;color:#e7e7ff;padding:12px;border-radius:12px;overflow:auto}
.muted{color:#666;font-size:13px;margin-top:10px}
.ok{display:inline-block;padding:4px 10px;border-radius:999px;background:#e9fff0;border:1px solid #b7f0c7;color:#166534;font-weight:800;font-size:12px}
</style></head><body>
<div class="card">
  <div class="ok">Connected</div>
  <h1>Xero connected successfully 🎉</h1>
  <p class="muted">Saved to Firestore: <b>integrations/xero</b></p>

  <p class="muted">Tenant ID</p>
  <pre>${htmlEscape(tenantId)}</pre>

  <p class="muted">TokenSet stored (includes refresh/access)</p>
  <pre>${htmlEscape(JSON.stringify(tokenSet, null, 2))}</pre>

  <p class="muted">Redirect URI reminder (must match Xero app settings):</p>
  <pre>${htmlEscape(process.env.XERO_REDIRECT_URI || "")}</pre>

  <p class="muted">Now go back and test invoice creation.</p>
</div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );

    // clear cookie
    res.headers.append("Set-Cookie", `xero_oauth_state=; Path=/; Max-Age=0; SameSite=Lax`);
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Xero callback failed";
    console.error("[xero/auth/callback]", e);
    return new NextResponse(msg, { status: 500 });
  }
}
