"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

type PromoType =
  | "free_trial"
  | "percentage_discount"
  | "flat_discount"
  | "full_access"
  | "package_unlock";

type DiscountAppliesTo = "per_session" | "per_month";
type PackageTier = "CASUAL" | "PACKAGE_5" | "PACKAGE_12";

type PromoCodeDoc = {
  id: string;
  code: string;
  type?: PromoType;
  durationDays?: number | null;
  discountPercent?: number | null;
  discountCents?: number | null;
  discountAppliesTo?: DiscountAppliesTo | null;
  packageTier?: PackageTier | null;
  description?: string;
  maxRedemptions?: number | null;
  redemptionCount?: number;
  expiresAt?: Timestamp | null;
  active: boolean;
  createdAt?: Timestamp | null;
  createdBy?: string;
  // legacy fields from old schema
  trialDays?: number;
  maxUses?: number | null;
  usedCount?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function promoTypeLabel(type?: PromoType): string {
  switch (type) {
    case "free_trial": return "Free trial";
    case "percentage_discount": return "% Discount";
    case "flat_discount": return "Flat discount";
    case "full_access": return "Full access";
    case "package_unlock": return "Package unlock";
    default: return "Legacy trial";
  }
}

function promoDetails(c: PromoCodeDoc): string {
  if (!c.type) {
    return `Free access — ${c.trialDays ?? "?"} days (legacy)`;
  }
  switch (c.type) {
    case "free_trial":
      return `Free access — ${c.durationDays ?? "?"} days`;
    case "percentage_discount":
      return `${c.discountPercent ?? "?"}% off for ${c.durationDays ?? "?"} days`;
    case "flat_discount": {
      const dollars = c.discountCents != null ? `$${(c.discountCents / 100).toFixed(0)}` : "$?";
      const applies = c.discountAppliesTo === "per_month" ? "per month" : "per session";
      return `${dollars} off ${applies} for ${c.durationDays ?? "?"} days`;
    }
    case "full_access":
      return "Full access — no expiry ⚠️";
    case "package_unlock": {
      const tier =
        c.packageTier === "PACKAGE_5" ? "Package 5"
        : c.packageTier === "PACKAGE_12" ? "Package 12"
        : c.packageTier === "CASUAL" ? "Casual"
        : "?";
      return `${tier} — ${c.durationDays ?? "?"} days`;
    }
    default:
      return "—";
  }
}

function formatExpiry(ts?: Timestamp | null): string {
  if (!ts) return "—";
  if (typeof ts.toDate === "function") return ts.toDate().toLocaleDateString("en-AU");
  return "—";
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[color:var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]/30";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPromoPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCodeDoc[]>([]);

  // Form state
  const [code, setCode] = useState(() => generateCode());
  const [promoType, setPromoType] = useState<PromoType>("free_trial");
  const [durationDays, setDurationDays] = useState<number | "">(14);
  const [discountPercent, setDiscountPercent] = useState<number | "">(25);
  const [discountDollars, setDiscountDollars] = useState<number | "">(10);
  const [discountAppliesTo, setDiscountAppliesTo] = useState<DiscountAppliesTo>("per_session");
  const [packageTier, setPackageTier] = useState<PackageTier>("CASUAL");
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState<number | "">("");
  const [expiryDate, setExpiryDate] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const off = auth.onAuthStateChanged((u) => {
      if (!u) { router.replace("/"); return; }
      setUid(u.uid);
    });
    return () => off();
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, "promoCodes"), orderBy("createdAt", "desc")),
      (snap) => setPromoCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PromoCodeDoc)
      )
    );
    return () => unsub();
  }, [uid]);

  function resetForm() {
    setCode(generateCode());
    setPromoType("free_trial");
    setDurationDays(14);
    setDiscountPercent(25);
    setDiscountDollars(10);
    setDiscountAppliesTo("per_session");
    setPackageTier("CASUAL");
    setDescription("");
    setMaxRedemptions("");
    setExpiryDate("");
    setActive(true);
  }

  async function handleCreate() {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) { setError("Code is required."); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const u = auth.currentUser;
      if (!u) { setError("Not signed in."); return; }

      let expiresAt: Timestamp | null = null;
      if (expiryDate) {
        expiresAt = Timestamp.fromDate(new Date(expiryDate + "T00:00:00"));
      }

      const payload: Omit<PromoCodeDoc, "id"> = {
        code: trimmedCode,
        type: promoType,
        durationDays: promoType === "full_access" ? null : (durationDays === "" ? null : Number(durationDays)),
        discountPercent: promoType === "percentage_discount" ? (discountPercent === "" ? null : Number(discountPercent)) : null,
        discountCents: promoType === "flat_discount" ? (discountDollars === "" ? null : Math.round(Number(discountDollars) * 100)) : null,
        discountAppliesTo: promoType === "flat_discount" ? discountAppliesTo : null,
        packageTier: promoType === "package_unlock" ? packageTier : null,
        description: description.trim(),
        maxRedemptions: maxRedemptions === "" ? null : Number(maxRedemptions),
        redemptionCount: 0,
        expiresAt,
        active,
        createdAt: serverTimestamp() as Timestamp,
        createdBy: u.uid,
      };

      await setDoc(doc(db, "promoCodes", trimmedCode), payload);
      setSuccess(`Promo code "${trimmedCode}" created.`);
      resetForm();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to create code.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(codeId: string, newActive: boolean) {
    try {
      await updateDoc(doc(db, "promoCodes", codeId), { active: newActive });
    } catch {
      setError("Failed to update code.");
    }
  }

  async function handleDelete(codeId: string, codeStr: string) {
    if (!window.confirm(`Delete promo code "${codeStr}"? This cannot be undone.`)) return;
    setDeletingId(codeId);
    try {
      await deleteDoc(doc(db, "promoCodes", codeId));
    } catch {
      setError("Failed to delete code.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">

        {/* Header */}
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Studyroom · Admin
          </p>
          <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Promo Codes</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Create and manage discount codes, free trials, and package unlocks.
          </p>
        </header>

        {/* Feedback */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* Create form */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-[color:var(--ink)]">Create new code</h2>

          <div className="grid gap-4 sm:grid-cols-2">

            {/* Code + type — always visible */}
            <Field label="Code (auto-generated, editable)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className={inputCls + " font-mono tracking-widest"}
              />
            </Field>

            <Field label="Promo type">
              <select
                aria-label="Promo type"
                value={promoType}
                onChange={(e) => setPromoType(e.target.value as PromoType)}
                className={inputCls}
              >
                <option value="free_trial">Free trial — full access for N days</option>
                <option value="percentage_discount">Percentage discount — X% off for N days</option>
                <option value="flat_discount">Flat discount — $X off per session or month</option>
                <option value="full_access">
                  Full access — permanent (no expiry) ⚠️
                </option>
                <option value="package_unlock">Package unlock — unlock a package tier</option>
              </select>
            </Field>

            {/* Type-specific fields */}
            {promoType === "full_access" && (
              <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠️ <strong>Full access — permanent</strong> grants indefinite platform access with no expiry. Use sparingly.
              </div>
            )}

            {promoType === "percentage_discount" && (
              <Field label="Discount (%)">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="25"
                  className={inputCls}
                />
              </Field>
            )}

            {promoType === "flat_discount" && (
              <>
                <Field label="Discount amount ($)">
                  <input
                    type="number"
                    min={1}
                    step={0.01}
                    value={discountDollars}
                    onChange={(e) => setDiscountDollars(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="10"
                    className={inputCls}
                  />
                </Field>
                <Field label="Applies to">
                  <select
                    aria-label="Applies to"
                    value={discountAppliesTo}
                    onChange={(e) => setDiscountAppliesTo(e.target.value as DiscountAppliesTo)}
                    className={inputCls}
                  >
                    <option value="per_session">Per session</option>
                    <option value="per_month">Per month</option>
                  </select>
                </Field>
              </>
            )}

            {promoType === "package_unlock" && (
              <Field label="Package tier">
                <select
                  aria-label="Package tier"
                  value={packageTier}
                  onChange={(e) => setPackageTier(e.target.value as PackageTier)}
                  className={inputCls}
                >
                  <option value="CASUAL">Casual</option>
                  <option value="PACKAGE_5">Package 5</option>
                  <option value="PACKAGE_12">Package 12</option>
                </select>
              </Field>
            )}

            {promoType !== "full_access" && (
              <Field label="Duration (days)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="14"
                  className={inputCls}
                />
              </Field>
            )}

            {/* Common fields */}
            <Field label="Description / internal note">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g. Facebook ad campaign April 2026"
                className={inputCls}
              />
            </Field>

            <Field label="Max redemptions (blank = unlimited)">
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="50"
                className={inputCls}
              />
            </Field>

            <Field label="Expiry date (optional)">
              <input
                type="date"
                aria-label="Expiry date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Active">
              <div className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  aria-label={active ? "Deactivate" : "Activate"}
                  onClick={() => setActive((v) => !v)}
                  className={
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none " +
                    (active ? "bg-[color:var(--brand)]" : "bg-gray-200")
                  }
                >
                  <span
                    className={
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform " +
                      (active ? "translate-x-5" : "translate-x-0")
                    }
                  />
                </button>
                <span className="text-sm text-[color:var(--muted)]">{active ? "Active" : "Inactive"}</span>
              </div>
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className={"brand-cta rounded-xl px-6 py-2 text-sm font-semibold shadow-sm " + (saving ? "opacity-60 cursor-not-allowed" : "")}
            >
              {saving ? "Creating…" : "Create code"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-[color:var(--ring)] bg-white px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:bg-[#d6e5e3]/40"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Existing codes table */}
        <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
          <div className="border-b border-[color:var(--ring)] px-5 py-4">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">
              Existing codes{promoCodes.length > 0 ? ` (${promoCodes.length})` : ""}
            </h2>
          </div>

          {promoCodes.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--muted)]">No promo codes yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 whitespace-nowrap">Max uses</th>
                    <th className="px-4 py-3">Redeemed</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((c) => {
                    const redeemed = c.redemptionCount ?? c.usedCount ?? 0;
                    const maxUses = c.maxRedemptions ?? c.maxUses ?? null;
                    return (
                      <tr key={c.id} className="border-t border-[color:var(--ring)] align-middle">
                        {/* Code */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold tracking-widest text-[color:var(--ink)]">
                            {c.code}
                          </span>
                          {c.description ? (
                            <div className="mt-0.5 text-xs text-[color:var(--muted)]">{c.description}</div>
                          ) : null}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3 text-xs text-[color:var(--muted)]">
                          {promoTypeLabel(c.type)}
                        </td>

                        {/* Details */}
                        <td className="px-4 py-3 text-[color:var(--ink)]">
                          {promoDetails(c)}
                        </td>

                        {/* Max uses */}
                        <td className="px-4 py-3 text-[color:var(--muted)]">
                          {maxUses != null ? maxUses : "∞"}
                        </td>

                        {/* Redeemed */}
                        <td className="px-4 py-3 text-[color:var(--muted)]">{redeemed}</td>

                        {/* Expires */}
                        <td className="px-4 py-3 text-[color:var(--muted)] whitespace-nowrap">
                          {formatExpiry(c.expiresAt)}
                        </td>

                        {/* Active toggle */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            aria-label={c.active ? "Deactivate code" : "Activate code"}
                            onClick={() => handleToggleActive(c.id, !c.active)}
                            className={
                              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors " +
                              (c.active ? "bg-[color:var(--brand)]" : "bg-gray-200")
                            }
                          >
                            <span
                              className={
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform " +
                                (c.active ? "translate-x-4" : "translate-x-0")
                              }
                            />
                          </button>
                        </td>

                        {/* Delete */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id, c.code)}
                            disabled={deletingId === c.id}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            {deletingId === c.id ? "…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => router.push("/hub/admin")}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          ← Back to Admin
        </button>
      </div>
    </div>
  );
}
