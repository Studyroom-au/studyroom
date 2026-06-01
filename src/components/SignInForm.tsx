"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  type AuthError,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ── Constants ──────────────────────────────────────────────────────────────

const YEAR_LEVELS = [
  "Prep", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
];

const REFERRAL_OPTIONS = [
  "Google search",
  "Facebook / Instagram",
  "Friend or family referral",
  "School recommendation",
  "Flyer or poster",
  "Other",
];

type Tab = "login" | "student" | "tutor";
type TutorMode = "code" | "request";
type SignupMode = "family" | "independent";

// ── Checkbox helper ─────────────────────────────────────────────────────────

function Checkbox({
  checked, onChange, children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={e => (e.key === " " || e.key === "Enter") && onChange()}
      style={{
        display: "flex", alignItems: "flex-start", gap: 11,
        marginBottom: 13, cursor: "pointer", userSelect: "none",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
        border: checked ? "none" : "2px solid #d4dce4",
        background: checked ? "#456071" : "#fafbfc",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {checked && (
          <div style={{
            width: 5, height: 4,
            borderLeft: "2px solid #fff", borderBottom: "2px solid #fff",
            transform: "rotate(-45deg) translate(1px,-1px)",
          }} />
        )}
      </div>
      <div style={{ fontSize: 12, color: "#1d2428", lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SignInForm() {
  const router = useRouter();

  const [tab, setTabState] = useState<Tab>("login");
  const [tutorMode, setTutorMode] = useState<TutorMode>("code");
  const [signupMode, setSignupMode] = useState<SignupMode>("family");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Promo code (independent path)
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [postSignUpPromoFailed, setPostSignUpPromoFailed] = useState(false);

  // Promo code (family path)
  const [familyPromoCode, setFamilyPromoCode] = useState("");
  const [familyPromoError, setFamilyPromoError] = useState<string | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Independent student — account credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Family student — separate login credentials (different from the independent email/password)
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentConfirmPassword, setStudentConfirmPassword] = useState("");

  // Student info (shared by both modes)
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [dob, setDob] = useState("");
  const [school, setSchool] = useState("");

  // Parent info (used by both modes — required for family, optional for independent)
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [referral, setReferral] = useState("");

  // Consent
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);

  // Family signup result state
  const [familyAlreadyExists, setFamilyAlreadyExists] = useState(false);

  // Tutor code
  const [tutorCode, setTutorCode] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [tutorPassword, setTutorPassword] = useState("");
  const [tutorConfirmPassword, setTutorConfirmPassword] = useState("");

  // Tutor request
  const [tutorReqName, setTutorReqName] = useState("");
  const [tutorReqEmail, setTutorReqEmail] = useState("");

  // Redirect if already signed in
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.subscriptionStatus === "active" && data.onboardingComplete) {
          router.push("/hub");
        } else if (data.subscriptionStatus === "active" && !data.onboardingComplete) {
          router.push("/onboarding");
        }
      } catch { /* ignore */ }
    });
    return () => off();
  }, [router]);

  function switchTab(t: Tab) {
    setTabState(t);
    setError(null);
    setSuccess(null);
    setFamilyAlreadyExists(false);
  }

  function switchSignupMode(m: SignupMode) {
    setSignupMode(m);
    setError(null);
    setFamilyAlreadyExists(false);
    setFamilyPromoCode("");
    setFamilyPromoError(null);
  }

  // ── Shared styles ────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    width: "100%",
    border: "1.5px solid #e4eaef",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#1d2428",
    outline: "none",
    background: "#fafbfc",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  };

  const lbl: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: "#748398",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    marginBottom: 5,
    display: "block",
  };

  const field: React.CSSProperties = { marginBottom: 14 };

  const secLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "#b8cad6",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  const infoBox: React.CSSProperties = {
    background: "#f4f7f9",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 12,
    color: "#677a8a",
    lineHeight: 1.6,
    marginBottom: 18,
    borderLeft: "3px solid #b8cad6",
  };

  const submitBtn: React.CSSProperties = {
    width: "100%", background: "#456071", color: "#fff", border: "none",
    borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
    opacity: loading ? 0.7 : 1, marginTop: 6, transition: "opacity 0.15s",
    letterSpacing: "-0.01em",
  };

  const errBox = (
    <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginBottom: 14 }}>
      {error}
    </div>
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleLogin() {
    if (!loginEmail.trim()) { setError("Please enter your email address."); return; }
    if (!loginPassword) { setError("Please enter your password."); return; }
    setLoading(true); setError(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      router.push("/hub");
    } catch (err: unknown) {
      const code = (err as AuthError)?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Incorrect email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally { setLoading(false); }
  }

  // ── Family signup handler ─────────────────────────────────────────────────

  async function handleFamilySignUp() {
    // Parent validation
    if (!parentName.trim()) { setError("Please enter your name."); return; }
    if (!parentEmail.trim()) { setError("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) { setError("Please enter a valid parent email address."); return; }
    if (!parentPhone.trim()) { setError("Please enter a contact phone number."); return; }
    if (parentPassword.trim().length < 6) { setError("Please set a parent password (minimum 6 characters)."); return; }
    // Student validation
    if (!studentName.trim()) { setError("Please enter the student’s name."); return; }
    if (!studentEmail.trim()) { setError("Please enter the student’s email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) { setError("Please enter a valid student email address."); return; }
    if (studentEmail.trim().toLowerCase() === parentEmail.trim().toLowerCase()) {
      setError("Student and parent email addresses must be different."); return;
    }
    if (studentPassword.length < 8) { setError("Student password must be at least 8 characters."); return; }
    if (studentPassword !== studentConfirmPassword) { setError("Student passwords don’t match."); return; }
    if (!yearLevel) { setError("Please select a year level."); return; }
    // Consent
    if (!consentTerms) { setError("Please agree to the terms of service."); return; }
    if (!consentPrivacy) { setError("Please agree to the privacy policy."); return; }
    if (!consentGuardian) { setError("Please confirm you are the parent or legal guardian."); return; }

    setLoading(true); setError(null); setFamilyPromoError(null);

    try {
      const res = await fetch("/api/signup/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: parentName.trim(),
          parentEmail: parentEmail.trim(),
          parentPassword: parentPassword.trim(),
          parentPhone: parentPhone.trim(),
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim(),
          studentPassword,
          yearLevel,
          dob: dob || undefined,
          school: school.trim() || undefined,
          promoCode: familyPromoCode.trim() || undefined,
        }),
      });

      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        accountWasNew?: boolean;
        promoApplied?: boolean;
        promoError?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not create account. Please try again.");
      }

      if (data.promoError) {
        setFamilyPromoError(data.promoError);
      }

      if (data.accountWasNew) {
        // New parent account — sign them in automatically and go to parent portal
        await signInWithEmailAndPassword(auth, parentEmail.trim(), parentPassword.trim());
        router.push("/parent");
      } else {
        // Account already existed — student was still added; prompt them to sign in
        setFamilyAlreadyExists(true);
        setLoginEmail(parentEmail.trim());
      }
    } catch (err: unknown) {
      const code = (err as AuthError)?.code ?? "";
      if (code === "auth/invalid-credential") {
        setError("Could not sign in. Please use the login tab with your existing password.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Independent student signup handler ───────────────────────────────────

  async function handleStudentSignUp() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don’t match."); return; }
    if (!studentName.trim()) { setError("Please enter the student’s name."); return; }
    if (!yearLevel) { setError("Please select a year level."); return; }
    // Parent is fully optional for independent students — no validation
    if (!consentTerms) { setError("Please agree to the terms of service."); return; }
    if (!consentPrivacy) { setError("Please agree to the privacy policy."); return; }

    setLoading(true); setError(null); setPromoError(null);

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const infoRes = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          studentName, yearLevel, dob, school,
          parentName: parentName.trim() || undefined,
          parentEmail: parentEmail.trim() || undefined,
          parentPhone: parentPhone.trim() || undefined,
          parentPassword: parentPassword.trim() || undefined,
          referral,
          loginEmail: email.trim(),
          accountType: "independent",
        }),
      });
      const infoData = await infoRes.json() as { ok?: boolean; error?: string };
      if (!infoRes.ok || !infoData.ok) throw new Error(infoData.error ?? "Could not save details.");

      if (promoCode.trim()) {
        const promoRes = await fetch("/api/promo/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ code: promoCode.trim() }),
        });
        const promoData = await promoRes.json() as { ok?: boolean; error?: string };
        if (promoRes.ok && promoData.ok) {
          router.push("/onboarding");
          return;
        }
        setPromoError(promoData.error ?? "Invalid promo code.");
        setPostSignUpPromoFailed(true);
        setLoading(false);
        return;
      }

      const stripeRes = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      });
      const stripeData = await stripeRes.json() as { url?: string; error?: string };
      if (!stripeRes.ok || !stripeData.url) throw new Error(stripeData.error ?? "Could not start payment.");

      window.location.href = stripeData.url;
    } catch (err: unknown) {
      const code = (err as AuthError)?.code ?? "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Use Log in instead.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setLoading(false);
    }
  }

  async function handleTutorCodeRedeem() {
    if (!tutorCode.trim()) { setError("Please enter your access code."); return; }
    if (!tutorEmail.trim()) { setError("Please enter your email address."); return; }
    if (tutorPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (tutorPassword !== tutorConfirmPassword) { setError("Passwords don’t match."); return; }

    setLoading(true); setError(null);

    try {
      try {
        await createUserWithEmailAndPassword(auth, tutorEmail.trim(), tutorPassword);
      } catch (createErr: unknown) {
        const code = (createErr as AuthError)?.code ?? "";
        if (code === "auth/email-already-in-use") {
          try {
            await signInWithEmailAndPassword(auth, tutorEmail.trim(), tutorPassword);
          } catch (signInErr: unknown) {
            const signInCode = (signInErr as AuthError)?.code ?? "";
            if (signInCode === "auth/wrong-password" || signInCode === "auth/invalid-credential") {
              setError("An account with this email already exists but the password is incorrect. Please use the password for your existing Studyroom account.");
            } else {
              setError("Could not sign in to your existing account. Please try again.");
            }
            setLoading(false);
            return;
          }
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
          setLoading(false);
          return;
        } else if (code === "auth/weak-password") {
          setError("Password must be at least 8 characters.");
          setLoading(false);
          return;
        } else {
          throw createErr;
        }
      }

      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const res = await fetch("/api/tutor/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ code: tutorCode.trim().toUpperCase() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Invalid code.");

      router.push("/hub/tutor");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) { setError("Please enter your email address."); return; }
    setForgotLoading(true);
    setError(null);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotSent(true);
    } catch (err: unknown) {
      const code = (err as AuthError)?.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setForgotSent(true);
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleTutorRequest() {
    if (!tutorReqName.trim()) { setError("Please enter your name."); return; }
    if (!tutorReqEmail.trim()) { setError("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tutorReqEmail)) {
      setError("Please enter a valid email address."); return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/tutor/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tutorReqName.trim(), email: tutorReqEmail.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not send request.");
      setSuccess(`Thanks ${tutorReqName.trim().split(" ")[0]}! We’ve received your request and will be in touch once approved.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "32px 16px 60px" }}>
      <div style={{ width: "100%", maxWidth: 460, margin: "0 auto" }}>

        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
            Studyroom
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {tab === "login" ? "Welcome back"
              : tab === "student" ? "Create your account"
              : "Tutor access"}
          </div>
          <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 5 }}>
            {tab === "login" ? "Log in to your student hub."
              : tab === "student" ? "Logan and Brisbane Southside tutoring."
              : "Join the Studyroom tutor team."}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: "flex", background: "#fff", borderRadius: 16, padding: 5,
          marginBottom: 18, gap: 4, border: "1px solid rgba(0,0,0,0.07)",
        }}>
          {(["login", "student", "tutor"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              style={{
                flex: 1, padding: "9px 8px", borderRadius: 11, border: "none",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.18s",
                background: tab === t ? "#456071" : "transparent",
                color: tab === t ? "#fff" : "#748398",
              }}
            >
              {t === "login" ? "Log in" : t === "student" ? "New student" : "Tutor access"}
            </button>
          ))}
        </div>

        {/* ── LOG IN ── */}
        {tab === "login" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={field}>
              <label style={lbl}>Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => { setLoginEmail(e.target.value); setError(null); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="you@email.com"
                autoComplete="email"
                style={inp}
              />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => { setLoginPassword(e.target.value); setError(null); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Your password"
                autoComplete="current-password"
                style={inp}
              />
            </div>
            {error && !showForgotPassword && errBox}
            <button type="button" onClick={handleLogin} disabled={loading} style={submitBtn}>
              {loading ? "Logging in..." : "Log in"}
            </button>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(v => !v);
                  setForgotEmail(loginEmail);
                  setForgotSent(false);
                  setError(null);
                }}
                style={{ background: "none", border: "none", fontSize: 12, color: "#8a96a3", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                Forgot password?
              </button>
            </div>
            {showForgotPassword && (
              <div style={{ marginTop: 14, background: "#f4f7f9", borderRadius: 12, padding: "14px 16px" }}>
                {forgotSent ? (
                  <div style={{ fontSize: 13, color: "#2d5a24", lineHeight: 1.6 }}>
                    If an account exists for that email, a reset link has been sent.
                    Check your inbox (and spam folder).
                    <br />
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(false); setForgotSent(false); }}
                      style={{ marginTop: 10, background: "none", border: "none", fontSize: 12, color: "#456071", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}
                    >
                      Back to log in
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "#677a8a", marginBottom: 10 }}>
                      Enter your email and we&apos;ll send you a reset link.
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => { setForgotEmail(e.target.value); setError(null); }}
                        onKeyDown={e => e.key === "Enter" && void handleForgotPassword()}
                        placeholder="your@email.com"
                        autoComplete="email"
                        style={{ width: "100%", border: "1.5px solid #e4eaef", borderRadius: 9, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", color: "#1d2428", outline: "none", background: "#fff", boxSizing: "border-box" as const }}
                      />
                    </div>
                    {error && <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>{error}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => void handleForgotPassword()} disabled={forgotLoading}
                        style={{ flex: 2, background: "#456071", color: "#fff", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: forgotLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: forgotLoading ? 0.7 : 1 }}>
                        {forgotLoading ? "Sending..." : "Send reset link"}
                      </button>
                      <button type="button" onClick={() => { setShowForgotPassword(false); setError(null); }}
                        style={{ flex: 1, background: "#fff", color: "#677a8a", border: "none", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── NEW STUDENT ── */}
        {tab === "student" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>

            {/* ── Account type selector ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 10 }}>
                Account type
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Family option */}
                <button
                  type="button"
                  onClick={() => switchSignupMode("family")}
                  style={{
                    textAlign: "left", background: signupMode === "family" ? "#f0f4f7" : "#fafbfc",
                    border: `1.5px solid ${signupMode === "family" ? "#456071" : "#e4eaef"}`,
                    borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${signupMode === "family" ? "#456071" : "#c8d4dc"}`, background: signupMode === "family" ? "#456071" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {signupMode === "family" && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>Parent / guardian account</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#748398", marginTop: 4, paddingLeft: 22, lineHeight: 1.5 }}>
                    Parent manages billing, student access and the parent portal.
                  </div>
                </button>

                {/* Independent option */}
                <button
                  type="button"
                  onClick={() => switchSignupMode("independent")}
                  style={{
                    textAlign: "left", background: signupMode === "independent" ? "#f0f4f7" : "#fafbfc",
                    border: `1.5px solid ${signupMode === "independent" ? "#456071" : "#e4eaef"}`,
                    borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${signupMode === "independent" ? "#456071" : "#c8d4dc"}`, background: signupMode === "independent" ? "#456071" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {signupMode === "independent" && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>I am 16 or older and managing my own account</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#748398", marginTop: 4, paddingLeft: 22, lineHeight: 1.5 }}>
                    Parent details are optional.
                  </div>
                </button>
              </div>
            </div>

            {/* ── FAMILY FORM ─────────────────────────────────────────────────── */}
            {signupMode === "family" && (
              <>
                {/* Existing account notice */}
                {familyAlreadyExists && (
                  <div style={{ background: "#edf5eb", borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid #c8e6bb" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#2d5a24", marginBottom: 4 }}>
                      Student added successfully
                    </div>
                    <div style={{ fontSize: 12, color: "#456071", lineHeight: 1.5 }}>
                      This parent account already exists. Sign in to view your family account.
                    </div>
                    {familyPromoError && (
                      <div style={{ fontSize: 12, color: "#c0445e", marginTop: 8, padding: "6px 10px", background: "#fce8ee", borderRadius: 7 }}>
                        {familyPromoError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { switchTab("login"); }}
                      style={{ marginTop: 10, background: "#456071", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Sign in →
                    </button>
                  </div>
                )}

                {!familyAlreadyExists && (
                  <>
                    {/* Parent account */}
                    <div style={secLabel}>Your account <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <div style={field}>
                      <label style={lbl}>Your email</label>
                      <input type="email" value={parentEmail}
                        onChange={e => { setParentEmail(e.target.value); setError(null); }}
                        placeholder="parent@email.com" autoComplete="email" style={inp} />
                    </div>
                    <div style={field}>
                      <label style={lbl}>Create a password</label>
                      <input type="password" value={parentPassword}
                        onChange={e => { setParentPassword(e.target.value); setError(null); }}
                        placeholder="Min 6 characters" autoComplete="new-password" style={inp} />
                      <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 5 }}>
                        This password lets you log in to your parent portal.
                      </div>
                    </div>

                    {/* Parent info */}
                    <div style={secLabel}>Your details <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <div style={field}>
                      <label style={lbl}>Your name</label>
                      <input value={parentName}
                        onChange={e => { setParentName(e.target.value); setError(null); }}
                        placeholder="Full name" style={inp} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={lbl}>Phone</label>
                      <input type="tel" value={parentPhone}
                        onChange={e => { setParentPhone(e.target.value); setError(null); }}
                        placeholder="04xx xxx xxx" style={inp} />
                    </div>

                    {/* Student login */}
                    <div style={secLabel}>Student login <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <div style={{ ...infoBox, marginBottom: 14 }}>
                      Student login is for the student hub and study tools.
                    </div>
                    <div style={field}>
                      <label style={lbl}>Student email</label>
                      <input type="email" value={studentEmail}
                        onChange={e => { setStudentEmail(e.target.value); setError(null); }}
                        placeholder="student@email.com" autoComplete="off" style={inp} />
                    </div>
                    <div style={field}>
                      <label style={lbl}>Student password</label>
                      <input type="password" value={studentPassword}
                        onChange={e => { setStudentPassword(e.target.value); setError(null); }}
                        placeholder="At least 8 characters" autoComplete="new-password" style={inp} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={lbl}>Confirm student password</label>
                      <input type="password" value={studentConfirmPassword}
                        onChange={e => { setStudentConfirmPassword(e.target.value); setError(null); }}
                        placeholder="Re-enter student password" autoComplete="new-password" style={inp} />
                    </div>

                    {/* Student details */}
                    <div style={secLabel}>Student details <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <div style={field}>
                      <label style={lbl}>Student&apos;s name</label>
                      <input value={studentName}
                        onChange={e => { setStudentName(e.target.value); setError(null); }}
                        placeholder="First name" style={inp} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={lbl}>Year level</label>
                        <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}
                          style={{ ...inp, cursor: "pointer" }} title="Year level">
                          <option value="">Select year</option>
                          {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Date of birth <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(opt.)</span></label>
                        <input type="date" value={dob}
                          onChange={e => setDob(e.target.value)}
                          style={inp} title="Date of birth" />
                      </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={lbl}>School <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span></label>
                      <input value={school} onChange={e => setSchool(e.target.value)}
                        placeholder="School name" style={inp} />
                    </div>

                    {/* Consent */}
                    <div style={secLabel}>Consent <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <Checkbox checked={consentTerms} onChange={() => setConsentTerms(v => !v)}>
                      I agree to the{" "}
                      <a href="https://studyroom.au/legal/terms" target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                        terms of service
                      </a>
                    </Checkbox>
                    <Checkbox checked={consentPrivacy} onChange={() => setConsentPrivacy(v => !v)}>
                      I agree to the{" "}
                      <a href="https://studyroom.au/legal/privacy" target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                        privacy policy
                      </a>
                    </Checkbox>
                    <Checkbox checked={consentGuardian} onChange={() => setConsentGuardian(v => !v)}>
                      I am the parent or legal guardian of the student
                    </Checkbox>

                    {/* Subscription */}
                    <div style={{ ...secLabel, marginTop: 6 }}>Subscription <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                    <div style={{ background: "#f4f7f9", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>Monthly membership</div>
                        <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2, lineHeight: 1.5 }}>Use Studyroom for student organisation, study tools and tutoring support when needed.</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#456071", lineHeight: 1 }}>$9.95</div>
                        <div style={{ fontSize: 10, color: "#8a96a3" }}>/ month</div>
                      </div>
                    </div>
                    {["Student hub with deadline tracker", "Mood and study tools", "Cancel anytime"].map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#bde4af", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <div style={{ width: 5, height: 4, borderLeft: "1.5px solid #2d5a24", borderBottom: "1.5px solid #2d5a24", transform: "rotate(-45deg) translate(1px,-1px)" }} />
                        </div>
                        <div style={{ fontSize: 12, color: "#456071" }}>{f}</div>
                      </div>
                    ))}

                    {/* Promo code */}
                    <div style={{ marginTop: 16, marginBottom: 4 }}>
                      <label style={lbl}>
                        Promo / beta code{" "}
                        <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span>
                      </label>
                      <input
                        value={familyPromoCode}
                        onChange={e => { setFamilyPromoCode(e.target.value.toUpperCase()); setFamilyPromoError(null); }}
                        placeholder="Enter code"
                        style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.1em" }}
                      />
                      {familyPromoError && (
                        <div style={{ fontSize: 12, color: "#c0445e", marginTop: 5 }}>{familyPromoError}</div>
                      )}
                    </div>

                    {error && <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", margin: "14px 0" }}>{error}</div>}
                    <button type="button" onClick={handleFamilySignUp} disabled={loading} style={{ ...submitBtn, marginTop: 16 }}>
                      {loading ? "Creating your account..." : familyPromoCode.trim() ? "Create account with promo code →" : "Create family account →"}
                    </button>
                    <div style={{ fontSize: 10, color: "#b0bec5", textAlign: "center", marginTop: 9 }}>
                      {familyPromoCode.trim() ? "Your promo code will be applied during signup." : "Secured by Stripe. Cancel anytime."}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── INDEPENDENT STUDENT FORM ─────────────────────────────────── */}
            {signupMode === "independent" && (
              <>
                {/* Account */}
                <div style={secLabel}>Account <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                <div style={field}>
                  <label style={lbl}>Email</label>
                  <input type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@email.com" autoComplete="email" style={inp} />
                </div>
                <div style={field}>
                  <label style={lbl}>Password</label>
                  <input type="password" value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="At least 8 characters" autoComplete="new-password" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Confirm password</label>
                  <input type="password" value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                    placeholder="Re-enter password" autoComplete="new-password" style={inp} />
                </div>

                {/* Student */}
                <div style={secLabel}>Student <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                <div style={field}>
                  <label style={lbl}>Your name</label>
                  <input value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="First name" style={inp} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={lbl}>Year level</label>
                    <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}
                      style={{ ...inp, cursor: "pointer" }} title="Year level">
                      <option value="">Select year</option>
                      {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Date of birth <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(opt.)</span></label>
                    <input type="date" value={dob}
                      onChange={e => setDob(e.target.value)}
                      style={inp} title="Date of birth" />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>School <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span></label>
                  <input value={school} onChange={e => setSchool(e.target.value)}
                    placeholder="School name" style={inp} />
                </div>

                {/* Parent — optional for independent students */}
                <div style={secLabel}>
                  Parent / guardian
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#b8cad6", background: "#f4f7f9", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Optional
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#edf0f3" }} />
                </div>
                <div style={{ ...infoBox, marginBottom: 14 }}>
                  Since you&apos;re managing your own account, parent details are optional. You can add them later.
                </div>
                <div style={field}>
                  <label style={lbl}>Parent name <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span></label>
                  <input value={parentName} onChange={e => setParentName(e.target.value)}
                    placeholder="Full name" style={{ ...inp, opacity: 0.7 }} />
                </div>
                <div style={field}>
                  <label style={lbl}>Parent email <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span></label>
                  <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                    placeholder="parent@email.com" style={{ ...inp, opacity: 0.7 }} />
                </div>
                <div style={{ marginBottom: parentEmail.trim() ? 14 : 20 }}>
                  <label style={lbl}>Parent phone <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span></label>
                  <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                    placeholder="04xx xxx xxx" style={{ ...inp, opacity: 0.7 }} />
                </div>
                {parentEmail.trim() && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={lbl}>Parent login password</label>
                    <input type="password" value={parentPassword} onChange={e => setParentPassword(e.target.value)}
                      placeholder="Min 6 characters" autoComplete="new-password" style={{ ...inp, opacity: 0.7 }} />
                    <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 5 }}>
                      Your parent can use this to log in at studyroom.au/parent.
                    </div>
                  </div>
                )}

                {/* Referral */}
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>How did you hear about Studyroom?</label>
                  <select value={referral} onChange={e => setReferral(e.target.value)}
                    style={{ ...inp, cursor: "pointer" }} title="How did you hear about Studyroom?">
                    <option value="">Select...</option>
                    {REFERRAL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Consent */}
                <div style={secLabel}>Consent <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                <Checkbox checked={consentTerms} onChange={() => setConsentTerms(v => !v)}>
                  I agree to the{" "}
                  <a href="https://studyroom.au/terms" target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                    terms of service
                  </a>
                </Checkbox>
                <Checkbox checked={consentPrivacy} onChange={() => setConsentPrivacy(v => !v)}>
                  I agree to the{" "}
                  <a href="https://studyroom.au/privacy" target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                    privacy policy
                  </a>
                </Checkbox>

                {/* Subscription */}
                <div style={{ ...secLabel, marginTop: 6 }}>Subscription <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
                <div style={{ background: "#f4f7f9", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>Monthly membership</div>
                    <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2, lineHeight: 1.5 }}>Full hub access, sessions and tutor tools.</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#456071", lineHeight: 1 }}>$9.95</div>
                    <div style={{ fontSize: 10, color: "#8a96a3" }}>/ month</div>
                  </div>
                </div>
                {["Student hub with deadline tracker", "Mood and study tools", "Cancel anytime"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#bde4af", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div style={{ width: 5, height: 4, borderLeft: "1.5px solid #2d5a24", borderBottom: "1.5px solid #2d5a24", transform: "rotate(-45deg) translate(1px,-1px)" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#456071" }}>{f}</div>
                  </div>
                ))}

                {/* Promo code */}
                <div style={{ marginTop: 16, marginBottom: 4 }}>
                  <label style={lbl}>
                    Promo / beta code{" "}
                    <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span>
                  </label>
                  <input
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); setPostSignUpPromoFailed(false); }}
                    placeholder="Enter code"
                    style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.1em" }}
                  />
                  {promoError && !postSignUpPromoFailed && (
                    <div style={{ fontSize: 12, color: "#c0445e", marginTop: 5 }}>{promoError}</div>
                  )}
                </div>

                {postSignUpPromoFailed && promoError ? (
                  <div style={{ marginTop: 12, background: "#fce8ee", borderRadius: 9, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, color: "#c0445e", marginBottom: 6 }}>{promoError}</div>
                    <div style={{ fontSize: 11, color: "#677a8a", marginBottom: 10, lineHeight: 1.5 }}>
                      Your account was created. You can try your code again on the payment page, or subscribe with a card.
                    </div>
                    <button type="button" onClick={() => router.push("/subscribe")}
                      style={{ ...submitBtn, marginTop: 0, fontSize: 13 }}>
                      Continue to payment page →
                    </button>
                  </div>
                ) : (
                  <>
                    {error && <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", margin: "14px 0" }}>{error}</div>}
                    <button type="button" onClick={handleStudentSignUp} disabled={loading} style={{ ...submitBtn, marginTop: 16 }}>
                      {loading ? "Creating your account..."
                        : promoCode.trim() ? "Create account with promo code →"
                        : "Create account and continue to payment →"}
                    </button>
                    <div style={{ fontSize: 10, color: "#b0bec5", textAlign: "center", marginTop: 9 }}>
                      Secured by Stripe. Cancel anytime.
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        )}

        {/* ── TUTOR ACCESS ── */}
        {tab === "tutor" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", background: "#f4f7f9", borderRadius: 10, padding: 4, gap: 4, marginBottom: 20 }}>
              {(["code", "request"] as TutorMode[]).map(m => (
                <button key={m} type="button"
                  onClick={() => { setTutorMode(m); setError(null); setSuccess(null); }}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", background: tutorMode === m ? "#fff" : "transparent", color: tutorMode === m ? "#456071" : "#748398", boxShadow: tutorMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {m === "code" ? "I have an access code" : "Request access"}
                </button>
              ))}
            </div>

            {tutorMode === "code" && !success && (
              <>
                <div style={infoBox}>Enter the code from your Studyroom welcome email to create your tutor account.</div>
                <div style={field}>
                  <label style={lbl}>Access code</label>
                  <input value={tutorCode} onChange={e => { setTutorCode(e.target.value.toUpperCase()); setError(null); }}
                    placeholder="TUTOR-XXXXXX" style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.15em", fontSize: 15, textAlign: "center" }} />
                </div>
                <div style={field}>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={tutorEmail} onChange={e => { setTutorEmail(e.target.value); setError(null); }}
                    placeholder="Same email you registered with" style={inp} />
                </div>
                <div style={field}>
                  <label style={lbl}>Password</label>
                  <input type="password" value={tutorPassword} onChange={e => { setTutorPassword(e.target.value); setError(null); }}
                    placeholder="Choose a password" autoComplete="new-password" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Confirm password</label>
                  <input type="password" value={tutorConfirmPassword} onChange={e => { setTutorConfirmPassword(e.target.value); setError(null); }}
                    placeholder="Re-enter password" autoComplete="new-password" style={inp} />
                </div>
                {error && errBox}
                <button type="button" onClick={handleTutorCodeRedeem} disabled={loading} style={submitBtn}>
                  {loading ? "Activating..." : "Activate tutor account →"}
                </button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: "#8a96a3" }}>
                    Don&apos;t have a code?{" "}
                    <button type="button" onClick={() => { setTutorMode("request"); setError(null); }}
                      style={{ background: "none", border: "none", color: "#456071", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>
                      Request access instead
                    </button>
                  </span>
                </div>
              </>
            )}

            {tutorMode === "request" && !success && (
              <>
                <div style={infoBox}>Not yet a Studyroom tutor? Submit your details and we&apos;ll review your application. You&apos;ll receive a welcome email with your personal access code once approved.</div>
                <div style={field}>
                  <label style={lbl}>Your name</label>
                  <input value={tutorReqName} onChange={e => { setTutorReqName(e.target.value); setError(null); }}
                    placeholder="Full name" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={tutorReqEmail} onChange={e => { setTutorReqEmail(e.target.value); setError(null); }}
                    placeholder="you@email.com" style={inp} />
                </div>
                {error && errBox}
                <button type="button" onClick={handleTutorRequest} disabled={loading} style={submitBtn}>
                  {loading ? "Sending..." : "Request access"}
                </button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: "#8a96a3" }}>
                    Already have a code?{" "}
                    <button type="button" onClick={() => { setTutorMode("code"); setError(null); }}
                      style={{ background: "none", border: "none", color: "#456071", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>
                      Enter it here
                    </button>
                  </span>
                </div>
              </>
            )}

            {success && (
              <div style={{ background: "#edf5eb", borderRadius: 12, padding: "16px 18px", fontSize: 13, color: "#2d5a24", lineHeight: 1.7, border: "1px solid #c8e6bb" }}>
                {success}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
