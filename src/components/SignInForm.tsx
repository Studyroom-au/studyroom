"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

function friendlyError(e: unknown, mode: "signin" | "signup") {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-email": "That email doesn’t look right.",
    "auth/user-not-found": "We couldn’t find that account.",
    "auth/wrong-password": "That password doesn’t look right.",
    "auth/invalid-credential": "Email or password doesn’t match.",
    "auth/too-many-requests": "Too many tries. Please wait a moment.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Try a longer password (at least 6 characters).",
  };
  return map[code] || (mode === "signin"
    ? "We could not sign you in. Please try again."
    : "We could not create your account. Please try again.");
}

export default function SignInForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), pw);
      }
      // Redirect handled in page.tsx via onAuthStateChanged
    } catch (err) {
      setError(friendlyError(err, mode));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    const addr = email.trim();
    if (!addr) {
      setError("Type your email first, then tap ‘Forgot password’."); 
      return;
    }
    try {
      setBusy(true);
      await sendPasswordResetEmail(auth, addr);
      setInfo("We sent you a reset link. Please check your email.");
    } catch (err) {
      setError(friendlyError(err, "signin"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on" method="post">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[color:var(--sr-ring)]">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={
            mode === "signin"
              ? "bg-[color:var(--sr-primary)] px-3 py-2 text-sm font-medium text-white"
              : "bg-[color:var(--sr-card)] px-3 py-2 text-sm text-[color:var(--sr-ink)]/80 hover:bg-white"
          }
        >
          I have an account
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={
            mode === "signup"
              ? "bg-[color:var(--sr-primary)] px-3 py-2 text-sm font-medium text-white"
              : "bg-[color:var(--sr-card)] px-3 py-2 text-sm text-[color:var(--sr-ink)]/80 hover:bg-white"
          }
        >
          I’m new here
        </button>
      </div>

      {/* ✅ Accessible message region */}
      {(error || info) && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            error
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {error ?? info}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-[color:var(--sr-ink)]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2"
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-[color:var(--sr-ink)]">
          Password
        </label>
        <div className="relative">
          {mode === "signin" ? (
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2 pr-14"
              placeholder="8+ characters"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          ) : (
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2 pr-14"
              placeholder="8+ characters"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          )}
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[color:var(--sr-ring)] bg-white px-2 py-1 text-xs text-[color:var(--sr-ink)]/80 hover:bg-white/80"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>

        {mode === "signin" ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleForgot}
              disabled={busy}
              className="text-xs text-[color:var(--sr-primary)] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        ) : (
          <p className="pt-2 text-xs text-[color:var(--sr-muted)]">
            Choose a password that’s easy to remember.
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[color:var(--sr-primary)] px-4 py-2 font-medium text-white transition hover:bg-[color:var(--sr-primary-600)] disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </div>
    </form>
  );
}
