//src/app/hub/tutor/sessions/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import type { EventClickArg, EventDropArg, EventContentArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";

import Drawer from "@/components/ui/Drawer";
import RescheduleSession from "@/components/session/RescheduleSession";
import SessionLogEditor from "@/components/session/SessionLogEditor";
import {
  SESSION_DURATION_MINS,
  formatModeLabel,
  formatPlanLabel,
  formatSessionStatusLabel,
  normalizeMode,
  normalizePlanType,
  normalizeSessionStatus,
  type BillingOutcome,
  type InvoiceStatus,
  type StudyroomEntitlementRecord,
  type StudyroomPlanRecord,
} from "@/lib/studyroom/billing";

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;
  studentId: string;
  clientId?: string | null;
  planId?: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes?: number;
  durationMins?: number;
  status: string;
  billingStatus?: string;
  billingOutcome?: BillingOutcome | null;
  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  mode?: "in_home" | "online" | "group" | null;
  graceApplied?: boolean | null;
  noticeHours?: number | null;
  consumed?: boolean | null;
  invoiceId?: string | null;
  xeroInvoiceId?: string | null;
  seriesKey?: string | null;
  notes?: string | null;
};

type StudentDoc = {
  studentName?: string;
  yearLevel?: string;
  clientId?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
  assignedTutorId?: string;
  assignedTutorEmail?: string;
  activePlanId?: string | null;
  package?: string | null;
  mode?: "online" | "in-home" | null;
};

type ClientDoc = {
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  postcode?: string | null;
};

type InvoiceDoc = {
  status?: InvoiceStatus | null;
  xeroInvoiceId?: string | null;
};

type AddModality = "IN_HOME" | "ONLINE";

function isAddModality(v: string): v is AddModality {
  return v === "IN_HOME" || v === "ONLINE";
}

function getErrorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Something went wrong.";
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function niceRange(start: Date, end: Date) {
  return `${fmtTime(start)}–${fmtTime(end)}`;
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function upcomingDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export default function TutorSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; data: SessionDoc }>>([]);
  const [students, setStudents] = useState<Record<string, StudentDoc>>({});
  const [clients, setClients] = useState<Record<string, ClientDoc>>({});
  const [plans, setPlans] = useState<Record<string, StudyroomPlanRecord>>({});
  const [entitlements, setEntitlements] = useState<Record<string, StudyroomEntitlementRecord>>({});
  const [invoices, setInvoices] = useState<Record<string, InvoiceDoc>>({});

  const [openId, setOpenId] = useState<string | null>(null);

  // Add Session Drawer
  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDate, setAddDate] = useState(""); // yyyy-mm-dd
  const [addTime, setAddTime] = useState("15:00"); // HH:MM 24h
  const [addDuration, setAddDuration] = useState(SESSION_DURATION_MINS);
  const [addModality, setAddModality] = useState<AddModality>("IN_HOME");
  const [addNotes, setAddNotes] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Recurring
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [recurringBusy, setRecurringBusy] = useState(false);

  // Address editor
  const [addressDraft, setAddressDraft] = useState({
    addressLine1: "",
    suburb: "",
    postcode: "",
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [xeroPushing, setXeroPushing] = useState(false);
  const [xeroMsg, setXeroMsg] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileViewDate, setMobileViewDate] = useState(new Date());
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [addressMsg, setAddressMsg] = useState<string | null>(null);
  const [drawerMsg, setDrawerMsg] = useState<string | null>(null);
  // Edit inline form
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("15:00");
  const [editMode, setEditMode] = useState<"IN_HOME" | "ONLINE">("IN_HOME");
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  // Delete
  const [deleting, setDeleting] = useState(false);

  const pushInvoiceToXero = useCallback(async (invoiceId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setXeroPushing(true);
    setXeroMsg(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/billing/push-invoice-to-xero", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ invoiceId }),
      });
      const json = await res.json();
      if (!res.ok) { setXeroMsg(json.error || "Failed"); return; }
      setXeroMsg("Pushed to Xero");
      setInvoices((prev) => ({ ...prev, [invoiceId]: { ...prev[invoiceId], status: "sent" } }));
    } catch (e) {
      setXeroMsg(getErrorMessage(e));
    } finally {
      setXeroPushing(false);
    }
  }, []);

  const openSession = useMemo(
    () => sessions.find((s) => s.id === openId) ?? null,
    [openId, sessions]
  );

  const openStudent = useMemo(() => {
    if (!openSession) return null;
    return students[openSession.data.studentId] ?? null;
  }, [openSession, students]);

  const openClient = useMemo(() => {
    if (!openSession) return null;
    const cid = openSession.data.clientId || openStudent?.clientId || "";
    if (!cid) return null;
    return clients[cid] ?? null;
  }, [openSession, openStudent, clients]);
  const openPlan = useMemo(() => {
    const planId = openSession?.data.planId ?? openStudent?.activePlanId ?? "";
    return planId ? plans[planId] ?? null : null;
  }, [openSession, openStudent, plans]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openEntitlement = useMemo(() => {
    const planId = openSession?.data.planId ?? openStudent?.activePlanId ?? "";
    return planId ? entitlements[planId] ?? null : null;
  }, [openSession, openStudent, entitlements]);
  const openInvoice = useMemo(() => {
    const invoiceId = openSession?.data.invoiceId ?? "";
    return invoiceId ? invoices[invoiceId] ?? null : null;
  }, [openSession, invoices]);

  const packageWarnings = useMemo(() => {
    const warnings: Array<{ key: string; studentName: string; remaining: number; urgent: boolean }> = [];
    for (const [planId, ent] of Object.entries(entitlements)) {
      const remaining = Number(ent.remainingSessions ?? 0);
      if (remaining <= 0 || remaining > 3) continue;
      const studentEntry = Object.entries(students).find(([, s]) => s.activePlanId === planId);
      if (!studentEntry) continue;
      const studentName = studentEntry[1].studentName ?? "Student";
      warnings.push({ key: planId, studentName, remaining, urgent: remaining === 1 });
    }
    return warnings.sort((a, b) => a.remaining - b.remaining);
  }, [entitlements, students]);

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return sessions
      .filter(s => {
        const start = s.data.startAt?.toDate?.();
        const status = normalizeSessionStatus(s.data.status);
        return start && start >= now && start <= cutoff && !status.includes("cancel");
      })
      .sort((a, b) => a.data.startAt.toDate().getTime() - b.data.startAt.toDate().getTime())
      .slice(0, 20);
  }, [sessions]);

  const sessionStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    let todayCount = 0;
    let weekCount = 0;
    let nextSession: { start: Date; studentName: string } | null = null;
    for (const s of sessions) {
      const start = s.data.startAt?.toDate?.();
      if (!start) continue;
      const status = normalizeSessionStatus(s.data.status);
      if (status.includes("cancel")) continue;
      if (start >= todayStart && start < todayEnd) todayCount++;
      if (start >= weekStart && start < weekEnd) weekCount++;
      if (start >= now && (!nextSession || start < nextSession.start)) {
        nextSession = { start, studentName: students[s.data.studentId]?.studentName ?? "Session" };
      }
    }
    return { todayCount, weekCount, nextSession };
  }, [sessions, students]);

  useEffect(() => {
    setBillingExpanded(!!openSession?.data.billingOutcome);
    setEditOpen(false);
    setEditMsg(null);
  }, [openSession]);

  useEffect(() => {
    if (!openStudent) return;
    setAddressDraft({
      addressLine1: openStudent.addressLine1 || "",
      suburb: openStudent.suburb || "",
      postcode: openStudent.postcode || "",
    });
  }, [openStudent]);

  const studentLabel = useCallback(
    (studentId: string) => {
      const s = students[studentId];
      if (!s) return "Session";
      const yr = s.yearLevel ? ` (${s.yearLevel})` : "";
      return `${s.studentName ?? "Student"}${yr}`;
    },
    [students]
  );

  const refresh = useCallback(
    async (uid: string, email?: string | null) => {
      if (!uid) return;
      setLoading(true);
      try {
        const sessionSnap = await getDocs(
          query(collection(db, "sessions"), where("tutorId", "==", uid), orderBy("startAt", "asc"))
        );

        const nextSessions = sessionSnap.docs.map((d) => ({
          id: d.id,
          data: d.data() as SessionDoc,
        }));
        setSessions(nextSessions);

        // Students: by assignedTutorId, fallback to assignedTutorEmail
        let studentSnap = await getDocs(query(collection(db, "students"), where("assignedTutorId", "==", uid)));

        if (studentSnap.empty && email) {
          studentSnap = await getDocs(
            query(collection(db, "students"), where("assignedTutorEmail", "==", email.toLowerCase()))
          );
        }

        const studentMap: Record<string, StudentDoc> = {};
        studentSnap.docs.forEach((d) => {
          studentMap[d.id] = d.data() as StudentDoc;
        });
        setStudents(studentMap);

        // default student for add drawer
        setAddStudentId((prev) => {
          if (prev) return prev;
          const first = Object.keys(studentMap)[0];
          return first ?? "";
        });

        const clientIds = Array.from(
          new Set(
            nextSessions
              .map((s) => s.data.clientId)
              .concat(Object.values(studentMap).map((s) => s.clientId || null))
              .filter(Boolean) as string[]
          )
        );

        const clientMap: Record<string, ClientDoc> = {};
        await Promise.all(
          clientIds.map(async (id) => {
            const snap = await getDoc(doc(db, "clients", id));
            if (snap.exists()) clientMap[id] = snap.data() as ClientDoc;
          })
        );
        setClients(clientMap);

        const planIds = Array.from(
          new Set(
            nextSessions
              .map((s) => s.data.planId)
              .concat(Object.values(studentMap).map((s) => s.activePlanId || null))
              .filter(Boolean) as string[]
          )
        );

        const planMap: Record<string, StudyroomPlanRecord> = {};
        const entitlementMap: Record<string, StudyroomEntitlementRecord> = {};
        await Promise.all(
          planIds.map(async (id) => {
            const planSnap = await getDoc(doc(db, "plans", id));
            if (planSnap.exists()) {
              planMap[id] = { id, ...(planSnap.data() as StudyroomPlanRecord) };
            }
            const entitlementSnap = await getDoc(doc(db, "entitlements", id));
            if (entitlementSnap.exists()) {
              entitlementMap[id] = { id, ...(entitlementSnap.data() as StudyroomEntitlementRecord) };
            }
          })
        );
        setPlans(planMap);
        setEntitlements(entitlementMap);

        const invoiceIds = Array.from(new Set(nextSessions.map((s) => s.data.invoiceId).filter(Boolean) as string[]));
        const invoiceMap: Record<string, InvoiceDoc> = {};
        await Promise.all(
          invoiceIds.map(async (id) => {
            const snap = await getDoc(doc(db, "invoices", id));
            if (snap.exists()) invoiceMap[id] = snap.data() as InvoiceDoc;
          })
        );
        setInvoices(invoiceMap);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      refresh(u.uid, u.email ?? null);
    });
    return () => off();
  }, [refresh]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const events = useMemo(() => {
    return sessions.map((s) => {
      const start = s.data.startAt.toDate();
      const end = s.data.endAt.toDate();

      const classNames = [
        "sr-event",
        normalizeSessionStatus(s.data.status) === "completed" ? "sr-event--done" : "",
        normalizeSessionStatus(s.data.status).startsWith("cancelled") ? "sr-event--cancel" : "",
        s.data.billingOutcome === "invoice" ? "sr-event--invoice" : "",
      ].filter(Boolean);

      return {
        id: s.id,
        title: studentLabel(s.data.studentId),
        start,
        end,
        allDay: false,
        classNames,
        extendedProps: {
          billingStatus: s.data.billingStatus,
          billingOutcome: s.data.billingOutcome ?? null,
          status: normalizeSessionStatus(s.data.status),
          legacyStatus: s.data.status,
          studentName: students[s.data.studentId]?.studentName ?? "",
          yearLevel: students[s.data.studentId]?.yearLevel ?? "",
          planType: (s.data.planId ? plans[s.data.planId]?.type : null)
            ?? (students[s.data.studentId]?.activePlanId ? plans[students[s.data.studentId].activePlanId!]?.type : null)
            ?? "casual",
          modality: normalizeMode(s.data.mode ?? s.data.modality ?? "in_home"),
        },
      };
    });
  }, [sessions, studentLabel, students, plans]);

  async function updateSessionStatus(
    sessionId: string,
    action: "complete" | "cancel_by_parent" | "cancel_by_tutor" | "no_show"
  ) {
    const user = auth.currentUser;
    if (!user) return;

    const idToken = await user.getIdToken();
    const res = await fetch("/api/sessions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ sessionId, action }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Session update failed:", res.status, t);
      alert("Session update failed. Check console / server logs.");
    } else {
      await refresh(user.uid, user.email ?? null);
      setOpenId(null);
    }
  }

  async function cancelSession(sessionId: string, reason: "PARENT" | "STUDYROOM") {
    const yes = confirm(
      reason === "PARENT"
        ? "Cancel this session as a parent cancellation?"
        : "Cancel this session as a tutor cancellation? This records a credit outcome."
    );
    if (!yes) return;
    await updateSessionStatus(sessionId, reason === "STUDYROOM" ? "cancel_by_tutor" : "cancel_by_parent");
  }

  async function createRecurringFromOpenSession() {
    if (!openSession) return;
    const weeks = Math.max(1, Math.min(12, recurringWeeks));
    setRecurringBusy(true);
    try {
      const base = openSession.data;
      const baseStart = base.startAt.toDate();
      const baseEnd = base.endAt.toDate();
      const durationMin = minutesBetween(baseStart, baseEnd);
      const seriesKey = base.seriesKey || `series-${openSession.id}`;

      for (let i = 1; i <= weeks; i++) {
        const start = addDays(baseStart, 7 * i);
        const end = addDays(baseEnd, 7 * i);

        await addDoc(collection(db, "sessions"), {
          tutorId: base.tutorId,
          tutorEmail: base.tutorEmail ?? auth.currentUser?.email ?? null,
          studentId: base.studentId,
          clientId: base.clientId ?? null,
          planId: base.planId ?? students[base.studentId]?.activePlanId ?? null,
          startAt: Timestamp.fromDate(start),
          endAt: Timestamp.fromDate(end),
          durationMinutes: durationMin,
          durationMins: durationMin,
          modality: base.modality ?? "IN_HOME",
          mode: normalizeMode(base.mode ?? base.modality ?? "IN_HOME"),
          status: "scheduled",
          legacyStatus: "SCHEDULED",
          seriesKey,
          notes: base.notes ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      alert(`Created ${weeks} recurring weekly sessions.`);
      await refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null);
    } catch (e: unknown) {
      console.error(e);
      alert(getErrorMessage(e));
    } finally {
      setRecurringBusy(false);
    }
  }

  async function saveStudentAddress() {
    if (!openSession) return;
    setSavingAddress(true);
    setAddressMsg(null);
    try {
      await updateDoc(doc(db, "students", openSession.data.studentId), {
        addressLine1: addressDraft.addressLine1.trim() || null,
        suburb: addressDraft.suburb.trim() || null,
        postcode: addressDraft.postcode.trim() || null,
        updatedAt: serverTimestamp(),
      });
      await refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null);
      setAddressMsg("Address saved.");
      setTimeout(() => setAddressMsg(null), 3000);
    } catch (e: unknown) {
      setAddressMsg(getErrorMessage(e));
    } finally {
      setSavingAddress(false);
    }
  }

  async function saveEdit() {
    if (!openSession) return;
    const user = auth.currentUser;
    if (!user) return;
    setEditBusy(true);
    setEditMsg(null);
    try {
      const idToken = await user.getIdToken();
      const currentStart = openSession.data.startAt.toDate();
      const currentEnd = openSession.data.endAt.toDate();
      const durationMin = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);

      const newStart = new Date(`${editDate}T${editTime}`);
      if (Number.isNaN(newStart.getTime())) { setEditMsg("Invalid date/time."); return; }
      const newEnd = new Date(newStart.getTime() + durationMin * 60000);

      const timeChanged = newStart.getTime() !== currentStart.getTime();
      const currentModeNorm = normalizeMode(openSession.data.mode ?? openSession.data.modality ?? "in_home");
      const newModeNorm = editMode === "IN_HOME" ? "in_home" : "online";
      const modeChanged = currentModeNorm !== newModeNorm;

      const tasks: Promise<void>[] = [];

      if (timeChanged) {
        tasks.push(
          fetch("/api/sessions/reschedule", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ sessionId: openSession.id, startISO: newStart.toISOString(), endISO: newEnd.toISOString() }),
          }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error((j as { error?: string }).error || "Reschedule failed.");
            }
          })
        );
      }

      if (modeChanged) {
        tasks.push(
          fetch("/api/sessions/update", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ sessionId: openSession.id, mode: editMode }),
          }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error((j as { error?: string }).error || "Mode update failed.");
            }
          })
        );
      }

      await Promise.all(tasks);
      setEditOpen(false);
      await refresh(user.uid, user.email ?? null);
    } catch (e: unknown) {
      setEditMsg(getErrorMessage(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteSession() {
    if (!openSession) return;
    const yes = confirm("Delete this session? This cannot be undone.");
    if (!yes) return;
    const user = auth.currentUser;
    if (!user) return;
    setDeleting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId: openSession.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "Delete failed.");
        return;
      }
      setOpenId(null);
      await refresh(user.uid, user.email ?? null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  async function createSessionFromDrawer() {
    const user = auth.currentUser;
    if (!user) { setDrawerMsg("Please sign in."); return; }

    const student = students[addStudentId];
    if (!student) { setDrawerMsg("Please select a student."); return; }
    if (!addDate) { setDrawerMsg("Please choose a date."); return; }
    if (!addTime) { setDrawerMsg("Please choose a time."); return; }

    const start = new Date(`${addDate}T${addTime}`);
    if (Number.isNaN(start.getTime())) { setDrawerMsg("Invalid date/time."); return; }

    const end = new Date(start.getTime() + addDuration * 60000);

    setAddBusy(true);
    setDrawerMsg(null);
    try {
      await addDoc(collection(db, "sessions"), {
        tutorId: user.uid,
        tutorEmail: user.email ?? null,
        studentId: addStudentId,
        clientId: student.clientId ?? null,
        planId: student.activePlanId ?? null,
        startAt: Timestamp.fromDate(start),
        endAt: Timestamp.fromDate(end),
        durationMinutes: addDuration,
        durationMins: addDuration,
        modality: addModality,
        mode: normalizeMode(addModality),
        status: "scheduled",
        legacyStatus: "SCHEDULED",
        notes: addNotes.trim() ? addNotes.trim() : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAddNotes("");
      setAddOpen(false);
      await refresh(user.uid, user.email ?? null);
    } catch (e: unknown) {
      console.error(e);
      setDrawerMsg(getErrorMessage(e));
    } finally {
      setAddBusy(false);
    }
  }

  async function persistReschedule(sessionId: string, start: Date, end: Date) {
    const user = auth.currentUser;
    if (!user) return;

    const idToken = await user.getIdToken();
    const res = await fetch("/api/sessions/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        sessionId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      }),
    });

    if (!res.ok) {
      const json: unknown = await res.json().catch(() => ({}));
      const msg =
        json && typeof json === "object" && "error" in json && typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : "Reschedule failed.";
      alert(msg);
      await refresh(user.uid, user.email ?? null);
      return;
    }

    await refresh(user.uid, user.email ?? null);
  }

  function groupByDate(sessionsToGroup: Array<{ id: string; data: SessionDoc }>) {
    const groups: Record<string, Array<{ id: string; data: SessionDoc }>> = {};
    sessionsToGroup
      .filter(s => s.data.startAt)
      .sort((a, b) => a.data.startAt.toDate().getTime() - b.data.startAt.toDate().getTime())
      .forEach(s => {
        const d = s.data.startAt.toDate();
        const key = d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });
    return groups;
  }

  function handleSessionClick(id: string) {
    setOpenId(id);
  }

  // ids for accessible labels
  const idStudent = "add-session-student";
  const idWhen = "add-session-when";
  const idDuration = "add-session-duration";
  const idModality = "add-session-modality";
  const idNotes = "add-session-notes";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Page header */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Sessions
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>Sessions Calendar</div>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const yyyy = now.getFullYear();
              const mo = String(now.getMonth() + 1).padStart(2, "0");
              const dd = String(now.getDate()).padStart(2, "0");
              setAddDate(`${yyyy}-${mo}-${dd}`);
              const mins = now.getMinutes() < 30 ? 30 : 0;
              const hrs = mins === 0 ? now.getHours() + 1 : now.getHours();
              setAddTime((hrs >= 6 && hrs < 20) ? `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}` : "15:00");
              setAddOpen(true);
              setDrawerMsg(null);
            }}
            style={{ background: "#456071", color: "white", border: "none", borderRadius: 20, padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Add session
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 3 }}>Click a session for details. Drag to reschedule.</div>
        {!loading && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 12, color: "#8a96a3", marginTop: 6 }}>
            <span><span style={{ fontWeight: 700, color: "#1d2428" }}>{sessionStats.todayCount}</span> today</span>
            <span><span style={{ fontWeight: 700, color: "#1d2428" }}>{sessionStats.weekCount}</span> this week</span>
            {sessionStats.nextSession ? (
              <span>Next: <span style={{ fontWeight: 600, color: "#456071" }}>{fmtTime(sessionStats.nextSession.start)}</span> · {sessionStats.nextSession.studentName}</span>
            ) : (
              <span>No upcoming sessions</span>
            )}
          </div>
        )}
      </div>

      {/* Package session warnings */}
      {packageWarnings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {packageWarnings.map(({ key, studentName, remaining, urgent }) =>
            urgent ? (
              <div key={key} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
                🔴 {studentName} — {remaining} session remaining
              </div>
            ) : (
              <div key={key} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                ⚠ {studentName} — {remaining} session{remaining !== 1 ? "s" : ""} remaining
              </div>
            )
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
        {isMobile ? (
          <div style={{ flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, fontSize: 13, color: "#8a96a3" }}>Loading…</div>
            ) : (
              <>
                {/* Month navigator */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428" }}>Sessions</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setMobileViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      style={{ background: "#f4f7f9", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#456071" }}
                    >←</button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#748398" }}>
                      {mobileViewDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      style={{ background: "#f4f7f9", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#456071" }}
                    >→</button>
                  </div>
                </div>

                {/* Session list */}
                {(() => {
                  const monthSessions = sessions.filter(s => {
                    const d = s.data.startAt?.toDate?.();
                    if (!d) return false;
                    return d.getMonth() === mobileViewDate.getMonth() && d.getFullYear() === mobileViewDate.getFullYear();
                  });
                  const groups = groupByDate(monthSessions);
                  const entries = Object.entries(groups);
                  if (entries.length === 0) {
                    return (
                      <div style={{ background: "#fff", borderRadius: 14, padding: "28px 16px", textAlign: "center", border: "1.5px dashed #e4eaef", fontSize: 13, color: "#8a96a3" }}>
                        No sessions this month.
                      </div>
                    );
                  }
                  return entries.map(([dateLabel, daySessions]) => (
                    <div key={dateLabel} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#748398", marginBottom: 7, paddingLeft: 4 }}>
                        {dateLabel}
                      </div>
                      {daySessions.map(s => {
                        const startAt = s.data.startAt.toDate();
                        const rawStatus = normalizeSessionStatus(s.data.status);
                        const isSessionCompleted = rawStatus === "completed";
                        const isSessionCancelled = rawStatus.includes("cancel") || rawStatus === "no_show";
                        const statusBg = isSessionCompleted ? "#d4edcc" : isSessionCancelled ? "#fce8ee" : "#edf2f6";
                        const statusFg = isSessionCompleted ? "#2d5a24" : isSessionCancelled ? "#c0445e" : "#456071";
                        const accentColor = isSessionCompleted ? "#82977e" : isSessionCancelled ? "#e39bb6" : "#456071";
                        const durMins = s.data.durationMinutes ?? s.data.durationMins ?? 0;
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSessionClick(s.id)}
                            onKeyDown={e => e.key === "Enter" && handleSessionClick(s.id)}
                            style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 8, border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", borderLeft: `3px solid ${accentColor}` }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {students[s.data.studentId]?.studentName ?? "Session"}
                              </div>
                              <div style={{ fontSize: 11, color: "#8a96a3" }}>
                                {startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}
                                {durMins ? ` · ${durMins} min` : ""}
                                {s.data.modality ? ` · ${s.data.modality === "ONLINE" ? "Online" : "In-home"}` : ""}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: statusBg, color: statusFg }}>
                              {formatSessionStatusLabel(rawStatus)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mo = String(now.getMonth() + 1).padStart(2, "0");
                    const dd = String(now.getDate()).padStart(2, "0");
                    setAddDate(`${yyyy}-${mo}-${dd}`);
                    const mins = now.getMinutes() < 30 ? 30 : 0;
                    const hrs = mins === 0 ? now.getHours() + 1 : now.getHours();
                    setAddTime((hrs >= 6 && hrs < 20) ? `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}` : "15:00");
                    setAddOpen(true);
                    setDrawerMsg(null);
                  }}
                  style={{ width: "100%", marginTop: 8, background: "#456071", color: "#fff", border: "none", borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  + Add session
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0, background: "white", borderRadius: 20, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflowX: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, fontSize: 13, color: "#8a96a3" }}>Loading…</div>
            ) : (
              <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,today,next",
                center: "title",
                right: "timeGridWeek,dayGridMonth",
              }}
              buttonText={{
                today: "Today",
                week: "Week",
                month: "Month",
              }}
              height="auto"
              nowIndicator
              firstDay={1}
              slotMinTime="06:00:00"
              slotMaxTime="21:30:00"
              slotDuration="00:30:00"
              editable
              eventStartEditable
              eventDurationEditable={false}
              eventResizableFromStart={false}
              dayMaxEvents={3}
              events={events}
              eventClick={(arg: EventClickArg) => handleSessionClick(arg.event.id)}
              eventDrop={(arg: EventDropArg) => persistReschedule(arg.event.id, arg.event.start!, arg.event.end!)}
              eventResize={(arg: EventResizeDoneArg) => persistReschedule(arg.event.id, arg.event.start!, arg.event.end!)}
              eventClassNames={(arg) => {
                const status = String(
                  arg.event.extendedProps?.status ?? arg.event.extendedProps?.legacyStatus ?? "scheduled"
                ).toLowerCase();
                const classes: string[] = [];
                if (status === "completed") classes.push("sr-completed");
                else if (status.includes("cancel") || status === "no_show") classes.push("sr-cancelled");
                else classes.push("sr-scheduled");
                return classes;
              }}
              eventContent={(arg: EventContentArg) => {
                const props = arg.event.extendedProps as {
                  status?: string;
                  studentName?: string;
                  yearLevel?: string;
                  planType?: string;
                  modality?: string;
                };

                const rawStatus = String(props.status ?? arg.event.extendedProps?.legacyStatus ?? "scheduled").toLowerCase();
                const isCompleted = rawStatus === "completed";
                const isCancelled = rawStatus.includes("cancel") || rawStatus === "no_show";

                const accentColor = isCompleted ? "#82977e" : isCancelled ? "#e39bb6" : "#456071";
                const bgColor = isCompleted ? "#edf5eb" : isCancelled ? "#fdf2f4" : "#edf2f6";
                const statusLabel = isCompleted ? "Completed" : isCancelled ? "Cancelled" : "Scheduled";
                const statusColor = isCompleted ? "#2d5a24" : isCancelled ? "#c0445e" : "#456071";

                const name = props.studentName
                  ? `${props.studentName}${props.yearLevel ? ` · ${props.yearLevel}` : ""}`
                  : arg.event.title || "Session";

                const start = arg.event.start;
                const end = arg.event.end;
                const timeStr = start && end
                  ? `${start.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })} – ${end.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })}`
                  : "";

                const planType = String(props.planType ?? "").toLowerCase();
                const planLabel = planType.includes("package") ? "Package" : planType === "casual" ? "Casual" : null;
                const planBg = planType.includes("package") ? "#edf5eb" : "#e8f0fa";
                const planColor = planType.includes("package") ? "#2d5a24" : "#3a6090";

                const durationMins = start && end
                  ? Math.round((end.getTime() - start.getTime()) / 60000)
                  : 0;
                const showPill = durationMins >= 45;

                if (arg.view.type === "dayGridMonth" || arg.view.type === "listWeek") {
                  return (
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: statusColor,
                      padding: "2px 6px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                      width: "100%",
                      lineHeight: 1.3,
                      display: "block",
                    }}>
                      {name}
                    </div>
                  );
                }

                return (
                  <div style={{
                    height: "100%",
                    background: bgColor,
                    borderLeft: `3px solid ${accentColor}`,
                    borderRadius: "0 10px 10px 0",
                    padding: "6px 8px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    gap: 2,
                    opacity: isCancelled ? 0.75 : isCompleted ? 0.65 : 1,
                    cursor: "pointer",
                  }}>
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: statusColor,
                      lineHeight: 1,
                    }}>
                      {statusLabel}
                    </div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#1d2428",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: "#8a96a3",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {timeStr}
                    </div>
                    {showPill && planLabel && (
                      <div style={{
                        display: "inline-block",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 20,
                        background: planBg,
                        color: planColor,
                        marginTop: 2,
                        alignSelf: "flex-start",
                      }}>
                        {planLabel}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
        )}

        {/* Inline session detail panel */}
        {openSession ? (
          <div style={{ width: isMobile ? "100%" : 380, flexShrink: 0, background: "white", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflowY: "auto", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.01em" }}>
                    {openStudent?.studentName ?? "Session"}
                    {openStudent?.yearLevel ? ` · ${openStudent.yearLevel}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 2 }}>
                    {openSession.data.startAt.toDate().toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {niceRange(openSession.data.startAt.toDate(), openSession.data.endAt.toDate())}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#677a8a", fontFamily: "inherit", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                  background: normalizeSessionStatus(openSession.data.status) === "completed" ? "#d4edcc"
                    : normalizeSessionStatus(openSession.data.status).includes("cancel") ? "#fce8ee" : "#edf2f6",
                  color: normalizeSessionStatus(openSession.data.status) === "completed" ? "#2d5a24"
                    : normalizeSessionStatus(openSession.data.status).includes("cancel") ? "#c0445e" : "#456071",
                }}>
                  {formatSessionStatusLabel(normalizeSessionStatus(openSession.data.status))}
                </span>
                {openPlan && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                    {formatPlanLabel(normalizePlanType(openPlan.type))}
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                  {formatModeLabel(normalizeMode(openSession.data.mode ?? openSession.data.modality ?? "in_home"))}
                </span>
              </div>
            </div>

            {/* Billing — collapsed unless an outcome exists */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <button
                type="button"
                onClick={() => setBillingExpanded(v => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398" }}>Billing</div>
                  {!billingExpanded && openSession.data.billingOutcome && (
                    <span style={{ fontSize: 10, color: "#748398" }}>
                      {openSession.data.billingOutcome === "no_charge" ? "No charge"
                        : openSession.data.billingOutcome === "credit" ? "Credit"
                        : openSession.data.billingOutcome === "invoice" ? "Invoice"
                        : ""}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: "#b8cad6" }}>{billingExpanded ? "▲" : "▼"}</span>
              </button>
              {billingExpanded && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>
                        {(() => {
                          const outcome = openSession.data.billingOutcome;
                          if (outcome === "no_charge") return "No charge";
                          if (outcome === "credit") return "Credit issued";
                          if (outcome === "invoice") return "Invoice";
                          return "Pending";
                        })()}
                      </div>
                      {openInvoice && (
                        <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>
                          Status: {openInvoice.status ?? "—"}
                          {openInvoice.xeroInvoiceId && (
                            <span style={{ marginLeft: 6, color: "#82977e" }}>· In Xero</span>
                          )}
                        </div>
                      )}
                    </div>
                    {(openInvoice?.status === "pending_xero" || openInvoice?.status === "xero_failed") && openSession.data.invoiceId && (
                      <button
                        type="button"
                        onClick={() => pushInvoiceToXero(openSession.data.invoiceId!)}
                        disabled={xeroPushing}
                        style={{ background: "#2d5a24", color: "#fff", border: "none", borderRadius: 9, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {xeroPushing ? "Pushing..." : "Push to Xero"}
                      </button>
                    )}
                  </div>
                  {xeroMsg && <p style={{ fontSize: 11, color: "#8a96a3", marginTop: 4, margin: 0 }}>{xeroMsg}</p>}
                </div>
              )}
            </div>

            {/* Parent */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>Parent</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428" }}>{openClient?.parentName || "—"}</div>
              <div style={{ fontSize: 12, color: "#8a96a3", marginTop: 2 }}>
                {openClient?.parentEmail || ""}
                {openClient?.parentPhone ? ` · ${openClient.parentPhone}` : ""}
              </div>
            </div>

            {/* Address — only shown for in-home sessions */}
            {normalizeMode(openSession.data.mode ?? openSession.data.modality ?? "in_home") !== "online" && (
              <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>Address</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    aria-label="Address line 1"
                    value={addressDraft.addressLine1}
                    onChange={e => setAddressDraft(p => ({ ...p, addressLine1: e.target.value }))}
                    placeholder="Address line 1"
                    style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "7px 11px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <input
                      aria-label="Suburb"
                      value={addressDraft.suburb}
                      onChange={e => setAddressDraft(p => ({ ...p, suburb: e.target.value }))}
                      placeholder="Suburb"
                      style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "7px 11px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none" }}
                    />
                    <input
                      aria-label="Postcode"
                      value={addressDraft.postcode}
                      onChange={e => setAddressDraft(p => ({ ...p, postcode: e.target.value }))}
                      placeholder="Postcode"
                      style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "7px 11px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveStudentAddress}
                    disabled={savingAddress}
                    style={{ background: savingAddress ? "#b8cad6" : "#456071", color: "#fff", border: "none", borderRadius: 9, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {savingAddress ? "Saving..." : "Save address"}
                  </button>
                  {addressMsg && (
                    <p style={{ fontSize: 11, margin: 0, color: addressMsg.startsWith("Address saved") ? "#2d5a24" : "#c0445e" }}>{addressMsg}</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>Actions</div>
              {/* Primary actions */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {normalizeSessionStatus(openSession.data.status) === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => updateSessionStatus(openSession.id, "complete")}
                    style={{ background: "#456071", color: "#fff", border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Mark completed
                  </button>
                )}
                {normalizeSessionStatus(openSession.data.status) === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = openSession.data.startAt.toDate();
                      setEditDate(dateToYMD(s));
                      setEditTime(dateToHHMM(s));
                      setEditMode(normalizeMode(openSession.data.mode ?? openSession.data.modality ?? "in_home") === "online" ? "ONLINE" : "IN_HOME");
                      setEditMsg(null);
                      setEditOpen(v => !v);
                    }}
                    style={{ background: editOpen ? "#e8f0fa" : "#f4f7f9", color: "#456071", border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {editOpen ? "Cancel edit" : "Edit session"}
                  </button>
                )}
                <RescheduleSession
                  sessionId={openSession.id}
                  currentStart={openSession.data.startAt.toDate()}
                  currentEnd={openSession.data.endAt.toDate()}
                  onDone={() => refresh(auth.currentUser?.uid || "", auth.currentUser?.email ?? null)}
                />
              </div>

              {/* Edit inline form */}
              {editOpen && normalizeSessionStatus(openSession.data.status) === "scheduled" && (
                <div style={{ marginTop: 10, padding: "12px", background: "#f8f9fa", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4 }}>Date</div>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4 }}>Start time</div>
                      <select
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none", boxSizing: "border-box" }}
                      >
                        {(() => {
                          const opts = [];
                          for (let h = 6; h <= 21; h++) {
                            for (const m of [0, 30]) {
                              if (h === 21 && m === 30) break;
                              const hh = String(h).padStart(2, "0");
                              const mm = String(m).padStart(2, "0");
                              const h12 = h % 12 === 0 ? 12 : h % 12;
                              const ampm = h < 12 ? "AM" : "PM";
                              opts.push(<option key={`${hh}:${mm}`} value={`${hh}:${mm}`}>{h12}:{mm} {ampm}</option>);
                            }
                          }
                          return opts;
                        })()}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 4 }}>Mode</div>
                    <select
                      value={editMode}
                      onChange={e => setEditMode(e.target.value as "IN_HOME" | "ONLINE")}
                      style={{ width: "100%", border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "6px 9px", fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none", boxSizing: "border-box" }}
                    >
                      <option value="IN_HOME">In-home</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={editBusy}
                      style={{ background: "#456071", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {editBusy ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      style={{ background: "none", color: "#748398", border: "none", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                  </div>
                  {editMsg && <p style={{ fontSize: 11, margin: 0, color: "#c0445e" }}>{editMsg}</p>}
                </div>
              )}

              {/* Destructive actions — visually separated */}
              {normalizeSessionStatus(openSession.data.status) === "scheduled" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <button
                    type="button"
                    onClick={() => cancelSession(openSession.id, "PARENT")}
                    style={{ background: "#fce8ee", color: "#c0445e", border: "none", borderRadius: 9, padding: "6px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancel (parent)
                  </button>
                  <button
                    type="button"
                    onClick={() => { const yes = confirm("Mark this session as a no-show?"); if (yes) updateSessionStatus(openSession.id, "no_show"); }}
                    style={{ background: "#fff8e6", color: "#a06000", border: "none", borderRadius: 9, padding: "6px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    No show
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelSession(openSession.id, "STUDYROOM")}
                    style={{ background: "#f4f7f9", color: "#677a8a", border: "none", borderRadius: 9, padding: "6px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancel (tutor)
                  </button>
                  {!openSession.data.invoiceId && !openSession.data.billingOutcome && (
                    <button
                      type="button"
                      onClick={deleteSession}
                      disabled={deleting}
                      style={{ background: "#fce8ee", color: "#c0445e", border: "1px solid #fca5a5", borderRadius: 9, padding: "6px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {deleting ? "Deleting…" : "Delete session"}
                    </button>
                  )}
                </div>
              )}
              {/* Recurring — inline */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                <span style={{ fontSize: 11, color: "#8a96a3" }}>Repeat:</span>
                <select
                  id="recurring-weeks"
                  aria-label="Number of weeks for recurring sessions"
                  value={recurringWeeks}
                  onChange={e => setRecurringWeeks(Number(e.target.value))}
                  style={{ border: "1.5px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontFamily: "inherit", color: "#1d2428", outline: "none" }}
                >
                  {[1,2,3,4,6,8,10,12].map(w => (
                    <option key={w} value={w}>{w} week{w > 1 ? "s" : ""}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={createRecurringFromOpenSession}
                  disabled={recurringBusy}
                  style={{ background: "#edf2f6", color: "#456071", border: "none", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {recurringBusy ? "Creating..." : "Add recurring"}
                </button>
              </div>
            </div>

            {/* Session workflow guidance */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 11, color: "#8a96a3", lineHeight: 1.65 }}>
                Reschedule if time changes · Mark completed after the lesson · Use parent cancel only when the family cancels · Add notes so admin sees the same record
              </div>
            </div>

            {/* Session log — collapsed by default */}
            <div style={{ padding: "12px 18px" }}>
              <button
                type="button"
                onClick={() => setLogExpanded(v => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398" }}>
                  Session log
                </div>
                <span style={{ fontSize: 11, color: "#8a96a3" }}>{logExpanded ? "▲" : "▼"}</span>
              </button>
              {logExpanded && (
                <div style={{ marginTop: 10 }}>
                  <SessionLogEditor sessionId={openSession.id} />
                </div>
              )}
            </div>

          </div>
        ) : !isMobile ? (
          <div style={{ width: 380, flexShrink: 0, background: "white", borderRadius: 20, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflowY: "auto", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398" }}>Upcoming</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428", marginTop: 2 }}>Next 14 days</div>
            </div>
            {upcomingSessions.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", fontSize: 12, color: "#8a96a3" }}>
                No upcoming sessions in the next 14 days.<br />
                <span style={{ color: "#b8cad6" }}>Click a session on the calendar to view details.</span>
              </div>
            ) : (() => {
              const groups: { label: string; items: typeof upcomingSessions }[] = [];
              for (const s of upcomingSessions) {
                const label = upcomingDayLabel(s.data.startAt.toDate());
                const last = groups[groups.length - 1];
                if (last && last.label === label) { last.items.push(s); }
                else { groups.push({ label, items: [s] }); }
              }
              return (
                <div>
                  {groups.map(({ label, items }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#748398", padding: "10px 18px 4px" }}>
                        {label}
                      </div>
                      {items.map(s => {
                        const start = s.data.startAt.toDate();
                        const end = s.data.endAt.toDate();
                        const sName = students[s.data.studentId]?.studentName ?? "Session";
                        const yr = students[s.data.studentId]?.yearLevel;
                        const isCompleted = normalizeSessionStatus(s.data.status) === "completed";
                        const accentColor = isCompleted ? "#82977e" : "#456071";
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSessionClick(s.id)}
                            onKeyDown={e => e.key === "Enter" && handleSessionClick(s.id)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 18px 8px 15px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", borderLeft: `3px solid ${accentColor}` }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1d2428", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {sName}{yr ? ` · ${yr}` : ""}
                              </div>
                              <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 1 }}>
                                {niceRange(start, end)}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: isCompleted ? "#d4edcc" : "#edf2f6", color: isCompleted ? "#2d5a24" : "#456071", flexShrink: 0 }}>
                              {isCompleted ? "Done" : "Scheduled"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>

      {/* Add Session Drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Session">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={idStudent} className="text-xs font-semibold text-[color:var(--muted)]">
              Student
            </label>
            <select
              id={idStudent}
              value={addStudentId}
              onChange={(e) => setAddStudentId(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
            >
              {Object.keys(students).length === 0 ? (
                <option value="">No students yet</option>
              ) : (
                Object.entries(students)
                  .sort((a, b) => (a[1].studentName || "").localeCompare(b[1].studentName || ""))
                  .map(([id, s]) => (
                    <option key={id} value={id}>
                      {s.studentName ?? "Student"}
                      {s.yearLevel ? ` · ${s.yearLevel}` : ""}
                    </option>
                  ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label htmlFor={idWhen} className="text-xs font-semibold text-[color:var(--muted)]">
                Date
              </label>
              <input
                id={idWhen}
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="add-session-time" className="text-xs font-semibold text-[color:var(--muted)]">
                Start time
              </label>
              <select
                id="add-session-time"
                value={addTime}
                onChange={(e) => setAddTime(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              >
                {(() => {
                  const opts = [];
                  for (let h = 6; h <= 21; h++) {
                    for (const m of [0, 30]) {
                      if (h === 21 && m === 30) break;
                      const hh = String(h).padStart(2, "0");
                      const mm = String(m).padStart(2, "0");
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      const ampm = h < 12 ? "AM" : "PM";
                      opts.push(
                        <option key={`${hh}:${mm}`} value={`${hh}:${mm}`}>
                          {h12}:{mm} {ampm}
                        </option>
                      );
                    }
                  }
                  return opts;
                })()}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label htmlFor={idDuration} className="text-xs font-semibold text-[color:var(--muted)]">
                Duration
              </label>
              <select
                id={idDuration}
                value={addDuration}
                onChange={(e) => setAddDuration(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--ring)] bg-white px-3 py-2 text-sm"
              >
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor={idModality} className="text-xs font-semibold text-[color:var(--muted)]">
                Modality
              </label>
              <select
                id={idModality}
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

          <div className="space-y-2">
            <label htmlFor={idNotes} className="text-xs font-semibold text-[color:var(--muted)]">
              Notes
            </label>
            <textarea
              id={idNotes}
              rows={3}
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full rounded-2xl border border-[color:var(--ring)] bg-white px-4 py-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={createSessionFromDrawer}
            disabled={addBusy}
            className="brand-cta w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {addBusy ? "Creating…" : "Create session"}
          </button>
          {drawerMsg && (
            <p className="text-xs text-rose-600 text-center">{drawerMsg}</p>
          )}
        </div>
      </Drawer>


      <style jsx global>{`
        /* ── Reset ── */
        .fc { font-family: inherit !important; }

        /* ── Page background ── */
        .fc-theme-standard td,
        .fc-theme-standard th { border-color: rgba(0,0,0,0.06) !important; }

        /* ── Column headers (day names + dates) ── */
        .fc .fc-col-header-cell {
          background: #fff !important;
          padding: 6px 0 8px !important;
          border-bottom: 1px solid rgba(0,0,0,0.07) !important;
        }
        .fc .fc-col-header-cell-cushion {
          display: inline-block !important;
          padding: 3px 10px !important;
          text-decoration: none !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          color: #8a96a3 !important;
          white-space: nowrap !important;
          border-radius: 6px !important;
          line-height: 1.4 !important;
        }
        .fc .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion {
          background: #456071 !important;
          color: #fff !important;
          font-weight: 600 !important;
        }

        /* ── Today column ── */
        .fc .fc-day-today {
          background: #fff9fb !important;
        }
        .fc .fc-timegrid-col.fc-day-today {
          background: #fff9fb !important;
        }

        /* ── Time labels ── */
        .fc .fc-timegrid-slot-label {
          font-size: 10px !important;
          font-weight: 500 !important;
          color: #b0bec5 !important;
          vertical-align: top !important;
          padding-top: 4px !important;
        }
        .fc .fc-timegrid-slot-label-cushion {
          padding: 0 8px 0 0 !important;
        }

        /* ── Slot lines ── */
        .fc .fc-timegrid-slot {
          height: 56px !important;
        }
        .fc .fc-timegrid-slot-minor {
          border-top-style: dashed !important;
          border-top-color: rgba(0,0,0,0.04) !important;
        }

        /* ── Now indicator ── */
        .fc .fc-timegrid-now-indicator-line {
          border-color: #e39bb6 !important;
          border-width: 1.5px !important;
        }
        .fc .fc-timegrid-now-indicator-arrow {
          border-top-color: #e39bb6 !important;
          border-bottom-color: #e39bb6 !important;
          border-left-color: #e39bb6 !important;
        }

        /* ── Toolbar buttons ── */
        .fc .fc-button {
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
          padding: 5px 12px !important;
          box-shadow: none !important;
          outline: none !important;
          transition: all 0.15s !important;
        }
        .fc .fc-button-primary {
          background: #f4f7f9 !important;
          border-color: transparent !important;
          color: #456071 !important;
        }
        .fc .fc-button-primary:hover {
          background: #edf2f6 !important;
          border-color: transparent !important;
          color: #2a2f33 !important;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background: #456071 !important;
          border-color: #456071 !important;
          color: #fff !important;
        }
        .fc .fc-button-primary:disabled {
          background: #f4f7f9 !important;
          border-color: transparent !important;
          color: #b0bec5 !important;
          opacity: 1 !important;
        }

        /* ── Toolbar title ── */
        .fc .fc-toolbar-title {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #1d2428 !important;
          letter-spacing: -0.01em !important;
        }

        /* ── Event base reset — our eventContent handles everything ── */
        .fc .fc-timegrid-event,
        .fc .fc-timegrid-event-harness {
          box-shadow: none !important;
        }
        .fc .fc-event {
          border: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        .fc .fc-event:focus::after {
          display: none !important;
        }

        /* ── Month view event pills ── */
        .fc .fc-daygrid-event-harness {
          max-width: 100% !important;
          overflow: hidden !important;
          min-width: 0 !important;
        }
        .fc .fc-daygrid-event {
          border-radius: 6px !important;
          padding: 0 !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          border: none !important;
          overflow: hidden !important;
          max-width: 100% !important;
          min-width: 0 !important;
          display: block !important;
          white-space: nowrap !important;
        }
        .fc .fc-daygrid-event .fc-event-main {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          max-width: 100% !important;
          min-width: 0 !important;
          display: block !important;
          padding: 0 !important;
        }
        .fc .fc-daygrid-dot-event {
          overflow: hidden !important;
          max-width: 100% !important;
          white-space: nowrap !important;
        }
        .fc .fc-daygrid-day-events {
          min-width: 0 !important;
          overflow: hidden !important;
        }
        .fc .fc-daygrid-event.sr-completed {
          background: #edf5eb !important;
          color: #2d5a24 !important;
        }
        .fc .fc-daygrid-event.sr-scheduled {
          background: #edf2f6 !important;
          color: #456071 !important;
        }
        .fc .fc-daygrid-event.sr-cancelled {
          background: #fdf2f4 !important;
          color: #c0445e !important;
          opacity: 0.75 !important;
        }

        /* ── Month view day numbers — top right ── */
        .fc .fc-daygrid-day-top {
          flex-direction: row-reverse !important;
        }
        .fc .fc-daygrid-day-number {
          float: right !important;
          padding: 4px 8px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #748398 !important;
          text-decoration: none !important;
        }

        /* ── Month view today cell ── */
        .fc .fc-daygrid-day.fc-day-today {
          background: #fff9fb !important;
        }
        .fc .fc-day-today .fc-daygrid-day-number {
          background: #456071 !important;
          color: #fff !important;
          border-radius: 50% !important;
          width: 22px !important;
          height: 22px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          margin: 4px 4px 0 0 !important;
        }

        /* ── Scrollbar ── */
        .fc-scroller::-webkit-scrollbar { width: 4px; }
        .fc-scroller::-webkit-scrollbar-track { background: transparent; }
        .fc-scroller::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

        /* ── Fix header/body column alignment v2 ── */

        /* Kill the scrollbar-compensation gap FullCalendar adds to header */
        .fc .fc-scrollgrid-section-header .fc-scroller {
          overflow: hidden !important;
        }
        .fc .fc-scrollgrid-section-body .fc-scroller {
          overflow-y: auto !important;
        }

        /* Force both header and body tables to fill their container identically */
        .fc .fc-scrollgrid-sync-table {
          width: 100% !important;
        }
        .fc .fc-col-header {
          width: 100% !important;
        }

        /* Lock the time axis gutter to a fixed width in both header and body */
        .fc .fc-timegrid-axis {
          width: 50px !important;
          min-width: 50px !important;
          max-width: 50px !important;
        }

        /* Centre day header text within each column cell */
        .fc .fc-col-header-cell {
          text-align: center !important;
          vertical-align: middle !important;
        }

        /* Month view: ensure the daygrid body table matches header width */
        .fc .fc-daygrid-body {
          width: 100% !important;
        }
        .fc .fc-daygrid-body table {
          width: 100% !important;
        }

        /* Month view: centre day names in header */
        .fc .fc-scrollgrid-sync-inner {
          display: flex !important;
          justify-content: center !important;
        }

        /* Remove any stray padding on scrollgrid cells */
        .fc .fc-scrollgrid-section > td,
        .fc .fc-scrollgrid-section > th {
          padding: 0 !important;
        }

        /* Hide the fake scrollbar spacer FullCalendar inserts in the header */
        .fc .fc-scrollgrid-section-header td:last-child,
        .fc .fc-scrollgrid-section-header th:last-child {
          border-left: none !important;
        }
        .fc .fc-scrollgrid-section-header .fc-scroller-liquid-absolute {
          overflow: hidden !important;
        }
      `}</style>
    </div>
  );
}
