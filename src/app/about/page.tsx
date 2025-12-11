import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* HERO */}
      <section className="px-4 pt-12 md:px-6 md:pt-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-[color:var(--ring)]">
            About Studyroom
          </div>

          <h1 className="text-4xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            Learning thrives when students feel confident, supported, and understood.
          </h1>

          <p className="text-lg text-[color:var(--muted)] md:max-w-3xl">
            Studyroom was created with a simple belief: every student can grow when learning feels
            calm, structured, and personal.
          </p>
        </div>
      </section>

      {/* OUR PURPOSE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[1.4fr,1fr] lg:items-center">
          <div className="space-y-4 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Our Purpose</h2>

            <p className="text-sm text-[color:var(--muted)]">
              So many students aren&apos;t struggling because they &quot;can&apos;t do it.&quot; They&apos;re
              struggling because they don&apos;t feel confident, they&apos;re unsure where to start, they feel
              overwhelmed by fast-paced classrooms, or they&apos;ve never been taught how to organise
              themselves.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              Studyroom exists to change that. We meet students exactly where they are and help
              them move forward with clarity, confidence, and pride.
            </p>
          </div>

          <div
            className="relative h-72 w-full overflow-hidden rounded-3xl ring-1 ring-[color:var(--ring)]"
            suppressHydrationWarning
          >
            <Image
              src="/artgallery.jpeg"
              alt="Lily standing in front of colourful artwork"
              fill
              className="object-cover"
              style={{ color: "transparent" }}
            />
          </div>
        </div>
      </section>

      {/* WHAT WE BELIEVE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-5 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">What We Believe</h2>

          <p className="text-sm text-[color:var(--muted)]">At Studyroom, we believe:</p>

          <ul className="space-y-2 text-sm text-[color:var(--muted)]">
            <li>• Confidence comes before achievement</li>
            <li>• Organisation creates independence</li>
            <li>• Clear steps reduce overwhelm</li>
            <li>• Students learn best when routines are predictable</li>
            <li>• Every learner deserves patience and clarity</li>
            <li>• Education works when it feels personal, not pressured</li>
          </ul>

          <p className="text-sm text-[color:var(--muted)]">
            We don&apos;t force students into a system – we build the system around them.
          </p>
        </div>
      </section>

      {/* WHO WE SUPPORT */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-10 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Who We Support</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Studyroom is for students who want to feel confident, organised, and capable –
              without pressure or fear of making mistakes.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              "Students who want more confidence in school",
              "Learners who need help staying organised and consistent",
              "Students who benefit from clear routines and calm pacing",
              "Teens who are catching up or want to aim higher",
              "Students who feel stuck, unsure, or overwhelmed",
              "Neurodivergent learners (including ASD & ADHD)",
              "Students who can’t always attend school",
              "Teens who need personalised explanations and real support",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-[color:var(--ring)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)]">
                  <span className="text-lg">✨</span>
                </div>
                <div className="text-sm font-semibold text-[color:var(--ink)]">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE STUDYROOM DIFFERENCE */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              The Studyroom Difference
            </h2>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              We don&apos;t just tutor. We help students rebuild confidence, create structure, and
              feel capable in their learning.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              {[
                "Feeling proud of their progress",
                "Building momentum and good habits",
                "Developing independence with schoolwork",
                "Understanding their learning style",
                "Rebuilding their relationship with school",
                "Feeling capable, organised, and prepared",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--accent-sage)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="relative h-80 w-full overflow-hidden rounded-3xl ring-1 ring-[color:var(--ring)]"
            suppressHydrationWarning
          >
            <Image
              src="/image.png"
              alt="Lily receiving academic award"
              fill
              className="object-cover"
              style={{ color: "transparent" }}
            />
          </div>
        </div>
      </section>

      {/* ABOUT LILY */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[1fr,1.3fr] lg:items-center">
          <div
            className="relative h-80 w-full overflow-hidden rounded-3xl ring-1 ring-[color:var(--ring)]"
            suppressHydrationWarning
          >
            <Image
              src="/selfphoto.jpeg"
              alt="Portrait of Lily Smith"
              fill
              className="object-cover"
              style={{ color: "transparent" }}
            />
          </div>

          <div className="space-y-4 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
              About Lily – Founder
            </h2>

            <p className="text-sm text-[color:var(--muted)]">
              I started Studyroom after realising how many students felt the same way I once did –
              capable, but overwhelmed.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              I often struggled with confidence, organisation, and feeling behind even when I
              wasn&apos;t. Once I learned how to break tasks down and study properly, everything
              changed – and I wanted to help other students feel the same.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              I&apos;m now studying a Bachelor of Education (Primary & Secondary – Mathematics) and
              have worked with hundreds of students across Logan and Brisbane.
            </p>

            <p className="text-sm text-[color:var(--muted)]">
              My approach blends patience, structure, curriculum knowledge, confidence building, and
              genuine care.
            </p>
          </div>
        </div>
      </section>

      {/* SAFETY + VALUES */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-[color:var(--ring)]">
          <h2 className="text-2xl font-semibold text-[color:var(--ink)]">
            Safety &amp; Professional Standards
          </h2>

          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Families trust us because we are committed to child safety, professionalism, and clear,
            honest communication.
          </p>

          <ul className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
            <li>• Blue Cards and child safety standards</li>
            <li>• Privacy and confidentiality</li>
            <li>• Calm, predictable learning environments</li>
            <li>• Ethical, student-led teaching practices</li>
            <li>• Professional scheduling and reliable routines</li>
          </ul>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-4 rounded-3xl bg-[color:var(--brand)] px-8 py-10 text-white shadow-lg">
          <h2 className="text-3xl font-semibold">We hear you, and we want to help.</h2>

          <p className="text-sm text-white/90 md:max-w-2xl">
            If your child needs clarity, calmness, confidence, or a fresh start – we&apos;re here.
            Share a few details and we&apos;ll recommend a supportive starting point.
          </p>

          <Link
            href="/contact"
            className="inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand)] shadow-sm transition hover:shadow-md"
          >
            Enquire about tutoring
          </Link>
        </div>
      </section>
    </div>
  );
}
