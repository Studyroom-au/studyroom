"use client";

// Canonical Tutor Profile V2 edit form — shared by BOTH /hub/tutor/profile
// (mode="self", the tutor editing their own profile) and the admin
// full-profile editor on /hub/admin/tutors/[tutorId] (mode="admin", final
// pre-release addition). One form, one schema, one API route
// (/api/tutors/profile) — admin and tutor edit the exact same canonical
// tutors/{uid} fields, never a separate admin copy.

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TUTOR_MODES } from "@/lib/studyroom/tutorConstants";
import type { TutorCapability, TutorSupportCapability, AvailabilitySlot } from "@/types/tutor";
import {
  INPUT,
  LABEL,
  SECTION,
  CapabilitiesSection,
  AvailabilityGrid,
} from "./TutorProfileFormParts";

function toDateInput(val: unknown): string {
  if (!val || typeof val !== "string") return "";
  try {
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

type FormState = {
  phone: string;
  bio: string;
  abn: string;
  wwccNumber: string;
  wwccState: string;
  wwccExpiresAt: string;
  driverLicenceNumber: string;
  driverLicenceExpiry: string;
  modes: string[];
  suburb: string;
  postcode: string;
  serviceSuburbs: string;
  travelNotes: string;
  maxTravelMinutes: string;
  maxTravelKm: string;
  availabilitySlots: AvailabilitySlot[];
  availabilityNote: string;
  desiredHoursPerWeek: string;
  maxHoursPerWeek: string;
  maxActiveStudents: string;
  capabilities: TutorCapability[];
  supportCapabilities: TutorSupportCapability[];
};

const EMPTY_FORM: FormState = {
  phone: "", bio: "", abn: "", wwccNumber: "", wwccState: "",
  wwccExpiresAt: "", driverLicenceNumber: "", driverLicenceExpiry: "",
  modes: [], suburb: "", postcode: "", serviceSuburbs: "",
  travelNotes: "", maxTravelMinutes: "", maxTravelKm: "",
  availabilitySlots: [], availabilityNote: "",
  desiredHoursPerWeek: "", maxHoursPerWeek: "", maxActiveStudents: "",
  capabilities: [], supportCapabilities: [],
};

function profileToForm(p: Record<string, unknown>): FormState {
  return {
    phone: String(p.phone ?? ""),
    bio: String(p.bio ?? ""),
    abn: String(p.abn ?? ""),
    wwccNumber: String(p.wwccNumber ?? ""),
    wwccState: String(p.wwccState ?? ""),
    wwccExpiresAt: toDateInput(p.wwccExpiresAt),
    driverLicenceNumber: String(p.driverLicenceNumber ?? ""),
    driverLicenceExpiry: toDateInput(p.driverLicenceExpiry),
    modes: Array.isArray(p.modes) ? (p.modes as string[]) : [],
    suburb: String(p.suburb ?? ""),
    postcode: String(p.postcode ?? ""),
    serviceSuburbs: Array.isArray(p.serviceSuburbs)
      ? (p.serviceSuburbs as string[]).join(", ")
      : "",
    travelNotes: String(p.travelNotes ?? ""),
    maxTravelMinutes: p.maxTravelMinutes != null ? String(p.maxTravelMinutes) : "",
    maxTravelKm: p.maxTravelKm != null ? String(p.maxTravelKm) : "",
    availabilitySlots: Array.isArray(p.availabilitySlots)
      ? (p.availabilitySlots as AvailabilitySlot[])
      : [],
    availabilityNote: String(p.availabilityNote ?? ""),
    desiredHoursPerWeek: p.desiredHoursPerWeek != null ? String(p.desiredHoursPerWeek) : "",
    maxHoursPerWeek: p.maxHoursPerWeek != null ? String(p.maxHoursPerWeek) : "",
    maxActiveStudents: p.maxActiveStudents != null ? String(p.maxActiveStudents) : "",
    capabilities: Array.isArray(p.capabilities) ? (p.capabilities as TutorCapability[]) : [],
    supportCapabilities: Array.isArray(p.supportCapabilities)
      ? (p.supportCapabilities as TutorSupportCapability[])
      : [],
  };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  active: "Active",
  paused: "Paused",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  pending_review: { bg: "#fffbeb", text: "#92400e", border: "#fbbf24" },
  active: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  paused: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

export type TutorProfileFormProps = {
  /** "self": the tutor editing their own profile. "admin": an admin editing another tutor's profile. */
  mode: "self" | "admin";
  /** Required when mode === "admin" — the target tutor's uid. */
  tutorUid?: string;
  /** admin mode only: called after a successful save, e.g. so the parent page can refresh a header display. */
  onSaved?: (identity: { name: string; email: string }) => void;
};

export default function TutorProfileForm({ mode, tutorUid, onSaved }: TutorProfileFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Read-only for a tutor editing their own profile — email is the
  // authenticated Auth login email (no in-app flow changes it). In admin
  // mode, name becomes editable (admin corrects it); email stays read-only
  // everywhere — there is still no in-app email-change workflow.
  const [identity, setIdentity] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const token = await u.getIdToken(true);
        const url = mode === "admin" && tutorUid
          ? `/api/tutors/profile?uid=${encodeURIComponent(tutorUid)}`
          : "/api/tutors/profile";
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            profile: Record<string, unknown> | null;
            identity?: { name: string; email: string };
          };
          if (data.profile) {
            setForm(profileToForm(data.profile));
            setProfileStatus(String(data.profile.profileStatus ?? "draft"));
          }
          if (data.identity) {
            setIdentity(data.identity);
            setNameInput(data.identity.name ?? "");
          }
        }
      } catch {
        // silently ignore — empty form is fine
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, [mode, tutorUid]);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const token = await u.getIdToken(true);

      // Admin-only: display name lives on users/{uid}, not tutors/{uid}, so
      // it's a separate write — but bundled into the same Save action so
      // this reads as one motion, not two.
      if (mode === "admin" && tutorUid) {
        await updateDoc(doc(db, "users", tutorUid), {
          name: nameInput.trim() || null,
          updatedAt: serverTimestamp(),
        });
      }

      // Derive availabilityDays from the slot grid
      const availabilityDays = [...new Set(form.availabilitySlots.map((s) => s.day))];

      const payload: Record<string, unknown> = {
        phone: form.phone,
        bio: form.bio,
        abn: form.abn,
        wwccNumber: form.wwccNumber,
        wwccState: form.wwccState,
        wwccExpiresAt: form.wwccExpiresAt || null,
        driverLicenceNumber: form.driverLicenceNumber || null,
        driverLicenceExpiry: form.driverLicenceExpiry || null,
        modes: form.modes,
        suburb: form.suburb,
        postcode: form.postcode,
        serviceSuburbs: form.serviceSuburbs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        travelNotes: form.travelNotes,
        availabilityDays,
        availabilitySlots: form.availabilitySlots,
        availabilityNote: form.availabilityNote,
        // Drop any incomplete custom/"Other" subject row (blank name or no
        // year selected yet) rather than surfacing a validation error for a
        // row that was added but not finished.
        capabilities: form.capabilities.filter((c) => c.subject.trim().length > 0 && c.years.length > 0),
        supportCapabilities: form.supportCapabilities,
      };

      if (form.desiredHoursPerWeek !== "") payload.desiredHoursPerWeek = Number(form.desiredHoursPerWeek);
      if (form.maxHoursPerWeek !== "") payload.maxHoursPerWeek = Number(form.maxHoursPerWeek);
      if (form.maxActiveStudents !== "") payload.maxActiveStudents = Number(form.maxActiveStudents);
      if (form.maxTravelMinutes !== "") payload.maxTravelMinutes = Number(form.maxTravelMinutes);
      if (form.maxTravelKm !== "") payload.maxTravelKm = Number(form.maxTravelKm);

      if (mode === "admin" && tutorUid) payload.uid = tutorUid;

      const res = await fetch("/api/tutors/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      type SuccessBody = { ok: true; profileStatus: string };
      type ErrorBody = { ok?: false; error: string; details?: string[] };
      const data = (await res.json().catch(() => null)) as SuccessBody | ErrorBody | null;

      if (!res.ok || !data || !("ok" in data) || data.ok !== true) {
        const errData = data as ErrorBody | null;
        const msg = errData?.error ?? "Save failed.";
        const details = errData?.details?.join("; ") ?? "";
        setMessage({ type: "error", text: details ? `${msg} ${details}` : msg });
        return;
      }

      setProfileStatus((data as SuccessBody).profileStatus);
      const nextIdentity = { name: nameInput.trim(), email: identity.email };
      setIdentity(nextIdentity);
      setMessage({ type: "success", text: "Profile saved." });
      onSaved?.(nextIdentity);
    } catch (err) {
      console.error("[TutorProfileForm save]", err);
      setMessage({ type: "error", text: "Save failed. Check console." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const statusStyle = profileStatus
    ? (STATUS_STYLES[profileStatus] ?? STATUS_STYLES.draft)
    : null;

  return (
    <div className="mt-6 space-y-5">

      {/* 1. Page header */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            {mode === "admin" ? "Admin · Full Profile Editor" : "Tutor Portal"}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
            {mode === "admin" ? "Edit Tutor Profile" : "My Profile"}
          </h1>
        </div>
        {profileStatus && statusStyle && (
          <span
            className="ml-auto rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              background: statusStyle.bg,
              color: statusStyle.text,
              border: `1px solid ${statusStyle.border}`,
            }}
          >
            {STATUS_LABELS[profileStatus] ?? profileStatus}
          </span>
        )}
      </div>

      {/* 2. Your details */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Your details</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Name{mode === "admin" ? "" : ""}</label>
            {mode === "admin" ? (
              <input
                className={INPUT}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Tutor's full name"
              />
            ) : (
              <div className={`${INPUT} bg-slate-50 text-slate-500`} title="Contact Studyroom to correct your display name">
                {identity.name || "Not set — contact Studyroom to add your name"}
              </div>
            )}
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <div
              className={`${INPUT} bg-slate-50 text-slate-500`}
              title="This is the tutor's authenticated login email — read-only until a real email-change workflow exists"
            >
              {identity.email || "—"}
            </div>
          </div>
          <div>
            <label className={LABEL}>Phone *</label>
            <input
              className={INPUT}
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+61 4xx xxx xxx"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={LABEL}>Bio</label>
          <textarea
            className={`${INPUT} min-h-[90px] resize-y`}
            value={form.bio}
            onChange={(e) => setField("bio", e.target.value)}
            placeholder="Brief professional bio shown to families…"
          />
        </div>
      </section>

      {/* 3. Teaching setup */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Teaching setup</p>
        <p className="mb-5 text-xs text-slate-400">
          This helps admin understand how many students and hours the tutor can realistically take on.
        </p>
        <div>
          <label className={LABEL}>Teaching modes *</label>
          <div className="mt-1 flex flex-wrap gap-3">
            {TUTOR_MODES.map((mode_) => (
              <label
                key={mode_}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:border-[#456071]"
              >
                <input
                  type="checkbox"
                  checked={form.modes.includes(mode_)}
                  onChange={() => setField("modes", toggle(form.modes, mode_))}
                  className="accent-[#456071]"
                />
                {mode_ === "in_home" ? "In-home" : mode_ === "online" ? "Online" : "Group"}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className={LABEL}>Desired hours/week</label>
            <input
              type="number"
              min="0"
              className={INPUT}
              value={form.desiredHoursPerWeek}
              onChange={(e) => setField("desiredHoursPerWeek", e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className={LABEL}>Max hours/week</label>
            <input
              type="number"
              min="0"
              className={INPUT}
              value={form.maxHoursPerWeek}
              onChange={(e) => setField("maxHoursPerWeek", e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label className={LABEL}>Max active students</label>
            <input
              type="number"
              min="0"
              className={INPUT}
              value={form.maxActiveStudents}
              onChange={(e) => setField("maxActiveStudents", e.target.value)}
              placeholder="e.g. 8"
            />
          </div>
        </div>
      </section>

      {/* 4. Location & travel */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Location &amp; travel</p>
        <p className="mb-5 text-xs text-slate-400">
          This helps admin match the tutor with nearby in-home students.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Suburb</label>
            <input
              className={INPUT}
              value={form.suburb}
              onChange={(e) => setField("suburb", e.target.value)}
              placeholder="e.g. Paddington"
            />
          </div>
          <div>
            <label className={LABEL}>Postcode</label>
            <input
              className={INPUT}
              value={form.postcode}
              onChange={(e) => setField("postcode", e.target.value)}
              placeholder="e.g. 4064"
            />
          </div>
          <div>
            <label className={LABEL}>Max travel time (minutes)</label>
            <input
              type="number"
              min="0"
              className={INPUT}
              value={form.maxTravelMinutes}
              onChange={(e) => setField("maxTravelMinutes", e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <div>
            <label className={LABEL}>Max travel distance (km)</label>
            <input
              type="number"
              min="0"
              className={INPUT}
              value={form.maxTravelKm}
              onChange={(e) => setField("maxTravelKm", e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={LABEL}>Service suburbs (optional, comma-separated)</label>
          <input
            className={INPUT}
            value={form.serviceSuburbs}
            onChange={(e) => setField("serviceSuburbs", e.target.value)}
            placeholder="e.g. Paddington, Toowong, Auchenflower"
          />
        </div>
        <div className="mt-4">
          <label className={LABEL}>Travel notes (optional)</label>
          <textarea
            className={`${INPUT} resize-y`}
            value={form.travelNotes}
            onChange={(e) => setField("travelNotes", e.target.value)}
            placeholder="Any notes about travel distance or availability in specific areas…"
          />
        </div>
      </section>

      {/* 5. Availability */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Availability *</p>
        <p className="mb-4 text-xs text-slate-400">
          Tick the time slots when the tutor is generally available to take sessions.
        </p>
        <AvailabilityGrid
          slots={form.availabilitySlots}
          onChange={(slots) => setField("availabilitySlots", slots)}
        />
        <div className="mt-4">
          <label className={LABEL}>Availability note (optional)</label>
          <textarea
            className={`${INPUT} resize-y`}
            value={form.availabilityNote}
            onChange={(e) => setField("availabilityNote", e.target.value)}
            placeholder="e.g. After 4 pm on school days, flexible on weekends…"
          />
        </div>
      </section>

      {/* 6. Subjects tutorable */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Subjects *</p>
        <p className="mb-5 text-xs text-slate-400">
          Subjects and year levels the tutor is comfortable tutoring, including any custom/Other subject.
        </p>
        <CapabilitiesSection
          kindFilter="academic"
          capabilities={form.capabilities}
          supportCapabilities={form.supportCapabilities}
          onCapabilitiesChange={(caps) => setField("capabilities", caps)}
          onSupportCapabilitiesChange={(caps) => setField("supportCapabilities", caps)}
        />
      </section>

      {/* 7. Learning support experience */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Learning support experience *</p>
        <p className="mb-5 text-xs text-slate-400">
          Areas of experience or training supporting students.
        </p>
        <CapabilitiesSection
          kindFilter="support"
          capabilities={form.capabilities}
          supportCapabilities={form.supportCapabilities}
          onCapabilitiesChange={(caps) => setField("capabilities", caps)}
          onSupportCapabilitiesChange={(caps) => setField("supportCapabilities", caps)}
        />
      </section>

      {/* 8. Compliance — private, admin/tutor-only (see route/rules); never
          shown to parents/students/public tutor cards/other tutors. */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Compliance</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>ABN *</label>
            <input
              className={INPUT}
              value={form.abn}
              onChange={(e) => setField("abn", e.target.value)}
              placeholder="xx xxx xxx xxx"
            />
          </div>
          <div>
            <label className={LABEL}>WWCC / Blue Card Number *</label>
            <input
              className={INPUT}
              value={form.wwccNumber}
              onChange={(e) => setField("wwccNumber", e.target.value)}
              placeholder="WWCC/Blue Card number"
            />
          </div>
          <div>
            <label className={LABEL}>WWCC State *</label>
            <input
              className={INPUT}
              value={form.wwccState}
              onChange={(e) => setField("wwccState", e.target.value)}
              placeholder="QLD"
            />
          </div>
          <div>
            <label className={LABEL}>WWCC / Blue Card Expiry *</label>
            <input
              type="date"
              title="WWCC / Blue Card expiry date"
              className={INPUT}
              value={form.wwccExpiresAt}
              onChange={(e) => setField("wwccExpiresAt", e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Driver Licence Number (optional)</label>
            <input
              className={INPUT}
              value={form.driverLicenceNumber}
              onChange={(e) => setField("driverLicenceNumber", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className={LABEL}>Driver Licence Expiry (optional)</label>
            <input
              type="date"
              title="Driver licence expiry date"
              className={INPUT}
              value={form.driverLicenceExpiry}
              onChange={(e) => setField("driverLicenceExpiry", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pb-8">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl bg-[#456071] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#2c4b4c] disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "admin" ? "Save Changes" : "Save Profile"}
        </button>
        {message && (
          <p
            className={`text-sm font-medium ${
              message.type === "success" ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
