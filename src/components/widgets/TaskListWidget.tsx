"use client";

import { useEffect, useMemo, useState } from "react";
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

  return (
    <section className="space-y-3">
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* Add Task */}
      <form onSubmit={addTask} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write 1–3 things you’ll finish today…"
          className="flex-1 rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm"
          autoComplete="off"
        />

        {/* FIX: Correct brand button colouring */}
        <button
          type="submit"
          disabled={saving}
          className="
            rounded-xl 
            bg-[color:var(--brand)] 
            px-3 py-2 
            text-sm 
            font-medium 
            text-[color:var(--brand-contrast)]
            shadow-sm 
            transition 
            hover:bg-[color:var(--brand-600)] 
            disabled:opacity-60
          "
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      {/* Task List */}
      <ul className="space-y-2 text-sm">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 shadow-sm"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(t)}
                disabled={busyId === t.id}
                className="h-3 w-3"
              />
              <span
                className={
                  t.done
                    ? "line-through text-[color:var(--muted)]"
                    : "text-[color:var(--ink)]"
                }
              >
                {t.title}
              </span>
            </label>

            <button
              onClick={() => removeTask(t)}
              disabled={busyId === t.id}
              className="
                rounded-lg 
                border border-[color:var(--ring)] 
                px-2 py-1 
                text-xs 
                text-red-600 
                hover:bg-red-50 
                disabled:opacity-50
              "
            >
              Delete
            </button>
          </li>
        ))}

        {tasks.length === 0 && (
          <li className="rounded-xl border border-dashed border-[color:var(--ring)] px-3 py-4 text-center text-xs text-[color:var(--muted)]">
            No tasks yet. Add a couple of small wins for today.
          </li>
        )}
      </ul>
    </section>
  );
}
