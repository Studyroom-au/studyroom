"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-xl bg-[color:var(--brand)] shadow-sm">
                {/* Update src to your actual logo asset, e.g. /logo-studyroom.svg or /studyroom-logo.png */}
                <Image
                  src="/logo.png"
                  alt="Studyroom"
                  fill
                  className="object-contain p-1.5"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Studyroom
                </span>
                <span className="text-sm font-semibold text-[color:var(--ink)]">
                  Student Hub
                </span>
              </div>
            </Link>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs text-[color:var(--muted)]">
                A calm space to plan and focus.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/lobby")}
              className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm font-medium text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
            >
              Studyrooms
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm font-medium text-[color:var(--muted)] shadow-sm transition hover:bg-white"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Study Rooms Section */}
        <section className="mb-8 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-6 py-5 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.1fr_0.9fr]">
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
                  className="brand-cta rounded-xl px-5 py-2 text-sm font-semibold shadow-sm"
                >
                  Open Lobby
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/room/Room%201")}
                  className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-2 text-sm font-medium text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
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
                  <span className="text-base font-medium group-hover:text-[color:var(--brand)]">
                    {room}
                  </span>
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
