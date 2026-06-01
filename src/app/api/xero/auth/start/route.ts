// src/app/api/xero/auth/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getXeroClient } from "@/lib/xeroAuthClient";
import { verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

function isAdminEmail(email?: string | null) {
  return (email || "").toLowerCase() === "lily.studyroom@gmail.com";
}

export async function GET(req: Request) {
  try {
    const decoded = await verifyIdTokenFromRequest(req);
    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Not admin" }, { status: 403 });
    }

    const state = crypto.randomUUID();

    const xero = getXeroClient();
    const baseConsentUrl = await xero.buildConsentUrl();

    // Use URLSearchParams to safely inject the state — avoids string concatenation.
    const u = new URL(baseConsentUrl);
    u.searchParams.set("state", state);
    const consentUrl = u.toString();

    const res = NextResponse.json({ consentUrl });

    // HttpOnly cookie for CSRF state validation in the callback.
    res.headers.append(
      "Set-Cookie",
      `xero_oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`
    );

    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
