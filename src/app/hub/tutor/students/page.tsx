"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;

  clientId?: string | null;

  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;

  createdAt?: Timestamp;
};

type StudentRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  school?: string | null;

  clientId: string;

  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;

  createdAt?: Timestamp;
};

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TutorStudentsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentRow[]>([]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      setLoading(true);
      try {
        // Primary: uid-based assignment
        const q1 = query(collection(db, "students"), where("assignedTutorId", "==", u.uid));
        let snap = await getDocs(q1);

        // Fallback: email-based assignment
        if (snap.empty && u.email) {
          const q2 = query(collection(db, "students"), where("assignedTutorEmail", "==", u.email));
          snap = await getDocs(q2);
        }

        const list: StudentRow[] = snap.docs.map((d) => {
          const data = d.data() as StudentDoc;
          return {
            id: d.id,
            studentName: data.studentName ?? "",
            yearLevel: data.yearLevel ?? "",
            school: data.school ?? null,
            clientId: data.clientId ?? "",
            assignedTutorId: data.assignedTutorId ?? null,
            assignedTutorEmail: data.assignedTutorEmail ?? null,
            createdAt: data.createdAt,
          };
        });

        // Newest-first
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });

        setRows(list);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Page header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Students
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
            My Students
          </div>
          <Link
            href="/hub/tutor/leads"
            style={{ background: "white", color: "#456071", border: "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            View Leads
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 18, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ height: 14, width: 80, borderRadius: 20, background: "rgba(0,0,0,0.06)", marginBottom: 10 }} />
              <div style={{ height: 20, width: 140, borderRadius: 20, background: "rgba(0,0,0,0.06)", marginBottom: 8 }} />
              <div style={{ height: 12, width: "70%", borderRadius: 20, background: "rgba(0,0,0,0.06)" }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 16, padding: 40, textAlign: "center", fontSize: 13, color: "#8a96a3" }}>
          No students assigned yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {rows.map((s) => (
            <div key={s.id} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 4, background: "#456071" }} />
              <div style={{ padding: 16, display: "flex", flexDirection: "column", flexGrow: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #456071 0%, #82977e 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                    {(s.studentName || "S").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2428" }}>{s.studentName || "—"}</div>
                    <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 1 }}>
                      {[s.yearLevel, s.school].filter(Boolean).join(" · ") || "Details pending"}
                    </div>
                  </div>
                </div>

                {s.createdAt && (
                  <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, color: "#748398" }}>Added: </span>{formatDate(s.createdAt)}
                  </div>
                )}

                <div style={{ marginTop: "auto" }}>
                  <Link
                    href={`/hub/tutor/students/${s.id}`}
                    style={{ display: "inline-block", background: "#456071", color: "white", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                  >
                    Open →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
