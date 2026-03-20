"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Task = {
  id: string;
  title: string;
  done: boolean;
  source?: string;
};

export default function TaskListWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.getIdToken(true);
        } catch {}
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setTasks([]);
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
      collection(db, "users", u.uid, "tasks"),
      orderBy("createdAt", "desc")
    );

    const off = onSnapshot(
      q,
      (snap) => {
        const rows: Task[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data();
          rows.push({
            id: d.id,
            title: String(data.title || ""),
            done: Boolean(data.done),
            source: data.source ? String(data.source) : undefined,
          });
        });
        setTasks(rows);
      },
      (e) => setErr(e.message || "Failed to load tasks")
    );

    return () => off();
  }, [authReady]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const title = text.trim();
    if (!title) return;

    const u = auth.currentUser;
    if (!u) {
      setErr("Please sign in to add tasks.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "users", u.uid, "tasks"), {
        title,
        done: false,
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Could not add task");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(t: Task) {
    setErr(null);
    const u = auth.currentUser;
    if (!u) return;
    setBusyId(t.id);
    try {
      await updateDoc(doc(db, "users", u.uid, "tasks", t.id), { done: !t.done });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Could not update task");
    } finally {
      setBusyId(null);
    }
  }

  async function removeTask(t: Task) {
    setErr(null);
    const u = auth.currentUser;
    if (!u) return;
    setBusyId(t.id);
    try {
      await deleteDoc(doc(db, "users", u.uid, "tasks", t.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg || "Could not delete task");
    } finally {
      setBusyId(null);
    }
  }

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && (
        <div style={{ borderRadius: 12, border: "1px solid #fcd34d", background: "#fffbeb", padding: "6px 10px", fontSize: 11, color: "#92400e" }}>
          {err}
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={addTask} style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task for today…"
          autoComplete="off"
          style={{ flex: 1, border: "1.5px solid #e4eaef", borderRadius: 12, padding: "8px 12px", fontSize: 12, color: "var(--sr-ink)", background: "white", outline: "none" }}
        />
        <button
          type="submit"
          disabled={saving}
          style={{ background: "#456071", color: "white", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "…" : "Add"}
        </button>
      </form>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sr-muted)" }}>Progress</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sr-muted)" }}>{done} / {total} done</span>
          </div>
          <div style={{ height: 4, background: "#edf0f3", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 20, background: done === total ? "#82977e" : "#456071", width: `${pct}%`, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Task list */}
      <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
        {tasks.map((t) => (
          <li
            key={t.id}
            className="task-row"
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 11, border: `1px solid ${t.done ? "#c8e6bb" : "rgba(0,0,0,0.06)"}`, background: t.done ? "#f4faf0" : "white", transition: "all 0.18s", position: "relative" }}
          >
            {/* Custom checkbox — 44px tap target, 17px visual */}
            <button
              type="button"
              onClick={() => toggleTask(t)}
              disabled={busyId === t.id}
              style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, margin: -13 }}
            >
              <span
                className={t.done ? "task-cb-done" : ""}
                style={{ width: 17, height: 17, borderRadius: "50%", border: `2px solid ${t.done ? "#82977e" : "rgba(0,0,0,0.14)"}`, background: t.done ? "#82977e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", flexShrink: 0 }}
              >
                {t.done && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>

            {/* Title */}
            <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4, color: t.done ? "var(--sr-muted)" : "var(--sr-ink)", textDecoration: t.done ? "line-through" : "none", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              {t.title}
              {t.source === "tutor_assigned" && (
                <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#d6e5e3", color: "#1a3a4a", marginLeft: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
                  From tutor
                </span>
              )}
            </span>

            {/* Delete */}
            <button
              type="button"
              onClick={() => removeTask(t)}
              disabled={busyId === t.id}
              className="task-delete"
              style={{ fontSize: 11, color: "var(--sr-muted)", padding: "2px 6px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", opacity: busyId === t.id ? 0.3 : 0, transition: "all 0.15s" }}
            >
              ✕
            </button>
          </li>
        ))}

        {tasks.length === 0 && (
          <li style={{ border: "1.5px dashed #e4eaef", borderRadius: 11, padding: 16, textAlign: "center", fontSize: 11, color: "var(--sr-muted)" }}>
            No tasks yet. Add a couple of small wins for today.
          </li>
        )}
      </ul>

      <style>{`
        .task-row:hover .task-delete { opacity: 1 !important; }
        .task-delete:hover { background: #fee2e2 !important; color: #dc2626 !important; }
        .task-cb-done { animation: sr-check-pulse 0.28s ease; }
        @keyframes sr-check-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
      `}</style>
    </section>
  );
}
