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

import type {
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

import SessionLogEditor from "@/components/session/SessionLogEditor";

type SessionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_PARENT"
  | "CANCELLED_STUDYROOM"
  | "NO_SHOW";

type BillingStatus =
  | "NOT_BILLED"
  | "READY_TO_INVOICE"
  | "INVOICED"
  | "CREDITED"
  | "FORFEITED";

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;

  studentId: string;
  clientId: string;

  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes: number;

  status: SessionStatus;
  billingStatus: BillingStatus;

  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  notes?: string | null;

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

function niceTimeRange(start: Date, end: Date) {
  const s = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const e = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${s}–${e}`;
}

function statusChip(status: SessionStatus) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "SCHEDULED") return "Session";
  if (status === "NO_SHOW") return "No-show";
  if (status.startsWith("CANCELLED")) return "Cancelled";
  return status;
}

function modalityLabel(m?: SessionDoc["modality"]) {
  if (!m) return "";
  if (m === "ONLINE") return "Online";
  if (m === "IN_HOME") return "In-home";
  if (m === "GROUP") return "Group";
  return "";
}

export default function AdminSessionsCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);

  const [students, setStudents] = useState<Record<string, StudentDoc>>({});
  const [tutors, setTutors] = useState<Record<string, UserDoc>>({});

  const [openId, setOpenId] = useState<string | null>(null);

  const openSession = useMemo(
    () => sessions.find((s) => s.id === openId) ?? null,
    [openId, sessions]
  );

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
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  const events = useMemo(() => {
    return sessions.map((s) => {
      const start = s.data.startAt?.toDate?.() ?? new Date();
      const end = s.data.endAt?.toDate?.() ?? new Date(start.getTime() + 60 * 60 * 1000);

      const stud = studentLabel(s.data.studentId);
      const tut = tutorLabel(s.data.tutorId, s.data.tutorEmail);

      const classNames = [
        "sr-event",
        s.data.status === "COMPLETED" ? "sr-event--done" : "",
        s.data.status.startsWith("CANCELLED") ? "sr-event--cancel" : "",
        s.data.billingStatus === "READY_TO_INVOICE" ? "sr-event--invoice" : "",
      ].filter(Boolean);

      return {
        id: s.id,
        // Title is fallback only; eventContent controls display
        title: `${statusChip(s.data.status)} · ${stud} · ${tut}`,
        start,
        end,
        classNames,
        extendedProps: {
          status: s.data.status,
          billingStatus: s.data.billingStatus,
          studentLabel: stud,
          tutorLabel: tut,
          modality: s.data.modality ?? null,
        },
      };
    });
  }, [sessions, studentLabel, tutorLabel]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Admin
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Sessions</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Drag to reschedule · Resize to change duration
        </p>
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
            eventDurationEditable
            eventResizableFromStart
            events={events}
            eventClick={onEventClick}
            eventDrop={onDrop}
            eventResize={onResize}
            eventContent={(arg: EventContentArg) => {
              const start = arg.event.start ?? new Date();
              const end = arg.event.end ?? new Date(start.getTime() + 60 * 60000);

              const status = String(arg.event.extendedProps?.status ?? "");
              const billing = String(arg.event.extendedProps?.billingStatus ?? "");
              const stud = String(arg.event.extendedProps?.studentLabel ?? "Student");
              const tut = String(arg.event.extendedProps?.tutorLabel ?? "Tutor");
              const mod = arg.event.extendedProps?.modality as SessionDoc["modality"] | null;

              const compact = arg.view.type === "dayGridMonth";
              const topLabel = statusChip(status as SessionStatus);

              return (
                <div className="sr-event-inner">
                  {/* ✅ Keep your original “Completed/Session + Invoice” row */}
                  <div className="sr-event-row">
                    <span className="sr-dot" />
                    <span className="sr-title">{topLabel}</span>
                    {billing === "READY_TO_INVOICE" && <span className="sr-pill">Invoice</span>}
                    {!compact && modalityLabel(mod ?? undefined) && (
                      <span className="sr-pill">{modalityLabel(mod ?? undefined)}</span>
                    )}
                  </div>

                  {/* ✅ New: show student + tutor in BOTH views */}
                  <div className="sr-sub">
                    <span className="sr-sub-strong">{stud}</span>
                    <span className="sr-sub-muted"> · {tut}</span>
                  </div>

                  {/* ✅ Time shown in BOTH, like your screenshot */}
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
              <div className="mt-1 text-lg font-semibold text-[color:var(--ink)]">
                {statusChip(openSession.data.status)}
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {niceTimeRange(openSession.data.startAt.toDate(), openSession.data.endAt.toDate())}
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {studentLabel(openSession.data.studentId)} ·{" "}
                {tutorLabel(openSession.data.tutorId, openSession.data.tutorEmail)}
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
        }
        .sr-event-inner {
          padding: 4px 6px;
          line-height: 1.05;
        }
        .sr-event-row {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sr-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--brand), black 12%);
          flex: 0 0 auto;
        }
        .sr-title {
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ✅ NEW: student/tutor line */
        .sr-sub {
          margin-top: 2px;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sr-sub-strong {
          font-weight: 700;
        }
        .sr-sub-muted {
          opacity: 0.85;
        }

        .sr-time {
          margin-top: 2px;
          font-size: 11px;
          opacity: 0.85;
        }
        .sr-pill {
          margin-left: auto;
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
