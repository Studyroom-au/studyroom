// src/app/hub/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
import PomoWidget from "@/components/widgets/PomoWidget";
import TaskListWidget from "@/components/widgets/TaskListWidget";
import DailyPlannerWidget from "@/components/widgets/DailyPlannerWidget";
import MoodTrackerWidget from "@/components/widgets/MoodTrackerWidget";
import { useUserRole } from "@/hooks/useUserRole";
import { useStreak } from "@/hooks/useStreak";
import PortalHeader from "@/components/hub/PortalHeader";
import GanttWidget from "@/components/widgets/GanttWidget";
import PlannerForm from "@/components/PlannerForm";

// ── Assessment list helpers ────────────────────────────────
type UpcomingListItem = {
  id: string;
  subject: string;
  title: string;
  type: string;
  dueDate: string;
  handoutDate?: string | null;
  draftDate?: string | null;
  status?: string | null;
  notes?: string | null;
  completed: boolean;
};

const LIST_SUBJECT_COLORS: Record<string, string> = {
  Maths: "#456071", English: "#82977e", Chemistry: "#748398",
  Physics: "#e39bb6", Japanese: "#c4a464", Biology: "#7aa8c0", Study: "#c4bbaf",
};
function getListSubjectColor(subject: string): string {
  return LIST_SUBJECT_COLORS[subject] ?? "#456071";
}
function detectSubject(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("math") || t.includes("calculus") || t.includes("algebra")) return "Maths";
  if (t.includes("english") || t.includes("essay") || t.includes("lit")) return "English";
  if (t.includes("chem")) return "Chemistry";
  if (t.includes("phys")) return "Physics";
  if (t.includes("bio")) return "Biology";
  if (t.includes("japan")) return "Japanese";
  return "Study";
}

// ── Room data ──────────────────────────────────────────────
const ROOMS = [
  {
    id: "room-1",
    name: "Room 1",
    vibe: "Math focus",
    svg: (
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
        <rect x="6" y="30" width="52" height="5" rx="2.5" fill="#d6e5e3"/>
        <rect x="10" y="35" width="4" height="10" rx="2" fill="#b8cad6"/>
        <rect x="50" y="35" width="4" height="10" rx="2" fill="#b8cad6"/>
        <rect x="20" y="18" width="24" height="16" rx="3" fill="#456071" opacity="0.9"/>
        <rect x="22" y="20" width="20" height="11" rx="2" fill="#7aa8c0"/>
        <rect x="24" y="22" width="11" height="1.5" rx="1" fill="rgba(255,255,255,0.55)"/>
        <rect x="24" y="25" width="8" height="1.5" rx="1" fill="rgba(255,255,255,0.35)"/>
        <rect x="24" y="28" width="13" height="1.5" rx="1" fill="rgba(255,255,255,0.22)"/>
        <rect x="18" y="30" width="28" height="3" rx="1.5" fill="#748398" opacity="0.5"/>
        <rect x="50" y="12" width="3" height="18" rx="1.5" fill="#c4bbaf"/>
        <ellipse cx="51.5" cy="12" rx="6" ry="3.5" fill="#f5ead8" stroke="#c4bbaf" strokeWidth="1"/>
        <circle cx="51.5" cy="12" r="2" fill="#f9d89a" opacity="0.9"/>
      </svg>
    ),
  },
  {
    id: "room-2",
    name: "Room 2",
    vibe: "English study",
    svg: (
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
        <ellipse cx="32" cy="30" rx="18" ry="8" fill="#e5d1d0" stroke="#c4bbaf" strokeWidth="1"/>
        <ellipse cx="32" cy="28" rx="14" ry="5.5" fill="#f0e4e0" opacity="0.7"/>
        <rect x="8" y="24" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
        <rect x="46" y="24" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
        <rect x="27" y="12" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
        <rect x="25" y="25" width="7" height="5" rx="1.5" fill="#82977e" opacity="0.7" transform="rotate(-7 28 27)"/>
        <rect x="33" y="26" width="6" height="5" rx="1.5" fill="#456071" opacity="0.55" transform="rotate(5 36 28)"/>
        <rect x="31" y="32" width="1.5" height="6" rx="1" fill="#c4bbaf" transform="rotate(-18 32 35)"/>
      </svg>
    ),
  },
  {
    id: "room-3",
    name: "Room 3",
    vibe: "Light Exam revision",
    svg: (
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
        <rect x="4" y="4" width="28" height="40" rx="3" fill="#f4f7f9" stroke="#b8cad6" strokeWidth="1" opacity="0.6"/>
        <rect x="8" y="26" width="20" height="13" rx="5" fill="#b8cad6" stroke="#748398" strokeWidth="1"/>
        <rect x="6" y="20" width="6" height="19" rx="3" fill="#748398" opacity="0.55"/>
        <rect x="22" y="20" width="6" height="19" rx="3" fill="#748398" opacity="0.55"/>
        <rect x="8" y="18" width="20" height="9" rx="4.5" fill="#748398" opacity="0.65"/>
        <rect x="36" y="6" width="24" height="34" rx="3" fill="#c4bbaf" opacity="0.35"/>
        <rect x="38" y="8" width="5" height="13" rx="1.5" fill="#e39bb6" opacity="0.85"/>
        <rect x="44" y="8" width="5" height="13" rx="1.5" fill="#82977e" opacity="0.85"/>
        <rect x="50" y="8" width="6" height="13" rx="1.5" fill="#456071" opacity="0.75"/>
        <rect x="38" y="23" width="7" height="11" rx="1.5" fill="#748398" opacity="0.55"/>
        <rect x="47" y="23" width="5" height="11" rx="1.5" fill="#b8cad6" opacity="0.85"/>
        <rect x="36" y="22" width="24" height="1.5" fill="#8b7d6b" opacity="0.35"/>
        <rect x="11" y="33" width="5" height="5" rx="1.5" fill="#8b7d6b" opacity="0.45"/>
        <ellipse cx="13.5" cy="31" rx="4" ry="3.5" fill="#82977e" opacity="0.65"/>
      </svg>
    ),
  },
  {
    id: "room-4",
    name: "Room 4",
    vibe: "Creative work",
    svg: (
      <svg width="64" height="48" viewBox="0 0 64 48" fill="none">
        <rect x="6" y="4" width="52" height="26" rx="3" fill="#f8f9fa" stroke="#b8cad6" strokeWidth="1.2"/>
        <path d="M14 13 Q22 9 30 13" stroke="#456071" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <line x1="14" y1="17" x2="28" y2="17" stroke="#456071" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
        <line x1="14" y1="21" x2="24" y2="21" stroke="#456071" strokeWidth="1.1" strokeLinecap="round" opacity="0.35"/>
        <rect x="34" y="9" width="17" height="14" rx="2" fill="#d6e5e3" opacity="0.85"/>
        <line x1="37" y1="13" x2="48" y2="13" stroke="#456071" strokeWidth="1" opacity="0.55"/>
        <line x1="37" y1="16" x2="45" y2="16" stroke="#456071" strokeWidth="1" opacity="0.4"/>
        <line x1="37" y1="19" x2="43" y2="19" stroke="#456071" strokeWidth="1" opacity="0.28"/>
        <rect x="6" y="29" width="52" height="3" rx="1.5" fill="#c4bbaf"/>
        <rect x="12" y="37" width="14" height="8" rx="4" fill="#e39bb6" opacity="0.7"/>
        <rect x="38" y="37" width="14" height="8" rx="4" fill="#456071" opacity="0.6"/>
        <rect x="26" y="38" width="12" height="5" rx="2.5" fill="#d6e5e3" stroke="#b8cad6" strokeWidth="1"/>
      </svg>
    ),
  },
];

// ── Section label ──────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--sr-muted)", whiteSpace: "nowrap" }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
    </div>
  );
}

// ── Widget card wrapper ────────────────────────────────────
function WidgetCard({
  title,
  accentColor,
  iconBg,
  icon,
  hint,
  onClick,
  children,
}: {
  title: string;
  accentColor: string;
  iconBg: string;
  icon: React.ReactNode;
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <section
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--sr-card)",
        borderRadius: "var(--sr-radius-card)",
        padding: 20,
        border: "1px solid var(--sr-border)",
        boxShadow: hovered ? "var(--sr-shadow-md)" : "var(--sr-shadow-sm)",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accentColor, borderRadius: "22px 22px 0 0" }} />

      {/* Card header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--sr-ink)", marginTop: 6, margin: 0, paddingTop: 6 }}>
          {title}
        </h3>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {icon}
        </div>
      </div>

      {/* Widget content */}
      {children}

      {/* Tap hint */}
      <span style={{ position: "absolute", bottom: 14, right: 16, fontSize: 10, color: "#c4cdd6", fontWeight: 500, letterSpacing: "0.02em" }}>
        {hint}
      </span>
    </section>
  );
}

// ── Sheet wrapper ──────────────────────────────────────────
function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        animation: "sr-slide-up 0.36s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Nav bar */}
      <div
        style={{
          background: "linear-gradient(138deg, rgba(69,96,113,0.07) 0%, rgba(255,255,255,0.97) 52%, rgba(255,255,255,1) 100%)",
          borderBottom: "1px solid var(--brand-100)",
          borderTop: "2.5px solid var(--brand)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ fontSize: 13, fontWeight: 600, color: "var(--sr-brand)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}
        >
          &larr; Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--sr-ink)" }}>{title}</span>
      </div>

      {/* Sheet body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 22, background: "var(--sr-off-white)" }}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function HubPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const role = useUserRole();
  const { currentStreak } = useStreak();
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [pomoHistory, setPomoHistory] = useState<Array<{ date: string; durationMs: number; completedAt: Date | null }>>([]);
  const [ganttView, setGanttView] = useState<"timeline" | "list">("timeline");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [upcomingItems, setUpcomingItems] = useState<UpcomingListItem[]>([]);
  const [resources, setResources] = useState<Array<{
    id: string;
    title: string;
    subject: string;
    type: string;
    fileUrl: string;
    fileName: string;
    description?: string;
    uploadedByName?: string;
    assignedTo?: string[];
  }>>([]);

  function toggleExpand(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
    });
    return () => off();
  }, [router]);

  // pomoHistory listener
  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) return;
      const q = query(
        collection(db, "users", u.uid, "pomoHistory"),
        orderBy("completedAt", "desc"),
        limit(70)
      );
      innerUnsub = onSnapshot(q, (snap) => {
        setPomoHistory(snap.docs.map((d) => ({
          date: String(d.data().date ?? ""),
          durationMs: Number(d.data().durationMs ?? 0),
          completedAt: d.data().completedAt?.toDate() ?? null,
        })));
      });
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  // Upcoming items for assessment list view
  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) { setUpcomingItems([]); return; }
      const q = query(collection(db, "users", u.uid, "upcoming"), orderBy("dueDate", "asc"));
      innerUnsub = onSnapshot(q, (snap) => {
        const list: UpcomingListItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            subject: String(data.subject || ""),
            title: String(data.title || ""),
            type: String(data.type || ""),
            dueDate: String(data.dueDate || ""),
            handoutDate: data.handoutDate ? String(data.handoutDate) : null,
            draftDate: data.draftDate ? String(data.draftDate) : null,
            status: data.status ? String(data.status) : null,
            notes: data.notes ? String(data.notes) : null,
            completed: Boolean(data.completed),
          });
        });
        setUpcomingItems(list);
      });
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  // Resources for this student
  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) { setResources([]); return; }
      const q = query(
        collection(db, "resources"),
        orderBy("createdAt", "desc"),
        limit(20),
      );
      innerUnsub = onSnapshot(q, (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
          id: string; title: string; subject: string; type: string;
          fileUrl: string; fileName: string; description?: string;
          uploadedByName?: string; assignedTo?: string[];
        }>;
        setResources(all.filter((r) =>
          !r.assignedTo || r.assignedTo.length === 0 || r.assignedTo.includes(u.uid)
        ));
      });
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  const pomoStats = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

    // Monday of current week
    const dow = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    weekStart.setHours(0, 0, 0, 0);

    const todayCount = pomoHistory.filter(h => h.date === todayKey).length;
    const weekCount = pomoHistory.filter(h => h.completedAt && h.completedAt >= weekStart).length;
    const monthCount = pomoHistory.filter(h => {
      if (!h.completedAt) return false;
      return h.completedAt.getFullYear() === now.getFullYear() && h.completedAt.getMonth() === now.getMonth();
    }).length;

    // Best streak from sorted unique dates
    const sortedDates = [...new Set(pomoHistory.map(h => h.date))].sort();
    let bestStreak = 0, cur = 0;
    sortedDates.forEach((d, i) => {
      if (i === 0) { cur = 1; }
      else {
        const diff = (new Date(d).getTime() - new Date(sortedDates[i-1]).getTime()) / 86400000;
        cur = diff === 1 ? cur + 1 : 1;
      }
      bestStreak = Math.max(bestStreak, cur);
    });

    const avgMin = pomoHistory.length > 0
      ? Math.round(pomoHistory.reduce((s, h) => s + h.durationMs, 0) / pomoHistory.length / 60000)
      : 0;

    const hourCounts: Record<string, number> = {};
    pomoHistory.forEach(h => {
      if (!h.completedAt) return;
      const hr = h.completedAt.getHours();
      const label = hr < 12 ? "Morning" : hr < 17 ? "Afternoon" : "Evening";
      hourCounts[label] = (hourCounts[label] ?? 0) + 1;
    });
    const bestTime = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    // Per-day counts for Mon–Sun of current week
    const weekCounts = [0,1,2,3,4,5,6].map(i => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      return pomoHistory.filter(h => h.date === key).length;
    });
    const maxCount = Math.max(1, ...weekCounts);

    return { todayCount, weekCount, monthCount, bestStreak, avgMin, bestTime, weekCounts, maxCount };
  }, [pomoHistory]);

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/");
    }
  }

  if (!mounted) return <div className="min-h-screen" />;

  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "tutor"
      ? "Tutor"
      : role === "tutor_pending"
      ? "Tutor (Pending)"
      : "Student";

  const canSeeTutorPortal = role === "tutor" || role === "admin" || role === "tutor_pending";
  const canSeeAdminPortal = role === "admin";

  const firstName = auth.currentUser?.displayName?.split(" ")[0] ?? "";
  const greeting = timeGreeting();

  const today = new Date();
  const dateEyebrow = today
    .toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  return (
    <div style={{ background: "var(--sr-off-white)", minHeight: "100svh" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 24px 120px" }}>

        <PortalHeader
          homeHref="/hub"
          eyebrow="Studyroom Hub"
          title="Student Hub"
          subtitle="A calm place to plan your week, join focus rooms, and keep study momentum visible."
          roleLabel={roleLabel}
          onSignOut={handleSignOut}
          navItems={[
            { label: "Hub", href: "/hub", active: pathname === "/hub" },
            { label: "Studyrooms", href: "/lobby" },
            { label: "Resources", href: "/hub/resources" },
            { label: "Profile", href: "/hub/profile" },
            ...(canSeeTutorPortal ? [{ label: "Tutor Portal", href: "/hub/tutor" }] : []),
            ...(canSeeAdminPortal ? [{ label: "Control Panel", href: "/hub/admin" }] : []),
          ]}
        />

        {/* Pending tutor banner */}
        {role === "tutor_pending" && (
          <section
            style={{
              marginBottom: 24,
              borderRadius: 24,
              padding: "20px 24px",
              background: "linear-gradient(135deg, #fffbf2 0%, #fff8e6 100%)",
              border: "1px solid #f0d88a",
              borderTop: "2.5px solid #d4a017",
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#78350f", margin: 0 }}>Tutor Portal — Pending Approval</h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "#92400e" }}>
              Tutor access is temporarily unavailable. Open the Tutor Portal and submit your in-app access request.
            </p>
            <button
              type="button"
              onClick={() => router.push("/hub/tutor")}
              style={{ marginTop: 12, borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#78350f", background: "rgba(255,255,255,0.85)", border: "1px solid #d4a017", cursor: "pointer" }}
            >
              Open Tutor Portal
            </button>
          </section>
        )}

        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--sr-mid)", margin: 0 }}>
            {dateEyebrow}
          </p>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--sr-ink)", letterSpacing: "-0.03em", margin: "4px 0 0" }}>
            {greeting}{firstName ? ", " + firstName : ""}.
          </h2>
          <p style={{ fontSize: 13, color: "var(--sr-muted)", marginTop: 4 }}>
            Your study space is ready.
          </p>
          {currentStreak >= 2 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#bde4af", color: "#2d5a24", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginTop: 6 }}>
              🔥 {currentStreak} day streak
            </span>
          )}
        </div>

        {/* Study Rooms section */}
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Study rooms" />

          {/* Room grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {ROOMS.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => router.push("/room/" + room.id)}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <ActionButton
              label="Open lobby"
              primary
              onClick={() => router.push("/lobby")}
            />
            <ActionButton
              label="Join Room 1"
              onClick={() => router.push("/room/room-1")}
            />
          </div>
        </section>

        {/* Widget grid */}
        <SectionLabel text="Your tools" />

        <main style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          <WidgetCard
            title="Private Pomodoro"
            accentColor="#456071"
            iconBg="#edf2f6"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#456071" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            hint="tap for stats"
            onClick={() => setActiveSheet("pomo")}
          >
            <div style={{ background: "#f4f7f9", borderRadius: 16, padding: 12 }}>
              <PomoWidget />
            </div>
          </WidgetCard>

          <WidgetCard
            title="Quick Study Plan"
            accentColor="#82977e"
            iconBg="#f0f5ee"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#82977e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            hint="tap to open"
            onClick={() => setActiveSheet("plan")}
          >
            <TaskListWidget />
          </WidgetCard>

          <WidgetCard
            title="Coming Up Soon"
            accentColor="#b8cad6"
            iconBg="#f0f4f8"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#748398" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            hint="tap to open planner"
            onClick={() => setActiveSheet("gantt")}
          >
            <UpcomingPreview />
          </WidgetCard>

          <WidgetCard
            title="Mood Tracker"
            accentColor="#e39bb6"
            iconBg="#fdf0f5"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e39bb6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            hint="tap for trends"
            onClick={() => setActiveSheet("mood")}
          >
            <MoodTrackerWidget />
          </WidgetCard>
        </main>

        {/* Resources widget */}
        {resources.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: 18, padding: "16px 18px",
            border: "1px solid rgba(0,0,0,0.06)", marginTop: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398" }}>
                Resources from your tutor
              </div>
              <a href="/hub/resources" style={{ fontSize: 11, color: "#456071", fontWeight: 600, textDecoration: "none" }}>
                View all →
              </a>
            </div>

            {resources.slice(0, 3).map((r) => {
              const TYPE_LABELS: Record<string, string> = {
                worksheet: "Worksheet", past_paper: "Past paper",
                guide: "Study guide", flashcard: "Flashcards", other: "Resource",
              };
              const SUBJECT_COLORS: Record<string, string> = {
                Maths: "#456071", English: "#82977e", Chemistry: "#748398",
                Physics: "#e39bb6", Japanese: "#c4a464", Biology: "#7aa8c0",
                "Study Skills": "#c4bbaf",
              };
              const color = SUBJECT_COLORS[r.subject] ?? "#748398";
              return (
                <a
                  key={r.id}
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "9px 12px", borderRadius: 12, marginBottom: 6,
                    background: "#f8f9fb", textDecoration: "none",
                    border: "1px solid rgba(0,0,0,0.04)", transition: "background 0.15s",
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: `${color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>
                    📄
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 2, display: "flex", gap: 6 }}>
                      {r.subject && (
                        <span style={{ fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: `${color}18`, color }}>
                          {r.subject}
                        </span>
                      )}
                      <span>{TYPE_LABELS[r.type] ?? "Resource"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: "#b8cad6", flexShrink: 0 }}>↗</div>
                </a>
              );
            })}

            {resources.length > 3 && (
              <a href="/hub/resources" style={{
                display: "block", textAlign: "center", fontSize: 11,
                color: "#456071", fontWeight: 600, textDecoration: "none",
                marginTop: 4, padding: "6px 0",
              }}>
                +{resources.length - 3} more resources
              </a>
            )}
          </div>
        )}

      </div>

      {/* Sheet: Pomodoro */}
      <Sheet open={activeSheet === "pomo"} title="Pomodoro · Focus stats" onClose={() => setActiveSheet(null)}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid var(--sr-border)", display: "flex", justifyContent: "center" }}>
            <PomoWidget />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "This week", value: String(pomoStats.weekCount), sub: "sessions done" },
              { label: "Today", value: String(pomoStats.todayCount), sub: "sessions done" },
              { label: "Best streak", value: String(pomoStats.bestStreak), sub: "days in a row" },
              { label: "Avg length", value: pomoStats.avgMin > 0 ? `${pomoStats.avgMin}m` : "\u2014", sub: "target: 25 min" },
              { label: "Best time", value: pomoStats.bestTime, sub: "most sessions here" },
              { label: "This month", value: String(pomoStats.monthCount), sub: "sessions total" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "white", borderRadius: 16, padding: "14px 16px", border: "1px solid var(--sr-border)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sr-muted)" }}>{stat.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--sr-ink)", margin: "4px 0 2px" }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: "var(--sr-muted)" }}>{stat.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Sessions this week</div>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 64 }}>
              {(() => {
                const dow = new Date().getDay();
                const todayIdx = dow === 0 ? 6 : dow - 1;
                return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                  const isToday = i === todayIdx;
                  const isFuture = i > todayIdx;
                  const count = pomoStats.weekCounts[i];
                  const barH = Math.max(isFuture ? 3 : (count > 0 ? 4 : 3), Math.round((count / pomoStats.maxCount) * 56));
                  const bg = isToday ? "#456071" : isFuture ? "transparent" : "#748398";
                  return (
                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <div style={{ width: "100%", height: barH, borderRadius: 4, background: bg, ...(isFuture ? { border: "1px dashed #b8cad6" } : {}) }} />
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#8a96a3" }}>{d}</div>
              ))}
            </div>
          </div>
        </div>
      </Sheet>

      {/* Sheet: Study plan */}
      <Sheet open={activeSheet === "plan"} title="Study plan · Full view" onClose={() => setActiveSheet(null)}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid var(--sr-border)" }}>
            <TaskListWidget />
          </div>
          <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid var(--sr-border)" }}>
            <DailyPlannerWidget />
          </div>
        </div>
      </Sheet>

      {/* Sheet: Gantt / Coming up */}
      <Sheet open={activeSheet === "gantt"} title="Coming up" onClose={() => setActiveSheet(null)}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* View toggle */}
          <div style={{ display: "flex", background: "#f4f7f9", borderRadius: 12, padding: 4, gap: 4 }}>
            <button
              type="button"
              onClick={() => setGanttView("timeline")}
              style={{ flex: 1, padding: "6px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: ganttView === "timeline" ? "#456071" : "transparent", color: ganttView === "timeline" ? "#fff" : "#677a8a", transition: "all 0.15s" }}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setGanttView("list")}
              style={{ flex: 1, padding: "6px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: ganttView === "list" ? "#456071" : "transparent", color: ganttView === "list" ? "#fff" : "#677a8a", transition: "all 0.15s" }}
            >
              Assessments
            </button>
          </div>

          {ganttView === "timeline" && (
            <>
              <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 3 }}>Term timeline</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 14 }}>Your deadlines across the next 6 weeks.</div>
                <GanttWidget />
              </div>
              <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 14 }}>Add a deadline</div>
                <PlannerForm />
              </div>
            </>
          )}

          {ganttView === "list" && (
            <div>
              {upcomingItems.filter(item => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(item => {
                const due = new Date(item.dueDate);
                const daysUntil = Math.round((due.getTime() - Date.now()) / 86400000);
                const isExpanded = expandedItems.has(item.id);
                const subjectColor = getListSubjectColor(item.subject || detectSubject(item.title));
                return (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", borderLeft: `3px solid ${subjectColor}`, marginBottom: 8, overflow: "hidden" }}>
                    <div onClick={() => toggleExpand(item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428", marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "#8a96a3", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {item.subject && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: `${subjectColor}18`, color: subjectColor }}>
                              {item.subject}
                            </span>
                          )}
                          <span>{item.type === "exam" ? "Exam" : "Assessment"}</span>
                          <span>·</span>
                          <span>{due.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: daysUntil < 0 ? "#fce8ee" : daysUntil <= 7 ? "#fce8ee" : daysUntil <= 14 ? "#fef3e2" : "#e8f0fa", color: daysUntil < 0 ? "#c0445e" : daysUntil <= 7 ? "#c0445e" : daysUntil <= 14 ? "#a06020" : "#3a6090" }}>
                          {daysUntil < 0 ? "Overdue" : daysUntil === 0 ? "Today" : `In ${daysUntil}d`}
                        </span>
                        <span style={{ fontSize: 11, color: "#8a96a3" }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 14px 12px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, marginBottom: 10 }}>
                          {item.handoutDate && (
                            <div>
                              <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 2 }}>Handout</div>
                              <div style={{ fontSize: 12, color: "#1d2428" }}>{new Date(item.handoutDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                            </div>
                          )}
                          {item.draftDate && (
                            <div>
                              <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 2 }}>Draft due</div>
                              <div style={{ fontSize: 12, color: "#1d2428" }}>{new Date(item.draftDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 2 }}>Due date</div>
                            <div style={{ fontSize: 12, color: "#1d2428", fontWeight: 600 }}>{due.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 2 }}>Status</div>
                            <div style={{ fontSize: 12, color: "#1d2428" }}>{item.status || "Not started"}</div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 4 }}>Notes</div>
                          <textarea
                            defaultValue={item.notes ?? ""}
                            onBlur={async e => {
                              const u = auth.currentUser;
                              if (!u) return;
                              await updateDoc(doc(db, "users", u.uid, "upcoming", item.id), {
                                notes: e.target.value.trim() || null,
                                updatedAt: serverTimestamp(),
                              });
                            }}
                            placeholder="Add notes..."
                            rows={2}
                            style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.08)", borderRadius: 9, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none", background: "#fafbfc", color: "#1d2428", boxSizing: "border-box" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              const u = auth.currentUser;
                              if (!u) return;
                              await updateDoc(doc(db, "users", u.uid, "upcoming", item.id), { completed: true, completedAt: serverTimestamp() });
                            }}
                            style={{ background: "#d4edcc", color: "#2d5a24", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Mark done
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const u = auth.currentUser;
                              if (!u) return;
                              if (!window.confirm("Delete this deadline?")) return;
                              await deleteDoc(doc(db, "users", u.uid, "upcoming", item.id));
                            }}
                            style={{ background: "#fce8ee", color: "#c0445e", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {upcomingItems.filter(i => i.completed).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>Completed</div>
                  {upcomingItems.filter(i => i.completed).sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map(item => (
                    <div key={item.id} style={{ background: "#f4f7f9", borderRadius: 12, padding: "9px 14px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.7 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2428", textDecoration: "line-through" }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "#8a96a3" }}>{item.subject} · {new Date(item.dueDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const u = auth.currentUser;
                          if (!u) return;
                          await updateDoc(doc(db, "users", u.uid, "upcoming", item.id), { completed: false, completedAt: null });
                        }}
                        style={{ background: "none", border: "none", fontSize: 11, color: "#456071", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                      >
                        Undo
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 14 }}>Add a deadline</div>
                <PlannerForm />
              </div>
            </div>
          )}

        </div>
      </Sheet>

      {/* Sheet: Mood trends */}
      <Sheet open={activeSheet === "mood"} title="Mood · 7-day trend" onClose={() => setActiveSheet(null)}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 1 — Last 7 days */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Last 7 days</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {[
                { label: "Tue 11", bg: "#bde4af", emoji: "\uD83D\uDE04" },
                { label: "Wed 12", bg: "#d6e5e3", emoji: "\uD83D\uDE10" },
                { label: "Thu 13", bg: "#e5d1d0", emoji: "\uD83D\uDE34" },
                { label: "Fri 14", bg: "#d6e5e3", emoji: "\uD83D\uDE10" },
                { label: "Sat 15", bg: "#bde4af", emoji: "\uD83D\uDE04" },
                { label: "Sun 16", bg: "#f0e4d0", emoji: "\uD83D\uDE2C" },
                { label: "Mon 17", bg: "#bde4af", emoji: "\uD83D\uDE04" },
              ].map((d) => (
                <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: d.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                    {d.emoji}
                  </div>
                  <span style={{ fontSize: 9, color: "#8a96a3", textAlign: "center" }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2 — Last 30 days distribution */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Last 30 days</div>
            {[
              { label: "\uD83D\uDE04 Great",   pct: "60%", bg: "#bde4af", count: 12 },
              { label: "\uD83D\uDE10 OK",       pct: "35%", bg: "#d6e5e3", count: 7 },
              { label: "\uD83D\uDE34 Tired",    pct: "20%", bg: "#e5d1d0", count: 4 },
              { label: "\uD83D\uDE2C Stressed", pct: "15%", bg: "#f0e4d0", count: 3 },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 60, fontSize: 11, fontWeight: 600, color: "#1d2428", flexShrink: 0 }}>{row.label}</div>
                <div style={{ flex: 1, height: 7, background: "#edf0f3", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: row.pct, borderRadius: 20, background: row.bg }} />
                </div>
                <div style={{ fontSize: 10, color: "#8a96a3", width: 20, textAlign: "right", flexShrink: 0 }}>{row.count}</div>
              </div>
            ))}
          </div>

          {/* Card 3 — Today's check-in */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 10 }}>{"Today\u2019s check-in"}</div>
            <MoodTrackerWidget />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function RoomCard({ room, onClick }: { room: typeof ROOMS[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--sr-card)",
        borderRadius: 20,
        padding: "16px 12px 14px",
        border: "1px solid " + (hovered ? "rgba(69,96,113,0.2)" : "var(--sr-border)"),
        boxShadow: hovered ? "var(--sr-shadow-md)" : "var(--sr-shadow-sm)",
        cursor: "pointer",
        transition: "all 0.22s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        textAlign: "center",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      {room.svg}
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sr-ink)" }}>{room.name}</span>
      <span style={{ fontSize: 10, color: "var(--sr-muted)", marginTop: -4 }}>{room.vibe}</span>
    </button>
  );
}

function UpcomingPreview() {
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<Array<{
    id: string; subject: string; title: string; dueDate: string; completed: boolean; type?: string;
  }>>([]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) { try { await u.getIdToken(true); } catch { /* ignore */ } setAuthReady(true); }
      else { setAuthReady(false); setItems([]); }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;
    const q = query(collection(db, "users", u.uid, "upcoming"), orderBy("dueDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: typeof items = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!data.completed) {
          list.push({ id: d.id, subject: String(data.subject || ""), title: String(data.title || ""), dueDate: String(data.dueDate || ""), completed: Boolean(data.completed), type: String(data.type || "") });
        }
      });
      setItems(list.slice(0, 3));
    });
    return () => unsub();
  }, [authReady]);

  if (!authReady) return <div style={{ height: 60, background: "rgba(0,0,0,0.04)", borderRadius: 10 }} />;

  if (items.length === 0) {
    return (
      <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: 16, textAlign: "center", fontSize: 11, color: "#8a96a3" }}>
        No upcoming deadlines. Tap to add one.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => {
        const today = new Date();
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const due = item.dueDate ? new Date(item.dueDate) : null;
        const diffDays = due
          ? Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - todayMid.getTime()) / 86400000)
          : 999;
        let borderColor = "#b0c8d8", bg = "#f3f7f9", badgeBg = "#d4e8f0", badgeColor = "#1a3a4a";
        let label = `In ${diffDays}d`;
        if (diffDays < 0) {
          borderColor = "#e39bb6"; bg = "#fdf2f4"; badgeBg = "#fce4eb"; badgeColor = "#9a2040";
          label = `${Math.abs(diffDays)}d overdue`;
        } else if (diffDays === 0) {
          borderColor = "#d4a017"; bg = "#fffbf0"; badgeBg = "#fef3c7"; badgeColor = "#7a4d10";
          label = "Today";
        } else if (diffDays <= 7) {
          borderColor = "#e39bb6"; bg = "#fdf2f4"; badgeBg = "#fce4eb"; badgeColor = "#9a2040";
          label = `${diffDays}d`;
        } else if (diffDays <= 14) {
          borderColor = "#d4b896"; bg = "#fdf8f3"; badgeBg = "#f5e8d4"; badgeColor = "#7a4d20";
          label = `In ${diffDays}d`;
        }
        // 15+ days: stays blue (default above)
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 11, borderLeft: `3px solid ${borderColor}`, background: bg }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1d2428" }}>{item.subject}</span>
                {item.type && (
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: item.type === "exam" ? "#d6e5e3" : "#f0e9e4", color: item.type === "exam" ? "#1a3a4a" : "#5a3a38" }}>
                    {item.type === "exam" ? "Exam" : "Assessment"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 1 }}>{item.title}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: badgeBg, color: badgeColor, whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? "#344d5c" : "var(--sr-brand)",
          color: "white",
          border: "none",
          borderRadius: 14,
          padding: "10px 22px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(69,96,113,0.2)",
          transform: hovered ? "translateY(-1px)" : "translateY(0)",
          transition: "all 0.18s",
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#f5f8fa" : "white",
        color: "var(--sr-brand)",
        border: "1.5px solid " + (hovered ? "var(--sr-brand)" : "rgba(69,96,113,0.2)"),
        borderRadius: 14,
        padding: "9px 18px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.18s",
      }}
    >
      {label}
    </button>
  );
}
