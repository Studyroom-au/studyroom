"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type MessageKey =
  | "login"
  | "task_complete"
  | "focus_start"
  | "focus_end"
  | "idle"
  | "mood_save"
  | "deadline_soon"
  | "streak_milestone"
  | "lobby_enter"
  | "room_enter"
  | "room_idle"
  | "evening_nudge";

const MESSAGES: Record<MessageKey, string[]> = {
  login: [
    "Hey! Good to see you. What are we tackling today?",
    "Back again. Let\u2019s get something done.",
    "Ready when you are.",
  ],
  task_complete: [
    "Done! That\u2019s one off the list.",
    "Yes! Look at you go.",
    "Boom. Crossed off. Incredible.",
  ],
  focus_start: [
    "Timer running. Stay with it.",
    "25 minutes. You\u2019ve got this.",
    "Deep focus. One thing at a time.",
  ],
  focus_end: [
    "Session done. Take a proper break \u2014 you earned it.",
    "Nice work. Rest for a bit, then go again.",
  ],
  idle: [
    "The timer\u2019s not going to press itself. Just saying.",
    "Still here. You\u2019ve been staring a while...",
    "Psst. Even 5 minutes counts.",
    "No pressure. But also... slight pressure.",
  ],
  mood_save: [
    "Saved. Just between us. \uD83D\uDD12",
    "Got it. How you feel matters.",
  ],
  deadline_soon: [
    "Heads up \u2014 something\u2019s due soon. Want to make a plan?",
  ],
  streak_milestone: [
    "7 days in a row. That\u2019s not a coincidence \u2014 that\u2019s a habit.",
    "Week streak! Alex is genuinely impressed.",
    "7 days straight. Keep this going.",
  ],
  lobby_enter: [
    "Pick a room or create your own. Quiet ones work best.",
    "The lobby is open. Find your spot.",
    "Room 1 is always available. Just saying.",
  ],
  room_enter: [
    "You\u2019re in. Camera optional, focus required.",
    "Room\u2019s ready. What are we working on today?",
    "In the room. Let\u2019s get something done.",
  ],
  room_idle: [
    "Timer\u2019s sitting there. You know what to do.",
    "Still in the room. Still not focused? Start the timer.",
    "You opened the room. That\u2019s step one. Step two is the timer.",
  ],
  evening_nudge: [
    "Haven\u2019t checked in today \uD83C\uDF19",
    "It\u2019s evening \u2014 how are you feeling? Tap to check in.",
  ],
};

const IDLE_DELAY_MS = 20_000;

const ALL_CYCLE_MESSAGES = [
  "Let\u2019s get one thing done. Just one.",
  "25 minutes. That\u2019s all.",
  "Still here. You\u2019ve been staring a while.",
  "The timer\u2019s not going to press itself.",
  "You\u2019ve got this. Seriously.",
  "One task. Pick one. Go.",
];

function readTime(text: string): number {
  return Math.min(10000, Math.max(3000, text.length * 55));
}

function todayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AlexBuddy() {
  const pathname = usePathname();
  const isStudentRoute =
    pathname === "/hub" ||
    pathname.startsWith("/lobby") ||
    pathname.startsWith("/room");

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blinking, setBlinking] = useState(false);
  const [animState, setAnimState] = useState<"float" | "bounce" | "wiggle">("float");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgIndex = useRef(0);

  const showMessage = useCallback((key: MessageKey) => {
    const pool = MESSAGES[key];
    const text = pool[Math.floor(Math.random() * pool.length)];
    setMessage(text);
    setAnimState("bounce");
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setMessage(null);
      setAnimState("float");
    }, readTime(text));
  }, []);

  // Initial greeting
  useEffect(() => {
    if (!isStudentRoute) return;
    const t = setTimeout(() => {
      setVisible(true);
      showMessage("login");
    }, 800);
    return () => clearTimeout(t);
  }, [isStudentRoute, showMessage]);

  // Idle nudge
  useEffect(() => {
    if (!isStudentRoute) return;
    function resetIdle() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        const pool = MESSAGES.idle;
        const text = pool[Math.floor(Math.random() * pool.length)];
        setMessage(text);
        setAnimState("wiggle");
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          setMessage(null);
          setAnimState("float");
        }, readTime(text));
      }, IDLE_DELAY_MS);
    }
    window.addEventListener("click", resetIdle, { passive: true });
    window.addEventListener("keydown", resetIdle, { passive: true });
    resetIdle();
    return () => {
      window.removeEventListener("click", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isStudentRoute]);

  // Blink
  useEffect(() => {
    blinkInterval.current = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
    }, 3800);
    return () => {
      if (blinkInterval.current) clearInterval(blinkInterval.current);
    };
  }, []);

  // Expose global say() for other components
  useEffect(() => {
    (window as unknown as Record<string, unknown>).alexBuddy = { say: showMessage };
    return () => {
      delete (window as unknown as Record<string, unknown>).alexBuddy;
    };
  }, [showMessage]);

  // Evening nudge — after 6pm if mood not logged today
  useEffect(() => {
    if (!isStudentRoute) return;
    const hour = new Date().getHours();
    if (hour < 18) return;

    const offAuth = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      const t = setTimeout(async () => {
        try {
          const snap = await getDoc(doc(db, "users", u.uid, "moodLogs", todayDateKey()));
          if (!snap.exists()) {
            showMessage("evening_nudge");
          }
        } catch {
          // ignore
        }
      }, 4000);
      return () => clearTimeout(t);
    });

    return () => offAuth();
  }, [isStudentRoute, showMessage]);

  function handleClick() {
    const text = ALL_CYCLE_MESSAGES[msgIndex.current % ALL_CYCLE_MESSAGES.length];
    msgIndex.current++;
    setMessage(text);
    setAnimState(msgIndex.current % 2 === 0 ? "bounce" : "wiggle");
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setMessage(null);
      setAnimState("float");
    }, readTime(text));
  }

  if (!visible || !isStudentRoute) return null;

  const animStyle =
    animState === "bounce"
      ? { animation: "sr-bounce 0.6s ease" }
      : animState === "wiggle"
      ? { animation: "sr-wiggle 0.55s ease" }
      : { animation: "sr-float 3.5s ease-in-out infinite" };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {message && (
        <div
          style={{
            pointerEvents: "auto",
            maxWidth: 200,
            background: "white",
            border: "1.5px solid rgba(0,0,0,0.09)",
            borderRadius: "16px 16px 4px 16px",
            padding: "10px 14px",
            fontSize: 12,
            lineHeight: 1.55,
            color: "#1d2428",
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            animation: "sr-pop-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-label="Alex \u2014 your study buddy"
        style={{
          pointerEvents: "auto",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: 72,
          display: "block",
          ...animStyle,
        }}
      >
        <svg
          width="64"
          height="128"
          viewBox="0 0 80 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Tapered exclamation stick */}
          <path
            d="M20 4 C20 4 26 3 40 3 C54 3 60 4 60 4 C60 4 53 70 49 80 C47 85 40 88 40 88 C40 88 33 85 31 80 C27 70 20 4 20 4 Z"
            fill="white"
            stroke="#1a1a1a"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Head */}
          <circle cx="40" cy="124" r="27" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />

          {/* Rosy cheeks */}
          <circle cx="22" cy="132" r="6.5" fill="#f4a0b4" opacity="0.42" />
          <circle cx="58" cy="132" r="6.5" fill="#f4a0b4" opacity="0.42" />

          {/* Left glasses lens */}
          <circle cx="25" cy="121" r="13" fill="rgba(176,174,228,0.52)" stroke="#222" strokeWidth="2" />
          {/* Right glasses lens */}
          <circle cx="55" cy="121" r="13" fill="rgba(176,174,228,0.52)" stroke="#222" strokeWidth="2" />

          {/* Bridge */}
          <path d="M41 121 Q40 119 39 121" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Arms */}
          <path d="M15 121 Q13 120 11 115" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M65 121 Q67 120 69 115" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* Eyes */}
          <ellipse
            cx="30"
            cy="122"
            rx={5}
            ry={blinking ? 0.8 : 5}
            fill="#1a1a1a"
            opacity="0.85"
            style={{ transition: "ry 0.08s ease" }}
          />
          <ellipse
            cx="50"
            cy="122"
            rx={5}
            ry={blinking ? 0.8 : 5}
            fill="#1a1a1a"
            opacity="0.85"
            style={{ transition: "ry 0.08s ease" }}
          />

          {!blinking && (
            <>
              <circle cx="32" cy="119" r="2" fill="white" />
              <circle cx="52" cy="119" r="2" fill="white" />
            </>
          )}

          {/* Nose */}
          <circle cx="40" cy="130" r="3.5" fill="#f4a0b4" opacity="0.9" />

          {/* Smile */}
          <path d="M31 138 Q40 146 49 138" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
