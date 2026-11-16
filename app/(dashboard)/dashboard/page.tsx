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
  fase?: string;
  tdBom?: string;
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
    // Cargar 2 años para comparativa anual (año actual vs anterior)
    const histStart = `${now.getFullYear() - 1}-01-01`;
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
  // progsDelMes: todas las programaciones del mes (para cobrado y conteos)
  const progsDelMes = useMemo(() => progs.filter((p) => (p.dia ?? "").startsWith(mesActual)), [progs, mesActual]);

  // progsEntregadasDelMes: solo las marcadas como "Entregado" (concreto físicamente despachado)
  const progsEntregadasDelMes = useMemo(() => progsDelMes.filter((p) => p.fase === "Entregado"), [progsDelMes]);

  // M³ y ventas: solo concreto efectivamente entregado
  const m3Mes = useMemo(() => progsEntregadasDelMes.reduce((s, p) => s + (p.m3Totales ?? 0), 0), [progsEntregadasDelMes]);
  const ventasMes = useMemo(() => progsEntregadasDelMes.reduce((s, p) => s + (p.total ?? 0), 0), [progsEntregadasDelMes]);

  // Cobrado: solo pedidos completamente pagados ("Sí") del mes, entregados o no
  const cobradoMes = useMemo(() =>
    progsDelMes.reduce((s, p) => p.pagado === "Sí" ? s + (p.total ?? 0) : s, 0),
    [progsDelMes],
  );

  // Neto sin IVA: ventas entregadas sin el 16% de IVA (precios siempre incluyen IVA en este negocio)
  const ventasNetas = useMemo(() => ventasMes / 1.16, [ventasMes]);

  const porCobrar = useMemo(() =>
    cxc.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0), [cxc]);
  const porPagar = useMemo(() =>
    cxp.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0), [cxp]);

  // ─── M³ por día (últimos 15 días, solo entregados) ───────────────────────
  const m3PorDia = useMemo(() => {
    const days: { dia: string; m3: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = localISODate(d);
      const m3 = progs
        .filter((p) => p.dia === iso && p.fase === "Entregado")
        .reduce((s, p) => s + (p.m3Totales ?? 0), 0);
      days.push({ dia: `${d.getDate()}/${d.getMonth() + 1}`, m3 });
    }
    return days;
  }, [progs]);

  // ─── Ventas por mes (últimos 6 meses, solo entregadas) ───────────────────
  const ventasPorMes = useMemo(() => {
    const months: { mes: string; ventas: number; m3: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = progs.filter((p) => (p.dia ?? "").startsWith(key) && p.fase === "Entregado");
      months.push({
        mes: MES_LABELS[d.getMonth()],
        ventas: bucket.reduce((s, p) => s + (p.total ?? 0), 0),
        m3: bucket.reduce((s, p) => s + (p.m3Totales ?? 0), 0),
      });
    }
    return months;
  }, [progs]);

  // ─── Desglose Tiro Directo vs Bombeado ───────────────────────────────────
  // Misma lógica que reportes/page.tsx: agrupa por tdBom raw, suma `total`
  // isBomba: detecta cualquier variante del campo (Bomba, BOM, BOM 5", etc.)
  const isBomba = (tdBom?: string) => (tdBom ?? "").toUpperCase().includes("BOM");
  const progsConcreto = useMemo(() => progsEntregadasDelMes.filter((p) => !isBomba(p.tdBom)), [progsEntregadasDelMes]);
  const progsBomba = useMemo(() => progsEntregadasDelMes.filter((p) => isBomba(p.tdBom)), [progsEntregadasDelMes]);
  const m3Concreto = useMemo(() => progsConcreto.reduce((s, p) => s + (p.m3Totales ?? 0), 0), [progsConcreto]);
  const m3Bomba = useMemo(() => progsBomba.reduce((s, p) => s + (p.m3Totales ?? 0), 0), [progsBomba]);
  // Ventas por tipo = suma de `total` almacenado (igual que el módulo de Reportes)
  const ventasConcreto = useMemo(() => progsConcreto.reduce((s, p) => s + (p.total ?? 0), 0), [progsConcreto]);
  const ventasBomba = useMemo(() => progsBomba.reduce((s, p) => s + (p.total ?? 0), 0), [progsBomba]);

  const diasTranscurridos = now.getDate();
  const diasDelMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const promDiarioConcreto = diasTranscurridos > 0 ? m3Concreto / diasTranscurridos : 0;
  const promDiarioBomba = diasTranscurridos > 0 ? m3Bomba / diasTranscurridos : 0;
  const tendenciaConcreto = promDiarioConcreto * diasDelMes;
  const tendenciaBomba = promDiarioBomba * diasDelMes;
  // Ticket = $/m³ promedio por tipo de despacho
  const ticketConcreto = m3Concreto > 0 ? ventasConcreto / m3Concreto : 0;
  const ticketBomba = m3Bomba > 0 ? ventasBomba / m3Bomba : 0;
  const pctBombeado = m3Mes > 0 ? (m3Bomba / m3Mes) * 100 : 0;
  const m3PorPedido = progsEntregadasDelMes.length > 0 ? m3Mes / progsEntregadasDelMes.length : 0;

  // ─── Top productos del mes (por resistencia/mezcla) ──────────────────────
  const topResistencias = useMemo(() => {
    const map = new Map<string, number>();
    progsEntregadasDelMes.forEach((p) => {
      const key = p.resistencia || "Sin especificar";
      map.set(key, (map.get(key) ?? 0) + (p.m3Totales ?? 0));
    });
    return [...map.entries()]
      .map(([name, m3]) => ({ name, m3: Math.round(m3 * 100) / 100 }))
      .sort((a, b) => b.m3 - a.m3)
      .slice(0, 6);
  }, [progsEntregadasDelMes]);

  // ─── Ventas anuales año actual vs anterior ────────────────────────────────
  const anioActual = now.getFullYear();
  const anioAnterior = anioActual - 1;
  const ventasAnuales = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const kaA = `${anioActual}-${String(i + 1).padStart(2, "0")}`;
      const kaPrev = `${anioAnterior}-${String(i + 1).padStart(2, "0")}`;
      const actual = progs.filter((p) => (p.dia ?? "").startsWith(kaA) && p.fase === "Entregado").reduce((s, p) => s + (p.m3Totales ?? 0), 0);
      const anterior = progs.filter((p) => (p.dia ?? "").startsWith(kaPrev) && p.fase === "Entregado").reduce((s, p) => s + (p.m3Totales ?? 0), 0);
      return { mes: MES_LABELS[i], actual, anterior };
    }),
  [progs]);

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
        <div className="relative flex min-h-[200px] flex-col justify-between gap-5 p-7 lg:max-w-[62%]" style={{ zIndex: 2, color: "#ffffff" }}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>{fechaLabel}</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]" style={{ color: "#ffffff" }}>
              {greeting}{userName ? `, ${userName}` : ""}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>Duro Concretos — Resumen operativo</p>
          </div>

          {/* Hero KPIs */}
          <div className="grid grid-cols-3 gap-3 max-w-[520px]">
            <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#fca5a5" }}>Coladas hoy</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "#ffffff" }}>{coladasHoy}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.60)" }}>{m3Hoy > 0 ? `${m3Hoy.toLocaleString("es-MX")} m³ prog.` : "Sin coladas prog."}</p>
            </div>
            <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#fcd34d" }}>M³ {MES_LABELS[now.getMonth()]}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "#ffffff" }}>{m3Mes.toLocaleString("es-MX")}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.60)" }}>{progsEntregadasDelMes.length} pedidos entregados</p>
            </div>
            <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6ee7b7" }}>Flota activa</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "#ffffff" }}>{pctFlota}%</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.60)" }}>{flota.activas} activas · {flota.mant} en mtto.</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/transporte/programacion")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: "#CC2229", color: "#ffffff" }}
            >
              <Package size={15} />
              + Nueva programación
            </button>
            <button
              onClick={() => router.push("/finanzas/estado-cuenta-clientes")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.20)", color: "rgba(255,255,255,0.80)" }}
            >
              Reportes
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI secundarios ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title={`Ventas ${MES_LABELS[now.getMonth()]} (entregadas)`}
          value={currency(ventasMes)}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          subtitle={m3Mes > 0 ? `${m3Mes.toLocaleString("es-MX")} m³ · ${currency(Math.round(ventasMes / m3Mes))}/m³ · ver en Programación →` : "Sin entregas registradas"}
          onClick={() => router.push("/transporte/programacion")}
        />
        <KPICard
          title={`Cobrado ${MES_LABELS[now.getMonth()]}`}
          value={currency(cobradoMes)}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          subtitle={`${progsDelMes.filter((p) => p.pagado === "Sí").length} programaciones marcadas como pagadas`}
          onClick={() => router.push("/transporte/programacion")}
        />
        <KPICard
          title="Por cobrar"
          value={currency(porCobrar)}
          icon={Banknote}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          subtitle={`${cxc.filter((c) => c.status !== "Pagado").length} facturas · todos los meses`}
          onClick={() => router.push("/finanzas/cxc")}
        />
        <KPICard
          title="Neto sin IVA (ventas)"
          value={currency(ventasNetas)}
          icon={Building2}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          subtitle={ventasMes > 0 ? `IVA 16%: ${currency(Math.round(ventasMes - ventasNetas))}` : "—"}
        />
        <KPICard
          title="Por pagar"
          value={currency(porPagar)}
          icon={TrendingDown}
          iconColor="text-[#CC2229]"
          iconBg="bg-red-500/10"
          subtitle={`${cxp.filter((c) => c.status !== "Pagado").length} facturas · todos los meses`}
          onClick={() => router.push("/finanzas/cxp")}
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
      </div>

      {/* ── Indicadores del mes ──────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Indicadores del mes — {MES_LABELS[now.getMonth()]} {now.getFullYear()}</h3>
          <span className="text-xs text-gray-500">{progsEntregadasDelMes.length} pedidos · {diasTranscurridos}/{diasDelMes} días transcurridos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-white/10">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 w-48">Indicador</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-blue-400">Tiro Directo</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-amber-400">Bombeado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                {
                  label: "Ventas ($)",
                  total: currency(ventasMes),
                  concreto: currency(ventasConcreto),
                  bomba: currency(ventasBomba),
                },
                {
                  label: "M³ despachados",
                  total: `${m3Mes.toLocaleString("es-MX")} m³`,
                  concreto: `${m3Concreto.toLocaleString("es-MX")} m³`,
                  bomba: `${m3Bomba.toLocaleString("es-MX")} m³`,
                },
                {
                  label: "Promedio diario",
                  total: `${((m3Mes / diasTranscurridos) || 0).toFixed(2)} m³/día`,
                  concreto: `${promDiarioConcreto.toFixed(2)} m³/día`,
                  bomba: `${promDiarioBomba.toFixed(2)} m³/día`,
                },
                {
                  label: "Tendencia (fin mes)",
                  total: `${diasTranscurridos > 0 ? (((m3Mes / diasTranscurridos) * diasDelMes)).toLocaleString("es-MX", { maximumFractionDigits: 1 }) : "—"} m³`,
                  concreto: `${tendenciaConcreto > 0 ? tendenciaConcreto.toLocaleString("es-MX", { maximumFractionDigits: 1 }) : "—"} m³`,
                  bomba: `${tendenciaBomba > 0 ? tendenciaBomba.toLocaleString("es-MX", { maximumFractionDigits: 1 }) : "—"} m³`,
                },
                {
                  label: "Ticket promedio ($/m³)",
                  total: m3Mes > 0 ? `${currency(Math.round(ventasMes / m3Mes))}/m³` : "—",
                  concreto: ticketConcreto > 0 ? `${currency(Math.round(ticketConcreto))}/m³` : "—",
                  bomba: ticketBomba > 0 ? `${currency(Math.round(ticketBomba))}/m³` : "—",
                },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 text-gray-400 font-medium">{row.label}</td>
                  <td className="px-5 py-3 text-right text-white font-semibold">{row.total}</td>
                  <td className="px-5 py-3 text-right text-blue-400">{row.concreto}</td>
                  <td className="px-5 py-3 text-right text-amber-400">{row.bomba}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1A1A1A] border-t border-white/10">
                <td className="px-5 py-2.5 text-[10px] font-semibold text-gray-500" colSpan={2}>
                  <span className="text-amber-400">{pctBombeado.toFixed(1)}%</span> bombeado ·
                  <span className="text-blue-400 ml-1">{(100 - pctBombeado).toFixed(1)}%</span> tiro directo ·
                  <span className="text-gray-600 ml-1">{progsBomba.length + progsConcreto.length} pedidos entregados</span>
                </td>
                <td className="px-5 py-2.5 text-right text-[10px] text-gray-500" colSpan={2}>
                  M³ prom/pedido: <span className="text-white font-semibold">{m3PorPedido.toFixed(2)} m³</span> ·
                  <span className="text-gray-600 ml-1">datos: módulo Reportes</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Alerta cartera vencida ────────────────────────────────────── */}
      {(() => {
        const vencidas = cxc.filter((c) => c.status !== "Pagado" && c.vencimiento && diasHasta(c.vencimiento) < 0);
        const totalVencido = vencidas.reduce((s, c) => s + (c.total - c.montoPagado), 0);
        if (vencidas.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <div>
                <span className="text-red-400 font-semibold text-sm">Cartera vencida: {currency(totalVencido)}</span>
                <span className="text-red-500/70 text-xs ml-2">· {vencidas.length} cuenta{vencidas.length !== 1 ? "s" : ""} con fecha de pago vencida</span>
              </div>
            </div>
            <button onClick={() => router.push("/finanzas/cxc")} className="text-xs text-red-400 hover:text-red-300 font-medium underline underline-offset-2 cursor-pointer">
              Ver CxC →
            </button>
          </div>
        );
      })()}

      {/* ── Gráficas ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* M³ por día */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">M³ diarios entregados</h3>
              <p className="text-gray-500 text-xs">Últimos 15 días · solo pedidos con remisión</p>
            </div>
            <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 px-2 py-1 rounded-lg">{m3Mes.toLocaleString("es-MX")} m³ / mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m3PorDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC2229" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="dia" stroke="#374151" tick={{ fontSize: 10, fill: "#6B7280" }} interval={2} />
              <YAxis stroke="#374151" tick={{ fontSize: 10, fill: "#6B7280" }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }} formatter={(v) => [`${v} m³`, "M³"]} />
              <Area type="monotone" dataKey="m3" stroke="#CC2229" strokeWidth={2.5} fill="url(#gradM3)" dot={false} activeDot={{ r: 4, fill: "#CC2229" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas anuales año actual vs anterior */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">Ventas anuales — {anioActual}</h3>
              <p className="text-gray-500 text-xs">
                <span className="inline-block w-2 h-2 bg-[#CC2229] rounded-sm mr-1 align-middle" />{anioActual}
                <span className="inline-block w-2 h-2 bg-[#374151] rounded-sm ml-3 mr-1 align-middle" />{anioAnterior} · m³ entregados
              </p>
            </div>
            <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg">{m3Mes.toLocaleString("es-MX")} m³ este mes</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ventasAnuales} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="mes" stroke="#374151" tick={{ fontSize: 11, fill: "#6B7280" }} />
              <YAxis stroke="#374151" tick={{ fontSize: 10, fill: "#6B7280" }} tickFormatter={(v) => `${v}m³`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }}
                formatter={(v, name) => [`${v} m³`, name === "actual" ? String(anioActual) : String(anioAnterior)]}
              />
              <Bar dataKey="anterior" fill="#374151" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" fill="#CC2229" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Más vendidos + Bomba vs Tiro Directo ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Más vendidos por mezcla/resistencia */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm">Más vendidos — {MES_LABELS[now.getMonth()]}</h3>
            <p className="text-gray-500 text-xs">Top productos por m³ entregados</p>
          </div>
          {topResistencias.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-gray-600 text-xs">Sin datos del mes</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topResistencias} layout="vertical" margin={{ top: 4, right: 50, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                <XAxis type="number" stroke="#374151" tick={{ fontSize: 10, fill: "#6B7280" }} tickFormatter={(v) => `${v}m³`} />
                <YAxis dataKey="name" type="category" stroke="#374151" tick={{ fontSize: 10, fill: "#9CA3AF" }} width={100} />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }}
                  formatter={(v) => [`${v} m³`, "M³"]}
                />
                <Bar dataKey="m3" fill="#CC2229" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bomba vs Tiro Directo */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm">Bomba vs Tiro Directo — {MES_LABELS[now.getMonth()]}</h3>
            <p className="text-gray-500 text-xs">M³ entregados por tipo de despacho</p>
          </div>
          <div className="space-y-5 mt-2">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-blue-400 font-semibold">Tiro Directo ({progsConcreto.length} pedidos)</span>
                <span className="text-xs text-white font-semibold">{m3Concreto.toLocaleString("es-MX")} m³</span>
              </div>
              <div className="h-5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500/80 rounded-full transition-all duration-700" style={{ width: m3Mes > 0 ? `${(m3Concreto / m3Mes) * 100}%` : "0%" }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-500">{progsConcreto.length} pedidos · {m3Mes > 0 ? (100 - pctBombeado).toFixed(1) : 0}%</span>
                <span className="text-[10px] text-blue-400">{currency(ventasConcreto)}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-amber-400 font-semibold">Bombeado ({progsBomba.length} pedidos)</span>
                <span className="text-xs text-white font-semibold">{m3Bomba.toLocaleString("es-MX")} m³</span>
              </div>
              <div className="h-5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div className="h-full bg-amber-500/80 rounded-full transition-all duration-700" style={{ width: m3Mes > 0 ? `${pctBombeado}%` : "0%" }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-500">{progsBomba.length} pedidos · {pctBombeado.toFixed(1)}%</span>
                <span className="text-[10px] text-amber-400">{currency(ventasBomba)}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
              <div className="bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">M³ prom / pedido</p>
                <p className="text-xl font-bold text-white mt-0.5">{m3PorPedido.toFixed(2)}</p>
              </div>
              <div className="bg-[#2A2A2A] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Días del mes</p>
                <p className="text-xl font-bold text-white mt-0.5">{diasTranscurridos}<span className="text-sm text-gray-500 font-normal"> / {diasDelMes}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Flota + CxC por vencer ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Estado flota */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Truck size={14} className="text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Estado de flota</h3>
                <p className="text-gray-500 text-[10px]">{unidades.length} unidades totales registradas</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Activas",  value: flota.activas, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "En mtto.", value: flota.mant,    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Baja",     value: flota.baja,    color: "text-gray-500",    bg: "bg-white/5 border-white/10" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Unidades actualmente en mantenimiento */}
          {flota.mant > 0 && (
            <div className="space-y-1.5 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                <Wrench size={10} />
                En mantenimiento ahora
              </p>
              {unidades.filter((u) => u.estatus === "Mantenimiento").map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 font-semibold">{u.noEconomico}</span>
                    <span className="text-xs text-gray-400">{u.marca} {u.modelo}</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">En taller</span>
                </div>
              ))}
            </div>
          )}

          {/* Próximos mantenimientos */}
          {flota.proxMant.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                <Wrench size={10} />
                Mantenimiento próximo (30 días)
              </p>
              {flota.proxMant.map((u) => {
                const dias = diasHasta(u.proximoMantenimiento);
                return (
                  <div key={u.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#CC2229] font-semibold">{u.noEconomico}</span>
                      <span className="text-xs text-gray-400">{u.marca} {u.modelo}</span>
                    </div>
                    <span className={`text-xs font-semibold ${dias <= 0 ? "text-red-400" : dias <= 7 ? "text-amber-400" : "text-gray-500"}`}>
                      {dias <= 0 ? "Vencido" : `en ${dias}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : flota.mant === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 size={13} />
              Flota operativa — sin mantenimientos urgentes
            </div>
          ) : null}
        </div>

        {/* CxC por vencer */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center">
              <Clock size={14} className="text-gray-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">CxC — Vencidas y por vencer</h3>
              <p className="text-gray-500 text-[10px]">Saldo pendiente por cliente, ordenado por urgencia</p>
            </div>
          </div>
          {(() => {
            const pendientes = cxc.filter((c) => c.status !== "Pagado" && c.vencimiento);
            const vencidas   = pendientes.filter((c) => diasHasta(c.vencimiento) < 0).sort((a, b) => diasHasta(a.vencimiento) - diasHasta(b.vencimiento));
            const proximas   = pendientes.filter((c) => diasHasta(c.vencimiento) >= 0).sort((a, b) => diasHasta(a.vencimiento) - diasHasta(b.vencimiento)).slice(0, 5);
            if (vencidas.length === 0 && proximas.length === 0) return (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 size={13} />
                Sin cuentas pendientes con fecha de vencimiento
              </div>
            );
            const Row = ({ c, i }: { c: Cuenta; i: number }) => {
              const pendiente = c.total - c.montoPagado;
              const dias = diasHasta(c.vencimiento);
              const isVencido = dias < 0;
              const isUrgente = dias >= 0 && dias <= 7;
              return (
                <div key={c.id ?? i} className={`flex items-center justify-between rounded-lg px-3 py-2.5 gap-3 border ${isVencido ? "bg-red-500/10 border-red-500/20" : isUrgente ? "bg-amber-500/10 border-amber-500/20" : "bg-white/5 border-white/10"}`}>
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium truncate">{c.contraparte}</p>
                    <p className={`text-[10px] mt-0.5 ${isVencido ? "text-red-400" : "text-gray-500"}`}>
                      {isVencido ? `Venció ${isoToDisplay(c.vencimiento)}` : `Vence ${isoToDisplay(c.vencimiento)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-white">{currency(pendiente)}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${isVencido ? "text-red-400" : isUrgente ? "text-amber-400" : "text-gray-500"}`}>
                      {isVencido ? `${Math.abs(dias)}d vencida` : `en ${dias}d`}
                    </p>
                  </div>
                  {(isVencido || isUrgente) && <AlertTriangle size={12} className={`shrink-0 ${isVencido ? "text-red-400" : "text-amber-400"}`} />}
                </div>
              );
            };
            return (
              <div className="space-y-3">
                {vencidas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">Vencidas ({vencidas.length})</p>
                    {vencidas.map((c, i) => <Row key={c.id ?? i} c={c} i={i} />)}
                  </div>
                )}
                {proximas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Próximas a vencer</p>
                    {proximas.map((c, i) => <Row key={c.id ?? i} c={c} i={i} />)}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs">
            <span className="text-gray-500">{cxc.filter((c) => c.status !== "Pagado").length} cuentas pendientes totales</span>
            <span className="text-white font-semibold">{currency(porCobrar)}</span>
          </div>
        </div>
      </div>

      {/* ── Recibos pendientes + Programaciones recientes ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recibos sin entregar */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center">
                <Building2 size={12} className="text-gray-400" />
              </div>
              <h3 className="text-white font-semibold text-sm">Recibos sin entregar</h3>
            </div>
            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">{recibos.filter((r) => !r.entregado).length} pendientes</span>
          </div>
          {recibosPendientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">Sin recibos pendientes</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {["Folio", "Cliente", "Metros", "Importe"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recibosPendientes.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[#CC2229] font-semibold">#{r.folio}</td>
                    <td className="px-4 py-2.5 text-gray-300 max-w-[120px] truncate">{r.cliente}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.metros ?? "—"} m³</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-medium">{r.importe ? currency(r.importe) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Programaciones del mes — más recientes */}
        <div className="bg-[#242424] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center">
                <Package size={12} className="text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Programaciones del mes</h3>
                <p className="text-gray-500 text-[10px]">{progsEntregadasDelMes.length} de {progsDelMes.length} entregadas este mes</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: progsDelMes.length > 0 && progsEntregadasDelMes.length / progsDelMes.length >= 0.8
                  ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                color: progsDelMes.length > 0 && progsEntregadasDelMes.length / progsDelMes.length >= 0.8
                  ? "#34d399" : "#fbbf24",
              }}>
              {progsDelMes.length > 0 ? `${Math.round(progsEntregadasDelMes.length / progsDelMes.length * 100)}% entregado` : "—"}
            </span>
          </div>
          {progsRecientes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">Sin programaciones</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {["Fecha", "Cliente", "M³", "Total", "Estado"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {progsRecientes.map((p, i) => {
                  const isEntregado = p.fase === "Entregado";
                  const isPagadoSi = p.pagado === "Sí";
                  return (
                    <tr key={p.id ?? i} className="hover:bg-white/5 transition-colors">
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{isoToDisplay(p.dia)}</td>
                      <td className="px-3 py-2.5 text-gray-300 max-w-[110px] truncate">{p.cliente || "—"}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-medium whitespace-nowrap">{p.m3Totales ?? "—"} m³</td>
                      <td className="px-3 py-2.5 text-white font-semibold whitespace-nowrap">{p.total ? currency(p.total) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                          isPagadoSi ? "bg-emerald-500/15 text-emerald-400" :
                          isEntregado ? "bg-blue-500/15 text-blue-400" :
                          "bg-white/10 text-gray-400"
                        }`}>
                          {isPagadoSi ? "Pagado" : isEntregado ? "Entregado" : p.fase || "Prog."}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
