"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

type SessionStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED_PARENT" | "CANCELLED_STUDYROOM" | "NO_SHOW";
type BillingStatus = "NOT_BILLED" | "READY_TO_INVOICE" | "BILLED" | "CREDITED" | "FORFEITED";

type SessionRow = {
  id: string;
  studentId: string;
  startAt: Timestamp;
  durationMinutes: number;
  status: SessionStatus;
  billingStatus: BillingStatus;
  tutorPayableCents: number;
};

type StudentMap = Record<string, { studentName?: string; yearLevel?: string }>;

type SessionDoc = {
  studentId?: string;
  startAt?: Timestamp;
  durationMinutes?: number;
  status?: SessionStatus;
  billingStatus?: BillingStatus;
  tutorPayableCents?: number;
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
};

type CsvRow = {
  sessionId: string;
  when: string;
  student: string;
  durationMinutes: number;
  status: SessionStatus;
  payable: string;
};

const TUTOR_DEFAULT_RATE_CENTS_PER_HOUR = 4000;

function payableCentsForSession(s: SessionRow) {
  if (typeof s.tutorPayableCents === "number" && s.tutorPayableCents > 0) {
    return s.tutorPayableCents;
  }
  if (s.status !== "COMPLETED") return 0;
  return Math.round((s.durationMinutes / 60) * TUTOR_DEFAULT_RATE_CENTS_PER_HOUR);
}

function toISODateInput(d: Date) {
  // yyyy-mm-dd
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmt(ts: Timestamp) {
  return ts.toDate().toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TutorPayoutsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // default: last 14 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toISODateInput(d);
  });
  const [endDate, setEndDate] = useState(() => toISODateInput(new Date()));

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [students, setStudents] = useState<StudentMap>({});

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
    });
    return () => off();
  }, []);

  async function load() {
    if (!uid) return;
    setLoading(true);
    try {
      const start = new Date(`${startDate}T00:00:00`);
      const endExclusive = new Date(`${endDate}T00:00:00`);
      endExclusive.setDate(endExclusive.getDate() + 1); // include end day

      const from = Timestamp.fromDate(start);
      const to = Timestamp.fromDate(endExclusive);

      // Composite index required: sessions (tutorId ASC, startAt ASC)
      const qy = query(
        collection(db, "sessions"),
        where("tutorId", "==", uid),
        where("startAt", ">=", from),
        where("startAt", "<", to),
        orderBy("startAt", "asc")
      );

      const snap = await getDocs(qy);
      const list: SessionRow[] = snap.docs.map((d) => {
        const data = d.data() as SessionDoc;
        return {
          id: d.id,
          studentId: data.studentId ?? "",
          startAt: data.startAt ?? Timestamp.fromDate(new Date(0)),
          durationMinutes: data.durationMinutes ?? 60,
          status: data.status ?? "SCHEDULED",
          billingStatus: data.billingStatus ?? "NOT_BILLED",
          tutorPayableCents: data.tutorPayableCents ?? 0,
        };
      });

      setSessions(list);

      // pull student names once (simple approach)
      const sSnap = await getDocs(collection(db, "students"));
      const map: StudentMap = {};
      sSnap.docs.forEach((d) => (map[d.id] = d.data() as StudentDoc));
      setStudents(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!uid) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const completed = useMemo(
    () => sessions.filter((s) => s.status === "COMPLETED"),
    [sessions]
  );

  const totalCents = useMemo(
    () => completed.reduce((sum, s) => sum + payableCentsForSession(s), 0),
    [completed]
  );

  function studentLabel(studentId: string) {
    const s = students[studentId];
    if (!s) return "Student";
    const name = s.studentName ?? "Student";
    const yl = s.yearLevel ? ` (${s.yearLevel})` : "";
    return `${name}${yl}`;
  }

  function exportCSV() {
    const rows: CsvRow[] = completed.map((s) => ({
      sessionId: s.id,
      when: fmt(s.startAt),
      student: studentLabel(s.studentId),
      durationMinutes: s.durationMinutes,
      status: s.status,
      payable: (payableCentsForSession(s) / 100).toFixed(2),
    }));

    const header: Array<keyof CsvRow> = Object.keys(
      rows[0] ?? { sessionId: "", when: "", student: "", durationMinutes: 0, status: "SCHEDULED", payable: "" }
    ) as Array<keyof CsvRow>;
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((k) => {
            const v = r[k] ?? "";
            const escaped = String(v).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
      "",
      `"TOTAL","","","","","${(totalCents / 100).toFixed(2)}"`,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyroom_tutor_payperiod_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Tutor Portal
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[color:var(--ink)]">
          Pay period export
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Select your dates, review completed sessions, then export CSV.
        </p>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="start" className="text-xs font-semibold text-[color:var(--muted)]">
              Start date
            </label>
            <input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="end" className="text-xs font-semibold text-[color:var(--muted)]">
              End date
            </label>
            <input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={load}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={completed.length === 0}
              className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
            <div className="text-xs font-semibold text-[color:var(--muted)]">Completed sessions</div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{completed.length}</div>
          </div>

          <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-4 md:col-span-2">
            <div className="text-xs font-semibold text-[color:var(--muted)]">Total payable</div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">
              ${(totalCents / 100).toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Uses stored tutorPayableCents, falling back to $40/hour when missing.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Sessions in period</h2>

        {loading ? (
          <div className="mt-4 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="mt-4 text-sm text-[color:var(--muted)]">No sessions found.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Payable</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-[color:var(--ring)]">
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">{fmt(s.startAt)}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--ink)]">
                      {studentLabel(s.studentId)}
                    </td>
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">{s.durationMinutes} min</td>
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">{s.status}</td>
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                      {s.status === "COMPLETED" ? `$${(payableCentsForSession(s) / 100).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
