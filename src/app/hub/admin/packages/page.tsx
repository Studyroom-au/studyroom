"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type AlertRow = {
  planId: string;
  studentName: string;
  packageType: string;
  sessionsRemaining: number;
  sessionsUsed: number;
  termId: string;
  urgent: boolean;
};

type RawEntitlement = {
  planId?: string;
  remainingSessions?: number;
  bonusRemaining?: number;
  termId?: string;
};

type RawPlan = {
  type?: string;
};

type RawStudent = {
  studentName?: string;
};

function packageTypeLabel(type: string): string {
  if (type === "package_5") return "5-session package";
  if (type === "package_12") return "12-session package";
  return "Package";
}

export default function AdminPackagesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "entitlements"),
          where("remainingSessions", ">=", 1),
          where("remainingSessions", "<=", 3)
        );
        const snap = await getDocs(q);
        const result: AlertRow[] = [];

        await Promise.all(
          snap.docs.map(async (entDoc) => {
            const ent = entDoc.data() as RawEntitlement;
            const planId = entDoc.id; // entitlement doc ID == plan doc ID
            const remaining = Number(ent.remainingSessions ?? 0);
            const bonus = Number(ent.bonusRemaining ?? 0);
            const termId = String(ent.termId ?? "");

            // Fetch plan for package type
            let packageType = "Package";
            let totalSessions = 0;
            try {
              const planSnap = await getDoc(doc(db, "plans", planId));
              if (planSnap.exists()) {
                const plan = planSnap.data() as RawPlan;
                packageType = packageTypeLabel(plan.type ?? "");
                if ((plan.type ?? "") === "package_12") totalSessions = 12;
                else if ((plan.type ?? "") === "package_5") totalSessions = 5;
              }
            } catch { /* skip */ }

            // Find student via activePlanId
            let studentName = "Unknown student";
            try {
              const studentSnap = await getDocs(
                query(collection(db, "students"), where("activePlanId", "==", planId))
              );
              if (!studentSnap.empty) {
                const s = studentSnap.docs[0].data() as RawStudent;
                studentName = s.studentName ?? "Unknown student";
              }
            } catch { /* skip */ }

            const sessionsUsed = Math.max(0, totalSessions - remaining - bonus);

            result.push({
              planId,
              studentName,
              packageType,
              sessionsRemaining: remaining,
              sessionsUsed,
              termId,
              urgent: remaining === 1,
            });
          })
        );

        result.sort((a, b) => a.sessionsRemaining - b.sessionsRemaining);
        setRows(result);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 6 }}>
          Studyroom · Admin
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Package Alerts
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          Students with 3 or fewer sessions remaining in their package
        </p>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: "#f9fafb", borderRadius: 16, padding: "32px 24px", textAlign: "center", color: "#6b7280", fontSize: 14, border: "1.5px dashed #e4eaef" }}>
          No students are running low on sessions.
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {["Student", "Package", "Remaining", "Used", "Term", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.planId}
                  style={{ borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}
                >
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "#1a1f24" }}>
                    {row.studentName}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                    {row.packageType}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                    {row.sessionsRemaining}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                    {row.sessionsUsed}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                    {row.termId}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {row.urgent ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
                        Urgent
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                        Warning
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/hub/admin")}
        style={{
          marginTop: 28,
          background: "white",
          color: "#456071",
          border: "1.5px solid #b8cad6",
          borderRadius: 12,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f2f5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
      >
        ← Back to Admin
      </button>
    </div>
  );
}
