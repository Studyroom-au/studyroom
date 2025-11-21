"use client";

import { useEffect, useState } from "react";
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
  dueDate: string;
  status: string;
  notes: string;
  completed: boolean;
};

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
        } catch {}
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
    if (!u) return;
    const { subject, title, dueDate, status, notes } = newItem;
    if (!subject || !title || !dueDate) {
      setErr("Please fill in Subject, Title, and Due Date.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "users", u.uid, "upcoming"), {
        subject,
        title,
        dueDate,
        status,
        notes,
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewItem({ subject: "", title: "", dueDate: "", status: "", notes: "" });
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

  return (
    <section className="space-y-4">
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      <form
        onSubmit={addItem}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3"
      >
        <input
          type="text"
          placeholder="Subject"
          value={newItem.subject}
          onChange={(e) =>
            setNewItem((x) => ({ ...x, subject: e.target.value }))
          }
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Assessment / Exam Title"
          value={newItem.title}
          onChange={(e) => setNewItem((x) => ({ ...x, title: e.target.value }))}
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          type="date"
          placeholder="Due Date"
          title="Due Date"
          aria-label="Due Date"
          value={newItem.dueDate}
          onChange={(e) => setNewItem((x) => ({ ...x, dueDate: e.target.value }))}
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Status (e.g. studying, submitted)"
          value={newItem.status}
          onChange={(e) => setNewItem((x) => ({ ...x, status: e.target.value }))}
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-sm sm:col-span-2 md:col-span-1"
        />
        <input
          type="text"
          placeholder="Notes"
          value={newItem.notes}
          onChange={(e) => setNewItem((x) => ({ ...x, notes: e.target.value }))}
          className="rounded-lg border border-[color:var(--ring)] px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[color:var(--brand)] px-4 py-2 text-sm font-medium text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </form>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-sm shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-[color:var(--ink)]">
                {item.subject} — {item.title}
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Due: {item.dueDate}
              </div>
            </div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              {item.status && <span>Status: {item.status}. </span>}
              {item.notes && <span>Notes: {item.notes}</span>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-[color:var(--muted)]">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(e) => toggleComplete(item.id, e.target.checked)}
                />
                Completed
              </label>
              <button
                onClick={() => removeItem(item.id)}
                className="ml-auto rounded-lg border border-[color:var(--ring)] px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}

        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-[color:var(--ring)] px-3 py-4 text-center text-xs text-[color:var(--muted)]">
            No upcoming items yet.
          </li>
        )}
      </ul>
    </section>
  );
}
