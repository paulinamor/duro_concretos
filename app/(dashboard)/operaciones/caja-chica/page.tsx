"use client";

import { useState } from "react";
import { Wallet, Plus, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GastoCajaChica {
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  comprobante: string;
  responsable: string;
  estado: string;
}

const gastosData: GastoCajaChica[] = [
  { fecha: "20/05/2026", descripcion: "Material de limpieza oficina", categoria: "Oficina", monto: 380, comprobante: "Ticket-0291", responsable: "Ana López", estado: "Aprobado" },
  { fecha: "20/05/2026", descripcion: "Café y consumibles comedor", categoria: "Consumibles", monto: 210, comprobante: "Ticket-0290", responsable: "Carlos Ortiz", estado: "Aprobado" },
  { fecha: "19/05/2026", descripcion: "Papelería e impresión", categoria: "Oficina", monto: 450, comprobante: "Factura-A112", responsable: "Ana López", estado: "Aprobado" },
  { fecha: "19/05/2026", descripcion: "Gasolina vehículo administrativo", categoria: "Transporte", monto: 700, comprobante: "Ticket-0289", responsable: "José Martínez", estado: "Aprobado" },
  { fecha: "18/05/2026", descripcion: "Herramientas menores", categoria: "Mantenimiento", monto: 620, comprobante: "Ticket-0288", responsable: "Carlos Ortiz", estado: "Aprobado" },
  { fecha: "18/05/2026", descripcion: "Comida reunión con cliente", categoria: "Representación", monto: 890, comprobante: "Ticket-0287", responsable: "Admin", estado: "Revision" },
  { fecha: "17/05/2026", descripcion: "Copia de llaves bodega", categoria: "Mantenimiento", monto: 120, comprobante: "Ticket-0286", responsable: "José Martínez", estado: "Aprobado" },
  { fecha: "16/05/2026", descripcion: "Artículos de seguridad (cinta)", categoria: "Seguridad", monto: 340, comprobante: "Ticket-0285", responsable: "Carlos Ortiz", estado: "Aprobado" },
];

const fondoTotal = 5000;
const gastado = gastosData.filter(g => g.estado === "Aprobado").reduce((s, g) => s + g.monto, 0);
const disponible = fondoTotal - gastado;
const porcentajeGastado = Math.round((gastado / fondoTotal) * 100);

// Category breakdown
const categorias = gastosData.reduce((acc: Record<string, number>, g) => {
  acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto;
  return acc;
}, {});

const pieData = Object.entries(categorias).map(([name, value]) => ({ name, value }));
const PIE_COLORS = ["#CC2229", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function CajaChicaPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Caja Chica</h1>
          <p className="text-gray-500 text-sm mt-0.5">Control de gastos menores y fondo</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw size={14} />
            Reposición de Fondo
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Registrar Gasto
          </button>
        </div>
      </div>

      {/* Fund Status Card */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Estado del fondo</p>
            <h2 className="text-white font-bold text-2xl flex items-center gap-2">
              <Wallet className="text-[#CC2229]" size={24} />
              ${fondoTotal.toLocaleString()} MXN
            </h2>
            <p className="text-gray-500 text-xs mt-1">Fondo asignado mensual</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-red-400 font-bold text-xl">${gastado.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Gastado</p>
            </div>
            <div className="text-center">
              <p className="text-green-400 font-bold text-xl">${disponible.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Disponible</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#1A1A1A] rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-[#CC2229] transition-all duration-500"
            style={{ width: `${porcentajeGastado}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-2">{porcentajeGastado}% del fondo utilizado</p>
      </div>

      <FormModal
        open={showForm}
        title="Registrar gasto de caja chica"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar</button>
          </>
        }
      >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Categoría</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Oficina", "Consumibles", "Transporte", "Mantenimiento", "Representación", "Seguridad"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto ($)</label>
              <input type="number" placeholder="0.00" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">No. Comprobante</label>
              <input type="text" placeholder="Ticket / Factura" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <input type="text" placeholder="Nombre" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <input type="text" placeholder="Concepto del gasto" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
          </div>
      </FormModal>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie chart */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Gastos por categoría</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
              <Legend formatter={(v) => <span className="text-gray-300 text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Gastos registrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Descripción", "Categoría", "Monto", "Comprobante", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {gastosData.map((g, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{g.fecha}</td>
                    <td className="px-4 py-3 text-gray-200">{g.descripcion}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{g.categoria}</td>
                    <td className="px-4 py-3 text-white font-semibold">${g.monto.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{g.comprobante}</td>
                    <td className="px-4 py-3"><StatusBadge status={g.estado} /></td>
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
