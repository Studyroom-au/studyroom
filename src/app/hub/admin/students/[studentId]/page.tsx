//src/app/hub/admin/students/[studentId]/page
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  updateDoc,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { computeAssignedTutorIds, shouldMirrorSingularTutor } from "@/lib/studyroom/clientTutorSync";
import { formatPlanLabel } from "@/lib/studyroom/billing";

// ─── Student / client / session types ────────────────────────────────────────

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
  subjects?: string[];
  goals?: string | null;
  challenges?: string | null;
  mode?: string | null;
  suburb?: string | null;
  addressLine1?: string | null;
  postcode?: string | null;
  activePlanId?: string | null;
  status?: string;
};

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
};

type PlanDoc = {
  id: string;
  type?: string;
  status?: string;
  mode?: string;
  standardPriceCents?: number | null;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number | null;
  discountAmountCents?: number | null;
  finalPriceCents?: number | null;
  discountReason?: string | null;
  renewedFromPlanId?: string | null;
  carryOverSessions?: number;
  createdAt?: Timestamp;
};

type EntitlementDoc = {
  remainingSessions?: number;
  bonusRemaining?: number;
};

type SessionDoc = {
  startAt?: Timestamp;
  endAt?: Timestamp;
  status?: string;
  modality?: string | null;
  durationMinutes?: number;
  notes?: string | null;
};

// The original lead/inquiry this student was converted from (Release 1B,
// final polish item 7) — read-only, historical context only. Never used to
// overwrite anything on the student/client doc; the reverse is also true,
// editing the student/client record here never touches the original lead.
type InquiryLeadDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  subjects?: string[];
  mode?: string | null;
  suburb?: string | null;
  goals?: string | null;
  challenges?: string | null;
  package?: string | null;
  source?: string;
  createdAt?: Timestamp;
};

function fmtDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleString();
}

function fmtCents(cents?: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function describeDiscount(p: PlanDoc) {
  if (!p.discountType) return null;
  const amount = p.discountType === "percent" ? `${p.discountValue}%` : fmtCents(p.discountValue);
  return `${amount} off${p.discountReason ? ` (${p.discountReason})` : ""}`;
}

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
  email: string;
  profile: TutorProfile | null;
  activeStudentCount: number;
};

type MatchLevel = "strong_match" | "possible_match" | "unknown_profile" | "not_recommended";
type MatchResult = { level: MatchLevel; reasons: string[] };

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
  if (m) return `Year ${parseInt(m[1], 10)}`;
  return raw.trim();
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

type MatchInput = {
  subjects?: string[];
  yearLevel?: string;
  mode?: string | null;
  suburb?: string | null;
};

function computeMatch(
  student: MatchInput,
  profile: TutorProfile | null,
  activeStudentCount: number
): MatchResult {
  if (!profile) return { level: "unknown_profile", reasons: ["No Tutor Profile V2 submitted yet"] };

  const reasons: string[] = [];
  let clearSubjectMismatch = false;
  let clearModeMismatch = false;
  let subjectYearMatch = false;
  let modeMatch = false;

  const subjectsNorm = (student.subjects ?? []).map(normalizeSubject);
  const yearNorm = student.yearLevel ? normalizeYearLevel(student.yearLevel) : null;
  const modeRaw = student.mode ?? null;
  const modeNorm =
    modeRaw === "in-home" || modeRaw === "in_home"
      ? "in_home"
      : modeRaw === "online"
      ? "online"
      : null;

  const caps = profile.capabilities ?? [];
  const tutorModes = profile.modes ?? [];

  // ── Subject + year
  if (subjectsNorm.length > 0) {
    if (caps.length > 0) {
      const exactMatches = caps.filter(
        (c) =>
          subjectsNorm.includes(c.subject) &&
          (yearNorm ? c.years.includes(yearNorm) : true)
      );
      const subjectMatches = caps.filter((c) => subjectsNorm.includes(c.subject));
      if (exactMatches.length > 0) {
        subjectYearMatch = true;
        const labels = exactMatches.map(
          (c) =>
            `${c.subject}${yearNorm ? ` ${yearNorm}` : ""}${c.readiness === "with_support" ? " (with support)" : ""}`
        );
        reasons.push(`Matches ${labels.join(", ")}`);
      } else if (subjectMatches.length > 0) {
        reasons.push(
          yearNorm
            ? `${subjectMatches[0].subject} listed but not ${yearNorm}`
            : `${subjectMatches[0].subject} listed`
        );
      } else {
        clearSubjectMismatch = true;
        reasons.push(`Does not list ${subjectsNorm.slice(0, 2).join(", ")}`);
      }
    } else {
      reasons.push("No academic capabilities declared");
    }
  }

  // ── Mode
  if (modeNorm) {
    if (tutorModes.length > 0) {
      if (tutorModes.includes(modeNorm)) {
        modeMatch = true;
        reasons.push(`${modeRaw === "in-home" || modeRaw === "in_home" ? "In-home" : "Online"} available`);
      } else {
        clearModeMismatch = true;
        const label = (m: string) => (m === "in_home" ? "In-home" : m === "online" ? "Online" : m);
        reasons.push(`Offers ${tutorModes.map(label).join(", ")} only`);
      }
    } else {
      reasons.push("Mode not declared");
    }
  }

  // ── Location (informational)
  const studentSuburb = student.suburb?.toLowerCase().trim();
  if (studentSuburb) {
    const serviced = (profile.serviceSuburbs ?? []).map((s) => s.toLowerCase().trim());
    if (
      serviced.includes(studentSuburb) ||
      profile.suburb?.toLowerCase().trim() === studentSuburb
    ) {
      reasons.push(`Serves ${student.suburb}`);
    }
  }

  // ── Level
  if (clearSubjectMismatch || clearModeMismatch) {
    // Check capacity before returning not_recommended
    const maxStudents = profile.maxActiveStudents;
    if (maxStudents != null && activeStudentCount >= maxStudents) {
      reasons.push(activeStudentCount === maxStudents ? "At student capacity" : "Over student capacity");
    }
    const _ps = profile.profileStatus;
    if (!_ps || !["active", "pending_review", "paused", "draft"].includes(_ps)) {
      return { level: "unknown_profile", reasons: [...reasons, "Profile needs admin review"] };
    }
    if (_ps === "draft") {
      return { level: "unknown_profile", reasons: [...reasons, "Profile incomplete"] };
    }
    return { level: "not_recommended", reasons };
  }

  const strong = (subjectYearMatch ? 1 : 0) + (modeMatch ? 1 : 0);
  let level: MatchLevel = strong >= 2 && subjectYearMatch ? "strong_match" : "possible_match";

  // ── Student capacity check
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

// ─── Small UI components ──────────────────────────────────────────────────────

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

function TutorMatchCard({
  tutor,
  match,
  selected,
  onSelect,
}: {
  tutor: TutorOption;
  match: MatchResult;
  selected: boolean;
  onSelect: (uid: string) => void;
}) {
  const style = MATCH_STYLES[match.level];
  const p = tutor.profile;

  const modeLabel = (m: string) =>
    m === "in_home" ? "In-home" : m === "online" ? "Online" : m === "group" ? "Group" : m;
  const modes = p?.modes?.map(modeLabel).join(" · ") ?? null;

  const tutorDays = p?.availabilitySlots
    ? [...new Set(p.availabilitySlots.map((s) => s.day))].map((d) => d.slice(0, 3)).join(", ")
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
        <span className="text-sm font-semibold text-[color:var(--ink)]">{tutor.name || tutor.email}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
        >
          {style.label}
        </span>
        <ProfileStatusChip profile={tutor.profile} />
        {selected && (
          <span className="ml-auto text-[11px] font-bold text-teal-600">Selected ✓</span>
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
            {/* Student capacity — primary */}
            {(() => {
              const max = p.maxActiveStudents;
              const count = tutor.activeStudentCount;
              if (max == null) {
                return <Chip><span className="text-slate-400">Student capacity not set</span></Chip>;
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

export default function AdminStudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [inquiryLead, setInquiryLead] = useState<InquiryLeadDoc | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);
  const [tutorOptions, setTutorOptions] = useState<TutorOption[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<string>("");
  const [savingTutor, setSavingTutor] = useState(false);
  const [tutorSaved, setTutorSaved] = useState(false);
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    studentName: "", yearLevel: "", school: "",
    subjectsText: "", mode: "", suburb: "",
    postcode: "", addressLine1: "", goals: "", challenges: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Arrangement (Release 1B, Stage 6) ──────────────────────────────────────
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementDoc | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanDoc[]>([]);
  const [arrangementMsg, setArrangementMsg] = useState<string | null>(null);
  const [arrangementBusy, setArrangementBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [createForm, setCreateForm] = useState({ planType: "package_5" as "casual" | "package_5" | "package_10", discountType: "" as "" | "percent" | "fixed", discountValue: "", discountReason: "" });
  const [renewForm, setRenewForm] = useState({ newPlanType: "package_10" as "package_5" | "package_10", carryOverSessions: "0", discountType: "" as "" | "percent" | "fixed", discountValue: "", discountReason: "" });
  const [correctForm, setCorrectForm] = useState({ delta: "", reason: "" });

  // ── Removal lifecycle (Release 1B, Stage 6d) ───────────────────────────────
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingStudent, setDeletingStudent] = useState(false);

  async function reloadArrangement(activePlanId: string | null | undefined) {
    if (!activePlanId) {
      setPlan(null);
      setEntitlement(null);
      return;
    }
    const [planSnap, entitlementSnap] = await Promise.all([
      getDoc(doc(db, "plans", activePlanId)),
      getDoc(doc(db, "entitlements", activePlanId)),
    ]);
    setPlan(planSnap.exists() ? ({ id: planSnap.id, ...(planSnap.data() as Omit<PlanDoc, "id">) }) : null);
    setEntitlement(entitlementSnap.exists() ? (entitlementSnap.data() as EntitlementDoc) : null);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const studentSnap = await getDoc(doc(db, "students", studentId));
        if (!studentSnap.exists()) {
          setStudent(null);
          setClient(null);
          setSessions([]);
          return;
        }

        const s = studentSnap.data() as StudentDoc;
        setStudent(s);
        setSelectedTutorId(s.assignedTutorId ?? "");
        if (!s.assignedTutorId) setTutorPickerOpen(true);

        if (s.clientId) {
          const clientSnap = await getDoc(doc(db, "clients", s.clientId));
          setClient(clientSnap.exists() ? (clientSnap.data() as ClientDoc) : null);
        } else {
          setClient(null);
        }

        // Original lead/inquiry this student was converted from, if any
        // (Release 1B, final polish item 7) — read-only historical context.
        const leadSnap = await getDocs(
          query(collection(db, "leads"), where("studentId", "==", studentId))
        );
        setInquiryLead(leadSnap.empty ? null : (leadSnap.docs[0].data() as InquiryLeadDoc));

        await reloadArrangement(s.activePlanId);
        const planHistorySnap = await getDocs(
          query(collection(db, "plans"), where("studentId", "==", studentId))
        );
        const historyRows = planHistorySnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PlanDoc, "id">) }))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setPlanHistory(historyRows);

        const sessionSnap = await getDocs(
          query(collection(db, "sessions"), where("studentId", "==", studentId))
        );
        const rows = sessionSnap.docs.map((d) => ({ id: d.id, data: d.data() as SessionDoc }));
        rows.sort((a, b) => (b.data.startAt?.toMillis() || 0) - (a.data.startAt?.toMillis() || 0));
        setSessions(rows);

        // ── Load tutors with V2 profiles and student counts ──────────────────
        const rolesSnap = await getDocs(
          query(collection(db, "roles"), where("role", "==", "tutor"))
        );
        const tutorUids = rolesSnap.docs.map((d) => d.id);

        // Count assigned students per tutor from the students collection.
        // No status filter — counts all assigned students. Labelled "assigned".
        const allStudentsSnap = await getDocs(collection(db, "students"));
        const studentCounts: Record<string, number> = {};
        for (const d of allStudentsSnap.docs) {
          const tid = String((d.data() as DocumentData).assignedTutorId ?? "");
          if (tid) studentCounts[tid] = (studentCounts[tid] ?? 0) + 1;
        }

        const options = await Promise.all(
          tutorUids.map(async (uid) => {
            try {
              const [userSnap, profileSnap] = await Promise.all([
                getDoc(doc(db, "users", uid)),
                getDoc(doc(db, "tutors", uid)),
              ]);
              const data = userSnap.exists()
                ? (userSnap.data() as { name?: string; displayName?: string; email?: string })
                : {};
              const profile: TutorProfile | null = profileSnap.exists()
                ? (profileSnap.data() as TutorProfile)
                : null;
              return {
                uid,
                name: data.name || data.displayName || "",
                email: data.email || "",
                profile,
                activeStudentCount: studentCounts[uid] ?? 0,
              } satisfies TutorOption;
            } catch {
              return {
                uid,
                name: "",
                email: "",
                profile: null,
                activeStudentCount: studentCounts[uid] ?? 0,
              } satisfies TutorOption;
            }
          })
        );
        options.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        setTutorOptions(options);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  // ── Save student profile ──────────────────────────────────────────────────────

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const subjects = profileForm.subjectsText.split(",").map((s) => s.trim()).filter(Boolean);
      // Only updates this student document — no client sync, no tutor writes.
      await updateDoc(doc(db, "students", studentId), {
        studentName: profileForm.studentName.trim() || null,
        yearLevel: profileForm.yearLevel.trim() || null,
        school: profileForm.school.trim() || null,
        subjects,
        mode: profileForm.mode || null,
        suburb: profileForm.suburb.trim() || null,
        postcode: profileForm.postcode.trim() || null,
        addressLine1: profileForm.addressLine1.trim() || null,
        goals: profileForm.goals.trim() || null,
        challenges: profileForm.challenges.trim() || null,
        updatedAt: serverTimestamp(),
      });
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              studentName: profileForm.studentName.trim() || undefined,
              yearLevel: profileForm.yearLevel.trim() || undefined,
              school: profileForm.school.trim() || null,
              subjects,
              mode: profileForm.mode || null,
              suburb: profileForm.suburb.trim() || null,
              postcode: profileForm.postcode.trim() || null,
              addressLine1: profileForm.addressLine1.trim() || null,
              goals: profileForm.goals.trim() || null,
              challenges: profileForm.challenges.trim() || null,
            }
          : prev
      );
      setEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Arrangement actions (Release 1B, Stage 6/6b) ───────────────────────────
  // All commercial writes go through the server routes built in Stage 5 —
  // never a direct client Firestore write to plans/entitlements/invoices.

  function discountValueForApi(discountType: "" | "percent" | "fixed", raw: string): number | null {
    if (!discountType) return null;
    if (discountType === "fixed") return Math.round(Number(raw) * 100); // admin enters dollars
    return Number(raw); // percent entered/sent as-is
  }

  async function handleCreatePackage() {
    if (!student || !auth.currentUser) return;
    setArrangementBusy(true);
    setArrangementMsg(null);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/plans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          clientId: student.clientId,
          studentId,
          tutorId: student.assignedTutorId ?? null,
          tutorEmail: student.assignedTutorEmail ?? null,
          mode: student.mode ?? "in_home",
          planType: createForm.planType,
          discountType: createForm.discountType || null,
          discountValue: discountValueForApi(createForm.discountType, createForm.discountValue),
          discountReason: createForm.discountReason || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || "Failed to create package.");
      setShowCreateForm(false);
      setArrangementMsg("Package created.");
      const freshStudent = await getDoc(doc(db, "students", studentId));
      const activePlanId = (freshStudent.data() as StudentDoc | undefined)?.activePlanId;
      await reloadArrangement(activePlanId);
    } catch (e) {
      setArrangementMsg(e instanceof Error ? e.message : "Failed to create package.");
    } finally {
      setArrangementBusy(false);
    }
  }

  async function handleRenew() {
    if (!plan || !auth.currentUser) return;
    setArrangementBusy(true);
    setArrangementMsg(null);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/plans/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          oldPlanId: plan.id,
          newPlanType: renewForm.newPlanType,
          carryOverSessions: Number(renewForm.carryOverSessions) || 0,
          discountType: renewForm.discountType || null,
          discountValue: discountValueForApi(renewForm.discountType, renewForm.discountValue),
          discountReason: renewForm.discountReason || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || "Failed to renew package.");
      setShowRenewForm(false);
      setArrangementMsg("Package renewed.");
      await reloadArrangement(result.newPlanId);
      const historySnap = await getDocs(query(collection(db, "plans"), where("studentId", "==", studentId)));
      setPlanHistory(
        historySnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PlanDoc, "id">) }))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      );
    } catch (e) {
      setArrangementMsg(e instanceof Error ? e.message : "Failed to renew package.");
    } finally {
      setArrangementBusy(false);
    }
  }

  async function handleCorrectBalance() {
    if (!plan || !auth.currentUser) return;
    const delta = Number(correctForm.delta);
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      setArrangementMsg("Enter a non-zero whole number for the correction.");
      return;
    }
    if (!correctForm.reason.trim()) {
      setArrangementMsg("A reason is required for a balance correction.");
      return;
    }
    const resultingBalance = (entitlement?.remainingSessions ?? 0) + delta;
    const confirmed = confirm(
      `This will change the remaining balance from ${entitlement?.remainingSessions ?? 0} to ${resultingBalance}. Continue?`
    );
    if (!confirmed) return;

    setArrangementBusy(true);
    setArrangementMsg(null);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/entitlements/${plan.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ delta, reason: correctForm.reason.trim() }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || "Failed to correct balance.");
      setShowCorrectForm(false);
      setCorrectForm({ delta: "", reason: "" });
      setArrangementMsg(`Balance corrected: ${result.previousRemainingSessions} → ${result.newRemainingSessions}.`);
      await reloadArrangement(plan.id);
    } catch (e) {
      setArrangementMsg(e instanceof Error ? e.message : "Failed to correct balance.");
    } finally {
      setArrangementBusy(false);
    }
  }

  // ── Removal lifecycle (Release 1B, Stage 6d) ───────────────────────────────
  // Root cause traced: nothing ever set or checked a student's `status` — the
  // field exists (written "active" at creation) but no tutor-facing list
  // filtered on it, and the only "remove" action anywhere was deleting the
  // parent CLIENT doc, which never touched the student doc at all — leaving
  // assignedTutorId intact and the student looking fully active forever.

  async function handleEndStudent() {
    if (!student) return;
    const confirmed = confirm(
      "End this student? They will disappear from the tutor's active list. Session, billing, and package history is kept — this does not delete anything."
    );
    if (!confirmed) return;
    setStatusBusy(true);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, "students", studentId), {
        status: "ended",
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStudent((prev) => (prev ? { ...prev, status: "ended" } : prev));
      setStatusMsg("Student marked as ended.");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleRestoreStudent() {
    if (!student) return;
    setStatusBusy(true);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, "students", studentId), {
        status: "active",
        endedAt: null,
        updatedAt: serverTimestamp(),
      });
      setStudent((prev) => (prev ? { ...prev, status: "active" } : prev));
      setStatusMsg("Student restored to active.");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  // ── Paused status (Release 1B, final polish item 8) ─────────────────────────
  // Distinct from "ended": a pause is temporary and reversible. Tutor/plan/
  // balance/pricing history/notes/sessions are all left completely untouched
  // — pausing never consumes or resets an entitlement, it only changes how
  // this student appears in tutor-facing active lists. Any future scheduled
  // sessions are surfaced as a warning, never silently cancelled — the admin
  // decides what to do with them separately.
  async function handlePauseStudent() {
    if (!student) return;
    const now = Timestamp.now();
    const upcoming = sessions.filter(
      (s) => s.data.status === "scheduled" && s.data.startAt && s.data.startAt.toMillis() > now.toMillis()
    );
    const warning =
      upcoming.length > 0
        ? `This student has ${upcoming.length} upcoming scheduled session${upcoming.length === 1 ? "" : "s"} — pausing will NOT cancel ${upcoming.length === 1 ? "it" : "them"}. You'll need to reschedule or cancel separately if needed. `
        : "";
    const confirmed = confirm(
      `${warning}Pause this student? They'll disappear from the tutor's active list but everything (tutor, package, balance, pricing, notes, session history) stays exactly as-is. You can resume at any time.`
    );
    if (!confirmed) return;
    setStatusBusy(true);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, "students", studentId), {
        status: "paused",
        pausedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStudent((prev) => (prev ? { ...prev, status: "paused" } : prev));
      setStatusMsg("Student paused.");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleResumeStudent() {
    if (!student) return;
    setStatusBusy(true);
    setStatusMsg(null);
    try {
      await updateDoc(doc(db, "students", studentId), {
        status: "active",
        pausedAt: null,
        updatedAt: serverTimestamp(),
      });
      setStudent((prev) => (prev ? { ...prev, status: "active" } : prev));
      setStatusMsg("Student resumed to active.");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handlePermanentDeleteStudent() {
    if (!student) return;
    // Guardrail: refuse if there's any real session, package, or invoice
    // history — permanent delete is only for genuine mistakes/test records.
    if (sessions.length > 0 || planHistory.length > 0) {
      setStatusMsg(
        "This student has real session/package history and cannot be permanently deleted — use \"End student\" instead."
      );
      return;
    }
    const expected = (student.studentName || studentId).trim().toLowerCase();
    if (deleteConfirmText.trim().toLowerCase() !== expected) {
      setStatusMsg("Type the student's name exactly as shown to confirm permanent deletion.");
      return;
    }
    setDeletingStudent(true);
    setStatusMsg(null);
    try {
      await deleteDoc(doc(db, "students", studentId));
      window.location.href = "/hub/admin/clients";
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to permanently delete student.");
      setDeletingStudent(false);
    }
  }

  // ── Save tutor assignment — unchanged logic ───────────────────────────────────

  async function handleSaveTutor() {
    const tutor = tutorOptions.find((t) => t.uid === selectedTutorId) ?? null;
    setSavingTutor(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "students", studentId), {
        assignedTutorId: tutor?.uid ?? null,
        assignedTutorName: tutor?.name ?? null,
        assignedTutorEmail: tutor?.email ?? null,
        updatedAt: serverTimestamp(),
      });

      if (student?.clientId) {
        // Multi-student-family correction (pre-Stage-6): recompute the full
        // set of tutors assigned to ANY student under this client (siblings
        // included) rather than clobbering the client's tutor pointer with
        // just this one student's tutor. Student-level assignment remains
        // authoritative — this is a derived read, never the other way around.
        const siblingsSnap = await getDocs(
          query(collection(db, "students"), where("clientId", "==", student.clientId))
        );
        const siblingTutorIds = siblingsSnap.docs.map((d) =>
          d.id === studentId ? tutor?.uid ?? null : ((d.data() as StudentDoc).assignedTutorId ?? null)
        );
        const assignedTutorIds = computeAssignedTutorIds(siblingTutorIds);

        const clientSnap = await getDoc(doc(db, "clients", student.clientId));
        const existingClientTutorId = String(
          (clientSnap.data() as { assignedTutorId?: string } | undefined)?.assignedTutorId ?? ""
        );

        const clientPatch: Record<string, unknown> = {
          assignedTutorIds,
          updatedAt: serverTimestamp(),
        };
        // Legacy singular fields, kept for backward-compatible display only
        // (e.g. a "primary tutor" label) — never used for access control
        // anymore, and never overwritten away from a different sibling's
        // tutor that's already recorded there.
        if (shouldMirrorSingularTutor(existingClientTutorId, tutor?.uid ?? null)) {
          clientPatch.assignedTutorId = tutor?.uid ?? null;
          clientPatch.assignedTutorName = tutor?.name ?? null;
          clientPatch.assignedTutorEmail = tutor?.email ?? null;
        }
        batch.update(doc(db, "clients", student.clientId), clientPatch);
      }

      await batch.commit();
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              assignedTutorId: tutor?.uid ?? null,
              assignedTutorName: tutor?.name ?? null,
              assignedTutorEmail: tutor?.email ?? null,
            }
          : prev
      );
      setTutorSaved(true);
      setTimeout(() => setTutorSaved(false), 2000);
    } finally {
      setSavingTutor(false);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const completedCount = useMemo(
    () => sessions.filter((s) => s.data.status === "completed" || s.data.status === "COMPLETED").length,
    [sessions]
  );

  // Resolve assigned tutor display name without showing raw UIDs.
  const assignedTutorDisplay = useMemo(() => {
    if (!student?.assignedTutorId) return "—";
    if (student.assignedTutorName) return student.assignedTutorName;
    if (student.assignedTutorEmail) return student.assignedTutorEmail;
    const opt = tutorOptions.find((t) => t.uid === student.assignedTutorId);
    if (opt?.name) return opt.name;
    if (opt?.email) return opt.email;
    return "Tutor assigned, name not found";
  }, [student, tutorOptions]);

  const tutorsWithMatch = useMemo<(TutorOption & { match: MatchResult })[]>(() => {
    return tutorOptions.map((t) => ({
      ...t,
      match: student
        ? computeMatch(student, t.profile, t.activeStudentCount)
        : { level: "unknown_profile" as MatchLevel, reasons: [] },
    }));
  }, [student, tutorOptions]);

  const sortedTutors = useMemo(
    () =>
      [...tutorsWithMatch].sort((a, b) => {
        const diff = MATCH_SORT[a.match.level] - MATCH_SORT[b.match.level];
        return diff !== 0 ? diff : (a.name || a.email).localeCompare(b.name || b.email);
      }),
    [tutorsWithMatch]
  );

  const selectedTutor = useMemo(
    () => tutorsWithMatch.find((t) => t.uid === selectedTutorId) ?? null,
    [tutorsWithMatch, selectedTutorId]
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-sm text-[color:var(--muted)]">Student not found.</p>
        <Link
          href="/hub/admin/clients"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-2">
        <Link
          href="/hub/admin/clients"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to clients
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin · Student
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
          {student.studentName || "Student"}
        </h1>
        <p className="text-sm text-[color:var(--muted)]">
          {student.yearLevel || "Year not set"}
          {student.school ? ` · ${student.school}` : ""}
        </p>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[color:var(--ink)]">Profile</h2>
          {!editingProfile && (
            <button
              type="button"
              onClick={() => {
                setProfileForm({
                  studentName: student.studentName ?? "",
                  yearLevel: student.yearLevel ?? "",
                  school: student.school ?? "",
                  subjectsText: (student.subjects ?? []).join(", "),
                  mode: student.mode ?? "",
                  suburb: student.suburb ?? "",
                  postcode: student.postcode ?? "",
                  addressLine1: student.addressLine1 ?? "",
                  goals: student.goals ?? "",
                  challenges: student.challenges ?? "",
                });
                setEditingProfile(true);
              }}
              className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {editingProfile ? (
          <>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              {(
                [
                  ["studentName", "Name"],
                  ["yearLevel", "Year level"],
                  ["school", "School"],
                  ["mode", "Mode"],
                  ["suburb", "Suburb"],
                  ["postcode", "Postcode"],
                  ["addressLine1", "Address"],
                ] as const
              ).map(([f, label]) =>
                f === "mode" ? (
                  <label key={f} className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">{label}</span>
                    <select
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={profileForm[f]}
                      onChange={(e) => setProfileForm((p) => ({ ...p, [f]: e.target.value }))}
                    >
                      <option value="">Not set</option>
                      <option value="online">Online</option>
                      <option value="in-home">In-home</option>
                      <option value="in_home">In-home (legacy)</option>
                    </select>
                  </label>
                ) : (
                  <label key={f} className="block space-y-0.5">
                    <span className="text-xs text-[color:var(--muted)]">{label}</span>
                    <input
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                      value={profileForm[f]}
                      onChange={(e) => setProfileForm((p) => ({ ...p, [f]: e.target.value }))}
                    />
                  </label>
                )
              )}
              <label className="block space-y-0.5 md:col-span-2">
                <span className="text-xs text-[color:var(--muted)]">Subjects (comma-separated)</span>
                <input
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={profileForm.subjectsText}
                  onChange={(e) => setProfileForm((p) => ({ ...p, subjectsText: e.target.value }))}
                  placeholder="e.g. Maths, English"
                />
              </label>
              <label className="block space-y-0.5 md:col-span-2">
                <span className="text-xs text-[color:var(--muted)]">Goals</span>
                <textarea
                  rows={2}
                  className="w-full resize-y rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={profileForm.goals}
                  onChange={(e) => setProfileForm((p) => ({ ...p, goals: e.target.value }))}
                />
              </label>
              <label className="block space-y-0.5 md:col-span-2">
                <span className="text-xs text-[color:var(--muted)]">Challenges</span>
                <textarea
                  rows={2}
                  className="w-full resize-y rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30"
                  value={profileForm.challenges}
                  onChange={(e) => setProfileForm((p) => ({ ...p, challenges: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:bg-[#d6e5e3]/40"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
            <div><span className="font-semibold text-[color:var(--ink)]">Tutor:</span> {assignedTutorDisplay}</div>
            <div><span className="font-semibold text-[color:var(--ink)]">Mode:</span> {student.mode || "—"}</div>
            <div><span className="font-semibold text-[color:var(--ink)]">Suburb:</span> {student.suburb || "—"}</div>
            <div><span className="font-semibold text-[color:var(--ink)]">Postcode:</span> {student.postcode || "—"}</div>
            <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Address:</span> {student.addressLine1 || "—"}</div>
            <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Subjects:</span> {student.subjects?.length ? student.subjects.join(", ") : "—"}</div>
            <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Goals:</span> {student.goals || "—"}</div>
            <div className="md:col-span-2"><span className="font-semibold text-[color:var(--ink)]">Challenges:</span> {student.challenges || "—"}</div>
          </div>
        )}
      </section>

      {/* Assign tutor — matching assist */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[color:var(--ink)]">
              {selectedTutorId && !tutorPickerOpen ? "Assigned tutor" : "Assign tutor"}
            </h2>
            {(tutorPickerOpen || !selectedTutorId) && (student.subjects?.length || student.yearLevel || student.mode) && (
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                Matching{" "}
                {[student.yearLevel, student.subjects?.join(", "), student.mode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectedTutorId && !tutorPickerOpen && (
              <button
                type="button"
                onClick={() => { setSelectedTutorId(""); setTutorPickerOpen(true); }}
                className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
              >
                Clear
              </button>
            )}
            {tutorPickerOpen && selectedTutorId && (
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

        {tutorOptions.length === 0 ? (
          <p className="text-xs text-[color:var(--muted)]">No tutors found. Add tutors first.</p>
        ) : tutorPickerOpen ? (
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {sortedTutors.map((t) => (
              <TutorMatchCard
                key={t.uid}
                tutor={t}
                match={t.match}
                selected={t.uid === selectedTutorId}
                onSelect={(uid) => { setSelectedTutorId(uid); if (uid) setTutorPickerOpen(false); }}
              />
            ))}
          </div>
        ) : selectedTutor ? (
          <>
            <TutorMatchCard
              tutor={selectedTutor}
              match={selectedTutor.match}
              selected
              onSelect={() => setTutorPickerOpen(true)}
            />
            <button
              type="button"
              onClick={() => setTutorPickerOpen(true)}
              className="mt-2 text-xs font-semibold text-[color:var(--brand)] hover:underline"
            >
              Change tutor
            </button>
          </>
        ) : null}

        {selectedTutorId && selectedTutor && tutorPickerOpen && (
          <p className="mt-2 text-xs font-semibold text-teal-700">
            Assigning to: {selectedTutor.name || selectedTutor.email}
            {selectedTutor.email && selectedTutor.name ? ` (${selectedTutor.email})` : ""}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveTutor}
            disabled={savingTutor || selectedTutorId === (student?.assignedTutorId ?? "")}
            className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {savingTutor ? "Saving…" : "Save"}
          </button>
          {tutorSaved && (
            <span className="text-sm font-semibold text-emerald-600">Saved</span>
          )}
        </div>
      </section>

      {/* Parent */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Parent</h2>
        <div className="grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Name:</span>{" "}
            {client?.parentName || "—"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Email:</span>{" "}
            {client?.parentEmail ? (
              <a
                href={`mailto:${client.parentEmail}`}
                className="text-[color:var(--brand)] hover:underline"
              >
                {client.parentEmail}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Phone:</span>{" "}
            {client?.parentPhone || "—"}
          </div>
        </div>
      </section>

      {/* Inquiry info — Release 1B, final polish item 7. Collapsed by default;
          read-only historical snapshot of the original lead this student was
          converted from. Never overwrites, and is never overwritten by,
          anything on the student/client record. */}
      {inquiryLead && (
        <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
          <button
            type="button"
            onClick={() => setInquiryOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="font-semibold text-[color:var(--ink)]">Inquiry info</h2>
            <span className="text-xs font-semibold text-[color:var(--brand)]">
              {inquiryOpen ? "Hide ▲" : "Show ▼"}
            </span>
          </button>
          {inquiryOpen && (
            <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-2">
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Original inquiry date:</span>{" "}
                {inquiryLead.createdAt ? fmtDate(inquiryLead.createdAt) : "—"}
              </div>
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Source:</span>{" "}
                {inquiryLead.source === "contact" ? "Contact form" : inquiryLead.source === "manual" ? "Manual" : "Enrolment form"}
              </div>
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Parent (at inquiry):</span>{" "}
                {inquiryLead.parentName || "—"} ({inquiryLead.parentEmail || "—"})
              </div>
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Requested package:</span>{" "}
                {inquiryLead.package || "—"}
              </div>
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Subjects:</span>{" "}
                {(inquiryLead.subjects ?? []).join(", ") || "—"}
              </div>
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Mode / suburb:</span>{" "}
                {inquiryLead.mode || "—"} {inquiryLead.suburb ? `· ${inquiryLead.suburb}` : ""}
              </div>
              {inquiryLead.goals && (
                <div className="md:col-span-2">
                  <span className="font-semibold text-[color:var(--ink)]">Goals:</span> {inquiryLead.goals}
                </div>
              )}
              {inquiryLead.challenges && (
                <div className="md:col-span-2">
                  <span className="font-semibold text-[color:var(--ink)]">Challenges:</span> {inquiryLead.challenges}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Arrangement — Release 1B, Stage 6. Per-student, never one family-wide value. */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Arrangement</h2>

        {plan ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Payment arrangement:</span>{" "}
                {formatPlanLabel((plan.type as Parameters<typeof formatPlanLabel>[0]) ?? "casual")}
              </div>
              {plan.type !== "casual" && (
                <div>
                  <span className="font-semibold text-[color:var(--ink)]">Sessions remaining:</span>{" "}
                  {entitlement?.remainingSessions ?? "—"}
                  {(entitlement?.bonusRemaining ?? 0) > 0 ? ` (+${entitlement?.bonusRemaining} legacy bonus)` : ""}
                </div>
              )}
              {plan.standardPriceCents != null && (
                <div>
                  <span className="font-semibold text-[color:var(--ink)]">Agreed price:</span>{" "}
                  {fmtCents(plan.finalPriceCents ?? plan.standardPriceCents)}
                  {plan.discountType && (
                    <span className="text-xs text-[color:var(--muted)]"> (standard {fmtCents(plan.standardPriceCents)}, {describeDiscount(plan)})</span>
                  )}
                </div>
              )}
              <div>
                <span className="font-semibold text-[color:var(--ink)]">Commenced:</span> {fmtDate(plan.createdAt) || "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {plan.type !== "casual" && (
                <button
                  type="button"
                  onClick={() => setShowRenewForm((v) => !v)}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
                >
                  {showRenewForm ? "Cancel renew" : "Renew package"}
                </button>
              )}
              {plan.type !== "casual" && (
                <button
                  type="button"
                  onClick={() => setShowCorrectForm((v) => !v)}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
                >
                  {showCorrectForm ? "Cancel correction" : "Correct balance"}
                </button>
              )}
            </div>

            {showRenewForm && (
              <div className="rounded-xl border border-dashed border-[color:var(--ring)] p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">New package</span>
                    <select
                      value={renewForm.newPlanType}
                      onChange={(e) => setRenewForm((f) => ({ ...f, newPlanType: e.target.value as "package_5" | "package_10" }))}
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    >
                      <option value="package_5">5-session package</option>
                      <option value="package_10">10-session package</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      Carry-over (max {entitlement?.remainingSessions ?? 0})
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={entitlement?.remainingSessions ?? 0}
                      value={renewForm.carryOverSessions}
                      onChange={(e) => setRenewForm((f) => ({ ...f, carryOverSessions: e.target.value }))}
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">
                      Discount {plan.discountType ? `(previously: ${describeDiscount(plan)})` : "(none previously)"}
                    </span>
                    <select
                      value={renewForm.discountType}
                      onChange={(e) => setRenewForm((f) => ({ ...f, discountType: e.target.value as "" | "percent" | "fixed" }))}
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    >
                      <option value="">No discount</option>
                      <option value="percent">Percentage off</option>
                      <option value="fixed">Fixed dollar off</option>
                    </select>
                  </label>
                  {renewForm.discountType && (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[color:var(--muted)]">
                        {renewForm.discountType === "percent" ? "Percent (0-100)" : "Amount off (AUD)"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step={renewForm.discountType === "percent" ? "1" : "0.01"}
                        value={renewForm.discountValue}
                        onChange={(e) => setRenewForm((f) => ({ ...f, discountValue: e.target.value }))}
                        className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                      />
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRenew}
                  disabled={arrangementBusy}
                  className="rounded-xl bg-[color:var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {arrangementBusy ? "Renewing…" : "Confirm renewal"}
                </button>
              </div>
            )}

            {showCorrectForm && (
              <div className="rounded-xl border border-dashed border-[color:var(--ring)] p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Adjustment (+/-)</span>
                    <input
                      type="number"
                      value={correctForm.delta}
                      onChange={(e) => setCorrectForm((f) => ({ ...f, delta: e.target.value }))}
                      placeholder="e.g. -1 or 2"
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Reason *</span>
                    <input
                      value={correctForm.reason}
                      onChange={(e) => setCorrectForm((f) => ({ ...f, reason: e.target.value }))}
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                {correctForm.delta && Number.isFinite(Number(correctForm.delta)) && (
                  <p className="text-xs text-[color:var(--muted)]">
                    Resulting balance: {(entitlement?.remainingSessions ?? 0) + Number(correctForm.delta)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleCorrectBalance}
                  disabled={arrangementBusy}
                  className="rounded-xl bg-[color:var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {arrangementBusy ? "Saving…" : "Confirm correction"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[color:var(--muted)]">No package on record — currently casual.</p>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
            >
              {showCreateForm ? "Cancel" : "Set up a package"}
            </button>
            {showCreateForm && (
              <div className="rounded-xl border border-dashed border-[color:var(--ring)] p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Package</span>
                    <select
                      value={createForm.planType}
                      onChange={(e) => setCreateForm((f) => ({ ...f, planType: e.target.value as "casual" | "package_5" | "package_10" }))}
                      className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                    >
                      <option value="casual">Casual</option>
                      <option value="package_5">5-session package</option>
                      <option value="package_10">10-session package</option>
                    </select>
                  </label>
                  {createForm.planType !== "casual" && (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[color:var(--muted)]">Discount</span>
                      <select
                        value={createForm.discountType}
                        onChange={(e) => setCreateForm((f) => ({ ...f, discountType: e.target.value as "" | "percent" | "fixed" }))}
                        className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                      >
                        <option value="">No discount</option>
                        <option value="percent">Percentage off</option>
                        <option value="fixed">Fixed dollar off</option>
                      </select>
                    </label>
                  )}
                  {createForm.planType !== "casual" && createForm.discountType && (
                    <>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">
                          {createForm.discountType === "percent" ? "Percent (0-100)" : "Amount off (AUD)"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step={createForm.discountType === "percent" ? "1" : "0.01"}
                          value={createForm.discountValue}
                          onChange={(e) => setCreateForm((f) => ({ ...f, discountValue: e.target.value }))}
                          className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">Reason</span>
                        <input
                          value={createForm.discountReason}
                          onChange={(e) => setCreateForm((f) => ({ ...f, discountReason: e.target.value }))}
                          className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-1.5 text-sm"
                        />
                      </label>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCreatePackage}
                  disabled={arrangementBusy}
                  className="rounded-xl bg-[color:var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {arrangementBusy ? "Saving…" : "Confirm"}
                </button>
              </div>
            )}
          </div>
        )}

        {arrangementMsg && <p className="mt-2 text-xs text-[color:var(--muted)]">{arrangementMsg}</p>}

        {planHistory.length > 1 && (
          <div className="mt-4 border-t border-[color:var(--ring)] pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">History</h3>
            <div className="space-y-1 text-xs text-[color:var(--muted)]">
              {planHistory.map((p) => (
                <div key={p.id}>
                  {formatPlanLabel((p.type as Parameters<typeof formatPlanLabel>[0]) ?? "casual")} — {p.status}
                  {p.finalPriceCents != null ? ` — ${fmtCents(p.finalPriceCents)}` : ""} — {fmtDate(p.createdAt) || "—"}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-2 font-semibold text-[color:var(--ink)]">Sessions</h2>
        <p className="mb-3 text-xs text-[color:var(--muted)]">
          Total: {sessions.length} · Completed: {completedCount}
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No sessions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">End</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Modality</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-[color:var(--ring)]">
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {fmtDate(s.data.startAt) || "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {fmtDate(s.data.endAt) || "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {s.data.status || "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {s.data.modality || "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {s.data.durationMinutes ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-[color:var(--muted)]">
                      {s.data.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Removal lifecycle — Release 1B, Stage 6d */}
      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Status</h2>
        <p className="mb-3 text-sm text-[color:var(--muted)]">
          Current status:{" "}
          <span
            className={`font-semibold ${
              student?.status === "ended"
                ? "text-rose-700"
                : student?.status === "paused"
                ? "text-amber-700"
                : "text-[color:var(--ink)]"
            }`}
          >
            {student?.status === "ended" ? "Ended" : student?.status === "paused" ? "Paused" : "Active"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {student?.status === "ended" ? (
            <button
              type="button"
              onClick={handleRestoreStudent}
              disabled={statusBusy}
              className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-60"
            >
              {statusBusy ? "Working…" : "Restore to active"}
            </button>
          ) : student?.status === "paused" ? (
            <>
              <button
                type="button"
                onClick={handleResumeStudent}
                disabled={statusBusy}
                className="rounded-xl border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-60"
              >
                {statusBusy ? "Working…" : "Resume student"}
              </button>
              <button
                type="button"
                onClick={handleEndStudent}
                disabled={statusBusy}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {statusBusy ? "Working…" : "End student"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseStudent}
                disabled={statusBusy}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {statusBusy ? "Working…" : "Pause student"}
              </button>
              <button
                type="button"
                onClick={handleEndStudent}
                disabled={statusBusy}
                className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                {statusBusy ? "Working…" : "End student"}
              </button>
            </>
          )}
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Permanently delete…
            </button>
          ) : null}
        </div>

        {showDeleteConfirm && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-800">
              This permanently removes the student record — it is refused if any session, package, or invoice
              history exists for this student ({sessions.length} session{sessions.length === 1 ? "" : "s"},{" "}
              {planHistory.length} package record{planHistory.length === 1 ? "" : "s"} found). Use this only for a
              genuine mistake or test record; otherwise use &ldquo;End student&rdquo; above. Type{" "}
              <strong>{student?.studentName || studentId}</strong> to confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handlePermanentDeleteStudent}
                disabled={deletingStudent}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {deletingStudent ? "Deleting…" : "Confirm permanent delete"}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {statusMsg && <p className="mt-2 text-xs text-[color:var(--muted)]">{statusMsg}</p>}
      </section>
    </div>
  );
}
