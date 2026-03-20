"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDateString(): string {
  return formatDateKey(new Date());
}

async function recalculateStreakFromHistory(uid: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
}> {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "moodLogs"),
      orderBy("date", "desc"),
      limit(365)
    )
  );

  const dates = snap.docs
    .map((d) => String(d.data().date ?? ""))
    .filter(Boolean)
    .sort()
    .reverse(); // most recent first

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "" };
  }

  const today = localDateString();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateKey(d);
  })();

  // Current streak: consecutive days ending at today or yesterday
  let currentStreak = 0;
  const lastDate = dates[0];
  const streakIsActive = lastDate === today || lastDate === yesterday;
  if (streakIsActive) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest streak across all history
  let longestStreak = currentStreak;
  let runStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      runStreak++;
      if (runStreak > longestStreak) longestStreak = runStreak;
    } else {
      runStreak = 1;
    }
  }
  if (runStreak > longestStreak) longestStreak = runStreak;

  return { currentStreak, longestStreak, lastActiveDate: lastDate };
}

export function useStreak() {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      setAuthReady(!!u);
    });
    return () => off();
  }, []);

  // On mount (when auth is ready), do a one-time getDocs recalculation so the
  // streak is correct immediately, before the onSnapshot fires.
  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;

    recalculateStreakFromHistory(u.uid).then((result) => {
      setCurrentStreak(result.currentStreak);
      setLongestStreak(result.longestStreak);

      setDoc(
        doc(db, "users", u.uid, "streak", "state"),
        {
          currentStreak: result.currentStreak,
          longestStreak: result.longestStreak,
          lastActiveDate: result.lastActiveDate,
          recalculatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => { /* ignore */ });
    }).catch(() => { /* ignore */ });
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;

    const q = query(
      collection(db, "users", u.uid, "moodLogs"),
      orderBy("date", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const dates = new Set<string>();
      snap.forEach((d) => {
        const data = d.data();
        if (data.date) dates.add(String(data.date));
      });

      // Calculate current streak (grace window: don't reset if today not logged yet)
      let streak = 0;
      const today = new Date();
      const todayKey = formatDateKey(today);
      const startI = dates.has(todayKey) ? 0 : 1;
      for (let i = startI; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (dates.has(formatDateKey(d))) {
          streak++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      const sortedDates = Array.from(dates).sort().reverse();
      let longest = 0;
      let current = 0;
      let prev: Date | null = null;
      for (const dateStr of sortedDates) {
        const [y, m, dd] = dateStr.split("-").map(Number);
        const d = new Date(y, m - 1, dd);
        if (prev === null) {
          current = 1;
        } else {
          const diff = Math.round((prev.getTime() - d.getTime()) / 86400000);
          if (diff === 1) {
            current++;
          } else {
            longest = Math.max(longest, current);
            current = 1;
          }
        }
        prev = d;
        longest = Math.max(longest, current);
      }

      setCurrentStreak(streak);
      setLongestStreak(longest);

      // Persist to Firestore
      try {
        const sref = doc(db, "users", u.uid, "streak", "state");
        await setDoc(sref, {
          currentStreak: streak,
          longestStreak: longest,
          lastActiveDate: formatDateKey(today),
        }, { merge: true });
      } catch {
        // ignore write errors silently
      }
    });

    return () => unsub();
  }, [authReady]);

  return { currentStreak, longestStreak };
}
