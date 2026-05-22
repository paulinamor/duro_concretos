"use client";

import { useState } from "react";
import { Fuel, DollarSign, Gauge, Plus } from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CargaDiesel {
  fecha: string;
  unidad: string;
  operador: string;
  litros: number;
  precioL: number;
  total: number;
  kmRecorridos: number;
  rendimiento: string;
}

const dieselData: CargaDiesel[] = [
  { fecha: "20/05/2026", unidad: "DC-03", operador: "Luis Ramírez", litros: 180, precioL: 22.5, total: 4050, kmRecorridos: 540, rendimiento: "3.0 km/L" },
  { fecha: "20/05/2026", unidad: "DC-07", operador: "Carlos Mendoza", litros: 150, precioL: 22.5, total: 3375, kmRecorridos: 420, rendimiento: "2.8 km/L" },
  { fecha: "19/05/2026", unidad: "DC-01", operador: "José García", litros: 200, precioL: 22.3, total: 4460, kmRecorridos: 620, rendimiento: "3.1 km/L" },
  { fecha: "19/05/2026", unidad: "DC-05", operador: "Miguel Torres", litros: 140, precioL: 22.3, total: 3122, kmRecorridos: 390, rendimiento: "2.8 km/L" },
  { fecha: "18/05/2026", unidad: "DC-02", operador: "Roberto Flores", litros: 165, precioL: 22.1, total: 3647, kmRecorridos: 480, rendimiento: "2.9 km/L" },
  { fecha: "18/05/2026", unidad: "DC-06", operador: "Alejandro Reyes", litros: 155, precioL: 22.1, total: 3426, kmRecorridos: 460, rendimiento: "3.0 km/L" },
  { fecha: "17/05/2026", unidad: "DC-04", operador: "Fernando Castillo", litros: 190, precioL: 22.0, total: 4180, kmRecorridos: 570, rendimiento: "3.0 km/L" },
  { fecha: "17/05/2026", unidad: "DC-08", operador: "Eduardo López", litros: 170, precioL: 22.0, total: 3740, kmRecorridos: 510, rendimiento: "3.0 km/L" },
  { fecha: "16/05/2026", unidad: "DC-03", operador: "Luis Ramírez", litros: 175, precioL: 21.9, total: 3833, kmRecorridos: 490, rendimiento: "2.8 km/L" },
  { fecha: "15/05/2026", unidad: "DC-01", operador: "José García", litros: 195, precioL: 21.8, total: 4251, kmRecorridos: 600, rendimiento: "3.1 km/L" },
];

const costosPorDia = [
  { dia: "15/05", DC01: 4251, DC03: 0, DC07: 0 },
  { dia: "16/05", DC01: 0, DC03: 3833, DC07: 0 },
  { dia: "17/05", DC01: 0, DC03: 0, DC07: 0 },
  { dia: "18/05", DC01: 0, DC03: 0, DC07: 3426 },
  { dia: "19/05", DC01: 4460, DC03: 0, DC07: 0 },
  { dia: "20/05", DC01: 0, DC03: 4050, DC07: 3375 },
];

const totalLitros = dieselData.reduce((s, d) => s + d.litros, 0);
const totalCosto = dieselData.reduce((s, d) => s + d.total, 0);
const promedioRendimiento = "2.95 km/L";

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function DieselPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Control de Diesel</h1>
          <p className="text-gray-500 text-sm mt-0.5">Registro de cargas y consumo por unidad</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Registrar Carga
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total litros del mes" value={`${totalLitros.toLocaleString()} L`} icon={Fuel} iconColor="text-yellow-400" />
        <KPICard title="Costo total del mes" value={`$${totalCosto.toLocaleString()}`} icon={DollarSign} iconColor="text-[#CC2229]" />
        <KPICard title="Promedio rendimiento" value={promedioRendimiento} icon={Gauge} iconColor="text-blue-400" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar carga de diesel"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Guardar
            </button>
          </>
        }
      >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Fecha", type: "date" },
              { label: "Unidad", type: "text", placeholder: "Ej. DC-01" },
              { label: "Operador", type: "text", placeholder: "Nombre del operador" },
              { label: "Litros cargados", type: "number", placeholder: "0.0" },
              { label: "Precio por litro ($)", type: "number", placeholder: "22.50" },
              { label: "Km recorridos", type: "number", placeholder: "0" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder ?? ""}
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                />
              </div>
            ))}
          </div>
      </FormModal>

      {/* Chart */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Costo de diesel por día (principales unidades)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={costosPorDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
            <XAxis dataKey="dia" stroke="#6B7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
            <Legend />
            <Line type="monotone" dataKey="DC01" stroke="#CC2229" strokeWidth={2} dot={{ r: 3 }} name="DC-01" />
            <Line type="monotone" dataKey="DC03" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="DC-03" />
            <Line type="monotone" dataKey="DC07" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="DC-07" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Registro de cargas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Fecha", "Unidad", "Operador", "Litros", "Precio/L", "Total", "Km Recorridos", "Rendimiento"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {dieselData.map((d, i) => (
                <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{d.fecha}</td>
                  <td className="px-4 py-3 text-white font-semibold">{d.unidad}</td>
                  <td className="px-4 py-3 text-gray-200">{d.operador}</td>
                  <td className="px-4 py-3 text-yellow-400">{d.litros} L</td>
                  <td className="px-4 py-3 text-gray-300">${d.precioL.toFixed(2)}</td>
                  <td className="px-4 py-3 text-white font-semibold">${d.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-300">{d.kmRecorridos} km</td>
                  <td className="px-4 py-3 text-blue-400">{d.rendimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
