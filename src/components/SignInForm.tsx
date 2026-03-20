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

// ── Age helper ─────────────────────────────────────────────────────────────

function getAge(dobString: string): number | null {
  if (!dobString) return null;
  const today = new Date();
  const birth = new Date(dobString);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SignInForm() {
  const router = useRouter();

  const [tab, setTabState] = useState<Tab>("login");
  const [tutorMode, setTutorMode] = useState<TutorMode>("code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Student sign up — account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Student sign up — student info
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [dob, setDob] = useState("");
  const [school, setSchool] = useState("");

  // Student sign up — parent info
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [referral, setReferral] = useState("");

  // Consent
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);

  // Tutor code
  const [tutorCode, setTutorCode] = useState("");
  const [tutorEmail, setTutorEmail] = useState("");
  const [tutorPassword, setTutorPassword] = useState("");
  const [tutorConfirmPassword, setTutorConfirmPassword] = useState("");

  // Tutor request
  const [tutorReqName, setTutorReqName] = useState("");
  const [tutorReqEmail, setTutorReqEmail] = useState("");

  // Derived
  const studentAge = getAge(dob);
  const parentOptional = studentAge !== null && studentAge >= 16;

  // Mount effect
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

  async function handleStudentSignUp() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    if (!studentName.trim()) { setError("Please enter the student's name."); return; }
    if (!yearLevel) { setError("Please select a year level."); return; }
    if (!parentOptional) {
      if (!parentName.trim()) { setError("Please enter the parent or guardian's name."); return; }
      if (!parentEmail.trim()) { setError("Please enter the parent email address."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
        setError("Please enter a valid parent email address."); return;
      }
      if (!parentPhone.trim()) { setError("Please enter a contact phone number."); return; }
    }
    if (!consentTerms) { setError("Please agree to the terms of service."); return; }
    if (!consentPrivacy) { setError("Please agree to the privacy policy."); return; }
    if (!parentOptional && !consentGuardian) {
      setError("Please confirm you are the parent or legal guardian."); return;
    }

    setLoading(true); setError(null);

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
          parentName: parentOptional ? "" : parentName,
          parentEmail: parentOptional ? email.trim() : parentEmail,
          parentPhone: parentOptional ? "" : parentPhone,
          referral, loginEmail: email.trim(),
        }),
      });
      const infoData = await infoRes.json() as { ok?: boolean; error?: string };
      if (!infoRes.ok || !infoData.ok) throw new Error(infoData.error ?? "Could not save details.");

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
    if (tutorPassword !== tutorConfirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true); setError(null);

    try {
      await createUserWithEmailAndPassword(auth, tutorEmail.trim(), tutorPassword);
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
      const code = (err as AuthError)?.code ?? "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Log in first, then contact admin if your role hasn't been set.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setLoading(false);
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
      setSuccess(`Thanks ${tutorReqName.trim().split(" ")[0]}! We've received your request and will be in touch once approved.`);
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
            {error && errBox}
            <button type="button" onClick={handleLogin} disabled={loading} style={submitBtn}>
              {loading ? "Logging in..." : "Log in"}
            </button>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 12, color: "#8a96a3", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
              >
                Forgot password?
              </button>
            </div>
          </div>
        )}

        {/* ── NEW STUDENT ── */}
        {tab === "student" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>

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
                placeholder="At least 8 characters"
                autoComplete="new-password" style={inp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Confirm password</label>
              <input type="password" value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                placeholder="Re-enter password"
                autoComplete="new-password" style={inp} />
            </div>

            {/* Student */}
            <div style={secLabel}>Student <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>
            <div style={field}>
              <label style={lbl}>Student&apos;s name</label>
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
                <label style={lbl}>Date of birth</label>
                <input type="date" value={dob}
                  onChange={e => setDob(e.target.value)}
                  style={inp} title="Date of birth" placeholder="Date of birth" />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>
                School{" "}
                <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>(optional)</span>
              </label>
              <input value={school} onChange={e => setSchool(e.target.value)}
                placeholder="School name" style={inp} />
            </div>

            {/* Parent / guardian */}
            <div style={secLabel}>
              Parent / guardian
              {parentOptional && (
                <span style={{
                  fontSize: 9, fontWeight: 600, color: "#b8cad6", background: "#f4f7f9",
                  borderRadius: 20, padding: "2px 8px", letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}>
                  Optional
                </span>
              )}
              <div style={{ flex: 1, height: 1, background: "#edf0f3" }} />
            </div>

            {parentOptional && (
              <div style={{
                background: "#fdf8f0", borderRadius: 9, padding: "9px 12px",
                fontSize: 11, color: "#a06020", lineHeight: 1.6, marginBottom: 14,
                borderLeft: "3px solid #d4b896",
              }}>
                Student is 16 or over — parent and guardian details are optional.
              </div>
            )}

            <div style={field}>
              <label style={lbl}>
                Parent name
                {parentOptional && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}> (optional)</span>}
              </label>
              <input value={parentName} onChange={e => setParentName(e.target.value)}
                placeholder="Full name" style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }} />
            </div>
            <div style={field}>
              <label style={lbl}>
                Parent email
                {parentOptional && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}> (optional)</span>}
              </label>
              <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                placeholder="parent@email.com"
                style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }} />
              <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 5 }}>
                All invoices and session updates go here.
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>
                Phone
                {parentOptional && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}> (optional)</span>}
              </label>
              <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>How did you hear about Studyroom?</label>
              <select value={referral} onChange={e => setReferral(e.target.value)}
                style={{ ...inp, cursor: "pointer" }}
                title="How did you hear about Studyroom?">
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
            {!parentOptional && (
              <Checkbox checked={consentGuardian} onChange={() => setConsentGuardian(v => !v)}>
                I am the parent or legal guardian of the student
              </Checkbox>
            )}

            {/* Subscription */}
            <div style={{ ...secLabel, marginTop: 6 }}>Subscription <div style={{ flex: 1, height: 1, background: "#edf0f3" }} /></div>

            <div style={{
              background: "#f4f7f9", borderRadius: 12, padding: "14px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>Monthly membership</div>
                <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2, lineHeight: 1.5 }}>
                  Full hub access, sessions and tutor tools.
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#456071", lineHeight: 1 }}>$9.95</div>
                <div style={{ fontSize: 10, color: "#8a96a3" }}>/ month</div>
              </div>
            </div>

            {["Student hub with deadline tracker", "Mood and study tools", "Cancel anytime"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", background: "#bde4af",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <div style={{ width: 5, height: 4, borderLeft: "1.5px solid #2d5a24", borderBottom: "1.5px solid #2d5a24", transform: "rotate(-45deg) translate(1px,-1px)" }} />
                </div>
                <div style={{ fontSize: 12, color: "#456071" }}>{f}</div>
              </div>
            ))}

            {error && <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", margin: "14px 0" }}>{error}</div>}

            <button type="button" onClick={handleStudentSignUp} disabled={loading} style={{ ...submitBtn, marginTop: 16 }}>
              {loading ? "Creating your account..." : "Create account and continue to payment →"}
            </button>
            <div style={{ fontSize: 10, color: "#b0bec5", textAlign: "center", marginTop: 9 }}>
              Secured by Stripe. Cancel anytime.
            </div>
          </div>
        )}

        {/* ── TUTOR ACCESS ── */}
        {tab === "tutor" && (
          <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>

            {/* Inner toggle */}
            <div style={{
              display: "flex", background: "#f4f7f9", borderRadius: 10,
              padding: 4, gap: 4, marginBottom: 20,
            }}>
              {(["code", "request"] as TutorMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setTutorMode(m); setError(null); setSuccess(null); }}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                    background: tutorMode === m ? "#fff" : "transparent",
                    color: tutorMode === m ? "#456071" : "#748398",
                    boxShadow: tutorMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {m === "code" ? "I have an access code" : "Request access"}
                </button>
              ))}
            </div>

            {/* Code mode */}
            {tutorMode === "code" && !success && (
              <>
                <div style={infoBox}>
                  Enter the code from your Studyroom welcome email to create your tutor account.
                </div>
                <div style={field}>
                  <label style={lbl}>Access code</label>
                  <input
                    value={tutorCode}
                    onChange={e => { setTutorCode(e.target.value.toUpperCase()); setError(null); }}
                    placeholder="TUTOR-XXXXXX"
                    style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.15em", fontSize: 15, textAlign: "center" }}
                  />
                </div>
                <div style={field}>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={tutorEmail}
                    onChange={e => { setTutorEmail(e.target.value); setError(null); }}
                    placeholder="Same email you registered with" style={inp} />
                </div>
                <div style={field}>
                  <label style={lbl}>Password</label>
                  <input type="password" value={tutorPassword}
                    onChange={e => { setTutorPassword(e.target.value); setError(null); }}
                    placeholder="Choose a password"
                    autoComplete="new-password" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Confirm password</label>
                  <input type="password" value={tutorConfirmPassword}
                    onChange={e => { setTutorConfirmPassword(e.target.value); setError(null); }}
                    placeholder="Re-enter password"
                    autoComplete="new-password" style={inp} />
                </div>
                {error && errBox}
                <button type="button" onClick={handleTutorCodeRedeem} disabled={loading} style={submitBtn}>
                  {loading ? "Activating..." : "Activate tutor account →"}
                </button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: "#8a96a3" }}>
                    Don&apos;t have a code?{" "}
                    <button
                      type="button"
                      onClick={() => { setTutorMode("request"); setError(null); }}
                      style={{ background: "none", border: "none", color: "#456071", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}
                    >
                      Request access instead
                    </button>
                  </span>
                </div>
              </>
            )}

            {/* Request mode */}
            {tutorMode === "request" && !success && (
              <>
                <div style={infoBox}>
                  Not yet a Studyroom tutor? Submit your details and we&apos;ll review your application. You&apos;ll receive a welcome email with your personal access code once approved.
                </div>
                <div style={field}>
                  <label style={lbl}>Your name</label>
                  <input value={tutorReqName}
                    onChange={e => { setTutorReqName(e.target.value); setError(null); }}
                    placeholder="Full name" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Email address</label>
                  <input type="email" value={tutorReqEmail}
                    onChange={e => { setTutorReqEmail(e.target.value); setError(null); }}
                    placeholder="you@email.com" style={inp} />
                </div>
                {error && errBox}
                <button type="button" onClick={handleTutorRequest} disabled={loading} style={submitBtn}>
                  {loading ? "Sending..." : "Request access"}
                </button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: "#8a96a3" }}>
                    Already have a code?{" "}
                    <button
                      type="button"
                      onClick={() => { setTutorMode("code"); setError(null); }}
                      style={{ background: "none", border: "none", color: "#456071", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}
                    >
                      Enter it here
                    </button>
                  </span>
                </div>
              </>
            )}

            {/* Success */}
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
