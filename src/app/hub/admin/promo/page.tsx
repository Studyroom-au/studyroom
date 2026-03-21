"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type PromoCode = {
  id: string;
  code: string;
  trialDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: { toDate?: () => Date } | null;
  active: boolean;
  createdAt: { toDate?: () => Date } | null;
  createdBy: string;
};

const lbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#748398",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 5,
  display: "block",
};

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
  boxSizing: "border-box",
};

export default function AdminPromoPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newMaxUses, setNewMaxUses] = useState<number | "">("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) { router.replace("/"); return; }
      setUid(u.uid);
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, "promoCodes"), orderBy("createdAt", "desc")),
      snap =>
        setPromoCodes(
          snap.docs.map(d => ({ id: d.id, ...d.data() })) as PromoCode[]
        )
    );
    return () => unsub();
  }, [uid]);

  async function handleCreateCode() {
    if (!newCode.trim()) { setError("Please enter a code."); return; }
    setCreatingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const u = auth.currentUser;
      if (!u) return;
      const idToken = await u.getIdToken();

      const res = await fetch("/api/admin/promo/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          trialDays: 7,
          maxUses: newMaxUses !== "" ? Number(newMaxUses) : null,
          expiresAt: newExpiry || null,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) { setError(data.error ?? "Failed to create code."); return; }

      setNewCode("");
      setNewMaxUses("");
      setNewExpiry("");
      setSuccess("Promo code created.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setCreatingCode(false);
    }
  }

  async function handleToggleCode(codeId: string, active: boolean) {
    try {
      await updateDoc(doc(db, "promoCodes", codeId), { active });
    } catch {
      setError("Failed to update code.");
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#82977e", marginBottom: 6,
        }}>
          Studyroom · Admin
        </div>
        <h1 style={{
          fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0,
          letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Promo Codes
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          Create and manage 7-day trial access codes for students
        </p>
      </div>

      {/* Feedback messages */}
      {error && (
        <div style={{
          fontSize: 12, color: "#c0445e", background: "#fce8ee",
          borderRadius: 9, padding: "8px 12px", marginBottom: 14,
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          fontSize: 12, color: "#2d5a24", background: "#d4edcc",
          borderRadius: 9, padding: "8px 12px", marginBottom: 14,
        }}>
          {success}
        </div>
      )}

      {/* Create new code */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: "18px 18px",
        border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#748398", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>Create new code</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12,
        }}>
          <div>
            <label style={lbl}>Code</label>
            <input
              value={newCode}
              onChange={e => { setNewCode(e.target.value.toUpperCase()); setError(null); setSuccess(null); }}
              placeholder="STUDYROOM7"
              style={{ ...inp, fontFamily: "monospace", letterSpacing: "0.08em" }}
            />
          </div>
          <div>
            <label style={lbl}>Max uses (blank = unlimited)</label>
            <input
              type="number"
              value={newMaxUses}
              onChange={e => setNewMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 50"
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Expires (optional)</label>
            <input
              type="date"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              style={inp}
            />
          </div>
        </div>

        <button
          onClick={handleCreateCode}
          disabled={creatingCode}
          style={{
            background: "#456071", color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 20px", fontSize: 12,
            fontWeight: 700, cursor: creatingCode ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: creatingCode ? 0.7 : 1,
          }}
        >
          {creatingCode ? "Creating..." : "Create code"}
        </button>
      </div>

      {/* Existing codes */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
        textTransform: "uppercase", color: "#748398", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span>Existing codes</span>
        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
      </div>

      {promoCodes.length === 0 && (
        <div style={{ fontSize: 13, color: "#8a96a3", padding: "12px 0" }}>
          No promo codes yet.
        </div>
      )}

      {promoCodes.map(c => (
        <div key={c.id} style={{
          background: "#fff", borderRadius: 14, padding: "11px 16px",
          border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#1d2428",
              fontFamily: "monospace", letterSpacing: "0.08em",
            }}>
              {c.code}
            </div>
            <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
              {c.trialDays} days ·{" "}
              {c.maxUses
                ? `${c.usedCount ?? 0}/${c.maxUses} uses`
                : `${c.usedCount ?? 0} uses (unlimited)`}
              {c.expiresAt
                ? ` · expires ${new Date(c.expiresAt.toDate?.() ?? c.expiresAt as unknown as Date).toLocaleDateString("en-AU")}`
                : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
              background: c.active ? "#d4edcc" : "#f4f7f9",
              color: c.active ? "#2d5a24" : "#748398",
            }}>
              {c.active ? "Active" : "Inactive"}
            </span>
            <button
              onClick={() => handleToggleCode(c.id, !c.active)}
              style={{
                background: "#f4f7f9", color: "#456071", border: "none",
                borderRadius: 8, padding: "4px 12px", fontSize: 11,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {c.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}

      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/hub/admin")}
        style={{
          background: "white", color: "#456071", border: "1.5px solid #b8cad6",
          borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit", marginTop: 16,
        }}
      >
        ← Back to Admin
      </button>
    </div>
  );
}
