# 02 — User Roles

## Role Overview

Studyroom has five distinct roles. Four are stored in Firestore (`roles/{uid}.role`); the admin role is additionally gated by a hard-coded email address.

| Role | Firestore Value | How Assigned | Portal |
|------|----------------|--------------|--------|
| Student | `"student"` | Signup → Stripe → onboarding, or via family signup | `/hub` |
| Parent | `"parent"` | Family signup, or admin promotion | `/parent` |
| Tutor | `"tutor"` | Admin approval or access code redemption | `/hub/tutor` |
| Tutor Pending | `"tutor_pending"` | Self-registration via `/tutor-access` | `/hub/tutor` (limited) |
| Admin | `"admin"` | Hard-coded email gate (`lily.studyroom@gmail.com`) | `/hub/admin` |

> **Note:** The admin role is determined two ways in parallel:
> 1. In client-side code (`useUserRole.ts`), any email in a hard-coded allowlist is always treated as admin
> 2. In Firestore security rules, only `lily.studyroom@gmail.com` is treated as admin
> 
> A second email (`contact.studyroomaustralia@gmail.com`) appears in the client-side hook but NOT in the Firestore rules — this creates an inconsistency where that user appears as admin in the UI but has different Firestore permissions.

---

## Student

### Purpose
The primary end-user of the Studyroom platform. Uses the study hub daily for task management, focus sessions, deadline tracking, mood logging, and access to tutor-uploaded resources.

### How a Student Account Is Created
- **Path A — Family signup:** Admin or parent initiates family signup at `/api/signup/family`. Creates both a parent and student Firebase account simultaneously.
- **Path B — Independent signup:** Student creates their own Firebase account, subscribes via Stripe, and completes onboarding.

### Subscription Gate
A student cannot access `/hub` unless:
- `users/{uid}.subscriptionStatus` is `"active"` or `"trial"`
- `users/{uid}.onboardingComplete` is `true`

### Pages Accessible
- `/hub` — Main dashboard (tasks, deadlines, mood, pomodoro, resources)
- `/hub/resources` — Full resource library
- `/hub/profile` — Account settings
- `/lobby` — Study room selection
- `/room/[id]` — Live study room (if `roomAccessEnabled` is true on their `students/{id}` doc)

### Firestore Permissions
| Collection | Read | Write |
|-----------|------|-------|
| `users/{uid}` (own) | ✅ | ✅ |
| `users/{uid}/tasks` | ✅ | ✅ |
| `users/{uid}/upcoming` | ✅ | ✅ |
| `users/{uid}/moodLogs` | ✅ | ✅ |
| `users/{uid}/pomoHistory` | ✅ | ✅ |
| `users/{uid}/streak` | ✅ | ✅ |
| `sessions/{id}` (own sessions only) | ✅ | ❌ |
| `sessions/{id}/logs` (own sessions) | ✅ | ❌ |
| `resources` (all) | ✅ | ❌ |
| `rooms`, `rooms/chat`, `rooms/whiteboard` | ✅ | ✅ |
| `roles/{uid}` (own) | ✅ | ✅ (limited: cannot change own role) |

### Key Data Fields
- `users/{uid}.subscriptionStatus` — subscription gate
- `users/{uid}.onboardingComplete` — onboarding gate
- `students/{studentId}.hubUid` — links CRM student record to auth user
- `students/{studentId}.roomAccessEnabled` — parent-controlled room access toggle

### Relationships
- Belongs to one `clients/{id}` (family record) via `students/{id}.clientId`
- Has one assigned tutor via `students/{id}.assignedTutorId`
- Has one `plans/{id}` via `students/{id}.activePlanId`
- May have one or more `sessions/{id}` records
- May have one `entitlements/{id}` record (for prepaid packages)

---

## Parent

### Purpose
Guardian of one or more enrolled students. Monitors child's study activity, views session notes, and manages family account settings. The parent portal is a read-mostly experience with limited write capabilities (add tasks, add deadlines, toggle room access).

### How a Parent Account Is Created
- **Path A — Family signup:** Created automatically alongside the student account via `/api/signup/family`
- **Path B — During independent student onboarding:** If a parent email and password are provided during onboarding (`/api/onboarding/submit`), a parent account is created server-side

### Pages Accessible
- `/parent` — Main parent portal (all children's data: tasks, sessions, moods, pomodoro, resources)

> Parents are redirected to `/parent` instead of `/hub` when they log in. The hub layout checks for the parent role and redirects accordingly.

### What Parents Can Do
- View all linked children's tasks, upcoming/deadline items, mood logs, session history, pomodoro history, and resources
- Add tasks for a child (via `POST /api/parent/add-task`)
- Add deadlines/upcoming items for a child (via `POST /api/parent/add-upcoming`)
- Toggle study room access for a child (via `POST /api/parent/room-access`)
- View session notes written by tutors
- View subscription/trial status

### Firestore Permissions (via security rules)
Parents read `clients/{id}` and `students/{id}` records by **email match** — `clients/{id}.parentEmail == authedEmail()`. This is a Firestore security rule, not application-level logic, meaning the parent email stored at account creation time permanently governs access.

| Collection | Read | Write |
|-----------|------|-------|
| `clients/{id}` (own family) | ✅ | ❌ |
| `students/{id}` (linked children) | ✅ | ❌ |
| `sessions/{id}` (children's sessions) | ✅ | ❌ |
| `sessions/{id}/logs` (children's sessions) | ✅ | ❌ |

### Key Data Fields
- `clients/{id}.parentEmail` — used for all Firestore permission checks
- `clients/{id}.parentUid` — links to parent's Firebase Auth account
- `students/{id}.hubUid` — used to fetch child's hub data

### Relationships
- One parent (client record) → one or more students
- Parent email is the linking key across `clients`, `students`, and `sessions` for read access

---

## Tutor

### Purpose
An approved Studyroom educator. Manages their own tutoring sessions, uploads resources, logs session notes with work samples, views their assigned students' records, and claims new leads from the marketplace.

### How a Tutor Account Is Activated
- **Path A — Access code:** Admin issues a one-time code stored in `tutorAccessCodes` collection. Tutor redeems via `POST /api/tutor/redeem-code`. Sets role to `"tutor"` and `subscriptionStatus` to `"tutor_access"`.
- **Path B — Admin approval:** Tutor submits request at `/hub/tutor` (while in `tutor_pending` state). Admin approves via admin portal → `POST /api/admin/tutor-access/decision`.

### Pages Accessible
- `/hub/tutor` — Tutor dashboard
- `/hub/tutor/sessions` — Schedule, complete, and manage sessions
- `/hub/tutor/leads` — Leads marketplace (claim open leads)
- `/hub/tutor/leads/[leadsId]` — Single lead detail
- `/hub/tutor/students` — List of assigned students
- `/hub/tutor/students/[id]` — Single student profile with session history and notes
- `/hub/tutor/payouts` — Payout export
- `/hub/tutor/resources` — Upload and manage resources
- `/hub/tutor/calendar` — Calendar view

### Firestore Permissions
| Collection | Read | Write |
|-----------|------|-------|
| `clients/{id}` (assigned students only) | ✅ | tutorNotes only |
| `students/{id}` (assigned students only) | ✅ | limited fields |
| `students/{id}/sessions` | ✅ | ✅ |
| `sessions/{id}` (own sessions) | ✅ | limited fields |
| `sessions/{id}/logs` (own sessions) | ✅ | ✅ |
| `leads/{id}` (unclaimed or own) | ✅ | claim only |
| `resources` | ✅ | ✅ (own uploads) |
| `plans/{id}` (own tutees) | ✅ | ❌ |
| `entitlements/{id}` (own tutees) | ✅ | ❌ |
| `invoices/{id}` (own tutees) | ✅ | ❌ |
| `users/{uid}` (students only) | ✅ | ❌ |
| `rooms`, `rooms/chat` | ✅ | ✅ |

> Tutor assignment is determined by `assignedTutorId` or `assignedTutorEmail` on the `clients/{id}` and `students/{id}` documents.

### Key Data Fields
- `sessions/{id}.tutorId` — used for tutor ownership checks
- `students/{id}.assignedTutorId` / `assignedTutorEmail` — the tutor-student link
- `users/{uid}.subscriptionStatus = "tutor_access"` — tutor does not pay a subscription

---

## Tutor Pending

### Purpose
A transitional state for tutors who have self-registered but not yet been approved by the admin.

### Behaviour
When a user with `roles/{uid}.role = "tutor_pending"` visits `/hub/tutor`, they see a special approval-pending form instead of the full tutor portal. This form collects:
- Subjects taught
- Year levels
- Delivery mode (online / in-home)
- Service area / suburb
- ABN
- Blue Card / WWCC status

Submission calls `POST /api/tutor/request-access` (stores a lead for admin review).

### Firestore Permissions
Tutor Pending has no special Firestore permissions beyond what any authenticated user has. They cannot access student records, sessions, leads, or resources until promoted to `"tutor"`.

---

## Admin

### Purpose
Internal Studyroom staff with full platform access. Currently scoped to a single operator. Manages all clients, students, tutors, sessions, leads, billing, promo codes, blog content, and integrations.

### How Admin Is Determined
The admin role is gated by a hard-coded email in both the client-side hook (`useUserRole.ts`) and Firestore security rules. No Firestore role document needs to exist — the email check is sufficient.

### Pages Accessible
All pages. Admin bypasses:
- Subscription gate (in `/hub/layout.tsx`)
- Onboarding gate
- Tutor assignment checks
- All Firestore security rule conditions

### Key Admin Pages
- `/hub/admin` — Control panel overview
- `/hub/admin/leads` and `/leads/[id]` — Lead management
- `/hub/admin/clients` and `/clients/[id]` — Family management
- `/hub/admin/tutors` and `/tutors/[id]` — Tutor management
- `/hub/admin/students/add-existing` and `/students/[id]` — Student management
- `/hub/admin/sessions` — All sessions calendar and history
- `/hub/admin/blog` — Blog CMS
- `/hub/admin/promo` — Promo code creation
- `/hub/admin/packages` — Package alert (<4 sessions remaining)
- `/hub/admin/payments` — Payment records
- `/hub/admin/invoices` — Invoice management
- `/hub/admin/integrations/xero` — Xero OAuth and sync

### Firestore Permissions
Full read/write on all collections. Admin SDK (server-side) bypasses all Firestore security rules entirely.
