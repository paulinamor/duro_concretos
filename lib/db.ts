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
  limit,
  startAfter,
  getCountFromServer,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  WithFieldValue,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Planta } from "./auth";

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
  planta?: "Pesquería" | "Allende" | "Todas";
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
  reparaciones: "reparaciones",
  fallas: "fallas",
  cajaChica: "cajaChica",
  efectivo: "efectivo",
  inventarioMovimientos: "inventarioMovimientos",
  inventarioStock: "inventarioStock",
  remisiones: "remisiones",
  entradasMaterial: "entradasMaterial",
  existenciasIniciales: "existenciasIniciales",
  nomina: "nomina",
  programaciones: "programaciones",
  cuentasPorCobrar: "cuentasPorCobrar",
  cuentasPorPagar: "cuentasPorPagar",
  configuracion: "configuracion",
  cfdiEmitidos: "cfdiEmitidos",
  descargasSAT: "descargasSAT",
  obras: "obras",
  salidasEfectivo: "salidasEfectivo",
} as const;

export { where, orderBy, limit, startAfter, type QueryConstraint };

export async function countCollectionDocs(
  collectionName: string,
  constraints: QueryConstraint[] = [],
): Promise<number> {
  const dbInstance = getDb();
  const ref = collection(dbInstance, collectionName);
  const q = constraints.length ? query(ref, ...constraints) : ref;
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export function subscribeToCollection<T>(
  collectionName: string,
  onData: (docs: T[]) => void,
  constraints: QueryConstraint[] = [],
): () => void {
  const ref = collection(getDb(), collectionName);
  const q = constraints.length ? query(ref, ...constraints) : ref;
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
  });
}

// ---------- multi-tenant server-side helpers ----------

/**
 * Fetches docs for a specific plant using Firestore server-side filtering.
 * Pesquería: exact `where("planta", "==", "Pesquería")` — never sees Allende data.
 * Allende / Todas: full fetch (legacy docs have no planta field, so we can't
 *   filter server-side until migrateLegacyPlanta() has been run).
 *
 * After running migrateLegacyPlanta() on every collection, Allende can also
 * use `where("planta", "in", ["Allende", "Todas"])` for true server-side filtering.
 */
export async function getCollectionDocsByPlanta<T extends { planta?: string }>(
  collectionName: string,
  planta: Planta,
  extraConstraints: QueryConstraint[] = [],
): Promise<T[]> {
  if (planta === "Pesquería") {
    return getCollectionDocs<T>(collectionName, [
      where("planta", "==", "Pesquería"),
      ...extraConstraints,
    ]);
  }
  // Allende / Todas: still needs full fetch due to legacy docs without planta field.
  // Run migrateLegacyPlanta() first to enable server-side filtering here too.
  const all = await getCollectionDocs<T>(collectionName, extraConstraints);
  if (planta === "Todas") return all;
  // Allende: include docs with no planta (legacy) or planta === "Allende"
  return all.filter((d) => !d.planta || d.planta === "Todas" || d.planta === "Allende");
}

/**
 * One-time migration: sets planta: "Allende" on every document in the collection
 * that is missing the planta field (or has planta: "Todas").
 * Safe to run multiple times — skips docs that already have a concrete planta.
 * After running this on all collections, Allende queries can use server-side
 * where("planta", "in", ["Allende"]) instead of full-fetch + client filter.
 *
 * Usage (run once from the browser console or a one-off admin page):
 *   import { migrateLegacyPlanta, COLLECTIONS } from "@/lib/db";
 *   await migrateLegacyPlanta(COLLECTIONS.programaciones);
 */
export async function migrateLegacyPlanta(collectionName: string): Promise<{ migrated: number; skipped: number }> {
  const database = getDb();
  const snap = await getDocs(collection(database, collectionName));
  let migrated = 0;
  let skipped = 0;
  let batch = writeBatch(database);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.planta || data.planta === "Todas") {
      batch.update(docSnap.ref, { planta: "Allende" });
      migrated++;
      batchCount++;
      if (batchCount === 499) {
        await batch.commit();
        batch = writeBatch(database);
        batchCount = 0;
      }
    } else {
      skipped++;
    }
  }

  if (batchCount > 0) await batch.commit();
  return { migrated, skipped };
}
