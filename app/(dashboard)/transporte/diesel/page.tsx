"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, DollarSign, Filter, Fuel, Gauge, Plus } from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
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
  combustible: string;
  litros: number;
  precioL: number;
  total: number;
  kmRecorridos: number;
  rendimiento: string;
  recibo: string;
}

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function DieselPage() {
  const [cargas, setCargas] = useState<CargaDiesel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCostoUnidad, setShowCostoUnidad] = useState(false);
  const [filterUnidad, setFilterUnidad] = useState("Todas");

  useEffect(() => {
    getCollectionDocs<CargaDiesel>(COLLECTIONS.diesel).then(setCargas);
  }, []);

  const totalLitros = cargas.reduce((s, d) => s + d.litros, 0);
  const totalCosto = cargas.reduce((s, d) => s + d.total, 0);
  const unidadesDiesel = ["Todas", ...Array.from(new Set(cargas.map((d) => d.unidad)))];
  const bajoRendimiento = cargas.filter((d) => Number(d.rendimiento.split(" ")[0]) < 2.9).length;
  const filteredDiesel = cargas.filter((d) => {
    return filterUnidad === "Todas" || d.unidad === filterUnidad;
  });
  const costosPorDia: { dia: string; DC01: number; DC03: number; DC07: number }[] = [];
  const rendimientoValores = cargas.map(d => Number(d.rendimiento.split(" ")[0])).filter(v => v > 0);
  const promedioRendimiento = rendimientoValores.length > 0
    ? `${(rendimientoValores.reduce((s, v) => s + v, 0) / rendimientoValores.length).toFixed(2)} km/L`
    : "0.00 km/L";
  const costoPorUnidad = Array.from(
    cargas.reduce((summary, carga) => {
      const current = summary.get(carga.unidad) ?? { unidad: carga.unidad, litros: 0, costo: 0, cargas: 0 };
      summary.set(carga.unidad, {
        unidad: carga.unidad,
        litros: current.litros + carga.litros,
        costo: current.costo + carga.total,
        cargas: current.cargas + 1,
      });
      return summary;
    }, new Map<string, { unidad: string; litros: number; costo: number; cargas: number }>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.costo - a.costo);

  async function handleSave(values: Record<string, string>) {
    const litros = Number(values["Litros cargados"]?.replace(" L", "") || 0);
    const precioL = Number(values["Precio por litro ($)"] || 0);
    const kmRecorridos = Number(values["Km recorridos"]?.replace(" km", "") || 0);
    const rendimiento = litros > 0 ? `${(kmRecorridos / litros).toFixed(1)} km/L` : "0.0 km/L";
    const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const newCarga: CargaDiesel = {
      fecha,
      unidad: values.Unidad || "DC-03",
      operador: values.Operador || "Luis Ramírez",
      combustible: "DIESEL",
      litros,
      precioL,
      total: Math.round(litros * precioL),
      kmRecorridos,
      rendimiento,
      recibo: "Nuevo",
    };
    setCargas((current) => [newCarga, ...current]);
    await upsertDocument(COLLECTIONS.diesel, Date.now().toString(), newCarga);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total litros del mes" value={`${totalLitros.toLocaleString()} L`} icon={Fuel} iconColor="text-yellow-400" />
        <KPICard title="Costo total del mes" value={`$${totalCosto.toLocaleString()}`} icon={DollarSign} iconColor="text-[#CC2229]" />
        <KPICard title="Promedio rendimiento" value={promedioRendimiento} icon={Gauge} iconColor="text-blue-400" />
        <KPICard title="Bajo rendimiento" value={String(bajoRendimiento)} icon={AlertTriangle} iconColor="text-orange-400" subtitle="Menor a 2.9 km/L" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar carga de diesel"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
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
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {unidadesDiesel.filter((u) => u !== "Todas").map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Operador</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Luis Ramírez", "Carlos Mendoza", "José García", "Miguel Torres", "Roberto Flores", "Alejandro Reyes"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Litros cargados</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["140", "150", "165", "180", "190", "200"].map((l) => <option key={l}>{l} L</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Precio por litro ($)</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["21.80", "21.90", "22.00", "22.10", "22.30", "22.50"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Km recorridos</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["390", "420", "480", "540", "600", "620"].map((km) => <option key={km}>{km} km</option>)}
              </select>
            </div>
          </div>
      </FormModal>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400" />
        <select
          value={filterUnidad}
          onChange={(e) => setFilterUnidad(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {unidadesDiesel.map((unidad) => <option key={unidad}>{unidad}</option>)}
        </select>
        <button
          onClick={() => setShowCostoUnidad((value) => !value)}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
        >
          <DollarSign size={15} />
          {showCostoUnidad ? "Ocultar costo por unidad" : "Ver costo por unidad"}
        </button>
        <span className="text-gray-500 text-xs ml-auto">{filteredDiesel.length} cargas</span>
      </div>

      {showCostoUnidad && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Costo por unidad</h3>
              <p className="text-gray-500 text-xs mt-1">Resumen acumulado de litros, cargas y costo total por unidad.</p>
            </div>
            <button
              onClick={() => setShowCostoUnidad(false)}
              className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
            >
              Cerrar resumen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Unidad", "Cargas", "Litros", "Costo total", "Costo promedio/L"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {costoPorUnidad.map((item) => (
                  <tr key={item.unidad} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-white font-semibold">{item.unidad}</td>
                    <td className="px-4 py-3 text-gray-300">{item.cargas}</td>
                    <td className="px-4 py-3 text-yellow-400">{item.litros.toLocaleString(undefined, { maximumFractionDigits: 2 })} L</td>
                    <td className="px-4 py-3 text-white font-semibold">${item.costo.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-gray-300">
                      ${item.litros > 0 ? (item.costo / item.litros).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                {["Fecha", "Unidad", "Combustible", "Litros", "Precio/L", "Total", "Km Recorridos", "Rendimiento", "Recibo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filteredDiesel.map((d, i) => (
                <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{d.fecha}</td>
                  <td className="px-4 py-3 text-white font-semibold">{d.unidad}</td>
                  <td className="px-4 py-3 text-gray-200">{d.combustible}</td>
                  <td className="px-4 py-3 text-yellow-400">{d.litros} L</td>
                  <td className="px-4 py-3 text-gray-300">${d.precioL.toFixed(2)}</td>
                  <td className="px-4 py-3 text-white font-semibold">${d.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-300">{d.kmRecorridos} km</td>
                  <td className={`px-4 py-3 ${Number(d.rendimiento.split(" ")[0]) < 2.9 ? "text-orange-400 font-semibold" : "text-blue-400"}`}>{d.rendimiento}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{d.recibo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
