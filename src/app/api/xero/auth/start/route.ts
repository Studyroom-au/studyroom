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

    // Force add state if not present
    const consentUrl = baseConsentUrl.includes("state=")
      ? baseConsentUrl
      : `${baseConsentUrl}${baseConsentUrl.includes("?") ? "&" : "?"}state=${encodeURIComponent(
          state
        )}`;

    const res = NextResponse.json({ consentUrl });

    // cookie for CSRF state validation
    res.headers.append(
      "Set-Cookie",
      `xero_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax`
    );

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unauthorized" }, { status: 401 });
  }
}
