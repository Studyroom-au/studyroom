// src/app/hub/admin/clients/[clientId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { formatPlanLabel } from "@/lib/studyroom/billing";

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
  onboardingStatus?: "INCOMPLETE" | "COMPLETE";
  onboardingCompletedAt?: Timestamp | null;
  activePlanId?: string | null;
  adminNotes?: string | null;
  createdAt?: Timestamp;
  status?: string;
};

type StudentDoc = {
  id: string;
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  subjects?: string[];
  mode?: string | null;
  suburb?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
  goals?: string | null;
  challenges?: string | null;
  package?: string | null;
  tutorConfirmedAt?: Timestamp | null;
  status?: string;
};

type SessionDoc = {
  id: string;
  studentId: string;
  tutorId?: string;
  status?: string;
  startAt?: Timestamp;
  notes?: string | null;
  billingStatus?: string;
  xeroInvoiceId?: string | null;
  tutorPayableCents?: number;
};

type PlanDoc = {
  id: string;
  type?: string;
  status?: string;
  studentId?: string | null;
  finalPriceCents?: number | null;
  standardPriceCents?: number | null;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number | null;
};

type EntitlementDoc = {
  remainingSessions?: number;
};

type UserDoc = {
  name?: string;
  displayName?: string;
  email?: string;
};

function asString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function formatDate(ts?: Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="w-36 shrink-0 text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      <span className="text-[color:var(--ink)]">{value || "—"}</span>
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [entitlements, setEntitlements] = useState<Record<string, EntitlementDoc>>({});
  const [tutorProfile, setTutorProfile] = useState<UserDoc | null>(null);

  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingParent, setEditingParent] = useState(false);
  const [parentForm, setParentForm] = useState({
    parentName: "", parentEmail: "", parentPhone: "",
    addressLine1: "", suburb: "", postcode: "",
  });
  const [savingParent, setSavingParent] = useState(false);

  // Add / Link child (final pre-release addition, item 2) —
  // "Add new child" navigates to add-existing with this family preselected;
  // "Link existing student" merges an already-enrolled student (from a
  // duplicate family record) into this one via the transactional server
  // route, which is the only thing that touches sessions/invoices/plans.
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddLinkMenu, setShowAddLinkMenu] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkCandidatesLoading, setLinkCandidatesLoading] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [linkCandidates, setLinkCandidates] = useState<
    Array<{ id: string; studentName: string; clientId: string; parentName: string; parentEmail: string; likely: boolean }>
  >([]);
  const [selectedLinkCandidateId, setSelectedLinkCandidateId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Client doc
        const clientSnap = await getDoc(doc(db, "clients", clientId));
        if (!clientSnap.exists()) {
          setClient(null);
          return;
        }
        const clientData = clientSnap.data() as ClientDoc;
        setClient(clientData);
        setAdminNotes(asString(clientData.adminNotes));

        // Students linked to this client
        const studentsSnap = await getDocs(
          query(collection(db, "students"), where("clientId", "==", clientId))
        );
        const studentDocs: StudentDoc[] = studentsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StudentDoc, "id">),
        }));
        setStudents(studentDocs);

        // Sessions linked to this client
        const sessionsSnap = await getDocs(
          query(collection(db, "sessions"), where("clientId", "==", clientId))
        );
        const sessionDocs: SessionDoc[] = sessionsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SessionDoc, "id">),
        }));
        setSessions(sessionDocs);

        // Plans linked to this client
        const plansSnap = await getDocs(
          query(collection(db, "plans"), where("clientId", "==", clientId))
        );
        const planDocs: PlanDoc[] = plansSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PlanDoc, "id">),
        }));
        setPlans(planDocs);

        // Entitlement balances for each active, non-casual plan (per student,
        // not one family-wide value — Release 1B, Stage 6).
        const activePrepaidPlans = planDocs.filter((p) => p.status === "active" && p.type !== "casual");
        const entitlementEntries = await Promise.all(
          activePrepaidPlans.map(async (p) => {
            const snap = await getDoc(doc(db, "entitlements", p.id));
            return [p.id, snap.exists() ? (snap.data() as EntitlementDoc) : {}] as const;
          })
        );
        setEntitlements(Object.fromEntries(entitlementEntries));

        // Assigned tutor profile
        const tutorId = asString(clientData.assignedTutorId);
        if (tutorId) {
          const tutorSnap = await getDoc(doc(db, "users", tutorId));
          if (tutorSnap.exists()) setTutorProfile(tutorSnap.data() as UserDoc);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId, reloadKey]);

  async function saveParentInfo() {
    setSavingParent(true);
    try {
      // Only updates this client document — no auth users, no student records, no syncing.
      await updateDoc(doc(db, "clients", clientId), {
        parentName: parentForm.parentName.trim() || null,
        parentEmail: parentForm.parentEmail.trim() || null,
        parentPhone: parentForm.parentPhone.trim() || null,
        addressLine1: parentForm.addressLine1.trim() || null,
        suburb: parentForm.suburb.trim() || null,
        postcode: parentForm.postcode.trim() || null,
        updatedAt: serverTimestamp(),
      });
      setClient((prev) =>
        prev
          ? {
              ...prev,
              parentName: parentForm.parentName.trim() || undefined,
              parentEmail: parentForm.parentEmail.trim() || undefined,
              parentPhone: parentForm.parentPhone.trim() || null,
              addressLine1: parentForm.addressLine1.trim() || null,
              suburb: parentForm.suburb.trim() || null,
              postcode: parentForm.postcode.trim() || null,
            }
          : prev
      );
      setEditingParent(false);
    } finally {
      setSavingParent(false);
    }
  }

  async function saveAdminNotes() {
    setSavingNotes(true);
    try {
      await updateDoc(doc(db, "clients", clientId), {
        adminNotes,
        updatedAt: serverTimestamp(),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSavingNotes(false);
    }
  }

  // Removal lifecycle (Release 1B, Stage 6d): "End family" is the normal
  // action — it cascades to every one of this family's students so they
  // disappear from their tutors' active lists immediately, without deleting
  // anything. The old "Delete client" only ever removed the client doc,
  // leaving students dangling (still "active"-looking to their tutor) —
  // exactly the traced root cause of students outliving a removed family.
  async function endFamily() {
    const confirmed = window.confirm(
      `End "${client?.parentName || clientId}" as a family? All ${students.length} student(s) will be marked ended and disappear from their tutors' active lists. Session, billing, and package history is kept.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "clients", clientId), { status: "ended", endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      // Only cascade to students not already independently ended — this
      // preserves each such student's TRUE original endedAt (rather than
      // overwriting it with the family's archive time), which is also what
      // lets a future Restore tell "ended because the family was archived"
      // apart from "was already ended before that" (final pre-release fix).
      for (const s of students) {
        if (s.status !== "ended") {
          batch.update(doc(db, "students", s.id), { status: "ended", endedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
      }
      await batch.commit();
      setClient((prev) => (prev ? { ...prev, status: "ended" } : prev));
    } catch (e) {
      console.error(e);
      alert("Failed to end family. Check console.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteClient() {
    // Guardrail: refuse if there's any real session or package history across
    // any of this family's students — permanent delete is only for genuine
    // mistakes/test records; a real family should be ended, not deleted.
    if (sessions.length > 0 || plans.length > 0) {
      alert(
        `This family has ${sessions.length} session(s) and ${plans.length} package record(s) — it cannot be permanently deleted. Use "End family" instead.`
      );
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete client record for "${client?.parentName || clientId}"? This only removes the client document — students are not deleted (end them separately first).`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "clients", clientId));
      router.push("/hub/admin/clients");
    } catch (e) {
      console.error(e);
      alert("Delete failed. Check console.");
      setDeleting(false);
    }
  }

  // Link existing student — surfaces likely matches (normalised parent
  // email against OTHER client records) first, but always requires explicit
  // admin confirmation before anything is moved. Never auto-merges.
  async function loadLinkCandidates() {
    setLinkCandidatesLoading(true);
    setLinkMsg(null);
    try {
      const normalizedEmail = (client?.parentEmail || "").trim().toLowerCase();
      const likelyClientIds = new Set<string>();
      if (normalizedEmail) {
        const likelyClientsSnap = await getDocs(
          query(collection(db, "clients"), where("parentEmail", "==", normalizedEmail))
        );
        likelyClientsSnap.docs.forEach((d) => {
          if (d.id !== clientId) likelyClientIds.add(d.id);
        });
      }

      const [allClientsSnap, allStudentsSnap] = await Promise.all([
        getDocs(query(collection(db, "clients"), limit(300))),
        getDocs(query(collection(db, "students"), limit(500))),
      ]);
      const clientsById = new Map<string, { parentName: string; parentEmail: string }>();
      allClientsSnap.docs.forEach((d) => {
        const data = d.data() as { parentName?: string; parentEmail?: string };
        clientsById.set(d.id, { parentName: data.parentName || "Parent", parentEmail: data.parentEmail || "" });
      });

      const candidates = allStudentsSnap.docs
        .filter((d) => (d.data() as { clientId?: string }).clientId !== clientId)
        .map((d) => {
          const data = d.data() as { studentName?: string; clientId?: string };
          const cid = String(data.clientId ?? "");
          const c = clientsById.get(cid);
          return {
            id: d.id,
            studentName: data.studentName || "Student",
            clientId: cid,
            parentName: c?.parentName || "Unknown family",
            parentEmail: c?.parentEmail || "",
            likely: likelyClientIds.has(cid),
          };
        })
        .sort((a, b) => (a.likely === b.likely ? 0 : a.likely ? -1 : 1));

      setLinkCandidates(candidates);
    } catch (e) {
      console.error(e);
      setLinkMsg("Failed to load students. Check console.");
    } finally {
      setLinkCandidatesLoading(false);
    }
  }

  async function confirmLinkStudent() {
    if (!selectedLinkCandidateId) return;
    const candidate = linkCandidates.find((c) => c.id === selectedLinkCandidateId);
    if (!candidate) return;

    const confirmed = window.confirm(
      `Move ${candidate.studentName} from ${candidate.parentName} → ${client?.parentName || "this family"}?\n\nTutor assignment, package/plan, entitlement, sessions, invoices, and inquiry history are all preserved.`
    );
    if (!confirmed) return;

    setLinking(true);
    setLinkMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/students/link-to-family", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ studentId: selectedLinkCandidateId, destinationClientId: clientId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        movedCounts?: { sessions: number; invoices: number; plans: number; leads: number };
        oldFamilyArchived?: boolean;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to link student.");
      }
      const counts = json.movedCounts;
      setLinkMsg(
        `${candidate.studentName} moved successfully` +
          (counts ? ` (${counts.sessions} session(s), ${counts.invoices} invoice(s), ${counts.plans} plan(s) preserved)` : "") +
          (json.oldFamilyArchived ? ". The old family had no students left and was archived." : ".")
      );
      setSelectedLinkCandidateId(null);
      setShowLinkPanel(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setLinkMsg(e instanceof Error ? e.message : "Failed to link student.");
    } finally {
      setLinking(false);
    }
  }

  const filteredLinkCandidates = linkCandidates.filter((c) => {
    if (!linkSearchTerm.trim()) return true;
    const term = linkSearchTerm.trim().toLowerCase();
    return (
      c.studentName.toLowerCase().includes(term) ||
      c.parentName.toLowerCase().includes(term) ||
      c.parentEmail.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[color:var(--muted)]">Loading…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-[color:var(--muted)]">Client not found.</p>
          <Link
            href="/hub/admin/clients"
            className="mt-4 inline-flex rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to clients
          </Link>
        </div>
      </div>
    );
  }

  const tutorName =
    tutorProfile?.name ||
    tutorProfile?.displayName ||
    asString(client.assignedTutorName) ||
    asString(client.assignedTutorEmail) ||
    "Unassigned";

  const completedSessions = sessions.filter((s) => s.status === "completed" || s.status === "COMPLETED");
  // "DRAFT_CREATED" is the real billingStatus the engine writes once a Xero draft exists;
  // xeroInvoiceId is kept as a secondary signal for older/edge-case docs.
  const invoicedSessions = sessions.filter((s) => s.billingStatus === "DRAFT_CREATED" || !!s.xeroInvoiceId);
  // Release 1A (A4): tutorPayableCents is not yet written anywhere by the billing engine,
  // so this is reported as "not yet available" rather than a fabricated $0 total.
  const payableSessions = completedSessions.filter((s) => typeof s.tutorPayableCents === "number");
  const payableCents = payableSessions.reduce((sum, s) => sum + (s.tutorPayableCents ?? 0), 0);
  const payableUnavailableCount = completedSessions.length - payableSessions.length;

  const sessionNotes = sessions
    .filter((s) => s.notes && s.notes.trim().length > 0)
    .sort((a, b) => {
      const aTime = a.startAt?.toMillis() ?? 0;
      const bTime = b.startAt?.toMillis() ?? 0;
      return bTime - aTime;
    });

  // Multi-student-family correction: a family can have more than one active
  // plan (one per student) — a single arbitrary "the active plan" pick would
  // silently hide a sibling's package. The per-student list below already
  // shows each student's own plan correctly; this is just a count.
  const activePlanCount = plans.filter((p) => p.status === "active").length;

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin · Client
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
              {client.parentName || "Unknown"}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              {client.parentEmail}
              {client.parentPhone ? ` · ${client.parentPhone}` : ""}
            </p>
          </div>
          <Link
            href="/hub/admin/clients"
            className="self-start rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to clients
          </Link>
        </header>

        {/* Parent info */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">Parent</h2>
            {!editingParent && (
              <button
                type="button"
                onClick={() => {
                  setParentForm({
                    parentName: client.parentName ?? "",
                    parentEmail: client.parentEmail ?? "",
                    parentPhone: client.parentPhone ?? "",
                    addressLine1: client.addressLine1 ?? "",
                    suburb: client.suburb ?? "",
                    postcode: client.postcode ?? "",
                  });
                  setEditingParent(true);
                }}
                className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editingParent ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["parentName", "Name", "text"],
                    ["parentEmail", "Email", "email"],
                    ["parentPhone", "Phone", "tel"],
                    ["addressLine1", "Address line 1", "text"],
                    ["suburb", "Suburb", "text"],
                    ["postcode", "Postcode", "text"],
                  ] as const
                ).map(([f, label, type]) => (
                  <label key={f} className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">{label}</span>
                    <input
                      type={type}
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={parentForm[f]}
                      onChange={(e) => setParentForm((p) => ({ ...p, [f]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveParentInfo}
                  disabled={savingParent}
                  className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingParent ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingParent(false)}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:bg-[#d6e5e3]/40"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Name" value={client.parentName} />
              <InfoRow label="Email" value={client.parentEmail} />
              <InfoRow label="Phone" value={client.parentPhone} />
              <InfoRow
                label="Address"
                value={[client.addressLine1, client.suburb, client.postcode].filter(Boolean).join(", ")}
              />
              <InfoRow
                label="Onboarding"
                value={
                  client.onboardingStatus === "COMPLETE"
                    ? `Complete${client.onboardingCompletedAt ? ` · ${formatDate(client.onboardingCompletedAt)}` : ""}`
                    : "Incomplete"
                }
              />
              <InfoRow label="Assigned tutor" value={tutorName} />
            </>
          )}
        </section>

        {/* Students */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">
              Students ({students.length})
            </h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddLinkMenu((v) => !v)}
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
              >
                Add / Link child ▾
              </button>
              {showAddLinkMenu && (
                <div className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-[color:var(--ring)] bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddLinkMenu(false);
                      router.push(`/hub/admin/students/add-existing?clientId=${clientId}`);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[#f4f7f9]"
                  >
                    Add new child
                    <span className="block font-normal text-[color:var(--muted)]">Enrol a new sibling under this family</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddLinkMenu(false);
                      setShowLinkPanel(true);
                      setLinkMsg(null);
                      if (linkCandidates.length === 0) void loadLinkCandidates();
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[#f4f7f9]"
                  >
                    Link existing student
                    <span className="block font-normal text-[color:var(--muted)]">Move a student from a duplicate family record</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {showLinkPanel && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-900">Link existing student into this family</p>
                <button
                  type="button"
                  onClick={() => { setShowLinkPanel(false); setSelectedLinkCandidateId(null); }}
                  className="text-xs font-semibold text-amber-800 hover:underline"
                >
                  Close
                </button>
              </div>
              <p className="mb-3 text-xs text-amber-800">
                Preserves tutor, package/plan, entitlement, sessions, invoices, and inquiry history. Likely matches
                (same parent email) are shown first — nothing is moved until you confirm.
              </p>
              <input
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                placeholder="Search by student or parent name/email…"
                className="mb-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm"
              />
              {linkCandidatesLoading ? (
                <p className="text-sm text-amber-800">Loading students…</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-amber-200 bg-white">
                  {filteredLinkCandidates.length === 0 ? (
                    <p className="p-3 text-sm text-[color:var(--muted)]">No matching students found.</p>
                  ) : (
                    filteredLinkCandidates.slice(0, 50).map((c) => (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center justify-between gap-2 border-t border-amber-100 px-3 py-2 text-sm first:border-t-0 ${
                          selectedLinkCandidateId === c.id ? "bg-amber-100" : "hover:bg-amber-50/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="linkCandidate"
                            checked={selectedLinkCandidateId === c.id}
                            onChange={() => setSelectedLinkCandidateId(c.id)}
                          />
                          <span>
                            <span className="font-semibold text-[color:var(--ink)]">{c.studentName}</span>
                            <span className="text-[color:var(--muted)]"> — {c.parentName}{c.parentEmail ? ` (${c.parentEmail})` : ""}</span>
                          </span>
                        </span>
                        {c.likely && (
                          <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Likely match
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={confirmLinkStudent}
                  disabled={!selectedLinkCandidateId || linking}
                  className="rounded-xl bg-amber-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {linking ? "Moving…" : "Move into this family"}
                </button>
                {linkMsg && <span className="text-xs font-medium text-amber-900">{linkMsg}</span>}
              </div>
            </div>
          )}

          {students.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No students linked to this client.</p>
          ) : (
            <div className="space-y-4">
              {students.map((s) => {
                // Multi-student-family correction: each student's OWN active
                // plan, never an arbitrary family-wide pick.
                const plan = plans.find((p) => p.studentId === s.id && p.status === "active");
                const entitlement = plan ? entitlements[plan.id] : undefined;
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[color:var(--ink)]">
                        {s.studentName || "Student"}
                        {s.yearLevel ? ` · ${s.yearLevel}` : ""}
                        {s.status === "paused" && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Paused
                          </span>
                        )}
                        {s.status === "ended" && (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800">
                            Ended
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/hub/admin/students/${s.id}`}
                        className="rounded-lg border border-[color:var(--ring)] bg-white px-2.5 py-1 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                      >
                        View student →
                      </Link>
                    </div>
                    <div className="grid gap-1 text-sm sm:grid-cols-2">
                      <InfoRow label="School" value={s.school} />
                      <InfoRow label="Subjects" value={s.subjects?.join(", ")} />
                      <InfoRow
                        label="Mode"
                        value={s.mode === "in-home" ? "In-home" : s.mode === "online" ? "Online" : null}
                      />
                      <InfoRow label="Suburb" value={s.suburb} />
                      <InfoRow label="Tutor" value={s.assignedTutorEmail} />
                      <InfoRow
                        label="Payment arrangement"
                        value={plan ? formatPlanLabel(plan.type as Parameters<typeof formatPlanLabel>[0]) : (s.package ?? "Casual")}
                      />
                      {plan && plan.type !== "casual" && (
                        <InfoRow label="Sessions remaining" value={String(entitlement?.remainingSessions ?? "—")} />
                      )}
                      {plan?.finalPriceCents != null && (
                        <InfoRow
                          label="Agreed price"
                          value={`$${(plan.finalPriceCents / 100).toFixed(2)}${plan.discountType ? " (discounted)" : ""}`}
                        />
                      )}
                      <InfoRow label="Goals" value={s.goals} />
                      <InfoRow label="Challenges" value={s.challenges} />
                      <InfoRow
                        label="Tutor confirmed"
                        value={s.tutorConfirmedAt ? formatDate(s.tutorConfirmedAt) : "Pending"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Session summary */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-[color:var(--ink)]">Session summary</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4 text-center">
              <div className="text-2xl font-bold text-[color:var(--ink)]">{completedSessions.length}</div>
              <div className="text-xs text-[color:var(--muted)]">Completed sessions</div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4 text-center">
              <div className="text-2xl font-bold text-[color:var(--ink)]">{invoicedSessions.length}</div>
              <div className="text-xs text-[color:var(--muted)]">Invoiced</div>
            </div>
            <div className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4 text-center">
              <div className="text-2xl font-bold text-[color:var(--ink)]">
                {payableSessions.length > 0 ? money(payableCents) : "—"}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Tutor payable
                {payableUnavailableCount > 0 && (
                  <span className="block text-[10px] text-amber-700">
                    Not yet available for {payableUnavailableCount} session
                    {payableUnavailableCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          </div>
          {activePlanCount > 0 && (
            <div className="mt-3 text-sm text-[color:var(--muted)]">
              <span className="font-semibold text-[color:var(--ink)]">{activePlanCount}</span> active package
              {activePlanCount === 1 ? "" : "s"} — see each student above for their own package.
            </div>
          )}
        </section>

        {/* Tutor session notes */}
        {sessionNotes.length > 0 && (
          <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[color:var(--ink)]">
              Tutor session notes ({sessionNotes.length})
            </h2>
            <div className="space-y-3">
              {sessionNotes.map((s) => (
                <div key={s.id} className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4">
                  <div className="mb-1 text-xs text-[color:var(--muted)]">
                    {s.startAt ? formatDate(s.startAt) : "Date unknown"}
                  </div>
                  <p className="text-sm text-[color:var(--ink)]">{s.notes}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Admin notes */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-[color:var(--ink)]">Admin notes</h2>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={5}
            placeholder="Internal notes about this client…"
            className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={saveAdminNotes}
              disabled={savingNotes}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
            >
              {savingNotes ? "Saving…" : "Save notes"}
            </button>
            {notesSaved && (
              <span className="text-xs font-semibold text-emerald-600">Saved</span>
            )}
          </div>
        </section>

        {/* Removal lifecycle — Release 1B, Stage 6d */}
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-base font-semibold text-red-700">Remove family</h2>
          <p className="mb-4 text-sm text-red-600">
            Status: <strong>{client?.status === "ended" ? "Ended" : "Active"}</strong>. Ending a family cascades to
            every student so they disappear from their tutors&apos; active lists — nothing is deleted. Permanent delete
            stays available for a genuine mistake/test record only, and is refused while any real session or
            package history exists.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={endFamily}
              disabled={deleting || client?.status === "ended"}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {client?.status === "ended" ? "Family already ended" : deleting ? "Working…" : "End family"}
            </button>
            <button
              type="button"
              onClick={deleteClient}
              disabled={deleting}
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Permanently delete client record"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
