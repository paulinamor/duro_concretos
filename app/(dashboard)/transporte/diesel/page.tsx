"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  DollarSign, Download, Fuel, Gauge, MapPin, MessageSquare,
  Pencil, Plus, Receipt, Search, Shield, Trash2, Truck, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCombustible = "DIESEL" | "GASOLINA" | "GAS";

interface CargaDiesel {
  id?: string;
  fecha: string;
  unidad: string;
  combustible: TipoCombustible;
  litros: number;
  kmAnterior: number | null;
  kmNuevo: number | null;
  kmRecorridos: number | null;
  rendimiento: number | null;
  precioL: number | null;
  total: number;
  recibo: string;
  sellosAnt: string;
  sellosNuevo: string;
  lugar: string;
  comentarios: string;
  planta?: string;
}

interface FormState {
  fecha: string; unidad: string; combustible: TipoCombustible;
  litros: string; kmAnterior: string; kmNuevo: string; kmRecorridos: string;
  total: string; recibo: string; sellosAnt: string; sellosNuevo: string;
  lugar: string; comentarios: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function mesLabel(key: string) {
  if (key === "todos") return "Todos";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

const COMBUSTIBLE_BADGE: Record<TipoCombustible, string> = {
  DIESEL:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  GASOLINA: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  GAS:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const COMBUSTIBLE_LABEL: Record<TipoCombustible, string> = {
  DIESEL: "Diésel", GASOLINA: "Gasolina", GAS: "Gas",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  color: "#f1f5f9",
  fontSize: "12px",
};

const emptyForm = (): FormState => ({
  fecha: todayISO(), unidad: "", combustible: "DIESEL",
  litros: "", kmAnterior: "", kmNuevo: "", kmRecorridos: "",
  total: "", recibo: "", sellosAnt: "", sellosNuevo: "",
  lugar: "", comentarios: "",
});

// ─── Form Drawer ──────────────────────────────────────────────────────────────

function FormDrawer({ open, onClose, onSave, unidadesList, editing }: {
  open: boolean; onClose: () => void;
  onSave: (carga: CargaDiesel) => Promise<void>;
  unidadesList: string[]; editing?: CargaDiesel | null;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const toISO = (f: string) => f.includes("/") ? f.split("/").reverse().join("-") : f;
      setForm({
        fecha: toISO(editing.fecha), unidad: editing.unidad,
        combustible: editing.combustible, litros: String(editing.litros),
        kmAnterior: editing.kmAnterior != null ? String(editing.kmAnterior) : "",
        kmNuevo: editing.kmNuevo != null ? String(editing.kmNuevo) : "",
        kmRecorridos: editing.kmRecorridos != null ? String(editing.kmRecorridos) : "",
        total: String(editing.total), recibo: editing.recibo,
        sellosAnt: editing.sellosAnt, sellosNuevo: editing.sellosNuevo,
        lugar: editing.lugar, comentarios: editing.comentarios,
      });
    } else {
      setForm(emptyForm());
    }
    setErrors({});
  }, [open, editing]);

  const kmAnt = parseNum(form.kmAnterior);
  const kmNue = parseNum(form.kmNuevo);
  const kmRecAuto = kmAnt != null && kmNue != null && kmNue > kmAnt ? kmNue - kmAnt : null;
  const litrosN = parseNum(form.litros);
  const totalN = parseNum(form.total);
  const precioLCalc = litrosN && totalN && litrosN > 0 ? totalN / litrosN : null;
  const kmRecN = parseNum(form.kmRecorridos) ?? kmRecAuto;
  const rendCalc = kmRecN && litrosN && litrosN > 0 ? kmRecN / litrosN : null;

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.unidad.trim()) e.unidad = "Requerido";
    if (!form.litros || parseNum(form.litros) == null) e.litros = "Requerido";
    if (!form.total || parseNum(form.total) == null) e.total = "Requerido";
    if (!form.recibo.trim()) e.recibo = "Requerido";
    return e;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSave({
        ...(editing?.id ? { id: editing.id } : {}),
        fecha: isoToDisplay(form.fecha), unidad: form.unidad.trim(),
        combustible: form.combustible, litros: litrosN!,
        kmAnterior: parseNum(form.kmAnterior), kmNuevo: parseNum(form.kmNuevo),
        kmRecorridos: parseNum(form.kmRecorridos) ?? kmRecAuto,
        rendimiento: rendCalc, precioL: precioLCalc, total: totalN!,
        recibo: form.recibo.trim(), sellosAnt: form.sellosAnt.trim(),
        sellosNuevo: form.sellosNuevo.trim(), lugar: form.lugar.trim(),
        comentarios: form.comentarios.trim(),
      });
      onClose();
    } finally { setSaving(false); }
  }

  const inp = (field?: keyof FormState) =>
    `w-full bg-white border ${field && errors[field] ? "border-red-400" : "border-gray-200"} rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors`;
  const ro = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-emerald-700 font-mono cursor-default select-all font-semibold";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const req = <span className="text-[#CC2229] ml-0.5">*</span>;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Fuel size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{editing ? "Editar carga" : "Registrar carga"}</h2>
              <p className="text-xs text-gray-500">Carga de combustible</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Identificación</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Fecha {req}</label>
                <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp()} />
              </div>
              <div>
                <label className={lbl}>Tipo {req}</label>
                <div className="flex gap-1">
                  {(["DIESEL", "GASOLINA", "GAS"] as TipoCombustible[]).map((t) => (
                    <button key={t} type="button" onClick={() => set("combustible", t)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${form.combustible === t
                        ? t === "DIESEL" ? "bg-amber-100 border border-amber-400 text-amber-700"
                          : t === "GASOLINA" ? "bg-sky-100 border border-sky-400 text-sky-700"
                          : "bg-emerald-100 border border-emerald-400 text-emerald-700"
                        : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {COMBUSTIBLE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className={lbl}>Unidad {req}</label>
              <select value={form.unidad} onChange={(e) => set("unidad", e.target.value)} className={inp("unidad")}>
                <option value="">Seleccionar unidad…</option>
                {unidadesList.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {errors.unidad && <p className="mt-1 text-xs text-red-400">{errors.unidad}</p>}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Carga de combustible</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Litros {req}</label>
                <input type="number" step="0.001" min="0" value={form.litros} onChange={(e) => set("litros", e.target.value)} placeholder="0.000" className={inp("litros")} onWheel={(e) => e.currentTarget.blur()} />
                {errors.litros && <p className="mt-1 text-xs text-red-400">{errors.litros}</p>}
              </div>
              <div>
                <label className={lbl}>Total $ {req}</label>
                <input type="number" step="0.01" min="0" value={form.total} onChange={(e) => set("total", e.target.value)} placeholder="0.00" className={inp("total")} onWheel={(e) => e.currentTarget.blur()} />
                {errors.total && <p className="mt-1 text-xs text-red-400">{errors.total}</p>}
              </div>
              <div>
                <label className={lbl}>Precio / litro (calc.)</label>
                <div className={ro}>{precioLCalc != null ? `$${precioLCalc.toFixed(3)}` : "—"}</div>
              </div>
              <div>
                <label className={lbl}>No. Recibo / Factura {req}</label>
                <input type="text" value={form.recibo} onChange={(e) => set("recibo", e.target.value)} placeholder="Número de recibo" className={inp("recibo")} />
                {errors.recibo && <p className="mt-1 text-xs text-red-400">{errors.recibo}</p>}
              </div>
            </div>
            <div className="mt-3">
              <label className={lbl}>Lugar / Gasolinera</label>
              <input type="text" value={form.lugar} onChange={(e) => set("lugar", e.target.value)} placeholder="Nombre de la gasolinera o dirección" className={inp()} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Odómetro</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Km anterior</label>
                <input type="number" step="0.1" min="0" value={form.kmAnterior} onChange={(e) => set("kmAnterior", e.target.value)} placeholder="0" className={inp()} onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={lbl}>Km nuevo</label>
                <input type="number" step="0.1" min="0" value={form.kmNuevo} onChange={(e) => set("kmNuevo", e.target.value)} placeholder="0" className={inp()} onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={lbl}>Km recorridos</label>
                <input type="number" step="0.1" min="0"
                  value={form.kmRecorridos || (kmRecAuto != null ? String(kmRecAuto) : "")}
                  onChange={(e) => set("kmRecorridos", e.target.value)}
                  placeholder={kmRecAuto != null ? String(kmRecAuto) : "Auto-calculado"}
                  className={inp()} onWheel={(e) => e.currentTarget.blur()} />
                {kmRecAuto != null && !form.kmRecorridos && (
                  <p className="mt-1 text-xs text-gray-400">Auto: {kmRecAuto.toLocaleString("es-MX")} km</p>
                )}
              </div>
              <div>
                <label className={lbl}>Rendimiento (calc.)</label>
                <div className={ro}>{rendCalc != null ? `${rendCalc.toFixed(3)} km/L` : "—"}</div>
                {rendCalc != null && rendCalc < 2.9 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-500">
                    <AlertTriangle size={11} /> Bajo rendimiento
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Sellos de odómetro</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Sellos anterior</label>
                <input type="text" value={form.sellosAnt} onChange={(e) => set("sellosAnt", e.target.value)} placeholder="Número de sello" className={inp()} />
              </div>
              <div>
                <label className={lbl}>Sellos nuevo</label>
                <input type="text" value={form.sellosNuevo} onChange={(e) => set("sellosNuevo", e.target.value)} placeholder="Número de sello" className={inp()} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Observaciones</legend>
            <textarea rows={3} value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} placeholder="Notas adicionales..." className={`${inp()} resize-none`} />
          </fieldset>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-md shadow-[#CC2229]/20 cursor-pointer">
            {saving ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Guardando...</> : <><Fuel size={15} />{editing ? "Actualizar" : "Guardar carga"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

function TableRow({ carga, onEdit, onDelete }: {
  carga: CargaDiesel;
  onEdit?: (c: CargaDiesel) => void;
  onDelete?: (c: CargaDiesel) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lowRend = carga.rendimiento != null && carga.rendimiento < 2.9;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{carga.fecha}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2A2A2A]">
              <Truck size={12} className="text-gray-500" />
            </div>
            <span className="text-gray-200 font-semibold text-sm">{carga.unidad}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${COMBUSTIBLE_BADGE[carga.combustible] ?? ""}`}>
            {COMBUSTIBLE_LABEL[carga.combustible]}
          </span>
        </td>
        <td className="px-4 py-3 text-amber-600 font-semibold tabular-nums text-sm">
          {fmt(carga.litros, 1)} L
        </td>
        <td className="px-4 py-3 text-gray-200 font-semibold tabular-nums">
          {currency(carga.total)}
        </td>
        <td className={`px-4 py-3 tabular-nums text-sm font-semibold ${lowRend ? "text-orange-500" : "text-sky-600"}`}>
          <div className="flex items-center gap-1">
            {carga.rendimiento != null ? `${carga.rendimiento.toFixed(2)} km/L` : <span className="text-gray-400">—</span>}
            {lowRend && <AlertTriangle size={11} />}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={7} className="px-5 py-4">
            {/* Stat row */}
            <div className="flex flex-wrap gap-3 mb-3">
              {/* Precio/L */}
              <div className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-amber-500/20 px-4 py-2.5 min-w-[130px]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <DollarSign size={14} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70 mb-0.5">Precio / L</p>
                  <p className="text-sm font-bold text-white">{carga.precioL != null ? `$${carga.precioL.toFixed(3)}` : "—"}</p>
                </div>
              </div>
              {/* KM */}
              <div className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-sky-500/20 px-4 py-2.5 min-w-[160px]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                  <Gauge size={14} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-sky-400/70 mb-0.5">KM recorridos</p>
                  <p className="text-sm font-bold text-white">
                    {carga.kmRecorridos != null ? `${carga.kmRecorridos.toLocaleString("es-MX")} km` : "—"}
                  </p>
                  {(carga.kmAnterior != null || carga.kmNuevo != null) && (
                    <p className="text-[10px] text-sky-400/60 font-mono mt-0.5">
                      {(carga.kmAnterior ?? 0).toLocaleString("es-MX")} → {(carga.kmNuevo ?? 0).toLocaleString("es-MX")}
                    </p>
                  )}
                </div>
              </div>
              {/* Recibo */}
              <div className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-violet-500/20 px-4 py-2.5 min-w-[160px]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <Receipt size={14} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-violet-400/70 mb-0.5">Recibo / Factura</p>
                  <p className="text-sm font-mono font-bold text-white">{carga.recibo || "—"}</p>
                </div>
              </div>
              {/* Gasolinera */}
              {carga.lugar && (
                <div className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-emerald-500/20 px-4 py-2.5 min-w-[140px]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <MapPin size={14} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70 mb-0.5">Gasolinera</p>
                    <p className="text-sm font-semibold text-white">{carga.lugar}</p>
                  </div>
                </div>
              )}
              {/* Sellos */}
              {(carga.sellosAnt || carga.sellosNuevo) && (
                <div className="flex items-center gap-3 rounded-xl bg-[#1A1A1A] border border-gray-600/30 px-4 py-2.5 min-w-[180px]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-500/10">
                    <Shield size={14} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Sellos</p>
                    <p className="text-xs text-gray-300 font-mono">
                      {carga.sellosAnt || "—"} → {carga.sellosNuevo || "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Notas */}
            {carga.comentarios && (
              <div className="flex items-start gap-2.5 rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] px-4 py-2.5 mb-3">
                <MessageSquare size={13} className="text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-400 leading-relaxed">{carga.comentarios}</p>
              </div>
            )}
            {/* Actions */}
            {(onEdit || onDelete) && (
              <div className="flex gap-2 pt-1">
                {onEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onEdit(carga); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg transition-colors cursor-pointer">
                    <Pencil size={11} /> Editar
                  </button>
                )}
                {onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(carga); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 bg-[#1A1A1A] hover:bg-red-500/10 border border-[#3A3A3A] hover:border-red-500/30 rounded-lg transition-colors cursor-pointer">
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

// ─── UnitCard ─────────────────────────────────────────────────────────────────

function UnitCard({ row, maxLitros }: {
  row: { unidad: string; litros: number; costo: number; cargas: number; rendProm: number | null; promPrecio: number | null };
  maxLitros: number;
}) {
  const lowRend = row.rendProm != null && row.rendProm < 2.9;
  const barPct = maxLitros > 0 ? (row.litros / maxLitros) * 100 : 0;

  return (
    <div className="bg-[#242424] p-4 space-y-3 hover:bg-[#2A2A2A] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Truck size={13} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-200 leading-tight">{row.unidad}</p>
            <p className="text-[11px] text-gray-400">{row.cargas} carga{row.cargas !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {row.rendProm != null && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${lowRend ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30"}`}>
            {lowRend && <AlertTriangle size={10} />}
            {row.rendProm.toFixed(2)} km/L
          </span>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Litros</span>
          <span className="text-xs font-semibold text-amber-400">{row.litros.toLocaleString("es-MX", { maximumFractionDigits: 0 })} L</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#3A3A3A]">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${barPct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#3A3A3A]">
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Costo total</p>
          <p className="text-sm font-bold text-gray-200">{Math.round(row.costo).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })}</p>
        </div>
        {row.promPrecio != null && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">Precio prom</p>
            <p className="text-sm font-semibold text-gray-300">${row.promPrecio.toFixed(3)}/L</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DieselPage() {
  const [cargas, setCargas] = useState<CargaDiesel[]>([]);
  const [unidadesList, setUnidadesList] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCarga, setEditingCarga] = useState<CargaDiesel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CargaDiesel | null>(null);
  const [filterUnidad, setFilterUnidad] = useState("Todas");
  const [filterCombustible, setFilterCombustible] = useState("Todos");
  const [filterMes, setFilterMes] = useState("todos");
  const [query, setQuery] = useState("");

  useEffect(() => {
    getCollectionDocs<CargaDiesel>(COLLECTIONS.diesel).then((data) => setCargas(filterByPlanta(data)));
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then((list) =>
      setUnidadesList(list.map((u) => u.noEconomico).filter(Boolean)),
    );
  }, []);

  const allUnidades = useMemo(() => {
    const fromCargas = cargas.map((c) => c.unidad);
    return ["Todas", ...Array.from(new Set([...unidadesList, ...fromCargas])).sort()];
  }, [cargas, unidadesList]);

  const mesesDisponibles = useMemo(() => {
    const meses = new Set<string>();
    cargas.forEach((c) => {
      if (!c.fecha) return;
      const parts = c.fecha.split("/");
      if (parts.length === 3) { const [, m, y] = parts; if (m && y) meses.add(`${y}-${m}`); }
    });
    return ["todos", ...Array.from(meses).sort().reverse()];
  }, [cargas]);

  const filtered = useMemo(() => {
    const toMs = (f: string) => {
      const p = f.split("/");
      if (p.length !== 3) return 0;
      return new Date(`${p[2]}-${p[1]}-${p[0]}T00:00:00`).getTime();
    };
    return cargas
      .filter((c) => {
        const matchUnidad = filterUnidad === "Todas" || c.unidad === filterUnidad;
        const matchComb = filterCombustible === "Todos" || c.combustible === filterCombustible;
        const matchMes = filterMes === "todos" || (() => {
          if (!c.fecha) return false;
          const parts = c.fecha.split("/");
          if (parts.length !== 3) return false;
          const [, m, y] = parts;
          return `${y}-${m}` === filterMes;
        })();
        const q = query.toLowerCase();
        const matchQ = !q || c.unidad.toLowerCase().includes(q) || c.recibo.toLowerCase().includes(q) || (c.lugar || "").toLowerCase().includes(q);
        return matchUnidad && matchComb && matchMes && matchQ;
      })
      .sort((a, b) => toMs(b.fecha) - toMs(a.fecha));
  }, [cargas, filterUnidad, filterCombustible, filterMes, query]);

  const totalLitros = filtered.reduce((s, c) => s + (c.litros ?? 0), 0);
  const totalCosto = filtered.reduce((s, c) => s + (c.total ?? 0), 0);
  const rendValues = filtered.map((c) => c.rendimiento).filter((r): r is number => r != null && r > 0);
  const promRendimiento = rendValues.length > 0 ? rendValues.reduce((s, v) => s + v, 0) / rendValues.length : null;
  const bajoRendimiento = rendValues.filter((r) => r < 2.9).length;
  const promPrecioL = totalLitros > 0 ? totalCosto / totalLitros : null;

  const litrosPorUnidad = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => map.set(c.unidad, (map.get(c.unidad) ?? 0) + (c.litros ?? 0)));
    return Array.from(map.entries()).sort(([, a], [, b]) => b - a).slice(0, 10).map(([unidad, litros]) => ({ unidad, litros }));
  }, [filtered]);

  const costoPorDia = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => { if (!c.fecha) return; map.set(c.fecha, (map.get(c.fecha) ?? 0) + (c.total ?? 0)); });
    const toMs = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, m - 1, d).getTime(); };
    return Array.from(map.entries()).sort(([a], [b]) => toMs(a) - toMs(b)).slice(-30).map(([dia, costo]) => ({ dia, costo }));
  }, [filtered]);

  const resumenPorUnidad = useMemo(() => {
    const map = new Map<string, { litros: number; costo: number; cargas: number; rendSum: number; rendCount: number }>();
    filtered.forEach((c) => {
      const curr = map.get(c.unidad) ?? { litros: 0, costo: 0, cargas: 0, rendSum: 0, rendCount: 0 };
      map.set(c.unidad, { litros: curr.litros + (c.litros ?? 0), costo: curr.costo + (c.total ?? 0), cargas: curr.cargas + 1, rendSum: curr.rendSum + (c.rendimiento ?? 0), rendCount: curr.rendCount + (c.rendimiento != null ? 1 : 0) });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b.costo - a.costo).map(([unidad, v]) => ({
      unidad, ...v,
      rendProm: v.rendCount > 0 ? v.rendSum / v.rendCount : null,
      promPrecio: v.litros > 0 ? v.costo / v.litros : null,
    }));
  }, [filtered]);

  const maxLitros = resumenPorUnidad.reduce((m, r) => Math.max(m, r.litros), 0);

  function exportXLSX() {
    const XLSX = require("xlsx");
    const rows = filtered.map((c) => ({
      "Fecha": c.fecha,
      "Unidad": c.unidad,
      "Combustible": c.combustible,
      "Litros": c.litros,
      "Km Anterior": c.kmAnterior ?? "",
      "Km Nuevo": c.kmNuevo ?? "",
      "Km Recorridos": c.kmRecorridos ?? "",
      "Rendimiento km/L": c.rendimiento != null ? parseFloat(c.rendimiento.toFixed(3)) : "",
      "Total $": c.total,
      "Precio/L": c.precioL != null ? parseFloat(c.precioL.toFixed(3)) : "",
      "Recibo": c.recibo,
      "Sellos Ant.": c.sellosAnt,
      "Sellos Nuevo": c.sellosNuevo,
      "Lugar": c.lugar,
      "Comentarios": c.comentarios,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Combustible");
    XLSX.writeFile(wb, `cargas-combustible-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleSave(carga: CargaDiesel) {
    const id = carga.id ?? Date.now().toString();
    const withId = { ...carga, id };
    if (carga.id) { setCargas((prev) => prev.map((c) => c.id === id ? withId : c)); }
    else { setCargas((prev) => [withId, ...prev]); }
    const { id: _id, planta: _p, ...data } = withId;
    await upsertDocument(COLLECTIONS.diesel, id, withPlantaTag(data));
  }

  async function handleDelete(carga: CargaDiesel) {
    setCargas((prev) => prev.filter((c) => c.id !== carga.id));
    await deleteDocument(COLLECTIONS.diesel, carga.id!);
    setConfirmDelete(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Carga de ${carga.unidad} eliminada.` } }));
  }

  const mesIdx = mesesDisponibles.indexOf(filterMes);
  const hasFilters = filterMes !== "todos" || filterUnidad !== "Todas" || filterCombustible !== "Todos" || query;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {filtered.length} de {cargas.length} registros
          {filterMes !== "todos" && <span className="ml-1.5 text-[#CC2229] capitalize">· {mesLabel(filterMes)}</span>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={exportXLSX} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 bg-[#242424] border border-[#3A3A3A] rounded-lg hover:border-[#4A4A4A] transition-colors disabled:opacity-40 shadow-sm cursor-pointer">
            <Download size={13} /> Excel
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-md shadow-[#CC2229]/20 cursor-pointer">
            <Plus size={16} /> Registrar carga
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total litros" value={`${totalLitros.toLocaleString("es-MX", { maximumFractionDigits: 0 })} L`} icon={Fuel} iconColor="text-amber-500" iconBg="bg-amber-50" subtitle={`${filtered.length} carga${filtered.length !== 1 ? "s" : ""} registradas`} />
        <KPICard title="Costo total" value={currency(totalCosto)} icon={DollarSign} iconColor="text-[#CC2229]" iconBg="bg-red-50" subtitle={promPrecioL != null ? `$${promPrecioL.toFixed(3)}/L promedio` : undefined} />
        <KPICard title="Rendimiento promedio" value={promRendimiento != null ? `${promRendimiento.toFixed(2)} km/L` : "—"} icon={Gauge} iconColor="text-sky-500" iconBg="bg-sky-50" subtitle={`${rendValues.length} cargas con odómetro`} />
        <KPICard title="Bajo rendimiento" value={String(bajoRendimiento)} icon={AlertTriangle} iconColor={bajoRendimiento > 0 ? "text-orange-500" : "text-gray-400"} iconBg={bajoRendimiento > 0 ? "bg-orange-50" : "bg-gray-100"} subtitle="Menor a 2.9 km/L" />
      </div>

      {/* Filters */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar unidad, recibo..."
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-44 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-500" />
        </div>

        <div className="w-px h-5 bg-[#3A3A3A]" />

        {/* Mes */}
        <div className="flex items-center gap-1">
          <button disabled={mesIdx >= mesesDisponibles.length - 1} onClick={() => setFilterMes(mesesDisponibles[mesIdx + 1])}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#3A3A3A] transition-colors disabled:opacity-30 cursor-pointer">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setFilterMes("todos")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${filterMes === "todos" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-[#3A3A3A]"}`}>
            Todo
          </button>
          {filterMes !== "todos" && (
            <button
              onClick={() => setFilterMes("todos")}
              className="px-3 py-1.5 text-xs font-semibold bg-[#CC2229] text-white rounded-lg capitalize whitespace-nowrap cursor-pointer"
            >
              {mesLabel(filterMes)}
            </button>
          )}
          <button disabled={mesIdx <= 0} onClick={() => setFilterMes(mesesDisponibles[mesIdx - 1])}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#3A3A3A] transition-colors disabled:opacity-30 cursor-pointer">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="w-px h-5 bg-[#3A3A3A]" />

        {/* Combustible pills */}
        <div className="flex gap-1">
          {([["Todos", "Todos"], ["DIESEL", "Diésel"], ["GASOLINA", "Gasolina"], ["GAS", "Gas"]] as [string, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setFilterCombustible(val)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${filterCombustible === val ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-gray-200 hover:bg-[#3A3A3A]"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#3A3A3A]" />

        {/* Unidad */}
        <select value={filterUnidad} onChange={(e) => setFilterUnidad(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60 cursor-pointer">
          {allUnidades.map((u) => <option key={u}>{u}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterMes("todos"); setFilterUnidad("Todas"); setFilterCombustible("Todos"); setQuery(""); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer ml-auto">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Main content — charts left, table right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">

        {/* Left: stacked charts */}
        <div className="space-y-4">
          {/* Litros por unidad */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#3A3A3A]">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Litros por unidad</h3>
            </div>
            <div className="p-4">
              {litrosPorUnidad.length === 0 ? (
                <div className="flex h-36 items-center justify-center text-xs text-gray-400">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.min(litrosPorUnidad.length * 28 + 16, 280)}>
                  <BarChart data={litrosPorUnidad} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#cbd5e1" tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <YAxis type="category" dataKey="unidad" stroke="#cbd5e1" tick={{ fontSize: 9, fill: "#64748b" }} width={80} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${(Number(v) || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} L`, "Litros"]} />
                    <Bar dataKey="litros" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Costo diario */}
          {costoPorDia.length >= 2 && (
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-[#3A3A3A]">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costo diario</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={costoPorDia} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradCosto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CC2229" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dia" stroke="#cbd5e1" tick={{ fontSize: 8, fill: "#94a3b8" }} interval="preserveStartEnd" />
                    <YAxis stroke="#cbd5e1" tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={36} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [currency(Number(v) || 0), "Costo"]} />
                    <Area type="monotone" dataKey="costo" stroke="#CC2229" strokeWidth={2} fill="url(#gradCosto)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right: historial table */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-sm font-semibold text-white">Historial de cargas</h3>
            <span className="text-xs text-gray-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Tipo", "Litros", "Total", "Rendimiento", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                  ))}
                </tr>
              </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                    {cargas.length === 0 ? "Aún no hay cargas registradas" : "Sin resultados para los filtros aplicados"}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id ?? c.recibo + c.fecha} carga={c}
                    onEdit={(c) => { setEditingCarga(c); setShowForm(true); }}
                    onDelete={setConfirmDelete} />
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

      </div>{/* end 2-col grid */}

      <FormDrawer open={showForm} onClose={() => { setShowForm(false); setEditingCarga(null); }} onSave={handleSave} editing={editingCarga}
        unidadesList={[...unidadesList, ...cargas.map((c) => c.unidad)].filter((v, i, a) => v && a.indexOf(v) === i).sort()} />

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-[#242424] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar carga</h3>
            <p className="text-xs text-gray-400 mb-5">
              ¿Eliminar la carga de <span className="text-gray-200 font-medium">{confirmDelete.unidad}</span> del {confirmDelete.fecha}? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-[#4A4A4A] transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
