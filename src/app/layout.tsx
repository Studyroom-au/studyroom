import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteShell from "@/components/SiteShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Studyroom",
  description: "Kid-friendly study rooms",
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
