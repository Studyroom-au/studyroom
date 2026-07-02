# 07 — API Routes

## Overview

All API routes live under `src/app/api/`. They are Next.js App Router Route Handlers. Unless noted, all protected routes verify the caller's Firebase ID token via the `verifyIdTokenFromRequest()` helper in `src/lib/firebaseAdmin.ts`, which validates the `Authorization: Bearer <idToken>` header.

**Authentication patterns used:**
- **Bearer token** — Firebase ID token in `Authorization` header (most routes)
- **Stripe signature** — `x-stripe-signature` header validated against webhook secret
- **x-internal-call** — Internal shared secret for server-to-server calls
- **x-cron-secret** — Shared secret for cron job invocations
- **None** — Public routes (contact, enquiry, enrolment, Xero OAuth callback)

---

## Auth & Signup

### `POST /api/signup/family`
**Auth:** None (public)  
**Purpose:** Atomic creation of a parent + student Firebase account pair for the family signup flow.

**Inputs:**
```json
{
  "parentEmail": "string (required)",
  "parentPassword": "string (required, min 6 chars)",
  "parentName": "string (required)",
  "studentEmail": "string (required)",
  "studentPassword": "string (required, min 8 chars)",
  "studentName": "string (required)",
  "promoCode": "string (optional)"
}
```

**Outputs:**
```json
{
  "ok": true,
  "parentUid": "string",
  "studentUid": "string",
  "clientId": "string",
  "studentId": "string",
  "accountWasNew": "boolean",
  "promoApplied": "boolean",
  "promoError": "string (if code was invalid — account still created)"
}
```

**Side effects:**
- Creates Firebase Auth accounts for parent and student
- Creates `roles/{parentUid}` (role: parent) and `users/{parentUid}`
- Creates `roles/{studentUid}` (role: student) and `users/{studentUid}`
- Creates or finds `clients/{id}` (linked by parentUid)
- Creates `students/{id}` record
- If promo code valid: atomically redeems code, sets `subscriptionStatus: "trial"` on both accounts

**Dependencies:** Firebase Admin Auth, Firestore Admin SDK, `promoCodes` collection

---

### `POST /api/onboarding/submit`
**Auth:** Bearer token (authenticated student)  
**Purpose:** Completes the student onboarding flow after signup/payment. Creates CRM records.

**Inputs:**
```json
{
  "studentName": "string",
  "yearLevel": "string",
  "dob": "string",
  "school": "string",
  "subjects": ["string"],
  "referralSource": "string",
  "parentName": "string (optional)",
  "parentEmail": "string (optional)",
  "parentPassword": "string (optional — creates parent account if provided)",
  "consentGiven": "boolean"
}
```

**Side effects:**
- Creates `clients/{id}` and `students/{id}` in Firestore
- Sets `users/{uid}.onboardingComplete = true`
- If parent email + password provided: creates parent Firebase Auth account
- Sends parent welcome email (non-fatal — does not block if email fails)
- Updates Stripe customer email if `stripeCustomerId` exists (non-fatal)

**Dependencies:** Firebase Admin SDK, Nodemailer

---

### `POST /api/tutor/redeem-code`
**Auth:** Bearer token  
**Purpose:** Activates a tutor account using a one-time access code.

**Inputs:**
```json
{
  "code": "string (required)"
}
```

**Side effects:**
- Validates code against `tutorAccessCodes` collection (checks expiry, `used: false`, email match)
- Sets `roles/{uid}.role = "tutor"`
- Sets `users/{uid}.subscriptionStatus = "tutor_access"`
- Marks `tutorAccessCodes/{id}.used = true`, sets `redeemedAt`, `redeemedByUid`, `redeemedByEmail`
- Marks any leads with matching email as active and links `tutorUid`

**Dependencies:** Firestore Admin SDK, `tutorAccessCodes` collection

---

### `POST /api/tutor/request-access`
**Auth:** None (public)  
**Purpose:** Stores a tutor access request lead for admin review.

**Inputs:** Tutor profile fields (subjects, year levels, mode, service area, ABN, Blue Card/WWCC status)

**Side effects:** Creates a `leads/{id}` document with status `"new"`. Sets caller's role to `"tutor_pending"` if not already set.

---

### `POST /api/tutor/link-student`
**Auth:** Bearer token (tutor)  
**Purpose:** Links a student record to the calling tutor.

**Inputs:** unclear — check `src/app/api/tutor/link-student/` (recently added, untracked file — content not fully explored)

---

### `POST /api/students/claim`
**Auth:** Bearer token  
**Purpose:** Allows a student to claim a pre-created student record using an invite code or identifier.

**Inputs:** unclear — check implementation

**Side effects:** Updates `students/{id}.hubUid` and `hubEmail` to link the authenticated user to the CRM student record.

---

## Parent Portal

### `GET /api/parent/hub-data`
**Auth:** Bearer token (parent)  
**Purpose:** Returns all data needed for the parent portal view — children's tasks, upcoming items, sessions, mood logs, pomodoro history, resources.

**Outputs:**
```json
{
  "parent": { "parentName": "string", "parentEmail": "string" },
  "students": [
    {
      "id": "string",
      "hubUid": "string",
      "studentName": "string",
      "yearLevel": "string",
      "subjects": ["string"],
      "roomAccessEnabled": "boolean",
      "tasks": [...],
      "upcoming": [...],
      "sessions": [...],
      "pomoHistory": [...],
      "moodLogs": [...]
    }
  ],
  "subscription": {
    "status": "string",
    "trialEndsAt": "string | null",
    "stripeCustomerId": "string"
  }
}
```

**Dependencies:** Firestore Admin SDK — reads `clients`, `students`, `users/{uid}/tasks`, `users/{uid}/upcoming`, `sessions`, `users/{uid}/pomoHistory`, `users/{uid}/moodLogs`

---

### `POST /api/parent/add-task`
**Auth:** Bearer token (parent)  
**Purpose:** Adds a task to a child's task list.

**Inputs:**
```json
{
  "studentHubUid": "string",
  "title": "string",
  "dueDate": "string (optional)"
}
```

**Side effects:** Creates document in `users/{studentHubUid}/tasks`

---

### `POST /api/parent/add-upcoming`
**Auth:** Bearer token (parent)  
**Purpose:** Adds a deadline/assessment item for a child.

**Inputs:**
```json
{
  "studentHubUid": "string",
  "title": "string",
  "subject": "string",
  "type": "string",
  "dueDate": "string"
}
```

**Side effects:** Creates document in `users/{studentHubUid}/upcoming`

---

### `POST /api/parent/room-access`
**Auth:** Bearer token (parent)  
**Purpose:** Toggles study room access for a specific child.

**Inputs:**
```json
{
  "studentId": "string",
  "enabled": "boolean"
}
```

**Side effects:** Updates `students/{studentId}.roomAccessEnabled`

---

### `POST /api/parent/add-child`
**Auth:** Bearer token (parent)  
**Purpose:** Adds an additional child to a parent's account. Unclear — full implementation not explored.

---

## Sessions & Billing

### `POST /api/sessions/status`
**Auth:** Bearer token (tutor or admin)  
**Purpose:** Updates a session's status (complete, cancel, no-show). The core billing trigger.

**Inputs:**
```json
{
  "sessionId": "string (required)",
  "status": "completed | cancelled_by_parent | cancelled_by_tutor | no_show",
  "graceApplied": "boolean (optional)",
  "noticeHours": "number (optional)"
}
```

**Side effects:**
- Calls `applySessionAction()` — atomic Firestore transaction that:
  - Computes billing outcome
  - Updates session status and billing fields
  - For casual: creates `invoices/{id}` document (`pending_xero` status)
  - For prepaid: decrements entitlement counts
  - Triggers `POST /api/billing/push-invoice-to-xero` (fire-and-forget) for casual sessions

**Dependencies:** `src/lib/studyroom/serverBilling.ts`, `src/lib/studyroom/billing.ts`, `src/lib/studyroom/invoiceEngine.ts`

---

### `POST /api/sessions/eod-invoice`
**Auth:** `x-cron-secret` header  
**Purpose:** End-of-day fallback to generate invoices for any sessions that completed without triggering an invoice. Designed to run nightly via an external scheduler.

**Side effects:** Scans `sessions` for completed casual sessions without invoices; generates family invoices for each

**Dependencies:** `invoiceEngine.ts`, Xero integration

---

### `POST /api/sessions/reschedule`
**Auth:** Bearer token (tutor)  
**Purpose:** Reschedules an existing session to a new time.

**Inputs:**
```json
{
  "sessionId": "string",
  "newStartAt": "Timestamp",
  "newEndAt": "Timestamp"
}
```

**Side effects:** Updates `sessions/{id}` start/end times

---

### `POST /api/sessions/cancel`
**Auth:** Bearer token  
**Purpose:** Cancels a session. Similar to `status` update but may have separate validation logic.

---

### `POST /api/sessions/recurring/update`
**Auth:** Bearer token (tutor)  
**Purpose:** Updates all sessions in a recurring series (by `seriesKey`).

---

### `POST /api/email/session-recap`
**Auth:** `x-internal-call` header  
**Purpose:** Sends a session recap email to the parent/student after a session is completed.

**Dependencies:** Nodemailer (Gmail SMTP)

---

### `POST /api/billing/push-invoice-to-xero`
**Auth:** Bearer token (admin/tutor) OR `x-internal-call` header  
**Purpose:** Pushes a Firestore invoice document to Xero as a DRAFT invoice. Handles both family invoices (multiple sessions) and individual invoices. Also handles legacy and current line-item schemas.

**Inputs:**
```json
{
  "invoiceId": "string (required)"
}
```

**Outputs:**
```json
{
  "ok": true,
  "xeroInvoiceId": "string",
  "skipped": "boolean (if already pushed)"
}
```

**Side effects:**
- Resolves or creates Xero contact (by `parentEmail`)
- Creates DRAFT invoice in Xero
- Updates `invoices/{id}`: sets `xeroInvoiceId`, `xeroInvoiceStatus: "DRAFT"`, `status: "draft_created"`
- Updates linked `sessions/{id}`: sets `xeroInvoiceId`, `billingStatus: "DRAFT_CREATED"`
- On error: persists error to `invoices/{id}`: `{ status: "xero_failed", xeroError, xeroDebug }`

**Dependencies:** `src/lib/xero.ts`, Xero API, Firestore Admin SDK

---

## Stripe

### `POST /api/stripe/create-checkout`
**Auth:** Bearer token  
**Purpose:** Creates a Stripe Checkout Session for monthly subscription.

**Inputs:**
```json
{
  "successUrl": "string (optional)",
  "cancelUrl": "string (optional)"
}
```

**Outputs:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Side effects:** None directly; all subscription activation happens via webhook.

---

### `POST /api/stripe/webhook`
**Auth:** Stripe HMAC signature (`x-stripe-signature`)  
**Purpose:** Handles Stripe lifecycle events.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Sets `subscriptionStatus: "active"`, stores `stripeCustomerId` and `stripeSubscriptionId` on `users/{uid}`. Assigns `role: "student"` unless existing role is `"parent"`. |
| `customer.subscription.deleted` | Sets `subscriptionStatus: "cancelled"` |
| `customer.subscription.paused` | Sets `subscriptionStatus: "cancelled"` |
| `invoice.payment_failed` | Sets `subscriptionStatus: "past_due"` |

**Dependencies:** Stripe SDK, Firestore Admin SDK

---

### `POST /api/stripe/customer-portal`
**Auth:** Bearer token  
**Purpose:** Returns a Stripe customer portal URL for self-service billing management.

**Inputs:**
```json
{
  "returnUrl": "string (optional, default: /hub/profile)"
}
```

**Outputs:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Dependencies:** Stripe SDK; requires `users/{uid}.stripeCustomerId` to exist

---

## Xero Integration

### `GET /api/xero/auth/start`
**Auth:** Requires calling user's email === admin email (lily.studyroom@gmail.com)  
**Purpose:** Initiates Xero OAuth2 consent flow.

**Outputs:**
```json
{
  "consentUrl": "https://login.xero.com/..."
}
```

**Side effects:** Sets `xero_oauth_state` HttpOnly cookie (600s expiry) for CSRF validation

---

### `GET /api/xero/auth/callback`
**Auth:** None (OAuth callback — validated via state cookie)  
**Purpose:** Completes Xero OAuth flow. Exchanges auth code for tokens.

**Side effects:**
- Validates CSRF state cookie
- Exchanges code for token set
- Fetches Xero tenant info
- Stores `tenantId` and `tokenSet` in `integrations/xero` Firestore document
- Returns HTML confirmation page (not JSON)

---

### `POST /api/xero/invoices/create`
**Auth:** Bearer token (tutor or admin)  
**Purpose:** Creates an invoice in Xero for a specific session.

**Inputs:**
```json
{
  "sessionId": "string (required)",
  "mode": "DRAFT | AUTHORISED (default: DRAFT)"
}
```

**Outputs:**
```json
{
  "ok": true,
  "invoiceId": "string",
  "status": "DRAFT | AUTHORISED"
}
```

**Side effects:**
- Resolves or creates Xero contact
- Creates invoice in Xero
- Stores `xeroInvoiceId` on the session document

---

### `POST /api/xero/invoices/void`
**Auth:** Bearer token (tutor or admin)  
**Purpose:** Voids a Xero invoice and resets the session for re-invoicing.

**Inputs:**
```json
{
  "sessionId": "string (required)"
}
```

**Side effects:**
- Voids invoice in Xero
- Clears `xeroInvoiceId` from session document
- Sets `billingStatus: "READY_TO_INVOICE"` on session
- Resets linked invoice document to `status: "pending_xero"`

---

## Promo Codes

### `POST /api/promo/redeem`
**Auth:** Bearer token  
**Purpose:** Redeems a promo code for trial access (standalone, after account creation).

**Inputs:**
```json
{
  "code": "string (required)"
}
```

**Side effects:**
- Validates code (active, not expired, capacity available, user eligible)
- Atomically increments `redemptionCount`, adds uid to `redeemedBy`
- Sets `users/{uid}.subscriptionStatus: "trial"` and `trialEndsAt`

---

### `POST /api/admin/promo/create`
**Auth:** Bearer token (admin)  
**Purpose:** Creates a new promo code.

**Inputs:**
```json
{
  "code": "string",
  "type": "free_trial | full_access",
  "durationDays": "number (default 7)",
  "maxRedemptions": "number (optional)"
}
```

**Side effects:** Creates `promoCodes/{id}` document

---

## Admin

### `POST /api/admin/setRole`
**Auth:** Bearer token (admin)  
**Purpose:** Sets a user's role in Firestore.

**Inputs:**
```json
{
  "uid": "string",
  "role": "student | parent | tutor | tutor_pending | admin"
}
```

**Side effects:** Writes `roles/{uid}.role`

---

### `POST /api/admin/grant-tutor`
**Auth:** Bearer token (admin)  
**Purpose:** Grants the tutor role to a user.

---

### `POST /api/admin/tutor-access/decision`
**Auth:** Bearer token (admin)  
**Purpose:** Approves or rejects a tutor access request.

**Inputs:**
```json
{
  "uid": "string",
  "decision": "approved | rejected"
}
```

**Side effects:** On approval: sets `roles/{uid}.role = "tutor"`, sends welcome email

---

### `POST /api/admin/export`
**Auth:** Bearer token (admin)  
**Purpose:** Exports clients, leads, and students data to Google Sheets.

**Side effects:** Writes to external Google Sheets (unclear which sheet — requires further investigation)

---

### `POST /api/admin/blog/save`
**Auth:** Bearer token (admin)  
**Purpose:** Creates or updates a blog post.

**Inputs:** Blog post fields (title, slug, content, published)

**Side effects:** Creates/updates `blogPosts/{slug}`

---

### `POST /api/admin/blog/delete`
**Auth:** Bearer token (admin)  
**Purpose:** Deletes a blog post.

**Side effects:** Deletes `blogPosts/{slug}`

---

## Video

### `POST /api/livekitToken`
**Auth:** Firebase ID token (passed in body, not header)  
**Purpose:** Issues a LiveKit JWT for room access.

**Inputs:**
```json
{
  "idToken": "string (Firebase ID token, required)",
  "roomName": "string (required)"
}
```

**Outputs:**
```json
{
  "url": "wss://studyroom-[project].livekit.cloud",
  "token": "eyJhbGc..."
}
```

**Token grants:** `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`. Embeds `{ role }` in token metadata.

**Dependencies:** LiveKit Server SDK, Firebase Admin Auth

---

## Email & Cron

### `POST /api/email/tutor-welcome`
**Auth:** Bearer token (admin)  
**Purpose:** Sends a welcome email to a newly approved tutor.

**Dependencies:** Nodemailer

---

### `POST /api/cron/trial-warnings`
**Auth:** `x-cron-secret` header  
**Purpose:** Scans for users whose trial is expiring soon and sends warning emails.

**Side effects:** Sends emails; sets `users/{uid}.trialWarningEmailSent = true`

**Dependencies:** Firestore Admin SDK, Nodemailer

---

## Public Forms

### `POST /api/contact`
**Auth:** None  
**Purpose:** Handles contact form submissions from the public `/contact` page.

**Side effects:** Sends notification email; optionally creates an enquiry record.

---

### `POST /api/enquiry`
**Auth:** None  
**Purpose:** Stores a general enquiry.

**Side effects:** Creates `enquiries/{id}` document

---

### `POST /api/enrol`
**Auth:** None  
**Purpose:** Handles the public enrolment form submission.

**Side effects:** Creates a `leads/{id}` document with status `"new"`

---

## Leads

### `GET /api/leads/[leadsId]/claim`
**Auth:** Bearer token (tutor)  
**Purpose:** Allows a tutor to claim an unclaimed lead from the marketplace.

**Side effects:**
- Updates `leads/{leadsId}`: sets `claimedTutorId`, `status: "claimed"`, `claimedAt`

---

## Other

### `POST /api/promote-user`
**Auth:** unclear  
**Purpose:** unclear — distinct from `setRole` and `grant-tutor` but purpose is undocumented. Check implementation before modifying.

---

## Internal Authentication Pattern

Protected API routes follow this pattern:

```typescript
const { uid, email } = await verifyIdTokenFromRequest(request);
// uid and email are now verified Firebase Auth credentials
// All subsequent Firestore operations use the Admin SDK (bypasses rules)
```

The `verifyIdTokenFromRequest()` function is defined in `src/lib/firebaseAdmin.ts`.
