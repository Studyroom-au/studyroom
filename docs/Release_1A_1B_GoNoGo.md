# Studyroom — Release 1A + 1B Go/No-Go Audit & Rollout Checklist

Prepared after the final Release 1B operational-polish batch. Covers everything built across Release 1A (billing foundation) and Release 1B (operational control, packages, billing visibility, Operations Centre), what's verified, what's deliberately deferred, and what must happen — in what order — to go live.

**Current state: local only.** Nothing in either release has been pushed to GitHub, deployed to Vercel, or had Firestore rules deployed to production.

---

## 1. What shipped

### Release 1A — Billing foundation (commit `9c2a831`)
- Single canonical billing engine: `applySessionAction()` in `serverBilling.ts` is the sole transaction from session status change → billing outcome → entitlement/invoice.
- Pricing lock: `originalStartAt` (immutable, set once) → `resolveBookedAt()` → `getSessionRateCents()` against `CASUAL_PRICING_TIERS`, keyed by `PRICING_EFFECTIVE_DATE = "2026-10-06"`. A reschedule can never retroactively change a session's price.
- 60-minute / in-home-or-online session enforcement.
- Migration path tested against production-shaped data.

### Release 1B — Operational control, packages, billing visibility, Operations Centre
- **Packages**: Casual / 5-session / 10-session only. Legacy `package_12` (10+2 bonus) retired from all new sales; 2 legacy `package_12` plans confirmed in production (both active) via a read-only audit script (`scripts/audit-packages.js`) — tracked manually by Lily, untouched by any migration.
- **Canonical package pricing**: `settings/packagePricing` (single current value per package, not date-tiered), changeable only via `POST /api/settings/package-pricing`.
- **Discounts**: percent or fixed, mutually exclusive by construction, snapshotted onto each `plans/{id}` at the moment of sale/renewal (`standardPriceCents`, `discountAmountCents`, `finalPriceCents`, `pricingSnapshotAt`) — never recomputed later, mirroring `originalStartAt`'s guarantee.
- **Full renewal lifecycle**: `/api/plans/create` and `/api/plans/renew`, one Firestore transaction each — old plan expires, new plan+entitlement created, carry-over bounded and audited, package-purchase invoice created in the same transaction and flows through the existing Xero-push pipeline unchanged.
- **Payment truth**: manual admin "Mark as paid" action (`/api/invoices/mark-paid`) — explicitly not a Xero webhook build.
- **Day-batch invoice engine and the dead third Xero path removed** (`invoiceEngine.ts`, `siblingPricing.ts`, `sessions/eod-invoice`, `api/xero/invoices/create`) — confirmed zero callers before deletion.
- **Note-required-to-complete**: server-enforced in `applySessionAction`, paired with client UX in the tutor sessions page (note editor moved alongside the Actions block; "Mark completed" disabled until a note exists).
- **Multi-student-family correction**: `students/{id}.activePlanId` is the only authoritative plan pointer; `clients/{id}.assignedTutorIds: string[]` derived from every student's own tutor assignment, so siblings with different tutors both keep read access to the shared family record. Legacy singular fields kept for display only, guarded against silent overwrite.
- **Operations Centre**: the existing `/hub/admin` home, restructured in place (no second route) — Action Required (derived exceptions), Today & Upcoming, Operational Health.
- **Removal/lifecycle principle applied uniformly** across leads, tutors, students, and clients: archive/end is the normal action; permanent delete is exceptional, guardrailed, and refused whenever real history exists.
- **Final polish batch** (this session, 10 items — see `C:\Users\user\.claude\plans\studyroom-release-smooth-garden.md` for full detail): admin Sessions oversight view (Agenda/List + filters + Needs Attention, reusing one shared exception-detection module also used by the Operations Centre); tutor-facing billing/invoice info hidden while admin's finance visibility is untouched; recurring-session week count now allows all of 1–12; Work Samples upload hidden pending a storage-cost decision (existing files untouched, fully restorable); Operations Centre Action Required rows gained a persisted Dismiss/Restore; inquiry↔enrolment matching prevents duplicate client records when the same family contacts Studyroom more than once before converting; a new **Paused** status for students (distinct from Ended) that preserves everything and warns rather than silently cancels future sessions.

---

## 2. Deliberately deferred / out of scope

| Item | Status | Why |
|---|---|---|
| Casual pricing tiers → admin-configurable | Not built | Flagged as a stop-condition: would change the read order inside the core, heavily-tested billing transaction. A migration design was presented and is available if Lily wants to proceed later. |
| Xero webhook / automated payment reconciliation | Not built | Explicitly out of scope for 1B; "Mark as paid" is the deliberate ceiling. |
| Tutor-pay (`tutorPayableCents`) calculation/surface | Not built | Explicitly out of scope; never promoted into admin nav or the Operations Centre. |
| `package_12` migration/backfill | Not built | Legacy customers tracked manually by Lily; this release only reports what exists. |
| Persisted workflow state (assignment, snoozing, "waiting on parent") beyond the new Dismiss | Not built | Action Required stays derived-only except for the one narrow Dismiss exception explicitly requested this batch. |

---

## 3. Verification status (all green, local)

| Check | Result |
|---|---|
| `npm test` (pure unit) | 69/69 passing |
| `npm run test:emulator` (Firestore emulator + rules) | 54/54 passing |
| `npx tsc --noEmit` | Clean |
| `npx eslint .` | 39 problems — pre-existing baseline only, all in files never touched by either release (`useMounted.ts`, `useUserProfile.ts`, `xero.ts`, `xeroAuthClient.ts`, `ClientOnly.tsx`, `PomodoroBar.tsx`, `PortalHeader.tsx`, `GanttWidget.tsx`, a few others) |

No production data has been read/written except one approved read-only audit (`scripts/audit-packages.js`, confirming the 2 legacy `package_12` plans).

---

## 4. Go/No-Go decision points — need Lily's sign-off before deploying

These are not code defects — they're business/ops decisions or unverified production configuration:

1. **Production Xero-push env vars.** `INTERNAL_API_SECRET` and `NEXT_PUBLIC_BASE_URL` are unset in local `.env.local`, so locally every completed casual session lands in `pending_xero` awaiting the existing manual "Create Xero Draft" button. **Unknown whether these are set in production Vercel.** If they are, completion→Xero-draft is already fully automatic. If not, Tiara/Lily will need to keep using the manual "Create Xero Draft" action (already built and working) until/unless this is configured. → **Action: check Vercel env vars before or immediately after deploy.**
2. **Package prices.** `settings/packagePricing` (5-session and 10-session standard price) has not been populated with real dollar figures in this session — confirm the current values before any admin renews/creates a package, or the price will read as $0/blank.
3. **Casual pricing admin-configurability** — deferred (see §2). Confirm this is acceptable for launch, or decide whether to schedule the migration.
4. **Legacy `package_12` customers** — 2 confirmed in production. Confirm Lily's manual tracking process for these is still workable going forward, since they're outside every renewal/correction UI built this release.
5. **Work Samples upload** — currently hidden from the tutor UI (`WORK_SAMPLES_UPLOAD_ENABLED = false` in `src/lib/studyroom/featureFlags.ts`) pending a storage-cost decision. Flip this one constant to `true` whenever ready — no other change needed, no data was affected.

---

## 5. Rollout checklist (in order)

1. **Review this document and the plan file** with Lily; get explicit go-ahead on §4.
2. **Confirm `settings/packagePricing`** will be set to real values immediately after rules deploy (via the admin settings UI built this release) — before any admin creates/renews a package in production.
3. **Deploy Firestore rules first, alone**, and verify no rule-only regression (the tightened `plans`/`entitlements`/`invoices`/`clients` rules remove a previous client-side write bypass — confirmed safe since the only client-side writers moved server-side, but verify in production Firebase console after deploy that no unexpected rule-denied writes appear in logs).
4. **Deploy the application** (Vercel).
5. **Verify production env vars**: `INTERNAL_API_SECRET`, `NEXT_PUBLIC_BASE_URL`, Xero credentials, Resend/SMTP mail credentials — confirm each is set as expected before relying on any automated path (enrolment alert emails, Xero push).
6. **Smoke test in production** (small, real, reversible actions):
   - Log in as admin — Operations Centre loads, Action Required/Today/Health all populate.
   - Open `/hub/admin/sessions` — Calendar and Agenda both load; filters work.
   - Create one test package plan via `/api/plans/create` (or a real one for a real student) — confirm price populates correctly.
   - Complete one real session — confirm note-required gate, confirm invoice lands in `pending_xero` (or auto-pushes, if env vars are set).
   - Pause and resume one test student — confirm balance/history untouched.
   - Log in as a tutor — confirm no billing/invoice info visible on `/hub/tutor/sessions`, confirm Work Samples upload is hidden as expected.
7. **Monitor for 24–48 hours**: watch the Operations Centre's Action Required count and the Invoices "needs attention" section for anything unexpected (e.g., a spike in `xero_failed`).

## 6. Rollback plan

- **Firestore rules**: keep the pre-1B rules file available; a rules-only rollback is a single `firebase deploy --only firestore:rules` back to the prior version and takes effect immediately.
- **Application**: Vercel keeps prior deployments — a rollback is a one-click "promote previous deployment."
- **Data**: no migration was run against production data this release (package_12 rename was never applied to existing records; only new writes use the new type values), so there is no data rollback required — reverting code/rules is sufficient.
