"use client";

import { useState } from "react";
import { Package, ArrowDownCircle, ArrowUpCircle, DollarSign, Plus } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";

interface Movimiento {
  fecha: string;
  producto: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  responsable: string;
  observaciones: string;
}

interface StockItem {
  producto: string;
  stockActual: number;
  unidad: string;
  minimo: number;
  status: string;
}

const movimientosData: Movimiento[] = [
  { fecha: "20/05/2026", producto: "Cemento CPC 30 (saco)", tipo: "Salida", cantidad: 120, unidad: "sacos", responsable: "Carlos Ortiz", observaciones: "Producción mezcla B20" },
  { fecha: "20/05/2026", producto: "Grava 3/4\"", tipo: "Entrada", cantidad: 15, unidad: "ton", responsable: "José Martínez", observaciones: "Proveedor Bancos MTY" },
  { fecha: "19/05/2026", producto: "Arena fina", tipo: "Salida", cantidad: 8, unidad: "m³", responsable: "Luis Ramírez", observaciones: "Mezcla zona norte" },
  { fecha: "19/05/2026", producto: "Aditivo plastificante", tipo: "Entrada", cantidad: 200, unidad: "litros", responsable: "Ana López", observaciones: "Proveedor Sika" },
  { fecha: "18/05/2026", producto: "Cemento CPC 30 (saco)", tipo: "Entrada", cantidad: 500, unidad: "sacos", responsable: "José Martínez", observaciones: "Pedido quincenal" },
  { fecha: "18/05/2026", producto: "Agua", tipo: "Salida", cantidad: 5000, unidad: "litros", responsable: "Carlos Ortiz", observaciones: "Producción del día" },
  { fecha: "17/05/2026", producto: "Grava 3/4\"", tipo: "Salida", cantidad: 10, unidad: "ton", responsable: "Luis Ramírez", observaciones: "Carga viaje MTY-Sur" },
  { fecha: "17/05/2026", producto: "Acelerante de fraguado", tipo: "Salida", cantidad: 50, unidad: "litros", responsable: "Ana López", observaciones: "Urgencia proyecto Apodaca" },
];

const stockData: StockItem[] = [
  { producto: "Cemento CPC 30 (saco)", stockActual: 780, unidad: "sacos", minimo: 200, status: "Normal" },
  { producto: "Grava 3/4\"", stockActual: 45, unidad: "ton", minimo: 20, status: "Normal" },
  { producto: "Arena fina", stockActual: 18, unidad: "m³", minimo: 15, status: "Stock bajo" },
  { producto: "Aditivo plastificante", stockActual: 380, unidad: "litros", minimo: 100, status: "Normal" },
  { producto: "Acelerante de fraguado", stockActual: 95, unidad: "litros", minimo: 80, status: "Stock bajo" },
  { producto: "Colorante mineral", stockActual: 60, unidad: "kg", minimo: 20, status: "Normal" },
];

const entradas = movimientosData.filter(m => m.tipo === "Entrada").length;
const salidas = movimientosData.filter(m => m.tipo === "Salida").length;

export default function InventarioPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"movimientos" | "stock">("movimientos");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Inventario</h1>
          <p className="text-gray-500 text-sm mt-0.5">Control de materiales y existencias</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Registrar Movimiento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Productos" value={String(stockData.length)} icon={Package} iconColor="text-blue-400" />
        <KPICard title="Entradas del mes" value={String(entradas)} icon={ArrowDownCircle} iconColor="text-green-400" />
        <KPICard title="Salidas del mes" value={String(salidas)} icon={ArrowUpCircle} iconColor="text-red-400" />
        <KPICard title="Alertas stock" value={String(stockData.filter(s => s.status === "Stock bajo").length)} icon={DollarSign} iconColor="text-orange-400" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar movimiento"
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
              <label className="block text-sm text-gray-400 mb-1">Tipo</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Entrada</option>
                <option>Salida</option>
              </select>
            </div>
            {[
              { label: "Fecha", type: "date" },
              { label: "Producto", type: "text", placeholder: "Nombre del material" },
              { label: "Cantidad", type: "number", placeholder: "0" },
              { label: "Unidad", type: "text", placeholder: "sacos / kg / litros / m³" },
              { label: "Responsable", type: "text", placeholder: "Nombre" },
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
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
              <input type="text" placeholder="Notas..." className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
          </div>
      </FormModal>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("movimientos")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "movimientos" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
        >
          Movimientos
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "stock" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
        >
          Stock actual
        </button>
      </div>

      {/* Movimientos Table */}
      {activeTab === "movimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Producto", "Tipo", "Cantidad", "Unidad", "Responsable", "Observaciones"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {movimientosData.map((m, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.fecha}</td>
                    <td className="px-4 py-3 text-gray-200">{m.producto}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.tipo} /></td>
                    <td className="px-4 py-3 text-gray-200 font-semibold">{m.cantidad}</td>
                    <td className="px-4 py-3 text-gray-400">{m.unidad}</td>
                    <td className="px-4 py-3 text-gray-300">{m.responsable}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.observaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Table */}
      {activeTab === "stock" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Producto", "Stock Actual", "Unidad", "Mínimo", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {stockData.map((s, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-200">{s.producto}</td>
                    <td className="px-4 py-3 text-white font-bold text-base">{s.stockActual.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-400">{s.unidad}</td>
                    <td className="px-4 py-3 text-gray-500">{s.minimo}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
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
