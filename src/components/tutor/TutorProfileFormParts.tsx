"use client";

// Shared Tutor Profile V2 form pieces — used by BOTH /hub/tutor/profile (the
// tutor's own editing surface) and the admin full-profile editor on
// /hub/admin/tutors/[tutorId] (final pre-release addition). Extracted here
// specifically so subject/year validation and availability-slot toggling
// exist in exactly one place — admin and tutor editing the same canonical
// Tutor Profile V2 fields through the same logic, never two copies.

import { useState } from "react";
import {
  YEAR_LEVELS_ACIQ,
  YEAR_LEVELS_QCAA,
  ALL_YEAR_LEVELS,
  SUPPORT_CAPABILITIES,
  AVAILABILITY_DAYS,
  AVAILABILITY_BLOCKS,
} from "@/lib/studyroom/tutorConstants";
import type { TutorCapability, TutorSupportCapability, AvailabilitySlot } from "@/types/tutor";

// ─── Shared style strings ─────────────────────────────────────────────────────

export const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-[#456071] focus:ring-2 focus:ring-[#d6e5e3]";
export const LABEL = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1";
export const SECTION = "text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4";

// ─── Capability group definitions ────────────────────────────────────────────
//
// kind "academic" → saved into capabilities[] with chosen years + readiness.
// kind "support"  → saved into supportCapabilities[] with readiness only.
// QCAA subjects auto-include Year 11 + Year 12 when checked; tutors/admin can
// still deselect individual years afterwards.

type AcademicItem = {
  kind: "academic";
  label: string;
  subject: string;
  validYears: readonly string[];
};
type SupportItem = { kind: "support"; label: string; type: string };
type CapabilityItem = AcademicItem | SupportItem;

export const CAPABILITY_GROUPS: { group: string; items: CapabilityItem[] }[] = [
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

// Any capability whose subject isn't one of the fixed items above is a
// tutor-entered custom/"Other" subject (e.g. "Japanese") — not hardcoded to
// any specific name, so a future subject needs no code change here.
export const KNOWN_ACADEMIC_SUBJECTS = new Set(
  CAPABILITY_GROUPS.flatMap((g) => g.items)
    .filter((i): i is AcademicItem => i.kind === "academic")
    .map((i) => i.subject)
);

// ─── Capabilities section ─────────────────────────────────────────────────────

export type CapabilitiesSectionProps = {
  kindFilter: "academic" | "support";
  capabilities: TutorCapability[];
  supportCapabilities: TutorSupportCapability[];
  onCapabilitiesChange: (caps: TutorCapability[]) => void;
  onSupportCapabilitiesChange: (caps: TutorSupportCapability[]) => void;
};

export function CapabilitiesSection({
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

  // ── Custom/"Other" subject helpers (academic only) ────────────────────────
  // Any capability not among the fixed hardcoded subjects — a free-text
  // subject name typed in, e.g. "Japanese".

  function getCustomCapabilities(): TutorCapability[] {
    return capabilities.filter((c) => !KNOWN_ACADEMIC_SUBJECTS.has(c.subject));
  }

  function setCustomCapabilities(next: TutorCapability[]) {
    const known = capabilities.filter((c) => KNOWN_ACADEMIC_SUBJECTS.has(c.subject));
    onCapabilitiesChange([...known, ...next]);
  }

  function addCustomCapability() {
    setCustomCapabilities([...getCustomCapabilities(), { subject: "", years: [], readiness: "independent" }]);
  }

  function updateCustomSubjectName(idx: number, value: string) {
    const custom = [...getCustomCapabilities()];
    custom[idx] = { ...custom[idx], subject: value };
    setCustomCapabilities(custom);
  }

  function toggleCustomYear(idx: number, year: string) {
    const custom = [...getCustomCapabilities()];
    const cap = custom[idx];
    const years = cap.years.includes(year) ? cap.years.filter((y) => y !== year) : [...cap.years, year];
    custom[idx] = { ...cap, years };
    setCustomCapabilities(custom);
  }

  function removeCustomCapability(idx: number) {
    const custom = [...getCustomCapabilities()];
    custom.splice(idx, 1);
    setCustomCapabilities(custom);
  }

  const customCapabilities = kindFilter === "academic" ? getCustomCapabilities() : [];

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
                          Tick the year levels comfortable tutoring.
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

              // Support item — simple checkbox, no readiness toggle shown
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

      {/* Custom/"Other" academic subject — any subject not in the fixed list
          above (e.g. "Japanese"). Not hardcoded to any specific name. */}
      {kindFilter === "academic" && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#456071]">
            Other
          </p>
          <div className="space-y-2">
            {customCapabilities.map((cap, idx) => (
              <div key={idx} className="rounded-xl border border-[#d6e5e3] bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cap.subject}
                    onChange={(e) => updateCustomSubjectName(idx, e.target.value)}
                    placeholder="Subject name (e.g. Japanese)"
                    maxLength={60}
                    aria-label="Custom subject name"
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#456071] focus:ring-2 focus:ring-[#d6e5e3]"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomCapability(idx)}
                    className="shrink-0 text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <p className="mb-2 mt-2 text-[10px] text-slate-400">
                  Tick the year levels comfortable tutoring.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_YEAR_LEVELS.map((yr) => {
                    const selected = cap.years.includes(yr);
                    return (
                      <button
                        key={yr}
                        type="button"
                        aria-label={`${yr} — ${selected ? "Selected" : "Not selected"}. Click to toggle.`}
                        onClick={() => toggleCustomYear(idx, yr)}
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
            ))}
            <button
              type="button"
              onClick={addCustomCapability}
              className="rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#456071] hover:border-[#748398]"
            >
              + Add another subject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Availability grid ────────────────────────────────────────────────────────

export type AvailabilityGridProps = {
  slots: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
};

export function AvailabilityGrid({ slots, onChange }: AvailabilityGridProps) {
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
