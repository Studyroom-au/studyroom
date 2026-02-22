// src/app/hub/admin/calendar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type SessionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_PARENT"
  | "CANCELLED_STUDYROOM"
  | "NO_SHOW";

type SessionDoc = {
  tutorId: string;
  tutorEmail: string | null;

  studentId: string;
  clientId: string;

  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes: number;

  modality: "IN_HOME" | "ONLINE";

  status: SessionStatus;
  billingStatus: string;

  notes?: string | null;
};

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function fmtDayHeader(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function statusChip(status: SessionStatus) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border";
  switch (status) {
    case "CONFIRMED":
      return base + " bg-white border-[color:var(--ring)] text-[color:var(--brand)]";
    case "COMPLETED":
      return base + " bg-emerald-50 border-emerald-200 text-emerald-700";
    case "CANCELLED_PARENT":
    case "CANCELLED_STUDYROOM":
      return base + " bg-rose-50 border-rose-200 text-rose-700";
    case "NO_SHOW":
      return base + " bg-amber-50 border-amber-200 text-amber-700";
    default:
      return base + " bg-white border-[color:var(--ring)] text-[color:var(--muted)]";
  }
}

export default function AdminCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [sessions, setSessions] = useState<(SessionDoc & { id: string })[]>([]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekRange = useMemo(() => {
    const start = new Date(weekStart);
    const end = addDays(start, 7);
    return { start, end };
  }, [weekStart]);

  // Hours shown
  const HOURS_START = 7;
  const HOURS_END = 20;
  const SLOT_MIN = 30;
  const MINUTES_PER_DAY_VIEW = (HOURS_END - HOURS_START) * 60;

  const timeLabels = useMemo(() => {
    const labels: { hour: number; minute: number; label: string }[] = [];
    for (let m = HOURS_START * 60; m <= HOURS_END * 60; m += SLOT_MIN) {
      const h = Math.floor(m / 60);
      const mi = m % 60;
      const d = new Date();
      d.setHours(h, mi, 0, 0);
      labels.push({ hour: h, minute: mi, label: fmtTime(d) });
    }
    return labels;
  }, []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      // Admin layout already gates access
      setLoading(true);
      try {
        const from = Timestamp.fromDate(weekRange.start);
        const to = Timestamp.fromDate(weekRange.end);

        const qy = query(
          collection(db, "sessions"),
          where("startAt", ">=", from),
          where("startAt", "<", to),
          orderBy("startAt", "asc")
        );

        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
        setSessions(list);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, [weekRange.start, weekRange.end]);

  const sessionsByDay = useMemo(() => {
    const map: Record<string, (SessionDoc & { id: string })[]> = {};
    for (const day of weekDays) map[day.toDateString()] = [];
    for (const s of sessions) {
      const start = s.startAt.toDate();
      const key = new Date(start.getFullYear(), start.getMonth(), start.getDate()).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [sessions, weekDays]);

  function blockStyle(s: SessionDoc) {
    const start = s.startAt.toDate();
    const end = s.endAt.toDate();
    const startMin = minutesSinceMidnight(start);
    const endMin = minutesSinceMidnight(end);

    const topMin = clamp(startMin - HOURS_START * 60, 0, MINUTES_PER_DAY_VIEW);
    const heightMin = clamp(endMin - startMin, 15, MINUTES_PER_DAY_VIEW);

    const topPct = (topMin / MINUTES_PER_DAY_VIEW) * 100;
    const heightPct = (heightMin / MINUTES_PER_DAY_VIEW) * 100;

    return { top: `${topPct}%`, height: `${heightPct}%` } as React.CSSProperties;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Control Panel
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[color:var(--ink)]">
            Calendar (All Sessions)
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Admin oversight of the full timetable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeekMonday(addDays(weekStart, -7)))}
            className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
            className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeekMonday(addDays(weekStart, 7)))}
            className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            Next →
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-[color:var(--ring)]">
          <div className="p-3 text-xs font-semibold text-[color:var(--muted)]">Time</div>
          {weekDays.map((d) => (
            <div key={d.toISOString()} className="p-3 text-xs font-semibold text-[color:var(--muted)]">
              {fmtDayHeader(d)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[80px_repeat(7,1fr)]">
          <div className="border-r border-[color:var(--ring)]">
            {timeLabels.map((t, idx) => (
              <div key={idx} className="h-10 px-3 py-2 text-[11px] font-semibold text-[color:var(--muted)]">
                {t.minute === 0 ? t.label : ""}
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const key = day.toDateString();
            const daySessions = sessionsByDay[key] ?? [];

            return (
              <div key={key} className="relative border-r border-[color:var(--ring)]">
                {timeLabels.map((_, idx) => (
                  <div key={idx} className="h-10 w-full border-b border-[color:var(--ring)]/60" />
                ))}

                <div className="absolute inset-0">
                  {daySessions.map((s) => {
                    const start = s.startAt.toDate();
                    const end = s.endAt.toDate();
                    return (
                      <div
                        key={s.id}
                        className="absolute left-1 right-1 rounded-2xl border border-[color:var(--ring)] bg-white/95 p-2 text-left shadow-sm"
                        style={blockStyle(s)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[color:var(--ink)]">
                              Tutor: {s.tutorEmail || s.tutorId}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                              {fmtTime(start)}–{fmtTime(end)} · {s.modality === "ONLINE" ? "Online" : "In-home"}
                            </div>
                          </div>
                          <span className={statusChip(s.status)}>{s.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="p-4 text-sm text-[color:var(--muted)]">Loading sessions…</div>
        )}
      </section>
    </div>
  );
}
