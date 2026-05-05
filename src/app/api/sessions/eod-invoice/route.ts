import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { generateFamilyInvoice } from "@/lib/studyroom/invoiceEngine";

/** Derive "YYYY-MM-DD" dateKey from a Unix-ms timestamp in Brisbane timezone (UTC+10, no DST). */
function toBrisbaneDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function isCancelledStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("cancel") || s === "no_show";
}

export async function POST(req: Request) {
  // Authenticate via shared cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const now = new Date();
    const dateKey = toBrisbaneDateKey(now.getTime());

    // Compute Brisbane day boundaries (UTC+10)
    const [year, month, day] = dateKey.split("-").map(Number);
    const brisbaneMidnightMs = Date.UTC(year, month - 1, day) - 10 * 3600 * 1000;
    const startOfDay = Timestamp.fromMillis(brisbaneMidnightMs);
    const endOfDay = Timestamp.fromMillis(brisbaneMidnightMs + 24 * 3600 * 1000);

    // Fetch all sessions that started today (Brisbane time)
    const sessionsSnap = await db.collection("sessions")
      .where("startAt", ">=", startOfDay)
      .where("startAt", "<", endOfDay)
      .get();

    type SessionRow = {
      clientId?: string | null;
      status?: string | null;
    };

    // Group sessions by clientId
    const byClient: Record<string, SessionRow[]> = {};
    for (const docSnap of sessionsSnap.docs) {
      const data = docSnap.data() as SessionRow;
      const clientId = String(data.clientId ?? "");
      if (!clientId) continue;
      if (!byClient[clientId]) byClient[clientId] = [];
      byClient[clientId].push(data);
    }

    const invoiced: string[] = [];
    const skipped: string[] = [];
    const errors: Array<{ clientId: string; error: string }> = [];

    for (const [clientId, sessions] of Object.entries(byClient)) {
      try {
        // Check if a family invoice already exists for this clientId + dateKey
        const existingSnap = await db.collection("invoices")
          .where("clientId", "==", clientId)
          .where("dateKey", "==", dateKey)
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          skipped.push(clientId);
          continue;
        }

        // Must have at least one completed session
        const hasCompleted = sessions.some(
          (s) => String(s.status ?? "").toLowerCase() === "completed"
        );
        if (!hasCompleted) {
          skipped.push(clientId);
          continue;
        }

        // Check all non-cancelled sessions are completed
        const nonCancelled = sessions.filter(
          (s) => !isCancelledStatus(String(s.status ?? ""))
        );
        const allCompleted = nonCancelled.every(
          (s) => String(s.status ?? "").toLowerCase() === "completed"
        );

        if (!allCompleted) {
          // Not all done yet — skip, manual follow-up if needed
          skipped.push(clientId);
          continue;
        }

        const { invoiceDocId, skippedPackageSessions } = await generateFamilyInvoice({
          clientId,
          dateKey,
          triggeredBy: "eod_fallback",
        });

        if (invoiceDocId) {
          invoiced.push(clientId);
          console.log(
            `[eod-invoice] Generated ${invoiceDocId} for ${clientId} on ${dateKey} (${skippedPackageSessions} package sessions skipped)`
          );
        } else {
          skipped.push(clientId);
        }
      } catch (err) {
        console.error(`[eod-invoice] Error for ${clientId}:`, err);
        errors.push({ clientId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      dateKey,
      invoiced,
      skipped,
      errors,
    });
  } catch (e: unknown) {
    console.error("[eod-invoice]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
