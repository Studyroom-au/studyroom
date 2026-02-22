// src/app/hub/admin/leads/[leadId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type LeadStatus = "new" | "contacted" | "assigned" | "converted";
type LeadStatusRaw = LeadStatus | "claimed" | "closed";

type Lead = {
  parentName: string;
  parentEmail: string;
  parentPhone?: string | null;

  studentName: string;
  yearLevel: string;
  school?: string | null;

  subjects?: string[];
  mode?: "online" | "in-home";
  suburb?: string | null;

  availability?: unknown;
  availabilityBlocks?: string[];

  goals?: string | null;
  challenges?: string | null;

  package?: string | null;

  status: LeadStatus;
  source?: "direct-enrol" | "contact";

  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;

  clientId?: string | null;
  studentId?: string | null;

  createdAt?: Timestamp;
};

type TutorOption = {
  uid: string;
  name: string;
  email?: string;
};

function safeArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") as string[] : [];
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lead, setLead] = useState<Lead | null>(null);
  const [tutors, setTutors] = useState<TutorOption[]>([]);

  const [status, setStatus] = useState<LeadStatus>("new");
  const [assignedTutorId, setAssignedTutorId] = useState<string>("");

  // Load lead
  useEffect(() => {
    async function loadLead() {
      setLoading(true);
      try {
        const ref = doc(db, "leads", leadId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setLead(null);
          return;
        }

        const data = snap.data() as DocumentData;

        const loaded: Lead = {
          parentName: asString(data.parentName),
          parentEmail: asString(data.parentEmail),
          parentPhone: asNullableString(data.parentPhone),

          studentName: asString(data.studentName),
          yearLevel: asString(data.yearLevel),
          school: asNullableString(data.school),

          subjects: safeArr(data.subjects),
          mode: data.mode === "online" || data.mode === "in-home" ? data.mode : undefined,
          suburb: asNullableString(data.suburb),

          availability: data.availability ?? null,
          availabilityBlocks: safeArr(data.availabilityBlocks),

          goals: asNullableString(data.goals),
          challenges: asNullableString(data.challenges),

          package: asNullableString(data.package),

          status:
            (data.status as LeadStatusRaw) === "claimed"
              ? "assigned"
              : (data.status as LeadStatusRaw) === "closed"
              ? "contacted"
              : data.status === "new" ||
                data.status === "contacted" ||
                data.status === "assigned" ||
                data.status === "converted"
              ? data.status
              : "new",

          source: data.source === "contact" ? "contact" : "direct-enrol",

          assignedTutorId: asNullableString(data.assignedTutorId) ?? asNullableString(data.claimedTutorId),
          assignedTutorName: asNullableString(data.assignedTutorName) ?? asNullableString(data.claimedTutorName),
          assignedTutorEmail: asNullableString(data.assignedTutorEmail) ?? asNullableString(data.claimedTutorEmail),

          clientId: asNullableString(data.clientId),
          studentId: asNullableString(data.studentId),

          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        };

        setLead(loaded);
        setStatus(loaded.status);
        setAssignedTutorId(loaded.assignedTutorId ?? "");
      } finally {
        setLoading(false);
      }
    }
    loadLead();
  }, [leadId]);

  // Load tutors (from roles)
  useEffect(() => {
    async function loadTutors() {
      try {
        const rolesSnap = await getDocs(query(collection(db, "roles")));
        const tutorUids = rolesSnap.docs
          .map((d) => ({ uid: d.id, role: (d.data() as DocumentData).role as unknown }))
          .filter((x) => x.role === "tutor")
          .map((x) => x.uid);

        if (tutorUids.length === 0) {
          setTutors([]);
          return;
        }

        const userSnaps = await Promise.all(
          tutorUids.map(async (uid) => {
            const uref = doc(db, "users", uid);
            const usnap = await getDoc(uref);
            const udata = usnap.exists() ? (usnap.data() as DocumentData) : {};
            const name =
              asString(udata.displayName) ||
              asString(udata.name) ||
              asString(udata.fullName) ||
              asString(udata.firstName) ||
              "Tutor";
            const email = asString(udata.email) || asString(udata.userEmail) || "";
            return { uid, name, email };
          })
        );

        setTutors(userSnaps.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        console.error("[lead detail] loadTutors failed:", e);
        setTutors([]);
      }
    }
    loadTutors();
  }, []);

  const assignedTutor = useMemo(() => {
    if (!assignedTutorId) return null;
    return tutors.find((t) => t.uid === assignedTutorId) ?? null;
  }, [assignedTutorId, tutors]);

  // ✅ FIXED: Save changes now upserts students/clients when assigning
  async function saveChanges() {
    if (!lead) return;
    setSaving(true);
    try {
      const leadRef = doc(db, "leads", leadId);
      const batch = writeBatch(db);

      const patch: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (assignedTutorId) {
        const tutorName = assignedTutor?.name ?? null;
        const tutorEmail = assignedTutor?.email ?? null;

        patch.assignedTutorId = assignedTutorId;
        patch.assignedTutorName = tutorName;
        patch.assignedTutorEmail = tutorEmail;

        if (status === "new" || status === "contacted") patch.status = "assigned";

        // deterministic IDs for MVP (keeps everything aligned)
        const clientId = leadId;
        const studentId = leadId;

        const clientRef = doc(db, "clients", clientId);
        const studentRef = doc(db, "students", studentId);

        batch.set(
          clientRef,
          {
            parentName: lead.parentName,
            parentEmail: lead.parentEmail,
            parentPhone: lead.parentPhone ?? null,

            assignedTutorId,
            assignedTutorName: tutorName,
            assignedTutorEmail: tutorEmail,

            status: "active",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        batch.set(
          studentRef,
          {
            clientId,

            studentName: lead.studentName,
            yearLevel: lead.yearLevel,
            school: lead.school ?? null,

            subjects: lead.subjects ?? [],
            mode: lead.mode ?? null,
            suburb: lead.suburb ?? null,

            availability: lead.availability ?? null,
            availabilityBlocks: lead.availabilityBlocks ?? [],

            goals: lead.goals ?? null,
            challenges: lead.challenges ?? null,

            package: lead.package ?? null,

            assignedTutorId,
            assignedTutorName: tutorName,
            assignedTutorEmail: tutorEmail,

            tutorConfirmedAt: null,
            tutorConfirmedBy: null,

            status: "active",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        patch.clientId = clientId;
        patch.studentId = studentId;
      } else {
        patch.assignedTutorId = null;
        patch.assignedTutorName = null;
        patch.assignedTutorEmail = null;
        patch.clientId = null;
        patch.studentId = null;
      }

      batch.update(leadRef, patch);
      await batch.commit();

      router.refresh();
      alert("Saved. Student record created/updated.");
    } catch (e) {
      console.error(e);
      alert("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-[color:var(--muted)]">Lead not found.</p>
          <Link
            href="/hub/admin/leads"
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin · Lead
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
              {lead.studentName} · {lead.yearLevel}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Parent: <span className="font-semibold text-[color:var(--ink)]">{lead.parentName}</span> ·{" "}
              <span className="font-semibold text-[color:var(--brand)]">{lead.parentEmail}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub/admin/leads"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
            >
              ← Back to leads
            </Link>
          </div>
        </header>

        {/* Controls */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Admin actions</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="assigned">Assigned</option>
                <option value="converted">Converted</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Assign tutor</div>
              <select
                value={assignedTutorId}
                onChange={(e) => setAssignedTutorId(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
              >
                <option value="">Unassigned</option>
                {tutors.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.name}{t.email ? ` (${t.email})` : ""}
                  </option>
                ))}
              </select>

              {tutors.length === 0 && (
                <p className="text-xs text-[color:var(--muted)]">
                  No tutors found in <code>roles</code>. Add tutor roles first (role = &quot;tutor&quot;).
                </p>
              )}
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveChanges}
              disabled={saving}
              className={
                "brand-cta rounded-xl px-5 py-2 text-sm font-semibold shadow-sm " +
                (saving ? "opacity-60 cursor-not-allowed" : "")
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </button>

            <a
              href={`mailto:${lead.parentEmail}?subject=${encodeURIComponent("Studyroom - next steps")}`}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-5 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
            >
              Email parent
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
