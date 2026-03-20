"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

type Resource = {
  id: string;
  title: string;
  subject: string;
  type: "worksheet" | "past_paper" | "guide" | "flashcard" | "other";
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  assignedTo: string[];
};

const SUBJECT_COLORS: Record<string, string> = {
  Maths: "#456071",
  English: "#82977e",
  Chemistry: "#748398",
  Physics: "#e39bb6",
  Japanese: "#c4a464",
  Biology: "#7aa8c0",
  "Study Skills": "#c4bbaf",
};

const TYPE_LABELS: Record<string, string> = {
  worksheet: "Worksheet",
  past_paper: "Past paper",
  guide: "Study guide",
  flashcard: "Flashcards",
  other: "Resource",
};

const lbl: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#748398",
  display: "block",
  marginBottom: 5,
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1.5px solid #e4eaef",
  fontSize: 13,
  color: "#1d2428",
  background: "#fff",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export default function TutorResourcesPage() {
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resources, setResources] = useState<Resource[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; studentName: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<Resource["type"]>("worksheet");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/"); return; }

      // Load this tutor's resources
      const q = query(
        collection(db, "resources"),
        where("uploadedBy", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(q, (snap) => {
        setResources(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Resource[]);
      });

      // Load assigned students
      const studentsSnap = await getDocs(
        query(
          collection(db, "students"),
          where("assignedTutorId", "==", u.uid)
        )
      );
      setStudents(
        studentsSnap.docs.map((d) => ({
          id: d.id,
          studentName: String(d.data().studentName ?? "Unknown"),
        }))
      );

      return () => unsub();
    });
    return () => off();
  }, [router]);

  async function handleUpload() {
    if (!selectedFile) { setError("Please select a file."); return; }
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!subject) { setError("Please select a subject."); return; }

    const u = auth.currentUser;
    if (!u) return;

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File must be under 20MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const filePath = `resources/${u.uid}/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      const fileUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snap) => {
            setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          },
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      await addDoc(collection(db, "resources"), {
        title: title.trim(),
        subject,
        type,
        description: description.trim(),
        fileUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadedBy: u.uid,
        uploadedByName: u.displayName || u.email || "Tutor",
        uploadedAt: new Date().toISOString().split("T")[0],
        assignedTo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle("");
      setSubject("");
      setType("worksheet");
      setDescription("");
      setAssignedTo([]);
      setSelectedFile(null);
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      setSuccess("Resource uploaded successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("[upload-resource]", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleDelete(resourceId: string, fileUrl: string) {
    if (!window.confirm("Delete this resource? Students will lose access.")) return;
    try {
      await deleteDoc(doc(db, "resources", resourceId));
      try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      } catch {
        // Non-fatal — file may already be gone
      }
    } catch (err) {
      console.error("[delete-resource]", err);
    }
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100svh", padding: "0 0 60px" }}>
      {/* Header card */}
      <div style={{
        background: "#fff",
        borderRadius: "0 0 20px 20px",
        padding: "14px 20px 12px",
        marginBottom: 20,
        border: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#748398", marginBottom: 4 }}>
          Resources
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1d2428", letterSpacing: "-0.02em" }}>
          Upload resources
        </div>
        <div style={{ fontSize: 13, color: "#8a96a3", marginTop: 3 }}>
          Share worksheets, past papers, and study guides with your students.
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>

        {/* Upload form */}
        <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 14 }}>
            Upload new resource
          </div>

          {/* Title + subject */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Year 10 Quadratics Worksheet"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ ...inp, cursor: "pointer" }}
              >
                <option value="">Select subject</option>
                {["Maths", "Specialist Maths", "Math Methods", "General Maths", "Essential Maths", "English", "Science", "Chemistry", "Physics", "Biology", "HASS", "Study Skills", "Other"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + description */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Resource["type"])}
                style={{ ...inp, cursor: "pointer" }}
              >
                <option value="worksheet">Worksheet</option>
                <option value="past_paper">Past paper</option>
                <option value="guide">Study guide</option>
                <option value="flashcard">Flashcards</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                style={inp}
              />
            </div>
          </div>

          {/* Assign to students */}
          {students.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Assign to students (leave empty for all)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setAssignedTo((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                      )
                    }
                    style={{
                      padding: "5px 13px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border: "none",
                      transition: "all 0.15s",
                      background: assignedTo.includes(s.id) ? "#456071" : "#f4f7f9",
                      color: assignedTo.includes(s.id) ? "#fff" : "#677a8a",
                    }}
                  >
                    {s.studentName}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 5 }}>
                {assignedTo.length === 0
                  ? "All your students can see this resource."
                  : `Only ${assignedTo.length} selected student${assignedTo.length > 1 ? "s" : ""} can see this.`}
              </div>
            </div>
          )}

          {/* File picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>File</label>
            <div
              style={{
                border: "2px dashed #e4eaef",
                borderRadius: 12,
                padding: "20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.15s",
                background: selectedFile ? "#f0f5ee" : "#fafbfc",
              }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSelectedFile(f);
                }}
              />
              {selectedFile ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2d5a24" }}>{selectedFile.name}</div>
                  <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 3 }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: "#748398", fontWeight: 600 }}>Click to choose a file</div>
                  <div style={{ fontSize: 11, color: "#b0bec5", marginTop: 3 }}>
                    PDF, Word, PowerPoint, Excel, or images — max 20MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div style={{ height: 6, background: "#edf0f3", borderRadius: 20, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                height: "100%",
                background: "#456071",
                borderRadius: 20,
                width: `${uploadProgress}%`,
                transition: "width 0.2s ease",
              }} />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "#c0445e", background: "#fce8ee", borderRadius: 9, padding: "8px 12px", marginBottom: 12 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ fontSize: 12, color: "#2d5a24", background: "#d4edcc", borderRadius: 9, padding: "8px 12px", marginBottom: 12 }}>
              {success}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            style={{
              background: uploading || !selectedFile ? "#b8cad6" : "#456071",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "11px 24px",
              fontSize: 13,
              fontWeight: 700,
              cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {uploading ? `Uploading... ${uploadProgress}%` : "Upload resource"}
          </button>
        </div>

        {/* Uploaded resources list */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#748398", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Your uploads</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
        </div>

        {resources.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "32px 20px", textAlign: "center", border: "1.5px dashed #e4eaef" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 13, color: "#8a96a3" }}>No resources uploaded yet.</div>
          </div>
        ) : (
          resources.map((r) => {
            const color = SUBJECT_COLORS[r.subject] ?? "#748398";
            return (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "12px 16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1d2428" }}>{r.title}</div>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${color}18`, color }}>
                      {r.subject}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#f4f7f9", color: "#748398" }}>
                      {TYPE_LABELS[r.type] ?? "Resource"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8a96a3" }}>
                    {r.fileName}
                    {r.fileSize ? ` · ${(r.fileSize / 1024).toFixed(0)} KB` : ""}
                    {r.assignedTo?.length > 0
                      ? ` · ${r.assignedTo.length} student${r.assignedTo.length > 1 ? "s" : ""}`
                      : " · All students"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "#edf2f6",
                      color: "#456071",
                      border: "none",
                      borderRadius: 8,
                      padding: "5px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(r.id, r.fileUrl)}
                    style={{
                      background: "#fce8ee",
                      color: "#c0445e",
                      border: "none",
                      borderRadius: 8,
                      padding: "5px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
