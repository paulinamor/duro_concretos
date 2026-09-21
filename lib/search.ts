/**
 * Search normalization utilities.
 * Use `matchesQuery` in every filter useMemo to get consistent,
 * accent-insensitive, case-insensitive search across all modules.
 */

// Unicode combining diacritical marks block U+0300–U+036F
// eslint-disable-next-line no-control-regex
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normalize a string for fuzzy search:
 * - Strips diacritics/accents (á→a, é→e, ñ→n, ü→u …)
 * - Lowercases
 * - Collapses whitespace
 * Safe to call on null/undefined — returns "".
 */
export function normalizeSearch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")           // decompose accented chars into base + combining mark
    .replace(COMBINING_MARKS, "") // strip combining diacritics
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if any of the given field values contain the query term.
 * Accent-insensitive and case-insensitive.
 *
 * @example
 * matchesQuery(query, [cliente, obra, operador])
 */
export function matchesQuery(
  query: string,
  fields: (string | number | null | undefined)[],
): boolean {
  const term = normalizeSearch(query);
  if (!term) return true;
  return fields.some((f) => normalizeSearch(String(f ?? "")).includes(term));
}

/**
 * Sort comparator that ignores accents/case.
 *
 * @example
 * [...lista].sort((a, b) => compareStrings(a.nombre, b.nombre))
 */
export function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, "es-MX", { sensitivity: "base" });
}
