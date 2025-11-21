"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PomoWidget from "@/components/widgets/PomoWidget";
import TaskListWidget from "@/components/widgets/TaskListWidget";

type Room = {
  id: string;
  title?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  lastActiveAt?: Timestamp;
  isActive?: boolean;
  _shownTitle?: string;
};

const DEFAULT_ROOMS: Room[] = [
  { id: "room-1", title: "Room 1" },
  { id: "room-2", title: "Room 2" },
  { id: "room-3", title: "Room 3" },
  { id: "room-4", title: "Room 4" },
];

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const friendlyError = (msg: string) =>
  msg.includes("permission") ? "You do not have permission to do that." : msg;

export default function LobbyPage() {
  const router = useRouter();

  const [authed, setAuthed] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Require auth and refresh token (so rule changes apply)
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthed(false);
        router.replace("/");
        return;
      }
      try {
        await u.getIdToken(true);
      } catch {
        /* ignore token refresh fail */
      }
      setAuthed(true);
    });
    return () => off();
  }, [router]);

  // Subscribe to rooms when authed
  useEffect(() => {
    if (!authed) return;

    const q = query(collection(db, "rooms"), orderBy("createdAt", "desc"));
    const off = onSnapshot(
      q,
      (snap) => {
        const list: Room[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data() as Omit<Room, "id">;
          list.push({ id: d.id, ...data });
        });
        setRooms(list);
      },
      (e) => setError(friendlyError(e.message || "Failed to load rooms"))
    );
    return () => off();
  }, [authed]);

  const shownRooms = useMemo(() => {
    const now = Date.now();

    const activeNonDefault = rooms.filter((r) => {
      const isDefaultId = DEFAULT_ROOMS.some((d) => d.id === r.id);
      if (isDefaultId) return false;
      const ts = r.lastActiveAt?.toMillis?.();
      const recentlyActive =
        typeof ts === "number" && now - ts <= ACTIVE_WINDOW_MS;
      return recentlyActive || r.isActive === true;
    });

    const base = [...DEFAULT_ROOMS, ...activeNonDefault];
    return base.map((r) => ({
      ...r,
      _shownTitle: (r.title ?? "").trim() || r.id,
    }));
  }, [rooms]);

  async function createRoom() {
    setError(null);
    const title = newTitle.trim();
    if (!title) {
      setError("Please enter a room name.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Please sign in first.");
      return;
    }

    try {
      setCreating(true);

      const docRef = await addDoc(collection(db, "rooms"), {
        title,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        isActive: true,
      });

      router.push(`/room/${encodeURIComponent(docRef.id)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(friendlyError(msg || "Could not create room"));
    } finally {
      setCreating(false);
      setNewTitle("");
    }
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-block h-7 w-7 rounded-xl bg-[color:var(--brand)]"
            />
            <div>
              <h1 className="text-xl font-semibold leading-tight text-[color:var(--ink)]">
                Library Lobby
              </h1>
              <p className="text-sm text-[color:var(--muted)]">
                Join a quiet, focused room.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/hub")}
            className="rounded-xl border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--ink)]/80 shadow-sm transition hover:bg-white"
            title="Back to your Hub"
          >
            Back to Hub
          </button>
        </header>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-5">
            {/* Create Room */}
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm">
              <div className="mb-3">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                  Create a room
                </h2>
                <p className="mt-0.5 text-sm text-[color:var(--muted)]">
                  Give it a friendly name, e.g., &quot;Biology Revision&quot;.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  className="flex-1 rounded-xl border border-[color:var(--ring)] px-3 py-2 text-[color:var(--ink)] placeholder:text-[color:var(--muted)]/70"
                  placeholder="Room name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  aria-label="New room name"
                />
                <button
                  onClick={createRoom}
                  disabled={creating}
                  className="rounded-xl bg-[color:var(--brand)] px-4 py-2 font-medium text-[color:var(--brand-contrast)] shadow-sm transition hover:bg-[color:var(--brand-600)] disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create Room"}
                </button>
              </div>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Only active rooms appear below, plus four default rooms.
              </p>
            </section>

            {/* Rooms grid */}
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                  Studyrooms
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shownRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() =>
                      router.push(`/room/${encodeURIComponent(room.id)}`)
                    }
                    className="group h-40 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    title={`Join ${room._shownTitle}`}
                  >
                    <div className="flex h-full gap-4">
                      <div className="w-2 rounded-lg bg-[color:var(--brand)] transition group-hover:opacity-90" />
                      <div className="flex flex-1 flex-col">
                        <div className="mb-1 line-clamp-2 text-lg font-semibold text-[color:var(--ink)]">
                          {room._shownTitle}
                        </div>
                        <div className="text-xs text-[color:var(--muted)]">
                          {room.createdAt
                            ? `Added ${room.createdAt
                                .toDate()
                                .toLocaleDateString()}`
                            : ["room-1", "room-2", "room-3", "room-4"].includes(
                                room.id
                              )
                            ? "Default room"
                            : "Active now"}
                        </div>
                        <div className="mt-auto">
                          <span className="inline-flex items-center rounded-full border border-[color:var(--ring)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
                            Quiet
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {shownRooms.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-8 text-center text-[color:var(--muted)]">
                    No rooms yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN – widgets */}
          <aside className="flex min-h-0 flex-col gap-5">
            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
              <div className="mb-2 text-sm font-medium text-[color:var(--ink)]">
                Pomodoro
              </div>
              <PomoWidget />
            </section>

            <section className="rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
              <div className="mb-2 text-sm font-medium text-[color:var(--ink)]">
                Quick Study Plan
              </div>
              <TaskListWidget />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
