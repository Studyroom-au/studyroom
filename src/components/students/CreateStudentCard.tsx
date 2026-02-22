"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function CreateStudentCard({ onDone }: { onDone?: () => void }) {
  const [studentName, setStudentName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function createStudent() {
    setMsg(null);
    setBusy(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      const idToken = await user.getIdToken();

      const res = await fetch("/api/students/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentName,
          yearLevel,
          parentName,
          parentEmail,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Create failed");
      }

      setStudentName("");
      setYearLevel("");
      setParentName("");
      setParentEmail("");
      setMsg("Student created ✅");
      onDone?.();
    } catch (e: unknown) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-[color:var(--ink)]">Enrol new student</div>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Create a new student and parent profile.
      </p>

      <div className="mt-3 grid gap-2">
        <input
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="Student name"
          className="rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          placeholder="Year level"
          className="rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          placeholder="Parent name"
          className="rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm"
        />
        <input
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          placeholder="Parent email"
          className="rounded-2xl border border-[color:var(--ring)] px-3 py-2 text-sm"
        />

        <button
          type="button"
          onClick={createStudent}
          disabled={busy}
          className="brand-cta rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create student"}
        </button>
      </div>

      {msg && <div className="mt-2 text-xs text-[color:var(--muted)]">{msg}</div>}
    </div>
  );
}
