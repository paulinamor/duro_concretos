import { upsertDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";
import type { Viaje } from "@/lib/viajes";

export type ConcreteSupplyType = "Tiro directo" | "Bombeado";

// ── Legacy type (kept for backward compat when loading old records) ───────────
export interface ConcreteExtra {
  name: string;
  checked: boolean;
  price: number;
  quantity: string;
  unit: string;
}

// ── New types ─────────────────────────────────────────────────────────────────

export interface ConcreteProducto {
  id: string;
  resistencia: string;
  m3: number;
  supplyType: ConcreteSupplyType;
  precioPorM3: number;
}

/** Dosificación-based additive (impermeabilizante, acelerante, fibra, color) */
export interface ConcreteAditivo {
  name: string;
  checked: boolean;
  showUnit: boolean;  // whether to show unit label in receipt
  unit: string;       // e.g. "LT", "KG", ""
  dosis: number;      // qty per m³ (user enters this)
  precio: number;     // price per unit
}

/** Free-form extra row (user fills in anything) */
export interface ConcreteExtraRow {
  id: string;
  concepto: string;
  cantidad: string;   // string so it can be blank
  precio: string;     // string so it can be blank
}

export interface ConcreteReceipt {
  id: string;
  receiptNumber: number;
  cliente: string;
  direccionObra: string;

  // ── New multi-product model ──────────────────────────────────────────────
  productos: ConcreteProducto[];

  // Bomba
  bombaAplicarMinimo: boolean;
  bombaMinimoM3: number;
  bombaPrecioM3: number;

  // Metros vacíos
  metrosVaciosCantidad: number;
  metrosVaciosPrecio: number;

  // Aditivos (dosificación-based)
  aditivos: ConcreteAditivo[];

  // Extras libres (free-form)
  extrasLibres: ConcreteExtraRow[];

  // Financial / metadata
  anticipo: number;
  nota: string;
  firmaCliente: string;
  recibidoPor: string;
  fecha: string;
  total: number;
  resta: number;
  abonos?: Array<{ fecha: string; monto: number; reciboOrigenId?: string }>;
  viajeFolio?: string;
  planta?: string;
  enviarACobros?: boolean;

  // ── Legacy fields (optional, kept for backward compat) ──────────────────
  m3?: number;
  resistencia?: string;
  supplyType?: ConcreteSupplyType;
  precioPorM3?: number;
  servicioBomba?: string;
  servicioBombaImporte?: number;
  extras?: ConcreteExtra[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const concreteReceiptResistencias = [
  "F'C 100-20-14 KG/CM²",
  "F'C 150-20-14 KG/CM²",
  "F'C 200-20-14 KG/CM²",
  "F'C 250-20-14 KG/CM²",
  "F'C 300-20-14 KG/CM²",
  "F'C 350-20-14 KG/CM²",
  "F'C 400-20-14 KG/CM²",
];

export const defaultAditivos: ConcreteAditivo[] = [
  { name: "Impermeabilizante", checked: false, showUnit: true,  unit: "LT", dosis: 0, precio: 0 },
  { name: "Acelerante",        checked: false, showUnit: false, unit: "",   dosis: 0, precio: 0 },
  { name: "Fibra",             checked: false, showUnit: false, unit: "",   dosis: 0, precio: 0 },
  { name: "Color",             checked: false, showUnit: false, unit: "",   dosis: 0, precio: 0 },
];

export function makeProducto(): ConcreteProducto {
  return { id: `p${Date.now()}`, resistencia: "", m3: 0, supplyType: "Tiro directo", precioPorM3: 0 };
}

export function makeExtraLibre(): ConcreteExtraRow {
  return { id: `e${Date.now()}`, concepto: "", cantidad: "", precio: "" };
}

// ── Migration: convert old-format receipt to new format on load ───────────────

export function migrateReceipt(r: ConcreteReceipt): ConcreteReceipt {
  const hasNewFormat = r.productos && r.productos.length > 0;
  const productos: ConcreteProducto[] = hasNewFormat
    ? r.productos
    : [{ id: "p0", resistencia: r.resistencia ?? "", m3: r.m3 ?? 0, supplyType: r.supplyType ?? "Tiro directo", precioPorM3: r.precioPorM3 ?? 0 }];

  // Migrate legacy extras → extrasLibres
  let extrasLibres: ConcreteExtraRow[] = r.extrasLibres ?? [];
  if (!r.extrasLibres && r.extras) {
    extrasLibres = r.extras
      .filter((e) => e.checked && e.price > 0)
      .map((e, i) => ({
        id: `el${i}`,
        concepto: e.name,
        cantidad: e.unit ? e.quantity : "1",
        precio: String(e.price),
      }));
  }

  // Legacy bomba
  let bombaPrecioM3 = r.bombaPrecioM3 ?? 0;
  let bombaAplicarMinimo = r.bombaAplicarMinimo ?? false;
  let bombaMinimoM3 = r.bombaMinimoM3 ?? 15;
  if (!hasNewFormat && (r.servicioBombaImporte ?? 0) > 0 && bombaPrecioM3 === 0) {
    bombaPrecioM3 = r.servicioBombaImporte ?? 0;
  }

  return {
    ...r,
    productos,
    aditivos: r.aditivos ?? defaultAditivos.map((a) => ({ ...a })),
    extrasLibres,
    bombaAplicarMinimo,
    bombaMinimoM3,
    bombaPrecioM3,
  };
}

// ── Calculation ───────────────────────────────────────────────────────────────

export function getTotalM3(r: ConcreteReceipt): number {
  if (r.productos && r.productos.length > 0)
    return r.productos.reduce((s, p) => s + (p.m3 ?? 0), 0);
  return r.m3 ?? 0;
}

export function getTotalM3Bombeado(r: ConcreteReceipt): number {
  if (r.productos && r.productos.length > 0)
    return r.productos.filter((p) => p.supplyType === "Bombeado").reduce((s, p) => s + (p.m3 ?? 0), 0);
  if (r.supplyType === "Bombeado") return r.m3 ?? 0;
  return 0;
}

export function calculateConcreteReceiptTotal(r: ConcreteReceipt): { total: number; resta: number } {
  // Concreto
  let concreteTotal = 0;
  if (r.productos && r.productos.length > 0) {
    concreteTotal = r.productos.reduce((s, p) => s + (p.m3 ?? 0) * (p.precioPorM3 ?? 0), 0);
  } else {
    concreteTotal = (r.m3 ?? 0) * (r.precioPorM3 ?? 0);
  }

  // Metros vacíos
  const metrosVaciosTotal = (r.metrosVaciosCantidad ?? 0) * (r.metrosVaciosPrecio ?? 0);

  // Bomba
  let bombaTotal = 0;
  const m3Bombeado = getTotalM3Bombeado(r);
  if (r.productos && r.productos.length > 0) {
    if (m3Bombeado > 0 && (r.bombaPrecioM3 ?? 0) > 0) {
      const base = r.bombaAplicarMinimo ? Math.max(m3Bombeado, r.bombaMinimoM3 ?? 0) : m3Bombeado;
      bombaTotal = base * (r.bombaPrecioM3 ?? 0);
    }
  } else {
    bombaTotal = r.servicioBombaImporte ?? 0;
  }

  // Aditivos (new format)
  let aditivosTotal = 0;
  const totalM3 = getTotalM3(r);
  if (r.aditivos && r.aditivos.length > 0) {
    for (const a of r.aditivos) {
      if (!a.checked) continue;
      const qty = totalM3 * (a.dosis ?? 0);
      aditivosTotal += qty * (a.precio ?? 0);
    }
  } else if (r.extras) {
    // Legacy
    for (const e of r.extras) {
      if (!e.checked) continue;
      const qty = e.unit ? (parseFloat(e.quantity) || 0) : 1;
      aditivosTotal += qty * (e.price ?? 0);
    }
  }

  // Extras libres
  let extrasTotal = 0;
  for (const ex of r.extrasLibres ?? []) {
    const qty = parseFloat(ex.cantidad) || 0;
    const precio = parseFloat(ex.precio) || 0;
    if (qty > 0 && precio > 0) extrasTotal += qty * precio;
  }

  const total = concreteTotal + metrosVaciosTotal + bombaTotal + aditivosTotal + extrasTotal;
  const totalAbonos = (r.abonos ?? []).reduce((s, a) => s + a.monto, 0);
  const resta = Math.max(total - (r.anticipo ?? 0) - totalAbonos, 0);
  return { total, resta };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const concreteReceiptObras = [
  "Vista Encinos",
  "Colinas del Aeropuerto",
  "Residencial El Barrito",
  "Camino Agua Fría Apodaca",
];

/** @deprecated kept only for backward compat in old records */
export const defaultConcreteExtras: ConcreteExtra[] = [
  { name: "Impermeabilizante", checked: false, price: 0, quantity: "", unit: "LT." },
  { name: "Acelerante", checked: false, price: 0, quantity: "", unit: "LT." },
  { name: "Fibra", checked: false, price: 0, quantity: "", unit: "KG." },
  { name: "Color", checked: false, price: 0, quantity: "", unit: "KG." },
  { name: "Tubería extra", checked: false, price: 0, quantity: "", unit: "PZ." },
  { name: "Maniobra", checked: false, price: 0, quantity: "", unit: "" },
  { name: "Tiempo extra", checked: false, price: 0, quantity: "", unit: "HR." },
];

export function formatReceiptDate(date: string) {
  if (!date) return { day: "02", month: "Junio", year: "2026" };
  const [year, month, day] = date.split("-");
  const monthNames: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
  };
  return { day, month: monthNames[month] ?? month, year };
}

export async function syncReceiptWithTrip(receipt: ConcreteReceipt) {
  const folio = receipt.viajeFolio ?? `VJ-2026-${receipt.receiptNumber}`;
  const [year, month, day] = receipt.fecha.split("-");
  const fecha = `${day}/${month}/${year}`;
  const m3 = getTotalM3(receipt);
  const firstProd = receipt.productos?.[0];
  const trip: Viaje = {
    folio,
    fecha,
    unidad: "Por asignar",
    operador: "Por asignar",
    destino: receipt.direccionObra,
    m3,
    precioPorM3: firstProd?.precioPorM3 ?? receipt.precioPorM3 ?? 0,
    total: receipt.total,
    estado: "Pendiente",
  };
  await upsertDocument<Viaje>(COLLECTIONS.viajes, folio, withPlantaTag(trip));
}
