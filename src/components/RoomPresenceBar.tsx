"use client";

import { useRoomContext } from "@livekit/components-react";

export function RoomPresenceBar() {
  const room = useRoomContext();

  const localParticipant = room?.localParticipant ?? null;
  const remoteParticipants = room ? Array.from(room.remoteParticipants.values()) : [];

  const participants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  const count = participants.length;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs text-slate-100">
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      <span>
        {count === 0
          ? "No one in this room yet"
          : count === 1
          ? "1 person in this room"
          : `${count} people in this room`}
      </span>
    </div>
  );
}
