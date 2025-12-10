// src/app/admin/roles/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

export default function AdminRolesPage() {
  const router = useRouter();
  const role = useUserRole();
  const [mounted, setMounted] = useState(false);

  const [targetUid, setTargetUid] = useState("");
  const [newRole, setNewRole] = useState<"student" | "tutor" | "admin">(
    "tutor"
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  // Require auth
  useEffect(() => {
    const off = auth.onAuthStateChanged((u) => {
      if (!u) {
        router.replace("/");
      }
    });
    return () => off();
  }, [router]);

  if (!mounted) {
    return <div className="min-h-screen app-bg" />;
  }

  async function handleSetRole(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const uid = targetUid.trim();
    if (!uid) {
      setStatus("Please enter a user UID.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setStatus("You must be signed in.");
      return;
    }

    try {
      setLoading(true);
      const idToken = await user.getIdToken(true);

      const res = await fetch("/api/admin/setRole", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          targetUid: uid,
          role: newRole,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        setStatus(`Error: ${text || res.statusText}`);
        return;
      }

      setStatus(`Role for ${uid} set to "${newRole}".`);

      // Optional: if you changed your own role, refresh token
      if (user.uid === uid) {
        await user.getIdToken(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = role === "admin";

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
            Admin &amp; Tutor Roles
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Set user roles to <span className="font-semibold">student</span>,{" "}
            <span className="font-semibold">tutor</span>, or{" "}
            <span className="font-semibold">admin</span>.
          </p>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Your current app role (from Firestore):{" "}
            <span className="font-mono">
              {role ?? "(loading or none, defaults to student)"}
            </span>
          </p>
        </header>

        {!isAdmin && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You don&apos;t have an <code>admin</code> role yet. If your email is
            listed in <code>ALLOWED_ADMIN_EMAILS</code> in{" "}
            <code>/api/admin/setRole</code>, you can still use this page to set
            roles.
          </div>
        )}

        <form
          onSubmit={handleSetRole}
          className="space-y-4 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--ink)]">
              Target user UID
            </label>
            <input
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--muted)]/70"
              placeholder="Paste Firebase Auth UID"
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
            />
            <p className="text-xs text-[color:var(--muted)]">
              You can copy the UID from the{" "}
              <span className="font-mono">Authentication &gt; Users</span> page
              in the Firebase console.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="new-role" className="text-sm font-medium text-[color:var(--ink)]">
              New role
            </label>
            <select
              id="new-role"
              className="w-full rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]"
              value={newRole}
              onChange={(e) =>
                setNewRole(e.target.value as "student" | "tutor" | "admin")
              }
            >
              <option value="student">student</option>
              <option value="tutor">tutor</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="brand-cta rounded-xl px-5 py-2 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {loading ? "Saving…" : "Set Role"}
          </button>

          {status && (
            <p className="text-sm text-[color:var(--muted)] mt-2">{status}</p>
          )}
        </form>
      </div>
    </div>
  );
}
