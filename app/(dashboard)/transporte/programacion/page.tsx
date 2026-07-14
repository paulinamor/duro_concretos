"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Download, ExternalLink, Pencil, Plus, ReceiptText, Trash2, UserRound, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import ClienteCombobox from "@/components/ClienteCombobox";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Operador } from "@/lib/operadores";
import type { Cliente } from "@/lib/crmClientes";

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
  cxcId?: string;
  planta?: string;
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
  m3Vacios: string; precioM3: string; precioM3Bomba: string;
  factorBomba: string; aplicarFactorBomba: boolean;
  ltoAcelr: string; kiloFibra: string; m3Imper: string;
  aditivo: string; tuberiaExtra: string; permisosOC: string;
  recibo: string; credito: string; fact: string; pagado: string;
  montoPagado: string;
  metodoPago: string; fechaPago: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ViewMode = "dia" | "semana" | "mes" | "rango";

function todayISO() { return new Date().toISOString().slice(0, 10); }

function addDays(iso: string, d: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function addMonths(iso: string, m: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setMonth(dt.getMonth() + m);
  return dt.toISOString().slice(0, 10);
}

function weekRange(iso: string): [string, string] {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
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
    nv(p.m3Vacios) +
    nv(p.tuberiaExtra) +
    (n(String(p.tiempoExtraDescarga ?? "")) ?? 0);
  if (txm3 === 0 || p.m3Totales == null) return { totalXM3: null, total: null };
  return { totalXM3: txm3, total: txm3 * p.m3Totales + flatExtras };
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

function emptyForm(dia: string): FormState {
  return {
    dia, vendedor: "", diaHoraPedido: "", muestras: "",
    cliente: "", telefono: "", direccion: "", paraUso: "",
    hora: "", hsr: "", choferes: [emptyChofer()],
    tiempoExtraDescarga: "",
    extras: "", tdBom: "", resistencia: "", color: "", m3Vacios: "",
    precioM3: "", precioM3Bomba: "", factorBomba: "1.16", aplicarFactorBomba: false,
    ltoAcelr: "", kiloFibra: "", m3Imper: "",
    aditivo: "", tuberiaExtra: "", permisosOC: "",
    recibo: "", credito: "", fact: "", pagado: "", montoPagado: "", metodoPago: "", fechaPago: "",
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
    hora: p.hora, hsr: p.hsr, choferes,
    tiempoExtraDescarga: p.tiempoExtraDescarga,
    extras: p.extras, tdBom: p.tdBom, resistencia: p.resistencia, color: p.color,
    m3Vacios: p.m3Vacios != null ? String(p.m3Vacios) : "",
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
        "M3 TOTALES": r.m3Totales ?? "", "M3 VACÍOS": r.m3Vacios ?? "",
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
  operadoresList,
}: {
  entry: ChoferFormEntry;
  index: number;
  total: number;
  onChange: (updated: ChoferFormEntry) => void;
  onRemove: () => void;
  operadoresList: Pick<Operador, "id" | "nombre">[];
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
          <select value={entry.chofer} onChange={(e) => set("chofer", e.target.value)} className={inp}>
            <option value="">Sin asignar</option>
            {operadoresList.map((o) => (
              <option key={o.id} value={o.nombre}>{o.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>M3</label>
          <input type="number" step="0.5" min="0" value={entry.m3} onChange={(e) => set("m3", e.target.value)} placeholder="0.0" className={inp} onWheel={(e) => e.currentTarget.blur()} />
        </div>
        <div>
          <label className={lbl}>CR</label>
          <input type="text" value={entry.cr} onChange={(e) => set("cr", e.target.value)} placeholder="CR-01" className={inp} />
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

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, initial, dia, operadoresList, clientesList,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (p: Programacion) => Promise<void>;
  initial?: Programacion;
  dia: string;
  operadoresList: Pick<Operador, "id" | "nombre">[];
  clientesList: string[];
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(dia));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? formFromProg(initial) : emptyForm(dia));
  }, [open, initial, dia]);

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
    if (totalXM3Auto == null || m3TotalesAuto == null) return null;
    const flatExtras =
      (n(form.m3Vacios) ?? 0) +
      (n(form.tuberiaExtra) ?? 0) +
      (n(form.tiempoExtraDescarga) ?? 0);
    return totalXM3Auto * m3TotalesAuto + flatExtras;
  }, [totalXM3Auto, m3TotalesAuto, form.m3Vacios, form.tuberiaExtra, form.tiempoExtraDescarga]);

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
      await onSave({
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
      });
      onClose();
    } catch (err) {
      console.error("Error al guardar programación:", err);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al guardar. Verifica tu conexión e intenta de nuevo." } }));
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
            <h2 className="text-sm font-semibold text-gray-900">{initial ? "Editar programación" : "Nueva programación"}</h2>
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
              <div className="flex gap-2 items-center">
                {form.diaHoraPedido === "N/A" ? (
                  <div className={`${inp} flex-1 text-gray-400 bg-gray-50 cursor-default`}>N/A</div>
                ) : (
                  <input type="datetime-local" value={form.diaHoraPedido} onChange={(e) => set("diaHoraPedido", e.target.value)} className={`${inp} flex-1`} />
                )}
                <button
                  type="button"
                  onClick={() => set("diaHoraPedido", form.diaHoraPedido === "N/A" ? "" : "N/A")}
                  className={`shrink-0 px-2.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${form.diaHoraPedido === "N/A" ? "bg-gray-200 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                >
                  N/A
                </button>
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
              <label className={lbl}>Total $ <span className="text-emerald-600 normal-case font-normal">(Total x M3 × M3 totales + extras — auto)</span></label>
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
              <select value={form.pagado} onChange={(e) => set("pagado", e.target.value)} className={inp}>
                <option value="">—</option>
                <option value="Sí">Sí</option>
                <option value="No">No</option>
                <option value="Parcial">Parcial</option>
              </select>
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
            <div>
              <label className={lbl}>Método de pago</label>
              <select value={form.metodoPago} onChange={(e) => set("metodoPago", e.target.value)} className={inp}>
                <option value="">—</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Cheque">Cheque</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha de pago</label>
              <input type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} className={inp} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
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
    </div>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

function TableRow({ p, onEdit, onDelete, onCreateCxC, showFecha }: { p: Programacion; onEdit: () => void; onDelete: () => void; onCreateCxC: (p: Programacion) => void; showFecha?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const pagadoColor = p.pagado === "Sí"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : p.pagado === "Parcial"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : p.pagado === "No"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-white/5 text-slate-500 border-white/10";

  const choferesList = p.choferes?.filter((c) => c.chofer) ?? [];

  return (
    <>
      <tr
        className="cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {showFecha && (
          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap font-mono">{p.dia || "—"}</td>
        )}
        <td className="px-4 py-3 text-white font-mono text-sm font-semibold whitespace-nowrap">{p.hora || "—"}</td>
        <td className="px-4 py-3 max-w-[160px]">
          {choferesList.length === 0 ? (
            <span className="text-gray-600 text-sm">—</span>
          ) : choferesList.length === 1 ? (
            <span className="text-gray-200 text-sm">{choferesList[0].chofer}</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-gray-200 text-xs truncate">{choferesList[0].chofer}</span>
              <span className="text-gray-500 text-[10px]">+{choferesList.length - 1} más</span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
          {choferesList.length === 1 ? choferesList[0].cr || "—"
            : choferesList.length > 1 ? choferesList.map((c) => c.cr).filter(Boolean).join(", ") || "—"
            : "—"}
        </td>
        <td className="px-4 py-3 max-w-[180px]">
          <p className="text-gray-100 text-sm font-medium truncate">{p.cliente}</p>
          {p.direccion && <p className="text-gray-600 text-xs truncate">{p.direccion}</p>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {p.m3Totales != null
            ? <span className="text-blue-300 font-semibold text-sm">{p.m3Totales}<span className="text-gray-600 text-xs ml-1">m³</span></span>
            : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
          {choferesList.length === 1 ? choferesList[0].remision || "—"
            : choferesList.length > 1 ? choferesList.map((c) => c.remision).filter(Boolean).join(", ") || "—"
            : "—"}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {p.resistencia
            ? <span className="rounded-full bg-[#CC2229]/15 border border-[#CC2229]/30 px-2 py-0.5 text-[11px] font-semibold text-[#CC2229]">{p.resistencia}</span>
            : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-white font-semibold text-sm whitespace-nowrap tabular-nums">{currency(p.total)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {p.pagado
            ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pagadoColor}`}>{p.pagado}</span>
            : <span className="text-gray-600 text-xs">—</span>}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors" aria-label="Editar">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors" aria-label="Eliminar">
              <Trash2 size={13} />
            </button>
            {expanded ? <ChevronUp size={13} className="text-gray-600 ml-1" /> : <ChevronDown size={13} className="text-gray-600 ml-1" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={showFecha ? 11 : 10} className="bg-[#1A1A1A]" style={{ padding: "16px 20px", borderTop: "2px solid #CC2229", borderBottom: "1px solid #e2e8f0", maxWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflow: "hidden" }}>

              {/* Tarjetas de choferes */}
              {choferesList.length > 0 && (
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", marginBottom: "10px" }}>Choferes</p>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {choferesList.map((c) => (
                      <div key={c.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", minWidth: "160px", flex: "1 1 160px", maxWidth: "260px", display: "flex", flexDirection: "column", gap: "5px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>{c.chofer}</p>
                        {[
                          { label: "M3",           value: c.m3 != null ? `${c.m3} m³` : "", color: "#2563eb", bold: true },
                          { label: "CR",           value: c.cr,                              color: "#1e293b", bold: false },
                          { label: "Remisión",     value: c.remision,                        color: "#1e293b", bold: false },
                          { label: "Sello",        value: c.numSello,                        color: "#1e293b", bold: false },
                          { label: "Salida",       value: c.horaSalida,                      color: "#1e293b", bold: false },
                          { label: "Llegada obra", value: c.horaLlegadaObra,                 color: "#1e293b", bold: false },
                          { label: "Inicio desc.", value: c.horaInicioDescarga,               color: "#1e293b", bold: false },
                          { label: "Final desc.",  value: c.horaFinalDescarga,                color: "#1e293b", bold: false },
                          { label: "Salida obra",  value: c.horaSalidaObra,                  color: "#1e293b", bold: false },
                          { label: "T. descarga",  value: c.tiempoDescarga,                  color: "#059669", bold: true },
                        ].filter((f) => f.value).map(({ label, value, color, bold }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <span style={{ fontSize: "10px", color: "#64748b", flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: "11px", color, fontFamily: "monospace", fontWeight: bold ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(value ?? "")}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalles en 3 columnas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>

                {/* Concreto */}
                {[p.hsr, p.tiempoExtraDescarga, p.m3Vacios, p.tdBom, p.color, p.resistencia, p.extras, p.paraUso, p.muestras].some(Boolean) && (
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "8px", paddingBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>Concreto</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {[
                        { label: "Resistencia",   value: p.resistencia },
                        { label: "T/D BOM",       value: p.tdBom },
                        { label: "Color",         value: p.color },
                        { label: "M3 vacíos",     value: p.m3Vacios != null ? `${p.m3Vacios} m³` : "" },
                        { label: "HSR",           value: p.hsr },
                        { label: "T. extra desc.",value: p.tiempoExtraDescarga },
                        { label: "Extras",        value: p.extras },
                        { label: "Para uso",      value: p.paraUso },
                        { label: "Muestras",      value: p.muestras },
                      ].filter((f) => f.value).map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <span style={{ fontSize: "10px", color: "#64748b", flexShrink: 0 }}>{label}</span>
                          <span style={{ fontSize: "11px", color: "#1e293b", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Costos */}
                {[p.precioM3, p.precioM3Bomba, p.totalXM3, p.ltoAcelr, p.kiloFibra, p.m3Imper, p.tuberiaExtra, p.permisosOC, p.aditivo].some((v) => v != null && v !== "") && (
                  <div>
                    <p style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "8px", paddingBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>Costos</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {[
                        { label: "Precio M3",     value: p.precioM3 != null ? currency(p.precioM3) : "" },
                        { label: "$ M3 Bomba",    value: p.precioM3Bomba != null ? currency(p.precioM3Bomba) : "" },
                        { label: "Total x M3",    value: p.totalXM3 != null ? currency(p.totalXM3) : "" },
                        { label: "$ Lto Acelr",   value: p.ltoAcelr != null ? currency(p.ltoAcelr) : "" },
                        { label: "$ Kilo Fibra",  value: p.kiloFibra != null ? currency(p.kiloFibra) : "" },
                        { label: "$ M3 Imper",    value: p.m3Imper != null ? currency(p.m3Imper) : "" },
                        { label: "Tubería extra", value: p.tuberiaExtra != null ? currency(p.tuberiaExtra) : "" },
                        { label: "Permisos O/C",  value: p.permisosOC != null ? currency(p.permisosOC) : "" },
                        { label: "Aditivo",       value: p.aditivo },
                      ].filter((f) => f.value).map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <span style={{ fontSize: "10px", color: "#64748b", flexShrink: 0 }}>{label}</span>
                          <span style={{ fontSize: "11px", color: "#1e293b", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pago y pedido */}
                <div>
                  <p style={{ fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "#64748b", marginBottom: "8px", paddingBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>Pago y pedido</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {[
                      { label: "Vendedor",         value: p.vendedor },
                      { label: "Día y hora pedido",value: p.diaHoraPedido ? p.diaHoraPedido.replace("T", " ") : "" },
                      { label: "Teléfono",         value: p.telefono },
                      { label: "Recibo",           value: p.recibo },
                      { label: "Fact.",            value: p.fact },
                      { label: "Crédito",          value: p.credito },
                      { label: "Método pago",      value: p.metodoPago },
                      { label: "Monto pagado",     value: p.pagado === "Parcial" && p.montoPagado != null ? `$${p.montoPagado.toLocaleString("es-MX")}` : "" },
                      { label: "Fecha pago",       value: p.fechaPago },
                    ].filter((f) => f.value).map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>{label}</span>
                        <span style={{ fontSize: "11px", color: "#1e293b", fontFamily: "monospace" }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* CxC link / action */}
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
                    {p.cxcId ? (
                      <a
                        href="/finanzas/cxc"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        <ReceiptText size={12} />
                        En CxC
                        <ExternalLink size={10} />
                      </a>
                    ) : p.total && p.pagado !== "Sí" ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCreateCxC(p); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-blue-400 hover:border-blue-400/70 hover:bg-blue-500/20 transition-colors cursor-pointer"
                      >
                        <ReceiptText size={12} />
                        Enviar a CxC
                      </button>
                    ) : null}
                  </div>
                </div>

              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramacionPage() {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);
  const [clientesList, setClientesList] = useState<string[]>([]);
  const [clientesSet, setClientesSet] = useState<Set<string>>(new Set());
  const [diaActivo, setDiaActivo] = useState(todayISO);
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const [rangoInicio, setRangoInicio] = useState(todayISO);
  const [rangoFin, setRangoFin] = useState(todayISO);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Programacion | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Programacion>(COLLECTIONS.programaciones),
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
    ]).then(([progs, ops, clientes]) => {
      setProgramaciones(filterByPlanta(progs));
      setOperadoresList(ops.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre })));

      // Migrate existing records with incorrect totalXM3 / total values
      const toFix = progs.filter((p) => {
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

      // Build unique client list from both sources, deduplicated
      const fromProgs = progs.map((p) => p.cliente).filter(Boolean);
      const fromClientes = clientes.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean));
      const allNames = Array.from(new Set([...fromClientes, ...fromProgs])).sort();
      setClientesList(allNames);

      // Keep a normalized set of existing clientes for quick lookup
      const existingSet = new Set(clientes.map((c) => c.razonSocial.toLowerCase().trim()));
      setClientesSet(existingSet);

      // Migrate clients from programaciones that don't exist yet in clientes collection
      const today = new Date().toISOString().slice(0, 10);
      const nuevos = Array.from(new Set(fromProgs.map((n) => n.trim()).filter(Boolean)))
        .filter((nombre) => !existingSet.has(nombre.toLowerCase()));
      if (nuevos.length > 0) {
        Promise.all(
          nuevos.map((nombre) => {
            const id = `CL-prog-${nombre.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}-${Date.now()}`;
            return upsertDocument(COLLECTIONS.clientes, id, {
              razonSocial: nombre,
              nombreComercial: nombre,
              rfc: "", domicilio: "", colonia: "", municipio: "", estado: "", cp: "",
              contacto: "", cargo: "", telefono: "", email: "",
              tipoCliente: "Particular", vendedorAsignado: "",
              limiteCredito: 0, saldoPendiente: 0, diasCredito: 0,
              ultimaCompra: today, totalComprasAnio: 0, m3Acumulados: 0,
              estatus: "Activo", calificacion: "B", fechaAlta: today, notas: "",
            });
          })
        ).catch((err) => console.error("Error migrando clientes:", err));
      }
    }).catch((err) => {
      console.error("Error cargando programaciones:", err);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list: Programacion[];
    if (viewMode === "dia") {
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
      const dc = (a.dia ?? "").localeCompare(b.dia ?? "");
      return dc !== 0 ? dc : (a.hora ?? "").localeCompare(b.hora ?? "");
    });
  }, [programaciones, diaActivo, viewMode, rangoInicio, rangoFin]);

  const totalM3 = filtered.reduce((s, p) => s + (p.m3Totales ?? 0), 0);
  const totalFacturado = filtered.reduce((s, p) => s + (p.total ?? 0), 0);
  const totalM3Vacios = filtered.reduce((s, p) => s + (p.m3Vacios ?? 0), 0);
  const totalPagado = filtered.filter((p) => p.pagado === "Sí").length;

  async function handleSave(p: Programacion) {
    const id = p.id!;
    const { id: _id, ...data } = p;
    await upsertDocument(COLLECTIONS.programaciones, id, withPlantaTag(data));
    setProgramaciones((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const updated = { ...p, id };
      return idx >= 0 ? prev.map((x, i) => (i === idx ? updated : x)) : [updated, ...prev];
    });

    // Auto-registrar cliente en base de clientes si no existe
    const nombreCliente = p.cliente.trim();
    if (nombreCliente && !clientesSet.has(nombreCliente.toLowerCase())) {
      const clienteId = `CL-${Date.now()}`;
      const today = new Date().toISOString().slice(0, 10);
      const nuevoCliente: Omit<Cliente, "id"> = {
        razonSocial: nombreCliente,
        nombreComercial: nombreCliente,
        rfc: "",
        domicilio: p.direccion ?? "",
        colonia: "",
        municipio: "",
        estado: "",
        cp: "",
        contacto: "",
        cargo: "",
        telefono: p.telefono ?? "",
        email: "",
        tipoCliente: "Particular",
        vendedorAsignado: p.vendedor ?? "",
        limiteCredito: 0,
        saldoPendiente: 0,
        diasCredito: 0,
        ultimaCompra: today,
        totalComprasAnio: 0,
        m3Acumulados: 0,
        estatus: "Activo",
        calificacion: "B",
        fechaAlta: today,
        notas: "",
      };
      await upsertDocument(COLLECTIONS.clientes, clienteId, nuevoCliente);
      setClientesSet((prev) => new Set([...prev, nombreCliente.toLowerCase()]));
      setClientesList((prev) => Array.from(new Set([...prev, nombreCliente])).sort());
    }
  }

  async function handleDelete(id: string) {
    setProgramaciones((prev) => prev.filter((p) => p.id !== id));
    await deleteDocument(COLLECTIONS.programaciones, id);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Programación eliminada." } }));
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
          {/* Tabs de modo */}
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
            {(["dia", "semana", "mes", "rango"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer capitalize ${viewMode === m ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
              >
                {m === "dia" ? "Día" : m === "semana" ? "Semana" : m === "mes" ? "Mes" : "Rango"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => filtered.length > 0 && exportXLSX(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
            >
              <Download size={13} />
              Excel
            </button>
            <button
              onClick={() => { setEditing(undefined); setShowDrawer(true); }}
              className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20"
            >
              <Plus size={15} />
              Nueva programación
            </button>
          </div>
        </div>

        {/* Fila 2: controles de fecha según modo */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== "rango" && (
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

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#3A3A3A] flex items-center justify-between">
          <p className="text-sm font-semibold text-white">
            {filtered.length > 0 ? `${filtered.length} programación${filtered.length !== 1 ? "es" : ""}` : "Sin programaciones para este período"}
          </p>
          <p className="text-xs text-gray-500 capitalize">{periodLabel(viewMode, diaActivo, rangoInicio, rangoFin)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#1A1A1A]">
              <tr className="bg-[#1A1A1A]">
                {[...(viewMode !== "dia" ? ["Fecha"] : []), "Hora", "Chofer", "CR", "Cliente", "M3 totales", "Remisión", "Resistencia", "Total", "Pagado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {loading ? (
                <tr><td colSpan={viewMode !== "dia" ? 11 : 10} className="px-4 py-12 text-center text-sm text-gray-600">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={viewMode !== "dia" ? 11 : 10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-[#1A1A1A] flex items-center justify-center">
                        <CalendarDays size={22} className="text-gray-600" />
                      </div>
                      <p className="text-sm text-gray-500">Sin programaciones para este período</p>
                      <button
                        onClick={() => { setEditing(undefined); setShowDrawer(true); }}
                        className="text-xs text-[#CC2229] hover:underline"
                      >
                        Agregar primera programación
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((p) => (
                <TableRow
                  key={p.id}
                  p={p}
                  showFecha={viewMode !== "dia"}
                  onEdit={() => { setEditing(p); setShowDrawer(true); }}
                  onDelete={() => p.id && handleDelete(p.id)}
                  onCreateCxC={handleCreateCxC}
                />
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs text-gray-600">
            <span>{filtered.length} viaje{filtered.length !== 1 ? "s" : ""} · {totalM3.toLocaleString("es-MX")} m³ totales</span>
            {totalFacturado > 0 && <span className="font-semibold text-white">{currency(totalFacturado)}</span>}
          </div>
        )}
      </div>

      <FormDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
        initial={editing}
        dia={diaActivo}
        operadoresList={operadoresList}
        clientesList={clientesList}
      />
    </div>
  );
}
