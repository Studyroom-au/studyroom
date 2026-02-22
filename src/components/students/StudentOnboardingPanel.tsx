"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
  onboardingStatus?: "INCOMPLETE" | "COMPLETE";
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  school?: string | null;
  clientId?: string | null;
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
  assignedTutorName?: string | null;
  assignedTutorEmail?: string | null;
};

type Row<T> = { id: string; data: T };

type Props = {
  clients: Array<Row<ClientDoc>>;
  students: Array<Row<StudentDoc>>;
  selectedClientId?: string | null;
  onSelectClient?: (clientId: string) => void;
  onDone?: () => void;
};

type Mode = "online" | "in-home";
type PackagePlan = "CASUAL" | "PACKAGE_5" | "PACKAGE_12";

type FormState = {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  yearLevel: string;
  school: string;
  subjectsText: string;
  mode: Mode;
  suburb: string;
  addressLine1: string;
  postcode: string;
  availabilityText: string;
  goals: string;
  challenges: string;
  package: PackagePlan;
};

const EMPTY_FORM: FormState = {
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  studentName: "",
  yearLevel: "",
  school: "",
  subjectsText: "",
  mode: "in-home",
  suburb: "",
  addressLine1: "",
  postcode: "",
  availabilityText: "",
  goals: "",
  challenges: "",
  package: "CASUAL",
};

function normalizePackage(v?: string | null): PackagePlan {
  if (v === "PACKAGE_5" || v === "PACKAGE_12") return v;
  return "CASUAL";
}

function parseCsvLines(v: string) {
  return Array.from(
    new Set(
      v
        .split(/\r?\n|,/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

export default function StudentOnboardingPanel({
  clients,
  students,
  selectedClientId,
  onSelectClient,
  onDone,
}: Props) {
  const [clientId, setClientId] = useState(selectedClientId ?? "");
  const [studentId, setStudentId] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClientId && selectedClientId !== clientId) {
      setClientId(selectedClientId);
    }
  }, [selectedClientId, clientId]);

  const incompleteClients = useMemo(
    () => clients.filter((c) => (c.data.onboardingStatus ?? "INCOMPLETE") !== "COMPLETE"),
    [clients]
  );

  const client = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId]);
  const studentsForClient = useMemo(
    () => students.filter((s) => (s.data.clientId ?? "") === clientId),
    [students, clientId]
  );
  const student = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);

  useEffect(() => {
    if (!clientId) {
      setStudentId("");
      setForm(EMPTY_FORM);
      return;
    }

    const nextStudentId = studentsForClient[0]?.id ?? "__create__";
    setStudentId(nextStudentId);
  }, [clientId, studentsForClient]);

  useEffect(() => {
    if (!client) return;

    const s = student?.data;
    const c = client.data;

    setForm({
      parentName: c.parentName ?? "",
      parentEmail: c.parentEmail ?? "",
      parentPhone: c.parentPhone ?? "",
      studentName: s?.studentName ?? "",
      yearLevel: s?.yearLevel ?? "",
      school: s?.school ?? "",
      subjectsText: (s?.subjects ?? []).join(", "),
      mode: s?.mode === "online" ? "online" : c.mode === "online" ? "online" : "in-home",
      suburb: s?.suburb ?? c.suburb ?? "",
      addressLine1: s?.addressLine1 ?? c.addressLine1 ?? "",
      postcode: s?.postcode ?? c.postcode ?? "",
      availabilityText: (s?.availabilityBlocks ?? []).join("\n"),
      goals: s?.goals ?? "",
      challenges: s?.challenges ?? "",
      package: normalizePackage(s?.package ?? c.package),
    });
  }, [client, studentId, student]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveOnboarding() {
    setMsg(null);
    if (!clientId) {
      setMsg("Select a client first.");
      return;
    }
    if (form.parentName.trim().length < 2 || !form.parentEmail.includes("@")) {
      setMsg("Parent name and parent email are required.");
      return;
    }
    if (form.studentName.trim().length < 2 || form.yearLevel.trim().length < 1) {
      setMsg("Student name and year level are required.");
      return;
    }

    setSaving(true);
    try {
      const subjects = parseCsvLines(form.subjectsText);
      const availabilityBlocks = parseCsvLines(form.availabilityText);
      const activeClient = clients.find((c) => c.id === clientId);
      const existingStudent = studentId && studentId !== "__create__" ? students.find((s) => s.id === studentId) : null;

      const batch = writeBatch(db);
      const clientRef = doc(db, "clients", clientId);

      batch.set(
        clientRef,
        {
          parentName: form.parentName.trim(),
          parentEmail: form.parentEmail.trim(),
          parentPhone: form.parentPhone.trim() || null,
          mode: form.mode,
          suburb: form.suburb.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          postcode: form.postcode.trim() || null,
          package: form.package,
          onboardingStatus: "COMPLETE",
          onboardingCompletedAt: serverTimestamp(),
          onboardingCompletedBy: auth.currentUser?.uid ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const targetStudentRef =
        studentId === "__create__" || !studentId ? doc(collection(db, "students")) : doc(db, "students", studentId);

      const studentPatch: Record<string, unknown> = {
        clientId,
        studentName: form.studentName.trim(),
        yearLevel: form.yearLevel.trim(),
        school: form.school.trim() || null,
        subjects,
        mode: form.mode,
        suburb: form.suburb.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        postcode: form.postcode.trim() || null,
        availabilityBlocks,
        goals: form.goals.trim() || null,
        challenges: form.challenges.trim() || null,
        package: form.package,
        assignedTutorId:
          existingStudent?.data.assignedTutorId ?? activeClient?.data.assignedTutorId ?? null,
        assignedTutorName:
          existingStudent?.data.assignedTutorName ?? activeClient?.data.assignedTutorName ?? null,
        assignedTutorEmail:
          existingStudent?.data.assignedTutorEmail ?? activeClient?.data.assignedTutorEmail ?? null,
        updatedAt: serverTimestamp(),
        status: "active",
      };
      if (studentId === "__create__" || !studentId) {
        studentPatch.createdAt = serverTimestamp();
      }
      batch.set(targetStudentRef, studentPatch, { merge: true });

      await batch.commit();
      setMsg("Onboarding saved and profile updated.");
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to save onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[color:var(--ring)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">Student onboarding</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Complete onboarding for existing tutor/my-student records and sync profile fields.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/enrol"
            className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            Public enrol form
          </Link>
          <Link
            href="/hub/admin/leads"
            className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
          >
            Admin leads
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Client with incomplete onboarding</span>
          <select
            value={clientId}
            onChange={(e) => {
              const v = e.target.value;
              setClientId(v);
              onSelectClient?.(v);
            }}
            className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Select client</option>
            {incompleteClients.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.data.parentName || "Parent")} ({c.id})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Student profile</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={!clientId}
            className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm disabled:opacity-60"
          >
            {!clientId && <option value="">Select client first</option>}
            {clientId && studentsForClient.map((s) => (
              <option key={s.id} value={s.id}>
                {s.data.studentName || "Student"} ({s.id})
              </option>
            ))}
            {clientId && <option value="__create__">Create new student under this client</option>}
          </select>
        </label>
      </div>

      {clientId && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Parent name *</span>
            <input
              value={form.parentName}
              onChange={(e) => setField("parentName", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Parent email *</span>
            <input
              value={form.parentEmail}
              onChange={(e) => setField("parentEmail", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Parent phone</span>
            <input
              value={form.parentPhone}
              onChange={(e) => setField("parentPhone", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Mode</span>
            <select
              value={form.mode}
              onChange={(e) => setField("mode", (e.target.value === "online" ? "online" : "in-home") as Mode)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            >
              <option value="in-home">In-home</option>
              <option value="online">Online</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Student name *</span>
            <input
              value={form.studentName}
              onChange={(e) => setField("studentName", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Year level *</span>
            <input
              value={form.yearLevel}
              onChange={(e) => setField("yearLevel", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">School</span>
            <input
              value={form.school}
              onChange={(e) => setField("school", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Package</span>
            <select
              value={form.package}
              onChange={(e) => setField("package", normalizePackage(e.target.value))}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            >
              <option value="CASUAL">Casual</option>
              <option value="PACKAGE_5">5-session package</option>
              <option value="PACKAGE_12">12-session package</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Subjects (comma or new line)</span>
            <textarea
              value={form.subjectsText}
              onChange={(e) => setField("subjectsText", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
              rows={2}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Suburb</span>
            <input
              value={form.suburb}
              onChange={(e) => setField("suburb", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Postcode</span>
            <input
              value={form.postcode}
              onChange={(e) => setField("postcode", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Address line</span>
            <input
              value={form.addressLine1}
              onChange={(e) => setField("addressLine1", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Availability blocks (one per line)</span>
            <textarea
              value={form.availabilityText}
              onChange={(e) => setField("availabilityText", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
              rows={3}
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Goals</span>
            <textarea
              value={form.goals}
              onChange={(e) => setField("goals", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Challenges</span>
            <textarea
              value={form.challenges}
              onChange={(e) => setField("challenges", e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] px-3 py-2 text-sm"
              rows={2}
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={saveOnboarding}
          disabled={saving || !clientId}
          className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save onboarding and mark complete"}
        </button>
        {msg && <p className="text-sm text-[color:var(--muted)]">{msg}</p>}
      </div>
    </section>
  );
}
