import type { Metadata } from "next";

// /contact/page.tsx is a Client Component ("use client", for the form
// state), so its metadata has to live in this sibling layout instead —
// metadata exports only work in Server Components.
export const metadata: Metadata = {
  title: "Contact & Enquire",
  description:
    "Get in touch with Studyroom Australia to enquire about 1:1 tutoring for your child, in-home across Logan and Brisbane Southside or online.",
  alternates: { canonical: "/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
