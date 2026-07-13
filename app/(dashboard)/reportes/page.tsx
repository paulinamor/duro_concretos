"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Package, CheckCircle2, Download, Search,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList, CalendarRange,
} from "lucide-react";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { filterByPlanta } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Programacion {
  id?: string;
  dia: string;
  cliente: string;
  vendedor: string;
  direccion: string;
  resistencia: string;
  m3Totales: number | null;
  precioM3: number | null;
  total: number | null;
  pagado: string;
  metodoPago: string;
  recibo: string;
  fact: string;
  tdBom: string;
  planta?: string;
}

type Period = "semana" | "mes" | "mes-anterior" | "trimestre" | "año" | "personalizado";

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
  // ISO: YYYY-MM-DD
  if (dia.includes("-")) return new Date(dia + "T12:00:00");
  // DD/MM/YYYY
  const [d, m, y] = dia.split("/").map(Number);
  return new Date(y, m - 1, d, 12);
}

function isPagado(pagado: string): boolean {
  return /^s[ií]/i.test(pagado?.trim() ?? "");
}

function getRange(p: Period): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (p) {
    case "semana": {
      const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const start = new Date(today);
      start.setDate(today.getDate() - dow);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "mes":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case "mes-anterior":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "trimestre": {
      const start = new Date(today);
      start.setDate(today.getDate() - 89);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "año":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
  }
}

function getPrevRange(p: Period): { start: Date; end: Date } {
  const now = new Date();
  if (p === "semana") {
    const { start, end } = getRange("semana");
    return {
      start: new Date(start.getTime() - 7 * 86_400_000),
      end: new Date(end.getTime() - 7 * 86_400_000),
    };
  }
  if (p === "mes") return getRange("mes-anterior");
  if (p === "mes-anterior")
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999),
    };
  if (p === "trimestre") {
    const { start } = getRange("trimestre");
    const prevEnd = new Date(start.getTime() - 86_400_000);
    const prevStart = new Date(prevEnd.getTime() - 89 * 86_400_000);
    return { start: prevStart, end: prevEnd };
  }
  return {
    start: new Date(now.getFullYear() - 1, 0, 1),
    end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
  };
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

function trendPct(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

// ─── Components ───────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

const PAGO_COLORS: Record<string, string> = {
  Pagado: "#10B981",
  Pendiente: "#F59E0B",
};

function KPICard({ icon: Icon, label, value, sub, color, pct }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string; pct?: number | null;
}) {
  return (
    <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white leading-tight truncate">{value}</p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{sub}</span>
            {pct !== undefined && pct !== null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${pct > 0 ? "text-green-400" : pct < 0 ? "text-red-400" : "text-gray-500"}`}>
                {pct > 0 ? <ArrowUpRight size={11} /> : pct < 0 ? <ArrowDownRight size={11} /> : <Minus size={11} />}
                {Math.abs(pct)}% vs período ant.
              </span>
            )}
          </div>
        </div>
        <div className={`shrink-0 rounded-xl bg-[#1A1A1A] p-3 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-gray-600" style={{ height }}>
      Sin datos en el período seleccionado
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-4 border-b border-[#3A3A3A]">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mes");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"fecha" | "total" | "m3">("fecha");

  useEffect(() => {
    getCollectionDocs<Programacion>(COLLECTIONS.programaciones)
      .then((docs) => setProgramaciones(filterByPlanta(docs)))
      .finally(() => setLoading(false));
  }, []);

  // ── Ranges ────────────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => {
    if (period === "personalizado") {
      const s = new Date(customStart + "T00:00:00");
      const e = new Date(customEnd + "T23:59:59");
      return { start: s, end: e };
    }
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const pagados = filtered.filter((r) => isPagado(r.pagado));
  const prevPagados = prevFiltered.filter((r) => isPagado(r.pagado));

  const totalProg = filtered.length;
  const totalM3 = filtered.reduce((s, r) => s + (r.m3Totales ?? 0), 0);
  const totalIngresos = filtered.reduce((s, r) => s + (r.total ?? 0), 0);
  const pctPagados = totalProg > 0 ? Math.round((pagados.length / totalProg) * 100) : 0;

  const prevIngresos = prevFiltered.reduce((s, r) => s + (r.total ?? 0), 0);
  const prevM3 = prevFiltered.reduce((s, r) => s + (r.m3Totales ?? 0), 0);
  const prevTotal = prevFiltered.length;
  const prevPct = prevTotal > 0 ? Math.round((prevPagados.length / prevTotal) * 100) : 0;

  // ── Tendencia por día ─────────────────────────────────────────────────────
  const tendencia = useMemo(() => {
    const map = new Map<string, { ingresos: number; m3: number; pedidos: number }>();
    filtered.forEach((r) => {
      const key = r.dia;
      const curr = map.get(key) ?? { ingresos: 0, m3: 0, pedidos: 0 };
      map.set(key, {
        ingresos: curr.ingresos + (r.total ?? 0),
        m3: curr.m3 + (r.m3Totales ?? 0),
        pedidos: curr.pedidos + 1,
      });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => parseDia(a).getTime() - parseDia(b).getTime())
      .map(([dia, vals]) => ({
        dia: parseDia(dia).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
        ...vals,
      }));
  }, [filtered]);

  // ── Por cliente ───────────────────────────────────────────────────────────
  const porCliente = useMemo(() => {
    const map = new Map<string, { pedidos: number; m3: number; ingresos: number; pagados: number }>();
    filtered.forEach((r) => {
      const curr = map.get(r.cliente) ?? { pedidos: 0, m3: 0, ingresos: 0, pagados: 0 };
      map.set(r.cliente, {
        pedidos: curr.pedidos + 1,
        m3: curr.m3 + (r.m3Totales ?? 0),
        ingresos: curr.ingresos + (r.total ?? 0),
        pagados: curr.pagados + (isPagado(r.pagado) ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.ingresos - a.ingresos)
      .map(([cliente, vals]) => ({ cliente, ...vals }));
  }, [filtered]);

  // ── Por resistencia ───────────────────────────────────────────────────────
  const porResistencia = useMemo(() => {
    const map = new Map<string, { m3: number; pedidos: number }>();
    filtered.forEach((r) => {
      const key = r.resistencia || "Sin especificar";
      const curr = map.get(key) ?? { m3: 0, pedidos: 0 };
      map.set(key, { m3: curr.m3 + (r.m3Totales ?? 0), pedidos: curr.pedidos + 1 });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.m3 - a.m3)
      .slice(0, 8)
      .map(([resistencia, vals]) => ({ resistencia, ...vals }));
  }, [filtered]);

  // ── Distribución pago ─────────────────────────────────────────────────────
  const porEstado = useMemo(() => {
    const pagadosCount = filtered.filter((r) => isPagado(r.pagado)).length;
    const pendientesCount = filtered.length - pagadosCount;
    const result: { name: string; value: number }[] = [];
    if (pagadosCount > 0) result.push({ name: "Pagado", value: pagadosCount });
    if (pendientesCount > 0) result.push({ name: "Pendiente", value: pendientesCount });
    return result;
  }, [filtered]);

  // ── Tabla detalle ─────────────────────────────────────────────────────────
  const tableRows = useMemo(() => {
    const q = query.toLowerCase();
    return filtered
      .filter((r) =>
        !q ||
        r.cliente?.toLowerCase().includes(q) ||
        r.recibo?.toLowerCase().includes(q) ||
        r.resistencia?.toLowerCase().includes(q) ||
        r.direccion?.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (sortBy === "total") return (b.total ?? 0) - (a.total ?? 0);
        if (sortBy === "m3") return (b.m3Totales ?? 0) - (a.m3Totales ?? 0);
        return parseDia(b.dia).getTime() - parseDia(a.dia).getTime();
      });
  }, [filtered, query, sortBy]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Fecha", "Cliente", "Recibo", "M³", "Precio/m³", "Total", "Resistencia", "Pagado", "Método Pago"];
    const rows = filtered.map((r) =>
      [r.dia, `"${r.cliente}"`, r.recibo ?? "", r.m3Totales ?? "", r.precioM3 ?? "", r.total ?? "",
        `"${r.resistencia}"`, r.pagado, r.metodoPago].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-programacion-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Análisis operativo y gerencial</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-0.5">
            {(["semana", "mes", "mes-anterior", "trimestre", "año", "personalizado"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p ? "bg-[#CC2229] text-white shadow" : "text-gray-400 hover:text-white"}`}
              >
                {p === "personalizado" && <CalendarRange size={11} />}
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Custom date range picker */}
      {period === "personalizado" && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl">
          <CalendarRange size={14} className="text-[#CC2229] shrink-0" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#242424] border border-[#3A3A3A] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60 [color-scheme:dark]"
            />
            <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#242424] border border-[#3A3A3A] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60 [color-scheme:dark]"
            />
          </div>
          <span className="text-xs text-gray-600">
            {filtered.length} pedido{filtered.length !== 1 ? "s" : ""} en este rango
          </span>
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[#242424] border border-[#3A3A3A] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            icon={ClipboardList}
            label="Pedidos registrados"
            value={String(totalProg)}
            sub={`${pagados.length} pagados`}
            color="text-blue-400"
            pct={trendPct(totalProg, prevTotal)}
          />
          <KPICard
            icon={Package}
            label="M³ programados"
            value={`${totalM3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³`}
            sub={totalProg > 0 ? `${(totalM3 / totalProg).toFixed(1)} prom/pedido` : "Sin pedidos"}
            color="text-yellow-400"
            pct={trendPct(totalM3, prevM3)}
          />
          <KPICard
            icon={TrendingUp}
            label="Total facturado"
            value={currency(totalIngresos)}
            sub={totalProg > 0 ? `${currency(totalIngresos / totalProg)} prom/pedido` : "Sin pedidos"}
            color="text-green-400"
            pct={trendPct(totalIngresos, prevIngresos)}
          />
          <KPICard
            icon={CheckCircle2}
            label="% Pagados"
            value={`${pctPagados}%`}
            sub={`${filtered.length - pagados.length} pendientes`}
            color="text-[#CC2229]"
            pct={trendPct(pctPagados, prevPct)}
          />
        </div>
      )}

      {/* Charts row 1 — Tendencia + Estado */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="Total facturado y m³ — tendencia diaria" />
          <div className="p-5">
            {tendencia.length < 2 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={tendencia} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="dia" stroke="#4B5563" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="ing" stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                  <YAxis yAxisId="m3" orientation="right" stroke="#4B5563" tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [name === "Total" ? currency(Number(v) || 0) : `${v} m³`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                  <Area yAxisId="ing" type="monotone" dataKey="ingresos" name="Total" stroke="#CC2229" strokeWidth={2} fill="url(#gradIngresos)" dot={false} />
                  <Area yAxisId="m3" type="monotone" dataKey="m3" name="M³" stroke="#3B82F6" strokeWidth={2} fill="url(#gradM3)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="Estado de pago" />
          <div className="p-5">
            {porEstado.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porEstado} cx="50%" cy="42%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value">
                    {porEstado.map((entry) => (
                      <Cell key={entry.name} fill={PAGO_COLORS[entry.name] ?? "#6B7280"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [v, name]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts row 2 — Por cliente + Por resistencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="M³ por cliente (top 8)" />
          <div className="p-5">
            {porCliente.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={porCliente.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
                  <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toLocaleString("es-MX")} />
                  <YAxis type="category" dataKey="cliente" stroke="#4B5563" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [(Number(v) || 0).toLocaleString("es-MX") + " m³", "M³"]} />
                  <Bar dataKey="m3" fill="#CC2229" radius={[0, 4, 4, 0]} name="M³" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="M³ por resistencia" />
          <div className="p-5">
            {porResistencia.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={porResistencia} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="resistencia" stroke="#4B5563" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toLocaleString("es-MX")} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [(Number(v) || 0).toLocaleString("es-MX") + " m³", "M³"]} />
                  <Bar dataKey="m3" fill="#3B82F6" radius={[4, 4, 0, 0]} name="M³" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tabla por cliente */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <SectionHeader title="Resumen por cliente" />
        {porCliente.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-600">Sin datos en el período seleccionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["#", "Cliente", "Pedidos", "Pagados", "M³", "Total", "% Pagado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {porCliente.map((row, i) => {
                  const pct = row.pedidos > 0 ? Math.round((row.pagados / row.pedidos) * 100) : 0;
                  return (
                    <tr key={row.cliente} className="transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{i + 1}</td>
                      <td className="px-4 py-3 text-white font-medium">{row.cliente}</td>
                      <td className="px-4 py-3 text-gray-400">{row.pedidos}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">{row.pagados}</td>
                      <td className="px-4 py-3 text-gray-300">{row.m3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³</td>
                      <td className="px-4 py-3 text-white font-semibold">{currency(row.ingresos)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
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
      </div>

      {/* Detalle de pedidos */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">
            Detalle de pedidos
            <span className="ml-2 text-xs text-gray-500 font-normal">({tableRows.length} de {filtered.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "fecha" | "total" | "m3")}
              className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-400 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
            >
              <option value="fecha">Por fecha</option>
              <option value="total">Por total</option>
              <option value="m3">Por m³</option>
            </select>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cliente, recibo, resistencia..."
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-48 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1A1A1A]">
                {["Fecha", "Cliente", "Recibo", "M³", "Precio/m³", "Total", "Resistencia", "Pagado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-600">
                    {filtered.length === 0 ? "Sin pedidos en el período seleccionado." : "Sin resultados para la búsqueda."}
                  </td>
                </tr>
              ) : (
                tableRows.map((r, i) => (
                  <tr key={r.id ?? i} className="transition-colors hover:bg-[#2A2A2A]">
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                      {r.dia ? parseDia(r.dia).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-200 font-medium text-xs whitespace-nowrap">{r.cliente}</td>
                    <td className="px-4 py-2.5 text-[#CC2229] font-mono text-xs">{r.recibo || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-200 text-xs tabular-nums">{(r.m3Totales ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums">{r.precioM3 != null ? currency(r.precioM3) : "—"}</td>
                    <td className="px-4 py-2.5 text-white font-semibold text-xs tabular-nums">{r.total != null ? currency(r.total) : "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{r.resistencia || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPagado(r.pagado) ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                        {isPagado(r.pagado) ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
