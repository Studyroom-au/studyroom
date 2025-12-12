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
              Studyroom Australia – Privacy Policy
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              How Studyroom collects, stores, and protects your information.
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
            <strong>Studyroom Australia</strong> (“Studyroom”, “we”, “our”, “us”) is committed
            to protecting the privacy, safety, and wellbeing of all users, especially
            students under the age of 18.
          </p>

          <p>
            This Privacy Policy explains what information we collect, how we use it, how it
            is stored, and the choices available to students, parents or guardians, and
            tutors. This policy forms part of the Studyroom Terms and Conditions.
          </p>

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              1. Who This Policy Applies To
            </h2>
            <p className="mt-2">
              This Privacy Policy applies to all users of Studyroom, including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Students (including users under 18)</li>
              <li>Parents and legal guardians</li>
              <li>Tutors and moderators</li>
              <li>Any person accessing the Studyroom platform</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              2. Information We Collect
            </h2>

            <p className="mt-2">
              We collect only the information reasonably necessary to operate Studyroom
              safely and effectively.
            </p>

            <p className="mt-2 font-medium text-[color:var(--ink)]">
              Information you provide directly:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Name or chosen display name</li>
              <li>Email address</li>
              <li>Account role (student, parent or guardian, tutor)</li>
              <li>Parent or guardian email address (for minors)</li>
              <li>Messages, whiteboard input, and notes created within the platform</li>
            </ul>

            <p className="mt-2 font-medium text-[color:var(--ink)]">
              Information collected through use of the platform:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Task lists, assessment entries, and calendar usage</li>
              <li>Pomodoro sessions and study activity data</li>
              <li>Wellbeing check-ins or reflections (if used)</li>
              <li>Basic usage data (such as feature interactions and timestamps)</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              3. Information About Minors
            </h2>
            <p className="mt-2">
              Studyroom is designed for student use, including users under 18.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>We require parent or legal guardian consent for minor accounts.</li>
              <li>We collect limited personal information from minors.</li>
              <li>
                Parents or guardians may request access to, correction of, or deletion of
                their child’s information at any time.
              </li>
              <li>
                We do not knowingly collect unnecessary or sensitive personal information
                from minors.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              4. How We Use Information
            </h2>
            <p className="mt-2">
              We use collected information to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide and operate the Studyroom platform</li>
              <li>Support student learning, organisation, and collaboration</li>
              <li>Enable tutor moderation and platform safety</li>
              <li>Communicate with users and parents or guardians</li>
              <li>Respond to safety concerns or reports</li>
              <li>Improve platform functionality and user experience</li>
            </ul>

            <p className="mt-2">
              We do not use student data for advertising or profiling.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              5. Chat, Voice, and Shared Spaces
            </h2>
            <p className="mt-2">
              Studyroom includes public study rooms with chat, voice communication, and
              shared whiteboards.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Messages and interactions may be visible to other users in public rooms.</li>
              <li>Tutors may observe or review interactions for safety and moderation.</li>
              <li>
                We do not record voice communications by default, but moderation actions may
                involve reviewing reported content.
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              6. How We Share Information
            </h2>
            <p className="mt-2">
              Studyroom does <strong>not</strong> sell user data.
            </p>

            <p className="mt-2">
              We only share personal information:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>With parents or guardians of minor users</li>
              <li>With tutors for educational and safety purposes</li>
              <li>Where required by law or a lawful request</li>
              <li>Where necessary to protect the safety of users</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              7. Data Storage and Security
            </h2>
            <p className="mt-2">
              We take reasonable steps to protect personal information from misuse, loss,
              unauthorised access, or disclosure.
            </p>
            <p className="mt-2">
              This includes secure storage systems, access controls, and limited internal
              access to personal data.
            </p>
            <p className="mt-2">
              No system is completely secure, but we continuously review our practices to
              improve data protection.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              8. Data Retention
            </h2>
            <p className="mt-2">
              We retain personal information only for as long as necessary to provide the
              service, meet legal obligations, or ensure student safety.
            </p>
            <p className="mt-2">
              Parents or guardians may request deletion of their child’s account and data,
              subject to legal and safety requirements.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              9. Access, Correction, and Deletion
            </h2>
            <p className="mt-2">
              Users and parents or guardians of minors may request:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access to personal information</li>
              <li>Correction of inaccurate information</li>
              <li>Deletion of account data</li>
            </ul>
            <p className="mt-2">
              Requests can be made by contacting Studyroom using the details below.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              10. Third-Party Services
            </h2>
            <p className="mt-2">
              Studyroom may use trusted third-party services (such as hosting, analytics, or
              communication providers) to operate the platform.
            </p>
            <p className="mt-2">
              These providers are required to handle information securely and only for
              authorised purposes.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              11. Changes to This Privacy Policy
            </h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. Changes will be posted
              within the app or website.
            </p>
            <p className="mt-2">
              Continued use of Studyroom after changes are made indicates acceptance of the
              updated policy.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              12. Contact Us
            </h2>
            <p className="mt-2">
              If you have questions, concerns, or requests regarding privacy, contact:
            </p>
            <p className="mt-1">
              <strong>Studyroom Australia</strong>
              <br />
              Email: <em>contact.studyroomaustralia@gmail.com</em>
            </p>
          </section>

          <p className="pt-4 text-xs text-[color:var(--muted)]">
            © Studyroom Australia 2025. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
