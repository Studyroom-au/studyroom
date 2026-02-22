import { NextResponse } from "next/server";
import { getXeroClient } from "@/lib/xeroAuthClient";
import { verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

function isAdminEmail(email?: string | null) {
  return (email || "").toLowerCase() === "lily.studyroom@gmail.com";
}

function addOrReplaceState(consentUrl: string, state: string) {
  const u = new URL(consentUrl);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function POST(req: Request) {
  try {
    const decoded = await verifyIdTokenFromRequest(req);
    if (!isAdminEmail(decoded.email ?? null)) {
      return NextResponse.json({ error: "Not admin" }, { status: 403 });
    }

    const xero = getXeroClient();

    // Our own state cookie to validate callback
    const state = crypto.randomUUID();

    const consentUrl = await xero.buildConsentUrl();
    const consentUrlWithState = addOrReplaceState(consentUrl, state);

    const res = NextResponse.json({ consentUrl: consentUrlWithState });

    res.headers.append(
      "Set-Cookie",
      `xero_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );

    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
