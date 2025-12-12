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
              StudyRoom Australia – Terms and Conditions
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Effective date: <span className="italic">12/12/2025</span>
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

        <div className="space-y-6 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--ink)]/80 shadow-sm">
          <p>
            Welcome to <strong>StudyRoom Australia</strong> (“StudyRoom”, “we”, “our”, “us”).
            StudyRoom is a student-centred digital learning platform designed to support
            organisation, collaboration, and wellbeing through shared study spaces and
            educational tools.
          </p>

          <p>
            By creating an account or using the StudyRoom platform, you agree to these Terms
            and Conditions. If you do not agree, you must not use the platform.
          </p>

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              1. Eligibility and Account Creation
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>StudyRoom may be used by students under the age of 18.</li>
              <li>All users under 18 must provide a parent or legal guardian’s email address at sign-up.</li>
              <li>Parental or guardian consent is required for account activation.</li>
              <li>Parents or guardians may request account information, suspension, or deletion at any time.</li>
              <li>
                By creating an account, you confirm that the information provided is accurate
                and that appropriate consent has been obtained.
              </li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              2. Purpose of the Platform
            </h2>
            <p className="mt-2">StudyRoom provides educational and organisational tools, including:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Virtual StudyRooms (public learning spaces)</li>
              <li>Chat and voice communication</li>
              <li>Shared whiteboards</li>
              <li>Task lists and assessment calendars</li>
              <li>Pomodoro timers</li>
              <li>Wellbeing reflection tools</li>
              <li>Digital notebooks</li>
            </ul>
            <p className="mt-2">
              StudyRoom is designed to support learning and organisation. It does not replace
              schools, teachers, or professional services.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              3. Intellectual Property and Ownership
            </h2>
            <p className="mt-2">
              All content and materials available on the StudyRoom platform are owned by
              StudyRoom Australia unless otherwise stated. This includes platform structure,
              designs, educational workflows, written content, templates, visual elements,
              software, and functionality.
            </p>

            <p className="mt-2 font-medium">Licence to Use</p>
            <p>
              Users are granted a limited, personal, non-exclusive, non-transferable licence
              to access and use StudyRoom for personal educational purposes only.
            </p>

            <p className="mt-2">Users must not:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Copy, reproduce, distribute, or publish platform content</li>
              <li>Replicate StudyRoom systems or structures</li>
              <li>Reverse-engineer or scrape platform features</li>
              <li>Use StudyRoom materials to build competing platforms</li>
              <li>Train artificial intelligence systems on StudyRoom content</li>
              <li>Commercially exploit any part of the platform</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              4. Restriction on Replication and Competitive Use
            </h2>
            <p>
              Users agree not to recreate, replicate, or derive competing tools, platforms,
              or educational systems that are substantially similar to StudyRoom using
              StudyRoom content, access, or materials.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              5. User-Generated Content
            </h2>
            <p>
              Users retain ownership of content they personally create. By using the
              platform, users grant StudyRoom permission to store, display, process, and
              moderate this content solely for operating the service.
            </p>
            <p className="mt-2">
              StudyRoom does not claim ownership over student-created work.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              6. Shared Spaces, Chat, and Voice Communication
            </h2>
            <p>
              StudyRoom includes public shared learning spaces. Tutors may monitor rooms,
              but continuous supervision is not guaranteed. Users are responsible for their
              conduct at all times.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              7. Student Safety and Acceptable Use
            </h2>
            <p>Users must not engage in:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Harassment, bullying, or intimidation</li>
              <li>Discrimination or hate speech</li>
              <li>Grooming or inappropriate interactions</li>
              <li>Sharing personal or private information</li>
              <li>Recording or redistributing other users’ content</li>
              <li>Impersonation or misleading behaviour</li>
            </ul>
          </section>

          {/* 8–15 condensed */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              8–15. Platform Oversight, Wellbeing, Privacy, and Legal Terms
            </h2>
            <p>
              Tutors may observe StudyRooms. Wellbeing tools are optional reflective aids
              only and do not provide medical or therapeutic advice. Privacy is handled in
              accordance with Australian law and the StudyRoom Privacy Policy.
            </p>
            <p className="mt-2">
              StudyRoom may suspend or terminate accounts where safety concerns arise.
              StudyRoom is provided “as is” and does not guarantee academic outcomes.
              These Terms are governed by Australian law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              Contact
            </h2>
            <p>
              For questions, concerns, or parental requests, contact:
            </p>
            <p className="mt-1">
              <strong>StudyRoom Australia</strong><br />
              Email: <em>contact.studyroomaustralia@gmail.com</em>
            </p>
          </section>

          <p className="pt-4 text-xs text-[color:var(--muted)]">
            © StudyRoom Australia [Year]. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
