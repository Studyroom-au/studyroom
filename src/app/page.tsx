"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import SignInForm from "@/components/SignInForm";

export default function SignInPage() {
  const router = useRouter();

  useEffect(() => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/hub");
    });
    return () => off();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <main className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">
            Welcome to Studyroom
          </h1>
          <p className="text-sm text-slate-600">
            Sign in to start your quiet study session.
          </p>
        </div>
        <SignInForm />
      </main>
    </div>
  );
}
