"use client";

import { useEffect, useState } from "react";
import { Plus, Truck, Package, Calendar, Filter } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import FormSection from "@/components/FormSection";
import type { Viaje } from "@/lib/viajes";
import { COLLECTIONS, getCollectionDocs, upsertDocument } from "@/lib/db";
import { unidadesDisponibilidad } from "@/lib/disponibilidadCargas";

const estados = ["Todos", "Completado", "En ruta", "Cancelado", "Pendiente"];

function formatDate(date: string) {
  if (!date) return "20/05/2026";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export default function ViajesPage() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterOperador, setFilterOperador] = useState("Todos");

  useEffect(() => {
    getCollectionDocs<Viaje>(COLLECTIONS.viajes)
      .then(setViajes)
      .finally(() => setLoading(false));
  }, []);

  const totalM3 = viajes.filter(v => v.estado === "Completado").reduce((s, v) => s + v.m3, 0);
  const todayStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/");
  const hoy = viajes.filter(v => v.fecha === todayStr).length;
  const operadoresOptions = ["Todos", ...Array.from(new Set(viajes.map(v => v.operador))).sort()];
  const filtered = viajes.filter((v) => {
    return (
      (filterEstado === "Todos" || v.estado === filterEstado) &&
      (filterOperador === "Todos" || v.operador === filterOperador)
    );
  });

  async function handleSave(values: Record<string, string>) {
    const m3 = Number(values["M3 a entregar"] || 0);
    const precioPorM3 = Number(values["Precio por M3 ($)"] || 0);
    const folio = `VJ-2026-${Date.now()}`;
    const fecha = formatDate(values.Fecha);

    const viaje: Viaje = {
      folio,
      fecha,
      unidad: values.Unidad || "DC-03 · NMY-1042",
      operador: values.Chofer || "Luis Ramírez",
      destino: values.Destino || "Monterrey Centro",
      m3,
      precioPorM3,
      total: m3 * precioPorM3,
      estado: values.Estado || "Pendiente",
    };

    setViajes((current) => [viaje, ...current]);
    await upsertDocument(COLLECTIONS.viajes, folio, viaje);
  }

  async function updateViajeEstado(folio: string, estado: string) {
    setViajes((current) =>
      current.map((v) => (v.folio === folio ? { ...v, estado } : v)),
    );
    const viaje = viajes.find((v) => v.folio === folio);
    if (viaje) await upsertDocument(COLLECTIONS.viajes, folio, { ...viaje, estado });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Registro y seguimiento de viajes</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Registrar Viaje
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total viajes del mes" value={String(viajes.length)} icon={Truck} iconColor="text-[#CC2229]" />
        <KPICard title="M3 entregados" value={`${totalM3} m³`} icon={Package} iconColor="text-blue-400" />
        <KPICard title="Viajes hoy" value={String(hoy)} icon={Calendar} iconColor="text-green-400" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar nuevo viaje"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20">
              Guardar viaje
            </button>
          </>
        }
      >
        {(() => {
          const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
          const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
          return (
            <>
              <FormSection title="Datos del viaje">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Unidad</label>
                  <select className={inp}>
                    {unidadesDisponibilidad.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Chofer</label>
                  <select className={inp}>
                    {operadoresOptions.filter((o) => o !== "Todos").map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <select className={inp}>
                    <option>Pendiente</option>
                    <option>En ruta</option>
                    <option>Completado</option>
                  </select>
                </div>
              </FormSection>
              <FormSection title="Carga y destino">
                <div>
                  <label className={lbl}>Destino</label>
                  <select className={inp}>
                    {["Monterrey Centro", "San Nicolás", "Apodaca Industrial", "García NL", "Guadalupe NL", "Santa Catarina"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>M3 a entregar</label>
                  <select className={inp}>
                    {["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"].map((m3) => <option key={m3}>{m3}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Precio por M3 ($)</label>
                  <select className={inp}>
                    {["1850", "1900", "2000"].map((precio) => <option key={precio}>{precio}</option>)}
                  </select>
                </div>
              </FormSection>
              <div>
                <label className={lbl}>Observaciones</label>
                <textarea rows={2} placeholder="Notas adicionales..." className={`${inp} resize-none`} />
              </div>
            </>
          );
        })()}
      </FormModal>

      {/* Filters */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400" />
        <div className="flex flex-wrap gap-3">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            {estados.map((e) => <option key={e}>{e}</option>)}
          </select>
          <select
            value={filterOperador}
            onChange={(e) => setFilterOperador(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            {operadoresOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} registros</span>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio", "Fecha", "Unidad", "Chofer", "Destino", "M3", "Precio/M3", "Total", "Estado", "Acción"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                    Cargando viajes...
                  </td>
                </tr>
              ) : filtered.map((v) => (
                <tr key={v.folio} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{v.folio}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{v.fecha}</td>
                  <td className="px-4 py-3 text-gray-200 font-medium text-xs">{v.unidad}</td>
                  <td className="px-4 py-3 text-gray-200">{v.operador}</td>
                  <td className="px-4 py-3 text-gray-300">{v.destino}</td>
                  <td className="px-4 py-3 text-gray-200">{v.m3} m³</td>
                  <td className="px-4 py-3 text-gray-300">${v.precioPorM3.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-semibold">${v.total.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.estado} /></td>
                  <td className="px-4 py-3">
                    {v.estado !== "Completado" ? (
                      <button
                        onClick={() => updateViajeEstado(v.folio, "Completado")}
                        className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
                      >
                        Marcar completado
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Listo para pago</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
