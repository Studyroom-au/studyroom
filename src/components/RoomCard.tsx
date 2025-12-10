import Link from "next/link";
import type { Timestamp } from "firebase/firestore";

export type LobbyRoom = {
  id: string;
  title: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
};

export function RoomCard({ room }: { room: LobbyRoom }) {
  return (
    <Link
      href={`/room/${room.id}`}
      className="flex flex-col gap-2 rounded-2xl bg-white/80 p-4 text-sm shadow-sm ring-1 ring-slate-200 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{room.title}</h2>
        {room.isActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            In session
          </span>
        )}
      </div>
      <p className="text-[13px] text-slate-500">
        Click to join this Studyroom.
      </p>
    </Link>
  );
}
