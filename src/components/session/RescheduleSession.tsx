"use client";

import { useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(d: Date) {
  // yyyy-MM-ddTHH:mm (local)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60000);
}

export default function RescheduleSession({
  sessionId,
  currentStart,
  currentEnd,
  onDone,
}: {
  sessionId: string;
  currentStart: Date;
  currentEnd: Date;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [startStr, setStartStr] = useState(() => toLocalInputValue(currentStart));
  const [duration, setDuration] = useState<number>(() => {
    const mins = Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000));
    return mins;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const endPreview = useMemo(() => {
    const start = new Date(startStr);
    if (Number.isNaN(start.getTime())) return null;
    return addMinutes(start, duration);
  }, [startStr, duration]);

  async function save() {
    setMsg(null);
    setBusy(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      const start = new Date(startStr);
      if (Number.isNaN(start.getTime())) throw new Error("Invalid start time.");

      const end = addMinutes(start, duration);

      const idToken = await user.getIdToken();
      const res = await fetch("/api/sessions/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          sessionId,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json?.code === "SESSION_OVERLAP") throw new Error("That overlaps another session.");
        throw new Error(json?.error || "Reschedule failed.");
      }

      setOpen(false);
      setMsg("Rescheduled ✅");
      onDone?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Reschedule failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-[color:var(--muted)]">Reschedule</div>
          <div className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
            {currentStart.toLocaleString()} → {currentEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStartStr(toLocalInputValue(currentStart));
            setDuration(Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000)));
            setMsg(null);
            setOpen((v) => !v);
          }}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
        >
          {open ? "Close" : "Reschedule session"}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-[color:var(--muted)]">Start</label>
            <input
              type="datetime-local"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]"
              placeholder="Select start date and time"
            />
          </div>

          <div>
            <label htmlFor="duration-select" className="text-xs font-semibold text-[color:var(--muted)]">Duration</label>
            <select
              id="duration-select"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm outline-none"
            >
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>

            {endPreview && (
              <span className="text-xs text-[color:var(--muted)]">
                Ends: {endPreview.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}

            {msg && <span className="text-xs text-[color:var(--muted)]">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
