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
  status: string;
  billingStatus: string;
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
  status: string;
  payable: string;
};

const TUTOR_DEFAULT_RATE_CENTS_PER_HOUR = 4000;

function payableCentsForSession(s: SessionRow) {
  if (typeof s.tutorPayableCents === "number" && s.tutorPayableCents > 0) {
    return s.tutorPayableCents;
  }
  if (s.status.toLowerCase() !== "completed") return 0;
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
    () => sessions.filter((s) => s.status.toLowerCase() === "completed"),
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

  const inputSt: React.CSSProperties = { border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "8px 11px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none", width: "100%", background: "#fff", boxSizing: "border-box" };
  const cardSt: React.CSSProperties = { background: "white", borderRadius: 18, padding: 16, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Page header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Payouts
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>Pay Period Export</div>
        <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 3 }}>Select dates, review sessions, then export CSV.</div>
      </div>

      {/* Date range + actions */}
      <div style={cardSt}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>Start date</div>
            <input id="start" type="date" aria-label="Start date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputSt} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>End date</div>
            <input id="end" type="date" aria-label="End date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={load} style={{ background: "white", color: "#456071", border: "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              Refresh
            </button>
            <button type="button" onClick={exportCSV} disabled={completed.length === 0} style={{ background: "#456071", color: "white", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: completed.length === 0 ? "not-allowed" : "pointer", opacity: completed.length === 0 ? 0.5 : 1, fontFamily: "inherit" }}>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div style={{ background: "#f8fafb", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4 }}>Completed</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428" }}>{completed.length}</div>
          </div>
          <div style={{ background: "#f8fafb", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4 }}>Total payable</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428" }}>${(totalCents / 100).toFixed(2)}</div>
            <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 2 }}>Uses stored rate, falls back to $40/hr.</div>
          </div>
        </div>
      </div>

      {/* Sessions list */}
      <div style={cardSt}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 12 }}>Sessions in period</div>

        {loading ? (
          <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: 28, textAlign: "center", fontSize: 13, color: "#8a96a3" }}>No sessions found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ background: "#f8fafb", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{studentLabel(s.studentId)}</div>
                  <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>{fmt(s.startAt)} · {s.durationMinutes} min</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: s.status.toLowerCase() === "completed" ? "rgba(69,150,113,0.1)" : "rgba(0,0,0,0.06)", color: s.status.toLowerCase() === "completed" ? "#1a6a4a" : "#748398", fontWeight: 600 }}>
                    {s.status}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>
                    {s.status.toLowerCase() === "completed" ? `$${(payableCentsForSession(s) / 100).toFixed(2)}` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
