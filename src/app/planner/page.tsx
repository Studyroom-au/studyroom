"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import GanttWidget, { type UpcomingItem } from "@/components/widgets/GanttWidget";
import PlannerForm from "@/components/PlannerForm";

export default function PlannerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);

  useEffect(() => {
    let innerUnsub: (() => void) | null = null;
    const off = onAuthStateChanged(auth, (u) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      if (!u) { router.replace("/"); return; }
      setAuthed(true);
      const q = query(collection(db, "users", u.uid, "upcoming"), orderBy("dueDate", "asc"));
      innerUnsub = onSnapshot(q, (snap) => {
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
            draftCompleted: Boolean(data.draftCompleted),
            completed: Boolean(data.completed),
            status: data.status ? String(data.status) : null,
          });
        });
        setUpcomingItems(list);
      });
    });
    return () => { off(); if (innerUnsub) innerUnsub(); };
  }, [router]);

  if (!authed) {
    return (
      <div style={{ background: "#f0f2f5", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "#8a96a3" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "24px 20px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Page header */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => router.push("/hub")}
            style={{ background: "rgba(69,96,113,0.08)", color: "#456071", border: "none", borderRadius: 8, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            ← Hub
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398" }}>
              Term Planner
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
              Your Timeline
            </div>
          </div>
        </div>

        {/* Gantt chart */}
        <div style={{ background: "white", borderRadius: 20, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", marginBottom: 16, overflowX: "auto" }}>
          <GanttWidget items={upcomingItems} />
        </div>

        {/* Add to planner form */}
        <div style={{ background: "white", borderRadius: 20, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 14 }}>Add to planner</div>
          <PlannerForm />
        </div>

      </div>
    </div>
  );
}
