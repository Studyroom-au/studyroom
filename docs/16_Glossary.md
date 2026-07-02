# 16 — Glossary

Alphabetical reference for every important concept, term, and identifier used in Studyroom.

---

**Admin SDK**  
The Firebase Admin SDK, used in server-side API routes. Bypasses all Firestore security rules. All invoice, plan, and entitlement writes use the Admin SDK. Initialised in `src/lib/firebaseAdmin.ts`.

**Alex Buddy**  
The animated AI companion character that appears throughout the student hub and lobby. Triggered via the global `window.alexBuddy.say(key)` function. Has 10 message keys including idle detection and evening mood nudge. See [08_Widget_System.md](08_Widget_System.md).

**applySessionAction()**  
The core billing function in `src/lib/studyroom/serverBilling.ts`. Runs as an atomic Firestore transaction when a session is completed or cancelled. Computes the billing outcome, updates the session, consumes entitlements (if prepaid), and creates invoices (if casual).

**assignedTutorId / assignedTutorEmail**  
Fields on `clients/{id}` and `students/{id}` that link a tutor to a family or student. Both are checked in Firestore rules: `isAssignedTutorDoc(docData)` matches by either UID or email.

**backToBack (rate type)**  
A sibling pricing rate ($60.00) applied when a family has two consecutive in-home sessions with a gap of 15 minutes or less between them. Calculated in `src/lib/studyroom/siblingPricing.ts`.

**Bearer token**  
The authentication method used by Studyroom's API routes. The client sends a Firebase ID token as `Authorization: Bearer <token>`. Server validates via `verifyIdTokenFromRequest()` in `src/lib/firebaseAdmin.ts`.

**betaFeedback**  
Firestore collection (`betaFeedback/{docId}`) storing user feedback submitted via the `FeedbackButton` component. Readable only by admin. Cannot be updated or deleted.

**billing outcome**  
The result of `computeBillingOutcome()` in `billing.ts`. One of: `"consume_entitlement"`, `"invoice"`, `"no_charge"`, or `"credit"`. Determines what happens financially when a session status changes.

**billingStatus**  
Field on `sessions/{id}`. The session's current state in the billing pipeline: `"READY_TO_INVOICE"` | `"PREPAID"` | `"CREDITED"` | `"NOT_BILLED"` | `"DRAFT_CREATED"` | `"ERROR"`.

**blogPosts**  
Firestore collection (`blogPosts/{slug}`) managed by the admin blog CMS at `/hub/admin/blog`. Public pages at `/blog` and `/blog/[slug]` serve this content. Only published posts (`published: true`) are readable by the public.

**casual (plan type)**  
A session billing plan where each completed session generates a Xero invoice. No prepaid sessions. Invoiced per session or per family per day. See also: `package_5`, `package_12`.

**checkpoints**  
Subcollection of `users/{uid}/upcoming/{assessmentId}/checkpoints/{checkpointId}`. Subtasks for a specific upcoming assessment item. Student-only read/write.

**clientId**  
The Firestore document ID in the `clients` collection. References the family/parent record. Stored on `students/{id}` and `sessions/{id}` to link them back to the family.

**clients collection**  
`clients/{clientId}` — The family/parent record. In Studyroom, "client" means the parent family, not the student. Each family has one client document. The billing and contact anchor for the whole family.

**computeBillingOutcome()**  
Function in `src/lib/studyroom/billing.ts` that determines what happens financially when a session status changes. Returns one of four billing outcomes. See [10_Billing.md](10_Billing.md).

**consumedFrom**  
Field on `sessions/{id}`. When an entitlement is consumed, records whether it came from `"base"` or `"bonus"` pool of the entitlement document.

**credit (billing outcome)**  
The billing outcome when a tutor cancels a session. No charge to the student; the tutor absorbs the session.

**dateKey**  
A `YYYY-MM-DD` string (Brisbane timezone) used on `invoices/{id}` to group all casual sessions for a family on the same day into a single invoice. Used for deduplication.

**entitlement**  
Firestore document in `entitlements/{id}`. Tracks session credits for prepaid plans (package_5, package_12). Contains `baseSessions`, `bonusSessions`, `baseConsumed`, `bonusConsumed`. Written by Admin SDK only.

**enquiries collection**  
`enquiries/{enquiryId}` — Contact form submissions from the public site. Readable and writable by tutors and admin.

**EOD invoice**  
End-of-day fallback invoice generation. If a casual session completion doesn't auto-trigger an invoice (e.g. network issue), a nightly cron job at `POST /api/sessions/eod-invoice` catches and creates the invoice.

**ensureXeroToken()**  
Function in `src/lib/xero.ts` that manages Xero OAuth token lifecycle. Has a 30-second in-memory cache, auto-refreshes near expiry, and persists updated tokens to `integrations/xero` in Firestore.

**generateFamilyInvoice()**  
Function in `src/lib/studyroom/invoiceEngine.ts`. Groups all casual sessions for one family on a single day into a single Xero invoice with sibling pricing applied.

**grace / graceApplied**  
A billing waiver. When `graceApplied: true` is set on a session, a late cancellation or no-show results in `billingOutcome: "no_charge"` instead of being invoiced or consuming an entitlement.

**hubEmail**  
The Firebase Auth email of the student, stored on `students/{id}`. Used in Firestore rules to grant parents read access to student records where the parent's email matches the student's linked email.

**hubUid**  
The Firebase Auth UID of the student, stored on `students/{id}`. The critical link between the CRM student record and the authenticated Firebase user. Without this field set correctly, the student cannot access their sessions and the parent portal cannot see the child's data.

**integrations/xero**  
Firestore document at `integrations/xero`. Stores the Xero OAuth `tokenSet` and `tenantId`. Written by the Xero OAuth callback. Admin-read-only. Contains sensitive OAuth credentials — never expose to client-side code.

**invoiceEngine.ts**  
`src/lib/studyroom/invoiceEngine.ts`. Contains `generateFamilyInvoice()` for creating Firestore invoice records from casual sessions. Called by `serverBilling.ts` after billing outcome computation.

**invoices collection**  
`invoices/{invoiceId}`. Billing records for tutoring sessions. Written only by the Admin SDK (server-side). Contains the full invoice lifecycle state from `pending_xero` through `paid`. See [05_Firestore_Data_Model.md](05_Firestore_Data_Model.md).

**isAssignedTutorDoc()**  
Firestore rules helper function. Returns true if the authenticated user's UID matches `assignedTutorId` OR their email matches `assignedTutorEmail` on a given document. This dual check (UID + email) provides flexibility at the cost of two possible match paths.

**leads collection**  
`leads/{leadId}`. Stores enrolment enquiries (from `/api/enrol`) and tutor access requests. Tutors see unclaimed leads in the marketplace; admin sees all. Status progresses from `"new"` → `"claimed"` → `"converted"`.

**lineItems**  
Array field on `invoices/{id}`. Contains one object per session for family invoices, with description, quantity, unitAmount (in dollars), and accountCode.

**moodLogs**  
Subcollection of `users/{uid}/moodLogs/{logId}`. Daily mood entries keyed by date string (`YYYY-MM-DD`). Five mood levels: Stressed, Tired, OK, Good, Great. Used for streak calculation and parent/tutor visibility.

**mode / modality**  
Session delivery method: `"in_home"` | `"online"` | `"group"`. The canonical field appears to be `mode` (used in `billing.ts`). `modality` may be a legacy or parallel field. See [15_Known_Technical_Debt.md](15_Known_Technical_Debt.md).

**no_charge (billing outcome)**  
The billing outcome when no money changes hands — e.g. tutor-cancelled session, parent cancelled with sufficient notice, or grace waiver applied.

**onboardingComplete**  
Boolean field on `users/{uid}`. Must be `true` for a student to access the hub (`/hub`). Set by `POST /api/onboarding/submit`.

**package_5 / package_12**  
Prepaid plan types. `package_5`: 5 base sessions + 0 bonus. `package_12`: 10 base sessions + 2 bonus. Session completion consumes from `entitlements/{id}` rather than generating an invoice.

**packages collection**  
`packages/{packageId}`. Purpose unclear relative to `plans` and `entitlements`. Tutors can update `sessionsUsed`, `sessionsRemaining`, `status`. May be a legacy or parallel tracking system. See [15_Known_Technical_Debt.md](15_Known_Technical_Debt.md).

**parentUid**  
The Firebase Auth UID of the parent user. Stored on `clients/{id}`.

**plans collection**  
`plans/{planId}`. Billing plan configuration for a student-tutor relationship. Written by Admin SDK only. Contains plan type, mode, rates, and status. Referenced by `activePlanId` on both `clients/{id}` and `students/{id}`.

**pomoHistory**  
Subcollection of `users/{uid}/pomoHistory/{pomoId}`. Records of completed Pomodoro focus sessions. Contains `date`, `durationMs`, `completedAt`.

**pomoState / pomoSessions**  
Subcollections of `users/{uid}` for persisting active Pomodoro timer state across browser sessions.

**promo code**  
A redeemable code in the `promoCodes` collection. Grants free trial access (`"free_trial"`) or long-term access (`"full_access"`). Default eligibility is `"new_users_only"`. Redemption is atomic via Firestore transaction.

**push-invoice-to-xero**  
The server route `POST /api/billing/push-invoice-to-xero` that takes a Firestore `invoices/{id}` document and creates a DRAFT invoice in Xero. Handles both legacy and current line-item schemas.

**rateSummary**  
Array field on family `invoices/{id}`. Contains one entry per session with `{ id, startMs, endMs, rateType, rateCents }`. Documents how sibling pricing was applied.

**reports collection**  
`reports/{reportId}`. Stores user-submitted reports of inappropriate chat messages. Writable by any authenticated user; readable by tutors and admin.

**resources collection**  
`resources/{resourceId}`. Tutor-uploaded study materials. All authenticated users can read (client-side filtering in `hub/page.tsx` restricts what each student sees). Types: worksheet, guide, past_paper, flashcard.

**roles collection**  
`roles/{uid}`. Stores each user's role. The `uid` is the Firebase Auth UID. Role values: `"student"` | `"parent"` | `"tutor"` | `"tutor_pending"` | `"admin"`. Users can self-create with limited values; admin can write any value.

**roomAccessEnabled**  
Boolean field on `students/{id}`. If `false`, the student cannot join study rooms. Toggled by parents via `POST /api/parent/room-access`.

**rooms collection**  
`rooms/{roomId}`. Study room metadata. Subcollections: `chat/{msgId}` (Firestore-backed chat), `whiteboard/{strokeId}` (collaborative whiteboard strokes). Video/audio is handled by LiveKit — not stored here.

**sameTime (rate type)**  
A sibling pricing rate ($40.00) applied when a family has overlapping sessions at the same time (e.g. two students being tutored simultaneously). Calculated in `src/lib/studyroom/siblingPricing.ts`.

**seriesKey**  
Field on `sessions/{id}` that groups recurring sessions together. Used by `POST /api/sessions/recurring/update` to update all sessions in a series at once.

**serverBilling.ts**  
`src/lib/studyroom/serverBilling.ts`. Contains `applySessionAction()` — the atomic Firestore transaction that handles all session completion billing logic.

**session log**  
A document in `sessions/{sessionId}/logs/{logId}`. Created by tutors after a completed session. Contains detailed notes and work sample URLs. Readable by the student and their parent.

**sessionId**  
The Firestore document ID in the top-level `sessions` collection. References a single tutoring session. Not to be confused with the Firebase Auth session (login session).

**siblingPricing.ts**  
`src/lib/studyroom/siblingPricing.ts`. Calculates which sessions qualify for sibling discounts (`backToBack`, `sameTime`) when a family has multiple casual sessions on the same day.

**standard (rate type)**  
The default casual rate. In-home: $75.00. Online: $60.00. Group: $45.00. Applied when no sibling pricing discount applies.

**studentId**  
The Firestore document ID in the `students` collection. This is a CRM identifier — it is NOT the Firebase Auth UID of the student. The Firebase Auth UID is stored separately as `hubUid`.

**studentPlans collection**  
`studentPlans/{studentId}`. Readable and writable by tutors and admin. Purpose unclear — may be a legacy or parallel planning system. See [15_Known_Technical_Debt.md](15_Known_Technical_Debt.md).

**students collection**  
`students/{studentId}`. CRM student records. Separate from the Firebase Auth account — linked via `hubUid`. Contains name, year level, school, subjects, tutor assignment, plan reference, and room access settings.

**subscriptionStatus**  
Field on `users/{uid}`. Controls hub access gate. Values: `"active"` | `"trial"` | `"cancelled"` | `"past_due"` | `"tutor_access"`. Set by Stripe webhook (for paid subscriptions) or promo code redemption (for trials).

**trialEndsAt**  
Timestamp field on `users/{uid}`. When a trial subscription expires. Set during promo code redemption. The hub layout checks this against the current time to determine if trial access is still valid.

**tutorAccessCodes collection**  
`tutorAccessCodes/{codeId}`. One-time codes issued by admin to activate tutor accounts without going through the approval flow. Used by `POST /api/tutor/redeem-code`.

**tutor_pending**  
A transitional role for tutors who have self-registered at `/tutor-access` but have not yet been approved by admin. They see a limited view of the tutor portal until approved.

**tutor_access (subscriptionStatus)**  
The subscription status assigned to tutors when their account is activated. Bypasses the Stripe subscription gate. Tutors do not pay for platform access.

**tutors collection**  
`tutors/{uid}/...`. A wildcard collection covering all subcollections under a tutor's UID path. Read/write by the tutor themselves and admin. Known subcollections: `studentPlans`, `worksheets`.

**unitPlanWeek / worksheetId**  
Optional fields on `sessions/{id}`. Link a session to curriculum unit planning materials or a specific worksheet. Can be set by tutors during a session update.

**upcoming**  
Subcollection of `users/{uid}/upcoming/{itemId}`. Assessment and deadline items with optional handout date, draft date, due date, and completion tracking. Has its own subcollection for checkpoints.

**useStreak**  
Custom React hook at `src/hooks/useStreak.ts`. Reads `users/{uid}/moodLogs` and `users/{uid}/streak` to calculate and display the current mood/check-in streak. Returns `{ currentStreak, longestStreak }`.

**useUserProfile**  
Custom hook at `src/hooks/useUserProfile.ts`. Returns `{ firebaseUser, profile, loading }`. Profile is from `users/{uid}`. UserType is `"student"` | `"parent"` | `"tutor"`.

**useUserRole**  
Custom hook at `src/hooks/useUserRole.ts`. Returns the user's effective role by combining a hard-coded admin email check with a real-time `onSnapshot` listener on `roles/{uid}`. The primary role source for all auth guards.

**verifyIdTokenFromRequest()**  
Server-side helper in `src/lib/firebaseAdmin.ts`. Extracts and verifies the `Authorization: Bearer <idToken>` header from API requests. Returns `{ uid, email }`. Used by virtually all protected API routes.

**widgetCard**  
`src/components/widgets/WidgetCard.tsx`. Shared wrapper component that provides consistent title and expand/collapse styling for all dashboard widgets.

**work sample**  
A file uploaded by a tutor during a session log creation. Stored in Firebase Storage under `workSamples/{tutorId}/{sessionId}/`. URL stored in `sessions/{id}/logs/{logId}.workSamples` array.

**xeroDebug**  
Object field on `invoices/{id}`. Populated when a Xero push fails. Contains the full error response from the Xero SDK (message, status, responseStatus, responseData). Used for admin troubleshooting without re-running the operation.

**xeroInvoiceId**  
The UUID assigned by Xero when an invoice is created. Stored on both `invoices/{id}` and the linked `sessions/{id}`. Used for deduplication (prevents double-creation on retry) and for voiding.

**xeroInvoiceStatus**  
Xero-side invoice status stored on `invoices/{id}` and `sessions/{id}`. Values: `"DRAFT"` | `"AUTHORISED"` | `"VOIDED"`. Updated when the Firestore record is synced with Xero state.
