"use client";

import { useState } from "react";
import { Plus, Truck, Package, Calendar, Filter } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";

interface Viaje {
  folio: string;
  fecha: string;
  unidad: string;
  operador: string;
  destino: string;
  m3: number;
  precioPorM3: number;
  total: number;
  estado: string;
}

const viajesData: Viaje[] = [
  { folio: "VJ-2026-142", fecha: "20/05/2026", unidad: "DC-03 · NMY-1042", operador: "Luis Ramírez", destino: "Monterrey Centro", m3: 7.5, precioPorM3: 1850, total: 13875, estado: "Completado" },
  { folio: "VJ-2026-141", fecha: "20/05/2026", unidad: "DC-07 · PMH-3310", operador: "Carlos Mendoza", destino: "San Nicolás", m3: 6.0, precioPorM3: 1850, total: 11100, estado: "En ruta" },
  { folio: "VJ-2026-140", fecha: "20/05/2026", unidad: "DC-01 · KLJ-8821", operador: "José García", destino: "Apodaca Industrial", m3: 8.0, precioPorM3: 1900, total: 15200, estado: "Completado" },
  { folio: "VJ-2026-139", fecha: "19/05/2026", unidad: "DC-05 · HJK-4459", operador: "Miguel Torres", destino: "García NL", m3: 5.5, precioPorM3: 1850, total: 10175, estado: "Cancelado" },
  { folio: "VJ-2026-138", fecha: "19/05/2026", unidad: "DC-02 · XPW-7734", operador: "Roberto Flores", destino: "Guadalupe NL", m3: 7.0, precioPorM3: 1900, total: 13300, estado: "Completado" },
  { folio: "VJ-2026-137", fecha: "19/05/2026", unidad: "DC-06 · TNB-2281", operador: "Alejandro Reyes", destino: "Santa Catarina", m3: 6.5, precioPorM3: 1850, total: 12025, estado: "Completado" },
  { folio: "VJ-2026-136", fecha: "18/05/2026", unidad: "DC-04 · RPL-5590", operador: "Fernando Castillo", destino: "Escobedo NL", m3: 8.5, precioPorM3: 1900, total: 16150, estado: "Completado" },
  { folio: "VJ-2026-135", fecha: "18/05/2026", unidad: "DC-08 · ZXC-9012", operador: "Eduardo López", destino: "Cadereyta", m3: 7.0, precioPorM3: 2000, total: 14000, estado: "Completado" },
  { folio: "VJ-2026-134", fecha: "17/05/2026", unidad: "DC-03 · NMY-1042", operador: "Luis Ramírez", destino: "Monterrey Oriente", m3: 6.0, precioPorM3: 1850, total: 11100, estado: "Completado" },
  { folio: "VJ-2026-133", fecha: "17/05/2026", unidad: "DC-01 · KLJ-8821", operador: "José García", destino: "Juárez NL", m3: 7.5, precioPorM3: 1900, total: 14250, estado: "Completado" },
  { folio: "VJ-2026-132", fecha: "16/05/2026", unidad: "DC-07 · PMH-3310", operador: "Carlos Mendoza", destino: "Monterrey Sur", m3: 5.0, precioPorM3: 1850, total: 9250, estado: "Pendiente" },
];

const operadores = ["Todos", "Luis Ramírez", "Carlos Mendoza", "José García", "Miguel Torres", "Roberto Flores", "Alejandro Reyes", "Fernando Castillo", "Eduardo López"];
const estados = ["Todos", "Completado", "En ruta", "Cancelado", "Pendiente"];

const totalM3 = viajesData.filter(v => v.estado === "Completado").reduce((s, v) => s + v.m3, 0);
const hoy = viajesData.filter(v => v.fecha === "20/05/2026").length;

export default function ViajesPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterOperador, setFilterOperador] = useState("Todos");

  const filtered = viajesData.filter((v) => {
    return (
      (filterEstado === "Todos" || v.estado === filterEstado) &&
      (filterOperador === "Todos" || v.operador === filterOperador)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Viajes y Operadores</h1>
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
        <KPICard title="Total viajes del mes" value={String(viajesData.length)} icon={Truck} iconColor="text-[#CC2229]" />
        <KPICard title="M3 entregados" value={`${totalM3} m³`} icon={Package} iconColor="text-blue-400" />
        <KPICard title="Viajes hoy" value={String(hoy)} icon={Calendar} iconColor="text-green-400" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar nuevo viaje"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Guardar viaje
            </button>
          </>
        }
      >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Fecha", type: "date", placeholder: "" },
              { label: "Unidad", type: "text", placeholder: "Ej. DC-01 · KLJ-8821" },
              { label: "Operador", type: "text", placeholder: "Nombre del operador" },
              { label: "Destino", type: "text", placeholder: "Dirección de entrega" },
              { label: "M3 a entregar", type: "number", placeholder: "0.0" },
              { label: "Precio por M3 ($)", type: "number", placeholder: "1850" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
              <textarea
                rows={2}
                placeholder="Notas adicionales..."
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229] resize-none"
              />
            </div>
          </div>
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
            {operadores.map((o) => <option key={o}>{o}</option>)}
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
                {["Folio", "Fecha", "Unidad", "Operador", "Destino", "M3", "Precio/M3", "Total", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.map((v) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
