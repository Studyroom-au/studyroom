import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { applySessionAction } from "@/lib/studyroom/serverBilling";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/i);
  return m?.[1] || null;
}

async function requireUser(req: Request) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin not configured.");
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization token.");
  return await auth.verifyIdToken(token);
}

async function requireTutorOrAdmin(uid: string, email?: string | null) {
  if ((email || "").toLowerCase() === "lily.studyroom@gmail.com") return { role: "admin" as const };
  const db = getAdminDb();
  if (!db) throw new Error("Admin DB not configured.");
  const roleSnap = await db.collection("roles").doc(uid).get();
  const role = roleSnap.exists ? String(roleSnap.data()?.role ?? "student") : "student";
  if (role !== "tutor" && role !== "admin") throw new Error("Not permitted.");
  return { role: role as "tutor" | "admin" };
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { role } = await requireTutorOrAdmin(user.uid, user.email ?? null);
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "");
    const action = String(body?.action ?? "").trim().toLowerCase();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!["complete", "cancel_by_parent", "cancel_by_tutor", "no_show", "apply_grace"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await applySessionAction({
      sessionId,
      action: action as "complete" | "cancel_by_parent" | "cancel_by_tutor" | "no_show" | "apply_grace",
      user,
      role,
    });

    const secret = process.env.INTERNAL_API_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Fire-and-forget Xero push when an invoice is created
    if (result.billingOutcome === "invoice" && result.invoiceId && secret) {
      fetch(`${baseUrl}/api/billing/push-invoice-to-xero`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-call": secret },
        body: JSON.stringify({ invoiceId: result.invoiceId }),
      }).catch((err) => console.error("[sessions/status] xero push failed:", err));
    }

    // Fire-and-forget session recap email when session is marked complete
    if (action === "complete" && secret) {
      fetch(`${baseUrl}/api/email/session-recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-call": secret },
        body: JSON.stringify({
          sessionId,
          tutorName: user.name || user.email || "",
          tutorNotes: "",
        }),
      }).catch((err) => console.error("[sessions/status] recap email failed:", err));
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[sessions/status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
