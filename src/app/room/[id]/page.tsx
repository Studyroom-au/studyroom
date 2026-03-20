// src/app/room/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getIdToken, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import {
  doc,
  setDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

import SafeVideoArea from "@/components/SafeVideoArea";
import PomoWidget from "@/components/widgets/PomoWidget";
import ChatPanel from "@/components/ChatPanel";
import { useUserRole } from "@/hooks/useUserRole";
import RoomWhiteboard from "@/components/RoomWhiteboard";
import TutorSessionSidebar from "@/components/room/TutorSessionSidebar";
import RoomControls from "@/components/room/RoomControls";

async function touchRoomActivity(roomId: string) {
  try {
    const ref = doc(db, "rooms", roomId);
    await setDoc(
      ref,
      {
        lastActiveAt: serverTimestamp(),
        isActive: true,
      },
      { merge: true }
    );
  } catch {
    // ignore client-side failures; admin cleanup will still run
  }
}

async function updatePresence(roomId: string, delta: 1 | -1) {
  try {
    const ref = doc(db, "rooms", roomId);
    await setDoc(
      ref,
      {
        participantCount: increment(delta),
        lastActiveAt: serverTimestamp(),
        isActive: true,
      },
      { merge: true }
    );
  } catch {
    // soft-fail – presence is best-effort
  }
}

function RoomActivityTouch({ roomId }: { roomId: string }) {
  const room = useRoomContext();
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!room) return;

    if (room.state === ConnectionState.Connected && !joinedRef.current) {
      joinedRef.current = true;
      void touchRoomActivity(roomId);
      void updatePresence(roomId, 1);
    }

    return () => {
      if (joinedRef.current) {
        joinedRef.current = false;
        void updatePresence(roomId, -1);
      }
    };
  }, [room, roomId]);

  return null;
}

function RoomHeader({
  roomName,
  onBack,
  isTutor,
}: {
  roomName: string;
  onBack: () => void;
  isTutor: boolean;
}) {
  return (
    <header style={{
      background: "white",
      borderBottom: "1px solid rgba(0,0,0,0.07)",
      height: 52,
      padding: "0 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "rgba(69,96,113,0.08)",
          color: "#456071",
          border: "none",
          borderRadius: 8,
          padding: "5px 13px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Lobby
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#1d2428" }}>
        {roomName}
      </span>
      {isTutor && (
        <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#edf2f6", color: "#456071", marginLeft: 8 }}>
          Tutor view
        </span>
      )}
    </header>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomName = useMemo(() => {
    const raw = params?.id as string | undefined;
    return raw ? decodeURIComponent(raw) : "Room";
  }, [params]);

  const role = useUserRole();
  const isTutor = role === "tutor" || role === "admin";
  const canModerate = isTutor;

  const [authReady, setAuthReady] = useState<null | boolean>(null);
  const [url, setUrl] = useState<string>();
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  // Require sign-in & refresh token so rules/app-claims apply immediately
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthReady(false);
        router.replace("/");
        return;
      }
      try {
        await u.getIdToken(true);
      } catch {
        /* ignore token refresh errors; user is still authed */
      }
      setAuthReady(true);
    });
    return () => off();
  }, [router]);

  // Fetch LiveKit token once authed
  useEffect(() => {
    if (authReady !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await getIdToken(auth.currentUser!, true);
        const { data } = await axios.post("/api/livekitToken", {
          idToken,
          roomName,
        });
        if (!cancelled) {
          setUrl(data.url);
          setToken(data.token);
          void touchRoomActivity(roomName);
        }
      } catch (err) {
        const msg =
          (axios.isAxiosError(err) && (err.response?.data as string)) ||
          (err instanceof Error ? err.message : String(err));
        if (!cancelled) setError(msg || "Failed to get room token.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, roomName]);

  const handleBack = useCallback(() => {
    router.push("/lobby");
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => {
      (window as unknown as Record<string, unknown> & {
        alexBuddy?: { say: (key: string) => void };
      }).alexBuddy?.say("room_enter");
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (authReady === null) return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading room...</div>
    </div>
  );
  if (authReady === false) return <div className="p-4">Redirecting...</div>;
  if (!url || !token) return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: "#8a96a3" }}>Connecting to room...</div>
    </div>
  );

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio={true}
        connectOptions={{
          autoSubscribe: true,
        }}
        style={{ display: "flex", flexDirection: "column", flex: 1 }}
      >
        <RoomActivityTouch roomId={roomName} />
        <RoomHeader roomName={roomName} onBack={handleBack} isTutor={isTutor} />

        <div className="room-layout" style={{ display: "flex", flexDirection: "row", gap: 16, padding: 16, minHeight: "calc(100vh - 52px)" }}>

          {/* Left column — video + whiteboard */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0 }}>
            {/* Video card */}
            <div className="room-video-card" style={{ background: "#111827", borderRadius: 16, overflow: "hidden", minHeight: 340, position: "relative" }}>
              {/* Room badge top-left */}
              <div style={{ position: "absolute", top: 12, left: 14, zIndex: 1, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 20 }}>
                {roomName}
              </div>
              {/* Live indicator top-right */}
              <div style={{ position: "absolute", top: 12, right: 14, zIndex: 1, display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "sr-streak-glow 1.2s ease-in-out infinite" }} />
                Live
              </div>
              <SafeVideoArea />
            </div>

            {/* Controls bar */}
            <RoomControls onLeave={handleBack} />

            {/* Whiteboard card */}
            <div style={{ background: "white", borderRadius: 16, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#748398" }}>
                  Shared Whiteboard
                </span>
              </div>
              <RoomWhiteboard roomId={roomName} />
            </div>
          </div>

          {/* Right column — role-based */}
          <div className="room-sidebar" style={{ display: "flex", flexDirection: "column", width: 320, flexShrink: 0 }}>
            {isTutor
              ? <TutorSessionSidebar roomId={roomName} />
              : (
                <>
                  {/* Pomodoro card */}
                  <div style={{ background: "white", borderRadius: 20, padding: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Private Pomodoro</div>
                    <PomoWidget />
                  </div>
                  {/* Chat card */}
                  <div style={{ background: "white", borderRadius: 20, padding: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 12 }}>Room Chat</div>
                    <ChatPanel roomId={roomName} canModerate={canModerate} />
                  </div>
                </>
              )
            }
          </div>

        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
