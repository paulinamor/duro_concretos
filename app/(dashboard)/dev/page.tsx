"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardCopy, Code2, Database, Eye, EyeOff, Globe, Info,
  Layers, Lock, RefreshCw, Server, Settings2, Shield, Terminal, Trash2,
  Users, Zap,
} from "lucide-react";
import { COLLECTIONS, type SolicitudAutorizacion, getCollectionDocs } from "@/lib/db";
import {
  getStoredSession, DEVELOPER_EMAIL, moduleCatalog, DEV_ONLY_ROUTES,
  getImpersonationOriginal, isImpersonating, stopImpersonation,
  type Planta,
} from "@/lib/auth";
import { MODULE_STATUS_DEFAULTS, type ModuleStatus } from "@/lib/moduleStatus";
import { useRouter } from "next/navigation";

// ─── Static collection registry ───────────────────────────────────────────────

type IsolationLevel = "por-planta" | "global" | "parcial";

interface ColInfo {
  key: string;
  label: string;
  isolation: IsolationLevel;
  modules: string[];
  notes?: string;
}

const COLLECTION_REGISTRY: ColInfo[] = [
  // --- GLOBAL (compartido entre todas las plantas) ---
  { key: COLLECTIONS.users,         label: "users",         isolation: "global",     modules: ["Configuración", "Auth"], notes: "Perfiles de usuario del sistema" },
  { key: COLLECTIONS.operadores,    label: "operadores",    isolation: "global",     modules: ["Transporte", "RR.HH."], notes: "Empleados y operadores" },
  { key: COLLECTIONS.unidades,      label: "unidades",      isolation: "global",     modules: ["Transporte"], notes: "Flota vehicular" },
  { key: COLLECTIONS.configuracion, label: "configuracion", isolation: "global",     modules: ["Configuración", "Facturación"], notes: "Config fiscal, branding, planta coords" },
  { key: COLLECTIONS.descargasSAT,  label: "descargasSAT",  isolation: "global",     modules: ["SAT Descarga"], notes: "CFDIs descargados masivamente" },
  { key: COLLECTIONS.refacciones,   label: "refacciones",   isolation: "global",     modules: ["Mantenimiento"], notes: "Catálogo de refacciones (sin planta tag)" },
  { key: COLLECTIONS.reparaciones,  label: "reparaciones",  isolation: "global",     modules: ["Mantenimiento"], notes: "Historial reparaciones por unidad" },
  { key: COLLECTIONS.fallas,        label: "fallas",        isolation: "global",     modules: ["Mantenimiento"], notes: "Registro de fallas por unidad" },
  { key: COLLECTIONS.seguros,       label: "seguros",       isolation: "global",     modules: ["Transporte"], notes: "Pólizas de seguro por unidad" },
  // --- POR PLANTA (aislados, filtrados por planta activa) ---
  { key: COLLECTIONS.programaciones,        label: "programaciones",        isolation: "por-planta", modules: ["Ventas", "Transporte"], notes: "Pedidos de concreto — clave del negocio" },
  { key: COLLECTIONS.clientes,             label: "clientes",              isolation: "por-planta", modules: ["CRM", "Ventas", "Facturación"] },
  { key: COLLECTIONS.obras,               label: "obras",                 isolation: "por-planta", modules: ["Ventas"] },
  { key: COLLECTIONS.remisiones,          label: "remisiones",            isolation: "por-planta", modules: ["Ventas", "Facturación"] },
  { key: COLLECTIONS.efectivo,            label: "efectivo",              isolation: "por-planta", modules: ["Efectivo", "Ventas"] },
  { key: COLLECTIONS.salidasEfectivo,     label: "salidasEfectivo",       isolation: "por-planta", modules: ["Efectivo"] },
  { key: COLLECTIONS.entradasMaterial,    label: "entradasMaterial",      isolation: "por-planta", modules: ["Inventarios"] },
  { key: COLLECTIONS.inventarioMovimientos,label:"inventarioMovimientos",  isolation: "por-planta", modules: ["Inventarios"] },
  { key: COLLECTIONS.inventarioStock,     label: "inventarioStock",       isolation: "por-planta", modules: ["Inventarios"] },
  { key: COLLECTIONS.existenciasIniciales,label: "existenciasIniciales",  isolation: "por-planta", modules: ["Inventarios"] },
  { key: COLLECTIONS.cuentasPorCobrar,    label: "cuentasPorCobrar",      isolation: "por-planta", modules: ["Finanzas", "Facturación"] },
  { key: COLLECTIONS.cuentasPorPagar,     label: "cuentasPorPagar",       isolation: "por-planta", modules: ["Finanzas"] },
  { key: COLLECTIONS.cfdiEmitidos,        label: "cfdiEmitidos",          isolation: "por-planta", modules: ["Facturación"] },
  { key: COLLECTIONS.solicitudesAutorizacion, label: "solicitudesAutorizacion", isolation: "por-planta", modules: ["Inventarios", "Ventas", "Configuración"] },
  { key: COLLECTIONS.nomina,              label: "nomina",                isolation: "por-planta", modules: ["RR.HH."] },
  { key: COLLECTIONS.asistencias,         label: "asistencias",           isolation: "por-planta", modules: ["RR.HH."] },
  { key: COLLECTIONS.pipeline,            label: "pipeline",              isolation: "por-planta", modules: ["CRM"] },
  { key: COLLECTIONS.productos,           label: "productos",             isolation: "por-planta", modules: ["Ventas", "Facturación"] },
  { key: COLLECTIONS.viajes,             label: "viajes",                isolation: "por-planta", modules: ["Transporte"] },
  { key: COLLECTIONS.mantenimientos,      label: "mantenimientos",        isolation: "por-planta", modules: ["Mantenimiento"] },
  { key: COLLECTIONS.diesel,             label: "diesel",                isolation: "por-planta", modules: ["Transporte"] },
  { key: COLLECTIONS.cajaChica,          label: "cajaChica",             isolation: "por-planta", modules: ["Operaciones"] },
  { key: COLLECTIONS.notificaciones,     label: "notificaciones",        isolation: "por-planta", modules: ["Sistema"] },
  { key: COLLECTIONS.pagos,             label: "pagos",                 isolation: "por-planta", modules: ["Finanzas"] },
  // --- PARCIAL (escritura sin planta o inconsistente) ---
  { key: COLLECTIONS.mantenimientos, label: "mantenimientos", isolation: "parcial", modules: ["Mantenimiento"], notes: "withPlantaTag en escritura; lectura filtra por planta" },
];

// Deduplicate by key
const COL_MAP = new Map<string, ColInfo>();
for (const c of COLLECTION_REGISTRY) COL_MAP.set(c.key, c);
const COLS = Array.from(COL_MAP.values());

// ─── Module section map ────────────────────────────────────────────────────────

const ALL_ROUTES = [
  ...moduleCatalog.map((m) => ({ ...m, devOnly: false })),
  ...Array.from(DEV_ONLY_ROUTES).map((href) => ({ href, label: href, devOnly: true })),
];

const SECTION_MAP: Record<string, string> = {
  "/dashboard": "Inicio", "/reportes": "Inicio",
  "/transporte": "Transporte",
  "/operaciones": "Operaciones", "/efectivo": "Operaciones",
  "/crm": "CRM",
  "/ventas": "Ventas",
  "/finanzas": "Finanzas",
  "/facturacion": "Facturación",
  "/recursos-humanos": "RR.HH.",
  "/configuracion": "Sistema", "/perfil": "Sistema", "/dev": "Sistema",
};

function getSection(href: string) {
  for (const [prefix, section] of Object.entries(SECTION_MAP)) {
    if (href.startsWith(prefix)) return section;
  }
  return "Otro";
}

// ─── Toast helper ─────────────────────────────────────────────────────────────

function toast(type: string, title: string, message: string) {
  window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message } }));
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "sistema" | "modulos" | "colecciones" | "plantas" | "sesion" | "herramientas";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "sistema",      label: "Sistema",       icon: Server },
  { id: "modulos",      label: "Módulos",        icon: Layers },
  { id: "colecciones",  label: "Colecciones",    icon: Database },
  { id: "plantas",      label: "Visibilidad por planta", icon: Globe },
  { id: "sesion",       label: "Sesión & Auth",  icon: Shield },
  { id: "herramientas", label: "Herramientas",   icon: Terminal },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function IsolationBadge({ level }: { level: IsolationLevel }) {
  if (level === "global")     return <Pill label="Global"     color="bg-blue-100 text-blue-700" />;
  if (level === "por-planta") return <Pill label="Por planta" color="bg-emerald-100 text-emerald-700" />;
  return                             <Pill label="Parcial"    color="bg-amber-100 text-amber-700" />;
}

function StatusBadge({ status }: { status: ModuleStatus | undefined }) {
  if (!status || status === "live") return <Pill label="live" color="bg-emerald-100 text-emerald-700" />;
  if (status === "wip")             return <Pill label="wip"  color="bg-amber-100 text-amber-700" />;
  return                                   <Pill label="dev"  color="bg-slate-200 text-slate-500" />;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function KV({ k, v, mono = false }: { k: string; v: string | React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 shrink-0 w-40">{k}</span>
      <span className={`text-xs font-medium text-gray-900 text-right ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}

// ─── Sistema tab ──────────────────────────────────────────────────────────────

function TabSistema() {
  const [showEnv, setShowEnv] = useState(false);

  const envVars = [
    { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", val: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
    { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", val: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
    { key: "FACTURAMA_SANDBOX", val: process.env.FACTURAMA_SANDBOX ?? "(no definida = producción)" },
    { key: "FACTURAMA_USER", val: process.env.FACTURAMA_USER ? "✓ definida" : "✗ no definida" },
    { key: "FACTURAMA_PASSWORD", val: process.env.FACTURAMA_PASSWORD ? "✓ definida" : "✗ no definida" },
    { key: "FACTURAMA_SERIE", val: process.env.FACTURAMA_SERIE ?? "(no definida = A)" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard title="Aplicación">
        <KV k="Nombre" v="Duro Concretos ERP" />
        <KV k="Versión" v="v1.0.0" />
        <KV k="Framework" v="Next.js 16 (App Router)" />
        <KV k="UI" v="Tailwind CSS + shadcn/ui" />
        <KV k="Auth" v="Firebase Auth (custom session)" />
        <KV k="Base de datos" v="Firestore (client SDK)" />
        <KV k="PAC facturación" v="Facturama Multiemisor Lite v3" />
        <KV k="Endpoint Facturama" v={process.env.FACTURAMA_SANDBOX === "true" ? "⚠️ SANDBOX" : "✓ PRODUCCIÓN"} />
      </SectionCard>

      <SectionCard title="Firebase">
        <KV k="Proyecto" v={process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "—"} mono />
        <KV k="Auth domain" v={process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "—"} mono />
        <KV k="Storage bucket" v={process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "—"} mono />
      </SectionCard>

      <SectionCard title="Variables de entorno">
        <div className="space-y-1">
          <button
            onClick={() => setShowEnv((v) => !v)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer mb-3"
          >
            {showEnv ? <EyeOff size={12} /> : <Eye size={12} />}
            {showEnv ? "Ocultar" : "Mostrar"} variables
          </button>
          {showEnv && envVars.map(({ key, val }) => (
            <div key={key} className="flex items-center justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
              <span className="text-[11px] font-mono text-gray-500 truncate">{key}</span>
              <span className={`text-[11px] font-mono shrink-0 ${val?.startsWith("✗") ? "text-red-500" : "text-gray-900"}`}>{val ?? "—"}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Reglas de timbrado confirmadas">
        <div className="space-y-2 text-xs">
          {[
            ["CurrencyExchangeRate", "Campo correcto para TC en Facturama Lite v3 (no ExchangeRate)"],
            ["TaxObject 02", "Requiere Taxes. Sin impuesto → usar 01"],
            ["FormaPago 99", "Solo para PPD. PUE usa forma real"],
            ["DomicilioFiscalReceptor", "CP debe coincidir con constancia SAT"],
            ["Endpoint", "/api-lite/3/cfdis (Multiemisor)"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>{k}</strong> — {v}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Módulos tab ──────────────────────────────────────────────────────────────

function TabModulos() {
  const sections = useMemo(() => {
    const map: Record<string, typeof ALL_ROUTES> = {};
    for (const r of ALL_ROUTES) {
      const s = getSection(r.href);
      if (!map[s]) map[s] = [];
      map[s].push(r);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  const total = ALL_ROUTES.length;
  const live  = ALL_ROUTES.filter((r) => (MODULE_STATUS_DEFAULTS[r.href] ?? "live") === "live").length;
  const wip   = ALL_ROUTES.filter((r) => MODULE_STATUS_DEFAULTS[r.href] === "wip").length;
  const dev   = ALL_ROUTES.filter((r) => MODULE_STATUS_DEFAULTS[r.href] === "dev").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[["Total", total, "text-gray-900"], ["Live", live, "text-emerald-600"], ["WIP", wip, "text-amber-600"], ["Dev", dev, "text-slate-400"]].map(([l, n, c]) => (
          <div key={String(l)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-500">{l}</p>
            <p className={`text-2xl font-bold mt-0.5 ${c}`}>{n}</p>
          </div>
        ))}
      </div>

      {sections.map(([section, routes]) => (
        <div key={section} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{section}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {routes.map((r) => {
                const status = MODULE_STATUS_DEFAULTS[r.href];
                return (
                  <tr key={r.href} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 font-medium text-gray-900 w-56">{r.label}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{r.href}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={status} /></td>
                    <td className="px-3 py-2.5">
                      {r.devOnly && <Pill label="dev-only" color="bg-violet-100 text-violet-700" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ─── Colecciones tab ──────────────────────────────────────────────────────────

function TabColecciones() {
  const global    = COLS.filter((c) => c.isolation === "global");
  const porPlanta = COLS.filter((c) => c.isolation === "por-planta");
  const parcial   = COLS.filter((c) => c.isolation === "parcial");

  function ColTable({ cols }: { cols: ColInfo[] }) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Colección</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Aislamiento</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Módulos</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Notas</th>
          </tr>
        </thead>
        <tbody>
          {cols.map((c) => (
            <tr key={c.key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-900">{c.label}</td>
              <td className="px-4 py-2.5"><IsolationBadge level={c.isolation} /></td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {c.modules.map((m) => (
                    <span key={m} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{m}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-400 hidden lg:table-cell">{c.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-500">Total colecciones</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{COLS.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-600">Por planta</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5">{porPlanta.length}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-600">Globales</p>
          <p className="text-2xl font-bold text-blue-700 mt-0.5">{global.length}</p>
        </div>
      </div>

      {[
        { title: `Por planta — ${porPlanta.length} colecciones (aisladas por planta activa)`, cols: porPlanta },
        { title: `Globales — ${global.length} colecciones (compartidas entre todas las plantas)`, cols: global },
        ...(parcial.length ? [{ title: `Parciales — ${parcial.length} (escritura sin consistencia)`, cols: parcial }] : []),
      ].map(({ title, cols }) => (
        <div key={title} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
          </div>
          <ColTable cols={cols} />
        </div>
      ))}
    </div>
  );
}

// ─── Plantas tab ──────────────────────────────────────────────────────────────

const PLANTAS: Planta[] = ["Allende", "Pesquería"];

const MODULE_PLANT_MAP: { module: string; href: string; allende: boolean; pesqueria: boolean; shared: boolean }[] = [
  { module: "Dashboard",           href: "/dashboard",                  allende: true,  pesqueria: true,  shared: true },
  { module: "Prog. Ventas",        href: "/ventas/programacion",        allende: true,  pesqueria: true,  shared: false },
  { module: "Recibos Concreto",    href: "/ventas/recibos-concreto",    allende: true,  pesqueria: true,  shared: false },
  { module: "Catálogo Obras",      href: "/ventas/obras",               allende: true,  pesqueria: true,  shared: false },
  { module: "Remisiones",          href: "/ventas/remisiones",          allende: true,  pesqueria: true,  shared: false },
  { module: "Productos",           href: "/ventas/productos",           allende: true,  pesqueria: true,  shared: false },
  { module: "Clientes CRM",        href: "/crm/clientes",               allende: true,  pesqueria: true,  shared: false },
  { module: "Pipeline CRM",        href: "/crm/pipeline",               allende: true,  pesqueria: true,  shared: false },
  { module: "Efectivo",            href: "/efectivo",                   allende: true,  pesqueria: true,  shared: false },
  { module: "Inventarios",         href: "/operaciones/inventario",     allende: true,  pesqueria: true,  shared: false },
  { module: "CXC",                 href: "/finanzas/cxc",               allende: true,  pesqueria: true,  shared: false },
  { module: "CXP",                 href: "/finanzas/cxp",               allende: true,  pesqueria: true,  shared: false },
  { module: "Facturación",         href: "/facturacion",                allende: true,  pesqueria: true,  shared: false },
  { module: "Prog. Transporte",    href: "/transporte/programacion",    allende: true,  pesqueria: true,  shared: false },
  { module: "Flota / Seguros",     href: "/transporte/seguros",         allende: true,  pesqueria: false, shared: true  },
  { module: "Diésel",              href: "/transporte/diesel",          allende: true,  pesqueria: false, shared: true  },
  { module: "Mantenimiento",       href: "/transporte/mantenimiento",   allende: true,  pesqueria: false, shared: true  },
  { module: "Empleados",           href: "/transporte/operadores",      allende: true,  pesqueria: false, shared: true  },
  { module: "Nómina",              href: "/recursos-humanos/nomina",    allende: true,  pesqueria: false, shared: false },
  { module: "Asistencia",          href: "/recursos-humanos/asistencia",allende: true,  pesqueria: false, shared: false },
  { module: "Configuración",       href: "/configuracion",              allende: true,  pesqueria: true,  shared: true  },
  { module: "Reportes",            href: "/reportes",                   allende: true,  pesqueria: true,  shared: false },
];

function TabPlantas() {
  const sharedCount    = MODULE_PLANT_MAP.filter((m) => m.shared).length;
  const isolatedCount  = MODULE_PLANT_MAP.filter((m) => !m.shared).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-gray-500">Total módulos</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{MODULE_PLANT_MAP.length}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-600">Datos compartidos</p>
          <p className="text-2xl font-bold text-blue-700 mt-0.5">{sharedCount}</p>
          <p className="text-[10px] text-blue-500 mt-0.5">mismos datos en todas las plantas</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-600">Datos aislados</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5">{isolatedCount}</p>
          <p className="text-[10px] text-emerald-500 mt-0.5">cada planta ve solo los suyos</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Módulo</th>
              {PLANTAS.map((p) => (
                <th key={p} className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{p}</th>
              ))}
              <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Datos</th>
            </tr>
          </thead>
          <tbody>
            {MODULE_PLANT_MAP.map((m) => (
              <tr key={m.href} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="px-5 py-2.5">
                  <p className="font-medium text-gray-900 text-xs">{m.module}</p>
                  <p className="font-mono text-[10px] text-gray-400">{m.href}</p>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {m.allende
                    ? <CheckCircle2 size={15} className="text-emerald-500 mx-auto" />
                    : <span className="text-gray-300 text-lg">—</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {m.pesqueria
                    ? <CheckCircle2 size={15} className="text-emerald-500 mx-auto" />
                    : <span className="text-gray-300 text-lg">—</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {m.shared
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600"><Globe size={9} />Compartido</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"><Lock size={9} />Aislado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 flex gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <div>
          <strong>Nota de migración:</strong> Las colecciones globales (operadores, unidades, seguros, mantenimiento) no tienen campo <code className="bg-amber-100 px-1 rounded">planta</code> — los datos de flota son compartidos entre Allende y Pesquería. Si en el futuro se requiere aislamiento, ejecutar <code className="bg-amber-100 px-1 rounded">migrateLegacyPlanta()</code> en cada colección y actualizar las lecturas a <code className="bg-amber-100 px-1 rounded">filterByPlanta()</code>.
        </div>
      </div>
    </div>
  );
}

// ─── Sesión tab ───────────────────────────────────────────────────────────────

function TabSesion() {
  const session  = getStoredSession();
  const original = getImpersonationOriginal();
  const impersonating = isImpersonating();
  const [showRaw, setShowRaw] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SolicitudAutorizacion[]>([]);

  useEffect(() => {
    getCollectionDocs<SolicitudAutorizacion>(COLLECTIONS.solicitudesAutorizacion)
      .then(setSolicitudes).catch(() => {});
  }, []);

  const pendientes = solicitudes.filter((s) => s.status === "pendiente");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard title="Sesión activa">
        {session ? (
          <>
            <KV k="Nombre"   v={session.name} />
            <KV k="Email"    v={session.email} mono />
            <KV k="Rol"      v={session.role} />
            <KV k="Planta"   v={session.planta ?? "—"} />
            <KV k="Módulos"  v={session.modules === "all" ? "Todos" : `${(session.modules as string[]).length} módulos`} />
            <KV k="Puede autorizar" v={session.canAuthorize ? "Sí" : "No"} />
            {impersonating && (
              <div className="mt-3 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs text-violet-700">
                ⚠️ Impersonando a {session.name}. Sesión original: {original?.name}
                <button onClick={() => { stopImpersonation(); window.location.reload(); }}
                  className="ml-2 underline cursor-pointer">Salir</button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Sin sesión activa</p>
        )}
      </SectionCard>

      <SectionCard title="Solicitudes de autorización">
        <KV k="Total"     v={String(solicitudes.length)} />
        <KV k="Pendientes" v={<span className={pendientes.length > 0 ? "text-amber-600 font-bold" : ""}>{pendientes.length}</span>} />
        <KV k="Aprobadas" v={String(solicitudes.filter((s) => s.status === "aprobada").length)} />
        <KV k="Rechazadas" v={String(solicitudes.filter((s) => s.status === "rechazada").length)} />
        <div className="mt-3 space-y-1">
          {pendientes.slice(0, 3).map((s) => (
            <div key={s.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <p className="font-medium text-amber-800">{s.tipo} — {s.solicitanteEmail}</p>
              <p className="text-amber-600 truncate">{s.motivo}</p>
            </div>
          ))}
          {pendientes.length > 3 && <p className="text-xs text-gray-400">+{pendientes.length - 3} más en Configuración → Autorizaciones</p>}
        </div>
      </SectionCard>

      <SectionCard title="Sesión raw (localStorage)">
        <button onClick={() => setShowRaw((v) => !v)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer mb-3">
          {showRaw ? <EyeOff size={12} /> : <Eye size={12} />} {showRaw ? "Ocultar" : "Ver"} JSON
        </button>
        {showRaw && (
          <pre className="rounded-lg bg-gray-900 text-emerald-400 text-[11px] font-mono p-3 overflow-auto max-h-60">
            {JSON.stringify(session, null, 2)}
          </pre>
        )}
        <button
          onClick={() => { navigator.clipboard.writeText(JSON.stringify(session, null, 2)); toast("success", "Copiado", "Sesión copiada al clipboard"); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer mt-2"
        >
          <ClipboardCopy size={12} /> Copiar JSON
        </button>
      </SectionCard>

      <SectionCard title="Acciones de sesión">
        <div className="space-y-2">
          <button
            onClick={() => { localStorage.clear(); toast("info", "Limpiado", "localStorage eliminado. Recarga la página."); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 cursor-pointer transition-colors"
          >
            <Trash2 size={14} /> Limpiar localStorage
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <RefreshCw size={14} /> Forzar recarga
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Herramientas tab ─────────────────────────────────────────────────────────

function TabHerramientas() {
  const [toastType, setToastType] = useState("success");
  const [toastTitle, setToastTitle] = useState("Prueba");
  const [toastMsg, setToastMsg] = useState("Este es un toast de prueba.");
  const [lsKeys, setLsKeys] = useState<string[]>([]);
  const [showLs, setShowLs] = useState(false);

  function loadLs() {
    setLsKeys(Object.keys(localStorage).sort());
    setShowLs(true);
  }

  const inp = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SectionCard title="Tester de toasts">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select value={toastType} onChange={(e) => setToastType(e.target.value)} className={inp}>
              {["success", "error", "info", "warning"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Título</label>
            <input value={toastTitle} onChange={(e) => setToastTitle(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mensaje</label>
            <input value={toastMsg} onChange={(e) => setToastMsg(e.target.value)} className={inp} />
          </div>
          <button
            onClick={() => toast(toastType, toastTitle, toastMsg)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] cursor-pointer"
          >
            <Zap size={14} /> Disparar toast
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Inspector de localStorage">
        <div className="space-y-2">
          <button onClick={loadLs} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
            <Eye size={12} /> Ver claves ({typeof window !== "undefined" ? Object.keys(localStorage).length : 0})
          </button>
          {showLs && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {lsKeys.map((k) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-1.5">
                  <span className="text-[11px] font-mono text-gray-700 flex-1 truncate">{k}</span>
                  <button
                    onClick={() => { localStorage.removeItem(k); loadLs(); toast("info", "Eliminado", k); }}
                    className="text-gray-300 hover:text-red-500 cursor-pointer shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Info de diagnóstico">
        <div className="space-y-2 text-xs">
          <KV k="User Agent" v={typeof navigator !== "undefined" ? navigator.userAgent.split(")")[0].split("(")[1] ?? "—" : "—"} />
          <KV k="Viewport" v={typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "—"} />
          <KV k="Timezone" v={Intl.DateTimeFormat().resolvedOptions().timeZone} />
          <KV k="Idioma" v={typeof navigator !== "undefined" ? navigator.language : "—"} />
          <KV k="Online" v={typeof navigator !== "undefined" ? (navigator.onLine ? "Sí" : "No") : "—"} />
        </div>
        <button
          onClick={() => {
            const info = {
              session: getStoredSession(),
              url: window.location.href,
              ua: navigator.userAgent,
              viewport: `${window.innerWidth}×${window.innerHeight}`,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              timestamp: new Date().toISOString(),
            };
            navigator.clipboard.writeText(JSON.stringify(info, null, 2));
            toast("success", "Copiado", "Diagnóstico completo en el clipboard");
          }}
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          <ClipboardCopy size={12} /> Copiar diagnóstico completo
        </button>
      </SectionCard>

      <SectionCard title="Colecciones Firestore">
        <p className="text-xs text-gray-500 mb-3">Nombres de colección activos en el sistema:</p>
        <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
          {Object.entries(COLLECTIONS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 cursor-pointer hover:bg-gray-50"
              onClick={() => { navigator.clipboard.writeText(v); toast("info", "Copiado", v); }}>
              <span className="text-[10px] font-mono text-gray-600 truncate">{v}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevPage() {
  const session = getStoredSession();
  const router  = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("sistema");

  useEffect(() => {
    if (!session || session.email !== DEVELOPER_EMAIL) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  if (!session || session.email !== DEVELOPER_EMAIL) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
          <Code2 size={20} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Developer</p>
          <p className="text-gray-500 text-sm mt-0.5">Herramientas internas — solo visible para {DEVELOPER_EMAIL}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
              activeTab === id
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "sistema"      && <TabSistema />}
      {activeTab === "modulos"      && <TabModulos />}
      {activeTab === "colecciones"  && <TabColecciones />}
      {activeTab === "plantas"      && <TabPlantas />}
      {activeTab === "sesion"       && <TabSesion />}
      {activeTab === "herramientas" && <TabHerramientas />}
    </div>
  );
}
