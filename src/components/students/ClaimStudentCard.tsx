"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function ClaimStudentCard({ onDone }: { onDone?: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    setMsg(null);
    setBusy(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      const idToken = await user.getIdToken();
      const res = await fetch("/api/students/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ studentId: studentId.trim() }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Claim failed");
      }

      setStudentId("");
      setMsg("Student linked ✅");
      onDone?.();
    } catch (e: unknown) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-[color:var(--ink)]">Add existing student</div>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Paste the Student ID if they exist in the system but aren’t assigned yet.
      </p>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="Student ID (Firestore doc ID)"
          className="w-full rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]"
        />
        <button
          type="button"
          onClick={claim}
          disabled={busy || !studentId.trim()}
          className="brand-cta rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Linking…" : "Link student"}
        </button>
      </div>

      {msg && <div className="mt-2 text-xs text-[color:var(--muted)]">{msg}</div>}
    </div>
  );
}
