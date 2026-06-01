// src/app/hub/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

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
import FeedbackButton from "@/components/FeedbackButton";

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
  draftCompleted?: boolean;
  completed: boolean;
};

type Checkpoint = {
  id: string;
  title: string;
  dueDate?: string | null;
  completed: boolean;
  order?: number;
  linkedTaskId?: string | null;
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
// ── Mood line graph ────────────────────────────────────────
function MoodLineGraph({ points }: {
  points: Array<{ ts: Date; value: number; mood: string }>;
}) {
  const MOOD_BG: Record<string, string> = {
    great: "#bde4af", good: "#d6e5e3", ok: "#eaeaea", tired: "#e5d1d0", stressed: "#f0e4d0",
  };

  if (points.length < 2) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: "#8a96a3" }}>
        {points.length === 0
          ? "Log your mood a few times to see your trend line here."
          : "Add one more mood entry to see your trend line."}
      </div>
    );
  }

  const W = 480;
  const H = 130;
  const PL = 50; // left for Y labels
  const PR = 10;
  const PT = 10;
  const PB = 24; // bottom for X labels
  const gW = W - PL - PR;
  const gH = H - PT - PB;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const xMin = sevenDaysAgo.getTime();
  const xMax = now.getTime();
  const xRange = Math.max(xMax - xMin, 1);

  const toX = (ts: Date) => PL + ((ts.getTime() - xMin) / xRange) * gW;
  const toY = (v: number) => PT + gH - ((v - 1) / 4) * gH;

  const polyPts = points.map(p => `${toX(p.ts).toFixed(1)},${toY(p.value).toFixed(1)}`).join(" ");

  const yLines = [
    { v: 5, label: "Great" },
    { v: 4, label: "Good" },
    { v: 3, label: "OK" },
    { v: 2, label: "Tired" },
    { v: 1, label: "Stressed" },
  ];

  const dayTicks: Array<{ x: number; label: string }> = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const x = toX(d);
    if (x >= PL - 2 && x <= W - PR + 2) {
      dayTicks.push({ x, label: d.toLocaleDateString("en-AU", { weekday: "narrow" }) });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-label="Mood trend line over 7 days"
    >
      {yLines.map(({ v, label }) => {
        const y = toY(v);
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#edf0f3" strokeWidth="1" />
            <text x={PL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="#b0bec5" fontFamily="system-ui,sans-serif">{label}</text>
          </g>
        );
      })}

      {dayTicks.map((t, i) => (
        <g key={i}>
          <line x1={t.x} y1={PT} x2={t.x} y2={H - PB} stroke="#f0f2f5" strokeWidth="1" strokeDasharray="2,3" />
          <text x={t.x} y={H - PB + 15} textAnchor="middle" fontSize="9" fill="#b0bec5" fontFamily="system-ui,sans-serif">{t.label}</text>
        </g>
      ))}

      <polyline
        points={polyPts}
        fill="none"
        stroke="#456071"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(p.ts).toFixed(1)}
          cy={toY(p.value).toFixed(1)}
          r="4.5"
          fill={MOOD_BG[p.mood] ?? "#eaeaea"}
          stroke="#456071"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

function WidgetCard({
  title,
  accentColor,
  iconBg,
  icon,
  onClick,
  children,
}: {
  title: string;
  accentColor: string;
  iconBg: string;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [expandHovered, setExpandHovered] = useState(false);
  return (
    <section
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--sr-card)",
        borderRadius: "var(--sr-radius-card)",
        padding: "20px 20px 52px",
        border: "1px solid var(--sr-border)",
        boxShadow: hovered ? "var(--sr-shadow-md)" : "var(--sr-shadow-sm)",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        transition: "box-shadow 0.18s",
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

      {/* Expand trigger — only this opens the Sheet */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setExpandHovered(true)}
        onMouseLeave={() => setExpandHovered(false)}
        aria-label="Open full view"
        title="Open full view"
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: expandHovered ? "rgba(69,96,113,0.12)" : "rgba(69,96,113,0.06)",
          border: "1px solid rgba(69,96,113,0.1)",
          borderRadius: 9,
          cursor: "pointer",
          color: "#748398",
          padding: 0,
          fontFamily: "inherit",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7.5 1 11 1 11 4.5"/>
          <polyline points="4.5 11 1 11 1 7.5"/>
          <line x1="11" y1="1" x2="6.5" y2="5.5"/>
          <line x1="1" y1="11" x2="5.5" y2="6.5"/>
        </svg>
      </button>
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
      {/* Nav bar — matches SubPageHeader style */}
      <div
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(69,96,113,0.12)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 12, fontWeight: 600, color: "#456071",
            background: "rgba(69,96,113,0.07)", border: "none",
            borderRadius: 20, padding: "6px 14px",
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          ← Hub
        </button>
        <div style={{ width: 1, height: 16, background: "rgba(0,0,0,0.1)" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.01em" }}>
          {title}
        </span>
      </div>

      {/* Sheet body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 22, background: "var(--sr-off-white)" }}>
        {children}
      </div>
    </div>
  );
}

// ── Shared deadline detail helpers ────────────────────────
function listGetDiffFromToday(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
function listFormatShort(d: Date) {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function listStatusPillStyle(status: string) {
  if (status === "In progress") return { background: "#fef3e2", color: "#a06020" };
  if (status === "Submitted")   return { background: "#d4edcc", color: "#2d5a24" };
  return { background: "rgba(0,0,0,0.06)", color: "#748398" };
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
  const [moodLogs, setMoodLogs] = useState<Array<{ date: string; mood: string; value?: number; createdAt?: Date | null }>>([]);
  const [ganttView, setGanttView] = useState<"timeline" | "list">("list");
  const [ganttSelectedId, setGanttSelectedId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [allCheckpoints, setAllCheckpoints] = useState<Record<string, Checkpoint[]>>({});
  const [checkpointText, setCheckpointText] = useState("");
  const [checkpointDate, setCheckpointDate] = useState("");
  const [checkpointSaving, setCheckpointSaving] = useState(false);
  const [upcomingItems, setUpcomingItems] = useState<UpcomingListItem[]>([]);
  const backfillRan = useRef(false);
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
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [roomAccessEnabled, setRoomAccessEnabled] = useState(true);

  async function saveListStatus(id: string, newStatus: string) {
    const u = auth.currentUser;
    if (!u) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { status: newStatus });
  }

  async function toggleListDraft(id: string) {
    const u = auth.currentUser;
    if (!u) return;
    const item = upcomingItems.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { draftCompleted: !item.draftCompleted });
  }

  async function handleListCompletion(id: string, currentlyCompleted: boolean) {
    const u = auth.currentUser;
    if (!u) return;
    // Optimistic update — move the item immediately in the list view
    setUpcomingItems(prev => prev.map(i => i.id === id ? { ...i, completed: !currentlyCompleted } : i));
    setGanttSelectedId(null);
    if (currentlyCompleted) {
      await updateDoc(doc(db, "users", u.uid, "upcoming", id), { completed: false, completedAt: null });
    } else {
      await updateDoc(doc(db, "users", u.uid, "upcoming", id), { completed: true, completedAt: serverTimestamp() });
    }
  }

  // Always-on checkpoint listeners — one per assessment, so writes from any view land immediately.
  useEffect(() => {
    if (!uid || upcomingItems.length === 0) return;
    const unsubs = upcomingItems.map(item => {
      const q = query(
        collection(db, "users", uid, "upcoming", item.id, "checkpoints"),
        orderBy("order", "asc")
      );
      return onSnapshot(q, (snap) => {
        const cps: Checkpoint[] = snap.docs.map(d => ({
          id: d.id,
          title: String(d.data().title || ""),
          completed: Boolean(d.data().completed),
          dueDate: d.data().dueDate ? String(d.data().dueDate) : null,
          order: typeof d.data().order === "number" ? d.data().order : 999,
          linkedTaskId: d.data().linkedTaskId ? String(d.data().linkedTaskId) : null,
        }));
        setAllCheckpoints(prev => ({ ...prev, [item.id]: cps }));
      });
    });
    return () => unsubs.forEach(unsub => unsub());
  }, [uid, upcomingItems]);

  // Reset checkpoint form inputs whenever the selected assessment changes.
  useEffect(() => {
    setCheckpointText("");
    setCheckpointDate("");
  }, [ganttSelectedId]);

  async function addCheckpoint() {
    const title = checkpointText.trim();
    if (!title || !ganttSelectedId || checkpointSaving) return;
    const u = auth.currentUser;
    if (!u) return;
    setCheckpointSaving(true);
    try {
      const cpRef = await addDoc(
        collection(db, "users", u.uid, "upcoming", ganttSelectedId, "checkpoints"),
        { title, dueDate: checkpointDate || null, completed: false, createdAt: serverTimestamp(), order: (allCheckpoints[ganttSelectedId] ?? []).length, linkedTaskId: null }
      );
      setCheckpointText("");
      setCheckpointDate("");
      // Best-effort: create a linked task so this checkpoint appears in the task list
      try {
        const taskRef = await addDoc(collection(db, "users", u.uid, "tasks"), {
          title,
          done: false,
          createdAt: serverTimestamp(),
          source: "from_assessment",
          assessmentId: ganttSelectedId,
          upcomingId: ganttSelectedId,
          checkpointId: cpRef.id,
        });
        await updateDoc(cpRef, { linkedTaskId: taskRef.id });
      } catch {}
    } finally {
      setCheckpointSaving(false);
    }
  }

  async function toggleCheckpoint(id: string, current: boolean) {
    if (!ganttSelectedId) return;
    const u = auth.currentUser;
    if (!u) return;
    // Snapshot all closure values synchronously before any awaits
    const currentCheckpoints = allCheckpoints[ganttSelectedId] ?? [];
    const cp = currentCheckpoints.find((c) => c.id === id);
    const assessmentId = ganttSelectedId;
    const allDone = currentCheckpoints.length > 0 && currentCheckpoints.every(c => c.id === id ? !current : c.completed);
    const sel = upcomingItems.find(i => i.id === assessmentId);

    await updateDoc(doc(db, "users", u.uid, "upcoming", assessmentId, "checkpoints", id), { completed: !current });
    // Best-effort: sync task done state
    if (cp?.linkedTaskId) {
      try {
        await updateDoc(doc(db, "users", u.uid, "tasks", cp.linkedTaskId), { done: !current });
      } catch {}
    }
    // Sync assessment completion: all checkpoints done → mark complete; any undone → revert
    if (currentCheckpoints.length > 0) {
      if (allDone && sel && !sel.completed) {
        setUpcomingItems(prev => prev.map(i => i.id === assessmentId ? { ...i, completed: true } : i));
        await updateDoc(doc(db, "users", u.uid, "upcoming", assessmentId), {
          completed: true,
          completedAt: serverTimestamp(),
        });
      } else if (!allDone && sel && sel.completed) {
        setUpcomingItems(prev => prev.map(i => i.id === assessmentId ? { ...i, completed: false, status: "In progress" } : i));
        await updateDoc(doc(db, "users", u.uid, "upcoming", assessmentId), {
          completed: false,
          status: "In progress",
          completedAt: null,
        });
      }
    }
  }

  async function deleteCheckpoint(id: string) {
    if (!ganttSelectedId) return;
    const u = auth.currentUser;
    if (!u) return;
    const cp = (allCheckpoints[ganttSelectedId ?? ""] ?? []).find((c) => c.id === id);
    await deleteDoc(doc(db, "users", u.uid, "upcoming", ganttSelectedId, "checkpoints", id));
    // Best-effort: remove linked task
    if (cp?.linkedTaskId) {
      try {
        await deleteDoc(doc(db, "users", u.uid, "tasks", cp.linkedTaskId));
      } catch {}
    }
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) { router.replace("/"); setUid(null); }
      else setUid(u.uid);
    });
    return () => off();
  }, [router]);

  // Check whether a parent has disabled study room access for this student.
  // Only applies to the "student" role; tutors/admins always have access.
  // Runs whenever uid or role becomes available.
  useEffect(() => {
    if (!uid || role === null) return;
    if (role !== "student") { setRoomAccessEnabled(true); return; }
    getDocs(query(collection(db, "students"), where("hubUid", "==", uid), limit(1)))
      .then((snap) => {
        if (!snap.empty) {
          setRoomAccessEnabled(snap.docs[0].data().roomAccessEnabled !== false);
        }
      })
      .catch(() => { /* default to enabled */ });
  }, [uid, role]);

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
            draftCompleted: Boolean(data.draftCompleted),
            completed: Boolean(data.completed),
          });
        });
        setUpcomingItems(list);
      });
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  // One-time backfill: write upcomingId and checkpointId onto old task documents that are missing them
  useEffect(() => {
    if (backfillRan.current || upcomingItems.length === 0) return;
    backfillRan.current = true;
    const u = auth.currentUser;
    if (!u) return;
    void (async () => {
      const snap = await getDocs(
        query(
          collection(db, "users", u.uid, "tasks"),
          where("source", "==", "from_assessment")
        )
      );

      // Phase 1: backfill upcomingId from assessmentId for very old tasks
      const phase1 = snap.docs
        .filter((d) => !d.data().upcomingId && d.data().assessmentId)
        .map((d) =>
          updateDoc(doc(db, "users", u.uid, "tasks", d.id), {
            upcomingId: String(d.data().assessmentId),
          })
        );
      if (phase1.length > 0) await Promise.all(phase1);

      // Phase 2: backfill checkpointId for tasks with upcomingId but no checkpointId.
      // Each checkpoint document has linkedTaskId pointing to the task, so we match on that.
      const needCpId = snap.docs.filter(
        (d) => (d.data().upcomingId || d.data().assessmentId) && !d.data().checkpointId
      );
      if (needCpId.length === 0) return;

      // Group tasks needing checkpointId by their assessment ID
      const byAssessment = new Map<string, string[]>();
      for (const taskDoc of needCpId) {
        const aid = String(taskDoc.data().upcomingId || taskDoc.data().assessmentId);
        if (!byAssessment.has(aid)) byAssessment.set(aid, []);
        byAssessment.get(aid)!.push(taskDoc.id);
      }

      // For each assessment, load its checkpoints and match via linkedTaskId
      const phase2: Promise<void>[] = [];
      for (const [assessmentId, taskIds] of byAssessment) {
        const cpSnap = await getDocs(
          collection(db, "users", u.uid, "upcoming", assessmentId, "checkpoints")
        );
        for (const cpDoc of cpSnap.docs) {
          const linkedTaskId = cpDoc.data().linkedTaskId;
          if (!linkedTaskId || !taskIds.includes(linkedTaskId)) continue;
          phase2.push(
            updateDoc(doc(db, "users", u.uid, "tasks", linkedTaskId), {
              checkpointId: cpDoc.id,
            })
          );
        }
      }
      if (phase2.length > 0) await Promise.all(phase2);
    })();
  }, [upcomingItems]);

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

  // Mood logs for the trend sheet — last 60 entries, newest first by actual timestamp
  useEffect(() => {
    const MOOD_VAL: Record<string, number> = { stressed: 1, tired: 2, ok: 3, good: 4, great: 5 };
    let innerUnsub: (() => void) | null = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) { setMoodLogs([]); return; }
      const q = query(
        collection(db, "users", u.uid, "moodLogs"),
        orderBy("createdAt", "desc"),
        limit(60)
      );
      innerUnsub = onSnapshot(q, (snap) => {
        setMoodLogs(snap.docs.map(d => {
          const data = d.data();
          const mood = String(data.mood ?? "ok");
          return {
            date: String(data.dateKey ?? data.date ?? ""),
            mood,
            value: typeof data.value === "number" ? data.value : (MOOD_VAL[mood] ?? 3),
            createdAt: data.createdAt?.toDate?.() ?? null,
          };
        }));
      });
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  // Lightweight task count for the "Start here" checklist — limit(1) so it
  // doesn't duplicate TaskListWidget's full query.
  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const offAuth = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) { setTaskCount(0); return; }
      const q = query(collection(db, "users", u.uid, "tasks"), limit(1));
      innerUnsub = onSnapshot(q, (snap) => setTaskCount(snap.size));
    });
    return () => { offAuth(); if (innerUnsub) innerUnsub(); };
  }, []);

  // Delay checklist reveal so Firestore cache has time to populate. Returning
  // users' data arrives from cache in <200 ms — well before this fires — so
  // they never see a false-positive empty checklist.
  useEffect(() => {
    const t = setTimeout(() => setDataReady(true), 1000);
    return () => clearTimeout(t);
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

  const moodTrendData = useMemo(() => {
    const MOOD_META: Record<string, { label: string; emoji: string; bg: string }> = {
      great:    { label: "Great",    emoji: "😊", bg: "#bde4af" },
      good:     { label: "Good",     emoji: "🙂", bg: "#d6e5e3" },
      ok:       { label: "OK",       emoji: "😐", bg: "#eaeaea" },
      tired:    { label: "Tired",    emoji: "😴", bg: "#e5d1d0" },
      stressed: { label: "Stressed", emoji: "😰", bg: "#f0e4d0" },
    };

    // Most recent entry per day (moodLogs sorted desc by createdAt — first hit wins)
    const latestPerDay = new Map<string, string>();
    moodLogs.forEach(l => {
      if (l.date && !latestPerDay.has(l.date)) latestPerDay.set(l.date, l.mood);
    });

    // Last 7 days — index 0 = 6 days ago, index 6 = today
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${mo}-${dd}`;
      const weekday = d.toLocaleDateString("en-AU", { weekday: "short" });
      return { label: `${weekday} ${d.getDate()}`, mood: latestPerDay.get(key) ?? null };
    });

    // 30-day distribution — all entries, not deduplicated
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const recent30 = moodLogs.filter(l => l.date >= cutoffStr);
    const total30 = recent30.length;

    const counts: Record<string, number> = { great: 0, good: 0, ok: 0, tired: 0, stressed: 0 };
    recent30.forEach(l => { if (l.mood in counts) counts[l.mood]++; });

    const dist30 = ["great", "good", "ok", "tired", "stressed"].map(mood => ({
      mood,
      ...(MOOD_META[mood] ?? { label: mood, emoji: "", bg: "#edf0f3" }),
      count: counts[mood] ?? 0,
      pct: total30 > 0 ? Math.round(((counts[mood] ?? 0) / total30) * 100) : 0,
    }));

    // Line graph — all entries with timestamps in the last 7 days, sorted ascending
    const MOOD_VAL: Record<string, number> = { stressed: 1, tired: 2, ok: 3, good: 4, great: 5 };
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const chartPoints = moodLogs
      .filter((l): l is typeof l & { createdAt: Date } =>
        l.createdAt instanceof Date && l.createdAt >= sevenDaysAgo
      )
      .map(l => ({
        ts: l.createdAt,
        value: l.value ?? MOOD_VAL[l.mood] ?? 3,
        mood: l.mood,
      }))
      .sort((a, b) => a.ts.getTime() - b.ts.getTime());

    return { last7, dist30, total30, MOOD_META, chartPoints };
  }, [moodLogs]);

  const checkpoints = allCheckpoints[ganttSelectedId ?? ""] ?? [];

  const hasUpcoming = upcomingItems.length > 0;
  const hasMoodData = moodLogs.length > 0;
  const hasPomoData = pomoHistory.length > 0;
  const hasTaskData = (taskCount ?? 0) > 0;
  const showChecklist = dataReady && !(hasUpcoming && hasMoodData && hasPomoData && hasTaskData);

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
            ...(roomAccessEnabled ? [{ label: "Studyrooms", href: "/lobby" }] : []),
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

        {/* Start Here checklist — visible until all four items are done */}
        {showChecklist && (
          <section style={{ marginBottom: 24, background: "#fff", borderRadius: 20, padding: "18px 22px 14px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
              Getting started
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428", marginBottom: 3 }}>
              Welcome to your hub
            </div>
            <div style={{ fontSize: 12, color: "#8a96a3", lineHeight: 1.7, marginBottom: 14 }}>
              A few gentle first steps — no rush, there&apos;s no right order.
            </div>
            {[
              { done: hasUpcoming, label: "Add your first deadline",  cta: "Add one",    action: () => setActiveSheet("gantt") },
              { done: hasTaskData, label: "Add one task for today",   cta: "Add task",   action: () => setActiveSheet("plan")  },
              { done: hasMoodData, label: "Log how you’re feeling",      cta: "Log mood",  action: () => setActiveSheet("mood")  },
              { done: hasPomoData, label: "Try a focus session",      cta: "Start focus",action: () => setActiveSheet("pomo")  },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid #f0f2f5" : "none", opacity: item.done ? 0.5 : 1, transition: "opacity 0.25s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: item.done ? "#bde4af" : "transparent", border: item.done ? "none" : "2px solid #d4dce4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1.5 4L3.5 6L8.5 1" stroke="#2d5a24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: item.done ? 400 : 600, color: item.done ? "#8a96a3" : "#1d2428", textDecoration: item.done ? "line-through" : "none" }}>
                  {item.label}
                </span>
                {!item.done && (
                  <button type="button" onClick={item.action} style={{ fontSize: 11, fontWeight: 600, color: "#456071", background: "#f0f5f7", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {item.cta}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Study Rooms section — hidden entirely when parent has disabled access */}
        {roomAccessEnabled && (
          <section style={{ marginBottom: 24 }}>
            <SectionLabel text="Study rooms" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {ROOMS.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => router.push("/room/" + room.id)}
                />
              ))}
            </div>
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
        )}

        {/* Widget grid */}
        <SectionLabel text="Your tools" />

        <main style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          <WidgetCard
            title="Private Pomodoro"
            accentColor="#456071"
            iconBg="#edf2f6"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#456071" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
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
            onClick={() => setActiveSheet("plan")}
          >
            <TaskListWidget upcomingItems={upcomingItems} />
          </WidgetCard>

          <WidgetCard
            title="Coming Up Soon"
            accentColor="#b8cad6"
            iconBg="#f0f4f8"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#748398" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            onClick={() => setActiveSheet("gantt")}
          >
            <UpcomingPreview />
          </WidgetCard>

          <WidgetCard
            title="Mood Tracker"
            accentColor="#e39bb6"
            iconBg="#fdf0f5"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e39bb6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
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
          {pomoHistory.length === 0 && (
            <div style={{ background: "#f4f9f7", borderRadius: 14, padding: "13px 18px", fontSize: 12, color: "#456071", lineHeight: 1.7 }}>
              No sessions yet — ready when you are. Even one 25-minute block makes a difference.
            </div>
          )}
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
            <TaskListWidget upcomingItems={upcomingItems} />
          </div>
          <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid var(--sr-border)" }}>
            <DailyPlannerWidget items={upcomingItems} />
          </div>
        </div>
      </Sheet>

      {/* Sheet: Gantt / Coming up */}
      <Sheet open={activeSheet === "gantt"} title="Your deadlines" onClose={() => { setActiveSheet(null); setGanttSelectedId(null); }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Next up summary card */}
          {(() => {
            const next = upcomingItems
              .filter(i => !i.completed)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
            if (!next) return null;
            const todayMs = new Date().setHours(0, 0, 0, 0);
            const diff = Math.round((new Date(next.dueDate).getTime() - todayMs) / 86400000);
            const accent = diff < 0 || diff <= 4 ? "#c97777" : diff <= 14 ? "#c4954a" : "#748398";
            const bg = diff < 0 || diff <= 4 ? "#fff8f8" : diff <= 14 ? "#fffbf4" : "#f4f7f9";
            const timing = diff < 0 ? "Needs attention"
              : diff === 0 ? "Due today"
              : diff === 1 ? "Due tomorrow"
              : `Due in ${diff} days`;
            const tip = diff <= 0 ? "Start with just 25 minutes — any progress counts."
              : diff <= 4 ? "Coming up soon. Even a short session today will help."
              : diff <= 14 ? "A good time to map out your approach."
              : null;
            return (
              <div style={{ background: bg, borderRadius: 16, padding: "16px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", borderRight: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)", borderLeft: `3px solid ${accent}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, marginBottom: 6 }}>
                  Next up
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1d2428", lineHeight: 1.3, marginBottom: 4 }}>
                  {next.title}
                </div>
                <div style={{ fontSize: 12, color: "#748398", marginBottom: tip ? 8 : 0 }}>
                  {next.subject && <span>{next.subject}{" · "}</span>}
                  <span style={{ fontWeight: 600, color: accent }}>{timing}</span>
                </div>
                {tip && (
                  <div style={{ fontSize: 11, color: "#8a96a3", lineHeight: 1.6, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 8 }}>
                    {tip}
                  </div>
                )}
              </div>
            );
          })()}

          {/* View toggle */}
          <div style={{ display: "flex", background: "#f4f7f9", borderRadius: 12, padding: 4, gap: 4 }}>
            <button
              type="button"
              onClick={() => { setGanttView("timeline"); setGanttSelectedId(null); }}
              style={{ flex: 1, padding: "6px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: ganttView === "timeline" ? "#456071" : "transparent", color: ganttView === "timeline" ? "#fff" : "#677a8a", transition: "all 0.15s" }}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => { setGanttView("list"); setGanttSelectedId(null); }}
              style={{ flex: 1, padding: "6px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: ganttView === "list" ? "#456071" : "transparent", color: ganttView === "list" ? "#fff" : "#677a8a", transition: "all 0.15s" }}
            >
              Assessments
            </button>
          </div>

          {/* Shared detail panel — renders regardless of which view is active */}
          {(() => {
            const sel = ganttSelectedId ? upcomingItems.find(i => i.id === ganttSelectedId) : null;
            if (!sel) return null;
            const diff = listGetDiffFromToday(sel.dueDate);
            const accent = diff < 0 || diff <= 4 ? "#c97777" : diff <= 14 ? "#c4954a" : "#748398";
            const timing = diff < 0 ? "Needs attention" : diff === 0 ? "Due today" : diff === 1 ? "Due tomorrow" : `Due in ${diff} days`;
            return (
              <div style={{ background: "white", borderRadius: 14, borderTop: "1px solid rgba(0,0,0,0.08)", borderRight: "1px solid rgba(0,0,0,0.08)", borderBottom: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${accent}`, padding: "14px 16px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontSize: 10, color: "#8a96a3", marginBottom: 2 }}>{sel.subject}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428", lineHeight: 1.3 }}>{sel.title}</div>
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: accent }}>{timing}</div>
                  </div>
                  <button type="button" onClick={() => setGanttSelectedId(null)} style={{ fontSize: 14, color: "#8a96a3", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                </div>
                {/* Dates */}
                <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                  {sel.handoutDate && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Handout</div>
                      <div style={{ fontSize: 12, color: "#1d2428" }}>{listFormatShort(new Date(sel.handoutDate))}</div>
                    </div>
                  )}
                  {sel.draftDate && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Draft due</div>
                      <div style={{ fontSize: 12, color: "#1d2428" }}>{listFormatShort(new Date(sel.draftDate))}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Final due</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428" }}>{listFormatShort(new Date(sel.dueDate))}</div>
                  </div>
                </div>
                {/* Status selector */}
                {!sel.completed && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 6 }}>Status</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(["Not started", "In progress", "Submitted"] as const).map(s => {
                        const isActive = (sel.status || "Not started") === s;
                        return (
                          <button key={s} type="button" onClick={() => void saveListStatus(sel.id, s)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: isActive ? "none" : "1.5px solid rgba(0,0,0,0.08)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", ...(isActive ? listStatusPillStyle(s) : { background: "transparent", color: "#8a96a3" }) }}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Draft toggle */}
                {sel.draftDate && !sel.completed && (
                  <div style={{ marginBottom: 12 }}>
                    <button type="button" onClick={() => void toggleListDraft(sel.id)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", ...(sel.draftCompleted ? { background: "#d4edcc", color: "#2d5a24" } : { background: "rgba(0,0,0,0.05)", color: "#748398" }) }}>
                      {sel.draftCompleted ? "✓ Draft submitted" : "Mark draft submitted"}
                    </button>
                  </div>
                )}
                {/* Checkpoints */}
                <div style={{ marginBottom: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3" }}>
                      {sel.type === "exam" ? "Revision steps" : "Checkpoints"}
                    </div>
                    {checkpoints.length > 0 && (
                      <span style={{ fontSize: 10, color: "#8a96a3" }}>
                        {checkpoints.filter(c => c.completed).length} of {checkpoints.length} done
                      </span>
                    )}
                  </div>
                  {checkpoints.length > 0 && (
                    <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      {checkpoints.map(cp => (
                        <li key={cp.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => void toggleCheckpoint(cp.id, cp.completed)}
                            style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `2px solid ${cp.completed ? "#82977e" : "rgba(0,0,0,0.14)"}`, background: cp.completed ? "#82977e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, transition: "all 0.15s" }}
                          >
                            {cp.completed && (
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <span style={{ flex: 1, fontSize: 12, color: cp.completed ? "#8a96a3" : "#1d2428", textDecoration: cp.completed ? "line-through" : "none", lineHeight: 1.4 }}>
                            {cp.title}
                            {cp.dueDate && (
                              <span style={{ fontSize: 10, color: "#8a96a3", marginLeft: 6 }}>
                                by {listFormatShort(new Date(cp.dueDate))}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteCheckpoint(cp.id)}
                            style={{ fontSize: 11, color: "#b0bec5", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!sel.completed && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={checkpointText}
                          onChange={e => setCheckpointText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void addCheckpoint(); } }}
                          placeholder={sel.type === "exam" ? "Add a revision step…" : "Add a step…"}
                          autoComplete="off"
                          style={{ flex: 1, border: "1.5px solid #e4eaef", borderRadius: 9, padding: "6px 10px", fontSize: 12, color: "#1d2428", background: "white", outline: "none", fontFamily: "inherit" }}
                        />
                        <button
                          type="button"
                          onClick={() => void addCheckpoint()}
                          disabled={!checkpointText.trim() || checkpointSaving}
                          style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: (!checkpointText.trim() || checkpointSaving) ? 0.45 : 1, transition: "opacity 0.15s" }}
                        >
                          {checkpointSaving ? "…" : "Add"}
                        </button>
                      </div>
                      <input
                        type="date"
                        value={checkpointDate}
                        onChange={e => setCheckpointDate(e.target.value)}
                        aria-label="Optional due date for this step"
                        title="Optional due date for this step"
                        style={{ border: "1.5px solid #e4eaef", borderRadius: 9, padding: "5px 10px", fontSize: 11, color: checkpointDate ? "#1d2428" : "#8a96a3", background: "white", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 8, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
                  {!sel.completed ? (
                    <button type="button" onClick={() => void handleListCompletion(sel.id, false)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#d4edcc", color: "#2d5a24" }}>
                      Mark complete
                    </button>
                  ) : (
                    <button type="button" onClick={() => void handleListCompletion(sel.id, true)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#f0f2f5", color: "#456071" }}>
                      Undo complete
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {ganttView === "timeline" && (
            <>
              <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 3 }}>Your deadlines</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 14 }}>Across the next 6 weeks. Tap a milestone dot to see details.</div>
                <GanttWidget
                  items={upcomingItems}
                  selectedId={ganttSelectedId}
                  onSelectId={(id) => setGanttSelectedId(id)}
                  showCompleted={showCompleted}
                  onShowCompleted={setShowCompleted}
                />
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
                const isSelected = ganttSelectedId === item.id;
                const subjectColor = getListSubjectColor(item.subject || detectSubject(item.title));
                return (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 14, borderTop: `1px solid ${isSelected ? "rgba(69,96,113,0.2)" : "rgba(0,0,0,0.06)"}`, borderRight: `1px solid ${isSelected ? "rgba(69,96,113,0.2)" : "rgba(0,0,0,0.06)"}`, borderBottom: `1px solid ${isSelected ? "rgba(69,96,113,0.2)" : "rgba(0,0,0,0.06)"}`, borderLeft: `3px solid ${subjectColor}`, marginBottom: 8, overflow: "hidden" }}>
                    <div onClick={() => setGanttSelectedId(ganttSelectedId === item.id ? null : item.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer" }}>
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
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: daysUntil < 0 ? "#fef0f0" : daysUntil <= 4 ? "#fef0f0" : daysUntil <= 14 ? "#fffbf4" : "#f4f7f9", color: daysUntil < 0 ? "#c97777" : daysUntil <= 4 ? "#c97777" : daysUntil <= 14 ? "#c4954a" : "#748398" }}>
                          {daysUntil < 0 ? "Needs attention" : daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Tomorrow" : daysUntil <= 13 ? `In ${daysUntil} days` : `In ${Math.round(daysUntil / 7)} weeks`}
                        </span>
                        <span style={{ fontSize: 11, color: "#8a96a3" }}>{isSelected ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {upcomingItems.filter(item => !item.completed).length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 20px 12px", color: "#8a96a3" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nothing coming up yet</div>
                  <div style={{ fontSize: 12, color: "#b0bec5", lineHeight: 1.6 }}>Add your first deadline below — one at a time is plenty.</div>
                </div>
              )}

              {(() => {
                const doneItems = upcomingItems.filter(i => i.completed).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
                if (doneItems.length === 0) return null;
                return (
                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setShowCompleted(v => !v)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: showCompleted ? 8 : 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", fontFamily: "inherit" }}
                    >
                      <span>✓ {doneItems.length} completed</span>
                      <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 600 }}>{showCompleted ? "▼ Hide" : "▸ Show"}</span>
                    </button>
                    {showCompleted && doneItems.map(item => (
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
                            setUpcomingItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: false } : i));
                            await updateDoc(doc(db, "users", u.uid, "upcoming", item.id), { completed: false, completedAt: null });
                          }}
                          style={{ background: "none", border: "none", fontSize: 11, color: "#456071", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                        >
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "2px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 12 }}>
                  Add a deadline
                </div>
                <div style={{ background: "white", borderRadius: 16, padding: 20, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <PlannerForm />
                </div>
              </div>
            </div>
          )}

        </div>
      </Sheet>

      <FeedbackButton role={role} />

      {/* Sheet: Mood trends */}
      <Sheet open={activeSheet === "mood"} title="Mood · Trends" onClose={() => setActiveSheet(null)}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Card 0 — Line graph */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Mood over time · last 7 days</div>
            <MoodLineGraph points={moodTrendData.chartPoints} />
          </div>

          {/* Card 1 — Last 7 days */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Last 7 days</div>
            {moodLogs.length === 0 ? (
              <div style={{ fontSize: 12, color: "#8a96a3", textAlign: "center", padding: "16px 0" }}>
                No check-ins yet — log how you&apos;re feeling below.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {moodTrendData.last7.map((d) => {
                  const meta = d.mood ? moodTrendData.MOOD_META[d.mood] : null;
                  return (
                    <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: meta ? meta.bg : "#edf0f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                        {meta ? meta.emoji : <span style={{ fontSize: 10, color: "#c0c8d0" }}>–</span>}
                      </div>
                      <span style={{ fontSize: 9, color: "#8a96a3", textAlign: "center" }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2 — Last 30 days distribution */}
          <div style={{ background: "white", borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Last 30 days</div>
            {moodLogs.length === 0 ? (
              <div style={{ fontSize: 12, color: "#8a96a3", textAlign: "center", padding: "8px 0" }}>
                Check in a few times and your patterns will appear here.
              </div>
            ) : (
              moodTrendData.dist30.map((row) => (
                <div key={row.mood} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 60, fontSize: 11, fontWeight: 600, color: "#1d2428", flexShrink: 0 }}>{row.emoji} {row.label}</div>
                  <div style={{ flex: 1, height: 7, background: "#edf0f3", borderRadius: 20, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${row.pct}%`, borderRadius: 20, background: row.bg }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#8a96a3", width: 20, textAlign: "right", flexShrink: 0 }}>{row.count}</div>
                </div>
              ))
            )}
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
        Nothing here yet — add a deadline when you&apos;re ready.
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
