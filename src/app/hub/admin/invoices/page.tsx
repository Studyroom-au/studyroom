// src/app/hub/admin/invoices/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceRow = {
  id: string;
  status: string;
  clientId?: string | null;
  studentId?: string | null;
  sessionId?: string | null;
  sessionIds?: string[] | null;
  amountCents?: number | null;
  totalCents?: number | null;
  issuedAt?: Timestamp | null;
  xeroInvoiceId?: string | null;
  xeroError?: string | null;
  dateKey?: string | null;
  parentName?: string;
  studentName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts?: Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

async function hydrateNames(
  clientId?: string | null,
  studentId?: string | null
): Promise<{ parentName: string; studentName: string }> {
  let parentName = "—";
  let studentName = "—";
  if (clientId) {
    const cs = await getDoc(doc(db, "clients", clientId));
    if (cs.exists()) parentName = (cs.data() as { parentName?: string }).parentName || "—";
  }
  if (studentId) {
    const ss = await getDoc(doc(db, "students", studentId));
    if (ss.exists()) studentName = (ss.data() as { studentName?: string }).studentName || "—";
  }
  return { parentName, studentName };
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending_xero: "bg-amber-100 text-amber-800 border-amber-300",
    xero_failed:  "bg-red-100 text-red-800 border-red-300",
    draft_created: "bg-blue-100 text-blue-800 border-blue-300",
    sent:  "bg-purple-100 text-purple-800 border-purple-300",
    paid:  "bg-green-100 text-green-800 border-green-300",
    void:  "bg-gray-100 text-gray-600 border-gray-300",
  };
  const cls = colors[status] ?? "bg-gray-100 text-gray-600 border-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminInvoicesPage() {
  const [needsActionRows, setNeedsActionRows] = useState<InvoiceRow[]>([]);
  const [draftRows, setDraftRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [msgMap, setMsgMap] = useState<Record<string, string>>({});

  function setMsg(id: string, msg: string) {
    setMsgMap((prev) => ({ ...prev, [id]: msg }));
  }

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setLoading(true);
      try {
        // Invoices waiting for Xero draft creation (fresh, failed, or after void)
        const needsActionQ = query(
          collection(db, "invoices"),
          where("status", "in", ["pending_xero", "xero_failed"]),
          orderBy("issuedAt", "desc")
        );

        // Invoices with a Xero DRAFT — admin reviews and sends from Xero
        const draftQ = query(
          collection(db, "invoices"),
          where("status", "==", "draft_created"),
          orderBy("issuedAt", "desc")
        );

        const [naSnap, draftSnap] = await Promise.all([getDocs(needsActionQ), getDocs(draftQ)]);

        async function buildRows(docs: typeof naSnap.docs): Promise<InvoiceRow[]> {
          return Promise.all(
            docs.map(async (d) => {
              const data = d.data();
              const { parentName, studentName } = await hydrateNames(data.clientId, data.studentId);
              return {
                id: d.id,
                status: String(data.status ?? ""),
                clientId: data.clientId ?? null,
                studentId: data.studentId ?? null,
                sessionId: data.sessionId ?? null,
                sessionIds: data.sessionIds ?? null,
                amountCents: data.amountCents ?? null,
                totalCents: data.totalCents ?? null,
                issuedAt: data.issuedAt ?? null,
                xeroInvoiceId: data.xeroInvoiceId ?? null,
                xeroError: data.xeroError ?? null,
                dateKey: data.dateKey ?? null,
                parentName,
                studentName,
              };
            })
          );
        }

        const [needsAction, drafts] = await Promise.all([buildRows(naSnap.docs), buildRows(draftSnap.docs)]);
        setNeedsActionRows(needsAction);
        setDraftRows(drafts);
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, []);

  const centAmount = (row: InvoiceRow) => row.totalCents ?? row.amountCents ?? null;

  // Retry (or first-time manual trigger) — calls push-invoice-to-xero
  const createDraft = useCallback(async (invoiceId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setRetryingId(invoiceId);
    setMsg(invoiceId, "");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/billing/push-invoice-to-xero", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ invoiceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(invoiceId, json.error || "Failed");
        return;
      }
      setNeedsActionRows((prev) => {
        const row = prev.find((r) => r.id === invoiceId);
        if (row) {
          setDraftRows((d) => [
            { ...row, status: "draft_created", xeroInvoiceId: json.xeroInvoiceId },
            ...d,
          ]);
        }
        return prev.filter((r) => r.id !== invoiceId);
      });
    } catch (e) {
      setMsg(invoiceId, e instanceof Error ? e.message : "Error");
    } finally {
      setRetryingId(null);
    }
  }, []);

  // Void a Xero draft and reset the session for re-invoicing
  const voidInvoice = useCallback(
    async (invoiceId: string, sessionId: string | null | undefined) => {
      if (!sessionId) {
        setMsg(invoiceId, "No session linked — void not possible");
        return;
      }
      const user = auth.currentUser;
      if (!user) return;
      if (!confirm("Void this Xero draft invoice? The session will be re-queued for invoicing.")) return;
      setVoidingId(invoiceId);
      setMsg(invoiceId, "");
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/xero/invoices/void", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json();
        if (!res.ok) { setMsg(invoiceId, json.error || "Failed"); return; }
        // Invoice re-queues as pending_xero — move to Needs Attention
        setDraftRows((prev) => {
          const row = prev.find((r) => r.id === invoiceId);
          if (row) {
            setNeedsActionRows((na) => [
              { ...row, status: "pending_xero", xeroInvoiceId: null },
              ...na,
            ]);
          }
          return prev.filter((r) => r.id !== invoiceId);
        });
      } catch (e) {
        setMsg(invoiceId, e instanceof Error ? e.message : "Error");
      } finally {
        setVoidingId(null);
      }
    },
    []
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Control Panel
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-[color:var(--ink)]">Invoices</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Xero drafts are created automatically when tutors complete sessions.
          Review and send from Xero.
        </p>
      </header>

      {loading && (
        <div className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-6 text-sm text-[color:var(--muted)]">
          Loading…
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Needs Attention                                           */}
      {/* ------------------------------------------------------------------ */}
      {!loading && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-amber-800">
            Needs Attention ({needsActionRows.length})
          </h2>
          <p className="mb-4 text-xs text-amber-700">
            These invoices need a Xero draft. This can happen when auto-draft failed, when a draft
            was voided, or for family invoices created by the EOD process.
            Click &ldquo;Create Xero Draft&rdquo; to push to Xero.
          </p>

          {needsActionRows.length === 0 ? (
            <p className="text-xs text-amber-700">All clear — no invoices awaiting Xero draft creation.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-amber-700">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Parent</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {needsActionRows.map((inv) => (
                    <tr key={inv.id} className="border-t border-amber-200">
                      <td className="px-3 py-2 font-semibold text-[color:var(--ink)]">{inv.studentName}</td>
                      <td className="px-3 py-2 text-[color:var(--muted)]">{inv.parentName}</td>
                      <td className="px-3 py-2 text-[color:var(--muted)]">
                        {inv.dateKey ?? formatDate(inv.issuedAt)}
                      </td>
                      <td className="px-3 py-2 text-[color:var(--muted)]">
                        {centAmount(inv) != null ? money(centAmount(inv)!) : "—"}
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        <StatusBadge status={inv.status} />
                        {inv.xeroError && (
                          <p className="text-xs text-red-600 max-w-[200px] truncate" title={inv.xeroError}>
                            {inv.xeroError}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 space-x-2">
                        <button
                          type="button"
                          disabled={retryingId === inv.id}
                          onClick={() => createDraft(inv.id)}
                          className="rounded-lg bg-[#456071] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {retryingId === inv.id ? "Creating…" : "Create Xero Draft"}
                        </button>
                        {msgMap[inv.id] && (
                          <span className="text-xs text-red-700">{msgMap[inv.id]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: In Xero — Drafts                                         */}
      {/* ------------------------------------------------------------------ */}
      {!loading && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-blue-800">
            In Xero — Drafts ({draftRows.length})
          </h2>
          <p className="mb-4 text-xs text-blue-700">
            These invoices are DRAFT in Xero. Open Xero to review, approve, and send to parents.
            Use &ldquo;Void&rdquo; to cancel a draft and re-queue the session if something is wrong.
          </p>

          {draftRows.length === 0 ? (
            <p className="text-xs text-blue-700">No draft invoices in Xero.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-blue-700">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Parent</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Xero ID</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((inv) => {
                    const primarySessionId = inv.sessionId ?? inv.sessionIds?.[0] ?? null;
                    return (
                      <tr key={inv.id} className="border-t border-blue-200">
                        <td className="px-3 py-2 font-semibold text-[color:var(--ink)]">{inv.studentName}</td>
                        <td className="px-3 py-2 text-[color:var(--muted)]">{inv.parentName}</td>
                        <td className="px-3 py-2 text-[color:var(--muted)]">
                          {inv.dateKey ?? formatDate(inv.issuedAt)}
                        </td>
                        <td className="px-3 py-2 text-[color:var(--muted)]">
                          {centAmount(inv) != null ? money(centAmount(inv)!) : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-[color:var(--muted)]">
                          {inv.xeroInvoiceId ? inv.xeroInvoiceId.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={voidingId === inv.id}
                            onClick={() => voidInvoice(inv.id, primarySessionId)}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {voidingId === inv.id ? "Voiding…" : "Void"}
                          </button>
                          {msgMap[inv.id] && (
                            <span className="text-xs text-blue-700">{msgMap[inv.id]}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Info box                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm text-sm text-[color:var(--muted)] space-y-2">
        <h2 className="font-semibold text-[color:var(--ink)]">Invoice lifecycle</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Tutor marks session complete → Xero DRAFT created automatically → <code className="text-xs bg-gray-100 px-1 rounded">DRAFT_CREATED</code></li>
          <li>If auto-draft fails → <code className="text-xs bg-gray-100 px-1 rounded">ERROR</code> on session, invoice appears here under &ldquo;Needs Attention&rdquo;</li>
          <li>Open Xero → review DRAFT invoices → approve and send from Xero</li>
          <li>Use &ldquo;Void&rdquo; here to cancel a draft and re-queue the session</li>
        </ol>
        <p className="text-xs pt-1 text-[color:var(--muted)]">
          SENT and PAID statuses are managed in Xero. Future Xero webhook sync can update them here automatically.
        </p>
      </section>
    </div>
  );
}
