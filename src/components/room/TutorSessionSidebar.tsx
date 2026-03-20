"use client";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 16,
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  marginBottom: 12,
};

const MOOD_META: Record<string, { bg: string; emoji: string }> = {
  great:    { bg: "#bde4af", emoji: "😄" },
  good:     { bg: "#d6e5e3", emoji: "😊" },
  ok:       { bg: "#eaeaea", emoji: "😐" },
  tired:    { bg: "#e5d1d0", emoji: "😴" },
  stressed: { bg: "#f0e4d0", emoji: "😬" },
};

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getUrgency(dueDate: string) {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(dueDate);
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueMid.getTime() - todayMid.getTime()) / 86400000);
  if (diff < 0) return { borderColor: "#e39bb6", bg: "#fdf2f4", badgeBg: "#fce4eb", badgeColor: "#9a2040", label: `${Math.abs(diff)}d overdue` };
  if (diff === 0) return { borderColor: "#d4a017", bg: "#fffbf0", badgeBg: "#fef3c7", badgeColor: "#7a4d10", label: "Today" };
  if (diff <= 3) return { borderColor: "#e39bb6", bg: "#fdf2f4", badgeBg: "#fce4eb", badgeColor: "#9a2040", label: `${diff}d` };
  if (diff <= 14) return { borderColor: "#d4b896", bg: "#fdf8f3", badgeBg: "#f5e8d4", badgeColor: "#7a4d20", label: `In ${diff}d` };
  return { borderColor: "#b0c8d8", bg: "#f3f7f9", badgeBg: "#d4e8f0", badgeColor: "#1a3a4a", label: `In ${diff}d` };
}

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

type ChatMsg = { id: string; uid: string; name: string; text: string; createdAt: number };

export default function TutorSessionSidebar({ roomId }: { roomId: string }) {
  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<"session" | "chat">("session");

  // --- Chat ---
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    const unsub = onSnapshot(q, snap => {
      const msgs: ChatMsg[] = [];
      snap.forEach(d => {
        const data = d.data();
        msgs.push({
          id: d.id,
          uid: String(data.uid || ""),
          name: String(data.name || ""),
          text: String(data.text || ""),
          createdAt: data.createdAt?.toMillis?.() ?? 0,
        });
      });
      setChatMsgs(msgs);
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || sending) return;
    const u = auth.currentUser;
    if (!u) return;
    setSending(true);
    try {
      await addDoc(collection(db, "rooms", roomId, "chat"), {
        uid: u.uid,
        name: u.displayName || "Tutor",
        text,
        createdAt: serverTimestamp(),
      });
      setChatInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  // --- Panel 1: Session timer ---
  const [elapsed, setElapsed] = useState(0);
  const [sessionStart] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Panel 2: Session notes ---
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    getDoc(doc(db, "tutors", u.uid, "sessionNotes", roomId)).then(snap => {
      if (snap.exists()) setNotes(snap.data().notes || "");
    });
  }, [roomId]);

  function handleNotesChange(value: string) {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(value), 1200);
  }

  async function saveNotes(value: string) {
    const u = auth.currentUser;
    if (!u) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "tutors", u.uid, "sessionNotes", roomId),
        { notes: value, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // --- Panel 3: Student selector ---
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<Array<{ uid: string; name: string }>>([]);
  const [studentUid, setStudentUid] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleStudentSearch(value: string) {
    setStudentQuery(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!value.trim()) { setStudentResults([]); setShowDropdown(false); return; }
    searchDebounce.current = setTimeout(async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("displayName", ">=", value),
          where("displayName", "<=", value + "\uf8ff"),
          limit(5)
        );
        const snap = await getDocs(q);
        const results: Array<{ uid: string; name: string }> = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.displayName) results.push({ uid: d.id, name: String(data.displayName) });
        });
        setStudentResults(results);
        setShowDropdown(results.length > 0);
      } catch (e) {
        console.error(e);
      }
    }, 300);
  }

  function selectStudent(uid: string, name: string) {
    setStudentUid(uid);
    setStudentName(name);
    setStudentQuery("");
    setShowDropdown(false);
    setStudentResults([]);
  }

  function clearStudent() {
    setStudentUid(null);
    setStudentName(null);
  }

  // --- Panel 4: Student deadlines ---
  const [deadlines, setDeadlines] = useState<Array<{
    id: string; subject: string; title: string; dueDate: string;
  }>>([]);

  useEffect(() => {
    if (!studentUid) { setDeadlines([]); return; }
    const q = query(
      collection(db, "users", studentUid, "upcoming"),
      where("completed", "==", false),
      orderBy("dueDate", "asc"),
      limit(5)
    );
    const unsub = onSnapshot(q, snap => {
      const list: typeof deadlines = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, subject: String(data.subject || ""), title: String(data.title || ""), dueDate: String(data.dueDate || "") });
      });
      setDeadlines(list);
    });
    return () => unsub();
  }, [studentUid]);

  // --- Panel 5: Student mood ---
  const [moodLogs, setMoodLogs] = useState<Array<{ date: string; mood: string }>>([]);

  useEffect(() => {
    if (!studentUid) { setMoodLogs([]); return; }
    const q = query(
      collection(db, "users", studentUid, "moodLogs"),
      orderBy("date", "desc"),
      limit(7)
    );
    const unsub = onSnapshot(q, snap => {
      const list: typeof moodLogs = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ date: String(data.date || ""), mood: String(data.mood || "") });
      });
      setMoodLogs(list);
    });
    return () => unsub();
  }, [studentUid]);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const logMap = new Map(moodLogs.map(l => [l.date, l.mood]));

  // --- Panel 6: Task assignment ---
  const [taskInput, setTaskInput] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignedOk, setAssignedOk] = useState(false);

  async function assignTask() {
    if (!studentUid || !taskInput.trim()) return;
    setAssigning(true);
    try {
      await addDoc(collection(db, "users", studentUid, "tasks"), {
        title: taskInput.trim(),
        done: false,
        assignedBy: auth.currentUser?.uid,
        assignedByName: auth.currentUser?.displayName || "Your tutor",
        createdAt: serverTimestamp(),
        source: "tutor_assigned",
      });
      setTaskInput("");
      setAssignedOk(true);
      setTimeout(() => setAssignedOk(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  }

  const tutorUid = auth.currentUser?.uid ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: 4 }}>
        {(["session", "chat"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "6px 0", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              background: activeTab === tab ? "white" : "transparent",
              color: activeTab === tab ? "#1d2428" : "#748398",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            {tab === "session" ? "Session" : "Chat"}
          </button>
        ))}
      </div>

      {/* Chat panel */}
      {activeTab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{
            flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
            minHeight: 240, maxHeight: 400, padding: "4px 2px", marginBottom: 8,
          }}>
            {chatMsgs.length === 0 && (
              <div style={{ textAlign: "center", fontSize: 11, color: "#8a96a3", padding: "24px 0" }}>
                No messages yet. Start the conversation!
              </div>
            )}
            {chatMsgs.map(msg => {
              const isMine = msg.uid === tutorUid;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%", padding: "7px 11px", borderRadius: 14,
                    background: isMine ? "#456071" : "white",
                    color: isMine ? "white" : "#1d2428",
                    border: isMine ? "none" : "1px solid rgba(0,0,0,0.07)",
                    fontSize: 12, lineHeight: 1.5,
                    borderBottomRightRadius: isMine ? 4 : 14,
                    borderBottomLeftRadius: isMine ? 14 : 4,
                  }}>
                    {!isMine && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#748398", marginBottom: 2 }}>{msg.name}</div>
                    )}
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChatMessage()}
              placeholder="Message..."
              style={{
                flex: 1, border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10,
                padding: "8px 12px", fontSize: 12, fontFamily: "inherit",
                color: "#1d2428", outline: "none", background: "white",
              }}
              onFocus={e => (e.target.style.borderColor = "#456071")}
              onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.09)")}
            />
            <button
              type="button"
              onClick={sendChatMessage}
              disabled={sending || !chatInput.trim()}
              style={{
                background: "#456071", color: "white", border: "none", borderRadius: 10,
                padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit", opacity: sending || !chatInput.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === "session" && <>

      {/* Panel 1 — Session timer */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398" }}>
            Session
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>
            {formatElapsed(elapsed)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#8a96a3" }}>
          Started at {sessionStart.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}
        </div>
      </div>

      {/* Panel 2 — Session notes */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 8 }}>Session notes</div>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Type session notes here — only you can see these..."
          style={{
            width: "100%", minHeight: 110, resize: "vertical",
            border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "10px 12px",
            fontSize: 12, lineHeight: 1.6, fontFamily: "inherit", color: "#1d2428",
            outline: "none", background: "#fafbfc", boxSizing: "border-box",
          }}
          onFocus={e => { e.target.style.borderColor = "#456071"; e.target.style.background = "white"; }}
          onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.09)"; e.target.style.background = "#fafbfc"; }}
        />
        <div style={{ fontSize: 10, color: saved ? "#2d5a24" : "#8a96a3", textAlign: "right", marginTop: 4, minHeight: 14 }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : ""}
        </div>
      </div>

      {/* Panel 3 — Student selector */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 8 }}>Student</div>
        {studentUid ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0f5ee", borderRadius: 9, padding: "8px 11px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1d2428" }}>{studentName}</span>
            <button type="button" onClick={clearStudent} style={{ fontSize: 10, color: "#8a96a3", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              ✕ Clear
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={studentQuery}
              onChange={e => handleStudentSearch(e.target.value)}
              placeholder="Search student by name..."
              style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10, padding: "7px 11px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none", boxSizing: "border-box" }}
              onFocus={e => (e.target.style.borderColor = "#456071")}
              onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.09)"; setTimeout(() => setShowDropdown(false), 150); }}
            />
            {showDropdown && studentResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20, overflow: "hidden", marginTop: 2 }}>
                {studentResults.map(r => (
                  <div
                    key={r.uid}
                    onMouseDown={() => selectStudent(r.uid, r.name)}
                    style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", color: "#1d2428", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                    onMouseOver={e => (e.currentTarget.style.background = "#f4f7f9")}
                    onMouseOut={e => (e.currentTarget.style.background = "white")}
                  >
                    {r.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel 4 — Student deadlines */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 10 }}>Upcoming</div>
        {!studentUid ? (
          <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: 16, textAlign: "center", fontSize: 11, color: "#8a96a3" }}>
            Select a student to see their deadlines.
          </div>
        ) : deadlines.length === 0 ? (
          <div style={{ fontSize: 11, color: "#8a96a3", textAlign: "center", padding: "12px 0" }}>No upcoming deadlines.</div>
        ) : (
          deadlines.map(item => {
            const u = getUrgency(item.dueDate);
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 11, borderLeft: `3px solid ${u.borderColor}`, background: u.bg, marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2428" }}>{item.subject}</div>
                  <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 1 }}>{item.title}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: u.badgeBg, color: u.badgeColor, whiteSpace: "nowrap" }}>
                  {u.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Panel 5 — Student mood (last 7 days) */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 10 }}>Mood — last 7 days</div>
        {!studentUid ? (
          <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: 16, textAlign: "center", fontSize: 11, color: "#8a96a3" }}>
            Select a student to see their mood.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            {last7.map(d => {
              const key = formatDateKey(d);
              const mood = logMap.get(key);
              const meta = mood ? MOOD_META[mood] : null;
              const dayLabel = d.toLocaleDateString("en-AU", { weekday: "short" }).slice(0, 3);
              return (
                <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: meta ? meta.bg : "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
                    {meta ? meta.emoji : ""}
                  </div>
                  <span style={{ fontSize: 9, color: "#8a96a3" }}>{dayLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Panel 6 — Assign a task */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 8 }}>Assign a task</div>
        <div style={{ display: "flex", gap: 8, opacity: studentUid ? 1 : 0.4, pointerEvents: studentUid ? "auto" : "none" }}>
          <input
            type="text"
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && assignTask()}
            placeholder={studentUid ? "e.g. Practise Chapter 3 questions..." : "Select a student first"}
            style={{ flex: 1, border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none" }}
            onFocus={e => (e.target.style.borderColor = "#456071")}
            onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.09)")}
          />
          <button
            type="button"
            onClick={assignTask}
            disabled={assigning || !studentUid || !taskInput.trim()}
            style={{ background: "#456071", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: assigning ? 0.6 : 1 }}
          >
            Assign
          </button>
        </div>
        {assignedOk && (
          <div style={{ fontSize: 11, color: "#2d5a24", marginTop: 6 }}>Task assigned ✓</div>
        )}
      </div>

      </>}

    </div>
  );
}
