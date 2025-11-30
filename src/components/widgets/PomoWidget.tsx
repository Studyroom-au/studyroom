"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type Phase = "focus" | "break";
type TimerState = "idle" | "running" | "break";

type PomoDoc = {
  state: TimerState;
  phase: Phase | null;
  targetEpochMs: number | null;
  durationMs: number | null;
  updatedAt?: unknown;
};

const DEFAULT_FOCUS_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const FOCUS_MS = DEFAULT_FOCUS_MIN * 60 * 1000;
const BREAK_MS = DEFAULT_BREAK_MIN * 60 * 1000;

export default function PomoWidget() {
  const [mounted, setMounted] = useState(false);
  const [remote, setRemote] = useState<PomoDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  // editable lengths (minutes) – used for *new* sessions
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MIN);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MIN);

  useEffect(() => setMounted(true), []);

  // tick every second
  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // Subscribe to Firestore state (users/{uid}/pomoState/state)
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const u = auth.currentUser;
        if (!u) {
          setErr("Please sign in to use the Pomodoro timer.");
          setLoading(false);
          return;
        }

        const dref = doc(db, "users", u.uid, "pomoState", "state");
        const snap = await getDoc(dref);

        if (!snap.exists()) {
          const initial: PomoDoc = {
            state: "idle",
            phase: "focus",
            targetEpochMs: null,
            durationMs: FOCUS_MS,
            updatedAt: serverTimestamp(),
          };
          await setDoc(dref, initial, { merge: true });
        }

        unsub = onSnapshot(
          dref,
          (s) => {
            const data = s.data() as PomoDoc | undefined;
            setRemote(
              data ?? {
                state: "idle",
                phase: "focus",
                targetEpochMs: null,
                durationMs: FOCUS_MS,
              }
            );
            setLoading(false);
          },
          (e) => {
            setErr(e.message || "Failed to load Pomodoro.");
            setLoading(false);
          }
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const remainingMs = useMemo(() => {
    if (!remote?.targetEpochMs) return 0;
    return Math.max(0, remote.targetEpochMs - now);
  }, [remote?.targetEpochMs, now]);

  // Auto-advance focus → break → idle
  useEffect(() => {
    if (!remote) return;
    if (remote.state === "idle") return;
    if (!remote.targetEpochMs) return;
    if (remainingMs > 0) return;

    void safeWrite((_u, dref) => {
      const focusDur = focusMinutes * 60 * 1000;
      const breakDur = breakMinutes * 60 * 1000;

      const next =
        remote.state === "running"
          ? {
              state: "break" as const,
              phase: "break" as const,
              durationMs: breakDur,
              targetEpochMs: Date.now() + breakDur,
            }
          : {
              state: "idle" as const,
              phase: "focus" as const,
              durationMs: focusDur,
              targetEpochMs: null,
            };

      return updateDoc(dref, { ...next, updatedAt: serverTimestamp() });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, focusMinutes, breakMinutes]);

  // Actions ---------------

  async function startFocus() {
    const dur = clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "running",
        phase: "focus",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function startBreak() {
    const dur = clampMinutes(breakMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "break",
        phase: "break",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      })
    );
  }

  // switch from break → fresh focus block
  async function resumeStudy() {
    const dur = clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "running",
        phase: "focus",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      })
    );
  }

  // resume paused break using remaining time
  async function resumeBreak() {
    const dur =
      remote?.durationMs ?? clampMinutes(breakMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "break",
        phase: "break",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function pause() {
    const left = Math.max(0, remainingMs);
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "idle",
        phase: remote?.phase ?? "focus",
        durationMs:
          left ||
          (remote?.phase === "break"
            ? breakMinutes * 60 * 1000
            : focusMinutes * 60 * 1000),
        targetEpochMs: null,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function reset() {
    const dur = clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "idle",
        phase: "focus",
        durationMs: dur,
        targetEpochMs: null,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function safeWrite(
    op: (
      u: NonNullable<typeof auth.currentUser>,
      dref: ReturnType<typeof doc>
    ) => Promise<unknown>
  ) {
    try {
      setErr(null);
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const dref = doc(db, "users", u.uid, "pomoState", "state");
      await op(u, dref);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function fmt(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }

  function clampMinutes(v: number) {
    if (!Number.isFinite(v)) return DEFAULT_FOCUS_MIN;
    return Math.min(180, Math.max(1, Math.round(v)));
  }

  // Derived state ---------------

  if (!mounted) return <div className="h-28" />;

  if (loading && !remote) {
    return (
      <div className="space-y-2">
        <div className="h-6 w-24 rounded bg-slate-200/70" />
        <div className="h-8 w-32 rounded bg-slate-200/70" />
      </div>
    );
  }

  const isRunningFocus = remote?.state === "running";
  const isRunningBreak = remote?.state === "break";
  const isIdle = remote?.state === "idle";
  const phase = remote?.phase ?? "focus";

  const showingMs =
    isRunningFocus || isRunningBreak
      ? remainingMs
      : remote?.durationMs ??
        (phase === "break" ? BREAK_MS : FOCUS_MS);

  // UI ---------------------------

  return (
    <div className="space-y-3">
      {/* Top row: phase pill + status */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[color:var(--muted)]">
          {phase === "break" ? "Break block" : "Focus block"}
        </span>
        <span className="text-[10px] rounded-full border border-[color:var(--ring)] px-2 py-0.5 text-[color:var(--muted)]">
          {isRunningFocus || isRunningBreak
            ? "Running"
            : "Paused"}
        </span>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}

      {/* Timer display */}
      <div className="flex items-baseline gap-3">
        <div className="text-4xl font-semibold tabular-nums tracking-tight text-[color:var(--ink)]">
          {fmt(showingMs)}
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          {phase === "break"
            ? "Short reset between blocks."
            : "Deep focus on one task."}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-1 flex flex-wrap gap-2">
        {isRunningFocus || isRunningBreak ? (
          <button
            onClick={pause}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-white"
          >
            Pause
          </button>
        ) : phase === "break" && isIdle ? (
          <button
            onClick={resumeBreak}
            className="rounded-lg bg-[color:var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--brand-600)]"
          >
            Resume break
          </button>
        ) : (
          <button
            onClick={startFocus}
            className="rounded-lg bg-[color:var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--brand-600)]"
          >
            Start focus
          </button>
        )}

        {phase === "break" || isRunningBreak ? (
          <button
            onClick={resumeStudy}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-white"
          >
            Back to focus
          </button>
        ) : (
          <button
            onClick={startBreak}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-white"
          >
            Break
          </button>
        )}

        <button
          onClick={reset}
          className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs text-[color:var(--ink)] hover:bg-white"
        >
          Reset
        </button>
      </div>

      {/* Length controls */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-[color:var(--muted)]">
            Focus length (min)
          </span>
          <input
            type="number"
            min={1}
            max={180}
            value={focusMinutes}
            onChange={(e) =>
              setFocusMinutes(Number(e.target.value) || DEFAULT_FOCUS_MIN)
            }
            className="w-full rounded-lg border border-[color:var(--ring)] bg-white px-2 py-1.5 text-xs text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-[color:var(--muted)]">
            Break length (min)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) =>
              setBreakMinutes(Number(e.target.value) || DEFAULT_BREAK_MIN)
            }
            className="w-full rounded-lg border border-[color:var(--ring)] bg-white px-2 py-1.5 text-xs text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
        </label>
      </div>
    </div>
  );
}
