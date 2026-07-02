"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Workspace card ───────────────────────────────────────────────────────────

type WorkspaceCardProps = {
  title: string;
  subtitle: string;
  href: string;
  label: string;
  accentColor: string;
  labelColor: string;
};

function WorkspaceCard({ title, subtitle, href, label, accentColor, labelColor }: WorkspaceCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 20,
        padding: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 6px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        borderTop: `3px solid ${accentColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: labelColor,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", marginTop: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 12, color: "#8a96a3", marginTop: 4, lineHeight: 1.5, minHeight: 36 }}>
        {subtitle}
      </p>
      <p style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: accentColor }}>
        Open workspace →
      </p>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

type ProfileStatus = "none" | "draft" | "pending_review" | "active" | "paused";

type ChecklistItem = { label: string; done: boolean };

function buildChecklist(p: Record<string, unknown> | null): ChecklistItem[] {
  const get = (key: string) => p?.[key];
  const nonEmptyStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const nonEmptyArr = (v: unknown) => Array.isArray(v) && v.length > 0;

  return [
    { label: "Details",          done: nonEmptyStr(get("phone")) },
    { label: "Teaching setup",   done: nonEmptyArr(get("modes")) },
    { label: "Location & travel",done: nonEmptyStr(get("suburb")) || nonEmptyStr(get("postcode")) },
    { label: "Availability",     done: nonEmptyArr(get("availabilitySlots")) || nonEmptyArr(get("availabilityDays")) },
    { label: "Subjects",         done: nonEmptyArr(get("capabilities")) },
    { label: "Learning support", done: nonEmptyArr(get("supportCapabilities")) },
    { label: "Compliance",       done: nonEmptyStr(get("abn")) && nonEmptyStr(get("wwccNumber")) },
  ];
}

type ProfileCardConfig = {
  title: string;
  helper: string;
  button: string;
  accent: string;
  showChecklist: boolean;
};

const PROFILE_CARD: Record<ProfileStatus, ProfileCardConfig> = {
  none: {
    title: "Complete your Tutor Profile",
    helper: "Help us match you with the right students by adding your subjects, availability, location and capacity.",
    button: "Complete profile",
    accent: "#456071",
    showChecklist: true,
  },
  draft: {
    title: "Finish your Tutor Profile",
    helper: "Your profile has been started but is not ready for review yet.",
    button: "Continue profile",
    accent: "#748398",
    showChecklist: true,
  },
  pending_review: {
    title: "Tutor Profile submitted",
    helper: "Your profile is waiting for admin review. You can still update it if your availability or subjects change.",
    button: "View profile",
    accent: "#748398",
    showChecklist: false,
  },
  active: {
    title: "Tutor Profile active",
    helper: "Your profile is ready for matching. Keep it updated when your availability changes.",
    button: "View profile",
    accent: "#82977e",
    showChecklist: false,
  },
  paused: {
    title: "Tutor Profile paused",
    helper: "Your profile is not currently being used for new matches. Contact Studyroom if this seems wrong.",
    button: "View profile",
    accent: "#8b7d6b",
    showChecklist: false,
  },
};

function ProfileCard({
  status,
  profileData,
}: {
  status: ProfileStatus;
  profileData: Record<string, unknown> | null;
}) {
  const cfg = PROFILE_CARD[status];
  const checklist = cfg.showChecklist ? buildChecklist(profileData) : [];
  const doneCount = checklist.filter((c) => c.done).length;
  const total = checklist.length;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 20,
        border: "1px solid rgba(0,0,0,0.06)",
        borderTop: `3px solid ${cfg.accent}`,
        boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        padding: "16px 18px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase", color: cfg.accent, marginBottom: 4,
          }}>
            Tutor Profile
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2428" }}>
            {cfg.title}
          </div>
          <p style={{ fontSize: 12, color: "#8a96a3", marginTop: 4, lineHeight: 1.5 }}>
            {cfg.helper}
          </p>
        </div>

        <Link
          href="/hub/tutor/profile"
          style={{
            flexShrink: 0,
            display: "inline-block",
            background: cfg.accent,
            color: "white",
            borderRadius: 20,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {cfg.button}
        </Link>
      </div>

      {/* Completion checklist — draft and none states only */}
      {cfg.showChecklist && (
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: "#748398", marginBottom: 8, fontWeight: 600 }}>
            {doneCount} of {total} sections complete
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {checklist.map(({ label, done }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                  background: done ? "#d6e5e3" : "#f8f8ff",
                  color: done ? "#2c4b4c" : "#748398",
                  border: done ? "1.5px solid #82977e" : "1.5px solid #eaeaea",
                  flexShrink: 0,
                }}>
                  {done ? "✓" : ""}
                </span>
                <span style={{ color: done ? "#1d2428" : "#748398" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TutorHomePage() {
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);

  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  })();

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setFirstName(u.displayName?.split(" ")[0] ?? "");

      // Read users doc and tutors doc in parallel (read-only)
      const [userSnap, tutorSnap] = await Promise.all([
        getDoc(doc(db, "users", u.uid)),
        getDoc(doc(db, "tutors", u.uid)),
      ]);

      const userData = userSnap.data() as { tutorAccessRequest?: { status?: string; reviewedAt?: Timestamp } } | undefined;
      setShowApprovedBanner(userData?.tutorAccessRequest?.status === "approved");

      if (!tutorSnap.exists()) {
        setProfileStatus("none");
        setProfileData(null);
      } else {
        const tdata = tutorSnap.data() as Record<string, unknown>;
        const raw = typeof tdata.profileStatus === "string" ? tdata.profileStatus : "";
        const knownStatuses: ProfileStatus[] = ["draft", "pending_review", "active", "paused"];
        setProfileStatus(knownStatuses.includes(raw as ProfileStatus) ? (raw as ProfileStatus) : "draft");
        setProfileData(tdata);
      }
    });
    return () => off();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Tutor Portal
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
          Good {timeOfDay}{firstName ? `, ${firstName}` : ""}.
        </div>
        <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 3 }}>
          Here&apos;s your workspace.
        </div>
      </div>

      {/* Approved access banner */}
      {showApprovedBanner && (
        <div style={{
          borderRadius: 16,
          padding: "12px 16px",
          fontSize: 13,
          color: "#2d5a24",
          background: "linear-gradient(135deg, #f0fdf6 0%, #e8faf1 100%)",
          border: "1px solid #a7e3c0",
          borderTop: "2px solid #34a76a",
        }}>
          Tutor access approved. You now have full Tutor Portal access.
        </div>
      )}

      {/* Profile status card — shown once data is loaded */}
      {profileStatus !== null && (
        <ProfileCard status={profileStatus} profileData={profileData} />
      )}

      {/* Workspace cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <WorkspaceCard
          title="Sessions Calendar"
          subtitle="Schedule, reschedule, complete, and keep session admin moving."
          href="/hub/tutor/sessions"
          label="Sessions"
          accentColor="#456071"
          labelColor="#456071"
        />
        <WorkspaceCard
          title="Leads Marketplace"
          subtitle="Review open leads and request students you may be a good fit for."
          href="/hub/tutor/leads"
          label="Marketplace"
          accentColor="#82977e"
          labelColor="#82977e"
        />
        <WorkspaceCard
          title="My Students"
          subtitle="Open records, confirm onboarding, and add session context."
          href="/hub/tutor/students"
          label="Students"
          accentColor="#b8cad6"
          labelColor="#748398"
        />
        <WorkspaceCard
          title="Payout Export"
          subtitle="Filter pay periods and generate clean export files."
          href="/hub/tutor/payouts"
          label="Payouts"
          accentColor="#c4bbaf"
          labelColor="#8a7a6a"
        />
      </div>
    </div>
  );
}
