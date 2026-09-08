"use client";

import { useState } from "react";
import { getAttribution } from "@/lib/useAttribution";
import HoneypotField from "@/components/HoneypotField";
import {
  MODE_OPTIONS,
  BLUE_CARD_STATUS_OPTIONS,
  ABN_STATUS_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
} from "@/lib/studyroom/tutorApplicationFields";

type Status = { type: "idle" } | { type: "submitting" } | { type: "success" } | { type: "error"; message: string };

const RESUME_EMAIL = "contact.studyroomaustralia@gmail.com";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none";
const labelCls = "space-y-2 text-sm font-semibold text-slate-800";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  suburb: "",
  mode: "",
  willingInHome: false,
  hasCar: false,
  licenceStatus: "",
  serviceAreas: "",
  subjects: "",
  yearLevelsComfortable: "",
  background: "",
  experience: "",
  availability: "",
  blueCardStatus: "",
  abnStatus: "",
  whyTutor: "",
  referralSource: "",
};

export default function TutorApplicationForm() {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [honeypot, setHoneypot] = useState("");
  const [form, setForm] = useState(initialForm);

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    form.fullName.trim().length >= 2 &&
    form.email.includes("@") &&
    form.phone.trim().length >= 6 &&
    form.suburb.trim().length >= 2 &&
    !!form.mode &&
    form.subjects.trim().length >= 2 &&
    form.yearLevelsComfortable.trim().length >= 2 &&
    !!form.blueCardStatus &&
    !!form.abnStatus &&
    form.whyTutor.trim().length >= 10;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({ type: "error", message: "Please complete the required fields before submitting." });
      return;
    }
    setStatus({ type: "submitting" });
    try {
      const res = await fetch("/api/tutor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyWebsite: honeypot, ...getAttribution() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setStatus({ type: "error", message: data?.error || "Something went wrong. Please try again." });
        return;
      }
      setStatus({ type: "success" });
    } catch {
      setStatus({ type: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  if (status.type === "success") {
    return (
      <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-xl font-bold text-[color:var(--ink)]">Thanks for applying to tutor with Studyroom</h3>
        <p className="mt-3 text-sm text-slate-700">
          We&apos;ve received your application. Please email your resume to{" "}
          <a href={`mailto:${RESUME_EMAIL}`} className="font-semibold text-[color:var(--brand)]">{RESUME_EMAIL}</a>.
          You&apos;re also welcome to include a short cover letter if you&apos;d like to tell us anything else about
          yourself.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Once we&apos;ve received your resume, we&apos;ll review your application and contact you about next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
      <HoneypotField value={honeypot} onChange={setHoneypot} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Full name *</span>
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required className={inputCls} placeholder="Jane Smith" />
        </label>
        <label className={labelCls}>
          <span>Email *</span>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputCls} placeholder="you@example.com" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Phone *</span>
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} required className={inputCls} placeholder="04xx xxx xxx" />
        </label>
        <label className={labelCls}>
          <span>Suburb / location *</span>
          <input value={form.suburb} onChange={(e) => update("suburb", e.target.value)} required className={inputCls} placeholder="e.g. Logan Central" />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-slate-800">Mode preference *</legend>
        <div className="flex flex-wrap gap-3">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                form.mode === opt.value
                  ? "border-[color:var(--brand)] bg-[#d6e5e3]/60 text-[color:var(--brand)]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="mode" value={opt.value} checked={form.mode === opt.value} onChange={(e) => update("mode", e.target.value)} className="sr-only" />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={form.willingInHome} onChange={(e) => update("willingInHome", e.target.checked)} className="h-4 w-4" />
          Willing to provide in-home tutoring
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={form.hasCar} onChange={(e) => update("hasCar", e.target.checked)} className="h-4 w-4" />
          Reliable access to a car
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Licence status (optional)</span>
          <input value={form.licenceStatus} onChange={(e) => update("licenceStatus", e.target.value)} className={inputCls} placeholder="e.g. Full QLD licence" />
        </label>
        <label className={labelCls}>
          <span>Suburbs you&apos;d realistically travel to (optional)</span>
          <input value={form.serviceAreas} onChange={(e) => update("serviceAreas", e.target.value)} className={inputCls} placeholder="e.g. Logan, Springwood, Browns Plains" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Subjects *</span>
          <input value={form.subjects} onChange={(e) => update("subjects", e.target.value)} required className={inputCls} placeholder="e.g. Maths, English, Science" />
        </label>
        <label className={labelCls}>
          <span>Year levels you&apos;re comfortable tutoring *</span>
          <input value={form.yearLevelsComfortable} onChange={(e) => update("yearLevelsComfortable", e.target.value)} required className={inputCls} placeholder="e.g. Year 3 to Year 10" />
        </label>
      </div>

      <label className={labelCls}>
        <span>Current study, qualifications or background (optional)</span>
        <textarea value={form.background} onChange={(e) => update("background", e.target.value)} rows={2} className={inputCls} placeholder="e.g. Bachelor of Education, currently studying..." />
      </label>

      <label className={labelCls}>
        <span>Tutoring or teaching experience (optional)</span>
        <textarea value={form.experience} onChange={(e) => update("experience", e.target.value)} rows={2} className={inputCls} placeholder="Tell us about relevant experience" />
      </label>

      <label className={labelCls}>
        <span>Availability (optional)</span>
        <input value={form.availability} onChange={(e) => update("availability", e.target.value)} className={inputCls} placeholder="e.g. Weekday afternoons, Saturday mornings" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Blue Card status *</span>
          <select value={form.blueCardStatus} onChange={(e) => update("blueCardStatus", e.target.value)} required className={inputCls}>
            <option value="">Select an option</option>
            {BLUE_CARD_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span>ABN status *</span>
          <select value={form.abnStatus} onChange={(e) => update("abnStatus", e.target.value)} required className={inputCls}>
            <option value="">Select an option</option>
            {ABN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelCls}>
        <span>Why would you like to tutor with Studyroom? *</span>
        <textarea value={form.whyTutor} onChange={(e) => update("whyTutor", e.target.value)} required rows={4} className={inputCls} placeholder="Tell us a bit about yourself and why you're interested" />
      </label>

      <label className={labelCls}>
        <span>How did you hear about us? (optional)</span>
        <select value={form.referralSource} onChange={(e) => update("referralSource", e.target.value)} className={inputCls}>
          <option value="">Select an option</option>
          {REFERRAL_SOURCE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>

      <p className="text-xs text-slate-500">
        No resume upload needed here — after you submit, we&apos;ll ask you to email your resume to{" "}
        {RESUME_EMAIL}. A cover letter is optional.
      </p>

      {status.type === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{status.message}</div>
      )}

      <div>
        <button
          type="submit"
          disabled={!canSubmit || status.type === "submitting"}
          className={`brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm ${
            !canSubmit || status.type === "submitting" ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {status.type === "submitting" ? "Submitting…" : "Apply to tutor with Studyroom"}
        </button>
      </div>
    </form>
  );
}
