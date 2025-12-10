"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

type RoomCard = {
  id: string;
  name: string;
  participantCount?: number;
};

const DEFAULT_ROOMS: RoomCard[] = [
  { id: "room-1", name: "Room 1" },
  { id: "room-2", name: "Room 2" },
  { id: "room-3", name: "Room 3" },
  { id: "room-4", name: "Room 4" },
];

export default function StudyroomsShelf() {
  const [dynamicRooms, setDynamicRooms] = useState<RoomCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const qy = query(collection(db, "rooms"));
        const snap = await getDocs(qy);
        const list: RoomCard[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const id = d.id;
          const name = (data.title as string | undefined) ?? id;
          const participantCount =
            typeof data.participantCount === "number"
              ? data.participantCount
              : 0;
          list.push({ id, name, participantCount });
        });
        setDynamicRooms(list);
      } catch {
        setDynamicRooms([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleRooms = useMemo(() => {
    const byId = new Map<string, RoomCard>();
    DEFAULT_ROOMS.forEach((r) => byId.set(r.id, r));

    dynamicRooms.forEach((r) => {
      const existing = byId.get(r.id);
      if (existing) {
        byId.set(r.id, {
          ...existing,
          name: r.name || existing.name,
          participantCount: r.participantCount ?? existing.participantCount,
        });
      } else {
        byId.set(r.id, r);
      }
    });

    return Array.from(byId.values());
  }, [dynamicRooms]);

  return (
    <section className="kid-shelf">
      <div className="kid-shelf-title">
        <span className="kid-shelf-emoji">🏫</span>
        Studyrooms
      </div>

      <div className="kid-room-grid">
        {visibleRooms.map((room) => {
          const count = room.participantCount ?? 0;
          const active = count > 0;
          return (
            <article key={room.id} className="kid-room-card">
              <div className="kid-room-name">{room.name}</div>
              <div className="kid-room-meta">
                {active ? `Active • ${count} here` : "Quiet"}
              </div>
              <Link href={`/room/${encodeURIComponent(room.id)}`} className="kid-room-cta">
                Join Room
              </Link>
            </article>
          );
        })}

        {/* Create-your-own card */}
        <article className="kid-room-card">
          <div className="kid-room-name">Create a room</div>
          <div className="kid-room-meta">Name your own studyroom</div>
          <Link href="/lobby?create=1" className="kid-room-cta">
            New Room
          </Link>
        </article>
      </div>

      {loading && <div className="kid-room-meta mt-2">Loading rooms…</div>}
    </section>
  );
}
