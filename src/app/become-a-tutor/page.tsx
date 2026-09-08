import type { Metadata } from "next";
import Link from "next/link";
import TutorApplicationForm from "@/components/marketing/TutorApplicationForm";

export const metadata: Metadata = {
  title: "Become a Tutor in Logan & Brisbane Southside",
  description:
    "Studyroom Australia is looking for tutors, especially in-home tutors across Logan and Brisbane Southside, with online tutoring roles also available. Apply to tutor with Studyroom.",
  alternates: { canonical: "/become-a-tutor" },
};

const whatStudyroomHandles = [
  "Finding families and matching them to a suitable tutor",
  "The platform and admin support for family matching, session records and billing",
  "Invoicing and payment collection from families",
  "The Studyroom Hub, so you can share resources with your students between sessions",
];

const tutorsControl = [
  "Your own availability, and whether to accept work that's offered to you",
  "Agreeing and managing session times directly with the students you take on",
  "How you run your own sessions and teaching approach, within the Studyroom service framework",
  "Your own subcontractor business, including your ABN and how you invoice Studyroom",
];

const expectations = [
  {
    title: "Reliability",
    body: "Turning up prepared, on time, and giving reasonable notice if something changes.",
  },
  {
    title: "Communication",
    body: "Keeping Studyroom and families in the loop, especially around scheduling changes or a student who needs extra support.",
  },
  {
    title: "Student support",
    body: "Working independently with a student while staying warm, patient, and encouraging, especially with students who feel behind or anxious about school.",
  },
];

const recruitmentSteps = [
  { title: "Apply", body: "Submit the application below. It takes a few minutes." },
  { title: "Resume", body: "Email your resume so we can see your background. A short cover letter is optional." },
  { title: "Review", body: "We review applications and reach out about next steps if there's a good match." },
  { title: "Onboarding", body: "If it's a fit, we'll walk you through Blue Card, ABN, and platform onboarding." },
];

export default function BecomeATutorPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-10 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Tutor with Studyroom
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-5xl">
            We&apos;re especially looking for in-home tutors across Logan and Brisbane Southside.
          </h1>
          <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
            Studyroom Australia is a growing tutoring service supporting primary and secondary students who
            want to feel more capable, organised, and confident. We&apos;re currently especially looking for
            tutors who can support students in-home across Logan and Brisbane Southside.
          </p>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            We also welcome applications from online tutors where their subjects and availability match
            current student needs.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#apply" className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm">
              Apply to tutor with Studyroom
            </a>
          </div>
        </div>
      </section>

      {/* WHO WE SUPPORT */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Who Studyroom supports</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Studyroom works with primary and secondary students, from Prep through to Year 12, across core
              subjects including Maths, English, and Science, along with broader study skills and
              organisation support. Many of our students feel behind, anxious about school, or just want
              things to feel less overwhelming.{" "}
              <Link href="/about" className="font-semibold text-[color:var(--brand)] hover:underline">
                Read more about Studyroom
              </Link>
              .
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Personalised, confidence-focused tutoring</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Studyroom tutoring is built around the individual student, not a fixed curriculum. Tutors who
              do well with us slow down when it&apos;s needed, explain things more than one way, and focus on
              building a student&apos;s confidence alongside their skills.
            </p>
          </div>
        </div>
      </section>

      {/* HOW WE WORK */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">A flexible subcontract model</h2>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Studyroom tutors work as independent subcontractors, not employees. You operate under your
                own ABN, decide which suitable work to accept within your own availability, and run your own
                teaching approach. Studyroom provides the platform and admin support for family matching,
                session records and billing.
              </p>
            </div>
            <div className="grid gap-3">
              {expectations.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]">
                  <div className="text-sm font-semibold text-[color:var(--ink)]">{item.title}</div>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT STUDYROOM HANDLES VS WHAT TUTORS CONTROL */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">What Studyroom handles</h3>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              {whatStudyroomHandles.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-[color:var(--card)] p-6 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">What you control</h3>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              {tutorsControl.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--brand)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white/60 p-8 ring-1 ring-[color:var(--ring)]">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">What you&apos;ll need</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-[color:var(--ink)]">Blue Card</div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                A current Blue Card (working with children check) is required to tutor with Studyroom. If
                you don&apos;t have one yet, you can still apply and we&apos;ll talk you through it.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-[color:var(--ink)]">ABN</div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Tutors work under their own ABN as subcontractors. If you don&apos;t have one yet, that&apos;s
                fine, we can point you in the right direction.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-[color:var(--ink)]">Car and licence (in-home tutoring)</div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                In-home tutors need a reliable car and a current licence to travel to students across Logan
                and Brisbane Southside.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-[color:var(--ink)]">Online tutoring</div>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                A reliable internet connection and a quiet space to tutor from, where subjects and
                availability match current student needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">How applying works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recruitmentSteps.map((step, i) => (
              <div key={step.title} className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]">
                <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Step {i + 1}</div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{step.title}</div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APPLICATION FORM */}
      <section id="apply" className="px-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Apply to tutor with Studyroom</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Fill in the form below. It takes a few minutes, and we&apos;ll ask for your resume by email as the
            next step.
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-3xl">
          <TutorApplicationForm />
        </div>
      </section>
    </div>
  );
}
