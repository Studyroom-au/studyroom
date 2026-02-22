"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

type TutorOption = {
  uid: string;
  name: string;
  email: string;
};

type ClientOption = {
  id: string;
  parentName: string;
  parentEmail: string;
};

type PackagePlan = "CASUAL" | "PACKAGE_5" | "PACKAGE_12";
type Mode = "online" | "in-home";

type FormState = {
  selectedTutorId: string;
  selectedClientId: string;

  parentName: string;
  parentEmail: string;
  parentPhone: string;

  studentName: string;
  yearLevel: string;
  school: string;

  mode: Mode;
  suburb: string;
  addressLine1: string;
  postcode: string;

  subjectsText: string;
  availabilityText: string;
  goals: string;
  challenges: string;

  package: PackagePlan;

  reuseClientByEmail: boolean;
  markOnboardingComplete: boolean;
};

const EMPTY_FORM: FormState = {
  selectedTutorId: "",
  selectedClientId: "",

  parentName: "",
  parentEmail: "",
  parentPhone: "",

  studentName: "",
  yearLevel: "",
  school: "",

  mode: "in-home",
  suburb: "",
  addressLine1: "",
  postcode: "",

  subjectsText: "",
  availabilityText: "",
  goals: "",
  challenges: "",

  package: "CASUAL",

  reuseClientByEmail: true,
  markOnboardingComplete: true,
};

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function parseList(v: string) {
  return Array.from(
    new Set(
      v
        .split(/\r?\n|,/) 
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

export default function AdminAddExistingStudentPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rolesSnap = await getDocs(collection(db, "roles"));
        const tutorUids = rolesSnap.docs
          .map((d) => ({ uid: d.id, role: (d.data() as { role?: unknown }).role }))
          .filter((x) => x.role === "tutor")
          .map((x) => x.uid);

        const tutorRows = await Promise.all(
          tutorUids.map(async (uid) => {
            const us = await getDoc(doc(db, "users", uid));
            const data = us.exists() ? (us.data() as Record<string, unknown>) : {};
            return {
              uid,
              name:
                asString(data.displayName) ||
                asString(data.name) ||
                asString(data.fullName) ||
                "Tutor",
              email: asString(data.email) || asString(data.userEmail),
            };
          })
        );

        setTutors(tutorRows.sort((a, b) => a.name.localeCompare(b.name)));

        const clientSnap = await getDocs(query(collection(db, "clients"), limit(300)));
        const clientRows: ClientOption[] = clientSnap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            parentName: asString(data.parentName),
            parentEmail: asString(data.parentEmail),
          };
        });

        clientRows.sort((a, b) =>
          `${a.parentName} ${a.parentEmail}`.localeCompare(`${b.parentName} ${b.parentEmail}`)
        );

        setClients(clientRows);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const selectedTutor = useMemo(
    () => tutors.find((t) => t.uid === form.selectedTutorId) ?? null,
    [tutors, form.selectedTutorId]
  );

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreatedStudentId(null);
    setResolvedClientId(null);

    if (!auth.currentUser) {
      setMsg("You must be signed in.");
      return;
    }
    if (!form.selectedTutorId) {
      setMsg("Select a tutor.");
      return;
    }
    if (form.parentName.trim().length < 2 || !form.parentEmail.includes("@")) {
      setMsg("Parent name and valid parent email are required.");
      return;
    }
    if (form.studentName.trim().length < 2 || !form.yearLevel.trim()) {
      setMsg("Student name and year level are required.");
      return;
    }

    setSaving(true);
    try {
      const tutorName = selectedTutor?.name ?? null;
      const tutorEmail = selectedTutor?.email ?? null;
      const normalizedEmail = form.parentEmail.trim().toLowerCase();

      let clientId = form.selectedClientId.trim();

      if (!clientId && form.reuseClientByEmail) {
        const q = query(collection(db, "clients"), where("parentEmail", "==", normalizedEmail), limit(1));
        const hit = await getDocs(q);
        if (!hit.empty) clientId = hit.docs[0].id;
      }

      if (clientId) {
        await updateDoc(doc(db, "clients", clientId), {
          parentName: form.parentName.trim(),
          parentEmail: normalizedEmail,
          parentPhone: form.parentPhone.trim() || null,
          mode: form.mode,
          suburb: form.suburb.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          postcode: form.postcode.trim() || null,
          package: form.package,
          assignedTutorId: form.selectedTutorId,
          assignedTutorName: tutorName,
          assignedTutorEmail: tutorEmail,
          onboardingStatus: form.markOnboardingComplete ? "COMPLETE" : "INCOMPLETE",
          onboardingCompletedAt: form.markOnboardingComplete ? serverTimestamp() : null,
          onboardingCompletedBy: form.markOnboardingComplete ? auth.currentUser.uid : null,
          updatedAt: serverTimestamp(),
        });
      } else {
        const cRef = await addDoc(collection(db, "clients"), {
          parentName: form.parentName.trim(),
          parentEmail: normalizedEmail,
          parentPhone: form.parentPhone.trim() || null,
          mode: form.mode,
          suburb: form.suburb.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          postcode: form.postcode.trim() || null,
          package: form.package,
          assignedTutorId: form.selectedTutorId,
          assignedTutorName: tutorName,
          assignedTutorEmail: tutorEmail,
          status: "active",
          onboardingStatus: form.markOnboardingComplete ? "COMPLETE" : "INCOMPLETE",
          onboardingCompletedAt: form.markOnboardingComplete ? serverTimestamp() : null,
          onboardingCompletedBy: form.markOnboardingComplete ? auth.currentUser.uid : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        clientId = cRef.id;
      }

      const subjects = parseList(form.subjectsText);
      const availabilityBlocks = parseList(form.availabilityText);

      const sRef = await addDoc(collection(db, "students"), {
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
        assignedTutorId: form.selectedTutorId,
        assignedTutorName: tutorName,
        assignedTutorEmail: tutorEmail,
        tutorConfirmedAt: null,
        tutorConfirmedBy: null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCreatedStudentId(sRef.id);
      setResolvedClientId(clientId);
      setMsg("Existing student migrated successfully.");

      setForm((prev) => ({
        ...EMPTY_FORM,
        selectedTutorId: prev.selectedTutorId,
      }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom � Admin � Migration
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Add Existing Student</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Use this for tutor transition and manual backfill. It creates a student profile and links to an existing or new client.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-[color:var(--ring)] bg-[color:var(--card)] p-5 shadow-sm space-y-5">
        {loading ? (
          <div className="text-sm text-[color:var(--muted)]">Loading tutors and clients...</div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Assign tutor *</span>
                <select
                  value={form.selectedTutorId}
                  onChange={(e) => setField("selectedTutorId", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select tutor</option>
                  {tutors.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.name}{t.email ? ` (${t.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Use existing client (optional)</span>
                <select
                  value={form.selectedClientId}
                  onChange={(e) => setField("selectedClientId", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Auto by parent email / create new</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.parentName || "Parent")} - {c.parentEmail || c.id}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Parent name *</span>
                <input
                  value={form.parentName}
                  onChange={(e) => setField("parentName", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Parent email *</span>
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => setField("parentEmail", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Parent phone</span>
                <input
                  value={form.parentPhone}
                  onChange={(e) => setField("parentPhone", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Student name *</span>
                <input
                  value={form.studentName}
                  onChange={(e) => setField("studentName", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Year level *</span>
                <input
                  value={form.yearLevel}
                  onChange={(e) => setField("yearLevel", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">School</span>
                <input
                  value={form.school}
                  onChange={(e) => setField("school", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Mode</span>
                <select
                  value={form.mode}
                  onChange={(e) => setField("mode", (e.target.value === "online" ? "online" : "in-home") as Mode)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                >
                  <option value="in-home">In-home</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Suburb</span>
                <input
                  value={form.suburb}
                  onChange={(e) => setField("suburb", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Postcode</span>
                <input
                  value={form.postcode}
                  onChange={(e) => setField("postcode", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Address line</span>
                <input
                  value={form.addressLine1}
                  onChange={(e) => setField("addressLine1", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Subjects (comma or new line)</span>
                <textarea
                  value={form.subjectsText}
                  onChange={(e) => setField("subjectsText", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Availability blocks (comma or new line)</span>
                <textarea
                  value={form.availabilityText}
                  onChange={(e) => setField("availabilityText", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Goals</span>
                <textarea
                  value={form.goals}
                  onChange={(e) => setField("goals", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Challenges</span>
                <textarea
                  value={form.challenges}
                  onChange={(e) => setField("challenges", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Package</span>
                <select
                  value={form.package}
                  onChange={(e) => setField("package", (e.target.value as PackagePlan) || "CASUAL")}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                >
                  <option value="CASUAL">Casual</option>
                  <option value="PACKAGE_5">5-session package</option>
                  <option value="PACKAGE_12">12-session package</option>
                </select>
              </label>
            </section>

            <section className="grid gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.reuseClientByEmail}
                  onChange={(e) => setField("reuseClientByEmail", e.target.checked)}
                />
                Reuse existing client by parent email when found
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.markOnboardingComplete}
                  onChange={(e) => setField("markOnboardingComplete", e.target.checked)}
                />
                Mark client onboarding complete now
              </label>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create and link student"}
              </button>

              <Link
                href="/hub/admin/clients"
                className="rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
              >
                Open clients
              </Link>
            </div>
          </>
        )}

        {msg && <p className="text-sm text-[color:var(--muted)]">{msg}</p>}

        {createdStudentId && (
          <p className="text-sm text-[color:var(--ink)]">
            Student created: <code>{createdStudentId}</code>
            {resolvedClientId ? (
              <>
                {" "}� Client: <code>{resolvedClientId}</code> � {" "}
                <Link href={`/hub/admin/students/${createdStudentId}`} className="font-semibold text-[color:var(--brand)] hover:underline">
                  Open student
                </Link>
              </>
            ) : null}
          </p>
        )}
      </form>

      <div>
        <Link
          href="/hub/admin"
          className="inline-flex items-center justify-center rounded-xl border border-[color:var(--ring)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[#d6e5e3]/40"
        >
          Back to Admin Home
        </Link>
      </div>
    </div>
  );
}
