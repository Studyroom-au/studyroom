"use client";

export default function ContactPage() {
  return (
    <div className="px-4 pb-16 pt-12 md:px-6 md:pt-16">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* HEADER */}
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-slate-200">
            Contact
          </div>
          <h1 className="text-4xl font-bold leading-tight text-[color:var(--ink)] md:text-5xl">
            Tell us about your child and we’ll be in touch.
          </h1>
          <p className="text-lg text-slate-700 md:max-w-3xl">
            Share a few details and we’ll recommend the right tutor or workshop.
            No pressure — just a helpful first chat.
          </p>
        </div>

        {/* FORM */}
        <form
          action="https://formspree.io/f/mwpdylqr"
          method="POST"
          className="grid gap-6 rounded-3xl bg-[color:var(--card)] p-8 shadow-sm ring-1 ring-slate-200"
        >
          {/* Optional: subject line for the email */}
          <input
            type="hidden"
            name="_subject"
            value="New enquiry from Studyroom website"
          />

          {/* CONTACT DETAILS */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>Parent name</span>
              <input
                name="parentName"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="Jane Smith"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>Email</span>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="you@example.com"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>Phone</span>
              <input
                name="phone"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="04xx xxx xxx"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>Child’s name</span>
              <input
                name="childName"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="Alex"
              />
            </label>
          </div>

          {/* SCHOOL INFO */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>Year level</span>
              <input
                name="yearLevel"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="Year 5"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-800">
              <span>School (optional)</span>
              <input
                name="school"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
                placeholder="School name"
              />
            </label>
          </div>

          {/* SERVICE TYPE */}
          <label className="space-y-2 text-sm font-semibold text-slate-800">
            <span>Service type</span>
            <select
              name="serviceType"
              defaultValue="Tutoring"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-[color:var(--brand)] focus:outline-none"
            >
              <option value="Tutoring">Tutoring</option>
              <option value="Workshops">Workshops</option>
              <option value="Worksheets">Worksheets</option>
              <option value="Not sure">Not sure</option>
            </select>
          </label>

          {/* MESSAGE */}
          <label className="space-y-2 text-sm font-semibold text-slate-800">
            <span>Message</span>
            <textarea
              name="message"
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-[color:var(--brand)] focus:outline-none"
              placeholder="Tell us about goals, learning style, or concerns."
            />
          </label>

          {/* SUBMIT */}
          <div className="flex justify-start">
            <button
              type="submit"
              className="brand-cta inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
            >
              Submit
            </button>
          </div>
        </form>

        {/* OPTIONAL: Plain email note */}
        <p className="text-xs text-slate-500">
          Prefer email? You can also reach us at{" "}
          <a
            href="mailto:contactstudyroomaustralia@gmail.com"
            className="font-semibold text-[color:var(--brand)]"
          >
            contactstudyroomaustralia@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
