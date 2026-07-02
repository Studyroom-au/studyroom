// src/app/hub/admin/leads/[leadId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  writeBatch,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Lead types ───────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "assigned" | "converted";
type LeadStatusRaw = LeadStatus | "claimed" | "closed";

type Lead = {
  parentName: string;
  parentEmail: string;
  parentPhone?: string | null;

  studentName: string;
  yearLevel: string;
  school?: string | null;

  subjects?: string[];
  mode?: "online" | "in-home";
  suburb?: string | null;

  availability?: unknown;
  availabilityBlocks?: string[];

  goals?: string | null;
  challenges?: string | null;

  package?: string | null;

  status: LeadStatus;
  source?: "direct-enrol" | "contact" | "manual";
  sourceDetail?: string | null;

  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;

  clientId?: string | null;
  studentId?: string | null;

  createdAt?: Timestamp;
};

// ─── Tutor Profile V2 types ───────────────────────────────────────────────────

type TutorCap = { subject: string; years: string[]; readiness: string };
type TutorSupportCap = { type: string; readiness: string };
type TutorSlot = { day: string; block: string };

type TutorProfile = {
  profileStatus?: string;
  suburb?: string;
  serviceSuburbs?: string[];
  maxTravelMinutes?: number;
  maxTravelKm?: number;
  travelNotes?: string;
  modes?: string[];
  availabilitySlots?: TutorSlot[];
  availabilityNote?: string;
  desiredHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  maxActiveStudents?: number;
  capabilities?: TutorCap[];
  supportCapabilities?: TutorSupportCap[];
};

type TutorOption = {
  uid: string;
  name: string;
  email?: string;
  profile: TutorProfile | null;
  activeStudentCount: number;
};

type TutorRequest = {
  tutorId: string;
  tutorName: string | null;
  tutorEmail: string | null;
  status: string;
  requestedAt: string | null;
  message: string | null;
};

type MatchLevel = "strong_match" | "possible_match" | "unknown_profile" | "not_recommended";
type MatchResult = { level: MatchLevel; reasons: string[] };

type DetailsForm = {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  yearLevel: string;
  school: string;
  subjectsText: string;
  mode: "" | "online" | "in-home";
  suburb: string;
  package: string;
  availabilityText: string;
  goals: string;
  challenges: string;
};

// ─── Matching helpers ─────────────────────────────────────────────────────────

const SUBJECT_MAP: Record<string, string> = {
  maths: "Mathematics",
  math: "Mathematics",
  mathematics: "Mathematics",
  english: "English",
  science: "Science",
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics",
  hass: "HASS",
  history: "HASS",
  geography: "HASS",
  "health and pe": "Health & PE",
  "health & pe": "Health & PE",
  "health pe": "Health & PE",
  "physical education": "Health & PE",
};

function normalizeSubject(raw: string): string {
  return SUBJECT_MAP[raw.toLowerCase().trim()] ?? raw.trim();
}

function normalizeYearLevel(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (clean === "prep" || clean === "p") return "Prep";
  const m = clean.match(/^(?:year\s*|yr\s*|y)?(\d{1,2})$/);
  if (m) return `Year ${parseInt(m[1], 10).toString().padStart(0, "")}`;
  return raw.trim();
}

const ALL_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

function extractDaysFromBlocks(blocks: string[]): string[] {
  const found = new Set<string>();
  for (const block of blocks) {
    for (const day of ALL_DAYS) {
      if (block.toLowerCase().includes(day.toLowerCase())) found.add(day);
    }
  }
  return [...found];
}

const MATCH_STYLES: Record<MatchLevel, { bg: string; text: string; border: string; label: string }> = {
  strong_match: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Strong match" },
  possible_match: { bg: "#fffbeb", text: "#92400e", border: "#fbbf24", label: "Possible match" },
  unknown_profile: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", label: "No profile" },
  not_recommended: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", label: "Not recommended" },
};

const MATCH_SORT: Record<MatchLevel, number> = {
  strong_match: 0, possible_match: 1, unknown_profile: 2, not_recommended: 3,
};

function computeMatch(
  lead: Lead,
  profile: TutorProfile | null,
  activeStudentCount: number
): MatchResult {
  if (!profile) return { level: "unknown_profile", reasons: ["No Tutor Profile V2 submitted yet"] };

  const reasons: string[] = [];
  let clearSubjectMismatch = false;
  let clearModeMismatch = false;
  let subjectYearMatch = false;
  let modeMatch = false;
  let availMatch = false;

  const leadSubjectsNorm = (lead.subjects ?? []).map(normalizeSubject);
  const leadYearNorm = normalizeYearLevel(lead.yearLevel);
  const leadModeNorm = lead.mode === "in-home" ? "in_home" : lead.mode === "online" ? "online" : null;
  const leadDays = extractDaysFromBlocks(lead.availabilityBlocks ?? []);

  const caps = profile.capabilities ?? [];
  const tutorModes = profile.modes ?? [];
  const tutorSlots = profile.availabilitySlots ?? [];
  const tutorDays = [...new Set(tutorSlots.map((s) => s.day))];

  // ── Subject + year
  if (leadSubjectsNorm.length > 0) {
    if (caps.length > 0) {
      const exactMatches = caps.filter(
        (c) => leadSubjectsNorm.includes(c.subject) && c.years.includes(leadYearNorm)
      );
      const subjectMatches = caps.filter((c) => leadSubjectsNorm.includes(c.subject));
      if (exactMatches.length > 0) {
        subjectYearMatch = true;
        const labels = exactMatches.map(
          (c) =>
            `${c.subject} ${leadYearNorm}${c.readiness === "with_support" ? " (with support)" : ""}`
        );
        reasons.push(`Matches ${labels.join(", ")}`);
      } else if (subjectMatches.length > 0) {
        reasons.push(`${subjectMatches[0].subject} listed but not ${leadYearNorm}`);
      } else {
        clearSubjectMismatch = true;
        reasons.push(`Does not list ${leadSubjectsNorm.slice(0, 2).join(", ")}`);
      }
    } else {
      reasons.push("No academic capabilities declared");
    }
  }

  // ── Mode
  if (leadModeNorm) {
    if (tutorModes.length > 0) {
      if (tutorModes.includes(leadModeNorm)) {
        modeMatch = true;
        reasons.push(`${lead.mode === "in-home" ? "In-home" : "Online"} available`);
      } else {
        clearModeMismatch = true;
        const label = (m: string) => (m === "in_home" ? "In-home" : m === "online" ? "Online" : m);
        reasons.push(`Offers ${tutorModes.map(label).join(", ")} only`);
      }
    } else {
      reasons.push("Mode not declared");
    }
  }

  // ── Availability days
  if (leadDays.length > 0) {
    if (tutorDays.length > 0) {
      const matchDays = leadDays.filter((d) => tutorDays.includes(d));
      if (matchDays.length > 0) {
        availMatch = true;
        reasons.push(`Available ${matchDays.join(", ")}`);
      } else {
        reasons.push(`Availability unclear for ${leadDays.join(", ")}`);
      }
    } else if (profile.availabilityNote) {
      reasons.push("Availability unclear — check notes");
    } else {
      reasons.push("Availability not declared");
    }
  }

  // ── Location (informational)
  const leadSuburb = lead.suburb?.toLowerCase().trim();
  if (leadSuburb) {
    const serviced = (profile.serviceSuburbs ?? []).map((s) => s.toLowerCase().trim());
    if (
      serviced.includes(leadSuburb) ||
      profile.suburb?.toLowerCase().trim() === leadSuburb
    ) {
      reasons.push(`Serves ${lead.suburb}`);
    }
  }

  // ── Determine level
  if (clearSubjectMismatch || clearModeMismatch) {
    const _ps = profile.profileStatus;
    if (!_ps || !["active", "pending_review", "paused", "draft"].includes(_ps)) {
      return { level: "unknown_profile", reasons: [...reasons, "Profile needs admin review"] };
    }
    if (_ps === "draft") {
      return { level: "unknown_profile", reasons: [...reasons, "Profile incomplete"] };
    }
    return { level: "not_recommended", reasons };
  }
  const strong =
    (subjectYearMatch ? 1 : 0) + (modeMatch ? 1 : 0) + (availMatch ? 1 : 0);
  let level: MatchLevel =
    strong >= 2 && subjectYearMatch ? "strong_match" : "possible_match";

  // ── Student capacity check (advisory — never blocks, only downgrades strong→possible)
  const maxStudents = profile.maxActiveStudents;
  if (maxStudents != null) {
    const remaining = maxStudents - activeStudentCount;
    if (remaining <= 0) {
      reasons.push(remaining === 0 ? "At student capacity" : "Over student capacity");
      if (level === "strong_match") level = "possible_match";
    }
  }

  // ── Profile status safety overrides
  const ps = profile.profileStatus;
  if (!ps || !["active", "pending_review", "paused", "draft"].includes(ps)) {
    reasons.push("Profile needs admin review");
    return { level: "unknown_profile", reasons };
  }
  if (ps === "draft") {
    reasons.push("Profile incomplete");
    return { level: "unknown_profile", reasons };
  }
  if (ps === "paused") {
    reasons.push("Profile paused for new matching");
    return { level: "not_recommended", reasons };
  }
  if (ps === "pending_review" && level === "strong_match") {
    level = "possible_match";
    reasons.push("Profile pending admin review");
  }

  return { level, reasons };
}

// ─── Shared field helpers ─────────────────────────────────────────────────────

function safeArr(v: unknown): string[] {
  return Array.isArray(v)
    ? (v.filter((x) => typeof x === "string") as string[])
    : [];
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

// ─── Small UI components ──────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      <span className="text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

function SourceBadge({ source }: { source?: string | null }) {
  if (source === "contact") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
        Inquiry
      </span>
    );
  }
  if (source === "direct-enrol") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
        Enrolment
      </span>
    );
  }
  if (source === "manual") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
        Manual
      </span>
    );
  }
  return null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[color:var(--ring)] bg-white px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
      {children}
    </span>
  );
}

function ProfileStatusChip({ profile }: { profile: TutorProfile | null }) {
  if (!profile) {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        No profile
      </span>
    );
  }
  const ps = profile.profileStatus;
  if (ps === "active") {
    return (
      <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
        Active
      </span>
    );
  }
  if (ps === "pending_review") {
    return (
      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
        Pending review
      </span>
    );
  }
  if (ps === "draft") {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Profile draft
      </span>
    );
  }
  if (ps === "paused") {
    return (
      <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
        Profile paused
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      Profile needs review
    </span>
  );
}

// ─── Tutor match card ─────────────────────────────────────────────────────────

function TutorMatchCard({
  tutor,
  match,
  selected,
  onSelect,
  hasRequest,
}: {
  tutor: TutorOption;
  match: MatchResult;
  selected: boolean;
  onSelect: (uid: string) => void;
  hasRequest?: boolean;
}) {
  const style = MATCH_STYLES[match.level];
  const p = tutor.profile;

  const modeLabel = (m: string) =>
    m === "in_home" ? "In-home" : m === "online" ? "Online" : m === "group" ? "Group" : m;
  const modes = p?.modes?.map(modeLabel).join(" · ") ?? null;

  const tutorDays = p?.availabilitySlots
    ? [...new Set(p.availabilitySlots.map((s) => s.day))]
        .map((d) => d.slice(0, 3))
        .join(", ")
    : null;

  const caps = p?.capabilities ?? [];
  const supportCaps = p?.supportCapabilities ?? [];
  const capSummary = [
    ...caps.slice(0, 3).map((c) => c.subject),
    ...(caps.length > 3 ? [`+${caps.length - 3} more`] : []),
    ...(supportCaps.length > 0 ? [`${supportCaps.length} support`] : []),
  ]
    .filter(Boolean)
    .join(", ");

  const travelSummary =
    p?.maxTravelMinutes || p?.maxTravelKm
      ? [
          p.maxTravelMinutes != null && `${p.maxTravelMinutes} min`,
          p.maxTravelKm != null && `${p.maxTravelKm} km`,
        ]
          .filter(Boolean)
          .join(" / ")
      : null;

  const isPaused = tutor.profile?.profileStatus === "paused";

  return (
    <button
      type="button"
      onClick={() => {
        if (isPaused && !selected) return;
        onSelect(selected ? "" : tutor.uid);
      }}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-teal-400 bg-teal-50 shadow-sm ring-1 ring-teal-300"
          : isPaused
          ? "border-[color:var(--ring)] bg-white cursor-not-allowed opacity-70"
          : "border-[color:var(--ring)] bg-white hover:border-teal-300 hover:shadow-sm"
      }`}
    >
      {/* Name row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[color:var(--ink)]">{tutor.name}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: style.bg,
            color: style.text,
            border: `1px solid ${style.border}`,
          }}
        >
          {style.label}
        </span>
        <ProfileStatusChip profile={tutor.profile} />
        {selected && (
          <span className="ml-auto text-[11px] font-bold text-teal-600">Selected ✓</span>
        )}
        {hasRequest && !selected && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200">
            Requested
          </span>
        )}
      </div>

      {/* Match reasons */}
      {match.reasons.length > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">
          {match.reasons.join(" · ")}
        </p>
      )}

      {/* Profile chips */}
      <div className="mt-2 flex flex-wrap gap-1">
        {p ? (
          <>
            {/* Student capacity — primary signal */}
            {(() => {
              const max = p.maxActiveStudents;
              const count = tutor.activeStudentCount;
              if (max == null) {
                return (
                  <Chip>
                    <span className="text-slate-400">Student capacity not set</span>
                  </Chip>
                );
              }
              const remaining = max - count;
              if (remaining > 0) {
                return (
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                    {remaining} student {remaining === 1 ? "space" : "spaces"} available
                  </span>
                );
              }
              if (remaining === 0) {
                return (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    At student capacity
                  </span>
                );
              }
              return (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  Over capacity
                </span>
              );
            })()}
            {/* Secondary info */}
            {p.suburb && <Chip>{p.suburb}</Chip>}
            {modes && <Chip>{modes}</Chip>}
            {tutorDays && <Chip>Avail: {tutorDays}</Chip>}
            {travelSummary && <Chip>Travel: {travelSummary}</Chip>}
            {capSummary && <Chip>{capSummary}</Chip>}
            {(p.desiredHoursPerWeek != null || p.maxHoursPerWeek != null) && (
              <Chip>{p.desiredHoursPerWeek ?? "?"}–{p.maxHoursPerWeek ?? "?"} hrs/wk</Chip>
            )}
          </>
        ) : (
          <span className="text-xs text-[color:var(--muted)]">No Tutor Profile yet.</span>
        )}
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const leadId = params.leadId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [lead, setLead] = useState<Lead | null>(null);
  const [tutors, setTutors] = useState<TutorOption[]>([]);

  const [status, setStatus] = useState<LeadStatus>("new");
  const [assignedTutorId, setAssignedTutorId] = useState<string>("");
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState<DetailsForm>({
    parentName: "", parentEmail: "", parentPhone: "",
    studentName: "", yearLevel: "", school: "",
    subjectsText: "", mode: "", suburb: "",
    package: "", availabilityText: "", goals: "", challenges: "",
  });
  const [savingDetails, setSavingDetails] = useState(false);
  const [tutorRequests, setTutorRequests] = useState<TutorRequest[]>([]);

  useEffect(() => {
    async function loadRequests() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/leads/${leadId}/requests`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; requests: TutorRequest[] }
          | { ok: false }
          | null;
        if (data?.ok && Array.isArray(data.requests)) {
          setTutorRequests(data.requests);
        }
      } catch (e) {
        console.error("[lead detail] loadRequests failed:", e);
      }
    }
    loadRequests();
  }, [leadId]);

  useEffect(() => {
    async function loadLead() {
      setLoading(true);
      try {
        const ref = doc(db, "leads", leadId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setLead(null);
          return;
        }

        const data = snap.data() as DocumentData;

        const loaded: Lead = {
          parentName: asString(data.parentName),
          parentEmail: asString(data.parentEmail),
          parentPhone: asNullableString(data.parentPhone),

          studentName: asString(data.studentName),
          yearLevel: asString(data.yearLevel),
          school: asNullableString(data.school),

          subjects: safeArr(data.subjects),
          mode: data.mode === "online" || data.mode === "in-home" ? data.mode : undefined,
          suburb: asNullableString(data.suburb),

          availability: data.availability ?? null,
          availabilityBlocks: safeArr(data.availabilityBlocks),

          goals: asNullableString(data.goals),
          challenges: asNullableString(data.challenges),

          package: asNullableString(data.package),

          status:
            (data.status as LeadStatusRaw) === "claimed"
              ? "assigned"
              : (data.status as LeadStatusRaw) === "closed"
              ? "contacted"
              : data.status === "new" ||
                data.status === "contacted" ||
                data.status === "assigned" ||
                data.status === "converted"
              ? data.status
              : "new",

          source:
            data.source === "contact"
              ? "contact"
              : data.source === "manual"
              ? "manual"
              : "direct-enrol",
          sourceDetail: asNullableString(data.sourceDetail),

          assignedTutorId:
            asNullableString(data.assignedTutorId) ?? asNullableString(data.claimedTutorId),
          assignedTutorName:
            asNullableString(data.assignedTutorName) ??
            asNullableString(data.claimedTutorName),
          assignedTutorEmail:
            asNullableString(data.assignedTutorEmail) ??
            asNullableString(data.claimedTutorEmail),

          clientId: asNullableString(data.clientId),
          studentId: asNullableString(data.studentId),

          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
        };

        setLead(loaded);
        setStatus(loaded.status);
        setAssignedTutorId(loaded.assignedTutorId ?? "");
        if (!loaded.assignedTutorId) setTutorPickerOpen(true);
      } finally {
        setLoading(false);
      }
    }
    loadLead();
  }, [leadId]);

  useEffect(() => {
    async function loadTutors() {
      try {
        const rolesSnap = await getDocs(query(collection(db, "roles")));
        const tutorUids = rolesSnap.docs
          .map((d) => ({ uid: d.id, role: (d.data() as DocumentData).role as unknown }))
          .filter((x) => x.role === "tutor")
          .map((x) => x.uid);

        if (tutorUids.length === 0) {
          setTutors([]);
          return;
        }

        const loaded = await Promise.all(
          tutorUids.map(async (uid) => {
            const [usnap, psnap] = await Promise.all([
              getDoc(doc(db, "users", uid)),
              getDoc(doc(db, "tutors", uid)),
            ]);

            const udata = usnap.exists() ? (usnap.data() as DocumentData) : {};
            const name =
              asString(udata.displayName) ||
              asString(udata.name) ||
              asString(udata.fullName) ||
              asString(udata.firstName) ||
              "Tutor";
            const email =
              asString(udata.email) || asString(udata.userEmail) || "";

            const profile: TutorProfile | null = psnap.exists()
              ? (psnap.data() as TutorProfile)
              : null;

            return { uid, name, email, profile };
          })
        );

        // Count active students per tutor from the students collection.
        // One read of all students; count by assignedTutorId client-side.
        const studentsSnap = await getDocs(collection(db, "students"));
        const studentCounts: Record<string, number> = {};
        for (const d of studentsSnap.docs) {
          const tid = asString((d.data() as DocumentData).assignedTutorId);
          if (tid) studentCounts[tid] = (studentCounts[tid] ?? 0) + 1;
        }

        setTutors(
          loaded
            .map((t) => ({ ...t, activeStudentCount: studentCounts[t.uid] ?? 0 }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (e) {
        console.error("[lead detail] loadTutors failed:", e);
        setTutors([]);
      }
    }
    loadTutors();
  }, []);

  // ── Derived state ────────────────────────────────────────────────────────────

  const tutorsWithMatch = useMemo<(TutorOption & { match: MatchResult })[]>(() => {
    return tutors.map((t) => ({
      ...t,
      match: lead
        ? computeMatch(lead, t.profile, t.activeStudentCount)
        : { level: "unknown_profile" as MatchLevel, reasons: [] },
    }));
  }, [lead, tutors]);

  const sortedTutors = useMemo(
    () =>
      [...tutorsWithMatch].sort((a, b) => {
        const diff = MATCH_SORT[a.match.level] - MATCH_SORT[b.match.level];
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }),
    [tutorsWithMatch]
  );

  const assignedTutor = useMemo(
    () => tutorsWithMatch.find((t) => t.uid === assignedTutorId) ?? null,
    [assignedTutorId, tutorsWithMatch]
  );

  const requestedUids = useMemo(
    () => new Set(tutorRequests.map((r) => r.tutorId)),
    [tutorRequests]
  );

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function saveDetails() {
    if (!lead) return;
    setSavingDetails(true);
    try {
      const subjects = detailsForm.subjectsText.split(",").map((s) => s.trim()).filter(Boolean);
      const availabilityBlocks = detailsForm.availabilityText.split(",").map((s) => s.trim()).filter(Boolean);
      const savedMode = (detailsForm.mode === "online" || detailsForm.mode === "in-home")
        ? detailsForm.mode
        : null;

      // Only updates the current leads document — no tutor assignment, no client/student writes.
      // Parent email change only affects this document; auth users are not touched.
      await updateDoc(doc(db, "leads", leadId), {
        parentName: detailsForm.parentName.trim(),
        parentEmail: detailsForm.parentEmail.trim(),
        parentPhone: detailsForm.parentPhone.trim() || null,
        studentName: detailsForm.studentName.trim(),
        yearLevel: detailsForm.yearLevel.trim(),
        school: detailsForm.school.trim() || null,
        subjects,
        mode: savedMode,
        suburb: detailsForm.suburb.trim() || null,
        package: detailsForm.package.trim() || null,
        availabilityBlocks,
        goals: detailsForm.goals.trim() || null,
        challenges: detailsForm.challenges.trim() || null,
        updatedAt: serverTimestamp(),
      });

      setLead((prev) =>
        prev
          ? {
              ...prev,
              parentName: detailsForm.parentName.trim(),
              parentEmail: detailsForm.parentEmail.trim(),
              parentPhone: detailsForm.parentPhone.trim() || null,
              studentName: detailsForm.studentName.trim(),
              yearLevel: detailsForm.yearLevel.trim(),
              school: detailsForm.school.trim() || null,
              subjects,
              mode: savedMode ?? undefined,
              suburb: detailsForm.suburb.trim() || null,
              package: detailsForm.package.trim() || null,
              availabilityBlocks,
              goals: detailsForm.goals.trim() || null,
              challenges: detailsForm.challenges.trim() || null,
            }
          : prev
      );
      setEditingDetails(false);
    } finally {
      setSavingDetails(false);
    }
  }

  async function deleteLead() {
    if (!window.confirm("Delete this lead? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "leads", leadId));
      router.push("/hub/admin/leads");
    } catch (e) {
      console.error(e);
      alert("Delete failed. Check console.");
      setDeleting(false);
    }
  }

  async function saveChanges() {
    if (!lead) return;
    setSaving(true);
    try {
      const leadRef = doc(db, "leads", leadId);
      const batch = writeBatch(db);

      const patch: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (assignedTutorId) {
        const tutorName = assignedTutor?.name ?? null;
        const tutorEmail = assignedTutor?.email ?? null;

        patch.assignedTutorId = assignedTutorId;
        patch.assignedTutorName = tutorName;
        patch.assignedTutorEmail = tutorEmail;

        if (status === "new" || status === "contacted") patch.status = "assigned";

        const clientId = leadId;
        const studentId = leadId;

        const clientRef = doc(db, "clients", clientId);
        const studentRef = doc(db, "students", studentId);

        batch.set(
          clientRef,
          {
            parentName: lead.parentName,
            parentEmail: lead.parentEmail,
            parentPhone: lead.parentPhone ?? null,

            assignedTutorId,
            assignedTutorName: tutorName,
            assignedTutorEmail: tutorEmail,

            status: "active",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        batch.set(
          studentRef,
          {
            clientId,

            studentName: lead.studentName,
            yearLevel: lead.yearLevel,
            school: lead.school ?? null,

            subjects: lead.subjects ?? [],
            mode: lead.mode ?? null,
            suburb: lead.suburb ?? null,

            availability: lead.availability ?? null,
            availabilityBlocks: lead.availabilityBlocks ?? [],

            goals: lead.goals ?? null,
            challenges: lead.challenges ?? null,

            package: lead.package ?? null,

            assignedTutorId,
            assignedTutorName: tutorName,
            assignedTutorEmail: tutorEmail,

            tutorConfirmedAt: null,
            tutorConfirmedBy: null,

            status: "active",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        patch.clientId = clientId;
        patch.studentId = studentId;
      } else {
        patch.assignedTutorId = null;
        patch.assignedTutorName = null;
        patch.assignedTutorEmail = null;
        patch.clientId = null;
        patch.studentId = null;
      }

      batch.update(leadRef, patch);
      await batch.commit();

      router.refresh();
      alert("Saved. Student record created/updated.");
    } catch (e) {
      console.error(e);
      alert("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-[color:var(--muted)]">Lead not found.</p>
          <Link
            href="/hub/admin/leads"
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            ← Back to leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Studyroom · Admin · Lead
            </p>
            <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
              {lead.studentName} · {lead.yearLevel}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[color:var(--muted)]">
                Parent:{" "}
                <span className="font-semibold text-[color:var(--ink)]">{lead.parentName}</span> ·{" "}
                <span className="font-semibold text-[color:var(--brand)]">{lead.parentEmail}</span>
              </p>
              <SourceBadge source={lead.source} />
              {lead.source === "manual" && lead.sourceDetail && (
                <span className="text-xs text-[color:var(--muted)]">via {lead.sourceDetail}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hub/admin/leads"
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
            >
              ← Back to leads
            </Link>
          </div>
        </header>

        {/* Enrolment details card */}
        <section className="mb-6 rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Enrolment details</h2>
            {!editingDetails && (
              <button
                type="button"
                onClick={() => {
                  setDetailsForm({
                    parentName: lead.parentName,
                    parentEmail: lead.parentEmail,
                    parentPhone: lead.parentPhone ?? "",
                    studentName: lead.studentName,
                    yearLevel: lead.yearLevel,
                    school: lead.school ?? "",
                    subjectsText: (lead.subjects ?? []).join(", "),
                    mode: lead.mode ?? "",
                    suburb: lead.suburb ?? "",
                    package: lead.package ?? "",
                    availabilityText: (lead.availabilityBlocks ?? []).join(", "),
                    goals: lead.goals ?? "",
                    challenges: lead.challenges ?? "",
                  });
                  setEditingDetails(true);
                }}
                className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editingDetails ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Parent */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Parent</p>
                  {(["parentName", "parentEmail", "parentPhone"] as const).map((f) => (
                    <label key={f} className="block space-y-0.5">
                      <span className="text-xs text-[color:var(--muted)]">
                        {f === "parentName" ? "Name" : f === "parentEmail" ? "Email" : "Phone"}
                      </span>
                      <input
                        type={f === "parentEmail" ? "email" : f === "parentPhone" ? "tel" : "text"}
                        className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                        value={detailsForm[f]}
                        onChange={(e) => setDetailsForm((p) => ({ ...p, [f]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>

                {/* Student */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Student</p>
                  {(["studentName", "yearLevel", "school"] as const).map((f) => (
                    <label key={f} className="block space-y-0.5">
                      <span className="text-xs text-[color:var(--muted)]">
                        {f === "studentName" ? "Name" : f === "yearLevel" ? "Year level" : "School"}
                      </span>
                      <input
                        className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                        value={detailsForm[f]}
                        onChange={(e) => setDetailsForm((p) => ({ ...p, [f]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>

                {/* Learning */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Learning</p>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Subjects (comma-separated)</span>
                    <input
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.subjectsText}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, subjectsText: e.target.value }))}
                      placeholder="e.g. Maths, English"
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Mode</span>
                    <select
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.mode}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, mode: e.target.value as DetailsForm["mode"] }))}
                    >
                      <option value="">Not set</option>
                      <option value="online">Online</option>
                      <option value="in-home">In-home</option>
                    </select>
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Suburb</span>
                    <input
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.suburb}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, suburb: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Package</span>
                    <input
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.package}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, package: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Context */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Context</p>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Availability (comma-separated)</span>
                    <input
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.availabilityText}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, availabilityText: e.target.value }))}
                      placeholder="e.g. Monday after school, Wednesday evening"
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Goals</span>
                    <textarea
                      rows={2}
                      className="w-full resize-y rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.goals}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, goals: e.target.value }))}
                    />
                  </label>
                  <label className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">Challenges</span>
                    <textarea
                      rows={2}
                      className="w-full resize-y rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={detailsForm.challenges}
                      onChange={(e) => setDetailsForm((p) => ({ ...p, challenges: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={savingDetails}
                  className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingDetails ? "Saving…" : "Save details"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDetails(false)}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:bg-[#d6e5e3]/40"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Parent</p>
                <InfoRow label="Name" value={lead.parentName} />
                <InfoRow label="Email" value={lead.parentEmail} />
                <InfoRow label="Phone" value={lead.parentPhone} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Student</p>
                <InfoRow label="Name" value={lead.studentName} />
                <InfoRow label="Year level" value={lead.yearLevel} />
                <InfoRow label="School" value={lead.school} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Learning</p>
                <InfoRow label="Subjects" value={lead.subjects?.length ? lead.subjects.join(", ") : null} />
                <InfoRow label="Mode" value={lead.mode === "in-home" ? "In-home" : lead.mode === "online" ? "Online" : null} />
                <InfoRow label="Suburb" value={lead.suburb} />
                <InfoRow label="Package" value={lead.package} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Context</p>
                <InfoRow label="Availability" value={lead.availabilityBlocks?.length ? lead.availabilityBlocks.join(", ") : null} />
                <InfoRow label="Goals" value={lead.goals} />
                <InfoRow label="Challenges" value={lead.challenges} />
              </div>
            </div>
          )}
        </section>

        {/* Admin actions */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Admin actions</h2>

          {/* Status */}
          <div className="mt-4 max-w-xs">
            <label className="space-y-2">
              <div className="text-xs font-semibold text-[color:var(--muted)]">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="assigned">Assigned</option>
                <option value="converted">Converted</option>
              </select>
            </label>
          </div>

          {/* Tutor requests */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-[color:var(--muted)]">Tutor requests</p>
            {tutorRequests.length === 0 ? (
              <p className="text-xs text-[color:var(--muted)]">No tutor requests yet.</p>
            ) : (
              <div className="space-y-2">
                {tutorRequests.map((req) => (
                  <div
                    key={req.tutorId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--ring)] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                        {req.tutorName || req.tutorEmail || req.tutorId}
                      </p>
                      {req.tutorEmail && req.tutorName && (
                        <p className="truncate text-xs text-[color:var(--muted)]">{req.tutorEmail}</p>
                      )}
                      {req.requestedAt && (
                        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                          Requested {new Date(req.requestedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAssignedTutorId(req.tutorId); setTutorPickerOpen(false); }}
                      className="shrink-0 rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tutor matching assist */}
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-[color:var(--muted)]">
                {assignedTutorId && !tutorPickerOpen ? "Assigned tutor" : "Assign tutor"}
                {(tutorPickerOpen || !assignedTutorId) && (lead.subjects?.length || lead.yearLevel) ? (
                  <span className="ml-1 font-normal">
                    — matching{" "}
                    {[lead.yearLevel, lead.subjects?.join(", "), lead.mode]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                ) : null}
              </p>
              <div className="flex items-center gap-3">
                {assignedTutorId && !tutorPickerOpen && (
                  <button
                    type="button"
                    onClick={() => { setAssignedTutorId(""); setTutorPickerOpen(true); }}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                  >
                    Clear selection
                  </button>
                )}
                {tutorPickerOpen && assignedTutorId && (
                  <button
                    type="button"
                    onClick={() => setTutorPickerOpen(false)}
                    className="text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--ink)]"
                  >
                    Cancel change
                  </button>
                )}
              </div>
            </div>

            {tutors.length === 0 ? (
              <p className="text-xs text-[color:var(--muted)]">
                No tutors found in <code>roles</code>. Add tutor roles first (role = &quot;tutor&quot;).
              </p>
            ) : tutorPickerOpen ? (
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {sortedTutors.map((t) => (
                  <TutorMatchCard
                    key={t.uid}
                    tutor={t}
                    match={t.match}
                    selected={t.uid === assignedTutorId}
                    onSelect={(uid) => {
                      setAssignedTutorId(uid);
                      if (uid) setTutorPickerOpen(false);
                    }}
                    hasRequest={requestedUids.has(t.uid)}
                  />
                ))}
              </div>
            ) : assignedTutor ? (
              <>
                <TutorMatchCard
                  tutor={assignedTutor}
                  match={assignedTutor.match}
                  selected
                  onSelect={() => setTutorPickerOpen(true)}
                  hasRequest={requestedUids.has(assignedTutor.uid)}
                />
                <button
                  type="button"
                  onClick={() => setTutorPickerOpen(true)}
                  className="mt-2 text-xs font-semibold text-[color:var(--brand)] hover:underline"
                >
                  Change tutor
                </button>
              </>
            ) : assignedTutorId ? (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">Assigned tutor could not be resolved</p>
                  {(lead.assignedTutorName || lead.assignedTutorEmail) && (
                    <p className="mt-1 text-xs text-amber-700">
                      {[lead.assignedTutorName, lead.assignedTutorEmail].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTutorPickerOpen(true)}
                  className="mt-2 text-xs font-semibold text-[color:var(--brand)] hover:underline"
                >
                  Change tutor
                </button>
              </>
            ) : null}

            {assignedTutorId && assignedTutor && tutorPickerOpen && (
              <p className="mt-2 text-xs font-semibold text-teal-700">
                Assigning to: {assignedTutor.name}
                {assignedTutor.email ? ` (${assignedTutor.email})` : ""}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveChanges}
              disabled={saving}
              className={
                "brand-cta rounded-xl px-5 py-2 text-sm font-semibold shadow-sm " +
                (saving ? "opacity-60 cursor-not-allowed" : "")
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </button>

            <button
              type="button"
              onClick={deleteLead}
              disabled={deleting}
              className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete lead"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
