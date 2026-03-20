// src/components/SafeVideoArea.tsx
"use client";

import { useMemo, useState } from "react";
import {
  ParticipantTile,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export default function SafeVideoArea() {
  const room = useRoomContext();

  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera]);

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

  return (
    <div className="flex h-[min(65vh,640px)] flex-col">
      {/* MAIN DISPLAY */}
      <div className="min-h-0 flex-1 rounded-xl bg-slate-900 p-2">
        {mains.length > 0 ? (
          <button
            type="button"
            onClick={() => setMainId(null)}
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-black"
            title="Click to unpin"
          >
            <ParticipantTile
              trackRef={mains[0].ref}
              className="h-full w-full object-contain"
            />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
              {mains[0].isScreen ? "Screen Share" : "Camera"}
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 text-center">
            <div className="text-sm text-slate-200">No video yet</div>
            <div className="text-xs text-slate-400">
              Turn on your camera, microphone, or start a screen share. If the
              camera still doesn’t start, check browser and system permissions.
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
              type="button"
              className="relative h-24 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm hover:border-slate-400"
              onClick={() => setMainId(t.id)}
              title="Make main"
            >
              <ParticipantTile
                trackRef={t.ref}
                className="h-full w-full object-contain"
              />
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                {t.isScreen ? "Screen" : "Camera"}
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
