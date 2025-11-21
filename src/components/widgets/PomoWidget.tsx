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

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;

export default function PomoWidget() {
  const [mounted, setMounted] = useState(false);
  const [remote, setRemote] = useState<PomoDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

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
          // Create minimal, rules-safe doc. Use merge to avoid conflicts.
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

    if (remainingMs <= 0) {
      void safeWrite((_u, dref) => {
        const next =
          remote.state === "running"
            ? {
                state: "break" as const,
                phase: "break" as const,
                durationMs: BREAK_MS,
                targetEpochMs: Date.now() + BREAK_MS,
              }
            : {
                state: "idle" as const,
                phase: "focus" as const,
                durationMs: FOCUS_MS,
                targetEpochMs: null,
              };
        return updateDoc(dref, { ...next, updatedAt: serverTimestamp() });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs]);

  // Actions (ONLY write allowed keys so rules pass)
  async function startFocus() {
    await safeWrite((_u, dref) => {
      const dur = remote?.durationMs ?? FOCUS_MS;
      return updateDoc(dref, {
        state: "running",
        phase: "focus",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function startBreak() {
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "break",
        phase: "break",
        durationMs: BREAK_MS,
        targetEpochMs: Date.now() + BREAK_MS,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function resumeStudy() {
    await safeWrite((_u, dref) => {
      const dur = FOCUS_MS;
      return updateDoc(dref, {
        state: "running",
        phase: "focus",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function resumeBreak() {
    await safeWrite((_u, dref) => {
      const dur = remote?.durationMs ?? BREAK_MS;
      return updateDoc(dref, {
        state: "break",
        phase: "break",
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async function pause() {
    const left = Math.max(0, remainingMs);
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "idle",
        phase: remote?.phase ?? "focus",
        durationMs: left || (remote?.phase === "break" ? BREAK_MS : FOCUS_MS),
        targetEpochMs: null,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function reset() {
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "idle",
        phase: "focus",
        durationMs: FOCUS_MS,
        targetEpochMs: null,
        updatedAt: serverTimestamp(),
      })
    );
  }

  async function safeWrite(
    op: (u: NonNullable<typeof auth.currentUser>, dref: ReturnType<typeof doc>) => Promise<unknown>
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
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Skeleton to avoid layout shift
  if (!mounted) return <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 h-36" />;
  if (loading && !remote) {
    return (
      <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4">
        <h3 className="mb-2 font-semibold text-[color:var(--ink)]">Pomodoro</h3>
        <div className="text-sm text-[color:var(--muted)]">Loading…</div>
      </section>
    );
  }

  const isRunningFocus = remote?.state === "running";
  const isRunningBreak = remote?.state === "break";
  const isIdle = remote?.state === "idle";
  const phase = remote?.phase ?? "focus";

  const showingMs =
    isRunningFocus || isRunningBreak
      ? remainingMs
      : remote?.durationMs ?? (phase === "break" ? BREAK_MS : FOCUS_MS);

  return (
    <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[color:var(--ink)]">Pomodoro</h3>
        <span className="text-xs rounded-full border border-[color:var(--ring)] px-2 py-0.5 text-[color:var(--muted)]">
          {isRunningBreak || phase === "break" ? "Break" : "Focus"}
        </span>
      </header>

      {err && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {isRunningFocus || isRunningBreak ? `Time left ${fmt(showingMs)}` : "Paused"}
      </div>

      <div className="flex items-baseline gap-3">
        <div className="text-4xl font-semibold tabular-nums tracking-tight text-[color:var(--ink)]">
          {fmt(showingMs)}
        </div>
        <div className="text-sm text-[color:var(--muted)]">
          {isRunningFocus || isRunningBreak ? "Ticking…" : "Paused"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(isRunningFocus || isRunningBreak) ? (
          <button
            onClick={pause}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-white"
          >
            Pause
          </button>
        ) : phase === "break" ? (
          <button
            onClick={resumeBreak}
            className="rounded-lg bg-[color:var(--brand)] px-3 py-2 text-sm font-medium text-[color:var(--brand-contrast)] hover:bg-[color:var(--brand-600)]"
          >
            Resume Break
          </button>
        ) : (
          <button
            onClick={startFocus}
            className="rounded-lg bg-[color:var(--brand)] px-3 py-2 text-sm font-medium text-[color:var(--brand-contrast)] hover:bg-[color:var(--brand-600)]"
          >
            Start Focus
          </button>
        )}

        {isRunningBreak ? (
          <button
            onClick={resumeStudy}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-white"
          >
            Resume Study
          </button>
        ) : phase === "break" && isIdle ? (
          <button
            onClick={resumeStudy}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-white"
          >
            Resume Study
          </button>
        ) : (
          <button
            onClick={startBreak}
            className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-white"
          >
            Break 5:00
          </button>
        )}

        <button
          onClick={reset}
          className="rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-white"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
