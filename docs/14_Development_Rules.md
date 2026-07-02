# 14 — Development Rules

> These rules must be followed by every developer and AI assistant working on Studyroom. They exist to prevent the most common and dangerous mistakes in this codebase. Read before writing anything.

---

## Rule 1 — Read Before Writing

**Always read the relevant files before making any change.**

Never assume field names, collection paths, component props, API inputs, or billing constants. These are complex and specific.

Before editing a file:
1. Read the file in full (or the relevant section)
2. Check what Firestore collections it touches
3. Check what other components use it

Failure to do this has historically caused field name mismatches, broken Firestore queries, and billing errors.

---

## Rule 2 — Never Create Duplicate Systems

Before creating a new Firestore collection, component, hook, or API route — **search for an existing one**.

Examples of what not to duplicate:
- Do not create a new session log system — `sessions/{id}/logs/{logId}` already exists
- Do not create a new task system — `users/{uid}/tasks` already exists
- Do not create a new role system — `roles/{uid}` already exists
- Do not create a new invoice collection — `invoices/{id}` already exists

If in doubt, ask before building.

---

## Rule 3 — Reuse Existing Patterns

**Extend existing systems rather than building new ones.**

- New API routes should use `verifyIdTokenFromRequest()` from `src/lib/firebaseAdmin.ts`
- New dashboard widgets should use `WidgetCard` from `src/components/widgets/WidgetCard.tsx`
- New widget interactions should use `window.alexBuddy.say(key)` for companion integration
- New Firestore writes should follow the same field naming conventions as existing documents
- New Firestore listeners should use `onSnapshot` (not one-time `get`) where real-time updates are expected

---

## Rule 4 — Never Touch Billing Without Explicit Instruction

The billing engine is complex, tightly coupled, and financially consequential.

**Files to treat as off-limits unless explicitly requested:**
- `src/lib/studyroom/billing.ts`
- `src/lib/studyroom/serverBilling.ts`
- `src/lib/studyroom/invoiceEngine.ts`
- `src/lib/studyroom/siblingPricing.ts`
- `src/app/api/sessions/status/route.ts`
- `src/app/api/billing/push-invoice-to-xero/route.ts`

Any change here requires:
1. Understanding the full billing outcome decision tree
2. Understanding the Firestore transaction in `applySessionAction()`
3. Testing against all session status scenarios (completed, cancelled_by_parent, cancelled_by_tutor, no_show)

---

## Rule 5 — Never Touch Xero Without Explicit Instruction

The Xero integration uses a live OAuth token stored in Firestore. Any mishandling can break invoice generation for the entire platform.

**Files to treat as off-limits unless explicitly requested:**
- `src/lib/xero.ts`
- `src/app/api/xero/auth/start/route.ts`
- `src/app/api/xero/auth/callback/route.ts`
- `src/app/api/xero/invoices/create/route.ts`
- `src/app/api/xero/invoices/void/route.ts`

Xero token management is particularly fragile — the token cache, refresh logic, and Firestore persistence are all coupled. Do not modify `ensureXeroToken()` without full understanding.

---

## Rule 6 — Never Modify Firestore Security Rules Without Explicit Instruction

`firestore.rules` is the primary security layer for the database. A mistake here can grant public read/write access to sensitive billing, session, and personal data.

If you need to modify rules:
1. Read the entire rules file first
2. Understand what each function (`isAdmin`, `isTutor`, `isTutorOrAdmin`, `isAssignedTutorDoc`, etc.) does
3. Test changes in the Firebase emulator before deploying

**Never add permissive rules (e.g. `allow read, write: if true`) even temporarily.**

---

## Rule 7 — Invoice Writes Are Admin SDK Only

The `invoices`, `plans`, and `entitlements` collections have Firestore rules of `allow create, update, delete: if false` for client-side operations.

All writes to these collections **must go through server-side API routes** using the Firebase Admin SDK. Never try to write to these collections from client-side code.

---

## Rule 8 — Billing Outcomes Are Atomic Transactions

Session completion and invoice creation happen inside a Firestore transaction in `applySessionAction()`.

**Never split this into non-atomic operations.** A partial write would leave sessions in a billable state without an invoice, or consume entitlements without recording the session as complete.

If adding new logic that runs after a session is completed, it should either:
1. Run inside the existing transaction, or
2. Be triggered fire-and-forget after the transaction succeeds

---

## Rule 9 — Do Not Short-Circuit Subscription or Onboarding Gates

The hub layout (`src/app/hub/layout.tsx`) checks both `subscriptionStatus` and `onboardingComplete` before allowing access to `/hub`. Do not add shortcuts or bypasses that skip these checks for students.

Admin and tutor roles legitimately bypass the subscription check — this is by design. Do not add new role bypasses without explicit instruction.

---

## Rule 10 — Admin = `lily.studyroom@gmail.com` (Hard-Coded)

The admin role is gated by a hard-coded email address in:
- `src/hooks/useUserRole.ts`
- `firestore.rules`
- `src/app/api/xero/auth/start/route.ts`

Do not add new admin emails to the source code. If multi-admin support is needed, it should be implemented via the `roles` collection — not by hard-coding more email addresses.

---

## Rule 11 — Keep Visual Consistency

Studyroom has a specific visual identity:
- **Primary colour:** `#456071`
- **Background:** `#f8f5f0`
- **Font:** system/inherited (no custom font stack in source)
- **Card-based layouts with rounded corners**
- **Clean, minimal UI with no heavy framework components**

Do not introduce new component libraries (e.g. Chakra UI, Material UI, Ant Design) without explicit decision to change the design system. Match the existing visual patterns.

---

## Rule 12 — Never Commit Secrets

Never commit any of the following to the repository:
- API keys (Firebase, Stripe, Xero, LiveKit)
- Service account JSON or private keys
- SMTP passwords
- Webhook secrets
- OAuth client secrets
- `.env` files or `.env.local` files

All secrets live in environment variables. If you discover a secret in the codebase, treat it as compromised and rotate it.

---

## Rule 13 — `hubUid` Must Always Be Set on Student Records

When creating or linking a student record (`students/{id}`), the `hubUid` field MUST be set to the student's Firebase Auth UID. Without this:
- The student cannot read their own sessions
- The parent portal cannot link the child
- The subscription gate cannot find the student's plan

After any student creation, verify `students/{id}.hubUid` is populated correctly.

---

## Rule 14 — Explain Architecture Before Changing It

For any change that affects:
- Route structure
- Auth flow
- Firestore data model
- Billing logic

Write a brief explanation of what you're changing and why **before** making the change. This should go in a PR description, a comment, or a conversation — not in the code itself.

---

## Rule 15 — Use TypeScript Correctly

- Run TypeScript (`npx tsc --noEmit`) before declaring a change complete
- Do not use `any` without justification
- When creating new objects that interact with Firestore, define their shape as a TypeScript interface
- If a type already exists in a component file, use it — don't redefine it elsewhere

---

## Rule 16 — Parent Access Is Email-Based — Do Not Change It Without Thought

Firestore rules grant parents access to `clients/{id}` and `students/{id}` by matching `parentEmail == authedEmail()`. This is intentional.

If a parent's email changes in Firebase Auth, they will lose access. If you build any feature involving parent access, make sure you understand this constraint.

---

## Rule 17 — Test Against All Role Types

When adding or modifying any page or API route, verify it behaves correctly for:
- Student
- Parent
- Tutor
- Tutor Pending
- Admin
- Unauthenticated user

Role edge cases (especially tutor_pending) are easy to miss.

---

## Rule 18 — `sessions/{id}` and `students/{id}/sessions/{id}` Are Different

There are **two** session-related subcollection paths:
1. **`sessions/{sessionId}`** — Top-level collection. This is the billing source of truth. Used for all billing, status updates, and invoicing.
2. **`students/{studentId}/sessions/{noteId}`** — Student-level subcollection. Used for additional per-student notes by tutors.

Do not confuse these. Billing operations must always use the top-level `sessions/{sessionId}` collection.
