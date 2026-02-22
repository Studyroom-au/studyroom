// src/app/hub/admin/layout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useUserRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Must be logged in
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
    });
    return () => off();
  }, [router]);

  // Must be admin
  useEffect(() => {
    if (!mounted) return;
    if (role === null) return;
    if (role !== "admin") router.replace("/hub");
  }, [role, router, mounted]);

  const navButtonBase =
    "rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition";
  const navInactive =
    navButtonBase +
    " border border-[color:var(--ring)] bg-white text-[color:var(--brand)] hover:bg-[#d6e5e3]/40";
  const navActive =
    navButtonBase +
    " bg-[color:var(--brand)] text-[color:var(--brand-contrast)]";

  const isAdminHome = pathname === "/hub/admin";
  const isMigration = pathname === "/hub/admin/students/add-existing";

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/");
    }
  }

  const roleLabel = useMemo(() => (role === "admin" ? "Admin" : "User"), [role]);

  if (!mounted) return <div className="min-h-screen" />;
  if (role !== "admin") return <div className="min-h-screen" />;

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Admin Top Bar */}
        <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/hub" className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-xl bg-[color:var(--brand)] shadow-sm">
                <Image
                  src="/logo.png"
                  alt="Studyroom"
                  fill
                  className="object-contain p-1.5"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Studyroom
                </span>
                <span className="text-sm font-semibold text-[color:var(--ink)]">
                  Control Panel
                </span>
              </div>
            </Link>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs text-[color:var(--muted)]">
                Leads, sessions, tutor assignment, and operations.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={navInactive}
              onClick={() => router.push("/hub")}
            >
              Hub
            </button>

            <button
              type="button"
              className={isAdminHome ? navActive : navInactive}
              onClick={() => router.push("/hub/admin")}
            >
              Admin Home
            </button>
            <button
              type="button"
              className={isMigration ? navActive : navInactive}
              onClick={() => router.push("/hub/admin/students/add-existing")}
            >
              Add Existing Student
            </button>


            <span className="ml-1 inline-flex items-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
              {roleLabel}
            </span>

            <button
              type="button"
              onClick={handleSignOut}
              className="ml-1 rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] shadow-sm transition hover:bg-[#d6e5e3]/40"
            >
              Sign out
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
