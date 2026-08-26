"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownToLine, ArrowUpToLine,
  Boxes, CalendarDays, ChevronDown, ChevronUp,
  Download, Edit2,
  FlaskConical, Package, Pencil, Plus, Search, Trash2, Users, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import PlantaRequired from "@/components/PlantaRequired";
import ClienteCombobox from "@/components/ClienteCombobox";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, getActivePlanta, getStoredSession, Planta, withPlantaTag } from "@/lib/auth";
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

const INVENTARIO_MATERIALES: { key: MatKey; label: string; unidad: string; remKey: keyof Remision }[] = [
  { key: "cemento",      label: "Cemento",        unidad: "kg",       remKey: "cemento" },
  { key: "grava",        label: "Grava",           unidad: "kg",       remKey: "grava" },
  { key: "arena4",       label: "Arena 4",         unidad: "kg",       remKey: "arena4" },
  { key: "arena5",       label: "Arena 5",         unidad: "kg",       remKey: "arena5" },
  { key: "aditivo",      label: "Aditivo",         unidad: "L",        remKey: "aditivo" },
  { key: "hr25",         label: "HR25",            unidad: "",         remKey: "acelerante" },
  { key: "imper",        label: "Imper",           unidad: "",         remKey: "imper" },
  { key: "costalFibra",  label: "Costales Fibra",  unidad: "costales", remKey: "fibra" },
  { key: "colorCubetas", label: "Color / Cubetas", unidad: "cubetas",  remKey: "color" },
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
  const XLSX = require("xlsx");
  const data = rows.map((r) => ({
    "FECHA": r.fecha,
    "REMISION": r.noRemision,
    "CLIENTE": r.cliente,
    "METROS": r.metros,
    "CONCRETO": r.mezcla,
    "CR": r.cr ?? "",
    "OPERADOR": r.operador,
    "CEMENTO": r.cemento ?? "",
    "GRAVA": r.grava ?? "",
    "ARENA 4": r.arena4 ?? "",
    "ARENA 5": r.arena5 ?? "",
    "AGUA": r.agua ?? "",
    "ADITIVO": r.aditivo ?? "",
    "ACELERANTE": r.acelerante,
    "IMPER": r.imper,
    "FIBRA": r.fibra ?? "",
    "COLOR": r.color,
    "LIGSTHONE": r.ligsthone,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Remisiones");
  XLSX.writeFile(wb, "remisiones.xlsx");
}
const SUPERADMIN = "leonardo@lpsoft.mx";
function getPlantaSlug() {
  const s = getStoredSession();
  return (s?.planta ?? "all").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
}

const tooltipStyle = { backgroundColor: "#1A1F2B", border: "1px solid #252D3D", borderRadius: "8px", color: "#fff", fontSize: "12px" };
const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── Remision Form Drawer ─────────────────────────────────────────────────────

function RemisionDrawer({ open, onClose, onSave, initial, clientes, operadores, nextRemision }: {
  open: boolean; onClose: () => void; onSave: (r: Remision) => Promise<void>;
  initial?: Remision;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  nextRemision: string;
}) {
  const defaultPlanta = (): string => {
    const ap = getActivePlanta();
    return ap === "Todas" ? "Allende" : ap;
  };
  const emptyForm = (): FormState => ({
    fecha: todayISO(), noRemision: "", cliente: "", metros: "", mezcla: "",
    cr: "", operador: "", cemento: "", grava: "", arena4: "", arena5: "",
    agua: "", aditivo: "", acelerante: "", imper: "", fibra: "", color: "", ligsthone: "",
    planta: defaultPlanta(),
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
        planta: initial.planta ?? defaultPlanta(),
      });
    } else {
      setForm({ ...emptyForm(), noRemision: nextRemision });
    }
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
        planta: form.planta || defaultPlanta(),
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
            <p className="text-xs text-gray-500">Despacho de concreto</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Fecha <span className="text-[#CC2229]">*</span></label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label><input type="text" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value)} placeholder="18945" className={inp} /></div>
            <div className="col-span-2">
              <label className={lbl}>Planta <span className="text-[#CC2229]">*</span></label>
              <div className="flex gap-2">
                {(["Allende", "Pesquería"] as Planta[]).map((p) => (
                  <button key={p} type="button" onClick={() => set("planta", p)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                      form.planta === p
                        ? "bg-[#CC2229] border-[#CC2229] text-white"
                        : "bg-white border-gray-200 text-gray-500 hover:border-[#CC2229]/40"
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <ClienteCombobox label="Cliente" value={form.cliente} onChange={(v) => set("cliente", v)} options={clientes.map((c) => c.nombreComercial || c.razonSocial)} placeholder="Buscar o escribir cliente…" />
            </div>
            <div><label className={lbl}>Metros m³ <span className="text-[#CC2229]">*</span></label><input type="number" step="0.5" min="0" value={form.metros} onChange={(e) => set("metros", e.target.value)} placeholder="7.0" className={inp} /></div>
            <div><label className={lbl}>Mezcla</label><input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="250-20-14" className={inp} /></div>
            <div><label className={lbl}>CR</label><input type="number" value={form.cr} onChange={(e) => set("cr", e.target.value)} placeholder="350" className={inp} /></div>
            <div>
              <ClienteCombobox label="Operador" value={form.operador} onChange={(v) => set("operador", v)} options={operadores.map((o) => o.nombre)} placeholder="Buscar o escribir…" />
            </div>
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

// ─── Entrada Drawer ───────────────────────────────────────────────────────────

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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]"><ArrowDownToLine size={18} /></div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Registrar entrada</h2>
            <p className="text-xs text-gray-500">Recepción de material al inventario</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Categoria toggle */}
          <div>
            <label className={lbl}>Categoría</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button type="button" onClick={() => { set("categoria", "inventario"); set("material", ""); set("unidad", ""); }} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${form.categoria === "inventario" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Producción
              </button>
              <button type="button" onClick={() => { set("categoria", "almacen"); set("material", ""); set("unidad", ""); }} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${form.categoria === "almacen" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Almacén
              </button>
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
                <input type="text" value={form.material} onChange={(e) => set("material", e.target.value)} placeholder="Ej: Diesel, Lubricante, Bolsas…" className={inp} />
              )}
            </div>
            <div><label className={lbl}>Cantidad <span className="text-[#CC2229]">*</span></label><input type="number" step="0.001" min="0" value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} placeholder="0" className={inp} /></div>
            <div><label className={lbl}>Unidad</label><input type="text" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="kg, L, ton…" className={inp} /></div>
            <div><label className={lbl}>Fecha</label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>No. Factura</label><input type="text" value={form.noFactura} onChange={(e) => set("noFactura", e.target.value)} placeholder="—" className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Proveedor</label><input type="text" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Nombre del proveedor" className={inp} /></div>
          </div>
          <div><label className={lbl}>Observaciones</label><textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={2} className={`${inp} resize-none`} /></div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.material.trim() || !form.cantidad} className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Existencia Inicial Modal ─────────────────────────────────────────────────

function ExistenciaModal({ open, onClose, periodo, current, onSave }: {
  open: boolean; onClose: () => void; periodo: string;
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
            <h2 className="text-sm font-semibold text-gray-900">Existencia inicial</h2>
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
              <button onClick={() => setAlmacenRows((r) => [...r, { material: "", cantidad: "" }])} className="flex items-center gap-1.5 text-xs text-[#CC2229] font-medium hover:text-[#B01E24] transition-colors cursor-pointer"><Plus size={14} /> Agregar material</button>
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

// ─── Remision Table Row ───────────────────────────────────────────────────────

function RemisionRow({ r, onEdit, onDelete }: {
  r: Remision;
  onEdit?: (r: Remision) => void;
  onDelete?: (r: Remision) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="cursor-pointer hover:bg-[#2A2A2A] transition-colors" onClick={() => setExpanded((p) => !p)}>
        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
        <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-bold">{r.noRemision}</td>
        <td className="px-4 py-3 text-gray-200 text-sm max-w-[160px] truncate">{r.cliente || <span className="text-gray-600">—</span>}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{r.metros} m³</td>
        <td className="px-4 py-3">
          {r.mezcla ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300">{r.mezcla}</span> : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm">{r.operador || <span className="text-gray-600">—</span>}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            {r.planta && r.planta !== "Todas" && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${r.planta === "Allende" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"}`}>
                {r.planta}
              </span>
            )}
            {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-[#1A1A1A]" style={{ padding: "16px 20px", borderTop: "2px solid #CC2229", borderBottom: "1px solid #e2e8f0", maxWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {[
                { label: "Cemento",   value: r.cemento,              unit: "kg" },
                { label: "Grava",     value: r.grava,                unit: "kg" },
                { label: "Arena 4",   value: r.arena4,               unit: "kg" },
                { label: "Arena 5",   value: r.arena5,               unit: "kg" },
                { label: "Agua",      value: r.agua,                 unit: "L"  },
                { label: "Aditivo",   value: r.aditivo,              unit: ""   },
                { label: "Acelerante",value: r.acelerante || null,   unit: ""   },
                { label: "Imper.",    value: r.imper || null,        unit: ""   },
                { label: "Fibra",     value: r.fibra,                unit: "kg" },
                { label: "Color",     value: r.color || null,        unit: ""   },
                { label: "Ligsthone", value: r.ligsthone || null,    unit: ""   },
                { label: "CR",        value: r.cr,                   unit: ""   },
              ].filter(({ value }) => value != null && value !== "").map(({ label, value, unit }) => (
                <div key={label} style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", minWidth: "110px", flex: "1 1 110px", maxWidth: "180px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", marginBottom: "4px" }}>{label}</p>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>{value}{unit ? ` ${unit}` : ""}</p>
                </div>
              ))}
            </div>
            {(onEdit || onDelete) && (
              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #e2e8f0", display: "flex", gap: "8px" }}>
                {onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: "#64748b", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer" }}>
                    <Pencil size={11} /> Editar
                  </button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(r); }} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: "#94a3b8", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer" }}>
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Stock Health Bar ─────────────────────────────────────────────────────────

function StockBar({ inicial, entradas, consumo }: { inicial: number; entradas: number; consumo: number }) {
  const total = inicial + entradas;
  const final = total - consumo;
  const pct = total > 0 ? Math.max(0, Math.min(100, (final / total) * 100)) : 0;
  const color = final < 0 ? "bg-red-500" : pct < 20 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "remisiones" | "control" | "inventario" | "movimientos";

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>("control");
  const [periodo, setPeriodo] = useState(currentPeriod());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    setIsSuperAdmin(getStoredSession()?.email?.toLowerCase() === SUPERADMIN);
  }, []);

  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [entradasMaterial, setEntradasMaterial] = useState<EntradaMaterial[]>([]);
  const [existenciasIniciales, setExistenciasIniciales] = useState<ExistenciaInicial[]>([]);
  const [clientesList, setClientesList] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);

  const [showRemisionForm, setShowRemisionForm] = useState(false);
  const [showEntradaForm, setShowEntradaForm] = useState(false);
  const [showExistenciaForm, setShowExistenciaForm] = useState(false);
  const [editingRemision, setEditingRemision] = useState<Remision | undefined>(undefined);
  const [confirmDeleteRemision, setConfirmDeleteRemision] = useState<Remision | null>(null);
  const [confirmDeleteMovimiento, setConfirmDeleteMovimiento] = useState<EntradaMaterial | null>(null);
  const [search, setSearch] = useState("");
  const [filterMezcla, setFilterMezcla] = useState("Todos");
  const [searchMovimientos, setSearchMovimientos] = useState("");
  const [filterCatMov, setFilterCatMov] = useState<"Todos" | "inventario" | "almacen">("Todos");
  const [filterTipoMov, setFilterTipoMov] = useState<"Todos" | "entrada" | "salida">("Todos");
  const [controlDate, setControlDate] = useState(() => todayISO());
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    getCollectionDocs<Remision>(COLLECTIONS.remisiones).then((d) => {
      const items = filterByPlanta(d);
      setRemisiones(items);
      // Auto-set period to most recent month with data
      const sorted = items
        .filter((r) => r.fecha?.includes("/"))
        .map((r) => displayToISO(r.fecha))
        .filter(Boolean)
        .sort()
        .reverse();
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

  const handleSaveRemision = async (r: Remision) => {
    const id = r.id ?? `rem-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    const effectivePlanta = (r.planta && r.planta !== "Todas") ? r.planta : getActivePlanta();
    await upsertDocument(COLLECTIONS.remisiones, id, { ...data, planta: effectivePlanta });
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...r, id };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [updated, ...prev];
    });
  };

  const handleSaveEntrada = async (e: EntradaMaterial) => {
    const id = `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await upsertDocument(COLLECTIONS.entradasMaterial, id, withPlantaTag(e));
    setEntradasMaterial((prev) => [{ ...e, id }, ...prev]);
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
    const id = `ei-${getPlantaSlug()}-${e.periodo}`;
    await upsertDocument(COLLECTIONS.existenciasIniciales, id, withPlantaTag(e));
    setExistenciasIniciales((prev) => {
      const idx = prev.findIndex((x) => x.periodo === e.periodo);
      const updated = { ...e, id };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [...prev, updated];
    });
  };

  // ─ Remisiones ─
  const mezclas = useMemo(() => ["Todos", ...Array.from(new Set(remisiones.map((r) => r.mezcla).filter(Boolean))).sort()], [remisiones]);
  const remisionesPeriodo = useMemo(() => remisiones.filter((r) => inPeriod(r.fecha, periodo)), [remisiones, periodo]);
  const filtered = useMemo(() => {
    let rows = showAllHistory ? remisiones : remisionesPeriodo;
    if (search) { const q = search.toLowerCase(); rows = rows.filter((r) => r.cliente.toLowerCase().includes(q) || r.noRemision.includes(q) || r.operador.toLowerCase().includes(q)); }
    if (filterMezcla !== "Todos") rows = rows.filter((r) => r.mezcla === filterMezcla);
    return rows;
  }, [remisiones, remisionesPeriodo, search, filterMezcla, showAllHistory]);

  const totalM3Periodo = remisionesPeriodo.reduce((s, r) => s + r.metros, 0);
  const uniqueClientesPeriodo = new Set(remisionesPeriodo.map((r) => r.cliente)).size;

  const m3PorDia = useMemo(() => {
    const map = new Map<string, number>();
    remisionesPeriodo.forEach((r) => { const iso = r.fecha?.includes("/") ? displayToISO(r.fecha) : ""; if (!iso) return; map.set(iso, (map.get(iso) ?? 0) + r.metros); });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, metros]) => ({ fecha: fecha.slice(5).replace("-", "/"), metros: parseFloat(metros.toFixed(1)) }));
  }, [remisionesPeriodo]);

  const porMezcla = useMemo(() => {
    const map = new Map<string, number>();
    remisionesPeriodo.forEach((r) => { const k = r.mezcla || "Sin especificar"; map.set(k, (map.get(k) ?? 0) + r.metros); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([mezcla, metros]) => ({ mezcla, metros: parseFloat(metros.toFixed(1)) }));
  }, [remisionesPeriodo]);

  // ─ Inventario ─
  const existenciaInicial = useMemo(() => existenciasIniciales.find((e) => e.periodo === periodo) ?? null, [existenciasIniciales, periodo]);

  const consumoPeriodo = useMemo(() => {
    const rems = remisionesPeriodo;
    const result = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key, remKey }) => {
      result[key] = rems.reduce((s, r) => {
        const val = r[remKey]; const parsed = typeof val === "number" ? val : parseFloat(String(val ?? ""));
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0);
    });
    return result;
  }, [remisionesPeriodo]);

  const entradasNetoPeriodo = useMemo(() => {
    const entries = entradasMaterial.filter((e) => e.categoria === "inventario" && inPeriod(e.fecha, periodo));
    const result = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key }) => {
      const ent = entries.filter((e) => e.material === key && e.tipo === "entrada").reduce((s, e) => s + e.cantidad, 0);
      const sal = entries.filter((e) => e.material === key && e.tipo === "salida").reduce((s, e) => s + e.cantidad, 0);
      result[key] = ent - sal;
    });
    return result;
  }, [entradasMaterial, periodo]);

  const stockRows = useMemo(() => INVENTARIO_MATERIALES.map(({ key, label, unidad }) => {
    const inicial = existenciaInicial?.[key] ?? 0;
    const entradas = entradasNetoPeriodo[key] ?? 0;
    const consumo = consumoPeriodo[key] ?? 0;
    const final = inicial + entradas - consumo;
    const estado = final < 0 ? "deficit" : (inicial + entradas) > 0 && final / (inicial + entradas) < 0.2 ? "bajo" : "ok";
    return { key, label, unidad, inicial, entradas, consumo, final, estado };
  }), [existenciaInicial, entradasNetoPeriodo, consumoPeriodo]);

  const almacenStock = useMemo(() => {
    const inicialMap = existenciaInicial?.almacenMateriales ?? {};
    const almacenEntradas = entradasMaterial.filter((e) => e.categoria === "almacen" && inPeriod(e.fecha, periodo));
    const stock = new Map<string, { inicial: number; entradas: number; salidas: number }>();
    Object.entries(inicialMap).forEach(([mat, cant]) => stock.set(mat, { inicial: cant, entradas: 0, salidas: 0 }));
    almacenEntradas.forEach((e) => {
      const ex = stock.get(e.material) ?? { inicial: 0, entradas: 0, salidas: 0 };
      stock.set(e.material, e.tipo === "entrada" ? { ...ex, entradas: ex.entradas + e.cantidad } : { ...ex, salidas: ex.salidas + e.cantidad });
    });
    return Array.from(stock.entries()).map(([material, data]) => ({ material, ...data, final: data.inicial + data.entradas - data.salidas })).sort((a, b) => a.material.localeCompare(b.material));
  }, [existenciaInicial, entradasMaterial, periodo]);

  const materialesConProblema = useMemo(() => stockRows.filter((r) => r.estado !== "ok").length, [stockRows]);

  // ─ Control diario ─
  const controlPeriodo = controlDate.slice(0, 7);
  const existenciaInicialControl = useMemo(
    () => existenciasIniciales.find((e) => e.periodo === controlPeriodo) ?? null,
    [existenciasIniciales, controlPeriodo],
  );
  const remisionesDia = useMemo(
    () => remisiones.filter((r) => r.fecha?.includes("/") && displayToISO(r.fecha) === controlDate),
    [remisiones, controlDate],
  );
  const remisionesBeforeControl = useMemo(
    () => remisiones.filter((r) => {
      if (!r.fecha?.includes("/")) return false;
      const iso = displayToISO(r.fecha);
      return iso.startsWith(controlPeriodo) && iso < controlDate;
    }),
    [remisiones, controlPeriodo, controlDate],
  );
  const entradasDia = useMemo(
    () => entradasMaterial.filter((e) => e.categoria === "inventario" && e.fecha === controlDate),
    [entradasMaterial, controlDate],
  );
  const entradasBeforeControl = useMemo(
    () => entradasMaterial.filter((e) => e.categoria === "inventario" && e.fecha.startsWith(controlPeriodo) && e.fecha < controlDate),
    [entradasMaterial, controlPeriodo, controlDate],
  );
  const existenciaInicialDia = useMemo(() => {
    const r = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key }) => { r[key] = existenciaInicialControl?.[key] ?? 0; });
    entradasBeforeControl.forEach((e) => {
      const k = e.material as MatKey;
      if (k in r) r[k] += e.tipo === "entrada" ? e.cantidad : -e.cantidad;
    });
    remisionesBeforeControl.forEach((rem) => {
      INVENTARIO_MATERIALES.forEach(({ key, remKey }) => {
        const val = rem[remKey];
        const parsed = typeof val === "number" ? val : parseFloat(String(val ?? ""));
        if (!isNaN(parsed) && parsed > 0) r[key] -= parsed;
      });
    });
    return r;
  }, [existenciaInicialControl, entradasBeforeControl, remisionesBeforeControl]);
  const consumoDia = useMemo(() => {
    const r = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key }) => { r[key] = 0; });
    remisionesDia.forEach((rem) => {
      INVENTARIO_MATERIALES.forEach(({ key, remKey }) => {
        const val = rem[remKey];
        const parsed = typeof val === "number" ? val : parseFloat(String(val ?? ""));
        if (!isNaN(parsed) && parsed > 0) r[key] += parsed;
      });
    });
    return r;
  }, [remisionesDia]);
  const entradasNetaDia = useMemo(() => {
    const r = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key }) => { r[key] = 0; });
    entradasDia.forEach((e) => {
      const k = e.material as MatKey;
      if (k in r) r[k] += e.tipo === "entrada" ? e.cantidad : -e.cantidad;
    });
    return r;
  }, [entradasDia]);

  // ─ Movimientos ─ (existencia inicial + entradas manuales + remisiones como salidas automáticas)
  const filteredMovimientos = useMemo(() => {
    let rows: MovRow[] = [];

    // Existencia inicial como entrada virtual el día 1 del mes
    if (existenciaInicial) {
      const [y, m] = periodo.split("-");
      const fechaExi = `01/${m}/${y}`;
      INVENTARIO_MATERIALES.forEach(({ key, label, unidad }) => {
        const cantidad = existenciaInicial[key] ?? 0;
        if (cantidad > 0) rows.push({ _source: "existencia", material: key, label, cantidad, unidad, fecha: fechaExi });
      });
    }

    entradasMaterial
      .filter((e) => inPeriod(e.fecha, periodo))
      .forEach((e) => rows.push({ _source: "manual", data: e }));

    remisiones
      .filter((r) => r.fecha?.includes("/") && inPeriod(r.fecha, periodo))
      .forEach((r) => rows.push({ _source: "remision", data: r }));

    if (filterTipoMov === "entrada") rows = rows.filter((row) => row._source === "existencia" || (row._source === "manual" && row.data.tipo === "entrada"));
    if (filterTipoMov === "salida") rows = rows.filter((row) => row._source === "remision" || (row._source === "manual" && row.data.tipo === "salida"));
    if (filterCatMov === "inventario") rows = rows.filter((row) => row._source === "existencia" || row._source === "remision" || (row._source === "manual" && row.data.categoria === "inventario"));
    if (filterCatMov === "almacen") rows = rows.filter((row) => row._source === "manual" && row.data.categoria === "almacen");

    if (searchMovimientos) {
      const q = searchMovimientos.toLowerCase();
      rows = rows.filter((row) => {
        if (row._source === "existencia") return row.label.toLowerCase().includes(q);
        if (row._source === "manual") {
          const e = row.data;
          return e.material.toLowerCase().includes(q) || e.proveedor?.toLowerCase().includes(q) || e.noFactura?.toLowerCase().includes(q);
        }
        const r = row.data;
        return r.noRemision.toLowerCase().includes(q) || (r.cliente?.toLowerCase().includes(q) ?? false) || (r.mezcla?.toLowerCase().includes(q) ?? false);
      });
    }

    return [...rows].sort((a, b) => {
      const getDate = (row: MovRow) => {
        const f = row._source === "existencia" ? row.fecha : row.data.fecha;
        return f?.includes("/") ? displayToISO(f) : (f ?? "");
      };
      return getDate(b).localeCompare(getDate(a));
    });
  }, [existenciaInicial, entradasMaterial, remisiones, periodo, filterCatMov, filterTipoMov, searchMovimientos]);

  const movsPeriodo =
    entradasMaterial.filter((e) => inPeriod(e.fecha, periodo)).length +
    remisiones.filter((r) => r.fecha?.includes("/") && inPeriod(r.fecha, periodo)).length;

  const TABS: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "control",     label: "Hoy",            icon: CalendarDays,    badge: remisionesDia.length || undefined },
    { key: "remisiones",  label: "Remisiones",     icon: FlaskConical,    badge: remisionesPeriodo.length || undefined },
    { key: "inventario",  label: "Stock",           icon: Package,         badge: materialesConProblema || undefined },
    { key: "movimientos", label: "Movimientos",     icon: ArrowDownToLine, badge: movsPeriodo || undefined },
  ];

  return (
    <div className="space-y-5">
      {/* ── Top toolbar ──────────────────────────────────────────────────────── */}
      {tab !== "control" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#242424] border border-[#3A3A3A] rounded-lg overflow-hidden">
            <button
              onClick={() => { setPeriodo(adjMonth(periodo, -1)); setShowAllHistory(false); }}
              className="px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-lg leading-none"
              aria-label="Mes anterior"
            >‹</button>
            <span className="text-white text-sm font-medium capitalize min-w-[140px] text-center py-2 select-none">{periodLabel(periodo)}</span>
            <button
              onClick={() => { setPeriodo(adjMonth(periodo, +1)); setShowAllHistory(false); }}
              className="px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-lg leading-none"
              aria-label="Mes siguiente"
            >›</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isSuperAdmin && tab === "inventario" && (
              <button onClick={() => setShowExistenciaForm(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors cursor-pointer">
                <Edit2 size={13} /> Existencia inicial
              </button>
            )}
            {tab === "remisiones" && (
              <>
                <button onClick={() => exportXLSX(filtered)} disabled={filtered.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40 cursor-pointer">
                  <Download size={13} /> Excel
                </button>
                <PlantaRequired>
                  {(ok) => (
                    <button
                      onClick={() => ok && setShowRemisionForm(true)}
                      disabled={!ok}
                      title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
                      className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                    >
                      <Plus size={15} /> Nueva remisión
                    </button>
                  )}
                </PlantaRequired>
              </>
            )}
            {tab === "movimientos" && (
              <PlantaRequired>
                {(ok) => (
                  <button
                    onClick={() => ok && setShowEntradaForm(true)}
                    disabled={!ok}
                    title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
                    className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                  >
                    <Plus size={15} /> Entrada
                  </button>
                )}
              </PlantaRequired>
            )}
          </div>
        </div>
      )}

      {/* ── KPIs (solo fuera del tab Hoy) ─────────────────────────────────────── */}
      {tab !== "control" && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard title="Remisiones del período" value={String(remisionesPeriodo.length)} icon={FlaskConical} iconColor="text-[#CC2229]" subtitle={`${remisiones.length} total histórico`} />
          <KPICard title="M³ despachados" value={`${totalM3Periodo.toFixed(1)} m³`} icon={Package} iconColor="text-blue-400" iconBg="bg-blue-500/10" subtitle={`${(totalM3Periodo / Math.max(remisionesPeriodo.length, 1)).toFixed(1)} m³ promedio`} />
          <KPICard title="Clientes atendidos" value={String(uniqueClientesPeriodo)} icon={Users} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
          <KPICard title="Materiales con alerta" value={String(materialesConProblema)} icon={AlertTriangle} iconColor={materialesConProblema > 0 ? "text-amber-400" : "text-gray-500"} iconBg={materialesConProblema > 0 ? "bg-amber-500/10" : "bg-gray-500/10"} subtitle={materialesConProblema > 0 ? "Stock bajo o en déficit" : "Stock en orden"} />
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[#3A3A3A]">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${tab === key ? "border-[#CC2229] text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
            <Icon size={14} />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${key === "inventario" ? "bg-amber-500/20 text-amber-400" : "bg-[#CC2229]/15 text-[#CC2229]"}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Remisiones ───────────────────────────────────────────────────────── */}
      {tab === "remisiones" && (
        <>
          {/* Charts */}
          {m3PorDia.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4 text-sm">M³ por día · {periodLabel(periodo)}</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={m3PorDia}>
                    <defs><linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} /><stop offset="95%" stopColor="#CC2229" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="fecha" stroke="#4B5563" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Metros"]} />
                    <Area type="monotone" dataKey="metros" stroke="#CC2229" strokeWidth={2} fill="url(#gradM3)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {porMezcla.length > 0 && (
                <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4 text-sm">M³ por mezcla</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={porMezcla} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                      <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="mezcla" stroke="#4B5563" tick={{ fontSize: 10 }} width={70} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Total"]} />
                      <Bar dataKey="metros" fill="#CC2229" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-white flex-1">{filtered.length} remisión{filtered.length !== 1 ? "es" : ""}</p>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, remisión, operador…" className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-8 py-1.5 w-52 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"><X size={11} /></button>}
              </div>
              <AppSelect dark compact value={filterMezcla} onChange={(e) => setFilterMezcla(e.target.value)} wrapperClassName="">
                {mezclas.map((m) => <option key={m}>{m}</option>)}
              </AppSelect>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A]">
                    {["Fecha", "Remisión", "Cliente", "Metros", "Mezcla", "Operador", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {filtered.length === 0
                    ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-600">Sin remisiones para este filtro</td></tr>
                    : filtered.map((r) => (
                      <RemisionRow
                        key={r.id ?? r.noRemision}
                        r={r}
                        onEdit={(r) => { setEditingRemision(r); setShowRemisionForm(true); }}
                        onDelete={setConfirmDeleteRemision}
                      />
                    ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600">
                {filtered.length} remisión{filtered.length !== 1 ? "es" : ""} · {filtered.reduce((s, r) => s + r.metros, 0).toFixed(1)} m³
                {!showAllHistory && <span className="text-gray-700"> · de {remisionesPeriodo.length} en {periodLabel(periodo)}</span>}
              </p>
              {!showAllHistory && remisiones.length > remisionesPeriodo.length && (
                <button onClick={() => setShowAllHistory(true)} className="text-xs text-gray-500 hover:text-white transition-colors whitespace-nowrap cursor-pointer">
                  Ver {remisiones.length} histórico →
                </button>
              )}
              {showAllHistory && (
                <button onClick={() => setShowAllHistory(false)} className="text-xs text-[#CC2229] hover:underline whitespace-nowrap cursor-pointer">
                  ← Volver a {periodLabel(periodo)}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Inventario ────────────────────────────────────────────────────────── */}
      {tab === "inventario" && (
        <div className="space-y-4">
          {/* Status banner */}
          {!existenciaInicial && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                Sin existencia inicial para {periodLabel(periodo)}.
                {isSuperAdmin ? ' Usa el botón "Existencia inicial" para cargar el stock del período.' : " Solo el administrador puede configurarla."}
              </p>
            </div>
          )}

          {/* Producción materiales */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center gap-3">
              <FlaskConical size={15} className="text-[#CC2229]" />
              <h3 className="text-white font-semibold text-sm flex-1">Materiales de producción</h3>
              <span className="text-xs text-gray-500 capitalize">{periodLabel(periodo)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A]">
                    {["Material", "Unidad", "Inicial", "+ Entradas", "− Consumo", "Stock final", "Estado"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {stockRows.map(({ key, label, unidad, inicial, entradas, consumo, final, estado }) => (
                    <tr key={key} className="hover:bg-[#2A2A2A] transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">{label}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{unidad || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-right">{fmt(inicial)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={entradas !== 0 ? "text-emerald-400" : "text-gray-600"}>{entradas !== 0 ? (entradas > 0 ? `+${fmt(entradas)}` : fmt(entradas)) : "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={consumo > 0 ? "text-orange-400" : "text-gray-600"}>{consumo > 0 ? `−${fmt(consumo)}` : "—"}</span>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex flex-col gap-1">
                          <span className={`font-semibold font-mono text-sm ${final < 0 ? "text-red-400" : final === 0 ? "text-gray-500" : "text-white"}`}>{fmt(final)}</span>
                          <StockBar inicial={inicial} entradas={entradas} consumo={consumo} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {estado === "deficit" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">Déficit</span>}
                        {estado === "bajo"   && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Stock bajo</span>}
                        {estado === "ok"     && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#3A3A3A] text-xs text-gray-600">
              Salidas calculadas de {remisionesPeriodo.length} remisión{remisionesPeriodo.length !== 1 ? "es" : ""} del período · Para ver día por día usa la pestaña <span className="text-gray-400">Hoy</span>
            </div>
          </div>

          {/* Almacén */}
          {almacenStock.length > 0 && (
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center gap-3">
                <Boxes size={15} className="text-purple-400" />
                <h3 className="text-white font-semibold text-sm flex-1">Almacén general</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A]">
                      {["Material", "Inicial", "+ Entradas", "− Salidas", "Stock final"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {almacenStock.map(({ material, inicial, entradas, salidas, final }) => (
                      <tr key={material} className="hover:bg-[#2A2A2A] transition-colors">
                        <td className="px-4 py-3 text-gray-200 font-medium">{material}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-right">{fmt(inicial)}</td>
                        <td className="px-4 py-3 text-right font-mono"><span className={entradas > 0 ? "text-emerald-400" : "text-gray-600"}>{entradas > 0 ? `+${fmt(entradas)}` : "—"}</span></td>
                        <td className="px-4 py-3 text-right font-mono"><span className={salidas > 0 ? "text-orange-400" : "text-gray-600"}>{salidas > 0 ? `−${fmt(salidas)}` : "—"}</span></td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={`font-semibold text-sm ${final < 0 ? "text-red-400" : final === 0 ? "text-gray-500" : "text-white"}`}>{fmt(final)}</span>
                          {final < 0 && <span className="ml-2 text-[10px] text-red-400">¡déficit!</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hoy (control diario) ──────────────────────────────────────────────── */}
      {tab === "control" && (
        <div className="space-y-4">
          {/* Header: fecha + stats + acciones */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-[#CC2229]" />
                <input type="date" value={controlDate} onChange={(e) => setControlDate(e.target.value)}
                  className="bg-transparent text-white text-base font-semibold focus:outline-none cursor-pointer" />
              </div>
              <div className="h-4 w-px bg-[#3A3A3A] hidden sm:block" />
              <div className="flex items-center gap-5 text-xs text-gray-500">
                <span><span className="text-white font-bold text-sm">{remisionesDia.length}</span> remisiones (salidas)</span>
                <span><span className="text-white font-bold text-sm">{remisionesDia.reduce((s, r) => s + r.metros, 0).toFixed(1)}</span> m³</span>
                <span><span className="text-emerald-400 font-bold text-sm">{entradasDia.length}</span> mat. recibido</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setShowEntradaForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors cursor-pointer">
                  <Plus size={13} /> Entrada
                </button>
                <button onClick={() => setShowRemisionForm(true)}
                  className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer">
                  <Plus size={13} /> Nueva remisión
                </button>
              </div>
            </div>
            {!existenciaInicialControl && (
              <div className="flex items-center gap-2 pt-3 border-t border-[#3A3A3A]">
                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300">
                  Sin existencia inicial para {periodLabel(controlPeriodo)}.
                  {isSuperAdmin ? " Ve al tab Stock → Existencia inicial para configurarla." : " El cálculo parte de cero."}
                </span>
              </div>
            )}
          </div>

          {/* Balance del día */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#3A3A3A] flex items-center gap-3">
              <h3 className="text-white font-semibold text-sm flex-1">Balance del día</h3>
              <span className="text-[11px] text-gray-600">Inicial + Entradas − Salidas = Stock final</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Inicial</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">+ Entradas</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-orange-500 uppercase tracking-wider">− Salidas (remisiones)</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-white uppercase tracking-wider">= Stock final</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {INVENTARIO_MATERIALES.map(({ key, label, unidad }) => {
                    const ini = existenciaInicialDia[key] ?? 0;
                    const ent = entradasNetaDia[key] ?? 0;
                    const con = consumoDia[key] ?? 0;
                    const fin = ini + ent - con;
                    const hasData = ini !== 0 || ent !== 0 || con !== 0;
                    const estado = fin < 0 ? "deficit" : (ini + ent) > 0 && fin / (ini + ent) < 0.2 ? "bajo" : "ok";
                    return (
                      <tr key={key} className={`hover:bg-[#2A2A2A] transition-colors ${!hasData ? "opacity-40" : ""}`}>
                        <td className="px-4 py-3 text-gray-200 font-medium">
                          {label} {unidad && <span className="text-gray-600 text-xs font-normal">{unidad}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-right tabular-nums">{fmt(ini)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <span className={ent !== 0 ? (ent > 0 ? "text-emerald-400" : "text-orange-400") : "text-gray-700"}>
                            {ent !== 0 ? (ent > 0 ? `+${fmt(ent)}` : fmt(ent)) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <span className={con > 0 ? "text-orange-400 font-semibold" : "text-gray-700"}>{con > 0 ? `−${fmt(con)}` : "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-base">
                          <span className={fin < 0 ? "text-red-400" : fin === 0 ? "text-gray-600" : "text-white"}>{fmt(fin)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {hasData && estado === "deficit" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">Déficit</span>}
                          {hasData && estado === "bajo"    && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Stock bajo</span>}
                          {hasData && estado === "ok"      && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#3A3A3A] text-[11px] text-gray-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500/60 shrink-0" />
              Las salidas se calculan automáticamente de las remisiones capturadas en el día
            </div>
          </div>

          {/* Salidas (remisiones) y Entradas en dos columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Salidas = remisiones del día */}
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-[#3A3A3A] flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <h3 className="text-white font-semibold text-sm flex-1">
                  Salidas del día <span className="text-gray-500 font-normal text-xs">· remisiones despachadas</span>
                </h3>
                <span className="text-xs font-bold text-orange-400">{remisionesDia.length}</span>
              </div>
              {remisionesDia.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-10 px-5 text-center gap-2">
                  <FlaskConical size={24} className="text-gray-700" />
                  <p className="text-xs text-gray-600">Sin remisiones para esta fecha.</p>
                  <button onClick={() => setShowRemisionForm(true)} className="text-xs text-[#CC2229] hover:underline cursor-pointer">+ Capturar remisión</button>
                </div>
              ) : (
                <div className="divide-y divide-[#2A2A2A]">
                  {remisionesDia.map((r) => (
                    <div key={r.id ?? r.noRemision} className="px-5 py-3 flex items-center gap-3 hover:bg-[#2A2A2A] transition-colors">
                      <div className="shrink-0">
                        <p className="text-xs font-mono font-bold text-[#CC2229]">#{r.noRemision}</p>
                        <p className="text-[11px] text-gray-500 truncate max-w-[140px]">{r.cliente || "—"}</p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-sm font-bold text-white">{r.metros} m³</p>
                        <p className="text-[11px] text-gray-500">{r.mezcla || "—"}</p>
                      </div>
                    </div>
                  ))}
                  <div className="px-5 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-gray-600">{remisionesDia.length} remisiones · {remisionesDia.reduce((s, r) => s + r.metros, 0).toFixed(1)} m³</span>
                    <button onClick={() => setShowRemisionForm(true)} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">+ Nueva</button>
                  </div>
                </div>
              )}
            </div>

            {/* Entradas del día */}
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-[#3A3A3A] flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <h3 className="text-white font-semibold text-sm flex-1">
                  Entradas del día <span className="text-gray-500 font-normal text-xs">· materiales recibidos</span>
                </h3>
                <span className="text-xs font-bold text-emerald-400">{entradasDia.length}</span>
              </div>
              {entradasDia.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-10 px-5 text-center gap-2">
                  <ArrowDownToLine size={24} className="text-gray-700" />
                  <p className="text-xs text-gray-600">Sin entradas registradas para esta fecha.</p>
                  <button onClick={() => setShowEntradaForm(true)} className="text-xs text-emerald-400 hover:underline cursor-pointer">+ Registrar entrada</button>
                </div>
              ) : (
                <div className="divide-y divide-[#2A2A2A]">
                  {entradasDia.map((e) => (
                    <div key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#2A2A2A] transition-colors">
                      <div className="shrink-0 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-200 truncate">{INVENTARIO_MATERIALES.find((m) => m.key === e.material)?.label ?? e.material}</p>
                        <p className="text-[11px] text-gray-500">{e.proveedor || "Sin proveedor"}</p>
                      </div>
                      <span className={`text-sm font-bold font-mono shrink-0 ${e.tipo === "entrada" ? "text-emerald-400" : "text-orange-400"}`}>
                        {e.tipo === "entrada" ? "+" : "−"}{fmt(e.cantidad)} {e.unidad}
                      </span>
                    </div>
                  ))}
                  <div className="px-5 py-2.5 flex justify-end">
                    <button onClick={() => setShowEntradaForm(true)} className="text-xs text-gray-500 hover:text-white transition-colors cursor-pointer">+ Registrar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Movimientos ───────────────────────────────────────────────────────── */}
      {tab === "movimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-white flex-1">{filteredMovimientos.length} movimiento{filteredMovimientos.length !== 1 ? "s" : ""}</p>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input value={searchMovimientos} onChange={(e) => setSearchMovimientos(e.target.value)} placeholder="Material, proveedor, factura…" className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-8 py-1.5 w-48 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
              {searchMovimientos && <button onClick={() => setSearchMovimientos("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"><X size={11} /></button>}
            </div>
            {/* Filter chips */}
            <div className="flex gap-1">
              {(["Todos", "entrada", "salida"] as const).map((t) => (
                <button key={t} onClick={() => setFilterTipoMov(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterTipoMov === t ? "bg-[#CC2229] text-white" : "bg-[#1A1A1A] border border-[#3A3A3A] text-gray-400 hover:text-white"}`}>
                  {t === "Todos" ? "Todos" : t === "entrada" ? "↓ Entradas" : "↑ Salidas"}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["Todos", "inventario", "almacen"] as const).map((c) => (
                <button key={c} onClick={() => setFilterCatMov(c)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filterCatMov === c ? "bg-[#3A3A3A] text-white" : "bg-[#1A1A1A] border border-[#3A3A3A] text-gray-400 hover:text-white"}`}>
                  {c === "Todos" ? "Todas" : c === "inventario" ? "Producción" : "Almacén"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Fecha", "Tipo", "Categoría", "Material", "Cantidad", "Proveedor", "Factura", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {filteredMovimientos.length === 0
                  ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-gray-600">Sin movimientos en {periodLabel(periodo)}. Las remisiones del período aparecen automáticamente como salidas.</td></tr>
                  : filteredMovimientos.map((row, idx) => {
                    if (row._source === "existencia") {
                      return (
                        <tr key={`exi-${row.material}`} className="hover:bg-[#2A2A2A] transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{row.fecha}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <ArrowDownToLine size={11} /> Entrada
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                              Stock inicial
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-200">{row.label}</td>
                          <td className="px-4 py-3 text-white font-mono font-semibold">{fmt(row.cantidad)}{row.unidad ? ` ${row.unidad}` : ""}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">—</td>
                          <td className="px-4 py-3 text-gray-600 text-xs font-mono capitalize">{periodLabel(periodo)}</td>
                          <td className="px-4 py-3 text-gray-700 text-[10px]">Auto</td>
                        </tr>
                      );
                    }
                    if (row._source === "remision") {
                      const r = row.data;
                      return (
                        <tr key={r.id ?? r.noRemision} className="hover:bg-[#2A2A2A] transition-colors">
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs font-semibold text-orange-400">
                              <ArrowUpToLine size={11} /> Salida
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-500/10 border-orange-500/20 text-orange-300">
                              Remisión
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-200">{r.mezcla || "Concreto"}</td>
                          <td className="px-4 py-3 text-white font-mono font-semibold">{r.metros} m³</td>
                          <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-[160px]">{r.cliente || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">#{r.noRemision}</td>
                          <td className="px-4 py-3 text-gray-700 text-[10px]">Auto</td>
                        </tr>
                      );
                    }
                    const e = row.data;
                    return (
                      <tr key={e.id ?? idx} className="hover:bg-[#2A2A2A] transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{e.fecha}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs font-semibold ${e.tipo === "entrada" ? "text-emerald-400" : "text-orange-400"}`}>
                            {e.tipo === "entrada" ? <><ArrowDownToLine size={11} /> Entrada</> : <><ArrowUpToLine size={11} /> Salida</>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${e.categoria === "inventario" ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-purple-500/10 border-purple-500/20 text-purple-300"}`}>
                            {e.categoria === "inventario" ? "Producción" : "Almacén"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-200">{e.categoria === "inventario" ? (INVENTARIO_MATERIALES.find((m) => m.key === e.material)?.label ?? e.material) : e.material}</td>
                        <td className="px-4 py-3 text-white font-mono font-semibold">{fmt(e.cantidad)}{e.unidad ? ` ${e.unidad}` : ""}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{e.proveedor || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{e.noFactura || "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setConfirmDeleteMovimiento(e)}
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            aria-label="Eliminar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs text-gray-600">
            <span>{filteredMovimientos.length} movimiento{filteredMovimientos.length !== 1 ? "s" : ""} en {periodLabel(periodo)}</span>
            <span className="text-gray-700">Salidas = remisiones automáticas · Entradas = material recibido</span>
          </div>
        </div>
      )}

      {/* Drawers / Modals */}
      <RemisionDrawer open={showRemisionForm} onClose={() => { setShowRemisionForm(false); setEditingRemision(undefined); }} onSave={handleSaveRemision} initial={editingRemision} clientes={clientesList} operadores={operadoresList} nextRemision={nextRemision} />
      <EntradaDrawer open={showEntradaForm} onClose={() => setShowEntradaForm(false)} onSave={handleSaveEntrada} />
      {isSuperAdmin && (
        <ExistenciaModal open={showExistenciaForm} onClose={() => setShowExistenciaForm(false)} periodo={periodo} current={existenciaInicial} onSave={handleSaveExistencia} />
      )}

      {confirmDeleteRemision && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteRemision(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar remisión</h3>
            <p className="text-xs text-gray-500 mb-5">
              ¿Eliminar remisión <span className="text-gray-300 font-medium">{confirmDeleteRemision.noRemision}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteRemision(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteRemision(confirmDeleteRemision)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteMovimiento && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteMovimiento(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar movimiento</h3>
            <p className="text-xs text-gray-500 mb-5">
              ¿Eliminar movimiento de <span className="text-gray-300 font-medium">{confirmDeleteMovimiento.material}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteMovimiento(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteMovimiento(confirmDeleteMovimiento)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
