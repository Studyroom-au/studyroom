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
  const [addTutorEmail, setAddTutorEmail] = useState("");
  const [addTutorBusy, setAddTutorBusy] = useState(false);
  const [addTutorMsg, setAddTutorMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  async function handleAddTutorByEmail() {
    const email = addTutorEmail.trim().toLowerCase();
    if (!email) return;

    setAddTutorBusy(true);
    setAddTutorMsg(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      // Step 1: grant tutor access via Admin SDK (looks up by Auth email, not Firestore field)
      const grantRes = await fetch("/api/admin/grant-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email, action: "grant" }),
      });

      const grantData = (await grantRes.json().catch(() => ({}))) as { ok?: boolean; error?: string; displayName?: string; accessCode?: string };

      if (!grantRes.ok || !grantData.ok) {
        setAddTutorMsg({ type: "error", text: grantData.error ?? "Failed to grant access." });
        return;
      }

      // Step 2: send welcome email (non-fatal)
      try {
        await fetch("/api/email/tutor-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ to: email, displayName: grantData.displayName ?? email, accessCode: grantData.accessCode }),
        });
      } catch (emailErr) {
        console.warn("[add-tutor] welcome email failed (non-fatal):", emailErr);
      }

      setAddTutorMsg({ type: "success", text: `${email} has been granted tutor access. A welcome email has been sent.` });
      setAddTutorEmail("");
      await load();
    } catch (err) {
      console.error("[add-tutor]", err);
      setAddTutorMsg({ type: "error", text: "Something went wrong. Check the console." });
    } finally {
      setAddTutorBusy(false);
    }
  }

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

      {/* Add Tutor section */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 12px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", whiteSpace: "nowrap" }}>
          Add Tutor
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 4 }}>
          Grant tutor access by email
        </div>
        <div style={{ fontSize: 12, color: "#8a96a3", marginBottom: 14, lineHeight: 1.5 }}>
          The user must already have a Studyroom account. Once added, they&apos;ll receive a
          welcome email with instructions to check their students and calendar.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4, letterSpacing: "0.04em" }}>
              User email address
            </div>
            <input
              type="email"
              value={addTutorEmail}
              onChange={e => setAddTutorEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !addTutorBusy && void handleAddTutorByEmail()}
              placeholder="tutor@example.com"
              aria-label="Tutor email address"
              style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "9px 13px", fontSize: 13, fontFamily: "inherit", color: "#1d2428", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAddTutorByEmail()}
            disabled={addTutorBusy || !addTutorEmail.trim()}
            style={{ background: addTutorBusy ? "#748398" : "#456071", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: addTutorBusy ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: (!addTutorEmail.trim() || addTutorBusy) ? 0.55 : 1, transition: "all 0.15s" }}
          >
            {addTutorBusy ? "Adding..." : "Add as tutor"}
          </button>
        </div>
        {addTutorMsg && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: addTutorMsg.type === "success" ? "#2d5a24" : "#c0445e", background: addTutorMsg.type === "success" ? "#f0f8ec" : "#fdf0f3", borderRadius: 8, padding: "7px 12px", border: `1px solid ${addTutorMsg.type === "success" ? "#c8e6bb" : "#f5c0c8"}` }}>
            {addTutorMsg.type === "success" ? "✓ " : "✗ "}{addTutorMsg.text}
          </div>
        )}
      </div>

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
