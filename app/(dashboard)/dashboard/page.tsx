"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { getCollectionDocs, COLLECTIONS, where } from "@/lib/db";
import { filterByPlanta, getAllowedModuleSet, moduleCatalog, getStoredSession } from "@/lib/auth";
import { localISODate } from "@/lib/dateUtils";
import type { Unidad } from "@/lib/unidades";
import { TOOLTIP_STYLE } from "@/lib/chartStyles";
import { currencyRounded as currency } from "@/lib/formatters";

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
  montoPagado?: number | null;
  incluyeIVA?: boolean;
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
  const router = useRouter();
  const [progs, setProgs] = useState<Programacion[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [cxc, setCxc] = useState<Cuenta[]>([]);
  const [cxp, setCxp] = useState<Cuenta[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    const session = getStoredSession();
    const allowed = getAllowedModuleSet(session);
    if (!allowed.has("/dashboard")) {
      const first = moduleCatalog.find((m) => allowed.has(m.href));
      router.replace(first?.href ?? "/");
      return;
    }
    // Cargar 6 meses para el chart "Ventas por mes" y los últimos 15 días del gráfico diario
    const hace6Meses = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const histStart = `${hace6Meses.getFullYear()}-${String(hace6Meses.getMonth() + 1).padStart(2, "0")}-01`;
    const mesStart = `${mesActual}-01`;
    const mesEnd = `${mesActual}-31`;
    Promise.all([
      getCollectionDocs<Programacion>(COLLECTIONS.programaciones, [where("dia", ">=", histStart), where("dia", "<=", mesEnd)]),
      getCollectionDocs<Recibo>(COLLECTIONS.efectivo, [where("fecha", ">=", mesStart), where("fecha", "<=", mesEnd)]),
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

  // Cobrado = dinero efectivamente recibido este mes
  const cobradoMes = useMemo(() =>
    progsDelMes.reduce((s, p) => {
      if (p.pagado === "Sí") return s + (p.total ?? 0);
      if (p.pagado === "Parcial") return s + (p.montoPagado ?? 0);
      return s;
    }, 0),
    [progsDelMes],
  );

  // Cobrado neto sin IVA — divide entre 1.16 si la programación marcó incluyeIVA
  const cobradoNetoMes = useMemo(() =>
    progsDelMes.reduce((s, p) => {
      let monto = 0;
      if (p.pagado === "Sí") monto = p.total ?? 0;
      else if (p.pagado === "Parcial") monto = p.montoPagado ?? 0;
      return s + (p.incluyeIVA ? monto / 1.16 : monto);
    }, 0),
    [progsDelMes],
  );

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
      const iso = localISODate(d);
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

  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const session = getStoredSession();
  const userName = session?.name?.split(" ")[0] ?? "";
  const fechaLabel = now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const coladasHoy = progs.filter((p) => p.dia === localISODate(now)).length;
  const m3Hoy = progs.filter((p) => p.dia === localISODate(now)).reduce((s, p) => s + (p.m3Totales ?? 0), 0);
  const pctFlota = unidades.length > 0 ? Math.round((flota.activas / (unidades.length - flota.baja || 1)) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#CC2229] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="duro-hero relative isolate overflow-hidden rounded-2xl text-white"
        style={{ background: "#0b1426", boxShadow: "0 18px 44px -18px rgba(11,20,38,0.75)" }}
      >
        {/* Road / sky background — white mountain silhouettes like JC */}
        <svg viewBox="0 0 800 230" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" style={{ zIndex: 0 }} aria-hidden>
          <defs>
            <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b1426" />
              <stop offset="1" stopColor="#0e1f50" />
            </linearGradient>
          </defs>
          <rect width="800" height="230" fill="url(#heroSky)" />
          <circle cx="680" cy="30" r="150" fill="#CC2229" opacity="0.09" />
          {/* white mountain silhouettes — same technique as JC */}
          <path d="M0 185 L90 135 L175 172 L270 118 L360 178 L455 130 L555 182 L655 138 L800 188 V230 H0Z" fill="#ffffff" opacity="0.05" />
          <path d="M0 202 L115 162 L228 198 L345 155 L465 202 L585 162 L800 208 V230 H0Z" fill="#ffffff" opacity="0.07" />
          {/* road */}
          <rect y="212" width="800" height="18" fill="#04080f" />
          <rect y="220" width="800" height="3" fill="#CC2229" opacity="0.45" />
          {/* road dashes — more visible */}
          {[0,1,2,3,4,5,6,7,8,9,10].map((i) => (
            <rect key={i} x={i*76+10} y="215" width="38" height="4" rx="2" fill="white" opacity="0.32" />
          ))}
          {/* stars */}
          {([[118,24],[255,11],[408,34],[518,16],[630,27],[758,42],[54,44],[338,19]] as [number,number][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="1.2" fill="white" opacity="0.55" />
          ))}
        </svg>

        {/* Left-to-right fade — identical technique to JC */}
        <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(to right, #0b1426 42%, rgba(11,20,38,0.88) 60%, rgba(11,20,38,0.2) 80%, transparent 100%)" }} />

        {/* Concrete mixer truck — bottom-right */}
        <div className="absolute bottom-0 right-0 w-[40%] max-w-[360px]" style={{ zIndex: 1 }}>
          <svg viewBox="0 0 360 168" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            {/* Shadow */}
            <ellipse cx="178" cy="163" rx="156" ry="4" fill="black" opacity="0.1" />

            {/* Chassis */}
            <rect x="8" y="122" width="334" height="7" rx="3" fill="#334155" />

            {/* Drum support pillar — behind cab */}
            <rect x="115" y="48" width="12" height="78" rx="3" fill="#94A3B8" />
            <ellipse cx="121" cy="47" r="7" fill="#64748B" />
            <rect x="288" y="110" width="9" height="16" rx="3" fill="#94A3B8" />

            {/* Drum body */}
            <ellipse cx="210" cy="75" rx="99" ry="55" fill="white" />

            {/* Drum border */}
            <ellipse cx="210" cy="75" rx="99" ry="55" stroke="#E8EDF2" strokeWidth="2" fill="none" />

            {/* DURO CONCRETOS — only text on drum */}
            <text x="210" y="81" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="12" fill="#CC2229" letterSpacing="0.3">DURO CONCRETOS</text>

            {/* Drum end caps */}
            <ellipse cx="121" cy="75" rx="14" ry="36" fill="#F1F5F9" stroke="#D1D5DB" strokeWidth="1.5" />
            <ellipse cx="299" cy="75" rx="10" ry="27" fill="#F1F5F9" stroke="#D1D5DB" strokeWidth="1.5" />

            {/* Discharge chute */}
            <path d="M304 94 L327 136 L317 138 L292 104 Z" fill="#94A3B8" />

            {/* Cab — painted after drum so it overlaps drum edge */}
            <rect x="10" y="52" width="72" height="10" rx="5" fill="#E2E8F0" />
            <rect x="8" y="60" width="80" height="64" rx="8" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5" />
            <rect x="14" y="68" width="62" height="36" rx="6" fill="#BAE6FD" />
            <rect x="15" y="69" width="22" height="10" rx="3" fill="white" opacity="0.4" />
            <rect x="8" y="112" width="80" height="12" fill="#CC2229" />
            <rect x="5" y="88" width="9" height="16" rx="2" fill="#FEF08A" />

            {/* Hood — extended to connect with drum */}
            <rect x="88" y="92" width="44" height="28" rx="4" fill="#E2E8F0" />

            {/* Wheels */}
            {([32, 84, 196, 248] as number[]).map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy={133} r="18" fill="#1E293B" />
                <circle cx={cx} cy={133} r="11" fill="#E2E8F0" />
                <circle cx={cx} cy={133} r="4" fill="#475569" />
              </g>
            ))}

            {/* Axle brackets */}
            <rect x="70" y="122" width="5" height="14" rx="1" fill="#64748B" />
            <rect x="174" y="122" width="5" height="14" rx="1" fill="#64748B" />
          </svg>
        </div>

        {/* Content — explicitly z-index 2 to always render above background layers */}
        <div className="relative flex min-h-[200px] flex-col justify-between gap-5 p-7 lg:max-w-[62%]" style={{ zIndex: 2 }}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-white/60 text-xs">{fechaLabel}</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
              {greeting}{userName ? `, ${userName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-white/70">Duro Concretos — Resumen operativo</p>
          </div>

          {/* Hero KPIs */}
          <div className="grid grid-cols-3 gap-3 max-w-[520px]">
            <div className="rounded-xl px-4 py-3.5 border border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase text-red-300">Coladas hoy</p>
              <p className="text-3xl font-bold text-white mt-1">{coladasHoy}</p>
              <p className="text-white/60 text-xs mt-0.5">{m3Hoy > 0 ? `${m3Hoy} m³` : "0 m³"}</p>
            </div>
            <div className="rounded-xl px-4 py-3.5 border border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase text-amber-300">M³ {MES_LABELS[now.getMonth()]}</p>
              <p className="text-3xl font-bold text-white mt-1">{m3Mes.toLocaleString("es-MX")}</p>
              <p className="text-white/60 text-xs mt-0.5">{progsDelMes.length} pedidos</p>
            </div>
            <div className="rounded-xl px-4 py-3.5 border border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-300">Flota activa</p>
              <p className="text-3xl font-bold text-white mt-1">{pctFlota}%</p>
              <p className="text-white/60 text-xs mt-0.5">{flota.activas} de {unidades.length - flota.baja} unidades</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/transporte/programacion")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ backgroundColor: "#CC2229" }}
            >
              <Package size={15} />
              + Nueva programación
            </button>
            <button
              onClick={() => router.push("/finanzas/estado-cuenta-clientes")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white/80 border border-white/20 hover:bg-white/10 transition-colors cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              Reportes
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI secundarios ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={`Ventas ${MES_LABELS[now.getMonth()]}`}
          value={currency(ventasMes)}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          subtitle={m3Mes > 0 ? `${currency(ventasMes / m3Mes)} / m³` : "—"}
          onClick={() => router.push("/facturacion")}
        />
        <KPICard
          title="Por cobrar"
          value={currency(porCobrar)}
          icon={Banknote}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          subtitle={`${cxc.filter((c) => c.status !== "Pagado").length} docs pendientes`}
          onClick={() => router.push("/finanzas/estado-cuenta-clientes")}
        />
        <KPICard
          title="Por pagar"
          value={currency(porPagar)}
          icon={TrendingDown}
          iconColor="text-[#CC2229]"
          iconBg="bg-red-500/10"
          subtitle={`${cxp.filter((c) => c.status !== "Pagado").length} docs pendientes`}
          onClick={() => router.push("/efectivo")}
        />
        <KPICard
          title="Unidades activas"
          value={`${flota.activas} / ${unidades.length - flota.baja}`}
          icon={Truck}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          subtitle={flota.mant > 0 ? `${flota.mant} en mantenimiento` : "Flota disponible"}
          onClick={() => router.push("/transporte/seguros")}
        />
        <KPICard
          title={`Cobrado ${MES_LABELS[now.getMonth()]}`}
          value={currency(cobradoMes)}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          subtitle={`${progsDelMes.filter((p) => p.pagado === "Sí" || p.pagado === "Parcial").length} pagados / parciales`}
          onClick={() => router.push("/transporte/programacion")}
        />
        <KPICard
          title="Neto sin IVA"
          value={currency(cobradoNetoMes)}
          icon={Building2}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          subtitle={cobradoNetoMes < cobradoMes ? `IVA descontado: ${currency(cobradoMes - cobradoNetoMes)}` : "Sin IVA incluido"}
        />
      </div>

      {/* ── Gráficas ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* M³ por día */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-gray-900 font-semibold text-sm">M³ diarios</h3>
              <p className="text-gray-400 text-xs">Últimos 15 días</p>
            </div>
            <span className="text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg">{m3Mes.toLocaleString()} m³ / mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m3PorDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC2229" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="dia" stroke="#D1D5DB" tick={{ fontSize: 10, fill: "#6B7280" }} interval={2} />
              <YAxis stroke="#D1D5DB" tick={{ fontSize: 10, fill: "#6B7280" }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} m³`, "M³"]} />
              <Area type="monotone" dataKey="m3" stroke="#CC2229" strokeWidth={2.5} fill="url(#gradM3)" dot={false} activeDot={{ r: 4, fill: "#CC2229" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por mes */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-gray-900 font-semibold text-sm">Ventas por mes</h3>
              <p className="text-gray-400 text-xs">Últimos 6 meses</p>
            </div>
            <span className="text-emerald-700 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-lg">{currency(ventasMes)} este mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ventasPorMes} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="mes" stroke="#D1D5DB" tick={{ fontSize: 11, fill: "#6B7280" }} />
              <YAxis stroke="#D1D5DB" tick={{ fontSize: 10, fill: "#6B7280" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} formatter={(v) => [currency(Number(v ?? 0)), "Ventas"]} />
              <Bar dataKey="ventas" fill="#CC2229" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Flota + CxC por vencer ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Estado flota */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <Truck size={14} className="text-gray-600" />
            </div>
            <h3 className="text-gray-900 font-semibold text-sm">Estado de flota</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Activas", value: flota.activas, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
              { label: "Mantenimiento", value: flota.mant, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
              { label: "Baja", value: flota.baja, color: "text-gray-400", bg: "bg-gray-50 border-gray-100" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {flota.proxMant.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1.5">
                <Wrench size={10} />
                Mantenimiento próximo (30 días)
              </p>
              {flota.proxMant.map((u) => {
                const dias = diasHasta(u.proximoMantenimiento);
                return (
                  <div key={u.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#CC2229] font-semibold">{u.noEconomico}</span>
                      <span className="text-xs text-gray-500">{u.marca} {u.modelo}</span>
                    </div>
                    <span className={`text-xs font-semibold ${dias <= 7 ? "text-red-600" : "text-amber-600"}`}>
                      {dias <= 0 ? "Vencido" : `${dias}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
              <CheckCircle2 size={13} />
              Todos los mantenimientos al día
            </div>
          )}
        </div>

        {/* CxC por vencer */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <Clock size={14} className="text-gray-600" />
            </div>
            <h3 className="text-gray-900 font-semibold text-sm">CxC — Próximas a vencer</h3>
          </div>
          {cxcPorVencer.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
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
                  <div key={c.id ?? i} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-900 font-medium truncate">{c.contraparte}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Vence {isoToDisplay(c.vencimiento)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-900">{currency(pendiente)}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${isVencido ? "text-red-600" : isUrgente ? "text-amber-600" : "text-gray-400"}`}>
                        {isVencido ? `${Math.abs(dias)}d vencida` : `${dias}d`}
                      </p>
                    </div>
                    {(isVencido || isUrgente) && <AlertTriangle size={12} className={isVencido ? "text-red-500 shrink-0" : "text-amber-500 shrink-0"} />}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs">
            <span className="text-gray-400">{cxc.filter((c) => c.status !== "Pagado").length} cuentas pendientes</span>
            <span className="text-gray-900 font-semibold">{currency(porCobrar)}</span>
          </div>
        </div>
      </div>

      {/* ── Recibos pendientes + Programaciones recientes ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recibos sin entregar */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gray-100 flex items-center justify-center">
                <Building2 size={12} className="text-gray-500" />
              </div>
              <h3 className="text-gray-900 font-semibold text-sm">Recibos sin entregar</h3>
            </div>
            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">{recibos.filter((r) => !r.entregado).length} pendientes</span>
          </div>
          {recibosPendientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Sin recibos pendientes</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Folio", "Cliente", "Metros", "Importe"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recibosPendientes.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[#CC2229] font-semibold">#{r.folio}</td>
                    <td className="px-4 py-2.5 text-gray-800 max-w-[120px] truncate">{r.cliente}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.metros ?? "—"} m³</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-medium">{r.importe ? currency(r.importe) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Programaciones recientes */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-gray-100 flex items-center justify-center">
                <Package size={12} className="text-gray-500" />
              </div>
              <h3 className="text-gray-900 font-semibold text-sm">Programaciones recientes</h3>
            </div>
            <span className="text-xs text-gray-400">{progs.length} total</span>
          </div>
          {progsRecientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Sin programaciones</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Fecha", "Cliente", "M³", "Total"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {progsRecientes.map((p, i) => (
                  <tr key={p.id ?? i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{isoToDisplay(p.dia)}</td>
                    <td className="px-4 py-2.5 text-gray-800 max-w-[130px] truncate">{p.cliente || "—"}</td>
                    <td className="px-4 py-2.5 text-amber-600 font-medium">{p.m3Totales ?? "—"} m³</td>
                    <td className="px-4 py-2.5 text-gray-900 font-semibold">{p.total ? currency(p.total) : "—"}</td>
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
