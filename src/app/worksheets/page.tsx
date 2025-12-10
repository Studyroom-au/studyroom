import Link from "next/link";
import Image from "next/image";

const whatAre = [
  "Custom worksheets that target the exact gaps your child has in literacy, numeracy or study skills.",
  "Clear, step-by-step scaffolds that mirror classroom language and assessment wording.",
  "Varied question types that rehearse skills without pages of busy work.",
];

const whoHelp = [
  "Students who need extra practice between tutoring sessions.",
  "Anxious, autistic and ADHD learners who benefit from predictable, structured tasks.",
  "Parents who want curriculum-aligned resources they can trust at home.",
  "High achievers who want extension-style questions and exam-style practice.",
];

const pricing = [
  {
    label: "Single pack",
    detail:
      "From $15 for a targeted set of worksheets and answer guides for one focus area.",
  },
  {
    label: "Bundle with tutoring",
    detail:
      "Discounted when paired with weekly sessions so practice and tutoring work together.",
  },
  {
    label: "Term bundle",
    detail:
      "Custom plan for ongoing practice across the term based on school units and goals.",
  },
];

const howToOrder = [
  "Tell us your child’s year level, school topics and current goals.",
  "We design aligned practice with clear steps, examples and answer guides.",
  "Receive PDFs to print or use on a device at home or in tutoring sessions.",
];

const packIncludes = [
  "A short check-in to see what your child can already do independently.",
  "Step-by-step examples that model how to answer the questions.",
  "Targeted practice pages that build in difficulty without feeling overwhelming.",
  "A clear answer guide for parents or tutors.",
  "Simple notes on what to look for and how to support your child while they work.",
];

const examplePacks = [
  "Year 3 reading and comprehension confidence pack.",
  "Year 4 number facts and basic operations fluency pack.",
  "Year 6 fractions, decimals and percentages revision pack.",
  "Year 8 algebra and linear graphs practice pack.",
  "Essay structure and paragraph planning pack for Years 7 to 10.",
];



// 👉 Sample downloadable PDFs (put the files under public/docs/...)
const sampleDocs = [
  {
    label: "Grade 2 maths worksheet (sample PDF)",
    href: "/docs/grade2-maths-worksheet.docx",
  },
  {
    label: "Grade 4 literacy worksheet (sample PDF)",
    href: "/docs/grade4-literacy-worksheet.docx",
  },
  {
    label: "Kangaroo Grade 4 reading & maths activity (sample PDF)",
    href: "/docs/kangaroo-grade4-reading-maths.docx",
  },
];

export default function WorksheetsPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="px-4 pt-12 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-slate-200">
            Custom worksheets and practice packs
          </div>
          <h1 className="text-4xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            Targeted practice that actually moves your child forward.
          </h1>
          <p className="text-lg text-slate-700 md:max-w-3xl">
            We create curriculum-aligned worksheets that match your child’s
            level, classroom language and current units so practice time feels
            clear, calm and productive, not like a battle.
          </p>
          <p className="text-sm text-slate-700 md:max-w-3xl">
            Ideal for anxious learners, autistic and ADHD students, and high
            achievers who want focused revision instead of random worksheets
            from the internet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact?type=worksheets"
              className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
            >
              Order a worksheet pack
            </Link>
            <Link
              href="/tutoring"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              Pair with tutoring
            </Link>
          </div>
        </div>
      </section>

      {/* WHAT THEY ARE / WHO THEY HELP */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-2">
          {/* What they are */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              What custom worksheets are
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              These are not generic printables. Each pack is built around your
              child, their teacher’s expectations and the outcomes they are
              working toward.
            </p>
            <div className="mt-4 space-y-3">
              {whatAre.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200"
                >
                  <div className="text-sm font-semibold text-slate-800">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Who they help */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-semibold text-[color:var(--ink)]">
              Who they are designed to help
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              For learners who need practice that feels safe, clear and
              achievable, not another reason to feel behind.
            </p>
            <div className="mt-4 space-y-3">
              {whoHelp.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS INCLUDED + EXAMPLES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-2">
          {/* What is inside a pack */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              What is inside a typical pack
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Each pack is built so students can see the path from confused to
              confident, one page at a time.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {packIncludes.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Example packs */}
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              Examples of worksheet packs
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Every child is different, but these are some of the most common
              packs families request.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {examplePacks.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DESIGNED AROUND YOUR CHILD (replaces heavy diagnostic wording) */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Designed around your child
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:max-w-3xl">
            Before we build a full set of worksheets, we look at your child’s
            current work, school expectations and a short skills check so we are
            not guessing their level. This might be a quick reading sample, some
            number work or a short conversation with you and your child.
          </p>
          <p className="mt-2 text-sm text-slate-600 md:max-w-3xl">
            Once we know where your child is sitting, we build worksheets that
            sit in the sweet spot – not too easy, not too hard.
          </p>
        </div>
      </section>

      {/* MINI GALLERY SECTION */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            What our worksheets look like
          </h2>
          <p className="text-sm text-slate-600 md:max-w-3xl">
            Here are example layouts for a skills snapshot page and a practice
            worksheet. Your child’s pack will be personalised, but it will
            follow the same calm, uncluttered style.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            
          </div>
        </div>
      </section>

      {/* SAMPLE DOWNLOADS */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Download sample pages
          </h2>
          <p className="mt-3 text-sm text-slate-600 md:max-w-3xl">
            These samples show the style and structure of our worksheets. Your
            child’s pack will be customised to their school topics and goals.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--ink)]">
            {sampleDocs.map((doc) => (
              <li key={doc.href}>
                <a
                  href={doc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--brand)] underline underline-offset-2 hover:opacity-80"
                >
                  {doc.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Pricing
          </h2>
          <p className="text-sm text-slate-600 md:max-w-3xl">
            Pricing depends on year level, subject and how many focus areas you
            would like covered. We keep it transparent so you know exactly what
            you are getting.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {pricing.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-[color:var(--card)] p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="text-base font-semibold text-slate-900">
                  {item.label}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW TO ORDER */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
                How to order
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Simple steps to get practice that fits your child, not someone
                else’s worksheet set.
              </p>
            </div>
            <div className="space-y-3">
              {howToOrder.map((item, idx) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--brand)] text-sm font-semibold text-white">
                    {idx + 1}
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FUTURE APP INTEGRATION */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Linking worksheets with the Studyroom app
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            We are building closer links between worksheet packs and the
            Studyroom app so in future students can track which pages they have
            completed, log scores and turn tricky questions into new practice
            inside their study plan.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            For now, each pack is delivered as easy-to-print PDFs that tutors
            and families can save, reuse and build on across the term.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact?type=worksheets"
              className="brand-cta inline-flex rounded-lg px-4 py-2 text-sm font-semibold shadow-sm"
            >
              Request a pack
            </Link>
            <Link
              href="/login"
              className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              Student login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
