"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type NoteRow = {
  id: string;
  date?: Timestamp;
  durationMinutes?: number;
  focus?: string;
  homework?: string;
  createdAt?: Timestamp;
};

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StudentSessionHistoryPanel({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "students", studentId, "sessions"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<NoteRow>) })) as NoteRow[];
        if (alive) setNotes(list);
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (studentId) run();
    return () => {
      alive = false;
    };
  }, [studentId]);

  return (
    <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
      <div className="text-sm font-semibold text-[color:var(--ink)]">Tutor notes (Student history)</div>
      <div className="mt-1 text-xs text-[color:var(--muted)]">
        Notes added by tutor from the student page.
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-[color:var(--muted)]">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="mt-3 text-sm text-[color:var(--muted)]">No tutor notes yet.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {notes.slice(0, 8).map((n) => (
            <div key={n.id} className="rounded-xl border border-[color:var(--ring)] p-3 text-sm">
              <div className="font-semibold text-[color:var(--ink)]">
                {formatDate(n.date ?? n.createdAt)} · {n.durationMinutes ?? 0} mins
              </div>
              <div className="mt-1 text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--ink)]">Focus:</span>{" "}
                {n.focus || "—"}
              </div>
              <div className="mt-1 text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--ink)]">Homework:</span>{" "}
                {n.homework || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
