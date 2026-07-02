"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  subjects?: string[];
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
  hasName: boolean; // false = no name set in user doc
  email: string;
  phone: string;
  bio: string;
  subjects: string[];
  studentCount: number;
  maxActiveStudents: number | null;
  profileStatus: string | null;   // null = no tutors/{uid} doc
  profileData: Record<string, unknown> | null;
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

type TutorRequestRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  accessCode: string;
  createdAt: Date | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rawDisplayName(user?: UserDoc) {
  return user?.name || user?.displayName || "";
}

// ─── Profile checklist helpers ────────────────────────────────────────────────
// Matches the same logic as the Tutor Home completion card.

type ChecklistItem = { label: string; done: boolean };

function buildProfileChecklist(p: Record<string, unknown> | null): ChecklistItem[] {
  const s = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const a = (v: unknown) => Array.isArray(v) && v.length > 0;
  return [
    { label: "Details",           done: p != null && s(p.phone) },
    { label: "Teaching setup",    done: p != null && a(p.modes) },
    { label: "Location & travel", done: p != null && (s(p.suburb) || s(p.postcode)) },
    { label: "Availability",      done: p != null && (a(p.availabilitySlots) || a(p.availabilityDays)) },
    { label: "Subjects",          done: p != null && a(p.capabilities) },
    { label: "Learning support",  done: p != null && a(p.supportCapabilities) },
    { label: "Compliance",        done: p != null && s(p.abn) && s(p.wwccNumber) },
  ];
}

const PROFILE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  active: "Active",
  paused: "Paused",
};
const PROFILE_STATUS_COLOR: Record<string, string> = {
  draft: "#748398",
  pending_review: "#456071",
  active: "#82977e",
  paused: "#8b7d6b",
};

function ProfileCell({
  profileStatus,
  profileData,
}: {
  profileStatus: string | null;
  profileData: Record<string, unknown> | null;
}) {
  const checklist = buildProfileChecklist(profileData);
  const doneCount = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const missing = checklist.filter((c) => !c.done).map((c) => c.label);

  const missingLabel =
    missing.length === 0
      ? ""
      : missing.length <= 2
      ? `Missing: ${missing.join(", ")}`
      : `Missing: ${missing[0]}, ${missing[1]} +${missing.length - 2} more`;

  if (profileStatus === null) {
    return (
      <div className="space-y-0.5 text-sm">
        <div className="font-semibold" style={{ color: "#8b7d6b" }}>No profile</div>
        <div className="text-xs text-[color:var(--muted)]">0 / {total} complete</div>
      </div>
    );
  }

  const label = PROFILE_STATUS_LABEL[profileStatus] ?? profileStatus;
  const color = PROFILE_STATUS_COLOR[profileStatus] ?? "#748398";
  const showMissing = (profileStatus === "draft") && missingLabel;
  const showPendingNote = profileStatus === "pending_review";
  const showPausedNote = profileStatus === "paused";

  return (
    <div className="space-y-0.5 text-sm">
      <div className="font-semibold" style={{ color }}>{label}</div>
      <div className="text-xs text-[color:var(--muted)]">{doneCount} / {total} complete</div>
      {showMissing && (
        <div className="text-xs" style={{ color: "#8b7d6b" }}>{missingLabel}</div>
      )}
      {showPendingNote && (
        <div className="text-xs font-medium" style={{ color: "#456071" }}>Needs admin review</div>
      )}
      {showPausedNote && (
        <div className="text-xs text-[color:var(--muted)]">Profile paused</div>
      )}
    </div>
  );
}

// ─── Inline edit panel ────────────────────────────────────────────────────────

type EditState = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  subjectsRaw: string;
};

function EditPanel({
  tutor,
  onSave,
  onCancel,
}: {
  tutor: TutorRow;
  onSave: (uid: string, patch: Partial<TutorRow>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditState>({
    name: tutor.name === "No name set" ? "" : tutor.name,
    email: tutor.email,
    phone: tutor.phone,
    bio: tutor.bio,
    subjectsRaw: tutor.subjects.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(field: keyof EditState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const subjects = form.subjectsRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      await updateDoc(doc(db, "users", tutor.uid), {
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        subjects,
        updatedAt: serverTimestamp(),
      });

      const patch: Partial<TutorRow> = {
        name: form.name.trim() || "No name set",
        hasName: !!form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        subjects,
      };
      onSave(tutor.uid, patch);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30";

  return (
    <div className="border-t border-[color:var(--ring)] bg-[#f5f7fb] px-4 py-5">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Display name</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Full name"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="tutor@example.com"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Phone</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="04XX XXX XXX"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Bio / about</span>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={2}
            placeholder="Short bio visible to parents…"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Subjects (comma-separated)</span>
          <input
            value={form.subjectsRaw}
            onChange={(e) => set("subjectsRaw", e.target.value)}
            placeholder="Maths, English, Science"
            className={inputCls}
          />
        </label>
      </div>

      {err && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-1.5 text-xs font-semibold text-[color:var(--muted)] transition hover:bg-[#d6e5e3]/40"
        >
          Cancel
        </button>
        {saved && (
          <span className="text-xs font-semibold text-emerald-600">Saved</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTutorsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TutorRow[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingTutorRow[]>([]);
  const [tutorRequests, setTutorRequests] = useState<TutorRequestRow[]>([]);
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);
  const [requestInviteBusyId, setRequestInviteBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addTutorEmail, setAddTutorEmail] = useState("");
  const [addTutorBusy, setAddTutorBusy] = useState(false);
  const [addTutorMsg, setAddTutorMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rolesTutorSnap, rolesPendingSnap, tutorRequestsSnap] = await Promise.all([
        getDocs(query(collection(db, "roles"), where("role", "==", "tutor"))),
        getDocs(query(collection(db, "roles"), where("role", "==", "tutor_pending"))),
        getDocs(
          query(
            collection(db, "leads"),
            where("type", "==", "tutor_request"),
            orderBy("createdAt", "desc"),
            limit(50)
          )
        ),
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
          const [userSnap, profileSnap] = await Promise.all([
            getDoc(doc(db, "users", uid)),
            getDoc(doc(db, "tutors", uid)),
          ]);
          const user = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;
          const profile = profileSnap.exists()
            ? (profileSnap.data() as Record<string, unknown>)
            : null;
          const raw = rawDisplayName(user);
          const maxActiveStudents =
            profile && typeof profile.maxActiveStudents === "number"
              ? profile.maxActiveStudents
              : null;
          return {
            uid,
            name: raw || "No name set",
            hasName: !!raw,
            email: user.email || emailByTutorId[uid] || "",
            phone: user.phone || "",
            bio: user.bio || "",
            subjects: Array.isArray(user.subjects) ? user.subjects : [],
            studentCount: countByTutorId[uid] || 0,
            maxActiveStudents,
            profileStatus:
              profile && typeof profile.profileStatus === "string"
                ? profile.profileStatus
                : profile
                ? "draft"
                : null,
            profileData: profile,
          } satisfies TutorRow;
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
            name: rawDisplayName(user) || "Tutor",
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

      const loadedRequests = tutorRequestsSnap.docs.map((requestDoc) => {
        const data = requestDoc.data();
        const createdAtValue = data.createdAt;
        let createdAt: Date | null = null;
        if (typeof createdAtValue?.toDate === "function") {
          createdAt = createdAtValue.toDate();
        } else if (createdAtValue instanceof Date) {
          createdAt = createdAtValue;
        } else if (createdAtValue) {
          const parsed = new Date(createdAtValue);
          createdAt = Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        return {
          id: requestDoc.id,
          name: String(data.name ?? ""),
          email: String(data.email ?? ""),
          status: String(data.status ?? "new"),
          accessCode: String(data.accessCode ?? ""),
          createdAt,
        } satisfies TutorRequestRow;
      });
      setTutorRequests(loadedRequests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function grantTutorInvite(email: string, name?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Not authenticated");

    const grantRes = await fetch("/api/admin/grant-tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email: normalizedEmail, name }),
    });

    const grantData = (await grantRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      accessCode?: string;
    };

    if (!grantRes.ok || !grantData.ok || !grantData.accessCode) {
      throw new Error(grantData.error ?? "Failed to send invite. Please try again.");
    }

    return { email: normalizedEmail, accessCode: grantData.accessCode };
  }

  async function handleAddTutorByEmail() {
    const email = addTutorEmail.trim().toLowerCase();
    if (!email) return;

    setAddTutorBusy(true);
    setAddTutorMsg(null);
    try {
      const result = await grantTutorInvite(email);
      setAddTutorMsg({
        type: "success",
        text: `Tutor invite sent to ${result.email}. Access code: ${result.accessCode}`,
      });
      setAddTutorEmail("");
      await load();
    } catch (err) {
      console.error("[add-tutor]", err);
      setAddTutorMsg({ type: "error", text: "Failed to send invite. Please try again." });
    } finally {
      setAddTutorBusy(false);
    }
  }

  async function handleAddTutorFromRequest(email: string, name: string, leadId: string) {
    setRequestInviteBusyId(leadId);
    setAddTutorMsg(null);
    try {
      const result = await grantTutorInvite(email, name);
      await updateDoc(doc(db, "leads", leadId), {
        status: "invited",
        accessCode: result.accessCode,
        updatedAt: serverTimestamp(),
      });
      setAddTutorEmail(result.email);
      setAddTutorMsg({
        type: "success",
        text: `Access code sent to ${result.email}. Code: ${result.accessCode}`,
      });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send invite. Please try again.";
      setAddTutorMsg({ type: "error", text: message });
    } finally {
      setRequestInviteBusyId(null);
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
      setActionError(e instanceof Error ? e.message : "Failed to process tutor decision.");
    } finally {
      setActionBusyUid(null);
    }
  }

  function handleEditSave(uid: string, patch: Partial<TutorRow>) {
    setRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r))
    );
  }

  async function handleDeleteTutor(uid: string, name: string) {
    if (
      !window.confirm(
        `Remove ${name} as a tutor? This will remove their tutor role but not their user account.`
      )
    )
      return;

    setDeletingUid(uid);
    try {
      await deleteDoc(doc(db, "roles", uid));
      setRows((prev) => prev.filter((r) => r.uid !== uid));
      if (editingUid === uid) setEditingUid(null);
    } catch (e) {
      console.error(e);
      setActionError("Failed to remove tutor role. Check console.");
    } finally {
      setDeletingUid(null);
    }
  }

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );
  const sortedPendingRows = useMemo(
    () =>
      [...pendingRows].sort((a, b) => {
        const at = a.submittedAt?.getTime() ?? 0;
        const bt = b.submittedAt?.getTime() ?? 0;
        return bt - at;
      }),
    [pendingRows]
  );
  const sortedTutorRequests = useMemo(
    () =>
      [...tutorRequests].sort((a, b) => {
        const at = a.createdAt?.getTime() ?? 0;
        const bt = b.createdAt?.getTime() ?? 0;
        return bt - at;
      }),
    [tutorRequests]
  );
  const newTutorRequestCount = useMemo(
    () => tutorRequests.filter((r) => r.status === "new").length,
    [tutorRequests]
  );

  // Column count for the tutor table colspan (Tutor | Email | Students | Profile | Open | Actions)
  const tutorColCount = 6;

  const profileSummary = useMemo(() => {
    const noProfile = sortedRows.filter((r) => r.profileStatus === null).length;
    const draft = sortedRows.filter((r) => r.profileStatus === "draft").length;
    const pending = sortedRows.filter((r) => r.profileStatus === "pending_review").length;
    const active = sortedRows.filter((r) => r.profileStatus === "active").length;
    const paused = sortedRows.filter((r) => r.profileStatus === "paused").length;
    return { noProfile, draft, pending, active, paused, needsFinishing: noProfile + draft };
  }, [sortedRows]);

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

      {/* ── Pending approvals ──────────────────────────────────────────────── */}
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
                    {t.status}{!t.isComplete ? " · incomplete" : ""}
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

      {/* ── Tutor requests ─────────────────────────────────────────────────── */}
      {sortedTutorRequests.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <span>Tutor requests</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, background: "#fce8ee", color: "#c0445e", borderRadius: 20, padding: "2px 8px" }}>
              {newTutorRequestCount} new
            </span>
          </div>

          {sortedTutorRequests.map((request) => (
            <div key={request.id} style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{request.name || request.email}</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>{request.email}</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
                  {request.createdAt ? request.createdAt.toLocaleString() : "No submission date"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: request.status === "invited" ? "#d4edcc" : "#fce8ee", color: request.status === "invited" ? "#2d5a24" : "#c0445e" }}>
                  {request.status === "invited" ? "Invited" : "New"}
                </span>
                {request.status !== "invited" && (
                  <button
                    type="button"
                    onClick={() => void handleAddTutorFromRequest(request.email, request.name, request.id)}
                    disabled={requestInviteBusyId === request.id}
                    style={{ background: "#456071", color: "#fff", border: "none", borderRadius: 9, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: requestInviteBusyId === request.id ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: requestInviteBusyId === request.id ? 0.6 : 1 }}
                  >
                    {requestInviteBusyId === request.id ? "Sending..." : "Add as tutor"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Add tutor ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 12px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", whiteSpace: "nowrap" }}>Add Tutor</span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 4 }}>Grant tutor access by email</div>
        <div style={{ fontSize: 12, color: "#8a96a3", marginBottom: 14, lineHeight: 1.5 }}>
          Generate a tutor access code and email invite for someone who has not created their Studyroom account yet.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4, letterSpacing: "0.04em" }}>User email address</div>
            <input
              type="email"
              value={addTutorEmail}
              onChange={(e) => setAddTutorEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !addTutorBusy && void handleAddTutorByEmail()}
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

      {/* ── Tutor Profile Follow-up ───────────────────────────────────────── */}
      {!loading && sortedRows.length > 0 && (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] px-5 py-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
            Tutor Profile Follow-up
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {profileSummary.needsFinishing > 0 && (
              <span style={{ color: "#748398" }}>
                <span className="font-semibold">{profileSummary.needsFinishing}</span>{" "}
                {profileSummary.needsFinishing === 1 ? "tutor needs" : "tutors need"} to finish{" "}
                {profileSummary.needsFinishing === 1 ? "their profile" : "their profiles"}
              </span>
            )}
            {profileSummary.pending > 0 && (
              <span style={{ color: "#456071" }}>
                <span className="font-semibold">{profileSummary.pending}</span>{" "}
                {profileSummary.pending === 1 ? "profile" : "profiles"} waiting for admin review
              </span>
            )}
            {profileSummary.active > 0 && (
              <span style={{ color: "#82977e" }}>
                <span className="font-semibold">{profileSummary.active}</span>{" "}
                active {profileSummary.active === 1 ? "profile" : "profiles"}
              </span>
            )}
            {profileSummary.paused > 0 && (
              <span style={{ color: "#8b7d6b" }}>
                <span className="font-semibold">{profileSummary.paused}</span>{" "}
                paused {profileSummary.paused === 1 ? "profile" : "profiles"}
              </span>
            )}
            {profileSummary.needsFinishing === 0 && profileSummary.pending === 0 && (
              <span className="text-[color:var(--muted)]">All profiles up to date.</span>
            )}
          </div>
        </div>
      )}

      {/* ── Tutor directory ────────────────────────────────────────────────── */}
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
          <table className="min-w-[960px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Profile</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((t) => (
                <Fragment key={t.uid}>
                  <tr className="border-t border-[color:var(--ring)]">
                    {/* Name — muted if not set */}
                    <td className="px-4 py-4 text-sm">
                      {t.hasName ? (
                        <span className="font-semibold text-[color:var(--ink)]">{t.name}</span>
                      ) : (
                        <span className="italic text-[color:var(--muted)]">No name set</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-[color:var(--muted)]">{t.email || "—"}</td>
                    <td className="px-4 py-4 text-sm">
                      {t.maxActiveStudents == null ? (
                        <span className="text-[color:var(--muted)]">
                          {t.studentCount} assigned · <span className="text-slate-400">Capacity not set</span>
                        </span>
                      ) : (() => {
                        const remaining = t.maxActiveStudents - t.studentCount;
                        return (
                          <span>
                            <span className="text-[color:var(--ink)]">
                              {t.studentCount} / {t.maxActiveStudents} assigned
                            </span>
                            {" · "}
                            {remaining > 0 ? (
                              <span className="font-semibold text-teal-700">{remaining} spaces</span>
                            ) : remaining === 0 ? (
                              <span className="font-semibold text-amber-700">At capacity</span>
                            ) : (
                              <span className="font-semibold text-rose-700">Over capacity</span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <ProfileCell
                        profileStatus={t.profileStatus}
                        profileData={t.profileData}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/hub/admin/tutors/${t.uid}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                      >
                        Open →
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingUid(editingUid === t.uid ? null : t.uid)}
                          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                        >
                          {editingUid === t.uid ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTutor(t.uid, t.hasName ? t.name : t.email || t.uid)}
                          disabled={deletingUid === t.uid}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          {deletingUid === t.uid ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit panel — expands below the row */}
                  {editingUid === t.uid && (
                    <tr className="border-t border-[color:var(--ring)]">
                      <td colSpan={tutorColCount} className="p-0">
                        <EditPanel
                          tutor={t}
                          onSave={handleEditSave}
                          onCancel={() => setEditingUid(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
