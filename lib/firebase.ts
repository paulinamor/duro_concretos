import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { connectAuthEmulator } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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
const useEmulator = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_EMULATOR === "true";
function buildDb(a: FirebaseApp): Firestore {
  if (useEmulator) {
    // Emulator: sin caché persistente para evitar conflictos
    try { return initializeFirestore(a, {}); } catch { return getFirestore(a); }
  }
  try {
    return initializeFirestore(a, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(a);
  }
}
export const db: Firestore | null = app ? buildDb(app) : null;
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;

// Conectar al emulador local solo cuando NEXT_PUBLIC_USE_EMULATOR=true
if (useEmulator && db) { try { connectFirestoreEmulator(db, "127.0.0.1", 8080); } catch { /* ya conectado */ } }
if (useEmulator && auth) { try { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch { /* ya conectado */ } }

// Secondary app instance — used to create users without signing out the current admin
export const authSecondary: Auth | null = secondaryApp ? getAuth(secondaryApp) : null;
