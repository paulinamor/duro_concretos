"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, Building2, ChevronDown, ChevronUp,
  Clock, Download, Fuel, Gauge, HardHat, Layers, Loader2, MapPin, Navigation,
  Pause, Play, RefreshCw, Route, Search, Settings, SkipBack, Timer, Truck,
  User, Wifi, WifiOff, Wrench, X, Zap,
} from "lucide-react";
import { where, orderBy } from "firebase/firestore";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import type { VehicleLocation, Geofence } from "@/components/FlotaMap";

const FlotaMap = dynamic(() => import("@/components/FlotaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  ),
});

const REFRESH_FAST   = 5_000;
const REFRESH_SLOW   = 30_000;
const ALERT_STOP_MIN = 30;
const REPLAY_TICK_MS = 120; // ms por tick de replay

// ─── Coordenadas de plantas — actualiza con ubicaciones reales ─────────────────
const PLANTS: (Geofence & { id: string })[] = [
  { id: "allende",   name: "Planta Allende",   lat: 25.301206, lng: -100.004068, radiusM: 300, color: "#CC2229" },
  { id: "pesqueria", name: "Planta Pesquería",  lat: 25.80380254093802, lng: -100.1058478460289, radiusM: 300, color: "#2563eb" },
];

// ─── Cycle analysis ───────────────────────────────────────────────────────────

type RichGpsPoint = { lat: number; lng: number; time: string; address?: string; speedMph: number };

type TripCycle = {
  num:            number;
  departureTime:  string;
  obraArrival?:   string;
  obraAddress?:   string;
  obraDeparture?: string;
  returnTime?:    string;
  toObraMin:      number;
  obraMin:        number;
  backMin:        number;
  totalMin:       number;
  status:         "complete" | "en_curso";
};

function isInPlantCoords(lat: number, lng: number): boolean {
  return PLANTS.some((p) => haversineKm(lat, lng, p.lat, p.lng) * 1000 <= p.radiusM + 100);
}

function minutesDiff(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function fmtMin(min: number): string {
  if (min <= 0) return "—";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}min`;
}

function fmtHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function detectCycles(points: RichGpsPoint[]): TripCycle[] {
  if (points.length < 3) return [];

  const cycles: TripCycle[] = [];
  let state: "in_plant" | "traveling" | "at_obra" =
    isInPlantCoords(points[0].lat, points[0].lng) ? "in_plant" : "traveling";

  let departureTime: string | null   = null;
  let obraArrival:   string | null   = null;
  let obraAddress:   string | undefined;
  let obraDeparture: string | null   = null;
  let dwellRefLat    = 0, dwellRefLng = 0, dwellCount = 0;

  const DWELL_KM = 0.15, MIN_DWELL = 2;

  const pushCycle = (returnTime?: string) => {
    if (!departureTime) return;
    const last = returnTime ?? points[points.length - 1].time;
    cycles.push({
      num: cycles.length + 1,
      departureTime,
      obraArrival:  obraArrival  ?? undefined,
      obraAddress,
      obraDeparture: obraDeparture ?? undefined,
      returnTime,
      toObraMin:  obraArrival  ? minutesDiff(departureTime, obraArrival)   : minutesDiff(departureTime, last),
      obraMin:    obraArrival && obraDeparture ? minutesDiff(obraArrival, obraDeparture)
                : obraArrival ? minutesDiff(obraArrival, last) : 0,
      backMin:    obraDeparture ? minutesDiff(obraDeparture, last) : 0,
      totalMin:   minutesDiff(departureTime, last),
      status:     returnTime ? "complete" : "en_curso",
    });
    departureTime = null; obraArrival = null; obraAddress = undefined; obraDeparture = null;
  };

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const inPlant = isInPlantCoords(pt.lat, pt.lng);

    if (state === "in_plant") {
      if (!inPlant) {
        departureTime = pt.time; state = "traveling";
        dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
      }
    } else if (state === "traveling") {
      if (inPlant && departureTime) {
        pushCycle(pt.time); state = "in_plant"; dwellCount = 0;
      } else if (!inPlant) {
        if (haversineKm(pt.lat, pt.lng, dwellRefLat, dwellRefLng) < DWELL_KM) {
          dwellCount++;
          if (dwellCount >= MIN_DWELL && obraArrival === null) {
            const si = Math.max(0, i - dwellCount + 1);
            obraArrival = points[si].time;
            obraAddress = points[si].address;
            state = "at_obra";
          }
        } else {
          dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
        }
      }
    } else if (state === "at_obra") {
      if (inPlant) {
        obraDeparture = obraDeparture ?? pt.time;
        pushCycle(pt.time); state = "in_plant"; dwellCount = 0;
      } else if (haversineKm(pt.lat, pt.lng, dwellRefLat, dwellRefLng) > DWELL_KM) {
        obraDeparture = pt.time; state = "traveling";
        dwellCount = 1; dwellRefLat = pt.lat; dwellRefLng = pt.lng;
      } else {
        dwellRefLat = (dwellRefLat + pt.lat) / 2;
        dwellRefLng = (dwellRefLng + pt.lng) / 2;
      }
    }
  }

  if (departureTime && state !== "in_plant") pushCycle();
  return cycles;
}

// ─── Samsara raw types ────────────────────────────────────────────────────────

type SamsaraVehicle         = { id: string; name: string; licensePlate?: string; vin?: string; make?: string; model?: string; year?: number; tags?: { name: string }[] };
type SamsaraLocationVehicle = { id: string; name: string; location?: { latitude: number; longitude: number; speedMilesPerHour?: number; headingDegrees?: number; time?: string; reverseGeo?: { formattedLocation?: string } } };
type SamsaraDriverAssignment = { id: string; driver?: { name: string; id: string } };
type SamsaraStatVehicle     = { id: string; engineStates?: { value: "On" | "Off" | "Idle" }[]; obdOdometerMeters?: { value: number }[]; obdEngineSeconds?: { value: number }[]; fuelPercents?: { value: number }[]; gpsOdometerMeters?: { value: number }[] };

// ─── Merged vehicle ───────────────────────────────────────────────────────────

export type RichVehicle = VehicleLocation & {
  licensePlate?: string; vin?: string; make?: string; model?: string; year?: number;
  driverName?: string; odometerKm?: number; engineHours?: number; fuelPct?: number; tags?: string[];
  plantStatus?: "En planta" | "En ruta" | "En obra";
  nearPlant?:   string;
};

// ─── Productivity type ────────────────────────────────────────────────────────

type ProdEntry = {
  vehicleId:   string;
  vehicleName: string;
  driverName?: string;
  engineState?: string;
  trips:        number;
  avgCycleMin:  number;
  avgObraMin:   number;
  cycles:       TripCycle[];
  error?:       string;
};

type ServicioEntry = {
  vehicleId:       string;
  vehicleName:     string;
  currentKm?:      number;
  engineHours?:    number;
  lastServiceKm?:  number;
  lastServiceDate?: string;
  nextServiceKm?:  number;
  kmRemaining?:    number;
  urgency:         "rojo" | "ambar" | "verde" | "neutral";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toKph(mph: number): number { const k = mph * 1.60934; return k < 3 ? 0 : Math.round(k); }
function compassLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  return dirs[Math.round(deg / 22.5) % 16];
}
function shortAddr(addr: string): string { return addr ? addr.split(",")[0].trim().slice(0, 38) : "Sin ubicación"; }
function staleness(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `hace ${s}s`; if (s < 3600) return `hace ${Math.floor(s / 60)}min`; return `hace ${Math.floor(s / 3600)}h`;
}
function stoppedMinutes(iso: string): number { return Math.floor((Date.now() - new Date(iso).getTime()) / 60000); }
function speedBadgeCls(kph: number): string {
  if (kph >= 100) return "bg-red-100 text-red-700";
  if (kph >= 80)  return "bg-orange-100 text-orange-700";
  if (kph > 0)    return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-500";
}
function bearingBetween(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const toR = (d: number) => d * Math.PI / 180;
  const dLon = toR(p2.lng - p1.lng);
  const y = Math.sin(dLon) * Math.cos(toR(p2.lat));
  const x = Math.cos(toR(p1.lat)) * Math.sin(toR(p2.lat)) - Math.sin(toR(p1.lat)) * Math.cos(toR(p2.lat)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function getPlantStatus(v: VehicleLocation): { status: "En planta" | "En ruta" | "En obra"; nearPlant?: string } {
  for (const p of PLANTS) {
    if (haversineKm(v.lat, v.lng, p.lat, p.lng) * 1000 <= p.radiusM) return { status: "En planta", nearPlant: p.name };
  }
  return { status: v.engineState === "On" || v.engineState === "Idle" ? "En ruta" : "En obra" };
}
function exportCsv(rows: RichVehicle[], filename: string) {
  const headers = ["Nombre","Placa","Conductor","Estado","Velocidad km/h","Dirección","Latitud","Longitud","Actualizado","Combustible %","Odómetro km","Estatus planta"];
  const data = rows.map((v) => [
    v.name, v.licensePlate ?? "", v.driverName ?? "",
    v.engineState === "On" ? "En ruta" : v.engineState === "Idle" ? "Ralentí" : "Apagado",
    toKph(v.speedMph), v.address, v.lat, v.lng,
    new Date(v.updatedAt).toLocaleString("es-MX"),
    v.fuelPct ?? "", v.odometerKm ?? "", v.plantStatus ?? "",
  ]);
  const csv = [headers, ...data].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
function exportTripCsv(path: { lat: number; lng: number }[], vehicleName: string) {
  const headers = ["Latitud", "Longitud", "Punto"];
  const data    = path.map((p, i) => [p.lat, p.lng, i + 1]);
  const csv     = [headers, ...data].map((r) => r.join(",")).join("\n");
  const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `recorrido_${vehicleName}_${new Date().toISOString().slice(0,10)}.csv` }).click();
  URL.revokeObjectURL(url);
}

// ─── State tokens ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = { On: "En ruta", Idle: "En ralentí", Off: "Apagado" };
const STATE_DOT:   Record<string, string> = { On: "bg-emerald-500", Idle: "bg-amber-500", Off: "bg-slate-400" };
const STATE_BG:    Record<string, string> = { On: "bg-emerald-50 border-emerald-200", Idle: "bg-amber-50 border-amber-200", Off: "bg-slate-50 border-slate-200" };
const STATE_TEXT:  Record<string, string> = { On: "text-emerald-700", Idle: "text-amber-700", Off: "text-slate-500" };

const PLANT_BADGE: Record<string, string> = {
  "En planta": "bg-purple-100 text-purple-700 border-purple-200",
  "En ruta":   "bg-emerald-100 text-emerald-700 border-emerald-200",
  "En obra":   "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Mergers / parsers ────────────────────────────────────────────────────────

function mergeStats(fast: { data?: SamsaraStatVehicle[] }, slow: { data?: SamsaraStatVehicle[] }): { data?: SamsaraStatVehicle[] } {
  const m = new Map<string, SamsaraStatVehicle>();
  (slow?.data ?? []).forEach((v) => m.set(v.id, { ...v }));
  (fast?.data ?? []).forEach((v) => { const e = m.get(v.id) ?? { id: v.id }; m.set(v.id, { ...e, engineStates: v.engineStates }); });
  return { data: Array.from(m.values()) };
}

function parseAll(
  vehicles: { data?: SamsaraVehicle[] }, locations: { data?: SamsaraLocationVehicle[] },
  stats: { data?: SamsaraStatVehicle[] }, assignments: { data?: SamsaraDriverAssignment[] },
): RichVehicle[] {
  const vMap = new Map<string, SamsaraVehicle>(); (vehicles.data ?? []).forEach((v) => vMap.set(v.id, v));
  const sMap = new Map<string, SamsaraStatVehicle>(); (stats.data ?? []).forEach((v) => sMap.set(v.id, v));
  const dMap = new Map<string, string>(); (assignments.data ?? []).forEach((a) => { if (a.driver?.name) dMap.set(a.id, a.driver.name); });

  return (locations.data ?? []).filter((v) => v.location?.latitude && v.location?.longitude).map((v) => {
    const meta = vMap.get(v.id), stat = sMap.get(v.id);
    const odom = stat?.obdOdometerMeters?.[0]?.value ?? stat?.gpsOdometerMeters?.[0]?.value;
    const eng  = stat?.obdEngineSeconds?.[0]?.value;
    const fuel = stat?.fuelPercents?.[0]?.value;
    const speedMph = v.location!.speedMilesPerHour ?? 0;
    const state: "On" | "Off" | "Idle" = stat?.engineStates?.[0]?.value ?? (speedMph > 0.5 ? "On" : "Off");
    return {
      id: v.id, name: v.name, lat: v.location!.latitude, lng: v.location!.longitude,
      speedMph, headingDegrees: v.location!.headingDegrees ?? 0,
      address: v.location!.reverseGeo?.formattedLocation ?? "", updatedAt: v.location!.time ?? new Date().toISOString(),
      engineState: state, licensePlate: meta?.licensePlate, vin: meta?.vin, make: meta?.make, model: meta?.model, year: meta?.year,
      tags: meta?.tags?.map((t) => t.name), driverName: dMap.get(v.id),
      odometerKm: odom != null ? Math.round(odom / 1000) : undefined,
      engineHours: eng != null ? Math.round(eng / 3600) : undefined,
      fuelPct: fuel != null ? Math.round(fuel) : undefined,
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TripCyclesPanel({ cycles }: { cycles: TripCycle[] }) {
  if (cycles.length === 0) return (
    <div className="px-4 pb-3 text-center text-xs text-slate-400">Sin ciclos detectados hoy</div>
  );

  const complete  = cycles.filter((c) => c.status === "complete");
  const avgCycle  = complete.length ? Math.round(complete.reduce((a, c) => a + c.totalMin, 0) / complete.length) : 0;
  const withObra  = complete.filter((c) => c.obraMin > 0);
  const avgObra   = withObra.length ? Math.round(withObra.reduce((a, c) => a + c.obraMin, 0) / withObra.length) : 0;

  return (
    <div className="px-4 pb-3">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-1 mb-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="text-center">
          <p className="text-slate-900 font-bold text-xl leading-none">{cycles.length}</p>
          <p className="text-slate-400 text-[9px] mt-0.5">viajes</p>
        </div>
        <div className="text-center border-x border-slate-200">
          <p className="text-slate-900 font-bold text-xl leading-none">{avgCycle || "—"}</p>
          <p className="text-slate-400 text-[9px] mt-0.5">min/ciclo</p>
        </div>
        <div className="text-center">
          <p className="text-slate-900 font-bold text-xl leading-none">{avgObra || "—"}</p>
          <p className="text-slate-400 text-[9px] mt-0.5">min en obra</p>
        </div>
      </div>

      {/* Cycle cards */}
      <div className="space-y-2">
        {cycles.map((c) => {
          const total = Math.max(c.totalMin, 1);
          return (
            <div key={c.num} className={`rounded-xl border p-3 ${c.status === "en_curso" ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 text-xs font-bold">Viaje {c.num}</span>
                  {c.status === "en_curso"
                    ? <span className="text-[9px] bg-blue-100 text-blue-600 border border-blue-200 rounded-full px-1.5 py-0.5 font-semibold">En curso</span>
                    : <span className="text-[9px] bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-full px-1.5 py-0.5 font-semibold">Completo</span>
                  }
                </div>
                <span className="text-slate-800 text-xs font-bold tabular-nums">{fmtMin(c.totalMin)}</span>
              </div>

              {/* Time range */}
              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-2.5">
                <span className="font-semibold text-slate-700">{fmtHHMM(c.departureTime)}</span>
                <ArrowRight size={9} className="text-slate-300" />
                {c.returnTime
                  ? <span className="font-semibold text-slate-700">{fmtHHMM(c.returnTime)}</span>
                  : <span className="text-blue-500 font-semibold">ahora</span>
                }
              </div>

              {/* Segment bars */}
              <div className="space-y-1.5">
                {c.toObraMin > 0 && (
                  <div className="flex items-center gap-2">
                    <Truck size={9} className="text-orange-400 shrink-0" />
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, (c.toObraMin / total) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 tabular-nums w-10 text-right">{c.toObraMin} min</span>
                  </div>
                )}
                {c.obraMin > 0 && (
                  <div className="flex items-center gap-2">
                    <HardHat size={9} className="text-purple-500 shrink-0" />
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (c.obraMin / total) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 tabular-nums w-10 text-right">{c.obraMin} min</span>
                  </div>
                )}
                {c.backMin > 0 && (
                  <div className="flex items-center gap-2">
                    <Building2 size={9} className="text-blue-400 shrink-0" />
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (c.backMin / total) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 tabular-nums w-10 text-right">{c.backMin} min</span>
                  </div>
                )}
              </div>

              {/* Obra address */}
              {c.obraAddress && (
                <p className="text-[9px] text-slate-400 mt-2 truncate flex items-center gap-1">
                  <MapPin size={8} />{c.obraAddress.split(",")[0]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2.5 px-1">
        {[["bg-orange-400", "Traslado"], ["bg-purple-500", "En obra"], ["bg-blue-400", "Regreso"]].map(([cls, lbl]) => (
          <div key={lbl} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            <span className="text-[9px] text-slate-400">{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-slate-500 text-xs w-28 shrink-0">{label}</span>
      <span className="text-slate-900 text-xs font-medium text-right flex-1 truncate">{children}</span>
    </div>
  );
}

function VehicleDetailPanel({
  v, onClose, onShowTrip, tripLoading, hasTripPath, tripPath, onStartReplay, cycles,
}: {
  v: RichVehicle; onClose: () => void;
  onShowTrip: (id: string) => void; tripLoading: boolean;
  hasTripPath: boolean; tripPath: { lat: number; lng: number }[] | null;
  onStartReplay: () => void; cycles: TripCycle[] | null;
}) {
  const state   = v.engineState ?? "Off";
  const kph     = toKph(v.speedMph);
  const [open,        setOpen]        = useState(true);
  const [cyclesOpen,  setCyclesOpen]  = useState(true);
  const stopMins = state === "Off" ? stoppedMinutes(v.updatedAt) : 0;

  return (
    <div className="w-72 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-lg max-h-[calc(100vh-130px)]">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-slate-900 font-bold text-sm truncate">{v.name}</p>
            {v.make && <p className="text-slate-400 text-xs mt-0.5">{[v.year, v.make, v.model].filter(Boolean).join(" ")}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer mt-0.5"><X size={15} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${STATE_BG[state]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[state]}`} />
            <span className={STATE_TEXT[state]}>{STATE_LABEL[state]}</span>
          </span>
          {v.plantStatus && v.plantStatus !== "En ruta" && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${PLANT_BADGE[v.plantStatus]}`}>
              <Building2 size={9} />{v.nearPlant ?? v.plantStatus}
            </span>
          )}
          {stopMins >= ALERT_STOP_MIN && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-600">
              <AlertTriangle size={9} />{stopMins >= 60 ? `${Math.floor(stopMins / 60)}h ${stopMins % 60}min` : `${stopMins}min`}
            </span>
          )}
        </div>
      </div>

      {/* Driver card */}
      {v.driverName && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#CC2229] to-[#991b1f] flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">{v.driverName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-slate-900 text-xs font-bold truncate">{v.driverName}</p>
              <p className="text-slate-400 text-[10px]">Conductor asignado</p>
            </div>
          </div>
        </div>
      )}

      {/* Speed hero */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-end gap-1.5">
          <span className={`text-3xl font-bold tabular-nums leading-none ${kph >= 100 ? "text-red-600" : kph >= 80 ? "text-orange-500" : "text-slate-900"}`}>{kph}</span>
          <span className="text-slate-400 text-sm mb-0.5">km/h</span>
        </div>
        {v.headingDegrees > 0 ? (
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-[#CC2229]" style={{ transform: `rotate(${v.headingDegrees}deg)` }} />
            <div className="text-right">
              <p className="text-slate-800 text-xs font-semibold">{compassLabel(v.headingDegrees)}</p>
              <p className="text-slate-400 text-[10px]">{Math.round(v.headingDegrees)}°</p>
            </div>
          </div>
        ) : <span className="text-slate-400 text-xs">{kph === 0 ? "Detenido" : "—"}</span>}
      </div>

      {/* Trip actions */}
      <div className="px-4 py-2.5 border-b border-slate-100 shrink-0 space-y-1.5">
        <button
          onClick={() => onShowTrip(v.id)}
          disabled={tripLoading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          {tripLoading ? <Loader2 size={12} className="animate-spin" /> : <Route size={12} />}
          {tripLoading ? "Cargando recorrido…" : "Ver recorrido de hoy"}
        </button>
        {hasTripPath && (
          <div className="flex gap-1.5">
            <button
              onClick={onStartReplay}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Play size={11} />Replay
            </button>
            <button
              onClick={() => exportTripCsv(tripPath ?? [], v.name)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Download size={11} />CSV ruta
            </button>
          </div>
        )}
      </div>

      {/* Data rows */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          Detalles {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        {open && (
          <div className="px-4 pb-3">
            <DetailRow icon={<MapPin size={13} />} label="Ubicación">{v.address || "Sin dirección"}</DetailRow>
            {v.odometerKm != null && <DetailRow icon={<Activity size={13} />} label="Odómetro">{v.odometerKm.toLocaleString("es-MX")} km</DetailRow>}
            {v.engineHours != null && <DetailRow icon={<Timer size={13} />} label="Horas motor">{v.engineHours.toLocaleString("es-MX")} h</DetailRow>}
            {v.fuelPct != null && (
              <div className="flex items-center gap-3 py-2.5 border-b border-slate-100">
                <span className="text-slate-400 shrink-0"><Fuel size={13} /></span>
                <span className="text-slate-500 text-xs w-28 shrink-0">Combustible</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${v.fuelPct > 40 ? "bg-emerald-500" : v.fuelPct > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${v.fuelPct}%` }} />
                  </div>
                  <span className="text-slate-900 text-xs font-medium shrink-0">{v.fuelPct}%</span>
                </div>
              </div>
            )}
            {v.licensePlate && <DetailRow icon={<Truck size={13} />} label="Placa">{v.licensePlate}</DetailRow>}
            {v.vin && <DetailRow icon={<Gauge size={13} />} label="VIN">{v.vin}</DetailRow>}
            <DetailRow icon={<Clock size={13} />} label="Actualizado">{new Date(v.updatedAt).toLocaleTimeString("es-MX")} · {staleness(v.updatedAt)}</DetailRow>
            {v.tags?.length ? <DetailRow icon={<Activity size={13} />} label="Etiquetas">{v.tags.join(", ")}</DetailRow> : null}
          </div>
        )}

        {/* Ciclos de hoy */}
        {cycles !== null && (
          <>
            <button
              onClick={() => setCyclesOpen((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 cursor-pointer border-t border-slate-100 mt-1"
            >
              <span className="flex items-center gap-1.5">
                <Route size={10} />
                Ciclos de hoy
                {cycles.length > 0 && (
                  <span className="bg-[#CC2229] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cycles.length}
                  </span>
                )}
              </span>
              {cyclesOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {cyclesOpen && <TripCyclesPanel cycles={cycles} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Replay controls ──────────────────────────────────────────────────────────

function ReplayControls({
  active, idx, total, speed,
  onPlay, onPause, onReset, onSpeedChange, onClose,
}: {
  active: boolean; idx: number; total: number; speed: number;
  onPlay: () => void; onPause: () => void; onReset: () => void;
  onSpeedChange: (s: number) => void; onClose: () => void;
}) {
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-4 py-3 w-72">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-900">Replay de recorrido</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={13} /></button>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200 rounded-full mb-3 overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-3">
        <span>Punto {idx + 1} / {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button onClick={onReset} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"><SkipBack size={13} /></button>
        {active
          ? <button onClick={onPause} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer hover:bg-blue-700"><Pause size={12} />Pausar</button>
          : <button onClick={onPlay}  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer hover:bg-blue-700"><Play  size={12} />Reproducir</button>
        }
        {/* Speed selector */}
        <div className="flex gap-0.5">
          {[1, 5, 15, 30].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${speed === s ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlotaEnVivoPage() {
  const [vehicles,     setVehicles]     = useState<RichVehicle[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);
  const [online,       setOnline]       = useState(true);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [filter,       setFilter]       = useState<"todos" | "on" | "off" | "alertas">("todos");
  const [search,       setSearch]       = useState("");
  const [showTraffic,  setShowTraffic]  = useState(false);
  const [mapType,      setMapType]      = useState<"roadmap" | "satellite">("roadmap");
  const [sortBy,       setSortBy]       = useState<"default" | "speed">("default");
  const [tripPath,     setTripPath]     = useState<{ lat: number; lng: number }[] | null>(null);
  const [tripLoading,  setTripLoading]  = useState(false);
  const [tripVehicle,  setTripVehicle]  = useState<string>("");
  const [cycles,       setCycles]       = useState<TripCycle[] | null>(null);
  // Productividad de flota
  const [showProd,   setShowProd]   = useState(false);
  const [prodLoading,setProdLoading] = useState(false);
  const [prodData,   setProdData]   = useState<ProdEntry[] | null>(null);
  // Servicios predictivos
  const [showServ,     setShowServ]     = useState(false);
  const [servLoading,  setServLoading]  = useState(false);
  const [servData,     setServData]     = useState<ServicioEntry[] | null>(null);
  const [servIntervalKm, setServIntervalKm] = useState(5000);
  // Replay
  const [replayActive, setReplayActive] = useState(false);
  const [replayIdx,    setReplayIdx]    = useState(0);
  const [replaySpeed,  setReplaySpeed]  = useState(5);
  const [replayMarker, setReplayMarker] = useState<{ lat: number; lng: number; heading: number } | null>(null);
  const [showReplay,   setShowReplay]   = useState(false);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef   = useRef<Record<string, { lat: number; lng: number; ts: number }>>({});
  const speedHistRef = useRef<Record<string, number[]>>({});
  const slowCacheRef = useRef<{
    vehicles: { data?: SamsaraVehicle[] }; stats: { data?: SamsaraStatVehicle[] }; assignments: { data?: SamsaraDriverAssignment[] };
  }>({ vehicles: {}, stats: {}, assignments: {} });

  // Replay logic
  const stopReplay = useCallback(() => {
    if (replayTimerRef.current) { clearInterval(replayTimerRef.current); replayTimerRef.current = null; }
    setReplayActive(false);
  }, []);

  const startReplay = useCallback(() => {
    if (!tripPath || tripPath.length < 2) return;
    setReplayActive(true);
  }, [tripPath]);

  useEffect(() => {
    if (!replayActive || !tripPath || tripPath.length < 2) return;
    replayTimerRef.current = setInterval(() => {
      setReplayIdx((prev) => {
        const next = prev + replaySpeed;
        if (next >= tripPath.length - 1) {
          stopReplay();
          setReplayMarker({ ...tripPath[tripPath.length - 1], heading: 0 });
          return tripPath.length - 1;
        }
        const p1 = tripPath[next], p2 = tripPath[Math.min(next + 1, tripPath.length - 1)];
        const heading = bearingBetween(p1, p2);
        setReplayMarker({ lat: p1.lat, lng: p1.lng, heading });
        return next;
      });
    }, REPLAY_TICK_MS);
    return () => { if (replayTimerRef.current) clearInterval(replayTimerRef.current); };
  }, [replayActive, tripPath, replaySpeed, stopReplay]);

  const resetReplay = useCallback(() => {
    stopReplay();
    setReplayIdx(0);
    if (tripPath && tripPath.length >= 2) {
      setReplayMarker({ ...tripPath[0], heading: bearingBetween(tripPath[0], tripPath[1]) });
    }
  }, [stopReplay, tripPath]);

  const applyData = useCallback((locations: { data?: SamsaraLocationVehicle[] }, fastStats: { data?: SamsaraStatVehicle[] }) => {
    const stats  = mergeStats(fastStats, slowCacheRef.current.stats);
    const parsed = parseAll(slowCacheRef.current.vehicles, locations, stats, slowCacheRef.current.assignments);
    const now    = Date.now();

    const enriched = parsed.map((v) => {
      const prev = lastPosRef.current[v.id];
      lastPosRef.current[v.id] = { lat: v.lat, lng: v.lng, ts: now };
      let eMph = v.speedMph;
      if (eMph < 0.3 && prev) {
        const dk = haversineKm(prev.lat, prev.lng, v.lat, v.lng);
        const dh = (now - prev.ts) / 3_600_000;
        if (dh > 0 && dh < 0.017 && dk > 0.005) { const e = dk / dh; if (e > 2 && e < 200) eMph = e / 1.60934; }
      }
      if (!speedHistRef.current[v.id]) speedHistRef.current[v.id] = [];
      const hist = speedHistRef.current[v.id];
      hist.push(eMph * 1.60934); if (hist.length > 6) hist.shift();
      const avgKph  = hist.reduce((a, b) => a + b, 0) / hist.length;
      const isMoving = avgKph > 2;
      const withState = { ...v, speedMph: avgKph / 1.60934, engineState: isMoving ? "On" as const : (v.engineState ?? "Off") };
      const { status, nearPlant } = getPlantStatus(withState);
      return { ...withState, plantStatus: status, nearPlant };
    });

    setVehicles(enriched);
    setLastUpdate(new Date());
    setOnline(true);
  }, []);

  const fetchFast = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [lRes, esRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Flocations"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=engineStates"),
      ]);
      if (!lRes.ok) throw new Error("Error al obtener ubicaciones");
      const [lData, esData] = await Promise.all([lRes.json(), esRes.ok ? esRes.json() : Promise.resolve({ data: [] })]);
      applyData(lData, esData);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); setOnline(false); }
    finally { setLoading(false); }
  }, [applyData]);

  const fetchSlow = useCallback(async () => {
    try {
      const [vRes, sRes, aRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=obdOdometerMeters%2CgpsOdometerMeters%2CobdEngineSeconds%2CfuelPercents"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fdriver-assignments"),
      ]);
      const [vD, sD, aD] = await Promise.all([vRes.ok ? vRes.json() : Promise.resolve({}), sRes.ok ? sRes.json() : Promise.resolve({}), aRes.ok ? aRes.json() : Promise.resolve({})]);
      if (vD.data) slowCacheRef.current.vehicles    = vD;
      if (sD.data) slowCacheRef.current.stats       = sD;
      if (aD.data) slowCacheRef.current.assignments = aD;
    } catch { /* non-critical */ }
  }, []);

  const fetchTripHistory = useCallback(async (vehicleId: string) => {
    setTripLoading(true); setTripPath(null); setReplayMarker(null); setShowReplay(false); setCycles(null); stopReplay();
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const startTime  = todayStart.toISOString();
      const endTime    = new Date().toISOString();

      const endpoint = encodeURIComponent("/fleet/vehicles/stats/history");
      const res = await fetch(
        `/api/samsara?endpoint=${endpoint}&types=gps&vehicleIds=${vehicleId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&limit=500`
      );
      const json = await res.json();

      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : json?.error?.message ?? `Error Samsara ${res.status}`;
        throw new Error(msg);
      }

      type GpsPoint = { latitude: number; longitude: number; time: string; speedMilesPerHour?: number; reverseGeo?: { formattedLocation?: string } };
      type VehicleGps = { id: string; name: string; gps?: GpsPoint[] };

      const vData   = (json.data as VehicleGps[] ?? []).find((d) => d.id === vehicleId);
      const rawPts  = vData?.gps ?? [];

      const richPts: RichGpsPoint[] = rawPts
        .map((p) => ({
          lat: p.latitude, lng: p.longitude, time: p.time,
          address: p.reverseGeo?.formattedLocation,
          speedMph: p.speedMilesPerHour ?? 0,
        }))
        .filter((p) => typeof p.lat === "number" && typeof p.lng === "number") as RichGpsPoint[];

      if (richPts.length < 2) throw new Error("Sin recorrido registrado hoy");

      const path = richPts.map((p) => ({ lat: p.lat, lng: p.lng }));
      setTripPath(path);
      setCycles(detectCycles(richPts));
      setTripVehicle(vehicles.find((v) => v.id === vehicleId)?.name ?? "vehiculo");
      setReplayIdx(0);
      setReplayMarker({ ...path[0], heading: bearingBetween(path[0], path[1]) });
    } catch (e) { setError(e instanceof Error ? e.message : "Error al cargar recorrido"); }
    finally { setTripLoading(false); }
  }, [vehicles, stopReplay]);

  const fetchProductivity = useCallback(async () => {
    if (vehicles.length === 0) return;
    setShowProd(true); setProdLoading(true); setProdData(null);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const startTime  = todayStart.toISOString();
    const endTime    = new Date().toISOString();
    const ep         = encodeURIComponent("/fleet/vehicles/stats/history");

    type GpsPoint  = { latitude: number; longitude: number; time: string; speedMilesPerHour?: number; reverseGeo?: { formattedLocation?: string } };
    type VehGps    = { id: string; gps?: GpsPoint[] };

    const results = await Promise.allSettled(
      vehicles.map(async (v) => {
        const res  = await fetch(`/api/samsara?endpoint=${ep}&types=gps&vehicleIds=${v.id}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&limit=500`);
        const json = await res.json();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const vData  = (json.data as VehGps[] ?? []).find((d) => d.id === v.id);
        const richPts = (vData?.gps ?? [])
          .map((p) => ({ lat: p.latitude, lng: p.longitude, time: p.time, address: p.reverseGeo?.formattedLocation, speedMph: p.speedMilesPerHour ?? 0 }))
          .filter((p) => typeof p.lat === "number" && typeof p.lng === "number") as RichGpsPoint[];
        const detected  = detectCycles(richPts);
        const complete  = detected.filter((c) => c.status === "complete");
        const withObra  = complete.filter((c) => c.obraMin > 0);
        return {
          vehicleId:   v.id,   vehicleName: v.name,
          driverName:  v.driverName, engineState: v.engineState,
          trips:       detected.length,
          avgCycleMin: complete.length ? Math.round(complete.reduce((a, c) => a + c.totalMin, 0) / complete.length) : 0,
          avgObraMin:  withObra.length ? Math.round(withObra.reduce((a, c) => a + c.obraMin, 0) / withObra.length)  : 0,
          cycles:      detected,
        } satisfies ProdEntry;
      })
    );

    const entries: ProdEntry[] = results.map((r, i) =>
      r.status === "fulfilled" ? r.value : {
        vehicleId: vehicles[i].id, vehicleName: vehicles[i].name,
        driverName: vehicles[i].driverName, engineState: vehicles[i].engineState,
        trips: 0, avgCycleMin: 0, avgObraMin: 0, cycles: [],
        error: (r.reason as Error)?.message ?? "Error",
      }
    );

    entries.sort((a, b) => b.trips - a.trips || a.vehicleName.localeCompare(b.vehicleName));
    setProdData(entries);
    setProdLoading(false);
  }, [vehicles]);

  const loadServicios = useCallback(async () => {
    if (vehicles.length === 0) return;
    setShowServ(true); setServLoading(true); setServData(null);

    type MantRaw   = { id?: string; tipo: string; unidad: string; fecha: string; km?: number; horometro?: number };
    type UnidadRaw = { id?: string; noEconomico: string; kmActual?: number };

    const [mantsRaw, unidadesRaw] = await Promise.all([
      getCollectionDocs<MantRaw>(COLLECTIONS.mantenimientos, [
        where("tipo", "==", "Mantenimiento"),
        orderBy("fecha", "desc"),
      ]).catch(() => [] as MantRaw[]),
      getCollectionDocs<UnidadRaw>(COLLECTIONS.unidades).catch(() => [] as UnidadRaw[]),
    ]);

    // Index maintenance by noEconomico (most recent first due to orderBy desc)
    const byUnit = new Map<string, MantRaw>();
    for (const m of mantsRaw) {
      const key = m.unidad?.trim().toLowerCase();
      if (key && !byUnit.has(key)) byUnit.set(key, m);
    }

    // Index unidades by noEconomico → kmActual (fallback odometer)
    const kmByUnit = new Map<string, number>();
    for (const u of unidadesRaw) {
      const key = u.noEconomico?.trim().toLowerCase();
      if (key && u.kmActual != null) kmByUnit.set(key, u.kmActual);
    }

    const interval = servIntervalKm;
    const entries: ServicioEntry[] = vehicles.map((v) => {
      const key  = v.name.trim().toLowerCase();
      const mant = byUnit.get(key);
      // Samsara OBD odometer takes priority; fall back to manually maintained kmActual in unidades
      const currentKm    = v.odometerKm ?? kmByUnit.get(key);
      const engineHours  = v.engineHours;
      const lastServiceKm   = mant?.km;
      const lastServiceDate = mant?.fecha;
      let nextServiceKm: number | undefined;
      let kmRemaining:   number | undefined;
      let urgency: ServicioEntry["urgency"] = "neutral";

      if (lastServiceKm != null && currentKm != null) {
        nextServiceKm = lastServiceKm + interval;
        kmRemaining   = nextServiceKm - currentKm;
        urgency = kmRemaining <= 0 ? "rojo" : kmRemaining <= 500 ? "rojo" : kmRemaining <= 1500 ? "ambar" : "verde";
      } else if (currentKm != null && lastServiceKm == null) {
        // We know current km but no last service record — flag as needing attention
        urgency = "ambar";
      }

      return { vehicleId: v.id, vehicleName: v.name, currentKm, engineHours, lastServiceKm, lastServiceDate, nextServiceKm, kmRemaining, urgency };
    });

    entries.sort((a, b) => {
      const order = { rojo: 0, ambar: 1, verde: 2, neutral: 3 };
      return order[a.urgency] - order[b.urgency] || a.vehicleName.localeCompare(b.vehicleName);
    });

    setServData(entries);
    setServLoading(false);
  }, [vehicles, servIntervalKm]);

  useEffect(() => {
    fetchSlow().then(() => fetchFast(false));
    fastTimerRef.current = setInterval(() => fetchFast(true), REFRESH_FAST);
    slowTimerRef.current = setInterval(fetchSlow, REFRESH_SLOW);
    return () => {
      if (fastTimerRef.current) clearInterval(fastTimerRef.current);
      if (slowTimerRef.current) clearInterval(slowTimerRef.current);
    };
  }, [fetchFast, fetchSlow]);

  // Derived stats
  const selected     = vehicles.find((v) => v.id === selectedId) ?? null;
  const on           = vehicles.filter((v) => v.engineState === "On").length;
  const idle         = vehicles.filter((v) => v.engineState === "Idle").length;
  const off          = vehicles.filter((v) => !v.engineState || v.engineState === "Off").length;
  const movingVehs   = vehicles.filter((v) => v.engineState === "On");
  const avgKph       = movingVehs.length ? Math.round(movingVehs.reduce((a, v) => a + toKph(v.speedMph), 0) / movingVehs.length) : 0;
  const alertCount   = vehicles.filter((v) => (v.engineState === "Off" || !v.engineState) && stoppedMinutes(v.updatedAt) >= ALERT_STOP_MIN).length;
  const inPlantCount = vehicles.filter((v) => v.plantStatus === "En planta").length;

  const filtered = vehicles
    .filter((v) => {
      const state = v.engineState ?? "Off";
      const matchFilter =
        filter === "todos"   ? true :
        filter === "on"      ? state === "On" || state === "Idle" :
        filter === "off"     ? state === "Off" :
        (state === "Off" && stoppedMinutes(v.updatedAt) >= ALERT_STOP_MIN);
      const q = search.trim().toLowerCase();
      const matchSearch = !q
        || v.name.toLowerCase().includes(q)
        || v.address.toLowerCase().includes(q)
        || (v.driverName?.toLowerCase().includes(q) ?? false);
      return matchFilter && matchSearch;
    })
    .sort((a, b) => sortBy === "speed" ? toKph(b.speedMph) - toKph(a.speedMph) : 0);

  return (
    <div className="relative flex gap-0 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm" style={{ height: "calc(100vh - 96px)" }}>

      {/* ── Productividad modal ───────────────────────────────────────────────── */}
      {showProd && (
        <div className="absolute inset-0 z-[600] bg-white flex flex-col rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
            <div>
              <h2 className="text-slate-900 font-bold text-base">Productividad de flota</h2>
              <p className="text-slate-400 text-xs mt-0.5">{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} · {vehicles.length} unidades</p>
            </div>
            <div className="flex items-center gap-2">
              {prodData && (
                <button
                  onClick={() => {
                    if (!prodData) return;
                    const headers = ["Rank","Unidad","Conductor","Viajes","Ciclo prom (min)","En obra prom (min)","Estado"];
                    const rows = prodData.map((e, i) => [i+1, e.vehicleName, e.driverName ?? "", e.trips, e.avgCycleMin || "", e.avgObraMin || "", e.engineState ?? ""]);
                    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob(["﻿"+csv], { type: "text/csv;charset=utf-8;" });
                    const url  = URL.createObjectURL(blob);
                    Object.assign(document.createElement("a"), { href: url, download: `productividad_${new Date().toISOString().slice(0,10)}.csv` }).click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  <Download size={12} />CSV
                </button>
              )}
              <button onClick={() => setShowProd(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"><X size={18} /></button>
            </div>
          </div>

          {prodLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={36} className="animate-spin text-[#CC2229] mx-auto mb-4" />
                <p className="text-slate-700 text-sm font-semibold">Analizando {vehicles.length} unidades…</p>
                <p className="text-slate-400 text-xs mt-1">Consultando historial GPS del día</p>
              </div>
            </div>
          ) : prodData && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Fleet KPIs */}
              {(() => {
                const active   = prodData.filter((e) => e.trips > 0);
                const total    = prodData.reduce((a, e) => a + e.trips, 0);
                const avgCycle = active.filter(e => e.avgCycleMin > 0).length
                  ? Math.round(active.filter(e => e.avgCycleMin > 0).reduce((a, e) => a + e.avgCycleMin, 0) / active.filter(e => e.avgCycleMin > 0).length) : 0;
                const avgObra  = active.filter(e => e.avgObraMin > 0).length
                  ? Math.round(active.filter(e => e.avgObraMin > 0).reduce((a, e) => a + e.avgObraMin, 0) / active.filter(e => e.avgObraMin > 0).length) : 0;
                return (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      ["text-[#CC2229]", String(total),         "viajes totales hoy"],
                      ["text-emerald-600", String(active.length), "unidades con actividad"],
                      ["text-blue-600",    avgCycle > 0 ? `${avgCycle} min` : "—", "ciclo promedio flota"],
                      ["text-purple-600",  avgObra  > 0 ? `${avgObra} min` : "—", "tiempo prom en obra"],
                    ].map(([cls, val, lbl]) => (
                      <div key={lbl} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                        <p className={`text-3xl font-bold tabular-nums ${cls}`}>{val}</p>
                        <p className="text-slate-400 text-xs mt-1">{lbl}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["#","Unidad","Conductor","Viajes","Ciclo prom","En obra prom","Productividad relativa","Estado"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prodData.map((entry, i) => {
                      const maxTrips = Math.max(prodData[0]?.trips ?? 1, 1);
                      const pct = (entry.trips / maxTrips) * 100;
                      const tripColor = entry.trips >= 6 ? "text-emerald-600" : entry.trips >= 3 ? "text-blue-600" : entry.trips > 0 ? "text-slate-700" : "text-slate-300";
                      const barColor  = entry.trips >= 6 ? "bg-emerald-500" : entry.trips >= 3 ? "bg-blue-500" : entry.trips > 0 ? "bg-slate-400" : "bg-slate-200";
                      return (
                        <tr key={entry.vehicleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 text-sm">{entry.vehicleName}</p>
                            {entry.error && <p className="text-red-400 text-[10px] mt-0.5">{entry.error}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{entry.driverName ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`text-2xl font-bold tabular-nums ${tripColor}`}>{entry.trips}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs tabular-nums">
                            {entry.avgCycleMin > 0 ? `${entry.avgCycleMin} min` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs tabular-nums">
                            {entry.avgObraMin > 0 ? `${entry.avgObraMin} min` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{Math.round(pct)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              entry.engineState === "On"   ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                              entry.engineState === "Idle" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                             "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              {entry.engineState === "On" ? "En ruta" : entry.engineState === "Idle" ? "Ralentí" : "Apagado"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Servicios predictivos modal (Beta) ───────────────────────────────── */}
      {showServ && (
        <div className="absolute inset-0 z-[600] bg-white flex flex-col rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench size={15} className="text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-slate-900 font-bold text-base">Servicios predictivos</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200 uppercase tracking-wide">Beta</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">Próximos servicios basado en odómetro Samsara · intervalo: {servIntervalKm.toLocaleString()} km</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Interval selector */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Settings size={11} className="text-slate-400" />
                <span className="text-[10px] text-slate-500 font-medium">Intervalo</span>
                <select
                  value={servIntervalKm}
                  onChange={(e) => setServIntervalKm(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
                >
                  {[3000, 5000, 8000, 10000, 15000].map((v) => (
                    <option key={v} value={v}>{v.toLocaleString()} km</option>
                  ))}
                </select>
              </div>
              {servData && (
                <button
                  onClick={() => {
                    const headers = ["Unidad","Km actual","Último servicio (km)","Último servicio (fecha)","Próximo servicio (km)","Km restantes","Urgencia"];
                    const rows = servData.map((e) => [
                      e.vehicleName, e.currentKm ?? "", e.lastServiceKm ?? "", e.lastServiceDate ?? "",
                      e.nextServiceKm ?? "", e.kmRemaining != null ? e.kmRemaining : "", e.urgency,
                    ]);
                    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob(["﻿"+csv], { type: "text/csv;charset=utf-8;" });
                    const url  = URL.createObjectURL(blob);
                    Object.assign(document.createElement("a"), { href: url, download: `servicios_${new Date().toISOString().slice(0,10)}.csv` }).click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  <Download size={12} />CSV
                </button>
              )}
              <button onClick={() => setShowServ(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"><X size={18} /></button>
            </div>
          </div>

          {servLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={36} className="animate-spin text-amber-500 mx-auto mb-4" />
                <p className="text-slate-700 text-sm font-semibold">Consultando historial de mantenimiento…</p>
                <p className="text-slate-400 text-xs mt-1">Cruzando odómetros Samsara con Firestore</p>
              </div>
            </div>
          ) : servData && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Summary KPIs */}
              {(() => {
                const rojos  = servData.filter((e) => e.urgency === "rojo").length;
                const ambar  = servData.filter((e) => e.urgency === "ambar").length;
                const verdes = servData.filter((e) => e.urgency === "verde").length;
                const sinDatos = servData.filter((e) => e.urgency === "neutral").length;
                return (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      ["text-red-600",    String(rojos),   "urgente / vencido",      "bg-red-50 border-red-100"],
                      ["text-amber-600",  String(ambar),   "próximo servicio",        "bg-amber-50 border-amber-100"],
                      ["text-emerald-600",String(verdes),  "al día",                  "bg-emerald-50 border-emerald-100"],
                      ["text-slate-400",  String(sinDatos),"sin datos suficientes",   "bg-slate-50 border-slate-100"],
                    ].map(([cls, val, lbl, bg]) => (
                      <div key={lbl} className={`rounded-2xl p-4 border text-center ${bg}`}>
                        <p className={`text-3xl font-bold tabular-nums ${cls}`}>{val}</p>
                        <p className="text-slate-400 text-xs mt-1">{lbl}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Unidad","Km actual","Último servicio","Próximo servicio","Km restantes","Horas motor","Estado"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {servData.map((entry) => {
                      const urgClr = {
                        rojo:    "bg-red-100 text-red-700 border-red-200",
                        ambar:   "bg-amber-100 text-amber-700 border-amber-200",
                        verde:   "bg-emerald-100 text-emerald-700 border-emerald-200",
                        neutral: "bg-slate-100 text-slate-500 border-slate-200",
                      }[entry.urgency];
                      const urgLbl = {
                        rojo:    entry.kmRemaining != null && entry.kmRemaining <= 0 ? "Vencido" : "Urgente",
                        ambar:   "Próximo",
                        verde:   "Al día",
                        neutral: "Sin datos",
                      }[entry.urgency];
                      return (
                        <tr key={entry.vehicleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 text-sm">{entry.vehicleName}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700 text-sm tabular-nums font-semibold">
                            {entry.currentKm != null ? entry.currentKm.toLocaleString() : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {entry.lastServiceKm != null ? (
                              <div>
                                <p className="text-slate-700 text-xs tabular-nums font-medium">{entry.lastServiceKm.toLocaleString()} km</p>
                                {entry.lastServiceDate && <p className="text-slate-400 text-[10px] mt-0.5">{entry.lastServiceDate}</p>}
                              </div>
                            ) : <span className="text-slate-300 text-xs">Sin registro</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-700 text-sm tabular-nums">
                            {entry.nextServiceKm != null ? entry.nextServiceKm.toLocaleString() : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {entry.kmRemaining != null ? (
                              <span className={`text-sm font-bold tabular-nums ${entry.kmRemaining <= 0 ? "text-red-600" : entry.kmRemaining <= 500 ? "text-red-500" : entry.kmRemaining <= 1500 ? "text-amber-600" : "text-emerald-600"}`}>
                                {entry.kmRemaining <= 0 ? `+${Math.abs(entry.kmRemaining).toLocaleString()}` : entry.kmRemaining.toLocaleString()}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs tabular-nums">
                            {entry.engineHours != null ? `${entry.engineHours.toLocaleString()} h` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgClr}`}>{urgLbl}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-slate-400 text-[10px] text-center mt-4">
                Los km restantes se calculan con base en el odómetro OBD/GPS de Samsara y el registro de mantenimiento más reciente en Firestore.
                Actualiza el km del último servicio en el módulo de mantenimiento para mejorar la precisión.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-slate-200 bg-white">

        {/* Header */}
        <div className="px-4 pt-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {online ? <Wifi size={9} /> : <WifiOff size={9} />}
                {online ? "En vivo" : "Sin conexión"}
              </span>
              {lastUpdate && <span className="text-[10px] text-slate-400">{lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            </div>
            <button onClick={() => { fetchSlow(); fetchFast(false); }} disabled={loading} className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-40">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <button onClick={() => { setFilter("on"); setSortBy("default"); }} className={`rounded-lg px-2 py-1.5 text-center transition-all cursor-pointer border ${filter === "on" && sortBy === "default" ? "bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400" : "bg-emerald-50 border-transparent hover:border-emerald-300"}`}>
              <p className="text-emerald-700 text-sm font-bold">{on + idle}</p>
              <p className="text-emerald-600 text-[9px] font-medium">En ruta</p>
            </button>
            <button onClick={() => { setFilter("on"); setSortBy("speed"); }} className={`rounded-lg px-2 py-1.5 text-center transition-all cursor-pointer border ${filter === "on" && sortBy === "speed" ? "bg-blue-100 border-blue-400 ring-1 ring-blue-400" : "bg-blue-50 border-transparent hover:border-blue-300"}`}>
              <p className="text-blue-700 text-sm font-bold">{avgKph}</p>
              <p className="text-blue-600 text-[9px] font-medium">km/h prom ↕</p>
            </button>
            <button onClick={() => { setFilter(filter === "alertas" ? "todos" : "alertas"); setSortBy("default"); }} disabled={alertCount === 0} className={`rounded-lg px-2 py-1.5 text-center transition-all border ${alertCount === 0 ? "bg-slate-50 border-transparent cursor-default" : filter === "alertas" ? "bg-red-100 border-red-400 ring-1 ring-red-400 cursor-pointer" : "bg-red-50 border-transparent hover:border-red-300 cursor-pointer"}`}>
              <p className={`text-sm font-bold ${alertCount > 0 ? "text-red-600" : "text-slate-400"}`}>{alertCount}</p>
              <p className={`text-[9px] font-medium ${alertCount > 0 ? "text-red-500" : "text-slate-400"}`}>Detenidos</p>
            </button>
            <div className="rounded-lg px-2 py-1.5 text-center bg-purple-50 border border-transparent">
              <p className="text-purple-700 text-sm font-bold">{inPlantCount}</p>
              <p className="text-purple-600 text-[9px] font-medium">En planta</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar vehículo, conductor…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/20 focus:border-[#CC2229]/40" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={11} /></button>}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {([["todos", `Todos ${vehicles.length}`], ["on", `Ruta ${on + idle}`], ["off", `Parados ${off}`], ["alertas", `Alertas ${alertCount}`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setSortBy("default"); }}
              className={`flex-1 py-2.5 text-[10px] font-semibold transition-colors cursor-pointer border-b-2 ${filter === key ? key === "alertas" ? "border-red-500 text-red-600" : "border-[#CC2229] text-[#CC2229]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {error && <div className="flex items-center gap-2 m-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600"><AlertCircle size={13} />{error}</div>}
          {loading && vehicles.length === 0
            ? [...Array(8)].map((_, i) => <div key={i} className="mx-3 my-1.5 h-[72px] bg-slate-100 rounded-xl animate-pulse" />)
            : filtered.length === 0
            ? <div className="text-center py-16 text-slate-400 text-xs">Sin vehículos</div>
            : filtered.map((v) => {
                const state      = v.engineState ?? "Off";
                const kph        = toKph(v.speedMph);
                const isSelected = selectedId === v.id;
                const stopMins   = state === "Off" ? stoppedMinutes(v.updatedAt) : 0;
                const hasAlert   = stopMins >= ALERT_STOP_MIN;

                return (
                  <button key={v.id} onClick={() => { setSelectedId(isSelected ? null : v.id); setTripPath(null); setReplayMarker(null); setShowReplay(false); setCycles(null); stopReplay(); }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer ${isSelected ? "bg-[#CC2229]/5" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-900 text-sm font-bold truncate leading-tight">{v.name}</p>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${speedBadgeCls(kph)}`}>{kph} KM/H</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATE_DOT[state]}`} />
                      <p className="text-slate-500 text-[11px] truncate">{shortAddr(v.address)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {v.driverName && <p className="text-slate-400 text-[10px] flex items-center gap-1"><User size={9} className="shrink-0" />{v.driverName}</p>}
                      {v.plantStatus && v.plantStatus !== "En ruta" && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${PLANT_BADGE[v.plantStatus]}`}>
                          {v.nearPlant ?? v.plantStatus}
                        </span>
                      )}
                    </div>
                    {hasAlert && (
                      <p className="text-red-500 text-[10px] mt-0.5 font-semibold flex items-center gap-1">
                        <AlertTriangle size={9} />{stopMins >= 60 ? `Detenido ${Math.floor(stopMins / 60)}h ${stopMins % 60}min` : `Detenido ${stopMins}min`}
                      </p>
                    )}
                    {v.fuelPct != null && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Zap size={9} className="text-slate-400 shrink-0" />
                        <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${v.fuelPct > 40 ? "bg-emerald-500" : v.fuelPct > 20 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${v.fuelPct}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400 shrink-0">{v.fuelPct}%</span>
                      </div>
                    )}
                  </button>
                );
              })
          }
        </div>

        {/* Footer — export + legend */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50">
          <div className="px-3 pt-2 pb-1 flex flex-col gap-1.5">
            <button
              onClick={fetchProductivity}
              disabled={vehicles.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#CC2229] text-white text-[10px] font-semibold hover:bg-[#b01e24] cursor-pointer disabled:opacity-40 transition-colors"
            >
              <Activity size={11} />Productividad del día — {vehicles.length} unidades
            </button>
            <button
              onClick={loadServicios}
              disabled={vehicles.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 cursor-pointer disabled:opacity-40 transition-colors"
            >
              <Wrench size={11} />
              Servicios predictivos
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-700 uppercase tracking-wide">Beta</span>
            </button>
          </div>
          <div className="flex gap-1.5 px-3 pt-1">
            <button
              onClick={() => exportCsv(vehicles, `flota_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
            >
              <Download size={10} />Posiciones
            </button>
            {tripPath && (
              <button
                onClick={() => exportTripCsv(tripPath, tripVehicle)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold hover:bg-blue-100 cursor-pointer"
              >
                <Download size={10} />Ruta CSV
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 py-2">
            {[["En ruta","bg-emerald-500"],["Ralentí","bg-amber-400"],["Parado","bg-slate-400"],["Alerta","bg-red-500"],["Planta","bg-purple-500"]].map(([lbl, cls]) => (
              <div key={lbl} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />
                <span className="text-[9px] text-slate-500">{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 relative">
        <FlotaMap
          vehicles={vehicles}
          selectedId={selectedId}
          onVehicleClick={(id) => {
            setSelectedId((prev) => prev === id ? null : id);
            setTripPath(null);
            setReplayMarker(null);
            setShowReplay(false);
            setCycles(null);
            stopReplay();
          }}
          className="w-full h-full"
          showTraffic={showTraffic}
          mapType={mapType}
          tripPath={tripPath}
          geofences={PLANTS}
          replayMarker={showReplay ? replayMarker : null}
        />

        {/* Map controls */}
        <div className="absolute top-3 left-3 z-[500] flex flex-col gap-2">
          <button onClick={() => setShowTraffic((p) => !p)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm cursor-pointer ${showTraffic ? "bg-orange-500 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            <Activity size={12} />Tráfico
          </button>
          <button onClick={() => setMapType((t) => t === "roadmap" ? "satellite" : "roadmap")} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm cursor-pointer ${mapType === "satellite" ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            <Layers size={12} />{mapType === "satellite" ? "Mapa" : "Satélite"}
          </button>
          {tripPath && <button onClick={() => { setTripPath(null); setReplayMarker(null); setShowReplay(false); setCycles(null); stopReplay(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm bg-blue-600 text-white border-blue-700 hover:bg-blue-700 cursor-pointer"><X size={12} />Limpiar ruta</button>}
        </div>

        {/* Alert badge */}
        {alertCount > 0 && !selected && (
          <div className="absolute top-3 right-3 z-[500] flex items-center gap-2 bg-white border border-red-200 rounded-xl px-3 py-2 shadow-sm">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-xs font-semibold text-red-600">{alertCount} {alertCount === 1 ? "unidad detenida" : "unidades detenidas"} &gt;{ALERT_STOP_MIN}min</span>
          </div>
        )}

        {/* Replay controls */}
        {showReplay && tripPath && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500]">
            <ReplayControls
              active={replayActive} idx={replayIdx} total={tripPath.length} speed={replaySpeed}
              onPlay={() => { setShowReplay(true); startReplay(); }}
              onPause={stopReplay}
              onReset={resetReplay}
              onSpeedChange={setReplaySpeed}
              onClose={() => { stopReplay(); setShowReplay(false); setReplayMarker(null); }}
            />
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div className="absolute top-3 right-3 z-[500]">
            <VehicleDetailPanel
              v={selected}
              onClose={() => { setSelectedId(null); setTripPath(null); setReplayMarker(null); setShowReplay(false); setCycles(null); stopReplay(); }}
              onShowTrip={fetchTripHistory}
              tripLoading={tripLoading}
              hasTripPath={!!tripPath}
              tripPath={tripPath}
              onStartReplay={() => { setShowReplay(true); startReplay(); }}
              cycles={cycles}
            />
          </div>
        )}
      </div>
    </div>
  );
}
