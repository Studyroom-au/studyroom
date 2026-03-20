"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PortalNavItem = {
  href?: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function PortalHeader({
  navItems,
  roleLabel,
  onSignOut,
}: {
  homeHref: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  navItems: PortalNavItem[];
  roleLabel: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 mb-6 px-3 pt-3 md:px-4">
      <div
        className="rounded-[28px] bg-white/95 backdrop-blur-md"
        style={{
          border: "1px solid rgba(69, 96, 113, 0.15)",
          boxShadow:
            "0 1px 3px rgba(20, 32, 44, 0.06), 0 8px 28px rgba(20, 32, 44, 0.09)",
        }}
      >
        {/* ── Main row ── */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 md:px-5">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Studyroom"
              width={160}
              height={40}
              className="h-[36px] w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => {
              const cls = cx(
                "relative rounded-full px-3.5 py-2 text-sm transition-all duration-150",
                item.active
                  ? "bg-[color:var(--brand-50)] font-semibold text-[color:var(--brand)]"
                  : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--brand-50)]/60 hover:text-[color:var(--brand)]"
              );
              if (item.href) {
                return (
                  <Link key={item.label} href={item.href} className={cls}>
                    {item.label}
                    {item.active && (
                      <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-[color:var(--brand-soft)]" />
                    )}
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={cls}
                >
                  {item.label}
                  {item.active && (
                    <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-[color:var(--brand-soft)]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <span className="chip hidden text-xs sm:inline-flex">{roleLabel}</span>

            {/* Desktop sign out — hidden on mobile */}
            <button
              type="button"
              onClick={onSignOut}
              className="button-ghost hidden rounded-full px-3.5 py-1.5 text-xs font-semibold md:inline-flex"
            >
              Sign out
            </button>

            {/* Mobile hamburger — hidden on desktop */}
            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden"
              style={{
                fontSize: 12, fontWeight: 700, color: "#677a8a",
                background: "#f4f7f9", border: "none", borderRadius: 20,
                padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown ── */}
        {mobileOpen && (
          <div
            className="md:hidden"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 16px 14px" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              {navItems.map((item) => {
                const isActive = item.active;
                if (item.href) {
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        fontSize: 13, fontWeight: 600, padding: "9px 12px",
                        borderRadius: 10, textDecoration: "none",
                        color: isActive ? "#fff" : "#456071",
                        background: isActive ? "#456071" : "transparent",
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => { item.onClick?.(); setMobileOpen(false); }}
                    style={{
                      fontSize: 13, fontWeight: 600, padding: "9px 12px",
                      borderRadius: 10, textAlign: "left",
                      color: isActive ? "#fff" : "#456071",
                      background: isActive ? "#456071" : "transparent",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onSignOut}
              style={{
                width: "100%", fontSize: 12, fontWeight: 600,
                color: "#677a8a", background: "#f4f7f9",
                border: "none", borderRadius: 10, padding: "9px 0",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
