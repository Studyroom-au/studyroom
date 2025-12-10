"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };

type WhiteboardDoc = {
  strokes?: Stroke[];
  lastClearedAt?: unknown;
  updatedAt?: unknown;
};

const MAX_STROKES = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function RoomWhiteboard({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(2);
  const [mode, setMode] = useState<"pen" | "erase">("pen");
  const [err, setErr] = useState<string | null>(null);

  // Resize canvas to fit container
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        redraw(ctx, strokes);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load strokes + auto-clear if older than 24h
  useEffect(() => {
    (async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;

        const ref = doc(db, "rooms", roomId, "whiteboard", "state");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as WhiteboardDoc;
        // @ts-expect-error Firestore Timestamp
        const lastCleared = data.lastClearedAt?.toDate?.() as
          | Date
          | undefined;

        const now = Date.now();
        if (lastCleared && now - lastCleared.getTime() > DAY_MS) {
          // too old → clear in Firestore as well
          await updateDoc(ref, {
            strokes: [],
            lastClearedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setStrokes([]);
        } else if (Array.isArray(data.strokes)) {
          setStrokes(data.strokes.slice(-MAX_STROKES));
        }
      } catch (e) {
        setErr(
          e instanceof Error ? e.message : "Failed to load whiteboard state."
        );
      }
    })();
  }, [roomId]);

  // Draw whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    redraw(ctx, strokes);
  }, [strokes]);

  function redraw(ctx: CanvasRenderingContext2D, all: Stroke[]) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of all) {
      if (!s.points.length) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  }

  function canvasPoint(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleDown(
    e: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ): void {
    e.preventDefault();
    const pt = canvasPoint(e);
    if (mode === "erase") {
      eraseAt(pt);
      return;
    }

    const stroke: Stroke = {
      color,
      width,
      points: [pt],
    };
    setCurrentStroke(stroke);
    setDrawing(true);
  }

  function handleMove(
    e: React.MouseEvent<HTMLCanvasElement, MouseEvent>
  ): void {
    if (!drawing || !currentStroke) return;
    const pt = canvasPoint(e);
    setCurrentStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, pt] } : prev
    );
  }

  function handleUp(): void {
    if (!drawing || !currentStroke) {
      setDrawing(false);
      return;
    }
    const finalStroke = currentStroke;
    setDrawing(false);
    setCurrentStroke(null);

    const next = [...strokes, finalStroke].slice(-MAX_STROKES);
    setStrokes(next);
    void persist(next);
  }

  function eraseAt(pt: Point) {
    const radius = 12;
    const next = strokes.filter((s) =>
      s.points.every(
        (p) => (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2 > radius * radius
      )
    );
    setStrokes(next);
    void persist(next);
  }

  async function persist(next: Stroke[]) {
    try {
      const u = auth.currentUser;
      if (!u) return;
      const ref = doc(db, "rooms", roomId, "whiteboard", "state");
      await setDoc(
        ref,
        {
          strokes: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Failed to save whiteboard strokes."
      );
    }
  }

  async function clearBoard() {
    setStrokes([]);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const ref = doc(db, "rooms", roomId, "whiteboard", "state");
      await setDoc(
        ref,
        {
          strokes: [],
          lastClearedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Failed to clear whiteboard in cloud."
      );
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[color:var(--ink)]">
          Shared Whiteboard
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("pen")}
            className={`rounded-md px-2 py-1 text-xs ${
              mode === "pen"
                ? "bg-[color:var(--brand)] text-white"
                : "border border-[color:var(--ring)] bg-[color:var(--card)] text-[color:var(--ink)]"
            }`}
          >
            Pen
          </button>
          <button
            type="button"
            onClick={() => setMode("erase")}
            className={`rounded-md px-2 py-1 text-xs ${
              mode === "erase"
                ? "bg-[color:var(--brand)] text-white"
                : "border border-[color:var(--ring)] bg-[color:var(--card)] text-[color:var(--ink)]"
            }`}
          >
            Erase
          </button>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setColor("#111827")}
            className="h-5 w-5 rounded-full border border-slate-300 bg-[#111827]"
            aria-label="Black"
          />
          <button
            type="button"
            onClick={() => setColor("#ef4444")}
            className="h-5 w-5 rounded-full border border-slate-300 bg-[#ef4444]"
            aria-label="Red"
          />
          <button
            type="button"
            onClick={() => setColor("#22c55e")}
            className="h-5 w-5 rounded-full border border-slate-300 bg-[#22c55e]"
            aria-label="Green"
          />
          <button
            type="button"
            onClick={() => setColor("#3b82f6")}
            className="h-5 w-5 rounded-full border border-slate-300 bg-[#3b82f6]"
            aria-label="Blue"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border border-slate-300 bg-white"
            aria-label="Custom colour"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <label className="flex items-center gap-1">
            <span>Width</span>
            <input
              type="range"
              min={1}
              max={8}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={clearBoard}
          className="ml-auto rounded-md border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1 text-xs text-[color:var(--ink)] hover:bg-white"
        >
          Clear
        </button>
      </div>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      <div ref={containerRef} className="h-56 w-full rounded-lg border border-[color:var(--ring)] bg-white">
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair"
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
        />
      </div>

      <p className="text-[10px] text-[color:var(--muted)]">
        Whiteboard is shared within this room and is automatically cleared if not
        reset for 24 hours.
      </p>
    </div>
  );
}
