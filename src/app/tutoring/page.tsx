import Link from "next/link";

/**
 * TERM 2 PACKAGE SALE
 * Toggle on/off when needed.
 */
const TERM2_SALE_ACTIVE = true;
const TERM2_SALE_ENDS = "31 March";
const TERM2_SALE_LABEL = `Term 2 Early Enrolment Offer ends ${TERM2_SALE_ENDS}`;

const offers = [
  {
    title: "In-home tutoring",
    desc: "1:1 support delivered in-home across Logan, Beenleigh and Brisbane Southside.",
  },
  {
    title: "Online tutoring",
    desc: "Live 1:1 sessions delivered online via the Studyroom WebApp from anywhere.",
  },
];

const whoFor = [
  "Prep to Year 12 students who benefit from clear explanations and predictable learning routines",
  "Anxious and neurodivergent learners, including autistic and ADHD students",
  "Students catching up after setbacks, school avoidance or a run of low marks",
  "High achievers aiming for extension, scholarships or top results",
  "Families who value clear communication, steady progress and consistent support",
];

const howItWorks = [
  {
    title: "Enquire",
    desc: "Share your child’s year level, goals, and what support would help most right now.",
  },
  {
    title: "Plan",
    desc: "We confirm focus areas, preferred mode (in-home or online) and a realistic weekly plan.",
  },
  {
    title: "Match",
    desc: "We match your child with a tutor who fits their level, needs and learning style.",
  },
  {
    title: "Start weekly sessions",
    desc: "60-minute sessions that build skill, consistency and measurable progress over time.",
  },
];

/**
 * Packages are the PRIMARY model.
 * Prices shown for in-home and online.
 * Term package = 10 weekly term sessions + 2 bonus sessions (same term only).
 */
const packages = [
  {
    title: "5-Week Package (mid-term block)",
    priceInHome: "$375",
    priceOnline: "$300",
    desc: "A structured 5-week block to strengthen core skills and build momentum.",
    points: [
      "5 x 60-minute sessions",
      "Clear weekly focus and skills tracking",
      "Session notes + next steps",
      "Light home practice where helpful",
    ],
    tag: TERM2_SALE_ACTIVE ? TERM2_SALE_LABEL : "Most popular for a focused reset",
  },
  {
    title: "12-Session Term Package (10 + 2 bonus)",
    priceInHome: "$900",
    priceOnline: "$720",
    desc: "A term-based structure for consistent progress and assessment support.",
    points: [
      "10 weekly term sessions",
      "+ 2 bonus sessions (same term only)",
      "Bonus sessions can be used in term or holidays",
      "Clear planning across the term",
    ],
    tag: TERM2_SALE_ACTIVE ? TERM2_SALE_LABEL : "Best for term consistency",
  },
  {
    title: "Casual sessions (limited)",
    priceInHome: "$75",
    priceOnline: "$60",
    desc: "One-off sessions when availability allows.",
    points: [
      "60-minute session (in-home or online)",
      "Best for short-term or urgent support",
      "Limited weekly availability",
    ],
    tag: "Limited availability",
  },
];

const locations = [
  "In-home: Logan, Beenleigh and Brisbane Southside",
  "Online: Queensland and interstate",
  "School, library and community sessions by arrangement",
];

/**
 * SINGLE SOURCE OF TRUTH:
 * Pricing + policies live here only (not repeated in packages/FAQ).
 */
const pricingAndPolicies = [
  {
    label: "Session length",
    detail: "All standard sessions are 60 minutes.",
  },
  {
    label: "Standard pricing",
    detail: "In-home: $75 · Online: $60 · Group (same time): $45 per child",
  },
  {
    label: "Packages (primary model)",
    detail:
      "Packages are prepaid and secure your weekly time slot. Payment is required upfront to confirm enrolment.",
  },
  {
    label: "Casual sessions (invoice after session)",
    detail:
      "Casual sessions are invoiced after session completion is logged. Payment is due under invoice terms.",
  },
  {
    label: "Late payment",
    detail:
      "If an invoice is 7 days overdue, a $5 late fee applies. Services may be suspended or withdrawn for unpaid invoices.",
  },
  {
    label: "Cancellations and rescheduling",
    detail:
      "We require 24 hours notice to reschedule. Sessions cancelled with less than 24 hours notice are forfeited due to reserved time and limited availability.",
  },
  {
    label: "School holidays",
    detail:
      "Weekly sessions continue year-round by default. Families may pause during school holidays with notice and will not be penalised for pausing during holidays.",
  },
  {
    label: "Tutor cancellations",
    detail:
      "If a tutor cancels, we offer a reschedule. If we can’t find a suitable time, the session value is held as credit.",
  },
  {
    label: "Withdrawals and refunds",
    detail:
      "No refunds if a student withdraws mid-block. Term package bonus sessions must be used within the same term and are not transferable to the next term.",
  },
  {
    label: "Siblings and group sessions",
    detail:
      "No sibling discounts. If siblings are tutored at the same time, it is priced as a group session at $45 per child.",
  },
];

const tutors = [
  {
    name: "Lily",
    focus:
      "Founder and tutor. Education student specialising in Maths and personalised learning across Prep to Year 12. Lily works with students who feel anxious, behind or unsure of themselves, using explicit teaching, clear routines and structured scaffolds to build genuine understanding and confidence over time.",
  },
  {
    name: "Katarina",
    focus:
      "Maths and executive function tutor supporting primary and junior secondary students. Katarina helps students break work into manageable steps and develop stronger organisation skills, with steady pacing and clear expectations that support anxious learners.",
  },
  {
    name: "Scarlett",
    focus:
      "Primary specialist focused on literacy, reading fluency and foundational skills. Scarlett supports decoding, comprehension and written expression through explicit instruction and consistent practice, helping students build independence and resilience alongside core skill growth.",
  },
  {
    name: "Casey (He/Him)",
    focus:
      "Maths tutor supporting all year levels, with additional expertise in senior assessment and assignment support across subjects. Casey uses clear explanations, structured strategies and a calm approach to make complex tasks feel manageable. Students build genuine understanding and lasting confidence so they feel prepared, capable and proud of their progress.",
  },
];

const subjectBlocks = [
  {
    level: "Primary, Prep to Year 6",
    points: [
      "Phonics, reading fluency, comprehension and spelling",
      "Number facts, place value, operations and problem solving",
      "Confidence with classroom participation and routines",
      "Homework support and early study habits",
    ],
  },
  {
    level: "Junior Secondary, Years 7 to 10",
    points: [
      "English: writing structure, paragraphs, exams and comprehension",
      "Maths: gaps, algebra, graphs, fractions, indices and core skills",
      "Science: concept consolidation and assessment preparation",
      "Study skills: time management and assessment planning",
    ],
  },
  {
    level: "Senior and exam years, Years 11 and 12",
    points: [
      "QCE aligned support in Maths, English and selected sciences",
      "IA planning, drafting, revising and exam preparation",
      "Checklists, scaffolds and clear study routines",
      "Workload and stress management in high-pressure terms",
    ],
  },
];

/**
 * Shortened “typical session”
 */
const sessionFlow = [
  {
    title: "Set the focus",
    text: "Quick check-in and a clear goal for the session.",
  },
  {
    title: "Teach and model",
    text: "Step-by-step teaching with worked examples and visuals where needed.",
  },
  {
    title: "Guided practice",
    text: "Students practise with coaching and prompts to build accuracy and confidence.",
  },
  {
    title: "Wrap and next steps",
    text: "Short recap plus a simple plan for home practice or the next session.",
  },
];

/**
 * FAQ: keep helpful, avoid duplicating policies.
 */
const faqs = [
  {
    q: "How long are sessions?",
    a: "All standard sessions are 60 minutes.",
  },
  {
    q: "Do you support anxious and neurodivergent learners?",
    a: "Yes. Many Studyroom students are anxious, autistic, ADHD or benefit from predictable routines and clear teaching.",
  },
  {
    q: "What does a package include?",
    a: "A structured block of sessions with a clear weekly focus, session notes and practical next steps tailored to your child’s goals and year level.",
  },
  {
    q: "What subjects do you tutor?",
    a: "We support literacy, numeracy and study skills across Prep to Year 12. Coverage depends on tutor availability and the student’s year level.",
  },
  {
    q: "Can you help with senior assessment and exams?",
    a: "Yes. We support planning, scaffolding, drafting and exam preparation, especially in Years 11–12.",
  },
];

export default function TutoringPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-10 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Prep to Year 12 · Logan and Brisbane Southside · In-home and online
          </p>

          <div className="inline-flex items-center rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
            Personalised 1:1 tutoring
          </div>

          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-4xl">
            One-on-one tutoring that brings structure and confidence back into
            school.
          </h1>

          <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
            Studyroom provides personalised 1:1 tutoring for Prep to Year 12
            students across Logan and Brisbane Southside. We support anxious and
            neurodivergent learners, as well as high-achieving students ready to
            extend.
          </p>

          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            We focus on understanding — not memorising — using clear steps and
            predictable routines so students know what to do next.
          </p>

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

      {/* PACKAGES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Packages
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Structured learning packages
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:max-w-3xl md:text-base">
              Studyroom operates primarily on prepaid packages to secure weekly
              time slots and support consistent progress. All sessions are 60
              minutes.
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

                  <div className="shrink-0 space-y-2 text-right">
                    <div className="rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
                      In-home {pkg.priceInHome}
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[color:var(--brand)] ring-1 ring-[color:var(--ring)]">
                      Online {pkg.priceOnline}
                    </div>
                  </div>
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
              View pricing & policies →
            </Link>
          </div>
        </div>
      </section>

      {/* DELIVERY MODES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            How sessions can run
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Most families begin with weekly 1:1 sessions either in-home or
            online, depending on what’s easiest for the student and the family.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
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

      {/* SUBJECTS AND FOCUS AREAS (combined) */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Subjects and focus areas
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            We support literacy, numeracy, executive function and study skills
            aligned with the Australian Curriculum and your child’s current
            school units.
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
                Studyroom supports students who benefit from clear explanations,
                predictable structure and steady guidance — whether they are
                catching up, keeping up or extending.
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

      {/* HOW IT WORKS */}
      <section className="px-4 md:px-6" id="how-it-works">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            How Studyroom works
          </h2>
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

      {/* SESSION FLOW (shortened) */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What a typical session looks like
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Sessions follow a predictable rhythm so students can focus on the
            work, not guess what’s coming next.
          </p>
          <div className="grid gap-4 md:grid-cols-4">
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

      {/* PRICING & POLICIES + LOCATIONS */}
      <section className="px-4 md:px-6" id="pricing">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          {/* PRICING & POLICIES (single source of truth) */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Pricing and policies
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Clear pricing and expectations in one place.
            </p>

            <div className="mt-4 space-y-3">
              {pricingAndPolicies.map((item) => (
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
          </div>

          {/* LOCATIONS */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Locations
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              In-home coverage is kept reasonable for families and tutors, with
              online tutoring available for everyone else.
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
            Common questions
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-sm font-semibold text-[color:var(--ink)]">
                  {item.q}
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {item.a}
                </p>
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
                A small, vetted team — you always know who is working with your
                child.
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
                      Tutor
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
                Next step
              </p>
              <h2 className="text-3xl font-semibold leading-tight">
                Ready to start a weekly learning plan?
              </h2>
              <p className="text-sm text-white/85 md:max-w-2xl">
                Tell us what your child needs right now. We’ll recommend the
                best package and match them with a tutor who fits their goals and
                pace.
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