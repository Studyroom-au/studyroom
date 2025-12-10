"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export type UserProfile = {
  displayName?: string;
  userType?: "student" | "parent" | "tutor";
  parentEmail?: string | null;
  suspended?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

export function useUserProfile() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile({});
        }
      } catch (err) {
        console.error("Failed to load user profile", err);
        setProfile({});
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  return { firebaseUser, profile, loading };
}
