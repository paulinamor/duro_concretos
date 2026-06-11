import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// NEXT_PUBLIC_ vars are embedded at build time. If missing (e.g. Vercel env not set),
// fall back to hardcoded values — these are client-side keys, not secrets.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyDrNUi8HNqxy1hHft3RNzLQx_mBoydP0yo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "dc-erp-99aea.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "dc-erp-99aea",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "dc-erp-99aea.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "536573008419",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:536573008419:web:60792c8c93fbdebf97af96",
};

export const missingFirebaseEnv = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
  ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.messagingSenderId],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app: FirebaseApp | null = null;
let secondaryApp: FirebaseApp | null = null;

if (isFirebaseConfigured) {
  app = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);
  secondaryApp =
    getApps().find((a) => a.name === "secondary") ??
    initializeApp(firebaseConfig, "secondary");
}

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

// Secondary app instance — used to create users without signing out the current admin
export const authSecondary: Auth | null = secondaryApp ? getAuth(secondaryApp) : null;
