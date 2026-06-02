"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";

interface Transaccion {
  hora: string;
  descripcion: string;
  tipo: string;
  monto: number;
  responsable: string;
  saldo: number;
}

const transaccionesData: Transaccion[] = [
  { hora: "20/03/26", descripcion: "ABRAHAM ARRIAGA - 4.5 m³ - Colinas del Aeropuerto", tipo: "Ingreso", monto: 16920, responsable: "SAM", saldo: 16920 },
  { hora: "21/03/26", descripcion: "PATRICIO BENAVIDES - 00 de 50kg", tipo: "Ingreso", monto: 8000, responsable: "SAM", saldo: 24920 },
  { hora: "09/04/26", descripcion: "JORGE ESTEBAN REYES - Residencial El Barrito", tipo: "Ingreso", monto: 9000, responsable: "SAM", saldo: 33920 },
  { hora: "14/04/26", descripcion: "ADRIAN LEAL - 36 m³ - Col. Terminal Monterrey", tipo: "Ingreso", monto: 29200, responsable: "SAM", saldo: 63120 },
  { hora: "16/04/26", descripcion: "CRISTO VIVE - 7 m³ - Camino Agua Fría Apodaca", tipo: "Ingreso", monto: 20300, responsable: "SAM", saldo: 83420 },
  { hora: "17/04/26", descripcion: "GABRIEL FRAGOSO - Dr. González", tipo: "Ingreso", monto: 10700, responsable: "SAM", saldo: 94120 },
  { hora: "18/04/26", descripcion: "MARIA SANTOS CANTU - 27 m³ - Pesquería NL", tipo: "Ingreso", monto: 71820, responsable: "SAM", saldo: 165940 },
  { hora: "18/04/26", descripcion: "CRISTO VIVE - 10 m³ - Camino Agua Fría Apodaca", tipo: "Ingreso", monto: 29000, responsable: "SAM", saldo: 194940 },
  { hora: "NO COLADO", descripcion: "MARIA SANTOS CANTU - Pesquería NL", tipo: "Ingreso", monto: 50000, responsable: "RAFA", saldo: 244940 },
  { hora: "04/26", descripcion: "GABRIEL FRAGOSO - 17 m³ - Mil Encinos", tipo: "Ingreso", monto: 52870, responsable: "RAFA", saldo: 297810 },
  { hora: "15/05/26", descripcion: "JIME GONZALEZ CISNEROS - Universo #3318", tipo: "Ingreso", monto: 21450, responsable: "GAYTAN", saldo: 319260 },
  { hora: "18/04/26", descripcion: "Robo de efectivo - salida de Samantha y Angel", tipo: "Egreso", monto: 4500, responsable: "SAMANTHA/ANGEL", saldo: 314760 },
];

const saldoInicial = 0;

export default function EfectivoPage() {
  const [transacciones, setTransacciones] = useState(transaccionesData);
  const [selectedDate, setSelectedDate] = useState("2026-05-20");
  const [showForm, setShowForm] = useState(false);
  const ingresos = transacciones.filter(t => t.tipo === "Ingreso").reduce((s, t) => s + t.monto, 0);
  const egresos = transacciones.filter(t => t.tipo === "Egreso").reduce((s, t) => s + t.monto, 0);
  const saldoFinal = transacciones[transacciones.length - 1]?.saldo ?? saldoInicial;

  function handleSave(values: Record<string, string>) {
    const monto = Number(values["Monto ($)"]?.replace(/[$,]/g, "") || 0);
    const tipo = values.Tipo || "Ingreso";
    const saldoActual = transacciones[transacciones.length - 1]?.saldo ?? saldoInicial;
    const descripcion = values.Descripción || "Cobro viaje";

    setTransacciones((current) => [
      {
        hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
        descripcion,
        tipo,
        monto,
        responsable: values.Responsable || "Admin",
        saldo: tipo === "Ingreso" ? saldoActual + monto : saldoActual - monto,
      },
      ...current,
    ]);
  }

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
            onClick={() => setShowForm(true)}
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
                <option>Ingreso</option>
                <option>Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto ($)</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[850, 3200, 3375, 4050, 12025, 13300, 15200, 16150, 22000].map((monto) => <option key={monto}>${monto.toLocaleString()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Admin", "José García", "Luis Ramírez", "Roberto Flores", "Alejandro Reyes", "Fernando Castillo", "Carlos Mendoza"].map((responsable) => <option key={responsable}>{responsable}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Cobro viaje", "Cobro pendiente cliente", "Pago diesel", "Pago refacciones", "Gastos varios operación", "Saldo inicial del día"].map((descripcion) => <option key={descripcion}>{descripcion}</option>)}
              </select>
            </div>
          </div>
      </FormModal>

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
              {transacciones.map((t, i) => (
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
