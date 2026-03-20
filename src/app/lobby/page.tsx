// src/app/lobby/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PomoWidget from "@/components/widgets/PomoWidget";
import TaskListWidget from "@/components/widgets/TaskListWidget";
import Image from "next/image";

type Room = {
  id: string;
  title?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  lastActiveAt?: Timestamp;
  isActive?: boolean;
  participantCount?: number;
  _shownTitle?: string;
};

const DEFAULT_ROOMS: Room[] = [
  { id: "room-1", title: "Room 1" },
  { id: "room-2", title: "Room 2" },
  { id: "room-3", title: "Room 3" },
  { id: "room-4", title: "Room 4" },
];

const DEFAULT_ROOM_IDS = new Set(DEFAULT_ROOMS.map((r) => r.id));

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const friendlyError = (msg: string) =>
  msg.toLowerCase().includes("permission")
    ? "You do not have permission to do that."
    : msg;

export default function LobbyPage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");

  // Require auth and refresh token (so Firestore rule changes apply)
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthed(false);
        router.replace("/");
        return;
      }
      try {
        await u.getIdToken(true);
      } catch {
        // ignore token refresh failures, just continue
      }
      setAuthed(true);
    });
    return () => off();
  }, [router]);

  // One-shot cleanup: delete non-default rooms older than 24h
  useEffect(() => {
    if (!authed) return;

    const cleanupOldRooms = async () => {
      try {
        const snap = await getDocs(collection(db, "rooms"));
        const now = Date.now();

        const deletePromises: Promise<void>[] = [];

        snap.forEach((docSnap) => {
          const id = docSnap.id;

          // Never touch default rooms
          if (DEFAULT_ROOM_IDS.has(id)) return;

          const data = docSnap.data() as Room;
          const lastActiveMs = data.lastActiveAt?.toMillis?.();
          const createdAtMs = data.createdAt?.toMillis?.();

          const referenceTime = lastActiveMs ?? createdAtMs;
          if (typeof referenceTime !== "number") return;

          const age = now - referenceTime;
          if (age > EXPIRY_MS) {
            deletePromises.push(deleteDoc(docSnap.ref));
          }
        });

        if (deletePromises.length > 0) {
          await Promise.allSettled(deletePromises);
        }
      } catch (e) {
        console.error("Failed to clean up old rooms", e);
      }
    };

    void cleanupOldRooms();
  }, [authed]);

  // Subscribe to rooms when authed
  useEffect(() => {
    if (!authed) return;

    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const off = onSnapshot(
      q,
      (snap) => {
        const list: Room[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as Omit<Room, "id">;
          list.push({ id: d.id, ...data });
        });
        setRooms(list);
      },
      (e) => setError(friendlyError(e.message || "Failed to load rooms"))
    );
    return () => off();
  }, [authed]);

  // Trigger lobby_enter message for Alex
  useEffect(() => {
    const t = setTimeout(() => {
      (window as unknown as Record<string, unknown> & {
        alexBuddy?: { say: (key: string) => void };
      }).alexBuddy?.say("lobby_enter");
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Which rooms should be shown in the grid
  const shownRooms = useMemo(() => {
    const now = Date.now();

    const activeNonDefault = rooms.filter((r) => {
      if (DEFAULT_ROOM_IDS.has(r.id)) return false;

      const lastMs =
        r.lastActiveAt?.toMillis?.() ?? r.createdAt?.toMillis?.();
      if (typeof lastMs !== "number") return false;

      const age = now - lastMs;
      return age <= EXPIRY_MS;
    });

    const base = [...DEFAULT_ROOMS, ...activeNonDefault];
    return base.map((r) => ({
      ...r,
      _shownTitle: (r.title ?? "").trim() || r.id,
    }));
  }, [rooms]);

  async function createRoom() {
    setError(null);
    const title = newTitle.trim();
    if (!title) {
      setError("Please enter a room name.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Please sign in first.");
      return;
    }

    try {
      setCreating(true);

      const docRef = await addDoc(collection(db, "rooms"), {
        title,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        isActive: true,
      });

      router.push(`/room/${encodeURIComponent(docRef.id)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(friendlyError(msg || "Could not create room"));
    } finally {
      setCreating(false);
      setNewTitle("");
    }
  }

  function joinByCode() {
    const code = codeInput.trim();
    if (!code) return;
    router.push("/room/" + code.toLowerCase());
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px" }}>

        {/* Header */}
        <header className="sticky top-0 z-30 mb-6 px-3 pt-3 md:px-4">
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--brand)]">Studyroom</p>
                  <h1 className="text-base font-bold tracking-tight text-[color:var(--ink)]">Library Lobby</h1>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/hub")}
                className="button-secondary flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
                title="Back to your Hub"
              >
                ← Hub
              </button>
            </div>
          </div>
        </header>

        {/* 2-column layout */}
        <div className="lobby-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Create Room card */}
            <section style={{ background: "white", borderRadius: 20, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", margin: "0 0 6px" }}>
                New room
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em", margin: 0 }}>
                Create a room
              </h2>
              <p style={{ fontSize: 13, color: "#8a96a3", marginTop: 3, marginBottom: 16 }}>
                Give it a friendly name, e.g., &quot;Biology Revision&quot;.
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <input
                  style={{ flex: 1, border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#1d2428", background: "white", outline: "none", fontFamily: "inherit" }}
                  placeholder="Room name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  aria-label="New room name"
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#456071"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)"; }}
                />
                <button
                  type="button"
                  onClick={createRoom}
                  disabled={creating}
                  style={{ background: "#456071", color: "white", border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: creating ? 0.6 : 1, flexShrink: 0, fontFamily: "inherit" }}
                  onMouseOver={(e) => { if (!creating) e.currentTarget.style.background = "#344d5c"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "#456071"; }}
                >
                  {creating ? "Creating\u2026" : "Create Room"}
                </button>
              </div>

              {error && (
                <p style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>{error}</p>
              )}
              <p style={{ fontSize: 11, color: "#8a96a3", marginTop: 8 }}>
                Only rooms used in the last 24 hours appear below. Older rooms are cleaned up automatically.
              </p>
            </section>

            {/* Private room — join by code */}
            <section style={{ background: "white", borderRadius: 20, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden" }}>
              {/* Accent stripe */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #e39bb6, #e5d1d0)", borderRadius: "20px 20px 0 0" }} />
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e39bb6", margin: "0 0 6px" }}>
                Private room
              </p>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", margin: 0 }}>
                Join with a code
              </h2>
              <p style={{ fontSize: 12, color: "#8a96a3", marginTop: 3, marginBottom: 14 }}>
                Enter a room code to join a private session.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  style={{ flex: 1, border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1d2428", background: "white", outline: "none", fontFamily: "inherit" }}
                  placeholder="e.g. ABC123"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#e39bb6"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.09)"; }}
                  aria-label="Room code"
                />
                <button
                  type="button"
                  onClick={joinByCode}
                  disabled={codeInput.trim().length < 4}
                  style={{ background: "#456071", color: "white", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: codeInput.trim().length < 4 ? "not-allowed" : "pointer", flexShrink: 0, fontFamily: "inherit", opacity: codeInput.trim().length < 4 ? 0.5 : 1 }}
                  onMouseOver={(e) => { if (codeInput.trim().length >= 4) e.currentTarget.style.background = "#344d5c"; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = "#456071"; }}
                >
                  Join
                </button>
              </div>
            </section>

            {/* Study rooms section */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", whiteSpace: "nowrap" }}>
                  Study rooms
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {shownRooms.map((room, idx) => (
                  <LobbyRoomCard
                    key={room.id}
                    room={room}
                    isDefault={DEFAULT_ROOM_IDS.has(room.id)}
                    roomIndex={idx}
                    onClick={() => router.push(`/room/${encodeURIComponent(room.id)}`)}
                  />
                ))}

                {shownRooms.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", borderRadius: 20, padding: 32, textAlign: "center", fontSize: 13, color: "#8a96a3", background: "rgba(69,96,113,0.04)", border: "1px dashed rgba(69,96,113,0.18)" }}>
                    No rooms yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <section style={{ background: "white", borderRadius: 20, padding: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", borderTop: "3px solid #456071" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 12, margin: "0 0 12px" }}>
                Private Pomodoro
              </p>
              <PomoWidget />
            </section>

            <section style={{ background: "white", borderRadius: 20, padding: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", borderTop: "3px solid #82977e" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", margin: "0 0 12px" }}>
                Quick Study Plan
              </p>
              <TaskListWidget />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Room SVGs for default rooms
const ROOM_SVGS = [
  // Room 1 — solo focus
  <svg key="r1" width="44" height="34" viewBox="0 0 64 48" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}>
    <rect x="6" y="30" width="52" height="5" rx="2.5" fill="#d6e5e3"/>
    <rect x="20" y="18" width="24" height="16" rx="3" fill="#456071" opacity="0.9"/>
    <rect x="22" y="20" width="20" height="11" rx="2" fill="#7aa8c0"/>
    <rect x="24" y="22" width="11" height="1.5" rx="1" fill="rgba(255,255,255,0.55)"/>
    <rect x="50" y="12" width="3" height="18" rx="1.5" fill="#c4bbaf"/>
    <ellipse cx="51.5" cy="12" rx="6" ry="3.5" fill="#f5ead8" stroke="#c4bbaf" strokeWidth="1"/>
  </svg>,
  // Room 2 — group
  <svg key="r2" width="44" height="34" viewBox="0 0 64 48" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}>
    <ellipse cx="32" cy="30" rx="18" ry="8" fill="#e5d1d0" stroke="#c4bbaf" strokeWidth="1"/>
    <rect x="8" y="24" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
    <rect x="46" y="24" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
    <rect x="27" y="12" width="10" height="7" rx="4" fill="#e39bb6" opacity="0.75"/>
  </svg>,
  // Room 3 — revision
  <svg key="r3" width="44" height="34" viewBox="0 0 64 48" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}>
    <rect x="36" y="6" width="24" height="34" rx="3" fill="#c4bbaf" opacity="0.35"/>
    <rect x="38" y="8" width="5" height="13" rx="1.5" fill="#e39bb6" opacity="0.85"/>
    <rect x="44" y="8" width="5" height="13" rx="1.5" fill="#82977e" opacity="0.85"/>
    <rect x="50" y="8" width="6" height="13" rx="1.5" fill="#456071" opacity="0.75"/>
    <rect x="36" y="22" width="24" height="1.5" fill="#8b7d6b" opacity="0.35"/>
  </svg>,
  // Room 4 — tutor / whiteboard
  <svg key="r4" width="44" height="34" viewBox="0 0 64 48" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }}>
    <rect x="6" y="4" width="52" height="26" rx="3" fill="#f8f9fa" stroke="#b8cad6" strokeWidth="1.2"/>
    <path d="M14 13 Q22 9 30 13" stroke="#456071" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <line x1="14" y1="17" x2="28" y2="17" stroke="#456071" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    <rect x="6" y="29" width="52" height="3" rx="1.5" fill="#c4bbaf"/>
  </svg>,
];

// Generic SVG for user-created rooms
const GENERIC_SVG = (
  <svg width="44" height="34" viewBox="0 0 64 48" fill="none" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>
    <rect x="10" y="8" width="32" height="26" rx="3" fill="#d6e5e3"/>
    <rect x="14" y="13" width="20" height="2" rx="1" fill="#456071" opacity="0.6"/>
    <rect x="14" y="18" width="14" height="2" rx="1" fill="#456071" opacity="0.4"/>
    <rect x="14" y="23" width="17" height="2" rx="1" fill="#456071" opacity="0.3"/>
  </svg>
);

function LobbyRoomCard({
  room,
  isDefault,
  roomIndex,
  onClick,
}: {
  room: Room & { _shownTitle?: string };
  isDefault: boolean;
  roomIndex: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const svg = isDefault && roomIndex < 4 ? ROOM_SVGS[roomIndex] : GENERIC_SVG;
  const occupancy = room.participantCount ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Join ${room._shownTitle}`}
      style={{
        background: "white",
        borderRadius: 20,
        padding: 16,
        border: "1px solid " + (hovered ? "rgba(69,96,113,0.18)" : "rgba(0,0,0,0.06)"),
        boxShadow: hovered ? "0 8px 24px rgba(69,96,113,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.22s",
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        display: "block",
        width: "100%",
        minHeight: 80,
      }}
    >
      {/* Accent bar */}
      <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: "0 3px 3px 0", background: "#456071" }} />
      {/* Illustrated SVG */}
      {svg}
      <div style={{ paddingLeft: 12, paddingRight: 56 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: hovered ? "#456071" : "#1d2428", marginBottom: 3, transition: "color 0.18s" }}>
          {room._shownTitle}
        </div>
        <div style={{ fontSize: 12, color: "#8a96a3" }}>
          {room.createdAt
            ? `Added ${room.createdAt.toDate().toLocaleDateString()}`
            : isDefault
            ? "Default room"
            : "Recent room"}
        </div>
        {occupancy > 0 ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#d4edcc", color: "#2d5a24", fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, marginTop: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#82977e", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            {occupancy} in room
          </div>
        ) : (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.04)", color: "#8a96a3", fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, marginTop: 6 }}>
            Empty
          </div>
        )}
      </div>
    </button>
  );
}
