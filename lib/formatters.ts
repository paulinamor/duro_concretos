/**
 * Centralized formatters for the ERP.
 * All monetary, numeric, and unit display should go through here.
 * Locale: es-MX (Mexican Spanish).
 */

const LOCALE = "es-MX";

/** $1,234.56 — 2 decimals always. Null/undefined → "—" */
export function currency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString(LOCALE, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** $1,234 — 0 decimals, for large rounded amounts */
export function currencyRounded(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `$${Math.round(n).toLocaleString(LOCALE)}`;
}

/** 1,234.56 — number without currency symbol. Null → "—" */
export function num(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 1,234 km */
export function km(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString(LOCALE)} km`;
}

/** 1,234.56 L */
export function litros(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
}

/** 1,234.5 m³ */
export function m3(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;
}

/** 42.5% */
export function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** km/L with 2 decimals */
export function rendimiento(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`;
}
