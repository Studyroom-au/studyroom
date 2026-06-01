//src/components/widget/GanttWidget.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UpcomingItem = {
  id: string;
  subject: string;
  title: string;
  dueDate: string;
  handoutDate?: string | null;
  draftDate?: string | null;
  draftCompleted?: boolean;
  completed: boolean;
  status?: string | null;
};

const STATUS_NEXT: Record<string, string> = {
  "Not started": "In progress",
  "In progress": "Submitted",
  "Submitted": "Not started",
};

function statusPillStyle(status: string): React.CSSProperties {
  if (status === "In progress") return { background: "#fef3e2", color: "#a06020" };
  if (status === "Submitted")   return { background: "#d4edcc", color: "#2d5a24" };
  return { background: "rgba(0,0,0,0.06)", color: "#748398" };
}

// ── Colour palette (emoji badge backgrounds) ────────────────
const SR_PALETTE = [
  { color: "#456071", light: "#edf2f6", mid: "#b8cad6" },
  { color: "#82977e", light: "#edf5eb", mid: "#bdd4b9" },
  { color: "#748398", light: "#edf0f3", mid: "#c4cdd6" },
  { color: "#5b7fa6", light: "#e8f0f8", mid: "#a8c4e0" },
  { color: "#7a6e9e", light: "#f0ecf8", mid: "#c8c0e0" },
  { color: "#6b9e78", light: "#e8f5eb", mid: "#b8d9bf" },
  { color: "#9e7a6b", light: "#f5ede8", mid: "#d9b8b0" },
  { color: "#9b8ea8", light: "#f0ecf5", mid: "#d4cce0" },
  { color: "#7a9e8e", light: "#e8f5f0", mid: "#b8d9ce" },
  { color: "#a89b6e", light: "#f5f0e8", mid: "#d9ceaf" },
];

function getSubjectStyle(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % SR_PALETTE.length;
  return SR_PALETTE[idx];
}

// ── Brand-aligned bar & pin colours ─────────────────────────
const SUBJECT_COLOURS: Record<string, { bar: string; pin: string }> = {
  english:   { bar: "#b8cad6", pin: "#456071" },
  maths:     { bar: "#bde4af", pin: "#82977e" },
  math:      { bar: "#bde4af", pin: "#82977e" },
  science:   { bar: "#b8cad6", pin: "#748398" },
  history:   { bar: "#e8d5c4", pin: "#a0724a" },
  geography: { bar: "#c8d8c8", pin: "#5a7a5a" },
  art:       { bar: "#f2d4e0", pin: "#c0607a" },
  music:     { bar: "#d4cce8", pin: "#7060a8" },
  default:   { bar: "#dde4ea", pin: "#456071" },
};

function getSubjectColour(subject: string): { bar: string; pin: string } {
  const s = subject.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECT_COLOURS)) {
    if (key !== "default" && s.includes(key)) return val;
  }
  return SUBJECT_COLOURS.default;
}

function getSubjectEmoji(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("math") || s.includes("specialist")) return "📐";
  if (s.includes("english") || s.includes("literature")) return "📖";
  if (s.includes("chem")) return "🧪";
  if (s.includes("physics")) return "⚡";
  if (s.includes("bio")) return "🧬";
  if (
    s.includes("japanese") || s.includes("french") || s.includes("german") ||
    s.includes("spanish") || s.includes("chinese") || s.includes("korean")
  ) return "🌏";
  if (s.includes("history") || s.includes("ancient")) return "🏛️";
  if (s.includes("geography")) return "🗺️";
  if (s.includes("psychology") || s.includes("psych")) return "🧠";
  if (s.includes("music")) return "🎵";
  if (s.includes("art") || s.includes("visual")) return "🎨";
  if (s.includes("drama") || s.includes("theatre")) return "🎭";
  if (s.includes("sport") || s.includes("physical") || s.includes("pe ")) return "⚽";
  if (s.includes("legal") || s.includes("law")) return "⚖️";
  if (s.includes("business") || s.includes("economics") || s.includes("accounting")) return "📊";
  if (s.includes("ict") || s.includes("digital") || s.includes("computer") || s.includes("software")) return "💻";
  if (s.includes("design") || s.includes("technology") || s.includes("engineering")) return "🔧";
  if (s.includes("science")) return "🔬";
  if (s.includes("study") || s.includes("skills")) return "📚";
  if (s.includes("social")) return "🌍";
  if (s.includes("health")) return "❤️";
  return "📝";
}

// ── Date helpers ────────────────────────────────────────────
function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function toMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatShort(d: Date) {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function getDiffFromToday(dateStr: string) {
  const today = toMidnight(new Date());
  const d = toMidnight(new Date(dateStr));
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
function clamp(v: number) { return Math.max(-2, Math.min(102, v)); }

const TOTAL_DAYS = 42;
const ROW_H = 74;

export default function GanttWidget({
  items,
  selectedId: externalSelectedId,
  onSelectId,
  showCompleted: externalShowCompleted,
  onShowCompleted,
}: {
  items: UpcomingItem[];
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  showCompleted?: boolean;
  onShowCompleted?: (v: boolean) => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; text: string; pinned?: boolean; key?: string } | null>(null);
  const [completedAnims, setCompletedAnims] = useState<Set<string>>(new Set());
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [internalShowCompleted, setInternalShowCompleted] = useState(false);

  const isControlled = onSelectId !== undefined;
  const selectedId = isControlled ? (externalSelectedId ?? null) : internalSelectedId;
  function setSelectedId(id: string | null) {
    if (isControlled) onSelectId(id);
    else setInternalSelectedId(id);
  }
  const showCompleted = onShowCompleted !== undefined ? (externalShowCompleted ?? false) : internalShowCompleted;
  function toggleShowCompleted() {
    if (onShowCompleted !== undefined) onShowCompleted(!(externalShowCompleted ?? false));
    else setInternalShowCompleted(v => !v);
  }

  const today = useMemo(() => toMidnight(new Date()), []);

  const windowStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [today, weekOffset]);

  const windowEnd = useMemo(() => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + TOTAL_DAYS);
    return d;
  }, [windowStart]);

  const dayCols = useMemo(() => {
    const cols: Date[] = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = new Date(windowStart);
      d.setDate(d.getDate() + i);
      cols.push(d);
    }
    return cols;
  }, [windowStart]);

  const weekHeaders = useMemo(() => {
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      weeks.push({ label: formatShort(dayCols[w * 7]) });
    }
    return weeks;
  }, [dayCols]);

  const todayIdx = useMemo(() =>
    daysBetween(windowStart, today), [windowStart, today]);
  const todayInView = todayIdx >= 0 && todayIdx < TOTAL_DAYS;

  function dayToPercent(dateStr: string) {
    const diff = daysBetween(windowStart.toISOString().slice(0, 10), dateStr);
    return (diff / TOTAL_DAYS) * 100;
  }

  // ── Toggle handlers ──────────────────────────────────────────
  async function handleCompletionWithAnim(id: string, currentlyCompleted: boolean) {
    const u = auth.currentUser;
    if (!u) return;
    if (!currentlyCompleted) {
      setCompletedAnims(prev => new Set([...prev, id]));
      setTimeout(async () => {
        await updateDoc(doc(db, "users", u.uid, "upcoming", id), { completed: true });
        setCompletedAnims(prev => { const n = new Set(prev); n.delete(id); return n; });
      }, 700);
    } else {
      await updateDoc(doc(db, "users", u.uid, "upcoming", id), { completed: false });
    }
  }

  async function toggleDraft(id: string) {
    const u = auth.currentUser;
    if (!u) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { draftCompleted: !item.draftCompleted });
  }

  // Clear any pinned milestone tooltip when the user navigates weeks or opens the detail panel
  useEffect(() => { setTooltipInfo(null); }, [weekOffset, selectedId]);

  async function cycleStatus(id: string, current: string, e: React.MouseEvent) {
    e.stopPropagation();
    const u = auth.currentUser;
    if (!u) return;
    const next = STATUS_NEXT[current] ?? "In progress";
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { status: next });
  }

  async function saveStatus(id: string, newStatus: string) {
    const u = auth.currentUser;
    if (!u) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { status: newStatus });
  }

  return (
    <div style={{ fontFamily: "inherit", padding: "0 0 8px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        .sr-gantt * { box-sizing: border-box; }
        .sr-nav-btn {
          background: #f0f2f5; color: #456071;
          border: 1.5px solid rgba(69,96,113,0.15);
          border-radius: 10px; padding: 6px 14px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: all 0.15s;
        }
        .sr-nav-btn:hover { background: #e4eaef; }
        .sr-nav-btn:active { transform: scale(0.96); }
        .sr-label-row {
          height: ${ROW_H}px; display: flex; align-items: center;
          padding: 0 10px; gap: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          cursor: pointer; transition: background 0.15s;
        }
        .sr-label-row:hover { background: rgba(69,96,113,0.03); }
        .sr-label-emoji {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0; transition: transform 0.2s;
          align-self: flex-start; margin-top: 3px;
        }
        .sr-label-row:hover .sr-label-emoji { transform: scale(1.1) rotate(-4deg); }
        .sr-title-clamp {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; line-height: 1.3;
        }
        .sr-track-row {
          height: ${ROW_H}px; position: relative;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          transition: background 0.15s;
        }
        .sr-track-row:hover { background: rgba(69,96,113,0.02); }
        .sr-week-cell {
          flex: 1; text-align: center; padding: 10px 0 8px;
          font-size: 11px; font-weight: 600; color: #8a96a3;
          border-right: 1px solid rgba(0,0,0,0.04);
          font-family: 'Space Mono', monospace;
        }
        .sr-week-cell:last-child { border-right: none; }
        .sr-bar-wrap {
          position: absolute; top: 50%; transform: translateY(-50%);
          height: 26px; display: flex; align-items: center; z-index: 3;
          transition: filter 0.2s;
        }
        .sr-bar-wrap:hover { filter: brightness(1.08); z-index: 5; }
        .sr-completing { animation: srComplete 0.7s ease forwards; }
        @keyframes srComplete {
          0%   { transform: translateY(-50%) scale(1); opacity: 1; }
          30%  { transform: translateY(-50%) scale(1.04); }
          100% { transform: translateY(-50%) scale(0.9); opacity: 0.3; }
        }
        .sr-bar-fill {
          height: 100%; width: 100%; border-radius: 10px;
          display: flex; align-items: center; padding: 0 10px;
          font-size: 10px; font-weight: 700;
          white-space: nowrap; overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          transition: opacity 0.4s;
        }
        .sr-milestone-flag {
          position: absolute; top: 50%;
          transform: translate(-50%, -100%);
          z-index: 6; cursor: pointer; transition: transform 0.15s;
          padding-bottom: 1px; line-height: 0;
        }
        .sr-milestone-flag:hover { transform: translate(-50%, -100%) scale(1.18); }
        .sr-milestone-flag.sr-flag-active { transform: translate(-50%, -100%) scale(1.18); }
        .sr-today-line {
          position: absolute; top: 0; bottom: 0; width: 2px;
          background: #c47fa0; z-index: 10; pointer-events: none; border-radius: 1px;
        }
        .sr-done-row { opacity: 0.35; }
        .sr-done-row:hover { opacity: 0.5; }
        .sr-section-label {
          grid-column: 1/-1; padding: 5px 14px 4px;
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: #82977e; background: rgba(130,151,126,0.06);
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        .sr-tooltip {
          position: fixed; background: #1d2428; color: white;
          padding: 8px 12px; border-radius: 10px;
          font-size: 11px; line-height: 1.6; z-index: 100;
          pointer-events: none; max-width: 180px; white-space: pre-line;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
      `}</style>

      {/* Nav + range */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button type="button" className="sr-nav-btn" onClick={() => setWeekOffset(o => o - 2)}>← Back</button>
        <button type="button" className="sr-nav-btn" onClick={() => setWeekOffset(0)}>Today</button>
        <button type="button" className="sr-nav-btn" onClick={() => setWeekOffset(o => o + 2)}>Forward →</button>
        <span style={{
          marginLeft: "auto", fontFamily: "'Space Mono', monospace",
          fontSize: 10, color: "#8a96a3",
        }}>
          {formatShort(windowStart)} – {formatShort(windowEnd)}
        </span>
      </div>

      {/* Grid */}
      <div style={{
        overflowX: "auto", borderRadius: 14,
        border: "1.5px solid rgba(69,96,113,0.12)", background: "#fff",
      }}>
        <div style={{ display: "grid", minWidth: 680, gridTemplateColumns: "136px 1fr" }}>

          {/* Column headers */}
          <div style={{
            height: 38, display: "flex", alignItems: "center", padding: "0 14px",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#8a96a3",
            borderBottom: "1.5px solid rgba(69,96,113,0.1)",
            borderRight: "1.5px solid rgba(69,96,113,0.1)",
          }}>
            Assessment
          </div>
          <div style={{ display: "flex", borderBottom: "1.5px solid rgba(69,96,113,0.1)", position: "relative" }}>
            {weekHeaders.map((w, i) => (
              <div key={i} className="sr-week-cell">{w.label}</div>
            ))}
            {todayInView && (
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(todayIdx / TOTAL_DAYS) * 100}%`, width: 2, background: "#c47fa0", zIndex: 5, borderRadius: 1, pointerEvents: "none" }}>
                <span style={{ position: "absolute", top: 3, left: 4, fontSize: 8, fontWeight: 700, color: "#c47fa0", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em" }}>Today</span>
              </div>
            )}
          </div>

          {/* Active rows */}
          {items
            .filter(item => !item.completed)
            .sort((a, b) => getDiffFromToday(a.dueDate) - getDiffFromToday(b.dueDate))
            .map(item => {
              const subjectStyle = getSubjectStyle(item.subject);
              const subjectColour = getSubjectColour(item.subject);
              const emoji = getSubjectEmoji(item.subject);
              const isCompleting = completedAnims.has(item.id);

              const startDate = (item.handoutDate || item.draftDate || item.dueDate) as string;
              const barLeft = clamp(dayToPercent(startDate));
              const barRight = clamp(dayToPercent(item.dueDate));
              const barWidth = Math.max(2, barRight - barLeft);

              const milestones = [
                item.handoutDate ? { date: item.handoutDate, label: "Handout", emoji: "📋" } : null,
                item.draftDate ? { date: item.draftDate, label: "Draft due", emoji: "✏️" } : null,
                { date: item.dueDate, label: "Final due", emoji: "🏁" },
              ].filter((m): m is { date: string; label: string; emoji: string } => m !== null);

              return [
                <div
                  key={`l-${item.id}`}
                  className="sr-label-row"
                  onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  style={{ borderRight: "1.5px solid rgba(69,96,113,0.1)", alignItems: "flex-start", paddingTop: 10, paddingBottom: 10 }}
                >
                  <div className="sr-label-emoji" style={{ background: subjectStyle.light }}>{emoji}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sr-title-clamp" style={{ fontSize: 11, fontWeight: 600, color: "#1d2428" }}>
                      {item.title}
                    </div>
                    <button
                      type="button"
                      onClick={e => void cycleStatus(item.id, item.status ?? "Not started", e)}
                      style={{
                        marginTop: 4, fontSize: 9, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 6, border: "none",
                        cursor: "pointer", fontFamily: "inherit",
                        ...statusPillStyle(item.status ?? "Not started"),
                      }}
                    >
                      {item.status ?? "Not started"}
                    </button>
                  </div>
                </div>,

                <div key={`t-${item.id}`} className="sr-track-row">
                  {todayInView && (
                    <div className="sr-today-line" style={{ left: `${(todayIdx / TOTAL_DAYS) * 100}%` }} />
                  )}

                  <div
                    className={`sr-bar-wrap${isCompleting ? " sr-completing" : ""}`}
                    style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                  >
                    <div className="sr-bar-fill" style={{ background: subjectColour.bar, color: subjectColour.pin }}>
                      {barWidth > 8 && (item.title.length <= 14 ? item.title : item.subject.split(" ")[0])}
                    </div>
                  </div>

                  {milestones.map((m, mi) => {
                    const pos = clamp(dayToPercent(m.date));
                    if (pos < -1 || pos > 101) return null;
                    const mDiff = getDiffFromToday(m.date);
                    const mDays = mDiff < 0
                      ? `${Math.abs(mDiff)} day${Math.abs(mDiff) === 1 ? "" : "s"} overdue`
                      : mDiff === 0 ? "Today"
                      : mDiff === 1 ? "Tomorrow"
                      : `In ${mDiff} days`;
                    const tipText = `${m.label}\n${formatShort(new Date(m.date))}\n${mDays}`;
                    const pinKey = `${item.id}-${mi}`;
                    const isPinned = tooltipInfo?.pinned && tooltipInfo.key === pinKey;
                    const pinColor = subjectColour.pin;
                    return (
                      <div
                        key={mi}
                        className={`sr-milestone-flag${isPinned ? " sr-flag-active" : ""}`}
                        style={{ left: `${pos}%` }}
                        onMouseEnter={e => {
                          if (!tooltipInfo?.pinned) {
                            setTooltipInfo({ x: e.clientX, y: e.clientY - 60, text: tipText });
                          }
                        }}
                        onMouseLeave={() => {
                          if (!tooltipInfo?.pinned) setTooltipInfo(null);
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          if (isPinned) {
                            setTooltipInfo(null);
                          } else {
                            setTooltipInfo({ x: e.clientX, y: e.clientY - 70, text: tipText, pinned: true, key: pinKey });
                          }
                        }}
                      >
                        <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
                          <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={pinColor}/>
                        </svg>
                      </div>
                    );
                  })}
                </div>,
              ];
            })}

          {/* Completed section — collapsed by default */}
          {(() => {
            const doneItems = items.filter(item => item.completed);
            if (doneItems.length === 0) return null;
            return (
              <>
                <div
                  className="sr-section-label"
                  onClick={toggleShowCompleted}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span>✓ {doneItems.length} completed</span>
                  <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 600, letterSpacing: "0.04em" }}>
                    {showCompleted ? "▼ Hide" : "▸ Show"}
                  </span>
                </div>
                {showCompleted && doneItems.map(item => {
                  const subjectStyle = getSubjectStyle(item.subject);
                  const subjectColour = getSubjectColour(item.subject);
                  const emoji = getSubjectEmoji(item.subject);
                  const startDate = (item.handoutDate || item.draftDate || item.dueDate) as string;
                  const barLeft = clamp(dayToPercent(startDate));
                  const barRight = clamp(dayToPercent(item.dueDate));
                  const barWidth = Math.max(2, barRight - barLeft);
                  return [
                    <div
                      key={`l-${item.id}`}
                      className="sr-label-row sr-done-row"
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                      style={{ borderRight: "1.5px solid rgba(69,96,113,0.1)", alignItems: "flex-start", paddingTop: 10, paddingBottom: 10 }}
                    >
                      <div className="sr-label-emoji" style={{ background: subjectStyle.light }}>{emoji}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="sr-title-clamp" style={{ fontSize: 11, fontWeight: 600, color: "#1d2428", textDecoration: "line-through" }}>
                          {item.title}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 9, color: "#8a96a3" }}>{item.subject}</div>
                      </div>
                    </div>,
                    <div key={`t-${item.id}`} className="sr-track-row sr-done-row">
                      {todayInView && (
                        <div className="sr-today-line" style={{ left: `${(todayIdx / TOTAL_DAYS) * 100}%` }} />
                      )}
                      <div className="sr-bar-wrap" style={{ left: `${barLeft}%`, width: `${barWidth}%` }}>
                        <div className="sr-bar-fill" style={{ background: subjectColour.bar, color: subjectColour.pin }}>
                          {barWidth > 8 && item.title}
                        </div>
                      </div>
                    </div>,
                  ];
                })}
              </>
            );
          })()}

          {/* Empty state */}
          {items.length === 0 && (
            <div style={{
              gridColumn: "1/-1", padding: "40px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8a96a3", marginBottom: 4 }}>
                Nothing planned yet
              </div>
              <div style={{ fontSize: 12, color: "#b0bec5", lineHeight: 1.6 }}>
                Add your first deadline below — one step at a time.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Detail panel — only when not controlled externally */}
      {!isControlled && (() => {
        const sel = selectedId ? items.find(i => i.id === selectedId) : null;
        if (!sel) return null;
        const diff = getDiffFromToday(sel.dueDate);
        const accent = diff < 0 || diff <= 4 ? "#c97777" : diff <= 14 ? "#c4954a" : "#748398";
        const timing = diff < 0 ? "Needs attention" : diff === 0 ? "Due today" : diff === 1 ? "Due tomorrow" : `Due in ${diff} days`;
        return (
          <div style={{
            marginTop: 10, background: "white", borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${accent}`,
            padding: "14px 16px",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                <div style={{ fontSize: 10, color: "#8a96a3", marginBottom: 2 }}>{sel.subject}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428", lineHeight: 1.3 }}>{sel.title}</div>
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: accent }}>{timing}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                style={{ fontSize: 14, color: "#8a96a3", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, fontFamily: "inherit", flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Dates row */}
            <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
              {sel.handoutDate && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Handout</div>
                  <div style={{ fontSize: 12, color: "#1d2428" }}>{formatShort(new Date(sel.handoutDate))}</div>
                </div>
              )}
              {sel.draftDate && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Draft due</div>
                  <div style={{ fontSize: 12, color: "#1d2428" }}>{formatShort(new Date(sel.draftDate))}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 2 }}>Final due</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428" }}>{formatShort(new Date(sel.dueDate))}</div>
              </div>
            </div>

            {/* Status selector */}
            {!sel.completed && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8a96a3", marginBottom: 6 }}>Status</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["Not started", "In progress", "Submitted"] as const).map(s => {
                    const isActive = (sel.status ?? "Not started") === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void saveStatus(sel.id, s)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
                          border: isActive ? "none" : "1.5px solid rgba(0,0,0,0.08)",
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          ...(isActive ? statusPillStyle(s) : { background: "transparent", color: "#8a96a3" }),
                        }}
                      >
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
                <button
                  type="button"
                  onClick={() => void toggleDraft(sel.id)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "none",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    ...(sel.draftCompleted
                      ? { background: "#d4edcc", color: "#2d5a24" }
                      : { background: "rgba(0,0,0,0.05)", color: "#748398" }),
                  }}
                >
                  {sel.draftCompleted ? "✓ Draft submitted" : "Mark draft submitted"}
                </button>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
              {!sel.completed ? (
                <button
                  type="button"
                  onClick={() => { void handleCompletionWithAnim(sel.id, false); setSelectedId(null); }}
                  style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#d4edcc", color: "#2d5a24" }}
                >
                  Mark complete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleCompletionWithAnim(sel.id, true); setSelectedId(null); }}
                  style={{ fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: "#f0f2f5", color: "#456071" }}
                >
                  Undo complete
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tooltip */}
      {tooltipInfo && (
        <div className="sr-tooltip" style={{ top: tooltipInfo.y, left: tooltipInfo.x }}>
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
}
