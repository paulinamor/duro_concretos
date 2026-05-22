"use client";

import { useState } from "react";
import { Banknote, TrendingUp, TrendingDown, DollarSign, Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

interface Transaccion {
  hora: string;
  descripcion: string;
  tipo: string;
  monto: number;
  responsable: string;
  saldo: number;
}

const transaccionesData: Transaccion[] = [
  { hora: "08:15", descripcion: "Saldo inicial del día", tipo: "Ingreso", monto: 15000, responsable: "Admin", saldo: 15000 },
  { hora: "09:30", descripcion: "Cobro viaje VJ-2026-140 (Apodaca)", tipo: "Ingreso", monto: 15200, responsable: "José García", saldo: 30200 },
  { hora: "10:45", descripcion: "Pago diesel DC-03", tipo: "Egreso", monto: 4050, responsable: "Luis Ramírez", saldo: 26150 },
  { hora: "11:20", descripcion: "Cobro viaje VJ-2026-138 (Guadalupe)", tipo: "Ingreso", monto: 13300, responsable: "Roberto Flores", saldo: 39450 },
  { hora: "12:00", descripcion: "Pago refacciones Taller MTY", tipo: "Egreso", monto: 3200, responsable: "Admin", saldo: 36250 },
  { hora: "13:30", descripcion: "Cobro viaje VJ-2026-137 (Sta. Catarina)", tipo: "Ingreso", monto: 12025, responsable: "Alejandro Reyes", saldo: 48275 },
  { hora: "14:00", descripcion: "Gastos varios operación", tipo: "Egreso", monto: 850, responsable: "Admin", saldo: 47425 },
  { hora: "15:30", descripcion: "Cobro viaje VJ-2026-136 (Escobedo)", tipo: "Ingreso", monto: 16150, responsable: "Fernando Castillo", saldo: 63575 },
  { hora: "16:00", descripcion: "Pago diesel DC-07", tipo: "Egreso", monto: 3375, responsable: "Carlos Mendoza", saldo: 60200 },
  { hora: "17:45", descripcion: "Cobro pendiente cliente Grupo Alfa", tipo: "Ingreso", monto: 22000, responsable: "Admin", saldo: 82200 },
];

const saldoInicial = 15000;
const ingresos = transaccionesData.filter(t => t.tipo === "Ingreso").reduce((s, t) => s + t.monto, 0);
const egresos = transaccionesData.filter(t => t.tipo === "Egreso").reduce((s, t) => s + t.monto, 0);
const saldoFinal = transaccionesData[transaccionesData.length - 1].saldo;

export default function EfectivoPage() {
  const [selectedDate, setSelectedDate] = useState("2026-05-20");
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Control de Efectivo</h1>
          <p className="text-gray-500 text-sm mt-0.5">Seguimiento de ingresos y egresos diarios</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Registrar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">Saldo inicial</p>
          <p className="text-xl font-bold text-white">${saldoInicial.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-green-900/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-400" /> Ingresos</p>
          <p className="text-xl font-bold text-green-400">${ingresos.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-red-900/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} className="text-red-400" /> Egresos</p>
          <p className="text-xl font-bold text-red-400">${egresos.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-[#CC2229]/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><DollarSign size={12} className="text-[#CC2229]" /> Saldo final</p>
          <p className="text-xl font-bold text-[#CC2229]">${saldoFinal.toLocaleString()}</p>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Registrar movimiento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Ingreso</option>
                <option>Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto ($)</label>
              <input type="number" placeholder="0.00" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <input type="text" placeholder="Nombre" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <input type="text" placeholder="Concepto del movimiento" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar</button>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Movimientos del día — {selectedDate}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Hora", "Descripción", "Tipo", "Monto", "Responsable", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {transaccionesData.map((t, i) => (
                <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.hora}</td>
                  <td className="px-4 py-3 text-gray-200">{t.descripcion}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.tipo} /></td>
                  <td className={`px-4 py-3 font-semibold ${t.tipo === "Ingreso" ? "text-green-400" : "text-red-400"}`}>
                    {t.tipo === "Ingreso" ? "+" : "-"}${t.monto.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{t.responsable}</td>
                  <td className="px-4 py-3 text-white font-bold">${t.saldo.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
