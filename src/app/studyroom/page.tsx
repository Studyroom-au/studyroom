import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import HubEarlyAccessForm from "@/components/marketing/HubEarlyAccessForm";

export const metadata: Metadata = {
  title: "Studyroom Hub: Study Support Between Sessions",
  description:
    "Studyroom Hub is where Studyroom tutoring students keep working between sessions: assessments, tasks, tutor resources and focus tools in one calmer place.",
  alternates: { canonical: "/studyroom" },
  // A page that defines its own `openGraph`/`twitter` object does NOT inherit
  // the remaining fields (siteName/type/locale) from the root layout's —
  // confirmed by inspecting the actual built HTML, not assumed — so every
  // field that should still be present has to be restated here, not just the
  // one being overridden (the real product screenshot now on this page,
  // reusing the existing asset rather than the default logo).
  openGraph: {
    siteName: "Studyroom Australia",
    type: "website",
    locale: "en_AU",
    images: [{ url: "/studyroom-hub-screenshot.png", width: 854, height: 864 }],
  },
  twitter: { card: "summary_large_image", images: ["/studyroom-hub-screenshot.png"] },
};

const hubFeatures = [
  {
    title: "Assessments and deadlines",
    body: "Keep assessments and deadlines together with clear due dates, subjects and progress, so nothing quietly slips.",
  },
  {
    title: "Checkpoints",
    body: "Bigger assessments broken into manageable steps, each labelled with its subject, so it's obvious what belongs where.",
  },
  {
    title: "Tasks and checklists",
    body: "A simple daily list for schoolwork, whether it came from a tutor, a parent, or you.",
  },
  {
    title: "Pomodoro and focus tools",
    body: "A built-in focus timer for sitting down and actually getting started, with a history of sessions you've completed.",
  },
  {
    title: "Tutor-shared resources",
    body: "Worksheets and resources your tutor has shared with you, kept in one place instead of scattered across emails.",
  },
  {
    title: "Progress and streaks",
    body: "A simple view of what you've been getting done, so effort between sessions is visible, not invisible.",
  },
];

export default function StudyroomHubPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-10 md:px-6 md:pt-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom Hub · part of Studyroom tutoring
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-5xl">
              Tutoring that doesn&apos;t stop when the session ends.
            </h1>
            <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
              Studyroom brings schoolwork, next steps, tutor resources and focus tools into one calmer place
              between sessions, so what happens with your tutor keeps going the rest of the week too.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm">
                Get tutoring with Studyroom
              </Link>
              <a href="#how-it-works" className="button-secondary inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">
                See how Studyroom works
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-md ring-1 ring-[color:var(--ring)]">
            <Image
              src="/studyroom-hub-screenshot.png"
              alt="Screenshot of the Studyroom Hub dashboard, showing study rooms, a private focus timer and a daily study plan checklist"
              width={854}
              height={864}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* WHAT STUDYROOM TUTORING IS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Tutoring, with somewhere to keep working</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Studyroom is a Logan and Brisbane Southside tutoring service built around students who feel
              behind, anxious, or just want a clearer system. A session with a tutor is where the real work
              happens: explaining, practising, building confidence.
            </p>
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            The Hub is what happens in between. It&apos;s the calm, organised place students come back to
            during the week, so the plan from a session doesn&apos;t get lost, and the next session doesn&apos;t
            have to start from scratch. Want the full picture on tutoring itself?{" "}
            <Link href="/tutoring" className="font-semibold text-[color:var(--brand)] hover:underline">
              See how Studyroom tutoring works
            </Link>
            .
          </p>
        </div>
      </section>

      {/* HOW THE HUB HELPS */}
      <section id="how-it-works" className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <div className="mb-6 grid gap-8 md:grid-cols-[1fr_0.8fr] md:items-center">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">What&apos;s in the Hub right now</h2>
              <p className="text-sm text-[color:var(--muted)] md:max-w-md">
                Everything below is live and in use by Studyroom students today, not a roadmap.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-[color:var(--ring)]">
              <Image
                src="/studyroom-tools-screenshot.png"
                alt="Screenshot of Studyroom Hub tools: a focus timer, a daily study plan checklist, upcoming assessment deadlines and a mood check-in"
                width={719}
                height={857}
                className="h-auto w-full"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hubFeatures.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white/80 p-5 ring-1 ring-[color:var(--ring)]">
                <div className="text-sm font-semibold text-[color:var(--ink)]">{f.title}</div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOOD + ALEX */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">How you&apos;re feeling matters too</h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              A quick daily check-in for how school is feeling, not just what got done. It helps students
              notice patterns in how their week is going.
            </p>
          </div>
          <div className="rounded-3xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-[color:var(--ink)]">Alex the Study Buddy</h3>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Alex offers gentle, scripted encouragement and study prompts, like a nudge to start the timer
                  or a note when a streak is building. Alex is not an AI chat system, and there are no
                  open-ended AI conversations with students.
                </p>
              </div>
              <div className="hidden w-24 flex-shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-[color:var(--ring)] sm:block">
                <Image
                  src="/alex-motivation-example.png"
                  alt="Example of Alex the Study Buddy showing a short scripted encouragement message"
                  width={288}
                  height={307}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOCUS SPACES (secondary, beta) */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white/60 p-6 ring-1 ring-[color:var(--ring)] md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_0.85fr] md:items-center">
            <div>
              <div className="chip mb-3">Beta</div>
              <h3 className="text-lg font-semibold text-[color:var(--ink)]">Studyroom focus spaces</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)] md:max-w-md">
                Access supported Studyroom focus spaces when available, a quiet space to run a focus timer
                alongside other students. This is an early, secondary feature, not the main reason to use the
                Hub.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-[color:var(--ring)]">
              <Image
                src="/studyroom-library-lobby-screenshot.png"
                alt="Screenshot of the Studyroom focus spaces lobby, showing available study rooms students can join or create"
                width={1036}
                height={875}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* BROADER MESSAGE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-2xl font-semibold leading-snug text-[color:var(--ink)] md:text-3xl">
            School can feel like a lot. Studyroom helps you bring it into one calmer place.
          </p>
        </div>
      </section>

      {/* EARLY ACCESS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Interested in using Studyroom without tutoring?
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Right now, Studyroom Hub is part of the tutoring experience, not a standalone product. If you&apos;d
            still like access without tutoring, let us know, we&apos;re gauging interest before building that
            out further.
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-2xl">
          <HubEarlyAccessForm />
        </div>
      </section>
    </div>
  );
}
