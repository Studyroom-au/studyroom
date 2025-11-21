"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
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

function toDateSafe(v: unknown): Date | null {
  // @ts-expect-error tolerate Firestore Timestamp
  return v && typeof v.toDate === "function" ? v.toDate() : null;
}

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "great", label: "Great", emoji: "😊" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "ok", label: "OK", emoji: "😐" },
  { value: "tired", label: "Tired", emoji: "😴" },
  { value: "stressed", label: "Stressed", emoji: "😰" },
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

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.getIdToken(true);
        } catch {}
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
      orderBy("date", "desc")
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

      // ✅ clear note field after save (visual reset)
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

  if (!authReady)
    return (
      <div className="rounded-2xl border bg-[color:var(--card)] p-4 text-sm text-[color:var(--muted)]">
        Loading mood tracker…
      </div>
    );

  return (
    <section className="space-y-3">
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      <form onSubmit={saveMood} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const active = selectedMood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelectedMood(m.value)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-[color:var(--brand)] bg-[color:var(--brand)]/10"
                    : "border-[color:var(--ring)] hover:bg-white"
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note (optional)…"
          className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={saving || !selectedMood}
          className="rounded-xl bg-[color:var(--brand)] px-4 py-2 text-sm font-medium text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save mood"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="text-xs text-[color:var(--brand)] hover:underline"
      >
        {showHistory ? "Hide History" : "Show History"}
      </button>

      {showHistory && (
        <div className="max-h-52 overflow-auto rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 text-xs">
          {logs.map((l) => (
            <div
              key={l.id}
              className="mb-2 flex items-start justify-between rounded-lg px-2 py-1 hover:bg-black/5"
            >
              <div>
                <div className="font-medium text-[color:var(--ink)]">
                  {l.date}
                </div>
                <div className="text-[color:var(--muted)]">
                  {MOODS.find((m) => m.value === l.mood)?.emoji}{" "}
                  {MOODS.find((m) => m.value === l.mood)?.label}
                  {l.note && <span> — {l.note}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => startEdit(l.id)}
                  className="text-[10px] text-[color:var(--brand)] hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteLog(l.id)}
                  className="text-[10px] text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center text-[color:var(--muted)]">
              No mood entries yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
