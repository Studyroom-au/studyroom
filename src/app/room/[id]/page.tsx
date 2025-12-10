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
}: {
  roomName: string;
  onBack: () => void;
}) {
  return (
    <header className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-2 shadow-sm">
      {/* Left side: back button + room label */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--ink)]/80 hover:bg-slate-50"
        >
          Lobby
        </button>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Studyroom
          </span>
          <span className="text-sm font-semibold text-[color:var(--ink)]">
            Room: {roomName}
          </span>
        </div>
      </div>
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
  const canModerate = role === "tutor" || role === "admin";

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

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (authReady === null) return <div className="p-4">Checking sign-in...</div>;
  if (authReady === false) return <div className="p-4">Redirecting...</div>;
  if (!url || !token) return <div className="p-4">Connecting to room...</div>;

  return (
    <div className="app-bg min-h-[100svh] px-3 py-3">
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        className="flex-1"
        audio={true}
        connectOptions={{
          autoSubscribe: true,
        }}
      >
        <RoomActivityTouch roomId={roomName} />
        <RoomHeader roomName={roomName} onBack={handleBack} />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          {/* VIDEO + CONTROLS */}
          <section className="min-h-0 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
            <SafeVideoArea />
          </section>

          {/* SIDE WIDGETS */}
          <aside className="flex min-h-0 flex-col gap-3">
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
              <PomoWidget />
            </section>
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
              <ChatPanel roomId={roomName} canModerate={canModerate} />
            </section>
          </aside>
        </div>

        {/* WHITEBOARD BELOW – scroll if needed */}
        <div className="mt-3 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
          <RoomWhiteboard roomId={roomName} />
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
