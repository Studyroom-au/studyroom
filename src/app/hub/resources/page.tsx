"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Resource = {
  id: string;
  title: string;
  subject: string;
  type: "worksheet" | "past_paper" | "guide" | "flashcard" | "other";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  uploadedBy: string;
  uploadedAt: string;
  assignedTo?: string[];
};

const SUBJECT_COLORS: Record<string, string> = {
  Maths: "#edf2f6",
  English: "#f0f5ee",
  Chemistry: "#f0f4f8",
  Physics: "#fdf0f5",
  Japanese: "#fdf8f3",
  Biology: "#e8f4f8",
  Study: "#f4f2ef",
};

const TYPE_LABELS: Record<string, string> = {
  worksheet: "Worksheet",
  past_paper: "Past paper",
  guide: "Study guide",
  flashcard: "Flashcards",
  other: "Resource",
};

export default function ResourcesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      const q = query(
        collection(db, "resources"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Resource[];
      // Show if assignedTo is empty (available to all) OR includes this student's UID
      const visible = all.filter(
        (r) => !r.assignedTo || r.assignedTo.length === 0 || r.assignedTo.includes(u.uid)
      );
      setResources(visible);
      setLoading(false);
    });
    return () => off();
  }, [router]);

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{
        background: "#fff",
        borderRadius: "0 0 20px 20px",
        padding: "16px 20px 0",
        marginBottom: 16,
        border: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Studyroom
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em", marginBottom: 3 }}>
          Resources
        </div>
        <div style={{ fontSize: 13, color: "#8a96a3", marginBottom: 14 }}>
          Study materials assigned by your tutor.
        </div>
        <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 -20px" }} />
        <div style={{ padding: "10px 0" }}>
          <button
            type="button"
            onClick={() => router.push("/hub")}
            style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", background: "transparent", color: "#677a8a", fontFamily: "inherit" }}
          >
            ← Hub
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ fontSize: 13, color: "#8a96a3", padding: "40px 0", textAlign: "center" }}>
            Loading resources...
          </div>
        ) : resources.length === 0 ? (
          <div style={{
            background: "#fff", borderRadius: 18, padding: "48px 24px",
            border: "1.5px dashed #e4eaef", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1d2428", marginBottom: 6 }}>
              No resources yet
            </div>
            <div style={{ fontSize: 12, color: "#8a96a3" }}>
              Your tutor will share worksheets, past papers, and study guides here.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {resources.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  padding: "16px 18px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  cursor: r.fileUrl ? "pointer" : "default",
                  transition: "box-shadow 0.18s",
                }}
                onClick={() => r.fileUrl && window.open(r.fileUrl, "_blank")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{r.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                        {TYPE_LABELS[r.type] ?? "Resource"}
                      </div>
                      {r.fileSize && (
                        <div style={{ fontSize: 10, color: "#b0bec5" }}>
                          {(r.fileSize / 1024).toFixed(0)} KB
                        </div>
                      )}
                    </div>
                  </div>
                  {r.subject && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20,
                      background: SUBJECT_COLORS[r.subject] ?? "#edf0f3",
                      color: "#456071", flexShrink: 0, marginLeft: 8,
                    }}>
                      {r.subject}
                    </span>
                  )}
                </div>
                {r.fileUrl && (
                  <div style={{
                    fontSize: 11, color: "#456071", fontWeight: 600,
                    background: "rgba(69,96,113,0.07)", borderRadius: 8,
                    padding: "5px 10px", display: "inline-block",
                  }}>
                    Open →
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
