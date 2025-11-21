"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

type Task = { id: string; title: string; done: boolean };

export default function TasksWidget() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const q = query(
      collection(db, "users", u.uid, "tasks"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      const rows: Task[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Task, "id">) }));
      setTasks(rows);
    });
  }, []);

  const add = async () => {
    const title = text.trim();
    if (!title) return;
    const u = auth.currentUser;
    if (!u) return;
    await addDoc(collection(db, "users", u.uid, "tasks"), {
      title,
      done: false,
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  const toggle = async (t: Task) => {
    const u = auth.currentUser; if (!u) return;
    await updateDoc(doc(db, "users", u.uid, "tasks", t.id), { done: !t.done });
  };

  const del = async (t: Task) => {
    const u = auth.currentUser; if (!u) return;
    await deleteDoc(doc(db, "users", u.uid, "tasks", t.id));
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Add a task…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className="rounded-lg border px-3 py-2 hover:bg-black/5">
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border p-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
              <span className={t.done ? "line-through text-neutral-500" : ""}>{t.title}</span>
            </label>
            <button
              onClick={() => del(t)}
              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              title="Delete task"
            >
              Delete
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="rounded border p-2 text-sm text-neutral-500">No tasks yet.</li>
        )}
      </ul>
    </div>
  );
}
