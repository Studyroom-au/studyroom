"use client";

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

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
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
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // in src/components/Navbar.tsx, inside the component:

return (
  <header className="sticky top-0 z-30 border-b border-[#374f5e] bg-[#456071] backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
      <Link href="/" className="flex items-center gap-3">
        <div className="relative h-9 w-40">
          <Image
            src="/logo.png"
            alt="Studyroom"
            fill
            className="object-contain"
            priority
          />
        </div>
        <span className="hidden text-xs font-medium text-[#d6e5e3] sm:block">
          Calm, confidence-first tutoring
        </span>
      </Link>

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

      <div className="flex items-center gap-2">
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
    </div>
  </header>
);
}
