"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { TutorProfileStatus } from "@/types/tutor";

// ─── Existing types ───────────────────────────────────────────────────────────

type UserDoc = { name?: string; displayName?: string; email?: string };
type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
};
type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
};
type StudentRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  school: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
};

function tutorName(user?: UserDoc) {
  return user?.name || user?.displayName || "Tutor";
}

// ─── Profile summary helpers ──────────────────────────────────────────────────

type ProfileData = Record<string, unknown>;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  active: "Active",
  paused: "Paused",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  pending_review: { bg: "#fffbeb", text: "#92400e", border: "#fbbf24" },
  active: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  paused: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  if (typeof ts === "object" && ts !== null && "toDate" in ts) {
    try {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString("en-AU");
    } catch {
      return "—";
    }
  }
  if (typeof ts === "string" && ts) return ts.split("T")[0];
  return "—";
}

const DAY_ORDER = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
] as const;

function groupSlotsByDay(slots: unknown): { day: string; blocks: string[] }[] {
  if (!Array.isArray(slots)) return [];
  const map = new Map<string, string[]>();
  for (const slot of slots) {
    if (typeof slot !== "object" || !slot) continue;
    const s = slot as Record<string, unknown>;
    if (typeof s.day !== "string" || typeof s.block !== "string") continue;
    if (!map.has(s.day)) map.set(s.day, []);
    map.get(s.day)!.push(s.block as string);
  }
  return DAY_ORDER.filter((d) => map.has(d)).map((d) => ({ day: d, blocks: map.get(d)! }));
}

function str(val: unknown): string {
  return typeof val === "string" && val ? val : "—";
}

function num(val: unknown): string {
  return typeof val === "number" ? String(val) : "—";
}

function PRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </span>
      <span className="text-[color:var(--ink)]">{value || "—"}</span>
    </div>
  );
}

function PSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--brand)]">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TutorProfileSummaryCard({
  profile,
  activeStudentCount,
}: {
  profile: ProfileData | null;
  activeStudentCount: number;
}) {
  if (!profile) {
    return (
      <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Tutor Profile V2
        </p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          No Tutor Profile V2 has been submitted yet.
        </p>
      </div>
    );
  }

  const status = typeof profile.profileStatus === "string" ? profile.profileStatus : "draft";
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;

  const capabilities = Array.isArray(profile.capabilities)
    ? (profile.capabilities as Record<string, unknown>[])
    : [];
  const supportCapabilities = Array.isArray(profile.supportCapabilities)
    ? (profile.supportCapabilities as Record<string, unknown>[])
    : [];
  const modes = Array.isArray(profile.modes)
    ? (profile.modes as string[])
        .map((m) => (m === "in_home" ? "In-home" : m === "online" ? "Online" : "Group"))
        .join(" · ")
    : "—";
  const serviceSuburbs = Array.isArray(profile.serviceSuburbs)
    ? (profile.serviceSuburbs as string[]).join(", ") || "—"
    : "—";
  const availabilityGrouped = groupSlotsByDay(profile.availabilitySlots);

  const hasTravelLimit = profile.maxTravelMinutes != null || profile.maxTravelKm != null;
  const travelLimit = hasTravelLimit
    ? `${num(profile.maxTravelMinutes)} min · ${num(profile.maxTravelKm)} km`
    : "—";

  return (
    <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Tutor Profile V2
        </p>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
          }}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      <div className="space-y-5">
        {/* Contact */}
        <PSection title="Contact">
          <PRow label="Phone" value={str(profile.phone)} />
          {typeof profile.bio === "string" && profile.bio && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Bio
              </span>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
                {profile.bio}
              </p>
            </div>
          )}
        </PSection>

        {/* Compliance */}
        <PSection title="Compliance">
          <PRow label="ABN" value={str(profile.abn)} />
          <PRow label="WWCC Number" value={str(profile.wwccNumber)} />
          <PRow label="WWCC State" value={str(profile.wwccState)} />
          <PRow label="WWCC Expiry" value={formatDate(profile.wwccExpiresAt)} />
          {!!profile.blueCardNumber && (
            <>
              <PRow label="Blue Card" value={str(profile.blueCardNumber)} />
              <PRow label="Blue Card Expiry" value={formatDate(profile.blueCardExpiresAt)} />
            </>
          )}
        </PSection>

        {/* Capabilities */}
        <PSection title="Teaching Capabilities">
          {capabilities.length === 0 && supportCapabilities.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">None declared.</p>
          ) : (
            <>
              {capabilities.length > 0 && (
                <ul className="space-y-1">
                  {capabilities.map((cap, i) => {
                    const subject =
                      typeof cap.subject === "string" ? cap.subject : "Unknown";
                    const years = Array.isArray(cap.years)
                      ? (cap.years as string[]).join(", ")
                      : "—";
                    const readiness =
                      cap.readiness === "with_support" ? "With support" : "Independent";
                    return (
                      <li key={i} className="text-sm">
                        <span className="font-semibold text-[color:var(--ink)]">{subject}</span>
                        <span className="text-[color:var(--muted)]">: {years}</span>
                        <span className="text-[color:var(--muted)]"> — </span>
                        <span className="text-[color:var(--ink)]">{readiness}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {supportCapabilities.length > 0 && (
                <>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    Support capabilities
                  </p>
                  <ul className="mt-1 space-y-1">
                    {supportCapabilities.map((cap, i) => {
                      const type =
                        typeof cap.type === "string" ? cap.type : "Unknown";
                      const readiness =
                        cap.readiness === "with_support" ? "With support" : "Independent";
                      return (
                        <li key={i} className="text-sm">
                          <span className="font-semibold text-[color:var(--ink)]">{type}</span>
                          <span className="text-[color:var(--muted)]"> — </span>
                          <span className="text-[color:var(--ink)]">{readiness}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </PSection>

        {/* Modes */}
        <PSection title="Teaching Modes">
          <p className="text-sm text-[color:var(--ink)]">{modes}</p>
        </PSection>

        {/* Location */}
        <PSection title="Location &amp; Travel">
          <PRow label="Suburb" value={str(profile.suburb)} />
          <PRow label="Postcode" value={str(profile.postcode)} />
          <PRow label="Max travel" value={travelLimit} />
          <PRow label="Service suburbs" value={serviceSuburbs} />
          {typeof profile.travelNotes === "string" && profile.travelNotes && (
            <PRow label="Travel notes" value={profile.travelNotes} />
          )}
        </PSection>

        {/* Availability */}
        <PSection title="Availability">
          {availabilityGrouped.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">Not set.</p>
          ) : (
            <ul className="space-y-1">
              {availabilityGrouped.map(({ day, blocks }) => (
                <li key={day} className="text-sm">
                  <span className="font-semibold text-[color:var(--ink)]">{day.slice(0, 3)}:</span>{" "}
                  <span className="text-[color:var(--muted)]">{blocks.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          {typeof profile.availabilityNote === "string" && profile.availabilityNote && (
            <p className="mt-2 text-sm italic text-[color:var(--muted)]">
              {profile.availabilityNote}
            </p>
          )}
        </PSection>

        {/* Capacity */}
        <PSection title="Capacity">
          <PRow label="Desired hrs/wk" value={num(profile.desiredHoursPerWeek)} />
          <PRow label="Max hrs/wk" value={num(profile.maxHoursPerWeek)} />
          <PRow label="Assigned students" value={String(activeStudentCount)} />
          <PRow
            label="Max students"
            value={
              typeof profile.maxActiveStudents === "number"
                ? String(profile.maxActiveStudents)
                : "Student capacity not set"
            }
          />
          {typeof profile.maxActiveStudents === "number" && (() => {
            const remaining = profile.maxActiveStudents - activeStudentCount;
            const label =
              remaining > 0
                ? `${remaining} student ${remaining === 1 ? "space" : "spaces"} available`
                : remaining === 0
                ? "At student capacity"
                : "Over capacity";
            return <PRow label="Student spaces" value={label} />;
          })()}
        </PSection>
      </div>
    </div>
  );
}

// ─── Admin review panel ───────────────────────────────────────────────────────

const REVIEW_STATUS_DESC: Record<string, string> = {
  draft: "Profile has been started but not submitted for review.",
  pending_review: "Tutor profile is waiting for admin review.",
  active: "Admin has reviewed this profile and marked it ready for matching.",
  paused:
    "Admin has paused this profile for new matching. Matching visibility will be handled in a later pass.",
};

type ReviewButton = { label: string; status: TutorProfileStatus; color: string };

const REVIEW_BUTTONS: ReviewButton[] = [
  { label: "Mark active", status: "active", color: "#82977e" },
  { label: "Pause profile", status: "paused", color: "#8b7d6b" },
  { label: "Return to pending review", status: "pending_review", color: "#748398" },
];

function AdminReviewPanel({
  profileStatus,
  statusSaving,
  statusError,
  statusSuccess,
  onUpdateStatus,
}: {
  profileStatus: TutorProfileStatus;
  statusSaving: boolean;
  statusError: string | null;
  statusSuccess: string | null;
  onUpdateStatus: (s: TutorProfileStatus) => void;
}) {
  const statusStyle = STATUS_STYLES[profileStatus] ?? STATUS_STYLES.draft;

  return (
    <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Tutor Profile Review
        </p>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
          }}
        >
          {STATUS_LABELS[profileStatus] ?? profileStatus}
        </span>
      </div>

      <p className="mb-4 text-sm text-[color:var(--muted)]">
        {REVIEW_STATUS_DESC[profileStatus] ?? ""}
      </p>

      <div className="flex flex-wrap gap-2">
        {REVIEW_BUTTONS.map(({ label, status, color }) => {
          const isCurrent = profileStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={statusSaving || isCurrent}
              onClick={() => onUpdateStatus(status)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: isCurrent ? "#c4bbaf" : color }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {statusSuccess && (
        <p className="mt-3 text-sm font-medium text-[#82977e]">{statusSuccess}</p>
      )}
      {statusError && (
        <p className="mt-3 text-sm font-medium text-rose-600">{statusError}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTutorDetailPage() {
  const params = useParams<{ tutorId: string }>();
  const tutorId = params.tutorId;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Tutor");
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [tutorProfile, setTutorProfile] = useState<ProfileData | null>(null);

  // Review panel state
  const [profileStatus, setProfileStatus] = useState<TutorProfileStatus>("draft");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [userSnap, profileSnap] = await Promise.all([
          getDoc(doc(db, "users", tutorId)),
          getDoc(doc(db, "tutors", tutorId)),
        ]);

        const user = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;
        setName(tutorName(user));

        if (profileSnap.exists()) {
          const pdata = profileSnap.data() as ProfileData;
          setTutorProfile(pdata);
          const raw = typeof pdata.profileStatus === "string" ? pdata.profileStatus : "draft";
          const validStatuses: TutorProfileStatus[] = ["draft", "pending_review", "active", "paused"];
          setProfileStatus(validStatuses.includes(raw as TutorProfileStatus) ? (raw as TutorProfileStatus) : "draft");
        } else {
          setTutorProfile(null);
        }

        let studentsSnap = await getDocs(
          query(collection(db, "students"), where("assignedTutorId", "==", tutorId))
        );
        if (studentsSnap.empty && user.email) {
          studentsSnap = await getDocs(
            query(collection(db, "students"), where("assignedTutorEmail", "==", user.email))
          );
        }

        const students = studentsSnap.docs.map((d) => ({
          id: d.id,
          data: d.data() as StudentDoc,
        }));
        const fallbackEmailFromStudents =
          students.find((s) => !!s.data.assignedTutorEmail)?.data.assignedTutorEmail || "";
        setEmail(user.email || fallbackEmailFromStudents);

        const clientIds = Array.from(
          new Set(students.map((s) => s.data.clientId).filter((x): x is string => !!x))
        );
        const clientsById: Record<string, ClientDoc> = {};
        await Promise.all(
          clientIds.map(async (cid) => {
            const cSnap = await getDoc(doc(db, "clients", cid));
            if (cSnap.exists()) clientsById[cid] = cSnap.data() as ClientDoc;
          })
        );

        const mapped = students.map((s) => {
          const c = (s.data.clientId && clientsById[s.data.clientId]) || {};
          return {
            id: s.id,
            studentName: s.data.studentName || "Student",
            yearLevel: s.data.yearLevel || "",
            school: s.data.school || null,
            parentName: (c as ClientDoc).parentName || "",
            parentEmail: (c as ClientDoc).parentEmail || "",
            parentPhone: (c as ClientDoc).parentPhone || null,
          };
        });

        setRows(mapped);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tutorId]);

  async function updateStatus(newStatus: TutorProfileStatus) {
    setStatusSaving(true);
    setStatusError(null);
    setStatusSuccess(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch(`/api/admin/tutors/${tutorId}/profile-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profileStatus: newStatus }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; profileStatus: string }
        | { ok: false; error: string }
        | null;
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data as { ok: false; error: string } | null)?.error ?? "Update failed.");
      }
      // Keep review panel and summary badge in sync — update both
      setProfileStatus(newStatus);
      setTutorProfile((prev) => (prev ? { ...prev, profileStatus: newStatus } : prev));
      setStatusSuccess(`Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}.`);
    } catch (e) {
      console.error("[admin tutor] status update failed:", e);
      setStatusError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setStatusSaving(false);
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-2">
        <Link
          href="/hub/admin/tutors"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to tutors
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin · Tutor
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">{name}</h1>
        <p className="text-sm text-[color:var(--muted)]">{email || "No email on file"}</p>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      ) : (
        <>
          {/* Tutor Profile V2 summary (unchanged) */}
          <TutorProfileSummaryCard profile={tutorProfile} activeStudentCount={sortedRows.length} />

          {/* Admin review controls — only shown when a profile exists */}
          {tutorProfile !== null && (
            <AdminReviewPanel
              profileStatus={profileStatus}
              statusSaving={statusSaving}
              statusError={statusError}
              statusSuccess={statusSuccess}
              onUpdateStatus={updateStatus}
            />
          )}

          {/* Assigned students */}
          {sortedRows.length === 0 ? (
            <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
              This tutor has no assigned students.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
              <table className="min-w-[980px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Parent email</th>
                    <th className="px-4 py-3">Parent phone</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((s) => (
                    <tr key={s.id} className="border-t border-[color:var(--ring)]">
                      <td className="px-4 py-4 text-sm font-semibold text-[color:var(--ink)]">
                        {s.studentName}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                        {s.yearLevel || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                        {s.school || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                        {s.parentName || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                        {s.parentEmail || "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--muted)]">
                        {s.parentPhone || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/hub/admin/students/${s.id}`}
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
        </>
      )}
    </div>
  );
}
