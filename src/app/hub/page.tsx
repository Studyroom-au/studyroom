"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PomoWidget from "@/components/widgets/PomoWidget";
import TaskListWidget from "@/components/widgets/TaskListWidget";
import DailyPlannerWidget from "@/components/widgets/DailyPlannerWidget";
import MoodTrackerWidget from "@/components/widgets/MoodTrackerWidget";

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm transition hover:shadow-md">
      {(title || subtitle || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-[color:var(--muted)]">
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export default function HubPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
    });
    return () => off();
  }, [router]);

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/");
    }
  }

  if (!mounted) return <div className="min-h-screen" />;

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Top Bar */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-block h-7 w-7 rounded-xl bg-[color:var(--brand)] shadow-sm"
            />
            <div>
              <h1 className="text-xl font-semibold leading-tight text-[color:var(--ink)]">
                Your Hub
              </h1>
              <p className="text-sm text-[color:var(--muted)]">
                A calm space to plan and focus.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/lobby")}
              className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
            >
              Studyrooms
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Study Rooms Section */}
        <section className="mb-8 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-6 py-5 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr]">
            <div className="flex flex-col justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--ink)]">
                  Study Rooms
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Join a focus space or create one in the Lobby. Rooms help you
                  connect, study, and stay accountable.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/lobby")}
                  className="rounded-xl bg-[color:var(--brand)] px-5 py-2 text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)]"
                >
                  Open Lobby
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/room/Room%201")}
                  className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
                >
                  Join Default Room
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2">
              {["Room 1", "Room 2", "Room 3", "Room 4"].map((room) => (
                <button
                  key={room}
                  onClick={() => router.push(`/room/${encodeURIComponent(room)}`)}
                  className="group flex flex-col items-center justify-center rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 text-center text-sm text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-base font-medium">{room}</span>
                  <span className="mt-1 text-xs text-[color:var(--muted)]">
                    Open 24/7
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <main className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card
            title="Private Pomodoro"
            subtitle="Stay focused with gentle intervals."
          >
            <div className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3">
              <PomoWidget />
            </div>
          </Card>

          <Card
            title="Quick Study Plan"
            subtitle="Write a few tasks you'll complete today."
          >
            <TaskListWidget />
          </Card>

          <Card
            title="Coming Up Soon"
            subtitle="Track upcoming assessments, exams, and deadlines."
          >
            <DailyPlannerWidget />
          </Card>

          <Card
            title="Mood Tracker"
            subtitle="Check in with how you feel and see your history."
          >
            <MoodTrackerWidget />
          </Card>
        </main>
      </div>
    </div>
  );
}
