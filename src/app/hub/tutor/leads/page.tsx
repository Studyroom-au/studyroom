"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type LeadStatus = "new" | "claimed" | "converted" | "closed";

type LeadRow = {
  id: string;
  studentName: string;
  yearLevel: string;
  suburb?: string | null;
  mode?: "online" | "in-home";
  subjects: string[];
  status: LeadStatus;
  claimedTutorId?: string | null;
  claimedTutorName?: string | null;
  claimedTutorEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type LeadDoc = {
  studentName?: unknown;
  yearLevel?: unknown;
  suburb?: unknown;
  mode?: unknown;
  subjects?: unknown;
  status?: unknown;
  claimedTutorId?: unknown;
  claimedTutorName?: unknown;
  claimedTutorEmail?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asTimestamp(v: unknown): Timestamp | undefined {
  return v instanceof Timestamp ? v : undefined;
}

function asMode(v: unknown): "online" | "in-home" | undefined {
  return v === "online" || v === "in-home" ? v : undefined;
}

function asLeadStatus(v: unknown): LeadStatus {
  return v === "new" || v === "claimed" || v === "converted" || v === "closed" ? v : "new";
}

function formatDate(ts?: Timestamp) {
  if (!ts) return "Recent";
  return ts.toDate().toLocaleDateString();
}

function formatMode(mode?: "online" | "in-home") {
  if (!mode) return "Flexible";
  return mode === "in-home" ? "In-home" : "Online";
}

export default function TutorMarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [filter, setFilter] = useState<"open" | "mine">("open");

  async function loadLeads(tutorUid: string, activeFilter: "open" | "mine") {
    setLoading(true);
    try {
      const col = collection(db, "leads");
      const snap =
        activeFilter === "open"
          ? await getDocs(query(col, where("status", "==", "new"), where("claimedTutorId", "==", null)))
          : await getDocs(query(col, where("claimedTutorId", "==", tutorUid)));

      const list: LeadRow[] = snap.docs.map((d) => {
        const data = d.data() as LeadDoc;
        return {
          id: d.id,
          studentName: asString(data.studentName, "Student"),
          yearLevel: asString(data.yearLevel, ""),
          suburb: asNullableString(data.suburb),
          mode: asMode(data.mode),
          subjects: asStringArray(data.subjects),
          status: asLeadStatus(data.status),
          claimedTutorId: asNullableString(data.claimedTutorId),
          claimedTutorName: asNullableString(data.claimedTutorName),
          claimedTutorEmail: asNullableString(data.claimedTutorEmail),
          createdAt: asTimestamp(data.createdAt),
          updatedAt: asTimestamp(data.updatedAt),
        };
      });

      list.sort((a, b) => {
        const at = a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
        const bt = b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
        return bt - at;
      });

      setRows(list.slice(0, 300));
    } catch (error) {
      console.error("[tutor marketplace] load failed:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const refreshForEffect = useCallback(() => loadLeads(uid, filter), [uid, filter]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!uid) return;
    refreshForEffect();
  }, [uid, filter, refreshForEffect]);

  const count = useMemo(() => rows.length, [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Simple page header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Marketplace
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
          Open leads
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => setFilter("open")}
          style={{ background: filter === "open" ? "#456071" : "white", color: filter === "open" ? "white" : "#456071", border: filter === "open" ? "none" : "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: filter === "open" ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          Open leads ({filter === "open" ? count : "…"})
        </button>
        <button
          type="button"
          onClick={() => setFilter("mine")}
          style={{ background: filter === "mine" ? "#456071" : "white", color: filter === "mine" ? "white" : "#456071", border: filter === "mine" ? "none" : "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: filter === "mine" ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          My claimed ({filter === "mine" ? count : "…"})
        </button>
        <button
          type="button"
          onClick={() => auth.currentUser && loadLeads(auth.currentUser.uid, filter)}
          style={{ background: "white", color: "#456071", border: "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          Refresh
        </button>
        <Link
          href="/hub/tutor/students"
          style={{ background: "white", color: "#456071", border: "1.5px solid rgba(69,96,113,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          My Students
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "white", borderRadius: 18, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ height: 14, width: 80, borderRadius: 20, background: "rgba(0,0,0,0.06)", marginBottom: 10 }} />
              <div style={{ height: 20, width: 140, borderRadius: 20, background: "rgba(0,0,0,0.06)", marginBottom: 8 }} />
              <div style={{ height: 12, width: "100%", borderRadius: 20, background: "rgba(0,0,0,0.06)" }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ border: "1.5px dashed #e4eaef", borderRadius: 16, padding: 40, textAlign: "center", fontSize: 13, color: "#8a96a3" }}>
          {filter === "open" ? "No open leads right now." : "You haven’t claimed any leads yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {rows.map((lead) => (
            <div key={lead.id} style={{ background: "white", borderRadius: 18, padding: 16, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#8a96a3", marginBottom: 3 }}>{formatDate(lead.createdAt)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428" }}>{lead.studentName}</div>
                  <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 2 }}>{lead.yearLevel || "Year level pending"}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#edf2f6", color: "#456071", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatMode(lead.mode)}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {(lead.subjects.length ? lead.subjects : ["Subject to confirm"]).slice(0, 4).map((subject) => (
                  <span key={subject} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "rgba(69,96,113,0.08)", color: "#456071" }}>
                    {subject}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: "#748398" }}>Suburb: </span>{lead.suburb || "Flexible"}
              </div>
              <div style={{ fontSize: 11, color: "#8a96a3", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, color: "#748398" }}>Status: </span>
                {lead.claimedTutorId ? lead.claimedTutorName || lead.claimedTutorEmail || "Claimed" : "Available"}
              </div>

              <div style={{ marginTop: "auto" }}>
                <Link
                  href={`/hub/tutor/leads/${lead.id}`}
                  style={{ display: "inline-block", background: "#456071", color: "white", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                >
                  Open lead
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

