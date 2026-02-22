"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;

  clientId?: string | null;

  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;

  createdAt?: Timestamp;
};

type StudentRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  school?: string | null;

  clientId: string;

  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;

  createdAt?: Timestamp;
};

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TutorStudentsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentRow[]>([]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      setLoading(true);
      try {
        // Primary: uid-based assignment
        const q1 = query(collection(db, "students"), where("assignedTutorId", "==", u.uid));
        let snap = await getDocs(q1);

        // Fallback: email-based assignment
        if (snap.empty && u.email) {
          const q2 = query(collection(db, "students"), where("assignedTutorEmail", "==", u.email));
          snap = await getDocs(q2);
        }

        const list: StudentRow[] = snap.docs.map((d) => {
          const data = d.data() as StudentDoc;
          return {
            id: d.id,
            studentName: data.studentName ?? "",
            yearLevel: data.yearLevel ?? "",
            school: data.school ?? null,
            clientId: data.clientId ?? "",
            assignedTutorId: data.assignedTutorId ?? null,
            assignedTutorEmail: data.assignedTutorEmail ?? null,
            createdAt: data.createdAt,
          };
        });

        // Newest-first
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });

        setRows(list);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Tutor Portal
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[color:var(--ink)]">
            My Students
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Students assigned to you. ({count})
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/hub/tutor/leads"
            className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            View Leads →
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">
            No students yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">School</th>
                  <th className="px-3 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-[color:var(--ring)]">
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--ink)]">
                      {s.studentName || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                      {s.yearLevel || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                      {s.school || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/hub/tutor/students/${s.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                      >
                        Open →
                      </Link>
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
