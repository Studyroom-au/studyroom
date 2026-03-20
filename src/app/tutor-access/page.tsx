"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function TutorAccessPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) { router.replace("/"); return; }
      setAuthReady(true);
    });
    return () => off();
  }, [router]);

  async function redeemCode() {
    if (!code.trim()) { setError("Please enter your access code."); return; }
    setLoading(true);
    setError(null);

    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const res = await fetch("/api/tutor/redeem-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Invalid code.");

      router.replace("/hub/tutor");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 6 }}>
            Studyroom · Tutor access
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
            Enter your access code
          </div>
          <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 6, lineHeight: 1.5 }}>
            You should have received this in your welcome email.
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "24px", border: "1px solid rgba(0,0,0,0.07)" }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && redeemCode()}
            placeholder="e.g. TUTOR-A1B2C3"
            style={{
              width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10,
              padding: "10px 14px", fontSize: 15, fontFamily: "monospace",
              color: "#1d2428", outline: "none", textAlign: "center",
              letterSpacing: "0.12em", boxSizing: "border-box", marginBottom: 12,
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            onClick={redeemCode}
            disabled={loading || !authReady}
            style={{
              width: "100%", background: "#456071", color: "#fff", border: "none",
              borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Verifying..." : "Activate tutor access"}
          </button>

          <button
            onClick={() => router.back()}
            style={{ width: "100%", marginTop: 10, background: "none", border: "none", fontSize: 12, color: "#8a96a3", cursor: "pointer", fontFamily: "inherit" }}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
