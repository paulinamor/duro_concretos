"use client";

/**
 * BETA — Vista en tiempo real de programación con Samsara GPS.
 * Solo lectura. No modifica ningún dato de producción.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Clock, FlaskConical,
  Loader2, MapPin, RefreshCw, Satellite, Truck,
} from "lucide-react";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { todayCST } from "@/lib/dateUtils";
import { filterByPlanta } from "@/lib/auth";
import KPICard from "@/components/KPICard";

// ─── Types (solo lo necesario de producción) ──────────────────────────────────

interface ChoferEntry {
  id: string;
  chofer: string;
  cr: string;          // nombre del vehículo — se usa para buscar en Samsara
  horaSalida: string;
  horaLlegadaObra: string;
  horaInicioDescarga: string;
  horaFinalDescarga: string;
  horaSalidaObra: string;
  m3: number | null;
}

interface Programacion {
  id: string;
  dia: string;
  cliente: string;
  direccion: string;
  hora: string;
  resistencia: string;
  m3Totales: number | null;
  choferes: ChoferEntry[];
  fase?: string;
  planta?: string;
}

// ─── Samsara live data ────────────────────────────────────────────────────────

interface SamsaraVehicle {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speedMph: number;
  address: string;
  engineState: "On" | "Off" | "Idle";
  updatedAt: string;
}

const ENGINE_LABEL: Record<string, string> = { On: "En ruta", Idle: "Ralentí", Off: "Apagado" };
const ENGINE_COLOR: Record<string, string> = {
  On:   "text-emerald-600 bg-emerald-50 border-emerald-200",
  Idle: "text-amber-600 bg-amber-50 border-amber-200",
  Off:  "text-slate-500 bg-slate-50 border-slate-200",
};
const ENGINE_DOT: Record<string, string> = { On: "bg-emerald-500", Idle: "bg-amber-500", Off: "bg-slate-400" };

const REFRESH = 15_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string) { return s.trim().toLowerCase(); }

function fmtTime(t: string) { return t || "—"; }

function fmtSpeed(mph: number) { return `${(mph * 1.60934).toFixed(0)} km/h`; }

// ─── Vehicle row within a trip card ──────────────────────────────────────────

function VehicleRow({
  entry,
  live,
}: {
  entry: ChoferEntry;
  live: SamsaraVehicle | undefined;
}) {
  const state = live?.engineState ?? null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200">
            <Truck size={13} className="text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{entry.cr || "Sin unidad"}</p>
            {entry.chofer && <p className="text-[11px] text-slate-400 truncate">{entry.chofer}</p>}
          </div>
        </div>

        {state ? (
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${ENGINE_COLOR[state]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ENGINE_DOT[state]}`} />
            {ENGINE_LABEL[state]}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full border border-slate-200 text-slate-400 bg-slate-50 shrink-0">
            Sin GPS
          </span>
        )}
      </div>

      {/* Live GPS data */}
      {live && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Activity size={10} /> {fmtSpeed(live.speedMph)}
          </span>
          {live.address && (
            <span className="flex items-center gap-1 truncate max-w-xs">
              <MapPin size={10} /> {live.address}
            </span>
          )}
          <span className="text-slate-300">
            GPS {new Date(live.updatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {/* Time comparison: ERP vs GPS */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] border-t border-slate-100 pt-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 col-span-2 mb-1">
          Tiempos registrados en ERP
        </span>
        {[
          ["Salida",           entry.horaSalida],
          ["Llegada a obra",   entry.horaLlegadaObra],
          ["Inicio descarga",  entry.horaInicioDescarga],
          ["Fin descarga",     entry.horaFinalDescarga],
          ["Salida de obra",   entry.horaSalidaObra],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center justify-between gap-1 col-span-1">
            <span className="text-slate-400">{label}</span>
            <span className={`font-semibold tabular-nums ${val ? "text-slate-700" : "text-slate-300"}`}>
              {fmtTime(val)}
            </span>
          </div>
        ))}
        {entry.m3 != null && (
          <div className="flex items-center justify-between gap-1 col-span-1">
            <span className="text-slate-400">m³</span>
            <span className="font-semibold text-slate-700">{entry.m3}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────

function TripCard({ prog, liveMap }: { prog: Programacion; liveMap: Map<string, SamsaraVehicle> }) {
  const hasGps = prog.choferes.some((c) => c.cr && liveMap.has(normalize(c.cr)));
  const onRoute = prog.choferes.some((c) => liveMap.get(normalize(c.cr))?.engineState === "On");

  return (
    <div className={`rounded-2xl border bg-white p-4 space-y-3 ${onRoute ? "border-emerald-200 shadow-sm shadow-emerald-50" : "border-slate-200"}`}>
      {/* Trip header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900 truncate">{prog.cliente}</p>
            {prog.fase && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                {prog.fase}
              </span>
            )}
          </div>
          {prog.direccion && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
              <MapPin size={10} /> {prog.direccion}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900 tabular-nums">{prog.hora || "—"}</p>
          {prog.m3Totales != null && (
            <p className="text-[11px] text-slate-400">{prog.m3Totales} m³</p>
          )}
          {prog.resistencia && (
            <p className="text-[11px] text-slate-400">{prog.resistencia}</p>
          )}
        </div>
      </div>

      {/* GPS hint */}
      {!hasGps && prog.choferes.length > 0 && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <Satellite size={11} /> Vehículos no encontrados en Samsara — verifica que el nombre del CR coincida
        </p>
      )}

      {/* Vehicles */}
      <div className="space-y-2">
        {prog.choferes
          .filter((c) => c.cr || c.chofer)
          .map((entry) => (
            <VehicleRow
              key={entry.id}
              entry={entry}
              live={entry.cr ? liveMap.get(normalize(entry.cr)) : undefined}
            />
          ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramacionLivePage() {
  const [date, setDate]           = useState(todayCST());
  const [progs, setProgs]         = useState<Programacion[]>([]);
  const [loadingProgs, setLoadingProgs] = useState(true);
  const [liveVehicles, setLive]   = useState<SamsaraVehicle[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError]         = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load programaciones for selected date ────────────────────────────────

  useEffect(() => {
    setLoadingProgs(true);
    getCollectionDocs(COLLECTIONS.programaciones).then((all) => {
      const filtered = filterByPlanta(
        (all as Programacion[]).filter((p) => {
          const d = p.dia?.includes("/")
            ? p.dia.split("/").reverse().join("-")
            : p.dia;
          return d === date;
        })
      );
      setProgs(filtered);
      setLoadingProgs(false);
    }).catch(() => setLoadingProgs(false));
  }, [date]);

  // ── Live Samsara polling ─────────────────────────────────────────────────

  const fetchLive = useCallback(async () => {
    setError("");
    try {
      const [vRes, lRes, sRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Flocations"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=engineStates"),
      ]);
      if (!lRes.ok) throw new Error("Error Samsara");
      const [vData, lData, sData] = await Promise.all([vRes.json(), lRes.json(), sRes.json()]);

      const vMap = new Map<string, { name: string }>();
      (vData.data ?? []).forEach((v: { id: string; name: string }) => vMap.set(v.id, v));
      const sMap = new Map<string, "On" | "Off" | "Idle">();
      (sData.data ?? []).forEach((v: { id: string; engineStates?: { value: "On" | "Off" | "Idle" }[] }) => {
        if (v.engineStates?.[0]?.value) sMap.set(v.id, v.engineStates[0].value);
      });

      const parsed: SamsaraVehicle[] = (lData.data ?? [])
        .filter((v: { location?: { latitude?: number; longitude?: number } }) => v.location?.latitude)
        .map((v: {
          id: string;
          name: string;
          location: {
            latitude: number; longitude: number;
            speedMilesPerHour?: number; headingDegrees?: number; time?: string;
            reverseGeo?: { formattedLocation?: string };
          };
        }) => {
          const speedMph = v.location.speedMilesPerHour ?? 0;
          const obdState = sMap.get(v.id);
          return {
            id: v.id,
            name: v.name,
            lat: v.location.latitude,
            lng: v.location.longitude,
            speedMph,
            address: v.location.reverseGeo?.formattedLocation ?? "",
            engineState: obdState ?? (speedMph > 0 ? "On" : "Off"),
            updatedAt: v.location.time ?? new Date().toISOString(),
          };
        });

      setLive(parsed);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setLoadingLive(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    timerRef.current = setInterval(fetchLive, REFRESH);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchLive]);

  // ── Derived data ─────────────────────────────────────────────────────────

  // Map normalized vehicle name → live data
  const liveMap = new Map(liveVehicles.map((v) => [normalize(v.name), v]));

  // All CRs referenced in today's programaciones
  const progCRs = new Set(
    progs.flatMap((p) => p.choferes.map((c) => normalize(c.cr)).filter(Boolean))
  );

  // Count vehicles in different states among those assigned to trips
  const tripVehicles = liveVehicles.filter((v) => progCRs.has(normalize(v.name)));
  const enRuta  = tripVehicles.filter((v) => v.engineState === "On").length;
  const parados = tripVehicles.filter((v) => v.engineState === "Off" || v.engineState === "Idle").length;

  return (
    <div className="space-y-4">
      {/* BETA Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <FlaskConical size={16} className="text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Modo pruebas — Solo lectura</p>
          <p className="text-xs text-amber-600">Esta vista usa datos de Samsara en tiempo real. No modifica la programación de producción.</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-200 text-amber-700 border border-amber-300">
          BETA
        </span>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-[#CC2229]/50 focus:ring-1 focus:ring-[#CC2229]/20"
          />
          {lastUpdate && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Satellite size={11} /> GPS {lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · auto 15s
            </span>
          )}
        </div>
        <button
          onClick={() => { fetchLive(); }}
          disabled={loadingLive}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loadingLive ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Actualizar GPS
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KPICard title="Viajes hoy"    value={loadingProgs ? "—" : String(progs.length)}         icon={Clock}     iconColor="text-[#CC2229]"   iconBg="bg-[#CC2229]/10" />
        <KPICard title="Unidades trip" value={loadingLive ? "—" : String(tripVehicles.length)}   icon={Truck}     iconColor="text-slate-500"   iconBg="bg-slate-100" />
        <KPICard title="En ruta"       value={loadingLive ? "—" : String(enRuta)}                icon={Activity}  iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <KPICard title="Paradas"       value={loadingLive ? "—" : String(parados)}               icon={Truck}     iconColor="text-slate-400"   iconBg="bg-slate-100" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Trip list */}
      {loadingProgs ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : progs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
          <Clock size={32} className="text-slate-300" />
          <p className="text-sm">Sin programaciones para esta fecha</p>
        </div>
      ) : (
        <div className="space-y-3">
          {progs.map((prog) => (
            <TripCard key={prog.id} prog={prog} liveMap={liveMap} />
          ))}
        </div>
      )}
    </div>
  );
}
