// src/app/hub/tutor/layout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";

type TutorAccessRequest = {
  status?: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  application?: {
    subjects?: string[];
    yearLevels?: string[];
    modes?: Array<"ONLINE" | "IN_HOME">;
    serviceArea?: string;
    abn?: string;
    wwccStatus?: string;
  };
  note?: string | null;
  decisionReason?: string | null;
  submittedAt?: { toDate?: () => Date } | null;
  reviewedAt?: { toDate?: () => Date } | null;
  reviewedByEmail?: string | null;
};

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useUserRole();
  const [mounted, setMounted] = useState(false);
  const [request, setRequest] = useState<TutorAccessRequest | null>(null);
  const [subjectsText, setSubjectsText] = useState("");
  const [yearLevelsText, setYearLevelsText] = useState("");
  const [modeOnline, setModeOnline] = useState(false);
  const [modeInHome, setModeInHome] = useState(false);
  const [serviceArea, setServiceArea] = useState("");
  const [abn, setAbn] = useState("");
  const [wwccStatus, setWwccStatus] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Must be logged in
  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
    });
    return () => off();
  }, [router]);

  // Must be tutor OR admin
  useEffect(() => {
    if (!mounted) return;
    if (role === null) return;
    if (role !== "tutor" && role !== "admin" && role !== "tutor_pending") router.replace("/hub");
  }, [role, router, mounted]);

  useEffect(() => {
    async function loadRequest() {
      const u = auth.currentUser;
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as { tutorAccessRequest?: TutorAccessRequest } | undefined;
      const req = data?.tutorAccessRequest ?? null;
      setRequest(req);
      setSubjectsText((req?.application?.subjects || []).join(", "));
      setYearLevelsText((req?.application?.yearLevels || []).join(", "));
      setModeOnline((req?.application?.modes || []).includes("ONLINE"));
      setModeInHome((req?.application?.modes || []).includes("IN_HOME"));
      setServiceArea(req?.application?.serviceArea || "");
      setAbn(req?.application?.abn || "");
      setWwccStatus(req?.application?.wwccStatus || "");
      setRequestNote(req?.note || "");
    }
    if (!mounted || role !== "tutor_pending") return;
    loadRequest();
  }, [mounted, role]);

  const navButtonBase =
    "rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition";
  const navInactive =
    navButtonBase +
    " border border-[color:var(--ring)] bg-white text-[color:var(--brand)] hover:bg-[#d6e5e3]/40";
  const navActive =
    navButtonBase +
    " bg-[color:var(--brand)] text-[color:var(--brand-contrast)]";

  const isTutorHome = pathname === "/hub/tutor";


  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/");
    }
  }

  const roleLabel = useMemo(() => {
    if (role === "admin") return "Admin";
    if (role === "tutor") return "Tutor";
    if (role === "tutor_pending") return "Tutor (Pending)";
    return "User";
  }, [role]);

  if (!mounted) return <div className="min-h-screen" />;
  if (role !== "tutor" && role !== "admin" && role !== "tutor_pending") {
    return <div className="min-h-screen" />;
  }

  async function submitTutorAccessRequest() {
    const u = auth.currentUser;
    if (!u) return;
    setRequestMsg(null);
    setRequestBusy(true);
    try {
      const note = requestNote.trim();
      const subjects = subjectsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const yearLevels = yearLevelsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const modes: Array<"ONLINE" | "IN_HOME"> = [];
      if (modeOnline) modes.push("ONLINE");
      if (modeInHome) modes.push("IN_HOME");
      const cleanAbn = abn.replace(/\s+/g, "");

      if (
        subjects.length === 0 ||
        yearLevels.length === 0 ||
        modes.length === 0 ||
        !serviceArea.trim() ||
        !cleanAbn ||
        !wwccStatus.trim()
      ) {
        setRequestMsg(
          "Please complete all required fields: subjects, year levels, mode, service area, ABN, and Blue Card/WWCC status."
        );
        return;
      }

      await setDoc(
        doc(db, "users", u.uid),
        {
          tutorAccessRequest: {
            status: "submitted",
            application: {
              subjects,
              yearLevels,
              modes,
              serviceArea: serviceArea.trim(),
              abn: cleanAbn,
              wwccStatus: wwccStatus.trim(),
            },
            note: note || null,
            submittedAt: serverTimestamp(),
            reviewedAt: null,
            reviewedByEmail: null,
            decisionReason: null,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.data() as { tutorAccessRequest?: TutorAccessRequest } | undefined;
      setRequest(data?.tutorAccessRequest ?? null);
      setRequestMsg("Access request submitted. Admin will review it in the Control Panel.");
    } catch {
      setRequestMsg("Could not submit request right now. Please try again.");
    } finally {
      setRequestBusy(false);
    }
  }

  if (role === "tutor_pending") {
    const submittedAt = request?.submittedAt?.toDate?.();
    const reviewedAt = request?.reviewedAt?.toDate?.();
    const isSubmitted = request?.status === "submitted" || request?.status === "under_review";
    return (
      <div className="app-bg min-h-[100svh]">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-xl font-semibold text-amber-900">Tutor Portal Temporarily Unavailable</h1>
            <p className="mt-2 text-sm text-amber-800">
              Your tutor account is pending admin approval.
            </p>
            <div className="mt-4 rounded-xl border border-amber-300 bg-white p-4">
              <p className="text-sm font-semibold text-amber-900">Request Tutor Access</p>
              <p className="mt-1 text-xs text-amber-800">
                Complete all required fields and submit for admin review.
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder="Subjects * (e.g. Math, English)"
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
                />
                <input
                  value={yearLevelsText}
                  onChange={(e) => setYearLevelsText(e.target.value)}
                  placeholder="Year levels * (e.g. 7-12)"
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold">Mode *</span>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={modeOnline} onChange={(e) => setModeOnline(e.target.checked)} />
                  Online
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={modeInHome} onChange={(e) => setModeInHome(e.target.checked)} />
                  In-home
                </label>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder="Suburb/service area *"
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
                />
                <input
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="ABN *"
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
                />
              </div>

              <input
                value={wwccStatus}
                onChange={(e) => setWwccStatus(e.target.value)}
                placeholder="Blue Card/WWCC status *"
                className="mt-2 w-full rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
              />

              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
                placeholder="Optional note"
                className="mt-2 w-full rounded-xl border border-amber-300 px-3 py-2 text-sm text-[color:var(--ink)]"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={requestBusy}
                  onClick={submitTutorAccessRequest}
                  className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40 disabled:opacity-60"
                >
                  {requestBusy ? "Submitting..." : isSubmitted ? "Resubmit request" : "Submit request"}
                </button>
                {isSubmitted && submittedAt && (
                  <span className="text-xs text-amber-800">
                    Last submitted: {submittedAt.toLocaleString()}
                  </span>
                )}
                {request?.status === "rejected" && (
                  <span className="text-xs font-semibold text-red-700">
                    Previous request was rejected.
                  </span>
                )}
                {request?.status === "approved" && (
                  <span className="text-xs font-semibold text-emerald-700">
                    Approved. Please refresh this page.
                  </span>
                )}
              </div>

              {reviewedAt && (
                <p className="mt-2 text-xs text-amber-800">
                  Last review: {reviewedAt.toLocaleString()}
                  {request?.reviewedByEmail ? ` by ${request.reviewedByEmail}` : ""}
                </p>
              )}
              {request?.status === "rejected" && request?.decisionReason && (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  Rejection reason: {request.decisionReason}
                </p>
              )}
              {requestMsg && (
                <p className="mt-2 text-xs font-semibold text-amber-900">{requestMsg}</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm transition hover:bg-[#d6e5e3]/40"
                onClick={() => router.push("/hub")}
              >
                Back to Hub
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] shadow-sm transition hover:bg-[#d6e5e3]/40"
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Tutor Top Bar */}
        <header className="mb-6 flex flex-col gap-3 rounded-2xl border border-[color:var(--ring)] bg-[color:var(--card)] px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/hub" className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-xl bg-[color:var(--brand)] shadow-sm">
                <Image
                  src="/logo.png"
                  alt="Studyroom"
                  fill
                  className="object-contain p-1.5"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Studyroom
                </span>
                <span className="text-sm font-semibold text-[color:var(--ink)]">
                  Tutor Portal
                </span>
              </div>
            </Link>
          
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={navInactive}
              onClick={() => router.push("/hub")}
            >
              Hub
            </button>

            <button
              type="button"
              className={isTutorHome ? navActive : navInactive}
              onClick={() => router.push("/hub/tutor")}
            >
              Tutor Home
            </button>



            <span className="ml-1 inline-flex items-center rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
              {roleLabel}
            </span>

            <button
              type="button"
              onClick={handleSignOut}
              className="ml-1 rounded-xl border border-[color:var(--ring)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] shadow-sm transition hover:bg-[#d6e5e3]/40"
            >
              Sign out
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
