// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// IMPORTANT: For client-side envs in Next.js, you MUST reference them directly,
// e.g. process.env.NEXT_PUBLIC_FIREBASE_API_KEY (not bracket lookup).
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Light guard so it's obvious if any are missing.
if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
  throw new Error(
    "[FIREBASE] Missing one or more NEXT_PUBLIC_FIREBASE_* envs. " +
      "Check .env.local (client vars must start with NEXT_PUBLIC_) and restart dev."
  );
}

const firebaseConfig = {
  apiKey: "AIzaSyCCR4kilTJaRAtV3Fgt4uvhNOzrJmte0v0",
  authDomain: "studyroom-6ba75.firebaseapp.com",
  projectId: "studyroom-6ba75",
  storageBucket: "studyroom-6ba75.firebasestorage.app",
  messagingSenderId: "454982880450",
  appId: "1:454982880450:web:2ccf2da34b9ee941707f5b",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const db = getFirestore(app);
export const storage = getStorage(app);

// sanity log in browser console
console.log("[FIREBASE] projectId =", app.options.projectId);
