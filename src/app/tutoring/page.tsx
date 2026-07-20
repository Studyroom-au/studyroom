import Link from "next/link";

/**
 * TERM 2 PACKAGE SALE
 * Toggle on/off when needed.
 */
const TERM2_SALE_ACTIVE = false;
const TERM2_SALE_ENDS = "31 March";
const TERM2_SALE_LABEL = `Term 2 Early Enrolment Offer ends ${TERM2_SALE_ENDS}`;

const offers = [
  {
    title: "In-home tutoring",
    desc: "1:1 support delivered in-home across Logan, Beenleigh and Brisbane Southside when a suitable local tutor match is available.",
  },
  {
    title: "Online tutoring",
    desc: "Live 1:1 sessions delivered online via the Studyroom WebApp or Microsoft Teams, matched to subject, year level and tutor availability.",
  },
];

const whoFor = [
  "Prep to Year 12 students who benefit from clear explanations and predictable learning routines",
  "Anxious and neurodivergent learners, including autistic and ADHD students",
  "Students catching up after time away from school, setbacks or a run of low marks",
  "High achievers aiming for extension, scholarships or top results",
  "Families who value clear communication, steady progress and careful tutor matching",
];

const howItWorks = [
  {
    title: "Enquire",
    desc: "Share your child’s year level, goals, learning needs, location and what support would help most right now.",
  },
  {
    title: "Review availability",
    desc: "We review your enquiry personally and check current tutor availability so we can find the right fit for your child.",
  },
  {
    title: "Tutor match",
    desc: "We match based on subject, year level, learning style, availability, location and preferred mode.",
  },
  {
    title: "Start weekly sessions",
    desc: "Once a suitable match and time slot are confirmed, sessions begin with a clear plan for progress.",
  },
];

/**
 * Packages are the PRIMARY model.
 * Prices shown for in-home and online.
 * Term package = 10 weekly term sessions + 2 bonus sessions (same term only).
 */
const packages = [
  {
    title: "5-Session Package",
    priceInHome: "$400",
    priceOnline: "$350",
    desc: "A structured block of tutoring designed to strengthen core skills, build confidence and establish positive study habits.",
    points: [
      "5 x 60-minute sessions",
      "Clear weekly focus",
      "Session notes + next steps",
      "Resources where appropriate",
    ],
    tag: TERM2_SALE_ACTIVE
      ? TERM2_SALE_LABEL
      : "Best for students needing extra support before assessment or wanting a focused academic reset.",
  },
  {
    title: "10-Session Package",
    priceInHome: "$750",
    priceOnline: "$650",
    desc: "Designed for families wanting consistent progress across the school term.",
    points: [
      "10 x 60-minute sessions",
      "Reserved weekly tutoring time",
      "Parent progress updates",
      "Clear planning across the term",
      "Resources where appropriate",
    ],
    tag: TERM2_SALE_ACTIVE
      ? TERM2_SALE_LABEL
      : "Best for students wanting consistent improvement across the term.",
  },
  {
    title: "Casual sessions (limited)",
    priceInHome: "$90",
    priceOnline: "$75",
    desc: "Flexible one-off sessions designed for immediate academic support.",
    points: [
      "60-minute session",
      "Assessment preparation",
      "One-off academic support",
      "Session notes",
    ],
    tag: "Casual sessions are subject to tutor availability and do not reserve an ongoing weekly time.",
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
    group: "Pricing and payment",
    items: [
      {
        label: "Session length",
        detail: "All standard sessions are 60 minutes.",
      },
      {
        label: "Package pricing",
        detail:
          "5 sessions: $400 in-home or $350 online. 10 sessions: $750 in-home or $650 online.",
      },
      {
        label: "Package payment",
        detail:
          "Packages are prepaid and secure your weekly time slot once a tutor match and schedule have been confirmed. Payment is required upfront to confirm enrolment.",
      },
      {
        label: "Casual pricing and payment",
        detail:
          "Casual sessions are $90 in-home or $75 online. They are invoiced after the completed session is logged and payment is due under the invoice terms.",
      },
      {
        label: "Late payment",
        detail:
          "If an invoice is 7 days overdue, a $5 late fee may apply. Services may be paused for unpaid invoices until the account is brought up to date.",
      },
    ],
  },
  {
    group: "Booking and matching",
    items: [
      {
        label: "Waitlist and matching",
        detail:
          "New enquiries are reviewed first and may be added to our matching waitlist while we find a suitable tutor. We match carefully rather than assigning whoever is free.",
      },
      {
        label: "Cancellations and rescheduling",
        detail:
          "We require at least 24 hours notice to reschedule. Sessions cancelled with less than 24 hours notice are forfeited because the tutor's time has been reserved.",
      },
      {
        label: "School holidays",
        detail:
          "Weekly sessions continue year-round by default. Families may pause during school holidays by giving notice in advance.",
      },
      {
        label: "Tutor cancellations",
        detail:
          "If a tutor cancels, we will offer a reschedule. If a suitable replacement time cannot be arranged, the session remains available as package credit or is not charged for casual bookings.",
      },
    ],
  },
  {
    group: "Packages and changes",
    items: [
      {
        label: "Pausing a package",
        detail:
          "School holidays and reasonable unforeseen circumstances can be accommodated with notice. Any pause is arranged with Studyroom so the tutor and weekly time can be managed fairly.",
      },
      {
        label: "Withdrawals and refunds",
        detail:
          "Package purchases reserve tutor time and are generally non-refundable once sessions have begun. Any exceptional circumstances will be reviewed individually in line with Australian Consumer Law.",
      },
      {
        label: "Siblings and group sessions",
        detail:
          "Sibling sessions are priced individually unless students are taught together at the same time. Group-session pricing is confirmed before enrolment based on the number of students and session format.",
      },
    ],
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
    q: "We've tried tutoring before and it didn't work. Why would this be different?",
    a: "Tutoring often does not work for anxious or neurodivergent students when it moves too quickly, feels too pressured, or skips over the gaps underneath. We focus on helping students feel safe enough to try, then build the skills and confidence from there.",
  },
  {
    q: "Do new students start straight away?",
    a: "Not always. New enquiries are reviewed first and may be added to our matching waitlist while we find the right tutor fit. We consider your child’s needs, subject, year level, location, preferred mode and tutor availability.",
  },
  {
    q: "What happens in the first session?",
    a: "The first session is used to build rapport, understand your child’s current strengths and gaps, and set a clear direction for future sessions. The tutor may also review current schoolwork or an upcoming assessment.",
  },
  {
    q: "Will my child have the same tutor each week?",
    a: "Yes, wherever possible. Consistency helps students build trust and gives the tutor time to understand how your child learns. If a different tutor would be a better fit, we will discuss the change with you.",
  },
  {
    q: "Do you support anxious and neurodivergent learners?",
    a: "Yes. Many Studyroom students are anxious, autistic, have ADHD or simply benefit from predictable routines, clear teaching and a calm pace.",
  },
  {
    q: "How will I know what was completed?",
    a: "Tutors record session notes outlining what was covered, how the student responded and the recommended next steps. These records also help Studyroom monitor consistency and progress over time.",
  },
  {
    q: "Are sessions online or in-home?",
    a: "Both options are available depending on your location, learning needs and tutor availability.",
  },
  {
    q: "What does a package include?",
    a: "A package includes a structured block of 60-minute sessions, a reserved weekly time where available, session notes, practical next steps and resources where appropriate.",
  },
  {
    q: "What subjects do you tutor?",
    a: "We support literacy, numeracy, study skills and selected secondary subjects across Prep to Year 12. Exact coverage depends on tutor expertise and availability.",
  },
  {
    q: "Can you help with senior assessment and exams?",
    a: "Yes. We support planning, scaffolding, drafting, revision and exam preparation, particularly in Years 11 and 12, subject to tutor expertise.",
  },
  {
    q: "Can I switch tutors?",
    a: "Yes. If another tutor would better suit your child’s learning style, subject needs or availability, we will organise the transition with you.",
  },
  {
    q: "Can I pause a package?",
    a: "School holidays and reasonable unforeseen circumstances can be accommodated with notice. Please contact Studyroom so the pause can be recorded and the tutor’s schedule managed.",
  },
  {
    q: "What if I don't know which package I need?",
    a: "Every family begins with a free consultation. We will recommend the most suitable option based on your child’s goals, expected frequency and current tutor availability.",
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
            Personalised 1:1 tutoring with careful tutor matching
          </div>

          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-4xl">
            Tutoring for capable students who need confidence, structure and
            clear direction.
          </h1>

          <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
            Studyroom supports Prep to Year 12 students with personalised 1:1
            tutoring across Logan and Brisbane Southside. We help students build
            clear skills, consistent routines and steady progress at school.
          </p>

          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            We meet students where they are, help fill the gaps that are holding
            them back, and give them clear steps forward. New enquiries are
            reviewed personally as part of our matching process so we can find
            the right tutor fit for your child’s needs, subject, location and
            availability.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
            >
              Book a Free Consultation
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
            >
              How matching works
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
              time slots and support consistent progress. Packages are confirmed
              after your enquiry has been reviewed and a suitable tutor match
              and time slot are available. All sessions are 60 minutes.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {packages.map((pkg) => {
              const isRecommended = pkg.title === "10-Session Package";

              return (
                <div
                  key={pkg.title}
                  className={`relative rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ${
                    isRecommended
                      ? "ring-2 ring-[color:var(--brand)] md:-translate-y-2"
                      : "ring-1 ring-[color:var(--ring)]"
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[color:var(--brand)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                      Most popular
                    </div>
                  )}
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
              );
            })}
          </div>

          <div className="rounded-2xl bg-[#f3f7f6] p-5 ring-1 ring-[color:var(--ring)]">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Need help choosing?
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Most families choose the 10-session package for consistent weekly
              progress. The 5-session package is a good starting point for a
              focused block of support, while casual sessions are designed for
              one-off assessment or exam preparation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              Get in touch
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
            online, depending on what is easiest for the student and what tutor
            match is available.
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
            school units. Exact subject coverage depends on the tutor match.
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
                predictable structure and steady guidance, whether they are
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
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              How Studyroom works
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
              Tutor fit matters, so we review each enquiry before recommending a
              match. Your child is not simply assigned to whoever is free.
            </p>
          </div>

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
              Clear pricing, matching expectations and session policies in one
              place.
            </p>

            <div className="mt-6 space-y-6">
              {pricingAndPolicies.map((section) => (
                <div key={section.group}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                    {section.group}
                  </h4>
                  <div className="mt-3 space-y-3">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
                      >
                        <div className="text-sm font-semibold text-[color:var(--ink)]">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--muted)]">
                          {item.detail}
                        </div>
                      </div>
                    ))}
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
              online tutoring available for everyone else. Location is one of
              the factors considered during tutor matching.
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
                A small, vetted team. Tutor matches depend on subject, year
                level, learning needs, location and current availability.
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
                Ready to enquire about weekly tutoring?
              </h2>
              <p className="text-sm text-white/85 md:max-w-2xl">
                Tell us what your child needs right now. We’ll review your
                enquiry, recommend the best next step and let you know the
                current tutor matching options.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Get in touch
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