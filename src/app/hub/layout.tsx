"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AlexBuddy from "@/components/AlexBuddy";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/");
        return;
      }

      const email = u.email ?? "";

      // Admin always passes through
      if (email === "lily.studyroom@gmail.com") {
        setReady(true);
        return;
      }

      // Check role
      const roleSnap = await getDoc(doc(db, "roles", u.uid));
      const role = roleSnap.exists() ? String(roleSnap.data().role ?? "") : "";

      // Tutors and admins bypass payment
      if (role === "tutor" || role === "admin") {
        setReady(true);
        return;
      }

      // Check subscription status
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const subStatus = String(userData.subscriptionStatus ?? "");
      const onboardingComplete = Boolean(userData.onboardingComplete);

      const isActive = subStatus === "active";
      const isTrial =
        subStatus === "trial" &&
        userData.trialEndsAt &&
        new Date() < (userData.trialEndsAt.toDate?.() ?? new Date(userData.trialEndsAt));

      if (!isActive && !isTrial) {
        if (subStatus === "trial") {
          router.replace("/subscribe?trial_expired=1");
        } else {
          router.replace("/subscribe");
        }
        return;
      }

      if (!onboardingComplete) {
        router.replace("/onboarding");
        return;
      }

      setReady(true);
    });
    return () => off();
  }, [router]);

  if (!ready) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {children}
      <AlexBuddy />
    </>
  );
}
