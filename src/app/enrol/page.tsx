// src/app/enrol/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PackagePlan = "CASUAL" | "PACKAGE_5" | "PACKAGE_12";

type FormState = {
  parentName: string;
  parentEmail: string;
  parentPhone: string;

  studentName: string;
  yearLevel: string;
  school: string;

  subjects: string[];

  mode: "online" | "in-home";

  suburb: string;
  addressLine1: string;
  postcode: string;

  availabilityBlocks: string[];

  goals: string;
  challenges: string;

  package: PackagePlan;

  consent: boolean;
};

const SUBJECT_OPTIONS = [
  "Maths",
  "English",
  "Science",
  "Humanities",
  "Study skills",
  "Organisation",
  "Reading",
  "Spelling",
  "Writing",
];

const YEAR_LEVELS = [
  "Prep",
  "Year 1",
  "Year 2",
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
];

const PACKAGE_OPTIONS: Array<{ value: PackagePlan; label: string; desc: string }> = [
  { value: "CASUAL", label: "Casual sessions", desc: "Pay per session. Flexible scheduling." },
  { value: "PACKAGE_5", label: "5-session package", desc: "Great for short catch-up blocks." },
  { value: "PACKAGE_12", label: "12-session package", desc: "Best value for consistent progress." },
];

// Availability grid
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SLOTS = [
  "Before school (6am - 8am)",
  "Morning (8am - 10am)",
  "Midday (10am - 1pm)",
  "Early afternoon (1pm - 3pm)",
  "After school (3pm - 5pm)",
  "Evening (5pm - 7pm)",
  "Late Evening (After 7pm)",
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function makeBlock(day: string, slot: string) {
  return `${day}|${slot}`;
}

export default function EnrolPage() {
  const [form, setForm] = useState<FormState>({
    parentName: "",
    parentEmail: "",
    parentPhone: "",
    studentName: "",
    yearLevel: "",
    school: "",
    subjects: [],
    mode: "in-home",
    suburb: "",
    addressLine1: "",
    postcode: "",
    availabilityBlocks: [],
    goals: "",
    challenges: "",
    package: "CASUAL",
    consent: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "success"; message: string }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const canSubmit = useMemo(() => {
    const baseOk =
      form.parentName.trim().length >= 2 &&
      form.parentEmail.includes("@") &&
      form.parentPhone.trim().length >= 8 &&
      form.studentName.trim().length >= 2 &&
      form.yearLevel.trim().length > 0 &&
      form.subjects.length > 0 &&
      form.availabilityBlocks.length > 0 &&
      form.consent;

    const locationOk = form.mode === "online" ? true : form.suburb.trim().length >= 2;
    return baseOk && locationOk;
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSubject(item: string) {
    setForm((prev) => {
      const exists = prev.subjects.includes(item);
      return { ...prev, subjects: exists ? prev.subjects.filter((x) => x !== item) : [...prev.subjects, item] };
    });
  }

  function toggleAvailability(day: string, slot: string) {
    const key = makeBlock(day, slot);
    setForm((prev) => {
      const exists = prev.availabilityBlocks.includes(key);
      return {
        ...prev,
        availabilityBlocks: exists
          ? prev.availabilityBlocks.filter((x) => x !== key)
          : [...prev.availabilityBlocks, key],
      };
    });
  }

  function clearAvailability() {
    setForm((prev) => ({ ...prev, availabilityBlocks: [] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "idle" });

    if (!canSubmit) {
      setStatus({
        type: "error",
        message:
          "Please complete the required fields (including at least 1 subject + 1 availability selection) and tick consent.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/enrol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,

          studentName: form.studentName,
          yearLevel: form.yearLevel,
          school: form.school || undefined,

          subjects: form.subjects,

          mode: form.mode,

          suburb: form.suburb || undefined,
          addressLine1: form.addressLine1 || undefined,
          postcode: form.postcode || undefined,

          availabilityBlocks: form.availabilityBlocks,

          goals: form.goals || undefined,
          challenges: form.challenges || undefined,

          package: form.package,

          consent: form.consent,
          source: "direct-enrol",
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true; leadId: string }
        | { ok: false; error: string }
        | null;

      if (!res.ok || !data || data.ok !== true) {
        const msg = data && "error" in data ? data.error : "Something went wrong. Please try again.";
        setStatus({ type: "error", message: msg });
        return;
      }

      setStatus({
        type: "success",
        message: "Thanks — we’ve received your enrolment. We’ll get back to you within 1–3 business days.",
      });

      setForm((prev) => ({
        ...prev,
        parentName: "",
        parentEmail: "",
        parentPhone: "",
        studentName: "",
        yearLevel: "",
        school: "",
        subjects: [],
        suburb: "",
        addressLine1: "",
        postcode: "",
        availabilityBlocks: [],
        goals: "",
        challenges: "",
        package: "CASUAL",
        consent: false,
      }));
    } catch {
      setStatus({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Studyroom Australia · Enrolment
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Enrol for tutoring</h1>
          <p className="text-sm text-[color:var(--muted)]">
            This helps us match your child with the right tutor and plan a calm, clear next step.
            If you prefer a general enquiry, use the{" "}
            <Link className="font-semibold text-[color:var(--brand)] hover:underline" href="/contact">
              contact page
            </Link>
            .
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm space-y-8"
        >
          {/* Parent */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Parent / Guardian</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Full name *</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.parentName}
                  onChange={(e) => update("parentName", e.target.value)}
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Email *</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.parentEmail}
                  onChange={(e) => update("parentEmail", e.target.value)}
                  type="email"
                  required
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Phone *</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.parentPhone}
                  onChange={(e) => update("parentPhone", e.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          {/* Student */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Student</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Student name *</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.studentName}
                  onChange={(e) => update("studentName", e.target.value)}
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Year level *</span>
                <select
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.yearLevel}
                  onChange={(e) => update("yearLevel", e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">School (optional)</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.school}
                  onChange={(e) => update("school", e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Subjects */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Subjects *</h2>
            <p className="text-sm text-[color:var(--muted)]">Select at least one.</p>

            <div className="flex flex-wrap gap-2">
              {SUBJECT_OPTIONS.map((s) => {
                const selected = form.subjects.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleSubject(s)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                      selected
                        ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)] ring-[color:var(--brand)]"
                        : "bg-white text-[color:var(--brand)] ring-[color:var(--ring)] hover:bg-[#d6e5e3]/40"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Package */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Package *</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {PACKAGE_OPTIONS.map((p) => {
                const selected = form.package === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update("package", p.value)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-[color:var(--brand)] bg-white shadow-sm"
                        : "border-[color:var(--ring)] bg-white/70 hover:bg-white"
                    )}
                  >
                    <div className="text-sm font-semibold text-[color:var(--ink)]">{p.label}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mode + Location */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Session type</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Mode *</span>
                <select
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.mode}
                  onChange={(e) => update("mode", e.target.value as FormState["mode"])}
                >
                  <option value="in-home">In-home tutoring</option>
                  <option value="online">Online tutoring</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Suburb {form.mode === "in-home" ? "*" : "(optional)"}
                </span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.suburb}
                  onChange={(e) => update("suburb", e.target.value)}
                  required={form.mode === "in-home"}
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Address line (optional — helps in-home planning)
                </span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.addressLine1}
                  onChange={(e) => update("addressLine1", e.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Postcode (optional)</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={form.postcode}
                  onChange={(e) => update("postcode", e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Availability grid */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">Availability *</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Select all times that could work. (Mon–Sun columns, time rows)
                </p>
              </div>

              <button
                type="button"
                onClick={clearAvailability}
                className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
              >
                Clear
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl ring-1 ring-[color:var(--ring)] bg-white/70">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <tr>
                    <th className="px-3 py-3">Time</th>
                    {DAYS.map((d) => (
                      <th key={d} className="px-3 py-3 text-center">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SLOTS.map((slot) => (
                    <tr key={slot} className="border-t border-[color:var(--ring)]">
                      <td className="px-3 py-3 font-semibold text-[color:var(--ink)] whitespace-nowrap">
                        {slot}
                      </td>

                      {DAYS.map((day) => {
                        const key = makeBlock(day, slot);
                        const selected = form.availabilityBlocks.includes(key);

                        return (
                          <td key={day} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleAvailability(day, slot)}
                              className={cn(
                                "h-10 w-10 rounded-xl ring-1 transition",
                                selected
                                  ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)] ring-[color:var(--brand)]"
                                  : "bg-white text-[color:var(--brand)] ring-[color:var(--ring)] hover:bg-[#d6e5e3]/40"
                              )}
                              aria-pressed={selected}
                              aria-label={`${day} ${slot}`}
                              title={`${day} ${slot}`}
                            >
                              {selected ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[color:var(--muted)]">
              Selected: <span className="font-mono">{form.availabilityBlocks.length}</span>
            </p>
          </section>

          {/* Context */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Learning context</h2>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Goals (optional)</span>
              <textarea
                className="min-h-[90px] w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                value={form.goals}
                onChange={(e) => update("goals", e.target.value)}
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Challenges (optional)</span>
              <textarea
                className="min-h-[90px] w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                value={form.challenges}
                onChange={(e) => update("challenges", e.target.value)}
              />
            </label>
          </section>

          {/* Consent + Submit */}
          <section className="space-y-3">
            <label className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-[color:var(--ring)]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={form.consent}
                onChange={(e) => update("consent", e.target.checked)}
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[color:var(--ink)]">Consent *</p>
                <p className="text-xs text-[color:var(--muted)]">
                  I consent to Studyroom collecting and using this information to match a tutor, contact me,
                  and plan tutoring support.
                </p>
              </div>
            </label>

            {status.type === "error" && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {status.message}
              </div>
            )}
            {status.type === "success" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className={cn(
                "w-full rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition",
                !canSubmit || submitting
                  ? "cursor-not-allowed bg-[color:var(--ring)] text-[color:var(--muted)]"
                  : "brand-cta"
              )}
            >
              {submitting ? "Submitting…" : "Submit enrolment"}
            </button>

            <p className="text-xs text-[color:var(--muted)]">
              If you don&apos;t hear back within 3 business days, please check spam or reach out via{" "}
              <Link className="font-semibold text-[color:var(--brand)] hover:underline" href="/contact">
                contact
              </Link>
              .
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}
