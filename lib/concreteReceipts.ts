import { crmOpportunities } from "@/lib/crmPipeline";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import type { Viaje } from "@/lib/viajes";

export type ConcreteSupplyType = "Tiro directo" | "Bombeado";

export interface ConcreteExtra {
  name: string;
  checked: boolean;
  price: number;
  quantity: string;
  unit: string;
}

export interface ConcreteReceipt {
  id: string;
  receiptNumber: number;
  cliente: string;
  direccionObra: string;
  m3: number;
  resistencia: string;
  supplyType: ConcreteSupplyType;
  servicioBomba: string;
  metrosVaciosCantidad: number;
  metrosVaciosPrecio: number;
  precioPorM3: number;
  anticipo: number;
  nota: string;
  firmaCliente: string;
  recibidoPor: string;
  fecha: string;
  extras: ConcreteExtra[];
  total: number;
  resta: number;
  viajeFolio?: string;
}

export const concreteReceiptStorageKey = "duro_concretos_concrete_receipts";

export const concreteReceiptClientes = Array.from(new Set([
  ...crmOpportunities.map((item) => item.cliente),
  "Roberto Peña",
  "María Santos Cantu",
  "Cristo Vive",
]));

export const concreteReceiptObras = Array.from(new Set([
  ...crmOpportunities.map((item) => item.obra),
  "Vista Encinos",
  "Colinas del Aeropuerto",
  "Residencial El Barrito",
  "Camino Agua Fría Apodaca",
]));

export const concreteReceiptResistencias = [
  "F'C 150-20-14 KG/CM²",
  "F'C 200-20-14 KG/CM²",
  "F'C 250-20-14 KG/CM²",
  "F'C 300-20-14 KG/CM²",
];

export const defaultConcreteExtras: ConcreteExtra[] = [
  { name: "Impermeabilizante", checked: false, price: 0, quantity: "", unit: "LT." },
  { name: "Acelerante", checked: false, price: 0, quantity: "", unit: "LT." },
  { name: "Fibra", checked: false, price: 0, quantity: "", unit: "KG." },
  { name: "Color", checked: false, price: 0, quantity: "", unit: "KG." },
  { name: "Tubería extra", checked: false, price: 0, quantity: "", unit: "PZ." },
  { name: "Maniobra", checked: false, price: 0, quantity: "", unit: "" },
  { name: "Tiempo extra", checked: false, price: 0, quantity: "", unit: "HR." },
];

export const concreteReceiptsBase: ConcreteReceipt[] = [
  {
    id: "REC-157",
    receiptNumber: 157,
    cliente: "Roberto Peña",
    direccionObra: "Vista Encinos",
    m3: 5,
    resistencia: "F'C 150-20-14 KG/CM²",
    supplyType: "Tiro directo",
    servicioBomba: "",
    metrosVaciosCantidad: 1,
    metrosVaciosPrecio: 800,
    precioPorM3: 245,
    anticipo: 0,
    nota: "2 / 06 / 26",
    firmaCliente: "Roberto Peña",
    recibidoPor: "Jere",
    fecha: "2026-06-02",
    extras: defaultConcreteExtras,
    total: 13050,
    resta: 13050,
    viajeFolio: "VJ-2026-157",
  },
];

export function calculateConcreteReceiptTotal({
  m3,
  precioPorM3,
  metrosVaciosCantidad,
  metrosVaciosPrecio,
  extras,
  anticipo,
}: Pick<ConcreteReceipt, "m3" | "precioPorM3" | "metrosVaciosCantidad" | "metrosVaciosPrecio" | "extras" | "anticipo">) {
  const concreteTotal = m3 * precioPorM3;
  const emptyMetersTotal = metrosVaciosCantidad * metrosVaciosPrecio;
  const extrasTotal = extras.reduce((sum, extra) => sum + (extra.checked ? extra.price : 0), 0);
  const total = concreteTotal + emptyMetersTotal + extrasTotal;

  return {
    total,
    resta: Math.max(total - anticipo, 0),
  };
}

export function formatReceiptDate(date: string) {
  if (!date) return { day: "02", month: "Junio", year: "2026" };

  const [year, month, day] = date.split("-");
  const monthNames: Record<string, string> = {
    "01": "Enero",
    "02": "Febrero",
    "03": "Marzo",
    "04": "Abril",
    "05": "Mayo",
    "06": "Junio",
    "07": "Julio",
    "08": "Agosto",
    "09": "Septiembre",
    "10": "Octubre",
    "11": "Noviembre",
    "12": "Diciembre",
  };

  return {
    day,
    month: monthNames[month] ?? month,
    year,
  };
}

export function loadConcreteReceipts() {
  if (typeof window === "undefined") return concreteReceiptsBase;

  const raw = localStorage.getItem(concreteReceiptStorageKey);
  if (!raw) {
    saveConcreteReceipts(concreteReceiptsBase);
    return concreteReceiptsBase;
  }

  try {
    const receipts = JSON.parse(raw) as ConcreteReceipt[];
    return receipts.length > 0 ? receipts : concreteReceiptsBase;
  } catch {
    localStorage.removeItem(concreteReceiptStorageKey);
    saveConcreteReceipts(concreteReceiptsBase);
    return concreteReceiptsBase;
  }
}

export function saveConcreteReceipts(receipts: ConcreteReceipt[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(concreteReceiptStorageKey, JSON.stringify(receipts));
  window.dispatchEvent(new CustomEvent("duro:concrete-receipts-updated"));
}

export async function syncReceiptWithTrip(receipt: ConcreteReceipt) {
  const folio = receipt.viajeFolio ?? `VJ-2026-${receipt.receiptNumber}`;
  const [year, month, day] = receipt.fecha.split("-");
  const fecha = `${day}/${month}/${year}`;
  const trip: Viaje = {
    folio,
    fecha,
    unidad: "Por asignar",
    operador: "Por asignar",
    destino: receipt.direccionObra,
    m3: receipt.m3,
    precioPorM3: receipt.precioPorM3,
    total: receipt.total,
    estado: "Pendiente",
  };

  await upsertDocument<Viaje>(COLLECTIONS.viajes, folio, trip);
}

