# 01 — Product Overview

## What Is Studyroom?

Studyroom is an Australian tutoring SaaS platform based in Queensland. It connects K–12 students with professional tutors through a combination of managed in-home sessions, online video sessions, and group workshops. The platform provides each student with a personalised study hub — a gamified dashboard for managing tasks, deadlines, mood, focus sessions, and tutor-uploaded resources.

The product has three distinct layers:

1. **Public marketing site** — landing pages, blog, enrolment form, contact form
2. **Student & parent hub** — the core learning management experience for enrolled families
3. **Operations layer** — tutor portal, admin control panel, billing engine, and accounting integration

---

## Target Users

| User | Description |
|------|-------------|
| **Student** | K–12 student enrolled in tutoring sessions. Primary consumer of the study hub. |
| **Parent** | Guardian of one or more enrolled students. Monitors child progress and manages account. |
| **Tutor** | Approved Studyroom educator. Manages sessions, uploads resources, logs session notes. |
| **Admin** | Internal Studyroom staff (currently one admin). Manages all clients, tutors, billing, and operations. |

---

## Service Offerings

- **In-home tutoring** — One-on-one sessions at the student's home
- **Online tutoring** — One-on-one video sessions via built-in study rooms
- **Group sessions** — Small group tutoring at a reduced per-student rate
- **HeadStart workshops** — Structured group programs (marketed on the `/headstart` page)
- **Custom worksheets** — Tutor-produced or platform-generated worksheets (marketed on `/worksheets`)

---

## Subscription Model

Students (or their parents) subscribe via Stripe on a monthly basis. Three plan types govern how sessions are billed:

- **Casual** — Pay-per-session invoiced via Xero
- **Package 5** — 5 prepaid sessions (+ 0 bonus)
- **Package 12** — 10 prepaid sessions (+ 2 bonus)

Trial access is available via promo codes (typically 7-day free trials). Full-access codes (intended for beta participants) grant extended trial periods.

---

## Core Philosophy

- **Student-first design** — The study hub is built around what students actually need day-to-day: tasks, deadlines, focus sessions, and mood tracking
- **Accountability without pressure** — Gamification (streaks, mood logs, pomodoro stats) encourages consistency without adding academic pressure
- **Transparency for parents** — The parent portal gives guardians a real-time view into their child's study activity and tutor session notes
- **Operational efficiency** — The admin and tutor portals are built to minimise manual overhead for tutors and reduce admin workload for the team

---

## Design Principles

- **Role-gated UI** — Each user type sees only what is relevant to their role; no role leakage
- **Real-time data** — Firestore `onSnapshot` listeners provide live updates throughout the hub
- **Mobile-responsive** — All portals are designed for use on phones and tablets as well as desktop
- **Minimal cognitive load** — Widgets collapse/expand; the dashboard surfaces the most important information first
- **Consistent visual identity** — Primary colour `#456071`, background `#f8f5f0`, clean card-based layouts

---

## Beta Status

As of the current implementation, the following areas are in beta:

- **Parent portal** — Functional but under active development. Family billing is partially connected.
- **Family signup flow** — The combined parent + student account creation path (`/api/signup/family`) is implemented but the parent Stripe subscription flow is not fully wired.

The core student hub, tutor portal, and admin control panel are production-ready.

---

## Vision & Long-Term Goals

Studyroom aims to become the leading tutoring platform for Queensland families by combining:

- Professional, vetted tutors with structured session management
- A genuinely useful study tool that students want to use between sessions
- Transparent billing and reporting for families
- Efficient operations tooling that scales without growing the admin team

The platform is designed to support eventual expansion to additional tutors, states, and service types without requiring significant architectural changes.
