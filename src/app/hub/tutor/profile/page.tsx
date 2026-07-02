"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  YEAR_LEVELS_ACIQ,
  YEAR_LEVELS_QCAA,
  SUPPORT_CAPABILITIES,
  TUTOR_MODES,
  AVAILABILITY_DAYS,
  AVAILABILITY_BLOCKS,
} from "@/lib/studyroom/tutorConstants";
import type { TutorCapability, TutorSupportCapability, AvailabilitySlot } from "@/types/tutor";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getIdTokenOrThrow(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in.");
  return await u.getIdToken(true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(val: unknown): string {
  if (!val || typeof val !== "string") return "";
  try {
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

// ─── Capability group definitions ────────────────────────────────────────────
//
// kind "academic" → saved into capabilities[] with chosen years + readiness.
// kind "support"  → saved into supportCapabilities[] with readiness only.
// QCAA subjects auto-include Year 11 + Year 12 when the tutor checks them;
// tutors can still deselect individual years afterwards.

type AcademicItem = {
  kind: "academic";
  label: string;
  subject: string;
  validYears: readonly string[];
};
type SupportItem = { kind: "support"; label: string; type: string };
type CapabilityItem = AcademicItem | SupportItem;

const CAPABILITY_GROUPS: { group: string; items: CapabilityItem[] }[] = [
  {
    group: "English & Literacy",
    items: [
      { kind: "academic", label: "English (Prep–Year 10)", subject: "English", validYears: YEAR_LEVELS_ACIQ },
      { kind: "academic", label: "Essential English (Yr 11–12)", subject: "Essential English", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Literature (Yr 11–12)", subject: "Literature", validYears: YEAR_LEVELS_QCAA },
      { kind: "support", label: "Early Literacy", type: "Early Literacy" },
    ],
  },
  {
    group: "Mathematics & Numeracy",
    items: [
      { kind: "academic", label: "Mathematics (Prep–Year 10)", subject: "Mathematics", validYears: YEAR_LEVELS_ACIQ },
      { kind: "academic", label: "General Mathematics (Yr 11–12)", subject: "General Mathematics", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Mathematical Methods (Yr 11–12)", subject: "Mathematical Methods", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Specialist Mathematics (Yr 11–12)", subject: "Specialist Mathematics", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Essential Mathematics (Yr 11–12)", subject: "Essential Mathematics", validYears: YEAR_LEVELS_QCAA },
      { kind: "support", label: "Foundational Numeracy", type: "Foundational Numeracy" },
    ],
  },
  {
    group: "Science & STEM",
    items: [
      { kind: "academic", label: "Science (Prep–Year 10)", subject: "Science", validYears: YEAR_LEVELS_ACIQ },
      { kind: "academic", label: "Biology (Yr 11–12)", subject: "Biology", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Chemistry (Yr 11–12)", subject: "Chemistry", validYears: YEAR_LEVELS_QCAA },
      { kind: "academic", label: "Physics (Yr 11–12)", subject: "Physics", validYears: YEAR_LEVELS_QCAA },
    ],
  },
  {
    group: "Humanities & Social Sciences",
    items: [
      { kind: "academic", label: "HASS (Prep–Year 10)", subject: "HASS", validYears: YEAR_LEVELS_ACIQ },
    ],
  },
  {
    group: "Health & Physical Education",
    items: [
      { kind: "academic", label: "Health & PE (Prep–Year 10)", subject: "Health & PE", validYears: YEAR_LEVELS_ACIQ },
    ],
  },
  {
    group: "General Academic Support",
    items: (SUPPORT_CAPABILITIES as readonly string[])
      .filter((t) => t !== "Early Literacy" && t !== "Foundational Numeracy")
      .map((t) => ({ kind: "support" as const, label: t, type: t })),
  },
];

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  phone: string;
  bio: string;
  abn: string;
  wwccNumber: string;
  wwccState: string;
  wwccExpiresAt: string;
  blueCardNumber: string;
  blueCardExpiresAt: string;
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
  wwccExpiresAt: "", blueCardNumber: "", blueCardExpiresAt: "",
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
    blueCardNumber: String(p.blueCardNumber ?? ""),
    blueCardExpiresAt: toDateInput(p.blueCardExpiresAt),
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  active: "Active",
  paused: "Paused",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  pending_review: { bg: "#fffbeb", text: "#92400e", border: "#fbbf24" },
  active: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  paused: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

// ─── Shared style strings ─────────────────────────────────────────────────────

const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-[#456071] focus:ring-2 focus:ring-[#d6e5e3]";
const LABEL = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1";
const SECTION = "text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4";

// ─── Capabilities section ─────────────────────────────────────────────────────

type CapabilitiesSectionProps = {
  kindFilter: "academic" | "support";
  capabilities: TutorCapability[];
  supportCapabilities: TutorSupportCapability[];
  onCapabilitiesChange: (caps: TutorCapability[]) => void;
  onSupportCapabilitiesChange: (caps: TutorSupportCapability[]) => void;
};

function CapabilitiesSection({
  kindFilter,
  capabilities,
  supportCapabilities,
  onCapabilitiesChange,
  onSupportCapabilitiesChange,
}: CapabilitiesSectionProps) {

  // expandedSubjects: which academic subject cards are open (year picker visible).
  // Initialised from capabilities on mount — happens after loading=false, so
  // capabilities already has the loaded profile data.
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const cap of capabilities) s.add(cap.subject);
    return s;
  });

  // ── Academic year helpers ─────────────────────────────────────────────────

  // A year is "selected" if it appears in any capability entry for this subject,
  // regardless of its stored readiness value. This handles existing with_support
  // data gracefully — it shows as selected; on next save it becomes independent.
  function isYearSelected(subject: string, year: string): boolean {
    return capabilities.some((c) => c.subject === subject && c.years.includes(year));
  }

  // Toggles a single year chip. Adding a year consolidates all selected years
  // for this subject into one independent entry, normalising any legacy
  // with_support entries. Removing a year strips it from all entries.
  function toggleYear(subject: string, year: string) {
    if (isYearSelected(subject, year)) {
      // Remove: drop this year from every entry for this subject
      const updated = capabilities
        .map((c) =>
          c.subject !== subject ? c : { ...c, years: c.years.filter((y) => y !== year) }
        )
        .filter((c) => c.years.length > 0);
      onCapabilitiesChange(updated);
    } else {
      // Add: collect all currently selected years, merge with new year,
      // replace all subject entries with one consolidated independent entry.
      const existingYears = new Set<string>();
      for (const c of capabilities) {
        if (c.subject === subject) c.years.forEach((y) => existingYears.add(y));
      }
      existingYears.add(year);
      const withoutSubject = capabilities.filter((c) => c.subject !== subject);
      onCapabilitiesChange([
        ...withoutSubject,
        { subject, years: [...existingYears], readiness: "independent" },
      ]);
    }
  }

  // Toggles the subject card open/closed, clearing or auto-seeding year selections.
  function toggleAcademicSubject(item: AcademicItem) {
    if (expandedSubjects.has(item.subject)) {
      setExpandedSubjects((prev) => {
        const s = new Set(prev);
        s.delete(item.subject);
        return s;
      });
      onCapabilitiesChange(capabilities.filter((c) => c.subject !== item.subject));
    } else {
      setExpandedSubjects((prev) => new Set([...prev, item.subject]));
      // QCAA subjects have only 2 valid years — auto-select both as independent.
      // ACiQ subjects have 11 years — tutor selects individually.
      if (item.validYears.length <= 2) {
        const filtered = capabilities.filter((c) => c.subject !== item.subject);
        onCapabilitiesChange([
          ...filtered,
          { subject: item.subject, years: [...item.validYears], readiness: "independent" },
        ]);
      }
    }
  }

  // ── Support capability helpers ────────────────────────────────────────────

  function getSupport(type: string): TutorSupportCapability | undefined {
    return supportCapabilities.find((c) => c.type === type);
  }

  function toggleSupport(type: string) {
    const existing = getSupport(type);
    if (existing) {
      onSupportCapabilitiesChange(supportCapabilities.filter((c) => c.type !== type));
    } else {
      onSupportCapabilitiesChange([...supportCapabilities, { type, readiness: "independent" }]);
    }
  }

  // ── Filtered groups ───────────────────────────────────────────────────────

  const filteredGroups = CAPABILITY_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => i.kind === kindFilter) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {filteredGroups.map(({ group, items }) => (
        <div key={group}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#456071]">
            {group}
          </p>
          <div className="space-y-2">
            {items.map((item) => {
              if (item.kind === "academic") {
                const isExpanded = expandedSubjects.has(item.subject);
                const hasAnyYear = capabilities.some(
                  (c) => c.subject === item.subject && c.years.length > 0
                );

                return (
                  <div
                    key={item.subject}
                    className={`rounded-xl border transition-colors ${
                      isExpanded ? "border-[#d6e5e3] bg-white" : "border-slate-100 bg-slate-50/60"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={isExpanded}
                        onChange={() => toggleAcademicSubject(item)}
                        className="h-4 w-4 accent-[#456071]"
                      />
                      <span className="text-sm font-medium text-[color:var(--ink)]">
                        {item.label}
                      </span>
                      {isExpanded && !hasAnyYear && (
                        <span className="ml-auto text-[10px] italic text-slate-400">
                          Select year levels below
                        </span>
                      )}
                    </label>

                    {isExpanded && (
                      <div className="border-t border-slate-100/80 px-4 pb-3 pt-2">
                        <p className="mb-2 text-[10px] text-slate-400">
                          Tick the year levels you are comfortable tutoring.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.validYears.map((yr) => {
                            const selected = isYearSelected(item.subject, yr);
                            return (
                              <button
                                key={yr}
                                type="button"
                                aria-label={`${yr} — ${selected ? "Selected" : "Not selected"}. Click to toggle.`}
                                onClick={() => toggleYear(item.subject, yr)}
                                className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                                  selected
                                    ? "border-[#748398] bg-[#d6e5e3] text-[#2c4b4c]"
                                    : "border-slate-200 bg-white text-slate-400 hover:border-[#748398] hover:text-[#456071]"
                                }`}
                              >
                                {yr}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Support item — simple checkbox, no readiness toggle shown to tutor
              const cap = getSupport(item.type);
              const checked = !!cap;
              return (
                <div
                  key={item.type}
                  className={`rounded-xl border transition-colors ${
                    checked ? "border-[#d6e5e3] bg-white" : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSupport(item.type)}
                      className="h-4 w-4 accent-[#456071]"
                    />
                    <span className="text-sm font-medium text-[color:var(--ink)]">{item.label}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Availability grid ────────────────────────────────────────────────────────

type AvailabilityGridProps = {
  slots: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
};

function AvailabilityGrid({ slots, onChange }: AvailabilityGridProps) {
  function isChecked(day: string, block: string) {
    return slots.some((s) => s.day === day && s.block === block);
  }

  function toggle(day: string, block: string) {
    if (isChecked(day, block)) {
      onChange(slots.filter((s) => !(s.day === day && s.block === block)));
    } else {
      onChange([...slots, { day, block }]);
    }
  }

  const dayAbbr: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
    Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th scope="col" className="w-28 pb-2 text-left font-semibold text-slate-400">Time block</th>
            {AVAILABILITY_DAYS.map((day) => (
              <th
                key={day}
                scope="col"
                className="pb-2 text-center font-bold text-slate-500"
              >
                {dayAbbr[day] ?? day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {AVAILABILITY_BLOCKS.map((block) => (
            <tr key={block} className="group">
              <td className="py-1.5 pr-3 text-[11px] font-medium text-slate-500 group-hover:text-slate-700">
                {block}
              </td>
              {AVAILABILITY_DAYS.map((day) => {
                const checked = isChecked(day, block);
                return (
                  <td key={day} className="py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(day, block)}
                      aria-label={`${day} ${block}`}
                      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                        checked
                          ? "border-[#456071] bg-[#456071] text-white"
                          : "border-slate-200 bg-white text-slate-300 hover:border-[#748398] hover:bg-[#d6e5e3]"
                      }`}
                    >
                      {checked && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
                          <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TutorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const token = await u.getIdToken(true);
        const res = await fetch("/api/tutors/profile", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { profile: Record<string, unknown> | null };
          if (data.profile) {
            setForm(profileToForm(data.profile));
            setProfileStatus(String(data.profile.profileStatus ?? "draft"));
          }
        }
      } catch {
        // silently ignore — empty form is fine
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, []);

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
      const token = await getIdTokenOrThrow();

      // Derive availabilityDays from the slot grid
      const availabilityDays = [...new Set(form.availabilitySlots.map((s) => s.day))];

      const payload: Record<string, unknown> = {
        phone: form.phone,
        bio: form.bio,
        abn: form.abn,
        wwccNumber: form.wwccNumber,
        wwccState: form.wwccState,
        wwccExpiresAt: form.wwccExpiresAt || null,
        blueCardNumber: form.blueCardNumber || null,
        blueCardExpiresAt: form.blueCardExpiresAt || null,
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
        capabilities: form.capabilities,
        supportCapabilities: form.supportCapabilities,
      };

      if (form.desiredHoursPerWeek !== "") payload.desiredHoursPerWeek = Number(form.desiredHoursPerWeek);
      if (form.maxHoursPerWeek !== "") payload.maxHoursPerWeek = Number(form.maxHoursPerWeek);
      if (form.maxActiveStudents !== "") payload.maxActiveStudents = Number(form.maxActiveStudents);
      if (form.maxTravelMinutes !== "") payload.maxTravelMinutes = Number(form.maxTravelMinutes);
      if (form.maxTravelKm !== "") payload.maxTravelKm = Number(form.maxTravelKm);

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
      setMessage({ type: "success", text: "Profile saved." });
    } catch (err) {
      console.error("[tutor/profile save]", err);
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
            Tutor Portal
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
            My Profile
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
          This helps admin understand how many students and hours you can realistically take on.
        </p>
        <div>
          <label className={LABEL}>Teaching modes *</label>
          <div className="mt-1 flex flex-wrap gap-3">
            {TUTOR_MODES.map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:border-[#456071]"
              >
                <input
                  type="checkbox"
                  checked={form.modes.includes(mode)}
                  onChange={() => setField("modes", toggle(form.modes, mode))}
                  className="accent-[#456071]"
                />
                {mode === "in_home" ? "In-home" : mode === "online" ? "Online" : "Group"}
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
          This helps admin match you with nearby in-home students.
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
          Tick the time slots when you are generally available to take sessions.
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

      {/* 6. Subjects you can tutor */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <p className={SECTION}>Subjects you can tutor *</p>
        <p className="mb-5 text-xs text-slate-400">
          Select the subjects and year levels you would be comfortable tutoring.
          Only tick year levels you would be happy for admin to match you with.
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
          Tick any areas where you have experience or training and are comfortable supporting students.
        </p>
        <CapabilitiesSection
          kindFilter="support"
          capabilities={form.capabilities}
          supportCapabilities={form.supportCapabilities}
          onCapabilitiesChange={(caps) => setField("capabilities", caps)}
          onSupportCapabilitiesChange={(caps) => setField("supportCapabilities", caps)}
        />
      </section>

      {/* 8. Compliance */}
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
            <label className={LABEL}>WWCC Number *</label>
            <input
              className={INPUT}
              value={form.wwccNumber}
              onChange={(e) => setField("wwccNumber", e.target.value)}
              placeholder="WWC/Blue Card number"
            />
          </div>
          <div>
            <label className={LABEL}>WWCC State</label>
            <input
              className={INPUT}
              value={form.wwccState}
              onChange={(e) => setField("wwccState", e.target.value)}
              placeholder="QLD"
            />
          </div>
          <div>
            <label className={LABEL}>WWCC Expiry</label>
            <input
              type="date"
              title="WWCC expiry date"
              className={INPUT}
              value={form.wwccExpiresAt}
              onChange={(e) => setField("wwccExpiresAt", e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL}>Blue Card Number (optional)</label>
            <input
              className={INPUT}
              value={form.blueCardNumber}
              onChange={(e) => setField("blueCardNumber", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className={LABEL}>Blue Card Expiry (optional)</label>
            <input
              type="date"
              title="Blue card expiry date"
              className={INPUT}
              value={form.blueCardExpiresAt}
              onChange={(e) => setField("blueCardExpiresAt", e.target.value)}
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
          {saving ? "Saving…" : "Save Profile"}
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
