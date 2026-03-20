"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, limit, getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

export default function ProfilePage() {
  const router = useRouter();
  const role = useUserRole();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Student record fields (read-only)
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [school, setSchool] = useState("");
  const [dob, setDob] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);

  // Parent / guardian (read-only, from client doc)
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUid(null);
        setEmail(null);
        setLoading(false);
        router.replace("/");
        return;
      }

      setUid(u.uid);
      setEmail(u.email ?? null);

      try {
        // Load user doc
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        setDisplayName(
          String(userData.displayName || u.displayName || u.email?.split("@")[0] || "")
        );

        // Load student record linked to this user
        const studentSnap = await getDocs(
          query(collection(db, "students"), where("hubUid", "==", u.uid), limit(1))
        );
        const studentData = studentSnap.empty ? null : studentSnap.docs[0].data();

        if (studentData) {
          setStudentName(String(studentData.studentName || ""));
          setYearLevel(String(studentData.yearLevel || ""));
          setSchool(String(studentData.school || ""));
          setDob(String(studentData.dob || ""));
          setSubjects(
            Array.isArray(studentData.subjects)
              ? studentData.subjects.filter((s: unknown): s is string => typeof s === "string")
              : []
          );

          // Load client record for parent info
          if (studentData.clientId) {
            const clientSnap = await getDoc(doc(db, "clients", studentData.clientId));
            if (clientSnap.exists()) {
              const clientData = clientSnap.data();
              setParentName(String(clientData.parentName || ""));
              setParentEmail(String(clientData.parentEmail || ""));
              setParentPhone(String(clientData.parentPhone || ""));
            }
          }
        }
      } catch (e) {
        console.error("[profile] load failed", e);
        setError("Could not load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await setDoc(doc(db, "users", uid), {
        displayName: displayName.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage("Profile updated.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e4eaef", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
    color: "#1d2428", outline: "none", background: "#fafbfc",
    boxSizing: "border-box",
  };

  const fieldLbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#748398",
    textTransform: "uppercase", letterSpacing: "0.1em",
    marginBottom: 6, display: "block",
  };

  const sectionHdr = (label: string) => (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
      textTransform: "uppercase", color: "#748398", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
    </div>
  );

  if (loading) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading your profile…</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "0 0 60px" }}>

      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: "0 0 20px 20px",
        padding: "16px 20px 14px", marginBottom: 20,
        border: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
              Studyroom
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
              {displayName || "Your profile"}
            </div>
            <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 3 }}>
              {email}
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: role === "tutor" ? "#edf2f6" : role === "admin" ? "#fce8ee" : "#edf5eb",
                color: role === "tutor" ? "#456071" : role === "admin" ? "#c0445e" : "#2d5a24",
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>
                {role === "admin" ? "Admin" : role === "tutor" ? "Tutor" : "Student"}
              </span>
            </div>
          </div>

          {/* Back to hub button */}
          <button
            type="button"
            onClick={() => router.push("/hub")}
            style={{
              fontSize: 12, fontWeight: 600, color: "#677a8a",
              background: "#f4f7f9", border: "none", borderRadius: 20,
              padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
              flexShrink: 0, marginTop: 4,
            }}
          >
            ← Hub
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Success / error message */}
        {(message || error) && (
          <div style={{
            fontSize: 12, borderRadius: 10, padding: "9px 14px", marginBottom: 14,
            background: error ? "#fce8ee" : "#d4edcc",
            color: error ? "#c0445e" : "#2d5a24",
          }}>
            {error ?? message}
          </div>
        )}

        {/* ── STUDENT INFO (read-only) ── */}
        {(studentName || yearLevel || subjects.length > 0) && (
          <div style={{
            background: "#fff", borderRadius: 18, padding: "18px 18px",
            border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            {sectionHdr("Student")}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: subjects.length > 0 ? 14 : 0 }}>
              {studentName && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Name</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>{studentName}</div>
                </div>
              )}
              {yearLevel && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Year level</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>{yearLevel}</div>
                </div>
              )}
              {dob && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Date of birth</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>
                    {new Date(dob).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              )}
              {school && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>School</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>{school}</div>
                </div>
              )}
            </div>

            {subjects.length > 0 && (
              <div>
                <div style={{ ...fieldLbl, marginBottom: 8 }}>Subjects</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {subjects.map(s => (
                    <span key={s} style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 12px",
                      borderRadius: 20, background: "#edf2f6", color: "#456071",
                    }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: "#b0bec5" }}>
              To update student details, contact your tutor or Studyroom admin.
            </div>
          </div>
        )}

        {/* ── PARENT / GUARDIAN (read-only) ── */}
        {(parentName || parentEmail || parentPhone) && (
          <div style={{
            background: "#fff", borderRadius: 18, padding: "18px 18px",
            border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14,
          }}>
            {sectionHdr("Parent / guardian")}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {parentName && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Name</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>{parentName}</div>
                </div>
              )}
              {parentEmail && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 13, color: "#456071", fontWeight: 600 }}>{parentEmail}</div>
                </div>
              )}
              {parentPhone && (
                <div>
                  <div style={{ ...fieldLbl, marginBottom: 4 }}>Phone</div>
                  <div style={{ fontSize: 13, color: "#1d2428", fontWeight: 600 }}>{parentPhone}</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: "#b0bec5" }}>
              To update parent details, contact Studyroom admin.
            </div>
          </div>
        )}

        {/* ── ACCOUNT (editable) ── */}
        <div style={{
          background: "#fff", borderRadius: 18, padding: "18px 18px",
          border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14,
        }}>
          {sectionHdr("Account")}

          <div style={{ marginBottom: 14 }}>
            <label style={fieldLbl}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={inp}
            />
          </div>

          <div>
            <label style={fieldLbl}>Email</label>
            <div style={{
              border: "1.5px solid #e4eaef", borderRadius: 10,
              padding: "9px 12px", fontSize: 13, color: "#8a96a3",
              background: "#f4f7f9",
            }}>
              {email}
            </div>
            <div style={{ fontSize: 11, color: "#b0bec5", marginTop: 5 }}>
              To change your email contact Studyroom admin.
            </div>
          </div>
        </div>

        {/* ── LEGAL ── */}
        <div style={{
          background: "#fff", borderRadius: 18, padding: "18px 18px",
          border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
        }}>
          {sectionHdr("Legal")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { label: "Terms of service", href: "/legal/terms" },
              { label: "Privacy policy", href: "/legal/privacy" },
              { label: "Online safety tips", href: "/legal/safety" },
            ].map(l => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 12, fontWeight: 600, color: "#456071",
                  background: "#edf2f6", borderRadius: 20, padding: "5px 14px",
                  textDecoration: "none",
                }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? "#b8cad6" : "#456071", color: "#fff",
            border: "none", borderRadius: 12, padding: "12px 28px",
            fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", width: "100%",
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

      </div>
    </div>
  );
}
