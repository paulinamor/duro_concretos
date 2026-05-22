"use client";

import { useState } from "react";
import { Wrench, AlertTriangle, DollarSign, Plus } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";

interface Mantenimiento {
  fecha: string;
  unidad: string;
  tipo: string;
  descripcion: string;
  costo: number;
  taller: string;
  status: string;
}

interface Refaccion {
  fecha: string;
  unidad: string;
  refaccion: string;
  cantidad: number;
  costoUnit: number;
  total: number;
  proveedor: string;
}

const mantenimientosData: Mantenimiento[] = [
  { fecha: "18/05/2026", unidad: "DC-03", tipo: "Preventivo", descripcion: "Cambio de aceite y filtros", costo: 3200, taller: "Taller Monterrey", status: "Completado" },
  { fecha: "17/05/2026", unidad: "DC-09", tipo: "Correctivo", descripcion: "Reparación de frenos traseros", costo: 8500, taller: "Servitruck NL", status: "En proceso" },
  { fecha: "15/05/2026", unidad: "DC-05", tipo: "Preventivo", descripcion: "Revisión general + afinación", costo: 4800, taller: "Taller Monterrey", status: "Completado" },
  { fecha: "12/05/2026", unidad: "DC-10", tipo: "Correctivo", descripcion: "Cambio de bomba hidráulica", costo: 15200, taller: "Auto Partes NL", status: "Pendiente" },
  { fecha: "10/05/2026", unidad: "DC-02", tipo: "Preventivo", descripcion: "Cambio de llantas delanteras", costo: 9600, taller: "Llantera JC", status: "Completado" },
  { fecha: "08/05/2026", unidad: "DC-06", tipo: "Preventivo", descripcion: "Cambio de aceite motor y diferencial", costo: 3800, taller: "Taller Monterrey", status: "Completado" },
];

const refaccionesData: Refaccion[] = [
  { fecha: "18/05/2026", unidad: "DC-03", refaccion: "Filtro de aceite", cantidad: 2, costoUnit: 280, total: 560, proveedor: "Auto Partes NL" },
  { fecha: "17/05/2026", unidad: "DC-09", refaccion: "Pastillas de freno", cantidad: 4, costoUnit: 650, total: 2600, proveedor: "Servitruck NL" },
  { fecha: "15/05/2026", unidad: "DC-05", refaccion: "Bujías NGK", cantidad: 6, costoUnit: 180, total: 1080, proveedor: "Refaccionaria Sur" },
  { fecha: "12/05/2026", unidad: "DC-10", refaccion: "Bomba hidráulica", cantidad: 1, costoUnit: 12500, total: 12500, proveedor: "Hidráulicos MTY" },
  { fecha: "10/05/2026", unidad: "DC-02", refaccion: "Llanta 11R22.5", cantidad: 2, costoUnit: 4800, total: 9600, proveedor: "Llantera JC" },
  { fecha: "08/05/2026", unidad: "DC-06", refaccion: "Aceite 15W40 (cubeta)", cantidad: 2, costoUnit: 890, total: 1780, proveedor: "Lubricantes MX" },
];

const costoMes = mantenimientosData.reduce((s, m) => s + m.costo, 0);
const pendientes = mantenimientosData.filter(m => m.status === "Pendiente" || m.status === "En proceso").length;

export default function MantenimientoPage() {
  const [activeTab, setActiveTab] = useState<"mantenimientos" | "refacciones">("mantenimientos");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Mantenimiento</h1>
          <p className="text-gray-500 text-sm mt-0.5">Control de mantenimientos y refacciones</p>
        </div>
        <button className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} />
          Registrar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard
          title="Costo mantenimiento mes"
          value={`$${costoMes.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-[#CC2229]"
        />
        <KPICard
          title="Mantenimientos pendientes"
          value={String(pendientes)}
          icon={AlertTriangle}
          iconColor="text-orange-400"
          subtitle="Requieren atención"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("mantenimientos")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "mantenimientos"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Mantenimientos
        </button>
        <button
          onClick={() => setActiveTab("refacciones")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "refacciones"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Refacciones
        </button>
      </div>

      {/* Mantenimientos Table */}
      {activeTab === "mantenimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Tipo", "Descripción", "Costo", "Taller", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {mantenimientosData.map((m, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.fecha}</td>
                    <td className="px-4 py-3 text-white font-semibold">{m.unidad}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.tipo} /></td>
                    <td className="px-4 py-3 text-gray-200">{m.descripcion}</td>
                    <td className="px-4 py-3 text-white font-semibold">${m.costo.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{m.taller}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refacciones Table */}
      {activeTab === "refacciones" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Refacción", "Cantidad", "Costo Unit.", "Total", "Proveedor"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {refaccionesData.map((r, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.fecha}</td>
                    <td className="px-4 py-3 text-white font-semibold">{r.unidad}</td>
                    <td className="px-4 py-3 text-gray-200">{r.refaccion}</td>
                    <td className="px-4 py-3 text-gray-300">{r.cantidad}</td>
                    <td className="px-4 py-3 text-gray-300">${r.costoUnit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white font-semibold">${r.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{r.proveedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
