"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function ExportButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function handleExport() {
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/admin/export", { method: "POST" });
      const json = await res.json() as { ok?: boolean; error?: string; counts?: { clients: number; leads: number; students: number } };
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      const c = json.counts;
      setMsg(`Exported: ${c?.clients ?? 0} clients · ${c?.leads ?? 0} leads · ${c?.students ?? 0} students`);
      setStatus("ok");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
      setStatus("err");
    }
    setTimeout(() => setStatus("idle"), 5000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={status === "loading"}
        style={{
          background: status === "ok" ? "#82977e" : "#456071",
          color: "white",
          border: "none",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 500,
          cursor: status === "loading" ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: status === "loading" ? 0.7 : 1,
          transition: "background 0.15s",
        }}
      >
        {status === "loading" ? "Exporting…" : status === "ok" ? "Exported ✓" : "Export to Sheets"}
      </button>
      {msg && (
        <span style={{ fontSize: 12, color: status === "err" ? "#dc2626" : "#6b7280" }}>{msg}</span>
      )}
    </div>
  );
}
const CARDS = [
  {
    title: "Leads",
    description: "New enrolments, status changes, and tutor assignment",
    href: "/hub/admin/leads",
    accent: "#456071",
  },
  {
    title: "Clients",
    description: "Families, students, and their assigned tutors",
    href: "/hub/admin/clients",
    accent: "#82977e",
  },
  {
    title: "Tutors",
    description: "All tutors and the students assigned to them",
    href: "/hub/admin/tutors",
    accent: "#b8cad6",
  },
  {
    title: "Sessions Calendar",
    description: "Scheduled and completed sessions with notes",
    href: "/hub/admin/sessions",
    accent: "#e39bb6",
  },
  {
    title: "Add Existing Student",
    description: "Onboard a tutor's current student without a public enrolment",
    href: "/hub/admin/students/add-existing",
    accent: "#c4bbaf",
  },
  {
    title: "Promo Codes",
    description: "Create and manage 7-day trial access codes for students",
    href: "/hub/admin/promo",
    accent: "#a8c5b0",
  },
  {
    title: "Package Alerts",
    description: "Students with 3 or fewer sessions remaining in their package",
    href: "/hub/admin/packages",
    accent: "#e39bb6",
  },
];

function AdminCard({ title, description, href, accent }: {
  title: string; description: string; href: string; accent: string;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 20,
        border: "1px solid #e8eaed",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow 0.18s, transform 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Top accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "20px 20px 0 0" }} />

      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1f24", marginTop: 4, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, flex: 1 }}>
        {description}
      </div>
      <button
        type="button"
        onClick={() => router.push(href)}
        style={{
          marginTop: 18,
          background: "#456071",
          color: "white",
          border: "none",
          borderRadius: 12,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          alignSelf: "flex-start",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#374f5e")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#456071")}
      >
        Open
      </button>
    </div>
  );
}

export default function AdminHubPage() {
  const router = useRouter();

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 6 }}>
          Studyroom · Admin
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Admin Portal
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          Review leads, assign tutors, and keep operations tidy
        </p>
      </div>

      {/* Card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        {CARDS.map((card) => (
          <AdminCard key={card.title} {...card} />
        ))}
      </div>

      {/* Export + Back */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        <ExportButton />

        <button
          type="button"
          onClick={() => router.push("/hub")}
        style={{
          background: "white",
          color: "#456071",
          border: "1.5px solid #b8cad6",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f2f5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
      >
        ← Back to Hub
      </button>
      </div>

    </div>
  );
}
