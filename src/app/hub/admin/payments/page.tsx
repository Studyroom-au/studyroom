"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export default function AdminPaymentsPage() {
  const [fromISO, setFromISO] = useState("");
  const [toISO, setToISO] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    const user = auth.currentUser;
    if (!user) return setErr("Not signed in.");

    const idToken = await user.getIdToken();
    const res = await fetch("/api/payments/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ fromISO, toISO }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(json?.error || "Failed");

    setRows(json.byTutor || []);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Tutor pay report</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          This doesn’t replace ABN invoices — it tells you what to pay and what tutors must include.
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <input
            className="rounded-2xl border p-2 text-sm"
            placeholder="From (YYYY-MM-DD)"
            value={fromISO}
            onChange={(e) => setFromISO(e.target.value)}
          />
          <input
            className="rounded-2xl border p-2 text-sm"
            placeholder="To (YYYY-MM-DD)"
            value={toISO}
            onChange={(e) => setToISO(e.target.value)}
          />
          <button onClick={run} className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold">
            Generate
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[color:var(--ink)]">Results</h2>

        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.tutorId} className="rounded-2xl border p-3 text-sm">
              <div><b>Tutor:</b> {r.tutorId}</div>
              <div><b>Sessions:</b> {r.sessions}</div>
              <div><b>Total:</b> ${(r.totalCents / 100).toFixed(2)}</div>
            </div>
          ))}
          {!rows.length && <div className="text-sm text-[color:var(--muted)]">No data yet.</div>}
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 text-sm">
          <b>What tutors must include on their ABN invoice:</b>
          <ul className="mt-2 list-disc pl-5 text-[color:var(--muted)]">
            <li>ABN + “Tax Invoice” label</li>
            <li>Invoice date + invoice number</li>
            <li>Pay period (weekly / fortnightly / monthly)</li>
            <li>Total sessions/hours + rate</li>
            <li>Total amount + bank details</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
