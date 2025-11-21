"use client";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export default function ConnectionChip() {
  const room = useRoomContext();
  const state = room?.state ?? "disconnected";

  const label =
    state === ConnectionState.Connected
      ? "Connected"
      : state === ConnectionState.Connecting
      ? "Connecting…"
      : state === ConnectionState.Reconnecting
      ? "Reconnecting…"
      : "Disconnected";

  const tone =
    state === ConnectionState.Connected
      ? "bg-green-100 text-green-800 ring-green-200"
      : state === ConnectionState.Reconnecting
      ? "bg-yellow-100 text-yellow-900 ring-yellow-200"
      : state === ConnectionState.Connecting
      ? "bg-blue-100 text-blue-900 ring-blue-200"
      : "bg-red-100 text-red-800 ring-red-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${tone}`}>
      {label}
    </span>
  );
}
