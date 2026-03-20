# Studyroom

Studyroom is a tutoring business web app built with Next.js, Firebase, LiveKit, and Xero.

It combines:

- a public marketing site for Studyroom Australia
- a parent enquiry and enrolment funnel
- a student study hub with personal productivity tools
- live online study rooms with video, chat, and a shared whiteboard
- tutor and admin portals for leads, students, sessions, billing, and invoicing

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Firebase Auth
- Cloud Firestore
- Firebase Storage
- LiveKit
- FullCalendar
- Nodemailer / Resend / Formspree for notifications
- Xero for accounting integration

## What The App Does

### Public site

The public site is the parent-facing and marketing side of the business.

- `/` homepage with brand, services, packages, testimonials, and tutor summaries
- `/tutoring` tutoring offer, packages, pricing, policies, and subject coverage
- `/headstart` holiday workshop sales page
- `/worksheets` custom worksheet packs and sample downloads
- `/about` business philosophy, founder story, and safety positioning
- `/contact` general enquiry form
- `/enrol` detailed enrolment form
- `/blog` markdown-based blog
- `/legal/*` privacy, safety, and terms pages

### Logged-in student experience

Authenticated users get a study hub built around calm planning and focus.

- private Pomodoro timer
- personal task list
- daily planner for upcoming work
- mood tracker with private history
- profile page
- room lobby and live study rooms

### Study rooms

The room system is the real-time collaboration part of the app.

- LiveKit-powered video and audio rooms
- room lobby with default rooms and user-created temporary rooms
- room chat backed by Firestore
- shared whiteboard backed by Firestore
- room activity and participant count tracking
- in-room Pomodoro widget

### Tutor and admin operations

The internal portals support day-to-day tutoring business operations.

- tutor session scheduling and rescheduling
- recurring session creation
- session completion, cancellation, and no-show handling
- lead review and assignment
- student and client records
- package / entitlement tracking
- invoice and payment reporting
- Xero connection for invoice creation

## Main Routes

### Public pages

- `/`
- `/about`
- `/tutoring`
- `/headstart`
- `/worksheets`
- `/contact`
- `/enrol`
- `/blog`
- `/blog/[slug]`
- `/legal/privacy`
- `/legal/safety`
- `/legal/terms`

### Authenticated pages

- `/login`
- `/profile`
- `/hub`
- `/lobby`
- `/room/[id]`

### Tutor portal

- `/hub/tutor`
- `/hub/tutor/calendar`
- `/hub/tutor/leads`
- `/hub/tutor/leads/[leadsId]`
- `/hub/tutor/payouts`
- `/hub/tutor/sessions`
- `/hub/tutor/students`
- `/hub/tutor/students/[id]`

### Admin portal

- `/hub/admin`
- `/hub/admin/calendar`
- `/hub/admin/clients`
- `/hub/admin/integrations/xero`
- `/hub/admin/invoices`
- `/hub/admin/leads`
- `/hub/admin/leads/[leadId]`
- `/hub/admin/payments`
- `/hub/admin/sessions`
- `/hub/admin/students/add-existing`
- `/hub/admin/students/[studentId]`
- `/hub/admin/tutors`
- `/hub/admin/tutors/[tutorId]`

## Core Data Areas

Firestore is used as the main system of record for:

- `users`
- `roles`
- `rooms`
- `rooms/{roomId}/chat`
- `rooms/{roomId}/whiteboard`
- `reports`
- `leads`
- `enquiries`
- `clients`
- `students`
- `sessions`
- `invoices`
- `plans`
- `entitlements`
- `integrations`

User-specific productivity data is stored under each user document, including:

- `pomoState`
- `tasks`
- `moodLogs`
- `upcoming`

## Roles

The app currently uses these effective roles:

- `student`
- `tutor_pending`
- `tutor`
- `admin`

Roles are read from Firestore and also influenced by the hard-coded admin email in the app and Firestore rules.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Add environment variables

Create `.env.local` and provide the values your environment needs.

#### Firebase client

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
```

#### Firebase Admin

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

#### LiveKit

```env
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
```

#### Email / notifications

You do not need every provider at once, but at least one delivery path should be configured for enquiry and enrolment alerts.

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

MAIL_TO=
ENQUIRY_ALERT_TO=
ENROL_ALERT_TO=

RESEND_API_KEY=
RESEND_FROM=

FORMSPREE_ENDPOINT=
FORMSPREE_ENQUIRY_ENDPOINT=
FORMSPREE_ENROL_ENDPOINT=
```

#### Xero

```env
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=
XERO_SALES_ACCOUNT_CODE=
XERO_TENANT_ID=
XERO_TOKEN_SET_JSON=
```

### 3. Run the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

### 4. Lint

```bash
npm run lint
```

## Notable Implementation Details

- Firebase client setup lives in `src/lib/firebase.ts`.
- Firebase Admin setup lives in `src/lib/firebaseAdmin.ts`.
- Firestore security rules are defined in `firestore.rules`.
- Blog posts are loaded from markdown files under `content/blog`.
- Room chat attachments are currently disabled in `src/components/ChatPanel.tsx`.
- Tutor and admin billing logic is centralized in `src/lib/studyroom/billing.ts` and `src/lib/studyroom/serverBilling.ts`.
- Xero token storage is handled through Firestore `integrations/xero` or optional environment variables.

## Project Structure

```text
src/
  app/                  Next.js routes
  components/           shared UI, room UI, widgets, admin/tutor UI
  hooks/                auth/profile/role hooks
  lib/                  Firebase, billing, Xero, posts, validation
content/
  blog/                 markdown blog posts
public/
  docs/                 downloadable worksheet samples
scripts/                local utility scripts
```

## Current Product Summary

Studyroom is no longer just a study-room MVP. It is a combined tutoring website and business operations platform with:

- lead capture
- enrolment intake
- student planning tools
- live online study rooms
- tutor scheduling workflows
- admin CRM-style tooling
- billing and invoice support

## Notes

- The app assumes Firebase Auth and Firestore are available.
- Some admin-only behaviour depends on the email `lily.studyroom@gmail.com` being treated as admin in code and rules.
- Production readiness depends on environment configuration, Firestore rules, and third-party integrations being set correctly.
