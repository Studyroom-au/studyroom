"use client";

import { useRouter } from "next/navigation";

export default function StudyroomsWidget() {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">
        Jump back into a room or browse rooms in the lobby.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          onClick={() => router.push("/lobby")}
        >
          Open Lobby
        </button>
        <button
          className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
          onClick={() => router.push("/room/Room%201")}
        >
          Join “Room 1”
        </button>
        {/* Add more shortcuts if you like */}
      </div>
    </div>
  );
}
