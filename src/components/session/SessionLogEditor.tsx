"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { uploadSessionWorkSample } from "@/lib/storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type Attachment = {
  url: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
};

export default function SessionLogEditor({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");

      // quick client-side permission check (real enforcement still in rules)
      const sref = doc(db, "sessions", sessionId);
      const ssnap = await getDoc(sref);
      if (!ssnap.exists()) throw new Error("Session missing.");
      const sdata = ssnap.data() as any;

      const isAdmin = (user.email || "").toLowerCase() === "lily.studyroom@gmail.com";
      if (!isAdmin && sdata.tutorId !== user.uid) throw new Error("Not permitted.");

      // create log doc first
      const logRef = await addDoc(collection(db, "sessions", sessionId, "logs"), {
        tutorId: user.uid,
        text: text || "",
        attachments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const attachments: Attachment[] = [];

      for (const f of files) {
        const up = await uploadSessionWorkSample({
          tutorId: user.uid,
          sessionId,
          file: f,
        });

        attachments.push({
          url: up.url,
          path: up.path,
          fileName: up.fileName,
          contentType: up.contentType,
          size: up.size,
        });
      }

      if (attachments.length) {
        await updateDoc(logRef, {
          attachments,
          updatedAt: serverTimestamp(),
        });
      }

      setText("");
      setFiles([]);
      setMsg("Saved ✅");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[color:var(--ring)] bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-[color:var(--ink)]">Session log</h3>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Notes + upload work samples (photos/PDFs).
      </p>

      {/* ✅ a11y label */}
      <label
        htmlFor="sessionLogText"
        className="mt-3 block text-xs font-semibold text-[color:var(--muted)]"
      >
        Session notes
      </label>
      <textarea
        id="sessionLogText"
        name="sessionLogText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-2 w-full rounded-2xl border border-[color:var(--ring)] p-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--brand)]"
        placeholder="What did you cover? What worked? Next steps? Homework?"
        aria-label="Session notes"
      />

      <div className="mt-3 flex flex-col gap-2">
        {/* ✅ a11y label */}
        <label
          htmlFor="sessionLogFiles"
          className="block text-xs font-semibold text-[color:var(--muted)]"
        >
          Upload work samples
        </label>
        <input
          id="sessionLogFiles"
          name="sessionLogFiles"
          type="file"
          multiple
          accept="image/*,application/pdf"
          title="Upload work samples"
          aria-label="Upload work samples"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="text-sm"
        />

        {!!files.length && (
          <div className="text-xs text-[color:var(--muted)]">{files.length} file(s) selected</div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="brand-cta rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save log"}
        </button>

        {msg && <div className="text-sm text-[color:var(--muted)]">{msg}</div>}
      </div>
    </div>
  );
}
