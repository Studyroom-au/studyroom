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
              Online Safety Tips
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

        <div className="space-y-4 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)] shadow-sm">
          <p>
            Studyroom is designed to be a calm, respectful space for learning. These tips
            can help keep students safe while using the app and the internet in general.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Never share your password with friends or classmates.</li>
            <li>Keep personal information private (such as your address, school, or phone number).</li>
            <li>Only join rooms with people you know and trust, such as your tutor or classmates.</li>
            <li>
              If someone makes you feel uncomfortable, leave the room and tell a parent,
              caregiver, or tutor.
            </li>
            <li>Take breaks if you feel overwhelmed or upset during study sessions.</li>
          </ul>
          <p>
            If you are worried about something that happened online, talk to a trusted adult
            and reach out to Studyroom so we can support you.
          </p>
        </div>
      </div>
    </div>
  );
}
