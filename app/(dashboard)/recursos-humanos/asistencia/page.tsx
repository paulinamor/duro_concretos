"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Clock,
  Download, Loader2, Moon, ShieldOff, Stethoscope, Umbrella,
  UserCheck, UserMinus, Users, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta } from "@/lib/auth";
import type { Operador } from "@/lib/operadores";

// ─── Types ────────────────────────────────────────────────────────────────────

type EstadoAsistencia =
  | "presente"
  | "ausente"
  | "justificada"
  | "vacaciones"
  | "permiso"
  | "incapacidad";

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

// ─── Config ───────────────────────────────────────────────────────────────────

const ESTADOS: {
  value: EstadoAsistencia;
  label: string;
  short: string;
  color: string;
  bg: string;
  icon: React.ElementType;
}[] = [
  { value: "presente",    label: "Presente",     short: "P",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: Check        },
  { value: "ausente",     label: "Ausente",      short: "A",  color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",         icon: X            },
  { value: "justificada", label: "Just. falta",  short: "JF", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",     icon: ShieldOff    },
  { value: "vacaciones",  label: "Vacaciones",   short: "V",  color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",       icon: Umbrella     },
  { value: "permiso",     label: "Permiso",      short: "PE", color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30",   icon: Moon         },
  { value: "incapacidad", label: "IMSS/Incap.",  short: "I",  color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",   icon: Stethoscope  },
];

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

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

function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

function isoToLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function monthLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function monthRange(iso: string): [string, string] {
  const d = new Date(iso + "T12:00:00");
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return [toISO(start), toISO(end)];
}

function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

function asistenciaId(empleadoId: string, fecha: string) {
  return `${empleadoId}_${fecha}`;
}

function getEstado(cfg: typeof ESTADOS[number]) { return cfg; }

function estadoCfg(estado?: EstadoAsistencia) {
  return ESTADOS.find((e) => e.value === estado);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AsistenciaPage() {
  const today = toISO(new Date());

  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [view, setView] = useState<"semana" | "mes">("semana");
  const [anchorDay, setAnchorDay] = useState(today);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Operador | null>(null);
  const [detailDay, setDetailDay] = useState<string>(today);
  const [horaEntrada, setHoraEntrada] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
      getCollectionDocs<Asistencia>(COLLECTIONS.asistencias),
    ]).then(([ops, att]) => {
      const activos = filterByPlanta(ops.filter((o) => !o.baja));
      setOperadores(activos);
      setAsistencias(att);
    }).finally(() => setLoading(false));
  }, []);

  // ── Lookup map ────────────────────────────────────────────────────────────
  const attMap = useMemo(() => {
    const m = new Map<string, Asistencia>();
    asistencias.forEach((a) => m.set(asistenciaId(a.empleadoId, a.fecha), a));
    return m;
  }, [asistencias]);

  // ── Week / month context ──────────────────────────────────────────────────
  const wStart = useMemo(() => weekStart(anchorDay), [anchorDay]);
  const days   = useMemo(() => weekDays(wStart), [wStart]);
  const [mStart, mEnd] = useMemo(() => monthRange(anchorDay), [anchorDay]);

  const monthDays = useMemo(() => {
    const result: string[] = [];
    let cur = mStart;
    while (cur <= mEnd) { result.push(cur); cur = addDays(cur, 1); }
    return result;
  }, [mStart, mEnd]);

  // ── KPIs (current month) ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const monthAtt = asistencias.filter((a) => a.fecha >= mStart && a.fecha <= mEnd);
    const hoy = asistencias.filter((a) => a.fecha === today);
    const presentesHoy  = hoy.filter((a) => a.estado === "presente").length;
    const ausentesHoy   = operadores.length - presentesHoy;
    const totalPresente = monthAtt.filter((a) => a.estado === "presente").length;
    const totalFaltas   = monthAtt.filter((a) => a.estado === "ausente").length;
    const totalRegistros = monthAtt.length;
    const puntualidad = totalRegistros > 0
      ? Math.round((totalPresente / totalRegistros) * 100) : 0;
    return { presentesHoy, ausentesHoy, totalPresente, totalFaltas, puntualidad };
  }, [asistencias, mStart, mEnd, today, operadores.length]);

  // ── Save attendance ───────────────────────────────────────────────────────
  async function marcar(empleado: Operador, fecha: string, estado: EstadoAsistencia, extra?: { horaEntrada?: string; horaSalida?: string; notas?: string }) {
    const id = asistenciaId(empleado.id, fecha);
    setSaving(id);
    const doc: Asistencia = {
      empleadoId: empleado.id,
      nombre: empleado.nombre,
      puesto: empleado.puesto,
      fecha,
      estado,
      ...(extra?.horaEntrada ? { horaEntrada: extra.horaEntrada } : {}),
      ...(extra?.horaSalida  ? { horaSalida:  extra.horaSalida  } : {}),
      ...(extra?.notas       ? { notas:       extra.notas       } : {}),
    };
    try {
      await upsertDocument(COLLECTIONS.asistencias, id, doc);
      setAsistencias((prev) => {
        const filtered = prev.filter((a) => asistenciaId(a.empleadoId, a.fecha) !== id);
        return [...filtered, { ...doc, id }];
      });
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al guardar asistencia." } }));
    } finally {
      setSaving(null);
    }
  }

  // ── Detail panel save ─────────────────────────────────────────────────────
  async function saveDetail(estado: EstadoAsistencia) {
    if (!selectedEmpleado) return;
    await marcar(selectedEmpleado, detailDay, estado, { horaEntrada, horaSalida, notas });
    setSelectedEmpleado(null);
    setHoraEntrada(""); setHoraSalida(""); setNotas("");
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  function exportXLSX() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const rows = operadores.flatMap((op) =>
      monthDays.map((fecha) => {
        const a = attMap.get(asistenciaId(op.id, fecha));
        return {
          Empleado: op.nombre,
          Puesto: op.puesto,
          Fecha: fecha,
          Estado: estadoCfg(a?.estado)?.label ?? "Sin registro",
          Entrada: a?.horaEntrada ?? "",
          Salida: a?.horaSalida ?? "",
          Notas: a?.notas ?? "",
        };
      })
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `asistencia-${anchorDay.slice(0, 7)}.xlsx`);
  }

  // ── Nav helpers ───────────────────────────────────────────────────────────
  function prevPeriod() {
    if (view === "semana") setAnchorDay((d) => addDays(d, -7));
    else setAnchorDay((d) => addMonths(d, -1));
  }
  function nextPeriod() {
    if (view === "semana") setAnchorDay((d) => addDays(d, 7));
    else setAnchorDay((d) => addMonths(d, 1));
  }

  const periodLabel = view === "semana"
    ? `${isoToLabel(days[0])} – ${isoToLabel(days[6])}`
    : monthLabel(anchorDay);

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
        <p className="text-sm text-gray-500">Control de asistencia por empleado</p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportXLSX}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors"
          >
            <Download size={13} /> Exportar mes
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard title="Empleados activos"  value={String(operadores.length)}    icon={Users}      iconColor="text-blue-400" />
        <KPICard title="Presentes hoy"      value={String(kpis.presentesHoy)}    icon={UserCheck}  iconColor="text-emerald-400" />
        <KPICard title="Ausentes hoy"       value={String(kpis.ausentesHoy)}     icon={UserMinus}  iconColor="text-red-400" />
        <KPICard title="Faltas en el mes"   value={String(kpis.totalFaltas)}     icon={CalendarDays} iconColor="text-orange-400" />
        <KPICard title="Puntualidad mes"    value={`${kpis.puntualidad}%`}       icon={Clock}      iconColor="text-[#CC2229]" />
      </div>

      {/* View controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          {(["semana", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${view === v ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
            >
              {v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm text-white font-medium px-1 capitalize min-w-40 text-center">{periodLabel}</span>
          <button onClick={nextPeriod} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => setAnchorDay(today)} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-xs text-gray-400 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer">
            Hoy
          </button>
        </div>
      </div>

      {/* ── VISTA SEMANA ─────────────────────────────────────────────────── */}
      {view === "semana" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-44">Empleado</th>
                  {days.map((d, i) => (
                    <th key={d} className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider ${d === today ? "text-[#CC2229]" : "text-gray-400"}`}>
                      <div>{DIAS_SEMANA[i]}</div>
                      <div className={`text-[10px] font-normal mt-0.5 ${d === today ? "text-[#CC2229]" : "text-gray-600"}`}>{isoToLabel(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {operadores.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-600">Sin empleados activos registrados.</td></tr>
                )}
                {operadores.map((op) => (
                  <tr key={op.id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-xs leading-tight">{op.nombre}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5">{op.puesto}</div>
                    </td>
                    {days.map((fecha) => {
                      const key = asistenciaId(op.id, fecha);
                      const att = attMap.get(key);
                      const cfg = att ? estadoCfg(att.estado) : undefined;
                      const isSaving = saving === key;
                      return (
                        <td key={fecha} className="px-1 py-2 text-center">
                          <button
                            onClick={() => {
                              setSelectedEmpleado(op);
                              setDetailDay(fecha);
                              setHoraEntrada(att?.horaEntrada ?? "");
                              setHoraSalida(att?.horaSalida ?? "");
                              setNotas(att?.notas ?? "");
                            }}
                            className={`w-10 h-10 rounded-lg border text-xs font-bold transition-all cursor-pointer hover:scale-105 mx-auto flex items-center justify-center ${
                              isSaving ? "border-[#3A3A3A] bg-[#1A1A1A] text-gray-600" :
                              cfg ? `${cfg.bg} ${cfg.color} border` :
                              fecha === today ? "border-[#CC2229]/30 bg-[#CC2229]/5 text-gray-600 hover:border-[#CC2229]/60" :
                              "border-[#3A3A3A] bg-[#1A1A1A] text-gray-600 hover:border-gray-500"
                            }`}
                            title={cfg ? `${cfg.label}${att?.horaEntrada ? ` · ${att.horaEntrada}` : ""}` : "Sin registro"}
                          >
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : cfg ? cfg.short : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Leyenda */}
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex flex-wrap items-center gap-4">
            {ESTADOS.map((e) => (
              <span key={e.value} className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${e.bg} ${e.color}`}>{e.short}</span>
                <span className="text-gray-500">{e.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── VISTA MES ────────────────────────────────────────────────────── */}
      {view === "mes" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white capitalize">{monthLabel(anchorDay)}</h3>
            <span className="text-xs text-gray-500">{operadores.length} empleados</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-[#1A1A1A] z-10 min-w-36">Empleado</th>
                  {monthDays.map((d) => {
                    const dn = new Date(d + "T12:00:00").getDay();
                    const isWeekend = dn === 0 || dn === 6;
                    return (
                      <th key={d} className={`px-0.5 py-2.5 text-center font-semibold uppercase tracking-wider min-w-[28px] ${d === today ? "text-[#CC2229]" : isWeekend ? "text-gray-600" : "text-gray-400"}`}>
                        <div className="text-[9px]">{new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "narrow" })}</div>
                        <div className="text-[10px]">{new Date(d + "T12:00:00").getDate()}</div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">P</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">A</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {operadores.map((op) => {
                  const monthAtt = monthDays.map((d) => attMap.get(asistenciaId(op.id, d)));
                  const presentes = monthAtt.filter((a) => a?.estado === "presente").length;
                  const ausentes  = monthAtt.filter((a) => a?.estado === "ausente").length;
                  const recorded  = monthAtt.filter(Boolean).length;
                  const pct = recorded > 0 ? Math.round((presentes / recorded) * 100) : null;
                  return (
                    <tr key={op.id} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-[#242424] hover:bg-[#1A1A1A] transition-colors z-10">
                        <div className="text-white font-medium text-[11px] leading-tight whitespace-nowrap">{op.nombre.split(" ").slice(0, 2).join(" ")}</div>
                        <div className="text-gray-600 text-[9px]">{op.puesto}</div>
                      </td>
                      {monthDays.map((fecha) => {
                        const key = asistenciaId(op.id, fecha);
                        const att = attMap.get(key);
                        const cfg = att ? estadoCfg(att.estado) : undefined;
                        const dn = new Date(fecha + "T12:00:00").getDay();
                        const isWeekend = dn === 0 || dn === 6;
                        return (
                          <td key={fecha} className="py-1 px-0.5 text-center">
                            <button
                              onClick={() => {
                                setSelectedEmpleado(op);
                                setDetailDay(fecha);
                                setHoraEntrada(att?.horaEntrada ?? "");
                                setHoraSalida(att?.horaSalida ?? "");
                                setNotas(att?.notas ?? "");
                              }}
                              className={`w-6 h-6 rounded text-[9px] font-bold transition-all cursor-pointer hover:scale-110 mx-auto flex items-center justify-center border ${
                                cfg ? `${cfg.bg} ${cfg.color}` :
                                fecha === today ? "border-[#CC2229]/30 bg-transparent text-gray-700" :
                                isWeekend ? "border-transparent bg-transparent text-gray-700" :
                                "border-[#3A3A3A] bg-transparent text-gray-700 hover:border-gray-500"
                              }`}
                              title={cfg?.label ?? (isWeekend ? "Descanso" : "Sin registro")}
                            >
                              {cfg ? cfg.short : isWeekend ? "·" : "—"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-center text-emerald-400 font-semibold tabular-nums">{presentes}</td>
                      <td className="px-4 py-2 text-center text-red-400 font-semibold tabular-nums">{ausentes}</td>
                      <td className="px-4 py-2 text-center tabular-nums">
                        {pct !== null ? (
                          <span className={`text-[10px] font-semibold ${pct >= 90 ? "text-emerald-400" : pct >= 75 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                        ) : (
                          <span className="text-gray-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex flex-wrap items-center gap-4">
            {ESTADOS.map((e) => (
              <span key={e.value} className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border ${e.bg} ${e.color}`}>{e.short}</span>
                <span className="text-gray-500">{e.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── PANEL DETALLE / EDICIÓN ─────────────────────────────────────── */}
      {selectedEmpleado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Registrar asistencia</p>
                <h3 className="text-gray-900 font-semibold text-sm leading-tight">{selectedEmpleado.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedEmpleado.puesto} · {isoToLabel(detailDay)}</p>
              </div>
              <button onClick={() => setSelectedEmpleado(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Estado buttons */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Estado</p>
                <div className="grid grid-cols-3 gap-2">
                  {ESTADOS.map((e) => {
                    const Icon = e.icon;
                    const cur = attMap.get(asistenciaId(selectedEmpleado.id, detailDay))?.estado;
                    const active = cur === e.value;
                    return (
                      <button
                        key={e.value}
                        onClick={() => saveDetail(e.value)}
                        disabled={saving === asistenciaId(selectedEmpleado.id, detailDay)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                          active ? `${e.bg} ${e.color} border-current scale-105` : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        }`}
                      >
                        <Icon size={14} />
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
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={(e) => setHoraEntrada(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Hora salida</label>
                  <input
                    type="time"
                    value={horaSalida}
                    onChange={(e) => setHoraSalida(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Notas (opcional)</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Motivo de falta, observaciones…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="px-6 pb-5">
              <button
                onClick={() => setSelectedEmpleado(null)}
                className="w-full py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
