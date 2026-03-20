"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type UpcomingItem = {
  id: string;
  subject: string;
  title: string;
  dueDate: string;
  handoutDate?: string | null;
  draftDate?: string | null;
  completed: boolean;
};

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function getDiffDays(dueDate: string): number {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = parseDate(dueDate);
  if (!due) return 999;
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueMid.getTime() - todayMid.getTime()) / 86400000);
}

const TOTAL_DAYS = 42; // 6 weeks

const SUBJECT_COLORS: Record<string, string> = {
  Maths:     "#5a7d8e",
  English:   "#6d8a69",
  Chemistry: "#8a9eaa",
  Physics:   "#9a6a80",
  Japanese:  "#9a7a3a",
  Biology:   "#4a7a8e",
  Study:     "#9a8a7a",
};

function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] ?? "#748398";
}

// Layout constants
const TRACK_H = 60;                // row min-height (px)
const BAR_H   = 24;                // assessment bar height (px)
const COLLAPSE_PCT = 3;            // collapse milestones within 3% of each other
const COLLISION_THRESHOLD_PCT = 5; // stagger labels when within 5% of each other
// Vertical zones (% of track height):
//   Milestone zone: 1%  — connector line + dots + labels
//   Bar zone:       50%  — assessment bar (centred)

type MilestoneWithY = {
  left: number;
  label: string;
  opacity: number;
  labelYOffset: number; // px from milestone zone (1%), negative = above
};

function layoutMilestoneLabels(
  milestones: Array<{ left: number; label: string; opacity: number }>
): MilestoneWithY[] {
  const result: MilestoneWithY[] = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const prev = result[i - 1];
    if (!prev || Math.abs(m.left - prev.left) >= COLLISION_THRESHOLD_PCT) {
      result.push({ ...m, labelYOffset: -16 });
    } else {
      result.push({ ...m, labelYOffset: prev.labelYOffset === -16 ? 8 : -16 });
    }
  }
  return result;
}

export default function GanttWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [offset, setOffset] = useState(0); // offset in weeks

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
          completed: Boolean(data.completed),
        });
      });
      setItems(list);
    });
    return () => unsub();
  }, [authReady]);

  // Week header dates (start of each week in the window)
  const weekHeaders = useMemo(() => {
    const headers: Date[] = [];
    const today = new Date();
    for (let w = 0; w < 6; w++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset * 7 + w * 7);
      headers.push(d);
    }
    return headers;
  }, [offset]);

  // Adjust item diff for current offset window
  function getAdjustedDiff(dueDate: string): number {
    return getDiffDays(dueDate) - offset * 7;
  }

  const urgent = items.filter((i) => !i.completed && getDiffDays(i.dueDate) <= 3);
  const soon = items.filter((i) => !i.completed && getDiffDays(i.dueDate) > 3 && getDiffDays(i.dueDate) <= 14);
  const upcoming = items.filter((i) => !i.completed && getDiffDays(i.dueDate) > 14);
  const completed = items.filter((i) => i.completed);

  if (!authReady) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 28, background: "rgba(0,0,0,0.06)", borderRadius: 6 }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428", marginBottom: 4 }}>No deadlines yet</div>
        <div style={{ fontSize: 11, color: "#8a96a3" }}>Add your first assessment or exam using the form below.</div>
      </div>
    );
  }

  function renderRow(item: UpcomingItem) {
    const originalDiff = getDiffDays(item.dueDate);
    const adjustedDue  = getAdjustedDiff(item.dueDate);
    const hasDraft     = !!item.draftDate;
    const hasHandout   = !!item.handoutDate;

    const clamp = (v: number) => Math.max(0, Math.min(92, v));
    const dueLeft     = clamp((adjustedDue / TOTAL_DAYS) * 100);
    const draftLeft   = hasDraft   ? clamp((getAdjustedDiff(item.draftDate!)   / TOTAL_DAYS) * 100) : null;
    const handoutLeft = hasHandout ? clamp((getAdjustedDiff(item.handoutDate!) / TOTAL_DAYS) * 100) : null;

    const spanLeft = handoutLeft ?? draftLeft ?? dueLeft;
    if (adjustedDue < -10 || spanLeft > 100) return null;

    const color = getSubjectColor(item.subject);

    const dueLabel = item.completed
      ? "Done"
      : originalDiff < 0  ? `${Math.abs(originalDiff)}d overdue`
      : originalDiff === 0 ? "Today"
      : originalDiff <= 14 ? `${originalDiff}d`
      : `In ${originalDiff}d`;

    // Build ordered milestone list
    const raw: Array<{ left: number; label: string; opacity: number }> = [];
    if (hasHandout && handoutLeft !== null) raw.push({ left: handoutLeft, label: "Handout", opacity: 0.5 });
    if (hasDraft   && draftLeft   !== null) raw.push({ left: draftLeft,   label: "Draft",   opacity: 0.75 });
    raw.push({ left: dueLeft, label: "Final", opacity: 1 });

    // Collapse milestones within COLLAPSE_PCT% of each other
    const milestones: Array<{ left: number; label: string; opacity: number }> = [];
    for (const m of raw) {
      const last = milestones[milestones.length - 1];
      if (last && Math.abs(m.left - last.left) < COLLAPSE_PCT) {
        last.label   = last.label + " · " + m.label;
        last.opacity = Math.max(last.opacity, m.opacity);
      } else {
        milestones.push({ ...m });
      }
    }

    const firstM = milestones[0];
    const lastM  = milestones[milestones.length - 1];

    const milestonesWithLabel = layoutMilestoneLabels(milestones);

    return (
      <div key={item.id} style={{ display: "flex", alignItems: "flex-start", minHeight: TRACK_H, marginBottom: 8 }}>
        {/* Row label */}
        <div style={{ width: 120, flexShrink: 0, paddingRight: 12, paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2428", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.subject}
          </div>
          <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.title}
          </div>
        </div>

        {/* Track */}
        <div style={{ flex: 1, position: "relative", minHeight: TRACK_H }}>
          {/* Week grid lines */}
          {weekHeaders.map((_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${(i / 6) * 100}%`, width: 1, borderLeft: "1px dashed rgba(0,0,0,0.05)" }} />
          ))}

          {/* Today marker — visible whenever today falls within the current window */}
          {(() => {
            const todayAdjusted = -offset * 7;
            if (todayAdjusted < 0 || todayAdjusted >= TOTAL_DAYS) return null;
            const todayPct = (todayAdjusted / TOTAL_DAYS) * 100;
            return (
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayPct}%`, width: 2, background: "#e39bb6", opacity: 0.75, zIndex: 5, borderRadius: 2 }} />
            );
          })()}

          {/* Spine line at bar level (50%) */}
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.06)", transform: "translateY(-50%)" }} />

          {/* Main bar — bar zone: centred at 50% */}
          <div style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            height: BAR_H,
            left: `${spanLeft}%`,
            width: `${Math.max(3, dueLeft - spanLeft)}%`,
            background: color,
            color: "white",
            borderRadius: 7,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>
            {item.title || item.subject}
          </div>

          {/* Connecting line — milestone zone: centred at 1% */}
          {milestones.length > 1 && (
            <div style={{
              position: "absolute",
              top: "1%",
              left: `${firstM.left}%`,
              width: `${lastM.left - firstM.left}%`,
              height: 1,
              background: "#c4d0d8",
              zIndex: 2,
              transform: "translateY(-50%)",
            }} />
          )}

          {/* Labels (staggered to avoid overlap) — milestone zone */}
          {milestonesWithLabel.map((m, i) => (
            <div key={`lbl-${i}`} style={{
              position: "absolute",
              top: `calc(1% + ${m.labelYOffset}px)`,
              left: `${m.left}%`,
              transform: "translateX(-50%)",
              fontSize: 9,
              fontWeight: 700,
              color: "#748398",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 6,
              lineHeight: 1,
            }}>
              {m.label}
            </div>
          ))}

          {/* Milestone dots — milestone zone: centred at 1% */}
          {milestones.map((m, i) => (
            <div key={`circ-${i}`} style={{
              position: "absolute",
              top: "1%",
              left: `${m.left}%`,
              transform: "translate(-50%, -50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              border: "2.5px solid #fff",
              opacity: m.opacity,
              zIndex: 5,
            }} />
          ))}

          {/* Day-count pill — pinned to milestone zone */}
          <div style={{
            position: "absolute",
            top: "calc(1% - 9px)",
            left: `${lastM.left}%`,
            marginLeft: 8,
            zIndex: 7,
          }}>
            <span style={{
              background: "white",
              border: "1px solid #b8cad6",
              color: "#456071",
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              display: "inline-block",
              lineHeight: 1.5,
            }}>
              {dueLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const sectionLabel = (emoji: string, text: string, color: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color, padding: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
      <span>{emoji}</span><span>{text}</span>
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 560 }}>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="gantt-nav-btn"
            onClick={() => setOffset((o) => o - 2)}
            style={{ background: "rgba(69,96,113,0.08)", color: "#456071", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            &larr; Prev
          </button>
          <button
            type="button"
            className="gantt-nav-btn"
            onClick={() => setOffset(0)}
            style={{ background: "rgba(69,96,113,0.08)", color: "#456071", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Today
          </button>
          <button
            type="button"
            className="gantt-nav-btn"
            onClick={() => setOffset((o) => o + 2)}
            style={{ background: "rgba(69,96,113,0.08)", color: "#456071", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Next &rarr;
          </button>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#8a96a3" }}>
            {formatWeekLabel(weekHeaders[0])} &ndash; {formatWeekLabel(weekHeaders[5])}
          </span>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {[
            { color: "#748398", label: "Handout", opacity: 0.5 },
            { color: "#748398", label: "Draft",   opacity: 0.75 },
            { color: "#748398", label: "Final",   opacity: 1 },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, fontSize: 10, color: "#8a96a3" }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#456071", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{l.label}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${l.color}`, background: "white", opacity: l.opacity }} />
              <div style={{ width: 1, height: 5, background: "#74839999" }} />
              <div style={{ width: 20, height: 4, background: "#748398", borderRadius: 2, opacity: 0.5 }} />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#8a96a3", marginLeft: 4 }}>
            <div style={{ width: 2, height: 12, background: "#e39bb6", borderRadius: 2 }} />
            <span>Today</span>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: "flex", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ width: 130, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex" }}>
            {weekHeaders.map((d, i) => (
              <div key={i} style={{ flex: 1, fontSize: 10, color: "#8a96a3", textAlign: "center" }}>
                {formatWeekLabel(d)}
              </div>
            ))}
          </div>
        </div>

        {/* Urgent section */}
        {urgent.length > 0 && (
          <>
            {sectionLabel("\uD83D\uDD34", "Urgent", "#9a2040")}
            {urgent.map(renderRow)}
          </>
        )}

        {/* Soon section */}
        {soon.length > 0 && (
          <>
            {sectionLabel("\uD83D\uDFE1", "Soon", "#7a4d20")}
            {soon.map(renderRow)}
          </>
        )}

        {/* Upcoming section */}
        {upcoming.length > 0 && (
          <>
            {sectionLabel("\uD83D\uDD35", "Upcoming", "#1a3a4a")}
            {upcoming.map(renderRow)}
          </>
        )}

        {/* Completed section */}
        {completed.length > 0 && (
          <>
            {sectionLabel("\u2705", "Completed", "#2d5a24")}
            {completed.map(renderRow)}
          </>
        )}

      </div>
    </div>
  );
}
