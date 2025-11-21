"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getIdToken, onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import SafeVideoArea from "@/components/SafeVideoArea";
import PomoWidget from "@/components/widgets/PomoWidget";
import ChatPanel from "@/components/ChatPanel";
import ConnectionChip from "@/components/ConnectionChip";
import { useUserRole } from "@/hooks/useUserRole";

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

function RoomActivityTouch({ roomId }: { roomId: string }) {
  const room = useRoomContext();
  useEffect(() => {
    if (room?.state === ConnectionState.Connected) {
      void touchRoomActivity(roomId);
    }
  }, [room?.state, roomId]);
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
    <header className="flex items-center justify-between rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-1.5 text-sm text-[color:var(--ink)] hover:bg-white"
          title="Back to Lobby"
        >
          Lobby
        </button>
        <div className="leading-tight">
          <div className="text-base font-semibold text-[color:var(--ink)]">
            Studyroom
          </div>
          <div className="text-xs text-[color:var(--muted)]">Room: {roomName}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-[color:var(--ring)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
          Friendly Mode
        </span>
        <ConnectionChip />
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
        const { data } = await axios.post("/api/livekitToken", { idToken, roomName });
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

        <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[1fr_340px]">
          <section className="min-h-0 overflow-hidden rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
            <SafeVideoArea />
          </section>

          <aside className="min-h-0 flex flex-col gap-3">
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
              <PomoWidget />
            </section>
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-3 shadow-sm">
              <ChatPanel roomId={roomName} canModerate={canModerate} />
            </section>
          </aside>
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
