"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const YEAR_LEVELS = [
  "Prep","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6",
  "Year 7","Year 8","Year 9","Year 10","Year 11","Year 12",
];

const REFERRAL_OPTIONS = [
  "Google search",
  "Facebook / Instagram",
  "Friend or family referral",
  "School recommendation",
  "Flyer or poster",
  "Other",
];

function getAge(dobString: string): number | null {
  if (!dobString) return null;
  const today = new Date();
  const birth = new Date(dobString);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [dob, setDob] = useState("");
  const [school, setSchool] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [referral, setReferral] = useState("");
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);

  const studentAge = getAge(dob);
  const parentOptional = studentAge !== null && studentAge >= 16;

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      setLoginEmail(u.email ?? "");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && snap.data().onboardingComplete) {
        router.replace("/hub");
        return;
      }
      setLoading(false);
    });
    return () => off();
  }, [router]);

  async function handleSubmit() {
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

    setSaving(true);
    setError(null);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentName,
          yearLevel,
          dob,
          school,
          subjects: [],
          parentName: parentOptional ? "" : parentName,
          parentEmail: parentOptional ? loginEmail : parentEmail,
          parentPhone: parentOptional ? "" : parentPhone,
          referral,
          loginEmail,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Something went wrong.");
      router.replace("/hub");
    } catch (err) {
      console.error("[onboarding]", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading...</div>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e4eaef", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, fontFamily: "inherit", color: "#1d2428",
    outline: "none", background: "#fafbfc", boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#748398",
    textTransform: "uppercase" as const, letterSpacing: "0.12em",
    marginBottom: 6, display: "block",
  };
  const field: React.CSSProperties = { marginBottom: 14 };
  const divider: React.CSSProperties = {
    height: 1, background: "rgba(0,0,0,0.06)", margin: "6px 0 18px",
  };
  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#748398",
    textTransform: "uppercase" as const, letterSpacing: "0.16em",
    marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
  };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "32px 16px 60px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 6 }}>
            Studyroom · Setup
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
            Tell us about your student
          </div>
          <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 5 }}>
            Just a few details so we can find the right tutor.
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 22px 20px", border: "1px solid rgba(0,0,0,0.07)" }}>

          {/* Student section */}
          <div style={secLabel}>
            Student
            <div style={{ flex: 1, height: 1, background: "#edf0f3" }} />
          </div>

          <div style={field}>
            <label style={lbl}>Student&apos;s name</label>
            <input style={inp} value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="First name" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Year level</label>
              <select value={yearLevel} onChange={e => setYearLevel(e.target.value)}
                style={{ ...inp, cursor: "pointer" }}>
                <option value="">Select year</option>
                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dob" style={lbl}>Date of birth</label>
              <input id="dob" type="date" style={inp} value={dob}
                onChange={e => setDob(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>
              School{" "}
              <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}>
                (optional)
              </span>
            </label>
            <input style={inp} value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder="School name" />
          </div>

          <div style={divider} />

          {/* Parent section */}
          <div style={secLabel}>
            Parent / guardian
            {parentOptional && (
              <span style={{
                fontSize: 9, fontWeight: 600, color: "#b8cad6",
                background: "#f4f7f9", borderRadius: 20, padding: "2px 8px",
                letterSpacing: "0.06em", textTransform: "uppercase",
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
            <input style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }}
              value={parentName} onChange={e => setParentName(e.target.value)}
              placeholder="Full name" />
          </div>

          <div style={field}>
            <label style={lbl}>
              Parent email
              {parentOptional && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}> (optional)</span>}
            </label>
            <input type="email"
              style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }}
              value={parentEmail} onChange={e => setParentEmail(e.target.value)}
              placeholder="parent@email.com" />
            <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 5 }}>
              All invoices and session updates go here.
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>
              Phone
              {parentOptional && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "#b0bec5" }}> (optional)</span>}
            </label>
            <input type="tel"
              style={{ ...inp, opacity: parentOptional ? 0.6 : 1 }}
              value={parentPhone} onChange={e => setParentPhone(e.target.value)}
              placeholder="04xx xxx xxx" />
          </div>

          <div style={divider} />

          {/* Referral */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="referral" style={lbl}>How did you hear about Studyroom?</label>
            <select id="referral" value={referral} onChange={e => setReferral(e.target.value)}
              style={{ ...inp, cursor: "pointer" }}>
              <option value="">Select...</option>
              {REFERRAL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={divider} />

          {/* Consent */}
          <div style={secLabel}>
            Consent
            <div style={{ flex: 1, height: 1, background: "#edf0f3" }} />
          </div>

          {[
            {
              checked: consentTerms,
              set: () => setConsentTerms(v => !v),
              content: (
                <span>
                  I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                    terms of service
                  </a>
                </span>
              ),
            },
            {
              checked: consentPrivacy,
              set: () => setConsentPrivacy(v => !v),
              content: (
                <span>
                  I agree to the{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: "#456071", fontWeight: 600, textDecoration: "underline" }}>
                    privacy policy
                  </a>
                </span>
              ),
            },
            ...(!parentOptional ? [{
              checked: consentGuardian,
              set: () => setConsentGuardian(v => !v),
              content: <span>I am the parent or legal guardian of the student</span>,
            }] : []),
          ].map((item, i) => (
            <div key={i} onClick={item.set} style={{
              display: "flex", alignItems: "flex-start", gap: 11,
              marginBottom: 13, cursor: "pointer", userSelect: "none" as const,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: item.checked ? "none" : "2px solid #d4dce4",
                background: item.checked ? "#456071" : "#fafbfc",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {item.checked && (
                  <div style={{
                    width: 5, height: 4,
                    borderLeft: "2px solid #fff", borderBottom: "2px solid #fff",
                    transform: "rotate(-45deg) translate(1px,-1px)",
                  }} />
                )}
              </div>
              <div style={{ fontSize: 13, color: "#1d2428", lineHeight: 1.6 }}>
                {item.content}
              </div>
            </div>
          ))}

          {error && (
            <div style={{
              fontSize: 12, color: "#c0445e", background: "#fce8ee",
              borderRadius: 9, padding: "8px 12px", marginBottom: 14, marginTop: 4,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: "100%", background: "#456071", color: "#fff", border: "none",
              borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: saving ? 0.7 : 1, marginTop: 8,
            }}
          >
            {saving ? "Setting up your account..." : "Go to my hub →"}
          </button>

          <div style={{ fontSize: 11, color: "#b0bec5", textAlign: "center", marginTop: 10 }}>
            Logged in as {loginEmail}
          </div>
        </div>
      </div>
    </div>
  );
}
