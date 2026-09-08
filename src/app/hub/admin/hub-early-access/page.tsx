"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Read-only admin list for Release 1C Hub early-access expressions of
// interest. Intentionally NOT a CRM: no stages, no assignment, no status
// workflow — just what came in, for Lily/Tiara to see. Firestore rules
// restrict `hubEarlyAccess` reads to isAdmin(); this page's parent layout
// (/hub/admin/layout.tsx) already gates the whole /hub/admin/** tree.

type SubmissionDoc = {
  id: string;
  name: string;
  email: string;
  studentYearLevel: string;
  biggestStudyChallenge: string | null;
  source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  referrer: string;
  submittedAt?: Timestamp;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function formatDate(ts?: Timestamp) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HubEarlyAccessAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SubmissionDoc[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "hubEarlyAccess"));
        const list: SubmissionDoc[] = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: asString(data.name),
            email: asString(data.email),
            studentYearLevel: asString(data.studentYearLevel),
            biggestStudyChallenge: typeof data.biggestStudyChallenge === "string" ? data.biggestStudyChallenge : null,
            source: asString(data.source, "hub_early_access"),
            utm_source: asString(data.utm_source),
            utm_medium: asString(data.utm_medium),
            utm_campaign: asString(data.utm_campaign),
            referrer: asString(data.referrer),
            submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt : undefined,
          };
        });
        list.sort((a, b) => (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0));
        setRows(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const attributionSummary = useMemo(() => {
    const withUtm = rows.filter((r) => r.utm_source).length;
    return { total: rows.length, withUtm };
  }, [rows]);

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Hub Early Access</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Expressions of interest in standalone Hub access from /studyroom. Demand validation only —
              nothing here creates an account or activates Hub access.
              {attributionSummary.total > 0 && (
                <> {attributionSummary.total} total, {attributionSummary.withUtm} with campaign attribution.</>
              )}
            </p>
          </div>
          <Link
            href="/hub/admin"
            className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
          >
            Admin Home
          </Link>
        </header>

        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">No submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="w-[100px] px-3 py-3">Date</th>
                    <th className="px-3 py-3">Name / Email</th>
                    <th className="w-[90px] px-3 py-3">Year</th>
                    <th className="px-3 py-3">Biggest challenge</th>
                    <th className="w-[140px] px-3 py-3">Attribution</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[color:var(--ring)]">
                      <td className="px-3 py-3 align-top text-xs text-[color:var(--muted)]">{formatDate(r.submittedAt)}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-[color:var(--ink)]">{r.name}</div>
                        <div className="text-xs text-[color:var(--muted)]">{r.email}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs">{r.studentYearLevel || "—"}</td>
                      <td className="px-3 py-3 align-top text-xs text-[color:var(--ink)]">
                        {r.biggestStudyChallenge || <span className="text-[color:var(--muted)]">—</span>}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-[color:var(--muted)]">
                        {r.utm_source ? (
                          <>
                            {r.utm_source}
                            {r.utm_campaign ? ` / ${r.utm_campaign}` : ""}
                          </>
                        ) : r.referrer ? (
                          r.referrer
                        ) : (
                          "Direct"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
