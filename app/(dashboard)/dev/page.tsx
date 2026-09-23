"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, Bug, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCopy, ClipboardList, Clock, Code2,
  Database, Eye, EyeOff, Globe, HeartPulse,
  Layers, Lock, RefreshCw, Server, Shield, Terminal, Trash2,
  XCircle, Zap,
} from "lucide-react";
import {
  COLLECTIONS, type SolicitudAutorizacion, type AppError, type AuditEntry,
  getCollectionDocs, countCollectionDocs, limit, orderBy,
} from "@/lib/db";
import { INTEGRITY_CHECKS, type IntegrityResult } from "@/lib/integrityChecks";
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

const _moduleHrefs = new Set(moduleCatalog.map((m) => m.href));
const ALL_ROUTES = [
  ...moduleCatalog.map((m) => ({ ...m, devOnly: DEV_ONLY_ROUTES.has(m.href) })),
  ...Array.from(DEV_ONLY_ROUTES)
    .filter((href) => !_moduleHrefs.has(href))
    .map((href) => ({ href, label: href, devOnly: true })),
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

type Tab = "salud" | "errores" | "integridad" | "bitacora" | "sistema" | "modulos" | "colecciones" | "plantas" | "sesion" | "herramientas";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "salud",        label: "Salud",          icon: HeartPulse },
  { id: "errores",      label: "Errores",         icon: Bug },
  { id: "integridad",   label: "Integridad",      icon: AlertCircle },
  { id: "bitacora",     label: "Bitácora",        icon: ClipboardList },
  { id: "sistema",      label: "Sistema",         icon: Server },
  { id: "modulos",      label: "Módulos",         icon: Layers },
  { id: "colecciones",  label: "Colecciones",     icon: Database },
  { id: "plantas",      label: "Plantas",         icon: Globe },
  { id: "sesion",       label: "Sesión",          icon: Shield },
  { id: "herramientas", label: "Herramientas",    icon: Terminal },
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

// ─── Salud tab ────────────────────────────────────────────────────────────────

const MONITORED_COLS = [
  "programaciones", "clientes", "efectivo", "cfdiEmitidos",
  "remisiones", "solicitudesAutorizacion", "errores", "auditLog",
] as const;

function SemLight({ status }: { status: "ok" | "warn" | "error" | "unknown" }) {
  const cfg = {
    ok:      { dot: "bg-emerald-500",  ring: "ring-emerald-200", label: "OK",         text: "text-emerald-700" },
    warn:    { dot: "bg-amber-400",    ring: "ring-amber-200",   label: "Advertencia", text: "text-amber-700" },
    error:   { dot: "bg-red-500",      ring: "ring-red-200",     label: "Error",       text: "text-red-700" },
    unknown: { dot: "bg-gray-300",     ring: "ring-gray-200",    label: "—",           text: "text-gray-400" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${cfg.ring} bg-white`}>
      <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

function TabSalud() {
  const [checking, setChecking]         = useState(false);
  const [firebase, setFirebase]         = useState<"ok" | "warn" | "error" | "unknown">("unknown");
  const [facturama, setFacturama]       = useState<"ok" | "warn" | "error" | "unknown">("unknown");
  const [factMsg, setFactMsg]           = useState("");
  const [counts, setCounts]             = useState<Record<string, number>>({});
  const [lastCheck, setLastCheck]       = useState<string | null>(null);
  const [errorCount, setErrorCount]     = useState<number | null>(null);
  const [staleCount, setStaleCount]     = useState<number | null>(null);

  async function runCheck() {
    setChecking(true);

    // Firebase connectivity
    try {
      await countCollectionDocs(COLLECTIONS.users);
      setFirebase("ok");
    } catch {
      setFirebase("error");
    }

    // Facturama
    try {
      const res  = await fetch("/api/facturama/test");
      const data = await res.json() as { ok?: boolean; sandbox?: boolean; mensaje?: string; error?: string };
      if (!data.ok) { setFacturama("error"); setFactMsg(data.error ?? "Error"); }
      else if (data.sandbox) { setFacturama("warn"); setFactMsg("SANDBOX — no es producción"); }
      else { setFacturama("ok"); setFactMsg(data.mensaje ?? "Conectado"); }
    } catch (e) {
      setFacturama("error");
      setFactMsg(e instanceof Error ? e.message : "Sin respuesta");
    }

    // Collection counts
    const entries: Record<string, number> = {};
    await Promise.all(
      MONITORED_COLS.map(async (col) => {
        try { entries[col] = await countCollectionDocs(col); }
        catch { entries[col] = -1; }
      }),
    );
    setCounts(entries);

    // Unresolved error count
    try {
      const errs = await getCollectionDocs<AppError>(COLLECTIONS.errores, [limit(200)]);
      setErrorCount(errs.filter((e) => !e.resolved).length);
    } catch { setErrorCount(null); }

    // Stale solicitudes (pendiente >7d)
    try {
      const sols = await getCollectionDocs<SolicitudAutorizacion>(COLLECTIONS.solicitudesAutorizacion);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      setStaleCount(sols.filter((s) => s.status === "pendiente" && s.creadoEn && new Date(s.creadoEn) < cutoff).length);
    } catch { setStaleCount(null); }

    setLastCheck(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setChecking(false);
  }

  useEffect(() => { runCheck(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{lastCheck ? `Última verificación: ${lastCheck}` : "Verificando…"}</p>
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Alertas activas */}
      {((errorCount ?? 0) > 0 || (staleCount ?? 0) > 0) && (
        <div className="space-y-2">
          {(errorCount ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <Bug size={15} className="text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-700">{errorCount} error(es) sin resolver — revisa la pestaña Errores</p>
            </div>
          )}
          {(staleCount ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Clock size={15} className="text-amber-500 shrink-0" />
              <p className="text-xs font-medium text-amber-700">{staleCount} solicitud(es) pendiente(s) con más de 7 días sin resolver</p>
            </div>
          )}
        </div>
      )}

      {/* Servicios */}
      <SectionCard title="Estado de servicios">
        <div className="space-y-3">
          {[
            { label: "Firebase / Firestore", status: firebase, msg: firebase === "ok" ? "Conectado" : "Sin conexión" },
            { label: "Facturama API",        status: facturama, msg: factMsg || "—" },
          ].map(({ label, status, msg }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-xs font-medium text-gray-900">{label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{msg}</p>
              </div>
              <SemLight status={status} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Conteos de colecciones */}
      <SectionCard title="Documentos por colección">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MONITORED_COLS.map((col) => {
            const n = counts[col];
            return (
              <div key={col} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-mono text-gray-400 truncate">{col}</p>
                <p className={`text-lg font-bold mt-0.5 ${n === undefined ? "text-gray-300" : n < 0 ? "text-red-400" : "text-gray-900"}`}>
                  {n === undefined ? "…" : n < 0 ? "ERR" : n.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Errores tab ──────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function TabErrores() {
  const [errors, setErrors]     = useState<AppError[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "unresolved">("unresolved");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [marking, setMarking]   = useState<string | null>(null);

  function load() {
    setLoading(true);
    getCollectionDocs<AppError>(COLLECTIONS.errores, [orderBy("timestamp", "desc"), limit(200)])
      .then(setErrors).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const shown = filter === "all" ? errors : errors.filter((e) => !e.resolved);

  async function markResolved(id: string) {
    if (!id) return;
    setMarking(id);
    try {
      const { upsertDocument } = await import("@/lib/db");
      await upsertDocument(COLLECTIONS.errores, id, { resolved: true });
      setErrors((prev) => prev.map((e) => e.id === id ? { ...e, resolved: true } : e));
      toast("success", "Resuelto", "Error marcado como resuelto");
    } catch { toast("error", "Error", "No se pudo actualizar"); }
    finally { setMarking(null); }
  }

  const typeIcon: Record<string, string> = {
    runtime: "bg-red-100 text-red-600",
    unhandled_promise: "bg-orange-100 text-orange-600",
    network: "bg-blue-100 text-blue-600",
    react: "bg-violet-100 text-violet-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(["unresolved", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${filter === f ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}>
              {f === "unresolved" ? `Sin resolver (${errors.filter((e) => !e.resolved).length})` : `Todos (${errors.length})`}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando errores…</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <CheckCircle2 size={32} className="text-emerald-400" />
          <p className="text-sm font-medium text-gray-600">Sin errores {filter === "unresolved" ? "sin resolver" : "registrados"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((err) => {
            const isExp = expanded === err.id;
            return (
              <div key={err.id} className={`rounded-xl border overflow-hidden transition-all ${err.resolved ? "border-gray-100 opacity-60" : "border-red-200"}`}>
                <div
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${err.resolved ? "bg-gray-50" : "bg-red-50/40"}`}
                  onClick={() => setExpanded(isExp ? null : (err.id ?? null))}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${typeIcon[err.type] ?? "bg-gray-100 text-gray-600"}`}>{err.type}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{err.route}</span>
                      <span className="text-[10px] text-gray-400">{fmtTime(err.timestamp)}</span>
                      {err.resolved && <Pill label="resuelto" color="bg-emerald-100 text-emerald-700" />}
                    </div>
                    <p className="text-xs font-medium text-gray-900 truncate">{err.message}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{err.userName} · {err.userEmail}</p>
                  </div>
                  <ChevronRight size={14} className={`text-gray-400 shrink-0 transition-transform mt-0.5 ${isExp ? "rotate-90" : ""}`} />
                </div>
                {isExp && (
                  <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-3">
                    {err.stack && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Stack trace</p>
                        <pre className="rounded-lg bg-gray-900 text-emerald-400 text-[10px] font-mono p-3 overflow-auto max-h-48 whitespace-pre-wrap">{err.stack}</pre>
                      </div>
                    )}
                    {err.context && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Contexto</p>
                        <pre className="rounded-lg bg-gray-50 text-gray-700 text-[10px] font-mono p-3">{JSON.stringify(err.context, null, 2)}</pre>
                      </div>
                    )}
                    {!err.resolved && (
                      <button
                        onClick={() => markResolved(err.id ?? "")}
                        disabled={marking === err.id}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} />
                        {marking === err.id ? "Marcando…" : "Marcar como resuelto"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Integridad tab ───────────────────────────────────────────────────────────

type CheckStatus = "idle" | "running" | "ok" | "issues";

interface CheckState {
  status: CheckStatus;
  result?: IntegrityResult;
}

function TabIntegridad() {
  const [states, setStates] = useState<Record<string, CheckState>>(() =>
    Object.fromEntries(INTEGRITY_CHECKS.map((c) => [c.id, { status: "idle" }])),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  function updateCheck(id: string, patch: Partial<CheckState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function runOne(checkId: string) {
    const check = INTEGRITY_CHECKS.find((c) => c.id === checkId);
    if (!check) return;
    updateCheck(checkId, { status: "running" });
    try {
      const result = await check.run();
      updateCheck(checkId, { status: result.ok ? "ok" : "issues", result });
    } catch {
      updateCheck(checkId, { status: "issues", result: { ok: false, count: 1, items: [{ id: "err", desc: "Error ejecutando la verificación" }], durationMs: 0 } });
    }
  }

  async function runAll() {
    setRunningAll(true);
    await Promise.all(INTEGRITY_CHECKS.map((c) => runOne(c.id)));
    setRunningAll(false);
  }

  const severityColor = { error: "bg-red-100 text-red-600", warning: "bg-amber-100 text-amber-600", info: "bg-blue-100 text-blue-600" };

  const summary = {
    ok:     INTEGRITY_CHECKS.filter((c) => states[c.id]?.status === "ok").length,
    issues: INTEGRITY_CHECKS.filter((c) => states[c.id]?.status === "issues").length,
    idle:   INTEGRITY_CHECKS.filter((c) => states[c.id]?.status === "idle" || states[c.id]?.status === "running").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-600 font-semibold">{summary.ok} OK</span>
          <span className="text-red-500 font-semibold">{summary.issues} con problemas</span>
          <span className="text-gray-400">{summary.idle} pendientes</span>
        </div>
        <button
          onClick={runAll}
          disabled={runningAll}
          className="flex items-center gap-1.5 rounded-xl bg-[#CC2229] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B01E24] cursor-pointer disabled:opacity-50"
        >
          <Activity size={13} className={runningAll ? "animate-pulse" : ""} />
          {runningAll ? "Verificando…" : "Ejecutar todas"}
        </button>
      </div>

      <div className="space-y-2">
        {INTEGRITY_CHECKS.map((check) => {
          const state = states[check.id];
          const isExp = expanded === check.id;
          const result = state.result;
          return (
            <div key={check.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-gray-900">{check.label}</p>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${severityColor[check.severity]}`}>{check.severity}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{check.description}</p>
                  {result && (
                    <p className={`text-[11px] font-medium mt-1 ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                      {result.ok ? "Sin problemas" : `${result.count} problema(s) encontrado(s)`}
                      {" · "}
                      <span className="text-gray-400">{result.durationMs}ms</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {state.status === "running" && <RefreshCw size={14} className="animate-spin text-gray-400" />}
                  {state.status === "ok"      && <CheckCircle2 size={16} className="text-emerald-500" />}
                  {state.status === "issues"  && <XCircle size={16} className="text-red-500" />}
                  <button
                    onClick={() => runOne(check.id)}
                    disabled={state.status === "running"}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-40"
                  >
                    {state.status === "running" ? "…" : "Verificar"}
                  </button>
                  {result && result.items.length > 0 && (
                    <button onClick={() => setExpanded(isExp ? null : check.id)} className="cursor-pointer">
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExp ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
              {isExp && result && result.items.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {result.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-[11px]">
                      <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{item.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Bitácora tab ─────────────────────────────────────────────────────────────

function TabBitacora() {
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterCol, setFilterCol]   = useState("");
  const [filterAction, setFilterAction] = useState<"" | "create" | "update" | "delete">("");

  function load() {
    setLoading(true);
    getCollectionDocs<AuditEntry>(COLLECTIONS.auditLog, [orderBy("timestamp", "desc"), limit(500)])
      .then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const shown = entries.filter((e) => {
    if (filterUser && !e.userEmail.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (filterCol && !e.collection.toLowerCase().includes(filterCol.toLowerCase())) return false;
    if (filterAction && e.action !== filterAction) return false;
    return true;
  });

  const actionStyle: Record<string, string> = {
    create: "bg-emerald-100 text-emerald-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-600",
  };

  const inp = "rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#CC2229]/20 bg-white";

  const uniqueUsers = Array.from(new Set(entries.map((e) => e.userEmail)));
  const uniqueCols  = Array.from(new Set(entries.map((e) => e.collection)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className={inp}>
          <option value="">Todos los usuarios</option>
          {uniqueUsers.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className={inp}>
          <option value="">Todas las colecciones</option>
          {uniqueCols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value as "" | "create" | "update" | "delete")} className={inp}>
          <option value="">Todas las acciones</option>
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Cargando…" : "Actualizar"}
        </button>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} de {entries.length} registros</span>
      </div>

      {loading && entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando bitácora…</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <ClipboardList size={32} className="text-gray-200" />
          <p className="text-sm font-medium text-gray-500">Sin registros de auditoría</p>
          <p className="text-xs text-gray-400">Las acciones de crear, actualizar y eliminar documentos quedarán registradas aquí.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Acción</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Colección / Doc</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Usuario</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px] hidden md:table-cell">Planta</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={e.id ?? i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 font-semibold text-[10px] ${actionStyle[e.action] ?? "bg-gray-100 text-gray-600"}`}>{e.action}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-mono text-[10px] text-gray-700">{e.collection}</p>
                    <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{e.summary ?? e.documentId}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{e.userName}</p>
                    <p className="text-[10px] text-gray-400">{e.userEmail}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{e.planta ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400">{fmtTime(e.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState<Tab>("salud");

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

      {activeTab === "salud"        && <TabSalud />}
      {activeTab === "errores"      && <TabErrores />}
      {activeTab === "integridad"   && <TabIntegridad />}
      {activeTab === "bitacora"     && <TabBitacora />}
      {activeTab === "sistema"      && <TabSistema />}
      {activeTab === "modulos"      && <TabModulos />}
      {activeTab === "colecciones"  && <TabColecciones />}
      {activeTab === "plantas"      && <TabPlantas />}
      {activeTab === "sesion"       && <TabSesion />}
      {activeTab === "herramientas" && <TabHerramientas />}
    </div>
  );
}
