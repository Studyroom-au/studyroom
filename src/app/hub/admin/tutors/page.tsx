"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
  tutorAccessRequest?: {
    status?: "draft" | "submitted" | "under_review" | "approved" | "rejected";
    application?: {
      subjects?: string[];
      yearLevels?: string[];
      modes?: Array<"ONLINE" | "IN_HOME">;
      serviceArea?: string;
      abn?: string;
      wwccStatus?: string;
    };
    note?: string | null;
    submittedAt?: Timestamp | null;
    reviewedAt?: Timestamp | null;
    reviewedByEmail?: string | null;
    decisionReason?: string | null;
  };
};
type StudentDoc = { assignedTutorId?: string | null; assignedTutorEmail?: string | null };

type TutorRow = {
  uid: string;
  name: string;
  email: string;
  studentCount: number;
};

type PendingTutorRow = {
  uid: string;
  name: string;
  email: string;
  note: string;
  subjects: string[];
  yearLevels: string[];
  modes: Array<"ONLINE" | "IN_HOME">;
  serviceArea: string;
  abn: string;
  wwccStatus: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "none";
  submittedAt: Date | null;
  decisionReason: string;
  isComplete: boolean;
};

function displayName(user?: UserDoc) {
  return user?.name || user?.displayName || "Tutor";
}

export default function AdminTutorsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TutorRow[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingTutorRow[]>([]);
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rolesTutorSnap, rolesPendingSnap] = await Promise.all([
        getDocs(query(collection(db, "roles"), where("role", "==", "tutor"))),
        getDocs(query(collection(db, "roles"), where("role", "==", "tutor_pending"))),
      ]);
      const tutorUids = rolesTutorSnap.docs.map((d) => d.id);
      const pendingUids = rolesPendingSnap.docs.map((d) => d.id);

      const studentsSnap = await getDocs(collection(db, "students"));
      const students = studentsSnap.docs.map((d) => d.data() as StudentDoc);

      const countByTutorId: Record<string, number> = {};
      const emailByTutorId: Record<string, string> = {};
      for (const s of students) {
        const tid = s.assignedTutorId || "";
        if (!tid) continue;
        countByTutorId[tid] = (countByTutorId[tid] || 0) + 1;
        if (!emailByTutorId[tid] && s.assignedTutorEmail) {
          emailByTutorId[tid] = s.assignedTutorEmail;
        }
      }

      const loaded = await Promise.all(
        tutorUids.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          const user = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;
          return {
            uid,
            name: displayName(user),
            email: user.email || emailByTutorId[uid] || "",
            studentCount: countByTutorId[uid] || 0,
          };
        })
      );
      setRows(loaded);

      const pendingLoaded = await Promise.all(
        pendingUids.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          const user = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;
          const req = user.tutorAccessRequest;
          return {
            uid,
            name: displayName(user),
            email: user.email || "",
            note: req?.note || "",
            subjects: req?.application?.subjects || [],
            yearLevels: req?.application?.yearLevels || [],
            modes: req?.application?.modes || [],
            serviceArea: req?.application?.serviceArea || "",
            abn: req?.application?.abn || "",
            wwccStatus: req?.application?.wwccStatus || "",
            status: req?.status || "none",
            submittedAt: req?.submittedAt?.toDate() ?? null,
            decisionReason: req?.decisionReason || "",
            isComplete:
              (req?.application?.subjects || []).length > 0 &&
              (req?.application?.yearLevels || []).length > 0 &&
              (req?.application?.modes || []).length > 0 &&
              !!req?.application?.serviceArea &&
              !!req?.application?.abn &&
              !!req?.application?.wwccStatus,
          } satisfies PendingTutorRow;
        })
      );
      setPendingRows(pendingLoaded);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decideTutor(uid: string, decision: "approve" | "reject", reason?: string) {
    setActionError(null);
    setActionBusyUid(uid);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();
      const res = await fetch("/api/admin/tutor-access/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid: uid, decision, reason: reason || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to process tutor decision.");

      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to process tutor decision.";
      setActionError(message);
    } finally {
      setActionBusyUid(null);
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const sortedPendingRows = useMemo(() => {
    return [...pendingRows].sort((a, b) => {
      const aTime = a.submittedAt ? a.submittedAt.getTime() : 0;
      const bTime = b.submittedAt ? b.submittedAt.getTime() : 0;
      return bTime - aTime;
    });
  }, [pendingRows]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Tutors</h1>
        <p className="text-sm text-[color:var(--muted)]">Tutor directory and assigned student counts.</p>
      </header>

      {actionError && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <section className="overflow-x-auto rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
        <div className="border-b border-[color:var(--ring)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">Pending Tutor Approvals</h2>
          <p className="text-xs text-[color:var(--muted)]">
            Tutors who signed up and requested Tutor Hub access.
          </p>
        </div>
        {sortedPendingRows.length === 0 ? (
          <div className="p-4 text-sm text-[color:var(--muted)]">No pending tutor approvals.</div>
        ) : (
          <table className="min-w-[900px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Application</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
            </thead>
            <tbody>
              {sortedPendingRows.map((t) => (
                <tr key={t.uid} className="border-t border-[color:var(--ring)]">
                  <td className="px-4 py-4 text-sm font-semibold text-[color:var(--ink)]">{t.name}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{t.email || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                    <div>Subjects: {t.subjects.length ? t.subjects.join(", ") : "—"}</div>
                    <div>Years: {t.yearLevels.length ? t.yearLevels.join(", ") : "—"}</div>
                    <div>Mode: {t.modes.length ? t.modes.join(", ") : "—"}</div>
                    <div>Area: {t.serviceArea || "—"}</div>
                    <div>ABN: {t.abn || "—"}</div>
                    <div>WWCC: {t.wwccStatus || "—"}</div>
                    {t.note ? <div>Note: {t.note}</div> : null}
                    {t.status === "rejected" && t.decisionReason ? (
                      <div className="font-semibold text-red-700">Rejected: {t.decisionReason}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                    {t.submittedAt ? t.submittedAt.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                    {t.status}
                    {!t.isComplete ? " · incomplete" : ""}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => decideTutor(t.uid, "approve")}
                        disabled={actionBusyUid === t.uid || !t.isComplete}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
                      >
                        {actionBusyUid === t.uid ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const reason = window.prompt("Rejection reason (required):", "");
                          if (!reason || !reason.trim()) return;
                          void decideTutor(t.uid, "reject", reason.trim());
                        }}
                        disabled={actionBusyUid === t.uid}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          No tutors found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
          <table className="min-w-[900px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Assigned students</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((t) => (
                <tr key={t.uid} className="border-t border-[color:var(--ring)]">
                  <td className="px-4 py-4 text-sm font-semibold text-[color:var(--ink)]">{t.name}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{t.email || "—"}</td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{t.studentCount}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/hub/admin/tutors/${t.uid}`}
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
