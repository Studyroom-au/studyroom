"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type UserDoc = { name?: string; displayName?: string; email?: string };
type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
};
type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
};

type StudentRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  school: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
};

function tutorName(user?: UserDoc) {
  return user?.name || user?.displayName || "Tutor";
}

export default function AdminTutorDetailPage() {
  const params = useParams<{ tutorId: string }>();
  const tutorId = params.tutorId;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Tutor");
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, "users", tutorId));

        const user = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;

        setName(tutorName(user));

        let studentsSnap = await getDocs(query(collection(db, "students"), where("assignedTutorId", "==", tutorId)));
        if (studentsSnap.empty && user.email) {
          studentsSnap = await getDocs(
            query(collection(db, "students"), where("assignedTutorEmail", "==", user.email))
          );
        }

        const students = studentsSnap.docs.map((d) => ({ id: d.id, data: d.data() as StudentDoc }));
        const fallbackEmailFromStudents =
          students.find((s) => !!s.data.assignedTutorEmail)?.data.assignedTutorEmail || "";
        setEmail(user.email || fallbackEmailFromStudents);

        const clientIds = Array.from(
          new Set(students.map((s) => s.data.clientId).filter((x): x is string => !!x))
        );

        const clientsById: Record<string, ClientDoc> = {};
        await Promise.all(
          clientIds.map(async (cid) => {
            const cSnap = await getDoc(doc(db, "clients", cid));
            if (cSnap.exists()) clientsById[cid] = cSnap.data() as ClientDoc;
          })
        );

        const mapped = students.map((s) => {
          const c = (s.data.clientId && clientsById[s.data.clientId]) || {};
          return {
            id: s.id,
            studentName: s.data.studentName || "Student",
            yearLevel: s.data.yearLevel || "",
            school: s.data.school || null,
            parentName: c.parentName || "",
            parentEmail: c.parentEmail || "",
            parentPhone: c.parentPhone || null,
          };
        });

        setRows(mapped);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tutorId]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-2">
        <Link
          href="/hub/admin/tutors"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to tutors
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin · Tutor
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">{name}</h1>
        <p className="text-sm text-[color:var(--muted)]">
          {email || "No email on file"}
        </p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          This tutor has no assigned students.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
          <table className="min-w-[980px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Parent email</th>
                <th className="px-4 py-3">Parent phone</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((s) => (
                <tr key={s.id} className="border-t border-[color:var(--ring)]">
                  <td className="px-4 py-4 text-sm font-semibold text-[color:var(--ink)]">{s.studentName}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{s.yearLevel || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{s.school || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{s.parentName || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{s.parentEmail || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{s.parentPhone || "—"}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/hub/admin/students/${s.id}`}
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
    </div>
  );
}

