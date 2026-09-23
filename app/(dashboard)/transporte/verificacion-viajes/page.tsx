"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Clock, Download,
  Loader2, RefreshCw, Route, Search, Truck, X,
} from "lucide-react";
import { where } from "firebase/firestore";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { detectCycles, fmtHHMM, minutesDiff, type TripCycle } from "@/lib/gps-cycles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChoferEntry {
  id: string; chofer: string; cr: string;
  horaSalida: string; horaLlegadaObra: string;
  horaInicioDescarga: string; horaFinalDescarga: string; horaSalidaObra: string;
  m3: number | null;
}

interface Programacion {
  id?: string;
  dia: string;
  cliente: string;
  nombreObra?: string;
  direccion: string;
  choferes: ChoferEntry[];
}

type Delta = { scheduled: string; actual?: string; deltaMin?: number };

type ChoferResult = {
  choferName: string;
  cr: string;
  m3: number | null;
  salida:    Delta;
  llegada:   Delta;
  salidaObra: Delta;
  cycle?: TripCycle;
  status: "ok" | "leve" | "tardanza" | "sin_gps" | "sin_prog";
  error?: string;
};

type ProgResult = {
  progId: string;
  cliente: string;
  obra: string;
  direccion: string;
  choferes: ChoferResult[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function scheduledToISO(dia: string, hhmm: string): string | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  return `${dia}T${hhmm}:00`;
}

function deltaCls(min?: number): string {
  if (min == null) return "text-slate-400";
  if (min <= 0)    return "text-emerald-600";
  if (min <= 15)   return "text-emerald-600";
  if (min <= 30)   return "text-amber-600";
  return "text-red-600";
}

function deltaLabel(min?: number): string {
  if (min == null) return "—";
  if (min === 0)   return "A tiempo";
  const abs = Math.abs(min);
  const sign = min < 0 ? "-" : "+";
  return `${sign}${abs} min`;
}

function statusFromDeltas(choferes: ChoferResult[]): ChoferResult["status"] {
  if (choferes.every((c) => c.status === "sin_gps")) return "sin_gps";
  const maxDelta = Math.max(...choferes.flatMap((c) =>
    [c.salida.deltaMin, c.llegada.deltaMin, c.salidaObra.deltaMin]
      .filter((d): d is number => d != null)
  ));
  if (maxDelta > 30) return "tardanza";
  if (maxDelta > 15) return "leve";
  return "ok";
}

const STATUS_ICON = {
  ok:       <CheckCircle2 size={14} className="text-emerald-500" />,
  leve:     <AlertTriangle size={14} className="text-amber-500" />,
  tardanza: <AlertCircle size={14} className="text-red-500" />,
  sin_gps:  <Clock size={14} className="text-slate-400" />,
  sin_prog: <Clock size={14} className="text-slate-400" />,
};
const STATUS_LABEL = { ok: "A tiempo", leve: "Leve retraso", tardanza: "Tardanza", sin_gps: "Sin GPS hoy", sin_prog: "Sin programación" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerificacionViajesPage() {
  const [date,    setDate]    = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProgResult[] | null>(null);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  const run = useCallback(async () => {
    setLoading(true); setError(""); setResults(null);
    try {
      // 1. Load programaciones for selected date
      const progs = await getCollectionDocs<Programacion>(COLLECTIONS.programaciones, [
        where("dia", "==", date),
      ]);

      if (progs.length === 0) {
        setResults([]);
        return;
      }

      // 2. Collect unique CR names
      const crNames = [...new Set(progs.flatMap((p) => p.choferes?.map((c) => c.cr).filter(Boolean) ?? []))];

      // 3. Fetch Samsara vehicle list to get IDs by name
      const vRes  = await fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles");
      const vData = vRes.ok ? await vRes.json() : { data: [] };
      type SamsVeh = { id: string; name: string };
      const vByName = new Map<string, SamsVeh>((vData.data as SamsVeh[] ?? []).map((v: SamsVeh) => [v.name.trim().toLowerCase(), v]));

      // 4. Fetch GPS history for each relevant vehicle in parallel
      const dayStart = new Date(`${date}T00:00:00`).toISOString();
      const dayEnd   = new Date(`${date}T23:59:59`).toISOString();
      const ep       = encodeURIComponent("/fleet/vehicles/stats/history");

      type GpsPoint  = { latitude: number; longitude: number; time: string; speedMilesPerHour?: number; reverseGeo?: { formattedLocation?: string } };
      type VehGps    = { id: string; gps?: GpsPoint[] };

      const gpsMap = new Map<string, TripCycle[]>();

      await Promise.allSettled(
        crNames.map(async (cr) => {
          const veh = vByName.get(cr.trim().toLowerCase());
          if (!veh) return;
          const res  = await fetch(`/api/samsara?endpoint=${ep}&types=gps&vehicleIds=${veh.id}&startTime=${encodeURIComponent(dayStart)}&endTime=${encodeURIComponent(dayEnd)}&limit=500`);
          const json = res.ok ? await res.json() : {};
          const vData2 = (json.data as VehGps[] ?? []).find((d) => d.id === veh.id);
          const pts = (vData2?.gps ?? [])
            .map((p) => ({ lat: p.latitude, lng: p.longitude, time: p.time, address: p.reverseGeo?.formattedLocation, speedMph: p.speedMilesPerHour ?? 0 }))
            .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
          gpsMap.set(cr.trim().toLowerCase(), detectCycles(pts));
        })
      );

      // 5. Cross-reference
      const out: ProgResult[] = progs.map((p) => {
        const choferes: ChoferResult[] = (p.choferes ?? []).map((c, idx) => {
          const key    = c.cr?.trim().toLowerCase() ?? "";
          const cycles = gpsMap.get(key);
          const cycle  = cycles?.[idx] ?? cycles?.[0];

          if (!cycles) {
            return {
              choferName: c.chofer, cr: c.cr, m3: c.m3,
              salida:     { scheduled: c.horaSalida },
              llegada:    { scheduled: c.horaLlegadaObra },
              salidaObra: { scheduled: c.horaSalidaObra },
              status: "sin_gps" as const,
            };
          }

          const calcDelta = (scheduled: string, actual?: string): Delta => {
            const sISO = scheduledToISO(date, scheduled);
            if (!actual || !sISO) return { scheduled };
            const dm = minutesDiff(sISO, actual);
            return { scheduled, actual, deltaMin: dm };
          };

          const salida    = calcDelta(c.horaSalida,    cycle?.departureTime);
          const llegada   = calcDelta(c.horaLlegadaObra, cycle?.obraArrival);
          const salidaObra = calcDelta(c.horaSalidaObra,  cycle?.obraDeparture);

          const deltas = [salida.deltaMin, llegada.deltaMin, salidaObra.deltaMin].filter((d): d is number => d != null);
          const maxD   = deltas.length ? Math.max(...deltas) : 0;
          const status: ChoferResult["status"] = maxD > 30 ? "tardanza" : maxD > 15 ? "leve" : "ok";

          return { choferName: c.chofer, cr: c.cr, m3: c.m3, salida, llegada, salidaObra, cycle, status };
        });

        return {
          progId:    p.id ?? "",
          cliente:   p.cliente,
          obra:      p.nombreObra ?? "—",
          direccion: p.direccion,
          choferes,
        };
      });

      setResults(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [date]);

  const filtered = (results ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.cliente.toLowerCase().includes(q) || r.obra.toLowerCase().includes(q)
      || r.choferes.some((c) => c.cr.toLowerCase().includes(q) || c.choferName.toLowerCase().includes(q));
  });

  const allChoferes = filtered.flatMap((r) => r.choferes);
  const countOk      = allChoferes.filter((c) => c.status === "ok").length;
  const countLeve    = allChoferes.filter((c) => c.status === "leve").length;
  const countTardanza = allChoferes.filter((c) => c.status === "tardanza").length;
  const countSinGps  = allChoferes.filter((c) => c.status === "sin_gps").length;

  const exportCsv = () => {
    if (!results) return;
    const headers = ["Cliente","Obra","Dirección","Conductor","CR","m³","Salida prog","Salida real","Δ salida","Llegada obra prog","Llegada obra real","Δ llegada","Salida obra prog","Salida obra real","Δ salida obra","Estado"];
    const rows = results.flatMap((r) => r.choferes.map((c) => [
      r.cliente, r.obra, r.direccion, c.choferName, c.cr, c.m3 ?? "",
      c.salida.scheduled, c.salida.actual ? fmtHHMM(c.salida.actual) : "", c.salida.deltaMin != null ? c.salida.deltaMin : "",
      c.llegada.scheduled, c.llegada.actual ? fmtHHMM(c.llegada.actual) : "", c.llegada.deltaMin != null ? c.llegada.deltaMin : "",
      c.salidaObra.scheduled, c.salidaObra.actual ? fmtHHMM(c.salidaObra.actual) : "", c.salidaObra.deltaMin != null ? c.salidaObra.deltaMin : "",
      STATUS_LABEL[c.status],
    ]));
    const csv  = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `verificacion_${date}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-[#CC2229]/10 flex items-center justify-center">
            <Route size={16} className="text-[#CC2229]" />
          </div>
          <h1 className="text-slate-900 font-bold text-xl">Verificación de viajes</h1>
        </div>
        <p className="text-slate-500 text-sm ml-11">Compara tiempos programados vs GPS real por unidad y conductor</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Fecha</label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/20 focus:border-[#CC2229]/40"
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#CC2229] text-white text-sm font-semibold hover:bg-[#b01e24] cursor-pointer disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading ? "Analizando…" : "Cargar"}
        </button>

        {results && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, CR, conductor…"
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/20 w-56"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"><X size={11} /></button>}
            </div>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              <Download size={12} />CSV
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* KPI Summary */}
      {results && allChoferes.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ["text-emerald-600", String(countOk),       "A tiempo",     "bg-emerald-50 border-emerald-100"],
            ["text-amber-600",   String(countLeve),      "Leve retraso", "bg-amber-50 border-amber-100"],
            ["text-red-600",     String(countTardanza),  "Tardanza",     "bg-red-50 border-red-100"],
            ["text-slate-400",   String(countSinGps),    "Sin GPS",      "bg-slate-50 border-slate-100"],
          ].map(([cls, val, lbl, bg]) => (
            <div key={lbl} className={`rounded-2xl p-4 border text-center ${bg}`}>
              <p className={`text-3xl font-bold tabular-nums ${cls}`}>{val}</p>
              <p className="text-slate-400 text-xs mt-1">{lbl}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {results === null && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Route size={40} className="mb-4 opacity-30" />
          <p className="text-sm font-medium">Selecciona una fecha y presiona Cargar</p>
        </div>
      )}

      {results?.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          Sin programaciones para {date}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {filtered.map((prog) => (
            <div key={prog.progId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Prog header */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{prog.cliente}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{prog.obra !== "—" && <><span className="font-medium">{prog.obra}</span> · </>}{prog.direccion}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  statusFromDeltas(prog.choferes) === "ok"       ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  statusFromDeltas(prog.choferes) === "leve"     ? "bg-amber-100 text-amber-700 border-amber-200" :
                  statusFromDeltas(prog.choferes) === "tardanza" ? "bg-red-100 text-red-700 border-red-200" :
                                                                   "bg-slate-100 text-slate-500 border-slate-200"
                }`}>
                  {STATUS_ICON[statusFromDeltas(prog.choferes)]}
                  {STATUS_LABEL[statusFromDeltas(prog.choferes)]}
                </span>
              </div>

              {/* Choferes table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Conductor / CR</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Salida planta</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Llegada obra</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Salida obra</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">m³</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prog.choferes.map((c, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 text-sm">{c.cr || "—"}</p>
                          <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><Truck size={9} />{c.choferName || "—"}</p>
                        </td>
                        {/* Salida */}
                        <DeltaCell d={c.salida} />
                        {/* Llegada obra */}
                        <DeltaCell d={c.llegada} />
                        {/* Salida obra */}
                        <DeltaCell d={c.salidaObra} />
                        <td className="px-4 py-3 text-slate-700 text-sm font-semibold tabular-nums">
                          {c.m3 != null ? c.m3 : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${
                            c.status === "ok"       ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            c.status === "leve"     ? "bg-amber-100 text-amber-700 border-amber-200" :
                            c.status === "tardanza" ? "bg-red-100 text-red-700 border-red-200" :
                                                      "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            {STATUS_ICON[c.status]}{STATUS_LABEL[c.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeltaCell({ d }: { d: Delta }) {
  return (
    <td className="px-4 py-3">
      <p className="text-slate-700 text-xs font-medium tabular-nums">{d.scheduled || "—"}</p>
      {d.actual && (
        <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">Real: {fmtHHMM(d.actual)}</p>
      )}
      {d.deltaMin != null && (
        <p className={`text-[10px] font-bold tabular-nums mt-0.5 ${deltaCls(d.deltaMin)}`}>
          {deltaLabel(d.deltaMin)}
        </p>
      )}
    </td>
  );
}
