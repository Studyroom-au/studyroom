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
              Studyroom Australia – Terms and Conditions
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
            Welcome to <strong>Studyroom Australia</strong> (“Studyroom”, “we”, “our”, “us”).
            Studyroom is a student-centred digital learning platform designed to support
            organisation, collaboration, and wellbeing through shared study spaces and
            educational tools.
          </p>

          <p>
            By creating an account, accessing, or using the Studyroom platform (including the
            website, mobile app, and any related services), you agree to these Terms and
            Conditions (“Terms”). If you do not agree, you must not use the platform.
          </p>

          <p>
            These Terms apply to students, parents or guardians, tutors, and any other person who
            accesses or uses Studyroom.
          </p>

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              1. Eligibility and Account Creation (Minors and Parental Consent)
            </h2>

            <p className="mt-2">
              Studyroom may be used by students under the age of 18. Because Studyroom is
              available to minors, additional protections apply.
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Studyroom may be used by students under the age of 18.</li>
              <li>All users under 18 must provide a parent or legal guardian’s email address at sign-up.</li>
              <li>Parental or guardian consent is required for account activation.</li>
              <li>
                Parents or guardians may request account information, suspension, or deletion at any time,
                subject to reasonable identity verification.
              </li>
              <li>
                By creating an account, you confirm that the information provided is accurate and that
                appropriate consent has been obtained.
              </li>
              <li>
                If we reasonably believe a user is under 18 and does not have valid parent or guardian consent,
                we may suspend or terminate the account.
              </li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              2. Purpose of the Platform
            </h2>

            <p className="mt-2">Studyroom provides educational and organisational tools, including:</p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Virtual Studyrooms (shared learning spaces)</li>
              <li>Chat and voice communication</li>
              <li>Shared whiteboards</li>
              <li>Task lists and assessment calendars</li>
              <li>Pomodoro timers</li>
              <li>Wellbeing reflection tools</li>
              <li>Digital notebooks</li>
            </ul>

            <p className="mt-2">
              Studyroom is designed to support learning and organisation. It does not replace schools,
              teachers, parents or guardians, or professional services.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              3. Intellectual Property and Ownership
            </h2>

            <p className="mt-2">
              All content and materials available on the Studyroom platform are owned by{" "}
              <strong>Studyroom Australia</strong> unless otherwise stated. This includes, but is not limited to:
              platform structure, room formats, designs, educational workflows, written content, templates,
              prompts, visual elements, software, code, and functionality.
            </p>

            <p className="mt-2 font-medium text-[color:var(--ink)]">3.1 Licence to Use</p>
            <p className="mt-1">
              Users are granted a limited, personal, non-exclusive, non-transferable licence to access and use
              Studyroom for personal educational purposes only, in accordance with these Terms.
            </p>

            <p className="mt-2 font-medium text-[color:var(--ink)]">3.2 Restrictions</p>
            <p className="mt-1">Users must not (and must not attempt to):</p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Copy, reproduce, distribute, publish, or publicly display platform content</li>
              <li>Replicate Studyroom systems, room structures, workflows, or designs</li>
              <li>Reverse-engineer, decompile, scrape, crawl, or attempt to extract source code or data</li>
              <li>Use Studyroom materials to build competing platforms, products, or services</li>
              <li>Train artificial intelligence or machine learning systems on Studyroom content or outputs</li>
              <li>Commercially exploit any part of the platform without prior written permission</li>
            </ul>

            <p className="mt-2">
              Any unauthorised use of Studyroom intellectual property may result in immediate account suspension
              or termination and may be pursued through legal channels where appropriate.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              4. Restriction on Replication and Competitive Use
            </h2>

            <p className="mt-2">
              Users agree not to recreate, replicate, or derive competing tools, platforms, products, or
              educational systems that are substantially similar to Studyroom using Studyroom content, access,
              designs, workflows, room formats, or materials.
            </p>

            <p className="mt-2">
              This restriction applies to both personal and commercial use and includes copying or adapting
              Studyroom’s structure, room experiences, and feature organisation.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              5. User-Generated Content
            </h2>

            <p className="mt-2">
              Users may create content within Studyroom, such as notes, drawings, whiteboard contributions, and
              messages (“User Content”).
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Users retain ownership of User Content they personally create.</li>
              <li>
                By using the platform, users grant Studyroom Australia a licence to store, display, process,
                and moderate User Content solely for operating, improving, and maintaining the service.
              </li>
              <li>
                Studyroom may remove, restrict, or report User Content that is unsafe, unlawful, inappropriate,
                or in breach of these Terms.
              </li>
            </ul>

            <p className="mt-2">
              Studyroom does not claim ownership over student-created work. However, users must ensure their User
              Content does not infringe the rights of others.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              6. Shared Spaces, Public Studyrooms, Chat, and Voice Communication
            </h2>

            <p className="mt-2">
              Studyroom includes shared learning spaces, including public Studyrooms, chat, voice communication,
              and collaborative whiteboards.
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                All Studyrooms are <strong>public at this time</strong> and may be accessed by other users.
              </li>
              <li>Tutors may monitor rooms and interactions.</li>
              <li>
                <strong>Continuous supervision is not guaranteed.</strong> Users remain responsible for their
                conduct at all times.
              </li>
              <li>
                Users must not share personal information (including full name, address, phone number, school,
                social media handles, or any identifying details) in public rooms.
              </li>
              <li>
                Users must not attempt to move conversations off-platform or encourage other users to connect
                privately outside Studyroom.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              7. Student Safety and Acceptable Use
            </h2>

            <p className="mt-2">
              Studyroom is a student-centred educational environment. Users must behave respectfully and ethically.
              Safety is the priority.
            </p>

            <p className="mt-2">Users must not engage in (or attempt) any of the following:</p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Harassment, bullying, intimidation, or targeted abuse</li>
              <li>Discrimination, hate speech, or degrading language</li>
              <li>Grooming, sexual content, or inappropriate interactions</li>
              <li>Sharing personal or private information (their own or someone else’s)</li>
              <li>Threats, coercion, blackmail, or manipulation</li>
              <li>Impersonation or misleading behaviour</li>
              <li>Posting or sharing harmful, explicit, or illegal content</li>
              <li>Attempting to access rooms or accounts that are not theirs</li>
              <li>Encouraging self-harm or unsafe behaviour</li>
            </ul>

            <p className="mt-2">
              If you see unsafe behaviour, you should report it immediately using the platform tools (where available)
              or by contacting Studyroom.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              8. Prohibited Recording, Screenshots, and Redistribution
            </h2>

            <p className="mt-2">
              To protect minors, privacy, and safety, users must not record, screenshot, photograph, or otherwise
              capture content from Studyrooms that includes other users (including chat logs, voice, whiteboards, or
              usernames), and must not share or redistribute any such content.
            </p>

            <p className="mt-2">
              Where permitted by law, Studyroom may take action if it becomes aware of recording, screenshots, or
              redistribution that compromises safety or privacy.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              9. Tutor Moderation and Platform Oversight
            </h2>

            <p className="mt-2">
              Tutors may enter Studyrooms, observe activity, and intervene when needed. Tutor involvement may include
              giving guidance, enforcing rules, removing content, or escalating safety concerns.
            </p>

            <p className="mt-2">
              Tutor presence does not mean constant supervision. Users acknowledge that they remain responsible for
              their conduct at all times.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              10. Wellbeing Tools Disclaimer
            </h2>

            <p className="mt-2">
              Studyroom includes wellbeing and reflection tools intended for organisation and self-awareness.
              These tools are optional and are not medical, psychological, or therapeutic services.
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Studyroom does not provide medical, psychological, counselling, or therapy services.</li>
              <li>Studyroom does not diagnose, treat, or manage health conditions.</li>
              <li>
                If a user is in distress or at risk, they should seek support from a parent or guardian, school, or a
                qualified professional, or call emergency services where appropriate.
              </li>
            </ul>
          </section>

          {/* 11 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              11. Privacy and Data Protection
            </h2>

            <p className="mt-2">
              Studyroom handles personal information in accordance with applicable Australian privacy laws and the
              Studyroom Privacy Policy. The Privacy Policy forms part of these Terms.
            </p>

            <p className="mt-2">
              Users and parents or guardians should review the Privacy Policy to understand what data is collected,
              how it is used, and how requests for access or deletion are handled.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              12. Suspension and Termination
            </h2>

            <p className="mt-2">
              Studyroom may suspend or terminate access to the platform where:
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>These Terms are breached</li>
              <li>User behaviour presents a safety risk</li>
              <li>Misuse of the platform occurs</li>
              <li>Required parent or guardian consent is withdrawn or cannot be verified</li>
              <li>We are required to do so by law or to protect users</li>
            </ul>

            <p className="mt-2">
              Accounts may be removed without notice where student safety is at risk. Where appropriate, parents
              or guardians may be notified.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              13. Platform Availability and Changes
            </h2>

            <p className="mt-2">
              Studyroom may change, update, pause, or discontinue features at any time. We do not guarantee that the
              platform or any specific feature will always be available.
            </p>

            <p className="mt-2">
              We may also update these Terms from time to time. Continued use of the platform after updates are made
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              14. Limitation of Liability and Australian Consumer Law
            </h2>

            <p className="mt-2">
              Studyroom is provided on an “as is” basis. We do not guarantee academic outcomes, grades, performance
              improvements, or uninterrupted access.
            </p>

            <p className="mt-2">
              To the maximum extent permitted by law, Studyroom Australia is not liable for indirect, incidental,
              special, or consequential loss arising from use of the platform.
            </p>

            <p className="mt-2">
              Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy
              conferred by the <strong>Australian Consumer Law</strong> or any other applicable law that cannot be
              excluded.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              15. Governing Law
            </h2>

            <p className="mt-2">
              These Terms are governed by the laws of Australia. You agree to submit to the non-exclusive jurisdiction
              of the courts in Australia.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              16. Contact
            </h2>

            <p className="mt-2">
              For questions, concerns, reports, or parental requests, contact:
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
