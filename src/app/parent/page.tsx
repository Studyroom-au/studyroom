"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import FeedbackButton from "@/components/FeedbackButton";

// ─── Constants ───────────────────────────────────────────
const YEAR_LEVELS = [
  "Prep", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
];

// ─── Types ────────────────────────────────────────────────────
type TaskItem = {
  id: string;
  title: string;
  done: boolean;
  source?: string;
  dueDate?: string | null;
};

type UpcomingItem = {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  type: string;
  completed: boolean;
};

type SessionRow = {
  id: string;
  startAt: string | null;
  durationMinutes: number;
  status: string;
  modality: string;
  notes: string;
};

type PomoEntry = {
  id: string;
  date: string;
  durationMs: number;
  completedAt: string | null;
};

type MoodEntry = {
  id: string;
  date: string;
  mood: string;
  note: string | null;
  createdAt: string | null;
};

type StudentData = {
  id: string;
  hubUid: string;
  studentName: string;
  yearLevel: string;
  subjects: string[];
  roomAccessEnabled: boolean;
  tasks: TaskItem[];
  upcoming: UpcomingItem[];
  sessions: SessionRow[];
  pomoHistory: PomoEntry[];
  moodLogs: MoodEntry[];
};

type HubData = {
  parent: {
    parentName: string;
    parentEmail: string;
  };
  students: StudentData[];
  subscription?: {
    status: string;
    trialEndsAt: string | null;
    stripeCustomerId: string;
  };
};

// ─── Shared input/button styles ───────────────────────────────
const inp: React.CSSProperties = {
  flex: 1,
  border: "1.5px solid #e4eaef",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  color: "#1d2428",
  background: "#fafbfc",
  outline: "none",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  background: "#456071",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  flexShrink: 0,
};

const btnDisabled: React.CSSProperties = { ...btnPrimary, opacity: 0.5, cursor: "not-allowed" };

// ─── Widget layout styles ─────────────────────────────────────
const widget: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  marginBottom: 14,
  overflow: "hidden",
};

function WidgetHead({ title, helper, accent }: { title: string; helper: string; accent?: string }) {
  return (
    <div style={{
      padding: "14px 18px 12px",
      borderBottom: "1px solid rgba(0,0,0,0.05)",
      ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 3, lineHeight: 1.4 }}>{helper}</div>
    </div>
  );
}

const widgetBody: React.CSSProperties = { padding: "14px 18px 16px" };

// Empty state used inside widget bodies
function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 12, color: "#b0bec5", margin: 0, lineHeight: 1.5 }}>{text}</p>;
}

// ─── Add Child Modal ──────────────────────────────────────
const modalInp: React.CSSProperties = {
  width: "100%",
  border: "1.5px solid #e4eaef",
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#1d2428",
  outline: "none",
  background: "#fafbfc",
  boxSizing: "border-box" as const,
};

const modalLbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#748398",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  marginBottom: 5,
  display: "block",
};

function AddChildModal({
  isOpen, onClose, idToken, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  idToken: string;
  onSuccess: () => void;
}) {
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [dob, setDob] = useState("");
  const [school, setSchool] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  function reset() {
    setStudentName(""); setStudentEmail(""); setStudentPassword("");
    setConfirmPassword(""); setYearLevel(""); setDob(""); setSchool("");
    setPromoCode(""); setSaving(false); setErr(null); setPromoErr(null);
  }

  function close() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setPromoErr(null);

    if (!studentName.trim()) { setErr("Student name is required."); return; }
    if (!studentEmail.trim()) { setErr("Student email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) { setErr("Please enter a valid email address."); return; }
    if (studentPassword.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (studentPassword !== confirmPassword) { setErr("Passwords don't match."); return; }
    if (!yearLevel) { setErr("Please select a year level."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/parent/add-child", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          studentPassword,
          yearLevel,
          dob: dob || undefined,
          school: school.trim() || undefined,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean; error?: string; promoError?: string; promoApplied?: boolean;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Could not add student. Please try again.");
        return;
      }
      if (data.promoError) {
        setPromoErr(data.promoError);
      }
      onSuccess();
      reset();
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 18, padding: "24px 22px",
          border: "1px solid rgba(0,0,0,0.06)", maxWidth: 460, width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428" }}>Add another child</div>
          <button
            type="button"
            onClick={close}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, color: "#8a96a3", padding: "0 4px",
              fontFamily: "inherit", lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>Student name</label>
            <input
              style={modalInp}
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setErr(null); }}
              placeholder="First name"
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>Student email</label>
            <input
              type="email"
              style={modalInp}
              value={studentEmail}
              onChange={(e) => { setStudentEmail(e.target.value); setErr(null); }}
              placeholder="student@email.com"
              autoComplete="off"
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>Student password</label>
            <input
              type="password"
              style={modalInp}
              value={studentPassword}
              onChange={(e) => { setStudentPassword(e.target.value); setErr(null); }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={modalLbl}>Confirm password</label>
            <input
              type="password"
              style={modalInp}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErr(null); }}
              placeholder="Re-enter password"
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>Year level</label>
            <select
              style={{ ...modalInp, cursor: "pointer" }}
              value={yearLevel}
              onChange={(e) => setYearLevel(e.target.value)}
              disabled={saving}
              title="Year level"
            >
              <option value="">Select year</option>
              {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>
              Date of birth{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>
                (optional)
              </span>
            </label>
            <input
              type="date"
              style={modalInp}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              disabled={saving}
              title="Date of birth"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>
              School{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>
                (optional)
              </span>
            </label>
            <input
              style={modalInp}
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="School name"
              disabled={saving}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={modalLbl}>
              Promo / beta code{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>
                (optional)
              </span>
            </label>
            <input
              style={{ ...modalInp, fontFamily: "monospace", letterSpacing: "0.1em" }}
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoErr(null); }}
              placeholder="Enter code"
              disabled={saving}
            />
            {promoErr && (
              <div style={{ fontSize: 11, color: "#c0445e", marginTop: 5 }}>{promoErr}</div>
            )}
          </div>

          {err && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginBottom: 14 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2, background: saving ? "#8a96a3" : "#456071", color: "#fff",
                border: "none", borderRadius: 10, padding: "10px 0",
                fontSize: 13, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Adding…" : "Add child →"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              style={{
                flex: 1, background: "#f4f7f9", color: "#677a8a",
                border: "none", borderRadius: 10, padding: "10px 0",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Student Selector ─────────────────────────────────────────
function StudentSelector({
  students, selectedId, onSelect, onAddChild,
}: {
  students: StudentData[];
  selectedId: string;
  onSelect: (s: StudentData) => void;
  onAddChild: () => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {students.length > 1 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#748398", marginBottom: 8 }}>
            Students
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center", marginBottom: 10 }}>
            {students.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 20,
                    border: `1.5px solid ${active ? "#456071" : "rgba(0,0,0,0.12)"}`,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: active ? "#456071" : "#fff",
                    color: active ? "#fff" : "#456071",
                    transition: "all 0.15s",
                  }}
                >
                  {s.studentName}
                </button>
              );
            })}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onAddChild}
        style={{
          padding: "7px 14px",
          borderRadius: 20,
          border: "1.5px dashed rgba(69,96,113,0.3)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          background: "transparent",
          color: "#748398",
        }}
      >
        + Add another child
      </button>
    </div>
  );
}

// ─── Add Task Form ────────────────────────────────────────────
function AddTaskForm({ idToken, studentId, onAdded }: {
  idToken: string; studentId: string; onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/parent/add-task", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, studentId }),
      });
      if (!res.ok) throw new Error("Failed");
      setTitle(""); onAdded();
    } catch {
      setErr("Could not add task. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          style={inp}
          placeholder="Add a task for your child…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />
        <button type="submit" style={saving || !title.trim() ? btnDisabled : btnPrimary} disabled={saving || !title.trim()}>
          {saving ? "…" : "Add"}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: "#dc2626" }}>{err}</div>}
    </form>
  );
}

// ─── Add Upcoming Form ────────────────────────────────────────
function AddUpcomingForm({ idToken, studentId, subjects, onAdded }: {
  idToken: string; studentId: string; subjects: string[]; onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState("assessment");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setSubject(subjects[0] ?? ""); }, [subjects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !dueDate) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/parent/add-upcoming", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, subject, dueDate, type, studentId }),
      });
      if (!res.ok) throw new Error("Failed");
      setTitle(""); setDueDate(""); onAdded();
    } catch {
      setErr("Could not add. Please try again.");
    } finally { setSaving(false); }
  }

  const canSubmit = title.trim() && dueDate && !saving;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        <input
          style={{ ...inp, minWidth: 0 }}
          placeholder="e.g. Chemistry Report"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />
        <input
          type="date"
          title="Due date"
          style={{ ...inp, flex: "0 0 auto", width: 138 }}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={saving}
        />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        {subjects.length > 0 ? (
          <select style={{ ...inp, flex: 1, minWidth: 120 }} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} title="Subject">
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="">Other</option>
          </select>
        ) : (
          <input style={{ ...inp, flex: 1 }} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} />
        )}
        <select style={{ ...inp, flex: "0 0 auto", width: 138 }} value={type} onChange={(e) => setType(e.target.value)} disabled={saving} title="Type">
          <option value="assessment">Assessment</option>
          <option value="exam">Exam</option>
          <option value="assignment">Assignment</option>
          <option value="project">Project</option>
          <option value="homeschool_goal">Homeschool goal</option>
          <option value="reading_task">Reading task</option>
          <option value="other">Other</option>
        </select>
        <button type="submit" style={canSubmit ? btnPrimary : btnDisabled} disabled={!canSubmit}>
          {saving ? "…" : "Add"}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: "#dc2626" }}>{err}</div>}
    </form>
  );
}

// ─── Room Access Toggle ───────────────────────────────────────
function RoomAccessToggle({ enabled, idToken, studentId, onChange }: {
  enabled: boolean; idToken: string; studentId: string; onChange: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setErr(null);
    const next = !enabled;
    try {
      const res = await fetch("/api/parent/room-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, studentId }),
      });
      if (!res.ok) throw new Error("Failed");
      onChange(next);
    } catch {
      setErr("Could not update. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12, color: enabled ? "#2d5a24" : "#8a96a3", lineHeight: 1.4 }}>
          {enabled ? "Your child can enter online study rooms." : "Your child cannot access study rooms."}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          style={{
            flexShrink: 0, border: "none", borderRadius: 20,
            padding: "8px 18px", fontSize: 12, fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: busy ? 0.6 : 1,
            background: enabled ? "#d4edcc" : "#fce8ee",
            color: enabled ? "#2d5a24" : "#c0445e",
            transition: "all 0.2s",
          }}
        >
          {busy ? "…" : enabled ? "Enabled — tap to block" : "Blocked — tap to allow"}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: "#dc2626" }}>{err}</div>}
    </div>
  );
}

// ─── Type label map ───────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  assessment: "Assessment", exam: "Exam", assignment: "Assignment",
  project: "Project", homeschool_goal: "Homeschool goal",
  reading_task: "Reading task", other: "Other",
};
function typeLabel(t: string) { return TYPE_LABELS[t] ?? t; }

// ─── Task Row ─────────────────────────────────────────────────
function TaskRow({ task }: { task: TaskItem }) {
  const sourceLabel =
    task.source === "parent_assigned" ? "From parent" :
    task.source === "tutor_assigned" ? "From tutor" : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "9px 11px", borderRadius: 11, marginBottom: 5,
      border: `1px solid ${task.done ? "#c8e6bb" : "rgba(0,0,0,0.07)"}`,
      background: task.done ? "#f4faf0" : "#fafbfc",
    }}>
      <span style={{
        width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${task.done ? "#82977e" : "rgba(0,0,0,0.14)"}`,
        background: task.done ? "#82977e" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {task.done && (
          <svg width="7" height="5" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={{
        flex: 1, fontSize: 12,
        color: task.done ? "#8a96a3" : "#1d2428",
        textDecoration: task.done ? "line-through" : "none",
        display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 5,
      }}>
        {task.title}
        {sourceLabel && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
            background: task.source === "parent_assigned" ? "#e8f0fa" : "#d6e5e3",
            color: task.source === "parent_assigned" ? "#3a6090" : "#1a3a4a",
            whiteSpace: "nowrap" as const,
          }}>
            {sourceLabel}
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Mood helpers ─────────────────────────────────────────────
const MOOD_EMOJI: Record<string, string> = {
  great: "😊", good: "🙂", ok: "😐", tired: "😴", stressed: "😰",
};
const MOOD_LABEL: Record<string, string> = {
  great: "Great", good: "Good", ok: "OK", tired: "Tired", stressed: "Stressed",
};

function relativeDate(isoOrDate: string | null): string {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return "";
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function ActivityRow({ icon, label, secondary, when }: {
  icon: string; label: string; secondary?: string; when?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 10, marginBottom: 5,
      border: "1px solid rgba(0,0,0,0.06)", background: "#fafbfc",
    }}>
      <span style={{ fontSize: 15, flexShrink: 0, width: 22, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: "#1d2428" }}>
        {label}
        {secondary && <span style={{ color: "#8a96a3", marginLeft: 6, fontSize: 11 }}>{secondary}</span>}
      </span>
      {when && <span style={{ fontSize: 10, color: "#b0bec5", whiteSpace: "nowrap" as const }}>{when}</span>}
    </div>
  );
}

function ActivityFeed({ completedTasks, pomoHistory, moodLogs }: {
  completedTasks: TaskItem[];
  pomoHistory: PomoEntry[];
  moodLogs: MoodEntry[];
}) {
  const hasActivity = completedTasks.length > 0 || pomoHistory.length > 0 || moodLogs.length > 0;

  if (!hasActivity) {
    return <EmptyNote text="Activity will appear here once your child starts using Studyroom." />;
  }

  const subLabel = (text: string, topGap?: boolean) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#b0bec5", marginBottom: 5, marginTop: topGap ? 12 : 0 }}>
      {text}
    </div>
  );

  return (
    <div>
      {pomoHistory.length > 0 && (
        <>
          {subLabel("Focus sessions")}
          {pomoHistory.map((p) => (
            <ActivityRow key={p.id} icon="🍅" label={`${Math.round(p.durationMs / 60000)} min focus session`} when={relativeDate(p.completedAt ?? p.date)} />
          ))}
        </>
      )}
      {moodLogs.length > 0 && (
        <>
          {subLabel("Mood check-ins", pomoHistory.length > 0)}
          {moodLogs.map((m) => (
            <ActivityRow key={m.id} icon={MOOD_EMOJI[m.mood] ?? "😐"} label={MOOD_LABEL[m.mood] ?? m.mood} secondary={m.note ?? undefined} when={relativeDate(m.createdAt ?? m.date)} />
          ))}
        </>
      )}
      {completedTasks.length > 0 && (
        <>
          {subLabel("Completed tasks", pomoHistory.length > 0 || moodLogs.length > 0)}
          {completedTasks.slice(0, 5).map((t) => (
            <ActivityRow
              key={t.id}
              icon="✅"
              label={t.title}
              secondary={t.source === "parent_assigned" ? "parent assigned" : t.source === "tutor_assigned" ? "tutor assigned" : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HubData | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [idToken, setIdToken] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [roomAccessEnabled, setRoomAccessEnabled] = useState(true);
  const [addChildModalOpen, setAddChildModalOpen] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function loadData(token: string): Promise<HubData | null> {
    const res = await fetch("/api/parent/hub-data", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) { setNotLinked(true); return null; }
    if (!res.ok) throw new Error("Failed to load");
    const json = await res.json() as { ok: boolean } & HubData;
    setData(json);
    return json;
  }

  function selectStudent(s: StudentData) {
    setSelectedStudentId(s.id);
    setRoomAccessEnabled(s.roomAccessEnabled);
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      setAuthEmail(u.email ?? "");
      try {
        const token = await u.getIdToken();
        setIdToken(token);
        const loaded = await loadData(token);
        if (loaded && loaded.students.length > 0) {
          const first = loaded.students[0];
          setSelectedStudentId(first.id);
          setRoomAccessEnabled(first.roomAccessEnabled);
        }
      } catch (err) {
        console.error("[parent-page]", err);
        setNotLinked(true);
      } finally {
        setLoading(false);
      }
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh() {
    if (!idToken) return;
    try { await loadData(idToken); } catch { /* silent */ }
  }

  async function handleSubscribe() {
    setBillingBusy(true); setBillingError(null);
    try {
      const token = (await auth.currentUser?.getIdToken()) ?? idToken;
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/parent`,
          cancelUrl: `${window.location.origin}/parent`,
        }),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "Could not start checkout.");
      window.location.href = d.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Something went wrong.");
      setBillingBusy(false);
    }
  }

  async function handleManageBilling() {
    setBillingBusy(true); setBillingError(null);
    try {
      const token = (await auth.currentUser?.getIdToken()) ?? idToken;
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/parent` }),
      });
      const d = await res.json() as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "Could not open billing portal.");
      window.location.href = d.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Something went wrong.");
      setBillingBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading…</div>
      </div>
    );
  }

  if (notLinked) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: 24, border: "1px solid rgba(0,0,0,0.06)", maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", marginBottom: 8 }}>Account not linked</div>
          <div style={{ fontSize: 13, color: "#8a96a3", lineHeight: 1.6 }}>
            Your email address isn&rsquo;t linked to a student record yet.
            Contact your tutor or Studyroom admin to get set up.
          </div>
          <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 12 }}>{authEmail}</div>
          <button
            type="button"
            onClick={() => signOut(auth).then(() => router.push("/"))}
            style={{ marginTop: 16, background: "#456071", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.students.length === 0) return null;

  const student = data.students.find((s) => s.id === selectedStudentId) ?? data.students[0];
  const { upcoming, tasks, sessions } = student;
  const pendingTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  // Snapshot: most recent activity timestamp across pomo, mood, and completed tasks
  const lastActivityTs = [
    ...student.pomoHistory.map((p) => p.completedAt ?? p.date),
    ...student.moodLogs.map((m) => m.createdAt ?? m.date),
  ].filter(Boolean).sort().pop() ?? null;

  // Snapshot: most recent mood entry (sort descending by createdAt or date)
  const latestMood = [...student.moodLogs]
    .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))[0]?.mood ?? null;

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", paddingBottom: 60 }}>

      {/* ── App header ── */}
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-4">
        <div
          className="rounded-[28px] bg-white/95 backdrop-blur-md"
          style={{ border: "1px solid rgba(69,96,113,0.15)", boxShadow: "0 1px 3px rgba(20,32,44,0.06), 0 8px 28px rgba(20,32,44,0.09)" }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 md:px-5">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Image src="/logo.png" alt="Studyroom" width={160} height={40} className="h-[36px] w-auto object-contain" priority />
              </Link>
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--muted)]">Parent View</p>
                <p className="text-sm font-semibold text-[color:var(--ink)]">{student.studentName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth).then(() => router.push("/"))}
              className="button-ghost rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* ── Student selector + Add another child ── */}
        <StudentSelector
          students={data.students}
          selectedId={student.id}
          onSelect={selectStudent}
          onAddChild={() => setAddChildModalOpen(true)}
        />

        {/* ── Add another child modal ── */}
        <AddChildModal
          isOpen={addChildModalOpen}
          onClose={() => setAddChildModalOpen(false)}
          idToken={idToken}
          onSuccess={async () => {
            setAddChildModalOpen(false);
            await refresh();
          }}
        />

        {/* ── Billing card ── */}
        {(() => {
          const sub = data.subscription;
          if (!sub) return null;
          const { status, trialEndsAt, stripeCustomerId } = sub;
          const trialDate = trialEndsAt ? new Date(trialEndsAt) : null;
          const daysLeft = trialDate ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000) : null;
          const trialExpired = daysLeft !== null && daysLeft <= 0;
          const isActive = status === "active";
          const isTrial = status === "trial" && !trialExpired;

          return (
            <div style={{ ...widget, marginBottom: 16, borderTop: "3px solid #d4b896" }}>
              <div style={{ padding: "11px 18px 10px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#748398" }}>
                  Billing &amp; Access
                </div>
              </div>
              <div style={{ padding: "14px 18px 16px" }}>
                {isActive ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2d5a24", flexShrink: 0 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#2d5a24" }}>Active subscription</div>
                    </div>
                    {stripeCustomerId && (
                      <button type="button" onClick={handleManageBilling} disabled={billingBusy}
                        style={billingBusy ? btnDisabled : { ...btnPrimary, padding: "7px 14px" }}>
                        {billingBusy ? "…" : "Manage billing"}
                      </button>
                    )}
                  </div>
                ) : isTrial ? (
                  <>
                    <div style={{ fontSize: 12, color: "#1d2428", marginBottom: 4, lineHeight: 1.5 }}>
                      <strong>Free trial</strong>
                      {daysLeft === 1 ? " — ends tomorrow." : daysLeft !== null && daysLeft > 1 ? ` — ${daysLeft} days remaining.` : "."}
                    </div>
                    {trialDate && (
                      <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 12, lineHeight: 1.5 }}>
                        Your trial ends on {trialDate.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}. After that, Studyroom is $9.95/month.
                      </div>
                    )}
                    <button type="button" onClick={handleSubscribe} disabled={billingBusy}
                      style={billingBusy ? btnDisabled : btnPrimary}>
                      {billingBusy ? "…" : "Subscribe — $9.95/month"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: status === "trial" ? "#c0445e" : "#8a96a3", marginBottom: 10, lineHeight: 1.5 }}>
                      {status === "trial" ? "Your trial has ended. Subscribe to keep access." : "Subscribe to access all Studyroom features for your family."}
                    </div>
                    <button type="button" onClick={handleSubscribe} disabled={billingBusy}
                      style={billingBusy ? btnDisabled : btnPrimary}>
                      {billingBusy ? "…" : "Subscribe — $9.95/month"}
                    </button>
                  </>
                )}
                {billingError && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>{billingError}</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Student Snapshot card ── */}
        <div style={{ ...widget, marginBottom: 16 }}>
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", borderTop: "3px solid #456071" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#748398" }}>
              Student Snapshot
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", marginTop: 5 }}>{student.studentName}</div>
            {student.yearLevel && (
              <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 2 }}>{student.yearLevel}</div>
            )}
          </div>
          <div style={{ padding: "14px 18px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#fafbfc", borderRadius: 12, padding: "10px 13px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 5 }}>Tasks Remaining</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#456071", lineHeight: 1 }}>{pendingTasks.length}</div>
              </div>
              <div style={{ background: "#fafbfc", borderRadius: 12, padding: "10px 13px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 5 }}>Upcoming Work</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#456071", lineHeight: 1 }}>{upcoming.length}</div>
              </div>
              <div style={{ background: roomAccessEnabled ? "#f4faf0" : "#fef5f7", borderRadius: 12, padding: "10px 13px", border: `1px solid ${roomAccessEnabled ? "#c8e6bb" : "#f5c6cf"}` }}>
                <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 5 }}>Study Rooms</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: roomAccessEnabled ? "#2d5a24" : "#c0445e" }}>
                  {roomAccessEnabled ? "Enabled" : "Blocked"}
                </div>
              </div>
              <div style={{ background: "#fafbfc", borderRadius: 12, padding: "10px 13px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, marginBottom: 5 }}>Last Activity</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>
                  {lastActivityTs ? relativeDate(lastActivityTs) : "No recent activity"}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, background: "#fafbfc", borderRadius: 12, padding: "10px 13px", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "#8a96a3", fontWeight: 600, flex: 1 }}>Mood</div>
              {latestMood ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{MOOD_EMOJI[latestMood] ?? "😐"}</span>
                  <span>{MOOD_LABEL[latestMood] ?? latestMood}</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#b0bec5" }}>Not logged yet</div>
              )}
            </div>
            {student.subjects.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 10 }}>
                {student.subjects.map((s) => (
                  <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#edf2f6", color: "#456071" }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Widget: Tasks for this student ── */}
        <div style={widget}>
          <WidgetHead
            title="Tasks for this student"
            helper="Add small jobs or reminders for your child."
            accent="#82977e"
          />
          <div style={widgetBody}>
            {idToken && student.hubUid ? (
              <AddTaskForm key={`task-${student.id}`} idToken={idToken} studentId={student.id} onAdded={refresh} />
            ) : !student.hubUid ? (
              <div style={{ marginBottom: 12 }}>
                <EmptyNote text="This student doesn't have a Studyroom login yet. Tasks will be available once they sign in." />
              </div>
            ) : null}

            {pendingTasks.length === 0 && doneTasks.length === 0 ? (
              <EmptyNote text="No tasks added yet. You can add one above." />
            ) : (
              <>
                {pendingTasks.map((t) => <TaskRow key={t.id} task={t} />)}
                {doneTasks.length > 0 && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#748398", cursor: "pointer", userSelect: "none" as const, padding: "4px 0" }}>
                      {doneTasks.length} completed
                    </summary>
                    <div style={{ marginTop: 4 }}>{doneTasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Widget: Upcoming work ── */}
        <div style={widget}>
          <WidgetHead
            title="Upcoming work"
            helper="Add assignments, projects, exams or homeschool goals."
            accent="#b0c8d8"
          />
          <div style={widgetBody}>
            {idToken && student.hubUid && (
              <AddUpcomingForm key={`upcoming-${student.id}`} idToken={idToken} studentId={student.id} subjects={student.subjects} onAdded={refresh} />
            )}
            {upcoming.length === 0 ? (
              <EmptyNote text="No upcoming work added yet." />
            ) : (
              upcoming.map((item) => {
                const due = new Date(item.dueDate);
                const daysUntil = Math.round((due.getTime() - Date.now()) / 86400000);
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 11, marginBottom: 5,
                    border: `1px solid rgba(0,0,0,0.07)`,
                    borderLeft: `3px solid ${daysUntil <= 7 ? "#e39bb6" : daysUntil <= 14 ? "#d4b896" : "#b0c8d8"}`,
                    background: "#fafbfc",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
                        {item.subject}{item.subject ? " · " : ""}{typeLabel(item.type)}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                      whiteSpace: "nowrap" as const, marginLeft: 12,
                      background: daysUntil < 0 ? "#fce8ee" : daysUntil <= 7 ? "#fce8ee" : daysUntil <= 14 ? "#fef3e2" : "#e8f0fa",
                      color: daysUntil < 0 ? "#c0445e" : daysUntil <= 7 ? "#c0445e" : daysUntil <= 14 ? "#a06020" : "#3a6090",
                    }}>
                      {daysUntil < 0 ? "Overdue" : daysUntil === 0 ? "Today" : `In ${daysUntil}d`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Widget: What they've been working on ── */}
        <div style={widget}>
          <WidgetHead
            title="What they've been working on"
            helper="See what your child has completed recently."
            accent="#e39bb6"
          />
          <div style={widgetBody}>
            <ActivityFeed completedTasks={doneTasks} pomoHistory={student.pomoHistory} moodLogs={student.moodLogs} />
          </div>
        </div>

        {/* ── Widget: Study room permission ── */}
        <div style={widget}>
          <WidgetHead
            title="Study room permission"
            helper="Turn study rooms on or off for this student."
            accent="#456071"
          />
          <div style={widgetBody}>
            {idToken && (
              <RoomAccessToggle
                key={`room-${student.id}`}
                enabled={roomAccessEnabled}
                idToken={idToken}
                studentId={student.id}
                onChange={setRoomAccessEnabled}
              />
            )}
          </div>
        </div>

        {/* ── Widget: Tutoring sessions ── */}
        <div style={widget}>
          <WidgetHead
            title="Tutoring sessions"
            helper="Recent Studyroom tutoring sessions."
            accent="#d4b896"
          />
          <div style={widgetBody}>
            {sessions.length === 0 ? (
              <EmptyNote text="No session history yet." />
            ) : (
              sessions.map((s) => {
                const startAt = s.startAt ? new Date(s.startAt) : null;
                return (
                  <div key={s.id} style={{
                    padding: "10px 12px", borderRadius: 11, marginBottom: 5,
                    border: "1px solid rgba(0,0,0,0.07)", background: "#fafbfc",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>
                        {startAt
                          ? startAt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
                          : "—"}
                        {startAt ? ` · ${startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}` : ""}
                        {` · ${s.durationMinutes} min`}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                        background: s.status?.toLowerCase() === "completed" ? "#d4edcc" : "#edf2f6",
                        color: s.status?.toLowerCase() === "completed" ? "#2d5a24" : "#456071",
                      }}>
                        {s.status ?? "scheduled"}
                      </span>
                    </div>
                    {s.modality && (
                      <div style={{ fontSize: 11, color: "#8a96a3" }}>
                        {s.modality === "ONLINE" || s.modality === "online" ? "Online" : "In-home"}
                      </div>
                    )}
                    {s.notes && (
                      <div style={{ fontSize: 11, color: "#456071", fontStyle: "italic", padding: "5px 9px", background: "rgba(69,96,113,0.05)", borderRadius: 7, borderLeft: "2px solid rgba(69,96,113,0.2)", marginTop: 6 }}>
                        &ldquo;{s.notes}&rdquo;
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      <FeedbackButton role="parent" />
    </div>
  );
}
