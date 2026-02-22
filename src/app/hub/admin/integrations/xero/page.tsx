"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export default function AdminXeroIntegrationsPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connectXero() {
    setErr(null);
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      const idToken = await user.getIdToken();

      const res = await fetch("/api/xero/auth/start", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to start Xero auth");

      const consentUrl = String(json?.consentUrl || "");
      if (!consentUrl) throw new Error("Missing consentUrl from server.");

      window.location.href = consentUrl;
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Xero Integration</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Connect Studyroom to Xero so invoices can be created from sessions.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={connectXero}
            disabled={loading}
            className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {loading ? "Connecting…" : "Connect Xero"}
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
