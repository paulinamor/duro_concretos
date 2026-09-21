"use client";

import { useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Clock, Fuel, Gauge,
  Loader2, MapPin, RefreshCw, Shield, Timer, Truck, User, Zap,
} from "lucide-react";

type EndpointGroup = {
  group:  string;
  icon:   React.ElementType;
  color:  string;
  items:  EndpointDef[];
};

type EndpointDef = {
  label:    string;
  endpoint: string;
  desc:     string;
  params?:  Record<string, string>;
  note?:    string;
};

const GROUPS: EndpointGroup[] = [
  {
    group: "Vehículos",
    icon:  Truck,
    color: "text-[#CC2229]",
    items: [
      {
        label:    "Lista de vehículos",
        endpoint: "/fleet/vehicles",
        desc:     "Todos los vehículos: nombre, placa, VIN, marca, modelo",
      },
      {
        label:    "Ubicaciones GPS en vivo",
        endpoint: "/fleet/vehicles/locations",
        desc:     "Posición actual, velocidad, rumbo, dirección geocodificada",
      },
      {
        label:    "Estado del motor + combustible",
        endpoint: "/fleet/vehicles/stats",
        desc:     "On/Off/Idle y nivel de combustible por vehículo",
        params:   { types: "engineStates,fuelPercents" },
      },
      {
        label:    "Odómetro OBD + GPS + Horas motor",
        endpoint: "/fleet/vehicles/stats",
        desc:     "Odómetro OBD/GPS en metros y horas de motor acumuladas",
        params:   { types: "obdOdometerMeters,gpsOdometerMeters,obdEngineSeconds" },
      },
    ],
  },
  {
    group: "Viajes (Trips)",
    icon:  Activity,
    color: "text-blue-500",
    items: [
      {
        label:    "Resumen de viajes (últimas 24h)",
        endpoint: "/fleet/trips",
        desc:     "Origen/destino, distancia, duración, conductor por viaje",
        params:   { startTime: "", endTime: "" },
        note:     "startTime/endTime se calculan automáticamente (últimas 24h)",
      },
    ],
  },
  {
    group: "Conductores",
    icon:  User,
    color: "text-emerald-500",
    items: [
      {
        label:    "Lista de conductores",
        endpoint: "/fleet/drivers",
        desc:     "Todos los conductores activos con ID, nombre y licencia",
      },
      {
        label:    "Asignaciones actuales",
        endpoint: "/fleet/vehicles/driver-assignments",
        desc:     "Qué conductor está asignado a cada vehículo ahora mismo",
      },
      {
        label:    "HOS — Horas de servicio (hoy)",
        endpoint: "/fleet/hos/daily-logs",
        desc:     "Registro de horas de servicio por conductor (cumplimiento legal)",
        params:   { date: new Date().toISOString().slice(0, 10) },
        note:     "Requiere HOS activado en la cuenta Samsara",
      },
    ],
  },
  {
    group: "Seguridad",
    icon:  Shield,
    color: "text-amber-500",
    items: [
      {
        label:    "Puntajes de seguridad",
        endpoint: "/fleet/safety/scores",
        desc:     "Score de manejo seguro por vehículo/conductor",
        params:   {
          startTime: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          endTime:   new Date().toISOString(),
          type:      "vehicle",
        },
        note:     "Calificación 0-100 basada en frenadas, aceleración, uso de cinturón",
      },
      {
        label:    "Eventos de seguridad (últimas 24h)",
        endpoint: "/fleet/safety/events",
        desc:     "Frenadas bruscas, aceleración brusca, exceso de velocidad, distracción",
        params:   {
          startTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          endTime:   new Date().toISOString(),
        },
        note:     "Disponible si la cámara Samsara está instalada",
      },
    ],
  },
  {
    group: "Inspecciones (DVIR)",
    icon:  AlertTriangle,
    color: "text-orange-500",
    items: [
      {
        label:    "Reportes de inspección (DVIR)",
        endpoint: "/fleet/defects",
        desc:     "Defectos reportados en pre/post-viaje por conductor",
        params:   {
          startTime: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          endTime:   new Date().toISOString(),
        },
        note:     "Útil para alimentar Mantenimiento automáticamente",
      },
    ],
  },
  {
    group: "Combustible",
    icon:  Fuel,
    color: "text-sky-500",
    items: [
      {
        label:    "Transacciones de combustible",
        endpoint: "/fleet/fuel-transactions",
        desc:     "Cargas de diesel registradas via tarjeta o RFID Samsara",
        params:   {
          startTime: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
          endTime:   new Date().toISOString(),
        },
        note:     "Requiere integración con tarjeta de combustible (WEX, Fleetcor, etc.)",
      },
    ],
  },
  {
    group: "Alertas y eventos",
    icon:  Zap,
    color: "text-purple-500",
    items: [
      {
        label:    "Alertas activas",
        endpoint: "/fleet/alerts",
        desc:     "Alertas configuradas: batería baja, motor prendido estacionado, geofence, etc.",
        note:     "Puede estar en /fleet/alerts o /fleet/alerts/history según tu plan Samsara",
      },
      {
        label:    "Historial odómetro (últimos 30 días)",
        endpoint: "/fleet/vehicles/stats/history",
        desc:     "Serie de tiempo del odómetro para calcular km recorridos por período",
        params:   {
          types:     "obdOdometerMeters",
          startTime: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
          endTime:   new Date().toISOString(),
        },
        note:     "Perfecto para calcular km entre mantenimientos",
      },
    ],
  },
  {
    group: "Diagnóstico",
    icon:  Gauge,
    color: "text-slate-400",
    items: [
      {
        label:    "Códigos de falla (DTC)",
        endpoint: "/fleet/vehicles/stats",
        desc:     "Códigos OBD de falla activos en cada vehículo",
        params:   { types: "obdDiagnosticTroubleCodes" },
        note:     "Alimenta automáticamente Mantenimiento cuando aparece un código",
      },
    ],
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildProxyUrl(ep: EndpointDef): string {
  const [path, qs] = ep.endpoint.split("?");
  const params = new URLSearchParams(qs ?? "");

  // Auto-fill timestamps
  const merged = { ...(ep.params ?? {}) };
  if ("startTime" in merged && !merged.startTime) {
    merged.startTime = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    merged.endTime   = new Date().toISOString();
  }

  Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
  params.set("endpoint", path);
  return `/api/samsara?${params.toString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Result = { data: unknown; ok: boolean; ms: number; status?: number };

export default function SamsaraTestPage() {
  const [results,  setResults]  = useState<Record<string, Result | null>>({});
  const [loading,  setLoading]  = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const key = (ep: EndpointDef) => `${ep.endpoint}::${JSON.stringify(ep.params ?? {})}`;

  async function test(ep: EndpointDef) {
    const k = key(ep);
    setLoading((p) => ({ ...p, [k]: true }));
    const t0 = Date.now();
    try {
      const res  = await fetch(buildProxyUrl(ep));
      const data = await res.json();
      setResults((p) => ({ ...p, [k]: { data, ok: res.ok, ms: Date.now() - t0, status: res.status } }));
    } catch (e) {
      setResults((p) => ({ ...p, [k]: { data: { error: String(e) }, ok: false, ms: Date.now() - t0 } }));
    } finally {
      setLoading((p) => ({ ...p, [k]: false }));
    }
  }

  async function testGroup(group: EndpointGroup) {
    for (const ep of group.items) await test(ep);
  }

  async function testAll() {
    for (const g of GROUPS) await testGroup(g);
  }

  const totalTested   = Object.values(results).filter(Boolean).length;
  const totalOk       = Object.values(results).filter((r) => r?.ok).length;
  const totalEndpoints = GROUPS.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Samsara — Explorador de API</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Org ID 5007918 · Solo lectura · Datos reales de producción
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalTested > 0 && (
            <span className="text-sm text-gray-500">
              {totalOk}/{totalTested} OK
            </span>
          )}
          <button
            onClick={testAll}
            className="flex items-center gap-2 px-4 py-2 bg-[#CC2229] hover:bg-[#B01E24] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            <RefreshCw size={14} /> Probar todos ({totalEndpoints})
          </button>
        </div>
      </div>

      {/* Groups */}
      {GROUPS.map((group) => {
        const GroupIcon = group.icon;
        const groupOk  = group.items.filter((ep) => results[key(ep)]?.ok).length;

        return (
          <div key={group.group} className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
            {/* Group header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#3A3A3A]">
              <div className="flex items-center gap-2.5">
                <GroupIcon size={16} className={group.color} />
                <span className="font-semibold text-white text-sm">{group.group}</span>
                <span className="text-xs text-gray-500">{group.items.length} endpoint{group.items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                {groupOk > 0 && (
                  <span className="text-xs text-emerald-500 font-medium">{groupOk}/{group.items.length} OK</span>
                )}
                <button
                  onClick={() => testGroup(group)}
                  className="text-xs px-3 py-1.5 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229]/60 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Probar grupo
                </button>
              </div>
            </div>

            {/* Endpoints */}
            <div className="divide-y divide-[#2A2A2A]">
              {group.items.map((ep) => {
                const k         = key(ep);
                const r         = results[k];
                const isLoading = loading[k];
                const isExpanded = expanded[k];

                return (
                  <div key={k}>
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-white text-sm">{ep.label}</p>
                          {ep.note && (
                            <span className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded font-medium">
                              NOTA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{ep.desc}</p>
                        <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                          {ep.endpoint}
                          {ep.params && Object.keys(ep.params).length > 0 && (
                            <span className="text-gray-700">
                              ?{Object.entries(ep.params).filter(([, v]) => v).map(([k, v]) => `${k}=${v.length > 20 ? v.slice(0, 20) + "…" : v}`).join("&")}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r && (
                          <>
                            {r.ok
                              ? <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium whitespace-nowrap"><CheckCircle2 size={12} /> {r.ms}ms</span>
                              : <span className="flex items-center gap-1 text-xs text-red-400 font-medium whitespace-nowrap"><AlertCircle size={12} /> {r.status ?? "Error"}</span>
                            }
                            <button
                              onClick={() => setExpanded((p) => ({ ...p, [k]: !isExpanded }))}
                              className="p-1.5 text-gray-500 hover:text-white hover:bg-[#3A3A3A] rounded-lg transition-colors cursor-pointer"
                              title={isExpanded ? "Cerrar" : "Ver respuesta"}
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => test(ep)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229]/60 text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isLoading ? <Loader2 size={11} className="animate-spin" /> : null}
                          {isLoading ? "Probando…" : "Probar"}
                        </button>
                      </div>
                    </div>

                    {/* Note */}
                    {ep.note && (
                      <div className="px-5 pb-2">
                        <p className="text-[11px] text-amber-400/70 bg-amber-400/5 border border-amber-400/10 rounded-lg px-3 py-1.5">
                          {ep.note}
                        </p>
                      </div>
                    )}

                    {/* Response */}
                    {isExpanded && r && (
                      <div className="border-t border-[#2A2A2A] bg-[#1A1A1A] px-5 py-4">
                        {r.ok && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">
                              {Array.isArray((r.data as { data?: unknown })?.data)
                                ? `${((r.data as { data: unknown[] }).data).length} registros`
                                : "1 objeto"}
                            </span>
                            <Clock size={10} className="text-gray-600" />
                            <span className="text-xs text-gray-600">{r.ms}ms</span>
                          </div>
                        )}
                        <pre className="text-[11px] font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Automation map */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl p-5">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Zap size={15} className="text-[#CC2229]" />
          Mapa de automatizaciones disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              endpoint: "Odómetro + Horas motor",
              module: "Mantenimiento",
              action: "Pre-llenar KM y Horómetro al crear evento",
              icon: "🔧",
              ready: true,
            },
            {
              endpoint: "Ubicaciones GPS",
              module: "Flota en vivo",
              action: "Mapa en tiempo real con posición de cada unidad",
              icon: "📍",
              ready: true,
            },
            {
              endpoint: "Engine state + Fuel",
              module: "Dashboard",
              action: "Widget de flota: X en ruta, Y ralentí, Z apagados",
              icon: "⚡",
              ready: true,
            },
            {
              endpoint: "Trips (viajes)",
              module: "Programación",
              action: "Validar hora de salida/llegada vs programado",
              icon: "🗓️",
              ready: false,
            },
            {
              endpoint: "DVIR (defectos)",
              module: "Mantenimiento",
              action: "Crear falla automática si conductor reporta defecto",
              icon: "⚠️",
              ready: false,
            },
            {
              endpoint: "Fuel transactions",
              module: "Diesel",
              action: "Importar cargas de diesel desde tarjeta de combustible",
              icon: "⛽",
              ready: false,
            },
            {
              endpoint: "Safety scores",
              module: "Operadores",
              action: "Score de manejo seguro por chofer en su perfil",
              icon: "🛡️",
              ready: false,
            },
            {
              endpoint: "DTC fault codes",
              module: "Mantenimiento",
              action: "Alerta automática cuando aparece código de falla OBD",
              icon: "🔴",
              ready: false,
            },
          ].map((item) => (
            <div key={item.module + item.endpoint} className="flex items-start gap-3 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl p-3">
              <span className="text-lg shrink-0">{item.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white text-xs font-semibold">{item.module}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    item.ready
                      ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                      : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                  }`}>
                    {item.ready ? "ACTIVO" : "PENDIENTE"}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">{item.action}</p>
                <p className="text-gray-600 text-[10px] font-mono mt-0.5">{item.endpoint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
