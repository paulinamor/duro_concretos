"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { filterByPlanta } from "@/lib/auth";
import type { Unidad } from "@/lib/unidades";
import { TOOLTIP_STYLE } from "@/lib/chartStyles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Programacion {
  id?: string;
  dia: string;
  cliente: string;
  m3Totales: number | null;
  total: number | null;
  totalXM3: number | null;
  resistencia: string;
  pagado: string;
  planta?: string;
}

interface Recibo {
  id?: string;
  folio: number;
  cliente: string;
  importe: number | null;
  metros: number | null;
  fecha: string;
  entregado: boolean;
  resistencia: string;
  planta?: string;
}

interface Cuenta {
  id?: string;
  contraparte: string;
  total: number;
  montoPagado: number;
  vencimiento: string;
  status: string;
  planta?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currency(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

function isoToDisplay(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diasHasta(iso: string) {
  if (!iso) return Infinity;
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86400000);
}

const MES_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];


// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [progs, setProgs] = useState<Programacion[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [cxc, setCxc] = useState<Cuenta[]>([]);
  const [cxp, setCxp] = useState<Cuenta[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Programacion>(COLLECTIONS.programaciones),
      getCollectionDocs<Recibo>(COLLECTIONS.efectivo),
      getCollectionDocs<Cuenta>(COLLECTIONS.cuentasPorCobrar),
      getCollectionDocs<Cuenta>(COLLECTIONS.cuentasPorPagar),
      getCollectionDocs<Unidad>(COLLECTIONS.unidades),
    ]).then(([p, r, cc, cp, u]) => {
      setProgs(filterByPlanta(p));
      setRecibos(filterByPlanta(r));
      setCxc(filterByPlanta(cc));
      setCxp(filterByPlanta(cp));
      setUnidades(filterByPlanta(u));
      setLoading(false);
    });
  }, []);

  // ─── KPIs del mes ──────────────────────────────────────────────────────────
  const progsDelMes = useMemo(() => progs.filter((p) => (p.dia ?? "").startsWith(mesActual)), [progs, mesActual]);
  const m3Mes = useMemo(() => progsDelMes.reduce((s, p) => s + (p.m3Totales ?? 0), 0), [progsDelMes]);
  const ventasMes = useMemo(() => progsDelMes.reduce((s, p) => s + (p.total ?? 0), 0), [progsDelMes]);

  const porCobrar = useMemo(() =>
    cxc.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0), [cxc]);
  const porPagar = useMemo(() =>
    cxp.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0), [cxp]);

  // ─── M³ por día (últimos 15 días) ─────────────────────────────────────────
  const m3PorDia = useMemo(() => {
    const days: { dia: string; m3: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const m3 = progs.filter((p) => p.dia === iso).reduce((s, p) => s + (p.m3Totales ?? 0), 0);
      days.push({ dia: `${d.getDate()}/${d.getMonth() + 1}`, m3 });
    }
    return days;
  }, [progs]);

  // ─── Ventas por mes (últimos 6 meses) ─────────────────────────────────────
  const ventasPorMes = useMemo(() => {
    const months: { mes: string; ventas: number; m3: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = progs.filter((p) => (p.dia ?? "").startsWith(key));
      months.push({
        mes: MES_LABELS[d.getMonth()],
        ventas: bucket.reduce((s, p) => s + (p.total ?? 0), 0),
        m3: bucket.reduce((s, p) => s + (p.m3Totales ?? 0), 0),
      });
    }
    return months;
  }, [progs]);

  // ─── Flota ────────────────────────────────────────────────────────────────
  const flota = useMemo(() => ({
    activas: unidades.filter((u) => u.estatus === "Activo").length,
    mant: unidades.filter((u) => u.estatus === "Mantenimiento").length,
    baja: unidades.filter((u) => u.estatus === "Baja").length,
    proxMant: unidades
      .filter((u) => u.estatus === "Activo" && u.proximoMantenimiento && diasHasta(u.proximoMantenimiento) <= 30)
      .sort((a, b) => diasHasta(a.proximoMantenimiento) - diasHasta(b.proximoMantenimiento))
      .slice(0, 4),
  }), [unidades]);

  // ─── CxC próximas a vencer ───────────────────────────────────────────────
  const cxcPorVencer = useMemo(() =>
    cxc
      .filter((c) => c.status !== "Pagado" && c.vencimiento)
      .sort((a, b) => diasHasta(a.vencimiento) - diasHasta(b.vencimiento))
      .slice(0, 5),
    [cxc]);

  // ─── Recibos pendientes ───────────────────────────────────────────────────
  const recibosPendientes = useMemo(() =>
    recibos.filter((r) => !r.entregado).sort((a, b) => b.folio - a.folio).slice(0, 5),
    [recibos]);

  // ─── Programaciones recientes ─────────────────────────────────────────────
  const progsRecientes = useMemo(() =>
    [...progs].sort((a, b) => (b.dia ?? "").localeCompare(a.dia ?? "")).slice(0, 5),
    [progs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#CC2229] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={`M³ ${MES_LABELS[now.getMonth()]}`}
          value={`${m3Mes.toLocaleString()} m³`}
          icon={Package}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          subtitle={`${progsDelMes.length} programaciones`}
        />
        <KPICard
          title={`Ventas ${MES_LABELS[now.getMonth()]}`}
          value={currency(ventasMes)}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          subtitle={m3Mes > 0 ? `${currency(ventasMes / m3Mes)} / m³ prom.` : "—"}
        />
        <KPICard
          title="Por cobrar"
          value={currency(porCobrar)}
          icon={Banknote}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          subtitle={`${cxc.filter((c) => c.status !== "Pagado").length} docs pendientes`}
        />
        <KPICard
          title="Por pagar"
          value={currency(porPagar)}
          icon={TrendingDown}
          iconColor="text-[#CC2229]"
          iconBg="bg-red-500/10"
          subtitle={`${cxp.filter((c) => c.status !== "Pagado").length} docs pendientes`}
        />
      </div>

      {/* ── Gráficas ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* M³ por día */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">M³ diarios</h3>
              <p className="text-gray-500 text-xs">Últimos 15 días</p>
            </div>
            <span className="text-amber-400 text-xs font-semibold">{m3Mes.toLocaleString()} m³ / mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m3PorDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC2229" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="dia" stroke="#4B5563" tick={{ fontSize: 10 }} interval={2} />
              <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} m³`, "M³"]} />
              <Area type="monotone" dataKey="m3" stroke="#CC2229" strokeWidth={2} fill="url(#gradM3)" dot={false} activeDot={{ r: 4, fill: "#CC2229" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por mes */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">Ventas por mes</h3>
              <p className="text-gray-500 text-xs">Últimos 6 meses</p>
            </div>
            <span className="text-emerald-400 text-xs font-semibold">{currency(ventasMes)} este mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ventasPorMes} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="mes" stroke="#4B5563" tick={{ fontSize: 11 }} />
              <YAxis stroke="#4B5563" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [currency(Number(v ?? 0)), "Ventas"]} />
              <Bar dataKey="ventas" fill="#CC2229" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Flota + CxC por vencer ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Estado flota */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={15} className="text-gray-400" />
            <h3 className="text-white font-semibold text-sm">Estado de flota</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Activas", value: flota.activas, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Mantenimiento", value: flota.mant, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Baja", value: flota.baja, color: "text-gray-500", bg: "bg-[#1A1A1A] border-[#3A3A3A]" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {flota.proxMant.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold flex items-center gap-1.5">
                <Wrench size={10} />
                Mantenimiento próximo (30 días)
              </p>
              {flota.proxMant.map((u) => {
                const dias = diasHasta(u.proximoMantenimiento);
                return (
                  <div key={u.id} className="flex items-center justify-between bg-[#1A1A1A] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#CC2229] font-semibold">{u.noEconomico}</span>
                      <span className="text-xs text-gray-400">{u.marca} {u.modelo}</span>
                    </div>
                    <span className={`text-xs font-semibold ${dias <= 7 ? "text-red-400" : "text-amber-400"}`}>
                      {dias <= 0 ? "Vencido" : `${dias}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 mt-2">
              <CheckCircle2 size={13} />
              Todos los mantenimientos al día
            </div>
          )}
        </div>

        {/* CxC por vencer */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-gray-400" />
            <h3 className="text-white font-semibold text-sm">CxC — Próximas a vencer</h3>
          </div>
          {cxcPorVencer.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 size={13} />
              Sin cuentas próximas a vencer
            </div>
          ) : (
            <div className="space-y-2">
              {cxcPorVencer.map((c, i) => {
                const pendiente = c.total - c.montoPagado;
                const dias = diasHasta(c.vencimiento);
                const isVencido = dias < 0;
                const isUrgente = dias >= 0 && dias <= 7;
                return (
                  <div key={c.id ?? i} className="flex items-center justify-between bg-[#1A1A1A] rounded-lg px-3 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{c.contraparte}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Vence {isoToDisplay(c.vencimiento)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-white">{currency(pendiente)}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${isVencido ? "text-red-400" : isUrgente ? "text-amber-400" : "text-gray-500"}`}>
                        {isVencido ? `${Math.abs(dias)}d vencida` : `${dias}d`}
                      </p>
                    </div>
                    {(isVencido || isUrgente) && <AlertTriangle size={12} className={isVencido ? "text-red-400 shrink-0" : "text-amber-400 shrink-0"} />}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-[#3A3A3A] flex justify-between text-xs">
            <span className="text-gray-500">{cxc.filter((c) => c.status !== "Pagado").length} cuentas pendientes</span>
            <span className="text-white font-semibold">{currency(porCobrar)}</span>
          </div>
        </div>
      </div>

      {/* ── Recibos pendientes + Programaciones recientes ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recibos sin entregar */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-gray-400" />
              <h3 className="text-white font-semibold text-sm">Recibos sin entregar</h3>
            </div>
            <span className="text-xs text-amber-400 font-semibold">{recibos.filter((r) => !r.entregado).length} pendientes</span>
          </div>
          {recibosPendientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-600">Sin recibos pendientes</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Folio", "Cliente", "Metros", "Importe"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {recibosPendientes.map((r) => (
                  <tr key={r.id} className="hover:bg-[#1A1A1A]">
                    <td className="px-4 py-2.5 font-mono text-[#CC2229] font-semibold">#{r.folio}</td>
                    <td className="px-4 py-2.5 text-gray-200 max-w-[120px] truncate">{r.cliente}</td>
                    <td className="px-4 py-2.5 text-gray-400">{r.metros ?? "—"} m³</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-medium">{r.importe ? currency(r.importe) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Programaciones recientes */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-gray-400" />
              <h3 className="text-white font-semibold text-sm">Programaciones recientes</h3>
            </div>
            <span className="text-xs text-gray-500">{progs.length} total</span>
          </div>
          {progsRecientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-600">Sin programaciones</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Fecha", "Cliente", "M³", "Total"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {progsRecientes.map((p, i) => (
                  <tr key={p.id ?? i} className="hover:bg-[#1A1A1A]">
                    <td className="px-4 py-2.5 text-gray-400">{isoToDisplay(p.dia)}</td>
                    <td className="px-4 py-2.5 text-gray-200 max-w-[130px] truncate">{p.cliente || "—"}</td>
                    <td className="px-4 py-2.5 text-amber-400 font-medium">{p.m3Totales ?? "—"} m³</td>
                    <td className="px-4 py-2.5 text-white font-semibold">{p.total ? currency(p.total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
