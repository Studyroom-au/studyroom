"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Primary destinations stay as real, always-crawlable top-level links.
// "Explore" groups the lower-priority marketing pages behind one disclosure
// so the bar stays spacious at normal desktop widths — its links remain
// real <Link> elements in the DOM at all times (only their visibility is
// toggled via CSS), so they're crawlable whether or not JS runs.
const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/tutoring", label: "Tutoring" },
  { href: "/studyroom", label: "Studyroom Hub" },
  { href: "/become-a-tutor", label: "Tutor with us" },
];

const exploreLinks = [
  { href: "/headstart", label: "HeadStart" },
  { href: "/worksheets", label: "Worksheets" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "relative rounded-full px-3.5 py-2 text-sm transition-all duration-150",
        active
          ? "bg-[color:var(--brand-50)] font-semibold text-[color:var(--brand)]"
          : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--brand-50)]/60 hover:text-[color:var(--brand)]"
      )}
    >
      {label}
      {active && (
        <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-[color:var(--brand-soft)]" />
      )}
    </Link>
  );
}

/** Desktop "Explore" disclosure — click/keyboard driven, not hover-dependent. */
function ExploreMenu({ isActive }: { isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anyActive = exploreLinks.some((l) => isActive(l.href));

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="explore-menu"
        className={cx(
          "flex items-center gap-1 rounded-full px-3.5 py-2 text-sm transition-all duration-150",
          anyActive
            ? "bg-[color:var(--brand-50)] font-semibold text-[color:var(--brand)]"
            : "font-medium text-[color:var(--ink-soft)] hover:bg-[color:var(--brand-50)]/60 hover:text-[color:var(--brand)]"
        )}
      >
        Explore
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={cx("transition-transform", open && "rotate-180")}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id="explore-menu"
        hidden={!open}
        className="absolute right-0 top-[calc(100%+8px)] z-40 w-48 rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-black/5"
      >
        {exploreLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={cx(
              "block rounded-xl px-3 py-2 text-sm transition",
              isActive(link.href)
                ? "font-semibold text-[color:var(--brand)]"
                : "text-[color:var(--ink-soft)] hover:bg-[color:var(--brand-50)]/60 hover:text-[color:var(--brand)]"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  // Every link inside the mobile panel below already closes it directly via
  // its own onClick — no separate route-change effect needed to keep it in
  // sync (that pattern was a synchronous setState-in-effect lint violation).

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-4">
      <div className="mx-auto max-w-6xl">
        {/* Navbar pill */}
        <div
          className="rounded-[28px] bg-white/95 backdrop-blur-md"
          style={{
            border: "1px solid rgba(69, 96, 113, 0.15)",
            boxShadow:
              "0 1px 3px rgba(20, 32, 44, 0.06), 0 8px 28px rgba(20, 32, 44, 0.09)",
          }}
        >
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 md:px-5">
            {/* Brand — always returns to / */}
            <Link href="/" className="flex flex-col items-start gap-0.5" aria-label="Studyroom home">
              <div>
                <Image
                  src="/logo.png"
                  alt="Studyroom"
                  width={120}
                  height={120}
                  className="h-[40px] w-[160px] object-contain"
                  priority
                  suppressHydrationWarning
                />
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
              {primaryLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  active={isActive(link.href)}
                />
              ))}
              <ExploreMenu isActive={isActive} />
            </nav>

            {/* Desktop CTA group — Enquire is the one prominent action, Log in is lower emphasis */}
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-full px-3.5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--brand)]"
              >
                Log in
              </Link>
              <Link
                href="/contact"
                className="brand-cta rounded-full px-4.5 py-2 text-sm font-semibold"
                style={{ padding: "0.5rem 1.1rem" }}
              >
                Enquire
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="button-secondary inline-flex items-center justify-center rounded-full px-3.5 py-2 text-xs font-semibold md:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
          </div>

          {/* Mobile menu — grouped so it isn't one long undifferentiated list */}
          {mobileOpen && (
            <div
              className="px-4 pb-5 pt-3 md:hidden"
              style={{ borderTop: "1px solid var(--ring-soft)" }}
            >
              <div className="flex flex-col gap-1">
                {primaryLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isActive(link.href)}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-4 mb-1 px-3.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Explore
              </div>
              <div className="flex flex-col gap-1">
                {exploreLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isActive(link.href)}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="brand-cta rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                >
                  Enquire
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="button-ghost rounded-2xl px-4 py-3 text-center text-sm font-medium"
                >
                  Log in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
