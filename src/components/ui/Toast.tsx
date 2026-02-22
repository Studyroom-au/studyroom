"use client";

import { useEffect } from "react";

export type ToastKind = "info" | "success" | "warning" | "error";

export default function Toast({
  open,
  message,
  kind = "info",
  onClose,
  durationMs = 3500,
}: {
  open: boolean;
  message: string;
  kind?: ToastKind;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  const tone =
    kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : kind === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : kind === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-[color:var(--ring)] bg-white text-[color:var(--ink)]";

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[min(520px,calc(100vw-32px))] -translate-x-1/2">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${tone}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold">{message}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-bold opacity-70 hover:opacity-100"
            aria-label="Close toast"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
