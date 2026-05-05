import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { applySessionAction } from "@/lib/studyroom/serverBilling";
import { generateFamilyInvoice } from "@/lib/studyroom/invoiceEngine";
import type { Firestore } from "firebase-admin/firestore";

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

/** Derive "YYYY-MM-DD" dateKey from a Unix-ms timestamp in Brisbane timezone (UTC+10, no DST). */
function toBrisbaneDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

async function checkAndMaybeInvoice(sessionId: string, db: Firestore) {
  try {
    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    if (!sessionSnap.exists) return;

    const session = sessionSnap.data() as {
      clientId?: string | null;
      startAt?: FirebaseFirestore.Timestamp | null;
      status?: string | null;
    };

    const clientId = String(session.clientId ?? "");
    if (!clientId) return;

    const startAtMs = (session.startAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() ?? 0;
    if (!startAtMs) return;

    const dateKey = toBrisbaneDateKey(startAtMs);

    // Skip if a family invoice already exists for this clientId + dateKey
    const existingSnap = await db.collection("invoices")
      .where("clientId", "==", clientId)
      .where("dateKey", "==", dateKey)
      .limit(1)
      .get();
    if (!existingSnap.empty) return;

    // Compute Brisbane day boundaries (UTC+10)
    const [year, month, day] = dateKey.split("-").map(Number);
    const brisbaneMidnightMs = Date.UTC(year, month - 1, day) - 10 * 3600 * 1000;
    const startOfDay = Timestamp.fromMillis(brisbaneMidnightMs);
    const endOfDay = Timestamp.fromMillis(brisbaneMidnightMs + 24 * 3600 * 1000);

    const allSessionsSnap = await db.collection("sessions")
      .where("clientId", "==", clientId)
      .where("startAt", ">=", startOfDay)
      .where("startAt", "<", endOfDay)
      .get();

    const allSessions = allSessionsSnap.docs.map((d) => d.data() as { status?: string | null });

    const nonCancelledSessions = allSessions.filter((s) => {
      const st = String(s.status ?? "").toLowerCase();
      return !st.includes("cancel") && st !== "no_show";
    });

    if (nonCancelledSessions.length === 0) return;

    const allCompleted = nonCancelledSessions.every((s) =>
      String(s.status ?? "").toLowerCase() === "completed"
    );

    if (!allCompleted) return;

    await generateFamilyInvoice({ clientId, dateKey, triggeredBy: "completion" });
  } catch (err) {
    console.error("[sessions/status] checkAndMaybeInvoice failed:", err);
  }
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

    // Fire-and-forget Xero push when an individual invoice is created
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

    // Fire-and-forget family invoice check when a session is completed
    if (action === "complete") {
      const db = getAdminDb();
      if (db) {
        checkAndMaybeInvoice(sessionId, db).catch((err) =>
          console.error("[sessions/status] checkAndMaybeInvoice error:", err)
        );
      }
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
