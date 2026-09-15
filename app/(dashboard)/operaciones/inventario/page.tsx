"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpToLine,
  BarChart2, ChevronDown, ChevronUp, Clock, Download, Edit2,
  FlaskConical, Package, Pencil, Plus, Search, Trash2, X,
  Layers, TrendingDown, CheckCircle2,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import ClienteCombobox from "@/components/ClienteCombobox";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, getActivePlanta, getStoredSession } from "@/lib/auth";
import { todayCST, currentMonthCST } from "@/lib/dateUtils";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Remision {
  id?: string;
  fecha: string; noRemision: string; cliente: string; metros: number; mezcla: string;
  cr: number | null; operador: string; cemento: number | null; grava: number | null;
  arena4: number | null; arena5: number | null; agua: number | null; aditivo: number | null;
  acelerante: string; imper: string; fibra: number | null; color: string; ligsthone: string;
  planta?: string;
}
interface EntradaMaterial {
  id?: string;
  fecha: string; material: string; cantidad: number; unidad: string;
  tipo: "entrada" | "salida"; proveedor: string; noFactura: string; observaciones: string;
  categoria: "inventario" | "almacen"; planta?: string;
}
interface ExistenciaInicial {
  id?: string; periodo: string;
  cemento: number; grava: number; arena4: number; arena5: number; aditivo: number;
  hr25: number; imper: number; costalFibra: number; colorCubetas: number;
  almacenMateriales?: Record<string, number>; planta?: string;
}

type MatKey = "cemento" | "grava" | "arena4" | "arena5" | "aditivo" | "hr25" | "imper" | "costalFibra" | "colorCubetas";

interface FormState {
  fecha: string; noRemision: string; cliente: string; metros: string; mezcla: string;
  cr: string; operador: string; cemento: string; grava: string; arena4: string;
  arena5: string; agua: string; aditivo: string; acelerante: string; imper: string;
  fibra: string; color: string; ligsthone: string; planta: string;
}
interface EntradaFormState {
  fecha: string; categoria: "inventario" | "almacen"; material: string;
  tipo: "entrada" | "salida"; cantidad: string; unidad: string;
  proveedor: string; noFactura: string; observaciones: string;
}
type MovRow =
  | { _source: "manual"; data: EntradaMaterial }
  | { _source: "remision"; data: Remision }
  | { _source: "existencia"; material: MatKey; label: string; cantidad: number; unidad: string; fecha: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const INVENTARIO_MATERIALES: {
  key: MatKey; label: string; unidad: string; remKey: keyof Remision;
  color: string; bg: string; dot: string;
}[] = [
  { key: "cemento",      label: "Cemento",       unidad: "kg",       remKey: "cemento",    color: "text-slate-300",  bg: "bg-slate-500/10",  dot: "bg-slate-400"  },
  { key: "grava",        label: "Grava",          unidad: "kg",       remKey: "grava",      color: "text-amber-300",  bg: "bg-amber-500/10",  dot: "bg-amber-400"  },
  { key: "arena4",       label: "Arena 4",        unidad: "kg",       remKey: "arena4",     color: "text-yellow-300", bg: "bg-yellow-500/10", dot: "bg-yellow-400" },
  { key: "arena5",       label: "Arena 5",        unidad: "kg",       remKey: "arena5",     color: "text-orange-300", bg: "bg-orange-500/10", dot: "bg-orange-400" },
  { key: "aditivo",      label: "Aditivo",        unidad: "L",        remKey: "aditivo",    color: "text-blue-300",   bg: "bg-blue-500/10",   dot: "bg-blue-400"   },
  { key: "hr25",         label: "HR25",           unidad: "",         remKey: "acelerante", color: "text-purple-300", bg: "bg-purple-500/10", dot: "bg-purple-400" },
  { key: "imper",        label: "Impermeabilizante", unidad: "",      remKey: "imper",      color: "text-cyan-300",   bg: "bg-cyan-500/10",   dot: "bg-cyan-400"   },
  { key: "costalFibra",  label: "Fibra",          unidad: "costales", remKey: "fibra",      color: "text-emerald-300",bg: "bg-emerald-500/10",dot: "bg-emerald-400"},
  { key: "colorCubetas", label: "Color / Cubetas",unidad: "pzas",     remKey: "color",      color: "text-pink-300",   bg: "bg-pink-500/10",   dot: "bg-pink-400"   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayISO = todayCST;
function currentPeriod() { return currentMonthCST(); }
function isoToDisplay(iso: string) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function displayToISO(display: string) { const [d, m, y] = display.split("/"); return `${y}-${m}-${d}`; }
function inPeriod(fecha: string, periodo: string) {
  if (!fecha?.includes("/")) return false;
  return displayToISO(fecha).startsWith(periodo);
}
function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}
function n(v: string): number | null { const p = parseFloat(v); return isNaN(p) ? null : p; }
function num(v: string): number { return parseFloat(v) || 0; }
function fmt(v: number): string {
  if (v === 0) return "0";
  return v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}
function adjMonth(p: string, delta: number): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function exportXLSX(rows: Remision[]) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const data = rows.map((r) => ({
    "FECHA": r.fecha, "REMISION": r.noRemision, "CLIENTE": r.cliente,
    "METROS": r.metros, "CONCRETO": r.mezcla, "CR": r.cr ?? "",
    "OPERADOR": r.operador, "CEMENTO": r.cemento ?? "", "GRAVA": r.grava ?? "",
    "ARENA 4": r.arena4 ?? "", "ARENA 5": r.arena5 ?? "", "AGUA": r.agua ?? "",
    "ADITIVO": r.aditivo ?? "", "ACELERANTE": r.acelerante, "IMPER": r.imper,
    "FIBRA": r.fibra ?? "", "COLOR": r.color, "LIGSTHONE": r.ligsthone,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Remisiones");
  XLSX.writeFile(wb, "remisiones.xlsx");
}

const SUPERADMIN = "leonardo@lpsoft.mx";
const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── Material Card ────────────────────────────────────────────────────────────

interface StockRow {
  key: MatKey; label: string; unidad: string; dot: string;
  inicial: number; entradas: number; consumo: number; final: number;
  estado: "deficit" | "bajo" | "ok"; diasRestantes: number | null;
}

function MaterialCard({ row }: { row: StockRow }) {
  const { label, unidad, dot, inicial, entradas, consumo, final, estado, diasRestantes } = row;
  const total = Math.max(inicial + entradas, 1);
  const pct = inicial === 0 ? 0 : Math.max(0, Math.min(100, (final / total) * 100));
  const hasData = inicial > 0 || consumo > 0 || entradas > 0;

  const barColor = final < 0
    ? "bg-red-500"
    : pct < 15
    ? "bg-amber-400"
    : pct < 40
    ? "bg-sky-400"
    : "bg-emerald-500";

  const borderColor = final < 0
    ? "border-red-200 bg-red-50"
    : estado === "bajo"
    ? "border-amber-200 bg-amber-50/40"
    : "border-gray-200 bg-white";

  return (
    <div className={`flex flex-col gap-0 rounded-2xl border overflow-hidden transition-colors shadow-[0_1px_6px_rgba(15,23,42,0.06)] ${borderColor}`}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 truncate">{label}</p>
            {unidad && <p className="text-[10px] text-gray-400 mt-0.5">{unidad}</p>}
          </div>
        </div>
        {final < 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">
            <AlertTriangle size={9} /> Déficit
          </span>
        )}
        {final >= 0 && estado === "bajo" && hasData && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
            <TrendingDown size={9} /> Stock bajo
          </span>
        )}
        {final >= 0 && estado === "ok" && hasData && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <CheckCircle2 size={9} /> OK
          </span>
        )}
      </div>

      {/* Main stock number */}
      <div className="px-5 pb-3">
        <p className={`text-3xl font-bold font-mono tabular-nums leading-none ${final < 0 ? "text-red-600" : hasData ? "text-gray-900" : "text-gray-400"}`}>
          {final < 0 ? `−${fmt(Math.abs(final))}` : fmt(final)}
        </p>
        {!hasData && <p className="text-xs text-gray-400 mt-1.5">Sin datos en el período</p>}
      </div>

      {/* Progress bar */}
      {hasData && inicial > 0 && (
        <div className="px-5 pb-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-gray-400">{pct.toFixed(0)}% disponible</p>
            {diasRestantes !== null && final > 0 && (
              <p className={`flex items-center gap-1 text-[10px] font-medium ${diasRestantes < 7 ? "text-amber-600" : "text-gray-400"}`}>
                <Clock size={9} /> ~{diasRestantes} días
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sub numbers */}
      <div className="grid grid-cols-3 border-t border-gray-100 bg-gray-50">
        {[
          { label: "Inicial", value: fmt(inicial), color: "text-gray-600" },
          { label: "Consumo", value: consumo > 0 ? `−${fmt(consumo)}` : "—", color: consumo > 0 ? "text-orange-500" : "text-gray-300" },
          { label: "Entradas", value: entradas > 0 ? `+${fmt(entradas)}` : "—", color: entradas > 0 ? "text-emerald-600" : "text-gray-300" },
        ].map(({ label: l, value, color }) => (
          <div key={l} className="px-3.5 py-3 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{l}</p>
            <p className={`text-[11px] font-mono font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RemisionDrawer ───────────────────────────────────────────────────────────

function RemisionDrawer({ open, onClose, onSave, initial, clientes, operadores, nextRemision, defaultPlanta }: {
  open: boolean; onClose: () => void; onSave: (r: Remision) => Promise<void>;
  initial?: Remision;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  nextRemision: string;
  defaultPlanta: "Allende" | "Pesquería";
}) {
  const emptyForm = (): FormState => ({
    fecha: todayISO(), noRemision: "", cliente: "", metros: "", mezcla: "",
    cr: "", operador: "", cemento: "", grava: "", arena4: "", arena5: "",
    agua: "", aditivo: "", acelerante: "", imper: "", fibra: "", color: "", ligsthone: "",
    planta: defaultPlanta,
  });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fecha: initial.fecha ? displayToISO(initial.fecha) : todayISO(),
        noRemision: initial.noRemision, cliente: initial.cliente,
        metros: String(initial.metros), mezcla: initial.mezcla,
        cr: initial.cr != null ? String(initial.cr) : "", operador: initial.operador,
        cemento: initial.cemento != null ? String(initial.cemento) : "",
        grava: initial.grava != null ? String(initial.grava) : "",
        arena4: initial.arena4 != null ? String(initial.arena4) : "",
        arena5: initial.arena5 != null ? String(initial.arena5) : "",
        agua: initial.agua != null ? String(initial.agua) : "",
        aditivo: initial.aditivo != null ? String(initial.aditivo) : "",
        acelerante: initial.acelerante, imper: initial.imper,
        fibra: initial.fibra != null ? String(initial.fibra) : "",
        color: initial.color, ligsthone: initial.ligsthone,
        planta: initial.planta ?? defaultPlanta,
      });
    } else {
      setForm({ ...emptyForm(), noRemision: nextRemision });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, nextRemision]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.noRemision.trim() || !form.metros) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id, fecha: isoToDisplay(form.fecha),
        noRemision: form.noRemision.trim(), cliente: form.cliente.trim(),
        metros: parseFloat(form.metros) || 0, mezcla: form.mezcla.trim(),
        cr: n(form.cr), operador: form.operador.trim(),
        cemento: n(form.cemento), grava: n(form.grava), arena4: n(form.arena4),
        arena5: n(form.arena5), agua: n(form.agua), aditivo: n(form.aditivo),
        acelerante: form.acelerante.trim(), imper: form.imper.trim(),
        fibra: n(form.fibra), color: form.color.trim(), ligsthone: form.ligsthone.trim(),
        planta: form.planta || defaultPlanta,
      });
      onClose();
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]"><FlaskConical size={18} /></div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{initial ? "Editar remisión" : "Nueva remisión"}</h2>
            <p className="text-xs text-gray-500">Despacho de concreto · {form.planta}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fecha <span className="text-[#CC2229]">*</span></label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label><input type="text" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value)} placeholder="18945" className={inp} /></div>
            <div className="col-span-2">
              <label className={lbl}>Planta</label>
              <div className="flex gap-2">
                {(["Allende", "Pesquería"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => set("planta", p)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${form.planta === p ? "bg-[#CC2229] border-[#CC2229] text-white" : "bg-white border-gray-200 text-gray-500 hover:border-[#CC2229]/40"}`}>{p}</button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <ClienteCombobox label="Cliente" value={form.cliente} onChange={(v) => set("cliente", v)} options={clientes.map((c) => c.nombreComercial || c.razonSocial)} placeholder="Buscar o escribir cliente…" />
            </div>
            <div><label className={lbl}>Metros m³ <span className="text-[#CC2229]">*</span></label><input type="number" step="0.5" min="0" value={form.metros} onChange={(e) => set("metros", e.target.value)} placeholder="7.0" className={inp} /></div>
            <div><label className={lbl}>Mezcla</label><input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="250-20-14" className={inp} /></div>
            <div><label className={lbl}>CR</label><input type="number" value={form.cr} onChange={(e) => set("cr", e.target.value)} placeholder="350" className={inp} /></div>
            <div><ClienteCombobox label="Operador" value={form.operador} onChange={(v) => set("operador", v)} options={operadores.map((o) => o.nombre)} placeholder="Buscar o escribir…" /></div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Materiales base</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              {([{ key: "cemento", label: "Cemento (kg)" }, { key: "grava", label: "Grava (kg)" }, { key: "arena4", label: "Arena 4 (kg)" }, { key: "arena5", label: "Arena 5 (kg)" }, { key: "agua", label: "Agua (L)" }, { key: "aditivo", label: "Aditivo" }] as const).map(({ key, label }) => (
                <div key={key}><label className={lbl}>{label}</label><input type="number" step="0.001" min="0" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0" className={inp} /></div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Aditivos especiales</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Acelerante (AFA)</label><input type="text" value={form.acelerante} onChange={(e) => set("acelerante", e.target.value)} placeholder="—" className={inp} /></div>
              <div><label className={lbl}>Impermeabilizante</label><input type="text" value={form.imper} onChange={(e) => set("imper", e.target.value)} placeholder="—" className={inp} /></div>
              <div><label className={lbl}>Fibra (kg)</label><input type="number" step="0.001" min="0" value={form.fibra} onChange={(e) => set("fibra", e.target.value)} placeholder="—" className={inp} /></div>
              <div><label className={lbl}>Color</label><input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="—" className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Ligsthone</label><input type="text" value={form.ligsthone} onChange={(e) => set("ligsthone", e.target.value)} placeholder="—" className={inp} /></div>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.noRemision.trim() || !form.metros} className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : "Guardar remisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EntradaDrawer ────────────────────────────────────────────────────────────

function EntradaDrawer({ open, onClose, onSave }: {
  open: boolean; onClose: () => void; onSave: (e: EntradaMaterial) => Promise<void>;
}) {
  const emptyForm = (): EntradaFormState => ({ fecha: todayISO(), categoria: "inventario", material: "", tipo: "entrada", cantidad: "", unidad: "", proveedor: "", noFactura: "", observaciones: "" });
  const [form, setForm] = useState<EntradaFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(emptyForm()); }, [open]);
  const set = (k: keyof EntradaFormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (form.categoria === "inventario" && form.material) {
      const mat = INVENTARIO_MATERIALES.find((m) => m.key === form.material);
      if (mat) setForm((p) => ({ ...p, unidad: mat.unidad }));
    }
  }, [form.material, form.categoria]);

  const handleSave = async () => {
    if (!form.material.trim() || !form.cantidad) return;
    setSaving(true);
    try {
      await onSave({
        fecha: isoToDisplay(form.fecha), material: form.material.trim(),
        cantidad: num(form.cantidad), unidad: form.unidad.trim(),
        tipo: form.tipo, proveedor: form.proveedor.trim(),
        noFactura: form.noFactura.trim(), observaciones: form.observaciones.trim(),
        categoria: form.categoria,
      });
      onClose();
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><ArrowDownToLine size={18} /></div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Registrar entrada de material</h2>
            <p className="text-xs text-gray-500">Recepción de proveedor o ajuste</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={lbl}>Tipo de registro</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["inventario", "almacen"] as const).map((c) => (
                <button key={c} type="button" onClick={() => { set("categoria", c); set("material", ""); set("unidad", ""); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${form.categoria === c ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {c === "inventario" ? "Producción" : "Almacén"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Movimiento</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["entrada", "salida"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("tipo", t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${form.tipo === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t === "entrada" ? "↓ Entrada" : "↑ Salida / Ajuste"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Material <span className="text-[#CC2229]">*</span></label>
              {form.categoria === "inventario" ? (
                <AppSelect value={form.material} onChange={(e) => set("material", e.target.value)}>
                  <option value="">Seleccionar material…</option>
                  {INVENTARIO_MATERIALES.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unidad ? ` (${m.unidad})` : ""}</option>)}
                </AppSelect>
              ) : (
                <input type="text" value={form.material} onChange={(e) => set("material", e.target.value)} placeholder="Ej: Diesel, Lubricante…" className={inp} />
              )}
            </div>
            <div><label className={lbl}>Cantidad <span className="text-[#CC2229]">*</span></label><input type="number" step="0.001" min="0" value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} placeholder="0" className={inp} /></div>
            <div><label className={lbl}>Unidad</label><input type="text" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="kg, L, ton…" className={inp} /></div>
            <div><label className={lbl}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>No. Factura</label><input type="text" value={form.noFactura} onChange={(e) => set("noFactura", e.target.value)} placeholder="—" className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Proveedor</label><input type="text" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Nombre del proveedor" className={inp} /></div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.material.trim() || !form.cantidad} className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-60 cursor-pointer">
            {saving ? "Guardando…" : "Registrar entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExistenciaModal ──────────────────────────────────────────────────────────

function ExistenciaModal({ open, onClose, periodo, planta, current, onSave }: {
  open: boolean; onClose: () => void; periodo: string; planta: string;
  current: ExistenciaInicial | null; onSave: (e: Omit<ExistenciaInicial, "id">) => Promise<void>;
}) {
  const emptyValues = (): Record<MatKey, string> => ({ cemento: "", grava: "", arena4: "", arena5: "", aditivo: "", hr25: "", imper: "", costalFibra: "", colorCubetas: "" });
  const [values, setValues] = useState<Record<MatKey, string>>(emptyValues);
  const [almacenRows, setAlmacenRows] = useState<{ material: string; cantidad: string }[]>([{ material: "", cantidad: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (current) {
      setValues({ cemento: current.cemento ? String(current.cemento) : "", grava: current.grava ? String(current.grava) : "", arena4: current.arena4 ? String(current.arena4) : "", arena5: current.arena5 ? String(current.arena5) : "", aditivo: current.aditivo ? String(current.aditivo) : "", hr25: current.hr25 ? String(current.hr25) : "", imper: current.imper ? String(current.imper) : "", costalFibra: current.costalFibra ? String(current.costalFibra) : "", colorCubetas: current.colorCubetas ? String(current.colorCubetas) : "" });
      const rows = Object.entries(current.almacenMateriales ?? {}).map(([material, cantidad]) => ({ material, cantidad: String(cantidad) }));
      setAlmacenRows(rows.length ? rows : [{ material: "", cantidad: "" }]);
    } else {
      setValues(emptyValues());
      setAlmacenRows([{ material: "", cantidad: "" }]);
    }
  }, [open, current]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const almacenMateriales = almacenRows.filter((r) => r.material.trim()).reduce((acc, r) => ({ ...acc, [r.material.trim()]: num(r.cantidad) }), {} as Record<string, number>);
      await onSave({ periodo, cemento: num(values.cemento), grava: num(values.grava), arena4: num(values.arena4), arena5: num(values.arena5), aditivo: num(values.aditivo), hr25: num(values.hr25), imper: num(values.imper), costalFibra: num(values.costalFibra), colorCubetas: num(values.colorCubetas), almacenMateriales });
      onClose();
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]"><Package size={18} /></div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Existencia inicial · {planta}</h2>
            <p className="text-xs text-gray-500 capitalize">{periodLabel(periodo)}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Producción</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              {INVENTARIO_MATERIALES.map(({ key, label, unidad }) => (
                <div key={key}><label className={lbl}>{label}{unidad ? ` (${unidad})` : ""}</label><input type="number" step="0.001" min="0" value={values[key]} onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" className={inp} /></div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Almacén</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="space-y-2">
              {almacenRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_32px] items-center gap-2">
                  <input type="text" value={row.material} onChange={(e) => { const next = [...almacenRows]; next[i] = { ...next[i], material: e.target.value }; setAlmacenRows(next); }} placeholder="Material" className={inp} />
                  <input type="number" step="0.001" min="0" value={row.cantidad} onChange={(e) => { const next = [...almacenRows]; next[i] = { ...next[i], cantidad: e.target.value }; setAlmacenRows(next); }} placeholder="0" className={inp} />
                  <button onClick={() => setAlmacenRows((r) => r.filter((_, j) => j !== i))} className="flex items-center justify-center h-10 w-8 text-gray-400 hover:text-red-500 transition-colors rounded-lg cursor-pointer"><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => setAlmacenRows((r) => [...r, { material: "", cantidad: "" }])} className="flex items-center gap-1.5 text-xs text-[#CC2229] font-medium hover:text-[#B01E24] transition-colors cursor-pointer"><Plus size={14} /> Agregar</button>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : "Guardar existencia"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RemisionRow ──────────────────────────────────────────────────────────────

function RemisionRow({ r, onEdit, onDelete }: { r: Remision; onEdit?: (r: Remision) => void; onDelete?: (r: Remision) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50 transition-colors group" onClick={() => setExpanded((p) => !p)}>
        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
        <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-bold">{r.noRemision}</td>
        <td className="px-4 py-3 text-gray-700 text-sm max-w-[160px] truncate">{r.cliente || <span className="text-gray-400">—</span>}</td>
        <td className="px-4 py-3 text-gray-900 font-bold tabular-nums">{r.metros} m³</td>
        <td className="px-4 py-3">
          {r.mezcla ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">{r.mezcla}</span> : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-3 text-gray-500 text-sm truncate max-w-[120px]">{r.operador || <span className="text-gray-400">—</span>}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {r.planta && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.planta === "Allende" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>{r.planta}</span>}
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-5 py-4 border-t-2 border-[#CC2229]/30">
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: "Cemento",    value: r.cemento,            unit: "kg" },
                { label: "Grava",      value: r.grava,              unit: "kg" },
                { label: "Arena 4",    value: r.arena4,             unit: "kg" },
                { label: "Arena 5",    value: r.arena5,             unit: "kg" },
                { label: "Agua",       value: r.agua,               unit: "L"  },
                { label: "Aditivo",    value: r.aditivo,            unit: ""   },
                { label: "Acelerante", value: r.acelerante || null, unit: ""   },
                { label: "Imper.",     value: r.imper || null,      unit: ""   },
                { label: "Fibra",      value: r.fibra,              unit: "kg" },
                { label: "Color",      value: r.color || null,      unit: ""   },
                { label: "CR",         value: r.cr,                 unit: ""   },
              ].filter(({ value }) => value != null && value !== "").map(({ label, value, unit }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 min-w-[100px]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{value}{unit ? ` ${unit}` : ""}</p>
                </div>
              ))}
            </div>
            {(onEdit || onDelete) && (
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"><Pencil size={11} /> Editar</button>}
                {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(r); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={11} /> Eliminar</button>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "stock" | "remisiones" | "movimientos";

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [periodo, setPeriodo] = useState(currentPeriod());
  const [localPlanta, setLocalPlanta] = useState<"Allende" | "Pesquería">(() => {
    const ap = getActivePlanta();
    return ap === "Pesquería" ? "Pesquería" : "Allende";
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => { setIsSuperAdmin(getStoredSession()?.email?.toLowerCase() === SUPERADMIN); }, []);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [entradasMaterial, setEntradasMaterial] = useState<EntradaMaterial[]>([]);
  const [existenciasIniciales, setExistenciasIniciales] = useState<ExistenciaInicial[]>([]);
  const [clientesList, setClientesList] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [showRemisionForm, setShowRemisionForm] = useState(false);
  const [showEntradaForm, setShowEntradaForm] = useState(false);
  const [showExistenciaForm, setShowExistenciaForm] = useState(false);
  const [editingRemision, setEditingRemision] = useState<Remision | undefined>(undefined);
  const [confirmDeleteRemision, setConfirmDeleteRemision] = useState<Remision | null>(null);
  const [confirmDeleteMovimiento, setConfirmDeleteMovimiento] = useState<EntradaMaterial | null>(null);
  const [search, setSearch] = useState("");
  const [searchMov, setSearchMov] = useState("");
  const [filterTipo, setFilterTipo] = useState<"Todos" | "entrada" | "salida">("Todos");
  const [filterCat, setFilterCat] = useState<"Todos" | "inventario" | "almacen">("Todos");

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    getCollectionDocs<Remision>(COLLECTIONS.remisiones).then((d) => {
      const items = filterByPlanta(d);
      setRemisiones(items);
      const sorted = items.filter((r) => r.fecha?.includes("/")).map((r) => displayToISO(r.fecha)).filter(Boolean).sort().reverse();
      if (sorted.length > 0) setPeriodo(sorted[0].slice(0, 7));
    });
    getCollectionDocs<EntradaMaterial>(COLLECTIONS.entradasMaterial).then((d) => setEntradasMaterial(filterByPlanta(d)));
    getCollectionDocs<ExistenciaInicial>(COLLECTIONS.existenciasIniciales).then((d) => setExistenciasIniciales(filterByPlanta(d)));
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((l) => setClientesList(l.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial }))));
    getCollectionDocs<Operador>(COLLECTIONS.operadores).then((l) => setOperadoresList(l.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre }))));
  }, []);

  const nextRemision = useMemo(() => {
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  // ── Plant filter ──────────────────────────────────────────────────────────────
  const remByPlanta = useMemo(
    () => remisiones.filter((r) => !r.planta || r.planta === localPlanta || r.planta === "Todas"),
    [remisiones, localPlanta],
  );
  const entByPlanta = useMemo(
    () => entradasMaterial.filter((e) => !e.planta || e.planta === localPlanta || e.planta === "Todas"),
    [entradasMaterial, localPlanta],
  );
  const existenciaInicial = useMemo(
    () => existenciasIniciales.find((e) => e.periodo === periodo && (!e.planta || e.planta === localPlanta)) ?? null,
    [existenciasIniciales, periodo, localPlanta],
  );

  // ── Period slices ─────────────────────────────────────────────────────────────
  const remisionesPeriodo = useMemo(
    () => remByPlanta.filter((r) => inPeriod(r.fecha, periodo)),
    [remByPlanta, periodo],
  );

  const consumoPeriodo = useMemo(() => {
    const result = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key, remKey }) => {
      result[key] = remisionesPeriodo.reduce((s, r) => {
        const val = r[remKey]; const parsed = typeof val === "number" ? val : parseFloat(String(val ?? ""));
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0);
    });
    return result;
  }, [remisionesPeriodo]);

  const entradasNetoPeriodo = useMemo(() => {
    const entries = entByPlanta.filter((e) => e.categoria === "inventario" && inPeriod(e.fecha, periodo));
    const result = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key }) => {
      const ent = entries.filter((e) => e.material === key && e.tipo === "entrada").reduce((s, e) => s + e.cantidad, 0);
      const sal = entries.filter((e) => e.material === key && e.tipo === "salida").reduce((s, e) => s + e.cantidad, 0);
      result[key] = ent - sal;
    });
    return result;
  }, [entByPlanta, periodo]);

  // Days of production in period (for daily avg consumption)
  const diasConProduccion = useMemo(() => {
    const fechas = new Set(remisionesPeriodo.map((r) => r.fecha?.includes("/") ? displayToISO(r.fecha) : "").filter(Boolean));
    return Math.max(fechas.size, 1);
  }, [remisionesPeriodo]);

  const stockRows: StockRow[] = useMemo(() => INVENTARIO_MATERIALES.map(({ key, label, unidad, dot }) => {
    const inicial = existenciaInicial?.[key] ?? 0;
    const entradas = entradasNetoPeriodo[key] ?? 0;
    const consumo = consumoPeriodo[key] ?? 0;
    const final = inicial + entradas - consumo;
    const total = Math.max(inicial + entradas, 1);
    const pct = inicial > 0 ? (final / total) * 100 : 0;
    const estado: StockRow["estado"] = final < 0 ? "deficit" : (inicial > 0 && pct < 20) ? "bajo" : "ok";
    const consumoDiario = consumo / diasConProduccion;
    const diasRestantes = consumoDiario > 0 && final > 0 ? Math.round(final / consumoDiario) : null;
    return { key, label, unidad, dot, inicial, entradas, consumo, final, estado, diasRestantes };
  }), [existenciaInicial, entradasNetoPeriodo, consumoPeriodo, diasConProduccion]);

  const almacenStock = useMemo(() => {
    const inicialMap = existenciaInicial?.almacenMateriales ?? {};
    const almacenEntradas = entByPlanta.filter((e) => e.categoria === "almacen" && inPeriod(e.fecha, periodo));
    const stock = new Map<string, { inicial: number; entradas: number; salidas: number }>();
    Object.entries(inicialMap).forEach(([mat, cant]) => stock.set(mat, { inicial: cant, entradas: 0, salidas: 0 }));
    almacenEntradas.forEach((e) => {
      const ex = stock.get(e.material) ?? { inicial: 0, entradas: 0, salidas: 0 };
      stock.set(e.material, e.tipo === "entrada" ? { ...ex, entradas: ex.entradas + e.cantidad } : { ...ex, salidas: ex.salidas + e.cantidad });
    });
    return Array.from(stock.entries()).map(([material, data]) => ({ material, ...data, final: data.inicial + data.entradas - data.salidas })).sort((a, b) => a.material.localeCompare(b.material));
  }, [existenciaInicial, entByPlanta, periodo]);

  const materialesConAlerta = useMemo(() => stockRows.filter((r) => r.estado !== "ok" && r.inicial > 0).length, [stockRows]);
  const totalM3 = remisionesPeriodo.reduce((s, r) => s + r.metros, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSaveRemision = async (r: Remision) => {
    const id = r.id ?? `rem-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    const efectivePlanta = (r.planta && r.planta !== "Todas") ? r.planta : localPlanta;
    await upsertDocument(COLLECTIONS.remisiones, id, { ...data, planta: efectivePlanta });
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...r, id };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [updated, ...prev];
    });
  };

  const handleSaveEntrada = async (e: EntradaMaterial) => {
    const id = `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await upsertDocument(COLLECTIONS.entradasMaterial, id, { ...e, planta: localPlanta });
    setEntradasMaterial((prev) => [{ ...e, id, planta: localPlanta }, ...prev]);
  };

  const handleDeleteRemision = async (r: Remision) => {
    setRemisiones((prev) => prev.filter((x) => x.id !== r.id));
    if (r.id) await deleteDocument(COLLECTIONS.remisiones, r.id);
    setConfirmDeleteRemision(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Remisión ${r.noRemision} eliminada.` } }));
  };

  const handleDeleteMovimiento = async (e: EntradaMaterial) => {
    setEntradasMaterial((prev) => prev.filter((x) => x.id !== e.id));
    if (e.id) await deleteDocument(COLLECTIONS.entradasMaterial, e.id);
    setConfirmDeleteMovimiento(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Movimiento eliminado." } }));
  };

  const handleSaveExistencia = async (e: Omit<ExistenciaInicial, "id">) => {
    const plantaSlug = localPlanta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
    const id = `ei-${plantaSlug}-${e.periodo}`;
    await upsertDocument(COLLECTIONS.existenciasIniciales, id, { ...e, planta: localPlanta });
    setExistenciasIniciales((prev) => {
      const idx = prev.findIndex((x) => x.periodo === e.periodo && (!x.planta || x.planta === localPlanta));
      const updated = { ...e, id, planta: localPlanta };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [...prev, updated];
    });
  };

  // ── Filtered lists ────────────────────────────────────────────────────────────
  const filteredRemisiones = useMemo(() => {
    let rows = remByPlanta.filter((r) => inPeriod(r.fecha, periodo));
    if (search) { const q = search.toLowerCase(); rows = rows.filter((r) => r.cliente.toLowerCase().includes(q) || r.noRemision.includes(q) || r.operador.toLowerCase().includes(q) || r.mezcla?.toLowerCase().includes(q)); }
    return rows;
  }, [remByPlanta, periodo, search]);

  const filteredMovimientos = useMemo(() => {
    let rows: MovRow[] = [];
    if (existenciaInicial) {
      const [y, m] = periodo.split("-");
      const fechaExi = `01/${m}/${y}`;
      INVENTARIO_MATERIALES.forEach(({ key, label, unidad }) => {
        const cantidad = existenciaInicial[key] ?? 0;
        if (cantidad > 0) rows.push({ _source: "existencia", material: key, label, cantidad, unidad, fecha: fechaExi });
      });
    }
    entByPlanta.filter((e) => inPeriod(e.fecha, periodo)).forEach((e) => rows.push({ _source: "manual", data: e }));
    remByPlanta.filter((r) => r.fecha?.includes("/") && inPeriod(r.fecha, periodo)).forEach((r) => rows.push({ _source: "remision", data: r }));
    if (filterTipo === "entrada") rows = rows.filter((row) => row._source === "existencia" || (row._source === "manual" && row.data.tipo === "entrada"));
    if (filterTipo === "salida") rows = rows.filter((row) => row._source === "remision" || (row._source === "manual" && row.data.tipo === "salida"));
    if (filterCat === "inventario") rows = rows.filter((row) => row._source === "existencia" || row._source === "remision" || (row._source === "manual" && row.data.categoria === "inventario"));
    if (filterCat === "almacen") rows = rows.filter((row) => row._source === "manual" && row.data.categoria === "almacen");
    if (searchMov) {
      const q = searchMov.toLowerCase();
      rows = rows.filter((row) => {
        if (row._source === "existencia") return row.label.toLowerCase().includes(q);
        if (row._source === "manual") { const e = row.data; return e.material.toLowerCase().includes(q) || e.proveedor?.toLowerCase().includes(q) || e.noFactura?.toLowerCase().includes(q); }
        const r = row.data; return r.noRemision.toLowerCase().includes(q) || (r.cliente?.toLowerCase().includes(q) ?? false);
      });
    }
    return [...rows].sort((a, b) => {
      const getDate = (row: MovRow) => { const f = row._source === "existencia" ? row.fecha : row.data.fecha; return f?.includes("/") ? displayToISO(f) : (f ?? ""); };
      return getDate(b).localeCompare(getDate(a));
    });
  }, [existenciaInicial, entByPlanta, remByPlanta, periodo, filterCat, filterTipo, searchMov]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period nav */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <button onClick={() => setPeriodo(adjMonth(periodo, -1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">‹</button>
          <span className="text-gray-800 text-sm font-medium capitalize min-w-[140px] text-center py-2 select-none">{periodLabel(periodo)}</span>
          <button onClick={() => setPeriodo(adjMonth(periodo, +1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">›</button>
        </div>

        {/* Plant selector */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
          {(["Allende", "Pesquería"] as const).map((p) => (
            <button key={p} onClick={() => setLocalPlanta(p)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all cursor-pointer ${localPlanta === p ? "bg-[#CC2229] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}>
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isSuperAdmin && tab === "stock" && (
            <button onClick={() => setShowExistenciaForm(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-colors cursor-pointer">
              <Edit2 size={13} /> Existencia inicial
            </button>
          )}
          {tab === "remisiones" && (
            <button onClick={() => exportXLSX(filteredRemisiones)} disabled={filteredRemisiones.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-40 cursor-pointer">
              <Download size={13} /> Excel
            </button>
          )}
          <button
            onClick={() => tab === "movimientos" ? setShowEntradaForm(true) : (setEditingRemision(undefined), setShowRemisionForm(true))}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            <Plus size={15} /> {tab === "movimientos" ? "Registrar entrada" : "Nueva remisión"}
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="M³ producidos" value={`${totalM3.toFixed(1)}`} icon={FlaskConical} iconColor="text-[#CC2229]" subtitle={`${remisionesPeriodo.length} remisiones · ${localPlanta}`} />
        <KPICard title="Promedio por remisión" value={`${(totalM3 / Math.max(remisionesPeriodo.length, 1)).toFixed(1)} m³`} icon={BarChart2} iconColor="text-sky-400" iconBg="bg-sky-500/10" subtitle={`${diasConProduccion} día${diasConProduccion !== 1 ? "s" : ""} con producción`} />
        <KPICard title="Alertas de stock" value={String(materialesConAlerta)} icon={AlertTriangle} iconColor={materialesConAlerta > 0 ? "text-amber-400" : "text-gray-500"} iconBg={materialesConAlerta > 0 ? "bg-amber-500/10" : "bg-gray-500/10"} subtitle={materialesConAlerta > 0 ? "Materiales en déficit o bajo" : "Todos los materiales OK"} />
        <KPICard title="Existencia inicial" value={existenciaInicial ? "Cargada" : "Faltante"} icon={Layers} iconColor={existenciaInicial ? "text-emerald-400" : "text-amber-400"} iconBg={existenciaInicial ? "bg-emerald-500/10" : "bg-amber-500/10"} subtitle={existenciaInicial ? `${localPlanta} · ${periodLabel(periodo)}` : "Ingresa el inventario inicial"} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-gray-200">
        {[
          { key: "stock" as Tab,       label: "Stock de Materiales", icon: Package,         badge: materialesConAlerta > 0 ? materialesConAlerta : undefined },
          { key: "remisiones" as Tab,  label: "Remisiones",          icon: FlaskConical,    badge: remisionesPeriodo.length || undefined },
          { key: "movimientos" as Tab, label: "Movimientos",          icon: ArrowDownToLine, badge: undefined as number | undefined },
        ].map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${tab === key ? "border-[#CC2229] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon size={14} /> {label}
            {badge !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${key === "stock" && materialesConAlerta > 0 ? "bg-amber-100 text-amber-700" : "bg-[#CC2229]/10 text-[#CC2229]"}`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Stock ─────────────────────────────────────────────────────────── */}
      {tab === "stock" && (
        <div className="space-y-6">
          {!existenciaInicial && (
            <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Sin existencia inicial · {localPlanta} · {periodLabel(periodo)}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {isSuperAdmin
                    ? 'Usa el botón "Existencia inicial" para cargar el stock del inicio del período.'
                    : "El cálculo de stock final parte de cero. Contacta al administrador para configurarlo."}
                </p>
              </div>
            </div>
          )}

          {/* Material cards grid */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Producción</h3>
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] text-gray-400">Inicial + Entradas − Consumo = Stock final</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockRows.map((row) => <MaterialCard key={row.key} row={row} />)}
            </div>
          </div>

          {/* Almacén */}
          {almacenStock.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Almacén general</h3>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["Material", "Inicial", "+ Entradas", "− Salidas", "Stock final"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {almacenStock.map(({ material, inicial, entradas, salidas, final }) => (
                      <tr key={material} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 text-gray-800 font-medium">{material}</td>
                        <td className="px-4 py-3.5 text-gray-500 font-mono text-right">{fmt(inicial)}</td>
                        <td className="px-4 py-3.5 text-right font-mono"><span className={entradas > 0 ? "text-emerald-600" : "text-gray-300"}>{entradas > 0 ? `+${fmt(entradas)}` : "—"}</span></td>
                        <td className="px-4 py-3.5 text-right font-mono"><span className={salidas > 0 ? "text-orange-500" : "text-gray-300"}>{salidas > 0 ? `−${fmt(salidas)}` : "—"}</span></td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold"><span className={final < 0 ? "text-red-600" : final === 0 ? "text-gray-400" : "text-gray-900"}>{fmt(final)}</span>{final < 0 && <span className="ml-2 text-[10px] text-red-500">déficit</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Remisiones ────────────────────────────────────────────────────── */}
      {tab === "remisiones" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{filteredRemisiones.length} remisión{filteredRemisiones.length !== 1 ? "es"  : ""}</p>
              <p className="text-xs text-gray-500">{filteredRemisiones.reduce((s, r) => s + r.metros, 0).toFixed(1)} m³ · {localPlanta}</p>
            </div>
            <div className="ml-auto relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, remisión, mezcla…" className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg pl-7 pr-8 py-1.5 w-56 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-400" />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={11} /></button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Fecha", "Remisión", "Cliente", "Metros", "Mezcla", "Operador", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRemisiones.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">Sin remisiones para este período</td></tr>
                  : filteredRemisiones.map((r) => (
                    <RemisionRow key={r.id ?? r.noRemision} r={r}
                      onEdit={(r) => { setEditingRemision(r); setShowRemisionForm(true); }}
                      onDelete={setConfirmDeleteRemision}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Movimientos ───────────────────────────────────────────────────── */}
      {tab === "movimientos" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 flex-1">{filteredMovimientos.length} movimiento{filteredMovimientos.length !== 1 ? "s" : ""}</p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={searchMov} onChange={(e) => setSearchMov(e.target.value)} placeholder="Material, proveedor…" className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg pl-7 pr-8 py-1.5 w-44 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-400" />
              {searchMov && <button onClick={() => setSearchMov("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={11} /></button>}
            </div>
            {(["Todos", "entrada", "salida"] as const).map((t) => (
              <button key={t} onClick={() => setFilterTipo(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterTipo === t ? "bg-[#CC2229] text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {t === "Todos" ? "Todos" : t === "entrada" ? "Entradas" : "Salidas"}
              </button>
            ))}
            {(["Todos", "inventario", "almacen"] as const).map((c) => (
              <button key={c} onClick={() => setFilterCat(c)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterCat === c ? "bg-gray-200 text-gray-800" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {c === "Todos" ? "Categorías" : c === "inventario" ? "Producción" : "Almacén"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Fecha", "Tipo", "Categoría", "Material", "Cantidad", "Proveedor", "Factura", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMovimientos.length === 0
                  ? <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">Sin movimientos en {periodLabel(periodo)}</td></tr>
                  : filteredMovimientos.map((row, idx) => {
                    if (row._source === "existencia") return (
                      <tr key={`exi-${row.material}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{row.fecha}</td>
                        <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><ArrowDownToLine size={11} /> Entrada</span></td>
                        <td className="px-4 py-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">Stock inicial</span></td>
                        <td className="px-4 py-3 text-gray-700">{row.label}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono font-semibold">{fmt(row.cantidad)}{row.unidad ? ` ${row.unidad}` : ""}</td>
                        <td className="px-4 py-3 text-gray-400">—</td>
                        <td className="px-4 py-3 text-gray-400 text-xs capitalize">{periodLabel(periodo)}</td>
                        <td />
                      </tr>
                    );
                    if (row._source === "remision") {
                      const r = row.data;
                      return (
                        <tr key={r.id ?? r.noRemision} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
                          <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs font-semibold text-orange-600"><ArrowUpToLine size={11} /> Salida</span></td>
                          <td className="px-4 py-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-50 border-orange-200 text-orange-700">Remisión</span></td>
                          <td className="px-4 py-3 text-gray-700">{r.mezcla || "Concreto"}</td>
                          <td className="px-4 py-3 text-gray-900 font-mono font-semibold">{r.metros} m³</td>
                          <td className="px-4 py-3 text-gray-500 text-sm truncate max-w-[140px]">{r.cliente || "—"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">#{r.noRemision}</td>
                          <td />
                        </tr>
                      );
                    }
                    const e = row.data;
                    return (
                      <tr key={e.id ?? idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{e.fecha}</td>
                        <td className="px-4 py-3"><span className={`flex items-center gap-1 text-xs font-semibold ${e.tipo === "entrada" ? "text-emerald-600" : "text-orange-600"}`}>{e.tipo === "entrada" ? <><ArrowDownToLine size={11} /> Entrada</> : <><ArrowUpToLine size={11} /> Salida</>}</span></td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${e.categoria === "inventario" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-purple-50 border-purple-200 text-purple-700"}`}>{e.categoria === "inventario" ? "Producción" : "Almacén"}</span></td>
                        <td className="px-4 py-3 text-gray-700">{e.categoria === "inventario" ? (INVENTARIO_MATERIALES.find((m) => m.key === e.material)?.label ?? e.material) : e.material}</td>
                        <td className="px-4 py-3 text-gray-900 font-mono font-semibold">{fmt(e.cantidad)}{e.unidad ? ` ${e.unidad}` : ""}</td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{e.proveedor || "—"}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.noFactura || "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setConfirmDeleteMovimiento(e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Drawers & Modals ───────────────────────────────────────────────────── */}
      <RemisionDrawer open={showRemisionForm} onClose={() => { setShowRemisionForm(false); setEditingRemision(undefined); }} onSave={handleSaveRemision} initial={editingRemision} clientes={clientesList} operadores={operadoresList} nextRemision={nextRemision} defaultPlanta={localPlanta} />
      <EntradaDrawer open={showEntradaForm} onClose={() => setShowEntradaForm(false)} onSave={handleSaveEntrada} />
      {isSuperAdmin && <ExistenciaModal open={showExistenciaForm} onClose={() => setShowExistenciaForm(false)} periodo={periodo} planta={localPlanta} current={existenciaInicial} onSave={handleSaveExistencia} />}

      {confirmDeleteRemision && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteRemision(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 mb-4"><Trash2 size={20} className="text-red-500" /></div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Eliminar remisión</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar remisión <span className="text-gray-900 font-semibold">{confirmDeleteRemision.noRemision}</span>? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteRemision(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancelar</button>
              <button onClick={() => handleDeleteRemision(confirmDeleteRemision)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteMovimiento && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteMovimiento(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 mb-4"><Trash2 size={20} className="text-red-500" /></div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Eliminar movimiento</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar movimiento de <span className="text-gray-900 font-semibold">{confirmDeleteMovimiento.material}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteMovimiento(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancelar</button>
              <button onClick={() => handleDeleteMovimiento(confirmDeleteMovimiento)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
