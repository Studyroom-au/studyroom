"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Phase = "study" | "break" | "longbreak";

/**
 * Pomodoro that repeats: [Study, Short, Study, Short, Study, Short, Study, Long].
 * Defaults: Study 25m, Short 5m, Long 60m. Students can edit minutes.
 * Controls: Start cycle, Stop, Start/Restart Study, Start/Restart Break.
 * Accurate (wall-clock) ticking, beep + red flash on phase change.
 */
export default function PomodoroBar() {
  // Editable minutes
  const [studyMin, setStudyMin] = useState<number>(25);
  const [shortMin, setShortMin] = useState<number>(5);
  const [longMin, setLongMin] = useState<number>(60);

  // Current phase within the 8-step cycle
  // Index 0..7: 0 S, 1 B, 2 S, 3 B, 4 S, 5 B, 6 S, 7 LongB
  const [cycleIx, setCycleIx] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("study");

  // Running state & timing anchors
  const [running, setRunning] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(studyMin * 60);
  const [startedAtMs, setStartedAtMs] = useState<number>(Date.now());
  const [remainSec, setRemainSec] = useState<number>(studyMin * 60);

  const [flash, setFlash] = useState<boolean>(false);

  // refs for timers
  const timeoutRef = useRef<number | null>(null);

  // Build durations array from the editable values
  const cycleDurationsSec = useMemo(() => {
    const s = Math.max(1, Math.round(studyMin) * 60);
    const b = Math.max(1, Math.round(shortMin) * 60);
    const L = Math.max(1, Math.round(longMin) * 60);
    return [s, b, s, b, s, b, s, L];
  }, [studyMin, shortMin, longMin]);

  const ixToPhase = useCallback((ix: number): Phase => {
    if (ix === 1 || ix === 3 || ix === 5) return "break";
    if (ix === 7) return "longbreak";
    return "study";
  }, []);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const playAlarm = useCallback(() => {
  const audio = new Audio("/alarm.mp3");
  audio.play().catch(() => {
    const AC =
      window.AudioContext ??
      window.webkitAudioContext;

    if (!AC) return; // no audio context available

    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 300);
  });
}, []);


  const flashRed = useCallback(() => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 600);
  }, []);

  /** Advance to next step in the 8-step cycle and re-anchor timing */
  const advance = useCallback(() => {
    const nextIx = (cycleIx + 1) % 8;
    const nextPhase = ixToPhase(nextIx);
    const d = cycleDurationsSec[nextIx];

    setCycleIx(nextIx);
    setPhase(nextPhase);
    setDurationSec(d);
    setStartedAtMs(Date.now());
    setRemainSec(d);

    playAlarm();
    flashRed();
  }, [cycleIx, cycleDurationsSec, ixToPhase, playAlarm, flashRed]);

  /** Handle end of the current phase */
  const handlePhaseEnd = useCallback(() => {
    advance();
  }, [advance]);

  /** Start a specific index in the cycle */
  const startIndex = useCallback(
    (ix: number) => {
      const d = cycleDurationsSec[ix];
      setCycleIx(ix);
      setPhase(ixToPhase(ix));
      setDurationSec(d);
      setStartedAtMs(Date.now());
      setRemainSec(d);
      setRunning(true);
    },
    [cycleDurationsSec, ixToPhase]
  );

  /** Controls */
  const startCycle = useCallback(() => startIndex(0), [startIndex]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const startStudy = useCallback(() => {
    const nextStudyIx = [0, 2, 4, 6].find((ix) => ix >= cycleIx) ?? 0;
    startIndex(nextStudyIx);
  }, [cycleIx, startIndex]);

  const startBreak = useCallback(() => {
    const nextBreakIx = [1, 3, 5, 7].find((ix) => ix >= cycleIx) ?? 1;
    startIndex(nextBreakIx);
  }, [cycleIx, startIndex]);

  const restartCurrent = useCallback(() => startIndex(cycleIx), [cycleIx, startIndex]);

  /** Wall-clock aligned tick (accurate seconds, no drift). */
  const tick = useCallback(() => {
    const now = Date.now();
    const elapsedSec = Math.floor((now - startedAtMs) / 1000);
    const remaining = Math.max(0, durationSec - elapsedSec);
    setRemainSec(remaining);

    if (remaining === 0) {
      handlePhaseEnd();
      return;
    }

    // align next call to the next second boundary
    const nextDelay = 1000 - ((now - startedAtMs) % 1000);
    timeoutRef.current = window.setTimeout(() => {
      if (!running) return;
      tick();
    }, nextDelay);
  }, [durationSec, startedAtMs, handlePhaseEnd, running]);

  // Manage ticking on/off and when anchors change
  useEffect(() => {
    if (!running) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      return;
    }
    tick();
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [running, tick]);

  // If user edits minutes while stopped, reflect new duration immediately
  useEffect(() => {
    if (!running) {
      const d = cycleDurationsSec[cycleIx];
      setDurationSec(d);
      setRemainSec(d);
    }
  }, [cycleDurationsSec, cycleIx, running]);

  const mins = Math.floor(remainSec / 60);
  const secs = remainSec % 60;

  return (
    <section
      className={[
        "rounded-xl border p-3 text-sm transition-colors",
        flash ? "bg-red-100" : "bg-white",
      ].join(" ")}
      aria-live="polite"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="font-medium">
          {phase === "study" && "Study"}
          {phase === "break" && "Short break"}
          {phase === "longbreak" && "Long break"}
          <span className="ml-2 text-xs text-neutral-500">Step {cycleIx + 1} / 8</span>
        </div>
        <div
          className={[
            "rounded-md px-2 py-1 font-mono",
            flash ? "bg-red-600 text-white" : "bg-black text-white",
          ].join(" ")}
          aria-label="Time remaining"
        >
          {pad(mins)}:{pad(secs)}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startCycle}
          className="rounded-lg border px-3 py-1 hover:bg-black/5"
          title="Start full cycle"
        >
          Start cycle
        </button>
        <button
          type="button"
          onClick={stop}
          className="rounded-lg border px-3 py-1 hover:bg-black/5"
          title="Stop / pause"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={startStudy}
          className="rounded-lg border px-3 py-1 hover:bg-black/5"
          title="Start or restart a study block"
        >
          Start/Restart study
        </button>
        <button
          type="button"
          onClick={startBreak}
          className="rounded-lg border px-3 py-1 hover:bg-black/5"
          title="Start or restart a break"
        >
          Start/Restart break
        </button>
        <button
          type="button"
          onClick={restartCurrent}
          className="rounded-lg border px-3 py-1 hover:bg-black/5"
          title="Restart current phase"
        >
          Restart current
        </button>

        <span className="ml-auto text-xs text-neutral-600">
          {running ? "Running" : "Stopped"}
        </span>
      </div>

      {/* Editors */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="studyMin" className="mb-1 block text-xs text-neutral-600">
            Study minutes
          </label>
          <input
            id="studyMin"
            type="number"
            min={1}
            max={240}
            value={studyMin}
            onChange={(e) => setStudyMin(Number(e.target.value || 0))}
            className="w-full rounded-lg border px-2 py-1"
            inputMode="numeric"
            aria-describedby="studyHelp"
          />
          <div id="studyHelp" className="mt-1 text-[11px] text-neutral-500">
            Used for each study block (steps 1, 3, 5, 7).
          </div>
        </div>

        <div>
          <label htmlFor="shortMin" className="mb-1 block text-xs text-neutral-600">
            Short break minutes
          </label>
          <input
            id="shortMin"
            type="number"
            min={1}
            max={120}
            value={shortMin}
            onChange={(e) => setShortMin(Number(e.target.value || 0))}
            className="w-full rounded-lg border px-2 py-1"
            inputMode="numeric"
            aria-describedby="shortHelp"
          />
          <div id="shortHelp" className="mt-1 text-[11px] text-neutral-500">
            Breaks after the first three study blocks (steps 2, 4, 6).
          </div>
        </div>

        <div>
          <label htmlFor="longMin" className="mb-1 block text-xs text-neutral-600">
            Long break minutes
          </label>
          <input
            id="longMin"
            type="number"
            min={1}
            max={240}
            value={longMin}
            onChange={(e) => setLongMin(Number(e.target.value || 0))}
            className="w-full rounded-lg border px-2 py-1"
            inputMode="numeric"
            aria-describedby="longHelp"
          />
          <div id="longHelp" className="mt-1 text-[11px] text-neutral-500">
            Break after the fourth study block (step 8).
          </div>
        </div>
      </div>
    </section>
  );
}
