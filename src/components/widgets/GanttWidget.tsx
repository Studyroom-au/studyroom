"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type UpcomingItem = {
  id: string;
  subject: string;
  title: string;
  dueDate: string;
  handoutDate?: string | null;
  draftDate?: string | null;
  draftCompleted?: boolean;
  completed: boolean;
};

// ── Colour palette ──────────────────────────────────────────
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
const ROW_H = 56;

export default function GanttWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const [completedAnims, setCompletedAnims] = useState<Set<string>>(new Set());

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try { await u.getIdToken(true); } catch { /* ignore */ }
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setItems([]);
      }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;
    const q = query(
      collection(db, "users", u.uid, "upcoming"),
      orderBy("dueDate", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: UpcomingItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          subject: String(data.subject || ""),
          title: String(data.title || ""),
          dueDate: String(data.dueDate || ""),
          handoutDate: data.handoutDate ? String(data.handoutDate) : null,
          draftDate: data.draftDate ? String(data.draftDate) : null,
          draftCompleted: Boolean(data.draftCompleted),
          completed: Boolean(data.completed),
        });
      });
      setItems(list);
    });
    return () => unsub();
  }, [authReady]);

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

  async function toggleDraft(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const u = auth.currentUser;
    if (!u) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), { draftCompleted: !item.draftCompleted });
  }

  if (!authReady) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 28, background: "rgba(0,0,0,0.06)", borderRadius: 6 }} />
        ))}
      </div>
    );
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
          padding: 0 12px; gap: 8px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          cursor: pointer; transition: background 0.15s;
        }
        .sr-label-row:hover { background: rgba(69,96,113,0.03); }
        .sr-label-emoji {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0; transition: transform 0.2s;
        }
        .sr-label-row:hover .sr-label-emoji { transform: scale(1.1) rotate(-4deg); }
        .sr-track-row {
          height: ${ROW_H}px; position: relative;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          transition: background 0.15s;
        }
        .sr-track-row:hover { background: rgba(69,96,113,0.02); }
        .sr-week-cell {
          flex: 1; text-align: center; padding: 9px 0 7px;
          font-size: 10px; font-weight: 600; color: #8a96a3;
          border-right: 1px solid rgba(0,0,0,0.04);
          font-family: 'Space Mono', monospace;
        }
        .sr-week-cell:last-child { border-right: none; }
        .sr-bar-wrap {
          position: absolute; top: 50%; transform: translateY(-50%);
          height: 26px; display: flex; align-items: center; z-index: 3;
          transition: filter 0.2s;
        }
        .sr-bar-wrap:hover { filter: brightness(1.05); z-index: 5; }
        .sr-completing { animation: srComplete 0.7s ease forwards; }
        @keyframes srComplete {
          0%   { transform: translateY(-50%) scale(1); opacity: 1; }
          30%  { transform: translateY(-50%) scale(1.04); }
          100% { transform: translateY(-50%) scale(0.9); opacity: 0.3; }
        }
        .sr-seg-draft {
          height: 100%; border-radius: 8px 0 0 8px;
          display: flex; align-items: center; padding: 0 8px;
          font-size: 10px; font-weight: 600; color: white;
          white-space: nowrap; overflow: hidden;
          box-shadow: 0 2px 6px rgba(69,96,113,0.18);
          transition: opacity 0.4s, filter 0.4s;
        }
        .sr-seg-draft.done { opacity: 0.4; filter: saturate(0.5); }
        .sr-seg-final {
          height: 100%; border-radius: 0 8px 8px 0;
          display: flex; align-items: center; padding: 0 6px;
          border: 1.5px dashed; border-left: none;
          font-size: 9px; font-weight: 600;
          white-space: nowrap; overflow: hidden;
          color: rgba(0,0,0,0.35); position: relative;
          transition: all 0.4s;
        }
        .sr-seg-final::after {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(
            -45deg, transparent, transparent 4px,
            rgba(255,255,255,0.28) 4px, rgba(255,255,255,0.28) 8px
          );
          pointer-events: none; transition: opacity 0.4s;
        }
        .sr-seg-final.unlocked { border: none; color: white; box-shadow: 0 2px 6px rgba(69,96,113,0.18); }
        .sr-seg-final.unlocked::after { opacity: 0; }
        .sr-seg-final.solo { border-radius: 8px; border: none; color: white; box-shadow: 0 2px 6px rgba(69,96,113,0.18); }
        .sr-seg-final.solo::after { opacity: 0; }
        .sr-milestone {
          position: absolute; top: 50%;
          transform: translate(-50%, -50%);
          width: 11px; height: 11px; border-radius: 50%;
          border: 2.5px solid white;
          box-shadow: 0 0 0 1px rgba(69,96,113,0.15), 0 1px 3px rgba(0,0,0,0.1);
          z-index: 6; cursor: pointer; transition: transform 0.15s;
        }
        .sr-milestone:hover { transform: translate(-50%, -50%) scale(1.3); }
        .sr-due-pill {
          position: absolute; top: 50%; transform: translateY(-50%);
          font-family: 'Space Mono', monospace;
          font-size: 9px; font-weight: 700;
          padding: 2px 7px; border-radius: 20px;
          white-space: nowrap; z-index: 7; pointer-events: none;
        }
        .sr-gridline {
          position: absolute; top: 0; bottom: 0; width: 1px;
          background: rgba(69,96,113,0.06); pointer-events: none; z-index: 0;
        }
        .sr-today-line {
          position: absolute; top: 0; bottom: 0; width: 2px;
          background: #e39bb6; z-index: 10; pointer-events: none; border-radius: 1px;
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
          padding: 7px 11px; border-radius: 9px;
          font-size: 11px; line-height: 1.5; z-index: 100;
          pointer-events: none; max-width: 200px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
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

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "center" }}>
        {[
          { bg: "#456071", border: "none", label: "Draft period" },
          { bg: "#edf2f6", border: "1.5px dashed #b8cad6", label: "Final (locked)" },
          { bg: "#456071", border: "none", label: "Final (unlocked)" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#8a96a3", fontWeight: 500 }}>
            <div style={{
              width: 14, height: 9, borderRadius: 3, flexShrink: 0,
              background: l.bg, border: l.border,
            }} />
            {l.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#8a96a3", fontWeight: 500 }}>
          <div style={{ width: 2, height: 11, borderRadius: 2, background: "#e39bb6", flexShrink: 0 }} />
          Today
        </div>
      </div>

      {/* Grid */}
      <div style={{
        overflowX: "auto", borderRadius: 14,
        border: "1.5px solid rgba(69,96,113,0.12)", background: "#fff",
      }}>
        <div style={{ display: "grid", minWidth: 700, gridTemplateColumns: "160px 1fr" }}>

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
          <div style={{ display: "flex", borderBottom: "1.5px solid rgba(69,96,113,0.1)" }}>
            {weekHeaders.map((w, i) => (
              <div key={i} className="sr-week-cell">{w.label}</div>
            ))}
          </div>

          {/* Active rows */}
          {items
            .filter(item => !item.completed)
            .sort((a, b) => getDiffFromToday(a.dueDate) - getDiffFromToday(b.dueDate))
            .map(item => {
              const subjectStyle = getSubjectStyle(item.subject);
              const emoji = getSubjectEmoji(item.subject);
              const diff = getDiffFromToday(item.dueDate);
              const isCompleting = completedAnims.has(item.id);
              const hasDraft = !!item.draftDate;

              const startDate = (item.handoutDate || item.draftDate || item.dueDate) as string;
              const barLeft = clamp(dayToPercent(startDate));
              const barRight = clamp(dayToPercent(item.dueDate));
              const barWidth = Math.max(2, barRight - barLeft);

              let draftWidth = 0;
              let finalWidth = barWidth;
              if (hasDraft) {
                draftWidth = Math.max(0, clamp(dayToPercent(item.draftDate!)) - barLeft);
                finalWidth = Math.max(2, barRight - clamp(dayToPercent(item.draftDate!)));
              }

              const milestones = [
                item.handoutDate ? { date: item.handoutDate, label: "Handout", emoji: "📋" } : null,
                item.draftDate ? { date: item.draftDate, label: "Draft due", emoji: "✏️" } : null,
                { date: item.dueDate, label: "Final due", emoji: "🏁" },
              ].filter((m): m is { date: string; label: string; emoji: string } => m !== null);

              let pillBg = "#edf0f3", pillColor = "#748398", pillText = `${diff}d`;
              if (diff < 0) {
                pillBg = "#fce8ee"; pillColor = "#c0445e";
                pillText = `${Math.abs(diff)}d late`;
              } else if (diff === 0) {
                pillBg = "#fce8ee"; pillColor = "#c0445e"; pillText = "TODAY";
              } else if (diff <= 3) {
                pillBg = "#fce8ee"; pillColor = "#c0445e";
              } else if (diff <= 7) {
                pillBg = "#fdf3e3"; pillColor = "#a06020";
              }

              return [
                <div
                  key={`l-${item.id}`}
                  className="sr-label-row"
                  onClick={() => handleCompletionWithAnim(item.id, false)}
                  style={{ borderRight: "1.5px solid rgba(69,96,113,0.1)" }}
                >
                  <div className="sr-label-emoji" style={{ background: subjectStyle.light }}>{emoji}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 11.5, fontWeight: 600, color: "#1d2428",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 98,
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#8a96a3", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 60 }}>
                        {item.subject}
                      </span>
                      {hasDraft && (
                        <span
                          onClick={e => { e.stopPropagation(); void toggleDraft(item.id, e); }}
                          style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 6,
                            cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
                            background: item.draftCompleted ? "#d4edcc" : "rgba(69,96,113,0.08)",
                            color: item.draftCompleted ? "#2d5a24" : "#748398",
                          }}
                        >
                          {item.draftCompleted ? "✓ Draft" : "Draft"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>,

                <div key={`t-${item.id}`} className="sr-track-row">
                  {[1, 2, 3, 4, 5].map(gi => (
                    <div key={gi} className="sr-gridline" style={{ left: `${(gi / 6) * 100}%` }} />
                  ))}
                  {todayInView && (
                    <div className="sr-today-line" style={{ left: `${(todayIdx / TOTAL_DAYS) * 100}%` }} />
                  )}

                  <div
                    className={`sr-bar-wrap${isCompleting ? " sr-completing" : ""}`}
                    style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                  >
                    {hasDraft && draftWidth > 0 && (
                      <div
                        className={`sr-seg-draft${item.draftCompleted ? " done" : ""}`}
                        style={{ width: `${(draftWidth / barWidth) * 100}%`, background: subjectStyle.color }}
                      >
                        {draftWidth > 8 && (item.draftCompleted ? "✓" : "Draft")}
                      </div>
                    )}
                    <div
                      className={`sr-seg-final${!hasDraft ? " solo" : ""}${hasDraft && item.draftCompleted ? " unlocked" : ""}`}
                      style={{
                        width: hasDraft ? `${(finalWidth / barWidth) * 100}%` : "100%",
                        background: (item.draftCompleted || !hasDraft) ? subjectStyle.color : subjectStyle.light,
                        borderColor: (!item.draftCompleted && hasDraft) ? subjectStyle.mid : "transparent",
                      }}
                    >
                      {finalWidth > 6 && (item.title.length <= 12 ? item.title : item.subject.split(" ")[0])}
                    </div>
                  </div>

                  {milestones.map((m, mi) => {
                    const pos = clamp(dayToPercent(m.date));
                    if (pos < -1 || pos > 101) return null;
                    return (
                      <div
                        key={mi}
                        className="sr-milestone"
                        style={{ left: `${pos}%`, background: subjectStyle.color }}
                        onMouseEnter={e => setTooltipInfo({
                          x: e.clientX, y: e.clientY - 44,
                          text: `${m.emoji} ${m.label}: ${formatShort(new Date(m.date))}`,
                        })}
                        onMouseLeave={() => setTooltipInfo(null)}
                      />
                    );
                  })}

                  {(() => {
                    const pp = clamp(dayToPercent(item.dueDate));
                    if (pp < -1 || pp > 96) return null;
                    return (
                      <div
                        className="sr-due-pill"
                        style={{ left: `calc(${pp}% + 10px)`, background: pillBg, color: pillColor }}
                      >
                        {pillText}
                      </div>
                    );
                  })()}
                </div>,
              ];
            })}

          {/* Completed section */}
          {items.filter(item => item.completed).length > 0 && (
            <>
              <div className="sr-section-label">✓ Completed</div>
              {items.filter(item => item.completed).map(item => {
                const subjectStyle = getSubjectStyle(item.subject);
                const emoji = getSubjectEmoji(item.subject);
                const startDate = (item.handoutDate || item.draftDate || item.dueDate) as string;
                const barLeft = clamp(dayToPercent(startDate));
                const barRight = clamp(dayToPercent(item.dueDate));
                const barWidth = Math.max(2, barRight - barLeft);
                return [
                  <div
                    key={`l-${item.id}`}
                    className="sr-label-row sr-done-row"
                    onClick={() => handleCompletionWithAnim(item.id, true)}
                    style={{ borderRight: "1.5px solid rgba(69,96,113,0.1)" }}
                  >
                    <div className="sr-label-emoji" style={{ background: subjectStyle.light }}>{emoji}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11.5, fontWeight: 600, color: "#1d2428",
                        textDecoration: "line-through",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 98,
                      }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: "#8a96a3" }}>{item.subject}</div>
                    </div>
                  </div>,
                  <div key={`t-${item.id}`} className="sr-track-row sr-done-row">
                    {[1, 2, 3, 4, 5].map(gi => (
                      <div key={gi} className="sr-gridline" style={{ left: `${(gi / 6) * 100}%` }} />
                    ))}
                    {todayInView && (
                      <div className="sr-today-line" style={{ left: `${(todayIdx / TOTAL_DAYS) * 100}%` }} />
                    )}
                    <div className="sr-bar-wrap" style={{ left: `${barLeft}%`, width: `${barWidth}%` }}>
                      <div
                        className="sr-seg-final solo"
                        style={{ width: "100%", background: subjectStyle.color, opacity: 0.5 }}
                      >
                        {item.title}
                      </div>
                    </div>
                  </div>,
                ];
              })}
            </>
          )}

          {/* Empty state */}
          {items.length === 0 && (
            <div style={{
              gridColumn: "1/-1", padding: "36px 20px",
              textAlign: "center", fontSize: 13, color: "#8a96a3",
            }}>
              No assessments yet. Add one above.
            </div>
          )}

        </div>
      </div>

      {/* Tooltip */}
      {tooltipInfo && (
        <div className="sr-tooltip" style={{ top: tooltipInfo.y, left: tooltipInfo.x }}>
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
}
