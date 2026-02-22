// src/app/hub/admin/clients/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import StudentOnboardingPanel from "@/components/students/StudentOnboardingPanel";

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;

  // ✅ Admin onboarding completion
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

  // ✅ Tutor confirmation fields
  tutorConfirmedAt?: Timestamp | null;
  tutorConfirmedBy?: string | null;
};

type SessionDoc = {
  clientId?: string | null;
  studentId: string;
  tutorId: string;
  tutorEmail?: string | null;
  status?: string;
  billingStatus?: string;
  tutorPayableCents?: number;
  xeroInvoiceId?: string | null;
  startAt?: Timestamp;
};

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
};

type SortKey = "parent" | "student" | "tutor" | "onboarding";
type FilterKey = "all" | "incomplete" | "complete";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts?: Timestamp | null) {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

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
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);

  const [tutors, setTutors] = useState<Record<string, UserDoc>>({});
  const [sortKey, setSortKey] = useState<SortKey>("parent");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [selectedOnboardingClientId, setSelectedOnboardingClientId] = useState<string>("");

  async function loadAll() {
    // Clients
    const cSnap = await getDocs(collection(db, "clients"));
    const c = cSnap.docs.map((d) => ({ id: d.id, data: d.data() as ClientDoc }));
    setClients(c);

    // Students
    const sSnap = await getDocs(collection(db, "students"));
    const s = sSnap.docs.map((d) => ({ id: d.id, data: d.data() as StudentDoc }));
    setStudents(s);

    // Sessions
    const sessSnap = await getDocs(collection(db, "sessions"));
    const sess = sessSnap.docs.map((d) => ({ id: d.id, data: d.data() as SessionDoc }));
    setSessions(sess);

    // Tutor profiles referenced by students
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

  async function markOnboardingComplete(clientId: string) {
    const u = auth.currentUser;
    if (!u) return;

    setBusyClientId(clientId);
    try {
      await updateDoc(doc(db, "clients", clientId), {
        onboardingStatus: "COMPLETE",
        onboardingCompletedAt: serverTimestamp(),
        onboardingCompletedBy: u.uid,
        updatedAt: serverTimestamp(),
      });
      await loadAll();
    } finally {
      setBusyClientId(null);
    }
  }

  const byClient = useMemo(() => {
    const studentByClient: Record<string, Array<{ id: string; data: StudentDoc }>> = {};
    students.forEach((s) => {
      const cid = s.data.clientId || "";
      if (!cid) return;
      (studentByClient[cid] ||= []).push(s);
    });

    const sessionsByTutor: Record<string, { completed: number; invoiced: number; payableCents: number }> = {};
    sessions.forEach((sx) => {
      const t = sx.data.tutorId || "";
      if (!t) return;

      const rec = (sessionsByTutor[t] ||= { completed: 0, invoiced: 0, payableCents: 0 });

      if (sx.data.status === "COMPLETED") {
        rec.completed += 1;
        rec.payableCents += Number(sx.data.tutorPayableCents || 0);
      }
      if (sx.data.billingStatus === "INVOICED" || !!sx.data.xeroInvoiceId) {
        rec.invoiced += 1;
      }
    });

    return { studentByClient, sessionsByTutor };
  }, [students, sessions]);

  const rows = useMemo(() => {
    return clients.map((c) => {
      const kids = byClient.studentByClient[c.id] || [];

      const kidsSorted = [...kids].sort((a, b) =>
        (a.data.studentName || "").localeCompare(b.data.studentName || "", undefined, { sensitivity: "base" })
      );

      const tutorIds = Array.from(
        new Set(
          kidsSorted
            .map((k) => k.data.assignedTutorId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      const tutorEmails = Array.from(
        new Set(
          kidsSorted
            .map((k) => k.data.assignedTutorEmail)
            .filter((e): e is string => typeof e === "string" && e.length > 0)
        )
      );

      let tutorName = "Unassigned";
      let tutorIdForStats: string | null = null;
      let combinedStats: { completed: number; invoiced: number; payableCents: number } | null = null;

      if (tutorIds.length === 1) {
        tutorIdForStats = tutorIds[0];
        tutorName = tutorDisplay(tutors[tutorIds[0]], tutorEmails[0] ?? null, tutorIds[0]);
        combinedStats = byClient.sessionsByTutor[tutorIdForStats] ?? null;
      } else if (tutorIds.length > 1) {
        const names = tutorIds.map((tid) =>
          tutorDisplay(
            tutors[tid],
            kidsSorted.find((k) => k.data.assignedTutorId === tid)?.data.assignedTutorEmail ?? null,
            tid
          )
        );

        tutorName = names.join(", ");

        combinedStats = tutorIds.reduce(
          (acc, tid) => {
            const s = byClient.sessionsByTutor[tid];
            if (!s) return acc;
            acc.completed += s.completed;
            acc.invoiced += s.invoiced;
            acc.payableCents += s.payableCents;
            return acc;
          },
          { completed: 0, invoiced: 0, payableCents: 0 }
        );
      } else if (tutorEmails.length === 1) {
        tutorName = tutorEmails[0];
      }

      const sortStudentName = kidsSorted[0]?.data.studentName || "";
      const onboarding = c.data.onboardingStatus ?? "INCOMPLETE";

      const confirmedCount = kidsSorted.filter((k) => !!k.data.tutorConfirmedAt).length;
      const pendingConfirmCount = kidsSorted.length - confirmedCount;

      return {
        id: c.id,
        client: c,
        kids: kidsSorted,
        tutorName,
        tutorIdForStats,
        tutorStats: combinedStats,
        sortStudentName,
        onboarding,
        confirmedCount,
        pendingConfirmCount,
      };
    });
  }, [clients, byClient.studentByClient, byClient.sessionsByTutor, tutors]);

  const filteredRows = useMemo(() => {
    if (filterKey === "all") return rows;
    if (filterKey === "complete") return rows.filter((r) => r.onboarding === "COMPLETE");
    return rows.filter((r) => r.onboarding !== "COMPLETE");
  }, [rows, filterKey]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];

    const key = (r: (typeof rows)[number]) => {
      if (sortKey === "parent") return (r.client.data.parentName || "").toLowerCase();
      if (sortKey === "student") return (r.sortStudentName || "").toLowerCase();
      if (sortKey === "tutor") return (r.tutorName || "").toLowerCase();
      return (r.onboarding || "INCOMPLETE").toLowerCase();
    };

    copy.sort((a, b) => key(a).localeCompare(key(b)));
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
              Parents, students, tutor assignment, confirmations, onboarding, and tutor stats.
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
              <option value="incomplete">Filter: Onboarding incomplete</option>
              <option value="complete">Filter: Onboarding complete</option>
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

      {/* Admin onboarding panel stays in Admin */}
      <div className="mb-6">
        <StudentOnboardingPanel
          clients={clients}
          students={students}
          selectedClientId={selectedOnboardingClientId}
          onSelectClient={(id) => setSelectedOnboardingClientId(id)}
          onDone={() => {
            void loadAll();
          }}
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
        <div className="overflow-x-auto rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
          <table className="min-w-[1200px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Tutor confirmation</th>
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">Tutor stats</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((r) => {
                const c = r.client;
                const kids = r.kids;

                const isComplete = (c.data.onboardingStatus ?? "INCOMPLETE") === "COMPLETE";

                return (
                  <tr key={c.id} className="border-t border-[color:var(--ring)] align-top">
                    {/* Parent */}
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-[color:var(--ink)]">
                        {c.data.parentName || "—"}
                      </div>
                      <div className="text-xs text-[color:var(--muted)]">
                        {c.data.parentEmail || "—"}
                        {c.data.parentPhone ? ` · ${c.data.parentPhone}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        {[c.data.addressLine1, c.data.suburb, c.data.postcode]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                    </td>

                    {/* Students */}
                    <td className="px-4 py-4">
                      {kids.length === 0 ? (
                        <div className="text-sm text-[color:var(--muted)]">—</div>
                      ) : (
                        <div className="space-y-1">
                          {kids.map((s) => (
                            <div key={s.id} className="text-sm text-[color:var(--ink)]">
                              <span className="font-semibold">{s.data.studentName || "Student"}</span>
                              <span className="text-[color:var(--muted)]">
                                {s.data.yearLevel ? ` · ${s.data.yearLevel}` : ""}
                                {s.data.school ? ` · ${s.data.school}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Tutor */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-[color:var(--ink)]">
                        <div className="font-semibold">{r.tutorName}</div>
                        {r.tutorIdForStats && (
                          <div className="text-xs text-[color:var(--muted)]">
                            Tutor ID: {r.tutorIdForStats}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tutor confirmation */}
                    <td className="px-4 py-4">
                      {kids.length === 0 ? (
                        <div className="text-sm text-[color:var(--muted)]">—</div>
                      ) : (
                        <div className="text-sm text-[color:var(--ink)] space-y-1">
                          <div>
                            Confirmed: <b>{r.confirmedCount}</b>
                          </div>
                          <div>
                            Pending: <b>{r.pendingConfirmCount}</b>
                          </div>
                          {r.pendingConfirmCount > 0 && (
                            <div className="text-xs text-[color:var(--muted)]">
                              Tutors confirm in Tutor Portal → Leads.
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Onboarding */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-[color:var(--ink)]">
                        <div className="font-semibold">
                          {isComplete ? "Complete" : "Incomplete"}
                        </div>
                        {isComplete && (
                          <div className="text-xs text-[color:var(--muted)]">
                            {c.data.onboardingCompletedAt
                              ? `Completed: ${formatDate(c.data.onboardingCompletedAt)}`
                              : ""}
                          </div>
                        )}
                      </div>

                      {!isComplete && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOnboardingClientId(c.id)}
                            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                          >
                            Open flow
                          </button>
                          <button
                            type="button"
                            onClick={() => markOnboardingComplete(c.id)}
                            disabled={busyClientId === c.id}
                            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
                          >
                            {busyClientId === c.id ? "Saving..." : "Mark complete"}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Tutor stats */}
                    <td className="px-4 py-4">
                      {!r.tutorStats ? (
                        <div className="text-sm text-[color:var(--muted)]">—</div>
                      ) : (
                        <div className="text-sm text-[color:var(--ink)] space-y-1">
                          <div>
                            Completed: <b>{r.tutorStats.completed}</b>
                          </div>
                          <div>
                            Invoices sent: <b>{r.tutorStats.invoiced}</b>
                          </div>
                          <div>
                            Payable (completed): <b>{money(r.tutorStats.payableCents)}</b>
                          </div>
                        </div>
                      )}
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
