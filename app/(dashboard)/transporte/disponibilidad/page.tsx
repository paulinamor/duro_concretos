"use client";

import { useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Clock, Truck, UsersRound } from "lucide-react";
import {
  bloquesCarga15Min,
  calcularImpactoDemoras,
  choferesDisponibilidad,
  disponibilidadProgramada,
  formatInputDate,
  formatTravelTime,
  unidadesDisponibilidad,
} from "@/lib/disponibilidadCargas";

export default function DisponibilidadCargasPage() {
  const [availabilityDate, setAvailabilityDate] = useState("2026-05-20");
  const [availabilityHour, setAvailabilityHour] = useState("08:00");
  const [selectedChofer, setSelectedChofer] = useState(choferesDisponibilidad[0]);
  const [selectedUnidad, setSelectedUnidad] = useState(unidadesDisponibilidad[0]);
  const availabilityFormattedDate = formatInputDate(availabilityDate);
  const busyItems = disponibilidadProgramada.filter((item) => (
    item.fecha === availabilityFormattedDate && item.hora === availabilityHour
  ));
  const demorasDia = disponibilidadProgramada.filter((item) => (
    item.fecha === availabilityFormattedDate && item.demoraMin > 0
  ));
  const impactoDemorasDia = calcularImpactoDemoras(availabilityFormattedDate);
  const viajesAtrasadosPorArrastre = impactoDemorasDia.filter((item) => item.seAtrasa);
  const viajesConRiesgo = impactoDemorasDia.filter((item) => item.demoraMin > 0 || item.seAtrasa);
  const demorasBloque = busyItems.filter((item) => item.demoraMin > 0);
  const minutosDemoraDia = demorasDia.reduce((total, item) => total + item.demoraMin, 0);
  const busyChoferes = new Set(busyItems.map((item) => item.chofer));
  const busyUnidades = new Set(busyItems.map((item) => item.unidad));
  const choferesLibres = choferesDisponibilidad.filter((chofer) => !busyChoferes.has(chofer));
  const unidadesLibres = unidadesDisponibilidad.filter((unidad) => !busyUnidades.has(unidad));
  const selectedChoferDisponible = !busyChoferes.has(selectedChofer);
  const selectedUnidadDisponible = !busyUnidades.has(selectedUnidad);
  const asignacionDisponible = selectedChoferDisponible && selectedUnidadDisponible;
  const choferOcupado = busyItems.find((item) => item.chofer === selectedChofer);
  const unidadOcupada = busyItems.find((item) => item.unidad === selectedUnidad);
  const capacidadCarga = Math.min(choferesLibres.length, unidadesLibres.length);
  const puedeCargar = capacidadCarga > 0;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#3A3A3A] bg-[#242424] overflow-hidden">
        <div className="border-b border-[#3A3A3A] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Seleccionar carga</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${
              asignacionDisponible
                ? "border-green-500/30 bg-green-500/10 text-green-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}>
              {asignacionDisponible ? "Disponible para cargar" : "No disponible"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Fecha</span>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  value={availabilityDate}
                  onChange={(event) => setAvailabilityDate(event.target.value)}
                  className="date-input-white w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Hora</span>
              <div className="relative">
                <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10" />
                <select
                  value={availabilityHour}
                  onChange={(event) => setAvailabilityHour(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] py-2 pl-9 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                >
                  {bloquesCarga15Min.map((hora) => <option key={hora}>{hora}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-[#3A3A3A]">
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">Chofer</h4>
              <span className="text-xs text-gray-500">{choferesLibres.length} libres</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {choferesDisponibilidad.map((chofer) => {
                const ocupado = busyChoferes.has(chofer);
                const selected = selectedChofer === chofer;
                return (
                  <button
                    key={chofer}
                    type="button"
                    onClick={() => setSelectedChofer(chofer)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-[#CC2229] bg-[#CC2229]/15"
                        : ocupado
                          ? "border-red-500/20 bg-red-500/10"
                          : "border-green-500/20 bg-green-500/10 hover:border-green-400/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{chofer}</p>
                    <p className={ocupado ? "text-xs text-red-300" : "text-xs text-green-300"}>
                      {ocupado ? "Ocupado" : "Libre"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white">Camión</h4>
              <span className="text-xs text-gray-500">{unidadesLibres.length} libres</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unidadesDisponibilidad.map((unidad) => {
                const ocupado = busyUnidades.has(unidad);
                const selected = selectedUnidad === unidad;
                return (
                  <button
                    key={unidad}
                    type="button"
                    onClick={() => setSelectedUnidad(unidad)}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-[#CC2229] bg-[#CC2229]/15"
                        : ocupado
                          ? "border-red-500/20 bg-red-500/10"
                          : "border-blue-500/20 bg-blue-500/10 hover:border-blue-400/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{unidad}</p>
                    <p className={ocupado ? "text-xs text-red-300" : "text-xs text-blue-300"}>
                      {ocupado ? "Ocupado" : "Libre"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[#3A3A3A] px-5 py-4">
          <p className="text-sm text-gray-500">
            Selección: <span className="font-semibold text-white">{selectedChofer}</span> · <span className="font-semibold text-white">{selectedUnidad}</span> · {availabilityFormattedDate} {availabilityHour}
          </p>
          {demorasBloque.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold text-amber-300">Demora en este bloque</p>
              <div className="mt-2 space-y-1">
                {demorasBloque.map((item) => (
                  <p key={`${item.fecha}-${item.hora}-${item.chofer}-demora`} className="text-xs text-gray-500">
                    {item.chofer} llegó {item.demoraMin} min tarde · programado {item.llegadaProgramada} / real {item.llegadaReal}
                  </p>
                ))}
              </div>
            </div>
          )}
          {!asignacionDisponible && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {!selectedChoferDisponible && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-300">Chofer ocupado</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {choferOcupado?.destino ?? "Ya tiene una carga asignada"} · {choferOcupado?.unidad ?? selectedUnidad}
                  </p>
                </div>
              )}
              {!selectedUnidadDisponible && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-300">Camión ocupado</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {unidadOcupada?.destino ?? "Ya tiene una carga asignada"} · {unidadOcupada?.chofer ?? selectedChofer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Disponibilidad seleccionada</h3>
          <p className="text-xs text-gray-500 mt-1">
            {availabilityFormattedDate} a las {availabilityHour}. Puede cargar solo si hay operador y camión.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#3A3A3A]">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1A1A1A] p-2.5 text-green-400">
                <UsersRound size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Choferes disponibles</p>
                <p className="text-2xl font-bold text-white">{choferesLibres.length}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1A1A1A] p-2.5 text-blue-400">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Camiones disponibles</p>
                <p className="text-2xl font-bold text-white">{unidadesLibres.length}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#1A1A1A] p-2.5 text-[#CC2229]">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Capacidad en este bloque</p>
                <p className={`text-2xl font-bold ${puedeCargar ? "text-green-400" : "text-red-400"}`}>{capacidadCarga}</p>
                <p className="text-xs text-gray-500">{puedeCargar ? "Puede cargar" : "Sin operador o camión"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-[#3A3A3A]">
          <div className="p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Choferes libres</h4>
            <div className="flex flex-wrap gap-2">
              {choferesLibres.map((chofer) => (
                <span key={chofer} className="rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-xs text-green-300">{chofer}</span>
              ))}
            </div>
          </div>
          <div className="p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Camiones libres</h4>
            <div className="flex flex-wrap gap-2">
              {unidadesLibres.map((unidad) => (
                <span key={unidad} className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">{unidad}</span>
              ))}
            </div>
          </div>
          <div className="p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Programados / ocupados</h4>
            <div className="space-y-2">
              {busyItems.length > 0 ? busyItems.map((item) => (
                <div key={`${item.fecha}-${item.hora}-${item.chofer}`} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-3">
                  <p className="text-sm font-semibold text-white">{item.chofer}</p>
                  <p className="text-xs text-gray-500">{item.unidad} · {item.destino}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#CC2229]/10 px-2 py-0.5 text-xs text-[#CC2229]">{item.estado}</span>
                    {item.demoraMin > 0 ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                        Demora {item.demoraMin} min
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-300">A tiempo</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Llegada: {item.llegadaProgramada} programada / {item.llegadaReal} real
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Tiempo aproximado de viaje: {formatTravelTime(item.tiempoEstimadoMin)}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-gray-500">No hay viajes programados para ese bloque.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Demoras del día</h3>
              <p className="text-xs text-gray-500 mt-1">Cargas que llegaron después de la hora programada.</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${
              demorasDia.length > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-green-500/25 bg-green-500/10 text-green-300"
            }`}>
              {demorasDia.length > 0 ? `${demorasDia.length} demoras · ${minutosDemoraDia} min` : "Sin demoras"}
            </span>
          </div>
        </div>
        {demorasDia.length > 0 ? (
          <div className="divide-y divide-[#3A3A3A]">
            {demorasDia.map((item) => (
              <div key={`${item.fecha}-${item.hora}-${item.chofer}-${item.unidad}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">{item.chofer}</p>
                  <p className="text-xs text-gray-500">{item.unidad} · {item.destino}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Llegada</p>
                  <p className="text-sm text-white">{item.llegadaProgramada} programada · {item.llegadaReal} real</p>
                  <p className="text-xs text-gray-500 mt-1">Viaje aprox. {formatTravelTime(item.tiempoEstimadoMin)}</p>
                </div>
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-semibold">{item.demoraMin} min tarde</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-sm text-gray-500">Todas las cargas de este día están a tiempo.</p>
          </div>
        )}
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Impacto en siguientes viajes</h3>
              <p className="text-xs text-gray-500 mt-1">
                Si una unidad o chofer se demora, el sistema recalcula los siguientes viajes donde se vuelve a usar ese recurso.
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${
              viajesAtrasadosPorArrastre.length > 0
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-green-500/25 bg-green-500/10 text-green-300"
            }`}>
              {viajesAtrasadosPorArrastre.length > 0
                ? `${viajesAtrasadosPorArrastre.length} viajes se atrasan`
                : "Sin arrastre"}
            </span>
          </div>
        </div>

        {viajesConRiesgo.length > 0 ? (
          <div className="divide-y divide-[#3A3A3A]">
            {viajesConRiesgo.map((item) => (
              <div key={`${item.fecha}-${item.hora}-${item.chofer}-${item.unidad}-impacto`} className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_auto] gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-white">{item.chofer}</p>
                  <p className="text-xs text-gray-500">{item.unidad} · {item.destino}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Salida recalculada</p>
                  <p className="text-sm text-white">
                    {item.salidaOriginal} original · {item.salidaRecalculada} nueva
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Viaje aprox. {formatTravelTime(item.tiempoEstimadoMin)} · fin estimado {item.finEstimadoRecalculado}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{item.motivoArrastre}</p>
                </div>
                <div className="flex items-center lg:justify-end">
                  {item.seAtrasa ? (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-300">
                      Se atrasa {item.atrasoArrastreMin} min
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-300">
                      Genera demora {item.demoraMin} min
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-sm text-gray-500">No hay demoras ni viajes afectados para esta fecha.</p>
          </div>
        )}
      </div>

    </div>
  );
}
