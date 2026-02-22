"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type LeadStatus = "new" | "claimed" | "converted" | "closed";

type LeadDoc = {
  parentName?: unknown;
  parentEmail?: unknown;
  parentPhone?: unknown;

  studentName?: unknown;
  yearLevel?: unknown;
  school?: unknown;

  subjects?: unknown;
  mode?: unknown;
  suburb?: unknown;
  addressLine1?: unknown;
  postcode?: unknown;

  availabilityBlocks?: unknown;

  goals?: unknown;
  challenges?: unknown;
  package?: unknown;

  status?: unknown;

  claimedTutorId?: unknown;
  claimedTutorName?: unknown;
  claimedTutorEmail?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asTimestamp(v: unknown): Timestamp | undefined {
  return v instanceof Timestamp ? v : undefined;
}
function asMode(v: unknown): "online" | "in-home" | undefined {
  return v === "online" || v === "in-home" ? v : undefined;
}
function asLeadStatus(v: unknown): LeadStatus {
  return v === "new" || v === "claimed" || v === "converted" || v === "closed" ? v : "new";
}

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleString();
}

async function getIdTokenOrThrow() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in.");
  return await u.getIdToken();
}

export default function TutorLeadDetailPage() {
  const params = useParams<{ leadsId: string }>();
  const leadId = useMemo(() => String(params?.leadsId ?? ""), [params]);

  const [uid, setUid] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lead, setLead] = useState<null | {
    id: string;

    parentName: string;
    parentEmail: string;
    parentPhone: string;

    studentName: string;
    yearLevel: string;
    school: string | null;

    subjects: string[];
    mode?: "online" | "in-home";
    suburb: string | null;
    addressLine1: string | null;
    postcode: string | null;

    availabilityBlocks: string[];

    goals: string | null;
    challenges: string | null;

    status: LeadStatus;

    claimedTutorId: string | null;
    claimedTutorName: string | null;
    claimedTutorEmail: string | null;

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
  }>(null);

  async function load() {
    if (!leadId) {
      setLead(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ref = doc(db, "leads", leadId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setLead(null);
        return;
      }

      const d = snap.data() as LeadDoc;

      setLead({
        id: snap.id,

        parentName: asString(d.parentName, ""),
        parentEmail: asString(d.parentEmail, ""),
        parentPhone: asString(d.parentPhone, ""),

        studentName: asString(d.studentName, "Student"),
        yearLevel: asString(d.yearLevel, ""),
        school: asNullableString(d.school),

        subjects: asStringArray(d.subjects),
        mode: asMode(d.mode),
        suburb: asNullableString(d.suburb),
        addressLine1: asNullableString(d.addressLine1),
        postcode: asNullableString(d.postcode),

        availabilityBlocks: asStringArray(d.availabilityBlocks),

        goals: asNullableString(d.goals),
        challenges: asNullableString(d.challenges),

        status: asLeadStatus(d.status),

        claimedTutorId: asNullableString(d.claimedTutorId),
        claimedTutorName: asNullableString(d.claimedTutorName),
        claimedTutorEmail: asNullableString(d.claimedTutorEmail),

        createdAt: asTimestamp(d.createdAt),
        updatedAt: asTimestamp(d.updatedAt),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
      load();
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const canClaim = useMemo(() => {
    if (!lead) return false;
    if (lead.status !== "new") return false;
    if (lead.claimedTutorId) return false;
    return true;
  }, [lead]);

  const isMine = useMemo(() => {
    if (!lead) return false;
    return !!lead.claimedTutorId && lead.claimedTutorId === uid;
  }, [lead, uid]);

  async function claim() {
    if (!canClaim) return;
    setSaving(true);
    try {
      const token = await getIdTokenOrThrow();

      const res = await fetch(`/api/leads/${leadId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true; studentId: string }
        | { ok: false; error: string }
        | null;

      if (!res.ok || !data || data.ok !== true) {
        const msg = data && "error" in data ? data.error : "Claim failed.";
        alert(msg);
        return;
      }

      // Go to student page immediately
      window.location.href = `/hub/tutor/students/${data.studentId}`;
    } catch (e) {
      console.error(e);
      alert("Claim failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-[color:var(--muted)]">Loading…</div>;
  }

  if (!lead) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <p className="text-sm text-[color:var(--muted)]">Lead not found.</p>
        <Link className="text-[color:var(--brand)] font-semibold" href="/hub/tutor/leads">
          Back to marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Tutor · Lead
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
              {lead.studentName} {lead.yearLevel ? `· ${lead.yearLevel}` : ""}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Created: {formatDate(lead.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub/tutor/leads"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              Marketplace
            </Link>

            <Link
              href="/hub/tutor/students"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              My Students
            </Link>

            {canClaim ? (
              <button
                type="button"
                onClick={claim}
                disabled={saving}
                className="rounded-xl bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-contrast)] disabled:opacity-60"
              >
                {saving ? "Claiming…" : "Claim this lead"}
              </button>
            ) : (
              <span className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)]">
                {isMine ? "Claimed by you" : lead.claimedTutorId ? "Already claimed" : "Not claimable"}
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Subjects</div>
            <div className="mt-1 text-sm">{lead.subjects.length ? lead.subjects.join(", ") : "—"}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Mode</div>
            <div className="mt-1 text-sm">{lead.mode ? (lead.mode === "in-home" ? "In-home" : "Online") : "—"}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Suburb</div>
            <div className="mt-1 text-sm">{lead.suburb || "—"}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">School</div>
            <div className="mt-1 text-sm">{lead.school || "—"}</div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[color:var(--muted)]">Availability</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--muted)]">
            {lead.availabilityBlocks.length ? (
              lead.availabilityBlocks.map((x) => <li key={x}>{x}</li>)
            ) : (
              <li>—</li>
            )}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Goals</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--muted)]">{lead.goals || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Challenges</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--muted)]">{lead.challenges || "—"}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-[color:var(--ring)]">
          <div className="text-xs font-semibold text-[color:var(--muted)]">Claim status</div>
          <div className="mt-1 text-sm">
            {lead.claimedTutorId
              ? `Claimed by: ${lead.claimedTutorName || lead.claimedTutorEmail || lead.claimedTutorId}`
              : "Not claimed yet"}
          </div>
        </div>
      </section>
    </div>
  );
}
