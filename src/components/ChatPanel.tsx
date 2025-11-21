"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  FirestoreError,
  QueryDocumentSnapshot,
  DocumentData,
  limit,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, getIdToken } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const ATTACHMENTS_ENABLED = false; // keep false until Storage billing is enabled
const MAX_MESSAGE_CHARS = 2000;
const MAX_DOC_BYTES = 9000;
const PAGE_LIMIT = 200;

const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "bastard", "dick"];

type ChatMessage = {
  id: string;
  uid: string;
  email: string | null;
  text?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: Date | null;
};

function toDateSafe(v: unknown): Date | null {
  // @ts-expect-error tolerate Timestamp
  return v && typeof v.toDate === "function" ? v.toDate() : null;
}

function shortEmail(email: string | null): string {
  if (!email) return "Anonymous";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const n = name.length <= 2 ? name : `${name[0]}***${name.slice(-1)}`;
  return `${n}@${domain}`;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function escapeRegex(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsBannedTerm(text: string) {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some((term) =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(lower)
  );
}

async function touchRoom(roomId: string) {
  try {
    await updateDoc(doc(db, "rooms", roomId), {
      lastActiveAt: serverTimestamp(),
      isActive: true,
    });
  } catch {
    /* ignore client failures; backend cleanup will still run */
  }
}

function friendlyError(e: unknown) {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("permission")) return "You do not have permission to do that.";
  return (e as Error)?.message || "Something went wrong. Please try again.";
}

export default function ChatPanel({
  roomId,
  canModerate,
}: {
  roomId: string;
  canModerate: boolean;
}) {
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setAuthReady(false);
        return;
      }
      try {
        await getIdToken(u, true);
        setAuthReady(true);
      } catch {
        setAuthReady(false);
      }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!authReady || !roomId) return;
    setErr(null);

    const collRef = collection(db, "rooms", roomId, "chat");
    const qy = query(collRef, orderBy("createdAt", "asc"), limit(PAGE_LIMIT));

    const off = onSnapshot(
      qy,
      (snap) => {
        const rows: ChatMessage[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const data = d.data();
          rows.push({
            id: d.id,
            uid: String(data.uid || ""),
            email: (data.email as string | null) ?? null,
            text: (data.text as string | undefined) ?? undefined,
            fileUrl: (data.fileUrl as string | null) ?? null,
            fileName: (data.fileName as string | null) ?? null,
            createdAt: toDateSafe(data.createdAt),
          });
        });
        setMessages(rows);
        queueMicrotask(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        });
      },
      (e: FirestoreError) => setErr(e.message || "Failed to load chat")
    );

    return () => off();
  }, [authReady, roomId]);

  const canSend = useMemo(() => {
    const t = text.trim();
    return !!t; // attachments disabled for now
  }, [text]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const user = auth.currentUser;
    if (!user) {
      setErr("Please sign in to chat.");
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_MESSAGE_CHARS) {
      setErr(`Message is too long. Keep it under ${MAX_MESSAGE_CHARS} characters.`);
      return;
    }

    if (containsBannedTerm(trimmed)) {
      setErr("Please keep chat friendly.");
      return;
    }

    const approxBytes =
      byteLength(trimmed) + byteLength(user.uid) + byteLength(user.email || "");
    if (approxBytes > MAX_DOC_BYTES) {
      setErr("This message is too large. Try shortening the text.");
      return;
    }

    setSending(true);
    try {
      await getIdToken(user, true);

      const payload: Record<string, unknown> = {
        uid: user.uid,
        email: user.email ?? null,
        text: trimmed,
        createdAt: serverTimestamp(),
        fileUrl: null,
        fileName: null,
      };

      await addDoc(collection(db, "rooms", roomId, "chat"), payload);
      setText("");
      void touchRoom(roomId);
    } catch (eSend) {
      setErr(friendlyError(eSend));
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string, ownerId: string) {
    setErr(null);
    const user = auth.currentUser;
    if (!user) return;
    if (!canModerate && user.uid !== ownerId) return;

    try {
      await deleteDoc(doc(db, "rooms", roomId, "chat", id));
    } catch (eDel) {
      setErr(friendlyError(eDel));
    }
  }

  async function handleReport(message: ChatMessage) {
    const user = auth.currentUser;
    if (!user) {
      setErr("Please sign in to report.");
      return;
    }
    const reason = window.prompt("Optional reason (keep it brief):", "") ?? "";
    try {
      await addDoc(collection(db, "reports"), {
        roomId,
        messageId: message.id,
        reportedBy: user.uid,
        messageText: message.text ?? "",
        messageOwnerId: message.uid,
        reason: reason.trim() || null,
        createdAt: serverTimestamp(),
      });
    } catch (eReport) {
      setErr(friendlyError(eReport));
    }
  }

  function formatTime(d?: Date | null) {
    if (!d) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[color:var(--ring)] px-3 py-2">
        <div className="text-sm font-medium text-[color:var(--ink)]">Room Chat</div>
        <div className="text-xs text-[color:var(--muted)]">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </div>
      </div>

      {err && (
        <div className="mx-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-0.5 text-[13px] text-[color:var(--muted)]">
                <span className="font-medium text-[color:var(--ink)]">
                  {shortEmail(m.email)}
                </span>
                {m.createdAt && (
                  <span className="ml-2 text-[color:var(--muted)]/70">
                    {formatTime(m.createdAt)}
                  </span>
                )}
              </div>
              {m.text && (
                <p className="whitespace-pre-wrap break-words text-[color:var(--ink)]">
                  {m.text}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              {(canModerate || m.uid === auth.currentUser?.uid) && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id, m.uid)}
                  className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  title="Delete"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => handleReport(m)}
                className="rounded-md px-2 py-1 text-[10px] text-[color:var(--muted)] hover:bg-[color:var(--ring)]/40"
                title="Report message"
              >
                Report
              </button>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-[color:var(--ring)] p-6 text-center text-[color:var(--muted)]">
            No messages yet. Say hi :)
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex flex-wrap items-center gap-2 border-t border-[color:var(--ring)] p-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-[color:var(--ring)] bg-[color:var(--card)] px-3 py-2 text-sm"
          maxLength={MAX_MESSAGE_CHARS}
          autoComplete="off"
          inputMode="text"
        />
        <button
          type="submit"
          disabled={!canSend || sending}
          className="rounded-lg bg-[color:var(--brand)] px-3 py-2 text-sm font-medium text-[color:var(--brand-contrast)] shadow-sm transition enabled:hover:bg-[color:var(--brand-600)] disabled:opacity-50"
          title="Send message"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
