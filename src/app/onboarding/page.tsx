"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, serverTimestamp, collection,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const SUBJECTS = ["Maths", "English", "Chemistry", "Physics", "Biology", "Japanese", "Study Skills"];
const YEAR_LEVELS = ["Prep", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"];

export default function OnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    studentName: "",
    yearLevel: "",
    school: "",
    suburb: "",
    subjects: [] as string[],
    goals: "",
    parentName: "",
    parentPhone: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      // If already onboarded, go to hub
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && snap.data().onboardingComplete) {
        router.replace("/hub");
        return;
      }
      setLoading(false);
    });
    return () => off();
  }, [router]);

  function toggleSubject(s: string) {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(s)
        ? prev.subjects.filter(x => x !== s)
        : [...prev.subjects, s],
    }));
  }

  async function handleSubmit() {
    const u = auth.currentUser;
    if (!u) return;

    if (!form.studentName.trim()) { setError("Student name is required."); return; }
    if (!form.yearLevel) { setError("Please select a year level."); return; }
    if (!form.suburb.trim()) { setError("Suburb is required."); return; }
    if (form.subjects.length === 0) { setError("Please select at least one subject."); return; }

    setSaving(true);
    setError(null);

    try {
      const idToken = await u.getIdToken();
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(form),
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
    width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, fontFamily: "inherit", color: "#1d2428",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#748398", textTransform: "uppercase",
    letterSpacing: "0.12em", marginBottom: 6, display: "block",
  };
  const section: React.CSSProperties = { marginBottom: 18 };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "32px 16px 60px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 6 }}>
            Studyroom · Welcome
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
            Tell us about your student
          </div>
          <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 6 }}>
            This helps us match you with the right tutor. Takes about 2 minutes.
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "22px 22px", border: "1px solid rgba(0,0,0,0.07)" }}>

          <div style={section}>
            <label style={labelStyle}>Student name</label>
            <input style={inp} value={form.studentName} onChange={e => setForm(p => ({ ...p, studentName: e.target.value }))} placeholder="First name" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Year level</label>
              <select
                value={form.yearLevel}
                onChange={e => setForm(p => ({ ...p, yearLevel: e.target.value }))}
                style={{ ...inp, cursor: "pointer" }}
              >
                <option value="">Select year</option>
                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Suburb</label>
              <input style={inp} value={form.suburb} onChange={e => setForm(p => ({ ...p, suburb: e.target.value }))} placeholder="e.g. Meadowbrook" />
            </div>
          </div>

          <div style={section}>
            <label style={labelStyle}>School (optional)</label>
            <input style={inp} value={form.school} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} placeholder="School name" />
          </div>

          <div style={section}>
            <label style={labelStyle}>Subjects needed</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all 0.15s",
                    background: form.subjects.includes(s) ? "#456071" : "#f4f7f9",
                    color: form.subjects.includes(s) ? "#fff" : "#677a8a",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={section}>
            <label style={labelStyle}>Learning goals (optional)</label>
            <textarea
              value={form.goals}
              onChange={e => setForm(p => ({ ...p, goals: e.target.value }))}
              placeholder="e.g. Improve grades in Maths, prepare for OP score..."
              rows={2}
              style={{ ...inp, resize: "none" }}
            />
          </div>

          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0 18px" }} />

          <div style={{ fontSize: 11, fontWeight: 700, color: "#748398", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
            Parent / guardian
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Name (optional)</label>
              <input style={inp} value={form.parentName} onChange={e => setForm(p => ({ ...p, parentName: e.target.value }))} placeholder="Parent name" />
            </div>
            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input style={inp} value={form.parentPhone} onChange={e => setForm(p => ({ ...p, parentPhone: e.target.value }))} placeholder="04xx xxx xxx" type="tel" />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginBottom: 14 }}>
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
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Setting up your account..." : "Go to my hub →"}
          </button>
        </div>
      </div>
    </div>
  );
}
