import type { Metadata } from "next";

// /enrol/page.tsx is a Client Component ("use client", for the form
// state), so its metadata has to live in this sibling layout instead —
// metadata exports only work in Server Components.
export const metadata: Metadata = {
  title: "Enrol with Studyroom",
  description:
    "Enrol your child for 1:1 tutoring with Studyroom Australia — tell us their subjects, year level and availability, in-home across Logan and Brisbane Southside or online.",
  alternates: { canonical: "/enrol" },
};

export default function EnrolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
