// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUserRole } from "@/hooks/useUserRole";

type RoleType = "student" | "tutor" | "admin";

type AdminUser = {
  uid: string;
  email: string;
  displayName?: string;
  accountType?: string;
  parentEmail?: string;
  createdAt?: Timestamp | null;
  role: RoleType;
};

const OWNER_EMAIL = "lily.studyroom@gmail.com"; // 👈 change if needed

export default function AdminPage() {
  const router = useRouter();
  const role = useUserRole();
  const [authed, setAuthed] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Basic auth guard – must be signed in
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/login");
      } else {
        setAuthed(true);
      }
    });
    return () => off();
  }, [router]);

  // If role is known and not admin, push back to hub
  useEffect(() => {
    if (role === null) return; // still loading
    if (role !== "admin") {
      router.replace("/hub");
    }
  }, [role, router]);

  // Load all users + their roles
  useEffect(() => {
    if (!authed || role !== "admin") return;

    async function loadUsers() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: AdminUser[] = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data() || {};
          const uid = docSnap.id;

          // Base info from user profile doc
          const email = (data.email as string | undefined) ?? "";
          const displayName = data.displayName as string | undefined;
          const accountType = data.accountType as string | undefined;
          const parentEmail = data.parentEmail as string | undefined;
          const createdAt = (data.createdAt as Timestamp | undefined) ?? null;

          // Default role
          let effectiveRole: RoleType = "student";

          // Owner email is always admin
          if (email && email === OWNER_EMAIL) {
            effectiveRole = "admin";
          } else {
            // For others, look at roles/{uid} doc (if it exists)
            const roleSnap = await getDoc(doc(db, "roles", uid));
            if (roleSnap.exists()) {
              const r = roleSnap.data()?.role as string | undefined;
              if (r === "tutor" || r === "admin") {
                effectiveRole = r;
              }
            }
          }

          list.push({
            uid,
            email,
            displayName,
            accountType,
            parentEmail,
            createdAt,
            role: effectiveRole,
          });
        }

        // Sort: admin (you) first, then tutors, then students
        list.sort((a, b) => {
          const order: Record<RoleType, number> = {
            admin: 0,
            tutor: 1,
            student: 2,
          };
          return order[a.role] - order[b.role];
        });

        setUsers(list);
      } catch (err) {
        console.error(err);
        setError("Could not load users. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [authed, role]);

  async function updateUserRole(uid: string, newRole: RoleType) {
    setError(null);
    setChangingId(uid);
    try {
      await setDoc(
        doc(db, "roles", uid),
        { role: newRole },
        { merge: true }
      );

      // Update local state immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? {
                ...u,
                role: newRole,
              }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      setError("Could not update role. Check Firestore rules and try again.");
    } finally {
      setChangingId(null);
    }
  }

  if (!authed || role !== "admin") {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Top bar */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Admin – Users &amp; Roles
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              View accounts and set who is a tutor. Only your login can see this
              page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/hub")}
            className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
          >
            Back to Hub
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">
              Accounts
            </h2>
            {loading && (
              <span className="text-xs text-[color:var(--muted)]">
                Loading…
              </span>
            )}
          </div>

          {users.length === 0 && !loading ? (
            <p className="text-sm text-[color:var(--muted)]">
              No user profiles found yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--ring)] text-xs uppercase text-[color:var(--muted)]">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Account type</th>
                    <th className="py-2 pr-4">Parent email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.uid}
                      className="border-b border-[color:var(--ring)]/60 last:border-0"
                    >
                      <td className="py-2 pr-4 text-[color:var(--ink)]">
                        {u.displayName || "—"}
                      </td>
                      <td className="py-2 pr-4 text-[color:var(--muted)]">
                        {u.email || "—"}
                      </td>
                      <td className="py-2 pr-4 text-[color:var(--muted)]">
                        {u.accountType || "student"}
                      </td>
                      <td className="py-2 pr-4 text-[color:var(--muted)]">
                        {u.parentEmail || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : u.role === "tutor"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-50 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {u.role === "admin"
                            ? "Admin"
                            : u.role === "tutor"
                            ? "Tutor"
                            : "Student"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {u.email === OWNER_EMAIL ? (
                          <span className="text-xs text-[color:var(--muted)]">
                            You
                          </span>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              disabled={changingId === u.uid || u.role === "student"}
                              onClick={() => updateUserRole(u.uid, "student")}
                              className="rounded-lg border border-[color:var(--ring)] bg-white px-2 py-1 text-xs text-[color:var(--muted)] hover:bg-slate-50 disabled:opacity-50"
                            >
                              Student
                            </button>
                            <button
                              type="button"
                              disabled={changingId === u.uid || u.role === "tutor"}
                              onClick={() => updateUserRole(u.uid, "tutor")}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Tutor
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
