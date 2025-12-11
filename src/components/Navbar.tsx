"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/tutoring", label: "Tutoring" },
  { href: "/headstart", label: "HeadStart" },
  { href: "/worksheets", label: "Worksheets" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
];

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
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#374f5e] text-[#f8f8ff]"
          : "text-[#eaeaea] hover:bg-[#374f5e] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-[#374f5e] bg-[#456071] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        {/* Logo + tagline */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-40 flex items-center">
            <Image
              src="/logo.png"
              alt="Studyroom"
              width={160}
              height={36}
              className="h-full w-auto object-contain"
              priority
              suppressHydrationWarning
            />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(link.href)}
            />
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#f8f8ff] transition hover:bg-[#374f5e]"
          >
            Student Login
          </Link>
          <Link
            href="/contact"
            className="rounded-lg bg-[#f8f8ff] px-4 py-2 text-sm font-semibold text-[#456071] shadow-sm transition hover:bg-[#eaeaea]"
          >
            Enquire
          </Link>
        </div>

        {/* Mobile menu button */}
      <button
  type="button"
  onClick={() => setMobileOpen((v) => !v)}
  className="inline-flex items-center justify-center rounded-lg border border-white/20 px-2 py-1 text-xs font-medium text-[#f8f8ff] md:hidden"
  aria-label="Toggle navigation menu"
  aria-expanded={mobileOpen}   // ✅ keep it like this
>
  {mobileOpen ? "Close" : "Menu"}
</button>


      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-[#374f5e] bg-[#456071] md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(link.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}

            <div className="mt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#f8f8ff] ring-1 ring-white/20 transition hover:bg-[#374f5e]"
              >
                Student Login
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-[#f8f8ff] px-3 py-2 text-sm font-semibold text-[#456071] shadow-sm transition hover:bg-[#eaeaea]"
              >
                Enquire
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
