import Link from "next/link";

const offers = [
  {
    title: "In-home tutoring",
    desc: "Calm, confidence-first support at your kitchen table with clear steps, steady pacing and consistent routines.",
  },
  {
    title: "Online tutoring",
    desc: "Live 1:1 sessions via the Studyroom WebApp with shared worksheets, notes and accountability, all from home.",
  },
  {
    title: "Subjects and skills",
    desc: "Literacy, numeracy, study skills, executive function and catch up plans tailored to your child’s goals and year level.",
  },
];

const whoFor = [
  "Prep to Year 12 students who do best with clear explanations and structure around their learning",
  "Anxious and neurodivergent learners, including autistic and ADHD students who feel safer with routine and predictable support",
  "Students rebuilding confidence after setbacks, school avoidance or a run of low marks",
  "High achievers aiming for A or A plus results, extension work, or scholarships",
  "Families who value gentle communication, honest feedback and regular progress updates",
];

const howItWorks = [
  {
    title: "Meet and plan",
    desc: "We learn about your child’s goals, school context, learning style and what has or has not worked before.",
  },
  {
    title: "Tutor match",
    desc: "We match your child with a calm, patient tutor who fits their personality, needs and preferred mode, in home or online.",
  },
  {
    title: "Weekly sessions",
    desc: "One to one sessions with clear scaffolds, repetition and routines so learning feels safe, predictable and achievable.",
  },
  {
    title: "Review and adjust",
    desc: "Short updates for parents and regular check ins so we can celebrate wins, notice patterns and adjust the plan where needed.",
  },
];

/**
 * NEW (Term 1 2026): package-based service model
 * - kept separate so it’s easy to edit later
 */
const packages = [
  {
    title: "5-Week Learning Package",
    price: "$375",
    desc: "A short, structured cycle to rebuild confidence, tighten skills and create momentum.",
    points: [
      "Weekly 1:1 session",
      "Weekly homework provided",
      "Structured session notes",
      "End-of-cycle parent progress update",
    ],
    tag: "Most popular for a focused reset",
  },
  {
    title: "12-Week Term Package",
    price: "$900",
    desc: "A full-term learning plan for steady progress, routines and clear reporting.",
    points: [
      "Weekly 1:1 session",
      "Weekly homework",
      "Mid-term update",
      "End-of-term written report",
    ],
    tag: "Best for consistent term progress",
  },
  {
    title: "Casual sessions (limited)",
    price: "$75",
    desc: "Limited spots for families who need a one-off session or short-term support.",
    points: [
      "Single-session support when available",
      "No structured reporting included",
      "Limited spots each week",
    ],
    tag: "For occasional support only",
  },
];

const pricing = [
  {
    label: "Learning packages (recommended)",
    detail:
      "Studyroom now operates on structured learning packages designed for consistency, clarity and measurable progress across the term.",
  },
  {
    label: "Casual sessions (limited availability)",
    detail:
      "$75 per session. Casual sessions do not include structured reporting and are offered in limited numbers.",
  },
  {
    label: "Group tutoring (optional)",
    detail:
      "$40 per student per session. Best suited to siblings or small groups who work well together and benefit from shared routine.",
  },
];

const locations = [
  "Logan, Beenleigh and Brisbane Southside for in home visits",
  "Online sessions available across Queensland and interstate",
  "School, library and community hub sessions by arrangement",
];

const tutors = [
  {
    name: "Lily",
    focus:
      "Founder and tutor. Education student specialising in Maths and personalised learning. Focused on confidence, routines and helping students feel genuinely proud of their progress.",
  },
  {
    name: "Katarina",
    focus:
      "Calm, organised tutor who supports students with Maths, executive function and study skills. Especially supportive of anxious learners who need steady pacing.",
  },
  {
    name: "Scarlett",
    focus:
      "Primary specialist with a focus on literacy, reading confidence and growth mindset. Gentle accountability and encouragement every session.",
  },
];

const subjectBlocks = [
  {
    level: "Primary, Prep to Year 6",
    points: [
      "Phonics, reading fluency, comprehension and spelling",
      "Number facts, place value, basic operations and problem solving",
      "Building classroom confidence, participation and organisation",
      "Homework support and a gentle introduction to study habits",
    ],
  },
  {
    level: "Junior Secondary, Years 7 to 10",
    points: [
      "English, including essay writing, paragraph structure and exam responses",
      "Maths, including algebra, linear graphs, fractions, indices and skills gaps",
      "Science, including consolidating core concepts and assessment preparation",
      "Study skills, time management and assessment planning",
    ],
  },
  {
    level: "Senior and exam years, Years 11 and 12",
    points: [
      "QCE aligned support in Maths, English and selected sciences",
      "Breaking down internal assessments and external exam preparation",
      "Planning, drafting and revising with clear checklists and scaffolds",
      "Balancing workload, stress and expectations in the final years of school",
    ],
  },
];

const sessionFlow = [
  {
    title: "Arrive and settle",
    text: "A short check in, setting a small goal for the session and revisiting last week’s key idea.",
  },
  {
    title: "Warm up",
    text: "Quick review questions or a low pressure activity to wake up prior knowledge and build confidence.",
  },
  {
    title: "New learning",
    text: "Step by step teaching with visuals, worked examples and plenty of space for questions.",
  },
  {
    title: "Guided practice",
    text: "Students practise with support, gradually taking more ownership while we coach and prompt.",
  },
  {
    title: "Wrap up and next steps",
    text: "A short recap, a simple takeaway and light home practice or a plan for the next session.",
  },
];

const faqs = [
  // Existing FAQs (kept)
  {
    q: "How long are sessions?",
    a: "Most families choose 60 minute sessions once a week. Some students benefit from 45 minute sessions, especially younger or very anxious learners, or two sessions a week during busy assessment periods.",
  },
  {
    q: "Is there a minimum commitment?",
    a: "We recommend trying a block of at least four to six sessions so your child has time to adjust and build trust. There are no long term lock in contracts.",
  },
  {
    q: "Do you give homework?",
    a: "We keep home practice light and purposeful. This might be a short review, a reading goal or finishing a question set, always tailored to your child’s capacity and your family’s schedule.",
  },
  {
    q: "How will I know if my child is improving?",
    a: "You will receive regular check ins about progress, challenges and next steps. We also keep an eye on school feedback, grades and how your child feels about learning.",
  },

  // NEW FAQs (Term 1 2026 package model)
  {
    q: "Why are you moving to packages?",
    a: "Because consistency is what drives progress. Packages allow structured planning, weekly homework, clear session notes and progress updates, so students don’t feel like they are starting over each week.",
  },
  {
    q: "Can I still book casual sessions?",
    a: "Yes — but spots are limited. Casual sessions don’t include structured reporting and are offered when the timetable allows.",
  },
  {
    q: "When do packages and new pricing start?",
    a: "From Term 1, 2026.",
  },
  {
    q: "What happens if we need to pause?",
    a: "If something comes up, we’ll work with you to pause where possible and keep your child’s learning plan steady.",
  },
  {
    q: "What if we miss a session?",
    a: "If you give notice, we’ll aim to reschedule within the same week where possible or adjust the plan. Missed sessions without notice may be forfeited due to limited availability.",
  },
];

export default function TutoringPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-10 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Logan and Brisbane Southside · In home and online · Prep to Year 12
          </p>
          <div className="inline-flex items-center rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
            Calm, confidence first tutoring
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-4xl">
            One-on-one tutoring that brings structure, confidence and clarity
            back into school.
          </h1>
          <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
            Studyroom provides personalised, gentle tutoring for anxious learners
            and neurodivergent students, including autistic and ADHD learners, as
            well as high achievers who want to extend themselves. We focus on
            understanding, not memorising, with clear steps and routines so
            students know what to do and how to do it.
          </p>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Sessions are available in home across Logan, Beenleigh and Brisbane
            Southside, or online via the Studyroom WebApp.
          </p>

          {/* Buttons (updated CTA language, keeping layout) */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
            >
              Apply for a spot
            </Link>
            <Link
              href="/worksheets"
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
            >
              Explore worksheets
            </Link>
          </div>
        </div>
      </section>

      {/* NEW: WHAT'S NEW / LEARNING PACKAGES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              What’s new for Term 1, 2026
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Introducing Studyroom learning packages
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:max-w-3xl md:text-base">
              Studyroom is moving from week-by-week bookings to structured
              learning packages. This creates consistency for students, clarity
              for parents, and measurable progress across the term.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {packages.map((pkg) => (
              <div
                key={pkg.title}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[color:var(--ink)]">
                      {pkg.title}
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {pkg.desc}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
                    {pkg.price}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {pkg.points.map((pt) => (
                    <div key={pt} className="flex items-start gap-3">
                      <span className="mt-1 h-5 w-5 rounded-full bg-[color:var(--brand)]/10 text-center text-xs leading-5 text-[color:var(--brand)]">
                        ✓
                      </span>
                      <p className="text-sm text-[color:var(--ink)]">{pt}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs font-semibold text-[color:var(--muted)]">
                  {pkg.tag}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              Enquire about packages
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* WHAT WE OFFER */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What we offer
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Every student’s plan is personalised, but most families begin with
            weekly one to one support in one of these formats.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {offers.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-lg font-semibold text-[color:var(--ink)]">
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUBJECTS AND FOCUS AREAS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Subjects and focus areas
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            We do more than help with homework. Each session is anchored to clear
            skills and aligned with the Australian Curriculum and your child’s
            current units at school.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {subjectBlocks.map((block) => (
              <div
                key={block.level}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-sm font-semibold text-[color:var(--brand)]">
                  {block.level}
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                  {block.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                Who tutoring is for
              </h2>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Studyroom suits learners who do best with calm, consistent
                support rather than pressure. We work with students who feel
                anxious, overwhelmed or left behind in busy classrooms, as well
                as students who are ready to extend themselves and aim higher.
              </p>
            </div>
            <div className="grid gap-3">
              {whoFor.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
                    ✓
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW SESSIONS WORK */}
      <section className="px-4 md:px-6" id="how-it-works">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            How Studyroom tutoring works
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            The process is simple and supportive from the start. No pushy sales
            calls, just a genuine conversation about what your child needs and
            what is realistic for your family.
          </p>
          <div className="grid gap-4 md:grid-cols-4">
            {howItWorks.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-xs font-semibold uppercase text-[color:var(--brand)]">
                  Step {index + 1}
                </div>
                <div className="mt-1 text-base font-semibold text-[color:var(--ink)]">
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT A SESSION FEELS LIKE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What a typical session feels like
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Every tutor has their own style, but all Studyroom sessions follow a
            calm, predictable rhythm so students know what to expect each week
            and do not feel surprised or unprepared.
          </p>
          <div className="grid gap-4 md:grid-cols-5">
            {sessionFlow.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl bg-[color:var(--card)] p-4 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-xs font-semibold uppercase text-[color:var(--brand)]">
                  {step.title}
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING AND LOCATIONS */}
      <section className="px-4 md:px-6" id="pricing">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          {/* PRICING */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Pricing
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Transparent options designed for consistency, clarity and flexible
              support when needed.
            </p>
            <div className="mt-4 space-y-3">
              {pricing.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {item.label}
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              Pricing is confirmed during your enquiry based on location, year
              level and session length.
            </p>
          </div>

          {/* LOCATIONS */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Locations
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              We keep travel reasonable for tutors and convenient for families
              while offering online options for everyone else.
            </p>
            <div className="mt-4 space-y-3">
              {locations.map((loc) => (
                <div
                  key={loc}
                  className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <div className="h-8 w-8 rounded-full bg-[color:var(--brand)]/10 text-center text-sm font-semibold leading-8 text-[color:var(--brand)]">
                    •
                  </div>
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {loc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Common questions from families
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            If you are unsure whether tutoring is the right step, you are not
            alone. These are some of the questions we hear most often.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-sm font-semibold text-[color:var(--ink)]">
                  {item.q}
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TUTOR PROFILES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                Tutor profiles
              </h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Studyroom is a small, vetted team, not a large marketplace. You
                will always know who is working with your child.
              </p>
            </div>
            <Link
              href="/contact"
              className="text-sm font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
            >
              Find a tutor →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {tutors.map((tutor) => (
              <div
                key={tutor.name}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand-soft)]/60 text-sm font-semibold text-[color:var(--brand)]">
                    {tutor.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[color:var(--ink)]">
                      {tutor.name}
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">
                      Confidence first tutor
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[color:var(--muted)]">
                  {tutor.focus}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl bg-[color:var(--brand)] px-8 py-10 text-white shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Let’s plan together
              </p>
              <h2 className="text-3xl font-semibold leading-tight">
                Ready to join a learning plan?
              </h2>
              <p className="text-sm text-white/85 md:max-w-2xl">
                Tell us about your child’s goals, challenges and learning style.
                We’ll recommend the right learning package and match them with a
                tutor who fits their pace — whether they are catching up, keeping
                up or aiming for top marks.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Apply for a spot
              </Link>
              <Link
                href="/worksheets"
                className="rounded-xl border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Explore worksheets
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
