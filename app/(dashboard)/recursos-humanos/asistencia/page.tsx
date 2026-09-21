"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock,
  Download, Loader2, Moon, Pencil, ShieldOff, Stethoscope, Umbrella,
  UserCheck, UserMinus, Users, X, BarChart3, ListChecks,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta } from "@/lib/auth";
import type { Operador } from "@/lib/operadores";

// ─── Types ────────────────────────────────────────────────────────────────────

type EstadoAsistencia =
  | "presente" | "ausente" | "justificada"
  | "vacaciones" | "permiso" | "incapacidad";

interface Asistencia {
  id?: string;
  empleadoId: string;
  nombre: string;
  puesto: string;
  fecha: string;
  estado: EstadoAsistencia;
  horaEntrada?: string;
  horaSalida?: string;
  notas?: string;
  planta?: string;
}

type ViewMode = "pase" | "semana" | "mes" | "resumen";

// ─── Config ───────────────────────────────────────────────────────────────────

const ESTADOS: {
  value: EstadoAsistencia; label: string; short: string;
  color: string; bg: string; ring: string; icon: React.ElementType;
}[] = [
  { value: "presente",    label: "Presente",    short: "P",  color: "text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/40", icon: Check       },
  { value: "ausente",     label: "Ausente",      short: "A",  color: "text-red-400",    bg: "bg-red-500/15",     ring: "ring-red-500/40",     icon: X           },
  { value: "justificada", label: "Just.",        short: "JF", color: "text-amber-400",  bg: "bg-amber-500/15",   ring: "ring-amber-500/40",   icon: ShieldOff   },
  { value: "vacaciones",  label: "Vacaciones",   short: "V",  color: "text-blue-400",   bg: "bg-blue-500/15",    ring: "ring-blue-500/40",    icon: Umbrella    },
  { value: "permiso",     label: "Permiso",      short: "PE", color: "text-purple-400", bg: "bg-purple-500/15",  ring: "ring-purple-500/40",  icon: Moon        },
  { value: "incapacidad", label: "Incap.",       short: "I",  color: "text-orange-400", bg: "bg-orange-500/15",  ring: "ring-orange-500/40",  icon: Stethoscope },
];

const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toISO = (d: Date) => d.toISOString().slice(0, 10);

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function weekStart(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

const weekDays = (s: string) => Array.from({ length: 7 }, (_, i) => addDays(s, i));

function isoToLabel(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", opts ?? { day: "2-digit", month: "short" });
}

function monthLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function monthRange(iso: string): [string, string] {
  const d = new Date(iso + "T12:00:00");
  return [
    toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  ];
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

const attId = (eid: string, fecha: string) => `${eid}_${fecha}`;
const eCfg  = (e?: EstadoAsistencia) => ESTADOS.find((s) => s.value === e);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AsistenciaPage() {
  const today = toISO(new Date());

  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const [view, setView]         = useState<ViewMode>("pase");
  const [anchor, setAnchor]     = useState(today);
  const [paseDate, setPaseDate] = useState(today);
  const [search, setSearch]     = useState("");

  // Detail modal
  const [detailKey, setDetailKey] = useState<{ op: Operador; fecha: string } | null>(null);
  const [dHoraE, setDHoraE]     = useState("");
  const [dHoraS, setDHoraS]     = useState("");
  const [dNotas, setDNotas]     = useState("");

  const savingRef = useRef(saving);
  savingRef.current = saving;

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
      getCollectionDocs<Asistencia>(COLLECTIONS.asistencias),
    ]).then(([ops, att]) => {
      setOperadores(filterByPlanta(ops.filter((o) => !o.baja)));
      setAsistencias(att);
    }).finally(() => setLoading(false));
  }, []);

  // ── Map ───────────────────────────────────────────────────────────────────
  const attMap = useMemo(() => {
    const m = new Map<string, Asistencia>();
    asistencias.forEach((a) => m.set(attId(a.empleadoId, a.fecha), a));
    return m;
  }, [asistencias]);

  // ── Ranges ────────────────────────────────────────────────────────────────
  const wStart    = useMemo(() => weekStart(anchor), [anchor]);
  const days      = useMemo(() => weekDays(wStart), [wStart]);
  const [mS, mE]  = useMemo(() => monthRange(anchor), [anchor]);
  const monthDays = useMemo(() => {
    const r: string[] = []; let c = mS;
    while (c <= mE) { r.push(c); c = addDays(c, 1); }
    return r;
  }, [mS, mE]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const [ms, me] = monthRange(today);
    const mAtt   = asistencias.filter((a) => a.fecha >= ms && a.fecha <= me);
    const hoy    = asistencias.filter((a) => a.fecha === today);
    const presH  = hoy.filter((a) => a.estado === "presente").length;
    const presM  = mAtt.filter((a) => a.estado === "presente").length;
    const faltaM = mAtt.filter((a) => a.estado === "ausente").length;
    const recM   = mAtt.length;
    return { presH, ausH: operadores.length - presH, presM, faltaM, pct: recM > 0 ? Math.round((presM / recM) * 100) : 0 };
  }, [asistencias, today, operadores.length]);

  // ── Per-employee stats for Resumen ────────────────────────────────────────
  const resumen = useMemo(() => {
    const [ms, me] = monthRange(anchor);
    return operadores.map((op) => {
      const att = asistencias.filter((a) => a.empleadoId === op.id && a.fecha >= ms && a.fecha <= me);
      const cnts = { presente: 0, ausente: 0, justificada: 0, vacaciones: 0, permiso: 0, incapacidad: 0 };
      att.forEach((a) => { if (a.estado in cnts) cnts[a.estado as keyof typeof cnts]++; });
      const diasH = monthDays.filter((d) => { const n = new Date(d + "T12:00:00").getDay(); return n !== 0 && n !== 6; });
      const pct = diasH.length > 0 ? Math.round((cnts.presente / diasH.length) * 100) : null;
      return { op, ...cnts, pct, totalRec: att.length };
    }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
  }, [operadores, asistencias, anchor, monthDays]);

  // ── Filtered employees for pase ───────────────────────────────────────────
  const filteredOps = useMemo(() => {
    const q = search.toLowerCase();
    return q ? operadores.filter((o) => o.nombre.toLowerCase().includes(q) || o.puesto.toLowerCase().includes(q)) : operadores;
  }, [operadores, search]);

  // ── Save one ──────────────────────────────────────────────────────────────
  async function marcar(op: Operador, fecha: string, estado: EstadoAsistencia, extra?: { horaEntrada?: string; horaSalida?: string; notas?: string }) {
    const id = attId(op.id, fecha);
    setSaving((s) => new Set(s).add(id));
    const doc: Asistencia = {
      empleadoId: op.id, nombre: op.nombre, puesto: op.puesto, fecha, estado,
      ...(extra?.horaEntrada ? { horaEntrada: extra.horaEntrada } : {}),
      ...(extra?.horaSalida  ? { horaSalida: extra.horaSalida } : {}),
      ...(extra?.notas       ? { notas: extra.notas } : {}),
    };
    try {
      await upsertDocument(COLLECTIONS.asistencias, id, doc);
      setAsistencias((prev) => [...prev.filter((a) => attId(a.empleadoId, a.fecha) !== id), { ...doc, id }]);
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al guardar." } }));
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  // ── Bulk: mark all employees for a date ──────────────────────────────────
  async function marcarTodos(fecha: string, estado: EstadoAsistencia) {
    setBulkSaving(true);
    await Promise.all(
      operadores
        .filter((op) => !attMap.has(attId(op.id, fecha)) || attMap.get(attId(op.id, fecha))?.estado !== estado)
        .map((op) => marcar(op, fecha, estado))
    );
    setBulkSaving(false);
  }

  // ── Cycle cell (semana/mes click) ─────────────────────────────────────────
  function cycleEstado(op: Operador, fecha: string) {
    const cur = attMap.get(attId(op.id, fecha))?.estado;
    const next: EstadoAsistencia = cur === "presente" ? "ausente" : "presente";
    marcar(op, fecha, next);
  }

  // ── Detail modal ──────────────────────────────────────────────────────────
  function openDetail(op: Operador, fecha: string) {
    const att = attMap.get(attId(op.id, fecha));
    setDetailKey({ op, fecha });
    setDHoraE(att?.horaEntrada ?? "");
    setDHoraS(att?.horaSalida ?? "");
    setDNotas(att?.notas ?? "");
  }

  async function saveDetail(estado: EstadoAsistencia) {
    if (!detailKey) return;
    await marcar(detailKey.op, detailKey.fecha, estado, { horaEntrada: dHoraE, horaSalida: dHoraS, notas: dNotas });
    setDetailKey(null);
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  function prev() { view === "semana" ? setAnchor((d) => addDays(d, -7)) : setAnchor((d) => addMonths(d, -1)); }
  function next() { view === "semana" ? setAnchor((d) => addDays(d, 7))  : setAnchor((d) => addMonths(d, 1)); }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportXLSX() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const rows = operadores.flatMap((op) =>
      monthDays.map((fecha) => {
        const a = attMap.get(attId(op.id, fecha));
        return { Empleado: op.nombre, Puesto: op.puesto, Fecha: fecha, Estado: eCfg(a?.estado)?.label ?? "Sin registro", Entrada: a?.horaEntrada ?? "", Salida: a?.horaSalida ?? "", Notas: a?.notas ?? "" };
      })
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Asistencia");

    const resSheet = resumen.map((r) => ({
      Empleado: r.op.nombre, Puesto: r.op.puesto,
      Presentes: r.presente, Ausentes: r.ausente, Justificadas: r.justificada,
      Vacaciones: r.vacaciones, Permisos: r.permiso, Incapacidades: r.incapacidad,
      "% Asistencia": r.pct !== null ? `${r.pct}%` : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resSheet), "Resumen empleados");

    XLSX.writeFile(wb, `asistencia-${anchor.slice(0, 7)}.xlsx`);
  }

  const periodLabel = view === "semana"
    ? `${isoToLabel(days[0])} – ${isoToLabel(days[6])}`
    : monthLabel(anchor);

  const hasNavPeriod = view === "semana" || view === "mes" || view === "resumen";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[#CC2229]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Control de asistencia · {operadores.length} empleados activos</p>
        <button onClick={exportXLSX} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors cursor-pointer">
          <Download size={13} /> Exportar mes
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard title="Empleados activos" value={String(operadores.length)}     icon={Users}        iconColor="text-blue-400" />
        <KPICard title="Presentes hoy"     value={String(kpis.presH)}            icon={UserCheck}    iconColor="text-emerald-400" />
        <KPICard title="Ausentes hoy"      value={String(kpis.ausH)}             icon={UserMinus}    iconColor="text-red-400" />
        <KPICard title="Faltas en el mes"  value={String(kpis.faltaM)}           icon={CalendarDays} iconColor="text-orange-400" />
        <KPICard title="Puntualidad mes"   value={`${kpis.pct}%`}                icon={Clock}        iconColor="text-[#CC2229]" />
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          {([
            { key: "pase",    label: "Pase de lista", icon: ListChecks  },
            { key: "semana",  label: "Semana",        icon: CalendarDays },
            { key: "mes",     label: "Mes",           icon: CalendarDays },
            { key: "resumen", label: "Resumen",       icon: BarChart3   },
          ] as { key: ViewMode; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${view === key ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Period nav (semana/mes/resumen) */}
        {hasNavPeriod && (
          <div className="flex items-center gap-2">
            <button onClick={prev} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:text-white hover:border-[#CC2229]/60 transition-colors cursor-pointer"><ChevronLeft size={14} /></button>
            <span className="text-sm text-white font-medium px-1 min-w-44 text-center capitalize">{view === "resumen" ? monthLabel(anchor) : periodLabel}</span>
            <button onClick={next} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:text-white hover:border-[#CC2229]/60 transition-colors cursor-pointer"><ChevronRight size={14} /></button>
            <button onClick={() => setAnchor(today)} className="text-xs text-gray-400 hover:text-white bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 hover:border-[#CC2229]/60 transition-colors cursor-pointer">Hoy</button>
          </div>
        )}
      </div>

      {/* ══ PASE DE LISTA ════════════════════════════════════════════════════ */}
      {view === "pase" && (
        <div className="space-y-3">
          {/* Barra superior del pase */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#242424] border border-[#3A3A3A] rounded-xl">
            <div className="flex items-center gap-3">
              <input type="date" value={paseDate} max={today}
                onChange={(e) => setPaseDate(e.target.value)}
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#CC2229]/60 [color-scheme:dark]" />
              <button onClick={() => setPaseDate(addDays(paseDate, -1))} disabled={addDays(paseDate, -1) < addDays(today, -60)}
                className="p-1.5 text-gray-500 hover:text-white border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors cursor-pointer disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPaseDate(addDays(paseDate, 1))} disabled={paseDate >= today}
                className="p-1.5 text-gray-500 hover:text-white border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors cursor-pointer disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
              <span className="text-xs text-gray-500 capitalize">{isoToLabel(paseDate, { weekday: "long", day: "2-digit", month: "long" })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">
                {operadores.filter((o) => attMap.has(attId(o.id, paseDate))).length}/{operadores.length} marcados
              </span>
              <button onClick={() => marcarTodos(paseDate, "presente")} disabled={bulkSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600/80 hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                {bulkSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
                Todos presentes
              </button>
              <button onClick={() => marcarTodos(paseDate, "ausente")} disabled={bulkSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                <X size={12} /> Todos ausentes
              </button>
            </div>
          </div>

          {/* Search */}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empleado…"
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />

          {/* Employee rows */}
          <div className="space-y-2">
            {filteredOps.length === 0 && (
              <p className="text-center py-10 text-sm text-gray-600">{search ? "Sin resultados." : "Sin empleados activos."}</p>
            )}
            {filteredOps.map((op) => {
              const key    = attId(op.id, paseDate);
              const att    = attMap.get(key);
              const cfg    = eCfg(att?.estado);
              const isSav  = saving.has(key);
              return (
                <div key={op.id} className={`flex items-center gap-3 px-4 py-3 bg-[#242424] border rounded-xl transition-colors ${cfg ? `border-l-2 ${
                  att?.estado === "presente" ? "border-l-emerald-500 border-[#3A3A3A]" :
                  att?.estado === "ausente"  ? "border-l-red-500 border-[#3A3A3A]" :
                  "border-l-amber-500 border-[#3A3A3A]"
                }` : "border-[#3A3A3A]"}`}>

                  {/* Avatar + nombre */}
                  <div className="shrink-0 w-9 h-9 rounded-full bg-[#1A1A1A] border border-[#3A3A3A] flex items-center justify-center text-xs font-bold text-gray-400">
                    {op.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm leading-tight truncate">{op.nombre}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{op.puesto}</p>
                  </div>

                  {/* Estado actual badge */}
                  {cfg && (
                    <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.short} {cfg.label}
                    </span>
                  )}
                  {att?.horaEntrada && (
                    <span className="hidden md:flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock size={10} /> {att.horaEntrada}
                      {att.horaSalida && ` – ${att.horaSalida}`}
                    </span>
                  )}

                  {/* Quick buttons */}
                  {isSav ? (
                    <Loader2 size={16} className="animate-spin text-gray-500 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {ESTADOS.map((e) => {
                        const Icon = e.icon;
                        const active = att?.estado === e.value;
                        return (
                          <button key={e.value} title={e.label}
                            onClick={() => marcar(op, paseDate, e.value)}
                            className={`w-8 h-8 rounded-lg border text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                              active ? `${e.bg} ${e.color} ring-1 ${e.ring} border-transparent scale-110` : "border-[#3A3A3A] text-gray-600 hover:border-gray-500 hover:text-gray-300"
                            }`}>
                            <Icon size={13} />
                          </button>
                        );
                      })}
                      <button title="Horario y notas" onClick={() => openDetail(op, paseDate)}
                        className="w-8 h-8 ml-1 rounded-lg border border-[#3A3A3A] text-gray-600 hover:text-gray-300 hover:border-gray-500 flex items-center justify-center transition-colors cursor-pointer">
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 pt-1">
            {ESTADOS.map((e) => (
              <span key={e.value} className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold ${e.bg} ${e.color}`}>{e.short}</span>
                {e.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ VISTA SEMANA ═════════════════════════════════════════════════════ */}
      {view === "semana" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3A3A3A] flex items-center gap-2 text-xs text-gray-500">
            <span>Click en celda = cicla P→A. Click en <Pencil size={10} className="inline" /> = detalles.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-40">Empleado</th>
                  {days.map((d, i) => (
                    <th key={d} className={`px-1 py-3 text-center text-xs font-semibold uppercase tracking-wider ${d === today ? "text-[#CC2229]" : "text-gray-400"}`}>
                      <div>{DIAS[i]}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${d === today ? "text-[#CC2229]" : "text-gray-600"}`}>{isoToLabel(d)}</div>
                      {/* Column bulk btn */}
                      <button onClick={() => marcarTodos(d, "presente")} title="Todos presentes"
                        className="mt-1 mx-auto w-5 h-5 rounded flex items-center justify-center bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/25 transition-colors cursor-pointer">
                        <Check size={9} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {operadores.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-600">Sin empleados.</td></tr>
                )}
                {operadores.map((op) => (
                  <tr key={op.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-xs leading-tight">{op.nombre}</div>
                      <div className="text-gray-600 text-[10px] mt-0.5">{op.puesto}</div>
                    </td>
                    {days.map((fecha) => {
                      const key = attId(op.id, fecha);
                      const att = attMap.get(key);
                      const cfg = eCfg(att?.estado);
                      const isSav = saving.has(key);
                      return (
                        <td key={fecha} className="px-1 py-1.5 text-center">
                          <div className="relative group inline-flex flex-col items-center">
                            <button onClick={() => cycleEstado(op, fecha)} title={cfg?.label ?? "Sin registro — click para marcar"}
                              className={`w-10 h-10 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center mx-auto ${
                                isSav ? "border-[#3A3A3A] text-gray-600" :
                                cfg ? `${cfg.bg} ${cfg.color} border-transparent ring-1 ${cfg.ring}` :
                                fecha === today ? "border-[#CC2229]/30 text-gray-700 hover:bg-[#CC2229]/10" :
                                "border-[#3A3A3A] text-gray-700 hover:border-gray-500"
                              }`}>
                              {isSav ? <Loader2 size={11} className="animate-spin" /> : cfg ? cfg.short : "—"}
                            </button>
                            {/* Pencil overlay */}
                            <button onClick={() => openDetail(op, fecha)} title="Editar detalles"
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded bg-[#1A1A1A] border border-[#3A3A3A] text-gray-500 items-center justify-center hidden group-hover:flex hover:text-white transition-colors cursor-pointer z-10">
                              <Pencil size={8} />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Legend />
        </div>
      )}

      {/* ══ VISTA MES ════════════════════════════════════════════════════════ */}
      {view === "mes" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#3A3A3A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white capitalize">{monthLabel(anchor)}</h3>
            <span className="text-xs text-gray-500">{operadores.length} empleados</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-[#1A1A1A] z-20 min-w-32">Empleado</th>
                  {monthDays.map((d) => {
                    const dn = new Date(d + "T12:00:00").getDay();
                    const wk = dn === 0 || dn === 6;
                    return (
                      <th key={d} className={`px-0 py-2 text-center font-semibold min-w-[26px] bg-[#1A1A1A] ${d === today ? "text-[#CC2229]" : wk ? "text-gray-700" : "text-gray-400"}`}>
                        <div className="text-[9px]">{new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "narrow" })}</div>
                        <div className="text-[10px]">{new Date(d + "T12:00:00").getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-emerald-400 uppercase bg-[#1A1A1A]">P</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-red-400 uppercase bg-[#1A1A1A]">A</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase bg-[#1A1A1A]">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {operadores.map((op) => {
                  const mAtt = monthDays.map((d) => attMap.get(attId(op.id, d)));
                  const pre  = mAtt.filter((a) => a?.estado === "presente").length;
                  const aus  = mAtt.filter((a) => a?.estado === "ausente").length;
                  const rec  = mAtt.filter(Boolean).length;
                  const pct  = rec > 0 ? Math.round((pre / rec) * 100) : null;
                  return (
                    <tr key={op.id} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-[#242424] hover:bg-[#1A1A1A] z-10 transition-colors">
                        <div className="text-white font-medium text-[11px] whitespace-nowrap">{op.nombre.split(" ").slice(0,2).join(" ")}</div>
                        <div className="text-gray-600 text-[9px]">{op.puesto}</div>
                      </td>
                      {monthDays.map((fecha) => {
                        const key = attId(op.id, fecha);
                        const att = attMap.get(key);
                        const cfg = eCfg(att?.estado);
                        const dn  = new Date(fecha + "T12:00:00").getDay();
                        const wk  = dn === 0 || dn === 6;
                        const isSav = saving.has(key);
                        return (
                          <td key={fecha} className="py-1 px-0 text-center">
                            <button onClick={() => cycleEstado(op, fecha)} title={cfg?.label ?? (wk ? "Descanso" : "Sin registro")}
                              className={`w-6 h-6 rounded text-[9px] font-bold transition-all cursor-pointer mx-auto flex items-center justify-center border ${
                                isSav ? "border-[#3A3A3A] text-gray-700" :
                                cfg ? `${cfg.bg} ${cfg.color} border-transparent` :
                                fecha === today ? "border-[#CC2229]/30 text-gray-700" :
                                wk ? "border-transparent text-gray-700" :
                                "border-[#3A3A3A] text-gray-700 hover:border-gray-500"
                              }`}>
                              {isSav ? <Loader2 size={9} className="animate-spin" /> : cfg ? cfg.short : wk ? "·" : "—"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center text-emerald-400 font-semibold tabular-nums">{pre}</td>
                      <td className="px-3 py-2 text-center text-red-400 font-semibold tabular-nums">{aus}</td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {pct !== null ? <span className={`text-[10px] font-semibold ${pct >= 90 ? "text-emerald-400" : pct >= 75 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                          : <span className="text-gray-700 text-[10px]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Legend />
        </div>
      )}

      {/* ══ VISTA RESUMEN ════════════════════════════════════════════════════ */}
      {view === "resumen" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Resumen por empleado</h3>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{monthLabel(anchor)} · ordenado por % asistencia</p>
            </div>
            {resumen.filter((r) => r.ausente > 3).length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                <AlertTriangle size={12} /> {resumen.filter((r) => r.ausente > 3).length} empleado(s) con más de 3 faltas
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {["Empleado","Pres.","Aus.","Just.","Vac.","Perm.","Incap.","% Asistencia"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {resumen.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-600">Sin datos en el período.</td></tr>
                )}
                {resumen.map(({ op, presente, ausente, justificada, vacaciones, permiso, incapacidad, pct }) => {
                  const alert = ausente > 3;
                  return (
                    <tr key={op.id} className={`transition-colors ${alert ? "bg-amber-500/4 hover:bg-amber-500/8" : "hover:bg-[#1A1A1A]"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {alert && <AlertTriangle size={12} className="text-amber-400 shrink-0" />}
                          <div>
                            <div className="text-white font-medium text-xs">{op.nombre}</div>
                            <div className="text-gray-600 text-[10px]">{op.puesto}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums">{presente}</td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className={`font-semibold ${ausente > 3 ? "text-red-400" : ausente > 1 ? "text-amber-400" : "text-gray-400"}`}>{ausente}</span>
                      </td>
                      <td className="px-4 py-3 text-amber-400 tabular-nums">{justificada || <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-blue-400 tabular-nums">{vacaciones || <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-purple-400 tabular-nums">{permiso || <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3 text-orange-400 tabular-nums">{incapacidad || <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-3">
                        {pct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-[#3A3A3A] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${pct >= 90 ? "text-emerald-400" : pct >= 75 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                          </div>
                        ) : <span className="text-gray-600 text-xs">Sin registros</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODAL DETALLE ════════════════════════════════════════════════════ */}
      {detailKey && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Detalle de asistencia</p>
                <h3 className="text-gray-900 font-semibold text-sm">{detailKey.op.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{detailKey.op.puesto} · {isoToLabel(detailKey.fecha, { weekday: "long", day: "2-digit", month: "short" })}</p>
              </div>
              <button onClick={() => setDetailKey(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Estado */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Estado</p>
                <div className="grid grid-cols-3 gap-2">
                  {ESTADOS.map((e) => {
                    const Icon = e.icon;
                    const cur  = attMap.get(attId(detailKey.op.id, detailKey.fecha))?.estado;
                    const active = cur === e.value;
                    const isSav  = saving.has(attId(detailKey.op.id, detailKey.fecha));
                    return (
                      <button key={e.value} onClick={() => saveDetail(e.value)} disabled={isSav}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                          active ? `${e.bg} ${e.color} border-current scale-105` : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        } disabled:opacity-50`}>
                        {isSav && active ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Hora entrada</label>
                  <input type="time" value={dHoraE} onChange={(e) => setDHoraE(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Hora salida</label>
                  <input type="time" value={dHoraS} onChange={(e) => setDHoraS(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20" />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Notas</label>
                <textarea value={dNotas} onChange={(e) => setDNotas(e.target.value)} rows={2}
                  placeholder="Motivo de falta, observaciones…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 placeholder-gray-400" />
              </div>

              {/* Guardar notas/horario sin cambiar estado */}
              <button onClick={async () => {
                const cur = attMap.get(attId(detailKey.op.id, detailKey.fecha))?.estado ?? "presente";
                await marcar(detailKey.op, detailKey.fecha, cur, { horaEntrada: dHoraE, horaSalida: dHoraS, notas: dNotas });
                setDetailKey(null);
              }}
                className="w-full py-2.5 text-sm font-semibold text-white bg-[#CC2229] rounded-xl hover:bg-[#AA1A1F] transition-colors cursor-pointer">
                Guardar horario y notas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="px-5 py-3 border-t border-[#3A3A3A] flex flex-wrap items-center gap-4">
      {ESTADOS.map((e) => (
        <span key={e.value} className="flex items-center gap-1.5 text-[11px]">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${e.bg} ${e.color}`}>{e.short}</span>
          <span className="text-gray-500">{e.label}</span>
        </span>
      ))}
    </div>
  );
}
