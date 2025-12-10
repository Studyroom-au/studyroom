// src/app/legal/terms/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Terms &amp; Conditions
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              A simple overview of how Studyroom is used by students, parents, and tutors.
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
            These Terms &amp; Conditions explain how Studyroom is used by students, parents,
            and tutors. By creating an account or using the Studyroom app, you agree to follow
            these terms.
          </p>
          <p>
            Studyroom is designed as a supportive educational platform. It does not replace
            school, therapy, or professional medical advice.
          </p>
          <p>
            Students and parents are responsible for ensuring that login details are kept
            private and secure. If you believe someone else has access to your account,
            please contact Studyroom as soon as possible so we can help.
          </p>
          <p>
            Tutors and admins agree to follow child safety requirements, keep information
            confidential, and use Studyroom only for appropriate educational purposes.
          </p>
          <p>
            These terms may be updated over time. We will aim to communicate any important
            changes to families and tutors.
          </p>
        </div>
      </div>
    </div>
  );
}
