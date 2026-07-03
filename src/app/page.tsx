import Link from "next/link";
import Image from "next/image";

/**
 * TERM 2 PACKAGE SALE
 * Toggle on/off when needed.
 */
const TERM2_SALE_ACTIVE = false;
const TERM2_SALE_ENDS = "31 March";
const TERM2_SALE_LABEL = `Term 2 Early Enrolment Offer ends ${TERM2_SALE_ENDS}`;

const services = [
  {
    title: "In-home tutoring",
    desc: "1:1 tutoring delivered in-home across Logan and Brisbane Southside when a suitable local tutor match is available.",
    tag: "In person support",
  },
  {
    title: "Online tutoring",
    desc: "Live 1:1 sessions delivered online via the Studyroom WebApp, matched to subject, year level and tutor availability.",
    tag: "Online support",
  },
  {
    title: "HeadStart workshops",
    desc: "Holiday workshops that rebuild organisation and study habits before term begins.",
    tag: "Holiday workshops",
  },
  {
    title: "Custom worksheets",
    desc: "Printable resources matched to year level, topics and skill gaps.",
    tag: "Printable resources",
  },
];

const philosophyPoints = [
  "Plans shaped around the student, not a generic program.",
  "Clear routines so school feels more manageable.",
  "Small wins that build real confidence and effort.",
  "Steady challenge without overwhelm.",
  "Skills that transfer back into the classroom.",
];

const helpPoints = [
  "Anxious learners who feel stressed, stuck or behind at school.",
  "Autistic and ADHD students and other neurodivergent learners.",
  "Students rebuilding after low marks or tricky school years.",
  "Motivated students aiming for strong grades, extension or scholarships.",
  "Students needing support with organisation and study skills.",
];

const thisIsForYou = [
  "Your child shuts down the moment schoolwork gets hard",
  "You've tried tutors before and nothing clicked",
  "Homework time ends in tears most nights",
  "Your child says they're stupid and believes it",
  "They have ADHD, ASD, or just learn differently",
  "You're exhausted from trying to help and not knowing how",
];

/**
 * WHAT MAKES US DIFFERENT — contrasts with what parents have already tried.
 */
const differentiators = [
  {
    others: "Most tutoring rushes through content.",
    us: "We slow down until it makes sense. No moving on until your child is genuinely with us.",
  },
  {
    others: "Most tutors see your child for an hour and disappear.",
    us: "Our tutors leave session notes. Lily stays involved. You always know how your child is tracking.",
  },
  {
    others: "Most agencies assign whoever's free.",
    us: "We review each enquiry and match carefully based on your child's needs, year level, learning style, location and tutor availability.",
  },
];

const whyReasons = [
  {
    title: "Progress that is measurable",
    desc: "Clear weekly focus so students build skills that show up in class and assessment.",
  },
  {
    title: "Personalised learning plans",
    desc: "Tutoring shaped around year level, current units and what the student needs next.",
  },
  {
    title: "Organisation and study skills",
    desc: "Planning, prioritising and revision routines so students aren’t scrambling before tests.",
  },
  {
    title: "Curriculum aligned support",
    desc: "Aligned with Australian Curriculum and QCE so tutoring connects directly to school.",
  },
  {
    title: "Clear communication",
    desc: "Parents receive straightforward updates and next steps across the learning plan.",
  },
];

const tutors = [
  {
    name: "Lily",
    role: "Founder & Tutor",
    blurb:
      "Education student specialising in Maths and personalised learning across Prep to Year 12. Lily supports students who feel anxious, behind or overwhelmed using explicit teaching, clear routines and structured scaffolds to build real understanding and confidence over time.",
  },
  {
    name: "Katarina",
    role: "Tutor",
    blurb:
      "Maths and executive function tutor supporting primary and junior secondary students. Katarina helps students break work into manageable steps, develop organisation skills and reduce stress with steady pacing and clear expectations.",
  },
  {
    name: "Scarlett",
    role: "Tutor",
    blurb:
      "Primary specialist focused on literacy, reading fluency and foundational skills. Scarlett strengthens decoding, comprehension and written expression through explicit instruction and consistent practice, supporting independence and resilience alongside core skill growth.",
  },
  {
    name: "Casey (He/Him)",
    role: "Tutor",
    blurb:
      "Maths tutor supporting all year levels, with additional expertise in senior assessment and assignment support across subjects. Casey uses clear explanations, structured strategies and a calm approach to make complex tasks feel manageable so students feel prepared, capable and confident.",
  },
];

const trustPoints = [
  "Local, Blue Card approved tutors",
  "1:1 support in-home or online",
  "Careful tutor matching process",
  "Neurodiversity aware approach",
];

// Featured testimonial pulled to the top
const featuredTestimonial = {
  quote:
    "Before tutoring I would simply give up on trying at maths. After one term I went from a D to a B on my exam. I can now confidently try my best and not be intimidated by hard questions.",
  name: "Year 8 student",
};

const testimonials = [
  {
    quote:
      "Maths has become his best subject and his confidence level is so much higher.",
    name: "Parent of Year 7 student",
  },
  {
    quote:
      "She actually looks forward to tutoring each week and feels more organised for school.",
    name: "Parent of Year 5 student",
  },
  {
    quote:
      "Lily is the best tutor I have ever had! She puts in the effort to help tutor me online while im overseas, and is dedicated to helping me with my education! She’s helped me so much with math! I went from failing my assignments and exams to passing all of them from Lily’s help. If you are in need of a tutor, I 100% recommend Lily, she is dedicated, friendly and puts in the effort to ensure you get the goals you would like for your schooling! She has helped me so much throughout this year and I wouldnt of been able to get through it without her! Thankyou Lily 🤗🤍",
    name: "Year 11 student",
  },
  {
    quote:
      "Within a term she moved from a C to an A in Science and finally feels proud of her hard work.",
    name: "Parent of Year 9 student",
  },
  {
    quote:
      "You've helped my daughter come so far! From failing maths to receiving a maths award and enjoying maths now, with confidence. Thank you Lily!",
    name: "Parent of Year 11 student",
  },
];

/**
 * HOMEPAGE FAQ — short answers to the questions parents ask silently.
 */
const homeFaqs = [
  {
    q: "We've tried tutoring before and it didn't work. Why would this be different?",
    a: "Tutoring often does not work for anxious or neurodivergent students when it moves too quickly, feels too pressured, or skips over the gaps underneath. We focus on helping students feel safe enough to try, then build the skills and confidence from there.",
  },
  {
    q: "Will Lily be my child's tutor?",
    a: "Depending on availability, sessions may be delivered by one of our Studyroom tutors. Tutors are personally reviewed by Lily, and Lily stays involved in the overall support and direction of your child’s learning where needed.",
  },
  {
    q: "Do new students start straight away?",
    a: "Not always. New enquiries are reviewed first and placed on our matching waitlist while we look for the right tutor fit. We consider your child’s needs, subject, year level, location, preferred mode and tutor availability.",
  },
  {
    q: "My child has ADHD or ASD — do you understand what that means for learning?",
    a: "Yes. This is a core part of our work. Our approach is built around predictable routines, clear teaching, and a calm environment that reduces anxiety rather than adds to it.",
  },
  {
    q: "What if it's not a good fit?",
    a: "We'd rather help you find the right support than force something that isn't working. If a tutor match isn't right, we review the match. If we're not the right service for your child, we'll tell you that honestly.",
  },
];

/**
 * WHAT HAPPENS AFTER YOU ENQUIRE — reassurance at point of conversion.
 */
const afterEnquiry = [
  {
    step: "1",
    title: "We reply personally",
    desc: "Within 1–3 business days. A real response from Lily — not an automated reply.",
  },
  {
    step: "2",
    title: "A no-pressure chat",
    desc: "We talk about your child, what they need, and what's worked or hasn't in the past.",
  },
  {
    step: "3",
    title: "A clear plan forward",
    desc: "If we’re a fit, we recommend the best next step and begin looking for the right tutor match based on your child’s needs, location, availability and learning style.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-12 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-center lg:gap-14">
          {/* TEXT SIDE */}
          <div className="flex-1 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Logan and Brisbane Southside · Prep to Year 12
            </p>

            <p className="inline-flex items-center rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
              Personalised 1:1 tutoring
            </p>

            <h1 className="text-3xl font-semibold leading-snug text-[color:var(--ink)] md:text-4xl">
              Tutoring for capable students who have lost confidence.
            </h1>

            <p className="text-base text-[color:var(--muted)] md:text-lg">
              At Studyroom, we provide 1 on 1 tutoring across Logan and Brisbane Southside that helps students feel capable, organised, and proud of their progress.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              We meet students where they are, help fill the gaps that are holding them back, and give them clear direction so school feels more manageable. New enquiries are reviewed personally and added to our matching waitlist while we find the right tutor fit for your child’s needs, subject, location and availability.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
              >
                Get in touch
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {[
                "Logan based tutors",
                "Prep to Year 12",
                "In-home and online",
                "Careful tutor matching",
              ].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-white px-3 py-1 ring-1 ring-[color:var(--ring)] text-[color:var(--brand)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* IMAGE SIDE */}
          <div className="flex-1">
            <div className="overflow-hidden rounded-xl border border-[color:var(--ring)] bg-[#fdfdff] shadow-sm">
              <div
                className="h-64 w-full overflow-hidden rounded-xl"
                suppressHydrationWarning
              >
                <Image
                  src="/long-lily-teaching.png"
                  alt="Lily teaching a small group in a calm classroom setting"
                  width={1200}
                  height={800}
                  className="h-full w-full object-cover"
                  style={{ color: "transparent" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EMOTIONAL OUTCOME LINE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-lg font-medium italic leading-relaxed text-[color:var(--ink)] md:text-xl">
            When learning has felt hard for long enough, confidence is usually the first thing to go. We help students rebuild the skills, structure and belief they need to try again.
          </p>
        </div>
      </section>

      {/* THIS IS FOR YOU */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--brand)] px-6 py-12 text-white md:px-10">
          <div className="grid gap-8 md:grid-cols-2 md:items-start">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                For the parent who's tried everything
              </p>
              <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
               Your child isn't the problem. They may just need support that meets them where they are.
              </h2>
              <p className="text-sm text-white/85 md:text-base">
                Most tutoring is built around content. Ours is built around your child.
              </p>
            </div>
            <div className="space-y-3">
              {thisIsForYou.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/20"
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--accent-soft)]" />
                  <p className="text-sm font-medium text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT MAKES US DIFFERENT */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              What's different about us
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Not just another tutoring service.
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:max-w-3xl md:text-base">
              If you've tried tutoring before, here's exactly where we do things differently.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {differentiators.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <p className="text-sm font-medium text-[color:var(--muted)]">
                  {item.others}
                </p>
                <div className="my-4 h-px bg-[color:var(--ring)]" />
                <p className="text-sm font-semibold leading-relaxed text-[color:var(--ink)]">
                  {item.us}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES TEASER */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Packages
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Structured learning packages
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:text-base">
              Studyroom primarily runs on prepaid packages to secure weekly time
              slots and support consistent progress. Packages are confirmed once
              we have reviewed your enquiry and found a suitable tutor match.
              All sessions are 60 minutes.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    5-Week Package
                  </p>
                  <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                    A focused block to strengthen core skills and build momentum
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
                  From $300
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold text-[color:var(--muted)]">
                {TERM2_SALE_ACTIVE ? TERM2_SALE_LABEL : "Prepaid package"}
              </p>

              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                {[
                  "5 x 60-minute sessions",
                  "Clear weekly focus",
                  "Session notes + next steps",
                  "Light home practice where helpful",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-5 w-5 rounded-full bg-[color:var(--brand-soft)] text-center text-xs leading-5 text-[color:var(--brand)]">
                      ✓
                    </span>
                    <p className="text-sm text-[color:var(--ink)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Term Package (10 + 2 bonus)
                  </p>
                  <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                    Term structure with two extra sessions for assessment support
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
                  From $720
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold text-[color:var(--muted)]">
                {TERM2_SALE_ACTIVE ? TERM2_SALE_LABEL : "Prepaid package"}
              </p>

              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                {[
                  "10 weekly term sessions",
                  "+ 2 bonus sessions (same term)",
                  "Supports steady skill growth",
                  "Useful for exam and IA periods",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-5 w-5 rounded-full bg-[color:var(--brand-soft)] text-center text-xs leading-5 text-[color:var(--brand)]">
                      ✓
                    </span>
                    <p className="text-sm text-[color:var(--ink)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[color:var(--ink)]">
                    Casual sessions (limited)
                  </p>
                  <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                    One-off sessions when availability allows
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[color:var(--brand)] ring-1 ring-[color:var(--ring)]">
                  From $60
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                {[
                  "60-minute session",
                  "Best for short-term support",
                  "Limited weekly availability",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-5 w-5 rounded-full bg-[color:var(--brand-soft)] text-center text-xs leading-5 text-[color:var(--brand)]">
                      ✓
                    </span>
                    <p className="text-sm text-[color:var(--ink)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              Get in touch
            </Link>
            <Link
              href="/tutoring"
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
            >
              View tutoring options →
            </Link>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="bg-[#f3f7f6] border-y border-[color:var(--ring)] px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-3">
          {trustPoints.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-medium ring-1 ring-[color:var(--ring)] text-[color:var(--muted)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* WHAT WE OFFER */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              What we offer
            </h2>
            <Link
              href="/tutoring"
              className="text-sm font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
            >
              Learn more about tutoring →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div
                key={service.title}
                className="flex flex-col gap-3 rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="h-8 w-8 rounded-full bg-[#b8cad6]/40 text-center text-sm font-semibold leading-8 text-[color:var(--brand)]">
                  ★
                </div>
                <div className="text-base font-semibold text-[color:var(--ink)]">
                  {service.title}
                </div>
                <p className="text-sm text-[color:var(--muted)]">
                  {service.desc}
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
                  {service.tag}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEARNING PHILOSOPHY */}
      <section className="bg-[color:var(--brand)] px-4 py-10 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-white">
              Learning is personal, and we treat it that way.
            </h2>
            <p className="text-sm text-white/85">
              We focus on clear teaching and consistent routines that transfer
              back into the classroom.
            </p>
          </div>
          <div className="space-y-3">
            {philosophyPoints.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/20"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--accent-soft)]" />
                <p className="text-sm font-medium text-white">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO WE HELP + HOW IT WORKS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-start">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Who we help
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Families come to Studyroom when school feels stressful, confusing
              or stuck and they want a clear plan forward.
            </p>
            <div className="space-y-3">
              {helpPoints.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl bg-[color:var(--card)] p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <span className="mt-1 h-5 w-5 rounded-full bg-[color:var(--brand-soft)] text-center text-xs leading-5 text-[color:var(--brand)]">
                    ✓
                  </span>
                  <p className="text-sm font-medium text-[color:var(--ink)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              What working with Studyroom looks like
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  step: "1. Enquiry",
                  desc: "Share year level, goals and what support would help most.",
                },
                {
                  step: "2. Review and match",
                  desc: "We review needs, availability and tutor fit before confirming next steps.",
                },
                {
                  step: "3. Weekly sessions",
                  desc: "Once a suitable match is confirmed, sessions begin with a clear plan.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl bg-[color:var(--card)] p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <p className="text-xs font-semibold uppercase text-[color:var(--brand)]">
                    {item.step}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl border border-[color:var(--ring)] bg-[#f8f8ff] shadow-sm">
              <div
                className="h-64 w-full overflow-hidden rounded-xl"
                suppressHydrationWarning
              >
                <Image
                  src="/IMG_2243.jpeg"
                  alt="Studyroom workshop group smiling together"
                  width={1000}
                  height={900}
                  className="h-full w-full object-cover object-top"
                  style={{ color: "transparent" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER STORY WITH PHOTO */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)] md:p-12">
          <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
            {/* PHOTO */}
            <div className="mx-auto md:mx-0">
              <div className="h-40 w-40 overflow-hidden rounded-full ring-4 ring-white shadow-md md:h-48 md:w-48">
                <Image
                  src="/selfphoto.jpeg"
                  alt="Lily, founder of Studyroom Australia"
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* TEXT */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
                The founder
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[color:var(--ink)] md:text-3xl">
                I built Studyroom for us.
              </h2>
              <div className="mt-5 space-y-4 text-base text-[color:var(--muted)]">
                <p>
                  When a student seems “behind,” it is often because they have missed key steps, lost confidence, or learned that it feels safer not to try than to get it wrong. I know this because I lived it. I was the quiet kid who stopped asking for help because I was embarrassed that I didn’t “get it” like everyone else.
                </p>
                <p>
                  At Studyroom, we start by meeting students where they are. We look for the gaps that are making learning feel harder than it needs to, then build the skills, confidence and structure they need to move forward.
                </p>
                <p className="font-semibold text-[color:var(--ink)]">
                 The goal is not just better marks. It is helping students understand the work, rebuild confidence, and feel capable of trying again.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  — Lily, Founder
                </p>
                <Link
                  href="/about"
                  className="text-sm font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
                >
                  Read more →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Results and stories
          </h2>

          {/* Featured testimonial */}
          <div className="rounded-2xl bg-[color:var(--brand)] p-8 text-white md:p-10">
            <p className="text-lg italic leading-relaxed md:text-xl">
              “{featuredTestimonial.quote}”
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-white/70">
              — {featuredTestimonial.name}
            </p>
          </div>

          {/* Remaining testimonials */}
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.quote}
                className="rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <p className="text-sm italic text-[color:var(--ink)]">
                  “{t.quote}”
                </p>
                <p className="mt-3 text-xs font-semibold text-[color:var(--muted)]">
                  {t.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY + IMAGE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Why families choose Studyroom
            </h2>
            <div className="space-y-3">
              {whyReasons.map((reason) => (
                <div
                  key={reason.title}
                  className="rounded-xl bg-[color:var(--card)] p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {reason.title}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {reason.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-[color:var(--ring)] bg-[#f8f8ff] shadow-sm">
              <div
                className="h-64 w-full overflow-hidden rounded-xl"
                suppressHydrationWarning
              >
                <Image
                  src="/workshop-group.jpeg"
                  alt="Studyroom workshop group smiling together"
                  width={1000}
                  height={900}
                  className="h-full w-full object-cover object-top"
                  style={{ color: "transparent" }}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[color:var(--ring)] bg-[#f8f8ff] shadow-sm">
              <div
                className="h-64 w-full overflow-hidden rounded-xl"
                suppressHydrationWarning
              >
                <Image
                  src="/IMG_4458.jpeg"
                  alt="Studyroom workshop group smiling together"
                  width={1000}
                  height={900}
                  className="h-full w-full object-cover object-top"
                  style={{ color: "transparent" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MEET YOUR TUTORS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                Meet your tutors
              </h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Our small team is hand-picked for empathy, reliability and experience with learners who need clear support. Tutor matches depend on availability, location, subject fit and your child’s needs.
              </p>
            </div>
            <Link
              href="/tutoring"
              className="text-sm font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-600)]"
            >
              Full tutor bios →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {tutors.map((tutor) => (
              <div
                key={tutor.name}
                className="rounded-xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand-soft)]/60 text-sm font-semibold text-[color:var(--brand)]">
                    {tutor.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {tutor.name}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {tutor.role}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[color:var(--muted)]">
                  {tutor.blurb}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOMEPAGE FAQ */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              Common questions
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              The questions parents usually ask first.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {homeFaqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {item.q}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT HAPPENS AFTER YOU ENQUIRE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              What happens next
            </p>
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              After you enquire.
            </h2>
            <p className="text-sm text-[color:var(--muted)] md:max-w-2xl">
              No pressure. Just a real conversation about your child and what they need next.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {afterEnquiry.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand)] text-sm font-bold text-white">
                  {item.step}
                </div>
                <p className="mt-4 text-base font-semibold text-[color:var(--ink)]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-xl bg-[color:var(--brand)] px-6 py-10 text-white shadow-md md:px-10 md:py-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Next step
              </p>
              <h2 className="text-2xl font-semibold md:text-3xl">
                You don't have to figure this out alone.
              </h2>
              <p className="text-sm text-white/85 md:max-w-2xl">
                Tell us about your child. We'll reply within 1–3 business days with the clearest next step and current tutor matching options.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}