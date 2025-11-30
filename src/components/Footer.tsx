import Link from "next/link";
import Image from "next/image";

const quickLinks = [
  { href: "/tutoring", label: "Tutoring" },
  { href: "/headstart", label: "HeadStart Workshops" },
  { href: "/worksheets", label: "Custom Worksheets" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
];

export default function Footer() {
  return (
    <footer className="bg-[#456071] text-[#eaeaea]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <div>
              <div className="relative h-9 w-40">
                        <Image
                          src="/logo.png"
                          alt="Studyroom"
                          fill
                          className="object-contain"
                          priority
                        />
                      </div>
              <div className="text-xs text-[#d6e5e3]">
                Personalised tutoring that meets students where they are.
              </div>
            </div>
          </div>
          <p className="max-w-xl text-sm text-[#d6e5e3]">
            We help anxious, neurodivergent, and catch-up learners build
            confidence through patient teaching, clear steps, and
            curriculum-aligned support.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Quick links</h3>
          <div className="grid gap-2 text-sm">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[#eaeaea] transition hover:text-[#b8cad6]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contact</h3>
          <div className="space-y-2 text-sm text-[#d6e5e3]">
            <p>hello@studyroom.au</p>
            <p>Phone: 0400 123 456</p>
            <p>Logan & Brisbane South</p>
            <Link
              href="/contact"
              className="inline-flex rounded-lg border border-[#b8cad6] px-3 py-2 text-sm font-semibold text-[#f8f8ff] transition hover:bg-[#374f5e]"
            >
              Start an enquiry
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[#374f5e] bg-[#374f5e]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-4 text-xs text-[#d6e5e3] sm:flex-row sm:items-center md:px-6">
          <span>© {new Date().getFullYear()} Studyroom. All rights reserved.</span>
          <span>Confidence-first tutoring for Prep – Year 12.</span>
        </div>
      </div>
    </footer>
  );
}
