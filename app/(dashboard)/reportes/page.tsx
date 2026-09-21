"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line,
} from "recharts";
import {
  TrendingUp, Package, CheckCircle2, Download, Search,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList, CalendarRange,
  AlertCircle, DollarSign, Users, Zap, BarChart3, Banknote, FileWarning, X,
  ChevronRight,
} from "lucide-react";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import AppSelect from "@/components/AppSelect";
import { filterByPlanta } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
import { currencyRounded as currency } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Programacion {
  id?: string;
  dia: string;
  cliente: string;
  vendedor?: string;
  direccion?: string;
  resistencia?: string;
  m3Totales?: number | null;
  precioM3?: number | null;
  total?: number | null;
  pagado?: string;
  metodoPago?: string;
  recibo?: string;
  fact?: string;
  tdBom?: string;
  planta?: string;
  fase?: string;
}

type Period = "semana" | "mes" | "mes-anterior" | "trimestre" | "año" | "personalizado";
type Tab = "ventas" | "operacional" | "cobranza";
type DrillField = "cliente" | "vendedor" | "resistencia" | "bomba" | "metodoPago" | "dia" | "semana";

interface DrillFilter {
  field: DrillField;
  value: string;
  label: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  semana: "Esta semana",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  trimestre: "90 días",
  año: "Este año",
  personalizado: "Personalizado",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDia(dia: string): Date {
  if (!dia) return new Date(0);
  if (dia.includes("-")) return new Date(dia + "T12:00:00");
  const [d, m, y] = dia.split("/").map(Number);
  return new Date(y, m - 1, d, 12);
}

function isPagado(pagado?: string): boolean {
  return /^s[ií]/i.test(pagado?.trim() ?? "");
}

function getRange(p: Period): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (p) {
    case "semana": {
      const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const start = new Date(today); start.setDate(today.getDate() - dow);
      const end = new Date(today); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "mes":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
    case "mes-anterior":
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
    case "trimestre": {
      const start = new Date(today); start.setDate(today.getDate() - 89);
      const end = new Date(today); end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "año":
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
  }
}

function getPrevRange(p: Period): { start: Date; end: Date } {
  const now = new Date();
  if (p === "semana") {
    const { start, end } = getRange("semana");
    return { start: new Date(start.getTime() - 7 * 86_400_000), end: new Date(end.getTime() - 7 * 86_400_000) };
  }
  if (p === "mes") return getRange("mes-anterior");
  if (p === "mes-anterior") return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999) };
  if (p === "trimestre") {
    const { start } = getRange("trimestre");
    const prevEnd = new Date(start.getTime() - 86_400_000);
    return { start: new Date(prevEnd.getTime() - 89 * 86_400_000), end: prevEnd };
  }
  return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) };
}

function trendPct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

function weekLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  return mon.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function matchDrill(r: Programacion, drill: DrillFilter | null, useSemanal: boolean): boolean {
  if (!drill) return true;
  switch (drill.field) {
    case "cliente":     return r.cliente === drill.value;
    case "vendedor":    return (r.vendedor?.trim() || "Sin asignar") === drill.value;
    case "resistencia": return (r.resistencia || "Sin especificar") === drill.value;
    case "bomba":       return (r.tdBom?.trim() || "Directo") === drill.value;
    case "metodoPago":  return (r.metodoPago?.trim() || "No especificado") === drill.value;
    case "dia":         return r.dia === drill.value;
    case "semana":      return useSemanal
      ? weekLabel(r.dia) === drill.value
      : r.dia === drill.value;
    default:            return true;
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

const TT = { backgroundColor: "#1A1A1A", border: "1px solid #3A3A3A", borderRadius: "8px", color: "#fff", fontSize: "12px" };
const PAGO_COLORS: Record<string, string> = { Pagado: "#10B981", Pendiente: "#F59E0B" };
const BOMBA_COLORS = ["#CC2229", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

function KPICard({ icon: Icon, label, value, sub, color, pct, warn }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string; pct?: number | null; warn?: boolean;
}) {
  return (
    <div className={`bg-[#242424] border rounded-xl p-5 ${warn ? "border-amber-500/40" : "border-[#3A3A3A]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white leading-tight truncate">{value}</p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{sub}</span>
            {pct !== undefined && pct !== null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${pct > 0 ? "text-green-400" : pct < 0 ? "text-red-400" : "text-gray-500"}`}>
                {pct > 0 ? <ArrowUpRight size={11} /> : pct < 0 ? <ArrowDownRight size={11} /> : <Minus size={11} />}
                {Math.abs(pct)}% vs anterior
              </span>
            )}
          </div>
        </div>
        <div className={`shrink-0 rounded-xl bg-[#1A1A1A] p-3 ${color}`}><Icon size={20} /></div>
      </div>
    </div>
  );
}

function EmptyChart({ height = 220 }: { height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-sm text-gray-600" style={{ height }}>
      <BarChart3 size={28} className="opacity-30" />Sin datos en el período
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#3A3A3A]">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Drill breadcrumb ─────────────────────────────────────────────────────────

function DrillBreadcrumb({ drill, onClear }: { drill: DrillFilter; onClear: () => void }) {
  const fieldLabel: Record<DrillField, string> = {
    cliente: "Cliente", vendedor: "Vendedor", resistencia: "Resistencia",
    bomba: "Tipo entrega", metodoPago: "Método pago", dia: "Fecha", semana: "Semana",
  };
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#CC2229]/10 border border-[#CC2229]/30 rounded-xl text-sm">
      <ChevronRight size={13} className="text-[#CC2229] shrink-0" />
      <span className="text-gray-400 text-xs">{fieldLabel[drill.field]}</span>
      <span className="text-white font-semibold">{drill.label}</span>
      <button onClick={onClear} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer">
        <X size={12} /> Quitar filtro
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [period, setPeriod] = useState<Period>("mes");
  const [customStart, setCustomStart] = useState(() => todayCST().slice(0, 7) + "-01");
  const [customEnd, setCustomEnd] = useState(todayCST);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"fecha" | "total" | "m3">("fecha");
  const [tab, setTab] = useState<Tab>("ventas");
  const [drill, setDrill] = useState<DrillFilter | null>(null);

  function applyDrill(field: DrillField, value: string, label?: string) {
    setDrill((prev) => (prev?.field === field && prev.value === value) ? null : { field, value, label: label ?? value });
    // Scroll to detail table
    setTimeout(() => document.getElementById("detalle-table")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // Clear drill when period or tab changes
  useEffect(() => { setDrill(null); }, [period, tab]);

  useEffect(() => {
    getCollectionDocs<Programacion>(COLLECTIONS.programaciones)
      .then((docs) => setProgramaciones(filterByPlanta(docs)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingLong(false); return; }
    const t = setTimeout(() => setLoadingLong(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  // ── Ranges ────────────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => {
    if (period === "personalizado") return { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") };
    return getRange(period);
  }, [period, customStart, customEnd]);

  const { start: pStart, end: pEnd } = useMemo(() => {
    if (period === "personalizado") {
      const diffMs = end.getTime() - start.getTime();
      return { start: new Date(start.getTime() - diffMs - 86_400_000), end: new Date(start.getTime() - 86_400_000) };
    }
    return getPrevRange(period);
  }, [period, start, end]);

  const filtered = useMemo(
    () => programaciones.filter((r) => { const d = parseDia(r.dia); return d >= start && d <= end; }),
    [programaciones, start, end],
  );
  const prevFiltered = useMemo(
    () => programaciones.filter((r) => { const d = parseDia(r.dia); return d >= pStart && d <= pEnd; }),
    [programaciones, pStart, pEnd],
  );

  // ── Core KPIs ─────────────────────────────────────────────────────────────
  const pagados        = filtered.filter((r) => isPagado(r.pagado));
  const prevPagados    = prevFiltered.filter((r) => isPagado(r.pagado));
  const totalProg      = filtered.length;
  const totalM3        = filtered.reduce((s, r) => s + (r.m3Totales ?? 0), 0);
  const totalIngresos  = filtered.reduce((s, r) => s + (r.total ?? 0), 0);
  const prevIngresos   = prevFiltered.reduce((s, r) => s + (r.total ?? 0), 0);
  const prevM3         = prevFiltered.reduce((s, r) => s + (r.m3Totales ?? 0), 0);
  const prevTotal      = prevFiltered.length;
  const pctPagados     = totalProg > 0 ? Math.round((pagados.length / totalProg) * 100) : 0;
  const prevPct        = prevTotal > 0 ? Math.round((prevPagados.length / prevTotal) * 100) : 0;
  const precioPromM3   = totalM3 > 0 ? totalIngresos / totalM3 : 0;
  const prevPrecioM3   = prevM3 > 0 ? prevIngresos / prevM3 : 0;
  const carteraPendiente = filtered.filter((r) => !isPagado(r.pagado)).reduce((s, r) => s + (r.total ?? 0), 0);
  const prevCartera    = prevFiltered.filter((r) => !isPagado(r.pagado)).reduce((s, r) => s + (r.total ?? 0), 0);

  // ── Tendencias ────────────────────────────────────────────────────────────
  const tendenciaDiaria = useMemo(() => {
    const map = new Map<string, { ingresos: number; m3: number; pedidos: number }>();
    filtered.forEach((r) => {
      const curr = map.get(r.dia) ?? { ingresos: 0, m3: 0, pedidos: 0 };
      map.set(r.dia, { ingresos: curr.ingresos + (r.total ?? 0), m3: curr.m3 + (r.m3Totales ?? 0), pedidos: curr.pedidos + 1 });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => parseDia(a).getTime() - parseDia(b).getTime())
      .map(([dia, vals]) => ({ rawDia: dia, dia: parseDia(dia).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }), ...vals }));
  }, [filtered]);

  const tendenciaSemanal = useMemo(() => {
    const map = new Map<string, { ingresos: number; m3: number; pedidos: number }>();
    filtered.forEach((r) => {
      const key = weekLabel(r.dia);
      const curr = map.get(key) ?? { ingresos: 0, m3: 0, pedidos: 0 };
      map.set(key, { ingresos: curr.ingresos + (r.total ?? 0), m3: curr.m3 + (r.m3Totales ?? 0), pedidos: curr.pedidos + 1 });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, vals]) => ({ rawDia: semana, dia: semana, ...vals }));
  }, [filtered]);

  const useSemanal = tendenciaDiaria.length > 14;
  const tendencia  = useSemanal ? tendenciaSemanal : tendenciaDiaria;

  // ── Agrupaciones ──────────────────────────────────────────────────────────
  const porCliente = useMemo(() => {
    const map = new Map<string, { pedidos: number; m3: number; ingresos: number; pagados: number; pendiente: number }>();
    filtered.forEach((r) => {
      const curr = map.get(r.cliente) ?? { pedidos: 0, m3: 0, ingresos: 0, pagados: 0, pendiente: 0 };
      map.set(r.cliente, {
        pedidos:   curr.pedidos + 1,
        m3:        curr.m3 + (r.m3Totales ?? 0),
        ingresos:  curr.ingresos + (r.total ?? 0),
        pagados:   curr.pagados  + (isPagado(r.pagado) ? 1 : 0),
        pendiente: curr.pendiente + (isPagado(r.pagado) ? 0 : (r.total ?? 0)),
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.ingresos - a.ingresos)
      .map(([cliente, vals]) => ({ cliente, ...vals, precioM3: vals.m3 > 0 ? vals.ingresos / vals.m3 : 0, ticketProm: vals.pedidos > 0 ? vals.ingresos / vals.pedidos : 0 }));
  }, [filtered]);

  const porVendedor = useMemo(() => {
    const map = new Map<string, { pedidos: number; m3: number; ingresos: number }>();
    filtered.forEach((r) => {
      const key = r.vendedor?.trim() || "Sin asignar";
      const curr = map.get(key) ?? { pedidos: 0, m3: 0, ingresos: 0 };
      map.set(key, { pedidos: curr.pedidos + 1, m3: curr.m3 + (r.m3Totales ?? 0), ingresos: curr.ingresos + (r.total ?? 0) });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b.ingresos - a.ingresos).map(([vendedor, vals]) => ({ vendedor, ...vals }));
  }, [filtered]);

  const porResistencia = useMemo(() => {
    const map = new Map<string, { m3: number; pedidos: number; ingresos: number }>();
    filtered.forEach((r) => {
      const key = r.resistencia || "Sin especificar";
      const curr = map.get(key) ?? { m3: 0, pedidos: 0, ingresos: 0 };
      map.set(key, { m3: curr.m3 + (r.m3Totales ?? 0), pedidos: curr.pedidos + 1, ingresos: curr.ingresos + (r.total ?? 0) });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b.m3 - a.m3).slice(0, 8)
      .map(([resistencia, vals]) => ({ resistencia, ...vals, precioM3: vals.m3 > 0 ? vals.ingresos / vals.m3 : 0 }));
  }, [filtered]);

  const porMetodoPago = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filtered.filter((r) => isPagado(r.pagado)).forEach((r) => {
      const key = r.metodoPago?.trim() || "No especificado";
      const curr = map.get(key) ?? { count: 0, total: 0 };
      map.set(key, { count: curr.count + 1, total: curr.total + (r.total ?? 0) });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b.total - a.total).map(([metodo, vals]) => ({ metodo, ...vals }));
  }, [filtered]);

  const porBomba = useMemo(() => {
    const map = new Map<string, { m3: number; pedidos: number }>();
    filtered.forEach((r) => {
      const key = r.tdBom?.trim() || "Directo";
      const curr = map.get(key) ?? { m3: 0, pedidos: 0 };
      map.set(key, { m3: curr.m3 + (r.m3Totales ?? 0), pedidos: curr.pedidos + 1 });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b.m3 - a.m3).map(([tipo, vals]) => ({ tipo, ...vals }));
  }, [filtered]);

  const porEstado = useMemo(() => {
    const p = filtered.filter((r) => isPagado(r.pagado)).length;
    const n = filtered.length - p;
    const result: { name: string; value: number; amount: number }[] = [];
    if (p > 0) result.push({ name: "Pagado",    value: p, amount: pagados.reduce((s, r) => s + (r.total ?? 0), 0) });
    if (n > 0) result.push({ name: "Pendiente", value: n, amount: carteraPendiente });
    return result;
  }, [filtered, pagados, carteraPendiente]);

  const carteraPorCliente = useMemo(() => porCliente.filter((c) => c.pendiente > 0).sort((a, b) => b.pendiente - a.pendiente), [porCliente]);

  const top3 = porCliente.slice(0, 3);
  const top3Total = top3.reduce((s, c) => s + c.ingresos, 0);
  const top3Pct   = totalIngresos > 0 ? Math.round((top3Total / totalIngresos) * 100) : 0;

  // ── Detail table (with drill + search) ────────────────────────────────────
  const tableRows = useMemo(() => {
    const q = query.toLowerCase();
    return filtered
      .filter((r) => matchDrill(r, drill, useSemanal))
      .filter((r) => !q || r.cliente?.toLowerCase().includes(q) || r.recibo?.toLowerCase().includes(q) || r.resistencia?.toLowerCase().includes(q) || r.vendedor?.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "total") return (b.total ?? 0) - (a.total ?? 0);
        if (sortBy === "m3") return (b.m3Totales ?? 0) - (a.m3Totales ?? 0);
        return parseDia(b.dia).getTime() - parseDia(a.dia).getTime();
      });
  }, [filtered, drill, useSemanal, query, sortBy]);

  // ── Export Excel ──────────────────────────────────────────────────────────
  function exportXLSX() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const detalle = filtered.map((r) => ({
      "Fecha": r.dia, "Cliente": r.cliente, "Vendedor": r.vendedor ?? "",
      "Recibo": r.recibo ?? "", "M³": r.m3Totales ?? "", "Precio/m³": r.precioM3 ?? "",
      "Total": r.total ?? "", "Resistencia": r.resistencia ?? "", "Bomba": r.tdBom ?? "",
      "Pagado": r.pagado ?? "", "Método Pago": r.metodoPago ?? "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), "Detalle");
    const clientes = porCliente.map((c, i) => ({
      "#": i + 1, "Cliente": c.cliente, "Pedidos": c.pedidos, "Pagados": c.pagados,
      "M³": +c.m3.toFixed(1), "Total": +c.ingresos.toFixed(2),
      "Precio/m³ prom": +c.precioM3.toFixed(2), "Pendiente": +c.pendiente.toFixed(2),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), "Por cliente");
    const vendedores = porVendedor.map((v) => ({ "Vendedor": v.vendedor, "Pedidos": v.pedidos, "M³": +v.m3.toFixed(1), "Total": +v.ingresos.toFixed(2) }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendedores), "Por vendedor");
    XLSX.writeFile(wb, `reporte-${period}-${todayCST()}.xlsx`);
  }

  const drillActive = (field: DrillField, value: string) => drill?.field === field && drill.value === value;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Análisis operativo y gerencial · click en gráficas para filtrar detalle</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-0.5">
            {(["semana","mes","mes-anterior","trimestre","año","personalizado"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${period === p ? "bg-[#CC2229] text-white shadow" : "text-gray-400 hover:text-white"}`}>
                {p === "personalizado" && <CalendarRange size={11} />}{PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button onClick={exportXLSX} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40">
            <Download size={13} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Custom date */}
      {period === "personalizado" && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl">
          <CalendarRange size={14} className="text-[#CC2229] shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
            <input type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#242424] border border-[#3A3A3A] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60 [color-scheme:dark]" />
            <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
            <input type="date" value={customEnd} min={customStart} max={todayCST()} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#242424] border border-[#3A3A3A] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60 [color-scheme:dark]" />
          </div>
          <span className="text-xs text-gray-600">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl">
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <svg className="h-9 w-9 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400">{loadingLong ? "Cargando información…" : "Cargando reportes…"}</p>
          </div>
        </div>
      ) : <>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard icon={ClipboardList} label="Pedidos registrados" value={String(totalProg)}
          sub={`${pagados.length} pagados`} color="text-blue-400" pct={trendPct(totalProg, prevTotal)} />
        <KPICard icon={Package} label="M³ programados"
          value={`${totalM3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`}
          sub={totalProg > 0 ? `${(totalM3 / totalProg).toFixed(1)} m³ prom/pedido` : "Sin pedidos"}
          color="text-yellow-400" pct={trendPct(totalM3, prevM3)} />
        <KPICard icon={TrendingUp} label="Total facturado" value={currency(totalIngresos)}
          sub={totalProg > 0 ? `${currency(totalIngresos / totalProg)} prom/pedido` : "Sin pedidos"}
          color="text-green-400" pct={trendPct(totalIngresos, prevIngresos)} />
        <KPICard icon={DollarSign} label="Precio promedio/m³"
          value={precioPromM3 > 0 ? currency(precioPromM3) : "—"}
          sub={`${pctPagados}% cobrado`} color="text-purple-400" pct={trendPct(precioPromM3, prevPrecioM3)} />
      </div>

      {/* Alerta cartera */}
      {carteraPendiente > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-amber-500/8 border border-amber-500/25 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <div>
              <span className="text-amber-300 font-semibold text-sm">Cartera pendiente: {currency(carteraPendiente)}</span>
              <span className="text-amber-500/70 text-xs ml-2">· {filtered.length - pagados.length} pedidos sin cobrar</span>
            </div>
          </div>
          <button onClick={() => setTab("cobranza")} className="text-xs text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 cursor-pointer">
            Ver cobranza →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
        {([
          { key: "ventas",      label: "Ventas",      icon: TrendingUp },
          { key: "operacional", label: "Operacional", icon: Zap        },
          { key: "cobranza",    label: "Cobranza",    icon: Banknote   },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${tab === key ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* ══ TAB: VENTAS ══════════════════════════════════════════════════════ */}
      {tab === "ventas" && (
        <div className="space-y-4">

          {/* Tendencia + Estado de cobro */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <Card title={`Total facturado y m³ — tendencia ${useSemanal ? "semanal" : "diaria"}`} subtitle="Click en una barra para filtrar el detalle">
                <div className="p-5">
                  {tendencia.length < 2 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={230}>
                      <ComposedChart data={tendencia} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onClick={(d: any) => { const p = d?.activePayload?.[0]?.payload; if (p?.rawDia) applyDrill(useSemanal ? "semana" : "dia", p.rawDia, p.dia); }}
                        style={{ cursor: "pointer" }}>
                        <defs>
                          <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                        <XAxis dataKey="dia" stroke="#4B5563" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="ing" stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                        <YAxis yAxisId="m3" orientation="right" stroke="#4B5563" tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                        <Tooltip contentStyle={TT} formatter={(v, name) => [name === "Total" ? currency(Number(v) || 0) : `${v} m³`, name]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                        <Area yAxisId="ing" type="monotone" dataKey="ingresos" name="Total" stroke="#CC2229" strokeWidth={2} fill="url(#gI)" dot={false} />
                        <Line yAxisId="m3" type="monotone" dataKey="m3" name="M³" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card title="Estado de cobro" subtitle="Click para filtrar">
                <div className="p-5">
                  {porEstado.length === 0 ? <EmptyChart /> : (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={porEstado} cx="50%" cy="50%" innerRadius={50} outerRadius={68} paddingAngle={3} dataKey="value"
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onClick={(d: any) => d?.name && applyDrill("metodoPago", d.name === "Pagado" ? "pagado" : "pendiente", String(d.name))}>
                            {porEstado.map((e) => <Cell key={e.name} fill={PAGO_COLORS[e.name] ?? "#6B7280"} style={{ cursor: "pointer" }} />)}
                          </Pie>
                          <Tooltip contentStyle={TT} formatter={(v, name) => [v, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-1">
                        {porEstado.map((e) => (
                          <div key={e.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: PAGO_COLORS[e.name] ?? "#6B7280" }} />
                              <span className="text-gray-400">{e.name}</span>
                            </div>
                            <div className="flex items-center gap-3 tabular-nums">
                              <span className="text-gray-500">{e.value} pedidos</span>
                              <span className="text-white font-semibold">{currency(e.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Por vendedor + Por bomba */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Ingresos por vendedor" subtitle="Click para filtrar detalle">
              <div className="p-5">
                {porVendedor.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porVendedor} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onClick={(d: any) => d?.activePayload?.[0] && applyDrill("vendedor", d.activePayload[0].payload.vendedor)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                      <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="vendedor" stroke="#4B5563" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip contentStyle={TT} formatter={(v) => [currency(Number(v) || 0), "Ingresos"]} />
                      <Bar dataKey="ingresos" radius={[0, 4, 4, 0]} name="Ingresos" style={{ cursor: "pointer" }}>
                        {porVendedor.map((e) => <Cell key={e.vendedor} fill={drillActive("vendedor", e.vendedor) ? "#fff" : "#CC2229"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="M³ por tipo de entrega (bomba)" subtitle="Click para filtrar detalle">
              <div className="p-5">
                {porBomba.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porBomba} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onClick={(d: any) => d?.activePayload?.[0] && applyDrill("bomba", d.activePayload[0].payload.tipo)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                      <XAxis dataKey="tipo" stroke="#4B5563" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={TT} formatter={(v) => [`${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`, "M³"]} />
                      <Bar dataKey="m3" radius={[4, 4, 0, 0]} name="M³" style={{ cursor: "pointer" }}>
                        {porBomba.map((e, i) => <Cell key={e.tipo} fill={drillActive("bomba", e.tipo) ? "#fff" : BOMBA_COLORS[i % BOMBA_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Por resistencia */}
          <Card title="M³ por resistencia" subtitle="Top 8 · click para filtrar detalle">
            <div className="p-5">
              {porResistencia.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porResistencia} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(d: any) => d?.activePayload?.[0] && applyDrill("resistencia", d.activePayload[0].payload.resistencia)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="resistencia" stroke="#4B5563" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toLocaleString("es-MX")} />
                    <Tooltip contentStyle={TT} formatter={(v) => [`${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`, "M³"]} />
                    <Bar dataKey="m3" radius={[4, 4, 0, 0]} name="m3" style={{ cursor: "pointer" }}>
                      {porResistencia.map((e) => <Cell key={e.resistencia} fill={drillActive("resistencia", e.resistencia) ? "#fff" : "#3B82F6"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Método de pago */}
          {porMetodoPago.length > 0 && (
            <Card title="Cobros por método de pago" subtitle="Solo pedidos marcados como pagados · click fila para filtrar">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#1A1A1A]">
                    {["Método","Pedidos cobrados","Total cobrado","% del cobrado"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {porMetodoPago.map((m) => {
                      const totalCobrado = pagados.reduce((s, r) => s + (r.total ?? 0), 0);
                      const pct = totalCobrado > 0 ? Math.round((m.total / totalCobrado) * 100) : 0;
                      const active = drillActive("metodoPago", m.metodo);
                      return (
                        <tr key={m.metodo} onClick={() => applyDrill("metodoPago", m.metodo)}
                          className={`transition-colors cursor-pointer ${active ? "bg-[#CC2229]/10 border-l-2 border-[#CC2229]" : "hover:bg-[#2A2A2A]"}`}>
                          <td className="px-4 py-3 text-white font-medium">{m.metodo}</td>
                          <td className="px-4 py-3 text-gray-400">{m.count}</td>
                          <td className="px-4 py-3 text-white font-semibold tabular-nums">{currency(m.total)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══ TAB: OPERACIONAL ═════════════════════════════════════════════════ */}
      {tab === "operacional" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard icon={Users}        label="Clientes atendidos"   value={String(porCliente.length)}  sub="en el período"          color="text-blue-400" />
            <KPICard icon={Zap}          label="M³/día promedio"      value={totalM3 > 0 ? (totalM3 / Math.max(tendenciaDiaria.length, 1)).toFixed(1) : "—"} sub="días con pedidos" color="text-yellow-400" />
            <KPICard icon={BarChart3}    label="Concentración top 3"  value={`${top3Pct}%`}              sub={`${currency(top3Total)} de ${currency(totalIngresos)}`} color="text-purple-400" warn={top3Pct > 60} />
            <KPICard icon={CheckCircle2} label="Pedidos entregados"   value={String(filtered.filter((r) => r.fase === "Entregado").length)} sub={`de ${totalProg} totales`} color="text-emerald-400" />
          </div>

          <Card title="Ranking de clientes" subtitle="Click en fila para filtrar el detalle de pedidos">
            {porCliente.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-600">Sin datos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#1A1A1A]">
                    {["#","Cliente","Pedidos","Pagados","M³","Total","Precio/m³","Ticket prom.","% Pagado"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {porCliente.map((row, i) => {
                      const pct   = row.pedidos > 0 ? Math.round((row.pagados / row.pedidos) * 100) : 0;
                      const share = totalIngresos > 0 ? Math.round((row.ingresos / totalIngresos) * 100) : 0;
                      const active = drillActive("cliente", row.cliente);
                      return (
                        <tr key={row.cliente} onClick={() => applyDrill("cliente", row.cliente)}
                          className={`cursor-pointer transition-colors ${active ? "bg-[#CC2229]/10 border-l-2 border-[#CC2229]" : "hover:bg-[#2A2A2A]"}`}>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="text-white font-medium">{row.cliente}</div>
                            <div className="w-full mt-1 h-1 bg-[#3A3A3A] rounded-full overflow-hidden">
                              <div className="h-full bg-[#CC2229]/60 rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{share}% del total</div>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{row.pedidos}</td>
                          <td className="px-4 py-3 text-emerald-400 font-semibold">{row.pagados}</td>
                          <td className="px-4 py-3 text-gray-300 tabular-nums">{row.m3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³</td>
                          <td className="px-4 py-3 text-white font-semibold tabular-nums">{currency(row.ingresos)}</td>
                          <td className="px-4 py-3 text-gray-300 tabular-nums">{row.precioM3 > 0 ? currency(row.precioM3) : "—"}</td>
                          <td className="px-4 py-3 text-gray-300 tabular-nums">{currency(row.ticketProm)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#CC2229] rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="M³ por cliente — top 10" subtitle="Click para filtrar detalle">
            <div className="p-5">
              {porCliente.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porCliente.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(d: any) => d?.activePayload?.[0] && applyDrill("cliente", d.activePayload[0].payload.cliente)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                    <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toLocaleString("es-MX")} />
                    <YAxis type="category" dataKey="cliente" stroke="#4B5563" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip contentStyle={TT} formatter={(v) => [`${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`, "M³"]} />
                    <Bar dataKey="m3" radius={[0, 4, 4, 0]} name="M³" style={{ cursor: "pointer" }}>
                      {porCliente.slice(0, 10).map((e) => <Cell key={e.cliente} fill={drillActive("cliente", e.cliente) ? "#fff" : "#CC2229"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ══ TAB: COBRANZA ════════════════════════════════════════════════════ */}
      {tab === "cobranza" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard icon={Banknote}     label="Total cobrado"       value={currency(totalIngresos - carteraPendiente)} sub={`${pagados.length} pedidos`}                color="text-emerald-400" pct={trendPct(totalIngresos - carteraPendiente, prevIngresos - prevCartera)} />
            <KPICard icon={FileWarning}  label="Cartera pendiente"   value={currency(carteraPendiente)}                 sub={`${filtered.length - pagados.length} pedidos`} color="text-amber-400"   warn={carteraPendiente > 0} pct={trendPct(carteraPendiente, prevCartera)} />
            <KPICard icon={CheckCircle2} label="% Efectividad cobro" value={`${pctPagados}%`}                           sub="pedidos cobrados"                             color="text-blue-400"   pct={trendPct(pctPagados, prevPct)} />
            <KPICard icon={AlertCircle}  label="Clientes con saldo"  value={String(carteraPorCliente.length)}           sub="con pedidos sin cobrar"                       color="text-red-400"    warn={carteraPorCliente.length > 0} />
          </div>

          <Card title="Cartera pendiente por cliente" subtitle="Click en fila para ver los pedidos de ese cliente">
            {carteraPorCliente.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <CheckCircle2 size={36} className="text-emerald-400/50" />
                <p className="text-sm text-gray-500">Sin cartera pendiente en el período. ✓</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[#1A1A1A]">
                    {["Cliente","Pedidos pend.","Monto pendiente","Total generado","% pendiente"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {carteraPorCliente.map((row) => {
                      const pct = row.ingresos > 0 ? Math.round((row.pendiente / row.ingresos) * 100) : 0;
                      const active = drillActive("cliente", row.cliente);
                      return (
                        <tr key={row.cliente} onClick={() => applyDrill("cliente", row.cliente)}
                          className={`cursor-pointer transition-colors ${active ? "bg-[#CC2229]/10 border-l-2 border-[#CC2229]" : "hover:bg-[#2A2A2A]"}`}>
                          <td className="px-4 py-3 text-white font-medium">{row.cliente}</td>
                          <td className="px-4 py-3 text-amber-400 font-semibold">{row.pedidos - row.pagados}</td>
                          <td className="px-4 py-3 text-amber-300 font-bold tabular-nums text-base">{currency(row.pendiente)}</td>
                          <td className="px-4 py-3 text-gray-400 tabular-nums">{currency(row.ingresos)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct > 50 ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-xs font-semibold tabular-nums ${pct > 50 ? "text-red-400" : "text-amber-400"}`}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                      <td className="px-4 py-3 text-white font-semibold" colSpan={2}>Total cartera</td>
                      <td className="px-4 py-3 text-amber-300 font-bold tabular-nums">{currency(carteraPendiente)}</td>
                      <td className="px-4 py-3 text-gray-400 tabular-nums">{currency(totalIngresos)}</td>
                      <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">
                        {totalIngresos > 0 ? Math.round((carteraPendiente / totalIngresos) * 100) : 0}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          <Card title="Pedidos sin cobrar" subtitle="Detalle · click en fila de deudor arriba para filtrar por cliente">
            <div className="overflow-x-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1A1A1A]">
                    {["Fecha","Cliente","Vendedor","Recibo","M³","Total","Resistencia"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {filtered
                    .filter((r) => !isPagado(r.pagado))
                    .filter((r) => matchDrill(r, drill, useSemanal))
                    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
                    .map((r, i) => (
                      <tr key={r.id ?? i} className="hover:bg-[#2A2A2A] transition-colors">
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {r.dia ? parseDia(r.dia).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-200 font-medium text-xs whitespace-nowrap">{r.cliente}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.vendedor || "—"}</td>
                        <td className="px-4 py-2.5 text-[#CC2229] font-mono text-xs">{r.recibo || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300 text-xs tabular-nums">{(r.m3Totales ?? 0).toFixed(1)} m³</td>
                        <td className="px-4 py-2.5 text-amber-300 font-semibold text-xs tabular-nums">{r.total != null ? currency(r.total) : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{r.resistencia || "—"}</td>
                      </tr>
                    ))}
                  {filtered.filter((r) => !isPagado(r.pagado)).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-600">Sin pedidos pendientes en el período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Detalle de pedidos ───────────────────────────────────────────────── */}
      <div id="detalle-table">
        <Card title="Detalle de pedidos">
          <div className="px-5 py-3 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">{tableRows.length} de {filtered.length} pedidos</span>
              {drill && <DrillBreadcrumb drill={drill} onClear={() => setDrill(null)} />}
            </div>
            <div className="flex items-center gap-2">
              <AppSelect dark compact value={sortBy} onChange={(e) => setSortBy(e.target.value as "fecha" | "total" | "m3")} wrapperClassName="">
                <option value="fecha">Por fecha</option>
                <option value="m3">Por m³</option>
                <option value="total">Por total</option>
              </AppSelect>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cliente, recibo, vendedor..."
                  className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-52 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A]">
                  {["Fecha","Cliente","Vendedor","Recibo","M³","Precio/m³","Total","Resistencia","Bomba","Pagado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {tableRows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-600">
                    {drill ? `Sin pedidos para "${drill.label}".` : filtered.length === 0 ? "Sin pedidos en el período." : "Sin resultados."}
                  </td></tr>
                ) : tableRows.map((r, i) => (
                  <tr key={r.id ?? i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {r.dia ? parseDia(r.dia).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 cursor-pointer text-gray-200 font-medium text-xs whitespace-nowrap hover:text-white"
                      onClick={() => applyDrill("cliente", r.cliente)}>{r.cliente}</td>
                    <td className="px-4 py-2.5 cursor-pointer text-gray-500 text-xs whitespace-nowrap hover:text-gray-300"
                      onClick={() => r.vendedor && applyDrill("vendedor", r.vendedor.trim() || "Sin asignar")}>{r.vendedor || "—"}</td>
                    <td className="px-4 py-2.5 text-[#CC2229] font-mono text-xs">{r.recibo || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-200 text-xs tabular-nums">{(r.m3Totales ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums">{r.precioM3 != null ? currency(r.precioM3) : "—"}</td>
                    <td className="px-4 py-2.5 text-white font-semibold text-xs tabular-nums">{r.total != null ? currency(r.total) : "—"}</td>
                    <td className="px-4 py-2.5 cursor-pointer text-gray-400 text-xs hover:text-gray-200"
                      onClick={() => r.resistencia && applyDrill("resistencia", r.resistencia)}>{r.resistencia || "—"}</td>
                    <td className="px-4 py-2.5 cursor-pointer text-gray-400 text-xs hover:text-gray-200"
                      onClick={() => applyDrill("bomba", r.tdBom?.trim() || "Directo")}>{r.tdBom || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPagado(r.pagado) ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                        {isPagado(r.pagado) ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      </>}
    </div>
  );
}
