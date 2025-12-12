import Link from "next/link";
import Image from "next/image";

const services = [
  {
    title: "In-home tutoring",
    desc: "Calm, structured lessons at your kitchen table that build confidence, clarity and routine.",
    tag: "In person 1:1 support",
  },
  {
    title: "Online tutoring",
    desc: "Live 1:1 support through the Studyroom WebApp with shared notes, worksheets and progress tracking.",
    tag: "Online 1:1 support",
  },
  {
    title: "HeadStart workshops",
    desc: "Holiday workshops that rebuild confidence, organisation and study habits before term begins.",
    tag: "Holiday workshops",
  },
  {
    title: "Custom worksheets",
    desc: "Personalised printable resources that match your child’s level, school topics and goals.",
    tag: "Printable resources",
  },
];

const philosophyPoints = [
  "Learning plans shaped around the student, not a generic program.",
  "Clear structure so school feels more manageable and less stressful.",
  "Real confidence-building with small wins that students can feel.",
  "Calm, encouraging sessions that avoid pressure and overwhelm.",
  "Healthy challenge that stretches students without panic.",
];

const helpPoints = [
  "Anxious learners who feel stressed, worried about grades or nervous about school.",
  "Autistic and ADHD students, and other neurodivergent learners who benefit from structure and clear expectations.",
  "Students rebuilding confidence after low marks, school avoidance or tricky school years.",
  "Motivated students aiming for strong grades, extension work or scholarships.",
  "Students who need support with organisation, routines and study skills.",
];

const whyReasons = [
  {
    title: "Confidence, clarity and progress",
    desc: "We focus on understanding, not memorising, so students feel capable and know what to do next.",
  },
  {
    title: "Personalised learning plans",
    desc: "Every plan is shaped around your child’s goals, year level and current school topics.",
  },
  {
    title: "Organisation and study skills",
    desc: "We help students plan, prioritise and revise so they are not scrambling before tests and assignments.",
  },
  {
    title: "Curriculum aligned support",
    desc: "Lessons follow the Australian Curriculum and QCE so tutoring links directly to what they see in class.",
  },
  {
    title: "Consistent communication",
    desc: "Parents get honest updates, clear next steps and support when things feel stressful.",
  },
];

const tutors = [
  {
    name: "Lily",
    role: "Founder & Tutor",
    blurb:
      "Education student specialising in Maths and personalised learning. Focused on confidence, routines and helping students feel genuinely proud of their progress.",
  },
  {
    name: "Katarina",
    role: "Tutor",
    blurb:
      "Calm, organised tutor who supports students with clear routines, encouragement and step by step teaching.",
  },
  {
    name: "Scarlett",
    role: "Tutor",
    blurb:
      "Primary school tutor focused on literacy, reading confidence and growth mindset with gentle accountability each session.",
  },
];

const trustPoints = [
  "Local, Blue Card approved tutors",
  "1:1 support in-home or online",
  "Aligned with Australian Curriculum and QCE",
  "Neurodiversity aware, anxiety-aware approach",
];

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
      "Before tutoring with lily, I was struggling immensely with mathematics, to a point where i would simply give up on trying. Lily helped explain problems with much more clarity than the questions in my textbook, and after 1 term of tutoring, I went from a D to a B- on my exam. I can now confidently try my best at maths, and not be intimidated by attempting difficult and confusing questions. If you are having trouble with anything, I can't recommend Lily enough! She's kind, patient and 100% perfect for helping people like you and me! Thank you Lily!!",
    name: "Grade 8 student",
  },
  {
    quote:
      " You've helped my daughter come so far! From failing maths to receiving a maths awards (and enjoying maths now, with confidence) Thank you Lily!",
    name: "Parent of Year 11 student",
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
            {/* Location Line */}
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Logan and Brisbane Southside · Prep to Year 12
            </p>

            {/* Brand Tone Bubble */}
            <p className="inline-flex items-center rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
              Calm · Personalised · Growth focused
            </p>

            {/* Heading */}
            <h1 className="text-3xl font-semibold leading-snug text-[color:var(--ink)] md:text-4xl">
              Calm tutoring that helps students feel capable, organised and proud of their progress.
            </h1>

            {/* Hero Paragraphs */}
            <p className="text-base text-[color:var(--muted)] md:text-lg">
              Studyroom gives students the structure, clarity and confidence they need to move forward at school.
              We support anxious and neurodivergent learners through calm, personalised teaching that helps them understand their work, stay organised and feel confident in their learning, without pressure.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              Some students come to us to catch up and feel proud again. Others want to stay on top or push for top marks.
              We build a plan that fits where they are now and where they want to go next.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
              >
                Enquire now
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
              >
                Student login
              </Link>
            </div>

            {/* Clean chips */}
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {[
                "Logan based tutors",
                "Prep to Year 12",
                "In-home and online",
                "Support for anxious and neurodivergent learners",
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
              <div className="h-64 w-full overflow-hidden rounded-xl" suppressHydrationWarning>
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

      {/* TRUST / SAFETY STRIP */}
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
              We believe every student, including anxious and neurodivergent learners, can make strong progress
              when the environment is calm, the plan is clear and the teaching fits how they learn.
            </p>
            <p className="text-sm text-white/85">
              We do not rush. We remove the panic. We focus on small, steady wins that add up to real confidence.
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
              Studyroom is where families turn when school starts to feel stressful, confusing or stuck.
              We support anxious learners, autistic and ADHD students and other neurodivergent young people,
              as well as students who are simply ready to grow.
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
                  step: "1. Quick enquiry",
                  desc: "Share your child’s goals, challenges and what school currently feels like.",
                },
                {
                  step: "2. Tutor match",
                  desc: "We pair your child with a tutor who fits their personality, level and preferred mode.",
                },
                {
                  step: "3. Weekly 1:1 sessions",
                  desc: "Calm, structured lessons plus guidance for families so everyone knows the next step.",
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
          </div>
        </div>
      </section>

      {/* RESULTS & STORIES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Results and stories
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Some students just want to pass and feel proud again. Others are aiming for top marks.
            We focus on confidence, clarity and steady progress for both.
          </p>
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

      {/* WHY FAMILIES CHOOSE STUDYROOM + WORKSHOP IMAGE */}
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
          <div className="overflow-hidden rounded-xl border border-[color:var(--ring)] bg-[#f8f8ff] shadow-sm">
            <div className="h-64 w-full overflow-hidden rounded-xl" suppressHydrationWarning>
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
                We are a small, vetted team, not a big marketplace.
                You will always know exactly who is working with your child.
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

      {/* FINAL CTA */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-xl bg-[color:var(--brand)] px-6 py-8 text-white shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Next step
              </p>
              <h2 className="text-2xl font-semibold">
                Tell us about your child and we will reply within 1-3 business days.
              </h2>
              <p className="text-sm text-white/85">
                Whether they want to pass and feel proud or are aiming for an A plus,
                we will help map out a clear, calm plan for moving forward.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Enquire now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
