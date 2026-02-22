import { NextResponse } from "next/server";
import { getXeroClient } from "@/lib/xeroAuthClient";
import { verifyIdTokenFromRequest } from "@/lib/firebaseAdmin";

function isAdminEmail(email?: string | null) {
  return (email || "").toLowerCase() === "lily.studyroom@gmail.com";
}

export async function POST(req: Request) {
  try {
    // Requires Authorization: Bearer <firebase idToken>
    const decoded = await verifyIdTokenFromRequest(req);
    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Not admin" }, { status: 403 });
    }

    const state = crypto.randomUUID();

    const xero = getXeroClient();
    let consentUrl = await xero.buildConsentUrl();

    // Ensure state exists in the URL (some SDK versions omit it)
    const u = new URL(consentUrl);
    if (!u.searchParams.get("state")) u.searchParams.set("state", state);
    consentUrl = u.toString();

    const res = NextResponse.json({ consentUrl });

    // Store state for callback validation
    res.headers.append(
      "Set-Cookie",
      `xero_oauth_state=${encodeURIComponent(
        state
      )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
    );

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unauthorized" },
      { status: 401 }
    );
  }
}
