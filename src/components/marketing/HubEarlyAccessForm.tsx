"use client";

import { useState } from "react";
import { getAttribution } from "@/lib/useAttribution";
import HoneypotField from "@/components/HoneypotField";
import { YEAR_LEVELS } from "@/lib/studyroom/enrolmentFields";

type Status = { type: "idle" } | { type: "submitting" } | { type: "success" } | { type: "error"; message: string };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none";
const labelCls = "space-y-2 text-sm font-semibold text-slate-800";

export default function HubEarlyAccessForm() {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [honeypot, setHoneypot] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    studentYearLevel: "",
    biggestStudyChallenge: "",
    guardianAcknowledgement: false,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email.includes("@") &&
    !!form.studentYearLevel &&
    form.guardianAcknowledgement;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setStatus({ type: "error", message: "Please complete the required fields and confirm the acknowledgement." });
      return;
    }
    setStatus({ type: "submitting" });
    try {
      const res = await fetch("/api/hub/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          studentYearLevel: form.studentYearLevel,
          biggestStudyChallenge: form.biggestStudyChallenge,
          guardianAcknowledgement: form.guardianAcknowledgement,
          companyWebsite: honeypot,
          ...getAttribution(),
        }),
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
        <h3 className="text-xl font-bold text-[color:var(--ink)]">Thanks — you&apos;re on the list</h3>
        <p className="mt-3 text-sm text-slate-700">
          We&apos;ll be in touch as standalone Hub access opens up. This doesn&apos;t create an account or give
          access yet — it just lets us know there&apos;s interest.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
      <HoneypotField value={honeypot} onChange={setHoneypot} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          <span>Your name *</span>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputCls} placeholder="Jane Smith" />
        </label>
        <label className={labelCls}>
          <span>Email *</span>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputCls} placeholder="you@example.com" />
        </label>
      </div>
      <label className={labelCls}>
        <span>Student year level *</span>
        <select value={form.studentYearLevel} onChange={(e) => update("studentYearLevel", e.target.value)} required className={inputCls}>
          <option value="">Select year level</option>
          {YEAR_LEVELS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        <span>What&apos;s the biggest study challenge right now? (optional)</span>
        <textarea
          value={form.biggestStudyChallenge}
          onChange={(e) => update("biggestStudyChallenge", e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="e.g. staying on top of assessments, keeping focused, feeling organised"
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.guardianAcknowledgement}
          onChange={(e) => update("guardianAcknowledgement", e.target.checked)}
          required
          className="mt-1 h-4 w-4 flex-shrink-0"
        />
        <span>
          I am 18 or older, or my parent/guardian knows I am submitting this early-access form and has given me
          permission.
        </span>
      </label>

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
          {status.type === "submitting" ? "Submitting…" : "Join Hub early access"}
        </button>
        <p className="mt-3 text-xs text-slate-500">
          This registers interest only — it doesn&apos;t create an account, enrol a student, or activate Hub
          access.
        </p>
      </div>
    </form>
  );
}
