/*
PROJECT: Studyroom (MVP)
GOAL: Safe study platform where verified students join video "study rooms".
Tutors are moderators from day one. Email/password only (no anonymous).

STACK
- Next.js (App Router, React, TypeScript)
- TailwindCSS (Studyroom brand colors via CSS vars)
- Firebase: Auth (email+password), Firestore (rooms, members, chat, logs), Storage (attachments)
- LiveKit Web SDK: video/audio, screen share, data channels
- Deployment: Vercel frontend + serverless token server

ROLES & AUTH
- Roles: "student", "tutor", "admin" (stored in /users/{uid})
- Sign-in REQUIRED: email/password only (no anonymous)
- Tutors = moderators: can mute/remove users, lock/unlock room, clear chat items, disable others' screen share
- Store: /users/{uid} = { displayName, role, avatarUrl? }

ROOMS & ACCESS
- Rooms PUBLIC by default; creator can switch to PRIVATE/INVITE-ONLY
- Private: via short inviteCode and/or allowedMemberIds list
- Keep join/leave logs for every entry/exit (uid, role, timestamp)
- Room "locked" flag: when locked, only tutors can admit (MVP: disallow new joins unless unlocked)

FEATURES (MVP)
1) Video room
   - On/off mic & camera, hand-raise, screen share (students + tutors)
   - Responsive participant grid (tiles + basic controls)
2) Text chat with attachments
   - Firestore subcollection per room
   - Upload attachments to Firebase Storage; save {name,url,type,size}
   - Limits: ≤ 10 MB; allow safe MIME types (png, jpg, pdf, docx)
   - Tutors can delete messages/attachments; log moderation actions
3) Synced Pomodoro timer
   - Default fixed sequence (minutes): 25/5/25/5/25/5/25/60/25/5/25/5/25/5/25
   - ANYONE can start/reset; allow custom durations per user preference
   - Canonical state in Firestore: { phase: "focus"|"break"|"idle", startedAt: Timestamp|null, durationSec: number, sequence: number }
   - Realtime broadcast via LiveKit data channel: { phase, durationSec, startedAtSec }
   - Late joiners compute remaining = durationSec - (now - startedAt)
4) Moderation & safety
   - Tutor-only actions: mute/unmute, remove participant, lock/unlock room, clear chat items
   - Write entries to /rooms/{id}/logs for auditability
5) Logging
   - /rooms/{id}/logs for: join/leave/mute/remove/lock/unlock/startTimer/resetTimer with actorId/targetId/at/details

DATA MODEL (FIRESTORE)
- /users/{uid}
  displayName: string
  role: "student"|"tutor"|"admin"
  avatarUrl?: string

- /rooms/{roomId}
  name: string
  visibility: "public"|"private"
  createdBy: uid
  inviteCode?: string|null
  allowedMemberIds?: string[]
  locked: boolean
  pomodoro: { phase: "focus"|"break"|"idle", startedAt: Timestamp|null, durationSec: number, sequence: number }
  membersCount: number
  createdAt: Timestamp

- /rooms/{roomId}/members/{uid}
  role: "student"|"tutor"
  joinedAt: Timestamp
  mutedByModerator: boolean
  handRaised: boolean

- /rooms/{roomId}/chat/{msgId}
  senderId: uid
  senderRole: "student"|"tutor"|"admin"
  text?: string
  attachments?: [{ name, url, type, size }]
  createdAt: Timestamp

- /rooms/{roomId}/logs/{logId}
  type: "join"|"leave"|"mute"|"remove"|"lock"|"unlock"|"startTimer"|"resetTimer"
  actorId: uid
  targetId?: uid
  at: Timestamp
  details?: any

TOKEN SERVER (SERVERLESS/EXPRESS)
- POST /livekitToken { idToken, roomName }
- Verify Firebase ID token; confirm room permission/visibility:
  - public OR allowedMemberIds includes uid OR inviteCode valid
- Assign LiveKit grant role:
  - moderator for tutors/admins
  - participant for students
- Return { url, token, role }
- NEVER expose LiveKit API secret to client (use env vars)

UI STRUCTURE (APP ROUTER)
- src/app/page.tsx: Home (sign-in, create/join room)
- src/app/room/[id]/page.tsx: Study room (video grid + right panel + toolbar)
- src/components/PomodoroBar.tsx
- src/components/ChatPanel.tsx
- src/components/ParticipantsPanel.tsx
- src/lib/firebase.ts, src/lib/tokenService.ts, src/lib/roomService.ts, src/lib/chatService.ts

STYLE & BRAND
- Minimal, clean, accessible (labels/ARIA)
- TailwindCSS with Studyroom brand via CSS vars:
  :root {
    --brand: #0ea5e9; /* REPLACE with Studyroom.au primary */
    --brand-600: #0284c7;
    --text: #0b1220;
    --bg: #f8fafc;
  }
- Buttons: clear states (on/off), focus rings, keyboard navigation

CODING CONVENTIONS
- TypeScript strict, React function components + hooks
- Firebase v9 modular imports; async/await
- Small components; prefer composition; colocate minimal state
- Services layer for Firebase/LiveKit calls; UI stays dumb
- Handle permission/camera/mic errors and reconnects
- Validate input, enforce file limits/types before upload

SECURITY (DEV → PROD)
- Dev rules can allow all authed reads/writes; tighten for prod:
  - No anonymous users
  - Only tutors/admins update moderation fields (locked, mutedByModerator)
  - Limit chat attachment metadata; validate types/sizes
  - Enforce room visibility: private rooms require invite or allowlist
- Never store secrets client-side; use serverless env vars

ACCEPTANCE CRITERIA (MVP READY)
- Users can sign in with email/password (no anonymous)
- Create/join a room → see video grid; mic/cam toggle; screen share; hand-raise
- Pomodoro starts/resets; all clients stay in sync; late joiners show correct remaining
- Chat supports text + safe attachments; tutors can delete items
- Logs written for joins/leaves + moderation/timer actions
- Rooms public by default; can switch to private/invite-only
- Deployed on Vercel; token server live and returning tokens

NON-FUNCTIONAL
- Basic Lighthouse friendliness (PWA later)
- Mobile-first responsive layout
- Guardrails for large/unsafe files (<= 10MB, safe MIME)
- Error paths: network fail, token 401, camera denied, firestore permission denied

SUGGESTIONS (FOR COPILOT)
- Generate idiomatic Next.js + TS components and services:
  - Auth form (email/password)
  - Room creation/join flow (Firestore + router push)
  - LiveKit connect helper + video grid/tiles
  - PomodoroBar (Firestore canonical state + data-channel broadcast)
  - ChatPanel (Storage uploads + Firestore messages)
  - ParticipantsPanel (mute/remove/lock; Firestore + LiveKit controls)
  - roomService APIs (createRoom, joinRoom, leaveRoom, toggleVisibility, writeLog)
  - tokenService client (POST /livekitToken)
- Follow modern App Router patterns; compile with current Next.js, Firebase v9, LiveKit Web SDK
*/
