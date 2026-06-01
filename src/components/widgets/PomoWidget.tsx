"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type Phase = "focus" | "break";
// "paused" is now an explicit state, distinct from "idle" (fresh/reset)
type TimerState = "idle" | "running" | "paused" | "break";

type PomoDoc = {
  state: TimerState;
  phase: Phase | null;
  targetEpochMs: number | null;
  // While running/break: the duration this run was started with.
  // While paused: the remaining time at the moment of pause.
  // While idle: the full duration for the next session.
  durationMs: number | null;
  // Unique ID for the current focus session — used as the pomoHistory doc ID
  // to make history writes idempotent (pause+resume+complete → same doc).
  sessionId: string | null;
  // Accumulated focus milliseconds across all pause/resume cycles in this session.
  // Updated on every pause so we always have the latest total.
  elapsedFocusMs: number | null;
  updatedAt?: unknown;
};

const DEFAULT_FOCUS_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const FOCUS_MS = DEFAULT_FOCUS_MIN * 60 * 1000;
const BREAK_MS = DEFAULT_BREAK_MIN * 60 * 1000;
// Only record a partial session if the student studied for at least this long.
const MIN_SAVE_MS = 60_000;

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PomoWidget() {
  const [mounted, setMounted] = useState(false);
  const [remote, setRemote] = useState<PomoDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MIN);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MIN);

  useEffect(() => setMounted(true), []);

  // Tick every second.
  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // Subscribe to Firestore pomoState.
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
            sessionId: null,
            elapsedFocusMs: 0,
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
                sessionId: null,
                elapsedFocusMs: 0,
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
    return () => { if (unsub) unsub(); };
  }, []);

  const remainingMs = useMemo(() => {
    if (!remote?.targetEpochMs) return 0;
    return Math.max(0, remote.targetEpochMs - now);
  }, [remote?.targetEpochMs, now]);

  // ── History write ────────────────────────────────────────────
  // Uses sessionId as the Firestore document ID so that multiple writes
  // (pause, then complete) for the same session are idempotent — the last
  // write wins, and the final completed record always takes priority.
  async function saveFocusHistory(
    uid: string,
    sessionId: string,
    elapsedMs: number,
    wasCompleted: boolean
  ) {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await setDoc(doc(db, "users", uid, "pomoHistory", sessionId), {
      date: dateStr,
      durationMs: elapsedMs,
      completedAt: serverTimestamp(),
      wasCompleted,
      source: "pomodoro",
      mode: "focus",
    });
  }

  // ── Auto-advance when timer reaches zero ─────────────────────
  useEffect(() => {
    if (!remote) return;
    // "paused" and "idle" have no running timer — nothing to auto-advance.
    if (remote.state === "idle" || remote.state === "paused") return;
    if (!remote.targetEpochMs) return;
    if (remainingMs > 0) return;

    if (remote.state === "running") {
      // Focus completed naturally — save a completed record.
      const u = auth.currentUser;
      if (u) {
        const totalElapsed = (remote.elapsedFocusMs ?? 0) + (remote.durationMs ?? FOCUS_MS);
        if (remote.sessionId) {
          void saveFocusHistory(u.uid, remote.sessionId, totalElapsed, true);
        } else {
          // Backward-compat: session was started before sessionId was introduced.
          const d = new Date();
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          void addDoc(collection(db, "users", u.uid, "pomoHistory"), {
            date: dateStr,
            durationMs: remote.durationMs ?? FOCUS_MS,
            completedAt: serverTimestamp(),
            wasCompleted: true,
            source: "pomodoro",
            mode: "focus",
          }).catch(() => {});
        }
      }
      // Transition to break.
      void safeWrite((_u, dref) => {
        const breakDur = breakMinutes * 60 * 1000;
        return updateDoc(dref, {
          state: "break" as const,
          phase: "break" as const,
          durationMs: breakDur,
          targetEpochMs: Date.now() + breakDur,
          sessionId: null,
          elapsedFocusMs: 0,
          updatedAt: serverTimestamp(),
        });
      });
    } else if (remote.state === "break") {
      // Break completed naturally — return to fresh idle.
      void safeWrite((_u, dref) => {
        const focusDur = focusMinutes * 60 * 1000;
        return updateDoc(dref, {
          state: "idle" as const,
          phase: "focus" as const,
          durationMs: focusDur,
          targetEpochMs: null,
          sessionId: null,
          elapsedFocusMs: 0,
          updatedAt: serverTimestamp(),
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, focusMinutes, breakMinutes]);

  // ── Actions ──────────────────────────────────────────────────

  // Start a brand-new focus session from idle.
  async function startFocus() {
    const dur = clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "running" as const,
        phase: "focus" as const,
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        sessionId: generateSessionId(),
        elapsedFocusMs: 0,
        updatedAt: serverTimestamp(),
      })
    );
  }

  // Resume a paused focus session — continues from remaining time, same sessionId.
  async function resumeFocus() {
    const remaining = remote?.durationMs ?? clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "running" as const,
        phase: "focus" as const,
        durationMs: remaining,
        targetEpochMs: Date.now() + remaining,
        // sessionId and elapsedFocusMs are unchanged — we're continuing the same session.
        updatedAt: serverTimestamp(),
      })
    );
  }

  // Resume a paused break — continues from remaining break time.
  async function resumeBreak() {
    const remaining = remote?.durationMs ?? clampMinutes(breakMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "break" as const,
        phase: "break" as const,
        durationMs: remaining,
        targetEpochMs: Date.now() + remaining,
        updatedAt: serverTimestamp(),
      })
    );
  }

  // Start a break. If focus was in progress, save partial history first.
  async function startBreak() {
    try {
      setErr(null);
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const dref = doc(db, "users", u.uid, "pomoState", "state");

      if (remote?.sessionId && remote.phase === "focus") {
        const elapsedMs = calcCurrentElapsed();
        if (elapsedMs >= MIN_SAVE_MS) {
          await saveFocusHistory(u.uid, remote.sessionId, elapsedMs, false);
        }
      }

      const dur = clampMinutes(breakMinutes) * 60 * 1000;
      await updateDoc(dref, {
        state: "break" as const,
        phase: "break" as const,
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        sessionId: null,
        elapsedFocusMs: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // Start a fresh focus block from break/break-paused state.
  async function backToFocus() {
    const dur = clampMinutes(focusMinutes) * 60 * 1000;
    await safeWrite((_u, dref) =>
      updateDoc(dref, {
        state: "running" as const,
        phase: "focus" as const,
        durationMs: dur,
        targetEpochMs: Date.now() + dur,
        sessionId: generateSessionId(),
        elapsedFocusMs: 0,
        updatedAt: serverTimestamp(),
      })
    );
  }

  // Pause the running timer (focus or break).
  async function pause() {
    try {
      setErr(null);
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const dref = doc(db, "users", u.uid, "pomoState", "state");
      const left = Math.max(0, remainingMs);

      if (remote?.state === "running") {
        // Accumulate elapsed time for this focus run.
        const elapsedThisRun = Math.max(0, (remote.durationMs ?? 0) - remainingMs);
        const totalElapsed = (remote.elapsedFocusMs ?? 0) + elapsedThisRun;

        // Save partial session if the student studied for a meaningful amount.
        if (totalElapsed >= MIN_SAVE_MS && remote.sessionId) {
          await saveFocusHistory(u.uid, remote.sessionId, totalElapsed, false);
        }

        await updateDoc(dref, {
          state: "paused" as const,
          phase: "focus" as const,
          durationMs: left || (remote.durationMs ?? FOCUS_MS),
          targetEpochMs: null,
          elapsedFocusMs: totalElapsed,
          updatedAt: serverTimestamp(),
        });
      } else if (remote?.state === "break") {
        // Pausing a break — no focus history to save.
        await updateDoc(dref, {
          state: "paused" as const,
          phase: "break" as const,
          durationMs: left || (remote.durationMs ?? BREAK_MS),
          targetEpochMs: null,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // Reset to fresh idle. Saves partial history if the session was meaningful.
  async function reset() {
    try {
      setErr(null);
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const dref = doc(db, "users", u.uid, "pomoState", "state");

      if (remote?.sessionId && remote.phase === "focus") {
        const elapsedMs = calcCurrentElapsed();
        if (elapsedMs >= MIN_SAVE_MS) {
          await saveFocusHistory(u.uid, remote.sessionId, elapsedMs, false);
        }
      }

      const dur = clampMinutes(focusMinutes) * 60 * 1000;
      await updateDoc(dref, {
        state: "idle" as const,
        phase: "focus" as const,
        durationMs: dur,
        targetEpochMs: null,
        sessionId: null,
        elapsedFocusMs: 0,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // Returns the total accumulated focus milliseconds for the current session,
  // including any time elapsed in the current run (not yet accumulated).
  function calcCurrentElapsed(): number {
    if (!remote) return 0;
    if (remote.state === "running") {
      const elapsedThisRun = Math.max(0, (remote.durationMs ?? 0) - remainingMs);
      return (remote.elapsedFocusMs ?? 0) + elapsedThisRun;
    }
    if (remote.state === "paused") {
      return remote.elapsedFocusMs ?? 0;
    }
    return 0;
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
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function clampMinutes(v: number) {
    if (!Number.isFinite(v)) return DEFAULT_FOCUS_MIN;
    return Math.min(180, Math.max(1, Math.round(v)));
  }

  // ── Derived state ─────────────────────────────────────────────

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
  const isPaused      = remote?.state === "paused";
  const phase         = remote?.phase ?? "focus";

  const isPausedFocus = isPaused && phase === "focus";
  const isPausedBreak = isPaused && phase === "break";
  const isActive      = isRunningFocus || isRunningBreak;

  // What the timer display shows.
  const showingMs =
    isActive
      ? remainingMs
      : remote?.durationMs ?? (phase === "break" ? BREAK_MS : FOCUS_MS);

  // Ring progress: when paused, reference the full session duration so the ring
  // correctly reflects how far through the session the student is.
  const circumference = 2 * Math.PI * 27; // r=27
  const fullSessionMs = phase === "break"
    ? clampMinutes(breakMinutes) * 60 * 1000
    : clampMinutes(focusMinutes) * 60 * 1000;
  const ringTotalMs = isActive
    ? (remote?.durationMs ?? fullSessionMs)
    : fullSessionMs;
  const progress   = ringTotalMs > 0 ? Math.max(0, Math.min(1, showingMs / ringTotalMs)) : 1;
  const dashOffset = circumference * (1 - progress);

  const statusLabel = isActive
    ? "Stay with it."
    : isPaused
    ? "Paused."
    : "Ready when you are.";

  // ── UI ────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!loading && err && (
        <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", padding: "6px 10px", fontSize: 11, color: "#b91c1c" }}>
          {err}
        </div>
      )}

      {/* Ring + time + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* SVG ring */}
        <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
          <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="34" cy="34" r="27" fill="none" stroke="#e4eaef" strokeWidth="5.5" />
            <circle
              cx="34" cy="34" r="27"
              fill="none"
              stroke={isPaused ? "#d4a017" : "#456071"}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: isPaused ? "#d4a017" : "#456071" }}>
              {phase === "break" ? "Break" : "Focus"}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--sr-ink)", letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {fmt(showingMs)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--sr-muted)", margin: "3px 0 10px" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isActive ? "#456071" : isPaused ? "#d4a017" : "#d1d5db",
              display: "inline-block",
            }} />
            <span>{statusLabel}</span>
          </div>

          {/* Control buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {/* Primary: Pause / Resume focus / Resume break / Start focus */}
            {isActive ? (
              <button type="button" onClick={pause}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Pause
              </button>
            ) : isPausedFocus ? (
              <button type="button" onClick={resumeFocus}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Resume focus
              </button>
            ) : isPausedBreak ? (
              <button type="button" onClick={resumeBreak}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Resume break
              </button>
            ) : (
              <button type="button" onClick={startFocus}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Start focus
              </button>
            )}

            {/* Secondary: Back to focus / Break */}
            {isRunningBreak || isPausedBreak ? (
              <button type="button" onClick={backToFocus}
                style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Back to focus
              </button>
            ) : (
              <button type="button" onClick={startBreak}
                style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Break
              </button>
            )}

            {/* Reset */}
            <button type="button" onClick={reset}
              style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, cursor: "pointer" }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Length controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, borderTop: "1px solid #edf0f3", paddingTop: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sr-muted)" }}>
            Focus (min)
          </span>
          <input
            type="number" min={1} max={180} value={focusMinutes}
            onChange={(e) => setFocusMinutes(Number(e.target.value) || DEFAULT_FOCUS_MIN)}
            style={{ width: "100%", border: "1px solid #e4eaef", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--sr-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sr-muted)" }}>
            Break (min)
          </span>
          <input
            type="number" min={1} max={60} value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value) || DEFAULT_BREAK_MIN)}
            style={{ width: "100%", border: "1px solid #e4eaef", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--sr-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
          />
        </label>
      </div>
    </div>
  );
}
