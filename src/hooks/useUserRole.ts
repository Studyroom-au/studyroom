"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

/**
 * Watches the user's role in real time (roles/{uid})
 * Returns "student" by default if no role doc exists.
 */
export function useUserRole() {
  const [role, setRole] = useState<"student" | "tutor" | "admin" | null>(null);

  useEffect(() => {
    let unsubRole: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      // Reset when auth changes
      if (!u) {
        setRole(null);
        if (unsubRole) unsubRole();
        return;
      }

      // Subscribe to their role doc live
      const ref = doc(db, "roles", u.uid);
      unsubRole = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data();
          const r = (data?.role as string | undefined) ?? "student";
          setRole(r as "student" | "tutor" | "admin");
        },
        (err) => {
          console.warn("Role listener error:", err);
          setRole("student"); // default fallback
        }
      );
    });

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubRole) unsubRole();
    };
  }, []);

  return role;
}
