"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";

type UpcomingItem = {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  type: string;
  completed: boolean;
};

type SessionRow = {
  id: string;
  startAt: string | null;
  durationMinutes: number;
  status: string;
  modality: string;
  notes: string;
};

type HubData = {
  student: {
    id: string;
    studentName: string;
    yearLevel: string;
    subjects: string[];
  };
  parent: {
    parentName: string;
    parentEmail: string;
  };
  upcoming: UpcomingItem[];
  sessions: SessionRow[];
};

export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HubData | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [authEmail, setAuthEmail] = useState("");

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }
      setAuthEmail(u.email ?? "");

      try {
        const idToken = await u.getIdToken();
        const res = await fetch("/api/parent/hub-data", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.status === 404) {
          setNotLinked(true);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error("Failed to load");

        const json = await res.json() as { ok: boolean } & HubData;
        setData(json);
      } catch (err) {
        console.error("[parent-page]", err);
        setNotLinked(true);
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, [router]);

  if (loading) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading...</div>
      </div>
    );
  }

  if (notLinked) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: 24, border: "1px solid rgba(0,0,0,0.06)", maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", marginBottom: 8 }}>Account not linked</div>
          <div style={{ fontSize: 13, color: "#8a96a3", lineHeight: 1.6 }}>
            Your email address isn&rsquo;t linked to a student record yet.
            Contact your tutor or Studyroom admin to get set up.
          </div>
          <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 12 }}>{authEmail}</div>
          <button
            onClick={() => signOut(auth).then(() => router.push("/"))}
            style={{ marginTop: 16, background: "#456071", color: "#fff", border: "none", borderRadius: 10, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, upcoming, sessions } = data;

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "0 0 60px" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-4">
        <div
          className="rounded-[28px] bg-white/95 backdrop-blur-md"
          style={{
            border: "1px solid rgba(69, 96, 113, 0.15)",
            boxShadow:
              "0 1px 3px rgba(20, 32, 44, 0.06), 0 8px 28px rgba(20, 32, 44, 0.09)",
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 md:px-5">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="Studyroom"
                  width={160}
                  height={40}
                  className="h-[36px] w-auto object-contain"
                  priority
                />
              </Link>
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--muted)]">Parent View</p>
                <p className="text-sm font-semibold text-[color:var(--ink)]">{student.studentName}</p>
              </div>
            </div>
            <button
              onClick={() => signOut(auth).then(() => router.push("/"))}
              className="button-ghost rounded-full px-3.5 py-1.5 text-xs font-semibold"
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: "16px 16px 0" }}>

        {/* Upcoming deadlines */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Upcoming deadlines</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
        </div>

        {upcoming.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20, fontSize: 12, color: "#8a96a3" }}>
            No upcoming deadlines.
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {upcoming.map((item) => {
              const due = new Date(item.dueDate);
              const daysUntil = Math.round((due.getTime() - Date.now()) / 86400000);
              return (
                <div key={item.id} style={{
                  background: "#fff", borderRadius: 14, padding: "12px 14px",
                  border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
                  borderLeft: `3px solid ${daysUntil <= 7 ? "#e39bb6" : daysUntil <= 14 ? "#d4b896" : "#b0c8d8"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
                      {item.subject} · {item.type === "exam" ? "Exam" : "Assessment"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" as const,
                    background: daysUntil < 0 ? "#fce8ee" : daysUntil <= 7 ? "#fce8ee" : daysUntil <= 14 ? "#fef3e2" : "#e8f0fa",
                    color: daysUntil < 0 ? "#c0445e" : daysUntil <= 7 ? "#c0445e" : daysUntil <= 14 ? "#a06020" : "#3a6090",
                    marginLeft: 12,
                  }}>
                    {daysUntil < 0 ? "Overdue" : daysUntil === 0 ? "Today" : `In ${daysUntil}d`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Session history */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Session history</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
        </div>

        {sessions.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#8a96a3" }}>
            No sessions yet.
          </div>
        ) : (
          sessions.map((s) => {
            const startAt = s.startAt ? new Date(s.startAt) : null;
            return (
              <div key={s.id} style={{
                background: "#fff", borderRadius: 14, padding: "12px 14px",
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>
                    {startAt
                      ? startAt.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
                      : "—"}
                    {startAt ? ` · ${startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}` : ""}
                    {` · ${s.durationMinutes} min`}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                    background: s.status?.toLowerCase() === "completed" ? "#d4edcc" : "#edf2f6",
                    color: s.status?.toLowerCase() === "completed" ? "#2d5a24" : "#456071",
                  }}>
                    {s.status ?? "scheduled"}
                  </span>
                </div>
                {s.modality && (
                  <div style={{ fontSize: 11, color: "#8a96a3" }}>
                    {s.modality === "ONLINE" || s.modality === "online" ? "Online" : "In-home"}
                  </div>
                )}
                {s.notes && (
                  <div style={{
                    fontSize: 11, color: "#456071", fontStyle: "italic",
                    padding: "5px 9px", background: "rgba(69,96,113,0.05)",
                    borderRadius: 7, borderLeft: "2px solid rgba(69,96,113,0.2)",
                    marginTop: 6,
                  }}>
                    &ldquo;{s.notes}&rdquo;
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
