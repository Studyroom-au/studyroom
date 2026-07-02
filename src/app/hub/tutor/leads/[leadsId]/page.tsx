"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  tutorRequestIds?: unknown;
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
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
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
  if (!ts) return "Unknown";
  return ts.toDate().toLocaleString();
}

function formatMode(mode?: "online" | "in-home") {
  if (!mode) return "Flexible";
  return mode === "in-home" ? "In-home" : "Online";
}

function joinAddress(parts: Array<string | null>) {
  return parts.filter(Boolean).join(", ") || "Not provided";
}

async function getIdTokenOrThrow() {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in.");
  // Force refresh so a newly granted tutor role is included in the token.
  return await u.getIdToken(true);
}

export default function TutorLeadDetailPage() {
  const params = useParams<{ leadsId: string }>();
  const leadId = useMemo(() => String(params?.leadsId ?? ""), [params]);

  const [uid, setUid] = useState("");
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
    packageLabel: string | null;
    status: LeadStatus;
    claimedTutorId: string | null;
    claimedTutorName: string | null;
    claimedTutorEmail: string | null;
    tutorRequestIds: string[];
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
  }>(null);

  const load = useCallback(async () => {
    if (!leadId) {
      setLead(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "leads", leadId));
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
        packageLabel: asNullableString(d.package),
        status: asLeadStatus(d.status),
        claimedTutorId: asNullableString(d.claimedTutorId),
        claimedTutorName: asNullableString(d.claimedTutorName),
        claimedTutorEmail: asNullableString(d.claimedTutorEmail),
        tutorRequestIds: asStringArray(d.tutorRequestIds),
        createdAt: asTimestamp(d.createdAt),
        updatedAt: asTimestamp(d.updatedAt),
      });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
      load();
    });
    return () => off();
  }, [leadId, load]);

  const hasRequested = useMemo(() => {
    if (!lead || !uid) return false;
    return lead.tutorRequestIds.includes(uid);
  }, [lead, uid]);

  const canRequest = useMemo(() => {
    if (!lead) return false;
    if (lead.status !== "new") return false;
    if (hasRequested) return false;
    return true;
  }, [lead, hasRequested]);

  async function sendRequest() {
    if (!canRequest) return;
    setSaving(true);
    try {
      const token = await getIdTokenOrThrow();
      const res = await fetch(`/api/leads/${leadId}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!res.ok || !data || data.ok !== true) {
        const msg = data && "error" in data ? data.error : "Request failed.";
        alert(msg);
        return;
      }

      await load();
    } catch (error) {
      console.error(error);
      alert("Request failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-card rounded-[32px] p-6">
        <div className="h-5 w-28 rounded-full bg-slate-200/70" />
        <div className="mt-4 h-8 w-64 rounded-full bg-slate-200/70" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-[24px] bg-slate-200/70" />
          <div className="h-40 rounded-[24px] bg-slate-200/70" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="surface-card rounded-[32px] px-6 py-10 text-center">
        <h1 className="text-xl font-semibold text-[color:var(--ink)]">Lead not found</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">This lead may have been removed or you may no longer have access to it.</p>
        <Link href="/hub/tutor/leads" className="mt-5 inline-flex rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white">
          Back to marketplace
        </Link>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden rounded-[32px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Lead profile</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
              {lead.studentName}{lead.yearLevel ? ` · ${lead.yearLevel}` : ""}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              Created {formatDate(lead.createdAt)}. Review fit, context, and family details before requesting.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub/tutor/leads"
              className="rounded-full border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:border-[color:var(--brand-soft)] hover:bg-white"
            >
              Marketplace
            </Link>
            <Link
              href="/hub/tutor/students"
              className="rounded-full border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:border-[color:var(--brand-soft)] hover:bg-white"
            >
              My Students
            </Link>
            {canRequest ? (
              <button
                type="button"
                onClick={sendRequest}
                disabled={saving}
                className="rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
              >
                {saving ? "Sending…" : "Request this student"}
              </button>
            ) : hasRequested ? (
              <div className="flex flex-col items-end gap-1">
                <span className="chip text-sm font-semibold">Request sent</span>
                <span className="text-xs text-[color:var(--muted)]">Awaiting admin review</span>
              </div>
            ) : (
              <span className="chip text-sm font-semibold">Not available</span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="surface-card rounded-[28px] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Student snapshot</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Subjects</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(lead.subjects.length ? lead.subjects : ["To be confirmed"]).map((subject) => (
                    <span key={subject} className="rounded-full bg-[color:var(--accent-soft)]/65 px-3 py-1 text-xs font-medium text-[color:var(--ink)]">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Delivery</div>
                <div className="mt-1 text-sm text-[color:var(--ink)]">{formatMode(lead.mode)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">School</div>
                <div className="mt-1 text-sm text-[color:var(--ink)]">{lead.school || "Not provided"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Package</div>
                <div className="mt-1 text-sm text-[color:var(--ink)]">{lead.packageLabel || "Not specified"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Location</div>
                <div className="mt-1 text-sm text-[color:var(--ink)]">{joinAddress([lead.suburb, lead.addressLine1, lead.postcode])}</div>
              </div>
            </div>
          </div>

          <div className="surface-card rounded-[28px] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Learning context</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] bg-white/70 p-4 ring-1 ring-[color:var(--ring)]/75">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Goals</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink)]">{lead.goals || "No goals added yet."}</div>
              </div>
              <div className="rounded-[24px] bg-white/70 p-4 ring-1 ring-[color:var(--ring)]/75">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Challenges</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink)]">{lead.challenges || "No challenges noted yet."}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card rounded-[28px] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Availability</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {lead.availabilityBlocks.length > 0 ? (
                lead.availabilityBlocks.map((slot) => (
                  <span key={slot} className="rounded-full border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]">
                    {slot}
                  </span>
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted)]">No availability provided.</p>
              )}
            </div>
          </div>

          <div className="surface-card rounded-[28px] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Family contact</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Parent / guardian</dt>
                <dd className="mt-1 text-[color:var(--ink)]">{lead.parentName || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Email</dt>
                <dd className="mt-1 break-all text-[color:var(--ink)]">{lead.parentEmail || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Phone</dt>
                <dd className="mt-1 text-[color:var(--ink)]">{lead.parentPhone || "Not provided"}</dd>
              </div>
            </dl>
          </div>

          <div className="surface-card rounded-[28px] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Request status</h2>
            <div className="mt-4 rounded-[24px] bg-white/70 p-4 ring-1 ring-[color:var(--ring)]/75">
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Current state</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{lead.status}</div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {hasRequested
                  ? "Your request is pending admin review. Admin will assign a tutor when ready."
                  : lead.status === "new"
                  ? "This student is available. Click Request to express interest in tutoring them."
                  : "This student is no longer available for requests."}
              </p>
              {lead.updatedAt && <p className="mt-3 text-xs text-[color:var(--muted)]">Last updated {formatDate(lead.updatedAt)}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

