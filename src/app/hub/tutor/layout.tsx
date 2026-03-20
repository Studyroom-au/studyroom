// src/app/hub/tutor/layout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUserRole } from "@/hooks/useUserRole";
import PortalHeader from "@/components/hub/PortalHeader";

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
      <div className="app-bg page-shell min-h-[100svh]">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <section
            className="rounded-[32px] p-6"
            style={{
              background: "linear-gradient(138deg, #fffbf0 0%, #fff8e8 100%)",
              border: "1px solid #e8c96a",
              borderTop: "2.5px solid #c49a14",
              boxShadow: "0 2px 12px rgba(170, 120, 10, 0.09), 0 8px 28px rgba(170, 120, 10, 0.06)",
            }}
          >
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-700">
                Studyroom Tutor Access
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-amber-950">
                Tutor Portal temporarily unavailable
              </h1>
              <p className="text-sm leading-relaxed text-amber-900/80">
                Your account is still awaiting admin approval. Submit or update your access request below and we will keep the rest of the tutor workflow untouched.
              </p>
            </div>

            <div
              className="mt-5 rounded-[22px] p-5"
              style={{ background: "rgba(255,255,255,0.94)", border: "1px solid #e0c060" }}
            >
              <p className="text-sm font-bold text-amber-900">Request Tutor Access</p>
              <p className="mt-1 text-xs text-amber-800">
                Complete all required fields and submit for admin review.
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder="Subjects * (e.g. Math, English)"
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <input
                  value={yearLevelsText}
                  onChange={(e) => setYearLevelsText(e.target.value)}
                  placeholder="Year levels * (e.g. 7-12)"
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-amber-300 bg-white px-4 py-3 text-xs text-amber-900">
                <span className="font-bold">Mode *</span>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={modeOnline} onChange={(e) => setModeOnline(e.target.checked)} />
                  Online
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={modeInHome} onChange={(e) => setModeInHome(e.target.checked)} />
                  In-home
                </label>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder="Suburb/service area *"
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <input
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="ABN *"
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <input
                value={wwccStatus}
                onChange={(e) => setWwccStatus(e.target.value)}
                placeholder="Blue Card/WWCC status *"
                className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />

              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
                placeholder="Optional note"
                className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-[color:var(--ink)] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={requestBusy}
                  onClick={submitTutorAccessRequest}
                  className="rounded-full bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-950 disabled:opacity-60"
                >
                  {requestBusy ? "Submitting..." : isSubmitted ? "Resubmit request" : "Submit request"}
                </button>
                {isSubmitted && submittedAt && (
                  <span className="text-xs text-amber-700">
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
                <p className="mt-2 text-xs text-amber-700">
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

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-50"
                style={{ border: "1px solid #d4a835" }}
                onClick={() => router.push("/hub")}
              >
                Back to Hub
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                style={{ border: "1px solid #e0c060" }}
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
    <div className="app-bg page-shell min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <PortalHeader
          homeHref="/hub/tutor"
          eyebrow="Studyroom Tutor"
          title="Tutor Portal"
          subtitle="Manage leads, students, sessions, and payouts in one structured workspace."
          roleLabel={roleLabel}
          onSignOut={handleSignOut}
          navItems={[
            { label: "Hub", href: "/hub" },
            { label: "Tutor Home", href: "/hub/tutor", active: isTutorHome },
            { label: "Marketplace", href: "/hub/tutor/leads", active: pathname.startsWith("/hub/tutor/leads") },
            { label: "Students", href: "/hub/tutor/students", active: pathname.startsWith("/hub/tutor/students") },
            { label: "Sessions", href: "/hub/tutor/sessions", active: pathname.startsWith("/hub/tutor/sessions") },
            { label: "Payouts", href: "/hub/tutor/payouts", active: pathname.startsWith("/hub/tutor/payouts") },
            { label: "Resources", href: "/hub/tutor/resources", active: pathname.startsWith("/hub/tutor/resources") },
          ]}
        />

        {children}
      </div>
    </div>
  );
}
