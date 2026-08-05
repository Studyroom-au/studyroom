"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { filterCurrentStudents } from "@/lib/studyroom/currentPopulation";

// Release 1B.1: upgrades the old alerts-only "Package Alerts" page into a
// full operational package register — one row per CURRENT student (the same
// filterCurrentStudents() population Admin Home and Clients already share),
// so admin can see and act on every student's arrangement in one place
// rather than only the ones running low.

type RawStudent = {
  studentName?: string;
  clientId?: string | null;
  status?: string | null;
  activePlanId?: string | null;
  assignedTutorId?: string | null;
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
  mode?: string | null;
};

type RawClient = {
  status?: string | null;
  parentName?: string | null;
};

type RawPlan = {
  type?: string;
  status?: string;
  mode?: string;
  standardPriceCents?: number | null;
  finalPriceCents?: number | null;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number | null;
  carryOverSessions?: number;
  commencementAt?: { toDate?: () => Date } | null;
  createdAt?: { toDate?: () => Date } | null;
};

type RawEntitlement = {
  remainingSessions?: number;
  bonusRemaining?: number;
};

type Arrangement = "casual" | "package_5" | "package_10" | "package_12" | "not_configured";

type Row = {
  studentId: string;
  studentName: string;
  clientId: string;
  parentName: string;
  tutorName: string;
  mode: string | null;
  arrangement: Arrangement;
  planStatus: string | null;
  commencementAt: Date | null;
  sessionsIncluded: number | null;
  carryOver: number;
  sessionsDeducted: number | null;
  sessionsRemaining: number | null;
  agreedPriceCents: number | null;
  discountLabel: string | null;
  isPaused: boolean;
  nextAction: string;
};

function baseSeedSessions(type: string): number {
  if (type === "package_10") return 10;
  if (type === "package_12") return 12;
  if (type === "package_5") return 5;
  return 0;
}

function arrangementLabel(a: Arrangement): string {
  if (a === "package_5") return "5-session";
  if (a === "package_10") return "10-session";
  if (a === "package_12") return "12-session (legacy)";
  if (a === "casual") return "Casual";
  return "Not configured";
}

function modeLabel(mode?: string | null): string {
  if (mode === "online") return "Online";
  if (mode === "in_home") return "In-home";
  return "—";
}

function money(cents?: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function dateStr(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

type FilterKey =
  | "all"
  | "not_configured"
  | "casual"
  | "package_5"
  | "package_10"
  | "package_12"
  | "low_balance"
  | "zero_balance"
  | "online"
  | "in_home";

export default function AdminPackagesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [tutorFilter, setTutorFilter] = useState<string>("all");

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setLoading(true);
      try {
        const [studentsSnap, clientsSnap] = await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "clients")),
        ]);

        const studentsRaw = studentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as RawStudent) }));
        const clientsRaw = clientsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as RawClient) }));
        const clientsById = new Map(clientsRaw.map((c) => [c.id, c]));

        const currentStudents = filterCurrentStudents(studentsRaw, clientsRaw);

        const result: Row[] = await Promise.all(
          currentStudents.map(async (s) => {
            let plan: RawPlan | null = null;
            let entitlement: RawEntitlement | null = null;
            if (s.activePlanId) {
              const [planSnap, entSnap] = await Promise.all([
                getDoc(doc(db, "plans", s.activePlanId)),
                getDoc(doc(db, "entitlements", s.activePlanId)),
              ]);
              plan = planSnap.exists() ? (planSnap.data() as RawPlan) : null;
              entitlement = entSnap.exists() ? (entSnap.data() as RawEntitlement) : null;
            }

            const arrangement: Arrangement = !plan
              ? "not_configured"
              : plan.type === "package_5" || plan.type === "package_10" || plan.type === "package_12" || plan.type === "casual"
                ? (plan.type as Arrangement)
                : "not_configured";

            const isPackage = arrangement === "package_5" || arrangement === "package_10" || arrangement === "package_12";
            const seedSessions = isPackage ? baseSeedSessions(plan?.type ?? "") : null;
            const carryOver = Number(plan?.carryOverSessions ?? 0);
            const remaining = isPackage ? Number(entitlement?.remainingSessions ?? 0) + Number(entitlement?.bonusRemaining ?? 0) : null;
            const deducted =
              isPackage && seedSessions != null && remaining != null ? Math.max(0, seedSessions + carryOver - remaining) : null;

            const discountLabel = plan?.discountType
              ? plan.discountType === "percent"
                ? `${plan.discountValue}% off`
                : `${money(plan.discountValue)} off`
              : null;

            let nextAction = "—";
            if (arrangement === "not_configured") nextAction = "Set up arrangement";
            else if (isPackage && remaining === 0) nextAction = "Renew package";
            else if (isPackage && remaining != null && remaining <= 3) nextAction = "Running low";

            const clientRec = s.clientId ? clientsById.get(s.clientId) : undefined;

            return {
              studentId: s.id,
              studentName: s.studentName || "(unnamed)",
              clientId: s.clientId || "",
              parentName: clientRec?.parentName || "—",
              tutorName: s.assignedTutorName || s.assignedTutorEmail || (s.assignedTutorId ? "Assigned" : "Unassigned"),
              mode: plan?.mode || s.mode || null,
              arrangement,
              planStatus: plan?.status ?? null,
              commencementAt: plan?.commencementAt?.toDate?.() ?? plan?.createdAt?.toDate?.() ?? null,
              sessionsIncluded: seedSessions,
              carryOver,
              sessionsDeducted: deducted,
              sessionsRemaining: remaining,
              agreedPriceCents: plan?.finalPriceCents ?? plan?.standardPriceCents ?? null,
              discountLabel,
              isPaused: s.status === "paused",
              nextAction,
            } satisfies Row;
          })
        );

        result.sort((a, b) => a.studentName.localeCompare(b.studentName));
        setRows(result);
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, []);

  const tutorOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.tutorName).filter((n) => n && n !== "Unassigned"));
    return Array.from(names).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (tutorFilter !== "all" && r.tutorName !== tutorFilter) return false;
      switch (filter) {
        case "not_configured":
          return r.arrangement === "not_configured";
        case "casual":
          return r.arrangement === "casual";
        case "package_5":
          return r.arrangement === "package_5";
        case "package_10":
          return r.arrangement === "package_10";
        case "package_12":
          return r.arrangement === "package_12";
        case "low_balance":
          return r.sessionsRemaining != null && r.sessionsRemaining >= 1 && r.sessionsRemaining <= 3;
        case "zero_balance":
          return r.sessionsRemaining === 0;
        case "online":
          return r.mode === "online";
        case "in_home":
          return r.mode === "in_home";
        default:
          return true;
      }
    });
  }, [rows, filter, tutorFilter]);

  const counts = useMemo(() => {
    return {
      total: rows.length,
      casual: rows.filter((r) => r.arrangement === "casual").length,
      package5: rows.filter((r) => r.arrangement === "package_5").length,
      package10: rows.filter((r) => r.arrangement === "package_10").length,
      legacy: rows.filter((r) => r.arrangement === "package_12").length,
      notConfigured: rows.filter((r) => r.arrangement === "not_configured").length,
      zeroBalance: rows.filter((r) => r.sessionsRemaining === 0).length,
      lowBalance: rows.filter((r) => r.sessionsRemaining != null && r.sessionsRemaining >= 1 && r.sessionsRemaining <= 3).length,
    };
  }, [rows]);

  const filterButtons: { key: FilterKey; label: string }[] = [
    { key: "all", label: `All (${counts.total})` },
    { key: "not_configured", label: `Not configured (${counts.notConfigured})` },
    { key: "casual", label: `Casual (${counts.casual})` },
    { key: "package_5", label: `5-session (${counts.package5})` },
    { key: "package_10", label: `10-session (${counts.package10})` },
    { key: "package_12", label: `Legacy 12-session (${counts.legacy})` },
    { key: "low_balance", label: `Low balance (${counts.lowBalance})` },
    { key: "zero_balance", label: `Zero balance (${counts.zeroBalance})` },
    { key: "online", label: "Online" },
    { key: "in_home", label: "In-home" },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#82977e", marginBottom: 6 }}>
          Studyroom · Admin
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "#1a1f24", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Package Register
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 0 }}>
          Every current student&apos;s arrangement, sessions, and balance in one place.
        </p>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {filterButtons.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setFilter(b.key)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: filter === b.key ? "1.5px solid #456071" : "1px solid #e4eaef",
                  background: filter === b.key ? "#456071" : "white",
                  color: filter === b.key ? "white" : "#456071",
                  cursor: "pointer",
                }}
              >
                {b.label}
              </button>
            ))}
            {tutorOptions.length > 0 && (
              <select
                value={tutorFilter}
                onChange={(e) => setTutorFilter(e.target.value)}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 20, border: "1px solid #e4eaef", color: "#456071" }}
              >
                <option value="all">All tutors</option>
                {tutorOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {[
                      "Student", "Family", "Tutor", "Mode", "Arrangement", "Status", "Commenced",
                      "Included", "Carryover", "Deducted", "Remaining", "Price", "Discount", "Next action", "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", whiteSpace: "nowrap" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={r.studentId} style={{ borderBottom: i < filteredRows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <td style={{ padding: "12px", fontSize: 13, fontWeight: 600, color: "#1a1f24", whiteSpace: "nowrap" }}>
                        {r.studentName}
                        {r.isPaused && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "#f4f7f9", color: "#748398" }}>
                            PAUSED
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{r.parentName}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{r.tutorName}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>{modeLabel(r.mode)}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                        {r.arrangement === "not_configured" ? (
                          <span style={{ color: "#991b1b", fontWeight: 600 }}>{arrangementLabel(r.arrangement)}</span>
                        ) : (
                          arrangementLabel(r.arrangement)
                        )}
                      </td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>{r.planStatus ?? "—"}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{dateStr(r.commencementAt)}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>{r.sessionsIncluded ?? "—"}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>{r.carryOver || "—"}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151" }}>{r.sessionsDeducted ?? "—"}</td>
                      <td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: r.sessionsRemaining === 0 ? "#991b1b" : "#374151" }}>
                        {r.sessionsRemaining ?? "—"}
                      </td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{money(r.agreedPriceCents)}</td>
                      <td style={{ padding: "12px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>{r.discountLabel ?? "—"}</td>
                      <td style={{ padding: "12px", fontSize: 12, whiteSpace: "nowrap" }}>
                        {r.nextAction !== "—" ? (
                          <span style={{ fontWeight: 600, padding: "3px 8px", borderRadius: 12, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                            {r.nextAction}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button
                          type="button"
                          onClick={() => router.push(`/hub/admin/students/${r.studentId}`)}
                          style={{ fontSize: 12, fontWeight: 600, color: "#456071", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRows.length === 0 && (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                No students match this filter.
              </div>
            )}
          </div>
        </>
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
      >
        ← Back to Admin
      </button>
    </div>
  );
}
