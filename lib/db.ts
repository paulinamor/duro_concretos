import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
  DocumentData,
  WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";

// ---------- generic helpers ----------

function getDb() {
  if (!db) {
    throw new Error("missing-firebase-config");
  }
  return db;
}

export async function getCollectionDocs<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const ref = collection(getDb(), collectionName);
  const q = constraints.length ? query(ref, ...constraints) : ref;
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function getDocument<T>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export async function upsertDocument<T extends WithFieldValue<DocumentData>>(
  collectionName: string,
  id: string,
  data: Omit<T, "id">,
): Promise<void> {
  await setDoc(doc(getDb(), collectionName, id), data, { merge: true });
}

export async function deleteDocument(
  collectionName: string,
  id: string,
): Promise<void> {
  await deleteDoc(doc(getDb(), collectionName, id));
}

// ---------- user profiles ----------

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  role: "admin" | "operador";
  modules: "all" | string[];
  status: "Activo" | "Inactivo";
  createdAt: string;
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  return getCollectionDocs<UserProfile>("users");
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return getDocument<UserProfile>("users", uid);
}

export async function getUserProfileByEmail(
  email: string,
): Promise<UserProfile | null> {
  const results = await getCollectionDocs<UserProfile>("users", [
    where("email", "==", email),
  ]);
  return results[0] ?? null;
}

export async function upsertUserProfile(
  uid: string,
  data: Omit<UserProfile, "id">,
): Promise<void> {
  return upsertDocument<UserProfile>("users", uid, data);
}

export function withoutUserProfileId(profile: UserProfile): Omit<UserProfile, "id"> {
  const { id, ...data } = profile;
  void id;
  return data;
}

export async function deleteUserProfile(uid: string): Promise<void> {
  return deleteDocument("users", uid);
}

// ---------- collection names ----------

export const COLLECTIONS = {
  users: "users",
  operadores: "operadores",
  unidades: "unidades",
  clientes: "clientes",
  viajes: "viajes",
  pipeline: "pipeline",
  mantenimientos: "mantenimientos",
  refacciones: "refacciones",
  seguros: "seguros",
  diesel: "diesel",
  cajaChica: "cajaChica",
  efectivo: "efectivo",
  inventarioMovimientos: "inventarioMovimientos",
  inventarioStock: "inventarioStock",
  nomina: "nomina",
} as const;

export { where, orderBy };
