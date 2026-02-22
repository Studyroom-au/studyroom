"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type StudentDoc = {
  clientId?: string | null;
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  subjects?: string[];
  mode?: "online" | "in-home" | null;
  suburb?: string | null;
  addressLine1?: string | null;
  postcode?: string | null;
  availabilityBlocks?: string[];
  goals?: string | null;
  challenges?: string | null;
  package?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
  message?: string | null;
};

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  mode?: "online" | "in-home" | null;
  suburb?: string | null;
  addressLine1?: string | null;
  postcode?: string | null;
  package?: string | null;
  assignedTutorId?: string | null;
  assignedTutorEmail?: string | null;
};

type SessionStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED_PARENT"
  | "CANCELLED_STUDYROOM"
  | "NO_SHOW";

type BillingStatus = "NOT_BILLED" | "READY_TO_INVOICE" | "INVOICED" | "CREDITED" | "FORFEITED";

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;
  studentId: string;
  clientId?: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  status: SessionStatus;
  billingStatus: BillingStatus;
  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  xeroInvoiceId?: string | null;
  seriesKey?: string | null;
  notes?: string | null;
  durationMinutes?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  cancelReason?: string | null;
};

type SessionRow = SessionDoc & { id: string };
type AddModality = "IN_HOME" | "ONLINE";

function formatDate(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleString();
}

function isAddModality(v: string): v is AddModality {
  return v === "IN_HOME" || v === "ONLINE";
}

function formatLeadMode(mode?: string | null) {
  if (mode === "in-home") return "In-home";
  if (mode === "online") return "Online";
  return "-";
}

export default function TutorStudentDetailPage() {
  const params = useParams();
  const studentId = useMemo(() => String(params?.id ?? ""), [params]);

  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [addWhenLocal, setAddWhenLocal] = useState("");
  const [addDuration, setAddDuration] = useState(60);
  const [addModality, setAddModality] = useState<AddModality>("IN_HOME");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [notAllowed, setNotAllowed] = useState(false);

  const reloadSessions = useCallback(async () => {
    if (!studentId) return;
    const user = auth.currentUser;
    if (!user) return;

    const q = query(collection(db, "sessions"), where("tutorId", "==", user.uid));
    const snap = await getDocs(q);

    const rows = snap.docs.map((d) => {
        const data = d.data() as SessionDoc;
        return { id: d.id, ...data };
      })
      .filter((s) => s.studentId === studentId);

    rows.sort((a, b) => {
      const at = a.startAt?.toMillis?.() ?? 0;
      const bt = b.startAt?.toMillis?.() ?? 0;
      return bt - at;
    });

    setSessions(rows);
  }, [studentId]);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) return;

      if (!studentId) {
        setStudent(null);
        setClient(null);
        setSessions([]);
        setNotAllowed(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotAllowed(false);

      const sSnap = await getDoc(doc(db, "students", studentId));
      if (!sSnap.exists()) {
        setStudent(null);
        setClient(null);
        setSessions([]);
        setLoading(false);
        return;
      }

      const sData = sSnap.data() as StudentDoc;

      const allowed =
        (!!sData.assignedTutorId && sData.assignedTutorId === u.uid) ||
        (!!sData.assignedTutorEmail && !!u.email && sData.assignedTutorEmail === u.email);

      if (!allowed) {
        setNotAllowed(true);
        setStudent(null);
        setClient(null);
        setSessions([]);
        setLoading(false);
        return;
      }

      setStudent(sData);

      if (sData.clientId) {
        const cSnap = await getDoc(doc(db, "clients", sData.clientId));
        if (cSnap.exists()) setClient(cSnap.data() as ClientDoc);
      } else {
        setClient(null);
      }

      await reloadSessions();
      setLoading(false);
    });

    return () => off();
  }, [studentId, reloadSessions]);

  async function addSession() {
    const user = auth.currentUser;
    if (!user) return;
    if (!studentId) return;
    if (!addWhenLocal) return alert("Please choose a date/time.");

    const start = new Date(addWhenLocal);
    if (Number.isNaN(start.getTime())) return alert("Invalid date/time.");
    const end = new Date(start.getTime() + addDuration * 60000);

    setSaving(true);

    await addDoc(collection(db, "sessions"), {
      tutorId: user.uid,
      tutorEmail: user.email ?? null,
      studentId,
      clientId: student?.clientId ?? null,
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      durationMinutes: addDuration,
      modality: addModality,
      status: "SCHEDULED",
      billingStatus: "NOT_BILLED",
      xeroInvoiceId: null,
      notes: addNotes.trim() ? addNotes.trim() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });

    setAddNotes("");
    setAddWhenLocal("");
    setAddDuration(60);
    setAddModality("IN_HOME");

    await reloadSessions();
    setSaving(false);
  }

  if (loading) return <div className="p-6">Loading...</div>;

  if (notAllowed) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/hub/tutor/students" className="text-sm text-[color:var(--brand)]">
          {"<- Back to Students"}
        </Link>

        <div className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
          <div className="text-lg font-semibold text-[color:var(--ink)]">Access denied</div>
          <p className="mt-1 text-sm text-[color:var(--muted)]">This student is not assigned to your tutor account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/hub/tutor/students" className="text-sm text-[color:var(--brand)]">
        {"<- Back to Students"}
      </Link>

      <div>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">{student?.studentName || "Student"}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          {student?.yearLevel ? `${student.yearLevel}` : "-"}
          {student?.school ? ` . ${student.school}` : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Student Information</h2>
        <div className="grid gap-3 text-sm text-[color:var(--muted)] md:grid-cols-2">
          <div>
            <span className="font-semibold text-[color:var(--ink)]">School:</span> {student?.school || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Mode:</span> {formatLeadMode(student?.mode)}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Suburb:</span> {student?.suburb || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Postcode:</span> {student?.postcode || "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Address:</span> {student?.addressLine1 || "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Subjects:</span>{" "}
            {student?.subjects?.length ? student.subjects.join(", ") : "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Availability:</span>{" "}
            {student?.availabilityBlocks?.length ? student.availabilityBlocks.join(", ") : "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Goals:</span> {student?.goals || "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Challenges:</span> {student?.challenges || "-"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Parent Information</h2>
        <div className="grid gap-3 text-sm text-[color:var(--muted)] md:grid-cols-2">
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Name:</span> {client?.parentName || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Email:</span> {client?.parentEmail || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Phone:</span> {client?.parentPhone || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Mode:</span>{" "}
            {formatLeadMode(client?.mode ?? student?.mode)}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Suburb:</span>{" "}
            {client?.suburb || student?.suburb || "-"}
          </div>
          <div>
            <span className="font-semibold text-[color:var(--ink)]">Postcode:</span>{" "}
            {client?.postcode || student?.postcode || "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Address:</span>{" "}
            {client?.addressLine1 || student?.addressLine1 || "-"}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold text-[color:var(--ink)]">Package:</span>{" "}
            {client?.package || student?.package || "-"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Add Session</h2>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[color:var(--muted)]">Date & time</label>
          <input
            type="datetime-local"
            value={addWhenLocal}
            onChange={(e) => setAddWhenLocal(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[color:var(--muted)]">Duration</label>
            <select
              value={addDuration}
              onChange={(e) => setAddDuration(Number(e.target.value))}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[color:var(--muted)]">Modality</label>
            <select
              value={addModality}
              onChange={(e) => {
                const v = e.target.value;
                if (isAddModality(v)) setAddModality(v);
              }}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
            >
              <option value="IN_HOME">In-home</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <label className="text-xs font-semibold text-[color:var(--muted)]">Notes</label>
          <textarea
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full rounded-2xl border border-[color:var(--ring)] bg-white px-4 py-3 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={addSession}
          disabled={saving}
          className="mt-3 rounded-xl bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add Session"}
        </button>
      </section>

      <section className="rounded-2xl border border-[color:var(--ring)] bg-white p-4">
        <h2 className="mb-3 font-semibold text-[color:var(--ink)]">Session History</h2>

        {sessions.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="space-y-1 border-t border-[color:var(--ring)] py-3 text-sm">
              <div className="font-semibold text-[color:var(--ink)]">
                {formatDate(s.startAt)} - {s.durationMinutes ?? 0} mins
              </div>

              <div className="text-[color:var(--muted)]">
                <strong className="text-[color:var(--ink)]">Status:</strong> {s.status || "-"}
              </div>

              <div className="text-[color:var(--muted)]">
                <strong className="text-[color:var(--ink)]">Modality:</strong>{" "}
                {s.modality === "ONLINE" ? "Online" : s.modality === "IN_HOME" ? "In-home" : "-"}
              </div>

              <div className="text-[color:var(--muted)]">
                <strong className="text-[color:var(--ink)]">Notes:</strong> {s.notes || "-"}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
