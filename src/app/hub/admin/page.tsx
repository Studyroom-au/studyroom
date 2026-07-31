"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isInvoiceOverdue, formatPlanLabel } from "@/lib/studyroom/billing";
import { brisbaneTodayWindow, startOfWeekBrisbane } from "@/lib/studyroom/brisbaneTime";
import { isOverdueScheduled, hasBillingOutcomeFailure, isEligibleForOperationalExceptions } from "@/lib/studyroom/sessionExceptions";
import { filterCurrentStudents } from "@/lib/studyroom/currentPopulation";
import { getOperationsCutoverAt } from "@/lib/studyroom/operationsCutover";

// ---------------------------------------------------------------------------
// Operations Centre — Release 1B, Stage 8. Replaces the previous static card
// launcher IN PLACE (no separate /hub/admin/operations route, per the
// approved correction). Three layers, all derived from existing collections —
// no new persisted "task" or "status" field is introduced anywhere, and
// nothing here implies assignment/snoozing/ownership tracking that doesn't
// exist. The card-link grid below is unchanged and still the quick-nav.
// ---------------------------------------------------------------------------

type UnmatchedRow = { id: string; name: string; kind: "lead" | "student" };
type PackageAlertRow = { studentId: string; studentName: string; planType: string; remaining: number; urgent: boolean };
type InvoiceAlertRow = { id: string; status: string; studentName: string; overdue: boolean };
type MissingNoteRow = { id: string; studentName: string };
type BillingFailureRow = { id: string; studentName: string };
type OverdueSessionRow = { id: string; studentName: string; startAt: Date };
type TodaySessionRow = { id: string; studentName: string; startAt: Date; status: string };
type DismissalRow = { key: string; label: string; dismissedBy: string; dismissedAt: Date | null };

function ExportButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/admin/export", { method: "POST" });
      const json = await res.json() as { ok?: boolean; error?: string; counts?: { clients: number; leads: number; students: number } };
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      const c = json.counts;
      setMsg(`Exported: ${c?.clients ?? 0} clients · ${c?.leads ?? 0} leads · ${c?.students ?? 0} students`);
      setStatus("ok");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
      setStatus("err");
    }
    setTimeout(() => setStatus("idle"), 5000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={status === "loading"}
        style={{
          background: status === "ok" ? "#82977e" : "#456071",
          color: "white",
          border: "none",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 500,
          cursor: status === "loading" ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: status === "loading" ? 0.7 : 1,
          transition: "background 0.15s",
        }}
      >
        {status === "loading" ? "Exporting…" : status === "ok" ? "Exported ✓" : "Export to Sheets"}
      </button>
      {msg && (
        <span style={{ fontSize: 12, color: status === "err" ? "#dc2626" : "#6b7280" }}>{msg}</span>
      )}
    </div>
  );
}
const CARDS = [
  {
    title: "Leads",
    description: "New enrolments, status changes, and tutor assignment",
    href: "/hub/admin/leads",
    accent: "#456071",
  },
  {
    title: "Clients",
    description: "Families, students, and their assigned tutors",
    href: "/hub/admin/clients",
    accent: "#82977e",
  },
  {
    title: "Tutors",
    description: "All tutors and the students assigned to them",
    href: "/hub/admin/tutors",
    accent: "#b8cad6",
  },
  {
    title: "Sessions Calendar",
    description: "Scheduled and completed sessions with notes",
    href: "/hub/admin/sessions",
    accent: "#e39bb6",
  },
  {
    title: "Add Existing Student",
    description: "Onboard a tutor's current student without a public enrolment",
    href: "/hub/admin/students/add-existing",
    accent: "#c4bbaf",
  },
  {
    title: "Promo Codes",
    description: "Create and manage 7-day trial access codes for students",
    href: "/hub/admin/promo",
    accent: "#a8c5b0",
  },
  {
    title: "Package Alerts",
    description: "Students with 3 or fewer sessions remaining in their package",
    href: "/hub/admin/packages",
    accent: "#e39bb6",
  },
  {
    title: "Invoices",
    description: "Xero drafts, needs-attention, and payment tracking",
    href: "/hub/admin/invoices",
    accent: "#c9a7ff",
  },
];

function AdminCard({ title, description, href, accent }: {
  title: string; description: string; href: string; accent: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 20,
        border: "1px solid #e8eaed",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow 0.18s, transform 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Top accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "20px 20px 0 0" }} />

      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1f24", marginTop: 4, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, flex: 1 }}>
        {description}
      </div>
      <button
        type="button"
        onClick={() => router.push(href)}
        style={{
          marginTop: 18,
          background: "#456071",
          color: "white",
          border: "none",
          borderRadius: 12,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          alignSelf: "flex-start",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#374f5e")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#456071")}
      >
        Open
      </button>
    </div>
  );
}

function SectionBox({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", borderRadius: 20, border: "1px solid #e8eaed", padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#748398", marginBottom: 2 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "#9aa5ad", marginBottom: 14 }}>{subtitle}</div>
      {children}
    </div>
  );
}

function Row({ label, sub, onClick, onDismiss }: { label: string; sub?: string; onClick?: () => void; onDismiss?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        gap: 8,
      }}
    >
      <div
        onClick={onClick}
        style={{ display: "flex", flex: 1, justifyContent: "space-between", alignItems: "center", cursor: onClick ? "pointer" : "default", minWidth: 0 }}
      >
        <span style={{ fontSize: 13, color: "#1a1f24", fontWeight: 500 }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: "#9aa5ad" }}>{sub}</span>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          title="Dismiss — hides this from Action Required without changing the underlying record"
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            lineHeight: "18px",
            textAlign: "center",
            fontSize: 13,
            color: "#9aa5ad",
            background: "none",
            border: "1px solid #e8eaed",
            borderRadius: "50%",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function AdminHubPage() {
  const router = useRouter();
  const [loadingOps, setLoadingOps] = useState(true);
  // A failed Firestore read (e.g. a permission/rules problem) must never be
  // rendered as "genuinely zero activity" — this is distinct from loadingOps
  // being false with real empty data. See the load effect below: any read in
  // the chain throwing aborts the whole load, so this is set whenever that
  // happens and cleared on the next successful attempt.
  const [opsError, setOpsError] = useState<string | null>(null);

  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const [packageAlerts, setPackageAlerts] = useState<PackageAlertRow[]>([]);
  const [renewalRequired, setRenewalRequired] = useState<PackageAlertRow[]>([]);
  const [invoiceAlerts, setInvoiceAlerts] = useState<InvoiceAlertRow[]>([]);
  const [missingNotes, setMissingNotes] = useState<MissingNoteRow[]>([]);
  const [billingFailures, setBillingFailures] = useState<BillingFailureRow[]>([]);
  const [overdueSessions, setOverdueSessions] = useState<OverdueSessionRow[]>([]);
  const [todaySessions, setTodaySessions] = useState<TodaySessionRow[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, DismissalRow>>({});
  const [showDismissed, setShowDismissed] = useState(false);
  const [healthCounts, setHealthCounts] = useState({
    activeStudents: 0,
    completedThisWeek: 0,
    invoicesOutstandingCount: 0,
    invoicesOutstandingCents: 0,
  });

  const loadOperationsData = useCallback(async () => {
      setLoadingOps(true);
      setOpsError(null);
      try {
        // ---- Operations Cutover (final pre-release addition) --------------
        // Sessions dated before this instant never generate a Needs
        // Attention exception under the new rules — see operationsCutover.ts
        // and sessionExceptions.ts's isEligibleForOperationalExceptions.
        const cutoverAt = await getOperationsCutoverAt(db);

        // ---- Persisted dismissals (final polish item 6) -------------------
        const dismissalsSnap = await getDocs(collection(db, "actionDismissals"));
        const dismissalMap: Record<string, DismissalRow> = {};
        dismissalsSnap.docs.forEach((d) => {
          const data = d.data();
          dismissalMap[d.id] = {
            key: d.id,
            label: String(data.label ?? d.id),
            dismissedBy: String(data.dismissedBy ?? "—"),
            dismissedAt: data.dismissedAt instanceof Timestamp ? data.dismissedAt.toDate() : null,
          };
        });
        setDismissals(dismissalMap);

        // ---- Action Required: unmatched leads/students -------------------
        const [leadsSnap, studentsSnap] = await Promise.all([
          getDocs(query(collection(db, "leads"), where("assignedTutorId", "==", null))),
          getDocs(query(collection(db, "students"), where("assignedTutorId", "==", null))),
        ]);
        const unmatchedRows: UnmatchedRow[] = [
          ...leadsSnap.docs.map((d) => ({ id: d.id, name: String(d.data().studentName ?? d.data().parentName ?? "Lead"), kind: "lead" as const })),
          ...studentsSnap.docs
            .filter((d) => d.data().status !== "ended")
            .map((d) => ({ id: d.id, name: String(d.data().studentName ?? "Student"), kind: "student" as const })),
        ];
        setUnmatched(unmatchedRows);

        // ---- Action Required: package alerts (low / renewal required) ----
        const activePlansSnap = await getDocs(query(collection(db, "plans"), where("status", "==", "active")));
        const currentPackagePlans = activePlansSnap.docs.filter((d) => {
          const t = d.data().type;
          return t === "package_5" || t === "package_10";
        });
        const studentNameCache: Record<string, string> = {};
        const alertRows: PackageAlertRow[] = [];
        const exhaustedRows: PackageAlertRow[] = [];
        for (const planDoc of currentPackagePlans) {
          const planData = planDoc.data();
          const studentId = String(planData.studentId ?? "");
          if (!studentId) continue;
          const entSnap = await getDoc(doc(db, "entitlements", planDoc.id));
          const ent = entSnap.exists() ? entSnap.data() : undefined;
          const remaining = Number(ent?.remainingSessions ?? 0);
          if (!(studentId in studentNameCache)) {
            const sSnap = await getDoc(doc(db, "students", studentId));
            studentNameCache[studentId] = String(sSnap.data()?.studentName ?? "Student");
          }
          const row: PackageAlertRow = {
            studentId,
            studentName: studentNameCache[studentId],
            planType: formatPlanLabel(planData.type),
            remaining,
            urgent: remaining <= 1,
          };
          if (remaining <= 0) exhaustedRows.push(row);
          else if (remaining <= 3) alertRows.push(row);
        }
        setPackageAlerts(alertRows);
        setRenewalRequired(exhaustedRows);

        // ---- Action Required: invoices needing attention / overdue -------
        // "approved" is included defensively (it's in the InvoiceStatus type
        // for a future Xero webhook, never written today) — the point is to
        // include every non-terminal status and exclude only the terminal
        // ones (paid, void, credited, waived), never the reverse.
        const activeInvoicesSnap = await getDocs(
          query(collection(db, "invoices"), where("status", "in", ["pending_xero", "xero_failed", "draft_created", "sent", "approved"]))
        );
        const invoiceRows: InvoiceAlertRow[] = [];
        for (const invDoc of activeInvoicesSnap.docs) {
          const data = invDoc.data();
          const status = String(data.status ?? "");
          const dueAt = data.dueAt instanceof Timestamp ? data.dueAt.toDate() : null;
          const overdue = dueAt ? isInvoiceOverdue({ status, dueAt, lateFeeApplied: data.lateFeeApplied }) : false;
          if (status === "pending_xero" || status === "xero_failed" || overdue) {
            const studentId = String(data.studentId ?? "");
            if (studentId && !(studentId in studentNameCache)) {
              const sSnap = await getDoc(doc(db, "students", studentId));
              studentNameCache[studentId] = String(sSnap.data()?.studentName ?? "Student");
            }
            invoiceRows.push({ id: invDoc.id, status, studentName: studentNameCache[studentId] ?? "Family", overdue });
          }
        }
        setInvoiceAlerts(invoiceRows);

        // Same map every completed-session check below uses to detect a
        // failed Xero push — built from the invoices already fetched above
        // (no extra read). Only "xero_failed" matters for this check.
        const invoiceStatusById: Record<string, string> = {};
        activeInvoicesSnap.docs.forEach((d) => {
          invoiceStatusById[d.id] = String(d.data().status ?? "");
        });

        // Relevant date for the Operations Cutover gate — the session's
        // current scheduled date (startAt), NOT originalStartAt. The cutover
        // separates historical activity from activity actually occurring
        // under the new operational system; a reschedule moves when a
        // session actually occurs, so a session originally booked
        // pre-cutover but rescheduled to a post-cutover date must become
        // eligible for exceptions. originalStartAt stays exclusively the
        // pricing-lock field (see billing.ts/serverBilling.ts) and must
        // never be read for this check. A session dated before the cutover
        // never generates a Needs Attention exception under the new rules,
        // regardless of which exception type would otherwise apply — it
        // remains fully browseable as history, just not re-litigated.
        function relevantSessionDate(data: Record<string, unknown>): Date | null {
          return data.startAt instanceof Timestamp ? data.startAt.toDate() : null;
        }

        // ---- Action Required: completed sessions missing a note ---------
        // Historical backlog only — the Stage 3 server gate prevents any NEW
        // completion without a note, so this shrinks over time and never grows.
        const completedSnap = await getDocs(query(collection(db, "sessions"), where("status", "==", "completed")));
        const missingNoteRows: MissingNoteRow[] = [];
        const billingFailureRows: BillingFailureRow[] = [];
        const completedDocsCapped = completedSnap.docs.slice(0, 200);
        for (const sDoc of completedDocsCapped) {
          const data = sDoc.data();
          const sessionDate = relevantSessionDate(data);
          if (!sessionDate || !isEligibleForOperationalExceptions(sessionDate, cutoverAt)) continue;

          const logsSnap = await getDocs(collection(db, "sessions", sDoc.id, "logs"));
          const hasNote = logsSnap.docs.some((l) => String(l.data().text ?? "").trim().length > 0);
          const studentId = String(data.studentId ?? "");
          const ensureStudentName = async () => {
            if (studentId && !(studentId in studentNameCache)) {
              const sSnap = await getDoc(doc(db, "students", studentId));
              studentNameCache[studentId] = String(sSnap.data()?.studentName ?? "Student");
            }
          };
          if (!hasNote) {
            await ensureStudentName();
            missingNoteRows.push({ id: sDoc.id, studentName: studentNameCache[studentId] ?? "Student" });
          }
          // Same billing/outcome-failure check the Sessions oversight page
          // uses (hasBillingOutcomeFailure), so the two pages' Needs
          // Attention totals agree — this was previously only computed on
          // /hub/admin/sessions, never on the Operations Centre.
          const invoiceStatus = data.invoiceId ? invoiceStatusById[String(data.invoiceId)] ?? null : null;
          if (hasBillingOutcomeFailure("completed", data.billingOutcome ?? null, invoiceStatus)) {
            await ensureStudentName();
            billingFailureRows.push({ id: sDoc.id, studentName: studentNameCache[studentId] ?? "Student" });
          }
        }
        setMissingNotes(missingNoteRows);
        setBillingFailures(billingFailureRows);

        // ---- Action Required: sessions overdue (time passed, still
        // "scheduled") — same derived check the Sessions oversight page
        // uses (isOverdueScheduled), so there is exactly one definition of
        // this exception across the whole app.
        const scheduledSnap = await getDocs(query(collection(db, "sessions"), where("status", "==", "scheduled")));
        const nowForOverdue = new Date();
        const overdueRows: OverdueSessionRow[] = [];
        for (const sDoc of scheduledSnap.docs) {
          const data = sDoc.data();
          const startAt = data.startAt instanceof Timestamp ? data.startAt.toDate() : null;
          if (!startAt) continue;
          const sessionDate = relevantSessionDate(data) ?? startAt;
          if (!isEligibleForOperationalExceptions(sessionDate, cutoverAt)) continue;
          const durationMinutes = Number(data.durationMinutes ?? data.durationMins ?? 60);
          if (!isOverdueScheduled("scheduled", startAt, durationMinutes, nowForOverdue)) continue;
          const studentId = String(data.studentId ?? "");
          if (studentId && !(studentId in studentNameCache)) {
            const sSnap = await getDoc(doc(db, "students", studentId));
            studentNameCache[studentId] = String(sSnap.data()?.studentName ?? "Student");
          }
          overdueRows.push({ id: sDoc.id, studentName: studentNameCache[studentId] ?? "Student", startAt });
        }
        overdueRows.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        setOverdueSessions(overdueRows);

        // ---- Today & Upcoming --------------------------------------------
        const { start, end } = brisbaneTodayWindow();
        const todaySnap = await getDocs(
          query(
            collection(db, "sessions"),
            where("startAt", ">=", Timestamp.fromDate(start)),
            where("startAt", "<=", Timestamp.fromDate(end))
          )
        );
        const todayRows: TodaySessionRow[] = [];
        for (const sDoc of todaySnap.docs) {
          const data = sDoc.data();
          const studentId = String(data.studentId ?? "");
          if (studentId && !(studentId in studentNameCache)) {
            const sSnap = await getDoc(doc(db, "students", studentId));
            studentNameCache[studentId] = String(sSnap.data()?.studentName ?? "Student");
          }
          todayRows.push({
            id: sDoc.id,
            studentName: studentNameCache[studentId] ?? "Student",
            startAt: data.startAt?.toDate?.() ?? new Date(),
            status: String(data.status ?? ""),
          });
        }
        todayRows.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        setTodaySessions(todayRows);

        // ---- Operational Health ------------------------------------------
        // "Current students" (final pre-release fix — was "Active students",
        // and undercounted Paused while overcounting orphaned students).
        // Uses the exact same shared filterCurrentStudents() the Clients
        // page uses, so the two can never disagree again. The previous
        // formula only excluded a student if their clientId matched a KNOWN
        // archived client — a student whose clientId pointed at nothing at
        // all (an orphaned/test record with no matching client document)
        // was never excluded, which is what actually caused the 55-vs-35
        // discrepancy (confirmed via scripts/audit-student-count-discrepancy.js:
        // 20 of the 55 students had a clientId with no matching client doc;
        // zero were archived-family or paused/ended mismatches).
        const [allStudentsSnap, allClientsSnap] = await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "clients")),
        ]);
        const currentStudentsList = filterCurrentStudents(
          allStudentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as { clientId?: string | null; status?: string | null }) })),
          allClientsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as { status?: string | null }) }))
        );
        const activeStudents = currentStudentsList.length;

        const weekStart = startOfWeekBrisbane();
        const completedThisWeek = completedSnap.docs.filter((d) => {
          const startAt = d.data().startAt;
          return startAt instanceof Timestamp && startAt.toDate().getTime() >= weekStart.getTime();
        }).length;

        // One invoice document is always exactly one invoice, whether it's a
        // casual session or a package purchase (a 10-session package invoice
        // is never 10 rows here) — invoicesOutstandingCount is a genuine
        // invoice-document count, kept for any other admin UI that wants it.
        // balanceCents is the authoritative "still owed" amount (set at
        // creation, zeroed by Mark-as-paid) — amountCents/totalCents are only
        // a fallback for a document that somehow predates that field.
        const invoicesOutstandingCount = activeInvoicesSnap.docs.length;
        const invoicesOutstandingCents = activeInvoicesSnap.docs.reduce((sum, d) => {
          const data = d.data();
          const balance = data.balanceCents ?? data.amountCents ?? data.totalCents ?? 0;
          return sum + Number(balance);
        }, 0);

        setHealthCounts({
          activeStudents,
          completedThisWeek,
          invoicesOutstandingCount,
          invoicesOutstandingCents,
        });
      } catch (e) {
        // A permission/query failure must never render as genuine zero
        // operational activity — surface it explicitly instead, with the
        // actual Firebase/query error message, so it reads as "couldn't
        // load" rather than "nothing needs attention".
        console.error("[Operations Centre] load failed:", e);
        setOpsError(e instanceof Error ? e.message : "Failed to load operations data.");
      } finally {
        setLoadingOps(false);
      }
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      void loadOperationsData();
    });
    return () => off();
  }, [loadOperationsData]);

  // ---- Persisted dismissal (final polish item 6) ---------------------------
  // Narrow, explicit exception to the "derived-only" MVP rule: dismissing a
  // row hides it from the normal Action Required view but never touches the
  // underlying session/invoice/package/student/lead record. Keys are stable
  // and deterministic so re-dismissing the same item is a no-op, and every
  // dismissal remains visible/reversible via "View dismissed" below.
  async function dismissRow(key: string, label: string) {
    const user = auth.currentUser;
    if (!user) return;
    setDismissals((prev) => ({
      ...prev,
      [key]: { key, label, dismissedBy: user.email ?? user.uid, dismissedAt: new Date() },
    }));
    try {
      await setDoc(doc(db, "actionDismissals", key), {
        key,
        label,
        dismissedBy: user.email ?? user.uid,
        dismissedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("[action-dismissal] failed to save:", e);
    }
  }

  async function restoreRow(key: string) {
    setDismissals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await deleteDoc(doc(db, "actionDismissals", key));
    } catch (e) {
      console.error("[action-dismissal] failed to restore:", e);
    }
  }

  const visibleUnmatched = useMemo(
    () => unmatched.filter((u) => !(`unmatched:${u.kind}:${u.id}` in dismissals)),
    [unmatched, dismissals]
  );
  const visibleRenewalRequired = useMemo(
    () => renewalRequired.filter((p) => !(`renewal:${p.studentId}` in dismissals)),
    [renewalRequired, dismissals]
  );
  const visiblePackageAlerts = useMemo(
    () => packageAlerts.filter((p) => !(`package-low:${p.studentId}` in dismissals)),
    [packageAlerts, dismissals]
  );
  const visibleInvoiceAlerts = useMemo(
    () => invoiceAlerts.filter((i) => !(`invoice:${i.id}` in dismissals)),
    [invoiceAlerts, dismissals]
  );
  const visibleMissingNotes = useMemo(
    () => missingNotes.filter((m) => !(`missing-note:${m.id}` in dismissals)),
    [missingNotes, dismissals]
  );
  const visibleOverdueSessions = useMemo(
    () => overdueSessions.filter((o) => !(`overdue-session:${o.id}` in dismissals)),
    [overdueSessions, dismissals]
  );
  const visibleBillingFailures = useMemo(
    () => billingFailures.filter((b) => !(`billing-failure:${b.id}` in dismissals)),
    [billingFailures, dismissals]
  );

  const actionRequiredCount = useMemo(
    () =>
      visibleUnmatched.length +
      visiblePackageAlerts.length +
      visibleRenewalRequired.length +
      visibleInvoiceAlerts.length +
      visibleMissingNotes.length +
      visibleOverdueSessions.length +
      visibleBillingFailures.length,
    [
      visibleUnmatched,
      visiblePackageAlerts,
      visibleRenewalRequired,
      visibleInvoiceAlerts,
      visibleMissingNotes,
      visibleOverdueSessions,
      visibleBillingFailures,
    ]
  );

  const dismissedList = useMemo(
    () => Object.values(dismissals).sort((a, b) => (b.dismissedAt?.getTime() ?? 0) - (a.dismissedAt?.getTime() ?? 0)),
    [dismissals]
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 6 }}>
          Studyroom · Admin
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Operations Centre
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          What needs attention, what&apos;s happening today, and whether Studyroom is operating normally.
        </p>
      </div>

      {/* Three-layer operations view */}
      {loadingOps ? (
        <div style={{ background: "white", borderRadius: 20, border: "1px solid #e8eaed", padding: 24, marginBottom: 28, fontSize: 13, color: "#9aa5ad" }}>
          Loading operations overview…
        </div>
      ) : opsError ? (
        <div style={{ background: "#fdf1f2", borderRadius: 20, border: "1px solid #f0b7bd", padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#9a2f3a", marginBottom: 6 }}>
            Operations data couldn&apos;t be loaded
          </div>
          <p style={{ fontSize: 13, color: "#9a2f3a", marginBottom: 4 }}>
            This is a load failure, not an empty dashboard — nothing below reflects real
            counts until this is resolved.
          </p>
          <p style={{ fontSize: 12, color: "#b0555e", fontFamily: "monospace", marginBottom: 14 }}>
            {opsError}
          </p>
          <button
            type="button"
            onClick={() => { void loadOperationsData(); }}
            style={{
              background: "#9a2f3a", color: "white", border: "none", borderRadius: 12,
              padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 28 }}>
          {/* Action Required */}
          <SectionBox title={`Action Required (${actionRequiredCount})`} subtitle="Derived from current records — nothing here is a persisted task">
            {actionRequiredCount === 0 ? (
              <p style={{ fontSize: 13, color: "#82977e" }}>Nothing needs attention right now.</p>
            ) : (
              <div>
                {visibleUnmatched.slice(0, 5).map((u) => {
                  const key = `unmatched:${u.kind}:${u.id}`;
                  return (
                    <Row
                      key={u.id}
                      label={`${u.name} — unmatched`}
                      sub={u.kind === "lead" ? "Lead" : "Student"}
                      onClick={() => router.push(u.kind === "lead" ? `/hub/admin/leads/${u.id}` : `/hub/admin/students/${u.id}`)}
                      onDismiss={() => dismissRow(key, `${u.name} — unmatched`)}
                    />
                  );
                })}
                {visibleRenewalRequired.slice(0, 5).map((p) => {
                  const key = `renewal:${p.studentId}`;
                  return (
                    <Row
                      key={`renew-${p.studentId}`}
                      label={`${p.studentName} — renewal required`}
                      sub={`${p.planType}, 0 left`}
                      onClick={() => router.push(`/hub/admin/students/${p.studentId}`)}
                      onDismiss={() => dismissRow(key, `${p.studentName} — renewal required`)}
                    />
                  );
                })}
                {visiblePackageAlerts.slice(0, 5).map((p) => {
                  const key = `package-low:${p.studentId}`;
                  return (
                    <Row
                      key={`low-${p.studentId}`}
                      label={`${p.studentName} — package running low`}
                      sub={`${p.remaining} left`}
                      onClick={() => router.push(`/hub/admin/students/${p.studentId}`)}
                      onDismiss={() => dismissRow(key, `${p.studentName} — package running low`)}
                    />
                  );
                })}
                {visibleInvoiceAlerts.slice(0, 5).map((i) => {
                  const key = `invoice:${i.id}`;
                  return (
                    <Row
                      key={i.id}
                      label={`${i.studentName} — invoice ${i.overdue ? "overdue" : "needs attention"}`}
                      sub={i.status}
                      onClick={() => router.push("/hub/admin/invoices")}
                      onDismiss={() => dismissRow(key, `${i.studentName} — invoice ${i.overdue ? "overdue" : "needs attention"}`)}
                    />
                  );
                })}
                {visibleMissingNotes.slice(0, 5).map((m) => {
                  const key = `missing-note:${m.id}`;
                  return (
                    <Row
                      key={m.id}
                      label={`${m.studentName} — session missing a note`}
                      onClick={() => router.push(`/hub/admin/students/${m.id}`)}
                      onDismiss={() => dismissRow(key, `${m.studentName} — session missing a note`)}
                    />
                  );
                })}
                {visibleOverdueSessions.slice(0, 5).map((o) => {
                  const key = `overdue-session:${o.id}`;
                  return (
                    <Row
                      key={o.id}
                      label={`${o.studentName} — session time passed, still scheduled`}
                      sub={o.startAt.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      onClick={() => router.push("/hub/admin/sessions")}
                      onDismiss={() => dismissRow(key, `${o.studentName} — session time passed, still scheduled`)}
                    />
                  );
                })}
                {visibleBillingFailures.slice(0, 5).map((b) => {
                  const key = `billing-failure:${b.id}`;
                  return (
                    <Row
                      key={b.id}
                      label={`${b.studentName} — session billing/outcome issue`}
                      onClick={() => router.push("/hub/admin/sessions")}
                      onDismiss={() => dismissRow(key, `${b.studentName} — session billing/outcome issue`)}
                    />
                  );
                })}
                {actionRequiredCount > 25 && (
                  <p style={{ fontSize: 11, color: "#9aa5ad", marginTop: 8 }}>Showing a partial list — open each area for the full picture.</p>
                )}
              </div>
            )}
            {dismissedList.length > 0 && (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowDismissed((v) => !v)}
                  style={{
                    fontSize: 11, color: "#9aa5ad", background: "none", border: "none",
                    cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0,
                  }}
                >
                  {showDismissed ? "Hide" : "View"} dismissed ({dismissedList.length})
                </button>
                {showDismissed && (
                  <div style={{ marginTop: 6 }}>
                    {dismissedList.map((d) => (
                      <div
                        key={d.key}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "6px 0", borderTop: "1px solid rgba(0,0,0,0.05)", gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#748398" }}>{d.label}</span>
                        <button
                          type="button"
                          onClick={() => restoreRow(d.key)}
                          style={{
                            flexShrink: 0, fontSize: 11, color: "#456071", background: "none",
                            border: "1px solid #b8cad6", borderRadius: 8, padding: "2px 8px",
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionBox>

          {/* Today & Upcoming */}
          <SectionBox title={`Today (${todaySessions.length})`} subtitle="Sessions scheduled for today, Brisbane time">
            {todaySessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9aa5ad" }}>No sessions today.</p>
            ) : (
              todaySessions.slice(0, 8).map((s) => (
                <Row
                  key={s.id}
                  label={s.studentName}
                  sub={`${s.startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })} · ${s.status}`}
                  onClick={() => router.push("/hub/admin/sessions")}
                />
              ))
            )}
          </SectionBox>

          {/* Operational Health */}
          <SectionBox title="Operational Health" subtitle="A snapshot, not an analytics dashboard">
            <Row label="Current students" sub={String(healthCounts.activeStudents)} />
            <Row label="Sessions completed this week" sub={String(healthCounts.completedThisWeek)} />
            <Row
              label="Invoices outstanding"
              sub={`$${(healthCounts.invoicesOutstandingCents / 100).toFixed(2)}`}
              onClick={() => router.push("/hub/admin/invoices")}
            />
            <Row label="Package alerts" sub={String(packageAlerts.length + renewalRequired.length)} onClick={() => router.push("/hub/admin/packages")} />
          </SectionBox>
        </div>
      )}

      {/* Card grid — quick navigation, unchanged */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#748398", marginBottom: 10 }}>
        Quick links
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        {CARDS.map((card) => (
          <AdminCard key={card.title} {...card} />
        ))}
      </div>

      {/* Export + Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        <ExportButton />

        <button
          type="button"
          onClick={() => router.push("/hub")}
        style={{
          background: "white",
          color: "#456071",
          border: "1.5px solid #b8cad6",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f2f5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
      >
        ← Back to Hub
      </button>
      </div>

    </div>
  );
}
