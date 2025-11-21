"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

type RoomCard = {
  id: string;
  name: string;
  active?: boolean;
  participants?: number;
};

const DEFAULT_ROOMS: RoomCard[] = [
  { id: "Room%201", name: "Room 1" },
  { id: "Room%202", name: "Room 2" },
  { id: "Room%203", name: "Room 3" },
  { id: "Room%204", name: "Room 4" },
];

export default function StudyroomsShelf() {
  const [dynamicRooms, setDynamicRooms] = useState<RoomCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch rooms (optional — will just show 1–4 if none)
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "rooms"));
        const snap = await getDocs(q);
        const list: RoomCard[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<RoomCard>;
          const name = data.name || d.id;
          const participants = Number(data.participants || 0);
          const active = Boolean(data.active || participants > 0);
          list.push({ id: encodeURIComponent(name), name, active, participants });
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
    const activeDyn = dynamicRooms.filter((r) => r.active);
    // Dedup against defaults by name
    const existing = new Set(DEFAULT_ROOMS.map((r) => r.name));
    const extras = activeDyn.filter((r) => !existing.has(r.name));
    return [...DEFAULT_ROOMS, ...extras];
  }, [dynamicRooms]);

  return (
    <section className="kid-shelf">
      <div className="kid-shelf-title">
        <span className="kid-shelf-emoji">🏫</span>
        Studyrooms
      </div>

      <div className="kid-room-grid">
        {visibleRooms.map((room) => (
          <article key={room.id} className="kid-room-card">
            <div className="kid-room-name">{room.name}</div>
            <div className="kid-room-meta">
              {room.active ? `Active • ${room.participants ?? 0} here` : "Quiet"}
            </div>
            <Link href={`/room/${room.id}`} className="kid-room-cta">
              Join Room
            </Link>
          </article>
        ))}

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
