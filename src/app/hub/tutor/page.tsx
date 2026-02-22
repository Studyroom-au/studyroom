"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
      <p className="mt-4 text-xs font-semibold text-[color:var(--brand)]">Open →</p>
    </Link>
  );
}

export default function TutorHomePage() {
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as { tutorAccessRequest?: { status?: string; reviewedAt?: Timestamp } } | undefined;
      const approved = data?.tutorAccessRequest?.status === "approved";
      setShowApprovedBanner(approved);
    });
    return () => off();
  }, []);

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Studyroom · Tutor
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
            Tutor Portal
          </h1>
        
        </header>

        {showApprovedBanner && (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Tutor access approved. You now have full Tutor Portal access.
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Sessions Calendar"
            subtitle="Schedule, reschedule, complete, invoice-trigger."
            href="/hub/tutor/sessions"
          />
          <Card
            title="My Leads"
            subtitle="View assigned leads and convert to students."
            href="/hub/tutor/leads"
          />
          <Card
            title="My Students"
            subtitle="Open student records and session logs."
            href="/hub/tutor/students"
          />
          <Card
            title="Payout Export"
            subtitle="Filter pay period and export CSV."
            href="/hub/tutor/payouts"
          />
        </div>
      </div>
    </div>
  );
}
