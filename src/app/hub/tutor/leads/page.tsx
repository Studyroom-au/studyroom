// src/app/hub/tutor/leads/page.tsx  (or /hub/tutors/leads/page.tsx)
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type LeadStatus = "new" | "claimed" | "converted" | "closed";

type LeadRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  suburb?: string | null;
  mode?: "online" | "in-home";
  subjects: string[];

  status: LeadStatus;

  claimedTutorId?: string | null;
  claimedTutorName?: string | null;
  claimedTutorEmail?: string | null;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type LeadDoc = {
  studentName?: unknown;
  yearLevel?: unknown;
  suburb?: unknown;
  mode?: unknown;
  subjects?: unknown;
  status?: unknown;

  claimedTutorId?: unknown;
  claimedTutorName?: unknown;
  claimedTutorEmail?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asTimestamp(v: unknown): Timestamp | undefined {
  return v instanceof Timestamp ? v : undefined;
}
function asMode(v: unknown): "online" | "in-home" | undefined {
  return v === "online" || v === "in-home" ? v : undefined;
}
function asLeadStatus(v: unknown): LeadStatus {
  return v === "new" || v === "claimed" || v === "converted" || v === "closed" ? v : "new";
}

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function TutorMarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string>("");
  const [email, setEmail] = useState<string | null>(null);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [filter, setFilter] = useState<"open" | "mine">("open");

  async function refresh(tutorUid: string) {
    setLoading(true);
    try {
      const col = collection(db, "leads");
      const snap =
        filter === "open"
          ? await getDocs(
              query(
                col,
                where("status", "==", "new"),
                where("claimedTutorId", "==", null)
              )
            )
          : await getDocs(
              query(
                col,
                where("claimedTutorId", "==", tutorUid)
              )
            );

      const list: LeadRow[] = snap.docs.map((d) => {
        const data = d.data() as LeadDoc;
        return {
          id: d.id,
          studentName: asString(data.studentName, "Student"),
          yearLevel: asString(data.yearLevel, ""),
          suburb: asNullableString(data.suburb),
          mode: asMode(data.mode),
          subjects: asStringArray(data.subjects),

          status: asLeadStatus(data.status),

          claimedTutorId: asNullableString(data.claimedTutorId),
          claimedTutorName: asNullableString(data.claimedTutorName),
          claimedTutorEmail: asNullableString(data.claimedTutorEmail),

          createdAt: asTimestamp(data.createdAt),
          updatedAt: asTimestamp(data.updatedAt),
        };
      });

      // Sort newest updated/created first
      list.sort((a, b) => {
        const at = a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
        const bt = b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
        return bt - at;
      });

      setRows(list.slice(0, 300));
    } catch (e) {
      console.error("[tutor marketplace] load failed:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
      setEmail(u.email ?? null);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!uid) return;
    refresh(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, filter]);

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Tutor
        </p>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Leads Marketplace</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Browse new leads and claim students you can support. ({count})
            </p>

            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Debug: uid=<span className="font-mono">{uid || "—"}</span>{" "}
              email=<span className="font-mono">{email || "—"}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("open")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold transition",
                filter === "open"
                  ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)]"
                  : "border border-[color:var(--ring)] bg-white text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
              )}
            >
              Open leads
            </button>

            <button
              type="button"
              onClick={() => setFilter("mine")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold transition",
                filter === "mine"
                  ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)]"
                  : "border border-[color:var(--ring)] bg-white text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
              )}
            >
              My claimed
            </button>

            <button
              type="button"
              onClick={() => auth.currentUser && refresh(auth.currentUser.uid)}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              Refresh
            </button>

            <Link
              href="/hub/tutor/students"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              My Students →
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">
            {filter === "open" ? "No open leads right now." : "You haven’t claimed any leads yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">Mode</th>
                  <th className="px-3 py-3">Suburb</th>
                  <th className="px-3 py-3">Subjects</th>
                  <th className="px-3 py-3">Claimed</th>
                  <th className="px-3 py-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t border-[color:var(--ring)]">
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {formatDate(l.createdAt)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-[color:var(--ink)]">
                      {l.studentName}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {l.yearLevel || "—"}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {l.mode ? (l.mode === "in-home" ? "In-home" : "Online") : "—"}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {l.suburb || "—"}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {l.subjects?.length ? l.subjects.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {l.claimedTutorId ? (l.claimedTutorName || "Yes") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/hub/tutor/leads/${l.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-3 text-xs text-[color:var(--muted)]">
              Results are fetched with Firestore rule-compatible filters.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
