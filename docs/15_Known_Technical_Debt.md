# 15 — Known Technical Debt

> This document lists known issues, incomplete systems, potential risks, and areas requiring future cleanup. Items are ranked roughly by risk/impact.

---

## 🔴 High Risk

### 1. No Firebase Storage Security Rules

**Issue:** No `storage.rules` file was found in the project. Firebase Storage uses a separate rules system from Firestore rules. Without explicit rules, the default Firebase Storage rules may allow any authenticated user to read or write any file in the bucket.

**Risk:** Session work samples (`workSamples/`) could be readable by any authenticated user — not just the tutor, student, and parent of that session. Tutor UIDs in the storage path would be exposed to students.

**Impact:** Security and privacy risk for all uploaded work samples.

**Fix needed:** Create and deploy `storage.rules` scoped to:
- Tutors: read/write `workSamples/{tutorId}/...` where `tutorId == request.auth.uid`
- Other roles: read access only via Firestore-gated download URLs (no direct Storage access)

---

### 2. Hard-Coded Admin Email Inconsistency

**Issue:** `useUserRole.ts` grants admin status to two emails: `lily.studyroom@gmail.com` and `contact.studyroomaustralia@gmail.com`. However, `firestore.rules` only grants admin database permissions to `lily.studyroom@gmail.com`.

**Risk:** The second email appears as admin in the UI (can navigate to admin pages, sees admin role label) but does NOT have admin Firestore permissions. Any admin action that requires a Firestore write (from that account) will fail with permission-denied errors.

**Fix needed:** Either:
- Add `contact.studyroomaustralia@gmail.com` to the `isAdmin()` function in `firestore.rules`, OR
- Remove it from `useUserRole.ts` and use the `roles` collection for multi-admin support instead

---

### 3. Xero Redirect URI Points to localhost

**Issue:** The Xero OAuth app is configured with `XERO_REDIRECT_URI=http://localhost:3000/api/xero/auth/callback`.

**Risk:** The Xero OAuth flow cannot be completed from any non-localhost environment unless this is updated in both the `.env` file AND the Xero developer portal app settings.

**Fix needed:** Update Xero app settings to the production domain and update `XERO_REDIRECT_URI` accordingly before deploying to a new production environment.

---

## 🟡 Medium Risk

### 4. No React Error Boundaries

**Issue:** The main hub dashboard (`hub/page.tsx` — 1800+ lines) and major portals use multiple Firestore `onSnapshot` listeners. There are no React error boundary components wrapping these.

**Risk:** If any listener throws an unhandled error (e.g. network failure, malformed Firestore document), it could blank the entire page with a white screen. Users would have no indication of what failed.

**Fix needed:** Wrap major widget areas and portal sections in `<ErrorBoundary>` components with user-friendly fallback UI.

---

### 5. `packages` Collection — Unclear Purpose

**Issue:** A `packages/{packageId}` Firestore collection exists alongside `plans/{planId}` and `entitlements/{entitlementId}`. The Firestore rules allow tutors to update `sessionsUsed`, `sessionsRemaining`, `status`, and `updatedAt` on package documents. This appears to be a separate session-counting system.

**Risk:** It's unclear whether `packages` is:
- A legacy system replaced by `plans` + `entitlements`
- A parallel system used in different contexts
- An active system for the admin packages alert page

If both `packages` and `entitlements` are being used to track remaining sessions, they may diverge.

**Fix needed:** Audit which system the package alerts page (`/hub/admin/packages`) reads from. If `packages` is legacy, migrate the alert logic to `entitlements` and remove the collection.

---

### 6. `studentPlans/{studentId}` Collection — Unknown Purpose

**Issue:** A `studentPlans/{studentId}` collection exists (read/write by tutors and admin). Its relationship to `plans/{planId}` is unknown.

**Risk:** May be a duplicate planning system or a legacy collection that was superseded by `plans`.

**Fix needed:** Audit reads/writes to this collection. If unused or redundant, remove it.

---

### 7. TypeScript Types Are Not Centralised

**Issue:** TypeScript interfaces are defined inline within individual component and page files (e.g. `SessionRow`, `StudentData`, `HubData`, `TaskItem` are all defined in `src/app/parent/page.tsx`). The same types may be re-defined differently in different files.

**Risk:** Type drift between components that operate on the same data. A field added to a Firestore document might not be reflected in the TypeScript type in all places that read it.

**Fix needed:** Create `src/types/` directory with shared interfaces for the core data models: `User`, `Student`, `Client`, `Session`, `Invoice`, `Plan`, `Entitlement`, `UpcomingItem`, `Task`, `MoodLog`, `PomoSession`, `Resource`, `Lead`.

---

### 8. EOD Invoice Cron and Trial Warning Cron Have No Scheduler Configured

**Issue:** Two cron-triggered API routes exist:
- `POST /api/sessions/eod-invoice` (x-cron-secret auth) — EOD invoice fallback
- `POST /api/cron/trial-warnings` (x-cron-secret auth) — Trial expiry warnings

No evidence of a scheduler (Vercel Cron, external cron service) was found in the repository.

**Risk:** These routes may never be called in production. Families with casual sessions that don't auto-trigger invoices will have invoices stuck in `pending_xero` indefinitely. Trial warning emails will not be sent.

**Fix needed:** Configure Vercel Cron (or equivalent) to call these routes on appropriate schedules.

---

### 9. `promote-user` API Route Undocumented

**Issue:** `POST /api/promote-user` exists but its purpose, inputs, auth requirements, and relationship to `setRole` and `grant-tutor` are unclear.

**Risk:** May be a duplicate of an existing route, or may have different/weaker auth than intended.

**Fix needed:** Read and document this route. If redundant with `setRole` or `grant-tutor`, consolidate.

---

## 🟢 Lower Risk / Future Cleanup

### 10. `hub/page.tsx` Is Very Large (1800+ lines)

**Issue:** The main student hub dashboard is a single 1800+ line file with all Firestore listeners, state management, and rendering logic inline.

**Risk:** Difficult to maintain and extend. Any two developers working on the hub simultaneously are likely to cause merge conflicts.

**Fix needed (future):** Extract listeners into a custom hook (e.g. `useHubData()`), and split the widget sections into sub-components. This is a refactoring task — not urgent but will reduce ongoing maintenance cost.

---

### 11. Blog Data Source Uncertainty

**Issue:** The admin blog CMS stores posts in Firestore (`blogPosts/{slug}`). The public `/blog` pages are listed as part of the routing but their data source (Firestore vs. static files vs. MDX) was not fully confirmed during this audit.

**Risk:** If the blog is reading from a different data source than Firestore, the admin CMS and the public blog are disconnected.

**Fix needed:** Verify `src/app/blog/page.tsx` and `src/app/blog/[slug]/page.tsx` read from the `blogPosts` Firestore collection (or document the actual data source).

---

### 12. Family Billing Not Fully Connected

**Issue:** The parent portal shows subscription status and the Stripe customer portal link is accessible. However, the family signup flow (`/api/signup/family`) does not currently create a Stripe subscription for the parent — accounts are created without payment.

**Risk:** Families created via the family signup path may never have a Stripe subscription unless a separate payment step is added.

**Fix needed:** Determine if family billing is intended to route through the parent account or the student account. Build the appropriate Stripe checkout flow for the parent portal path.

---

### 13. Chat Ban List Is Hard-Coded

**Issue:** `ChatPanel.tsx` contains a hard-coded list of banned terms for room chat moderation.

**Risk:** Updating the ban list requires a code deployment.

**Fix needed (future):** Move the ban list to a Firestore document (readable by the server or client) to allow dynamic updates.

---

### 14. No File Size Limit on Work Sample Uploads

**Issue:** `src/lib/storage.ts` (`uploadSessionWorkSample`) does not enforce a file size limit. Firebase Storage has default limits but no application-level validation was found.

**Risk:** Large files could be uploaded, increasing storage costs and slowing down session log loading.

**Fix needed:** Add client-side file size validation in `SessionLogEditor.tsx` before the upload is triggered.

---

### 15. `sessions` Has Both `modality` and `mode` Fields

**Issue:** The session creation Firestore rules list both `modality` and `mode` as allowed fields. The billing constants use `mode`. It's unclear if both are in active use or if one is a legacy field.

**Risk:** Inconsistent field usage could cause billing mode to be read incorrectly (e.g. billing as `mode: undefined` when only `modality` is set).

**Fix needed:** Confirm which field is the canonical source of truth and normalise. `normalizeMode()` in `billing.ts` may already handle this but it should be verified.

---

### 16. Resend and Nodemailer Used in Parallel (Email Provider Inconsistency)

**Issue:** Two separate email delivery systems exist in the codebase:
- **Nodemailer (Gmail SMTP):** Used for session recap emails, tutor welcome emails, trial warnings, and contact form notifications.
- **Resend REST API (direct fetch):** Used exclusively in `src/app/api/admin/tutor-access/decision/route.ts` for tutor approval/rejection emails.

No apparent reason for the split. The Resend integration is undocumented and `RESEND_API_KEY` / `RESEND_FROM` env vars do not appear in any `.env.example` or documented configuration.

**Risk:** Two email providers to maintain. If either set of credentials expires or changes, a subset of emails silently stops working with no obvious indication of which provider failed.

**Fix needed:** Standardise on one provider. Migrate the tutor decision email to Nodemailer, or migrate all email to Resend. Document the chosen provider fully in `11_Integrations.md` and remove the unused provider.

---

### 17. `firestore.rules` File May Not Reflect Deployed Production Rules

**Issue:** The `firestore.rules` file visible in this repository may be a reference or dummy file rather than the live deployed rules. There is no `firebase.json` or Firebase CLI configuration linking this file to the live Firebase project.

**Risk:** Rule changes made to this file may not be deployed. Rule changes reviewed from this file may not reflect what is actually enforced in production. Assuming they match could lead to a false sense of security or incorrectly deploying a stale ruleset over the live rules.

**Important for Tutor Profile V2 Phase 2:** Before deploying any Firestore rule changes:
1. Log into the Firebase Console → Firestore → Rules tab
2. Copy the currently deployed rules
3. Compare against both the `firestore.rules` file in this repo AND the proposed changes in the Phase 2 plan
4. Resolve any differences before applying anything

**Fix needed:** Add a `firebase.json` and establish a deploy process so the file and production rules stay in sync going forward.
