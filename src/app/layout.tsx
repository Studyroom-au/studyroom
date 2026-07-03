import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteShell from "@/components/SiteShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Studyroom Australia | Tutoring in Logan & Online",
  description:
    "Personalised 1:1 tutoring for Prep to Year 12 students across Logan, Brisbane Southside and online. Calm support for confidence, skills and study routines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen app-bg text-[color:var(--ink)] antialiased">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
