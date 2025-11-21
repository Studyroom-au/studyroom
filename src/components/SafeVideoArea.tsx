"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ParticipantTile,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";

export default function SafeVideoArea() {
  const room = useRoomContext();
  const router = useRouter();
  const connected = room?.state === ConnectionState.Connected;

  // All camera + screenshare tracks (local + remote)
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera]);

  // Normalize items for layout/selection
  const items = useMemo(() => {
    return tracks.map((t) => {
      const source = t.publication?.source ?? t.source;
      const id =
        t.publication?.trackSid ||
        t.publication?.track?.sid ||
        `${t.participant.identity}-${source}`;
      return { id, ref: t, isScreen: source === Track.Source.ScreenShare };
    });
  }, [tracks]);

  // Default main: prefer a screenshare; otherwise a camera; otherwise none
  const defaultMainId = useMemo(() => {
    const screen = items.find((i) => i.isScreen)?.id;
    if (screen) return screen;
    const cam = items.find((i) => !i.isScreen)?.id;
    return cam || null;
  }, [items]);

  const [mainId, setMainId] = useState<string | null>(null);
  const effectiveMainId = mainId ?? defaultMainId;

  const mains = items.filter((i) => i.id === effectiveMainId);
  const thumbs = items.filter((i) => i.id !== effectiveMainId);

  const isIPhone =
    typeof navigator !== "undefined" &&
    /iPhone/i.test(navigator.userAgent || "");
  const canShareScreen =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    "getDisplayMedia" in navigator.mediaDevices &&
    !isIPhone;

  // Local track states
  const micEnabled = room?.localParticipant?.isMicrophoneEnabled ?? false;
  const camEnabled = room?.localParticipant?.isCameraEnabled ?? false;
  const screenEnabled = room?.localParticipant?.isScreenShareEnabled ?? false;

  // Toggle handlers (start/stop tracks)
  const toggleMic = useCallback(async () => {
    await room?.localParticipant?.setMicrophoneEnabled(!micEnabled);
  }, [room, micEnabled]);

  const toggleCam = useCallback(async () => {
    await room?.localParticipant?.setCameraEnabled(!camEnabled);
  }, [room, camEnabled]);

  const toggleScreen = useCallback(async () => {
    if (!canShareScreen) return;
    await room?.localParticipant?.setScreenShareEnabled(!screenEnabled);
  }, [room, screenEnabled, canShareScreen]);

  const leaveRoom = useCallback(async () => {
    try {
      await room?.disconnect(true);
    } finally {
      router.push("/lobby");
    }
  }, [room, router]);

  const baseBtn =
    "inline-flex items-center justify-center rounded-md border text-sm font-medium px-4 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed";

  const primaryOn =
    "bg-slate-900 text-white border-slate-900 hover:bg-black";
  const primaryOff =
    "bg-white text-slate-800 border-slate-300 hover:bg-slate-50";

  const dangerBtn =
    "bg-red-600 text-white border-red-600 hover:bg-red-700";

  return (
    <div className="flex h-full flex-col">
      {/* MAIN DISPLAY */}
      <div className="grid min-h-0 flex-1 gap-2 rounded-xl bg-slate-900 p-2">
        {mains.length > 0 ? (
          <button
            onClick={() => setMainId(null)} // click main to let defaults take over again
            className="relative h-full overflow-hidden rounded-lg border border-slate-800 bg-black"
            title="Click to unpin"
          >
            <ParticipantTile trackRef={mains[0].ref} className="h-full w-full" />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
              {mains[0].isScreen ? "Screen Share" : "Camera"}
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 text-center">
            <div className="text-sm text-slate-200">No video yet</div>
            <div className="text-xs text-slate-400">
              Turn on your microphone or camera, or start a screen share.
            </div>
          </div>
        )}
      </div>

      {/* THUMB STRIP */}
      {thumbs.length > 0 && (
        <div className="mt-2 grid grid-flow-col auto-cols-[140px] gap-2 overflow-x-auto pb-2">
          {thumbs.map((t) => (
            <button
              key={t.id}
              className="relative h-24 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm hover:border-slate-400"
              onClick={() => setMainId(t.id)}
              title="Make main"
            >
              <ParticipantTile trackRef={t.ref} className="h-full w-full" />
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                {t.isScreen ? "Screen" : "Camera"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* CONTROLS */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!connected}
          className={`${baseBtn} ${micEnabled ? primaryOn : primaryOff}`}
          aria-label="Toggle microphone"
        >
          {micEnabled ? "Mic: On" : "Mic: Off"}
        </button>

        <button
          type="button"
          onClick={toggleCam}
          disabled={!connected}
          className={`${baseBtn} ${camEnabled ? primaryOn : primaryOff}`}
          aria-label="Toggle camera"
        >
          {camEnabled ? "Camera: On" : "Camera: Off"}
        </button>

        <button
          type="button"
          onClick={toggleScreen}
          disabled={!connected || !canShareScreen}
          className={`${baseBtn} ${screenEnabled ? primaryOn : primaryOff}`}
          aria-label="Toggle screen share"
        >
          {screenEnabled ? "Stop Screen Share" : "Share Screen"}
        </button>

        <button
          type="button"
          onClick={leaveRoom}
          className={`${baseBtn} ${dangerBtn}`}
          aria-label="Leave room"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
