// src/app/hub/admin/invoices/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type SessionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_PARENT"
  | "CANCELLED_STUDYROOM"
  | "NO_SHOW";

type BillingStatus =
  | "NOT_BILLED"
  | "INVOICE_DRAFT"
  | "BILLED"
  | "PREPAID"
  | "CREDITED"
  | "FORFEITED";

type SessionRow = {
  id: string;
  studentId: string;
  clientId: string;
  tutorId: string;
  tutorEmail?: string | null;
  startAt: Timestamp;
  durationMinutes: number;
  modality: "IN_HOME" | "ONLINE";
  status: SessionStatus;
  billingStatus: BillingStatus;
  invoiceId?: string | null;
};

type StudentRow = {
  id: string;
  studentName?: string;
  yearLevel?: string;
  clientId: string;
};

type ClientRow = {
  id: string;
  parentName?: string;
  parentEmail?: string;
  pricingPlan?: "CASUAL" | "PACKAGE_5" | "PACKAGE_12" | "ONLINE";
  ratePerHourCents?: number | null; // optional locked
};

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID" | "CANCELLED_BY_TUTOR";

type InvoiceDoc = {
  status: InvoiceStatus;

  clientId: string;
  studentId: string;
  sessionId: string;

  tutorId: string | null;
  tutorEmail: string | null;

  invoiceType: "ONE_OFF" | "PACKAGE";
  coverageStartAt: Timestamp;
  coverageEndAt: Timestamp;

  subtotalCents: number;
  dueAt: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  tutorNote?: string | null;
  cancelReason?: string | null;
};

type SessionDoc = Partial<SessionRow> & {
  studentId?: string;
  clientId?: string;
  tutorId?: string;
  startAt?: Timestamp;
};

type StudentDoc = Partial<StudentRow> & {
  studentName?: string;
  yearLevel?: string;
  clientId?: string;
};

type ClientDoc = Partial<ClientRow> & {
  parentName?: string;
  parentEmail?: string;
  pricingPlan?: "CASUAL" | "PACKAGE_5" | "PACKAGE_12" | "ONLINE";
  ratePerHourCents?: number | null;
};

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatDT(ts?: Timestamp) {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getDefaultRatePerHourCents(modality: "IN_HOME" | "ONLINE") {
  // Current pricing defaults
  return modality === "ONLINE" ? 6000 : 7500;
}

function computeSessionAmountCents(
  session: SessionRow,
  client?: ClientRow | null
) {
  const rate =
    client?.ratePerHourCents ?? getDefaultRatePerHourCents(session.modality);
  return Math.round((session.durationMinutes / 60) * rate);
}

export default function AdminInvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, StudentRow>>(
    {}
  );
  const [clientsById, setClientsById] = useState<Record<string, ClientRow>>({});

  // Load upcoming UNBILLED sessions (next 30 days)
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      setLoading(true);
      try {
        const now = new Date();
        const end = addDays(now, 30);

        const from = Timestamp.fromDate(now);
        const to = Timestamp.fromDate(end);

        const qy = query(
          collection(db, "sessions"),
          where("startAt", ">=", from),
          where("startAt", "<", to),
          where("billingStatus", "==", "NOT_BILLED"),
          orderBy("startAt", "asc")
        );

        const snap = await getDocs(qy);
        const list: SessionRow[] = snap.docs.map((d) => {
          const data = d.data() as SessionDoc;
          return {
            id: d.id,
            studentId: data.studentId ?? "",
            clientId: data.clientId ?? "",
            tutorId: data.tutorId ?? "",
            tutorEmail: data.tutorEmail ?? null,
            startAt: data.startAt ?? Timestamp.fromDate(new Date()),
            durationMinutes: data.durationMinutes ?? 60,
            modality: data.modality ?? "IN_HOME",
            status: data.status ?? "SCHEDULED",
            billingStatus: data.billingStatus ?? "NOT_BILLED",
            invoiceId: data.invoiceId ?? null,
          };
        });

        // Only sessions that are actually booked
        const booked = list.filter(
          (s) => s.status === "SCHEDULED" || s.status === "CONFIRMED"
        );

        // Load referenced students + clients
        const studentIds = Array.from(new Set(booked.map((s) => s.studentId)));
        const clientIds = Array.from(new Set(booked.map((s) => s.clientId)));

        const sMap: Record<string, StudentRow> = {};
        for (const sid of studentIds) {
          const sSnap = await getDoc(doc(db, "students", sid));
          if (sSnap.exists()) {
            const sd = sSnap.data() as StudentDoc;
            sMap[sid] = {
              id: sid,
              studentName: sd.studentName ?? "",
              yearLevel: sd.yearLevel ?? "",
              clientId: sd.clientId ?? "",
            };
          }
        }

        const cMap: Record<string, ClientRow> = {};
        for (const cid of clientIds) {
          const cSnap = await getDoc(doc(db, "clients", cid));
          if (cSnap.exists()) {
            const cd = cSnap.data() as ClientDoc;
            cMap[cid] = {
              id: cid,
              parentName: cd.parentName ?? "",
              parentEmail: cd.parentEmail ?? "",
              pricingPlan: cd.pricingPlan ?? "CASUAL",
              ratePerHourCents: cd.ratePerHourCents ?? null,
            };
          }
        }

        setStudentsById(sMap);
        setClientsById(cMap);

        // Filter out package clients (prepaid)
        const filtered = booked.filter((s) => {
          const plan = cMap[s.clientId]?.pricingPlan ?? "CASUAL";
          return plan !== "PACKAGE_5" && plan !== "PACKAGE_12";
        });

        setSessions(filtered);
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  const count = useMemo(() => sessions.length, [sessions]);

  async function createDraftInvoiceForSession(s: SessionRow) {
    const client = clientsById[s.clientId];
    const student = studentsById[s.studentId];

    // Due: 48 hours before session; if within 48 hours -> due now
    const startDate = s.startAt.toDate();
    const dueCandidate = new Date(startDate.getTime() - 48 * 60 * 60 * 1000);
    const due = dueCandidate.getTime() < Date.now() ? new Date() : dueCandidate;

    const subtotal = computeSessionAmountCents(s, client ?? null);

    const batch = writeBatch(db);
    const invoiceRef = doc(collection(db, "invoices"));

    batch.set(invoiceRef, {
      status: "DRAFT",

      clientId: s.clientId,
      studentId: s.studentId,
      sessionId: s.id,

      tutorId: s.tutorId ?? null,
      tutorEmail: s.tutorEmail ?? null,

      invoiceType: "ONE_OFF",
      coverageStartAt: s.startAt,
      coverageEndAt: s.startAt,

      subtotalCents: subtotal,
      dueAt: Timestamp.fromDate(due),

      tutorNote: null,
      cancelReason: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Partial<InvoiceDoc>);

    // Link the session to prevent double invoicing
    batch.update(doc(db, "sessions", s.id), {
      billingStatus: "INVOICE_DRAFT",
      invoiceId: invoiceRef.id,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    alert(
      `Draft invoice created for ${student?.studentName ?? "student"} (${client?.parentName ?? "parent"}).`
    );
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Control Panel
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[color:var(--ink)]">
            Invoices (Per Session)
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Upcoming UNBILLED sessions (next 30 days), excluding package clients. ({count})
          </p>
        </div>
      </header>

      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-4 shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--muted)]">
            No upcoming UNBILLED sessions found (or they’re all package/prepaid).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs font-semibold text-[color:var(--muted)]">
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Parent</th>
                  <th className="px-3 py-3">Mode</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Est total</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const st = studentsById[s.studentId];
                  const cl = clientsById[s.clientId];
                  const est = computeSessionAmountCents(s, cl ?? null);

                  return (
                    <tr key={s.id} className="border-t border-[color:var(--ring)]">
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {formatDT(s.startAt)}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-[color:var(--ink)]">
                        {(st?.studentName || "—") + (st?.yearLevel ? ` · ${st.yearLevel}` : "")}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {cl?.parentName || "—"}{" "}
                        <span className="text-xs">({cl?.parentEmail || "—"})</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {s.modality === "ONLINE" ? "Online" : "In-home"}
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {s.durationMinutes} min
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--muted)]">
                        {money(est)}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => createDraftInvoiceForSession(s)}
                          className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
                        >
                          Create draft invoice
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-xs text-[color:var(--muted)]">
              Notes: Draft invoices link to exactly one session. Package clients are excluded here.
              Xero sending comes later via a secure server function.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
