// src/components/FeedbackButton.tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const TYPES = ["Feedback", "Bug", "Confusing", "Idea"] as const;
type FeedbackType = typeof TYPES[number];

export default function FeedbackButton({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("Feedback");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg || saving) return;
    const u = auth.currentUser;
    if (!u) return;
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, "betaFeedback"), {
        type,
        message: msg,
        uid: u.uid,
        email: u.email ?? null,
        role: role ?? null,
        page: pathname,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setMessage("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setOpen(false);
    setDone(false);
    setError(null);
    setMessage("");
    setType("Feedback");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          left: 72,
          zIndex: 50,
          background: "#456071",
          color: "#fff",
          border: "none",
          borderRadius: 20,
          padding: "9px 18px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          boxShadow: "0 2px 10px rgba(69,96,113,0.3)",
          letterSpacing: "0.02em",
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 70,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "flex-end", justifyContent: "flex-start",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 18, padding: "22px 20px",
              border: "1px solid rgba(0,0,0,0.06)", width: 340, maxWidth: "calc(100vw - 40px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              marginBottom: 52,
              marginLeft: 52,
            }}
          >
            {done ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2428", marginBottom: 6 }}>
                  Thanks for the feedback!
                </div>
                <div style={{ fontSize: 12, color: "#8a96a3", lineHeight: 1.6, marginBottom: 18 }}>
                  We&apos;ll use it to improve Studyroom.
                </div>
                <button
                  type="button"
                  onClick={close}
                  style={{
                    background: "#456071", color: "#fff", border: "none",
                    borderRadius: 10, padding: "8px 22px", fontSize: 12,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428" }}>Share feedback</div>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 18, color: "#8a96a3", padding: 4, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20,
                          border: `1.5px solid ${type === t ? "#456071" : "rgba(0,0,0,0.12)"}`,
                          background: type === t ? "#456071" : "transparent",
                          color: type === t ? "#fff" : "#748398",
                          cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <textarea
                    placeholder={`Describe the ${type.toLowerCase()}…`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={saving}
                    rows={4}
                    style={{
                      border: "1.5px solid #e4eaef", borderRadius: 10, padding: "9px 11px",
                      fontSize: 12, color: "#1d2428", background: "#fafbfc", outline: "none",
                      fontFamily: "inherit", resize: "vertical", width: "100%",
                      boxSizing: "border-box", minHeight: 90,
                    }}
                  />

                  {error && (
                    <div style={{ fontSize: 11, color: "#dc2626" }}>{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={saving || !message.trim()}
                    style={{
                      background: saving || !message.trim() ? "#b0bec5" : "#456071",
                      color: "#fff", border: "none", borderRadius: 10, padding: "9px 0",
                      fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                      cursor: saving || !message.trim() ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {saving ? "Sending…" : "Send feedback"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
