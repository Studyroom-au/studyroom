// src/app/legal/privacy/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Privacy Policy
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              How Studyroom collects, stores, and uses your information.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
          >
            Back to Profile
          </button>
        </header>

        <div className="space-y-4 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)] shadow-sm">
          <p>
            Studyroom cares deeply about student wellbeing and privacy. This page explains,
            in simple language, what information we collect and how we use it.
          </p>
          <p>
            We may collect basic details such as your name, email address, account type
            (student, parent, tutor), and optional parent or caregiver contact information.
            We also store information related to your use of the app, such as tasks,
            Pomodoro sessions, and mood check-ins.
          </p>
          <p>
            This information is used only to support learning, communication between tutors
            and families, and to help keep students safe while using the platform.
          </p>
          <p>
            Studyroom does not sell your data. We only share information when it is required
            for safety, legal reasons, or when a parent or guardian has requested it.
          </p>
          <p>
            If you have questions about how your information is used, you can contact
            Studyroom and we will do our best to respond clearly and quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
