"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import enAuLocale from "@fullcalendar/core/locales/en-au";

import type {
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

import SessionLogEditor from "@/components/session/SessionLogEditor";
import {
  formatModeLabel,
  formatPlanLabel,
  formatSessionStatusLabel,
  normalizeMode,
  normalizePlanType,
  normalizeSessionStatus,
  type BillingOutcome,
  type InvoiceStatus,
  type StudyroomEntitlementRecord,
  type StudyroomPlanRecord,
} from "@/lib/studyroom/billing";
import { brisbaneTodayWindow } from "@/lib/studyroom/brisbaneTime";
import { isOverdueScheduled, hasBillingOutcomeFailure, isEligibleForOperationalExceptions } from "@/lib/studyroom/sessionExceptions";
import { getOperationsCutoverAt } from "@/lib/studyroom/operationsCutover";

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;

  studentId: string;
  clientId: string;
  planId?: string | null;

  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes: number;
  durationMins?: number;

  // Release 1A pricing-lock field — also doubles as the "was this session
  // ever moved from its original booked time" signal (final polish item 1),
  // so "Rescheduled" reuses this instead of inventing a second mechanism.
  originalStartAt?: Timestamp;

  status: string;
  billingStatus?: string;
  billingOutcome?: BillingOutcome | null;

  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  mode?: "in_home" | "online" | "group" | null;
  notes?: string | null;
  graceApplied?: boolean | null;
  noticeHours?: number | null;
  consumed?: boolean | null;
  invoiceId?: string | null;

  amountCents?: number | null;
  xeroInvoiceId?: string | null;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelReason?: string | null;
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
};

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
};

type InvoiceDoc = {
  status?: InvoiceStatus | null;
  dueAt?: Timestamp | null;
  lateFeeApplied?: boolean | null;
  lateFeeCents?: number | null;
};

function niceTimeRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  const s = start.toLocaleTimeString("en-AU", opts);
  const e = end.toLocaleTimeString("en-AU", opts);
  return `${s}–${e}`;
}

function niceDateLabel(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function dateKeyBrisbane(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

// A session is "rescheduled" if it's been moved from its original booked
// time — reuses the same originalStartAt pricing-lock field Release 1A
// already writes once at creation, rather than inventing a second mechanism.
function wasRescheduled(startAt: Date, originalStartAt?: Date | null) {
  if (!originalStartAt) return false;
  return Math.abs(startAt.getTime() - originalStartAt.getTime()) > 5 * 60000;
}

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled_by_parent", label: "Cancelled (parent)" },
  { value: "cancelled_by_tutor", label: "Cancelled (tutor)" },
  { value: "no_show", label: "No-show" },
] as const;

function statusBadgeColors(status: string) {
  if (status === "completed") return { bg: "#d4edcc", fg: "#2d5a24" };
  if (status === "no_show") return { bg: "#fff3cd", fg: "#8a6100" };
  if (status.startsWith("cancelled")) return { bg: "#fce8ee", fg: "#c0445e" };
  return { bg: "#edf2f6", fg: "#456071" }; // scheduled
}

export default function AdminSessionsCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);

  const [students, setStudents] = useState<Record<string, StudentDoc>>({});
  const [tutors, setTutors] = useState<Record<string, UserDoc>>({});
  const [plans, setPlans] = useState<Record<string, StudyroomPlanRecord>>({});
  const [entitlements, setEntitlements] = useState<Record<string, StudyroomEntitlementRecord>>({});
  const [invoices, setInvoices] = useState<Record<string, InvoiceDoc>>({});
  const [actionBusy, setActionBusy] = useState<"no_show" | "apply_grace" | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  // Oversight view (Release 1B, final polish item 1) — Calendar stays the
  // existing drag/resize view; Agenda is a flat, filterable list. Filters
  // apply to both views and to the Today summary / Needs Attention below.
  const [viewMode, setViewMode] = useState<"calendar" | "agenda">("calendar");
  const [tutorFilter, setTutorFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  // Historical backlog only, same cap/reasoning as the Operations Centre —
  // the Stage 3 server gate prevents any NEW completion without a note.
  const [missingNoteIds, setMissingNoteIds] = useState<Set<string>>(new Set());
  // Operations Cutover (final pre-release addition) — same shared value and
  // same gate the Operations Centre uses, so the two pages' Needs Attention
  // totals can never disagree over old/test/pre-Release-1B session data.
  const [cutoverAt, setCutoverAt] = useState<Date | null>(null);

  const openSession = useMemo(
    () => sessions.find((s) => s.id === openId) ?? null,
    [openId, sessions]
  );
  const openPlan = useMemo(() => {
    const planId = openSession?.data.planId ?? "";
    return planId ? plans[planId] ?? null : null;
  }, [openSession, plans]);
  const openEntitlement = useMemo(() => {
    const planId = openSession?.data.planId ?? "";
    return planId ? entitlements[planId] ?? null : null;
  }, [openSession, entitlements]);
  const openInvoice = useMemo(() => {
    const invoiceId = openSession?.data.invoiceId ?? "";
    return invoiceId ? invoices[invoiceId] ?? null : null;
  }, [openSession, invoices]);

  const studentLabel = useCallback(
    (studentId: string) => {
      const s = students[studentId];
      const name = s?.studentName || "Student";
      const yr = s?.yearLevel ? ` (${s.yearLevel})` : "";
      return `${name}${yr}`;
    },
    [students]
  );

  const tutorLabel = useCallback(
    (tutorId: string, tutorEmail?: string | null) => {
      const t = tutors[tutorId];
      const name = t?.name || t?.displayName;
      if (name) return name;
      if (tutorEmail) return tutorEmail.split("@")[0];
      return tutorId ? tutorId.slice(0, 6) : "Tutor";
    },
    [tutors]
  );

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      setLoading(true);
      try {
        const cutover = await getOperationsCutoverAt(db);
        setCutoverAt(cutover);

        const q1 = query(collection(db, "sessions"), orderBy("startAt", "asc"));
        const snap = await getDocs(q1);

        const loaded = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as SessionDoc,
        }));
        setSessions(loaded);

        const studentIds = Array.from(new Set(loaded.map((s) => s.data.studentId).filter(Boolean)));
        const tutorIds = Array.from(new Set(loaded.map((s) => s.data.tutorId).filter(Boolean)));

        const studentMap: Record<string, StudentDoc> = {};
        await Promise.all(
          studentIds.map(async (sid) => {
            const ssnap = await getDoc(doc(db, "students", sid));
            if (ssnap.exists()) studentMap[sid] = ssnap.data() as StudentDoc;
          })
        );
        setStudents(studentMap);

        // ✅ Your tutors live in users/{uid}
        const tutorMap: Record<string, UserDoc> = {};
        await Promise.all(
          tutorIds.map(async (tid) => {
            const tsnap = await getDoc(doc(db, "users", tid));
            if (tsnap.exists()) tutorMap[tid] = tsnap.data() as UserDoc;
          })
        );
        setTutors(tutorMap);

        const planIds = Array.from(new Set(loaded.map((s) => s.data.planId).filter(Boolean) as string[]));
        const invoiceIds = Array.from(new Set(loaded.map((s) => s.data.invoiceId).filter(Boolean) as string[]));

        const planMap: Record<string, StudyroomPlanRecord> = {};
        const entitlementMap: Record<string, StudyroomEntitlementRecord> = {};
        await Promise.all(
          planIds.map(async (pid) => {
            const planSnap = await getDoc(doc(db, "plans", pid));
            if (planSnap.exists()) {
              planMap[pid] = { id: pid, ...(planSnap.data() as StudyroomPlanRecord) };
            }
            const entitlementSnap = await getDoc(doc(db, "entitlements", pid));
            if (entitlementSnap.exists()) {
              entitlementMap[pid] = { id: pid, ...(entitlementSnap.data() as StudyroomEntitlementRecord) };
            }
          })
        );
        setPlans(planMap);
        setEntitlements(entitlementMap);

        const invoiceMap: Record<string, InvoiceDoc> = {};
        await Promise.all(
          invoiceIds.map(async (invoiceId) => {
            const invoiceSnap = await getDoc(doc(db, "invoices", invoiceId));
            if (invoiceSnap.exists()) invoiceMap[invoiceId] = invoiceSnap.data() as InvoiceDoc;
          })
        );
        setInvoices(invoiceMap);

        // Needs Attention: completed-with-no-note check (historical backlog
        // only — same reasoning/cap as the Operations Centre's identical
        // check, so this never needs to scan the whole sessions collection).
        const completedDocs = loaded.filter((s) => normalizeSessionStatus(s.data.status) === "completed").slice(0, 200);
        const noteIds = new Set<string>();
        await Promise.all(
          completedDocs.map(async (s) => {
            const logsSnap = await getDocs(collection(db, "sessions", s.id, "logs"));
            const hasNote = logsSnap.docs.some((l) => String(l.data().text ?? "").trim().length > 0);
            if (!hasNote) noteIds.add(s.id);
          })
        );
        setMissingNoteIds(noteIds);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  // Every distinct tutor referenced by any loaded session, for the filter
  // dropdown — reuses the same `tutors`/`tutorLabel` lookup already built.
  const tutorOptions = useMemo(() => {
    const ids = Array.from(new Set(sessions.map((s) => s.data.tutorId).filter(Boolean)));
    return ids
      .map((id) => ({ id, label: tutorLabel(id, sessions.find((s) => s.data.tutorId === id)?.data.tutorEmail) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions, tutorLabel]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (tutorFilter && s.data.tutorId !== tutorFilter) return false;
      if (statusFilter && normalizeSessionStatus(s.data.status) !== statusFilter) return false;
      return true;
    });
  }, [sessions, tutorFilter, statusFilter]);

  const events = useMemo(() => {
    return filteredSessions.map((s) => {
      const start = s.data.startAt?.toDate?.() ?? new Date();
      const end = s.data.endAt?.toDate?.() ?? new Date(start.getTime() + 60 * 60 * 1000);

      const stud = studentLabel(s.data.studentId);
      const tut = tutorLabel(s.data.tutorId, s.data.tutorEmail);

      const classNames = [
        "sr-event",
        normalizeSessionStatus(s.data.status) === "completed" ? "sr-event--done" : "",
        normalizeSessionStatus(s.data.status).startsWith("cancelled") ? "sr-event--cancel" : "",
        s.data.billingOutcome === "invoice" ? "sr-event--invoice" : "",
      ].filter(Boolean);

      return {
        id: s.id,
        // Title is fallback only; eventContent controls display
        title: `${formatSessionStatusLabel(normalizeSessionStatus(s.data.status))} · ${stud} · ${tut}`,
        start,
        end,
        classNames,
        extendedProps: {
          status: normalizeSessionStatus(s.data.status),
          billingStatus: s.data.billingStatus ?? "",
          billingOutcome: s.data.billingOutcome ?? null,
          studentLabel: stud,
          tutorLabel: tut,
          modality: s.data.modality ?? null,
          mode: s.data.mode ?? null,
          rescheduled: wasRescheduled(start, s.data.originalStartAt?.toDate?.()),
          graceApplied: !!s.data.graceApplied,
        },
      };
    });
  }, [filteredSessions, studentLabel, tutorLabel]);

  // Today summary + Needs Attention — both scoped to the current tutor/
  // status filters, so "Today" reads as "today, for what I'm looking at".
  const sessionNeedsAttention = useCallback(
    (s: { id: string; data: SessionDoc }, now: Date) => {
      const startAt = s.data.startAt?.toDate?.();
      if (!startAt) return false;
      // Operations Cutover gate — uses the session's current scheduled date
      // (startAt), NOT originalStartAt (the pricing-lock field). A session
      // dated before the cutover never generates a new exception, regardless
      // of which check would otherwise flag it (final pre-release addition;
      // see admin/page.tsx for the identical gate on the Operations Centre,
      // and sessionExceptions.ts for why originalStartAt is wrong here).
      if (cutoverAt && !isEligibleForOperationalExceptions(startAt, cutoverAt)) return false;

      const status = normalizeSessionStatus(s.data.status);
      const durationMinutes = Number(s.data.durationMinutes ?? s.data.durationMins ?? 60);
      const invoiceStatus = s.data.invoiceId ? invoices[s.data.invoiceId]?.status ?? null : null;
      return (
        isOverdueScheduled(status, startAt, durationMinutes, now) ||
        missingNoteIds.has(s.id) ||
        hasBillingOutcomeFailure(status, s.data.billingOutcome, invoiceStatus)
      );
    },
    [invoices, missingNoteIds, cutoverAt]
  );

  const todaySummary = useMemo(() => {
    const { start, end } = brisbaneTodayWindow();
    const now = new Date();
    const todays = filteredSessions.filter((s) => {
      const startAt = s.data.startAt?.toDate?.();
      return startAt && startAt >= start && startAt <= end;
    });
    const completed = todays.filter((s) => normalizeSessionStatus(s.data.status) === "completed").length;
    const upcoming = todays.filter(
      (s) => normalizeSessionStatus(s.data.status) === "scheduled" && (s.data.startAt?.toDate?.() ?? now) > now
    ).length;
    const needsAttention = todays.filter((s) => sessionNeedsAttention(s, now)).length;
    return { total: todays.length, completed, upcoming, needsAttention };
  }, [filteredSessions, sessionNeedsAttention]);

  const needsAttentionRows = useMemo(() => {
    const now = new Date();
    return filteredSessions
      .map((s) => {
        const startAt = s.data.startAt?.toDate?.();
        if (!startAt) return { session: s, startAt, reason: "", flagged: false };

        // Operations Cutover gate — same as sessionNeedsAttention above
        // (startAt, not originalStartAt).
        if (cutoverAt && !isEligibleForOperationalExceptions(startAt, cutoverAt)) {
          return { session: s, startAt, reason: "", flagged: false };
        }

        const status = normalizeSessionStatus(s.data.status);
        const durationMinutes = Number(s.data.durationMinutes ?? s.data.durationMins ?? 60);
        const invoiceStatus = s.data.invoiceId ? invoices[s.data.invoiceId]?.status ?? null : null;
        const overdue = isOverdueScheduled(status, startAt, durationMinutes, now);
        const missingNote = missingNoteIds.has(s.id);
        const billingFailure = hasBillingOutcomeFailure(status, s.data.billingOutcome, invoiceStatus);
        let reason = "";
        if (overdue) reason = "Time passed, still scheduled";
        else if (missingNote) reason = "Completed, no note";
        else if (billingFailure) reason = "Billing/outcome issue";
        return { session: s, startAt, reason, flagged: overdue || missingNote || billingFailure };
      })
      .filter((r): r is typeof r & { startAt: Date } => r.flagged && !!r.startAt)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [filteredSessions, invoices, missingNoteIds, cutoverAt]);

  // Agenda/List view — grouped by day. A reschedule moves the SAME session
  // document (see /api/sessions/reschedule) rather than creating a second
  // one, so a session only ever appears here once — reschedule history reads
  // as a "Rescheduled" badge on that one row, never a duplicate entry.
  const agendaGroups = useMemo(() => {
    const groups = new Map<string, Array<{ id: string; data: SessionDoc }>>();
    for (const s of filteredSessions) {
      const startAt = s.data.startAt?.toDate?.();
      if (!startAt) continue;
      const key = dateKeyBrisbane(startAt);
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .map(([key, rows]) => ({
        key,
        date: rows[0].data.startAt.toDate(),
        rows: rows.sort((a, b) => a.data.startAt.toMillis() - b.data.startAt.toMillis()),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredSessions]);

  async function updateSessionTime(sessionId: string, start: Date, end: Date) {
    const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    await updateDoc(doc(db, "sessions", sessionId), {
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      durationMinutes,
      updatedAt: serverTimestamp(),
    });
  }

  async function onDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) return;

    try {
      await updateSessionTime(id, start, end);
    } catch (e) {
      console.error(e);
      arg.revert();
      alert("Could not reschedule. Check permissions/rules.");
    }
  }

  async function onResize(arg: EventResizeDoneArg) {
    const id = arg.event.id;
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) return;

    try {
      await updateSessionTime(id, start, end);
    } catch (e) {
      console.error(e);
      arg.revert();
      alert("Could not resize duration. Check permissions/rules.");
    }
  }

  function onEventClick(arg: EventClickArg) {
    setOpenId(arg.event.id);
  }

  async function runAdminAction(action: "no_show" | "apply_grace") {
    const user = auth.currentUser;
    if (!user || !openSession) return;
    setActionBusy(action);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/sessions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: openSession.id, action }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Session update failed.");
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Session update failed.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Admin
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Sessions</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Every tutor&apos;s sessions in one place · Drag to reschedule (Calendar) · Resize to change duration
        </p>
      </header>

      {/* Controls: view toggle + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[color:var(--ring)] bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "calendar" ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--brand)]"
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("agenda")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "agenda" ? "bg-[color:var(--brand)] text-white" : "text-[color:var(--brand)]"
            }`}
          >
            Agenda
          </button>
        </div>

        <select
          value={tutorFilter}
          onChange={(e) => setTutorFilter(e.target.value)}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
          aria-label="Filter by tutor"
        >
          <option value="">All tutors</option>
          {tutorOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Today", value: todaySummary.total },
          { label: "Completed", value: todaySummary.completed },
          { label: "Upcoming", value: todaySummary.upcoming },
          { label: "Needs attention", value: todaySummary.needsAttention, alert: todaySummary.needsAttention > 0 },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-3 text-center ${
              c.alert ? "border-amber-300 bg-amber-50" : "border-[color:var(--ring)] bg-white"
            }`}
          >
            <div className={`text-2xl font-bold ${c.alert ? "text-amber-800" : "text-[color:var(--ink)]"}`}>
              {c.value}
            </div>
            <div className="text-xs text-[color:var(--muted)]">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Needs Attention — derived, same exception logic as the Operations
          Centre (isOverdueScheduled / hasBillingOutcomeFailure). Correctly
          recorded cancellations/reschedules/no-shows are never listed here. */}
      {needsAttentionRows.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">
            Needs attention ({needsAttentionRows.length})
          </h2>
          <div className="space-y-1">
            {needsAttentionRows.slice(0, 8).map((r) => (
              <div
                key={r.session.id}
                onClick={() => setOpenId(r.session.id)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-amber-100"
              >
                <span className="font-medium text-amber-900">
                  {studentLabel(r.session.data.studentId)} · {tutorLabel(r.session.data.tutorId, r.session.data.tutorEmail)}
                </span>
                <span className="text-xs text-amber-700">
                  {niceDateLabel(r.startAt)} · {r.reason}
                </span>
              </div>
            ))}
            {needsAttentionRows.length > 8 && (
              <p className="mt-1 text-xs text-amber-700">Showing a partial list — filter by tutor/status for more.</p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : viewMode === "agenda" ? (
          <div className="space-y-4">
            {agendaGroups.length === 0 ? (
              <p className="p-6 text-sm text-[color:var(--muted)]">No sessions match these filters.</p>
            ) : (
              agendaGroups.map((group) => (
                <div key={group.key}>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    {niceDateLabel(group.date)}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[color:var(--ring)]">
                    {group.rows.map((s, i) => {
                      const start = s.data.startAt.toDate();
                      const end = s.data.endAt?.toDate?.() ?? new Date(start.getTime() + 60 * 60000);
                      const status = normalizeSessionStatus(s.data.status);
                      const colors = statusBadgeColors(status);
                      const rescheduled = wasRescheduled(start, s.data.originalStartAt?.toDate?.());
                      return (
                        <div
                          key={s.id}
                          onClick={() => setOpenId(s.id)}
                          className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[#f5f7fb] ${
                            i > 0 ? "border-t border-[color:var(--ring)]" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[color:var(--ink)]">
                              {studentLabel(s.data.studentId)}
                              <span className="ml-2 text-sm font-normal text-[color:var(--muted)]">
                                {tutorLabel(s.data.tutorId, s.data.tutorEmail)}
                              </span>
                            </div>
                            <div className="text-xs text-[color:var(--muted)]">
                              {niceTimeRange(start, end)} · {formatModeLabel(normalizeMode(s.data.mode ?? s.data.modality))}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                              style={{ background: colors.bg, color: colors.fg }}
                            >
                              {formatSessionStatusLabel(status)}
                            </span>
                            {rescheduled && (
                              <span className="rounded-full bg-[#e7edf3] px-2.5 py-0.5 text-[10px] font-bold text-[#456071]">
                                Rescheduled
                              </span>
                            )}
                            {s.data.graceApplied && (
                              <span className="rounded-full bg-[#f4e8ff] px-2.5 py-0.5 text-[10px] font-bold text-[#7c3aed]">
                                Grace charge
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={enAuLocale}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,dayGridMonth",
            }}
            height="auto"
            nowIndicator
            firstDay={1}
            allDaySlot={false}
            slotMinTime="06:00:00"
            slotMaxTime="21:00:00"
            slotDuration="00:30:00"
            editable
            eventStartEditable
            eventDurationEditable
            eventResizableFromStart
            events={events}
            eventClick={onEventClick}
            eventDrop={onDrop}
            eventResize={onResize}
            eventContent={(arg: EventContentArg) => {
              const start = arg.event.start ?? new Date();
              const end = arg.event.end ?? new Date(start.getTime() + 60 * 60000);

              const status = normalizeSessionStatus(arg.event.extendedProps?.status);
              const stud = String(arg.event.extendedProps?.studentLabel ?? "Student");
              const tut = String(arg.event.extendedProps?.tutorLabel ?? "Tutor");
              const mod = normalizeMode(arg.event.extendedProps?.mode ?? arg.event.extendedProps?.modality);

              const compact = arg.view.type === "dayGridMonth";
              const topLabel = formatSessionStatusLabel(status);

              // Rescheduled/Grace are shown as badges in the detail drawer
              // (opened on click) rather than crowding this compact card —
              // keeping only status + mode + Invoice here is what keeps the
              // card readable without overflowing its allocated block,
              // especially in week view where columns are narrow.
              return (
                <div className="sr-event-inner">
                  <div className="sr-event-row">
                    <span className="sr-dot" />
                    <span className="sr-title">{topLabel}</span>
                    {(arg.event.extendedProps?.billingOutcome as BillingOutcome | null) === "invoice" && (
                      <span className="sr-pill">Invoice</span>
                    )}
                    {!compact && formatModeLabel(mod) && (
                      <span className="sr-pill">{formatModeLabel(mod)}</span>
                    )}
                  </div>

                  <div className="sr-sub">
                    <span className="sr-sub-strong">{stud}</span>
                    <span className="sr-sub-muted"> · {tut}</span>
                  </div>

                  <div className="sr-time">{niceTimeRange(start, end)}</div>
                </div>
              );
            }}
          />
        )}
      </section>

      {openSession && (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Session
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-lg font-semibold text-[color:var(--ink)]">
                {formatSessionStatusLabel(normalizeSessionStatus(openSession.data.status))}
                {wasRescheduled(openSession.data.startAt.toDate(), openSession.data.originalStartAt?.toDate?.()) && (
                  <span className="rounded-full bg-[#e7edf3] px-2 py-0.5 text-[10px] font-bold text-[#456071]">
                    Rescheduled
                  </span>
                )}
                {openSession.data.graceApplied && (
                  <span className="rounded-full bg-[#f4e8ff] px-2 py-0.5 text-[10px] font-bold text-[#7c3aed]">
                    Grace charge
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {niceDateLabel(openSession.data.startAt.toDate())} ·{" "}
                {niceTimeRange(openSession.data.startAt.toDate(), openSession.data.endAt.toDate())}
              </div>
              <div className="mt-1 text-xs font-semibold text-[color:var(--ink)]">
                {studentLabel(openSession.data.studentId)} ·{" "}
                {tutorLabel(openSession.data.tutorId, openSession.data.tutorEmail)}
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {formatModeLabel(normalizeMode(openSession.data.mode ?? openSession.data.modality))} · Outcome:{" "}
                <b>{openSession.data.billingOutcome ?? "no_charge"}</b>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Plan</div>
              <div className="mt-1 font-semibold text-[color:var(--ink)]">
                {formatPlanLabel(normalizePlanType(openPlan?.type))}
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {openSession.data.graceApplied ? "Grace applied to this session" : "No grace on this session"}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Entitlement</div>
              <div className="mt-1 font-semibold text-[color:var(--ink)]">
                {openEntitlement
                  ? `${openEntitlement.remainingSessions} base · ${openEntitlement.bonusRemaining} bonus`
                  : "No package balance"}
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Consumed: {openSession.data.consumed ? "Yes" : "No"}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Invoice</div>
              <div className="mt-1 font-semibold text-[color:var(--ink)]">
                {openInvoice?.status ?? (openSession.data.invoiceId ? "linked" : "none")}
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {openInvoice?.dueAt ? `Due ${openInvoice.dueAt.toDate().toLocaleDateString()}` : "No due date"}
                {openInvoice?.lateFeeApplied ? ` · Late fee $${((openInvoice.lateFeeCents ?? 0) / 100).toFixed(2)}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => runAdminAction("no_show")}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40 disabled:opacity-60"
            >
              {actionBusy === "no_show" ? "Saving..." : "Mark no-show"}
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => runAdminAction("apply_grace")}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40 disabled:opacity-60"
            >
              {actionBusy === "apply_grace" ? "Applying..." : "Apply grace"}
            </button>
            <div className="self-center text-xs text-[color:var(--muted)]">
              {openSession.data.graceApplied
                ? "Grace already applied"
                : openSession.data.noticeHours !== undefined && openSession.data.noticeHours !== null
                  ? `Notice: ${openSession.data.noticeHours.toFixed(1)} hours`
                  : "No notice recorded"}
            </div>
          </div>

          <div className="mt-4">
            <SessionLogEditor sessionId={openSession.id} />
          </div>
        </div>
      )}

      <style jsx global>{`
        .fc {
          --fc-border-color: color-mix(in oklab, var(--ring), transparent 35%);
          --fc-now-indicator-color: color-mix(in oklab, var(--brand), black 8%);
          font-size: 14px;
        }

        .sr-event .fc-event-main {
          padding: 0 !important;
          height: 100%;
        }
        .sr-event-inner {
          /* Fits exactly within FullCalendar's own allocated event block —
             overflow:hidden clips rather than lets content spill outside
             the rectangle; box-sizing keeps padding from adding to that. */
          box-sizing: border-box;
          height: 100%;
          overflow: hidden;
          padding: 2px 5px;
          line-height: 1.2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1px;
        }
        .sr-event-row {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          flex-wrap: nowrap;
        }
        .sr-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--brand), black 12%);
          flex: 0 0 auto;
        }
        .sr-title {
          font-size: 11px;
          font-weight: 700;
          min-width: 0;
          flex-shrink: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Student/tutor line */
        .sr-sub {
          font-size: 10.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .sr-sub-strong {
          font-weight: 700;
        }
        .sr-sub-muted {
          opacity: 0.85;
        }

        .sr-time {
          font-size: 10.5px;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sr-pill {
          margin-left: auto;
          flex-shrink: 0;
          font-size: 9.5px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--ring), transparent 15%);
          background: white;
          white-space: nowrap;
        }

        .sr-event {
          border-radius: 10px !important;
          border: 1px solid color-mix(in oklab, var(--ring), transparent 15%) !important;
          background: color-mix(in oklab, var(--card), white 18%) !important;
        }
        .sr-event--cancel {
          opacity: 0.6;
          text-decoration: line-through;
        }
        .sr-event--invoice {
          box-shadow: 0 0 0 1px color-mix(in oklab, var(--brand), transparent 55%) inset;
        }
        .fc-timegrid-event {
          margin: 1px 2px !important;
        }

        /* Ensure readable event text */
        .fc .fc-timegrid-event .fc-event-main,
        .fc .fc-daygrid-event .fc-event-main,
        .fc .fc-event-title,
        .fc .fc-event-time {
          color: var(--ink) !important;
        }
      `}</style>
    </div>
  );
}
