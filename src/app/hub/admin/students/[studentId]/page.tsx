"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
  subjects?: string[];
  goals?: string | null;
  challenges?: string | null;
  mode?: string | null;
  suburb?: string | null;
  addressLine1?: string | null;
  postcode?: string | null;
};

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
};

type SessionDoc = {
  startAt?: Timestamp;
  endAt?: Timestamp;
  status?: string;
  modality?: string | null;
  durationMinutes?: number;
  notes?: string | null;
};

function fmtDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleString();
}

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const studentSnap = await getDoc(doc(db, "students", studentId));
        if (!studentSnap.exists()) {
          setStudent(null);
          setClient(null);
          setSessions([]);
          return;
        }

        const s = studentSnap.data() as StudentDoc;
        setStudent(s);

        if (s.clientId) {
          const clientSnap = await getDoc(doc(db, "clients", s.clientId));
          setClient(clientSnap.exists() ? (clientSnap.data() as ClientDoc) : null);
        } else {
          setClient(null);
        }

        const sessionSnap = await getDocs(query(collection(db, "sessions"), where("studentId", "==", studentId)));
        const rows = sessionSnap.docs.map((d) => ({ id: d.id, data: d.data() as SessionDoc }));
        rows.sort((a, b) => (b.data.startAt?.toMillis() || 0) - (a.data.startAt?.toMillis() || 0));
        setSessions(rows);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  const completedCount = useMemo(
    () => sessions.filter((s) => s.data.status === "COMPLETED").length,
    [sessions]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-sm text-[color:var(--muted)]">Student not found.</p>
        <Link
          href="/hub/admin/tutors"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to tutors
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-2">
        <Link
          href="/hub/admin/tutors"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to tutors
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin · Student
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">{student.studentName || "Student"}</h1>
        <p className="text-sm text-[color:var(--muted)]">
          {student.yearLevel || "Year not set"} {student.school ? `· ${student.school}` : ""}
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Profile</h2>
        <div className="grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
          <div><span className="font-semibold text-[color:var(--ink)]">Tutor:</span> {student.assignedTutorEmail || student.assignedTutorId || "—"}</div>
          <div><span className="font-semibold text-[color:var(--ink)]">Mode:</span> {student.mode || "—"}</div>
          <div><span className="font-semibold text-[color:var(--ink)]">Suburb:</span> {student.suburb || "—"}</div>
          <div><span className="font-semibold text-[color:var(--ink)]">Postcode:</span> {student.postcode || "—"}</div>
          <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Address:</span> {student.addressLine1 || "—"}</div>
          <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Subjects:</span> {student.subjects?.length ? student.subjects.join(", ") : "—"}</div>
          <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Goals:</span> {student.goals || "—"}</div>
          <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Challenges:</span> {student.challenges || "—"}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Parent</h2>
        <div className="grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
          <div><span className="font-semibold text-[color:var(--ink)]">Name:</span> {client?.parentName || "—"}</div>
          <div><span className="font-semibold text-[color:var(--ink)]">Email:</span> {client?.parentEmail || "—"}</div>
          <div><span className="font-semibold text-[color:var(--ink)]">Phone:</span> {client?.parentPhone || "—"}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-2 font-semibold text-[color:var(--ink)]">Sessions</h2>
        <p className="mb-3 text-xs text-[color:var(--muted)]">
          Total: {sessions.length} · Completed: {completedCount}
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No sessions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Modality</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-[color:var(--ring)]">
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{fmtDate(s.data.startAt) || "—"}</td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{fmtDate(s.data.endAt) || "—"}</td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{s.data.status || "—"}</td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{s.data.modality || "—"}</td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{s.data.durationMinutes ?? "—"}</td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">{s.data.notes || "—"}</td>
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
