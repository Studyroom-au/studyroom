"use client";

import { useRouter } from "next/navigation";

export default function SubPageHeader({
  title,
  backHref = "/hub",
  backLabel = "← Hub",
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-4" style={{ marginBottom: 24 }}>
      <div
        className="rounded-[28px] bg-white/95 backdrop-blur-md"
        style={{
          border: "1px solid rgba(69,96,113,0.15)",
          boxShadow: "0 1px 3px rgba(20,32,44,0.06), 0 8px 28px rgba(20,32,44,0.09)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 md:px-5">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#456071",
              background: "rgba(69,96,113,0.07)",
              border: "none",
              borderRadius: 20,
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
          >
            {backLabel}
          </button>
          <div
            style={{ width: 1, height: 16, background: "rgba(0,0,0,0.1)", flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1d2428",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>
        </div>
      </div>
    </header>
  );
}
