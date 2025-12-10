"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type Role = "student" | "parent" | "tutor";

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
  return (
    map[code] ||
    (mode === "signin"
      ? "We could not sign you in. Please try again."
      : "We could not create your account. Please try again.")
  );
}

export default function SignInForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // extra fields for SIGNUP
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [parentEmail, setParentEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        // --- SIGN IN ---
        await signInWithEmailAndPassword(auth, email.trim(), pw);
        // Redirect is handled in login/page.tsx via onAuthStateChanged
      } else {
        // --- SIGN UP ---
        const trimmedEmail = email.trim();
        const trimmedPw = pw;
        const trimmedName = name.trim();
        const trimmedParentEmail = parentEmail.trim();

        // basic checks
        if (!trimmedName || !trimmedEmail || !trimmedPw) {
          setError("Please fill in your name, email, and password.");
          return;
        }

        if (!acceptedTerms) {
          setError("You need to agree to the Terms and Privacy Policy to continue.");
          return;
        }

        if (role === "student" && !trimmedParentEmail) {
          setError("Students must provide a parent email.");
          return;
        }

        // Create Auth user
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          trimmedPw
        );

        // Set display name
        await updateProfile(cred.user, {
          displayName: trimmedName,
        });

        const uid = cred.user.uid;

        // Create Firestore profile
        await setDoc(doc(db, "users", uid), {
          name: trimmedName,
          email: trimmedEmail,
          role,
          parentEmail: role === "student" ? trimmedParentEmail : null,
          createdAt: serverTimestamp(),
        });

        // Create Firestore role doc (used by security rules)
        await setDoc(doc(db, "roles", uid), {
          role,
        });

        // Redirect still handled by onAuthStateChanged in login/page.tsx
      }
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      autoComplete="on"
      method="post"
    >
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

      {/* Message region */}
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

      {/* SIGNUP-ONLY: Name */}
      {mode === "signup" && (
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm text-[color:var(--sr-ink)]"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
      )}

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm text-[color:var(--sr-ink)]"
        >
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

      {/* SIGNUP-ONLY: Role + Parent email */}
      {mode === "signup" && (
        <>
          {/* Role */}
          <div>
            <label className="mb-1 block text-sm text-[color:var(--sr-ink)]">
              I am a…
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2"
              aria-label="User role"
            >
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="tutor">Tutor</option>
            </select>
          </div>

          {/* Parent email for students */}
          {role === "student" && (
            <div>
              <label
                htmlFor="parentEmail"
                className="mb-1 block text-sm text-[color:var(--sr-ink)]"
              >
                Parent email (required for students)
              </label>
              <input
                id="parentEmail"
                name="parentEmail"
                type="email"
                className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                autoComplete="email"
              />
              <p className="mt-1 text-xs text-[color:var(--sr-muted)]">
                We may use this to contact your parent/guardian about safety or
                scheduling.
              </p>
            </div>
          )}
        </>
      )}

      {/* Password */}
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-[color:var(--sr-ink)]"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            className="w-full rounded-lg border border-[color:var(--sr-ring)] px-3 py-2 pr-14"
            placeholder="8+ characters"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
          />
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
            Choose a password that’s easy to remember but hard to guess.
          </p>
        )}
      </div>

      {/* SIGNUP-ONLY: Terms / Privacy checkbox */}
      {mode === "signup" && (
        <div className="flex items-start gap-2 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1"
          />
          <label
            htmlFor="terms"
            className="text-xs text-[color:var(--sr-ink)]"
          >
            I agree to the{" "}
            <a
              href="/terms"
              className="text-[color:var(--sr-primary)] underline"
              target="_blank"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-[color:var(--sr-primary)] underline"
              target="_blank"
            >
              Privacy Policy
            </a>
            . I understand this app is designed to be a calm and safe learning
            space.
          </label>
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[color:var(--sr-primary)] px-4 py-2 font-medium text-white transition hover:bg-[color:var(--sr-primary-600)] disabled:opacity-60"
        >
          {busy
            ? "Please wait…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </div>
    </form>
  );
}
