"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Truck,
  TrendingUp,
  Package,
  CheckCircle2,
  Download,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { parseViajeDate, type Viaje } from "@/lib/viajes";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "semana" | "mes" | "mes-anterior" | "trimestre" | "año";

const PERIOD_LABELS: Record<Period, string> = {
  semana: "Esta semana",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  trimestre: "90 días",
  año: "Este año",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const TOOLTIP_STYLE = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

const STATUS_COLORS: Record<string, string> = {
  Completado: "#10B981",
  "En ruta": "#3B82F6",
  Pendiente: "#F59E0B",
  Cancelado: "#6B7280",
};

// ─── Components ───────────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  pct,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  pct?: number | null;
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
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  pct > 0 ? "text-green-400" : pct < 0 ? "text-red-400" : "text-gray-500"
                }`}
              >
                {pct > 0 ? (
                  <ArrowUpRight size={11} />
                ) : pct < 0 ? (
                  <ArrowDownRight size={11} />
                ) : (
                  <Minus size={11} />
                )}
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
    <div
      className="flex items-center justify-center text-sm text-gray-600"
      style={{ height }}
    >
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
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mes");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"fecha" | "ingresos" | "m3">("fecha");

  useEffect(() => {
    getCollectionDocs<Viaje>(COLLECTIONS.viajes)
      .then(setViajes)
      .finally(() => setLoading(false));
  }, []);

  // ── Ranges ────────────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => getRange(period), [period]);
  const { start: pStart, end: pEnd } = useMemo(() => getPrevRange(period), [period]);

  const filtered = useMemo(
    () =>
      viajes.filter((v) => {
        const d = parseViajeDate(v.fecha);
        return d >= start && d <= end;
      }),
    [viajes, start, end],
  );

  const prevFiltered = useMemo(
    () =>
      viajes.filter((v) => {
        const d = parseViajeDate(v.fecha);
        return d >= pStart && d <= pEnd;
      }),
    [viajes, pStart, pEnd],
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const completados = filtered.filter((v) => v.estado === "Completado");
  const prevCompletados = prevFiltered.filter((v) => v.estado === "Completado");

  const totalViajes = filtered.length;
  const totalM3 = completados.reduce((s, v) => s + (v.m3 ?? 0), 0);
  const totalIngresos = completados.reduce((s, v) => s + (v.total ?? 0), 0);
  const tasaExito =
    totalViajes > 0 ? Math.round((completados.length / totalViajes) * 100) : 0;

  const prevIngresos = prevCompletados.reduce((s, v) => s + (v.total ?? 0), 0);
  const prevM3 = prevCompletados.reduce((s, v) => s + (v.m3 ?? 0), 0);
  const prevViajes = prevFiltered.length;
  const prevTasa =
    prevViajes > 0
      ? Math.round((prevCompletados.length / prevViajes) * 100)
      : 0;

  // ── Tendencia por día ─────────────────────────────────────────────────────
  const tendencia = useMemo(() => {
    const map = new Map<string, { ingresos: number; m3: number; viajes: number }>();
    filtered.forEach((v) => {
      const curr = map.get(v.fecha) ?? { ingresos: 0, m3: 0, viajes: 0 };
      map.set(v.fecha, {
        ingresos:
          curr.ingresos + (v.estado === "Completado" ? (v.total ?? 0) : 0),
        m3: curr.m3 + (v.estado === "Completado" ? (v.m3 ?? 0) : 0),
        viajes: curr.viajes + 1,
      });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const toMs = (s: string) => {
          const [d, m, y] = s.split("/").map(Number);
          return new Date(y, m - 1, d).getTime();
        };
        return toMs(a) - toMs(b);
      })
      .map(([dia, vals]) => ({ dia, ...vals }));
  }, [filtered]);

  // ── Por operador ──────────────────────────────────────────────────────────
  const porOperador = useMemo(() => {
    const map = new Map<
      string,
      { viajes: number; m3: number; ingresos: number; completados: number }
    >();
    filtered.forEach((v) => {
      const curr = map.get(v.operador) ?? {
        viajes: 0,
        m3: 0,
        ingresos: 0,
        completados: 0,
      };
      map.set(v.operador, {
        viajes: curr.viajes + 1,
        m3: curr.m3 + (v.estado === "Completado" ? (v.m3 ?? 0) : 0),
        ingresos:
          curr.ingresos + (v.estado === "Completado" ? (v.total ?? 0) : 0),
        completados: curr.completados + (v.estado === "Completado" ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.ingresos - a.ingresos)
      .map(([operador, vals]) => ({ operador, ...vals }));
  }, [filtered]);

  // ── Por estado ────────────────────────────────────────────────────────────
  const porEstado = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((v) => map.set(v.estado, (map.get(v.estado) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ── Top unidades ──────────────────────────────────────────────────────────
  const topUnidades = useMemo(() => {
    const map = new Map<string, { m3: number; viajes: number }>();
    completados.forEach((v) => {
      const key = v.unidad.split(" ")[0];
      const curr = map.get(key) ?? { m3: 0, viajes: 0 };
      map.set(key, {
        m3: curr.m3 + (v.m3 ?? 0),
        viajes: curr.viajes + 1,
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.m3 - a.m3)
      .slice(0, 8)
      .map(([unidad, vals]) => ({ unidad, ...vals }));
  }, [completados]);

  // ── Tabla detalle ─────────────────────────────────────────────────────────
  const tableRows = useMemo(() => {
    const q = query.toLowerCase();
    return filtered
      .filter(
        (v) =>
          !q ||
          v.folio.toLowerCase().includes(q) ||
          v.operador.toLowerCase().includes(q) ||
          v.unidad.toLowerCase().includes(q) ||
          v.destino.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (sortBy === "ingresos") return (b.total ?? 0) - (a.total ?? 0);
        if (sortBy === "m3") return (b.m3 ?? 0) - (a.m3 ?? 0);
        return b.folio.localeCompare(a.folio);
      });
  }, [filtered, query, sortBy]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      "Folio",
      "Fecha",
      "Unidad",
      "Operador",
      "Destino",
      "M3",
      "Precio/M3",
      "Total",
      "Estado",
    ];
    const rows = filtered.map((v) =>
      [
        v.folio,
        v.fecha,
        `"${v.unidad}"`,
        `"${v.operador}"`,
        `"${v.destino}"`,
        v.m3,
        v.precioPorM3,
        v.total,
        v.estado,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-viajes-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
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
          {/* Period selector */}
          <div className="flex bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-0.5">
            {(
              [
                "semana",
                "mes",
                "mes-anterior",
                "trimestre",
                "año",
              ] as Period[]
            ).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? "bg-[#CC2229] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {/* Export */}
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

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-[#242424] border border-[#3A3A3A] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            icon={Truck}
            label="Viajes registrados"
            value={String(totalViajes)}
            sub={`${completados.length} completados`}
            color="text-blue-400"
            pct={trendPct(totalViajes, prevViajes)}
          />
          <KPICard
            icon={Package}
            label="M³ entregados"
            value={`${totalM3.toLocaleString("es-MX")} m³`}
            sub={
              completados.length > 0
                ? `${(totalM3 / completados.length).toFixed(1)} prom/viaje`
                : "Sin viajes"
            }
            color="text-yellow-400"
            pct={trendPct(totalM3, prevM3)}
          />
          <KPICard
            icon={TrendingUp}
            label="Ingresos totales"
            value={currency(totalIngresos)}
            sub={
              completados.length > 0
                ? `${currency(totalIngresos / completados.length)} prom/viaje`
                : "Sin viajes"
            }
            color="text-green-400"
            pct={trendPct(totalIngresos, prevIngresos)}
          />
          <KPICard
            icon={CheckCircle2}
            label="Tasa de éxito"
            value={`${tasaExito}%`}
            sub={`${filtered.filter((v) => v.estado === "Cancelado").length} cancelados`}
            color="text-[#CC2229]"
            pct={trendPct(tasaExito, prevTasa)}
          />
        </div>
      )}

      {/* Charts row 1 — Tendencia + Estado */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="Ingresos y viajes — tendencia diaria" />
          <div className="p-5">
            {tendencia.length < 2 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={tendencia}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradViajes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis
                    dataKey="dia"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="ing"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) =>
                      `$${(v / 1000).toFixed(0)}k`
                    }
                    width={48}
                  />
                  <YAxis
                    yAxisId="vj"
                    orientation="right"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    width={28}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [
                      name === "Ingresos" ? currency(Number(v) || 0) : v,
                      name,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }}
                  />
                  <Area
                    yAxisId="ing"
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="#CC2229"
                    strokeWidth={2}
                    fill="url(#gradIngresos)"
                    dot={false}
                  />
                  <Area
                    yAxisId="vj"
                    type="monotone"
                    dataKey="viajes"
                    name="Viajes"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#gradViajes)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="Distribución por estado" />
          <div className="p-5">
            {porEstado.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={porEstado}
                    cx="50%"
                    cy="42%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {porEstado.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name] ?? "#6B7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v, name) => [v, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts row 2 — Por operador + Top unidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader title="M³ entregados por operador" />
          <div className="p-5">
            {porOperador.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={porOperador.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#2A2A2A"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toLocaleString("es-MX")}
                  />
                  <YAxis
                    type="category"
                    dataKey="operador"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [
                      (Number(v) || 0).toLocaleString("es-MX") + " m³",
                      "M³",
                    ]}
                  />
                  <Bar
                    dataKey="m3"
                    fill="#CC2229"
                    radius={[0, 4, 4, 0]}
                    name="M³"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <SectionHeader
            title={`Top ${topUnidades.length} unidades por m³`}
          />
          <div className="p-5">
            {topUnidades.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={topUnidades}
                  margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#2A2A2A"
                  />
                  <XAxis
                    dataKey="unidad"
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#4B5563"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toLocaleString("es-MX")}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [
                      (Number(v) || 0).toLocaleString("es-MX") + " m³",
                      "M³",
                    ]}
                  />
                  <Bar
                    dataKey="m3"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    name="M³"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Rendimiento por operador */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <SectionHeader title="Rendimiento por operador" />
        {porOperador.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-600">
            Sin datos en el período seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {[
                    "#",
                    "Operador",
                    "Viajes",
                    "Completados",
                    "M³ entregados",
                    "Ingresos",
                    "Eficiencia",
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
                {porOperador.map((row, i) => {
                  const eficiencia =
                    row.viajes > 0
                      ? Math.round((row.completados / row.viajes) * 100)
                      : 0;
                  return (
                    <tr
                      key={row.operador}
                      className="hover:bg-[#2A2A2A] transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {row.operador}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {row.viajes}
                      </td>
                      <td className="px-4 py-3 text-green-400 font-semibold">
                        {row.completados}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {row.m3.toLocaleString("es-MX")} m³
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {currency(row.ingresos)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#CC2229] rounded-full transition-all"
                              style={{ width: `${eficiencia}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {eficiencia}%
                          </span>
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

      {/* Detalle de viajes */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">
            Detalle de viajes
            <span className="ml-2 text-xs text-gray-500 font-normal">
              ({tableRows.length} de {filtered.length})
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "fecha" | "ingresos" | "m3")
              }
              className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-400 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
            >
              <option value="fecha">Por fecha</option>
              <option value="ingresos">Por ingresos</option>
              <option value="m3">Por m³</option>
            </select>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Folio, operador, destino..."
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-48 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {[
                  "Folio",
                  "Fecha",
                  "Unidad",
                  "Operador",
                  "Destino",
                  "M³",
                  "Precio/m³",
                  "Total",
                  "Estado",
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
              {tableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-gray-600"
                  >
                    {filtered.length === 0
                      ? "Sin viajes en el período seleccionado."
                      : "Sin resultados para la búsqueda."}
                  </td>
                </tr>
              ) : (
                tableRows.map((v) => (
                  <tr
                    key={v.folio}
                    className="hover:bg-[#2A2A2A] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[#CC2229] font-mono text-xs">
                      {v.folio}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {v.fecha}
                    </td>
                    <td className="px-4 py-2.5 text-gray-200 font-medium text-xs whitespace-nowrap">
                      {v.unidad}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300 text-xs whitespace-nowrap">
                      {v.operador}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300 text-xs">
                      {v.destino}
                    </td>
                    <td className="px-4 py-2.5 text-gray-200 text-xs tabular-nums">
                      {(v.m3 ?? 0).toLocaleString("es-MX")} m³
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums">
                      {currency(v.precioPorM3 ?? 0)}
                    </td>
                    <td className="px-4 py-2.5 text-white font-semibold text-xs tabular-nums">
                      {currency(v.total ?? 0)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={v.estado} />
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
