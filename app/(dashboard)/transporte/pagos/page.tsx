"use client";

import { useState } from "react";
import { DollarSign, Users, TrendingUp, FileText } from "lucide-react";
import KPICard from "@/components/KPICard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "semanal" | "quincenal" | "mensual";

interface Operador {
  nombre: string;
  viajes: number;
  m3Total: number;
  tarifaM3: number;
  subtotal: number;
  bonos: number;
  deducciones: number;
  total: number;
}

const operadoresData: Operador[] = [
  { nombre: "Luis Ramírez", viajes: 22, m3Total: 160.5, tarifaM3: 85, subtotal: 13643, bonos: 500, deducciones: 0, total: 14143 },
  { nombre: "Carlos Mendoza", viajes: 19, m3Total: 138.0, tarifaM3: 85, subtotal: 11730, bonos: 300, deducciones: 250, total: 11780 },
  { nombre: "José García", viajes: 21, m3Total: 158.0, tarifaM3: 90, subtotal: 14220, bonos: 500, deducciones: 0, total: 14720 },
  { nombre: "Miguel Torres", viajes: 17, m3Total: 120.5, tarifaM3: 85, subtotal: 10243, bonos: 0, deducciones: 500, total: 9743 },
  { nombre: "Roberto Flores", viajes: 20, m3Total: 145.0, tarifaM3: 85, subtotal: 12325, bonos: 300, deducciones: 0, total: 12625 },
  { nombre: "Alejandro Reyes", viajes: 18, m3Total: 132.0, tarifaM3: 85, subtotal: 11220, bonos: 200, deducciones: 100, total: 11320 },
];

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

const totalPagar = operadoresData.reduce((s, o) => s + o.total, 0);
const pagoPromedio = Math.round(totalPagar / operadoresData.length);

export default function PagosPage() {
  const [period, setPeriod] = useState<Period>("mensual");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Pago de Operadores</h1>
          <p className="text-gray-500 text-sm mt-0.5">Cálculo y gestión de nómina operadores</p>
        </div>
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          {(["semanal", "quincenal", "mensual"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                period === p
                  ? "bg-[#CC2229] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total a pagar"
          value={`$${totalPagar.toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-[#CC2229]"
        />
        <KPICard
          title="Operadores activos"
          value={String(operadoresData.length)}
          icon={Users}
          iconColor="text-blue-400"
        />
        <KPICard
          title="Pago promedio"
          value={`$${pagoPromedio.toLocaleString()}`}
          icon={TrendingUp}
          iconColor="text-green-400"
        />
      </div>

      {/* Chart */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4">Pago por operador</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={operadoresData.map(o => ({ nombre: o.nombre.split(" ")[0], total: o.total }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
            <XAxis dataKey="nombre" stroke="#6B7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Total"]} />
            <Bar dataKey="total" fill="#CC2229" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
          <h3 className="text-white font-semibold">Detalle de pagos — {period}</h3>
          <span className="text-xs text-gray-500">Mayo 2026</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Operador", "Viajes", "M3 Total", "Tarifa/M3", "Subtotal", "Bonos", "Deducciones", "Total a Pagar", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {operadoresData.map((o) => (
                <tr key={o.nombre} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{o.nombre}</td>
                  <td className="px-4 py-3 text-gray-300">{o.viajes}</td>
                  <td className="px-4 py-3 text-gray-300">{o.m3Total} m³</td>
                  <td className="px-4 py-3 text-gray-300">${o.tarifaM3}/m³</td>
                  <td className="px-4 py-3 text-gray-300">${o.subtotal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-400">+${o.bonos.toLocaleString()}</td>
                  <td className="px-4 py-3 text-red-400">-${o.deducciones.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-bold">${o.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1.5 text-xs bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors">
                      <FileText size={12} />
                      Recibo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                <td className="px-4 py-3 text-white font-semibold" colSpan={7}>Total</td>
                <td className="px-4 py-3 text-[#CC2229] font-bold text-base">${totalPagar.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
