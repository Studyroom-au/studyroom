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
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const [tutorProfile, setTutorProfile] = useState<UserDoc | null>(null);

  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  }, [clientId]);

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

  async function deleteClient() {
    const confirmed = window.confirm(
      `Delete client record for "${client?.parentName || clientId}"? This only removes the client document — students and sessions are not deleted.`
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
  const invoicedSessions = sessions.filter((s) => s.billingStatus === "INVOICED" || !!s.xeroInvoiceId);
  const payableCents = completedSessions.reduce((sum, s) => sum + (s.tutorPayableCents ?? 0), 0);

  const sessionNotes = sessions
    .filter((s) => s.notes && s.notes.trim().length > 0)
    .sort((a, b) => {
      const aTime = a.startAt?.toMillis() ?? 0;
      const bTime = b.startAt?.toMillis() ?? 0;
      return bTime - aTime;
    });

  const activePlan = plans.find((p) => p.status === "active");

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
          <h2 className="mb-4 text-base font-semibold text-[color:var(--ink)]">Parent</h2>
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
        </section>

        {/* Students */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-[color:var(--ink)]">
            Students ({students.length})
          </h2>
          {students.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No students linked to this client.</p>
          ) : (
            <div className="space-y-4">
              {students.map((s) => {
                const plan = plans.find((p) => p.studentId === s.id);
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-[color:var(--ring)] bg-[#f5f7fb] p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[color:var(--ink)]">
                        {s.studentName || "Student"}
                        {s.yearLevel ? ` · ${s.yearLevel}` : ""}
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
                      <InfoRow label="Package" value={plan?.type ?? s.package} />
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
              <div className="text-2xl font-bold text-[color:var(--ink)]">{money(payableCents)}</div>
              <div className="text-xs text-[color:var(--muted)]">Tutor payable</div>
            </div>
          </div>
          {activePlan && (
            <div className="mt-3 text-sm text-[color:var(--muted)]">
              Active plan: <span className="font-semibold text-[color:var(--ink)]">{activePlan.type}</span>
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

        {/* Danger zone */}
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-base font-semibold text-red-700">Danger zone</h2>
          <p className="mb-4 text-sm text-red-600">
            Deletes the client record only. Students and sessions are not removed.
          </p>
          <button
            type="button"
            onClick={deleteClient}
            disabled={deleting}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete client"}
          </button>
        </section>
      </div>
    </div>
  );
}
