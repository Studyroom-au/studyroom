"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SESSION_DURATION_MINS, normalizeMode } from "@/lib/studyroom/billing";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  activePlanId?: string | null;
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

type SessionDoc = {
  tutorId: string;
  tutorEmail?: string | null;
  studentId: string;
  clientId?: string | null;
  planId?: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  status: string;
  modality?: "IN_HOME" | "ONLINE" | "GROUP" | null;
  mode?: "in_home" | "online" | "group" | null;
  seriesKey?: string | null;
  notes?: string | null;
  durationMinutes?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  cancelReason?: string | null;
  unitPlanWeek?: number | null;
  worksheetId?: string | null;
};

type SessionRow = SessionDoc & { id: string };
type AddModality = "IN_HOME" | "ONLINE";

type UnitPlan = {
  id?: string;
  studentId: string;
  tutorId: string;
  termLabel: string;
  content: string;
  contentHtml: string;
  status: "active" | "completed";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
};

type Worksheet = {
  id: string;
  studentId: string;
  tutorId: string;
  title: string;
  subject: string;
  weekNumber?: number | null;
  notes: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type NoteRow = {
  id: string;
  notes: string;
  status: string;
  durationMinutes: number;
  date: string;
  startAt: Date | undefined;
  unitPlanWeek: number | null;
  worksheetId: string | null;
};

type TabKey = "overview" | "notes" | "plan" | "worksheets";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorStudentDetailPage() {
  const params = useParams();
  const studentId = useMemo(() => String(params?.id ?? ""), [params]);

  // ── Auth ──
  const [user, setUser] = useState<User | null>(null);

  // ── Student / session state ──
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [client, setClient] = useState<ClientDoc | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  // ── Add session form ──
  const [addWhenLocal, setAddWhenLocal] = useState("");
  const [addDuration, setAddDuration] = useState(SESSION_DURATION_MINS);
  const [addModality, setAddModality] = useState<AddModality>("IN_HOME");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // ── Session notes ──
  const [sessionNotes, setSessionNotes] = useState<NoteRow[]>([]);

  // ── Session note linking ──
  const [linkingSessionId, setLinkingSessionId] = useState<string | null>(null);
  const [linkWeek, setLinkWeek] = useState<number | "">("");
  const [linkWorksheetId, setLinkWorksheetId] = useState("");

  // ── Unit plan ──
  const [activePlan, setActivePlan] = useState<UnitPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<UnitPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planContent, setPlanContent] = useState("");
  const [planTermLabel, setPlanTermLabel] = useState("");
  const [planPreviewHtml, setPlanPreviewHtml] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Worksheets ──
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [addingWorksheet, setAddingWorksheet] = useState(false);
  const [wsTitle, setWsTitle] = useState("");
  const [wsSubject, setWsSubject] = useState("");
  const [wsWeekNumber, setWsWeekNumber] = useState<number | "">("");
  const [wsNotes, setWsNotes] = useState("");
  const [wsFile, setWsFile] = useState<File | null>(null);
  const [wsUploading, setWsUploading] = useState(false);
  const [wsUploadProgress, setWsUploadProgress] = useState(0);
  const [savingWorksheet, setSavingWorksheet] = useState(false);

  // ── Shared error ──
  const [error, setError] = useState<string | null>(null);

  // ─── Reload sessions list ──────────────────────────────────────────────────

  const reloadSessions = useCallback(async () => {
    if (!studentId) return;
    const u = auth.currentUser;
    if (!u) return;

    const q = query(collection(db, "sessions"), where("tutorId", "==", u.uid));
    const snap = await getDocs(q);

    const rows = snap.docs
      .map((d) => {
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

  // ─── Auth + student load ───────────────────────────────────────────────────

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setUser(u);
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

  // ─── Session notes (real-time) ────────────────────────────────────────────

  useEffect(() => {
    if (!studentId) return;
    const u = auth.currentUser;
    if (!u) return;

    const q = query(
      collection(db, "sessions"),
      where("studentId", "==", studentId),
      where("tutorId", "==", u.uid),
      orderBy("startAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(q, (snap) => {
      const withNotes = snap.docs
        .map((d) => {
          const data = d.data();
          const startAt = data.startAt?.toDate?.() as Date | undefined;
          return {
            id: d.id,
            notes: String(data.notes ?? "").trim(),
            status: String(data.status ?? ""),
            durationMinutes: Number(data.durationMinutes ?? data.durationMins ?? 60),
            date: startAt
              ? startAt.toLocaleDateString("en-AU", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Unknown date",
            startAt,
            unitPlanWeek: (data.unitPlanWeek as number | null) ?? null,
            worksheetId: (data.worksheetId as string | null) ?? null,
          };
        })
        .filter((s) => s.notes.length > 0);

      setSessionNotes(withNotes);
    });

    return () => unsub();
  }, [studentId]);

  // ─── Unit plan (real-time) ────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !studentId) return;

    const q = query(
      collection(db, "tutors", user.uid, "studentPlans"),
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    const unsub = onSnapshot(q, (snap) => {
      const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as UnitPlan[];
      const active = plans.find((p) => p.status === "active") ?? null;
      setActivePlan(active);
      setPlanHistory(plans.filter((p) => p.status === "completed"));
    });

    return () => unsub();
  }, [user, studentId]);

  // ─── Worksheets (real-time) ───────────────────────────────────────────────

  useEffect(() => {
    if (!user || !studentId) return;

    const q = query(
      collection(db, "tutors", user.uid, "worksheets"),
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(q, (snap) => {
      setWorksheets(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Worksheet[]);
    });

    return () => unsub();
  }, [user, studentId]);

  // ─── Live markdown preview ────────────────────────────────────────────────

  useEffect(() => {
    if (!planContent.trim()) {
      setPlanPreviewHtml("");
      return;
    }
    import("marked").then(({ marked }) => {
      const html = marked.parse ? String(marked.parse(planContent)) : String(marked(planContent as never));
      setPlanPreviewHtml(html);
    });
  }, [planContent]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function addSession() {
    const u = auth.currentUser;
    if (!u) return;
    if (!studentId) return;
    if (!addWhenLocal) return alert("Please choose a date/time.");

    const start = new Date(addWhenLocal);
    if (Number.isNaN(start.getTime())) return alert("Invalid date/time.");
    const end = new Date(start.getTime() + addDuration * 60000);

    setSaving(true);

    await addDoc(collection(db, "sessions"), {
      tutorId: u.uid,
      tutorEmail: u.email ?? null,
      studentId,
      clientId: student?.clientId ?? null,
      planId: student?.activePlanId ?? null,
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
    setAddWhenLocal("");
    setAddDuration(SESSION_DURATION_MINS);
    setAddModality("IN_HOME");

    await reloadSessions();
    setSaving(false);
  }

  async function handleSavePlan() {
    if (!planContent.trim()) { setError("Plan content is required."); return; }
    if (!planTermLabel.trim()) { setError("Please enter a term label (e.g. Term 2 2025)."); return; }
    if (!user) return;

    setSavingPlan(true);
    setError(null);
    try {
      const { marked } = await import("marked");
      const contentHtml = marked.parse
        ? String(marked.parse(planContent))
        : String(marked(planContent as never));

      const planData = {
        studentId,
        tutorId: user.uid,
        termLabel: planTermLabel.trim(),
        content: planContent,
        contentHtml,
        status: "active" as const,
        updatedAt: serverTimestamp(),
      };

      if (activePlan?.id) {
        await updateDoc(doc(db, "tutors", user.uid, "studentPlans", activePlan.id), planData);
      } else {
        await addDoc(collection(db, "tutors", user.uid, "studentPlans"), {
          ...planData,
          createdAt: serverTimestamp(),
        });
      }
      setEditingPlan(false);
    } catch (err) {
      console.error("[save-plan]", err);
      setError("Failed to save plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleCompletePlan() {
    if (!activePlan?.id || !user) return;
    if (!window.confirm("Mark this plan as complete? You can then create a new plan for the next term.")) return;
    try {
      await updateDoc(doc(db, "tutors", user.uid, "studentPlans", activePlan.id), {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setEditingPlan(false);
      setPlanContent("");
      setPlanTermLabel("");
    } catch (err) {
      console.error("[complete-plan]", err);
    }
  }

  async function handleSaveWorksheet() {
    if (!wsTitle.trim()) { setError("Title is required."); return; }
    if (!wsNotes.trim()) { setError("Notes are required."); return; }
    if (!user) return;

    setSavingWorksheet(true);
    setError(null);

    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;

      if (wsFile) {
        if (wsFile.size > 20 * 1024 * 1024) {
          setError("File must be under 20MB.");
          setSavingWorksheet(false);
          return;
        }
        setWsUploading(true);
        const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("@/lib/firebase");
        const filePath = `worksheets/${user.uid}/${studentId}/${Date.now()}_${wsFile.name}`;
        const storageRef = ref(storage, filePath);
        const task = uploadBytesResumable(storageRef, wsFile);

        fileUrl = await new Promise<string>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => setWsUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref)),
          );
        });
        fileName = wsFile.name;
        fileSize = wsFile.size;
        setWsUploading(false);
      }

      await addDoc(collection(db, "tutors", user.uid, "worksheets"), {
        studentId,
        tutorId: user.uid,
        title: wsTitle.trim(),
        subject: wsSubject || "",
        weekNumber: wsWeekNumber !== "" ? Number(wsWeekNumber) : null,
        notes: wsNotes.trim(),
        ...(fileUrl ? { fileUrl, fileName, fileSize } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setWsTitle(""); setWsSubject(""); setWsWeekNumber("");
      setWsNotes(""); setWsFile(null); setAddingWorksheet(false);
      setWsUploadProgress(0);
    } catch (err) {
      console.error("[save-worksheet]", err);
      setError("Failed to save worksheet.");
    } finally {
      setSavingWorksheet(false);
      setWsUploading(false);
    }
  }

  async function handleDeleteWorksheet(ws: Worksheet) {
    if (!window.confirm("Delete this worksheet?")) return;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "tutors", user.uid, "worksheets", ws.id));
      if (ws.fileUrl) {
        try {
          const { ref, deleteObject } = await import("firebase/storage");
          const { storage } = await import("@/lib/firebase");
          await deleteObject(ref(storage, ws.fileUrl));
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      console.error("[delete-worksheet]", err);
    }
  }

  async function handleSaveSessionLink(sessionId: string) {
    try {
      await updateDoc(doc(db, "sessions", sessionId), {
        unitPlanWeek: linkWeek !== "" ? Number(linkWeek) : null,
        worksheetId: linkWorksheetId || null,
        updatedAt: serverTimestamp(),
      });
      setLinkingSessionId(null);
    } catch (err) {
      console.error("[save-session-link]", err);
      setError("Failed to save link.");
    }
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "white", borderRadius: 18, padding: 18,
    border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 12,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
    textTransform: "uppercase", color: "#748398", marginBottom: 12,
  };
  const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 2 };
  const fieldValue: React.CSSProperties = { fontSize: 13, color: "#1d2428" };
  const inputSt: React.CSSProperties = {
    border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "8px 11px",
    fontSize: 12, fontFamily: "inherit", color: "#1d2428", outline: "none",
    width: "100%", background: "#fff", boxSizing: "border-box",
  };
  // Aliases used in new tabs
  const lbl = fieldLabel;
  const inp = inputSt;

  const tabs = [
    { key: "overview" as TabKey, label: "Overview" },
    { key: "notes" as TabKey, label: "Session notes" },
    { key: "plan" as TabKey, label: "Unit plan" },
    { key: "worksheets" as TabKey, label: "Worksheets" },
  ];

  // ─── Early returns ────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120, fontSize: 13, color: "#8a96a3" }}>Loading…</div>
  );

  if (notAllowed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/hub/tutor/students" style={{ fontSize: 12, color: "#456071", textDecoration: "none" }}>← Back to Students</Link>
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2428", marginBottom: 4 }}>Access denied</div>
          <div style={{ fontSize: 13, color: "#8a96a3" }}>This student is not assigned to your tutor account.</div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Back + header */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/hub/tutor/students" style={{ fontSize: 12, color: "#456071", textDecoration: "none" }}>← Back to Students</Link>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginTop: 12, marginBottom: 4 }}>Student Record</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>{student?.studentName || "Student"}</div>
        <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 2 }}>
          {[student?.yearLevel, student?.school].filter(Boolean).join(" · ") || "Details pending"}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: "#f4f7f9", borderRadius: 10, padding: 4, gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button type="button" key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
            background: activeTab === t.key ? "#fff" : "transparent",
            color: activeTab === t.key ? "#456071" : "#748398",
            boxShadow: activeTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
            {t.label}
            {t.key === "notes" && sessionNotes.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, background: "#456071", color: "#fff", borderRadius: 20, padding: "1px 5px" }}>
                {sessionNotes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && <>
        {/* Student Info */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Student Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            {[
              ["School", student?.school || "-"],
              ["Mode", formatLeadMode(student?.mode)],
              ["Suburb", student?.suburb || "-"],
              ["Postcode", student?.postcode || "-"],
              ["Address", student?.addressLine1 || "-"],
              ["Subjects", student?.subjects?.length ? student.subjects.join(", ") : "-"],
              ["Availability", student?.availabilityBlocks?.length ? student.availabilityBlocks.join(", ") : "-"],
              ["Goals", student?.goals || "-"],
              ["Challenges", student?.challenges || "-"],
            ].map(([label, value]) => (
              <div key={label} style={label === "Address" || label === "Subjects" || label === "Availability" || label === "Goals" || label === "Challenges" ? { gridColumn: "1 / -1" } : {}}>
                <div style={fieldLabel}>{label}</div>
                <div style={fieldValue}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Parent Info */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Parent Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            {[
              ["Name", client?.parentName || "-"],
              ["Email", client?.parentEmail || "-"],
              ["Phone", client?.parentPhone || "-"],
              ["Mode", formatLeadMode(client?.mode ?? student?.mode)],
              ["Suburb", client?.suburb || student?.suburb || "-"],
              ["Postcode", client?.postcode || student?.postcode || "-"],
              ["Address", client?.addressLine1 || student?.addressLine1 || "-"],
              ["Package", client?.package || student?.package || "-"],
            ].map(([label, value]) => (
              <div key={label} style={label === "Address" || label === "Package" ? { gridColumn: "1 / -1" } : {}}>
                <div style={fieldLabel}>{label}</div>
                <div style={fieldValue}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Session */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Add Session</div>
          <div style={{ marginBottom: 10 }}>
            <div style={fieldLabel}>Date &amp; time</div>
            <input type="datetime-local" aria-label="Session date and time" value={addWhenLocal} onChange={(e) => setAddWhenLocal(e.target.value)} style={inputSt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={fieldLabel}>Duration</div>
              <select aria-label="Session duration" value={addDuration} onChange={(e) => setAddDuration(Number(e.target.value))} style={inputSt}>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <div style={fieldLabel}>Modality</div>
              <select aria-label="Session modality" value={addModality} onChange={(e) => { const v = e.target.value; if (isAddModality(v)) setAddModality(v); }} style={inputSt}>
                <option value="IN_HOME">In-home</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabel}>Notes</div>
            <textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Optional notes…" style={{ ...inputSt, minHeight: 72, resize: "vertical" }} />
          </div>
          <button type="button" onClick={addSession} disabled={saving} style={{ background: "#456071", color: "white", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Add Session"}
          </button>
        </div>

        {/* Session History */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Session History</div>
          {sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8a96a3" }}>No sessions yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ background: "#f8fafb", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428", marginBottom: 6 }}>
                    {formatDate(s.startAt)} · {s.durationMinutes ?? 0} min
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#748398" }}>Status: </span>
                      <span style={{ fontSize: 12, color: "#1d2428" }}>{s.status || "-"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#748398" }}>Modality: </span>
                      <span style={{ fontSize: 12, color: "#1d2428" }}>{s.modality === "ONLINE" ? "Online" : s.modality === "IN_HOME" ? "In-home" : "-"}</span>
                    </div>
                    {s.notes && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#748398" }}>Notes: </span>
                        <span style={{ fontSize: 12, color: "#1d2428" }}>{s.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>}

      {/* ── SESSION NOTES TAB ────────────────────────────────────────────────── */}
      {activeTab === "notes" && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#748398", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>Session notes</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "7px 12px", marginBottom: 12 }}>
              {error}
            </div>
          )}

          {sessionNotes.length === 0 ? (
            <div style={{
              background: "#f4f7f9", borderRadius: 12, padding: "16px 18px",
              fontSize: 12, color: "#8a96a3", fontStyle: "italic",
            }}>
              No session notes yet.
            </div>
          ) : (
            sessionNotes.map(note => (
              <div key={note.id} style={{
                background: "#fff", borderRadius: 14, padding: "12px 16px",
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
              }}>
                {/* Date + status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428" }}>
                    {note.date}
                    {note.durationMinutes ? ` · ${note.durationMinutes} min` : ""}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                    background: note.status === "completed" ? "#d4edcc" : "#edf2f6",
                    color: note.status === "completed" ? "#2d5a24" : "#456071",
                  }}>
                    {note.status || "completed"}
                  </span>
                </div>

                {/* Note text */}
                <div style={{
                  fontSize: 13, color: "#456071", lineHeight: 1.6,
                  padding: "8px 12px", background: "rgba(69,96,113,0.04)",
                  borderRadius: 8, borderLeft: "2px solid rgba(69,96,113,0.2)",
                  fontStyle: "italic", whiteSpace: "pre-wrap",
                }}>
                  {note.notes}
                </div>

                {/* Link badges + toggle */}
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {note.unitPlanWeek ? (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "#edf2f6", color: "#456071" }}>
                      Unit plan · Week {note.unitPlanWeek}
                    </span>
                  ) : null}
                  {note.worksheetId ? (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                      📎 {worksheets.find(w => w.id === note.worksheetId)?.title ?? "Worksheet"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setLinkingSessionId(note.id);
                      setLinkWeek(note.unitPlanWeek ?? "");
                      setLinkWorksheetId(note.worksheetId ?? "");
                      setError(null);
                    }}
                    style={{ fontSize: 10, color: "#8a96a3", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}
                  >
                    {note.unitPlanWeek || note.worksheetId ? "Edit link" : "Link to plan / worksheet"}
                  </button>
                </div>

                {/* Inline link editor */}
                {linkingSessionId === note.id && (
                  <div style={{ marginTop: 10, background: "#f4f7f9", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ ...lbl, marginBottom: 3, display: "block" }}>Unit plan week</label>
                      <select
                        aria-label="Unit plan week"
                        value={linkWeek}
                        onChange={e => setLinkWeek(e.target.value === "" ? "" : Number(e.target.value))}
                        style={{ ...inp, fontSize: 12, padding: "6px 10px", width: "auto", minWidth: 130 }}
                      >
                        <option value="">No week</option>
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, marginBottom: 3, display: "block" }}>Worksheet</label>
                      <select
                        aria-label="Worksheet"
                        value={linkWorksheetId}
                        onChange={e => setLinkWorksheetId(e.target.value)}
                        style={{ ...inp, fontSize: 12, padding: "6px 10px", width: "auto", minWidth: 160 }}
                      >
                        <option value="">None</option>
                        {worksheets.map(w => (
                          <option key={w.id} value={w.id}>{w.title}{w.weekNumber ? ` (Wk ${w.weekNumber})` : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => handleSaveSessionLink(note.id)} style={{
                        background: "#456071", color: "#fff", border: "none",
                        borderRadius: 8, padding: "6px 14px", fontSize: 11,
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>
                        Save
                      </button>
                      <button type="button" onClick={() => setLinkingSessionId(null)} style={{
                        background: "#fff", color: "#677a8a", border: "none",
                        borderRadius: 8, padding: "6px 12px", fontSize: 11,
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── UNIT PLAN TAB ────────────────────────────────────────────────────── */}
      {activeTab === "plan" && (
        <div>
          {!activePlan && !editingPlan ? (
            <div style={{
              background: "#f4f7f9", borderRadius: 14, padding: "28px 20px",
              textAlign: "center", border: "1.5px dashed #e4eaef",
            }}>
              <div style={{ fontSize: 13, color: "#8a96a3", marginBottom: 12 }}>
                No active unit plan for this student.
              </div>
              <button type="button" onClick={() => { setEditingPlan(true); setError(null); }} style={{
                background: "#456071", color: "#fff", border: "none",
                borderRadius: 10, padding: "8px 20px", fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                Create unit plan
              </button>
            </div>
          ) : editingPlan ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: "18px 18px", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Term label</label>
                <input
                  value={planTermLabel}
                  onChange={e => setPlanTermLabel(e.target.value)}
                  placeholder="e.g. Term 2 2025"
                  style={inp}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
                <div>
                  <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Plan (Markdown)</label>
                  <textarea
                    value={planContent}
                    onChange={e => setPlanContent(e.target.value)}
                    placeholder={"## Week 1\nIntroduce key concepts...\n\n## Week 2\n..."}
                    rows={16}
                    style={{ ...inp, resize: "none", fontFamily: "monospace", fontSize: 12, lineHeight: 1.7 }}
                  />
                </div>
                <div>
                  <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Preview</label>
                  <div
                    className="prose prose-sm max-w-none"
                    style={{
                      border: "1.5px solid #e4eaef", borderRadius: 10,
                      padding: "10px 14px", background: "#fafbfc",
                      minHeight: 300, overflowY: "auto", fontSize: 12,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: planPreviewHtml || "<p style='color:#b0bec5;font-style:italic'>Preview appears here...</p>",
                    }}
                  />
                </div>
              </div>
              {error && (
                <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "7px 12px", margin: "10px 0" }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={handleSavePlan} disabled={savingPlan} style={{
                  background: "#456071", color: "#fff", border: "none",
                  borderRadius: 10, padding: "8px 20px", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  opacity: savingPlan ? 0.6 : 1,
                }}>
                  {savingPlan ? "Saving..." : "Save plan"}
                </button>
                <button type="button" onClick={() => { setEditingPlan(false); setError(null); }} style={{
                  background: "#f4f7f9", color: "#677a8a", border: "none",
                  borderRadius: 10, padding: "8px 16px", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ background: "#fff", borderRadius: 16, padding: "18px 18px", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1d2428" }}>{activePlan!.termLabel}</div>
                    <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 2 }}>Active unit plan</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => {
                      setPlanContent(activePlan!.content);
                      setPlanTermLabel(activePlan!.termLabel);
                      setEditingPlan(true);
                    }} style={{
                      background: "#edf2f6", color: "#456071", border: "none",
                      borderRadius: 8, padding: "5px 14px", fontSize: 11,
                      fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Edit
                    </button>
                    <button type="button" onClick={handleCompletePlan} style={{
                      background: "#d4edcc", color: "#2d5a24", border: "none",
                      borderRadius: 8, padding: "5px 14px", fontSize: 11,
                      fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      Mark complete
                    </button>
                  </div>
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: activePlan!.contentHtml }}
                />
              </div>

              {planHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#748398", marginBottom: 8 }}>
                    Previous plans
                  </div>
                  {planHistory.map(p => (
                    <div key={p.id} style={{
                      background: "#f4f7f9", borderRadius: 12, padding: "10px 14px",
                      border: "1px solid rgba(0,0,0,0.05)", marginBottom: 6,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2428" }}>{p.termLabel}</div>
                      <span style={{ fontSize: 10, color: "#82977e", fontWeight: 600, background: "#edf5eb", borderRadius: 20, padding: "2px 9px" }}>
                        Completed
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => { setPlanContent(""); setPlanTermLabel(""); setEditingPlan(true); }} style={{
                marginTop: 12, background: "transparent", color: "#456071",
                border: "1.5px dashed #b8cad6", borderRadius: 10,
                padding: "8px 20px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", width: "100%",
              }}>
                + Start new plan for next term
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WORKSHEETS TAB ───────────────────────────────────────────────────── */}
      {activeTab === "worksheets" && (
        <div>
          {addingWorksheet ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: "18px 18px", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 14 }}>New worksheet</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Title</label>
                  <input value={wsTitle} onChange={e => setWsTitle(e.target.value)}
                    placeholder="e.g. Quadratics Practice Set 1" style={inp} />
                </div>
                <div>
                  <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Subject</label>
                  <select aria-label="Subject" value={wsSubject} onChange={e => setWsSubject(e.target.value)}
                    style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Select subject</option>
                    {["Maths", "Specialist Maths", "Math Methods", "General Maths", "Essential Maths", "English", "Science", "Chemistry", "Physics", "Biology", "HASS", "Study Skills", "Other"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Week number (optional)</label>
                <select
                  aria-label="Week number"
                  value={wsWeekNumber}
                  onChange={e => setWsWeekNumber(e.target.value === "" ? "" : Number(e.target.value))}
                  style={{ ...inp, cursor: "pointer", maxWidth: 160 }}
                >
                  <option value="">No specific week</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Notes</label>
                <textarea
                  value={wsNotes}
                  onChange={e => setWsNotes(e.target.value)}
                  placeholder="What this worksheet covers, how to use it, any tips..."
                  rows={3}
                  style={{ ...inp, resize: "none" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, display: "block", marginBottom: 4 }}>Attach file (optional)</label>
                <div
                  style={{
                    border: "2px dashed #e4eaef", borderRadius: 10, padding: "14px",
                    textAlign: "center", cursor: "pointer",
                    background: wsFile ? "#f0f5ee" : "#fafbfc",
                  }}
                  onClick={() => document.getElementById("ws-file-input")?.click()}
                >
                  <input
                    id="ws-file-input"
                    type="file"
                    aria-label="Attach file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                    style={{ display: "none" }}
                    onChange={e => setWsFile(e.target.files?.[0] ?? null)}
                  />
                  {wsFile ? (
                    <div style={{ fontSize: 12, color: "#2d5a24", fontWeight: 600 }}>
                      {wsFile.name} · {(wsFile.size / 1024).toFixed(0)} KB
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#8a96a3" }}>
                      Click to attach a PDF, Word, or image — max 20MB
                    </div>
                  )}
                </div>
                {wsUploading && (
                  <div style={{ height: 5, background: "#edf0f3", borderRadius: 20, overflow: "hidden", marginTop: 8 }}>
                    <div style={{ height: "100%", background: "#456071", width: `${wsUploadProgress}%`, transition: "width 0.2s" }} />
                  </div>
                )}
              </div>

              {error && (
                <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "7px 12px", marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleSaveWorksheet} disabled={savingWorksheet || wsUploading} style={{
                  background: "#456071", color: "#fff", border: "none",
                  borderRadius: 10, padding: "8px 20px", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  opacity: savingWorksheet || wsUploading ? 0.6 : 1,
                }}>
                  {savingWorksheet ? "Saving..." : "Save worksheet"}
                </button>
                <button type="button" onClick={() => { setAddingWorksheet(false); setError(null); setWsFile(null); }} style={{
                  background: "#f4f7f9", color: "#677a8a", border: "none",
                  borderRadius: 10, padding: "8px 16px", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setAddingWorksheet(true); setError(null); }} style={{
              width: "100%", background: "#fff", color: "#456071",
              border: "1.5px dashed #b8cad6", borderRadius: 12,
              padding: "10px 0", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
            }}>
              + Add worksheet
            </button>
          )}

          {worksheets.length === 0 && !addingWorksheet ? (
            <div style={{ background: "#f4f7f9", borderRadius: 12, padding: "20px", textAlign: "center", fontSize: 12, color: "#8a96a3", fontStyle: "italic" }}>
              No worksheets stored yet.
            </div>
          ) : (
            worksheets.map(ws => (
              <div key={ws.id} style={{
                background: "#fff", borderRadius: 14, padding: "12px 16px",
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{ws.title}</div>
                      {ws.subject && (
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#edf2f6", color: "#456071" }}>
                          {ws.subject}
                        </span>
                      )}
                      {ws.weekNumber && (
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                          Week {ws.weekNumber}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#677a8a", lineHeight: 1.5 }}>{ws.notes}</div>
                    {ws.fileUrl && (
                      <a href={ws.fileUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#456071", fontWeight: 600, textDecoration: "none", display: "inline-block", marginTop: 5 }}>
                        📎 {ws.fileName ?? "View file"}
                      </a>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDeleteWorksheet(ws)} style={{
                    background: "#fce8ee", color: "#c0445e", border: "none",
                    borderRadius: 8, padding: "4px 10px", fontSize: 11,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
