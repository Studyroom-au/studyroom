# 12 — Current Features

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and connected end-to-end |
| ⚠️ | Partially implemented or partially connected |
| ❌ | Not connected or deprecated |
| ❓ | Unclear — requires further investigation |

---

## Student Features

### Hub Dashboard (`/hub`)

| Feature | Status | Notes |
|---------|--------|-------|
| Greeting with time of day | ✅ | Morning/afternoon/evening variants |
| Streak display | ✅ | Driven by `useStreak` hook, reads `moodLogs` |
| Getting started checklist | ✅ | 4 items: add deadline, add task, log mood, try focus |
| Alex Buddy AI companion | ✅ | Global companion with 10 message keys, idle detection, evening nudge |
| Pomodoro widget (Private Pomodoro) | ✅ | 8-step cycle, history stats, editable durations, audio alarm |
| Task list widget (Quick Study Plan) | ✅ | Daily tasks, progress bar, completion tracking |
| Deadline planner widget (Coming Up Soon) | ✅ | Timeline view, list view, urgency colours, checkpoints |
| Mood tracker widget | ✅ | 5-point scale, notes, 7-day trend graph |
| Resources section | ✅ | Recent tutor-uploaded resources shown on dashboard |
| Study room quick access | ✅ | Links to 4 rooms from dashboard |
| Pomodoro stats (expanded view) | ✅ | Today/week/month counts, streak, avg length, best time of day |
| Assessment breakdown (expanded) | ✅ | Full list of upcoming items with checkpoint tracking |
| Mood trend graph (expanded) | ✅ | 7-day history in expanded sheet view |

### Study Rooms (`/lobby`, `/room/[id]`)

| Feature | Status | Notes |
|---------|--------|-------|
| Room selection lobby | ✅ | 4 rooms with vibes/descriptions |
| LiveKit video + audio | ✅ | Full media session via LiveKit cloud |
| Screen sharing | ✅ | Via RoomControls |
| Real-time whiteboard | ✅ | Firestore-backed strokes (rooms/{id}/whiteboard) |
| In-room chat | ✅ | Firestore-backed (rooms/{id}/chat), banned terms filter |
| Chat moderation | ✅ | Tutors/admin can delete messages; users can report |
| Room participant count | ✅ | Via RoomPresenceBar |
| Connection status indicator | ✅ | ConnectionChip component |
| Room access gate | ✅ | `roomAccessEnabled` on students/{id}, toggled by parent |
| Pomodoro bar in rooms | ⚠️ | PomodoroBar component exists; integration location unclear |

### Student Resources (`/hub/resources`)

| Feature | Status | Notes |
|---------|--------|-------|
| View all assigned resources | ✅ | Filtered from `resources` collection |
| Resource types: worksheet, guide, past paper, flashcard | ✅ | `type` field on resource doc |
| File download | ✅ | Via Firebase Storage URLs stored on resource docs |

### Student Profile (`/hub/profile`)

| Feature | Status | Notes |
|---------|--------|-------|
| Account settings page | ✅ | Exists; exact fields unclear — requires further reading |
| Theme/notification preferences | ❓ | Unclear — not fully explored |

### Onboarding (`/onboarding`)

| Feature | Status | Notes |
|---------|--------|-------|
| Collect student name, year level, DOB, school | ✅ | Stored in students/{id} |
| Subject selection | ✅ | Array of subjects |
| Parent info (if under 16) | ✅ | Optionally creates parent account |
| Referral source | ✅ | Stored on user doc |
| Terms/privacy/guardian consent | ✅ | Required checkboxes |
| `onboardingComplete` flag set | ✅ | Unlocks /hub access |

---

## Parent Features

### Parent Portal (`/parent`)

| Feature | Status | Notes |
|---------|--------|-------|
| View child's task list | ✅ | Via `/api/parent/hub-data` |
| View child's upcoming/deadlines | ✅ | — |
| View child's mood logs | ✅ | — |
| View child's pomodoro history | ✅ | — |
| View child's session history | ✅ | — |
| View session notes (tutor logs) | ✅ | — |
| View resources assigned to child | ✅ | — |
| Add task for child | ✅ | `POST /api/parent/add-task` |
| Add deadline/upcoming for child | ✅ | `POST /api/parent/add-upcoming` |
| Toggle study room access | ✅ | `POST /api/parent/room-access` → `roomAccessEnabled` |
| View subscription/trial status | ✅ | — |
| Add child to account | ⚠️ | API exists (`/api/parent/add-child`) but UI flow unclear |
| Family billing management | ⚠️ | Stripe customer portal accessible; family subscription flow not fully wired |
| Multiple children view | ✅ | All children shown in parallel |

---

## Tutor Features

### Tutor Dashboard (`/hub/tutor`)

| Feature | Status | Notes |
|---------|--------|-------|
| Tutor home with 4 workspace cards | ✅ | Sessions, Leads, Students, Payouts |
| Tutor access request flow | ✅ | For tutor_pending users |
| Approved access banner | ✅ | Shown after recent approval |

### Session Management (`/hub/tutor/sessions`)

| Feature | Status | Notes |
|---------|--------|-------|
| Schedule new session | ✅ | Creates sessions/{id} with status: scheduled |
| View session calendar | ✅ | — |
| Mark session complete | ✅ | `POST /api/sessions/status` → billing triggered |
| Cancel session | ✅ | — |
| Reschedule session | ✅ | `POST /api/sessions/reschedule` |
| Recurring session series | ✅ | Via `seriesKey`; update all via `/api/sessions/recurring/update` |
| Session notes (brief) | ✅ | `notes` field on sessions/{id} |
| Session log with detailed notes | ✅ | `sessions/{id}/logs/{logId}` via SessionLogEditor |
| Work sample upload | ✅ | Files uploaded to Firebase Storage; URL stored in log |
| Session recap email | ✅ | `POST /api/email/session-recap` (internal trigger) |

### Leads Marketplace (`/hub/tutor/leads`, `/hub/tutor/leads/[id]`)

| Feature | Status | Notes |
|---------|--------|-------|
| View unclaimed leads | ✅ | Tutors see new leads via Firestore rules |
| View lead detail | ✅ | Student needs, availability, subjects |
| Claim a lead | ✅ | `GET /api/leads/[id]/claim` → sets claimedTutorId |

### Students (`/hub/tutor/students`, `/hub/tutor/students/[id]`)

| Feature | Status | Notes |
|---------|--------|-------|
| View assigned students | ✅ | By assignedTutorId on students/{id} |
| Student profile with notes | ✅ | tutorNotes field |
| Session history per student | ✅ | StudentSessionHistoryPanel component |
| Create new student + parent accounts | ✅ | CreateStudentCard component |
| Link existing student | ⚠️ | `src/app/api/tutor/link-student/` added recently (untracked) |

### Resources (`/hub/tutor/resources`)

| Feature | Status | Notes |
|---------|--------|-------|
| Upload worksheets, guides, past papers | ✅ | Creates resources/{id} |
| Assign resources to specific student or all | ✅ | `assignedTo` field |
| Delete own resources | ✅ | Tutors can delete own uploads |

### Payouts (`/hub/tutor/payouts`)

| Feature | Status | Notes |
|---------|--------|-------|
| Filter by pay period | ✅ | — |
| Generate payout export file | ✅ | — |
| View payment records | ✅ | — |

### Calendar (`/hub/tutor/calendar`)

| Feature | Status | Notes |
|---------|--------|-------|
| Calendar view of sessions | ⚠️ | Page exists; exact implementation and completeness unclear |

---

## Admin Features

### Admin Dashboard (`/hub/admin`)

| Feature | Status | Notes |
|---------|--------|-------|
| 7-card admin overview | ✅ | Leads, Clients, Tutors, Sessions, Add Student, Promo, Package Alerts |
| Data export | ✅ | `POST /api/admin/export` → Google Sheets |

### Leads (`/hub/admin/leads`)

| Feature | Status | Notes |
|---------|--------|-------|
| View all leads | ✅ | — |
| Filter by status | ✅ | — |
| Lead detail view | ✅ | — |
| Assign tutor to lead | ✅ | — |
| Create lead manually | ✅ | `/hub/admin/leads/new` |
| Update lead status | ✅ | — |

### Clients/Families (`/hub/admin/clients`)

| Feature | Status | Notes |
|---------|--------|-------|
| View all families | ✅ | — |
| Family detail with all students | ✅ | — |
| View subscription status | ✅ | — |
| Student management from client view | ✅ | — |

### Tutors (`/hub/admin/tutors`)

| Feature | Status | Notes |
|---------|--------|-------|
| View all tutors | ✅ | — |
| Tutor profile with assignments | ✅ | — |
| Approve/reject tutor access requests | ✅ | `POST /api/admin/tutor-access/decision` |
| Grant tutor role directly | ✅ | `POST /api/admin/grant-tutor` |
| Issue tutor access codes | ✅ | Stored in tutorAccessCodes collection |

### Sessions (`/hub/admin/sessions`, `/hub/admin/calendar`)

| Feature | Status | Notes |
|---------|--------|-------|
| View all sessions | ✅ | — |
| Filter by date, tutor, student, status | ✅ | — |
| View completed session notes | ✅ | — |
| Session calendar view | ⚠️ | Page exists; completeness unclear |

### Students (`/hub/admin/students`)

| Feature | Status | Notes |
|---------|--------|-------|
| Add existing student (bypass public enrolment) | ✅ | StudentOnboardingPanel via `/hub/admin/students/add-existing` |
| Student profile view/edit | ✅ | — |

### Billing

| Feature | Status | Notes |
|---------|--------|-------|
| Promo code creation | ✅ | `POST /api/admin/promo/create` |
| Package alerts (< 4 sessions) | ✅ | `/hub/admin/packages` |
| Payments page | ✅ | — |
| Invoices page | ✅ | — |
| Push invoice to Xero | ✅ | `POST /api/billing/push-invoice-to-xero` |
| Void Xero invoice | ✅ | `POST /api/xero/invoices/void` |
| Payment report | ❓ | Route exists (`/api/payments/report`); UI and completeness unclear |

### Blog (`/hub/admin/blog`)

| Feature | Status | Notes |
|---------|--------|-------|
| Create blog post | ✅ | Stored in blogPosts/{slug} |
| Edit blog post | ✅ | — |
| Delete blog post | ✅ | — |
| Publish/unpublish | ✅ | `published` boolean field |

### Integrations (`/hub/admin/integrations/xero`)

| Feature | Status | Notes |
|---------|--------|-------|
| Xero OAuth setup | ✅ | Admin-only OAuth flow |
| Xero token management | ✅ | Auto-refresh in xero.ts |
| Create Xero invoice (manual) | ✅ | Per session |
| Void Xero invoice | ✅ | — |
| Batch push invoices | ✅ | push-invoice-to-xero route |

---

## Platform-Wide Features

| Feature | Status | Notes |
|---------|--------|-------|
| Firebase Auth (email/password) | ✅ | — |
| Role-based access control | ✅ | useUserRole + Firestore rules |
| Real-time data (onSnapshot) | ✅ | All major views |
| Mobile-responsive design | ✅ | — |
| Beta feedback button | ✅ | FeedbackButton component → betaFeedback collection |
| Blog (public) | ✅ | /blog listing + /blog/[slug] detail |
| Trial warning emails (cron) | ⚠️ | Route exists; requires external scheduler to be configured |
| EOD invoice cron | ⚠️ | Route exists; requires external scheduler |
| Google Sheets export | ❓ | Route exists; target sheet unclear |
