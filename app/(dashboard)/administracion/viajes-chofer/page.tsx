"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download, Search, Truck, UserRound } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { driverTrips, getDriverTripSummaries } from "@/lib/driverTrips";

export default function ViajesChoferPage() {
  const [operador, setOperador] = useState("Todos");
  const [query, setQuery] = useState("");

  const summaries = useMemo(() => getDriverTripSummaries(driverTrips), []);
  const operadores = ["Todos", ...summaries.map((summary) => summary.operador)];
  const selectedTrips = driverTrips.filter((trip) => {
    const term = query.toLowerCase();
    return (
      (operador === "Todos" || trip.operador === operador) &&
      (
        trip.folio.toLowerCase().includes(term) ||
        trip.operador.toLowerCase().includes(term) ||
        trip.unidad.toLowerCase().includes(term) ||
        trip.destino.toLowerCase().includes(term)
      )
    );
  });

  const selectedSummaries = operador === "Todos"
    ? summaries
    : summaries.filter((summary) => summary.operador === operador);
  const viajesTotales = selectedSummaries.reduce((sum, item) => sum + item.viajesTotales, 0);
  const viajesCompletados = selectedSummaries.reduce((sum, item) => sum + item.viajesCompletados, 0);
  const m3Entregados = selectedSummaries.reduce((sum, item) => sum + item.m3Entregados, 0);
  const totalGenerado = selectedSummaries.reduce((sum, item) => sum + item.totalGenerado, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Administración de viajes realizados por operador</p>
        </div>
        <button className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Download size={16} />
          Exportar reporte
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Viajes totales" value={String(viajesTotales)} icon={Truck} iconColor="text-[#CC2229]" />
        <KPICard title="Viajes completados" value={String(viajesCompletados)} icon={CalendarDays} iconColor="text-green-400" />
        <KPICard title="M3 entregados" value={`${m3Entregados.toFixed(1)} m3`} icon={Truck} iconColor="text-blue-400" />
        <KPICard title="Total generado" value={`$${totalGenerado.toLocaleString()}`} icon={UserRound} iconColor="text-orange-400" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {operadores.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar folio, unidad o destino"
            className="w-72 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <span className="text-gray-500 text-xs ml-auto">{selectedTrips.length} viajes</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Resumen por chofer</h3>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {selectedSummaries.map((summary) => (
              <div key={summary.operador} className="p-4 hover:bg-[#2A2A2A] transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{summary.operador}</p>
                    <p className="text-gray-500 text-xs">Último viaje: {summary.ultimoViaje}</p>
                  </div>
                  <p className="text-[#CC2229] text-xl font-bold">{summary.viajesTotales}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-2">
                    <p className="text-green-400 font-bold">{summary.viajesCompletados}</p>
                    <p className="text-gray-500">Completados</p>
                  </div>
                  <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-2">
                    <p className="text-orange-400 font-bold">{summary.viajesPendientes}</p>
                    <p className="text-gray-500">Pendientes</p>
                  </div>
                  <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-2">
                    <p className="text-red-400 font-bold">{summary.viajesCancelados}</p>
                    <p className="text-gray-500">Cancelados</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Detalle de viajes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Folio", "Fecha", "Chofer", "Unidad", "Destino", "M3", "Total", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {selectedTrips.map((trip) => (
                  <tr key={trip.folio} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{trip.folio}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{trip.fecha}</td>
                    <td className="px-4 py-3 text-white font-medium">{trip.operador}</td>
                    <td className="px-4 py-3 text-gray-300">{trip.unidad}</td>
                    <td className="px-4 py-3 text-gray-300">{trip.destino}</td>
                    <td className="px-4 py-3 text-gray-200">{trip.m3} m3</td>
                    <td className="px-4 py-3 text-white font-semibold">${trip.total.toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={trip.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
