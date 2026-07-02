# 13 — Roadmap

> **Important:** This roadmap is derived exclusively from what currently exists or is partially implemented in the codebase. No features have been invented or assumed. For each area, the evidence in the code is cited.

---

## Completed Work

These features are fully implemented and connected end-to-end.

### Core Platform
- Firebase Auth (email/password), role-based access control, Firestore security rules
- Student hub dashboard with streak gamification
- Pomodoro timer with session history and statistics
- Daily task management with progress tracking
- Assessment/deadline planner with checkpoint subtasks
- Mood tracker with 7-day trend graph
- Alex Buddy AI companion with 10 message keys and idle detection
- LiveKit study rooms (video, audio, screen share, whiteboard, chat)
- Chat moderation (report system, tutor/admin delete)
- Tutor-uploaded resource library

### Tutor Portal
- Session scheduling, completion, cancellation, rescheduling
- Recurring session series management
- Session notes (brief and detailed logs)
- Work sample upload to Firebase Storage
- Leads marketplace with claim flow
- Student profiles with session history
- Resource upload and management
- Payout export

### Admin Control Panel
- Full lead management (create, assign, convert)
- Client/family and student management
- Tutor management and approval workflow
- Tutor access codes
- Session calendar and history
- Blog CMS (create, edit, delete, publish)
- Promo code creation (7-day trial codes)
- Package alerts for sessions running low
- Data export to Google Sheets

### Billing & Invoicing
- Stripe subscription billing (monthly, webhook-driven)
- Stripe customer portal for self-service management
- Casual session invoicing via Xero (DRAFT creation)
- Family invoice grouping with sibling pricing
- Prepaid package entitlement system (package_5, package_12)
- Billing outcome computation (consume/invoice/no-charge/credit)
- Promo code and trial system with atomic redemption
- Xero OAuth with smart token refresh
- Xero invoice void and retry

### Parent Portal (Beta)
- View all children's study activity (tasks, upcoming, sessions, moods, pomodoro)
- View tutor session notes
- Add tasks and deadlines for children
- Toggle study room access per child
- Family signup flow (atomic parent + student account creation)

### Communications
- Session recap emails
- Tutor welcome emails
- Trial warning email system (cron-ready)
- Contact form email

---

## In Progress / Partially Connected

These features have implementation in the codebase but are not fully wired or complete.

### Family Billing via Stripe
**Evidence:** The parent portal shows `subscription.status` and the Stripe customer portal is accessible. The `signup/family` route creates accounts but doesn't currently require or create a Stripe subscription for the parent account specifically. Family-owned subscription flow is not fully wired.  
**What remains:** Connecting the parent's Stripe customer ID to family-level subscription management; making the parent portal gate on subscription status.

### Tutor → Student Link Flow (new)
**Evidence:** `src/app/api/tutor/link-student/` is a recently added, untracked directory. The API exists but has not been fully explored.  
**What remains:** Confirm the complete flow for tutors linking to existing students without going through admin.

### Parent "Add Child" Flow
**Evidence:** `POST /api/parent/add-child` API route exists. The parent portal has a modal reference. Full UI flow is unclear.  
**What remains:** Confirm the complete UI and what the API actually does.

### Calendar Views (Tutor and Admin)
**Evidence:** `/hub/tutor/calendar` and `/hub/admin/calendar` pages exist. FullCalendar is a dependency. Exact implementation depth is unclear.  
**What remains:** Verify session data is properly loaded and that the calendar view is functional.

### Payment Report
**Evidence:** `POST /api/payments/report` route exists.  
**What remains:** Confirm what the route returns and whether the admin UI fully uses it.

### Trial Warning Emails (Cron)
**Evidence:** `POST /api/cron/trial-warnings` is implemented and ready.  
**What remains:** Connect to an external scheduler (Vercel Cron, or similar).

### EOD Invoice Fallback (Cron)
**Evidence:** `POST /api/sessions/eod-invoice` is implemented.  
**What remains:** Connect to an external scheduler to run nightly.

---

## Identified Future Work

These items are identified from technical debt, incomplete systems, or architectural gaps — not invented features.

### Firebase Storage Security Rules
**Why:** No `storage.rules` file found. Work samples may be publicly accessible to any authenticated user.  
**Scope:** Create and deploy `storage.rules` that restricts `workSamples/{tutorId}/...` to matching tutor UID, the assigned student, the parent, and admin.

### Centralised TypeScript Types
**Why:** Type definitions are spread across individual component files. This creates risk of drift and inconsistency.  
**Scope:** Create `src/types/index.ts` (or `src/types/*.ts`) with shared interfaces for User, Student, Client, Session, Invoice, Plan, Entitlement, etc.

### Clarify `packages` vs `plans` vs `entitlements`
**Why:** Three collections (`packages`, `plans`, `entitlements`) appear to overlap in purpose. `packages` allows tutor updates to `sessionsUsed`/`sessionsRemaining`; `entitlements` is the atomic billing source of truth. The relationship needs clarification and possible consolidation.

### `studentPlans` Collection Audit
**Why:** `studentPlans/{studentId}` exists as a separate collection alongside `plans/{planId}`. Purpose is unclear — may be duplicate or legacy.

### Xero Redirect URI for Production
**Why:** Currently set to `http://localhost:3000/api/xero/auth/callback` in the configured Xero app.  
**Scope:** Update Xero app settings to production URL before going live with new environments.

### Error Boundaries in Hub
**Why:** The main hub dashboard and major portals have no React error boundaries. A single Firestore listener failure could blank the entire screen.  
**Scope:** Add `<ErrorBoundary>` wrappers around major widget areas.

### Promote-User Route Audit
**Why:** `POST /api/promote-user` exists but its purpose relative to `setRole` and `grant-tutor` is undocumented.  
**Scope:** Read the implementation and document or consolidate with existing role management routes.

### Admin Email Consistency
**Why:** Two admin emails in `useUserRole.ts` but only one in `firestore.rules`. The second email has inconsistent permissions.  
**Scope:** Either add the second email to Firestore rules, or remove it from the client hook and use the `roles` collection for multi-admin support.
