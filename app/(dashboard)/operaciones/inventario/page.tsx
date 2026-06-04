"use client";

import { useEffect, useRef, useState } from "react";
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
  { fecha: "02/01/2026", producto: "Cemento", tipo: "Salida", cantidad: 1416, unidad: "kg", responsable: "Alexis", observaciones: "Remisión 18945 - Rosbel Tellez - 6.5 m³" },
  { fecha: "02/01/2026", producto: "Grava", tipo: "Salida", cantidad: 5390, unidad: "kg", responsable: "Alexis", observaciones: "Remisión 18945 - concreto 250-20-14" },
  { fecha: "02/01/2026", producto: "Arena 4", tipo: "Salida", cantidad: 6870, unidad: "kg", responsable: "Alexis", observaciones: "Remisión 18945 - Rosbel Tellez" },
  { fecha: "02/01/2026", producto: "Agua", tipo: "Salida", cantidad: 1105, unidad: "L", responsable: "Torres", observaciones: "Remisión 18946 - Rosbel Tellez" },
  { fecha: "02/01/2026", producto: "Aditivo", tipo: "Salida", cantidad: 14.3, unidad: "L", responsable: "Omar", observaciones: "Remisión 18947 - Express 57 / Raul Paras" },
  { fecha: "02/01/2026", producto: "Imper", tipo: "Salida", cantidad: 60, unidad: "kg", responsable: "Gerardo", observaciones: "Remisión 18957 - Casa ING - 03/01/2026" },
  { fecha: "02/01/2026", producto: "Fibra 2", tipo: "Salida", cantidad: 36, unidad: "bolsas", responsable: "Gerardo", observaciones: "Remisiones 18954-18956 - Casa ING" },
  { fecha: "02/01/2026", producto: "Grava", tipo: "Entrada", cantidad: 145620, unidad: "kg", responsable: "Calizas", observaciones: "Entrada material remisiones 28.020112, 40.020114, 18.02011, 48.020116" },
  { fecha: "03/01/2026", producto: "Cemento", tipo: "Entrada", cantidad: 25930, unidad: "kg", responsable: "Holcim", observaciones: "Entrada remisión 342425480" },
  { fecha: "03/01/2026", producto: "Grava", tipo: "Entrada", cantidad: 35030, unidad: "kg", responsable: "Calizas", observaciones: "Entrada remisión 34.030113" },
];

const stockData: StockItem[] = [
  { producto: "Cemento", stockActual: 55513, unidad: "kg", minimo: 20000, status: "Normal" },
  { producto: "Grava", stockActual: 314455, unidad: "kg", minimo: 50000, status: "Normal" },
  { producto: "Arena 4", stockActual: 442294, unidad: "kg", minimo: 50000, status: "Normal" },
  { producto: "Aditivo", stockActual: -3514, unidad: "L", minimo: 0, status: "Stock bajo" },
  { producto: "HR25", stockActual: 297, unidad: "kg", minimo: 50, status: "Normal" },
  { producto: "Imper", stockActual: -225, unidad: "kg", minimo: 0, status: "Stock bajo" },
  { producto: "Costales fibra", stockActual: 12, unidad: "bolsas", minimo: 10, status: "Normal" },
  { producto: "Color / cubetas", stockActual: 22, unidad: "cubetas", minimo: 10, status: "Normal" },
  { producto: "Arena 5", stockActual: 32050, unidad: "kg", minimo: 10000, status: "Normal" },
];

export default function InventarioPage() {
  const insightsRef = useRef<HTMLDivElement>(null);
  const [movimientos, setMovimientos] = useState(movimientosData);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"movimientos" | "stock">("movimientos");
  const [activeInsight, setActiveInsight] = useState<"productos" | "entradas" | "salidas" | "alertas" | null>(null);
  const entradas = movimientos.filter(m => m.tipo === "Entrada").length;
  const salidas = movimientos.filter(m => m.tipo === "Salida").length;
  const entradaMovimientos = movimientos.filter((m) => m.tipo === "Entrada");
  const salidaMovimientos = movimientos.filter((m) => m.tipo === "Salida");
  const alertasStock = stockData.filter((s) => s.status === "Stock bajo");

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!insightsRef.current || insightsRef.current.contains(event.target as Node)) return;
      setActiveInsight(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleSave(values: Record<string, string>) {
    const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : "20/05/2026";

    setMovimientos((current) => [
      {
        fecha,
        producto: values.Producto || "Cemento CPC 30 (saco)",
        tipo: values.Tipo || "Entrada",
        cantidad: Number(values.Cantidad || 0),
        unidad: values.Unidad || "sacos",
        responsable: values.Responsable || "Carlos Ortiz",
        observaciones: values.Observaciones || "Producción del día",
      },
      ...current,
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
      <div ref={insightsRef} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Productos"
            value={String(stockData.length)}
            icon={Package}
            iconColor="text-blue-400"
            active={activeInsight === "productos"}
            onClick={() => setActiveInsight((current) => current === "productos" ? null : "productos")}
          />
          <KPICard
            title="Entradas del mes"
            value={String(entradas)}
            icon={ArrowDownCircle}
            iconColor="text-green-400"
            active={activeInsight === "entradas"}
            onClick={() => setActiveInsight((current) => current === "entradas" ? null : "entradas")}
          />
          <KPICard
            title="Salidas del mes"
            value={String(salidas)}
            icon={ArrowUpCircle}
            iconColor="text-red-400"
            active={activeInsight === "salidas"}
            onClick={() => setActiveInsight((current) => current === "salidas" ? null : "salidas")}
          />
          <KPICard
            title="Alertas stock"
            value={String(alertasStock.length)}
            icon={DollarSign}
            iconColor="text-orange-400"
            active={activeInsight === "alertas"}
            onClick={() => setActiveInsight((current) => current === "alertas" ? null : "alertas")}
          />
        </div>

        {activeInsight && (
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A]">
              <h3 className="text-white font-semibold">
                {activeInsight === "productos" && "Detalle de productos"}
                {activeInsight === "entradas" && "Entradas del mes"}
                {activeInsight === "salidas" && "Salidas del mes"}
                {activeInsight === "alertas" && "Alertas de stock"}
              </h3>
              <p className="text-gray-500 text-xs mt-1">Selecciona una tarjeta para ver el detalle de inventario.</p>
            </div>
            <div className="divide-y divide-[#3A3A3A]">
              {activeInsight === "productos" && stockData.map((item) => (
                <div key={item.producto} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.producto}</p>
                    <p className="text-xs text-gray-500">Mínimo requerido: {item.minimo.toLocaleString()} {item.unidad}</p>
                  </div>
                  <p className="text-sm text-gray-300">{item.stockActual.toLocaleString()} {item.unidad}</p>
                  <StatusBadge status={item.status} />
                </div>
              ))}

              {activeInsight === "entradas" && entradaMovimientos.map((item) => (
                <div key={`${item.fecha}-${item.producto}-${item.cantidad}-${item.observaciones}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.producto}</p>
                  <div>
                    <p className="text-sm text-gray-200">{item.responsable}</p>
                    <p className="text-xs text-gray-500">{item.fecha} · {item.observaciones}</p>
                  </div>
                  <p className="text-sm font-semibold text-green-400">{item.cantidad.toLocaleString()} {item.unidad}</p>
                </div>
              ))}

              {activeInsight === "salidas" && salidaMovimientos.map((item) => (
                <div key={`${item.fecha}-${item.producto}-${item.cantidad}-${item.observaciones}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.producto}</p>
                  <div>
                    <p className="text-sm text-gray-200">{item.responsable}</p>
                    <p className="text-xs text-gray-500">{item.fecha} · {item.observaciones}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-400">{item.cantidad.toLocaleString()} {item.unidad}</p>
                </div>
              ))}

              {activeInsight === "alertas" && alertasStock.map((item) => (
                <div key={item.producto} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.producto}</p>
                    <p className="text-xs text-gray-500">Stock mínimo: {item.minimo.toLocaleString()} {item.unidad}</p>
                  </div>
                  <p className="text-sm font-semibold text-orange-400">{item.stockActual.toLocaleString()} {item.unidad}</p>
                  <StatusBadge status={item.status} />
                </div>
              ))}

              {activeInsight === "alertas" && alertasStock.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-500">No hay alertas de stock activas.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showForm}
        title="Registrar movimiento"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
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
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Producto</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {stockData.map((item) => <option key={item.producto}>{item.producto}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cantidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[5, 10, 15, 50, 100, 120, 200, 500].map((cantidad) => <option key={cantidad}>{cantidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["sacos", "ton", "m³", "litros", "kg"].map((unidad) => <option key={unidad}>{unidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Carlos Ortiz", "José Martínez", "Luis Ramírez", "Ana López"].map((responsable) => <option key={responsable}>{responsable}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Producción del día", "Pedido quincenal", "Proveedor Bancos MTY", "Urgencia proyecto Apodaca", "Mezcla zona norte"].map((observacion) => <option key={observacion}>{observacion}</option>)}
              </select>
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
                {movimientos.map((m, i) => (
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
