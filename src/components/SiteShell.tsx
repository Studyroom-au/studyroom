"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Navbar from "./Navbar";

const HIDE_CHROME_PATTERNS = [
  /^\/room(\/|$)/,
  /^\/hub(\/|$)/,
  /^\/lobby(\/|$)/,
];

export default function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome = HIDE_CHROME_PATTERNS.some((pattern) =>
    pattern.test(pathname)
  );

  return (
    <div className="flex min-h-screen flex-col">
      {!hideChrome && <Navbar />}
      <main className="flex-1">{children}</main>
      {!hideChrome && <Footer />}
    </div>
  );
}
