"use client";

import Link from "next/link";

function Card({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-lg font-semibold text-[color:var(--ink)]">{title}</div>
      <p className="mt-1 text-sm text-[color:var(--muted)]">{subtitle}</p>
      <p className="mt-4 text-xs font-semibold text-[color:var(--brand)]">
        Open →
      </p>
    </Link>
  );
}

export default function AdminHubPage() {
  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Studyroom · Admin
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
            Admin Portal
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            Review leads, assign tutors, and keep operations tidy.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            title="Leads"
            subtitle="View new enrolments, change status, and assign tutors."
            href="/hub/admin/leads"
          />
          <Card
            title="Clients"
            subtitle="Parents, students, assigned tutors, and tutor stats."
            href="/hub/admin/clients"
          />
          <Card
            title="Tutors"
            subtitle="Open a tutor and view all students assigned to them."
            href="/hub/admin/tutors"
          />

          <Card
            title="Sessions Calendar"
            subtitle="Track scheduled and completed sessions and notes."
            href="/hub/admin/sessions"
          />
          <Card
            title="Add Existing Student"
            subtitle="Migration tool to add a tutor's current students without public enrolment."
            href="/hub/admin/students/add-existing"
          />
        </div>

        <div className="mt-6">
          <Link
            href="/hub"
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
