// src/app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

type AccountType = "student" | "tutor" | "parent";

interface UserProfileDoc {
  displayName?: string;
  accountType?: AccountType;
  parentEmail?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export default function ProfilePage() {
  const router = useRouter();
  const role = useUserRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [parentEmail, setParentEmail] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current user + their profile
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setEmail(null);
        setLoading(false);
        router.replace("/login");
        return;
      }

      setUid(u.uid);
      setEmail(u.email ?? null);

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);

        const data = (snap.exists() ? (snap.data() as UserProfileDoc) : {}) ?? {};

        const fallbackName =
          data.displayName ||
          u.displayName ||
          (u.email ? u.email.split("@")[0] : "");

        setDisplayName(fallbackName);

        // If accountType exists use it, otherwise infer a sensible default
        const inferredType: AccountType =
          data.accountType ||
          (role === "tutor" || role === "admin"
            ? "tutor"
            : "student");

        setAccountType(inferredType);

        setParentEmail((data.parentEmail ?? "") || "");
      } catch (e) {
        console.error("Failed to load profile", e);
        setError("We couldn’t load your profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    });

    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, role]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const ref = doc(db, "users", uid);
      const payload: UserProfileDoc = {
        displayName: displayName.trim(),
        accountType,
        parentEmail: parentEmail.trim() || null,
        updatedAt: serverTimestamp(),
      };

      // If this is a brand new doc, also set createdAt
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(ref, payload, { merge: true });
      setMessage("Profile updated successfully.");
    } catch (e) {
      console.error("Save profile failed", e);
      setError("We couldn’t save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel =
    role === "admin" ? "Admin" :
    role === "tutor" ? "Tutor" :
    role === "student" ? "Student" :
    "Loading…";

  if (loading) {
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-16">
          <div className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-6 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            Loading your profile…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Your Profile
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Update your details and review how Studyroom keeps you safe.
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

        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm"
        >
          {/* Messages */}
          {(message || error) && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                error
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {error ?? message}
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Basic details
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="displayName"
                  className="text-sm font-medium text-[color:var(--ink)]"
                >
                  Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  className="w-full rounded-lg border border-[color:var(--ring)] bg-white px-3 py-2 text-sm text-[color:var(--ink)]"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <p className="text-xs text-[color:var(--muted)]">
                  This is the name that may appear in future on your profile and
                  in sessions.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--ink)]">
                  Email
                </label>
                <div className="rounded-lg border border-[color:var(--ring)] bg-slate-50 px-3 py-2 text-sm text-[color:var(--muted)]">
                  {email ?? "Unknown"}
                </div>
                <p className="text-xs text-[color:var(--muted)]">
                  To change your email, please contact Studyroom directly for now.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--ink)]">
                  Role
                </label>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ring)] bg-slate-50 px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--brand)]" />
                  {roleLabel}
                </div>
                <p className="text-xs text-[color:var(--muted)]">
                  Roles are managed by Studyroom. Students see &quot;Student&quot;, tutors see
                  &quot;Tutor&quot;, and admins see &quot;Admin&quot;.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--ink)]">
                  Account type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["student", "tutor", "parent"] as AccountType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAccountType(type)}
                      className={
                        accountType === type
                          ? "rounded-full bg-[color:var(--brand)] px-3 py-1 text-xs font-medium text-[color:var(--brand-contrast)] shadow-sm"
                          : "rounded-full border border-[color:var(--ring)] bg-white px-3 py-1 text-xs font-medium text-[color:var(--ink)]/80 hover:bg-slate-50"
                      }
                    >
                      {type === "student"
                        ? "Student"
                        : type === "tutor"
                        ? "Tutor"
                        : "Parent"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[color:var(--muted)]">
                  This helps us understand how you use Studyroom. It doesn&apos;t change your role
                  permissions.
                </p>
              </div>
            </div>

            {/* Parent email (for students) */}
            <div className="space-y-1">
              <label
                htmlFor="parentEmail"
                className="text-sm font-medium text-[color:var(--ink)]"
              >
                Parent / caregiver email (for contact)
              </label>
              <input
                id="parentEmail"
                type="email"
                className="w-full rounded-lg border border-[color:var(--ring)] bg-white px-3 py-2 text-sm text-[color:var(--ink)]"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
              />
              <p className="text-xs text-[color:var(--muted)]">
                For students under 18, we recommend including a parent or caregiver&apos;s email so
                your tutor can contact them if needed.
              </p>
            </div>
          </section>

          {/* Safety & legal */}
          <section className="space-y-3 rounded-xl border border-[color:var(--ring)] bg-white/80 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Safety & legal
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Studyroom is designed to be a calm, safe space for learning. Please take a moment to
              read through how we keep you safe online.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/legal/terms"
                className="rounded-full border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]/80 hover:bg-white"
              >
                Terms & Conditions
              </a>
              <a
                href="/legal/privacy"
                className="rounded-full border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]/80 hover:bg-white"
              >
                Privacy Policy
              </a>
              <a
                href="/legal/safety"
                className="rounded-full border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]/80 hover:bg-white"
              >
                Online Safety Tips
              </a>
            </div>
          </section>

          {/* Save button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-xl bg-[color:var(--brand)] px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
