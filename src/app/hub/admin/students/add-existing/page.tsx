//src/app/hub/admin/students/add-existing/page
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { normalizeMode, normalizePlanType, type DiscountType } from "@/lib/studyroom/billing";
import {
  SUBJECT_OPTIONS,
  YEAR_LEVELS,
  AVAILABILITY_DAYS,
  AVAILABILITY_SLOTS,
  makeAvailabilityBlock,
  validateEnrolmentFields,
} from "@/lib/studyroom/enrolmentFields";

// Release 1B, Stage 5c: this form now collects the same fields, the same
// way, as the public /enrol form (shared constants + shared validation from
// enrolmentFields.ts) — the only difference is the admin-only extras below
// (tutor assignment, package confirmation, onboarding status) that a parent
// should never control themselves.
//
// Package/entitlement creation now goes through POST /api/plans/create
// (Admin SDK, server-validated) instead of writing plans/entitlements
// directly — firestore.rules blocks that client-side write entirely as of
// Release 1B Stage 4, so this also fixes what would otherwise be a broken
// "permission denied" on every package assignment through this form.

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

type PackagePlan = "CASUAL" | "PACKAGE_5" | "PACKAGE_10";
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

  subjects: string[];
  availabilityBlocks: string[];
  goals: string;
  challenges: string;

  package: PackagePlan;
  discountType: DiscountType | "";
  discountValue: string;
  discountReason: string;

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

  subjects: [],
  availabilityBlocks: [],
  goals: "",
  challenges: "",

  package: "CASUAL",
  discountType: "",
  discountValue: "",
  discountReason: "",

  reuseClientByEmail: true,
  markOnboardingComplete: true,
};

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AdminAddExistingStudentPageInner() {
  const searchParams = useSearchParams();
  // "Add new child" from an already-open family page (final pre-release
  // addition) — the family is already known, so preselect and lock it,
  // skipping the parent-email family-match prompt below (admin has already
  // explicitly chosen this family).
  const preselectedClientId = searchParams.get("clientId") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, selectedClientId: preselectedClientId });
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);

  // Sibling/family-enrolment detection: reuses the existing parent-email
  // match (below) rather than a second matching system, but surfaces it as a
  // confirmation instead of silently auto-linking.
  const [familyMatch, setFamilyMatch] = useState<{ clientId: string; parentName: string; studentNames: string[] } | null>(null);
  const [familyMatchDecided, setFamilyMatchDecided] = useState(false);

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

  function toggleSubject(item: string) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(item) ? prev.subjects.filter((x) => x !== item) : [...prev.subjects, item],
    }));
  }

  function toggleAvailability(day: string, slot: string) {
    const key = makeAvailabilityBlock(day, slot);
    setForm((prev) => ({
      ...prev,
      availabilityBlocks: prev.availabilityBlocks.includes(key)
        ? prev.availabilityBlocks.filter((x) => x !== key)
        : [...prev.availabilityBlocks, key],
    }));
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

    // Same canonical validation as the public /enrol form — availability is
    // relaxed (not hard-required) here since this form is also used for
    // backfilling an existing student whose schedule is already established.
    const validationError = validateEnrolmentFields({
      parentName: form.parentName,
      parentEmail: form.parentEmail,
      parentPhone: form.parentPhone,
      studentName: form.studentName,
      yearLevel: form.yearLevel,
      subjects: form.subjects,
      mode: form.mode,
      suburb: form.suburb,
      availabilityBlocks: form.availabilityBlocks,
      requireAvailability: false,
    });
    if (validationError) {
      setMsg(validationError);
      return;
    }

    // Sibling/family-enrolment detection — only when admin hasn't already
    // explicitly picked a client from the dropdown and hasn't already
    // decided on this session's match prompt. Reuses the exact same
    // parent-email lookup the submit flow already performs below; this just
    // surfaces it as a confirmation instead of silently auto-linking.
    if (!form.selectedClientId.trim() && form.reuseClientByEmail && !familyMatchDecided) {
      const normalizedEmail = form.parentEmail.trim().toLowerCase();
      const q = query(collection(db, "clients"), where("parentEmail", "==", normalizedEmail), limit(1));
      const hit = await getDocs(q);
      if (!hit.empty) {
        const foundClientId = hit.docs[0].id;
        const foundClient = hit.docs[0].data() as { parentName?: string };
        const siblingsSnap = await getDocs(query(collection(db, "students"), where("clientId", "==", foundClientId)));
        setFamilyMatch({
          clientId: foundClientId,
          parentName: foundClient.parentName || "This parent",
          studentNames: siblingsSnap.docs.map((d) => String((d.data() as { studentName?: string }).studentName ?? "Student")),
        });
        return; // Wait for admin's Link / Keep separate decision before saving anything.
      }
    }

    await performSubmit(form.selectedClientId.trim());
  }

  async function performSubmit(preselectedClientId: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setMsg("You must be signed in.");
      return;
    }
    setSaving(true);
    try {
      const tutorName = selectedTutor?.name ?? null;
      const tutorEmail = selectedTutor?.email ?? null;
      const normalizedEmail = form.parentEmail.trim().toLowerCase();
      const normalizedPlan = normalizePlanType(form.package);
      const normalizedMode = normalizeMode(form.mode);

      // clientId starts as whatever was resolved before calling performSubmit
      // (explicitly chosen in the dropdown, or decided via the family-match
      // prompt — Link -> the matched clientId; Keep separate -> deliberately
      // empty, creating a new client below).
      let clientId = preselectedClientId;

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
          onboardingCompletedBy: form.markOnboardingComplete ? currentUser.uid : null,
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
          onboardingCompletedBy: form.markOnboardingComplete ? currentUser.uid : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        clientId = cRef.id;
      }

      const sRef = await addDoc(collection(db, "students"), {
        clientId,
        studentName: form.studentName.trim(),
        yearLevel: form.yearLevel.trim(),
        school: form.school.trim() || null,
        subjects: form.subjects,
        mode: form.mode,
        suburb: form.suburb.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        postcode: form.postcode.trim() || null,
        availabilityBlocks: form.availabilityBlocks,
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

      // This form always creates a brand-new student (sRef, above) — there is
      // no "select an existing student" option here — so this student can
      // never already have a plan, even if the chosen client is an existing
      // family with other students who already have their own packages.
      // Multi-student-family correction: a sibling always gets its own plan.
      const idToken = await currentUser.getIdToken();
      const discountType = form.discountType || null;
      // Admin enters dollars for a fixed discount (e.g. "20.00") — only the
      // API/Firestore layer deals in cents. Percent is entered/sent as-is.
      const discountValue =
        discountType === "fixed"
          ? Math.round(Number(form.discountValue) * 100)
          : discountType === "percent"
            ? Number(form.discountValue)
            : null;
      const res = await fetch("/api/plans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          clientId,
          studentId: sRef.id,
          tutorId: form.selectedTutorId,
          tutorEmail,
          mode: normalizedMode,
          planType: normalizedPlan,
          discountType,
          discountValue,
          discountReason: form.discountReason || null,
        }),
      });
      const planResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(planResult?.error || "Student profile was created, but the package could not be set up.");
      }

      setCreatedStudentId(sRef.id);
      setResolvedClientId(clientId);
      setMsg("Existing student migrated successfully.");

      setForm((prev) => ({
        ...EMPTY_FORM,
        selectedTutorId: prev.selectedTutorId,
      }));
      setFamilyMatchDecided(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create student.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkFamily() {
    if (!familyMatch) return;
    const clientId = familyMatch.clientId;
    setFamilyMatchDecided(true);
    setField("selectedClientId", clientId);
    setFamilyMatch(null);
    await performSubmit(clientId);
  }

  async function handleKeepSeparate() {
    setFamilyMatchDecided(true);
    setFamilyMatch(null);
    await performSubmit("");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Studyroom · Admin · Migration
        </p>
        <h1 className="text-3xl font-semibold text-[color:var(--ink)]">Add Existing Student</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Use this for tutor transition and manual backfill. It collects the same information as the public
          enrolment form, plus tutor assignment and package setup that only admin should control.
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
                  disabled={!!preselectedClientId}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm disabled:bg-[#f4f7f9] disabled:text-[color:var(--muted)]"
                >
                  <option value="">Auto by parent email / create new</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.parentName || "Parent")} - {c.parentEmail || c.id}
                    </option>
                  ))}
                </select>
                {preselectedClientId && (
                  <span className="block text-[11px] text-[color:var(--muted)]">
                    Adding a new child directly to this family — family selection is locked.
                  </span>
                )}
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
                <span className="text-xs font-semibold text-[color:var(--muted)]">Parent phone *</span>
                <input
                  value={form.parentPhone}
                  onChange={(e) => setField("parentPhone", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
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
                <select
                  value={form.yearLevel}
                  onChange={(e) => setField("yearLevel", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select…</option>
                  {YEAR_LEVELS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
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
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                  Suburb {form.mode === "in-home" ? "*" : "(optional)"}
                </span>
                <input
                  value={form.suburb}
                  onChange={(e) => setField("suburb", e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                  required={form.mode === "in-home"}
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

            <section className="space-y-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Subjects *</span>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((s) => {
                  const selected = form.subjects.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSubject(s)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                        selected
                          ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)] ring-[color:var(--brand)]"
                          : "bg-white text-[color:var(--brand)] ring-[color:var(--ring)] hover:bg-[#d6e5e3]/40"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <span className="text-xs font-semibold text-[color:var(--muted)]">
                Availability (optional for backfill)
              </span>
              <div className="overflow-x-auto rounded-2xl ring-1 ring-[color:var(--ring)] bg-white/70">
                <table className="min-w-[640px] w-full text-sm">
                  <thead className="text-left text-xs font-semibold text-[color:var(--muted)]">
                    <tr>
                      <th className="px-2 py-2">Time</th>
                      {AVAILABILITY_DAYS.map((d) => (
                        <th key={d} className="px-2 py-2 text-center">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AVAILABILITY_SLOTS.map((slot) => (
                      <tr key={slot} className="border-t border-[color:var(--ring)]">
                        <td className="px-2 py-2 font-semibold text-[color:var(--ink)] whitespace-nowrap">{slot}</td>
                        {AVAILABILITY_DAYS.map((day) => {
                          const key = makeAvailabilityBlock(day, slot);
                          const selected = form.availabilityBlocks.includes(key);
                          return (
                            <td key={day} className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleAvailability(day, slot)}
                                aria-pressed={selected}
                                aria-label={`${day} ${slot}`}
                                className={cn(
                                  "h-8 w-8 rounded-lg ring-1 transition",
                                  selected
                                    ? "bg-[color:var(--brand)] text-[color:var(--brand-contrast)] ring-[color:var(--brand)]"
                                    : "bg-white text-[color:var(--brand)] ring-[color:var(--ring)] hover:bg-[#d6e5e3]/40"
                                )}
                              >
                                {selected ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
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
            </section>

            {/* Admin-only: package confirmation. A parent never sets this — it's what actually creates the plan/entitlement/invoice. */}
            <section className="grid gap-3 md:grid-cols-2 rounded-2xl border border-dashed border-[color:var(--ring)] p-4">
              <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Admin only — package confirmation
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[color:var(--muted)]">Package</span>
                <select
                  value={form.package}
                  onChange={(e) => setField("package", (e.target.value as PackagePlan) || "CASUAL")}
                  className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                >
                  <option value="CASUAL">Casual</option>
                  <option value="PACKAGE_5">5-session package</option>
                  <option value="PACKAGE_10">10-session package</option>
                </select>
              </label>
              {form.package !== "CASUAL" && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Discount (optional)</span>
                    <select
                      value={form.discountType}
                      onChange={(e) => setField("discountType", e.target.value as DiscountType | "")}
                      className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">No discount</option>
                      <option value="percent">Percentage off</option>
                      <option value="fixed">Fixed dollar off</option>
                    </select>
                  </label>
                  {form.discountType && (
                    <>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">
                          {form.discountType === "percent" ? "Percent (0-100)" : "Amount off (AUD)"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step={form.discountType === "percent" ? "1" : "0.01"}
                          placeholder={form.discountType === "percent" ? "e.g. 10" : "e.g. 20.00"}
                          value={form.discountValue}
                          onChange={(e) => setField("discountValue", e.target.value)}
                          className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold text-[color:var(--muted)]">Reason</span>
                        <input
                          value={form.discountReason}
                          onChange={(e) => setField("discountReason", e.target.value)}
                          className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </>
                  )}
                </>
              )}
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

            {familyMatch && (
              <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-900">Possible existing family found</p>
                <p className="text-sm text-amber-900">
                  A client already exists for this parent email: <strong>{familyMatch.parentName}</strong>
                  {familyMatch.studentNames.length > 0 && (
                    <> — existing student{familyMatch.studentNames.length === 1 ? "" : "s"}: {familyMatch.studentNames.join(", ")}</>
                  )}
                </p>
                <p className="text-xs text-amber-800">
                  If this is the same family, the new student is added as a sibling under the existing client — their tutor,
                  package, and entitlement are never changed. If this is a different family, keep them separate.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLinkFamily}
                    disabled={saving}
                    className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Link to existing family
                  </button>
                  <button
                    type="button"
                    onClick={handleKeepSeparate}
                    disabled={saving}
                    className="rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                  >
                    Keep as separate family
                  </button>
                </div>
              </section>
            )}

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
                {" "}· Client: <code>{resolvedClientId}</code> ·{" "}
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

export default function AdminAddExistingStudentPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10 text-sm text-[color:var(--muted)]">Loading…</div>}>
      <AdminAddExistingStudentPageInner />
    </Suspense>
  );
}
