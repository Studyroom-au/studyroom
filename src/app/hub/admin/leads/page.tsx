//src/hub/admin/leads/page
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type LeadStatus = "new" | "contacted" | "assigned" | "converted";
type LeadStatusRaw = LeadStatus | "claimed" | "closed";

type LeadDoc = {
  id: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string | null;
  studentName: string;
  yearLevel: string;
  subjects?: string[];
  mode?: "online" | "in-home";
  suburb?: string | null;
  status: LeadStatus;
  source?: "direct-enrol" | "contact" | "manual";
  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
  claimedTutorId?: string | null;
  claimedTutorName?: string | null;
  claimedTutorEmail?: string | null;
  createdAt?: Timestamp;
};

type LeadData = {
  parentName?: unknown;
  parentEmail?: unknown;
  parentPhone?: unknown;
  studentName?: unknown;
  yearLevel?: unknown;
  subjects?: unknown;
  mode?: unknown;
  suburb?: unknown;
  status?: unknown;
  source?: unknown;
  assignedTutorId?: unknown;
  assignedTutorName?: unknown;
  assignedTutorEmail?: unknown;
  claimedTutorId?: unknown;
  claimedTutorName?: unknown;
  claimedTutorEmail?: unknown;
  createdAt?: unknown;
};

type FilterKey = "all" | LeadStatus;

function formatDate(ts?: Timestamp) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isLeadStatusRaw(v: unknown): v is LeadStatusRaw {
  return (
    v === "new" || v === "contacted" || v === "assigned" ||
    v === "converted" || v === "claimed" || v === "closed"
  );
}

function normalizeStatus(v: LeadStatusRaw): LeadStatus {
  if (v === "claimed") return "assigned";
  if (v === "closed") return "contacted";
  return v;
}

function isMode(v: unknown): v is "online" | "in-home" {
  return v === "online" || v === "in-home";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function asString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asTimestamp(v: unknown): Timestamp | undefined {
  return v instanceof Timestamp ? v : undefined;
}

function StatusPill({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, string> = {
    new: "bg-amber-50 text-amber-900 ring-amber-200",
    contacted: "bg-sky-50 text-sky-900 ring-sky-200",
    assigned: "bg-purple-50 text-purple-900 ring-purple-200",
    converted: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  };
  const label: Record<LeadStatus, string> = {
    new: "New", contacted: "Contacted", assigned: "Assigned", converted: "Converted",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (source === "contact") {
    return <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">Inquiry</span>;
  }
  if (source === "manual") {
    return <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">Manual</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Enrolment</span>;
}

export default function AdminLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch all documents without orderBy to avoid silently excluding docs with missing createdAt
        const snap = await getDocs(collection(db, "leads"));
        console.log("[leads] raw docs from Firestore:", snap.docs.length);

        const rows: LeadDoc[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as LeadData;

          const statusRaw: LeadStatusRaw = isLeadStatusRaw(data.status) ? data.status : "new";
          const status = normalizeStatus(statusRaw);
          const mode = isMode(data.mode) ? data.mode : undefined;
          const sourceRaw = data.source;
          const source: LeadDoc["source"] =
            sourceRaw === "contact" ? "contact" : sourceRaw === "manual" ? "manual" : "direct-enrol";

          return {
            id: docSnap.id,
            parentName: asString(data.parentName, ""),
            parentEmail: asString(data.parentEmail, ""),
            parentPhone: asNullableString(data.parentPhone),
            studentName: asString(data.studentName, ""),
            yearLevel: asString(data.yearLevel, ""),
            subjects: isStringArray(data.subjects) ? data.subjects : [],
            mode,
            suburb: asNullableString(data.suburb),
            status,
            source,
            assignedTutorId: asNullableString(data.assignedTutorId),
            assignedTutorName: asNullableString(data.assignedTutorName),
            assignedTutorEmail: asNullableString(data.assignedTutorEmail),
            claimedTutorId: asNullableString(data.claimedTutorId),
            claimedTutorName: asNullableString(data.claimedTutorName),
            claimedTutorEmail: asNullableString(data.claimedTutorEmail),
            createdAt: asTimestamp(data.createdAt),
          };
        });

        // Sort client-side: docs with createdAt descending; missing createdAt falls to bottom
        rows.sort((a, b) => {
          const at = a.createdAt?.toMillis() ?? 0;
          const bt = b.createdAt?.toMillis() ?? 0;
          return bt - at;
        });

        setLeads(rows);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this lead? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "leads", id));
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error(e);
      alert("Delete failed. Check console.");
    } finally {
      setDeletingId(null);
    }
  }

  const counts = useMemo(() => {
    const base = { all: leads.length, new: 0, contacted: 0, assigned: 0, converted: 0 };
    for (const l of leads) base[l.status] += 1;
    return base;
  }, [leads]);

  const filtered = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  type ChipDef = { key: FilterKey; label: string; count: number; active: string; inactive: string };
  const chips: ChipDef[] = [
    { key: "all", label: "All", count: counts.all, active: "bg-[color:var(--brand)] text-white", inactive: "border border-[color:var(--ring)] bg-white text-[color:var(--ink)] hover:bg-[#d6e5e3]/40" },
    { key: "new", label: "New", count: counts.new, active: "bg-amber-500 text-white", inactive: "bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100" },
    { key: "contacted", label: "Contacted", count: counts.contacted, active: "bg-sky-500 text-white", inactive: "bg-sky-50 text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100" },
    { key: "assigned", label: "Assigned", count: counts.assigned, active: "bg-purple-500 text-white", inactive: "bg-purple-50 text-purple-800 ring-1 ring-purple-200 hover:bg-purple-100" },
    { key: "converted", label: "Converted", count: counts.converted, active: "bg-emerald-500 text-white", inactive: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100" },
  ];

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Page header */}
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Leads</h1>
            <p className="text-sm text-[color:var(--muted)]">
              Enrolments from <span className="font-semibold">/enrol</span> and contact inquiries.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub/admin/leads/new"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
            >
              + New Lead
            </Link>
            <Link
              href="/hub/admin"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
            >
              Admin Home
            </Link>
          </div>
        </header>

        {/* Status chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition " +
                (filter === chip.key ? chip.active : chip.inactive)
              }
            >
              {chip.label} <span className="ml-1 opacity-75">{chip.count}</span>
            </button>
          ))}
        </div>

        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">No leads found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="px-3 py-3 whitespace-nowrap">Date</th>
                    <th className="px-3 py-3">Student / Parent</th>
                    <th className="px-3 py-3 whitespace-nowrap">Year</th>
                    <th className="px-3 py-3">Subjects</th>
                    <th className="px-3 py-3 whitespace-nowrap">Mode</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Assigned</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-t border-[color:var(--ring)] align-top">
                      {/* Date */}
                      <td className="px-3 py-3 text-xs text-[color:var(--muted)] whitespace-nowrap">
                        {formatDate(l.createdAt)}
                      </td>

                      {/* Student + parent (merged) */}
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[color:var(--ink)]">{l.studentName || "—"}</div>
                        <div className="text-xs text-[color:var(--muted)]">
                          {l.parentName || ""}
                          {l.parentEmail ? <> · <span className="text-[color:var(--brand)]">{l.parentEmail}</span></> : null}
                        </div>
                      </td>

                      {/* Year */}
                      <td className="px-3 py-3 text-[color:var(--muted)]">{l.yearLevel || "—"}</td>

                      {/* Subjects */}
                      <td className="px-3 py-3 text-[color:var(--muted)] max-w-[140px]">
                        <span className="line-clamp-2">{l.subjects?.length ? l.subjects.join(", ") : "—"}</span>
                      </td>

                      {/* Mode */}
                      <td className="px-3 py-3 text-[color:var(--muted)] whitespace-nowrap">
                        {l.mode === "in-home" ? "In-home" : l.mode === "online" ? "Online" : "—"}
                      </td>

                      {/* Source */}
                      <td className="px-3 py-3">
                        <SourceBadge source={l.source} />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <StatusPill status={l.status} />
                      </td>

                      {/* Assigned tutor */}
                      <td className="px-3 py-3 text-[color:var(--muted)]">
                        {l.assignedTutorName || l.claimedTutorName || l.assignedTutorEmail || l.claimedTutorEmail
                          ? <span className="font-semibold text-[color:var(--ink)]">{l.assignedTutorName || l.claimedTutorName || l.assignedTutorEmail || l.claimedTutorEmail}</span>
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/hub/admin/leads/${l.id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                          >
                            Open →
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(l.id)}
                            disabled={deletingId === l.id}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            {deletingId === l.id ? "…" : "Delete"}
                          </button>
                        </div>
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
