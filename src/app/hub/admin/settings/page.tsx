"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { CASUAL_PRICING_TIERS } from "@/lib/studyroom/billing";
import { DEFAULT_OPERATIONS_CUTOVER_ISO } from "@/lib/studyroom/operationsCutover";

type PackagePricingDoc = {
  package5PriceCents?: number;
  package10PriceCents?: number;
  updatedBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
};

type CasualPricingTierDoc = {
  effectiveFrom?: string;
  rates?: { in_home?: number; online?: number };
};

type CasualPricingSettingsDoc = {
  tiers?: CasualPricingTierDoc[];
  updatedBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
};

function centsToDollarsInput(cents?: number) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function formatCents(cents?: number) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateAU(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function todayBrisbaneDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<PackagePricingDoc | null>(null);
  const [package5, setPackage5] = useState("");
  const [package10, setPackage10] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Casual pricing (final pre-release operational addition) — a dated tier
  // list, not a single mutable value, so session.originalStartAt -> tier
  // stays the source of truth and a rate change never reprices history.
  const [casualDoc, setCasualDoc] = useState<CasualPricingSettingsDoc | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledInHome, setScheduledInHome] = useState("");
  const [scheduledOnline, setScheduledOnline] = useState("");
  const [casualSaving, setCasualSaving] = useState(false);
  const [casualMsg, setCasualMsg] = useState<string | null>(null);

  // Operations Cutover (final pre-release addition) — see
  // src/lib/studyroom/operationsCutover.ts. Never auto-written; this page is
  // the only place a real production value is ever set, and only when an
  // admin explicitly clicks Save.
  const [cutoverDoc, setCutoverDoc] = useState<{ operationsCutoverAt?: string; updatedBy?: string; updatedAt?: { toDate?: () => Date } | null } | null>(null);
  const [cutoverInput, setCutoverInput] = useState("");
  const [cutoverSaving, setCutoverSaving] = useState(false);
  const [cutoverMsg, setCutoverMsg] = useState<string | null>(null);

  async function loadCasualPricing() {
    const snap = await getDoc(doc(db, "settings", "casualPricingTiers"));
    setCasualDoc(snap.exists() ? (snap.data() as CasualPricingSettingsDoc) : null);
  }

  async function loadOperationsCutover() {
    const snap = await getDoc(doc(db, "settings", "operationsCutover"));
    setCutoverDoc(snap.exists() ? (snap.data() as typeof cutoverDoc) : null);
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "settings", "packagePricing"));
        if (snap.exists()) {
          const data = snap.data() as PackagePricingDoc;
          setCurrent(data);
          setPackage5(centsToDollarsInput(data.package5PriceCents));
          setPackage10(centsToDollarsInput(data.package10PriceCents));
        }
        await loadCasualPricing();
        await loadOperationsCutover();
      } finally {
        setLoading(false);
      }
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on auth mount, by design
  }, []);

  const effectiveCutoverIso = cutoverDoc?.operationsCutoverAt || DEFAULT_OPERATIONS_CUTOVER_ISO;
  const isCutoverConfigured = !!cutoverDoc?.operationsCutoverAt;

  async function saveOperationsCutover() {
    setCutoverMsg(null);
    const user = auth.currentUser;
    if (!user) return;
    if (!cutoverInput) {
      setCutoverMsg("Choose a cutover date.");
      return;
    }
    const iso = `${cutoverInput}T00:00:00+10:00`;
    if (isNaN(new Date(iso).getTime())) {
      setCutoverMsg("Invalid date.");
      return;
    }

    setCutoverSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/settings/operations-cutover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ operationsCutoverAt: iso }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCutoverMsg(json?.error || "Failed to save.");
      } else {
        setCutoverMsg("Operations cutover saved.");
        setCutoverInput("");
        await loadOperationsCutover();
      }
    } catch (e) {
      setCutoverMsg(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setCutoverSaving(false);
    }
  }

  const today = useMemo(() => todayBrisbaneDateString(), []);

  const sortedTiers = useMemo(() => {
    const tiers = casualDoc?.tiers ?? [];
    const valid = tiers.filter((t) => typeof t.effectiveFrom === "string" && !!t.rates);
    // Same fallback the server uses (casualPricing.ts) — if Settings has no
    // valid tiers yet, display the hardcoded seed list rather than "—".
    const source = valid.length > 0 ? valid : CASUAL_PRICING_TIERS;
    return [...source].sort((a, b) => (a.effectiveFrom as string).localeCompare(b.effectiveFrom as string));
  }, [casualDoc]);

  const currentCasualTier = useMemo(() => {
    const effective = sortedTiers.filter((t) => (t.effectiveFrom as string) <= today);
    return effective[effective.length - 1] ?? null;
  }, [sortedTiers, today]);

  const nextScheduledTier = useMemo(() => {
    const scheduled = sortedTiers.filter((t) => (t.effectiveFrom as string) > today);
    return scheduled[0] ?? null;
  }, [sortedTiers, today]);

  async function saveCasualPricing() {
    setCasualMsg(null);
    const user = auth.currentUser;
    if (!user) return;

    const inHomeCents = Math.round(Number(scheduledInHome) * 100);
    const onlineCents = Math.round(Number(scheduledOnline) * 100);
    if (!scheduledDate) {
      setCasualMsg("Choose an effective date for the scheduled change.");
      return;
    }
    if (!Number.isFinite(inHomeCents) || inHomeCents <= 0 || !Number.isFinite(onlineCents) || onlineCents <= 0) {
      setCasualMsg("Enter a valid rate (in dollars) for both in-home and online.");
      return;
    }

    setCasualSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/settings/casual-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          effectiveFrom: scheduledDate,
          inHomeRateCents: inHomeCents,
          onlineRateCents: onlineCents,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCasualMsg(json?.error || "Failed to save.");
      } else {
        setCasualMsg("Scheduled change saved.");
        setScheduledDate("");
        setScheduledInHome("");
        setScheduledOnline("");
        await loadCasualPricing();
      }
    } catch (e) {
      setCasualMsg(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setCasualSaving(false);
    }
  }

  async function save() {
    setMsg(null);
    const user = auth.currentUser;
    if (!user) return;

    const p5 = Math.round(Number(package5) * 100);
    const p10 = Math.round(Number(package10) * 100);
    if (!Number.isFinite(p5) || p5 <= 0 || !Number.isFinite(p10) || p10 <= 0) {
      setMsg("Enter a valid price (in dollars) for both packages.");
      return;
    }

    setSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/settings/package-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ package5PriceCents: p5, package10PriceCents: p10 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error || "Failed to save.");
      } else {
        setMsg("Saved.");
        setCurrent((prev) => ({ ...prev, package5PriceCents: p5, package10PriceCents: p10 }));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ paddingBottom: 100, maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 6 }}>
          Studyroom · Admin
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          Package and casual pricing. Package prices are the standard price used the moment a package is created or
          renewed — changing it here never alters the agreed price already recorded on an existing package.
        </p>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1f24", marginBottom: 14 }}>Package pricing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                5-session package — standard price (AUD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={package5}
                onChange={(e) => setPackage5(e.target.value)}
                placeholder="e.g. 425.00"
                style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                10-session package — standard price (AUD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={package10}
                onChange={(e) => setPackage10(e.target.value)}
                placeholder="e.g. 800.00"
                style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="brand-cta"
                style={{ borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save prices"}
              </button>
              {msg && <span style={{ marginLeft: 12, fontSize: 12, color: msg === "Saved." ? "#2d5a24" : "#c0445e" }}>{msg}</span>}
            </div>
            {current?.updatedAt?.toDate && (
              <div style={{ fontSize: 11, color: "#9aa5ad" }}>
                Last updated {current.updatedAt.toDate().toLocaleString("en-AU")}
                {current.updatedBy ? ` by ${current.updatedBy}` : ""}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1f24", marginBottom: 4 }}>Casual pricing</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0, marginBottom: 16 }}>
            A session&apos;s price is always decided by its original booked date (never by a reschedule, and
            never recomputed later) — editing this only schedules a change for future bookings. Existing
            sessions and any already-effective tier are never altered.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#f4f7f9", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
                Current casual rates
              </div>
              <div style={{ fontSize: 13, color: "#1a1f24" }}>In-home: <strong>{formatCents(currentCasualTier?.rates?.in_home)}</strong></div>
              <div style={{ fontSize: 13, color: "#1a1f24" }}>Online: <strong>{formatCents(currentCasualTier?.rates?.online)}</strong></div>
              {currentCasualTier?.effectiveFrom && (
                <div style={{ fontSize: 11, color: "#9aa5ad", marginTop: 6 }}>Effective from {formatDateAU(currentCasualTier.effectiveFrom)}</div>
              )}
            </div>
            <div style={{ background: nextScheduledTier ? "#fff8e6" : "#f4f7f9", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
                Next scheduled change
              </div>
              {nextScheduledTier ? (
                <>
                  <div style={{ fontSize: 11, color: "#9aa5ad", marginBottom: 4 }}>Effective from {formatDateAU(nextScheduledTier.effectiveFrom)}</div>
                  <div style={{ fontSize: 13, color: "#1a1f24" }}>In-home: <strong>{formatCents(nextScheduledTier.rates?.in_home)}</strong></div>
                  <div style={{ fontSize: 13, color: "#1a1f24" }}>Online: <strong>{formatCents(nextScheduledTier.rates?.online)}</strong></div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#9aa5ad" }}>No change scheduled.</div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#456071", marginBottom: 10 }}>
              Schedule a future change
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                  Effective from
                </label>
                <input
                  type="date"
                  min={today}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                  In-home (AUD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={scheduledInHome}
                  onChange={(e) => setScheduledInHome(e.target.value)}
                  placeholder="e.g. 90.00"
                  style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                  Online (AUD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={scheduledOnline}
                  onChange={(e) => setScheduledOnline(e.target.value)}
                  placeholder="e.g. 75.00"
                  style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveCasualPricing}
              disabled={casualSaving}
              className="brand-cta"
              style={{ borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {casualSaving ? "Saving…" : "Schedule change"}
            </button>
            {casualMsg && (
              <span style={{ marginLeft: 12, fontSize: 12, color: casualMsg === "Scheduled change saved." ? "#2d5a24" : "#c0445e" }}>
                {casualMsg}
              </span>
            )}
            {casualDoc?.updatedAt?.toDate && (
              <div style={{ fontSize: 11, color: "#9aa5ad", marginTop: 10 }}>
                Last updated {casualDoc.updatedAt.toDate().toLocaleString("en-AU")}
                {casualDoc.updatedBy ? ` by ${casualDoc.updatedBy}` : ""}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1f24", marginBottom: 4 }}>Operations cutover</div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 0, marginBottom: 16 }}>
            Sessions booked before this date/time never generate new Needs Attention items (overdue, missing note, or
            billing issue) on the Operations Centre or Sessions calendar — historical records stay fully browseable,
            nothing is deleted or rewritten. Sessions on or after this date/time follow the full Release 1B rules.
            This does not affect Leads.
          </p>

          <div style={{ background: isCutoverConfigured ? "#f4f7f9" : "#fff8e6", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
              {isCutoverConfigured ? "Configured cutover" : "Using default (not yet configured)"}
            </div>
            <div style={{ fontSize: 13, color: "#1a1f24" }}>
              <strong>{new Date(effectiveCutoverIso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</strong>
            </div>
            {!isCutoverConfigured && (
              <div style={{ fontSize: 11, color: "#9aa5ad", marginTop: 6 }}>
                This default is provisional — confirm or move it forward at actual go-live before relying on it in
                production.
              </div>
            )}
            {cutoverDoc?.updatedAt?.toDate && (
              <div style={{ fontSize: 11, color: "#9aa5ad", marginTop: 6 }}>
                Last updated {cutoverDoc.updatedAt.toDate().toLocaleString("en-AU")}
                {cutoverDoc.updatedBy ? ` by ${cutoverDoc.updatedBy}` : ""}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#456071", marginBottom: 10 }}>
              Set cutover date
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#748398", marginBottom: 6 }}>
                  Cutover date (Brisbane midnight)
                </label>
                <input
                  type="date"
                  value={cutoverInput}
                  onChange={(e) => setCutoverInput(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
              <button
                type="button"
                onClick={saveOperationsCutover}
                disabled={cutoverSaving}
                className="brand-cta"
                style={{ borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {cutoverSaving ? "Saving…" : "Save cutover"}
              </button>
            </div>
            {cutoverMsg && (
              <span style={{ fontSize: 12, color: cutoverMsg === "Operations cutover saved." ? "#2d5a24" : "#c0445e" }}>
                {cutoverMsg}
              </span>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
