"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, ChevronDown, ChevronUp, Clock,
  Fuel, Gauge, Loader2, MapPin, Navigation, RefreshCw, Search,
  Timer, Truck, User, Wifi, WifiOff, X,
} from "lucide-react";
import type { VehicleLocation } from "@/components/FlotaMap";

const FlotaMap = dynamic(() => import("@/components/FlotaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  ),
});

const REFRESH_FAST = 5_000;   // GPS positions + engine state
const REFRESH_SLOW = 30_000;  // vehicle catalog, odometer, fuel, driver assignments

// ─── Samsara raw types ────────────────────────────────────────────────────────

type SamsaraVehicle = {
  id: string; name: string;
  licensePlate?: string; vin?: string; make?: string; model?: string; year?: number;
  tags?: { name: string }[];
};

type SamsaraLocationVehicle = {
  id: string; name: string;
  location?: {
    latitude: number; longitude: number;
    speedMilesPerHour?: number; headingDegrees?: number; time?: string;
    reverseGeo?: { formattedLocation?: string };
  };
};

type SamsaraDriverAssignment = {
  id: string;
  driver?: { name: string; id: string };
};

type SamsaraStatVehicle = {
  id: string;
  engineStates?:      { value: "On" | "Off" | "Idle" }[];
  obdOdometerMeters?: { value: number }[];
  obdEngineSeconds?:  { value: number }[];
  fuelPercents?:      { value: number }[];
  gpsOdometerMeters?: { value: number }[];
};

// ─── Merged vehicle type ──────────────────────────────────────────────────────

export type RichVehicle = VehicleLocation & {
  licensePlate?: string;
  vin?:          string;
  make?:         string;
  model?:        string;
  year?:         number;
  driverName?:   string;
  odometerKm?:   number;
  engineHours?:  number;
  fuelPct?:      number;
  tags?:         string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert mph → kph, round to integer, threshold < 3 km/h = 0 (eliminates GPS noise)
function toKph(mph: number): number {
  const kph = mph * 1.60934;
  return kph < 3 ? 0 : Math.round(kph);
}

// 16-point compass label
function compassLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// First meaningful segment of an address
function shortAddr(addr: string): string {
  if (!addr) return "Sin ubicación";
  return addr.split(",")[0].trim().slice(0, 38);
}

// How long ago the GPS was updated
function staleness(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}min`;
  return `hace ${Math.floor(secs / 3600)}h`;
}

// ─── State theme tokens (light theme) ────────────────────────────────────────

const STATE_LABEL: Record<string, string> = { On: "En ruta", Idle: "En ralentí", Off: "Apagado" };
const STATE_DOT:   Record<string, string> = { On: "bg-emerald-500", Idle: "bg-amber-500", Off: "bg-slate-400" };
const STATE_BG:    Record<string, string> = { On: "bg-emerald-50 border-emerald-200", Idle: "bg-amber-50 border-amber-200", Off: "bg-slate-50 border-slate-200" };
const STATE_TEXT:  Record<string, string> = { On: "text-emerald-700", Idle: "text-amber-700", Off: "text-slate-500" };

// ─── Merge fast (engineStates) + slow (odometer, fuel) stats ─────────────────

function mergeStats(
  fast: { data?: SamsaraStatVehicle[] },
  slow: { data?: SamsaraStatVehicle[] },
): { data?: SamsaraStatVehicle[] } {
  const merged = new Map<string, SamsaraStatVehicle>();
  (slow?.data ?? []).forEach((v) => merged.set(v.id, { ...v }));
  (fast?.data ?? []).forEach((v) => {
    const existing = merged.get(v.id) ?? { id: v.id };
    merged.set(v.id, { ...existing, engineStates: v.engineStates });
  });
  return { data: Array.from(merged.values()) };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseAll(
  vehicles:    { data?: SamsaraVehicle[] },
  locations:   { data?: SamsaraLocationVehicle[] },
  stats:       { data?: SamsaraStatVehicle[] },
  assignments: { data?: SamsaraDriverAssignment[] },
): RichVehicle[] {
  const vMap = new Map<string, SamsaraVehicle>();
  (vehicles.data ?? []).forEach((v) => vMap.set(v.id, v));

  const sMap = new Map<string, SamsaraStatVehicle>();
  (stats.data ?? []).forEach((v) => sMap.set(v.id, v));

  const dMap = new Map<string, string>();
  (assignments.data ?? []).forEach((a) => { if (a.driver?.name) dMap.set(a.id, a.driver.name); });

  return (locations.data ?? [])
    .filter((v) => v.location?.latitude && v.location?.longitude)
    .map((v) => {
      const meta     = vMap.get(v.id);
      const stat     = sMap.get(v.id);
      const odom     = stat?.obdOdometerMeters?.[0]?.value ?? stat?.gpsOdometerMeters?.[0]?.value;
      const eng      = stat?.obdEngineSeconds?.[0]?.value;
      const fuel     = stat?.fuelPercents?.[0]?.value;
      const obdState = stat?.engineStates?.[0]?.value;
      const speedMph = v.location!.speedMilesPerHour ?? 0;
      const state: "On" | "Off" | "Idle" = obdState ?? (speedMph > 0.5 ? "On" : "Off");

      return {
        id:             v.id,
        name:           v.name,
        lat:            v.location!.latitude,
        lng:            v.location!.longitude,
        speedMph,
        headingDegrees: v.location!.headingDegrees ?? 0,
        address:        v.location!.reverseGeo?.formattedLocation ?? "",
        updatedAt:      v.location!.time ?? new Date().toISOString(),
        engineState:    state,
        licensePlate:   meta?.licensePlate,
        vin:            meta?.vin,
        make:           meta?.make,
        model:          meta?.model,
        year:           meta?.year,
        tags:           meta?.tags?.map((t) => t.name),
        driverName:     dMap.get(v.id),
        odometerKm:     odom != null ? Math.round(odom / 1000) : undefined,
        engineHours:    eng  != null ? Math.round(eng / 3600)  : undefined,
        fuelPct:        fuel != null ? Math.round(fuel)        : undefined,
      };
    });
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-slate-500 text-xs w-28 shrink-0">{label}</span>
      <span className="text-slate-900 text-xs font-medium text-right flex-1 truncate">{children}</span>
    </div>
  );
}

function VehicleDetailPanel({ v, onClose }: { v: RichVehicle; onClose: () => void }) {
  const state   = v.engineState ?? "Off";
  const kph     = toKph(v.speedMph);
  const heading = v.headingDegrees;
  const [open, setOpen] = useState(true);

  return (
    <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-slate-900 font-bold text-sm truncate">{v.name}</p>
            {v.make && (
              <p className="text-slate-400 text-xs mt-0.5">
                {[v.year, v.make, v.model].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer mt-0.5">
            <X size={15} />
          </button>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border mt-2.5 ${STATE_BG[state]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[state]}`} />
          <span className={STATE_TEXT[state]}>{STATE_LABEL[state]}</span>
        </span>
      </div>

      {/* Speed + heading hero */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-end gap-1.5">
          <span className="text-slate-900 text-3xl font-bold tabular-nums leading-none">{kph}</span>
          <span className="text-slate-400 text-sm mb-0.5">km/h</span>
        </div>
        {heading > 0 ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Navigation
              size={14}
              className="text-[#CC2229]"
              style={{ transform: `rotate(${heading}deg)` }}
            />
            <div className="text-right">
              <p className="text-slate-800 text-xs font-semibold">{compassLabel(heading)}</p>
              <p className="text-slate-400 text-[10px]">{Math.round(heading)}°</p>
            </div>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">{kph === 0 ? "Detenido" : "—"}</span>
        )}
      </div>

      {/* Collapsible data rows */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Detalles {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {open && (
          <div className="px-4 pb-2">
            <DetailRow icon={<MapPin size={13} />} label="Ubicación">
              {v.address || "Sin dirección"}
            </DetailRow>
            {v.driverName && (
              <DetailRow icon={<User size={13} />} label="Conductor">
                {v.driverName}
              </DetailRow>
            )}
            {v.odometerKm != null && (
              <DetailRow icon={<Activity size={13} />} label="Odómetro">
                {v.odometerKm.toLocaleString("es-MX")} km
              </DetailRow>
            )}
            {v.engineHours != null && (
              <DetailRow icon={<Timer size={13} />} label="Horas motor">
                {v.engineHours.toLocaleString("es-MX")} h
              </DetailRow>
            )}
            {v.fuelPct != null && (
              <div className="flex items-center gap-3 py-2.5 border-b border-slate-100">
                <span className="text-slate-400 shrink-0"><Fuel size={13} /></span>
                <span className="text-slate-500 text-xs w-28 shrink-0">Combustible</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${v.fuelPct > 40 ? "bg-emerald-500" : v.fuelPct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${v.fuelPct}%` }}
                    />
                  </div>
                  <span className="text-slate-900 text-xs font-medium shrink-0">{v.fuelPct}%</span>
                </div>
              </div>
            )}
            {v.licensePlate && (
              <DetailRow icon={<Truck size={13} />} label="Placa">
                {v.licensePlate}
              </DetailRow>
            )}
            {v.vin && (
              <DetailRow icon={<Gauge size={13} />} label="VIN">
                {v.vin}
              </DetailRow>
            )}
            <DetailRow icon={<Clock size={13} />} label="Actualizado">
              {new Date(v.updatedAt).toLocaleTimeString("es-MX")} · {staleness(v.updatedAt)}
            </DetailRow>
            {v.tags?.length ? (
              <DetailRow icon={<Activity size={13} />} label="Etiquetas">
                {v.tags.join(", ")}
              </DetailRow>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlotaEnVivoPage() {
  const [vehicles,   setVehicles]   = useState<RichVehicle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [online,     setOnline]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter,     setFilter]     = useState<"todos" | "on" | "off">("todos");

  const fastTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef    = useRef<Record<string, { lat: number; lng: number; ts: number }>>({});
  const speedHistRef  = useRef<Record<string, number[]>>({});
  // Slow-changing data cached between fast refreshes
  const slowCacheRef  = useRef<{
    vehicles:    { data?: SamsaraVehicle[] };
    stats:       { data?: SamsaraStatVehicle[] };
    assignments: { data?: SamsaraDriverAssignment[] };
  }>({ vehicles: {}, stats: {}, assignments: {} });

  const applyData = useCallback((
    locations:   { data?: SamsaraLocationVehicle[] },
    fastStats:   { data?: SamsaraStatVehicle[] },
  ) => {
    // Merge fast stats (engineStates) with cached slow stats (odometer, fuel, etc.)
    const mergedStats = mergeStats(fastStats, slowCacheRef.current.stats);
    const parsed = parseAll(
      slowCacheRef.current.vehicles,
      locations,
      mergedStats,
      slowCacheRef.current.assignments,
    );
    const now = Date.now();

    const enriched = parsed.map((v) => {
      const prev = lastPosRef.current[v.id];
      lastPosRef.current[v.id] = { lat: v.lat, lng: v.lng, ts: now };

      let effectiveSpeedMph = v.speedMph;

      // Haversine fallback when Samsara reports 0 but position moved
      if (effectiveSpeedMph < 0.3 && prev) {
        const distKm  = haversineKm(prev.lat, prev.lng, v.lat, v.lng);
        const dtHours = (now - prev.ts) / 3_600_000;
        if (dtHours > 0 && dtHours < 0.017 && distKm > 0.005) {
          const estKph = distKm / dtHours;
          if (estKph > 2 && estKph < 200) effectiveSpeedMph = estKph / 1.60934;
        }
      }

      // Rolling average INCLUDING zeros over 6 readings (~30s at 5s interval).
      // A single 0 from a GPS glitch or red light won't flip the state.
      if (!speedHistRef.current[v.id]) speedHistRef.current[v.id] = [];
      const hist = speedHistRef.current[v.id];
      hist.push(effectiveSpeedMph * 1.60934);
      if (hist.length > 6) hist.shift();

      const avgKph   = hist.reduce((a, b) => a + b, 0) / hist.length;
      const isMoving = avgKph > 2;

      return {
        ...v,
        speedMph:    avgKph / 1.60934,
        engineState: isMoving ? "On" as const : (v.engineState ?? "Off"),
      };
    });

    setVehicles(enriched);
    setLastUpdate(new Date());
    setOnline(true);
  }, []);

  // Fast refresh: locations + engine state only (5s)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  // Slow refresh: vehicle catalog, odometer, fuel, driver assignments (30s)
  const fetchSlow = useCallback(async () => {
    try {
      const [vRes, sRes, aRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=obdOdometerMeters%2CgpsOdometerMeters%2CobdEngineSeconds%2CfuelPercents"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fdriver-assignments"),
      ]);
      const [vData, sData, aData] = await Promise.all([
        vRes.ok ? vRes.json() : Promise.resolve({}),
        sRes.ok ? sRes.json() : Promise.resolve({}),
        aRes.ok ? aRes.json() : Promise.resolve({}),
      ]);
      if (vData.data) slowCacheRef.current.vehicles    = vData;
      if (sData.data) slowCacheRef.current.stats       = sData;
      if (aData.data) slowCacheRef.current.assignments = aData;
    } catch {
      // Slow data failure is non-critical — fast GPS data keeps running
    }
  }, []);

  useEffect(() => {
    // Load slow data first, then start fast polling
    fetchSlow().then(() => fetchFast(false));
    fastTimerRef.current = setInterval(() => fetchFast(true), REFRESH_FAST);
    slowTimerRef.current = setInterval(fetchSlow, REFRESH_SLOW);
    return () => {
      if (fastTimerRef.current) clearInterval(fastTimerRef.current);
      if (slowTimerRef.current) clearInterval(slowTimerRef.current);
    };
  }, [fetchFast, fetchSlow]);

  const [search, setSearch] = useState("");

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const on   = vehicles.filter((v) => v.engineState === "On").length;
  const idle = vehicles.filter((v) => v.engineState === "Idle").length;
  const off  = vehicles.filter((v) => !v.engineState || v.engineState === "Off").length;

  const filtered = vehicles.filter((v) => {
    const matchFilter =
      filter === "todos" ? true :
      filter === "on"    ? v.engineState === "On" || v.engineState === "Idle" :
      v.engineState === "Off" || !v.engineState;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.address.toLowerCase().includes(q) || (v.driverName?.toLowerCase().includes(q) ?? false);
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm" style={{ height: "calc(100vh - 96px)" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-slate-200 bg-white">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {online ? <Wifi size={9} /> : <WifiOff size={9} />}
                {online ? "Samsara · En vivo" : "Sin conexión"}
              </span>
              {lastUpdate && (
                <span className="text-[10px] text-slate-400">{lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              )}
            </div>
            <button onClick={() => { fetchSlow(); fetchFast(false); }} disabled={loading} className="text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-40">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vehículo, conductor…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/20 focus:border-[#CC2229]/40"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={11} /></button>}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-slate-100 shrink-0">
          {([["todos", `Todos ${vehicles.length}`], ["on", `En ruta ${on + idle}`], ["off", `Parados ${off}`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer border-b-2 ${
                filter === key
                  ? "border-[#CC2229] text-[#CC2229]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 m-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-600">
              <AlertCircle size={13} />{error}
            </div>
          )}

          {loading && vehicles.length === 0
            ? [...Array(8)].map((_, i) => (
                <div key={i} className="mx-3 my-1.5 h-[72px] bg-slate-100 rounded-xl animate-pulse" />
              ))
            : filtered.length === 0
            ? <div className="text-center py-16 text-slate-400 text-xs">Sin vehículos</div>
            : filtered.map((v) => {
                const state      = v.engineState ?? "Off";
                const kph        = toKph(v.speedMph);
                const isSelected = selectedId === v.id;
                const stoppedSecs = Math.floor((Date.now() - new Date(v.updatedAt).getTime()) / 1000);
                const isLongStopped = state === "Off" && stoppedSecs > 3600;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(isSelected ? null : v.id)}
                    className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors cursor-pointer ${
                      isSelected ? "bg-[#CC2229]/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-900 text-sm font-bold truncate leading-tight">{v.name}</p>
                      {kph > 0
                        ? <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{kph} KM/H</span>
                        : <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">0 KM/H</span>
                      }
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATE_DOT[state]}`} />
                      <p className="text-slate-500 text-[11px] truncate">{shortAddr(v.address)}</p>
                    </div>
                    {v.driverName && (
                      <p className="text-slate-400 text-[10px] mt-0.5 truncate">{v.driverName}</p>
                    )}
                    {isLongStopped && (
                      <p className="text-red-500 text-[10px] mt-0.5 font-medium">Vehículo detenido · {staleness(v.updatedAt)}</p>
                    )}
                    {v.fuelPct != null && (
                      <div className="flex items-center gap-1.5 mt-1.5">
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

        {/* Footer legend */}
        <div className="shrink-0 flex items-center justify-center gap-5 py-2.5 border-t border-slate-100 bg-slate-50">
          {[["En ruta","bg-emerald-500"], ["Ralentí","bg-amber-400"], ["Apagado","bg-slate-400"]].map(([lbl, cls]) => (
            <div key={lbl} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cls}`} />
              <span className="text-[10px] text-slate-500">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Map + detail ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 relative">
        <FlotaMap vehicles={vehicles} selectedId={selectedId} className="w-full h-full" />

        {/* Detail panel — floats over map */}
        {selected && (
          <div className="absolute top-3 right-3 z-[500]">
            <VehicleDetailPanel v={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
