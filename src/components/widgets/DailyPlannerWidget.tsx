"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type UpcomingItem = {
  id: string;
  subject: string;
  title: string;
  dueDate: string; // stored as "YYYY-MM-DD"
  handoutDate?: string | null;
  draftDate?: string | null;
  status: string;
  notes: string;
  completed: boolean;
};

// Helpers
function parseDue(dueDate: string): Date | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPrettyDue(due: Date | null): string {
  if (!due) return "No due date";
  return due.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

function describeDistance(due: Date | null): string {
  if (!due) return "";
  const today = new Date();
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueMid.getTime() - todayMid.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "In 1 day";
  if (diffDays > 1) return `In ${diffDays} days`;
  if (diffDays === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(diffDays)} days`;
}

export default function DailyPlannerWidget() {
  const [authReady, setAuthReady] = useState(false);
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    subject: "",
    title: "",
    dueDate: "",
    handoutDate: "",
    draftDate: "",
    status: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await u.getIdToken(true);
        } catch {
          // ignore
        }
        setAuthReady(true);
      } else {
        setAuthReady(false);
        setItems([]);
      }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const u = auth.currentUser;
    if (!u) return;

    const q = query(
      collection(db, "users", u.uid, "upcoming"),
      orderBy("dueDate", "asc")
    );
    const off = onSnapshot(
      q,
      (snap) => {
        const list: UpcomingItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            subject: String(data.subject || ""),
            title: String(data.title || ""),
            dueDate: String(data.dueDate || ""),
            handoutDate: data.handoutDate ? String(data.handoutDate) : null,
            draftDate: data.draftDate ? String(data.draftDate) : null,
            status: String(data.status || ""),
            notes: String(data.notes || ""),
            completed: Boolean(data.completed),
          });
        });
        setItems(list);
      },
      (e) => setErr(e.message || "Failed to load items")
    );
    return () => off();
  }, [authReady]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const u = auth.currentUser;
    if (!u) {
      setErr("Please sign in to save upcoming work.");
      return;
    }
    const { subject, title, dueDate, handoutDate, draftDate, status, notes } = newItem;
    if (!subject || !title || !dueDate) {
      setErr("Please fill in subject, what it is, and the due date.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "users", u.uid, "upcoming"), {
        subject: subject.trim(),
        title: title.trim(),
        dueDate,
        handoutDate: handoutDate || null,
        draftDate: draftDate || null,
        status: status.trim(),
        notes: notes.trim(),
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewItem({
        subject: "",
        title: "",
        dueDate: "",
        handoutDate: "",
        draftDate: "",
        status: "",
        notes: "",
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(id: string, value: boolean) {
    const u = auth.currentUser;
    if (!u) return;
    await updateDoc(doc(db, "users", u.uid, "upcoming", id), {
      completed: value,
    });
  }

  async function removeItem(id: string) {
    const u = auth.currentUser;
    if (!u) return;
    await deleteDoc(doc(db, "users", u.uid, "upcoming", id));
  }

  const upcoming = useMemo(() => items.slice(0, 12), [items]);

  const inputStyle: React.CSSProperties = { border: "1px solid #e4eaef", borderRadius: 10, padding: "7px 10px", fontSize: 12, background: "white", outline: "none", width: "100%", boxSizing: "border-box", color: "var(--sr-ink)", fontFamily: "inherit" };

  // Simple skeleton while auth is wiring up
  if (!authReady) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 32, width: "100%", borderRadius: 10, background: "rgba(0,0,0,0.06)" }} />
        <div style={{ height: 64, width: "100%", borderRadius: 10, background: "rgba(0,0,0,0.06)" }} />
      </div>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && (
        <div style={{ borderRadius: 12, border: "1px solid #fcd34d", background: "#fffbeb", padding: "6px 10px", fontSize: 11, color: "#92400e" }}>
          {err}
        </div>
      )}

      {/* Add new item */}
      <form
        onSubmit={addItem}
        style={{ background: "rgba(0,0,0,0.02)", borderRadius: 14, border: "1px solid #e4eaef", padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
      >
        <input
          type="text"
          placeholder="Subject (e.g. Maths)"
          value={newItem.subject}
          onChange={(e) => setNewItem((x) => ({ ...x, subject: e.target.value }))}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="What is it? (e.g. Algebra test)"
          value={newItem.title}
          onChange={(e) => setNewItem((x) => ({ ...x, title: e.target.value }))}
          style={inputStyle}
        />
        <input
          type="date"
          title="Due date"
          aria-label="Due date"
          value={newItem.dueDate}
          onChange={(e) => setNewItem((x) => ({ ...x, dueDate: e.target.value }))}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Status (e.g. not started)"
          value={newItem.status}
          onChange={(e) => setNewItem((x) => ({ ...x, status: e.target.value }))}
          style={inputStyle}
        />
        {/* Optional handout + draft dates */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 10, color: "#8a96a3" }}>Handout date (optional)</span>
          <input
            type="date"
            title="Handout date (optional)"
            aria-label="Handout date (optional)"
            value={newItem.handoutDate}
            onChange={(e) => setNewItem((x) => ({ ...x, handoutDate: e.target.value }))}
            style={{ ...inputStyle, opacity: 0.8 }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 10, color: "#8a96a3" }}>Draft due (optional)</span>
          <input
            type="date"
            title="Draft due date (optional)"
            aria-label="Draft due date (optional)"
            value={newItem.draftDate}
            onChange={(e) => setNewItem((x) => ({ ...x, draftDate: e.target.value }))}
            style={{ ...inputStyle, opacity: 0.8 }}
          />
        </div>
        <input
          type="text"
          placeholder="Notes (optional)"
          value={newItem.notes}
          onChange={(e) => setNewItem((x) => ({ ...x, notes: e.target.value }))}
          style={{ ...inputStyle, gridColumn: "span 2" }}
        />
        <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: "#456071", color: "white", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Adding\u2026" : "Add to upcoming"}
          </button>
        </div>
      </form>

      {/* List */}
      <ul style={{ display: "flex", flexDirection: "column", gap: 0, listStyle: "none", margin: 0, padding: 0 }}>
        {upcoming.map((item) => {
          const dueDateObj = parseDue(item.dueDate);
          const dueLabel = formatPrettyDue(dueDateObj);
          const distance = describeDistance(dueDateObj);
          // Urgency tier
          const today = new Date();
          const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const diffDays = dueDateObj
            ? Math.round((new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate()).getTime() - todayMid.getTime()) / 86400000)
            : 999;

          let borderColor = "#b0c8d8";
          let bg = "#f3f7f9";
          let badgeBg = "#d4e8f0";
          let badgeColor = "#1a3a4a";

          if (item.completed) {
            borderColor = "#82977e"; bg = "#f4faf0"; badgeBg = "#d4edcc"; badgeColor = "#2d5a24";
          } else if (diffDays < 0) {
            borderColor = "#e39bb6"; bg = "#fdf2f4"; badgeBg = "#fce4eb"; badgeColor = "#9a2040";
          } else if (diffDays === 0) {
            borderColor = "#d4a017"; bg = "#fffbf0"; badgeBg = "#fef3c7"; badgeColor = "#7a4d10";
          } else if (diffDays <= 3) {
            borderColor = "#e39bb6"; bg = "#fdf2f4"; badgeBg = "#fce4eb"; badgeColor = "#9a2040";
          } else if (diffDays <= 14) {
            borderColor = "#d4b896"; bg = "#fdf8f3"; badgeBg = "#f5e8d4"; badgeColor = "#7a4d20";
          }

          return (
            <li
              key={item.id}
              style={{ display: "flex", justifyContent: "space-between", padding: "8px 11px", borderRadius: 12, marginBottom: 6, borderLeft: `3px solid ${borderColor}`, background: bg, opacity: item.completed ? 0.75 : 1 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sr-ink)" }}>
                  {item.subject || "No subject"} — {item.title || "Untitled"}
                </div>
                <div style={{ fontSize: 10, color: "var(--sr-muted)", marginTop: 1 }}>
                  {item.status && <span>{item.status}</span>}
                  {item.status && item.notes && <span> \u00B7 </span>}
                  {item.notes && <span>{item.notes}</span>}
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--sr-muted)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => toggleComplete(item.id, e.target.checked)}
                      style={{ width: 12, height: 12 }}
                    />
                    Mark as done
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    style={{ border: "1px solid #e4eaef", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#dc2626", background: "white", cursor: "pointer" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#fee2e2")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "white")}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--sr-ink)", marginBottom: 4 }}>{dueLabel}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: badgeBg, color: badgeColor, display: "inline-block" }}>
                  {item.completed ? "Done" : distance}
                </span>
              </div>
            </li>
          );
        })}

        {upcoming.length === 0 && (
          <li style={{ border: "1.5px dashed #e4eaef", borderRadius: 12, padding: "16px", textAlign: "center", fontSize: 11, color: "var(--sr-muted)" }}>
            No upcoming assessments yet. Add your next due date above.
          </li>
        )}
      </ul>
    </section>
  );
}
