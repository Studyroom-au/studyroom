import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteShell from "@/components/SiteShell";
import { SITE_URL } from "@/lib/siteUrl";
import { ORGANIZATION_JSON_LD } from "@/lib/organizationJsonLd";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Studyroom Australia | Tutoring in Logan & Brisbane Southside",
    template: "%s | Studyroom Australia",
  },
  description: ORGANIZATION_JSON_LD.description,
  openGraph: {
    siteName: "Studyroom Australia",
    type: "website",
    locale: "en_AU",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen app-bg text-[color:var(--ink)] antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
