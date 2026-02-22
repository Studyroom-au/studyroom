"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Status =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "success" }
  | { type: "error"; message: string };

export default function ContactPage() {
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const [form, setForm] = useState({
    parentName: "",
    email: "",
    phone: "",
    childName: "",
    yearLevel: "",
    school: "",
    serviceType: "Tutoring",
    message: "",
  });

  const enrolUrl = "https://studyroom.au/enrol";

  const canSubmit = useMemo(() => {
    return (
      form.parentName.trim().length >= 2 &&
      form.email.includes("@") &&
      form.phone.trim().length >= 8 &&
      form.childName.trim().length >= 2 &&
      form.yearLevel.trim().length >= 1
    );
  }, [form]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "idle" });

    if (!canSubmit) {
      setStatus({
        type: "error",
        message:
          "Please complete the required fields (name, email, phone, child’s name, year level).",
      });
      return;
    }

    setStatus({ type: "submitting" });

    try {
      const composedMessage = [
        `Service type: ${form.serviceType}`,
        `Phone: ${form.phone}`,
        `Child: ${form.childName}`,
        `Year level: ${form.yearLevel}`,
        form.school ? `School: ${form.school}` : null,
        "",
        "Message:",
        form.message?.trim() ? form.message.trim() : "(No extra message provided)",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // api expects: name, email, message
        body: JSON.stringify({
          name: form.parentName,
          email: form.email,
          message: composedMessage,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string }
        | null;

      if (!res.ok || !data || (data as any).ok !== true) {
        const msg =
          data && "error" in data
            ? data.error
            : "Something went wrong. Please try again.";
        setStatus({ type: "error", message: msg });
        return;
      }

      setStatus({ type: "success" });

      // reset form
      setForm({
        parentName: "",
        email: "",
        phone: "",
        childName: "",
        yearLevel: "",
        school: "",
        serviceType: "Tutoring",
        message: "",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  }

  return (
    <div className="px-4 pb-16 pt-12 md:px-6 md:pt-16">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* HEADER */}
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-slate-200">
            Contact
          </div>
          <h1 className="text-4xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            Tell us about your child's goals.
          </h1>
          <p className="text-lg text-slate-700 md:max-w-3xl">
            We'll recommend the right tutor or learning plan to help them feel organised, capable and confident moving forward.
          </p>

          <div className="rounded-2xl bg-[#f3f7f6] p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-700">
              To speed things up, you can also complete our enrolment form here:{" "}
              <a
                href={enrolUrl}
                className="font-semibold text-[color:var(--brand)] hover:underline"
              >
                studyroom.au/enrol
              </a>
              .
            </p>
          </div>
        </div>

        {/* SUCCESS STATE */}
        {status.type === "success" ? (
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">
              Thanks — we got your message 🌿
            </h2>
            <p className="mt-3 text-slate-700 md:max-w-2xl">
              We’ll review your enquiry and respond within <strong>1–3 business days</strong>.
              To help us match your child with the right tutor faster, please complete our enrolment form:
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={enrolUrl}
                className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
              >
                Complete enrolment form
              </a>
              <button
                type="button"
                onClick={() => setStatus({ type: "idle" })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
              >
                Send another message
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              If you don’t hear back within 3 business days, please check your spam folder or email{" "}
              <a
                href="mailto:contactstudyroomaustralia@gmail.com"
                className="font-semibold text-[color:var(--brand)]"
              >
                contactstudyroomaustralia@gmail.com
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="grid gap-6 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200"
            >
              {/* CONTACT DETAILS */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>Parent name *</span>
                  <input
                    value={form.parentName}
                    onChange={(e) => update("parentName", e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="Jane Smith"
                  />
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>Phone *</span>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="04xx xxx xxx"
                  />
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>Child’s name *</span>
                  <input
                    value={form.childName}
                    onChange={(e) => update("childName", e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="Alex"
                  />
                </label>
              </div>

              {/* SCHOOL INFO */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>Year level *</span>
                  <input
                    value={form.yearLevel}
                    onChange={(e) => update("yearLevel", e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="Year 5"
                  />
                </label>

                <label className="space-y-2 text-sm font-semibold text-slate-800">
                  <span>School (optional)</span>
                  <input
                    value={form.school}
                    onChange={(e) => update("school", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                    placeholder="School name"
                  />
                </label>
              </div>

              {/* SERVICE TYPE */}
              <label className="space-y-2 text-sm font-semibold text-slate-800">
                <span>Service type</span>
                <select
                  value={form.serviceType}
                  onChange={(e) => update("serviceType", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-[color:var(--brand)] focus:outline-none"
                >
                  <option value="Tutoring">Tutoring</option>
                  <option value="Workshops">Workshops</option>
                  <option value="Worksheets">Worksheets</option>
                  <option value="Not sure">Not sure</option>
                </select>
              </label>

              {/* MESSAGE */}
              <label className="space-y-2 text-sm font-semibold text-slate-800">
                <span>Message (optional)</span>
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                  placeholder="Tell us about goals, learning style, or concerns."
                />
              </label>

              {/* STATUS */}
              {status.type === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {status.message}
                </div>
              )}

              {/* SUBMIT */}
              <div className="flex justify-start gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit || status.type === "submitting"}
                  className={`brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm ${
                    !canSubmit || status.type === "submitting"
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {status.type === "submitting" ? "Submitting..." : "Submit"}
                </button>

                <Link
                  href="/enrol"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
                >
                  Go to enrolment
                </Link>
              </div>
            </form>

            {/* OPTIONAL: Plain email note */}
            <p className="text-xs text-slate-500">
              Prefer email? You can also reach us at{" "}
              <a
                href="mailto:contactstudyroomaustralia@gmail.com"
                className="font-semibold text-[color:var(--brand)]"
              >
                contactstudyroomaustralia@gmail.com
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
