// src/hooks/useUserRole.ts
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

/**
 * Hard-coded admin emails.
 * Anyone who signs in with one of these emails will be treated as "admin",
 * even if there is no roles/{uid} doc or custom claim yet.
 */
const ADMIN_EMAILS = [
  "lily.studyroom@gmail.com", // ← replace this with your real email
  // "another-admin@example.com", // you can add more later if needed
] as const;

type Role = "student" | "tutor" | "tutor_pending" | "admin";

/**
 * Watches the user's role in real time (roles/{uid}).
 * - If email is in ADMIN_EMAILS → role = "admin".
 * - Else, use roles/{uid}.role, defaulting to "student".
 */
export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let unsubRole: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      // Reset when auth changes
      if (!u) {
        setRole(null);
        if (unsubRole) unsubRole();
        return;
      }

      // 🔐 1) Hard-coded admin emails take priority
      if (u.email && ADMIN_EMAILS.includes(u.email as (typeof ADMIN_EMAILS)[number])) {
        // No need to listen to roles doc for this user
        if (unsubRole) unsubRole();
        setRole("admin");
        return;
      }

      // 🔐 2) Otherwise, subscribe to their role doc live
      const ref = doc(db, "roles", u.uid);
      unsubRole = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data();
          const r = (data?.role as string | undefined) ?? "student";
          // Clamp to the allowed set
          if (r === "admin" || r === "tutor" || r === "tutor_pending" || r === "student") {
            setRole(r);
          } else {
            setRole("student");
          }
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
