"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SubscribePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }

      const email = u.email ?? "";
      setUserEmail(email);

      // If already subscribed, redirect
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      if (userData.subscriptionStatus === "active") {
        router.replace(userData.onboardingComplete ? "/hub" : "/onboarding");
        return;
      }

      setLoading(false);
    });
    return () => off();
  }, [router]);

  async function startCheckout() {
    setPaying(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in.");
      const idToken = await u.getIdToken();

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to start checkout.");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo / wordmark */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 6 }}>
            Studyroom
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
            Start learning today
          </div>
          <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 6, lineHeight: 1.5 }}>
            Personalised tutoring for Logan and Brisbane Southside students.
          </div>
        </div>

        {/* Plan card */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "24px 24px 20px",
          border: "1px solid rgba(0,0,0,0.07)",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428" }}>Monthly membership</div>
              <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 3, lineHeight: 1.5 }}>
                Full access to your student hub, session booking, and tutor tools.
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428" }}>$9.95</div>
              <div style={{ fontSize: 11, color: "#8a96a3" }}>/ month</div>
            </div>
          </div>

          {/* Feature list */}
          {[
            "Student hub with deadline tracker",
            "Mood and study tools",
            "Session history and tutor notes",
            "Cancel anytime",
          ].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#d4edcc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 6, height: 4, borderLeft: "1.5px solid #2d5a24", borderBottom: "1.5px solid #2d5a24", transform: "rotate(-45deg) translate(1px,-1px)" }} />
              </div>
              <div style={{ fontSize: 12, color: "#456071" }}>{f}</div>
            </div>
          ))}

          {error && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginTop: 12 }}>
              {error}
            </div>
          )}

          <button
            onClick={startCheckout}
            disabled={paying}
            style={{
              width: "100%", marginTop: 18, background: "#456071", color: "#fff",
              border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14,
              fontWeight: 700, cursor: paying ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: paying ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {paying ? "Redirecting to payment..." : "Subscribe — $9.95/month"}
          </button>

          <div style={{ fontSize: 11, color: "#8a96a3", textAlign: "center", marginTop: 10 }}>
            Secured by Stripe. Cancel anytime from your account.
          </div>
        </div>

        {/* Tutor access link */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => router.push("/tutor-access")}
            style={{ background: "none", border: "none", fontSize: 12, color: "#456071", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            I&apos;m a tutor — enter my access code →
          </button>
        </div>

        {/* Sign out */}
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button
            onClick={() => signOut(auth).then(() => router.push("/"))}
            style={{ background: "none", border: "none", fontSize: 11, color: "#b0bec5", cursor: "pointer", fontFamily: "inherit" }}
          >
            Sign out ({userEmail})
          </button>
        </div>
      </div>
    </div>
  );
}
