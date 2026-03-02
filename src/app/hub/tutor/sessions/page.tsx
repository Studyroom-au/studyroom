"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import type { EventClickArg, EventDropArg, EventContentArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

import Drawer from "@/components/ui/Drawer";
import RescheduleSession from "@/components/session/RescheduleSession";
import SessionLogEditor from "@/components/session/SessionLogEditor";
import {
  SESSION_DURATION_MINS,
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

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;
  studentId: string;
  clientId?: string | null;
  planId?: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes?: number;
  durationMins?: number;
  status: string;
  billingStatus?: string;
  billingOutcome?: BillingOutcome | null;
  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  mode?: "in_home" | "online" | "group" | null;
  graceApplied?: boolean | null;
  noticeHours?: number | null;
  consumed?: boolean | null;
  invoiceId?: string | null;
  xeroInvoiceId?: string | null;
  seriesKey?: string | null;
  notes?: string | null;
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  clientId?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  assignedTutorId?: string;
  assignedTutorEmail?: string;
  activePlanId?: string | null;
  package?: string | null;
  mode?: "online" | "in-home" | null;
};

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
};

type InvoiceDoc = {
  status?: InvoiceStatus | null;
};

type AddModality = "IN_HOME" | "ONLINE";

function isAddModality(v: string): v is AddModality {
  return v === "IN_HOME" || v === "ONLINE";
}

function getErrorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Something went wrong.";
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function niceRange(start: Date, end: Date) {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export default function TutorSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);
  const [students, setStudents] = useState<Record<string, StudentDoc>>({});
  const [clients, setClients] = useState<Record<string, ClientDoc>>({});
  const [plans, setPlans] = useState<Record<string, StudyroomPlanRecord>>({});
  const [entitlements, setEntitlements] = useState<Record<string, StudyroomEntitlementRecord>>({});
  const [invoices, setInvoices] = useState<Record<string, InvoiceDoc>>({});

  const [openId, setOpenId] = useState<string | null>(null);

  // Add Session Drawer
  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addWhenLocal, setAddWhenLocal] = useState(""); // yyyy-mm-ddThh:mm
  const [addDuration, setAddDuration] = useState(SESSION_DURATION_MINS);
  const [addModality, setAddModality] = useState<AddModality>("IN_HOME");
  const [addNotes, setAddNotes] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Recurring
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [recurringBusy, setRecurringBusy] = useState(false);

  // Address editor
  const [addressDraft, setAddressDraft] = useState({
    addressLine1: "",
    suburb: "",
    postcode: "",
  });
  const [savingAddress, setSavingAddress] = useState(false);

  const openSession = useMemo(
    () => sessions.find((s) => s.id === openId) ?? null,
    [openId, sessions]
  );

  const openStudent = useMemo(() => {
    if (!openSession) return null;
    return students[openSession.data.studentId] ?? null;
  }, [openSession, students]);

  const openClient = useMemo(() => {
    if (!openSession) return null;
    const cid = openSession.data.clientId || openStudent?.clientId || "";
    if (!cid) return null;
    return clients[cid] ?? null;
  }, [openSession, openStudent, clients]);
  const openPlan = useMemo(() => {
    const planId = openSession?.data.planId ?? openStudent?.activePlanId ?? "";
    return planId ? plans[planId] ?? null : null;
  }, [openSession, openStudent, plans]);
  const openEntitlement = useMemo(() => {
    const planId = openSession?.data.planId ?? openStudent?.activePlanId ?? "";
    return planId ? entitlements[planId] ?? null : null;
  }, [openSession, openStudent, entitlements]);
  const openInvoice = useMemo(() => {
    const invoiceId = openSession?.data.invoiceId ?? "";
    return invoiceId ? invoices[invoiceId] ?? null : null;
  }, [openSession, invoices]);

  useEffect(() => {
    if (!openStudent) return;
    setAddressDraft({
      addressLine1: openStudent.addressLine1 || "",
      suburb: openStudent.suburb || "",
      postcode: openStudent.postcode || "",
    });
  }, [openStudent]);

  const studentLabel = useCallback(
    (studentId: string) => {
      const s = students[studentId];
      if (!s) return "Session";
      const yr = s.yearLevel ? ` (${s.yearLevel})` : "";
      return `${s.studentName ?? "Student"}${yr}`;
    },
    [students]
  );

  const refresh = useCallback(
    async (uid: string, email?: string | null) => {
      if (!uid) return;
      setLoading(true);
      try {
        const sessionSnap = await getDocs(
          query(collection(db, "sessions"), where("tutorId", "==", uid), orderBy("startAt", "asc"))
        );

        const nextSessions = sessionSnap.docs.map((d) => ({
          id: d.id,
          data: d.data() as SessionDoc,
        }));
        setSessions(nextSessions);

        // Students: by assignedTutorId, fallback to assignedTutorEmail
        let studentSnap = await getDocs(query(collection(db, "students"), where("assignedTutorId", "==", uid)));

        if (studentSnap.empty && email) {
          studentSnap = await getDocs(
            query(collection(db, "students"), where("assignedTutorEmail", "==", email.toLowerCase()))
          );
        }

        const studentMap: Record<string, StudentDoc> = {};
        studentSnap.docs.forEach((d) => {
          studentMap[d.id] = d.data() as StudentDoc;
        });
        setStudents(studentMap);

        // default student for add drawer
        setAddStudentId((prev) => {
          if (prev) return prev;
          const first = Object.keys(studentMap)[0];
          return first ?? "";
        });

        const clientIds = Array.from(
          new Set(
            nextSessions
              .map((s) => s.data.clientId)
              .concat(Object.values(studentMap).map((s) => s.clientId || null))
              .filter(Boolean) as string[]
          )
        );

        const clientMap: Record<string, ClientDoc> = {};
        await Promise.all(
          clientIds.map(async (id) => {
            const snap = await getDoc(doc(db, "clients", id));
            if (snap.exists()) clientMap[id] = snap.data() as ClientDoc;
          })
        );
        setClients(clientMap);

        const planIds = Array.from(
          new Set(
            nextSessions
              .map((s) => s.data.planId)
              .concat(Object.values(studentMap).map((s) => s.activePlanId || null))
              .filter(Boolean) as string[]
          )
        );

        const planMap: Record<string, StudyroomPlanRecord> = {};
        const entitlementMap: Record<string, StudyroomEntitlementRecord> = {};
        await Promise.all(
          planIds.map(async (id) => {
            const planSnap = await getDoc(doc(db, "plans", id));
            if (planSnap.exists()) {
              planMap[id] = { id, ...(planSnap.data() as StudyroomPlanRecord) };
            }
            const entitlementSnap = await getDoc(doc(db, "entitlements", id));
            if (entitlementSnap.exists()) {
              entitlementMap[id] = { id, ...(entitlementSnap.data() as StudyroomEntitlementRecord) };
            }
          })
        );
        setPlans(planMap);
        setEntitlements(entitlementMap);

        const invoiceIds = Array.from(new Set(nextSessions.map((s) => s.data.invoiceId).filter(Boolean) as string[]));
        const invoiceMap: Record<string, InvoiceDoc> = {};
        await Promise.all(
          invoiceIds.map(async (id) => {
            const snap = await getDoc(doc(db, "invoices", id));
            if (snap.exists()) invoiceMap[id] = snap.data() as InvoiceDoc;
          })
        );
        setInvoices(invoiceMap);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      refresh(u.uid, u.email ?? null);
    });
    return () => off();
  }, [refresh]);

  const events = useMemo(() => {
    return sessions.map((s) => {
      const start = s.data.startAt.toDate();
      const end = s.data.endAt.toDate();

      const classNames = [
        "sr-event",
        normalizeSessionStatus(s.data.status) === "completed" ? "sr-event--done" : "",
        normalizeSessionStatus(s.data.status).startsWith("cancelled") ? "sr-event--cancel" : "",
        s.data.billingOutcome === "invoice" ? "sr-event--invoice" : "",
      ].filter(Boolean);

      return {
        id: s.id,
        title: studentLabel(s.data.studentId),
        start,
        end,
        classNames,
        extendedProps: {
          billingStatus: s.data.billingStatus,
          billingOutcome: s.data.billingOutcome ?? null,
          status: normalizeSessionStatus(s.data.status),
        },
      };
    });
  }, [sessions, studentLabel]);

  async function updateSessionStatus(
    sessionId: string,
    action: "complete" | "cancel_by_parent" | "cancel_by_tutor" | "no_show"
  ) {
    const user = auth.currentUser;
    if (!user) return;

    const idToken = await user.getIdToken();
    const res = await fetch("/api/sessions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ sessionId, action }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Session update failed:", res.status, t);
      alert("Session update failed. Check console / server logs.");
    } else {
      await refresh(user.uid, user.email ?? null);
      setOpenId(null);
    }
  }

  async function cancelSession(sessionId: string, reason: "PARENT" | "STUDYROOM") {
    const yes = confirm(
      reason === "PARENT"
        ? "Cancel this session as a parent cancellation?"
        : "Cancel this session as a tutor cancellation? This records a credit outcome."
    );
    if (!yes) return;
    await updateSessionStatus(sessionId, reason === "STUDYROOM" ? "cancel_by_tutor" : "cancel_by_parent");
  }

  async function createRecurringFromOpenSession() {
    if (!openSession) return;
    const weeks = Math.max(1, Math.min(12, recurringWeeks));
    setRecurringBusy(true);
    try {
      const base = openSession.data;
      const baseStart = base.startAt.toDate();
      const baseEnd = base.endAt.toDate();
      const durationMin = minutesBetween(baseStart, baseEnd);
      const seriesKey = base.seriesKey || `series-${openSession.id}`;

      for (let i = 1; i <= weeks; i++) {
        const start = addDays(baseStart, 7 * i);
        const end = addDays(baseEnd, 7 * i);

        await addDoc(collection(db, "sessions"), {
          tutorId: base.tutorId,
          tutorEmail: base.tutorEmail ?? auth.currentUser?.email ?? null,
          studentId: base.studentId,
          clientId: base.clientId ?? null,
          planId: base.planId ?? students[base.studentId]?.activePlanId ?? null,
          startAt: Timestamp.fromDate(start),
          endAt: Timestamp.fromDate(end),
          durationMinutes: durationMin,
          durationMins: durationMin,
          modality: base.modality ?? "IN_HOME",
          mode: normalizeMode(base.mode ?? base.modality ?? "IN_HOME"),
          status: "scheduled",
          legacyStatus: "SCHEDULED",
          seriesKey,
          notes: base.notes ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      alert(`Created ${weeks} recurring weekly sessions.`);
      await refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null);
    } catch (e: unknown) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
      setRecurringBusy(false);
    }
  }

  async function saveStudentAddress() {
    if (!openSession) return;
    setSavingAddress(true);
    try {
      await updateDoc(doc(db, "students", openSession.data.studentId), {
        addressLine1: addressDraft.addressLine1.trim() || null,
        suburb: addressDraft.suburb.trim() || null,
        postcode: addressDraft.postcode.trim() || null,
        updatedAt: serverTimestamp(),
      });
      await refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null);
      alert("Student address saved.");
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    } finally {
      setSavingAddress(false);
    }
  }

  async function createSessionFromDrawer() {
    const user = auth.currentUser;
    if (!user) return alert("Please sign in.");

    const student = students[addStudentId];
    if (!student) return alert("Please select a student.");
    if (!addWhenLocal) return alert("Please choose a date/time.");

    const start = new Date(addWhenLocal);
    if (Number.isNaN(start.getTime())) return alert("Invalid date/time.");

    const end = new Date(start.getTime() + addDuration * 60000);

    setAddBusy(true);
    try {
      await addDoc(collection(db, "sessions"), {
        tutorId: user.uid,
        tutorEmail: user.email ?? null,
        studentId: addStudentId,
        clientId: student.clientId ?? null,
        planId: student.activePlanId ?? null,
        startAt: Timestamp.fromDate(start),
        endAt: Timestamp.fromDate(end),
        durationMinutes: addDuration,
        durationMins: addDuration,
        modality: addModality,
        mode: normalizeMode(addModality),
        status: "scheduled",
        legacyStatus: "SCHEDULED",
        notes: addNotes.trim() ? addNotes.trim() : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAddNotes("");
      setAddOpen(false);
      await refresh(user.uid, user.email ?? null);
      alert("Session created.");
    } catch (e: unknown) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
      setAddBusy(false);
    }
  }

  async function persistReschedule(sessionId: string, start: Date, end: Date) {
    const user = auth.currentUser;
    if (!user) return;

    const idToken = await user.getIdToken();
    const res = await fetch("/api/sessions/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        sessionId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      }),
    });

    if (!res.ok) {
      const json: unknown = await res.json().catch(() => ({}));
      const msg =
        json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : "Reschedule failed.";
      alert(msg);
      await refresh(user.uid, user.email ?? null);
      return;
    }

    await refresh(user.uid, user.email ?? null);
  }

  // ids for accessible labels
  const idStudent = "add-session-student";
  const idWhen = "add-session-when";
  const idDuration = "add-session-duration";
  const idModality = "add-session-modality";
  const idNotes = "add-session-notes";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Tutor Portal</p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Sessions</h1>
            <p className="text-sm text-[color:var(--muted)]">Click a session for details. Drag to reschedule.</p>
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Add session
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : (
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,dayGridMonth",
            }}
            height="auto"
            nowIndicator
            firstDay={1}
            slotMinTime="06:00:00"
            slotMaxTime="21:00:00"
            slotDuration="00:30:00"
            editable
            eventStartEditable
            eventDurationEditable={false}
            eventResizableFromStart={false}
            events={events}
            eventClick={(arg: EventClickArg) => setOpenId(arg.event.id)}
            eventDrop={(arg: EventDropArg) => persistReschedule(arg.event.id, arg.event.start!, arg.event.end!)}
            eventResize={(arg: EventResizeDoneArg) => persistReschedule(arg.event.id, arg.event.start!, arg.event.end!)}
            eventContent={(arg: EventContentArg) => {
              const start = arg.event.start ?? new Date();
              const end =
                arg.event.end ?? new Date((arg.event.start?.getTime() || Date.now()) + 60 * 60000);
              const status = normalizeSessionStatus(arg.event.extendedProps?.status);
              const topLabel = formatSessionStatusLabel(status);
              const outcome = arg.event.extendedProps?.billingOutcome as BillingOutcome | null;

              return (
                <div className="sr-event-inner">
                  <div className="sr-row">
                    <div className="sr-title">{topLabel}</div>
                    {outcome === "invoice" && <span className="sr-pill">Invoice</span>}
                  </div>
                  <div className="sr-sub">{arg.event.title}</div>
                  <div className="sr-time">{niceRange(start, end)}</div>
                </div>
              );
            }}
          />
        )}
      </section>

      {/* Add Session Drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Session">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={idStudent} className="text-xs font-semibold text-[color:var(--muted)]">
              Student
            </label>
            <select
              id={idStudent}
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
            >
              {Object.keys(students).length === 0 ? (
                <option value="">No students yet</option>
              ) : (
                Object.entries(students)
                  .sort((a, b) => (a[1].studentName || "").localeCompare(b[1].studentName || ""))
                  .map(([id, s]) => (
                    <option key={id} value={id}>
                      {s.studentName ?? "Student"}
                      {s.yearLevel ? ` · ${s.yearLevel}` : ""}
                    </option>
                  ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor={idWhen} className="text-xs font-semibold text-[color:var(--muted)]">
              Date & time
            </label>
            <input
              id={idWhen}
              type="datetime-local"
              value={addWhenLocal}
              onChange={(e) => setAddWhenLocal(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label htmlFor={idDuration} className="text-xs font-semibold text-[color:var(--muted)]">
                Duration
              </label>
              <select
                id={idDuration}
                value={addDuration}
                onChange={(e) => setAddDuration(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              >
                <option value={60}>60 min</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor={idModality} className="text-xs font-semibold text-[color:var(--muted)]">
                Modality
              </label>
              <select
                id={idModality}
                value={addModality}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isAddModality(v)) setAddModality(v);
                }}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              >
                <option value="IN_HOME">In-home</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor={idNotes} className="text-xs font-semibold text-[color:var(--muted)]">
              Notes
            </label>
            <textarea
              id={idNotes}
              rows={3}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full rounded-2xl border border-[color:var(--ring)] bg-white px-4 py-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={createSessionFromDrawer}
            disabled={addBusy}
            className="brand-cta w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {addBusy ? "Creating…" : "Create session"}
          </button>
        </div>
      </Drawer>

      {/* Existing Session Details Drawer */}
      <Drawer open={!!openSession} onClose={() => setOpenId(null)} title="Session Details">
        {openSession && (
          <>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[color:var(--ink)]">
                {openStudent?.studentName ?? "Student"}
                {openStudent?.yearLevel ? ` (${openStudent.yearLevel})` : ""}
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                {niceRange(openSession.data.startAt.toDate(), openSession.data.endAt.toDate())}
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Status: <b>{formatSessionStatusLabel(normalizeSessionStatus(openSession.data.status))}</b> · Outcome:{" "}
                <b>{openSession.data.billingOutcome ?? "no_charge"}</b> ·{" "}
                {formatModeLabel(normalizeMode(openSession.data.mode ?? openSession.data.modality))}
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Plan: <b>{formatPlanLabel(normalizePlanType(openStudent?.package))}</b>
                {openSession.data.noticeHours !== null && openSession.data.noticeHours !== undefined
                  ? ` · Notice: ${openSession.data.noticeHours.toFixed(1)}h`
                  : ""}
                {openSession.data.graceApplied ? " · Grace applied" : ""}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Plan</div>
                <div className="mt-1 font-semibold text-[color:var(--ink)]">
                  {formatPlanLabel(normalizePlanType(openPlan?.type ?? openStudent?.package))}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {openEntitlement
                    ? `${openEntitlement.remainingSessions} base remaining · ${openEntitlement.bonusRemaining} bonus`
                    : "No package balance shown"}
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Billing</div>
                <div className="mt-1 font-semibold text-[color:var(--ink)]">
                  {openSession.data.billingOutcome ?? "no_charge"}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {openInvoice?.status ? `Invoice status: ${openInvoice.status}` : "No invoice linked"}
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Tutor action</div>
                <div className="mt-1 font-semibold text-[color:var(--ink)]">
                  {normalizeSessionStatus(openSession.data.status) === "scheduled"
                    ? "Choose what happened"
                    : "Recorded"}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  Complete if delivered. Parent cancel if family cancelled. Studyroom cancel if you cancelled.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--ring)] bg-white p-3">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Parent</div>
              <div className="mt-1 text-sm text-[color:var(--ink)]">{openClient?.parentName || "—"}</div>
              <div className="text-xs text-[color:var(--muted)]">
                {openClient?.parentEmail || "—"} {openClient?.parentPhone ? `· ${openClient.parentPhone}` : ""}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[color:var(--ring)] bg-white p-3">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Student Address</div>
              <div className="mt-2 grid gap-2">
                <input
                  aria-label="Address line 1"
                  value={addressDraft.addressLine1}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, addressLine1: e.target.value }))}
                  placeholder="Address line 1"
                  className="rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label="Suburb"
                    value={addressDraft.suburb}
                    onChange={(e) => setAddressDraft((p) => ({ ...p, suburb: e.target.value }))}
                    placeholder="Suburb"
                    className="rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
                  />
                  <input
                    aria-label="Postcode"
                    value={addressDraft.postcode}
                    onChange={(e) => setAddressDraft((p) => ({ ...p, postcode: e.target.value }))}
                    placeholder="Postcode"
                    className="rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveStudentAddress}
                  disabled={savingAddress}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40 disabled:opacity-60"
                >
                  {savingAddress ? "Saving..." : "Save address"}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-[color:var(--ring)] bg-white p-3">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Recurring Sessions</div>
              <div className="mt-2 flex items-center gap-2">
                <label className="sr-only" htmlFor="recurring-weeks">
                  Number of weeks for recurring sessions
                </label>
                <select
                  id="recurring-weeks"
                  value={recurringWeeks}
                  onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                  className="rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 6, 8, 10, 12].map((w) => (
                    <option key={w} value={w}>
                      {w} week{w > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={createRecurringFromOpenSession}
                  disabled={recurringBusy}
                  className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {recurringBusy ? "Creating..." : "Add recurring"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">Creates weekly sessions from this same time slot.</p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Tutor workflow</div>
                <div className="mt-2 text-sm text-[color:var(--ink)]">
                  1. Reschedule if the time changes.
                </div>
                <div className="text-sm text-[color:var(--ink)]">
                  2. Mark completed after the lesson finishes.
                </div>
                <div className="text-sm text-[color:var(--ink)]">
                  3. Use parent cancel only when the family cancels. Use Studyroom cancel only when you or admin cancel.
                </div>
                <div className="text-sm text-[color:var(--ink)]">
                  4. Add notes after the session so admin sees the same record.
                </div>
              </div>

              <RescheduleSession
                sessionId={openSession.id}
                currentStart={openSession.data.startAt.toDate()}
                currentEnd={openSession.data.endAt.toDate()}
                onDone={() => refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null)}
              />

              <div className="flex flex-wrap gap-2">
                {normalizeSessionStatus(openSession.data.status) !== "completed" && (
                  <button
                    type="button"
                    className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold"
                    onClick={() => updateSessionStatus(openSession.id, "complete")}
                  >
                    Mark completed
                  </button>
                )}

                <button
                  type="button"
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
                  onClick={() => cancelSession(openSession.id, "PARENT")}
                >
                  Cancel (parent)
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
                  onClick={() => cancelSession(openSession.id, "STUDYROOM")}
                >
                  Cancel (tutor)
                </button>
              </div>

              <div className="pt-3">
                <SessionLogEditor sessionId={openSession.id} />
              </div>
            </div>
          </>
        )}
      </Drawer>

      <style jsx global>{`
        .sr-event-inner {
          padding: 4px 6px;
          line-height: 1.1;
        }
        .sr-title {
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sr-row {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: space-between;
        }
        .sr-sub {
          margin-top: 2px;
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sr-time {
          margin-top: 2px;
          font-size: 11px;
          opacity: 0.8;
        }
        .sr-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--ring), transparent 15%);
          background: white;
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

        .fc .fc-timegrid-event .fc-event-main,
        .fc .fc-daygrid-event .fc-event-main {
          color: var(--ink) !important;
        }
        .fc .fc-event-title,
        .fc .fc-event-time {
          color: var(--ink) !important;
        }
        .fc .fc-event .sr-event-inner {
          display: block !important;
        }
      `}</style>
    </div>
  );
}
