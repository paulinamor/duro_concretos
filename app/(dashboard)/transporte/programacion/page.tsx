"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Download, Expand, ExternalLink, History, MapPin, MessageSquare, Navigation, Palette, Plus, Search, Shrink, UserRound, X,
} from "lucide-react";
import ExcelView from "./ExcelView";
import type { ExcelProg } from "./ExcelView";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import ClienteCombobox from "@/components/ClienteCombobox";
import { getCollectionDocs, subscribeToCollection, upsertDocument, deleteDocument, COLLECTIONS, type SolicitudAutorizacion, type Notificacion, getAllUserProfiles } from "@/lib/db";
import { filterByPlanta, getStoredSession, withPlantaTag } from "@/lib/auth";
import { todayCST, localISODate } from "@/lib/dateUtils";
import type { Operador } from "@/lib/operadores";
import type { Cliente } from "@/lib/crmClientes";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChoferEntry {
  id: string;
  chofer: string;
  cr: string;
  horaSalida: string;
  remision: string;
  numSello: string;
  horaLlegadaObra: string;
  horaInicioDescarga: string;
  horaFinalDescarga: string;
  horaSalidaObra: string;
  tiempoDescarga: string;
  m3: number | null;
}

interface FaseEntry {
  fase: string;
  fecha: string;
  nota?: string;
  usuario?: string;
  tipo?: "creacion" | "edicion" | "estado";
  cambios?: Array<{ campo: string; antes: string | number | null; despues: string | number | null }>;
}

interface Programacion {
  id?: string;
  dia: string;
  vendedor: string;
  diaHoraPedido: string;
  muestras: string;
  cliente: string;
  telefono: string;
  direccion: string;
  paraUso: string;
  hora: string;
  hsr: string;
  choferes: ChoferEntry[];
  tiempoExtraDescarga: string;
  m3Totales: number | null;
  extras: string;
  tdBom: string;
  resistencia: string;
  color: string;
  m3Vacios: number | null;
  precioM3Vacio: number | null;
  precioM3: number | null;
  precioM3Bomba: number | null;
  factorBomba: number | null;
  aplicarFactorBomba: boolean;
  ltoAcelr: number | null;
  kiloFibra: number | null;
  m3Imper: number | null;
  aditivo: string;
  tuberiaExtra: number | null;
  permisosOC: number | null;
  totalXM3: number | null;
  total: number | null;
  recibo: string;
  credito: string;
  fact: string;
  pagado: string;
  montoPagado: number | null;
  metodoPago: string;
  fechaPago: string;
  exhibiciones?: "1" | "2" | null;
  montoPago2?: number | null;
  fechaPago2?: string;
  metodoPago2?: string;
  notas?: string;
  notasVendedor?: string;
  cxcId?: string;
  planta?: string;
  folio?: string;
  fase?: string;
  historial?: FaseEntry[];
  notasAcceso?: string;
  vehiculoSamsaraId?: string;
  rowColor?: string;
  nombreObra?: string;
}

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

interface ChoferFormEntry {
  id: string;
  chofer: string;
  cr: string;
  horaSalida: string;
  remision: string;
  numSello: string;
  horaLlegadaObra: string;
  horaInicioDescarga: string;
  horaFinalDescarga: string;
  horaSalidaObra: string;
  m3: string;
}

interface FormState {
  dia: string; vendedor: string; diaHoraPedido: string; muestras: string;
  cliente: string; telefono: string; direccion: string; paraUso: string;
  hora: string; hsr: string; choferes: ChoferFormEntry[];
  tiempoExtraDescarga: string;
  extras: string; tdBom: string; resistencia: string; color: string;
  m3Vacios: string; precioM3Vacio: string; precioM3: string; precioM3Bomba: string;
  factorBomba: string; aplicarFactorBomba: boolean;
  ltoAcelr: string; kiloFibra: string; m3Imper: string;
  aditivo: string; tuberiaExtra: string; permisosOC: string;
  recibo: string; credito: string; fact: string; pagado: string;
  montoPagado: string;
  metodoPago: string; fechaPago: string;
  exhibiciones: "" | "1" | "2";
  montoPago2: string; fechaPago2: string; metodoPago2: string;
  notas: string;
  notasVendedor: string;
  rowColor: string;
  obraNombre: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ViewMode = "dia" | "semana" | "mes" | "rango" | "rastreo";

const todayISO = todayCST;

function addDays(iso: string, d: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + d);
  return localISODate(dt);
}

function addMonths(iso: string, m: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setMonth(dt.getMonth() + m);
  return localISODate(dt);
}

function weekRange(iso: string): [string, string] {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [localISODate(start), localISODate(end)];
}

function formatDateLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatShort(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function periodLabel(mode: ViewMode, anchor: string, ri: string, rf: string): string {
  if (mode === "dia") return formatDateLabel(anchor);
  if (mode === "semana") {
    const [s, e] = weekRange(anchor);
    return `${formatShort(s)} – ${formatShort(e)} ${new Date(e + "T12:00:00").getFullYear()}`;
  }
  if (mode === "mes") return new Date(anchor + "T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return `${formatShort(ri)} – ${formatShort(rf)}`;
}

function calcTiempoDescarga(inicio: string, fin: string): string {
  if (!inicio || !fin) return "";
  const [ih, im] = inicio.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);
  if (isNaN(ih) || isNaN(fh)) return "";
  const diff = (fh * 60 + fm) - (ih * 60 + im);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function n(v: string): number | null {
  const p = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(p) ? null : p;
}

function nv(v: number | null | undefined): number {
  return v ?? 0;
}

function calcTotalesProg(p: Programacion): { totalXM3: number | null; total: number | null } {
  const factorBomba = p.aplicarFactorBomba ? (p.factorBomba ?? 1) : 1;
  const txm3 =
    nv(p.precioM3) +
    nv(p.precioM3Bomba) * factorBomba +
    (n(String(p.color ?? "")) ?? 0) +
    nv(p.ltoAcelr) +
    nv(p.kiloFibra) +
    nv(p.m3Imper) +
    nv(p.permisosOC);
  const flatExtras =
    nv(p.precioM3Vacio) * nv(p.m3Vacios) +
    nv(p.tuberiaExtra) +
    (n(String(p.tiempoExtraDescarga ?? "")) ?? 0);
  const m3Base = txm3 * nv(p.m3Totales);
  const total = m3Base + flatExtras;
  return { totalXM3: txm3 > 0 ? txm3 : null, total: total > 0 ? total : null };
}

function currency(v: number | null) {
  if (v == null) return "—";
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyChofer(): ChoferFormEntry {
  return {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chofer: "", cr: "", horaSalida: "", remision: "", numSello: "",
    horaLlegadaObra: "", horaInicioDescarga: "", horaFinalDescarga: "",
    horaSalidaObra: "", m3: "",
  };
}

function nowLocalISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function emptyForm(dia: string): FormState {
  return {
    dia, vendedor: "", diaHoraPedido: nowLocalISO(), muestras: "",
    cliente: "", telefono: "", direccion: "", paraUso: "",
    hora: "", hsr: "", choferes: [emptyChofer()],
    tiempoExtraDescarga: "",
    extras: "", tdBom: "", resistencia: "", color: "", m3Vacios: "", precioM3Vacio: "",
    precioM3: "", precioM3Bomba: "", factorBomba: "1.16", aplicarFactorBomba: false,
    ltoAcelr: "", kiloFibra: "", m3Imper: "",
    aditivo: "", tuberiaExtra: "", permisosOC: "",
    recibo: "", credito: "", fact: "", pagado: "", montoPagado: "", metodoPago: "", fechaPago: "",
    exhibiciones: "", montoPago2: "", fechaPago2: "", metodoPago2: "",
    notas: "", notasVendedor: "", rowColor: "", obraNombre: "",
  };
}

function formFromProg(p: Programacion): FormState {
  // Backwards compat: old records may have flat single-chofer fields
  const legacy = p as unknown as Record<string, unknown>;
  const choferes: ChoferFormEntry[] = p.choferes?.length
    ? p.choferes.map((c) => ({
        id: c.id,
        chofer: c.chofer,
        cr: c.cr,
        horaSalida: c.horaSalida,
        remision: c.remision,
        numSello: c.numSello,
        horaLlegadaObra: c.horaLlegadaObra,
        horaInicioDescarga: c.horaInicioDescarga,
        horaFinalDescarga: c.horaFinalDescarga,
        horaSalidaObra: c.horaSalidaObra,
        m3: c.m3 != null ? String(c.m3) : "",
      }))
    : [{
        ...emptyChofer(),
        chofer: String(legacy.chofer ?? ""),
        cr: String(legacy.cr ?? ""),
        horaSalida: String(legacy.horaSalida ?? ""),
        remision: String(legacy.remision ?? ""),
        numSello: String(legacy.numSello ?? ""),
        horaLlegadaObra: String(legacy.horaLlegadaObra ?? ""),
        horaInicioDescarga: String(legacy.horaInicioDescarga ?? ""),
        horaFinalDescarga: String(legacy.horaFinalDescarga ?? ""),
        horaSalidaObra: String(legacy.horaSalidaObra ?? ""),
        m3: legacy.m3 != null ? String(legacy.m3) : "",
      }];

  return {
    dia: p.dia, vendedor: p.vendedor, diaHoraPedido: p.diaHoraPedido, muestras: p.muestras,
    cliente: p.cliente, telefono: p.telefono, direccion: p.direccion, paraUso: p.paraUso,
    obraNombre: p.nombreObra ?? "",
    hora: p.hora, hsr: p.hsr, choferes,
    tiempoExtraDescarga: p.tiempoExtraDescarga,
    extras: p.extras, tdBom: p.tdBom, resistencia: p.resistencia, color: p.color,
    m3Vacios: p.m3Vacios != null ? String(p.m3Vacios) : "",
    precioM3Vacio: p.precioM3Vacio != null ? String(p.precioM3Vacio) : "",
    precioM3: p.precioM3 != null ? String(p.precioM3) : "",
    precioM3Bomba: p.precioM3Bomba != null ? String(p.precioM3Bomba) : "",
    factorBomba: p.factorBomba != null ? String(p.factorBomba) : "1.16",
    aplicarFactorBomba: p.aplicarFactorBomba ?? false,
    ltoAcelr: p.ltoAcelr != null ? String(p.ltoAcelr) : "",
    kiloFibra: p.kiloFibra != null ? String(p.kiloFibra) : "",
    m3Imper: p.m3Imper != null ? String(p.m3Imper) : "",
    aditivo: p.aditivo,
    tuberiaExtra: p.tuberiaExtra != null ? String(p.tuberiaExtra) : "",
    permisosOC: p.permisosOC != null ? String(p.permisosOC) : "",
    recibo: p.recibo, credito: p.credito, fact: p.fact, pagado: p.pagado,
    montoPagado: p.montoPagado != null ? String(p.montoPagado) : "",
    metodoPago: p.metodoPago, fechaPago: p.fechaPago,
    exhibiciones: p.exhibiciones ?? "",
    montoPago2: p.montoPago2 != null ? String(p.montoPago2) : "",
    fechaPago2: p.fechaPago2 ?? "",
    metodoPago2: p.metodoPago2 ?? "",
    notas: p.notas ?? "",
    notasVendedor: p.notasVendedor ?? "",
    rowColor: p.rowColor ?? "",
  };
}

function exportXLSX(rows: Programacion[]) {
  const XLSX = require("xlsx");
  const data: Record<string, unknown>[] = [];
  for (const r of rows) {
    const choferes = r.choferes?.length ? r.choferes : [{ chofer: "", cr: "", horaSalida: "", remision: "", numSello: "", horaLlegadaObra: "", horaInicioDescarga: "", horaFinalDescarga: "", horaSalidaObra: "", tiempoDescarga: "", m3: null } as ChoferEntry];
    for (const c of choferes) {
      data.push({
        "DÍA": r.dia, "VENDEDOR": r.vendedor, "DÍA Y HORA PEDIDO": r.diaHoraPedido,
        "MUESTRAS": r.muestras, "HORA": r.hora, "HSR": r.hsr,
        "CHOFER": c.chofer, "CR": c.cr, "HORA SALIDA": c.horaSalida,
        "REMISIÓN": c.remision, "NUM SELLO": c.numSello,
        "HORA LLEGADA OBRA": c.horaLlegadaObra, "HORA INICIO DESC.": c.horaInicioDescarga,
        "HORA FINAL DESC.": c.horaFinalDescarga, "HORA SALIDA OBRA": c.horaSalidaObra,
        "TIEMPO DESC.": c.tiempoDescarga, "M3 CHOFER": c.m3 ?? "",
        "CLIENTE": r.cliente, "TELÉFONO": r.telefono, "PARA USO": r.paraUso, "DIRECCIÓN": r.direccion,
        "M3 TOTALES": r.m3Totales ?? "", "M3 VACÍOS": r.m3Vacios ?? "", "$ M3 VACÍO": r.precioM3Vacio ?? "",
        "T.EXTRA DESC.": r.tiempoExtraDescarga, "EXTRAS": r.extras, "T/D BOM": r.tdBom,
        "RESISTENCIA": r.resistencia, "COLOR": r.color,
        "PRECIO M3": r.precioM3 ?? "", "$ M3 BOMBA": r.precioM3Bomba ?? "", "TOTAL X M3": r.totalXM3 ?? "",
        "$ LTO ACELR": r.ltoAcelr ?? "", "$ KILO FIBRA": r.kiloFibra ?? "", "$ M3 IMPER": r.m3Imper ?? "",
        "ADITIVO": r.aditivo, "TUBERÍA EXTRA": r.tuberiaExtra ?? "", "PERMISOS O/C": r.permisosOC ?? "",
        "TOTAL": r.total ?? "", "RECIBO": r.recibo, "CRÉDITO": r.credito,
        "FACT": r.fact, "PAGADO": r.pagado, "MÉTODO PAGO": r.metodoPago, "FECHA PAGO": r.fechaPago,
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Programación");
  XLSX.writeFile(wb, `programacion-${rows[0]?.dia ?? "export"}.xlsx`);
}

function isUrl(v: string) { return v.startsWith("http://") || v.startsWith("https://"); }

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const searchMatch = url.match(/\/maps\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (searchMatch) return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };
  return null;
}

// Coordenadas de plantas — configurables en Configuración > Ubicaciones
const PLANT_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  Allende: { lat: 25.4437, lng: -100.0233, label: "Planta Allende" },
  Pesquería: { lat: 25.7544, lng: -99.9904, label: "Planta Pesquería" },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
const roInp = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-semibold cursor-default select-none";

function Sec({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">{title}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ─── ChoferCard ───────────────────────────────────────────────────────────────

function ChoferCard({
  entry, index, total,
  onChange, onRemove,
  operadoresList, revolveList,
}: {
  entry: ChoferFormEntry;
  index: number;
  total: number;
  onChange: (updated: ChoferFormEntry) => void;
  onRemove: () => void;
  operadoresList: Pick<Operador, "id" | "nombre">[];
  revolveList: string[];
}) {
  const set = (k: keyof ChoferFormEntry, v: string) => onChange({ ...entry, [k]: v });
  const tiempoAuto = calcTiempoDescarga(entry.horaInicioDescarga, entry.horaFinalDescarga);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#CC2229]/10 text-[#CC2229]">
            <UserRound size={12} />
          </div>
          <span className="text-xs font-semibold text-gray-700">Chofer {index + 1}</span>
        </div>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="Quitar chofer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={lbl}>Chofer</label>
          <AppSelect value={entry.chofer} onChange={(e) => set("chofer", e.target.value)}>
            <option value="">Sin asignar</option>
            {operadoresList.map((o) => (
              <option key={o.id} value={o.nombre}>{o.nombre}</option>
            ))}
          </AppSelect>
        </div>
        <div>
          <label className={lbl}>M3</label>
          <input type="number" step="0.5" min="0" value={entry.m3} onChange={(e) => set("m3", e.target.value)} placeholder="0.0" className={inp} onWheel={(e) => e.currentTarget.blur()} />
        </div>
        <div>
          <label className={lbl}>CR</label>
          <AppSelect value={entry.cr} onChange={(e) => set("cr", e.target.value)}>
            <option value="">— Sin asignar —</option>
            {revolveList.map((eco) => (
              <option key={eco} value={eco}>{eco}</option>
            ))}
            {entry.cr && !revolveList.includes(entry.cr) && (
              <option value={entry.cr}>{entry.cr}</option>
            )}
          </AppSelect>
        </div>
        <div>
          <label className={lbl}>Hora salida</label>
          <input type="time" value={entry.horaSalida} onChange={(e) => set("horaSalida", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Remisión</label>
          <input type="text" value={entry.remision} onChange={(e) => set("remision", e.target.value)} placeholder="18945" className={inp} />
        </div>
        <div>
          <label className={lbl}>Num. de sello</label>
          <input type="text" value={entry.numSello} onChange={(e) => set("numSello", e.target.value)} placeholder="—" className={inp} />
        </div>
        <div>
          <label className={lbl}>Hora llegada obra</label>
          <input type="time" value={entry.horaLlegadaObra} onChange={(e) => set("horaLlegadaObra", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Hora inicio descarga</label>
          <input type="time" value={entry.horaInicioDescarga} onChange={(e) => set("horaInicioDescarga", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Hora final descarga</label>
          <input type="time" value={entry.horaFinalDescarga} onChange={(e) => set("horaFinalDescarga", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Hora salida obra</label>
          <input type="time" value={entry.horaSalidaObra} onChange={(e) => set("horaSalidaObra", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Tiempo descarga <span className="text-emerald-600 normal-case font-normal">(auto)</span></label>
          <input type="text" value={tiempoAuto || "—"} readOnly className={`${roInp} text-emerald-700`} />
        </div>
      </div>
    </div>
  );
}

// ─── Row color palette ────────────────────────────────────────────────────────

const ROW_COLORS = [
  { label: "Sin color", value: "",        display: "#F9FAFB" },
  { label: "Verde",     value: "#166534", display: "#166534" },
  { label: "Ámbar",     value: "#92400e", display: "#92400e" },
  { label: "Rojo",      value: "#991b1b", display: "#991b1b" },
  { label: "Azul",      value: "#1e40af", display: "#1e40af" },
  { label: "Morado",    value: "#6b21a8", display: "#6b21a8" },
  { label: "Cian",      value: "#0e7490", display: "#0e7490" },
];

// ─── HistorialDrawer ──────────────────────────────────────────────────────────

function HistorialDrawer({
  open, onClose, historial, cliente,
}: {
  open: boolean;
  onClose: () => void;
  historial: FaseEntry[];
  cliente: string;
}) {
  if (!open) return null;

  const sorted = [...historial].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );

  function fmtFecha(iso: string) {
    try {
      return new Date(iso).toLocaleString("es-MX", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  }

  const typeMeta = {
    edicion:  { label: "Edición",   cls: "bg-blue-50 text-blue-600" },
    creacion: { label: "Creación",  cls: "bg-emerald-50 text-emerald-600" },
    estado:   { label: "Estado",    cls: "bg-gray-50 text-gray-500" },
  };

  return (
    <div className="fixed inset-0 z-[200] flex">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Cerrar historial" />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
            <History size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Historial de cambios</h2>
            <p className="text-xs text-gray-500 truncate max-w-[220px]">{cliente || "—"}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Sin historial registrado.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map((entry, i) => {
                const meta = typeMeta[entry.tipo ?? "estado"] ?? typeMeta.estado;
                return (
                  <div key={i} className="relative pl-7 pb-5">
                    {i < sorted.length - 1 && (
                      <div className="absolute left-[10px] top-5 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className={`absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                      entry.tipo === "edicion"  ? "bg-blue-50 border-blue-300" :
                      entry.tipo === "creacion" ? "bg-emerald-50 border-emerald-300" :
                      "bg-gray-50 border-gray-300"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        entry.tipo === "edicion"  ? "bg-blue-400" :
                        entry.tipo === "creacion" ? "bg-emerald-400" :
                        "bg-gray-400"
                      }`} />
                    </div>

                    <div className="ml-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${meta.cls}`}>
                          {meta.label}
                        </span>
                        {entry.fase && (
                          <span className="text-xs font-medium text-gray-600">→ {entry.fase}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{fmtFecha(entry.fecha)}</p>
                      {entry.usuario && (
                        <p className="text-xs font-medium text-gray-600">{entry.usuario}</p>
                      )}
                      {entry.nota && (
                        <p className="text-xs text-gray-500 italic mt-1">"{entry.nota}"</p>
                      )}
                      {entry.cambios && entry.cambios.length > 0 && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
                          {entry.cambios.map((c, j) => (
                            <div key={j} className="px-3 py-1.5 text-xs grid grid-cols-[auto_1fr_1fr] gap-2 items-baseline">
                              <span className="font-semibold text-gray-600 whitespace-nowrap">{c.campo}</span>
                              <span className="text-red-500 truncate line-through">{String(c.antes ?? "—")}</span>
                              <span className="text-emerald-600 truncate">{String(c.despues ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, onDelete, initial, dia, operadoresList, clientesList, revolveList, obrasData,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (p: Programacion) => Promise<void>;
  onDelete?: () => void;
  initial?: Programacion;
  dia: string;
  operadoresList: Pick<Operador, "id" | "nombre">[];
  clientesList: string[];
  revolveList: string[];
  obrasData: Obra[];
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(dia));
  const [saving, setSaving] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);

  // Obra selector state
  const [obraOpen, setObraOpen] = useState(false);
  const [obraQuery, setObraQuery] = useState("");
  const [obraNewOpen, setObraNewOpen] = useState(false);
  const [obraNewNombre, setObraNewNombre] = useState("");
  const [obraNewDireccion, setObraNewDireccion] = useState("");
  const obraContainerRef = useRef<HTMLDivElement>(null);

  const sessionInForm   = getStoredSession();
  const isAdminInForm   = sessionInForm?.role === "admin";
  const userNameInForm  = sessionInForm?.name ?? sessionInForm?.email ?? "Sistema";
  const vendedorDeRegistro = initial?.vendedor ?? "";
  const isVendorOfRecord   = vendedorDeRegistro !== "" && userNameInForm === vendedorDeRegistro;
  const canSeeProgNotas    = isAdminInForm || !isVendorOfRecord;
  const canEditVendorNotas = isAdminInForm || isVendorOfRecord || vendedorDeRegistro === "";

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (obraContainerRef.current && !obraContainerRef.current.contains(e.target as Node)) {
        setObraOpen(false); setObraNewOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? formFromProg(initial) : emptyForm(dia));
    setShowHistorial(false);
    setObraOpen(false); setObraQuery(""); setObraNewOpen(false);
    setObraNewNombre(""); setObraNewDireccion("");
  }, [open, initial, dia]);

  const obrasSugeridas = useMemo(() => {
    if (!form.cliente) return [];
    const cl = form.cliente.toLowerCase();
    return obrasData
      .filter((o) => o.cliente.toLowerCase() === cl)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [obrasData, form.cliente]);

  const obrasFiltradas = useMemo(() => {
    if (!obraQuery.trim()) return obrasSugeridas;
    const q = obraQuery.toLowerCase();
    return obrasSugeridas.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [obrasSugeridas, obraQuery]);

  const set = (k: keyof Omit<FormState, "choferes" | "aplicarFactorBomba">, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));
  const setBool = (k: keyof FormState, v: boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setChofer = (idx: number, updated: ChoferFormEntry) =>
    setForm((p) => ({ ...p, choferes: p.choferes.map((c, i) => i === idx ? updated : c) }));

  const addChofer = () =>
    setForm((p) => ({ ...p, choferes: [...p.choferes, emptyChofer()] }));

  const removeChofer = (idx: number) =>
    setForm((p) => ({ ...p, choferes: p.choferes.filter((_, i) => i !== idx) }));

  // ── Auto-calculated (read-only) ──────────────────────────────────────────
  const m3TotalesAuto = useMemo(() => {
    const sum = form.choferes.reduce((s, c) => s + (n(c.m3) ?? 0), 0);
    return sum > 0 ? sum : null;
  }, [form.choferes]);

  const totalXM3Auto = useMemo(() => {
    const factorBomba = form.aplicarFactorBomba ? (n(form.factorBomba) ?? 1) : 1;
    const sum =
      (n(form.precioM3) ?? 0) +
      (n(form.precioM3Bomba) ?? 0) * factorBomba +
      (n(form.color) ?? 0) +
      (n(form.ltoAcelr) ?? 0) +
      (n(form.kiloFibra) ?? 0) +
      (n(form.m3Imper) ?? 0) +
      (n(form.permisosOC) ?? 0);
    return sum > 0 ? sum : null;
  }, [form.precioM3, form.precioM3Bomba, form.aplicarFactorBomba, form.factorBomba, form.color, form.ltoAcelr, form.kiloFibra, form.m3Imper, form.permisosOC]);

  const totalAuto = useMemo(() => {
    const flatExtras =
      (n(form.precioM3Vacio) ?? 0) * (n(form.m3Vacios) ?? 0) +
      (n(form.tuberiaExtra) ?? 0) +
      (n(form.tiempoExtraDescarga) ?? 0);
    const m3Base = (totalXM3Auto ?? 0) * (m3TotalesAuto ?? 0);
    const result = m3Base + flatExtras;
    return result > 0 ? result : null;
  }, [totalXM3Auto, m3TotalesAuto, form.precioM3Vacio, form.m3Vacios, form.tuberiaExtra, form.tiempoExtraDescarga]);

  async function handleSave() {
    if (!form.cliente.trim()) {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "El campo Cliente es obligatorio." } }));
      return;
    }
    setSaving(true);
    try {
      const id = initial?.id ?? `prog-${Date.now()}`;
      const choferes: ChoferEntry[] = form.choferes.map((c) => ({
        id: c.id,
        chofer: c.chofer.trim(),
        cr: c.cr.trim(),
        horaSalida: c.horaSalida,
        remision: c.remision.trim(),
        numSello: c.numSello.trim(),
        horaLlegadaObra: c.horaLlegadaObra,
        horaInicioDescarga: c.horaInicioDescarga,
        horaFinalDescarga: c.horaFinalDescarga,
        horaSalidaObra: c.horaSalidaObra,
        tiempoDescarga: calcTiempoDescarga(c.horaInicioDescarga, c.horaFinalDescarga),
        m3: n(c.m3),
      }));

      const newProg: Programacion = {
        id,
        dia: form.dia,
        vendedor: form.vendedor.trim(),
        diaHoraPedido: form.diaHoraPedido,
        muestras: form.muestras.trim(),
        cliente: form.cliente.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        paraUso: form.paraUso.trim(),
        hora: form.hora,
        hsr: form.hsr,
        choferes,
        tiempoExtraDescarga: form.tiempoExtraDescarga.trim(),
        m3Totales: m3TotalesAuto,
        extras: form.extras.trim(),
        tdBom: form.tdBom.trim(),
        resistencia: form.resistencia.trim(),
        color: form.color.trim(),
        m3Vacios: n(form.m3Vacios),
        precioM3Vacio: n(form.precioM3Vacio),
        precioM3: n(form.precioM3),
        precioM3Bomba: n(form.precioM3Bomba),
        factorBomba: form.aplicarFactorBomba ? (n(form.factorBomba) ?? null) : null,
        aplicarFactorBomba: form.aplicarFactorBomba,
        ltoAcelr: n(form.ltoAcelr),
        kiloFibra: n(form.kiloFibra),
        m3Imper: n(form.m3Imper),
        aditivo: form.aditivo.trim(),
        tuberiaExtra: n(form.tuberiaExtra),
        permisosOC: n(form.permisosOC),
        totalXM3: totalXM3Auto,
        total: totalAuto,
        recibo: form.recibo.trim(),
        credito: form.credito.trim(),
        fact: form.fact.trim(),
        pagado: form.pagado.trim(),
        montoPagado: form.pagado === "Parcial" ? (n(form.montoPagado) ?? null) : null,
        metodoPago: form.metodoPago.trim(),
        fechaPago: form.fechaPago,
        exhibiciones: (form.exhibiciones || null) as "1" | "2" | null,
        montoPago2: form.exhibiciones === "2" ? (n(form.montoPago2) ?? null) : null,
        fechaPago2: form.exhibiciones === "2" ? form.fechaPago2 : "",
        metodoPago2: form.exhibiciones === "2" ? form.metodoPago2.trim() : "",
        notas: form.notas.trim(),
        notasVendedor: form.notasVendedor.trim(),
        rowColor: form.rowColor,
        nombreObra: form.obraNombre.trim() || undefined,
      };

      // ── Registro de historial ──────────────────────────────────────────────
      const hist: FaseEntry[] = [...(initial?.historial ?? [])];
      const nowISO = new Date().toISOString();

      if (!initial) {
        hist.push({ fase: "", fecha: nowISO, tipo: "creacion", usuario: userNameInForm });
      } else {
        const CAMPOS: Array<[keyof Programacion, string]> = [
          ["cliente",       "Cliente"],
          ["dia",           "Fecha"],
          ["hora",          "Hora"],
          ["resistencia",   "Resistencia"],
          ["tdBom",         "T/D BOM"],
          ["m3Totales",     "M³ totales"],
          ["extras",        "Extras"],
          ["precioM3",      "Precio M³"],
          ["precioM3Vacio", "Precio M³ Vacío"],
          ["precioM3Bomba", "Precio M³ Bomba"],
          ["total",         "Total"],
          ["pagado",        "Pagado"],
          ["recibo",        "Recibo"],
          ["fact",          "Fact."],
          ["vendedor",      "Vendedor"],
          ["direccion",     "Dirección"],
          ["telefono",      "Teléfono"],
          ["notas",         "Notas programación"],
          ["notasVendedor", "Notas vendedor"],
          ["rowColor",      "Color fila"],
        ];
        const cambios = CAMPOS.flatMap(([key, label]) => {
          const oldV = (initial as unknown as Record<string, unknown>)[key] ?? null;
          const newV = (newProg as unknown as Record<string, unknown>)[key] ?? null;
          return String(oldV ?? "") !== String(newV ?? "")
            ? [{ campo: label, antes: oldV as string | number | null, despues: newV as string | number | null }]
            : [];
        });
        if (cambios.length > 0) {
          hist.push({ fase: initial.fase ?? "", fecha: nowISO, tipo: "edicion", usuario: userNameInForm, cambios });
        }
      }
      newProg.historial = hist;

      await onSave(newProg);
      onClose();
    } catch (err) {
      console.error("Error al guardar programación:", err);
      const code = (err as { code?: string })?.code ?? "";
      const raw = err instanceof Error ? err.message : String(err);
      let msg: string;
      if (code === "permission-denied" || raw.includes("permission-denied")) {
        const sinPlanta = !getStoredSession()?.planta;
        msg = sinPlanta
          ? "Sin planta seleccionada. Ve al menú lateral y elige tu planta activa antes de guardar."
          : "Sin permisos para guardar este registro. Contacta a un administrador.";
      } else if (code === "unavailable" || raw.includes("unavailable") || raw.includes("network")) {
        msg = "Sin conexión a internet. Verifica tu red e intenta de nuevo.";
      } else if (code === "not-found" || raw.includes("not-found")) {
        msg = "El documento ya no existe. Recarga la página.";
      } else if (code === "unauthenticated" || raw.includes("unauthenticated")) {
        msg = "Sesión expirada. Recarga la página e inicia sesión de nuevo.";
      } else {
        msg = raw || "Error desconocido al guardar. Intenta de nuevo.";
      }
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: msg } }));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{initial ? "Completar programación" : "Programación"}</h2>
            <p className="text-xs text-gray-500">{formatDateLabel(form.dia)}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <Sec title="Identificación del pedido" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Día <span className="text-[#CC2229]">*</span></label>
              <input type="date" value={form.dia} onChange={(e) => set("dia", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Día y hora de pedido</label>
              <div className={`${inp} bg-gray-50 text-gray-500 cursor-default select-none`}>
                {form.diaHoraPedido
                  ? new Date(form.diaHoraPedido).toLocaleString("es-MX", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : <span className="text-gray-400">—</span>
                }
              </div>
            </div>
            <div>
              <label className={lbl}>Vendedor</label>
              <input type="text" value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} placeholder="Nombre del vendedor" className={inp} />
            </div>
            <div>
              <label className={lbl}>Muestras</label>
              <input type="text" value={form.muestras} onChange={(e) => set("muestras", e.target.value)} placeholder="—" className={inp} />
            </div>
          </div>

          <Sec title="Cliente" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ClienteCombobox
                label="Cliente"
                required
                value={form.cliente}
                onChange={(v) => set("cliente", v)}
                options={clientesList}
                placeholder="Buscar o escribir cliente…"
              />
            </div>
            <div>
              <label className={lbl}>Num. de teléfono</label>
              <input type="tel" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="81 0000 0000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Para uso</label>
              <input type="text" value={form.paraUso} onChange={(e) => set("paraUso", e.target.value)} placeholder="Losa, zapata, muro…" className={inp} />
            </div>
            {/* Nombre de la obra */}
            <div ref={obraContainerRef} className="col-span-2 relative">
              <label className={lbl}>
                Nombre de la obra
                {obrasSugeridas.length > 0 && (
                  <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-blue-400">
                    {obrasSugeridas.length} guardada{obrasSugeridas.length !== 1 ? "s" : ""}
                  </span>
                )}
              </label>
              <div
                role="button" tabIndex={form.cliente ? 0 : -1}
                onClick={() => { if (form.cliente) setObraOpen((v) => !v); }}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && form.cliente) { e.preventDefault(); setObraOpen((v) => !v); } }}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer select-none transition-colors ${
                  obraOpen ? "border-[#CC2229]/60 ring-1 ring-[#CC2229]/20" : "border-gray-200 hover:border-gray-300"
                } ${!form.cliente ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}`}
              >
                <span className={`flex-1 truncate ${form.obraNombre ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {form.obraNombre || (form.cliente ? "Seleccionar o agregar obra…" : "Selecciona un cliente primero")}
                </span>
                {form.obraNombre && (
                  <button type="button" onMouseDown={(e) => { e.stopPropagation(); set("obraNombre", ""); setObraQuery(""); }}
                    className="p-0.5 text-gray-300 hover:text-gray-500 cursor-pointer transition-colors">
                    <X size={11} />
                  </button>
                )}
                <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform duration-150 ${obraOpen ? "rotate-180" : ""}`} />
              </div>
              {obraOpen && (
                <div className="absolute z-[300] mt-1 w-full rounded-xl border border-gray-200 bg-white overflow-hidden"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)" }}>
                  {obrasSugeridas.length > 0 && (
                    <div className="p-2 border-b border-gray-100">
                      <input autoFocus value={obraQuery} onChange={(e) => setObraQuery(e.target.value)}
                        placeholder="Buscar obra…"
                        className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20" />
                    </div>
                  )}
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {obrasFiltradas.length === 0 && !obraNewOpen && (
                      <li className="px-4 py-3 text-sm text-gray-400 text-center">
                        {obrasSugeridas.length === 0 ? "Sin obras registradas para este cliente" : "Sin resultados"}
                      </li>
                    )}
                    {obrasFiltradas.map((o) => (
                      <li key={o.id}>
                        <button type="button"
                          onMouseDown={() => {
                            set("obraNombre", o.nombre);
                            if (o.direccion) set("direccion", o.direccion);
                            setObraOpen(false); setObraQuery("");
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="text-sm font-medium text-gray-800">{o.nombre}</div>
                          {o.direccion && (
                            <div className="text-xs text-gray-400 truncate mt-0.5">
                              {o.direccion.startsWith("http") ? "Ubicación en Maps guardada" : o.direccion}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!obraNewOpen && (
                    <div className="border-t border-gray-100 px-3 py-2">
                      <button type="button"
                        onMouseDown={() => { setObraNewOpen(true); setObraNewNombre(obraQuery); setObraNewDireccion(""); }}
                        className="text-xs font-semibold text-[#CC2229] hover:text-[#B01E24] py-1 cursor-pointer transition-colors">
                        + Agregar nueva obra
                      </button>
                    </div>
                  )}
                  {obraNewOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Nueva obra</p>
                      <input value={obraNewNombre} onChange={(e) => setObraNewNombre(e.target.value)}
                        placeholder="Nombre de la obra *"
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60" />
                      <input value={obraNewDireccion} onChange={(e) => setObraNewDireccion(e.target.value)}
                        placeholder="Dirección o link de Maps"
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60" />
                      <div className="flex gap-2 pt-1">
                        <button type="button" onMouseDown={() => setObraNewOpen(false)}
                          className="flex-1 text-sm py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 cursor-pointer">Cancelar</button>
                        <button type="button" disabled={!obraNewNombre.trim()}
                          onMouseDown={async () => {
                            if (!obraNewNombre.trim()) return;
                            const nombre = obraNewNombre.trim().toUpperCase().replace(/\s+/g, " ");
                            const direccion = obraNewDireccion.trim();
                            set("obraNombre", nombre);
                            if (direccion) set("direccion", direccion);
                            const id = `obra-${Date.now()}`;
                            const doc: Obra = { id, cliente: form.cliente.trim().toUpperCase().replace(/\s+/g, " "), nombre, direccion };
                            try { await (await import("@/lib/db")).upsertDocument(COLLECTIONS.obras, id, doc); } catch { /* ignore */ }
                            setObraOpen(false); setObraNewOpen(false); setObraQuery("");
                          }}
                          className="flex-1 text-sm py-1.5 rounded-lg bg-[#CC2229] text-white hover:bg-[#B01E24] disabled:opacity-50 cursor-pointer font-medium">
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className={lbl}>Dirección</label>
              <input type="text" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Dirección de la obra" className={inp} />
            </div>
          </div>

          <Sec title="Datos generales del viaje" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Hora programada</label>
              <input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>HSR</label>
              <input type="time" value={form.hsr} onChange={(e) => set("hsr", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Tiempo extra descarga</label>
              <input type="text" value={form.tiempoExtraDescarga} onChange={(e) => set("tiempoExtraDescarga", e.target.value)} placeholder="—" className={inp} />
            </div>
          </div>

          {/* Choferes */}
          <Sec title="Choferes" />
          <div className="space-y-3">
            {form.choferes.map((c, i) => (
              <ChoferCard
                key={c.id}
                entry={c}
                index={i}
                total={form.choferes.length}
                onChange={(updated) => setChofer(i, updated)}
                onRemove={() => removeChofer(i)}
                operadoresList={operadoresList}
                revolveList={revolveList}
              />
            ))}
            <button
              type="button"
              onClick={addChofer}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-xs font-semibold text-gray-500 hover:border-[#CC2229]/50 hover:text-[#CC2229] transition-colors"
            >
              <Plus size={13} />
              Agregar chofer
            </button>
          </div>

          <Sec title="Concreto" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>M3 totales <span className="text-emerald-600 normal-case font-normal">(auto)</span></label>
              <input
                type="text"
                value={m3TotalesAuto != null ? String(m3TotalesAuto) : "—"}
                readOnly
                className={`${roInp} text-emerald-700`}
              />
            </div>
            <div>
              <label className={lbl}>M3 vacíos</label>
              <input type="number" step="0.5" min="0" value={form.m3Vacios} onChange={(e) => set("m3Vacios", e.target.value)} placeholder="0.0" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>$ M3 Vacío</label>
              <input type="number" step="0.01" min="0" value={form.precioM3Vacio} onChange={(e) => set("precioM3Vacio", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>Resistencia</label>
              <input type="text" value={form.resistencia} onChange={(e) => set("resistencia", e.target.value)} placeholder="250, 300, 350…" className={inp} />
            </div>
            <div>
              <label className={lbl}>T/D BOM</label>
              <input type="text" value={form.tdBom} onChange={(e) => set("tdBom", e.target.value)} placeholder="Tipo / Diámetro" className={inp} />
            </div>
            <div>
              <label className={lbl}>Color</label>
              <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Natural, gris, rojo…" className={inp} />
            </div>
            <div>
              <label className={lbl}>Extras</label>
              <input type="text" value={form.extras} onChange={(e) => set("extras", e.target.value)} placeholder="—" className={inp} />
            </div>
          </div>

          <Sec title="Costos adicionales" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Precio M3 $</label>
              <input type="number" step="0.01" min="0" value={form.precioM3} onChange={(e) => set("precioM3", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={lbl} style={{ marginBottom: 0 }}>$ M3 Bomba</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.aplicarFactorBomba}
                    onChange={(e) => setBool("aplicarFactorBomba", e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#CC2229] cursor-pointer"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Factor rend.</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input type="number" step="0.01" min="0" value={form.precioM3Bomba} onChange={(e) => set("precioM3Bomba", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                {form.aplicarFactorBomba && (
                  <input
                    type="number" step="0.01" min="0"
                    value={form.factorBomba}
                    onChange={(e) => set("factorBomba", e.target.value)}
                    placeholder="1.16"
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`${inp} w-24 shrink-0`}
                  />
                )}
              </div>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Total x M3 <span className="text-emerald-600 normal-case font-normal">(Precio M3 + $ M3 Bomba — auto)</span></label>
              <input
                type="text"
                value={totalXM3Auto != null ? currency(totalXM3Auto) : "—"}
                readOnly
                className={`${roInp} text-emerald-700`}
              />
            </div>
            {(() => {
              const pVacio = n(form.precioM3Vacio) ?? 0;
              const mVacios = n(form.m3Vacios) ?? 0;
              if (pVacio <= 0 || mVacios <= 0) return null;
              return (
                <div className="col-span-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-xs text-amber-700 font-medium">
                    + M3 Vacíos: {mVacios} × {currency(pVacio)}
                  </span>
                  <span className="text-sm font-bold text-amber-800 tabular-nums">
                    {currency(pVacio * mVacios)}
                  </span>
                </div>
              );
            })()}
            <div>
              <label className={lbl}>$ Lto Acelr</label>
              <input type="number" step="0.01" min="0" value={form.ltoAcelr} onChange={(e) => set("ltoAcelr", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>$ Kilo Fibra</label>
              <input type="number" step="0.01" min="0" value={form.kiloFibra} onChange={(e) => set("kiloFibra", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>$ M3 Imper</label>
              <input type="number" step="0.01" min="0" value={form.m3Imper} onChange={(e) => set("m3Imper", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>Tubería extra $</label>
              <input type="number" step="0.01" min="0" value={form.tuberiaExtra} onChange={(e) => set("tuberiaExtra", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>Permisos O/C $</label>
              <input type="number" step="0.01" min="0" value={form.permisosOC} onChange={(e) => set("permisosOC", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>Aditivo</label>
              <input type="text" value={form.aditivo} onChange={(e) => set("aditivo", e.target.value)} placeholder="—" className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Total $ <span className="text-emerald-600 normal-case font-normal">(Total x M3 × M3 totales + vacíos + extras — auto)</span></label>
              <input
                type="text"
                value={totalAuto != null ? currency(totalAuto) : "—"}
                readOnly
                className={`${roInp} text-lg text-emerald-700`}
              />
            </div>
          </div>

          <Sec title="Pago" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Recibo</label>
              <input type="text" value={form.recibo} onChange={(e) => set("recibo", e.target.value)} placeholder="No. recibo" className={inp} />
            </div>
            <div>
              <label className={lbl}>Fact</label>
              <input type="text" value={form.fact} onChange={(e) => set("fact", e.target.value)} placeholder="No. factura" className={inp} />
            </div>
            <div>
              <label className={lbl}>Crédito</label>
              <input type="text" value={form.credito} onChange={(e) => set("credito", e.target.value)} placeholder="—" className={inp} />
            </div>
            <div>
              <label className={lbl}>Pagado</label>
              <AppSelect value={form.pagado} onChange={(e) => set("pagado", e.target.value)}>
                <option value="">—</option>
                <option value="Sí">Sí</option>
                <option value="No">No</option>
                <option value="Parcial">Parcial</option>
              </AppSelect>
            </div>
            {form.pagado === "Parcial" && (
              <div>
                <label className={lbl}>Monto pagado $</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.montoPagado}
                  onChange={(e) => set("montoPagado", e.target.value)}
                  placeholder="0.00"
                  className={inp}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            )}
          </div>

          {/* Exhibiciones — solo cuando hay algo que cobrar */}
          {(form.pagado === "Sí" || form.pagado === "Parcial") && (
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Fecha de pago</p>
            <div className="flex gap-2 mb-4">
              {(["1", "2"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("exhibiciones", form.exhibiciones === n ? "" : n)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    form.exhibiciones === n
                      ? "bg-[#CC2229] border-[#CC2229] text-white"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {n === "1" ? "1 Exhibición" : "2 Exhibiciones"}
                </button>
              ))}
            </div>

            {(form.exhibiciones === "1" || form.exhibiciones === "") && (
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Método</label>
                  <AppSelect value={form.metodoPago} onChange={(e) => set("metodoPago", e.target.value)}>
                    <option value="">—</option>
                    {["Efectivo", "Transferencia", "Cheque", "Crédito", "Por definir"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </AppSelect>
                </div>
              </div>
            )}

            {form.exhibiciones === "2" && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-3">Exhibición 1</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Fecha</label>
                      <input type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Método</label>
                      <AppSelect value={form.metodoPago} onChange={(e) => set("metodoPago", e.target.value)}>
                        <option value="">—</option>
                        {["Efectivo", "Transferencia", "Cheque", "Crédito", "Por definir"].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </AppSelect>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-3">Exhibición 2</p>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Monto $</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={form.montoPago2}
                        onChange={(e) => set("montoPago2", e.target.value)}
                        placeholder="0.00" className={inp}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Fecha</label>
                        <input type="date" value={form.fechaPago2} onChange={(e) => set("fechaPago2", e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Método</label>
                        <AppSelect value={form.metodoPago2} onChange={(e) => set("metodoPago2", e.target.value)}>
                          <option value="">—</option>
                          {["Efectivo", "Transferencia", "Cheque", "Crédito", "Por definir"].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </AppSelect>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

        </div>{/* fin body scroll */}

        {/* Notas — lado a lado */}
        <div className={`shrink-0 px-6 pb-4 grid gap-3 ${canSeeProgNotas ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* Notas del vendedor */}
          <div className={`rounded-xl border-2 p-3 ${canEditVendorNotas ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
            <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2 ${canEditVendorNotas ? "text-blue-700" : "text-gray-500"}`}>
              <MessageSquare size={11} />
              Notas vendedor
              {!canEditVendorNotas && <span className="ml-1 normal-case tracking-normal font-normal text-gray-400">(lectura)</span>}
            </label>
            <textarea
              rows={2}
              readOnly={!canEditVendorNotas}
              value={form.notasVendedor}
              onChange={canEditVendorNotas ? (e) => set("notasVendedor", e.target.value) : undefined}
              placeholder={canEditVendorNotas ? "Notas al equipo de programación…" : "Sin notas"}
              className={`w-full resize-none rounded-lg px-2.5 py-2 text-xs focus:outline-none ${
                canEditVendorNotas
                  ? "bg-white border border-blue-300 text-gray-800 placeholder-blue-300 focus:ring-2 focus:ring-blue-400"
                  : "bg-gray-100 border border-gray-200 text-gray-600 cursor-default"
              }`}
            />
          </div>

          {/* Notas de programación — ocultas al vendedor del registro */}
          {canSeeProgNotas && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Notas programación
                <span className="ml-1 normal-case tracking-normal font-normal text-amber-500">(internas)</span>
              </label>
              <textarea
                rows={2}
                value={form.notas}
                onChange={(e) => set("notas", e.target.value)}
                placeholder="Instrucciones operativas internas…"
                className="w-full resize-none bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-xs text-gray-800 placeholder-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}
        </div>

        {/* Color de fila — solo admins */}
        {isAdminInForm && (
          <div className="shrink-0 px-6 pb-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                <Palette size={12} />
                Color de fila en tabla
              </label>
              <div className="flex gap-2 flex-wrap">
                {ROW_COLORS.map(({ label, value, display }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set("rowColor", value)}
                    title={label}
                    className={`w-9 h-9 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-center ${
                      form.rowColor === value
                        ? "border-gray-800 ring-2 ring-gray-800 ring-offset-1 scale-110"
                        : "border-gray-300 hover:border-gray-500"
                    }`}
                    style={{ backgroundColor: display }}
                  >
                    {value === "" && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <line x1="2" y1="2" x2="12" y2="12" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="12" y1="2" x2="2" y2="12" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          {onDelete && initial?.id && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="px-3 py-2.5 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
            >
              Solicitar eliminación
            </button>
          )}
          {isAdminInForm && initial && (
            <button
              type="button"
              onClick={() => setShowHistorial(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl transition-colors"
            >
              <History size={13} />
              Historial
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <CalendarDays size={14} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <HistorialDrawer
        open={showHistorial}
        onClose={() => setShowHistorial(false)}
        historial={initial?.historial ?? []}
        cliente={form.cliente}
      />
    </div>
  );
}

// ─── TrackingModal ────────────────────────────────────────────────────────────

function TrackingModal({
  prog,
  plantaActiva,
  onClose,
}: {
  prog: Programacion;
  plantaActiva: string;
  onClose: () => void;
}) {
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvingDest, setResolvingDest] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [cierreNotas, setCierreNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [isLight, setIsLight] = useState(() =>
    typeof document !== "undefined" ? document.body.classList.contains("duro-theme-light") : false
  );
  useEffect(() => {
    const sync = () => setIsLight(document.body.classList.contains("duro-theme-light"));
    sync();
    window.addEventListener("duro:theme-change", sync);
    return () => window.removeEventListener("duro:theme-change", sync);
  }, []);

  useEffect(() => {
    const url = prog.direccion;
    if (!url || !isUrl(url)) { setDestCoords(null); return; }
    const direct = extractCoordsFromUrl(url);
    if (direct) { setDestCoords(direct); return; }
    setResolvingDest(true);
    let cancelled = false;
    fetch(`/api/maps/resolve?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.coords) setDestCoords(d.coords); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setResolvingDest(false); });
    return () => { cancelled = true; };
  }, [prog.direccion]);

  const choferes = (prog.choferes ?? []) as ChoferEntry[];
  const plantaCoords = PLANT_COORDS[plantaActiva] ?? null;

  async function handleEntregado() {
    if (!prog.id) return;
    setSaving(true);
    try {
      const entrada: FaseEntry = { fase: "Entregado", fecha: new Date().toISOString(), nota: cierreNotas.trim() || undefined };
      const { id: _id, ...rest } = prog;
      await upsertDocument(COLLECTIONS.programaciones, prog.id, {
        ...rest,
        fase: "Entregado",
        notasAcceso: cierreNotas.trim() || prog.notasAcceso,
        historial: [...(prog.historial ?? []), entrada],
      });
      setShowCierre(false);
      setCierreNotas("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const parseMins = (t: string | null): number | null => {
    if (!t || !t.includes(":")) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const diffLabel = (from: string | null, to: string | null): string | null => {
    const a = parseMins(from), b = parseMins(to);
    if (a == null || b == null || b <= a) return null;
    const d = b - a;
    return d < 60 ? `${d}m` : `${Math.floor(d / 60)}h ${d % 60 > 0 ? `${d % 60}m` : ""}`.trim();
  };
  const minHora = (field: keyof ChoferEntry): string | null => {
    const vals = choferes.map((c) => c[field] as string).filter(Boolean);
    return vals.length > 0 ? vals.sort()[0] : null;
  };

  const phases: { label: string; sub: string | null; done: boolean }[] = [
    {
      label: "Pedido creado",
      sub: prog.diaHoraPedido
        ? new Date(prog.diaHoraPedido).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : prog.historial?.[0]?.fecha
        ? new Date(prog.historial[0].fecha).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : null,
      done: true,
    },
    {
      label: "Asignado",
      sub: choferes.length > 0 ? `${choferes.length} viaje${choferes.length > 1 ? "s" : ""}` : null,
      done: choferes.length > 0,
    },
    {
      label: "En camino",
      sub: minHora("horaSalida"),
      done: !!minHora("horaSalida"),
    },
    {
      label: "En obra",
      sub: minHora("horaLlegadaObra"),
      done: !!minHora("horaLlegadaObra"),
    },
    {
      label: "Descargando",
      sub: minHora("horaInicioDescarga")
        ? `${minHora("horaInicioDescarga")} – ${minHora("horaFinalDescarga") ?? "…"}`
        : null,
      done: !!minHora("horaInicioDescarga"),
    },
    {
      label: "Completado",
      sub: prog.historial?.find((h) => h.fase === "Entregado")?.fecha
        ? new Date(prog.historial!.find((h) => h.fase === "Entregado")!.fecha).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })
        : null,
      done: prog.fase === "Entregado",
    },
  ];
  const lastDoneIdx = phases.reduce((last, p, i) => (p.done ? i : last), -1);

  const routeUrl = plantaCoords && destCoords
    ? `https://www.google.com/maps/dir/${plantaCoords.lat},${plantaCoords.lng}/${destCoords.lat},${destCoords.lng}`
    : destCoords
    ? `https://www.google.com/maps/search/?api=1&query=${destCoords.lat},${destCoords.lng}`
    : isUrl(prog.direccion)
    ? prog.direccion
    : null;

  const mapEmbedUrl = destCoords
    ? (() => {
        const { lat, lng } = destCoords;
        const delta = 0.006;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
      })()
    : null;

  // Theme-aware inline styles — bypasses global CSS overrides and respects duro-theme-light
  const S = isLight ? {
    modal:       { backgroundColor: "#FFFFFF", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" },
    divider:     "1px solid #E5E7EB",
    card:        { backgroundColor: "#F8F9FB", border: "1px solid #E5E7EB" },
    cardHeader:  { backgroundColor: "#F1F3F7" },
    connDone:    { backgroundColor: "#9CA3AF" },
    connEmpty:   { backgroundColor: "#E5E7EB" },
    dotDone:     { backgroundColor: "#9CA3AF" },
    dotFuture:   { backgroundColor: "transparent", border: "1px solid #D1D5DB" },
    timelineBg:  { backgroundColor: "#F8F9FB" },
    textPrimary: "#111827",
    textSecond:  "#6B7280",
    textMuted:   "#9CA3AF",
    textFaint:   "#D1D5DB",
    labelBg:     "rgba(17,24,39,0.85)",
  } : {
    modal:       { backgroundColor: "#111115" },
    divider:     "1px solid rgba(255,255,255,0.08)",
    card:        { backgroundColor: "#1E1E24", border: "1px solid rgba(255,255,255,0.08)" },
    cardHeader:  { backgroundColor: "#26262E" },
    connDone:    { backgroundColor: "#52525B" },
    connEmpty:   { backgroundColor: "#27272A" },
    dotDone:     { backgroundColor: "#52525B" },
    dotFuture:   { backgroundColor: "transparent", border: "1px solid #3F3F46" },
    timelineBg:  { backgroundColor: "#111115" },
    textPrimary: "#FFFFFF",
    textSecond:  "#A1A1AA",
    textMuted:   "#71717A",
    textFaint:   "#3F3F46",
    labelBg:     "rgba(17,17,21,0.95)",
  };

  const t = S.textPrimary;
  const ts = S.textSecond;
  const tm = S.textMuted;
  const tf = S.textFaint;
  const divB = S.divider;
  const emptyDotBorder = isLight ? "1px solid #D1D5DB" : "1px solid #3F3F46";
  const emptyTimeBorder = isLight ? "1px solid #D1D5DB" : "1px solid #3F3F46";
  const emptyTimeColor = isLight ? "#D1D5DB" : "#3F3F46";
  const connFull = isLight ? "#CC2229" : "#CC2229";
  const connEmpty = isLight ? "#E5E7EB" : "rgba(255,255,255,0.08)";
  const numberBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
  const numberBorder = isLight ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.15)";
  const closeBtnStyle = { color: tm };
  const faseBadge = prog.fase === "Entregado"
    ? { border: "1px solid #059669", backgroundColor: "#ECFDF5", color: "#047857" }
    : { border: "1px solid #D97706", backgroundColor: "#FFFBEB", color: "#B45309" };
  const scrollbarStyle = isLight
    ? { scrollbarWidth: "thin" as const, scrollbarColor: "#D1D5DB transparent" }
    : { scrollbarWidth: "thin" as const, scrollbarColor: "#3F3F46 transparent" };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-2xl max-h-[92vh] overflow-y-auto"
        style={{ ...S.modal, ...scrollbarStyle }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5" style={{ borderBottom: divB }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: "#E32636", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em" }}>
                {prog.folio ?? "SIN FOLIO"}
              </span>
              {prog.fase && (
                <span style={{ ...faseBadge, borderRadius: 9999, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>
                  {prog.fase}
                </span>
              )}
            </div>
            <h2 style={{ color: t, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{prog.cliente}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: ts, fontSize: 13 }}>
              {prog.dia && <span>{new Date(prog.dia + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</span>}
              {prog.hora && <><span style={{ color: tf }}>·</span><span>Llegada <strong style={{ color: t }}>{prog.hora}</strong></span></>}
              {prog.m3Totales != null && <><span style={{ color: tf }}>·</span><strong style={{ color: t }}>{prog.m3Totales} m³</strong></>}
              {prog.tdBom && <><span style={{ color: tf }}>·</span><span>{prog.tdBom}</span></>}
              {prog.resistencia && <><span style={{ color: tf }}>·</span><span>{prog.resistencia}</span></>}
            </div>
          </div>
          <button onClick={onClose} className="mt-1 shrink-0 cursor-pointer rounded-xl p-2 transition-colors hover:bg-black/5"
            style={closeBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {/* ── Stepper ── */}
        <div className="px-6 py-6" style={{ borderBottom: divB }}>
          <p style={{ color: tm, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
            Estado del viaje
          </p>
          <div className="flex items-start">
            {phases.map((phase, i) => {
              const isActive = i === lastDoneIdx;
              const isDone = phase.done && i < lastDoneIdx;
              const circleStyle = isDone
                ? S.dotDone
                : isActive
                ? { backgroundColor: "#CC2229" }
                : S.dotFuture;
              const labelColor = isActive ? t : isDone ? ts : tm;
              const subColor = isActive ? ts : tm;
              return (
                <div key={i} className="flex flex-1 items-start" style={{ minWidth: 76 }}>
                  <div className="flex flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={circleStyle}>
                        <span style={{ color: isDone ? (isLight ? "#374151" : "#D1D5DB") : isActive ? "#FFFFFF" : tm }}>
                          {isDone ? "✓" : i + 1}
                        </span>
                      </div>
                      {i < phases.length - 1 && (
                        <div className="mx-1 flex-1 rounded-full" style={{ height: 2, ...(isDone ? S.connDone : S.connEmpty) }} />
                      )}
                    </div>
                    <div className="mt-2 w-full pr-1">
                      <p style={{ color: labelColor, fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}>{phase.label}</p>
                      {phase.sub && <p style={{ color: subColor, fontSize: 9, marginTop: 2, lineHeight: 1.3 }}>{phase.sub}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Dirección ── */}
        {(prog.direccion || resolvingDest) && (
          <div className="px-6 py-5" style={{ borderBottom: divB }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5" style={{ color: tm, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                <MapPin size={10} /> Ubicación de la obra
              </p>
              {routeUrl && (
                <a href={routeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                  style={{ fontSize: 10, fontWeight: 600, color: ts, border: divB }}>
                  <Navigation size={10} />
                  {plantaCoords ? `Ruta desde ${plantaCoords.label}` : "Ver en Maps"}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>

            {resolvingDest && !mapEmbedUrl && (
              <div className="flex h-32 items-center justify-center gap-2 rounded-xl" style={S.card}>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-red-500" style={{ borderColor: tm, borderTopColor: "#E32636" }} />
                <span style={{ color: tm, fontSize: 12 }}>Obteniendo ubicación…</span>
              </div>
            )}

            {mapEmbedUrl && (
              <div className="relative overflow-hidden rounded-xl" style={{ height: 180, border: divB }}>
                <iframe src={mapEmbedUrl} width="100%" height="100%" className="h-full w-full border-0 grayscale" title="Ubicación" loading="lazy" />
                {plantaCoords && (
                  <div className="absolute bottom-2 left-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: S.labelBg, border: divB, fontSize: 9, color: ts }}>
                    <span style={{ color: "#E32636", fontWeight: 600 }}>{plantaCoords.label}</span> → Obra
                  </div>
                )}
              </div>
            )}

            {!resolvingDest && !mapEmbedUrl && isUrl(prog.direccion) && (
              <div className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl" style={S.card}>
                <MapPin size={16} style={{ color: tm }} />
                <p style={{ color: ts, fontSize: 12 }}>No se pudieron obtener coordenadas.</p>
                <a href={prog.direccion} target="_blank" rel="noopener noreferrer" style={{ color: tm, fontSize: 11, textDecoration: "underline" }}>Abrir en Maps</a>
              </div>
            )}

            {!isUrl(prog.direccion) && prog.direccion && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={S.card}>
                <MapPin size={14} style={{ color: "#E32636", flexShrink: 0 }} />
                <span style={{ color: ts, fontSize: 14 }}>{prog.direccion}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Viajes ── */}
        {choferes.length > 0 && (
          <div className="px-6 py-5 space-y-3" style={{ borderBottom: divB }}>
            <p style={{ color: tm, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Viajes · {choferes.reduce((s, c) => s + (c.m3 ?? 0), 0)} m³ entregados
            </p>
            {choferes.map((c, i) => {
              const steps: { label: string; time: string | null }[] = [
                { label: "Salida planta", time: c.horaSalida || null },
                { label: "Llegada obra",  time: c.horaLlegadaObra || null },
                { label: "Inicio desc.",  time: c.horaInicioDescarga || null },
                { label: "Fin desc.",     time: c.horaFinalDescarga || null },
                { label: "Salida obra",   time: c.horaSalidaObra || null },
              ];
              const hasTime = steps.some((s) => s.time);
              return (
                <div key={i} className="overflow-hidden rounded-xl" style={S.card}>
                  {/* chofer header */}
                  <div className="flex items-center justify-between px-4 py-3" style={S.cardHeader}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ border: numberBorder, backgroundColor: numberBg, color: tm }}>
                        {i + 1}
                      </span>
                      <div>
                        <p style={{ color: t, fontSize: 14, fontWeight: 600 }}>{c.chofer || `Chofer ${i + 1}`}</p>
                        {(c.cr || c.remision || c.numSello) && (
                          <p style={{ color: tm, fontSize: 10, marginTop: 2 }}>
                            {[c.cr && `CR: ${c.cr}`, c.remision && `Rem: ${c.remision}`, c.numSello && `Sello: ${c.numSello}`].filter(Boolean).join("  ·  ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {c.m3 != null && <span style={{ color: ts, fontSize: 14, fontWeight: 700 }}>{c.m3} m³</span>}
                  </div>
                  {/* timeline */}
                  {hasTime ? (
                    <div className="overflow-x-auto px-5 py-5" style={S.timelineBg}>
                      <div className="flex items-center" style={{ minWidth: "max-content" }}>
                        {steps.map((step, si) => (
                          <div key={si} className="flex items-center">
                            <div className="flex flex-col items-center" style={{ width: 88 }}>
                              <div className="h-4 w-4 rounded-full" style={{
                                backgroundColor: step.time ? "#CC2229" : "transparent",
                                border: step.time ? "none" : emptyTimeBorder,
                              }} />
                              <p className="mt-2 tabular-nums" style={{
                                color: step.time ? t : emptyTimeColor,
                                fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                              }}>{step.time ?? "—"}</p>
                              <p className="mt-1 text-center leading-tight" style={{ color: tm, fontSize: 9 }}>{step.label}</p>
                              {si > 0 && step.time && steps[si - 1].time && (
                                <p className="mt-1 font-semibold" style={{ color: "#E32636", fontSize: 9 }}>+{diffLabel(steps[si - 1].time, step.time)}</p>
                              )}
                            </div>
                            {si < steps.length - 1 && (
                              <div className="shrink-0" style={{
                                width: 20, height: 2, borderRadius: 9999,
                                backgroundColor: step.time && steps[si + 1]?.time ? connFull : connEmpty,
                              }} />
                            )}
                          </div>
                        ))}
                      </div>
                      {c.tiempoDescarga && (
                        <p style={{ color: tm, fontSize: 10, marginTop: 12 }}>
                          Tiempo descarga: <span style={{ color: ts, fontWeight: 500 }}>{c.tiempoDescarga}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="px-4 py-3" style={{ ...S.timelineBg, color: tm, fontSize: 12 }}>Sin horas registradas aún.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Resumen ── */}
        <div className="px-6 py-5 space-y-4">
          {(prog.total != null || prog.recibo || prog.fact || prog.pagado) && (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {prog.total != null && <span style={{ color: t, fontSize: 24, fontWeight: 700 }}>${prog.total.toLocaleString("es-MX")}</span>}
              {prog.pagado === "Sí" && <span style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>Pagado</span>}
              {prog.credito && <span style={{ color: ts, fontSize: 13 }}>{prog.credito}</span>}
              {prog.recibo && <span style={{ color: ts, fontSize: 13 }}>Recibo {prog.recibo}</span>}
              {prog.fact && <span style={{ color: ts, fontSize: 13 }}>Fact. {prog.fact}</span>}
            </div>
          )}

          {prog.notasAcceso && (
            <div className="rounded-xl p-4" style={{
              border: isLight ? "1px solid #FDE68A" : "1px solid rgba(217,119,6,0.4)",
              backgroundColor: isLight ? "#FFFBEB" : "rgba(120,53,15,0.2)",
            }}>
              <p className="mb-1.5 flex items-center gap-1.5" style={{ color: isLight ? "#B45309" : "#F59E0B", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                <AlertTriangle size={10} /> Acceso especial
              </p>
              <p style={{ color: isLight ? "#78350F" : "#FDE68A", fontSize: 13, lineHeight: 1.5 }}>{prog.notasAcceso}</p>
            </div>
          )}

          {prog.notas && <p style={{ color: ts, fontSize: 13, lineHeight: 1.6 }}>{prog.notas}</p>}

          {/* Samsara */}
          <div className="rounded-xl p-4" style={S.card}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: prog.vehiculoSamsaraId ? "#10B981" : (isLight ? "#D1D5DB" : "#3F3F46") }} />
                <div>
                  <p style={{ color: tm, fontSize: 12, fontWeight: 600 }}>GPS en tiempo real · Samsara</p>
                  {prog.vehiculoSamsaraId
                    ? <p style={{ color: t, fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>{prog.vehiculoSamsaraId}</p>
                    : <p style={{ color: tf, fontSize: 10, marginTop: 2 }}>Sin ID — agrégalo en el drawer de programación</p>
                  }
                </div>
              </div>
              <span style={{ color: prog.vehiculoSamsaraId ? "#059669" : tm, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {prog.vehiculoSamsaraId ? "Activo" : "Pendiente"}
              </span>
            </div>
          </div>

          {/* Marcar como entregado */}
          {prog.fase !== "Entregado" && (
            <div className="rounded-xl overflow-hidden" style={{ border: isLight ? "1px solid #E5E7EB" : "1px solid rgba(255,255,255,0.08)" }}>
              {!showCierre ? (
                <button
                  onClick={() => setShowCierre(true)}
                  className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:opacity-80"
                  style={{ backgroundColor: isLight ? "#F0FDF4" : "rgba(16,185,129,0.08)" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ color: "#059669", fontSize: 13, fontWeight: 600 }}>Marcar como entregado</p>
                      <p style={{ color: tm, fontSize: 11, marginTop: 2 }}>Cierra el viaje y registra la entrega</p>
                    </div>
                    <span style={{ color: "#059669", fontSize: 18 }}>✓</span>
                  </div>
                </button>
              ) : (
                <div className="p-4" style={{ backgroundColor: isLight ? "#F0FDF4" : "rgba(16,185,129,0.08)" }}>
                  <p style={{ color: "#059669", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Confirmar entrega</p>
                  <textarea
                    value={cierreNotas}
                    onChange={(e) => setCierreNotas(e.target.value)}
                    placeholder="Notas de acceso o incidencias (opcional)"
                    rows={2}
                    className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                    style={{
                      backgroundColor: isLight ? "#FFFFFF" : "rgba(0,0,0,0.3)",
                      border: isLight ? "1px solid #D1FAE5" : "1px solid rgba(16,185,129,0.3)",
                      color: t,
                    }}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { setShowCierre(false); setCierreNotas(""); }}
                      className="flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm transition-opacity hover:opacity-70"
                      style={{ border: isLight ? "1px solid #E5E7EB" : "1px solid rgba(255,255,255,0.1)", color: ts, backgroundColor: "transparent" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleEntregado}
                      disabled={saving}
                      className="flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: "#059669" }}
                    >
                      {saving ? "Guardando…" : "Confirmar entrega"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramacionPage() {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);
  const [clientesList, setClientesList] = useState<string[]>([]);
  const [revolveList, setRevolveList] = useState<string[]>([]);
  const [obrasData, setObrasData] = useState<Obra[]>([]);
  const [clientesSet, setClientesSet] = useState<Set<string>>(new Set());
  const [diaActivo, setDiaActivo] = useState(todayISO);
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const [rangoInicio, setRangoInicio] = useState(todayISO);
  const [rangoFin, setRangoFin] = useState(todayISO);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Programacion | undefined>();
  const [loading, setLoading] = useState(true);
  const [excelFullscreen, setExcelFullscreen] = useState(false);
  const [rastreoSearch, setRastreoSearch] = useState("");
  const [timelineProg, setTimelineProg] = useState<Programacion | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingNotas, setMarkingNotas] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const plantaActiva = useMemo(() => getStoredSession()?.planta ?? "", []);
  const isAdmin = getStoredSession()?.role === "admin";

  // Solicitud de autorización para eliminar
  const [solicitudElim, setSolicitudElim] = useState<Programacion | null>(null);
  const [motivoElim, setMotivoElim] = useState("");
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  const migrationRan = useRef(false);

  // Static data — load once
  useEffect(() => {
    Promise.all([
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<{ tipoUnidad: string; noEconomico: string; unidadId: string }>(COLLECTIONS.seguros),
      getCollectionDocs<Unidad>(COLLECTIONS.unidades),
    ]).then(([ops, clientes, segs, unis]) => {
      setOperadoresList(ops.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre })));

      const unitEstatusMap = new Map(unis.map((u) => [u.id, u.estatus]));
      const revolvedoras = segs
        .filter((s) => s.tipoUnidad === "Revolvedora" && s.noEconomico)
        .filter((s) => !s.unidadId || unitEstatusMap.get(s.unidadId) !== "Baja")
        .map((s) => s.noEconomico)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
      setRevolveList(revolvedoras);

      const fromClientes = clientes.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean));
      const existingSet = new Set(clientes.map((c) => c.razonSocial.toLowerCase().trim()));
      setClientesSet(existingSet);

      // Client list gets rebuilt on each programaciones snapshot (see below),
      // but seed it from the clientes collection immediately.
      setClientesList(Array.from(new Set(fromClientes)).sort());
    }).catch((err) => console.error("Error cargando datos estáticos:", err));
    getCollectionDocs<Obra>(COLLECTIONS.obras).then(setObrasData).catch(() => {});
  }, []);

  // Real-time programaciones subscription
  useEffect(() => {
    const unsub = subscribeToCollection<Programacion>(
      COLLECTIONS.programaciones,
      (progs) => {
        const filtered = filterByPlanta(progs);
        setProgramaciones(filtered);

        // Rebuild client suggestions on every update
        setClientesList((prev) => {
          const fromProgs = filtered.map((p) => p.cliente).filter(Boolean);
          const merged = Array.from(new Set([...prev, ...fromProgs])).sort();
          return merged;
        });

        // One-time migrations on first snapshot
        if (!migrationRan.current) {
          migrationRan.current = true;
          setLoading(false);

          const toFix = filtered.filter((p) => {
            const { totalXM3, total } = calcTotalesProg(p);
            return (totalXM3 !== null && p.totalXM3 !== totalXM3) ||
                   (total !== null && p.total !== total);
          });
          if (toFix.length > 0) {
            Promise.all(
              toFix.map((p) => {
                const { totalXM3, total } = calcTotalesProg(p);
                const { id: _id, ...data } = p;
                return upsertDocument(COLLECTIONS.programaciones, p.id!, withPlantaTag({ ...data, totalXM3, total }));
              })
            ).catch((err) => console.error("Error migrando totales:", err));
          }

        }
      }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list: Programacion[];
    if (viewMode === "rastreo") {
      const q = rastreoSearch.toLowerCase().trim();
      list = q
        ? programaciones.filter((p) =>
            p.folio?.toLowerCase().includes(q) ||
            p.cliente?.toLowerCase().includes(q) ||
            p.vendedor?.toLowerCase().includes(q) ||
            p.direccion?.toLowerCase().includes(q),
          )
        : [...programaciones];
    } else if (viewMode === "dia") {
      list = programaciones.filter((p) => p.dia === diaActivo);
    } else if (viewMode === "semana") {
      const [s, e] = weekRange(diaActivo);
      list = programaciones.filter((p) => (p.dia ?? "") >= s && (p.dia ?? "") <= e);
    } else if (viewMode === "mes") {
      const mesKey = diaActivo.slice(0, 7);
      list = programaciones.filter((p) => (p.dia ?? "").startsWith(mesKey));
    } else {
      list = programaciones.filter((p) => (p.dia ?? "") >= rangoInicio && (p.dia ?? "") <= rangoFin);
    }
    return list.sort((a, b) => {
      const dc = (b.dia ?? "").localeCompare(a.dia ?? "");
      return dc !== 0 ? dc : (a.hora ?? "").localeCompare(b.hora ?? "");
    });
  }, [programaciones, diaActivo, viewMode, rangoInicio, rangoFin, rastreoSearch]);

  const totalM3 = filtered.reduce((s, p) => s + (p.m3Totales ?? 0), 0);
  const totalFacturado = filtered.reduce((s, p) => s + (p.total ?? 0), 0);
  const totalM3Vacios = filtered.reduce((s, p) => s + (p.m3Vacios ?? 0), 0);
  const totalPagado = filtered.filter((p) => p.pagado === "Sí").length;

  // Panel de trabajo: conteos por estado para el equipo de programación
  const trabajoPendiente = useMemo(() => {
    const sinAsignar = filtered.filter((p) => !p.choferes || p.choferes.length === 0).length;
    const enProceso = filtered.filter((p) => {
      const ch = (p.choferes ?? []) as ChoferEntry[];
      return ch.length > 0 && !ch.every((c) => c.horaSalidaObra) && p.fase !== "Entregado";
    }).length;
    const porCerrar = filtered.filter((p) => {
      const ch = (p.choferes ?? []) as ChoferEntry[];
      return ch.length > 0 && ch.every((c) => c.horaSalidaObra) && p.fase !== "Entregado";
    }).length;
    return { sinAsignar, enProceso, porCerrar };
  }, [filtered]);

  async function handleSave(p: Programacion) {
    const id = p.id!;
    const { id: _id, ...data } = p;
    await upsertDocument(COLLECTIONS.programaciones, id, withPlantaTag(data));
    setProgramaciones((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const updated = { ...p, id };
      return idx >= 0 ? prev.map((x, i) => (i === idx ? updated : x)) : [updated, ...prev];
    });

  }

  async function handleSolicitarEliminar(prog: Programacion) {
    setSolicitudElim(prog);
    setMotivoElim("");
  }

  async function handleEnviarSolicitudEliminar() {
    if (!solicitudElim || !motivoElim.trim()) return;
    setEnviandoSolicitud(true);
    try {
      const session = getStoredSession();
      const solicitudId = `elim_${solicitudElim.id}_${Date.now()}`;
      const solicitud: Omit<SolicitudAutorizacion, "id"> = {
        tipo: "eliminar_programacion",
        programacionId: solicitudElim.id!,
        folio: solicitudElim.folio ?? solicitudElim.id!,
        dia: solicitudElim.dia,
        cliente: solicitudElim.cliente,
        motivo: motivoElim.trim(),
        solicitanteNombre: session?.name ?? "Usuario",
        solicitanteEmail: session?.email ?? "",
        status: "pendiente",
        creadoEn: new Date().toISOString(),
        planta: solicitudElim.planta,
      };
      await upsertDocument(COLLECTIONS.solicitudesAutorizacion, solicitudId, solicitud);

      // Notificar a todos los usuarios con canAuthorize
      const allUsers = await getAllUserProfiles();
      const autorizadores = allUsers.filter((u) => u.canAuthorize && u.status === "Activo");
      await Promise.all(autorizadores.map((u) => {
        const notifId = `notif_autorizacion_${solicitudId}_${u.id}`;
        const notif: Omit<import("@/lib/db").Notificacion, "id"> = {
          titulo: "Solicitud de eliminación pendiente",
          detalle: `${session?.name ?? "Un usuario"} solicita eliminar prog. ${solicitudElim.folio ?? solicitudElim.id} — ${solicitudElim.cliente}`,
          href: "/configuracion?tab=autorizaciones",
          tag: "Autorización",
          tipo: "autorizacion",
          prioridad: "alta",
          destinatarioEmail: u.email,
          leidoPor: [],
          creadoEn: new Date().toISOString(),
          planta: solicitudElim.planta,
        };
        return upsertDocument(COLLECTIONS.notificaciones, notifId, notif);
      }));

      setSolicitudElim(null);
      setMotivoElim("");
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Solicitud enviada", message: "Los autorizadores recibirán una notificación." } }));
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al enviar la solicitud." } }));
    } finally {
      setEnviandoSolicitud(false);
    }
  }

  async function handleDeleteConfirmado(id: string) {
    setProgramaciones((prev) => prev.filter((p) => p.id !== id));
    await deleteDocument(COLLECTIONS.programaciones, id);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Programación eliminada." } }));
  }

  async function handleEntregarDirecto(prog: Programacion, notas: string) {
    if (!prog.id) return;
    setSavingId(prog.id);
    try {
      const entrada: FaseEntry = { fase: "Entregado", fecha: new Date().toISOString(), nota: notas.trim() || undefined };
      const { id: _id, ...rest } = prog;
      await upsertDocument(COLLECTIONS.programaciones, prog.id, {
        ...rest,
        fase: "Entregado",
        notasAcceso: notas.trim() || prog.notasAcceso,
        historial: [...(prog.historial ?? []), entrada],
      });
      setMarkingId(null);
      setMarkingNotas("");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateCxC(p: Programacion) {
    if (!p.id || !p.total) return;
    const isoToDisplay = (iso: string) => {
      if (!iso || !iso.includes("-")) return iso;
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    };
    const mapFormaPago = (m: string) => {
      const lower = (m ?? "").toLowerCase();
      if (lower.includes("efectivo")) return "01 - Efectivo";
      if (lower.includes("transfer")) return "03 - Transferencia electrónica";
      if (lower.includes("tarjeta") || lower.includes("créd")) return "04 - Tarjeta de crédito";
      if (lower.includes("débito")) return "28 - Tarjeta de débito";
      return "99 - Por definir";
    };
    const montoPagado = p.pagado === "Sí" ? p.total : (p.pagado === "Parcial" ? (p.montoPagado ?? 0) : 0);
    const saldo = p.total - montoPagado;
    const status: "Pagado" | "Parcial" | "Pendiente" = saldo <= 0 ? "Pagado" : montoPagado > 0 ? "Parcial" : "Pendiente";
    const vencimiento = p.fechaPago ? isoToDisplay(p.fechaPago) : isoToDisplay(p.dia);
    const cxcId = `cxc-prog-${p.id}`;
    const cxcData = {
      estadoSAT: "Vigente" as const,
      tipo: "Factura" as const,
      serie: "F",
      uuid: "",
      uuidRelacion: "",
      rfc: "",
      fecha: isoToDisplay(p.dia),
      folio: p.recibo || "",
      contraparte: p.cliente,
      concepto: [`Concreto`, p.resistencia, p.m3Totales != null ? `${p.m3Totales} m³` : ""].filter(Boolean).join(" · "),
      subtotal: p.total,
      iva: 0,
      total: p.total,
      formaPago: mapFormaPago(p.metodoPago),
      banco: "",
      montoPagado,
      vencimiento,
      status,
      notas: `Programación ${p.dia}${p.recibo ? ` · Recibo ${p.recibo}` : ""}`,
      abonos: montoPagado > 0 ? [{ fecha: p.fechaPago ? isoToDisplay(p.fechaPago) : isoToDisplay(p.dia), monto: montoPagado, referencia: p.metodoPago }] : [],
      programacionId: p.id,
    };
    await upsertDocument(COLLECTIONS.cuentasPorCobrar, cxcId, cxcData);
    const { id: _id, ...rest } = p;
    await upsertDocument(COLLECTIONS.programaciones, p.id, withPlantaTag({ ...rest, cxcId }));
    setProgramaciones((prev) => prev.map((prog) => prog.id === p.id ? { ...prog, cxcId } : prog));
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Enviado a CxC", message: `${p.cliente} · ${currency(p.total)}` } }));
  }

  return (
    <div className="space-y-6">
      {/* Nav + filtros */}
      <div className="space-y-3">
        {/* Fila 1: tabs de modo + botones acción */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs de modo fecha */}
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
            {(["dia", "semana", "mes", "rango"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === m ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
              >
                {m === "dia" ? "Día" : m === "semana" ? "Semana" : m === "mes" ? "Mes" : "Rango"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Rastreo — separado visualmente de las vistas de fecha */}
            <button
              onClick={() => setViewMode(viewMode === "rastreo" ? "dia" : "rastreo")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                viewMode === "rastreo"
                  ? "bg-[#CC2229] border-[#CC2229] text-white"
                  : "bg-[#1A1A1A] border-[#3A3A3A] text-gray-400 hover:text-white hover:border-[#CC2229]/60"
              }`}
            >
              <Search size={13} />
              Rastreo de viajes
            </button>
            <div className="w-px h-5 bg-[#3A3A3A]" />
            <button
              onClick={() => setExcelFullscreen(true)}
              title="Pantalla completa"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer"
            >
              <Expand size={13} />
              Expandir
            </button>
            <button
              onClick={() => filtered.length > 0 && exportXLSX(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
            >
              <Download size={13} />
              Excel
            </button>
            {/* Panel de trabajo del día */}
            {filtered.length > 0 && (
              <div className="flex items-center gap-1.5">
                {trabajoPendiente.sinAsignar > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 cursor-default" title="Pedidos sin chofer asignado">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <span className="text-[11px] font-semibold text-red-400 whitespace-nowrap">{trabajoPendiente.sinAsignar} sin asignar</span>
                  </div>
                )}
                {trabajoPendiente.enProceso > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 cursor-default" title="En proceso — faltan horarios de algún viaje">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <span className="text-[11px] font-semibold text-amber-400 whitespace-nowrap">{trabajoPendiente.enProceso} en proceso</span>
                  </div>
                )}
                {trabajoPendiente.porCerrar > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 cursor-default" title="Todos los viajes terminados — listos para marcar entregado">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-400 whitespace-nowrap">{trabajoPendiente.porCerrar} por cerrar</span>
                  </div>
                )}
                {trabajoPendiente.sinAsignar === 0 && trabajoPendiente.enProceso === 0 && trabajoPendiente.porCerrar === 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-400 whitespace-nowrap">Todo entregado</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fila 2: controles de fecha / búsqueda según modo */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "rastreo" && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={rastreoSearch}
                onChange={(e) => setRastreoSearch(e.target.value)}
                placeholder="Buscar folio, cliente, vendedor…"
                className="w-80 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          )}
          {viewMode !== "rango" && viewMode !== "rastreo" && (
            <>
              <button
                onClick={() => {
                  if (viewMode === "dia") setDiaActivo((d) => addDays(d, -1));
                  else if (viewMode === "semana") setDiaActivo((d) => addDays(d, -7));
                  else setDiaActivo((d) => addMonths(d, -1));
                }}
                className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>
              {viewMode === "dia" ? (
                <input
                  type="date"
                  value={diaActivo}
                  onChange={(e) => setDiaActivo(e.target.value)}
                  className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer"
                />
              ) : (
                <span className="text-sm text-white font-medium px-1 capitalize">
                  {periodLabel(viewMode, diaActivo, rangoInicio, rangoFin)}
                </span>
              )}
              <button
                onClick={() => {
                  if (viewMode === "dia") setDiaActivo((d) => addDays(d, 1));
                  else if (viewMode === "semana") setDiaActivo((d) => addDays(d, 7));
                  else setDiaActivo((d) => addMonths(d, 1));
                }}
                className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setDiaActivo(todayISO())}
                className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-xs text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer"
              >
                Hoy
              </button>
            </>
          )}
          {viewMode === "rango" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={rangoInicio}
                onChange={(e) => setRangoInicio(e.target.value)}
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer"
              />
              <span className="text-gray-600 text-sm">—</span>
              <input
                type="date"
                value={rangoFin}
                min={rangoInicio}
                onChange={(e) => setRangoFin(e.target.value)}
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer"
              />
            </div>
          )}
          {filtered.length > 0 && (
            <span className="text-xs text-gray-500 ml-1 capitalize">
              {viewMode !== "rango" && viewMode !== "dia" ? "" : ""}{filtered.length} programación{filtered.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={viewMode === "dia" ? "Viajes del día" : viewMode === "semana" ? "Viajes semana" : viewMode === "mes" ? "Viajes mes" : "Viajes rango"}
          value={String(filtered.length)}
          icon={CalendarDays}
          iconColor="text-[#CC2229]"
          subtitle={`${programaciones.length} total registradas`}
        />
        <KPICard
          title="Total m³"
          value={totalM3 > 0 ? `${totalM3.toLocaleString("es-MX")} m³` : "—"}
          icon={Clock}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          subtitle={totalM3Vacios > 0 ? `${totalM3Vacios} m³ vacíos` : undefined}
        />
        <KPICard
          title="Total facturado"
          value={totalFacturado > 0 ? `$${totalFacturado.toLocaleString("es-MX")}` : "—"}
          icon={Clock}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <KPICard
          title="Viajes pagados"
          value={`${totalPagado} / ${filtered.length}`}
          icon={Clock}
          iconColor={totalPagado === filtered.length && filtered.length > 0 ? "text-emerald-400" : "text-amber-400"}
          iconBg={totalPagado === filtered.length && filtered.length > 0 ? "bg-emerald-500/10" : "bg-amber-500/10"}
        />
      </div>

      {/* Vista Rastreo */}
      {viewMode === "rastreo" && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-500">
              {rastreoSearch ? "Sin resultados para esa búsqueda." : "Sin programaciones registradas."}
            </div>
          )}
          {(filtered as Programacion[]).map((prog) => {
            const isExpanded = expandedId === prog.id;
            const isMarking = markingId === prog.id;
            const isSaving = savingId === prog.id;
            const choferes = (prog.choferes ?? []) as ChoferEntry[];
            const isEntregado = prog.fase === "Entregado";

            const tieneChofer = choferes.length > 0;
            const tieneSalida = choferes.some((c) => c.horaSalida);
            const tieneLlegada = choferes.some((c) => c.horaLlegadaObra);
            const tieneDescarga = choferes.some((c) => c.horaInicioDescarga);
            const todosSalieron = tieneChofer && choferes.every((c) => c.horaSalidaObra);
            const faseActual = isEntregado ? "Entregado"
              : todosSalieron ? "Descargado"
              : tieneDescarga ? "Descargando"
              : tieneLlegada ? "En obra"
              : tieneSalida ? "En camino"
              : tieneChofer ? "Asignado"
              : "Pendiente";

            const faseBadgeStyle = ({
              "Entregado":   { bg: "#ECFDF5", text: "#059669", border: "#6EE7B7" },
              "Descargado":  { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
              "Descargando": { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA" },
              "En obra":     { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
              "En camino":   { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0" },
              "Asignado":    { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
              "Pendiente":   { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
            } as Record<string, { bg: string; text: string; border: string }>)[faseActual] ?? { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" };

            const stepsDone = ["Pendiente","Asignado","En camino","En obra","Descargando","Descargado","Entregado"].indexOf(faseActual);

            const parseMins = (t: string | null) => {
              if (!t || !t.includes(":")) return null;
              const [h, m] = t.split(":").map(Number); return h * 60 + m;
            };
            const dur = (a: string | null, b: string | null) => {
              const ma = parseMins(a), mb = parseMins(b);
              if (ma == null || mb == null || mb <= ma) return null;
              const d = mb - ma;
              return d < 60 ? `${d}m` : `${Math.floor(d / 60)}h${d % 60 > 0 ? ` ${d % 60}m` : ""}`;
            };

            return (
              <div key={prog.id} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                {/* ── Card header — always visible ── */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-red-600 tracking-wider">{prog.folio ?? "—"}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{ backgroundColor: faseBadgeStyle.bg, color: faseBadgeStyle.text, borderColor: faseBadgeStyle.border }}
                        >
                          {faseActual}
                        </span>
                        {prog.notasAcceso && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700">
                            Acceso especial
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-900 truncate">{prog.cliente}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        {prog.dia && <span>{new Date(prog.dia + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}</span>}
                        {prog.hora && <><span>·</span><span>Llegada <span className="font-medium text-gray-700">{prog.hora}</span></span></>}
                        {prog.m3Totales != null && <><span>·</span><span className="font-semibold text-gray-700">{prog.m3Totales} m³</span></>}
                        {prog.tdBom && <><span>·</span><span>{prog.tdBom}</span></>}
                        {prog.resistencia && <><span>·</span><span>{prog.resistencia}</span></>}
                        {prog.vendedor && <><span>·</span><span>{prog.vendedor}</span></>}
                      </div>
                    </div>
                    {prog.total != null && (
                      <p className="text-base font-bold text-gray-900 shrink-0">${prog.total.toLocaleString("es-MX")}</p>
                    )}
                  </div>

                  {/* Mini phase stepper */}
                  <div className="mt-3 flex items-center gap-0">
                    {["Creado","Asignado","En camino","En obra","Desc.","✓"].map((label, i) => {
                      return (
                        <div key={i} className="flex items-center flex-1">
                          <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: i < stepsDone ? "#CC2229" : "#E5E7EB" }}
                            />
                            <span className="text-[8px] text-gray-400 mt-0.5 text-center leading-tight">{label}</span>
                          </div>
                          {i < 5 && (
                            <div
                              className="flex-1 h-0.5 mx-0.5 rounded-full"
                              style={{ backgroundColor: i < stepsDone - 1 ? "#CC2229" : "#E5E7EB" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Inline expand: driver timelines ── */}
                {isExpanded && choferes.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                    {choferes.map((c, ci) => {
                      const steps: { label: string; time: string | null }[] = [
                        { label: "Salida planta", time: c.horaSalida || null },
                        { label: "Llegada obra",  time: c.horaLlegadaObra || null },
                        { label: "Inicio desc.",  time: c.horaInicioDescarga || null },
                        { label: "Fin desc.",     time: c.horaFinalDescarga || null },
                        { label: "Salida obra",   time: c.horaSalidaObra || null },
                      ];
                      return (
                        <div key={ci}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600">{ci + 1}</span>
                            <p className="text-xs font-semibold text-gray-800">{c.chofer || `Chofer ${ci + 1}`}</p>
                            {c.m3 != null && <span className="text-xs text-gray-500">· {c.m3} m³</span>}
                            {(c.cr || c.remision) && (
                              <span className="text-[10px] text-gray-400">
                                · {[c.cr && `CR:${c.cr}`, c.remision && `Rem:${c.remision}`].filter(Boolean).join(" ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start overflow-x-auto">
                            {steps.map((step, si) => (
                              <div key={si} className="flex items-start">
                                <div className="flex flex-col items-center w-20">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: step.time ? "#CC2229" : "#E5E7EB" }} />
                                  <p className="mt-1 font-mono text-xs font-bold" style={{ color: step.time ? "#111827" : "#D1D5DB" }}>{step.time ?? "—"}</p>
                                  <p className="text-[8px] text-gray-400 text-center leading-tight mt-0.5">{step.label}</p>
                                  {si > 0 && step.time && steps[si - 1].time && (
                                    <p className="text-[8px] font-semibold text-red-500 mt-0.5">+{dur(steps[si - 1].time, step.time)}</p>
                                  )}
                                </div>
                                {si < steps.length - 1 && (
                                  <div
                                    className="mt-1.5 w-4 h-0.5 rounded-full shrink-0"
                                    style={{ backgroundColor: step.time && steps[si + 1]?.time ? "#CC2229" : "#E5E7EB" }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {prog.notasAcceso && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-0.5">Acceso especial</p>
                        <p className="text-xs text-amber-800">{prog.notasAcceso}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Footer actions ── */}
                <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-50">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : (prog.id ?? null))}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? "▲ Ocultar viajes" : "▼ Ver viajes"}</span>
                    {choferes.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px]">{choferes.length}</span>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {isAdmin && prog.id && (
                      <button
                        onClick={() => handleSolicitarEliminar(prog)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-red-50"
                        title="Solicitar eliminación"
                      >
                        Eliminar
                      </button>
                    )}

                    <button
                      onClick={() => setTimelineProg(prog)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Ver detalle →
                    </button>

                    {!isEntregado && !isMarking && (
                      <button
                        onClick={() => { setMarkingId(prog.id ?? null); setMarkingNotas(""); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: "#059669" }}
                      >
                        ✓ Marcar entregado
                      </button>
                    )}
                    {isEntregado && (
                      <span className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700">
                        ✓ Entregado
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Inline "marcar entregado" form ── */}
                {isMarking && !isEntregado && (
                  <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-2">Confirmar entrega de {prog.folio}</p>
                    <textarea
                      value={markingNotas}
                      onChange={(e) => setMarkingNotas(e.target.value)}
                      placeholder="Notas (opcional — acceso especial, incidencias…)"
                      rows={2}
                      className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-gray-800 resize-none outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => { setMarkingId(null); setMarkingNotas(""); }}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleEntregarDirecto(prog, markingNotas)}
                        disabled={isSaving}
                        className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: "#059669" }}
                      >
                        {isSaving ? "Guardando…" : "Confirmar entrega"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Excel view */}
      {viewMode !== "rastreo" && !excelFullscreen && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <ExcelView
            rows={filtered as unknown as ExcelProg[]}
            onEdit={(p) => { setEditing(p as unknown as Programacion); setShowDrawer(true); }}
          />
        </div>
      )}

      {/* Timeline modal */}
      {timelineProg && (
        <TrackingModal
          prog={timelineProg}
          plantaActiva={plantaActiva}
          onClose={() => setTimelineProg(null)}
        />
      )}

      {/* Excel fullscreen overlay */}
      {excelFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#3A3A3A] shrink-0">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Tabla — Programación</span>
            <button
              onClick={() => setExcelFullscreen(false)}
              title="Salir de pantalla completa"
              className="p-1.5 rounded-lg bg-[#242424] border border-[#3A3A3A] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer"
            >
              <Shrink size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-[#242424]">
            <ExcelView
              rows={filtered as unknown as ExcelProg[]}
              onEdit={(p) => { setEditing(p as unknown as Programacion); setShowDrawer(true); }}
              fullscreen
            />
          </div>
        </div>
      )}

      <FormDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
        onDelete={isAdmin && editing ? () => handleSolicitarEliminar(editing) : undefined}
        initial={editing}
        dia={diaActivo}
        operadoresList={operadoresList}
        clientesList={clientesList}
        revolveList={revolveList}
        obrasData={obrasData}
      />

      {/* Modal: solicitud de autorización para eliminar */}
      {solicitudElim && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setSolicitudElim(null); setMotivoElim(""); }} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 bg-red-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Solicitar eliminación</p>
                <p className="text-xs text-gray-500">Requiere autorización de un supervisor</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Programación a eliminar</p>
                <p className="text-sm font-semibold text-gray-900">{solicitudElim.folio ?? solicitudElim.id} — {solicitudElim.cliente}</p>
                <p className="text-xs text-gray-500">{solicitudElim.dia} · {solicitudElim.hora}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Motivo de eliminación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoElim}
                  onChange={(e) => setMotivoElim(e.target.value)}
                  placeholder="Explica por qué se necesita eliminar esta programación..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-colors"
                />
              </div>
              <p className="text-xs text-gray-400">
                La solicitud será enviada a los supervisores autorizados. La eliminación se ejecutará solo si es aprobada.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => { setSolicitudElim(null); setMotivoElim(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarSolicitudEliminar}
                disabled={!motivoElim.trim() || enviandoSolicitud}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {enviandoSolicitud ? <Clock size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                {enviandoSolicitud ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
