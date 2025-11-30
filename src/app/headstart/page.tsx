import Link from "next/link";

const outcomes = [
  "A personalised weekly Google Calendar study schedule",
  "A simple way to plan homework, assessments, sport and work across the week",
  "A healthy study routine they understand and can follow",
  "An understanding of how to study using active recall and spaced repetition",
  "A small bank of ChatGPT study prompts they can reuse for subjects and revision",
  "More confidence and clarity heading into Term 1",
  "A first week of school action plan and checklist",
];

const whoFor = [
  "High school students in Years 7 to 12",
  "Students who feel disorganised, behind or always catching up",
  "Anxious learners who worry about school, homework or exams",
  "Neurodivergent students, including autistic and ADHD learners, who prefer structure and clear routines",
  "High achievers who want stronger habits and a better study system",
  "Teens who juggle school, work, sport and still want time to relax",
];

const sections = [
  {
    title: "Part 1: Organisation and time management",
    focus: "Weekly planning and simple digital organisation.",
    tools: "Google Calendar and a basic Google Drive folder system.",
    skills: [
      "Setting up a realistic weekly study schedule",
      "Planning time for homework, assessments, sport and work",
      "Using Google Calendar to see the week at a glance",
      "Organising school files with a simple Google Drive system",
    ],
  },
  {
    title: "Part 2: Healthy study habits",
    focus: "Focus, motivation and a more supportive study environment.",
    tools: "Pomodoro timers and simple focus tools.",
    skills: [
      "Using the Pomodoro technique in a way that feels manageable",
      "Managing procrastination without shame or guilt",
      "Basic focus strategies that work at home",
      "Setting up a productive study environment",
      "Planning study and break blocks that do not derail the afternoon",
    ],
  },
  {
    title: "Part 3: How to study properly",
    focus: "Evidence based learning strategies that actually help content stick.",
    tools: "Simple planning sheets, paper or a digital document.",
    skills: [
      "Active recall instead of only rereading notes",
      "Spaced repetition instead of last minute cramming",
      "Turning class notes into practice questions",
      "Creating simple revision routines they can repeat each term",
    ],
  },
  {
    title: "Part 4: ChatGPT for learning",
    focus: "Safe, school friendly AI support for study.",
    tools: "ChatGPT prompt bank for students.",
    skills: [
      "How to ask for clear breakdowns and worked examples",
      "Creating practice questions for different subjects",
      "Turning topics into flashcards and short summaries",
      "Using ChatGPT to support learning without copying answers",
    ],
  },
  {
    title: "Part 5: Personal study plan",
    focus: "Putting it all together for Term 1 and beyond.",
    tools: "Google Calendar, simple checklists and prompt sheets.",
    skills: [
      "Building a realistic weekly study schedule they can follow",
      "Creating a short study habits checklist",
      "Planning a first week of school action list",
      "Saving a personal set of ChatGPT prompts for revision",
    ],
  },
];

const parentBenefits = [
  "Reduces overwhelm before school starts again",
  "Builds routines that last past the holidays",
  "Teaches practical skills that schools often do not have time to cover",
  "Helps anxious learners feel more in control of their week",
  "Gives high achievers a system to stay consistent",
  "Gives families a shared plan for homework and study time",
];

const logistics = [
  {
    label: "Duration",
    value: "Three hour workshop, including a short mid-session break.",
  },
  {
    label: "Price",
    value: "$60 per student.",
  },
  {
    label: "Location",
    value: "Logan area community venue.",
    note: "Final venue and room details are confirmed and emailed to families after booking.",
  },
  {
    label: "When",
    value: "Planned for Saturday 24 January 2026.",
    note: "Final session time is released when bookings open so students attend just before Term 1 starts.",
  },
];

const faqs = [
  {
    q: "Who is the HeadStart workshop for?",
    a: "HeadStart is for high school students in Years 7 to 12. It suits anxious learners, autistic and ADHD students who like structure, as well as students who are already doing well but want stronger habits and systems.",
  },
  {
    q: "Do students need to bring anything?",
    a: "The main thing students need is a laptop and charger. A notebook and pen can help if they like to write things down, but all key resources and templates are provided on the day.",
  },
  {
    q: "Is this suitable for anxious learners?",
    a: "Yes. The workshop is calm, structured and run in small groups. We set clear expectations, move at a steady pace and focus on building confidence rather than putting anyone on the spot.",
  },
  {
    q: "Is this suitable for autistic and ADHD students?",
    a: "Yes. The workshop is designed by a tutor who regularly supports autistic and ADHD learners. We use clear steps, visuals, routines and concrete examples. Students are welcome to use headphones during independent work and take short movement breaks.",
  },
  {
    q: "What if my child does not have their own laptop?",
    a: "A laptop is ideal so they can set up Google Calendar and their own systems. If your child does not have a device, we can adapt activities using shared examples and paper based planning. Please mention this when you enquire so we can plan for them.",
  },
  {
    q: "Is this only for students who are struggling?",
    a: "No. Many high achievers attend to build stronger habits, reduce stress and keep their results steady across the year. The systems we teach support both catch up learners and students aiming for top marks.",
  },
];

// What to bring block
const whatToBring = [
  "Laptop (charged) and charger",
  "School assessment schedule if they have one",
  "Headphones or earphones for quiet focus time (optional)",
  "A water bottle and a small snack for the break (optional)",
];

export default function HeadStartWorkshopPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="bg-[#f8f8ff] px-4 pt-12 pb-10 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Logan and Brisbane Southside · January holidays · Years 7 to 12
          </p>
          <div className="inline-flex items-center rounded-full bg-[#d6e5e3] px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
            HeadStart workshop for high school students
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--ink)] md:text-4xl">
            Give your teenager a clear study plan before Term 1 starts.
          </h1>
          <p className="text-base text-[color:var(--muted)] md:max-w-3xl md:text-lg">
            HeadStart is a three hour holiday workshop that helps high school students get organised,
            build healthy study habits and actually know how to study, not just read and hope. It is
            especially supportive for anxious learners, neurodivergent students and high achievers who
            want a stronger system.
          </p>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            Students leave with a weekly study schedule, a simple term planning system and a bank of
            study prompts they can use with ChatGPT and other tools all year.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact?type=headstart"
              className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
            >
              Secure a spot
            </Link>
            <Link
              href="/contact?type=headstart-info"
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--ring)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/60"
            >
              Request workshop info
            </Link>
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            Places are capped to keep the group calm and focused.
          </p>
        </div>
      </section>

      {/* OUTCOMES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              What students walk away with
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              HeadStart is not just a talk. Students build their own systems during the workshop and
              leave with tools they can open the very next week.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-[color:var(--muted)]">
            {outcomes.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                Is HeadStart right for your child?
              </h2>
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                This workshop is ideal for teens who want school to feel less chaotic and more in
                control. It supports students who feel anxious or behind, and students who are already
                doing well but want clear systems to protect their marks and their mental health.
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
                  <div className="text-sm font-semibold text-[color:var(--ink)]">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHY PARENTS LIKE IT */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Why parents like HeadStart
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              HeadStart gives families something more than motivation. It gives your teenager a
              shared language and a simple plan you can come back to once school goes back.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-[color:var(--muted)]">
            {parentBenefits.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* WORKSHOP PARTS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What we cover in the three hours
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            The workshop is broken into short, practical blocks so students are always doing, not just
            listening. We build systems together on their own device or on paper.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {sections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-[color:var(--ring)]"
              >
                <div className="text-sm font-semibold text-[color:var(--ink)]">
                  {section.title}
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Focus: {section.focus}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Tools: {section.tools}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-[color:var(--muted)]">
                  {section.skills.map((skill) => (
                    <li key={skill} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT TO BRING */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What students need to bring
          </h2>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            We keep it simple so it is easy to get ready. The main thing your teenager needs is their
            laptop so they can set up their own systems for Term 1.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
            {whatToBring.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LOGISTICS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Workshop details
            </h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              A practical, high value holiday workshop for high school students.
            </p>
            <div className="mt-4 space-y-3">
              {logistics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
                >
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {item.label}
                  </div>
                  <div className="text-sm text-[color:var(--muted)]">
                    {item.value}
                  </div>
                  {item.note && (
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              Final confirmation and room details are emailed to families after registration.
            </p>
          </div>

          <div className="rounded-3xl bg-[color:var(--brand)] p-8 text-white shadow-sm">
            <h3 className="text-xl font-semibold">Secure your teenager&apos;s spot</h3>
            <p className="mt-2 text-sm text-white/85">
              HeadStart runs in the January holidays and places are capped so each student can get
              individual support while they build their plan.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-white/85">
              <li>• Three hour small group workshop</li>
              <li>• $60 per student</li>
              <li>• Digital and printable planning resources to keep</li>
              <li>• Guided by a tutor who specialises in anxious and neurodivergent learners</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/contact?type=headstart"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Book now
              </Link>
              <Link
                href="/contact?type=headstart-info"
                className="rounded-xl border border-white/70 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Send an enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Common questions about HeadStart
          </h2>
          <p className="text-sm text-[color:var(--muted)] md:max-w-3xl">
            If you are not sure whether this is the right fit, these answers may help. You can also
            message Lily directly with questions about your child.
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

      {/* FINAL CTA */}
      <section className="px-4 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl bg-[color:var(--brand)] px-8 py-10 text-white shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                HeadStart workshop
              </p>
              <h2 className="text-3xl font-semibold leading-tight">
                Help your teenager start the year organised, not overwhelmed.
              </h2>
              <p className="text-sm text-white/85 md:max-w-2xl">
                Share a few details about your child and your preferred session. We will confirm
                availability, send the workshop information sheet and answer any questions you have
                before you book.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact?type=headstart"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
              >
                Secure a spot
              </Link>
              <Link
                href="/contact?type=headstart-info"
                className="rounded-xl border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Message Lily
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
