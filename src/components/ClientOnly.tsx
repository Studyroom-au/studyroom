"use client";

import { useEffect, useState } from "react";

/**
 * Render children only after the component has mounted on the client.
 * Always renders the same outer wrapper to avoid hydration mismatches.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
