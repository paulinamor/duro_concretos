"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ArrowDownToLine, Boxes, ChevronDown, ChevronUp, Download, Edit2,
  FlaskConical, Package, Plus, Search, Truck, Users, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import ClienteCombobox from "@/components/ClienteCombobox";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, getStoredSession, withPlantaTag } from "@/lib/auth";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Remision {
  id?: string;
  fecha: string;
  noRemision: string;
  cliente: string;
  metros: number;
  mezcla: string;
  cr: number | null;
  operador: string;
  cemento: number | null;
  grava: number | null;
  arena4: number | null;
  arena5: number | null;
  agua: number | null;
  aditivo: number | null;
  acelerante: string;
  imper: string;
  fibra: number | null;
  color: string;
  ligsthone: string;
  planta?: string;
}

interface EntradaMaterial {
  id?: string;
  fecha: string;
  material: string;
  cantidad: number;
  unidad: string;
  tipo: "entrada" | "salida";
  proveedor: string;
  noFactura: string;
  observaciones: string;
  categoria: "inventario" | "almacen";
  planta?: string;
}

interface ExistenciaInicial {
  id?: string;
  periodo: string;
  cemento: number;
  grava: number;
  arena4: number;
  arena5: number;
  aditivo: number;
  hr25: number;
  imper: number;
  costalFibra: number;
  colorCubetas: number;
  almacenMateriales?: Record<string, number>;
  planta?: string;
}

interface FormState {
  fecha: string; noRemision: string; cliente: string; metros: string;
  mezcla: string; cr: string; operador: string;
  cemento: string; grava: string; arena4: string; arena5: string;
  agua: string; aditivo: string; acelerante: string; imper: string;
  fibra: string; color: string; ligsthone: string;
}

interface EntradaFormState {
  fecha: string;
  categoria: "inventario" | "almacen";
  material: string;
  tipo: "entrada" | "salida";
  cantidad: string;
  unidad: string;
  proveedor: string;
  noFactura: string;
  observaciones: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INVENTARIO_MATERIALES: { key: MatKey; label: string; unidad: string; remKey: keyof Remision }[] = [
  { key: "cemento",      label: "Cemento",          unidad: "kg",       remKey: "cemento" },
  { key: "grava",        label: "Grava",             unidad: "kg",       remKey: "grava" },
  { key: "arena4",       label: "Arena 4",           unidad: "kg",       remKey: "arena4" },
  { key: "arena5",       label: "Arena 5",           unidad: "kg",       remKey: "arena5" },
  { key: "aditivo",      label: "Aditivo",           unidad: "L",        remKey: "aditivo" },
  { key: "hr25",         label: "HR25",              unidad: "",         remKey: "acelerante" },
  { key: "imper",        label: "Imper",             unidad: "",         remKey: "imper" },
  { key: "costalFibra",  label: "Costales Fibra",    unidad: "costales", remKey: "fibra" },
  { key: "colorCubetas", label: "Color / Cubetas",   unidad: "cubetas",  remKey: "color" },
];

type MatKey = "cemento" | "grava" | "arena4" | "arena5" | "aditivo" | "hr25" | "imper" | "costalFibra" | "colorCubetas";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function currentPeriod() { return new Date().toISOString().slice(0, 7); }
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
const SUPERADMIN = "leonardo@lpsoft.mx";

function getPlantaSlug(): string {
  const s = getStoredSession();
  return (s?.planta ?? "all").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
}
function emptyForm(): FormState {
  return {
    fecha: todayISO(), noRemision: "", cliente: "", metros: "",
    mezcla: "", cr: "", operador: "",
    cemento: "", grava: "", arena4: "", arena5: "", agua: "", aditivo: "",
    acelerante: "", imper: "", fibra: "", color: "", ligsthone: "",
  };
}
function emptyEntradaForm(): EntradaFormState {
  return { fecha: todayISO(), categoria: "inventario", material: "", tipo: "entrada", cantidad: "", unidad: "", proveedor: "", noFactura: "", observaciones: "" };
}
function n(v: string): number | null { const p = parseFloat(v); return isNaN(p) ? null : p; }
function num(v: string): number { return parseFloat(v) || 0; }
function fmt(v: number): string {
  if (v === 0) return "0";
  return v.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}
function exportCSV(rows: Remision[]) {
  const headers = ["FECHA","REMISION","CLIENTE","METROS","CONCRETO","CR","OPERADOR","CEMENTO","GRAVA","ARENA 4","ARENA 5","AGUA","ADITIVO","ACELERANTE(AFA)","IMPER","FIBRA","COLOR","LIGSTHONE"];
  const lines = rows.map((r) => [r.fecha, r.noRemision, r.cliente, r.metros, r.mezcla, r.cr ?? "", r.operador, r.cemento ?? "", r.grava ?? "", r.arena4 ?? "", r.arena5 ?? "", r.agua ?? "", r.aditivo ?? "", r.acelerante, r.imper, r.fibra ?? "", r.color, r.ligsthone].map((v) => `"${v}"`).join(","));
  const blob = new Blob(["﻿" + [headers.join(","), ...lines].join("\n")], { type: "text/csv" });
  Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "remisiones.csv" }).click();
}

const tooltipStyle = { backgroundColor: "#1A1F2B", border: "1px solid #252D3D", borderRadius: "8px", color: "#fff", fontSize: "12px" };
const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── FormDrawer (Remision) ────────────────────────────────────────────────────

function FormDrawer({ open, onClose, onSave, initial, clientes, operadores, nextRemision }: {
  open: boolean; onClose: () => void; onSave: (r: Remision) => Promise<void>;
  initial?: Remision;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  nextRemision: string;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fecha: initial.fecha ? displayToISO(initial.fecha) : todayISO(),
        noRemision: initial.noRemision, cliente: initial.cliente,
        metros: String(initial.metros), mezcla: initial.mezcla,
        cr: initial.cr != null ? String(initial.cr) : "",
        operador: initial.operador,
        cemento: initial.cemento != null ? String(initial.cemento) : "",
        grava: initial.grava != null ? String(initial.grava) : "",
        arena4: initial.arena4 != null ? String(initial.arena4) : "",
        arena5: initial.arena5 != null ? String(initial.arena5) : "",
        agua: initial.agua != null ? String(initial.agua) : "",
        aditivo: initial.aditivo != null ? String(initial.aditivo) : "",
        acelerante: initial.acelerante, imper: initial.imper,
        fibra: initial.fibra != null ? String(initial.fibra) : "",
        color: initial.color, ligsthone: initial.ligsthone,
      });
    } else {
      setForm({ ...emptyForm(), noRemision: nextRemision });
    }
  }, [open, initial, nextRemision]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.fecha || !form.noRemision.trim() || !form.metros) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        fecha: isoToDisplay(form.fecha), noRemision: form.noRemision.trim(),
        cliente: form.cliente.trim(), metros: parseFloat(form.metros) || 0,
        mezcla: form.mezcla.trim(), cr: n(form.cr), operador: form.operador.trim(),
        cemento: n(form.cemento), grava: n(form.grava), arena4: n(form.arena4),
        arena5: n(form.arena5), agua: n(form.agua), aditivo: n(form.aditivo),
        acelerante: form.acelerante.trim(), imper: form.imper.trim(),
        fibra: n(form.fibra), color: form.color.trim(), ligsthone: form.ligsthone.trim(),
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
            <h2 className="text-sm font-semibold text-gray-900">{initial ? "Editar remisión" : "Registrar remisión"}</h2>
            <p className="text-xs text-gray-500">Despacho de concreto</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Despacho</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Fecha <span className="text-[#CC2229]">*</span></label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
              <div><label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label><input type="text" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value)} placeholder="18945" className={inp} /></div>
              <div className="col-span-2">
                <ClienteCombobox
                  label="Cliente"
                  value={form.cliente}
                  onChange={(v) => set("cliente", v)}
                  options={clientes.map((c) => c.nombreComercial || c.razonSocial)}
                  placeholder="Buscar o escribir cliente…"
                />
              </div>
              <div><label className={lbl}>Metros m³ <span className="text-[#CC2229]">*</span></label><input type="number" step="0.5" min="0" value={form.metros} onChange={(e) => set("metros", e.target.value)} placeholder="7.0" className={inp} /></div>
              <div><label className={lbl}>Mezcla</label><input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="250-20-14" className={inp} /></div>
              <div><label className={lbl}>CR</label><input type="number" value={form.cr} onChange={(e) => set("cr", e.target.value)} placeholder="350" className={inp} /></div>
              <div>
                <ClienteCombobox
                  label="Operador"
                  value={form.operador}
                  onChange={(v) => set("operador", v)}
                  options={operadores.map((o) => o.nombre)}
                  placeholder="Buscar o escribir…"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Materiales base</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              {([{ key: "cemento", label: "Cemento (kg)" }, { key: "grava", label: "Grava (kg)" }, { key: "arena4", label: "Arena 4 (kg)" }, { key: "arena5", label: "Arena 5 (kg)" }, { key: "agua", label: "Agua (L)" }, { key: "aditivo", label: "Aditivo" }] as const).map(({ key, label }) => (
                <div key={key}><label className={lbl}>{label}</label><input type="number" step="0.001" min="0" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0" className={inp} /></div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Aditivos especiales</span><span className="h-px flex-1 bg-gray-100" /></div>
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
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.noRemision.trim() || !form.metros} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20">
            {saving ? "Guardando…" : "Guardar remisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EntradaForm ──────────────────────────────────────────────────────────────

function EntradaForm({ open, onClose, onSave }: {
  open: boolean; onClose: () => void; onSave: (e: EntradaMaterial) => Promise<void>;
}) {
  const [form, setForm] = useState<EntradaFormState>(emptyEntradaForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(emptyEntradaForm()); }, [open]);
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
            <h2 className="text-sm font-semibold text-gray-900">Entrada de material</h2>
            <p className="text-xs text-gray-500">Compra o recepción</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Categoría</label>
              <select value={form.categoria} onChange={(e) => { set("categoria", e.target.value); set("material", ""); set("unidad", ""); }} className={inp}>
                <option value="inventario">Inventario</option>
                <option value="almacen">Almacén</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={inp}>
                <option value="entrada">Entrada (compra)</option>
                <option value="salida">Salida (consumo)</option>
              </select>
            </div>
          </div>
          <div><label className={lbl}>Fecha <span className="text-[#CC2229]">*</span></label><input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} /></div>
          <div>
            <label className={lbl}>Material <span className="text-[#CC2229]">*</span></label>
            {form.categoria === "inventario" ? (
              <select value={form.material} onChange={(e) => set("material", e.target.value)} className={inp}>
                <option value="">Seleccionar material…</option>
                {INVENTARIO_MATERIALES.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.unidad})</option>)}
              </select>
            ) : (
              <input type="text" value={form.material} onChange={(e) => set("material", e.target.value)} placeholder="Ej: Diesel, Lubricante, Bolsas…" className={inp} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Cantidad <span className="text-[#CC2229]">*</span></label><input type="number" step="0.001" min="0" value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)} placeholder="0" className={inp} /></div>
            <div><label className={lbl}>Unidad</label><input type="text" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="kg, L, ton…" className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Proveedor</label><input type="text" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Nombre del proveedor" className={inp} /></div>
            <div><label className={lbl}>No. Factura</label><input type="text" value={form.noFactura} onChange={(e) => set("noFactura", e.target.value)} placeholder="—" className={inp} /></div>
          </div>
          <div><label className={lbl}>Observaciones</label><textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={3} placeholder="Notas adicionales…" className={`${inp} resize-none`} /></div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.material.trim() || !form.cantidad} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExistenciaInicialForm ────────────────────────────────────────────────────

function ExistenciaInicialForm({ open, onClose, periodo, current, onSave }: {
  open: boolean; onClose: () => void; periodo: string;
  current: ExistenciaInicial | null;
  onSave: (e: Omit<ExistenciaInicial, "id">) => Promise<void>;
}) {
  const emptyValues = (): Record<MatKey, string> => ({ cemento: "", grava: "", arena4: "", arena5: "", aditivo: "", hr25: "", imper: "", costalFibra: "", colorCubetas: "" });
  const [values, setValues] = useState<Record<MatKey, string>>(emptyValues);
  const [almacenRows, setAlmacenRows] = useState<{ material: string; cantidad: string }[]>([{ material: "", cantidad: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (current) {
      setValues({
        cemento: current.cemento ? String(current.cemento) : "",
        grava: current.grava ? String(current.grava) : "",
        arena4: current.arena4 ? String(current.arena4) : "",
        arena5: current.arena5 ? String(current.arena5) : "",
        aditivo: current.aditivo ? String(current.aditivo) : "",
        hr25: current.hr25 ? String(current.hr25) : "",
        imper: current.imper ? String(current.imper) : "",
        costalFibra: current.costalFibra ? String(current.costalFibra) : "",
        colorCubetas: current.colorCubetas ? String(current.colorCubetas) : "",
      });
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
      await onSave({
        periodo,
        cemento: num(values.cemento), grava: num(values.grava),
        arena4: num(values.arena4), arena5: num(values.arena5),
        aditivo: num(values.aditivo), hr25: num(values.hr25),
        imper: num(values.imper), costalFibra: num(values.costalFibra),
        colorCubetas: num(values.colorCubetas), almacenMateriales,
      });
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
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Materiales inventario</span><span className="h-px flex-1 bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-3">
              {INVENTARIO_MATERIALES.map(({ key, label, unidad }) => (
                <div key={key}>
                  <label className={lbl}>{label} ({unidad})</label>
                  <input type="number" step="0.001" min="0" value={values[key]} onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" className={inp} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Materiales almacén</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            {almacenRows.length > 0 && (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-1">Material</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-1">Cantidad</span>
              </div>
            )}
            <div className="space-y-2">
              {almacenRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_32px] items-center gap-2">
                  <input
                    type="text"
                    value={row.material}
                    onChange={(e) => { const next = [...almacenRows]; next[i] = { ...next[i], material: e.target.value }; setAlmacenRows(next); }}
                    placeholder="Ej: Aditivo, Costales…"
                    className={inp}
                  />
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={row.cantidad}
                    onChange={(e) => { const next = [...almacenRows]; next[i] = { ...next[i], cantidad: e.target.value }; setAlmacenRows(next); }}
                    placeholder="0"
                    className={inp}
                  />
                  <button
                    onClick={() => setAlmacenRows((rows) => rows.filter((_, j) => j !== i))}
                    className="flex items-center justify-center h-10 w-8 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setAlmacenRows((r) => [...r, { material: "", cantidad: "" }])}
                className="flex items-center gap-1.5 text-xs text-[#CC2229] font-medium hover:text-[#B01E24] transition-colors mt-1"
              >
                <Plus size={14} /> Agregar material
              </button>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20">
            {saving ? "Guardando…" : "Guardar existencia"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

function TableRow({ r }: { r: Remision }) {
  const [expanded, setExpanded] = useState(false);
  const totalMat = [r.cemento, r.grava, r.arena4, r.arena5, r.agua, r.aditivo, r.fibra].reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    <>
      <tr className="cursor-pointer transition-colors" onClick={() => setExpanded((p) => !p)}>
        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{r.fecha}</td>
        <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-semibold">{r.noRemision}</td>
        <td className="px-4 py-3 text-gray-200 text-sm max-w-[160px] truncate">{r.cliente}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{r.metros} m³</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300">{r.mezcla || "—"}</span>
        </td>
        <td className="px-4 py-3 text-gray-300 text-sm">{r.operador}</td>
        <td className="px-4 py-3 text-gray-500 text-xs tabular-nums">{totalMat > 0 ? `${totalMat.toFixed(0)} kg` : "—"}</td>
        <td className="px-4 py-3">{expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}</td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Cemento", value: r.cemento, unit: "kg" }, { label: "Grava", value: r.grava, unit: "kg" },
                { label: "Arena 4", value: r.arena4, unit: "kg" }, { label: "Arena 5", value: r.arena5, unit: "kg" },
                { label: "Agua", value: r.agua, unit: "L" }, { label: "Aditivo", value: r.aditivo, unit: "" },
                { label: "Acelerante", value: r.acelerante || null, unit: "" }, { label: "Imper.", value: r.imper || null, unit: "" },
                { label: "Fibra", value: r.fibra, unit: "kg" }, { label: "Color", value: r.color || null, unit: "" },
                { label: "Ligsthone", value: r.ligsthone || null, unit: "" }, { label: "CR", value: r.cr, unit: "" },
              ].map(({ label, value, unit }) => value != null ? (
                <div key={label} className="bg-[#0F1115] rounded-lg p-2.5 border border-[#252D3D]">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-200 font-mono">{value}{unit ? ` ${unit}` : ""}</p>
                </div>
              ) : null)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [tab, setTab] = useState<"remisiones" | "inventario" | "almacen" | "entradas">("remisiones");
  const [periodo, setPeriodo] = useState(currentPeriod());
  const isSuperAdmin = getStoredSession()?.email?.toLowerCase() === SUPERADMIN;

  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [entradasMaterial, setEntradasMaterial] = useState<EntradaMaterial[]>([]);
  const [existenciasIniciales, setExistenciasIniciales] = useState<ExistenciaInicial[]>([]);
  const [clientesList, setClientesList] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);

  const [showRemisionForm, setShowRemisionForm] = useState(false);
  const [showEntradaForm, setShowEntradaForm] = useState(false);
  const [showExistenciaForm, setShowExistenciaForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMezcla, setFilterMezcla] = useState("Todos");
  const [searchEntradas, setSearchEntradas] = useState("");
  const [filterCat, setFilterCat] = useState<"Todos" | "inventario" | "almacen">("Todos");

  useEffect(() => {
    getCollectionDocs<Remision>(COLLECTIONS.remisiones).then((data) => setRemisiones(filterByPlanta(data)));
    getCollectionDocs<EntradaMaterial>(COLLECTIONS.entradasMaterial).then((data) => setEntradasMaterial(filterByPlanta(data)));
    getCollectionDocs<ExistenciaInicial>(COLLECTIONS.existenciasIniciales).then((data) => setExistenciasIniciales(filterByPlanta(data)));
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((list) =>
      setClientesList(list.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial })))
    );
    getCollectionDocs<Operador>(COLLECTIONS.operadores).then((list) =>
      setOperadoresList(list.filter((o) => o.estatus === "Activo").map((o) => ({ id: o.id, nombre: o.nombre })))
    );
  }, []);

  const nextRemision = useMemo(() => {
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  const handleSaveRemision = async (r: Remision) => {
    const id = r.id ?? `rem-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    await upsertDocument(COLLECTIONS.remisiones, id, withPlantaTag(data));
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...r, id };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [updated, ...prev];
    });
  };

  const handleSaveEntrada = async (e: EntradaMaterial) => {
    const id = `em-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { id: _id, ...data } = e;
    await upsertDocument(COLLECTIONS.entradasMaterial, id, withPlantaTag(data));
    setEntradasMaterial((prev) => [{ ...e, id }, ...prev]);
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
  const filtered = useMemo(() => {
    let rows = remisiones;
    if (search) { const q = search.toLowerCase(); rows = rows.filter((r) => r.cliente.toLowerCase().includes(q) || r.noRemision.includes(q) || r.operador.toLowerCase().includes(q)); }
    if (filterMezcla !== "Todos") rows = rows.filter((r) => r.mezcla === filterMezcla);
    return rows;
  }, [remisiones, search, filterMezcla]);

  const totalM3 = remisiones.reduce((s, r) => s + r.metros, 0);
  const uniqueClientes = new Set(remisiones.map((r) => r.cliente)).size;
  const totalCemento = remisiones.reduce((s, r) => s + (r.cemento ?? 0), 0);

  const m3PorDia = useMemo(() => {
    const map = new Map<string, number>();
    remisiones.forEach((r) => { const iso = r.fecha?.includes("/") ? displayToISO(r.fecha) : ""; if (!iso) return; map.set(iso, (map.get(iso) ?? 0) + r.metros); });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([fecha, metros]) => ({ fecha: fecha.slice(5).replace("-", "/"), metros: parseFloat(metros.toFixed(1)) }));
  }, [remisiones]);

  const porMezcla = useMemo(() => {
    const map = new Map<string, number>();
    remisiones.forEach((r) => { const k = r.mezcla || "Sin especificar"; map.set(k, (map.get(k) ?? 0) + r.metros); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([mezcla, metros]) => ({ mezcla, metros: parseFloat(metros.toFixed(1)) }));
  }, [remisiones]);

  // ─ Inventario ─
  const existenciaInicial = useMemo(() => existenciasIniciales.find((e) => e.periodo === periodo) ?? null, [existenciasIniciales, periodo]);

  const consumoPeriodo = useMemo(() => {
    const rems = remisiones.filter((r) => inPeriod(r.fecha, periodo));
    const result = {} as Record<MatKey, number>;
    INVENTARIO_MATERIALES.forEach(({ key, remKey }) => {
      result[key] = rems.reduce((s, r) => {
        const val = r[remKey];
        const parsed = typeof val === "number" ? val : parseFloat(String(val ?? ""));
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0);
    });
    return result;
  }, [remisiones, periodo]);

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

  // ─ Almacén ─
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

  // ─ Entradas tab ─
  const filteredEntradas = useMemo(() => {
    let rows = entradasMaterial;
    if (filterCat !== "Todos") rows = rows.filter((e) => e.categoria === filterCat);
    if (searchEntradas) { const q = searchEntradas.toLowerCase(); rows = rows.filter((e) => e.material.toLowerCase().includes(q) || e.proveedor.toLowerCase().includes(q) || e.noFactura.toLowerCase().includes(q)); }
    return [...rows].sort((a, b) => {
      const isoA = a.fecha?.includes("/") ? displayToISO(a.fecha) : "";
      const isoB = b.fecha?.includes("/") ? displayToISO(b.fecha) : "";
      return isoB.localeCompare(isoA);
    });
  }, [entradasMaterial, filterCat, searchEntradas]);

  const remisionesEnPeriodo = remisiones.filter((r) => inPeriod(r.fecha, periodo)).length;

  const TABS = [
    { key: "remisiones" as const, label: "Remisiones", icon: FlaskConical },
    { key: "inventario" as const, label: "Inventario Materiales", icon: Package },
    { key: "almacen" as const, label: "Almacén", icon: Boxes },
    { key: "entradas" as const, label: "Entradas de Material", icon: ArrowDownToLine },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Producción / Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control de materiales y remisiones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(tab === "inventario" || tab === "almacen") && (
            <>
              <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60" />
              {isSuperAdmin && (
                <button onClick={() => setShowExistenciaForm(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors">
                  <Edit2 size={13} /> Existencia inicial
                </button>
              )}
            </>
          )}
          {tab === "entradas" && (
            <button onClick={() => setShowEntradaForm(true)} className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20">
              <Plus size={16} /> Nueva entrada
            </button>
          )}
          {tab === "remisiones" && (
            <>
              <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40">
                <Download size={14} /> Exportar CSV
              </button>
              <button onClick={() => setShowRemisionForm(true)} className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20">
                <Plus size={16} /> Nueva remisión
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#3A3A3A] overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === key ? "border-[#CC2229] text-[#CC2229]" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Remisiones ───────────────────────────────────────────────────────── */}
      {tab === "remisiones" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total remisiones" value={String(remisiones.length)} icon={Package} iconColor="text-[#CC2229]" />
            <KPICard title="Total m³ despachados" value={`${totalM3.toFixed(1)} m³`} icon={FlaskConical} iconColor="text-blue-400" />
            <KPICard title="Clientes únicos" value={String(uniqueClientes)} icon={Users} iconColor="text-green-400" />
            <KPICard title="Cemento total (kg)" value={totalCemento > 0 ? totalCemento.toLocaleString("es-MX") : "—"} icon={Truck} iconColor="text-yellow-400" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm">M³ despachados por día</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={m3PorDia}>
                  <defs><linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} /><stop offset="95%" stopColor="#CC2229" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="fecha" stroke="#4B5563" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#4B5563" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Metros"]} />
                  <Area type="monotone" dataKey="metros" stroke="#CC2229" strokeWidth={2} fill="url(#gradM3)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 text-sm">M³ por tipo de mezcla</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porMezcla} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                  <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="mezcla" stroke="#4B5563" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Total"]} />
                  <Bar dataKey="metros" fill="#CC2229" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
              <h3 className="text-white font-semibold text-sm flex-1">Remisiones</h3>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, remisión, operador…" className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-52 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
              </div>
              <select value={filterMezcla} onChange={(e) => setFilterMezcla(e.target.value)} className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
                {mezclas.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A]">
                    {["Fecha", "Remisión", "Cliente", "Metros", "Mezcla", "Operador", "Material total", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-600">Sin remisiones registradas.</td></tr>
                  ) : filtered.map((r) => <TableRow key={r.id ?? r.noRemision} r={r} />)}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#3A3A3A]">
              <p className="text-xs text-gray-600">{filtered.length} remisión{filtered.length !== 1 ? "es" : ""} · {filtered.reduce((s, r) => s + r.metros, 0).toFixed(1)} m³</p>
            </div>
          </div>
        </>
      )}

      {/* ── Inventario Materiales ─────────────────────────────────────────────── */}
      {tab === "inventario" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center gap-3 flex-wrap">
            <h3 className="text-white font-semibold text-sm flex-1">Resumen de materiales</h3>
            <span className="text-xs text-gray-500 capitalize">{periodLabel(periodo)}</span>
            {existenciaInicial ? (
              <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5 font-medium">Existencia inicial cargada</span>
            ) : (
              <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2 py-0.5 font-medium">
                {isSuperAdmin ? "Sin existencia inicial — cárgala el día 1" : "Sin existencia inicial (solo admin)"}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Material", "Unidad", "Exist. Inicial", "+ Entradas", "− Consumo", "= Exist. Final"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {INVENTARIO_MATERIALES.map(({ key, label, unidad }) => {
                  const inicial = existenciaInicial?.[key] ?? 0;
                  const entradas = entradasNetoPeriodo[key] ?? 0;
                  const consumo = consumoPeriodo[key] ?? 0;
                  const final = inicial + entradas - consumo;
                  return (
                    <tr key={key} className="transition-colors">
                      <td className="px-4 py-3 text-gray-200 text-sm font-medium">{label}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{unidad}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm font-mono text-right">{fmt(inicial)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        <span className={entradas > 0 ? "text-green-400" : entradas < 0 ? "text-red-400" : "text-gray-600"}>{entradas !== 0 ? (entradas > 0 ? `+${fmt(entradas)}` : fmt(entradas)) : "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        <span className={consumo > 0 ? "text-orange-400" : "text-gray-600"}>{consumo > 0 ? `−${fmt(consumo)}` : "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={`font-semibold text-sm ${final < 0 ? "text-red-400" : final === 0 ? "text-gray-500" : "text-white"}`}>{fmt(final)}</span>
                        {final < 0 && <span className="ml-1.5 text-[10px] text-red-400 font-normal">¡déficit!</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#3A3A3A]">
            <p className="text-xs text-gray-600">Consumo calculado de {remisionesEnPeriodo} remisión{remisionesEnPeriodo !== 1 ? "es" : ""} del período</p>
          </div>
        </div>
      )}

      {/* ── Almacén ──────────────────────────────────────────────────────────── */}
      {tab === "almacen" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center gap-3">
            <h3 className="text-white font-semibold text-sm flex-1">Materiales almacén</h3>
            <span className="text-xs text-gray-500 capitalize">{periodLabel(periodo)}</span>
          </div>
          {almacenStock.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Boxes size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">Sin materiales de almacén para este período</p>
              <p className="text-xs text-gray-600">Usa "Existencia inicial" para definir el stock inicial, o registra entradas desde la pestaña Entradas de Material.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A]">
                    {["Material", "Exist. Inicial", "+ Entradas", "− Salidas", "= Stock Final"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {almacenStock.map(({ material, inicial, entradas, salidas, final }) => (
                    <tr key={material} className="transition-colors">
                      <td className="px-4 py-3 text-gray-200 text-sm font-medium">{material}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm font-mono text-right">{fmt(inicial)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm"><span className={entradas > 0 ? "text-green-400" : "text-gray-600"}>{entradas > 0 ? `+${fmt(entradas)}` : "—"}</span></td>
                      <td className="px-4 py-3 text-right font-mono text-sm"><span className={salidas > 0 ? "text-orange-400" : "text-gray-600"}>{salidas > 0 ? `−${fmt(salidas)}` : "—"}</span></td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={`font-semibold text-sm ${final < 0 ? "text-red-400" : final === 0 ? "text-gray-500" : "text-white"}`}>{fmt(final)}</span>
                        {final < 0 && <span className="ml-1.5 text-[10px] text-red-400">¡déficit!</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Entradas de Material ─────────────────────────────────────────────── */}
      {tab === "entradas" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
            <h3 className="text-white font-semibold text-sm flex-1">Registro de entradas</h3>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchEntradas} onChange={(e) => setSearchEntradas(e.target.value)} placeholder="Material, proveedor, factura…" className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-48 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
            </div>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as typeof filterCat)} className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
              <option value="Todos">Todas las categorías</option>
              <option value="inventario">Inventario</option>
              <option value="almacen">Almacén</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Fecha", "Categoría", "Material", "Tipo", "Cantidad", "Proveedor", "Factura"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {filteredEntradas.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-600">Sin entradas registradas. Usa "Nueva entrada" para registrar una compra.</td></tr>
                ) : filteredEntradas.map((e) => (
                  <tr key={e.id} className="transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{e.fecha}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${e.categoria === "inventario" ? "bg-blue-500/10 border border-blue-500/20 text-blue-300" : "bg-purple-500/10 border border-purple-500/20 text-purple-300"}`}>
                        {e.categoria === "inventario" ? "Inventario" : "Almacén"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-sm">{e.categoria === "inventario" ? (INVENTARIO_MATERIALES.find((m) => m.key === e.material)?.label ?? e.material) : e.material}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium ${e.tipo === "entrada" ? "text-green-400" : "text-orange-400"}`}>{e.tipo === "entrada" ? "↑ Entrada" : "↓ Salida"}</span></td>
                    <td className="px-4 py-3 text-white font-mono text-sm">{fmt(e.cantidad)}{e.unidad ? ` ${e.unidad}` : ""}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{e.proveedor || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{e.noFactura || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#3A3A3A]">
            <p className="text-xs text-gray-600">{filteredEntradas.length} registro{filteredEntradas.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      <FormDrawer open={showRemisionForm} onClose={() => setShowRemisionForm(false)} onSave={handleSaveRemision} clientes={clientesList} operadores={operadoresList} nextRemision={nextRemision} />
      <EntradaForm open={showEntradaForm} onClose={() => setShowEntradaForm(false)} onSave={handleSaveEntrada} />
      {isSuperAdmin && (
        <ExistenciaInicialForm open={showExistenciaForm} onClose={() => setShowExistenciaForm(false)} periodo={periodo} current={existenciaInicial} onSave={handleSaveExistencia} />
      )}
    </div>
  );
}
