// src/app/hub/admin/leads/new/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SOURCE_OPTIONS = [
  "Facebook Messenger",
  "Community Page",
  "Referral",
  "Phone Call",
  "Email",
  "Other",
] as const;

type SourceOption = (typeof SOURCE_OPTIONS)[number];

export default function NewLeadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [subjectsRaw, setSubjectsRaw] = useState("");
  const [sourceDetail, setSourceDetail] = useState<SourceOption>("Facebook Messenger");
  const [mode, setMode] = useState<"online" | "in-home" | "">("");
  const [suburb, setSuburb] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentName.trim() || !parentEmail.trim() || !studentName.trim()) {
      setError("Parent name, email, and student name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const subjects = subjectsRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      await addDoc(collection(db, "leads"), {
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim().toLowerCase(),
        parentPhone: parentPhone.trim() || null,
        studentName: studentName.trim(),
        yearLevel: yearLevel.trim(),
        subjects,
        mode: mode || null,
        suburb: suburb.trim() || null,
        goals: notes.trim() || null,
        status: "new",
        source: "manual",
        sourceDetail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/hub/admin/leads");
    } catch (e) {
      console.error(e);
      setError("Failed to save. Check console.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin · Leads
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">New lead</h1>
            <p className="text-sm text-[color:var(--muted)]">Manually create a lead in the system.</p>
          </div>
          <Link
            href="/hub/admin/leads"
            className="self-start rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to leads
          </Link>
        </header>

        <form onSubmit={handleSubmit}>
          <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Parent */}
              <div className="sm:col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Parent
                </p>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Parent name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Parent email <span className="text-red-500">*</span>
                </span>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Parent phone</span>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="04XX XXX XXX"
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              {/* Student */}
              <div className="sm:col-span-2 mt-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Student
                </p>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Student name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Alex"
                  required
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Year level</span>
                <input
                  type="text"
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  placeholder="Year 10"
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Subjects (comma or line-separated)
                </span>
                <textarea
                  value={subjectsRaw}
                  onChange={(e) => setSubjectsRaw(e.target.value)}
                  rows={2}
                  placeholder="Maths, English, Science"
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              {/* Learning details */}
              <div className="sm:col-span-2 mt-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Learning
                </p>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Mode</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "online" | "in-home" | "")}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                >
                  <option value="">Not specified</option>
                  <option value="online">Online</option>
                  <option value="in-home">In-home</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Suburb</span>
                <input
                  type="text"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="Northbridge"
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>

              {/* Source */}
              <div className="sm:col-span-2 mt-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Source
                </p>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[color:var(--muted)]">How did they find us?</span>
                <select
                  value={sourceDetail}
                  onChange={(e) => setSourceDetail(e.target.value as SourceOption)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              {/* Notes */}
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Notes / goals</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What is the student hoping to achieve? Any additional context…"
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className={"brand-cta rounded-xl px-6 py-2 text-sm font-semibold shadow-sm " + (saving ? "opacity-60 cursor-not-allowed" : "")}
              >
                {saving ? "Saving…" : "Create lead"}
              </button>
              <Link
                href="/hub/admin/leads"
                className="rounded-xl border border-[color:var(--ring)] bg-white px-5 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
              >
                Cancel
              </Link>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
