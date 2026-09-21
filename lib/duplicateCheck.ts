import { getCollectionDocs, where } from "./db";
import type { QueryConstraint } from "firebase/firestore";

/**
 * Queries a collection for an existing document matching `field == value`.
 * Returns the first match (excluding `excludeId`) or null if none found.
 * Use to detect duplicates before creating new records.
 */
export async function findDuplicate<T extends { id?: string }>(
  collectionName: string,
  field: string,
  value: string,
  excludeId?: string,
  extraConstraints: QueryConstraint[] = [],
): Promise<T | null> {
  if (!value?.trim()) return null;
  const constraints: QueryConstraint[] = [
    where(field, "==", value.trim()),
    ...extraConstraints,
  ];
  const docs = await getCollectionDocs<T>(collectionName, constraints);
  const match = docs.find((d) => d.id !== excludeId);
  return match ?? null;
}

/**
 * Variant for composite key checks (AND condition across multiple field=value pairs).
 * e.g. findDuplicateComposite("diesel", { unidad: "E-01", fecha: "12/09/2026" })
 */
export async function findDuplicateComposite<T extends { id?: string }>(
  collectionName: string,
  fields: Record<string, string>,
  excludeId?: string,
): Promise<T | null> {
  const constraints = Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => where(k, "==", v.trim()));
  if (!constraints.length) return null;
  const docs = await getCollectionDocs<T>(collectionName, constraints);
  const match = docs.find((d) => d.id !== excludeId);
  return match ?? null;
}

/** Normalize a string for loose comparison (uppercase, collapse spaces) */
export function normalizeKey(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}
