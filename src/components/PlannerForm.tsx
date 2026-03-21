"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function detectSubject(title: string): string {
  const t = title.toLowerCase();
  if (/math|specialist/.test(t)) return "Maths";
  if (/english|essay|speech|lit|rhetoric|creative writing/.test(t)) return "English";
  if (/chem/.test(t)) return "Chemistry";
  if (/phys(?!ical|io)/.test(t)) return "Physics";
  if (/bio/.test(t)) return "Biology";
  if (/japanese|french|german|spanish|chinese|korean|mandarin|italian|indonesian|arabic|hindi|latin/.test(t)) return "Languages";
  if (/ancient history|modern history|history/.test(t)) return "History";
  if (/geog/.test(t)) return "Geography";
  if (/psych/.test(t)) return "Psychology";
  if (/music|band|choir|instrumental/.test(t)) return "Music";
  if (/visual art|studio art|art(?!ificial)/.test(t)) return "Visual Art";
  if (/drama|theatre/.test(t)) return "Drama";
  if (/physical education|sport|^pe$|^pe /.test(t)) return "Physical Education";
  if (/legal studies|law/.test(t)) return "Legal Studies";
  if (/business|economics|accounting|commerce/.test(t)) return "Business";
  if (/ict|digital|computer|software|information tech/.test(t)) return "Digital Technology";
  if (/design|technology|engineering|industrial/.test(t)) return "Technology";
  if (/health(?! ed)|nutrition/.test(t)) return "Health";
  if (/health ed/.test(t)) return "Health Education";
  if (/social science|society|social stud/.test(t)) return "Social Science";
  if (/science(?! of)/.test(t)) return "Science";
  if (/study skills|study hall/.test(t)) return "Study Skills";
  if (/religion|studies of religion/.test(t)) return "Religion";
  if (/philosophy|ethics/.test(t)) return "Philosophy";
  if (/film|media|television/.test(t)) return "Media";
  if (/dance/.test(t)) return "Dance";
  if (/agriculture|rural/.test(t)) return "Agriculture";
  if (/marine|aquatic/.test(t)) return "Marine Science";
  if (/earth|environmental/.test(t)) return "Earth & Environmental";
  if (/astronomy|space/.test(t)) return "Astronomy";
  if (/certificate|cert iii|cert iv|tafe|vet/.test(t)) return "VET";
  return "Study";
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function getDefaultStartDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  border: "1.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "#1d2428",
  outline: "none",
  width: "100%",
  background: "#fff",
  boxSizing: "border-box",
};

export default function PlannerForm() {
  const [planType, setPlanType]   = useState<"exam" | "assessment">("exam");
  const [showDraft, setShowDraft] = useState(false);
  const [taskName, setTaskName]   = useState("");
  const [examDate, setExamDate]   = useState(getDefaultDueDate());
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [dueDate, setDueDate]     = useState(getDefaultDueDate());
  const [draftDate, setDraftDate] = useState("");
  const [err, setErr]             = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  async function handleAdd() {
    setErr(null);
    setSaved(false);
    const u = auth.currentUser;
    if (!u) { setErr("Please sign in."); return; }
    if (!taskName.trim()) { setErr("Please enter a name."); return; }

    const subject = detectSubject(taskName.trim());

    if (planType === "exam") {
      if (!examDate) { setErr("Please enter an exam date."); return; }
      await addDoc(collection(db, "users", u.uid, "upcoming"), {
        subject,
        title: taskName.trim(),
        dueDate: examDate,
        type: "exam",
        completed: false,
        createdAt: serverTimestamp(),
      });
    } else {
      if (!dueDate) { setErr("Please enter a due date."); return; }
      await addDoc(collection(db, "users", u.uid, "upcoming"), {
        subject,
        title: taskName.trim(),
        dueDate,
        handoutDate: startDate || null,
        draftDate: draftDate || null,
        type: "assessment",
        completed: false,
        createdAt: serverTimestamp(),
      });
    }

    setTaskName("");
    setExamDate(getDefaultDueDate());
    setStartDate(getDefaultStartDate());
    setDueDate(getDefaultDueDate());
    setDraftDate("");
    setShowDraft(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div>
      {/* Type selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {(["exam", "assessment"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setPlanType(t); setShowDraft(false); }}
            style={{
              padding: "12px 10px",
              borderRadius: 12,
              border: planType === t ? "2px solid #456071" : "1.5px solid rgba(0,0,0,0.1)",
              background: planType === t ? "#f0f5f8" : "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "center",
              transition: "all .15s",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{t === "exam" ? "📋" : "📝"}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: planType === t ? "#456071" : "#1d2428" }}>
              {t === "exam" ? "Exam" : "Assessment"}
            </div>
            <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 2 }}>
              {t === "exam" ? "One date only" : "Start to due date"}
            </div>
          </button>
        ))}
      </div>

      {/* Name */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>Name</div>
        <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Maths IA" style={inputStyle} />
        {taskName.trim() && (
          <div style={{ fontSize: 10, color: "#8a96a3", marginTop: 3 }}>
            Subject: {detectSubject(taskName.trim())}
          </div>
        )}
      </div>

      {/* Exam fields */}
      {planType === "exam" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>Exam date</div>
          <input type="date" aria-label="Exam date" value={examDate} onChange={e => setExamDate(e.target.value)} style={inputStyle} />
        </div>
      )}

      {/* Assessment fields */}
      {planType === "assessment" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>
                Start date
                <span style={{ fontSize: 9, background: "rgba(0,0,0,.06)", color: "#8a96a3", padding: "1px 6px", borderRadius: 20, marginLeft: 5 }}>optional</span>
              </div>
              <input type="date" aria-label="Start date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>Due date</div>
              <input type="date" aria-label="Due date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDraft(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#456071", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 0", marginBottom: showDraft ? 8 : 0 }}
          >
            {showDraft ? "− Remove draft date" : "+ Add draft milestone"}
          </button>
          {showDraft && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#748398", marginBottom: 3 }}>Draft due date</div>
              <input type="date" aria-label="Draft due date" value={draftDate} onChange={e => setDraftDate(e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{err}</div>}
      {saved && <div style={{ fontSize: 12, color: "#2d5a24", marginTop: 6 }}>Added to your timeline ✓</div>}

      <button
        type="button"
        onClick={handleAdd}
        style={{ width: "100%", background: "#456071", color: "#fff", border: "none", borderRadius: 11, padding: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}
      >
        Add to planner
      </button>
    </div>
  );
}
