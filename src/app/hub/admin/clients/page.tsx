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
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { isCurrentFamilyStatus, filterCurrentStudents } from "@/lib/studyroom/currentPopulation";

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
  status?: string;
  endedAt?: Timestamp | null;
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
  status?: string;
  endedAt?: Timestamp | null;
};

type PlanDoc = {
  studentId?: string | null;
  status?: string;
  type?: string;
};

type EntitlementDoc = {
  remainingSessions?: number;
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
  if (fallbackId) return "Tutor assigned, name not found";
  return "Unassigned";
}

// Compact label for the table — "10-session", not "10-session package", so
// it reads naturally next to a remaining-sessions count.
function compactPlanLabel(type: string) {
  if (type === "package_5") return "5-session";
  if (type === "package_10") return "10-session";
  if (type === "package_12") return "12-session (legacy)";
  return "Casual";
}

// Canonical current-family/current-student definitions, shared with
// /hub/admin's Operations Centre (final pre-release fix — see
// currentPopulation.ts for why this must be the one shared implementation).

export default function AdminClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; data: ClientDoc }>>([]);
  const [students, setStudents] = useState<Array<{ id: string; data: StudentDoc }>>([]);
  const [tutors, setTutors] = useState<Record<string, UserDoc>>({});
  const [planByStudent, setPlanByStudent] = useState<Record<string, { id: string; type: string }>>({});
  const [entitlementByPlan, setEntitlementByPlan] = useState<Record<string, EntitlementDoc>>({});
  const [sortKey, setSortKey] = useState<SortKey>("parent");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function loadAll() {
    const cSnap = await getDocs(collection(db, "clients"));
    const c = cSnap.docs.map((d) => ({ id: d.id, data: d.data() as ClientDoc }));
    setClients(c);

    const sSnap = await getDocs(collection(db, "students"));
    const s = sSnap.docs.map((d) => ({ id: d.id, data: d.data() as StudentDoc }));
    setStudents(s);

    // Payment arrangement per student — never one family-wide value, since
    // siblings can be on different arrangements. Keep the plan id alongside
    // its type so remaining-sessions can be looked up from entitlements
    // (doc ID == plan ID), reusing data already loaded for this page.
    const plansSnap = await getDocs(collection(db, "plans"));
    const planMap: Record<string, { id: string; type: string }> = {};
    plansSnap.docs.forEach((d) => {
      const p = d.data() as PlanDoc;
      const sid = p.studentId ?? "";
      if (sid && p.status === "active") planMap[sid] = { id: d.id, type: p.type ?? "casual" };
    });
    setPlanByStudent(planMap);

    const activePlanIds = Object.values(planMap)
      .filter((p) => p.type !== "casual")
      .map((p) => p.id);
    const entitlementMap: Record<string, EntitlementDoc> = {};
    await Promise.all(
      activePlanIds.map(async (planId) => {
        try {
          const eSnap = await getDoc(doc(db, "entitlements", planId));
          if (eSnap.exists()) entitlementMap[planId] = eSnap.data() as EntitlementDoc;
        } catch (e) {
          console.warn("Entitlement fetch failed:", planId, e);
        }
      })
    );
    setEntitlementByPlan(entitlementMap);

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

  // Per-student arrangement line — "Casual", "10-session · 7 remaining", or
  // "10-session · 7 remaining · Paused". Package remaining-sessions only
  // shown when the entitlement is actually loaded; detailed editing stays on
  // the client/student arrangement page, this is a compact read-only line.
  const arrangementLineFor = (studentId: string, status?: string) => {
    const plan = planByStudent[studentId];
    const type = plan?.type ?? "casual";
    let text = compactPlanLabel(type);
    if (type !== "casual" && plan) {
      const ent = entitlementByPlan[plan.id];
      if (ent && typeof ent.remainingSessions === "number") {
        text += ` · ${ent.remainingSessions} remaining`;
      }
    }
    if (status === "paused") text += " · Paused";
    else if (status === "ended") text += " · Ended";
    return text;
  };

  // Archived (ended) families never contribute to the main table or any
  // stat below — a family that's archived is not part of the current
  // operational population, even if inconsistent legacy data left one of
  // its students individually marked "active" (final pre-release fix).
  const nonArchivedClients = useMemo(() => clients.filter((c) => isCurrentFamilyStatus(c.data.status)), [clients]);
  const archivedClients = useMemo(() => clients.filter((c) => !isCurrentFamilyStatus(c.data.status)), [clients]);

  const rows = useMemo(() => {
    return nonArchivedClients.map((c) => {
      const kids = (studentByClient[c.id] || []).sort((a, b) =>
        (a.data.studentName || "").localeCompare(b.data.studentName || "", undefined, { sensitivity: "base" })
      );

      // Tutor(s) — derived from each student's OWN tutor assignment, never
      // a single family-wide value. A single shared tutor collapses to one
      // name; different tutors per sibling are shown per-student.
      const kidTutors = kids.map((k) => ({
        id: k.id,
        name: k.data.studentName || "Student",
        tutor: tutorDisplay(
          tutors[k.data.assignedTutorId ?? ""],
          k.data.assignedTutorEmail,
          k.data.assignedTutorId
        ),
      }));
      const uniqueTutors = Array.from(new Set(kidTutors.map((k) => k.tutor)));
      let tutorName = "—";
      if (kidTutors.length > 0) {
        tutorName = uniqueTutors.length === 1
          ? uniqueTutors[0]
          : kidTutors.map((k) => `${k.name}: ${k.tutor}`).join(" · ");
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
  }, [nonArchivedClients, studentByClient, tutors]);

  // Stats row — derived by calling the SAME shared filterCurrentStudents()
  // helper the Operations Centre uses, against the same raw students/
  // clients state (not a page-local derivative), so the two pages are
  // structurally guaranteed to agree rather than merely happening to today
  // (final pre-release fix — the previous Operations Centre bug was
  // counting orphaned students whose clientId matched no real client
  // document at all; see currentPopulation.ts).
  const stats = useMemo(() => {
    const familiesCount = nonArchivedClients.length;
    const currentStudents = filterCurrentStudents(
      students.map((s) => ({ id: s.id, clientId: s.data.clientId, status: s.data.status })),
      clients.map((c) => ({ id: c.id, status: c.data.status }))
    );
    const pausedCount = currentStudents.filter((s) => s.status === "paused").length;

    // Each current student contributes to exactly one arrangement bucket.
    // Legacy package_12 (10+2 bonus, no longer sold) is intentionally folded
    // into the 10-session bucket for this aggregate count — it's the closest
    // current equivalent, and the per-student line already labels it
    // distinctly ("12-session (legacy)") wherever the real type matters.
    let casual = 0, package5 = 0, package10 = 0;
    currentStudents.forEach((s) => {
      const type = planByStudent[s.id]?.type ?? "casual";
      if (type === "package_5") package5 += 1;
      else if (type === "package_10" || type === "package_12") package10 += 1;
      else casual += 1;
    });

    return {
      currentStudentsCount: currentStudents.length,
      pausedCount,
      familiesCount,
      casual,
      package5,
      package10,
    };
  }, [students, clients, nonArchivedClients, planByStudent]);

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

  const archivedRows = useMemo(() => {
    return archivedClients
      .map((c) => ({
        id: c.id,
        client: c,
        kids: (studentByClient[c.id] || []).sort((a, b) =>
          (a.data.studentName || "").localeCompare(b.data.studentName || "", undefined, { sensitivity: "base" })
        ),
      }))
      .sort((a, b) => (a.client.data.parentName || "").localeCompare(b.client.data.parentName || "", undefined, { sensitivity: "base" }));
  }, [archivedClients, studentByClient]);

  // Restore/Unarchive (final pre-release fix) — traced how End Family
  // cascades first: it now only marks students "ended" if they weren't
  // already independently ended (see the client detail page's endFamily),
  // so any student whose endedAt exactly matches the family's own endedAt
  // was ended BY this archive action — restoring those is safe. A student
  // who was already ended earlier (a different, real endedAt) is left
  // alone; blindly reactivating them would incorrectly undo an unrelated,
  // genuine prior removal. Families archived before this fix shipped will
  // have every student's endedAt equal (the old code overwrote all of
  // them), so Restore will reactivate all of them for those — matching
  // that pre-existing data shape, not introducing a new regression.
  async function restoreFamily(clientId: string) {
    const archivedClient = clients.find((c) => c.id === clientId);
    if (!archivedClient) return;
    const familyEndedAtMs = archivedClient.data.endedAt?.toMillis?.() ?? null;

    setRestoringId(clientId);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "clients", clientId), { status: "active", endedAt: null, updatedAt: serverTimestamp() });

      const kids = studentByClient[clientId] || [];
      for (const s of kids) {
        const studentEndedAtMs = s.data.endedAt?.toMillis?.() ?? null;
        const endedByThisArchive =
          s.data.status === "ended" && familyEndedAtMs != null && studentEndedAtMs === familyEndedAtMs;
        if (endedByThisArchive) {
          batch.update(doc(db, "students", s.id), { status: "active", endedAt: null, updatedAt: serverTimestamp() });
        }
      }

      await batch.commit();
      await loadAll();
    } catch (e) {
      console.error(e);
      alert("Failed to restore family. Check console.");
    } finally {
      setRestoringId(null);
    }
  }

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
              Parents, students, tutor assignment, and current arrangements.
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

      {/* Stats — derived entirely from students/plans already loaded for
          this page; no denormalised counters written to Firestore. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[color:var(--ink)]">{stats.currentStudentsCount}</div>
          <div className="text-xs text-[color:var(--muted)]">Current Students</div>
          {stats.pausedCount > 0 && (
            <div className="mt-0.5 text-[11px] font-semibold text-amber-700">{stats.pausedCount} paused</div>
          )}
        </div>
        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[color:var(--ink)]">{stats.familiesCount}</div>
          <div className="text-xs text-[color:var(--muted)]">Families</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[color:var(--ink)]">{stats.casual}</div>
          <div className="text-xs text-[color:var(--muted)]">Casual</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[color:var(--ink)]">{stats.package5}</div>
          <div className="text-xs text-[color:var(--muted)]">5-session</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-3 text-center">
          <div className="text-2xl font-bold text-[color:var(--ink)]">{stats.package10}</div>
          <div className="text-xs text-[color:var(--muted)]">10-session</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      ) : nonArchivedClients.length === 0 ? (
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
                <th className="px-4 py-3">Suburb</th>
                <th className="px-4 py-3">Tutor(s)</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const c = r.client;

                return (
                  <tr key={c.id} className="border-t border-[color:var(--ring)] align-top">
                    {/* Parent */}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[color:var(--ink)]">{c.data.parentName || "—"}</div>
                      <div className="text-xs text-[color:var(--muted)]">{c.data.parentEmail || "—"}</div>
                    </td>

                    {/* Students — name, with the current arrangement shown
                        underneath in smaller/muted text (per student, never
                        one family-wide value). */}
                    <td className="px-4 py-4 text-[color:var(--ink)]">
                      {r.kids.length === 0 ? (
                        <span className="text-[color:var(--muted)]">—</span>
                      ) : (
                        <div className="space-y-2">
                          {r.kids.map((s) => (
                            <div key={s.id}>
                              <div className="font-medium">{s.data.studentName || "Student"}</div>
                              <div className="text-xs text-[color:var(--muted)]">
                                {arrangementLineFor(s.id, s.data.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Suburb */}
                    <td className="px-4 py-4 text-[color:var(--ink)]">
                      {c.data.suburb || "—"}
                    </td>

                    {/* Tutor(s) — derived per student, never a single
                        family-wide value */}
                    <td className="px-4 py-4 text-[color:var(--ink)] text-sm">
                      {r.tutorName}
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

      {/* Archived families — collapsed by default. Complete history is
          preserved; Restore is the only write action available here. */}
      {archivedRows.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-semibold text-[color:var(--muted)] hover:underline"
          >
            {showArchived ? "▾" : "▸"} Archived families ({archivedRows.length})
          </button>
          {showArchived && (
            <div className="mt-3 rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Suburb</th>
                    <th className="px-4 py-3">Archived</th>
                    <th className="px-4 py-3">View</th>
                    <th className="px-4 py-3">Restore</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedRows.map((r) => (
                    <tr key={r.id} className="border-t border-[color:var(--ring)] align-top opacity-80">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[color:var(--ink)]">{r.client.data.parentName || "—"}</div>
                        <div className="text-xs text-[color:var(--muted)]">{r.client.data.parentEmail || "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--ink)]">
                        {r.kids.length === 0 ? "—" : r.kids.map((s) => s.data.studentName || "Student").join(", ")}
                      </td>
                      <td className="px-4 py-4 text-[color:var(--ink)]">{r.client.data.suburb || "—"}</td>
                      <td className="px-4 py-4 text-[color:var(--ink)]">
                        {r.client.data.endedAt ? r.client.data.endedAt.toDate().toLocaleDateString("en-AU") : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/hub/admin/clients/${r.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                        >
                          View →
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => restoreFamily(r.id)}
                          disabled={restoringId === r.id}
                          className="inline-flex items-center justify-center rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-60"
                        >
                          {restoringId === r.id ? "Restoring…" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
