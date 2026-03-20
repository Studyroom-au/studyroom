"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type WorkspaceCardProps = {
  title: string;
  subtitle: string;
  href: string;
  label: string;
  accentColor: string;
  labelColor: string;
};

function WorkspaceCard({ title, subtitle, href, label, accentColor, labelColor }: WorkspaceCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 20,
        padding: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 6px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.18s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        borderTop: `3px solid ${accentColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: labelColor,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", marginTop: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 12, color: "#8a96a3", marginTop: 4, lineHeight: 1.5, minHeight: 36 }}>
        {subtitle}
      </p>
      <p style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: accentColor }}>
        Open workspace →
      </p>
    </div>
  );
}

export default function TutorHomePage() {
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);
  const [firstName, setFirstName] = useState("");
  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  })();

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setFirstName(u.displayName?.split(" ")[0] ?? "");
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as { tutorAccessRequest?: { status?: string; reviewedAt?: Timestamp } } | undefined;
      const approved = data?.tutorAccessRequest?.status === "approved";
      setShowApprovedBanner(approved);
    });
    return () => off();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Simple greeting */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Tutor Portal
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
          Good {timeOfDay}{firstName ? `, ${firstName}` : ""}.
        </div>
        <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 3 }}>
          Here&apos;s your workspace.
        </div>
      </div>

      {/* Approved access banner */}
      {showApprovedBanner && (
        <div style={{
          borderRadius: 16,
          padding: "12px 16px",
          fontSize: 13,
          color: "#2d5a24",
          background: "linear-gradient(135deg, #f0fdf6 0%, #e8faf1 100%)",
          border: "1px solid #a7e3c0",
          borderTop: "2px solid #34a76a",
        }}>
          Tutor access approved. You now have full Tutor Portal access.
        </div>
      )}

      {/* Workspace cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <WorkspaceCard
          title="Sessions Calendar"
          subtitle="Schedule, reschedule, complete, and keep session admin moving."
          href="/hub/tutor/sessions"
          label="Sessions"
          accentColor="#456071"
          labelColor="#456071"
        />
        <WorkspaceCard
          title="Leads Marketplace"
          subtitle="Review open leads, claim suitable students, and convert quickly."
          href="/hub/tutor/leads"
          label="Marketplace"
          accentColor="#82977e"
          labelColor="#82977e"
        />
        <WorkspaceCard
          title="My Students"
          subtitle="Open records, confirm onboarding, and add session context."
          href="/hub/tutor/students"
          label="Students"
          accentColor="#b8cad6"
          labelColor="#748398"
        />
        <WorkspaceCard
          title="Payout Export"
          subtitle="Filter pay periods and generate clean export files."
          href="/hub/tutor/payouts"
          label="Payouts"
          accentColor="#c4bbaf"
          labelColor="#8a7a6a"
        />
      </div>
    </div>
  );
}
