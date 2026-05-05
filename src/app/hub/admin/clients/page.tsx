// src/app/hub/admin/clients/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import StudentOnboardingPanel from "@/components/students/StudentOnboardingPanel";

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  onboardingStatus?: "INCOMPLETE" | "COMPLETE";
  onboardingCompletedAt?: Timestamp | null;
  onboardingCompletedBy?: string | null;
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
  tutorConfirmedAt?: Timestamp | null;
  tutorConfirmedBy?: string | null;
};

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
};

type SortKey = "parent" | "student" | "tutor" | "onboarding";
type FilterKey = "all" | "incomplete" | "complete";

function tutorDisplay(t?: UserDoc, fallbackEmail?: string | null, fallbackId?: string | null) {
  const name = t?.name || t?.displayName;
  if (name) return name;
  if (fallbackEmail) return fallbackEmail;
  if (fallbackId) return fallbackId;
  return "Unassigned";
}

export default function AdminClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; data: ClientDoc }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; data: StudentDoc }>>([]);
  const [tutors, setTutors] = useState<Record<string, UserDoc>>({});
  const [sortKey, setSortKey] = useState<SortKey>("parent");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [selectedOnboardingClientId, setSelectedOnboardingClientId] = useState<string>("");

  async function loadAll() {
    const cSnap = await getDocs(collection(db, "clients"));
    const c = cSnap.docs.map((d) => ({ id: d.id, data: d.data() as ClientDoc }));
    setClients(c);

    const sSnap = await getDocs(collection(db, "students"));
    const s = sSnap.docs.map((d) => ({ id: d.id, data: d.data() as StudentDoc }));
    setStudents(s);

    const tutorIds = Array.from(
      new Set(
        s
          .map((x) => x.data.assignedTutorId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );
    const tutorMap: Record<string, UserDoc> = {};
    await Promise.all(
      tutorIds.map(async (tid) => {
        try {
          const tsnap = await getDoc(doc(db, "users", tid));
          if (tsnap.exists()) tutorMap[tid] = tsnap.data() as UserDoc;
        } catch (e) {
          console.warn("Tutor fetch failed:", tid, e);
        }
      })
    );
    setTutors(tutorMap);
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setLoading(true);
      try {
        await loadAll();
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, []);


  const studentByClient = useMemo(() => {
    const map: Record<string, Array<{ id: string; data: StudentDoc }>> = {};
    students.forEach((s) => {
      const cid = s.data.clientId || "";
      if (!cid) return;
      (map[cid] ||= []).push(s);
    });
    return map;
  }, [students]);

  const rows = useMemo(() => {
    return clients.map((c) => {
      const kids = (studentByClient[c.id] || []).sort((a, b) =>
        (a.data.studentName || "").localeCompare(b.data.studentName || "", undefined, { sensitivity: "base" })
      );

      const tutorIds = Array.from(
        new Set(kids.map((k) => k.data.assignedTutorId).filter((id): id is string => !!id))
      );
      const tutorEmails = Array.from(
        new Set(kids.map((k) => k.data.assignedTutorEmail).filter((e): e is string => !!e))
      );

      let tutorName = "Unassigned";
      if (tutorIds.length === 1) {
        tutorName = tutorDisplay(tutors[tutorIds[0]], tutorEmails[0] ?? null, tutorIds[0]);
      } else if (tutorIds.length > 1) {
        tutorName = tutorIds
          .map((tid) =>
            tutorDisplay(
              tutors[tid],
              kids.find((k) => k.data.assignedTutorId === tid)?.data.assignedTutorEmail ?? null,
              tid
            )
          )
          .join(", ");
      } else if (tutorEmails.length === 1) {
        tutorName = tutorEmails[0];
      }

      return {
        id: c.id,
        client: c,
        kids,
        tutorName,
        sortStudentName: kids[0]?.data.studentName || "",
        onboarding: c.data.onboardingStatus ?? "INCOMPLETE",
      };
    });
  }, [clients, studentByClient, tutors]);

  const filteredRows = useMemo(() => {
    if (filterKey === "all") return rows;
    if (filterKey === "complete") return rows.filter((r) => r.onboarding === "COMPLETE");
    return rows.filter((r) => r.onboarding !== "COMPLETE");
  }, [rows, filterKey]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      let ak = "", bk = "";
      if (sortKey === "parent") { ak = (a.client.data.parentName || "").toLowerCase(); bk = (b.client.data.parentName || "").toLowerCase(); }
      else if (sortKey === "student") { ak = (a.sortStudentName || "").toLowerCase(); bk = (b.sortStudentName || "").toLowerCase(); }
      else if (sortKey === "tutor") { ak = (a.tutorName || "").toLowerCase(); bk = (b.tutorName || "").toLowerCase(); }
      else { ak = (a.onboarding || "INCOMPLETE").toLowerCase(); bk = (b.onboarding || "INCOMPLETE").toLowerCase(); }
      return ak.localeCompare(bk);
    });
    return copy;
  }, [filteredRows, sortKey]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Clients</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Parents, students, tutor assignment, and onboarding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterKey}
              onChange={(e) => setFilterKey(e.target.value as FilterKey)}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              aria-label="Filter clients"
            >
              <option value="all">Filter: All</option>
              <option value="incomplete">Filter: Incomplete</option>
              <option value="complete">Filter: Complete</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              aria-label="Sort clients by"
            >
              <option value="parent">Sort: Parent</option>
              <option value="student">Sort: Student</option>
              <option value="tutor">Sort: Tutor</option>
              <option value="onboarding">Sort: Onboarding</option>
            </select>
          </div>
        </div>
      </header>

      <div className="mb-6">
        <StudentOnboardingPanel
          clients={clients}
          students={students}
          selectedClientId={selectedOnboardingClientId}
          onSelectClient={(id) => setSelectedOnboardingClientId(id)}
          onDone={() => { void loadAll(); }}
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          No clients yet.
        </div>
      ) : (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const c = r.client;
                const isComplete = r.onboarding === "COMPLETE";

                return (
                  <tr key={c.id} className="border-t border-[color:var(--ring)] align-top">
                    {/* Parent */}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[color:var(--ink)]">{c.data.parentName || "—"}</div>
                      <div className="text-xs text-[color:var(--muted)]">{c.data.parentEmail || "—"}</div>
                    </td>

                    {/* Students — names only, comma-separated */}
                    <td className="px-4 py-4 text-[color:var(--ink)]">
                      {r.kids.length === 0
                        ? <span className="text-[color:var(--muted)]">—</span>
                        : r.kids.map((s) => s.data.studentName || "Student").join(", ")}
                    </td>

                    {/* Tutor */}
                    <td className="px-4 py-4 text-[color:var(--ink)]">
                      {r.tutorName}
                    </td>

                    {/* Onboarding badge */}
                    <td className="px-4 py-4">
                      {isComplete ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                          Incomplete
                        </span>
                      )}
                    </td>

                    {/* View */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/hub/admin/clients/${c.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
