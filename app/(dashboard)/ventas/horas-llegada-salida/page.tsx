"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  Download,
  FileText,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import {
  calcularDiferenciaMinutos,
  enlazarHorasGpsVentas,
  VentaEntrega,
  ventasEntregasBase,
} from "@/lib/gpsSalesTimes";

export default function HorasLlegadaSalidaPage() {
  const [entregas, setEntregas] = useState<VentaEntrega[]>(ventasEntregasBase);
  const [query, setQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [loadingGps, setLoadingGps] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return entregas.filter((entrega) => {
      return (
        (filterEstado === "Todos" || entrega.estado === filterEstado) &&
        (
          entrega.folio.toLowerCase().includes(term) ||
          entrega.cliente.toLowerCase().includes(term) ||
          entrega.obra.toLowerCase().includes(term) ||
          entrega.unidad.toLowerCase().includes(term)
        )
      );
    });
  }, [entregas, filterEstado, query]);

  const conGps = entregas.filter((entrega) => entrega.horaLlegadaGps).length;
  const diferencias = entregas.filter((entrega) => entrega.estado === "Diferencia").length;
  const validados = entregas.filter((entrega) => entrega.estado === "Validado").length;

  async function handleEnlazarGps() {
    setLoadingGps(true);
    try {
      const linked = await enlazarHorasGpsVentas(entregas);
      setEntregas(linked);
    } finally {
      setLoadingGps(false);
    }
  }

  function handleSave(values: Record<string, string>) {
    setEntregas((current) => [
      {
        folio: values["Folio venta/viaje"] || `VJ-2026-${current.length + 143}`,
        cliente: values.Cliente || "Grupo Alfa Logistica",
        obra: values.Obra || "Monterrey Centro",
        unidad: values.Unidad || "DC-03",
        operador: values.Operador || "Luis Ramírez",
        m3: Number(values.M3?.replace(" m3", "") || 0),
        horaProgramada: values["Hora programada"] || "08:30",
        horaLlegadaManual: values["Hora llegada manual"] || "08:36",
        horaSalidaManual: values["Hora salida manual"] || "09:10",
        estado: "Pendiente",
        observaciones: values.Observaciones || "Descarga sin incidencia",
      },
      ...current,
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Ventas con validación de hora de llegada por GPS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleEnlazarGps}
            disabled={loadingGps}
            className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] disabled:opacity-60 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loadingGps ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
            {loadingGps ? "Enlazando..." : "Enlazar GPS"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Registrar Documento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Documentos del día" value={String(entregas.length)} icon={FileText} iconColor="text-blue-400" />
        <KPICard title="Enlazados con GPS" value={`${conGps}/${entregas.length}`} icon={MapPin} iconColor="text-green-400" />
        <KPICard title="Validados" value={String(validados)} icon={Clock} iconColor="text-[#CC2229]" />
        <KPICard title="Con diferencia" value={String(diferencias)} icon={RefreshCw} iconColor="text-orange-400" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar folio, cliente, obra o unidad"
            className="w-80 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {["Todos", "Pendiente", "Validado", "Diferencia"].map((estado) => (
            <option key={estado}>{estado}</option>
          ))}
        </select>
        <button className="ml-auto flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <Download size={14} />
          Exportar documento
        </button>
      </div>

      <FormModal
        open={showForm}
        title="Registrar documento de llegada y salida"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar documento</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Folio venta/viaje</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.folio}>{entrega.folio}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cliente</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.cliente}>{entrega.cliente}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Obra</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.obra}>{entrega.obra}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Unidad</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.unidad}>{entrega.unidad}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Operador</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.operador}>{entrega.operador}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">M3</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[5.5, 6, 7.5, 8].map((m3) => <option key={m3}>{m3} m3</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hora programada</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["08:30", "10:00", "12:00", "14:15"].map((hora) => <option key={hora}>{hora}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hora llegada manual</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["08:36", "10:25", "12:04", "14:39"].map((hora) => <option key={hora}>{hora}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hora salida manual</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["09:10", "11:05", "12:45", "15:15"].map((hora) => <option key={hora}>{hora}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {ventasEntregasBase.map((entrega) => <option key={entrega.observaciones}>{entrega.observaciones}</option>)}
            </select>
          </div>
        </div>
      </FormModal>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Documento de horas por venta</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio", "Cliente / Obra", "Unidad", "Operador", "Programada", "Llegada manual", "Llegada GPS", "Salida manual", "Salida GPS", "Dif.", "GPS", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.map((entrega) => {
                const diferencia = calcularDiferenciaMinutos(entrega.horaLlegadaManual, entrega.horaLlegadaGps);
                return (
                  <tr key={entrega.folio} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{entrega.folio}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{entrega.cliente}</p>
                      <p className="text-gray-500 text-xs">{entrega.obra} - {entrega.m3} m3</p>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">{entrega.unidad}</td>
                    <td className="px-4 py-3 text-gray-300">{entrega.operador}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{entrega.horaProgramada}</td>
                    <td className="px-4 py-3 text-gray-200 font-mono text-xs">{entrega.horaLlegadaManual}</td>
                    <td className="px-4 py-3 text-green-400 font-mono text-xs">{entrega.horaLlegadaGps ?? "Sin GPS"}</td>
                    <td className="px-4 py-3 text-gray-200 font-mono text-xs">{entrega.horaSalidaManual}</td>
                    <td className="px-4 py-3 text-green-400 font-mono text-xs">{entrega.horaSalidaGps ?? "Sin GPS"}</td>
                    <td className={`px-4 py-3 font-semibold ${diferencia === null || Math.abs(diferencia) <= 5 ? "text-green-400" : "text-orange-400"}`}>
                      {diferencia === null ? "-" : `${diferencia > 0 ? "+" : ""}${diferencia} min`}
                    </td>
                    <td className="px-4 py-3">
                      {entrega.gpsLat && entrega.gpsLng ? (
                        <div className="text-xs">
                          <p className="text-gray-300">{entrega.fuenteGps}</p>
                          <p className="text-gray-500">{entrega.precisionMetros} m</p>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={entrega.estado} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
