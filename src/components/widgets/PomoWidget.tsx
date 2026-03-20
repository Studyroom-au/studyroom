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

    // Record completed focus session to pomoHistory
    if (remote.state === "running") {
      const u = auth.currentUser;
      if (u) {
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        addDoc(collection(db, "users", u.uid, "pomoHistory"), {
          date: dateStr,
          durationMs: remote.durationMs ?? FOCUS_MS,
          completedAt: serverTimestamp(),
        }).catch(() => { /* ignore write errors */ });
      }
    }

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

  // Ring progress calculation
  const circumference = 2 * Math.PI * 27; // r=27
  const totalMs = remote?.durationMs ?? (phase === "break" ? BREAK_MS : FOCUS_MS);
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, showingMs / totalMs)) : 1;
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!loading && err && (
        <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", padding: "6px 10px", fontSize: 11, color: "#b91c1c" }}>
          {err}
        </div>
      )}

      {/* Ring + time side by side */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* SVG ring */}
        <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
          <svg
            width="68"
            height="68"
            viewBox="0 0 68 68"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle cx="34" cy="34" r="27" fill="none" stroke="#e4eaef" strokeWidth="5.5" />
            <circle
              cx="34" cy="34" r="27"
              fill="none"
              stroke="#456071"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#456071" }}>
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
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: (isRunningFocus || isRunningBreak) ? "#456071" : "#d1d5db", display: "inline-block" }} />
            <span>{(isRunningFocus || isRunningBreak) ? "Stay with it." : "Ready when you are."}</span>
          </div>

          {/* Control buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {/* Primary action */}
            {isRunningFocus || isRunningBreak ? (
              <button
                type="button"
                onClick={pause}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Pause
              </button>
            ) : phase === "break" && isIdle ? (
              <button
                type="button"
                onClick={resumeBreak}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Resume break
              </button>
            ) : (
              <button
                type="button"
                onClick={startFocus}
                style={{ background: "#456071", color: "white", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Start focus
              </button>
            )}

            {/* Break / Back to focus */}
            {phase === "break" || isRunningBreak ? (
              <button
                type="button"
                onClick={resumeStudy}
                style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Back to focus
              </button>
            ) : (
              <button
                type="button"
                onClick={startBreak}
                style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Break
              </button>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={reset}
              style={{ background: "#f0f2f5", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, cursor: "pointer" }}
            >
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
            type="number"
            min={1}
            max={180}
            value={focusMinutes}
            onChange={(e) => setFocusMinutes(Number(e.target.value) || DEFAULT_FOCUS_MIN)}
            style={{ width: "100%", border: "1px solid #e4eaef", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--sr-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sr-muted)" }}>
            Break (min)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value) || DEFAULT_BREAK_MIN)}
            style={{ width: "100%", border: "1px solid #e4eaef", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "var(--sr-ink)", background: "white", outline: "none", boxSizing: "border-box" }}
          />
        </label>
      </div>
    </div>
  );
}
