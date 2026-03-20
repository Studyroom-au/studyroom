/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/tutoring", label: "Tutoring" },
  { href: "/headstart", label: "HeadStart" },
  { href: "/worksheets", label: "Worksheets" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
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

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
            {/* Brand */}
            <Link href="/" className="flex flex-col items-start gap-0.5">
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
            <nav className="hidden items-center gap-0.5 md:flex">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  active={isActive(link.href)}
                />
              ))}
            </nav>

            {/* Desktop CTA group */}
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="rounded-full px-3.5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--brand)]"
              >
                Log in
              </Link>
              <Link
                href="/contact"
                className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
              >
                Enquire
              </Link>
              <Link
                href="/enrol"
                className="brand-cta rounded-full px-4.5 py-2 text-sm font-semibold"
                style={{ padding: "0.5rem 1.1rem" }}
              >
                Enrol now
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

          {/* Mobile menu */}
          {mobileOpen && (
            <div
              className="px-4 pb-5 pt-3 md:hidden"
              style={{ borderTop: "1px solid var(--ring-soft)" }}
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
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
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="button-ghost rounded-2xl px-4 py-3 text-center text-sm font-medium"
                >
                  Log in
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="button-secondary rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                >
                  Enquire
                </Link>
                <Link
                  href="/enrol"
                  onClick={() => setMobileOpen(false)}
                  className="brand-cta rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                >
                  Enrol now
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
