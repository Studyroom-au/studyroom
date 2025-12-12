// src/app/legal/safety/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function SafetyPage() {
  const router = useRouter();

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Studyroom Australia – Online Safety
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Simple guidelines to help keep students safe while using Studyroom.
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
            Studyroom is designed to be a calm, respectful place for learning. These safety
            guidelines help protect students in Studyrooms (public learning spaces), chat,
            voice, and shared whiteboards.
          </p>

          <p>
            If something feels uncomfortable, confusing, or unsafe, trust that feeling. You
            can leave a Studyroom at any time and talk to a trusted adult.
          </p>

          {/* 1 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              1. Keep Personal Information Private
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Do not share your full name, address, phone number, or school name.</li>
              <li>Do not share your social media usernames, Snap, Instagram, or gamer tags.</li>
              <li>Do not share passwords, verification codes, or private links.</li>
              <li>
                If someone asks for personal details, do not answer. Leave the Studyroom and report it.
              </li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              2. Use Studyrooms Safely
            </h2>
            <p className="mt-2">
              Studyrooms are currently public spaces. That means other students may enter.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Stay on learning topics (homework, study planning, questions, revision).</li>
              <li>Be careful with what you write on the whiteboard (assume others can see it).</li>
              <li>Do not invite other users to private chats outside Studyroom.</li>
              <li>Do not share links unless a tutor has asked you to.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              3. Chat and Voice Rules
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Be respectful. No bullying, teasing, or harassment.</li>
              <li>No swearing or sexual content.</li>
              <li>No threats, “dare” challenges, or pressure to do unsafe things.</li>
              <li>No asking for photos, videos, or personal contact details.</li>
              <li>
                If someone is being inappropriate, stop replying, leave the Studyroom, and report it.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              4. Never Share Passwords
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Never share your password with friends, classmates, or anyone online.</li>
              <li>Use a strong password that you don’t use on other apps.</li>
              <li>If you think someone knows your password, change it immediately.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              5. Do Not Record or Screenshot Other Users
            </h2>
            <p className="mt-2">
              Recording, screenshots, or sharing content from Studyrooms can put students at risk.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Do not screenshot other students’ messages, usernames, or whiteboard work.</li>
              <li>Do not record voice conversations.</li>
              <li>Do not repost Studyroom content on social media.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              6. What To Do If Something Feels Unsafe
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Leave the Studyroom immediately.</li>
              <li>Do not keep replying or arguing.</li>
              <li>Tell a parent, guardian, or trusted adult.</li>
              <li>Report the behaviour to a tutor or to Studyroom support.</li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              7. Looking After Your Wellbeing While Studying
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Take breaks when you feel overwhelmed.</li>
              <li>Use the Pomodoro timer to study in small chunks.</li>
              <li>If you feel upset, pause and talk to a trusted adult.</li>
              <li>Remember: it’s okay to ask for help.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              8. How Studyroom Helps Keep Students Safe
            </h2>
            <p className="mt-2">
              Tutors may enter Studyrooms and monitor activity to support learning and safety.
              Even so, continuous supervision is not guaranteed, so students must follow these
              safety rules at all times.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-semibold text-[color:var(--ink)]">
              Need Help or Want to Report Something?
            </h2>
            <p className="mt-2">
              If something happens online that worries you, tell a trusted adult and contact Studyroom.
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
