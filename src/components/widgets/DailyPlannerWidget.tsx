"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type UpcomingItem = {
  id: string;
  subject: string;
  title: string;
  dueDate: string; // stored as "YYYY-MM-DD"
  status: string;
  notes: string;
  completed: boolean;
};

// Helpers
function parseDue(dueDate: string): Date | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPrettyDue(due: Date | null): string {
  if (!due) return "No due date";
  return due.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function describeDistance(due: Date | null): string {
  if (!due) return "";
  const today = new Date();
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueMid.getTime() - todayMid.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "In 1 day";
  if (diffDays > 1) return `In ${diffDays} days`;
  if (diffDays === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(diffDays)} days`;
}

export default function DailyPlannerWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    subject: "",
    title: "",
    dueDate: "",
    status: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

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
    const off = onSnapshot(
      q,
      (snap) => {
        const list: UpcomingItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            subject: String(data.subject || ""),
            title: String(data.title || ""),
            dueDate: String(data.dueDate || ""),
            status: String(data.status || ""),
            notes: String(data.notes || ""),
            completed: Boolean(data.completed),
          });
        });
        setItems(list);
      },
      (e) => setErr(e.message || "Failed to load items")
    );
    return () => off();
  }, [authReady]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const u = auth.currentUser;
    if (!u) {
      setErr("Please sign in to save upcoming work.");
      return;
    }
    const { subject, title, dueDate, status, notes } = newItem;
    if (!subject || !title || !dueDate) {
      setErr("Please fill in subject, what it is, and the due date.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "users", u.uid, "upcoming"), {
        subject: subject.trim(),
        title: title.trim(),
        dueDate,
        status: status.trim(),
        notes: notes.trim(),
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewItem({
        subject: "",
        title: "",
        dueDate: "",
        status: "",
        notes: "",
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(id: string, value: boolean) {
    const u = auth.currentUser;
    if (!u) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), {
      completed: value,
    });
  }

  async function removeItem(id: string) {
    const u = auth.currentUser;
    if (!u) return;
    await deleteDoc(doc(db, "users", u.uid, "upcoming", id));
  }

  const upcoming = useMemo(() => items.slice(0, 12), [items]);

  // Simple skeleton while auth is wiring up
  if (!authReady) {
    return (
      <div className="space-y-2 text-xs text-[color:var(--muted)]">
        <div className="h-8 w-full rounded-lg bg-slate-200/70" />
        <div className="h-16 w-full rounded-lg bg-slate-200/70" />
      </div>
    );
  }

  return (
    <section className="space-y-4 text-sm">
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      {/* Add new item */}
      <form
        onSubmit={addItem}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 sm:grid-cols-2"
      >
        <input
          type="text"
          placeholder="Subject (e.g. Maths)"
          value={newItem.subject}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, subject: e.target.value }))
          }
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-xs"
        />
        <input
          type="text"
          placeholder="What is it? (e.g. Algebra test)"
          value={newItem.title}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, title: e.target.value }))
          }
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-xs"
        />
        <input
          type="date"
          title="Due date"
          aria-label="Due date"
          value={newItem.dueDate}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, dueDate: e.target.value }))
          }
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-xs"
        />
        <input
          type="text"
          placeholder="Status (e.g. not started / revising)"
          value={newItem.status}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, status: e.target.value }))
          }
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-xs"
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={newItem.notes}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, notes: e.target.value }))
          }
          className="sm:col-span-2 rounded-lg border border-[color:var(--ring)] px-3 py-2 text-xs"
        />
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[color:var(--brand)] px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add to upcoming"}
          </button>
        </div>
      </form>

      {/* List */}
      <ul className="space-y-2">
        {upcoming.map((item) => {
          const dueDateObj = parseDue(item.dueDate);
          const dueLabel = formatPrettyDue(dueDateObj);
          const distance = describeDistance(dueDateObj);
          const isOverdue =
            dueDateObj && describeDistance(dueDateObj).startsWith("Overdue");
          const isToday = distance === "Due today";

          return (
            <li
              key={item.id}
              className={`flex flex-col rounded-xl border bg-[color:var(--card)] p-3 text-xs shadow-sm ${
                item.completed ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[color:var(--ink)]">
                    {item.subject || "No subject"} — {item.title || "Untitled"}
                  </div>
                  <div className="mt-0.5 text-[color:var(--muted)]">
                    {item.status && <span>Status: {item.status}. </span>}
                    {item.notes && <span>Notes: {item.notes}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-semibold text-[color:var(--ink)]">
                    {dueLabel}
                  </div>
                  {distance && (
                    <div
                      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                        item.completed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : isOverdue
                          ? "bg-red-50 text-red-700 border border-red-100"
                          : isToday
                          ? "bg-amber-50 text-amber-800 border border-amber-100"
                          : "bg-[color:var(--accent-soft)]/40 text-[color:var(--brand)] border border-[color:var(--accent-soft)]/60"
                      }`}
                    >
                      {item.completed ? "Completed" : distance}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => toggleComplete(item.id, e.target.checked)}
                    className="h-3 w-3"
                  />
                  Mark as done
                </label>
                <button
                  onClick={() => removeItem(item.id)}
                  className="ml-auto rounded-lg border border-[color:var(--ring)] px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}

        {upcoming.length === 0 && (
          <li className="rounded-xl border border-dashed border-[color:var(--ring)] px-3 py-4 text-center text-xs text-[color:var(--muted)]">
            No upcoming assessments or exams yet. Add your next due date above.
          </li>
        )}
      </ul>
    </section>
  );
}
