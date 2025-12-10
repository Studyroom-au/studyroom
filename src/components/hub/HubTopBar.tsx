"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

type HubNavTab = "hub" | "rooms" | "profile";

export default function HubTopBar({ active }: { active: HubNavTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useUserRole();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/login");
    });
    return () => off();
  }, [router]);

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/login");
    }
  }

  if (!mounted) {
    return <div className="mb-6 h-14 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)]" />;
  }

  const niceRole =
    role === "admin" ? "Admin" : role === "tutor" ? "Tutor" : "Student";

  const tabClass = (tab: HubNavTab) =>
    `rounded-xl px-3 py-1.5 text-sm font-medium transition ${
      active === tab
        ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)] shadow-sm"
        : "text-[color:var(--muted)] hover:bg-[color:var(--card)] hover:text-[color:var(--ink)]"
    }`;

  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-3 shadow-sm">
      {/* Left – logo + title */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-9 w-9 rounded-xl bg-[color:var(--brand)] shadow-sm overflow-hidden">
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
              Student Hub
            </span>
          </div>
        </Link>

        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-xs text-[color:var(--muted)]">
            A calm space to plan, focus, and check in.
          </span>
        </div>
      </div>

      {/* Middle – tabs */}
      <nav className="hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={() => router.push("/hub")}
          className={tabClass("hub")}
        >
          Hub
        </button>
        <button
          type="button"
          onClick={() => router.push("/lobby")}
          className={tabClass("rooms")}
        >
          Studyrooms
        </button>
        <button
          type="button"
          onClick={() => router.push("/hub/profile")}
          className={tabClass("profile")}
        >
          Profile
        </button>
      </nav>

      {/* Right – role pill + sign out */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1 text-xs font-medium text-[color:var(--muted)]">
          {niceRole}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm font-medium text-[color:var(--muted)] shadow-sm transition hover:bg-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
