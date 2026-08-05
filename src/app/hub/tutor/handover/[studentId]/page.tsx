"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

// Release 1B.1: tutor-facing view of a confirmed handover — created only by
// the admin "Confirm match and send tutor handover" action
// (POST /api/tutors/handover/confirm). Deliberately a small, standalone page
// (not a new messaging platform) — read-only packet + a copyable parent
// introduction template + three simple status actions.

type HandoverDoc = {
  studentId: string;
  tutorId?: string;
  tutorName?: string | null;
  studentName?: string | null;
  yearLevel?: string | null;
  school?: string | null;
  subjects?: string[];
  goals?: string | null;
  challenges?: string | null;
  mode?: string | null;
  suburb?: string | null;
  availabilityBlocks?: string[];
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  commencementDate?: string | null;
  suggestedNextSteps?: string | null;
  confirmedAt?: Timestamp | null;
  status?: "pending" | "contacted_parent" | "first_session_booked" | "need_admin_help";
  statusUpdatedAt?: Timestamp | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting first contact",
  contacted_parent: "Contacted parent",
  first_session_booked: "First session booked",
  need_admin_help: "Need admin help",
};

export default function TutorHandoverPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const studentId = params.studentId;

  const [uid, setUid] = useState<string | null>(null);
  const [tutorFirstName, setTutorFirstName] = useState("");
  const [handover, setHandover] = useState<HandoverDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUid(u.uid);
      setLoading(true);
      try {
        const [handoverSnap, userSnap] = await Promise.all([
          getDoc(doc(db, "tutorHandovers", studentId)),
          getDoc(doc(db, "users", u.uid)),
        ]);
        if (!handoverSnap.exists()) {
          setHandover(null);
          return;
        }
        const data = handoverSnap.data() as HandoverDoc;
        if (data.tutorId !== u.uid) {
          setNotAllowed(true);
          return;
        }
        setHandover(data);
        const name = (userSnap.data() as { name?: string; displayName?: string } | undefined)?.name
          || (userSnap.data() as { name?: string; displayName?: string } | undefined)?.displayName
          || "";
        setTutorFirstName(name.split(" ")[0] || name);
      } finally {
        setLoading(false);
      }
    });
    return () => off();
  }, [studentId]);

  const template = useMemo(() => {
    if (!handover) return "";
    const learningFocus = handover.goals || (handover.subjects ?? []).join(", ") || "their studies";
    return `Hi ${handover.parentName || "[Parent Name]"}, my name is ${tutorFirstName || "[Tutor Name]"} and I'm a tutor with Studyroom. Lily and Tiara have matched me with ${handover.studentName || "[Student Name]"} to support ${learningFocus}.

Based on the availability provided, I currently have [insert available options]. Would one of these suit for the first session?

To help me prepare, you are also welcome to send through any relevant unit plans, assessment sheets, teacher feedback, recent report cards or work samples where useful.

Kind regards,
${tutorFirstName || "[Tutor Name]"}
Studyroom Australia`;
  }, [handover, tutorFirstName]);

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — nothing to do, template is still selectable text
    }
  }

  async function setStatus(status: "contacted_parent" | "first_session_booked" | "need_admin_help") {
    if (!uid) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "tutorHandovers", studentId), {
        status,
        statusUpdatedBy: uid,
        statusUpdatedAt: serverTimestamp(),
      });
      setHandover((prev) => (prev ? { ...prev, status } : prev));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-[color:var(--muted)]">Loading…</div>;
  }
  if (notAllowed) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-red-600">This handover isn&apos;t available to your account.</div>;
  }
  if (!handover) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-[color:var(--muted)]">
        No handover found for this student yet.
        <button type="button" onClick={() => router.push("/hub/tutor")} className="ml-2 text-[color:var(--brand)] underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">New Student Handover</p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{handover.studentName || "Student"}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Status: <strong>{STATUS_LABEL[handover.status ?? "pending"]}</strong>
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4 text-sm space-y-2">
        <h2 className="mb-1 font-semibold text-[color:var(--ink)]">Student details</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div><span className="font-semibold">Year level:</span> {handover.yearLevel || "—"}</div>
          <div><span className="font-semibold">School:</span> {handover.school || "—"}</div>
          <div><span className="font-semibold">Subjects:</span> {(handover.subjects ?? []).join(", ") || "—"}</div>
          <div><span className="font-semibold">Mode:</span> {handover.mode === "online" ? "Online" : "In-home"}</div>
          <div><span className="font-semibold">Suburb:</span> {handover.suburb || "—"}</div>
          <div><span className="font-semibold">Commencement:</span> {handover.commencementDate || "—"}</div>
        </div>
        {handover.goals && <div><span className="font-semibold">Goals:</span> {handover.goals}</div>}
        {handover.challenges && <div><span className="font-semibold">Challenges / support needed:</span> {handover.challenges}</div>}
        {(handover.availabilityBlocks ?? []).length > 0 && (
          <div><span className="font-semibold">Availability supplied by parent:</span> {(handover.availabilityBlocks ?? []).join(", ")}</div>
        )}
        {handover.suggestedNextSteps && (
          <div><span className="font-semibold">Suggested next steps:</span> {handover.suggestedNextSteps}</div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4 text-sm space-y-2">
        <h2 className="mb-1 font-semibold text-[color:var(--ink)]">Parent contact</h2>
        <div><span className="font-semibold">Name:</span> {handover.parentName || "—"}</div>
        <div><span className="font-semibold">Email:</span> {handover.parentEmail || "—"}</div>
        <div><span className="font-semibold">Phone:</span> {handover.parentPhone || "—"}</div>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4 text-sm space-y-2">
        <h2 className="mb-1 font-semibold text-[color:var(--ink)]">Copyable parent introduction</h2>
        <p className="text-xs text-[color:var(--muted)]">
          Fill in your available session times before sending. Document requests are optional — only mention them where genuinely useful.
        </p>
        <textarea readOnly value={template} rows={9} className="w-full rounded-lg border border-[color:var(--ring)] px-2 py-2 text-xs font-mono" />
        <button
          type="button"
          onClick={copyTemplate}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40"
        >
          {copied ? "Copied!" : "Copy template"}
        </button>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4 text-sm space-y-2">
        <h2 className="mb-1 font-semibold text-[color:var(--ink)]">Update status</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("contacted_parent")}
            className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40 disabled:opacity-60"
          >
            Contacted parent
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("first_session_booked")}
            className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] hover:bg-[#d6e5e3]/40 disabled:opacity-60"
          >
            First session booked
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("need_admin_help")}
            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Need admin help
          </button>
        </div>
      </section>
    </div>
  );
}
