"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, ChevronRight, Compass, Fuel, Gauge,
  Loader2, MapPin, RefreshCw, Timer, Truck, User, Wifi, WifiOff, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import type { VehicleLocation } from "@/components/FlotaMap";

const FlotaMap = dynamic(() => import("@/components/FlotaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  ),
});

const REFRESH = 10_000;

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

// ─── Haversine (km) ───────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      const meta    = vMap.get(v.id);
      const stat    = sMap.get(v.id);
      const odom    = stat?.obdOdometerMeters?.[0]?.value ?? stat?.gpsOdometerMeters?.[0]?.value;
      const eng     = stat?.obdEngineSeconds?.[0]?.value;
      const fuel    = stat?.fuelPercents?.[0]?.value;
      const obdState = stat?.engineStates?.[0]?.value;
      const speedMph = v.location!.speedMilesPerHour ?? 0;
      const state: "On" | "Off" | "Idle" =
        obdState ?? (speedMph > 0 ? "On" : "Off");

      return {
        id:             v.id,
        name:           v.name,
        lat:            v.location!.latitude,
        lng:            v.location!.longitude,
        speedMph,
        headingDegrees: v.location!.headingDegrees    ?? 0,
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

const STATE_LABEL: Record<string, string> = { On: "En ruta", Idle: "En ralentí", Off: "Apagado" };
const STATE_COLOR: Record<string, string> = { On: "text-emerald-600", Idle: "text-amber-600", Off: "text-slate-500" };
const STATE_BG:    Record<string, string> = { On: "bg-emerald-50 border-emerald-200", Idle: "bg-amber-50 border-amber-200", Off: "bg-slate-50 border-slate-200" };
const STATE_DOT:   Record<string, string> = { On: "bg-emerald-500", Idle: "bg-amber-500", Off: "bg-slate-400" };

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-slate-500 text-xs w-28 shrink-0">{label}</span>
      <span className="text-slate-900 text-xs font-medium text-right flex-1 truncate">{value}</span>
    </div>
  );
}

function VehicleDetailPanel({ v, onClose }: { v: RichVehicle; onClose: () => void }) {
  const state = v.engineState ?? "Off";
  const speedKph = (v.speedMph * 1.60934).toFixed(1);

  return (
    <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-slate-900 font-bold text-sm truncate">{v.name}</p>
            {v.make && <p className="text-slate-400 text-xs mt-0.5">{[v.year, v.make, v.model].filter(Boolean).join(" ")}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer mt-0.5">
            <X size={15} />
          </button>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border mt-2.5 ${STATE_BG[state]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[state]}`} />
          <span className={STATE_COLOR[state]}>{STATE_LABEL[state]}</span>
        </span>
      </div>

      {/* Data */}
      <div className="flex-1 overflow-y-auto px-4 py-1">
        <DetailRow icon={<MapPin size={13} />}  label="Ubicación"      value={v.address || "Sin dirección"} />
        <DetailRow icon={<Gauge size={13} />}   label="Velocidad"      value={`${speedKph} km/h`} />
        <DetailRow icon={<Compass size={13} />} label="Dirección"      value={`${v.headingDegrees}°`} />
        {v.driverName    && <DetailRow icon={<User size={13} />}     label="Conductor"    value={v.driverName} />}
        {v.odometerKm != null && <DetailRow icon={<Activity size={13} />} label="Odómetro"  value={`${v.odometerKm.toLocaleString("es-MX")} km`} />}
        {v.engineHours != null && <DetailRow icon={<Timer size={13} />}   label="Horas motor" value={`${v.engineHours.toLocaleString("es-MX")} h`} />}
        {v.fuelPct != null && (
          <div className="flex items-center gap-3 py-2.5 border-b border-slate-100">
            <span className="text-slate-400 shrink-0"><Fuel size={13} /></span>
            <span className="text-slate-500 text-xs w-28 shrink-0">Combustible</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${v.fuelPct > 25 ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${v.fuelPct}%` }}
                />
              </div>
              <span className="text-slate-900 text-xs font-medium shrink-0">{v.fuelPct}%</span>
            </div>
          </div>
        )}
        {v.licensePlate && <DetailRow icon={<Truck size={13} />}  label="Placa"         value={v.licensePlate} />}
        {v.vin          && <DetailRow icon={<ChevronRight size={13} />} label="VIN"     value={v.vin} />}
        <DetailRow icon={<Timer size={13} />} label="Última actualiz." value={new Date(v.updatedAt).toLocaleTimeString("es-MX")} />
        {v.tags?.length ? <DetailRow icon={<Activity size={13} />} label="Etiquetas" value={v.tags.join(", ")} /> : null}
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
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef  = useRef<Record<string, { lat: number; lng: number; ts: number }>>({});

  const fetch$ = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [vRes, lRes, sRes, aRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Flocations"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=engineStates%2CobdOdometerMeters%2CobdEngineSeconds%2CfuelPercents%2CgpsOdometerMeters"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fdriver-assignments"),
      ]);
      if (!lRes.ok) throw new Error("Error al obtener ubicaciones");
      const [vData, lData, sData, aData] = await Promise.all([
        vRes.json(), lRes.json(), sRes.json(), aRes.ok ? aRes.json() : Promise.resolve({ data: [] }),
      ]);
      const parsed = parseAll(vData, lData, sData, aData);
      const now = Date.now();

      const enriched = parsed.map((v) => {
        const prev = lastPosRef.current[v.id];
        const cur  = { lat: v.lat, lng: v.lng, ts: now };
        lastPosRef.current[v.id] = cur;

        if (!prev) return v;

        const distKm   = haversineKm(prev.lat, prev.lng, v.lat, v.lng);
        const dtHours  = (now - prev.ts) / 3_600_000;
        const calcKph  = dtHours > 0 ? distKm / dtHours : 0;

        const realSpeedMph = v.speedMph > 0 ? v.speedMph : calcKph / 1.60934;
        const isMoving     = realSpeedMph > 0.3;

        if (!isMoving) return v;
        return {
          ...v,
          speedMph:    realSpeedMph,
          engineState: (v.engineState === "Off" || !v.engineState) ? "On" as const : v.engineState,
        };
      });
      setVehicles(enriched);
      setLastUpdate(new Date());
      setOnline(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
      setOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch$(false);
    timerRef.current = setInterval(() => fetch$(true), REFRESH);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch$]);

  const selected = vehicles.find((v) => v.id === selectedId) ?? null;
  const on   = vehicles.filter((v) => v.engineState === "On").length;
  const idle = vehicles.filter((v) => v.engineState === "Idle").length;
  const off  = vehicles.filter((v) => !v.engineState || v.engineState === "Off").length;

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 112px)" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
            online
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-600 border-red-200"
          }`}>
            {online ? <Wifi size={11} /> : <WifiOff size={11} />}
            {online ? "Conectado · Samsara" : "Sin conexión"}
          </span>
          {lastUpdate && (
            <span className="text-xs text-slate-400">
              Actualizado {lastUpdate.toLocaleTimeString("es-MX")} · auto 10s
            </span>
          )}
        </div>
        <button
          onClick={() => fetch$(false)} disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <KPICard title="Total flota" value={loading ? "—" : String(vehicles.length)} icon={Truck}    iconColor="text-[#CC2229]"   iconBg="bg-[#CC2229]/10" active={filter === "todos"} onClick={() => setFilter("todos")} />
        <KPICard title="En ruta"     value={loading ? "—" : String(on)}              icon={Activity} iconColor="text-emerald-600" iconBg="bg-emerald-50"    active={filter === "on"}    onClick={() => setFilter("on")} />
        <KPICard title="En ralentí"  value={loading ? "—" : String(idle)}            icon={Activity} iconColor="text-amber-600"   iconBg="bg-amber-50"      active={filter === "on"}    onClick={() => setFilter("on")} />
        <KPICard title="Apagados"    value={loading ? "—" : String(off)}             icon={Truck}    iconColor="text-slate-400"   iconBg="bg-slate-100"     active={filter === "off"}   onClick={() => setFilter("off")} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 shrink-0">
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* Map row */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Vehicle list */}
        <div className="w-56 shrink-0 flex flex-col gap-2 min-h-0">
          {/* Quick filters */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
            {([ ["todos","Todos"], ["on","En ruta"], ["off","Parados"] ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filter === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {loading && vehicles.length === 0
              ? [...Array(6)].map((_, i) => (
                  <div key={i} className="h-[68px] bg-slate-100 rounded-xl border border-slate-200 animate-pulse" />
                ))
              : vehicles
                  .filter((v) =>
                    filter === "todos" ? true :
                    filter === "on"    ? v.engineState === "On" || v.engineState === "Idle" :
                    v.engineState === "Off" || !v.engineState
                  )
                  .map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-colors cursor-pointer ${
                        selectedId === v.id
                          ? "bg-[#CC2229]/5 border-[#CC2229]/25"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATE_DOT[v.engineState ?? "Off"]}`} />
                        <div className="min-w-0">
                          <p className="text-slate-900 text-xs font-semibold truncate">{v.name}</p>
                          <p className="text-slate-400 text-[10px] truncate leading-tight mt-0.5">{v.address || "Sin ubicación"}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">
                            {(v.speedMph * 1.60934).toFixed(0)} km/h · {STATE_LABEL[v.engineState ?? "Off"]}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
            }
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-slate-200">
          <FlotaMap vehicles={vehicles} selectedId={selectedId} className="w-full h-full" />
        </div>

        {/* Detail panel */}
        {selected && (
          <VehicleDetailPanel v={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}
