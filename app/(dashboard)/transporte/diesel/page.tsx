"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Download,
  Fuel,
  Gauge,
  Plus,
  Search,
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoCombustible = "DIESEL" | "GASOLINA" | "GAS";

interface CargaDiesel {
  id?: string;
  fecha: string;         // dd/mm/yyyy
  unidad: string;
  combustible: TipoCombustible;
  litros: number;
  kmAnterior: number | null;
  kmNuevo: number | null;
  kmRecorridos: number | null;
  rendimiento: number | null;   // km/L
  precioL: number | null;       // calculated: total / litros
  total: number;
  recibo: string;
  sellosAnt: string;
  sellosNuevo: string;
  lugar: string;
  comentarios: string;
}

interface FormState {
  fecha: string;
  unidad: string;
  combustible: TipoCombustible;
  litros: string;
  kmAnterior: string;
  kmNuevo: string;
  kmRecorridos: string;
  total: string;
  recibo: string;
  sellosAnt: string;
  sellosNuevo: string;
  lugar: string;
  comentarios: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string) {
  const [d, m, y] = display.split("/");
  return `${y}-${m}-${d}`;
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

const COMBUSTIBLE_COLORS: Record<TipoCombustible, string> = {
  DIESEL: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  GASOLINA: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  GAS: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

const emptyForm = (): FormState => ({
  fecha: todayISO(),
  unidad: "",
  combustible: "DIESEL",
  litros: "",
  kmAnterior: "",
  kmNuevo: "",
  kmRecorridos: "",
  total: "",
  recibo: "",
  sellosAnt: "",
  sellosNuevo: "",
  lugar: "",
  comentarios: "",
});

// ─── Form Drawer ──────────────────────────────────────────────────────────────

function FormDrawer({
  open,
  onClose,
  onSave,
  unidadesList,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (carga: CargaDiesel) => Promise<void>;
  unidadesList: string[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const firstRef = useRef<HTMLInputElement>(null);

  // Auto-reset when opening
  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setErrors({});
      setTimeout(() => firstRef.current?.focus(), 80);
    }
  }, [open]);

  // Auto: km recorridos = km nuevo - km anterior
  const kmAnt = parseNum(form.kmAnterior);
  const kmNue = parseNum(form.kmNuevo);
  const kmRecAuto = kmAnt != null && kmNue != null && kmNue > kmAnt ? kmNue - kmAnt : null;

  // Auto: precio/L = total / litros
  const litrosN = parseNum(form.litros);
  const totalN = parseNum(form.total);
  const precioLCalc = litrosN && totalN && litrosN > 0 ? totalN / litrosN : null;

  // Auto: rendimiento = km recorridos / litros
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
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const carga: CargaDiesel = {
        fecha: isoToDisplay(form.fecha),
        unidad: form.unidad.trim(),
        combustible: form.combustible,
        litros: litrosN!,
        kmAnterior: parseNum(form.kmAnterior),
        kmNuevo: parseNum(form.kmNuevo),
        kmRecorridos: parseNum(form.kmRecorridos) ?? kmRecAuto,
        rendimiento: rendCalc,
        precioL: precioLCalc,
        total: totalN!,
        recibo: form.recibo.trim(),
        sellosAnt: form.sellosAnt.trim(),
        sellosNuevo: form.sellosNuevo.trim(),
        lugar: form.lugar.trim(),
        comentarios: form.comentarios.trim(),
      };
      await onSave(carga);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (field?: keyof FormState) =>
    `w-full bg-white border ${
      field && errors[field] ? "border-red-400" : "border-gray-200"
    } rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors`;

  const readonlyCls =
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-emerald-700 font-mono cursor-default select-all font-semibold";

  const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const requiredStar = <span className="text-[#CC2229] ml-0.5">*</span>;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Fuel size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Registrar carga</h2>
              <p className="text-xs text-gray-500">Carga de combustible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
          {/* Section: Identificación */}
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Identificación
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Fecha {requiredStar}
                </label>
                <input
                  ref={firstRef}
                  type="date"
                  value={form.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                  className={inputCls()}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Tipo {requiredStar}
                </label>
                <div className="flex gap-1">
                  {(["DIESEL", "GASOLINA", "GAS"] as TipoCombustible[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("combustible", t)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                        form.combustible === t
                          ? t === "DIESEL"
                            ? "bg-yellow-500/20 border border-yellow-500/60 text-yellow-300"
                            : t === "GASOLINA"
                              ? "bg-blue-500/20 border border-blue-500/60 text-blue-300"
                              : "bg-emerald-500/20 border border-emerald-500/60 text-emerald-300"
                          : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
                      }`}
                    >
                      {t === "DIESEL" ? "Diésel" : t === "GASOLINA" ? "Gasolina" : "Gas"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls}>
                Unidad {requiredStar}
              </label>
              <select
                value={form.unidad}
                onChange={(e) => set("unidad", e.target.value)}
                className={inputCls("unidad")}
              >
                <option value="">Seleccionar unidad…</option>
                {unidadesList.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {unidadesList.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">Sin unidades registradas — agrégalas en Transporte → Unidades.</p>
              )}
              {errors.unidad && (
                <p className="mt-1 text-xs text-red-400">{errors.unidad}</p>
              )}
            </div>
          </fieldset>

          {/* Section: Carga */}
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Carga de combustible
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Litros {requiredStar}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.litros}
                  onChange={(e) => set("litros", e.target.value)}
                  placeholder="0.000"
                  className={inputCls("litros")}
                />
                {errors.litros && (
                  <p className="mt-1 text-xs text-red-400">{errors.litros}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Total $ {requiredStar}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.total}
                  onChange={(e) => set("total", e.target.value)}
                  placeholder="0.00"
                  className={inputCls("total")}
                />
                {errors.total && (
                  <p className="mt-1 text-xs text-red-400">{errors.total}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Precio / litro (calc.)</label>
                <div className={readonlyCls}>
                  {precioLCalc != null
                    ? `$${precioLCalc.toFixed(3)}`
                    : "—"}
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  No. Recibo / Factura {requiredStar}
                </label>
                <input
                  type="text"
                  value={form.recibo}
                  onChange={(e) => set("recibo", e.target.value)}
                  placeholder="Número de recibo"
                  className={inputCls("recibo")}
                />
                {errors.recibo && (
                  <p className="mt-1 text-xs text-red-400">{errors.recibo}</p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Lugar / Gasolinera</label>
              <input
                type="text"
                value={form.lugar}
                onChange={(e) => set("lugar", e.target.value)}
                placeholder="Nombre de la gasolinera o dirección"
                className={inputCls()}
              />
            </div>
          </fieldset>

          {/* Section: Odómetro */}
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Odómetro
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Km anterior</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.kmAnterior}
                  onChange={(e) => set("kmAnterior", e.target.value)}
                  placeholder="0"
                  className={inputCls()}
                />
              </div>
              <div>
                <label className={labelCls}>Km nuevo</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.kmNuevo}
                  onChange={(e) => set("kmNuevo", e.target.value)}
                  placeholder="0"
                  className={inputCls()}
                />
              </div>
              <div>
                <label className={labelCls}>Km recorridos</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={
                    form.kmRecorridos ||
                    (kmRecAuto != null ? String(kmRecAuto) : "")
                  }
                  onChange={(e) => set("kmRecorridos", e.target.value)}
                  placeholder={
                    kmRecAuto != null ? String(kmRecAuto) : "Auto-calculado"
                  }
                  className={
                    form.kmRecorridos
                      ? inputCls()
                      : `${inputCls()} placeholder-gray-500`
                  }
                />
                {kmRecAuto != null && !form.kmRecorridos && (
                  <p className="mt-1 text-xs text-gray-400">
                    Auto: {kmRecAuto.toLocaleString("es-MX")} km
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Rendimiento (calc.)</label>
                <div className={readonlyCls}>
                  {rendCalc != null
                    ? `${rendCalc.toFixed(3)} km/L`
                    : "—"}
                </div>
                {rendCalc != null && rendCalc < 2.9 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-400">
                    <AlertTriangle size={11} />
                    Bajo rendimiento
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Section: Sellos */}
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Sellos de odómetro
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sellos anterior</label>
                <input
                  type="text"
                  value={form.sellosAnt}
                  onChange={(e) => set("sellosAnt", e.target.value)}
                  placeholder="Número de sello"
                  className={inputCls()}
                />
              </div>
              <div>
                <label className={labelCls}>Sellos nuevo</label>
                <input
                  type="text"
                  value={form.sellosNuevo}
                  onChange={(e) => set("sellosNuevo", e.target.value)}
                  placeholder="Número de sello"
                  className={inputCls()}
                />
              </div>
            </div>
          </fieldset>

          {/* Section: Observaciones */}
          <fieldset>
            <legend className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Observaciones
            </legend>
            <textarea
              rows={3}
              value={form.comentarios}
              onChange={(e) => set("comentarios", e.target.value)}
              placeholder="Notas adicionales sobre la carga..."
              className={`${inputCls()} resize-none`}
            />
          </fieldset>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Fuel size={15} />
                Guardar carga
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row detail expandable ─────────────────────────────────────────────────────

function TableRow({ carga }: { carga: CargaDiesel }) {
  const [expanded, setExpanded] = useState(false);
  const lowRendimiento = carga.rendimiento != null && carga.rendimiento < 2.9;

  return (
    <>
      <tr
        className={`hover:bg-[#1A1F2B] transition-colors cursor-pointer ${expanded ? "bg-[#1A1F2B]" : ""}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs">{carga.fecha}</td>
        <td className="px-4 py-3 text-white font-semibold text-sm">{carga.unidad}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COMBUSTIBLE_COLORS[carga.combustible] ?? ""}`}>
            {carga.combustible}
          </span>
        </td>
        <td className="px-4 py-3 text-yellow-400 font-semibold tabular-nums">
          {fmt(carga.litros, 3)} L
        </td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">
          {currency(carga.total)}
        </td>
        <td className="px-4 py-3 text-gray-400 tabular-nums text-xs">
          {carga.precioL != null ? `$${carga.precioL.toFixed(3)}` : "—"}
        </td>
        <td className="px-4 py-3 text-gray-300 tabular-nums text-xs">
          {carga.kmRecorridos != null
            ? `${carga.kmRecorridos.toLocaleString("es-MX")} km`
            : "—"}
        </td>
        <td className={`px-4 py-3 tabular-nums text-xs font-semibold ${lowRendimiento ? "text-orange-400" : "text-blue-400"}`}>
          {carga.rendimiento != null ? `${carga.rendimiento.toFixed(3)} km/L` : "—"}
          {lowRendimiento && <AlertTriangle size={11} className="inline ml-1" />}
        </td>
        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{carga.recibo || "—"}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
              <div>
                <p className="text-gray-500 mb-0.5">Km anterior</p>
                <p className="text-gray-200">{carga.kmAnterior != null ? carga.kmAnterior.toLocaleString("es-MX") : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Km nuevo</p>
                <p className="text-gray-200">{carga.kmNuevo != null ? carga.kmNuevo.toLocaleString("es-MX") : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Sellos ant.</p>
                <p className="text-gray-200 font-mono">{carga.sellosAnt || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Sellos nuevos</p>
                <p className="text-gray-200 font-mono">{carga.sellosNuevo || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-0.5">Lugar</p>
                <p className="text-gray-200">{carga.lugar || "—"}</p>
              </div>
              {carga.comentarios && (
                <div className="col-span-full">
                  <p className="text-gray-500 mb-0.5">Comentarios</p>
                  <p className="text-gray-300">{carga.comentarios}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DieselPage() {
  const [cargas, setCargas] = useState<CargaDiesel[]>([]);
  const [unidadesList, setUnidadesList] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterUnidad, setFilterUnidad] = useState("Todas");
  const [filterCombustible, setFilterCombustible] = useState("Todos");
  const [query, setQuery] = useState("");

  // Load data
  useEffect(() => {
    getCollectionDocs<CargaDiesel>(COLLECTIONS.diesel).then(setCargas);
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then((list) =>
      setUnidadesList(list.map((u) => u.noEconomico).filter(Boolean)),
    );
  }, []);

  // Derived unidades list (registered + seen in cargas)
  const allUnidades = useMemo(() => {
    const fromCargas = cargas.map((c) => c.unidad);
    return ["Todas", ...Array.from(new Set([...unidadesList, ...fromCargas])).sort()];
  }, [cargas, unidadesList]);

  // Filters
  const filtered = useMemo(
    () =>
      cargas.filter((c) => {
        const matchUnidad = filterUnidad === "Todas" || c.unidad === filterUnidad;
        const matchComb = filterCombustible === "Todos" || c.combustible === filterCombustible;
        const q = query.toLowerCase();
        const matchQ =
          !q ||
          c.unidad.toLowerCase().includes(q) ||
          c.recibo.toLowerCase().includes(q) ||
          (c.lugar || "").toLowerCase().includes(q) ||
          (c.comentarios || "").toLowerCase().includes(q);
        return matchUnidad && matchComb && matchQ;
      }),
    [cargas, filterUnidad, filterCombustible, query],
  );

  // KPIs
  const totalLitros = cargas.reduce((s, c) => s + (c.litros ?? 0), 0);
  const totalCosto = cargas.reduce((s, c) => s + (c.total ?? 0), 0);
  const rendValues = cargas.map((c) => c.rendimiento).filter((r): r is number => r != null && r > 0);
  const promRendimiento = rendValues.length > 0
    ? rendValues.reduce((s, v) => s + v, 0) / rendValues.length
    : null;
  const bajoRendimiento = rendValues.filter((r) => r < 2.9).length;
  const promPrecioL = totalLitros > 0 ? totalCosto / totalLitros : null;

  // Chart: litros por unidad
  const litrosPorUnidad = useMemo(() => {
    const map = new Map<string, number>();
    cargas.forEach((c) => map.set(c.unidad, (map.get(c.unidad) ?? 0) + (c.litros ?? 0)));
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([unidad, litros]) => ({ unidad, litros }));
  }, [cargas]);

  // Chart: costo por día
  const costoPorDia = useMemo(() => {
    const map = new Map<string, number>();
    cargas.forEach((c) => {
      if (!c.fecha) return;
      map.set(c.fecha, (map.get(c.fecha) ?? 0) + (c.total ?? 0));
    });
    const toMs = (s: string) => {
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return Array.from(map.entries())
      .sort(([a], [b]) => toMs(a) - toMs(b))
      .slice(-30)
      .map(([dia, costo]) => ({ dia, costo }));
  }, [cargas]);

  // Resumen por unidad
  const resumenPorUnidad = useMemo(() => {
    const map = new Map<string, { litros: number; costo: number; cargas: number; rendSum: number; rendCount: number }>();
    cargas.forEach((c) => {
      const curr = map.get(c.unidad) ?? { litros: 0, costo: 0, cargas: 0, rendSum: 0, rendCount: 0 };
      map.set(c.unidad, {
        litros: curr.litros + (c.litros ?? 0),
        costo: curr.costo + (c.total ?? 0),
        cargas: curr.cargas + 1,
        rendSum: curr.rendSum + (c.rendimiento ?? 0),
        rendCount: curr.rendCount + (c.rendimiento != null ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.costo - a.costo)
      .map(([unidad, v]) => ({
        unidad,
        ...v,
        rendProm: v.rendCount > 0 ? v.rendSum / v.rendCount : null,
        promPrecio: v.litros > 0 ? v.costo / v.litros : null,
      }));
  }, [cargas]);

  // Export CSV
  function exportCSV() {
    const headers = [
      "Fecha", "Unidad", "Combustible", "Litros", "Km Anterior", "Km Nuevo",
      "Km Recorridos", "Rendimiento km/L", "Total $", "Precio/L", "Recibo",
      "Sellos Ant.", "Sellos Nuevo", "Lugar", "Comentarios",
    ];
    const rows = filtered.map((c) =>
      [
        c.fecha, `"${c.unidad}"`, c.combustible,
        c.litros, c.kmAnterior ?? "", c.kmNuevo ?? "",
        c.kmRecorridos ?? "", c.rendimiento != null ? c.rendimiento.toFixed(3) : "",
        c.total, c.precioL != null ? c.precioL.toFixed(3) : "",
        `"${c.recibo}"`, c.sellosAnt, c.sellosNuevo, `"${c.lugar}"`, `"${c.comentarios}"`,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cargas-combustible-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave(carga: CargaDiesel) {
    const id = Date.now().toString();
    const withId = { ...carga, id };
    setCargas((prev) => [withId, ...prev]);
    await upsertDocument(COLLECTIONS.diesel, id, carga);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Registro de cargas · {cargas.length} entradas
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            <Plus size={16} />
            Registrar carga
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total litros"
          value={`${totalLitros.toLocaleString("es-MX", { maximumFractionDigits: 0 })} L`}
          icon={Fuel}
          iconColor="text-yellow-400"
          subtitle={`${cargas.length} cargas registradas`}
        />
        <KPICard
          title="Costo total"
          value={currency(totalCosto)}
          icon={DollarSign}
          iconColor="text-[#CC2229]"
          subtitle={promPrecioL != null ? `$${promPrecioL.toFixed(3)}/L promedio` : undefined}
        />
        <KPICard
          title="Rendimiento promedio"
          value={promRendimiento != null ? `${promRendimiento.toFixed(2)} km/L` : "—"}
          icon={Gauge}
          iconColor="text-blue-400"
          subtitle={`${rendValues.length} cargas con odómetro`}
        />
        <KPICard
          title="Bajo rendimiento"
          value={String(bajoRendimiento)}
          icon={AlertTriangle}
          iconColor="text-orange-400"
          subtitle="Menor a 2.9 km/L"
        />
      </div>

      {/* Charts */}
      {cargas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A]">
              <h3 className="text-sm font-semibold text-white">
                Litros consumidos por unidad
              </h3>
            </div>
            <div className="p-5">
              {litrosPorUnidad.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-600">
                  Sin datos
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={litrosPorUnidad}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#4B5563"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="unidad"
                      stroke="#4B5563"
                      tick={{ fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v) => [
                        `${(Number(v) || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} L`,
                        "Litros",
                      ]}
                    />
                    <Bar dataKey="litros" fill="#EAB308" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A]">
              <h3 className="text-sm font-semibold text-white">
                Costo diario acumulado (últimos 30 días)
              </h3>
            </div>
            <div className="p-5">
              {costoPorDia.length < 2 ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-600">
                  Sin suficientes datos
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={costoPorDia}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradCosto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis
                      dataKey="dia"
                      stroke="#4B5563"
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#4B5563"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        `$${(v / 1000).toFixed(0)}k`
                      }
                      width={44}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v) => [currency(Number(v) || 0), "Costo"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="costo"
                      stroke="#CC2229"
                      strokeWidth={2}
                      fill="url(#gradCosto)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen por unidad */}
      {resumenPorUnidad.length > 0 && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-sm font-semibold text-white">Resumen por unidad</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {[
                    "Unidad",
                    "Cargas",
                    "Litros totales",
                    "Costo total",
                    "Precio prom/L",
                    "Rend. prom",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {resumenPorUnidad.map((row) => (
                  <tr
                    key={row.unidad}
                    className="hover:bg-[#2A2A2A] transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-semibold">
                      {row.unidad}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.cargas}</td>
                    <td className="px-4 py-3 text-yellow-400 tabular-nums">
                      {row.litros.toLocaleString("es-MX", { maximumFractionDigits: 1 })} L
                    </td>
                    <td className="px-4 py-3 text-white font-semibold tabular-nums">
                      {currency(row.costo)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 tabular-nums">
                      {row.promPrecio != null
                        ? `$${row.promPrecio.toFixed(3)}`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums font-semibold ${
                        row.rendProm != null && row.rendProm < 2.9
                          ? "text-orange-400"
                          : "text-blue-400"
                      }`}
                    >
                      {row.rendProm != null
                        ? `${row.rendProm.toFixed(2)} km/L`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters + table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Unidad, recibo, lugar..."
              className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-44 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
            />
          </div>
          <select
            value={filterUnidad}
            onChange={(e) => setFilterUnidad(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
          >
            {allUnidades.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <select
            value={filterCombustible}
            onChange={(e) => setFilterCombustible(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
          >
            {["Todos", "DIESEL", "GASOLINA", "GAS"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-500">
            {filtered.length} de {cargas.length} cargas
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {[
                  "Fecha",
                  "Unidad",
                  "Tipo",
                  "Litros",
                  "Total",
                  "$/L",
                  "Km recorridos",
                  "Rendimiento",
                  "Recibo",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-sm text-gray-600"
                  >
                    {cargas.length === 0
                      ? "Sin cargas registradas. Presiona «Registrar carga» para agregar la primera."
                      : "Sin resultados para los filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => <TableRow key={c.id ?? i} carga={c} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Drawer */}
      <FormDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        unidadesList={[
          ...unidadesList,
          ...Array.from(new Set(cargas.map((c) => c.unidad))),
        ].filter((v, i, a) => a.indexOf(v) === i).sort()}
      />
    </div>
  );
}
