# 03 — User Journeys

## Overview

This document maps the complete lifecycle journeys for each user type, from initial discovery through normal daily usage. All journeys reflect the current implementation.

---

## Journey 1 — New Family Signup (Beta Path)

```mermaid
flowchart TD
    A[Parent visits /enrol or marketing site] --> B[Submit enrolment form]
    B --> C[POST /api/enrol — lead created in Firestore]
    C --> D[Admin reviews lead in /hub/admin/leads]
    D --> E[Admin assigns tutor and converts to client]
    E --> F[Admin creates family via /api/signup/family or StudentOnboardingPanel]
    F --> G[Parent Firebase account created]
    F --> H[Student Firebase account created]
    G & H --> I{Promo code provided?}
    I -- Yes --> J[Promo redeemed atomically — both accounts get trial status]
    I -- No --> K[Accounts created without subscription]
    J & K --> L[Parent receives login credentials]
    L --> M[Parent logs in → redirected to /parent portal]
    M --> N[Student logs in → /subscribe if no subscription]
    N --> O[Student completes Stripe checkout → subscriptionStatus: active]
    O --> P[Student completes /onboarding]
    P --> Q[Student accesses /hub]
```

**Key API calls:**
- `POST /api/signup/family` — atomic account creation
- `POST /api/stripe/create-checkout` — subscription payment
- `POST /api/stripe/webhook` — sets `subscriptionStatus: "active"`
- `POST /api/onboarding/submit` — sets `onboardingComplete: true`

---

## Journey 2 — Independent Student Signup

```mermaid
flowchart TD
    A[Student visits /subscribe] --> B[Creates Firebase account via SignInForm]
    B --> C{Promo code?}
    C -- Yes --> D[POST /api/promo/redeem — trial granted]
    C -- No --> E[POST /api/stripe/create-checkout]
    E --> F[Stripe checkout — monthly subscription]
    F --> G[POST /api/stripe/webhook — subscriptionStatus: active]
    D & G --> H[Redirected to /onboarding]
    H --> I[Student fills in name, year level, DOB, school, subjects, referral, consents]
    I --> J[POST /api/onboarding/submit — onboardingComplete: true]
    J --> K[Redirected to /hub]
    K --> L[Student uses daily study hub]
```

---

## Journey 3 — Student Daily Usage

```mermaid
flowchart TD
    A[Student logs in] --> B[Auth state check — subscriptionStatus + onboardingComplete]
    B --> C[/hub dashboard loads]
    C --> D{Getting started checklist complete?}
    D -- No --> E[Prompted to: add deadline, add task, log mood, try focus session]
    D -- Yes --> F[Full dashboard shown]
    F --> G[Streak display — fires AlexBuddy greeting]
    G --> H[Student manages tasks in TaskListWidget]
    G --> I[Student adds/checks deadline in DailyPlannerWidget]
    G --> J[Student logs mood in MoodTrackerWidget]
    G --> K[Student starts Pomodoro in PomoWidget]
    K --> L[After 25min block — short break, then repeat]
    G --> M[Student opens /lobby — study room selection]
    M --> N[Student joins /room/id — LiveKit video session]
    N --> O[Uses chat, whiteboard, focus timer in room]
    O --> P[Returns to hub]
```

**After 6pm:** AlexBuddy delivers evening mood nudge if no mood has been logged that day.

---

## Journey 4 — Tutor Onboarding

```mermaid
flowchart TD
    A[Tutor visits /tutor-access] --> B{Has access code?}
    B -- Yes --> C[Enters code — POST /api/tutor/redeem-code]
    C --> D[Role set to tutor, subscriptionStatus: tutor_access]
    D --> E[Full tutor portal available immediately]
    B -- No --> F[Submits request form — POST /api/tutor/request-access]
    F --> G[Role set to tutor_pending]
    G --> H[Tutor logs in → sees pending approval screen in /hub/tutor]
    H --> I[Admin reviews in /hub/admin/tutors]
    I --> J[Admin approves — POST /api/admin/tutor-access/decision]
    J --> K[Role updated to tutor]
    K --> E
```

---

## Journey 5 — Tutor Session Workflow

```mermaid
flowchart TD
    A[Tutor logs in → /hub/tutor] --> B[Views sessions in /hub/tutor/sessions]
    B --> C[Tutor schedules session — written to sessions collection]
    C --> D[Session day arrives]
    D --> E[Tutor conducts session — in-home or via /room/id]
    E --> F[Tutor marks session complete — POST /api/sessions/status]
    F --> G[computeBillingOutcome runs in transaction]
    G --> H{Plan type?}
    H -- Casual --> I[Invoice created — pending_xero status]
    H -- Prepaid --> J[Entitlement consumed — base or bonus pool]
    I --> K[POST /api/billing/push-invoice-to-xero — DRAFT invoice in Xero]
    J --> L[No invoice — sessions remaining updated]
    F --> M[Tutor logs session notes in SessionLogEditor]
    M --> N[Optional: uploads work samples to Firebase Storage]
    N --> O[Log saved to sessions/sessionId/logs/logId]
    O --> P[Student and parent can read log in their portals]
```

---

## Journey 6 — Parent Portal Usage

```mermaid
flowchart TD
    A[Parent logs in] --> B[Hub layout detects parent role → redirects to /parent]
    B --> C[GET /api/parent/hub-data — fetches all children's data]
    C --> D[Parent sees: tasks, upcoming, sessions, moods, pomodoro stats, resources per child]
    D --> E{Want to add task for child?}
    E -- Yes --> F[POST /api/parent/add-task]
    E -- No --> G{Want to add deadline for child?}
    G -- Yes --> H[POST /api/parent/add-upcoming]
    G -- No --> I{Want to toggle room access?}
    I -- Yes --> J[POST /api/parent/room-access — updates roomAccessEnabled on students doc]
    D --> K[Views session history and tutor notes]
    D --> L[Views mood trend charts]
    D --> M[Views pomodoro/focus session history]
```

---

## Journey 7 — Admin Operations

```mermaid
flowchart TD
    A[Admin logs in → /hub/admin] --> B[Dashboard with 7 action cards]
    B --> C[Leads — /hub/admin/leads]
    C --> C1[Review new enrolments]
    C1 --> C2[Assign tutor, update status]
    B --> D[Clients — /hub/admin/clients]
    D --> D1[View families and students]
    D1 --> D2[Open client record — view subscription, sessions, plan]
    B --> E[Tutors — /hub/admin/tutors]
    E --> E1[View all tutors and assignments]
    E1 --> E2[Approve pending tutor requests]
    B --> F[Sessions Calendar — /hub/admin/sessions]
    F --> F1[View all sessions by date, tutor, student, status]
    B --> G[Promo Codes — /hub/admin/promo]
    G --> G1[POST /api/admin/promo/create — create 7-day trial code]
    B --> H[Package Alerts — /hub/admin/packages]
    H --> H1[See students with fewer than 4 sessions remaining]
    B --> I[Xero Integration — /hub/admin/integrations/xero]
    I --> I1[GET /api/xero/auth/start — OAuth consent]
    I --> I2[POST /api/xero/invoices/create — manual invoice creation]
    I --> I3[POST /api/billing/push-invoice-to-xero — batch push]
```

---

## Journey 8 — Session Cancellation / Late Cancellation

```mermaid
flowchart TD
    A[Parent or tutor cancels session] --> B[POST /api/sessions/cancel]
    B --> C{Who cancelled?}
    C -- Tutor --> D[billingOutcome: credit — no charge to student]
    C -- Parent/Student --> E{How much notice?}
    E -- >= 24 hours --> F[billingOutcome: no_charge]
    E -- < 24 hours --> G{Grace waiver available?}
    G -- Yes --> H[graceApplied: true — billingOutcome: no_charge]
    G -- No --> I{Plan type?}
    I -- Casual --> J[Late cancellation invoiced]
    I -- Prepaid --> K[Entitlement consumed — session deducted from package]
```

---

## Journey 9 — Promo Code Redemption

```mermaid
flowchart TD
    A[User has promo code] --> B{Via family signup or standalone?}
    B -- Family signup --> C[Code validated before account creation]
    C --> D{Code valid and capacity available?}
    D -- Yes --> E[Accounts created, promo redeemed atomically in Firestore transaction]
    D -- No --> F[Account still created, user directed to payment page]
    B -- Standalone --> G[POST /api/promo/redeem after account creation]
    G --> H{Code valid, not expired, capacity available, user eligible?}
    H -- Yes --> I[subscriptionStatus: trial set on user doc, trialEndsAt calculated]
    H -- No --> J[Error returned — user directed to Stripe checkout]
    E & I --> K[User accesses /hub with trial access]
    K --> L[7 days later: trial warning email sent by cron]
    L --> M[Trial expires — subscriptionStatus reverts]
    M --> N[User must subscribe via /subscribe]
```
