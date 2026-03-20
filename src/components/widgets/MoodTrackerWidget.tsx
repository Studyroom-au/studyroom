"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Mood = "great" | "good" | "ok" | "tired" | "stressed";

type MoodLog = {
  id: string;
  date: string;
  mood: Mood;
  note?: string | null;
  createdAt?: Date | null;
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatPrettyDate(key: string): string {
  // key is "YYYY-MM-DD"
  const [y, m, d] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateSafe(v: unknown): Date | null {
  // @ts-expect-error tolerate Firestore Timestamp
  return v && typeof v.toDate === "function" ? v.toDate() : null;
}

const MOODS: {
  value: Mood;
  label: string;
  emoji: string;
  activeBg: string;
  activeText: string;
}[] = [
  { value: "great",    label: "Great",   emoji: "\uD83D\uDE0A", activeBg: "#bde4af", activeText: "#2d5a24" },
  { value: "good",     label: "Good",    emoji: "\uD83D\uDE42", activeBg: "#d6e5e3", activeText: "#1a3a4a" },
  { value: "ok",       label: "OK",      emoji: "\uD83D\uDE10", activeBg: "#eaeaea", activeText: "#4a4a4a" },
  { value: "tired",    label: "Tired",   emoji: "\uD83D\uDE34", activeBg: "#e5d1d0", activeText: "#5a3a38" },
  { value: "stressed", label: "Stressed",emoji: "\uD83D\uDE30", activeBg: "#f0e4d0", activeText: "#3a2810" },
];

export default function MoodTrackerWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const activeDateKey = editingId ?? todayKey;
  const todayEntry = useMemo(() => logs.find((l) => l.date === todayKey), [logs, todayKey]);

  // Derived from existing logs state — no new hooks
  const streak = useMemo(() => {
    if (logs.length === 0) return 0;
    const logSet = new Set(logs.map((l) => l.date));
    let count = 0;
    const base = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      if (logSet.has(formatDateKey(d))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [logs]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.getIdToken(true);
        } catch {
          // ignore
        }
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setLogs([]);
      }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;

    setErr(null);
    const q = query(
      collection(db, "users", u.uid, "moodLogs"),
      orderBy("date", "desc"),
      limit(30)
    );

    const off = onSnapshot(
      q,
      (snap) => {
        const rows: MoodLog[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data();
          rows.push({
            id: d.id,
            date: String(data.date || d.id),
            mood: (data.mood || "ok") as Mood,
            note: (data.note as string | null) ?? null,
            createdAt: toDateSafe(data.createdAt),
          });
        });
        setLogs(rows);
      },
      (e) => setErr(e.message || "Failed to load mood logs")
    );

    return () => off();
  }, [authReady]);

  useEffect(() => {
    const target = logs.find((l) => l.id === activeDateKey);
    if (target) {
      setSelectedMood(target.mood);
      setNote(target.note ?? "");
    } else if (!editingId) {
      setSelectedMood(null);
      setNote("");
    }
  }, [logs, activeDateKey, editingId]);

  async function saveMood(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const u = auth.currentUser;
    if (!u) {
      setErr("Please sign in to track your mood.");
      return;
    }
    if (!selectedMood) {
      setErr("Choose a mood before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: activeDateKey,
        mood: selectedMood,
        note: note.trim() || null,
        createdAt: serverTimestamp(),
      };
      const dref = doc(db, "users", u.uid, "moodLogs", activeDateKey);
      await setDoc(dref, payload, { merge: true });

      setNote("");
      setSelectedMood(null);
      setEditingId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Could not save mood");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: string) {
    setErr(null);
    const u = auth.currentUser;
    if (!u) return;
    try {
      await deleteDoc(doc(db, "users", u.uid, "moodLogs", id));
      if (editingId === id) setEditingId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Could not delete entry");
    }
  }

  function startEdit(id: string) {
    setEditingId(id);
  }

  if (!authReady) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 20, width: 96, borderRadius: 8, background: "rgba(0,0,0,0.06)" }} />
        <div style={{ height: 32, width: "100%", borderRadius: 8, background: "rgba(0,0,0,0.06)" }} />
      </div>
    );
  }

  const isEditing = Boolean(editingId);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && (
        <div style={{ borderRadius: 12, border: "1px solid #fcd34d", background: "#fffbeb", padding: "6px 10px", fontSize: 11, color: "#92400e" }}>
          {err}
        </div>
      )}

      {/* Header row: date + streak badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 10, color: "var(--sr-muted)" }}>{isEditing ? "Editing entry" : "Today"}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sr-ink)" }}>{formatPrettyDate(activeDateKey)}</span>
        </div>
        {streak > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#bde4af", color: "#2d5a24", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {"\uD83D\uDD25"} {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Today's saved entry (read mode) */}
      {todayEntry && !editingId ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f4faf0", border: "1px solid #c8e6bb", borderRadius: 12, padding: "10px 14px" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2428" }}>
              {MOODS.find(m => m.value === todayEntry.mood)?.emoji} {MOODS.find(m => m.value === todayEntry.mood)?.label}
            </div>
            {todayEntry.note && (
              <div style={{ fontSize: 11, color: "#677a8a", marginTop: 2 }}>{todayEntry.note}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => startEdit(todayKey)}
            style={{ fontSize: 11, fontWeight: 600, color: "#456071", background: "white", border: "1px solid #b8cad6", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
          >
            Edit
          </button>
        </div>
      ) : (
      <>

      {/* Mood chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MOODS.map((m) => {
          const active = selectedMood === m.value;
          return (
            <button
              key={m.value}
              type="button"
              className="mood-chip"
              onClick={() => setSelectedMood(m.value)}
              style={
                active
                  ? {
                      padding: "7px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1.5px solid " + m.activeBg,
                      background: m.activeBg,
                      color: m.activeText,
                      transition: "all 0.18s",
                    }
                  : {
                      padding: "7px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "1.5px solid rgba(0,0,0,0.08)",
                      background: "rgba(0,0,0,0.02)",
                      color: "var(--sr-muted)",
                      transition: "all 0.18s",
                    }
              }
            >
              {m.emoji} {m.label}
            </button>
          );
        })}
      </div>

      {/* Note + save */}
      <form onSubmit={saveMood} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything on your mind?"
          style={{
            width: "100%",
            border: "1.5px solid #e4eaef",
            borderRadius: 12,
            padding: "8px 11px",
            fontSize: 12,
            color: "var(--sr-ink)",
            resize: "none",
            outline: "none",
            background: "#fafbfc",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            type="submit"
            disabled={saving || !selectedMood}
            onMouseEnter={(e) => { if (!saving && selectedMood) e.currentTarget.style.background = "#374f5e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#456071"; }}
            style={{
              background: "#456071",
              color: "white",
              border: "none",
              borderRadius: 11,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: saving || !selectedMood ? 0.6 : 1,
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save today's mood"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setSelectedMood(null);
                setNote("");
              }}
              style={{ fontSize: 11, fontWeight: 500, color: "#456071", cursor: "pointer", background: "none", border: "none" }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      </> /* end today-not-logged / editing branch */
      )}

      {/* History toggle */}
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        style={{ fontSize: 11, fontWeight: 500, color: "#456071", cursor: "pointer", background: "none", border: "none", textAlign: "left", padding: 0 }}
      >
        {showHistory ? "Hide mood history" : "Show mood history"}
      </button>

      {/* History list */}
      {showHistory && (
        <div style={{ maxHeight: 200, overflowY: "auto", borderRadius: 14, border: "1px solid #e4eaef", background: "white", padding: 12 }}>
          {logs.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--sr-muted)" }}>No mood entries yet.</div>
          )}
          {logs.map((l) => {
            const meta = MOODS.find((m) => m.value === l.mood);
            return (
              <div
                key={l.id}
                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "4px 6px", borderRadius: 8 }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sr-ink)" }}>{formatPrettyDate(l.date)}</div>
                  <div style={{ fontSize: 11, color: "var(--sr-muted)" }}>
                    {meta?.emoji} {meta?.label}{l.note ? " \u2014 " + l.note : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(l.id)}
                    style={{ fontSize: 10, color: "#456071", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLog(l.id)}
                    style={{ fontSize: 10, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
