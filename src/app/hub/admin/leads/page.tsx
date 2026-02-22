"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
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
  source?: "direct-enrol" | "contact";
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
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isLeadStatusRaw(v: unknown): v is LeadStatusRaw {
  return (
    v === "new" ||
    v === "contacted" ||
    v === "assigned" ||
    v === "converted" ||
    v === "claimed" ||
    v === "closed"
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
    new: "New",
    contacted: "Contacted",
    assigned: "Assigned",
    converted: "Converted",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}

export default function AdminLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadDoc[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(100));
        const snap = await getDocs(q);

        const rows: LeadDoc[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as LeadData;

          const statusRaw: LeadStatusRaw = isLeadStatusRaw(data.status) ? data.status : "new";
          const status = normalizeStatus(statusRaw);

          const modeRaw = data.mode;
          const mode = isMode(modeRaw) ? modeRaw : undefined;

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
            source: data.source === "contact" ? "contact" : "direct-enrol",
            assignedTutorId: asNullableString(data.assignedTutorId),
            assignedTutorName: asNullableString(data.assignedTutorName),
            assignedTutorEmail: asNullableString(data.assignedTutorEmail),
            claimedTutorId: asNullableString(data.claimedTutorId),
            claimedTutorName: asNullableString(data.claimedTutorName),
            claimedTutorEmail: asNullableString(data.claimedTutorEmail),
            createdAt: asTimestamp(data.createdAt),
          };
        });

        setLeads(rows);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const counts = useMemo(() => {
    const base = { all: leads.length, new: 0, contacted: 0, assigned: 0, converted: 0 };
    for (const l of leads) {
      base[l.status] += 1;
    }
    return base;
  }, [leads]);

  const filterButtons: Array<[FilterKey, string]> = [
    ["all", `All (${counts.all})`],
    ["new", `New (${counts.new})`],
    ["contacted", `Contacted (${counts.contacted})`],
    ["assigned", `Assigned (${counts.assigned})`],
    ["converted", `Converted (${counts.converted})`],
  ];

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Leads</h1>
            <p className="text-sm text-[color:var(--muted)]">
              New enrolments from <span className="font-semibold">/enrol</span> and future contact funnel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterButtons.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  (filter === key
                    ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)]"
                    : "border border-[color:var(--ring)] bg-white text-[color:var(--brand)] hover:bg-[#d6e5e3]/40") +
                  " rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition"
                }
              >
                {label}
              </button>
            ))}

            <Link
              href="/hub/admin"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
            >
              Admin Home
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">No leads found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="px-3 py-3">Created</th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Year</th>
                    <th className="px-3 py-3">Parent</th>
                    <th className="px-3 py-3">Mode</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Assigned</th>
                    <th className="px-3 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-t border-[color:var(--ring)]">
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">{formatDate(l.createdAt)}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-[color:var(--ink)]">
                        {l.studentName || "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">{l.yearLevel || "—"}</td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        <div className="font-semibold text-[color:var(--ink)]">{l.parentName || "—"}</div>
                        <div className="text-xs">{l.parentEmail || ""}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {l.mode ? (l.mode === "in-home" ? "In-home" : "Online") : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={l.status} />
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {l.assignedTutorName || l.claimedTutorName || l.assignedTutorEmail || l.claimedTutorEmail ? (
                          <span className="font-semibold text-[color:var(--ink)]">
                            {l.assignedTutorName || l.claimedTutorName || l.assignedTutorEmail || l.claimedTutorEmail}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/hub/admin/leads/${l.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                        >
                          Open →
                        </Link>
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
