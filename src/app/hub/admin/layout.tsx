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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

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
  const isBlog = pathname.startsWith("/hub/admin/blog");

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
        <header className="sticky top-0 z-30 mb-6 px-3 pt-3 md:px-4">
          <div
            className="rounded-[28px] bg-white/95 backdrop-blur-md"
            style={{
              border: "1px solid rgba(69, 96, 113, 0.15)",
              boxShadow:
                "0 1px 3px rgba(20, 32, 44, 0.06), 0 8px 28px rgba(20, 32, 44, 0.09)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-5">
              {/* Logo — improved style, no box around image */}
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

              <div className="flex items-center gap-2">
                {/* Desktop nav — hidden on mobile */}
                <nav className="hidden items-center gap-2 md:flex">
                  <button type="button" className={navInactive} onClick={() => router.push("/hub")}>Hub</button>
                  <button type="button" className={isAdminHome ? navActive : navInactive} onClick={() => router.push("/hub/admin")}>Admin Home</button>
                  <button type="button" className={isMigration ? navActive : navInactive} onClick={() => router.push("/hub/admin/students/add-existing")}>Add Existing Student</button>
                  <button type="button" className={isBlog ? navActive : navInactive} onClick={() => router.push("/hub/admin/blog")}>Blog</button>
                </nav>

                <span className="hidden items-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--muted)] md:inline-flex">
                  {roleLabel}
                </span>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] shadow-sm transition hover:bg-[#d6e5e3]/40 md:inline-flex"
                >
                  Sign out
                </button>

                {/* Mobile hamburger */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(v => !v)}
                  className="md:hidden"
                  style={{ fontSize: 12, fontWeight: 700, color: "#677a8a", background: "#f4f7f9", border: "none", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {mobileOpen ? "Close" : "Menu"}
                </button>
              </div>
            </div>
            {/* Mobile dropdown */}
            {mobileOpen && (
              <div className="md:hidden" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 16px 14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  {[
                    { label: "Hub", active: false, path: "/hub" },
                    { label: "Admin Home", active: isAdminHome, path: "/hub/admin" },
                    { label: "Add Existing Student", active: isMigration, path: "/hub/admin/students/add-existing" },
                    { label: "Blog", active: isBlog, path: "/hub/admin/blog" },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => router.push(item.path)}
                      style={{ fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 10, textAlign: "left", color: item.active ? "#fff" : "#456071", background: item.active ? "#456071" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{ width: "100%", fontSize: 12, fontWeight: 600, color: "#677a8a", background: "#f4f7f9", border: "none", borderRadius: 10, padding: "9px 0", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
