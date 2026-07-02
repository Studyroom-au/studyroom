"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { uploadSessionWorkSample } from "@/lib/storage";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

// Full shape matches what uploadSessionWorkSample returns and SessionLogEditor saves.
// path/contentType are optional so older log docs without them still deserialise.
type Attachment = {
  url: string;
  path?: string;
  fileName: string;
  contentType?: string;
  size?: number;
};

type LogEntry = {
  id: string;
  text: string;
  attachments: Attachment[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SessionOption = {
  id: string;
  startAt?: Timestamp;
  durationMinutes?: number;
  status?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts?: Timestamp): string {
  if (!ts) return "Unknown date";
  return ts.toDate().toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(ts?: Timestamp): string {
  if (!ts) return "Unknown date";
  return ts.toDate().toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function uploadFiles(
  files: File[],
  tutorId: string,
  sessionId: string
): Promise<Attachment[]> {
  const results: Attachment[] = [];
  for (const file of files) {
    const up = await uploadSessionWorkSample({ tutorId, sessionId, file });
    results.push({
      url: up.url,
      path: up.path,
      fileName: up.fileName,
      contentType: up.contentType,
      size: up.size,
    });
  }
  return results;
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  border: "1.5px solid rgba(0,0,0,0.09)",
  borderRadius: 9,
  padding: "7px 11px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "#1d2428",
  outline: "none",
  width: "100%",
  background: "#fff",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#748398",
  marginBottom: 4,
  display: "block",
};

// ─── Sub-component: attachment chip (view or edit) ────────────────────────────

function AttachmentChip({
  att,
  onRemove,
}: {
  att: Attachment;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px 3px 10px",
        borderRadius: 20,
        background: "#edf2f6",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#456071", textDecoration: "none" }}
      >
        📎 {att.fileName}
        {att.size ? (
          <span style={{ color: "#8a96a3", fontWeight: 400 }}>
            {" "}
            {fmtSize(att.size)}
          </span>
        ) : null}
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${att.fileName}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#c0445e",
            fontSize: 13,
            lineHeight: 1,
            padding: "0 1px",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ─── Sub-component: file picker strip ─────────────────────────────────────────

function FilePicker({
  id,
  files,
  onChange,
}: {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div>
      <label htmlFor={id} style={lbl}>
        Attach files (optional)
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx"
        aria-label="Attach files"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        style={{ fontSize: 12, color: "#677a8a" }}
      />
      {files.length > 0 && (
        <div style={{ fontSize: 11, color: "#748398", marginTop: 4 }}>
          {files.map((f) => f.name).join(", ")}
          {files.some((f) => f.size > MAX_FILE_BYTES) && (
            <span style={{ color: "#c0445e" }}> — some files exceed 20 MB</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentSessionHistoryPanel({
  sessions,
}: {
  sessions: SessionOption[];
}) {
  // Logs keyed by sessionId
  const [logsBySessions, setLogsBySessions] = useState<Record<string, LogEntry[]>>({});
  const [loading, setLoading] = useState(true);

  // Edit-in-place state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editKeptAttachments, setEditKeptAttachments] = useState<Attachment[]>([]);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add-new-note state
  const [addingNote, setAddingNote] = useState(false);
  const [addSessionId, setAddSessionId] = useState("");
  const [addText, setAddText] = useState("");
  const [addFiles, setAddFiles] = useState<File[]>([]);
  const [savingAdd, setSavingAdd] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // ── Load all logs whenever the sessions list changes ──────────────────────

  useEffect(() => {
    if (sessions.length === 0) {
      setLoading(false);
      setLogsBySessions({});
      return;
    }

    let alive = true;
    setLoading(true);

    async function loadAllLogs() {
      const map: Record<string, LogEntry[]> = {};
      await Promise.all(
        sessions.map(async (s) => {
          try {
            const snap = await getDocs(
              query(
                collection(db, "sessions", s.id, "logs"),
                orderBy("createdAt", "asc")
              )
            );
            map[s.id] = snap.docs.map((d) => {
              const ld = d.data();
              return {
                id: d.id,
                text: String(ld.text ?? "").trim(),
                attachments: Array.isArray(ld.attachments)
                  ? (ld.attachments as Attachment[])
                  : [],
                createdAt: ld.createdAt as Timestamp | undefined,
                updatedAt: ld.updatedAt as Timestamp | undefined,
              };
            });
          } catch {
            map[s.id] = [];
          }
        })
      );
      if (alive) {
        setLogsBySessions(map);
        setLoading(false);
      }
    }

    loadAllLogs();
    return () => {
      alive = false;
    };
  }, [sessions]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function startEdit(sessionId: string, log: LogEntry) {
    setEditingLogId(log.id);
    setEditingSessionId(sessionId);
    setEditDraft(log.text);
    setEditKeptAttachments([...log.attachments]);
    setEditFiles([]);
    setError(null);
  }

  function cancelEdit() {
    setEditingLogId(null);
    setEditingSessionId(null);
    setEditDraft("");
    setEditKeptAttachments([]);
    setEditFiles([]);
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editingLogId || !editingSessionId) return;
    if (!editDraft.trim()) {
      setError("Note text cannot be empty.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("Not signed in.");
      return;
    }
    for (const f of editFiles) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" exceeds 20 MB.`);
        return;
      }
    }

    setSavingEdit(true);
    setError(null);
    try {
      const newAttachments = await uploadFiles(editFiles, user.uid, editingSessionId);
      const mergedAttachments = [...editKeptAttachments, ...newAttachments];

      await updateDoc(
        doc(db, "sessions", editingSessionId, "logs", editingLogId),
        {
          text: editDraft.trim(),
          attachments: mergedAttachments,
          updatedAt: serverTimestamp(),
        }
      );

      setLogsBySessions((prev) => ({
        ...prev,
        [editingSessionId]: (prev[editingSessionId] ?? []).map((l) =>
          l.id === editingLogId
            ? { ...l, text: editDraft.trim(), attachments: mergedAttachments }
            : l
        ),
      }));
      cancelEdit();
    } catch (err) {
      console.error("[session-log edit]", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddNote() {
    if (!addSessionId) {
      setError("Please select a session.");
      return;
    }
    if (!addText.trim()) {
      setError("Please enter a note.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setError("Not signed in.");
      return;
    }
    for (const f of addFiles) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" exceeds 20 MB.`);
        return;
      }
    }

    setSavingAdd(true);
    setError(null);
    try {
      const uploadedAttachments = await uploadFiles(addFiles, user.uid, addSessionId);

      const ref = await addDoc(collection(db, "sessions", addSessionId, "logs"), {
        tutorId: user.uid,
        text: addText.trim(),
        attachments: uploadedAttachments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newEntry: LogEntry = {
        id: ref.id,
        text: addText.trim(),
        attachments: uploadedAttachments,
      };

      setLogsBySessions((prev) => ({
        ...prev,
        [addSessionId]: [...(prev[addSessionId] ?? []), newEntry],
      }));

      setAddText("");
      setAddSessionId("");
      setAddFiles([]);
      setAddingNote(false);
    } catch (err) {
      console.error("[session-log add]", err);
      setError("Failed to add note. Please try again.");
    } finally {
      setSavingAdd(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const sessionsWithLogs = sessions.filter(
    (s) => (logsBySessions[s.id] ?? []).length > 0
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Section header + "Add note" trigger */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 12,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#748398",
          display: "flex", alignItems: "center", gap: 10, flex: 1,
        }}>
          <span>Session notes &amp; work samples</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
        </div>
        {sessions.length > 0 && !addingNote && (
          <button
            type="button"
            onClick={() => { setAddingNote(true); setError(null); }}
            style={{
              marginLeft: 12, background: "#456071", color: "#fff",
              border: "none", borderRadius: 8, padding: "5px 13px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", flexShrink: 0,
            }}
          >
            + Add note
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          fontSize: 12, color: "#c0445e", background: "#fce8ee",
          borderRadius: 9, padding: "7px 12px", marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {/* ── Add note form ──────────────────────────────────────────────────── */}
      {addingNote && (
        <div style={{
          background: "#fff", borderRadius: 14, padding: "14px 16px",
          border: "1.5px solid #b8cad6", marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#1d2428", marginBottom: 10 }}>
            New session note
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Session</label>
            <select
              aria-label="Select session for note"
              value={addSessionId}
              onChange={(e) => setAddSessionId(e.target.value)}
              style={{ ...inp, cursor: "pointer" }}
            >
              <option value="">Select a session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDateTime(s.startAt)}
                  {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Note</label>
            <textarea
              aria-label="Note text"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              rows={4}
              placeholder="What was covered? Next steps? Homework?"
              style={{ ...inp, resize: "vertical", minHeight: 80 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <FilePicker
              id="add-log-files"
              files={addFiles}
              onChange={setAddFiles}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={savingAdd}
              style={{
                background: "#456071", color: "#fff", border: "none",
                borderRadius: 9, padding: "7px 16px", fontSize: 12,
                fontWeight: 600, cursor: savingAdd ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: savingAdd ? 0.6 : 1,
              }}
            >
              {savingAdd
                ? (addFiles.length > 0 ? "Uploading…" : "Saving…")
                : "Save note"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingNote(false);
                setAddText("");
                setAddSessionId("");
                setAddFiles([]);
                setError(null);
              }}
              style={{
                background: "#f4f7f9", color: "#677a8a", border: "none",
                borderRadius: 9, padding: "7px 14px", fontSize: 12,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ fontSize: 12, color: "#8a96a3", padding: "8px 0" }}>
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          background: "#f4f7f9", borderRadius: 12, padding: "14px 16px",
          fontSize: 12, color: "#8a96a3", fontStyle: "italic",
        }}>
          No sessions yet. Create a session in the Sessions calendar before adding notes.
        </div>
      ) : sessionsWithLogs.length === 0 ? (
        <div style={{
          background: "#f4f7f9", borderRadius: 12, padding: "14px 16px",
          fontSize: 12, color: "#8a96a3", fontStyle: "italic",
        }}>
          No session notes yet. Use &ldquo;+ Add note&rdquo; above, or add notes via the
          Session log in the Sessions calendar.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessionsWithLogs.map((s) => {
            const logs = logsBySessions[s.id] ?? [];
            return (
              <div
                key={s.id}
                style={{
                  background: "#fff", borderRadius: 14, padding: "12px 16px",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {/* Session date header */}
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "#1d2428", marginBottom: 10,
                }}>
                  {formatDate(s.startAt)}
                  {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                </div>

                {/* Log entries */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(69,96,113,0.04)",
                        borderRadius: 8,
                        borderLeft: "2px solid rgba(69,96,113,0.2)",
                      }}
                    >
                      {editingLogId === log.id && editingSessionId === s.id ? (
                        /* ── Edit mode ─────────────────────────────────────── */
                        <div>
                          <textarea
                            aria-label="Edit note"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={4}
                            style={{ ...inp, resize: "vertical", minHeight: 80, marginBottom: 8 }}
                          />

                          {/* Existing attachments — removable */}
                          {editKeptAttachments.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                              {editKeptAttachments.map((att, i) => (
                                <AttachmentChip
                                  key={i}
                                  att={att}
                                  onRemove={() =>
                                    setEditKeptAttachments((prev) =>
                                      prev.filter((a) => a.url !== att.url)
                                    )
                                  }
                                />
                              ))}
                            </div>
                          )}

                          {/* Add more files */}
                          <div style={{ marginBottom: 10 }}>
                            <FilePicker
                              id={`edit-log-files-${log.id}`}
                              files={editFiles}
                              onChange={setEditFiles}
                            />
                          </div>

                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={savingEdit}
                              style={{
                                background: "#456071", color: "#fff", border: "none",
                                borderRadius: 8, padding: "5px 14px", fontSize: 11,
                                fontWeight: 600, cursor: savingEdit ? "not-allowed" : "pointer",
                                fontFamily: "inherit", opacity: savingEdit ? 0.6 : 1,
                              }}
                            >
                              {savingEdit
                                ? (editFiles.length > 0 ? "Uploading…" : "Saving…")
                                : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={{
                                background: "#f4f7f9", color: "#677a8a", border: "none",
                                borderRadius: 8, padding: "5px 12px", fontSize: 11,
                                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── View mode ─────────────────────────────────────── */
                        <div>
                          {log.text && (
                            <p style={{
                              fontSize: 13, color: "#456071", lineHeight: 1.6,
                              whiteSpace: "pre-wrap", margin: "0 0 6px",
                            }}>
                              {log.text}
                            </p>
                          )}

                          {log.attachments.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                              {log.attachments.map((att, i) => (
                                <AttachmentChip key={i} att={att} />
                              ))}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => startEdit(s.id, log)}
                            style={{
                              fontSize: 10, color: "#8a96a3", background: "none",
                              border: "none", cursor: "pointer", fontFamily: "inherit",
                              textDecoration: "underline", padding: 0,
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
