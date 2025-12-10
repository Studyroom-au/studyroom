"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const role = useUserRole();
  const router = useRouter();
  const [users, setUsers] = useState<Array<{ id: string; name?: string; email?: string; role?: string }>>([]);

  useEffect(() => {
    if (role === "student" || role === null) {
      router.push("/hub");
      return;
    }

    async function load() {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    load();
  }, [role, router]);

  if (role !== "admin") return <div className="p-6">Not authorised.</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold mb-6">Admin Dashboard</h1>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2">Name</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Role</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id}>
              <td className="border p-2">{u.name}</td>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.role}</td>
              <td className="border p-2 space-x-2">
                <button
                  className="px-2 py-1 bg-emerald-600 text-white rounded"
                  onClick={async () => {
                    await updateDoc(doc(db, "roles", u.id), { role: "tutor" });
                    await updateDoc(doc(db, "users", u.id), { role: "tutor" });
                    alert("Promoted to tutor");
                  }}
                >
                  Promote to Tutor
                </button>

                <button
                  className="px-2 py-1 bg-rose-600 text-white rounded"
                  onClick={async () => {
                    await updateDoc(doc(db, "roles", u.id), { role: "student" });
                    await updateDoc(doc(db, "users", u.id), { role: "student" });
                    alert("Demoted to student");
                  }}
                >
                  Demote to Student
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
