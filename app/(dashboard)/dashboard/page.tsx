"use client";

import { Truck, Fuel, TrendingUp, Car } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const viajesPorSemana = [
  { semana: "Sem 1", viajes: 32 },
  { semana: "Sem 2", viajes: 38 },
  { semana: "Sem 3", viajes: 35 },
  { semana: "Sem 4", viajes: 37 },
];

const dieselPorUnidad = [
  { unidad: "DC-01", litros: 620 },
  { unidad: "DC-02", litros: 580 },
  { unidad: "DC-03", litros: 710 },
  { unidad: "DC-04", litros: 490 },
  { unidad: "DC-05", litros: 645 },
  { unidad: "DC-06", litros: 530 },
  { unidad: "DC-07", litros: 680 },
  { unidad: "DC-08", litros: 565 },
];

const recentTrips = [
  { folio: "VJ-2026-142", unidad: "DC-03", operador: "Luis Ramírez", m3: 7.5, destino: "Monterrey Centro", estado: "Completado", fecha: "20/05/2026" },
  { folio: "VJ-2026-141", unidad: "DC-07", operador: "Carlos Mendoza", m3: 6.0, destino: "San Nicolás", estado: "En ruta", fecha: "20/05/2026" },
  { folio: "VJ-2026-140", unidad: "DC-01", operador: "José García", m3: 8.0, destino: "Apodaca Industrial", estado: "Completado", fecha: "20/05/2026" },
  { folio: "VJ-2026-139", unidad: "DC-05", operador: "Miguel Torres", m3: 5.5, destino: "García NL", estado: "Cancelado", fecha: "19/05/2026" },
  { folio: "VJ-2026-138", unidad: "DC-02", operador: "Roberto Flores", m3: 7.0, destino: "Guadalupe NL", estado: "Completado", fecha: "19/05/2026" },
];

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Viajes del mes"
          value="142"
          icon={Truck}
          iconColor="text-green-400"
          trend={{ value: "+8% vs mes anterior", positive: true }}
        />
        <KPICard
          title="Diesel consumido"
          value="4,820 L"
          icon={Fuel}
          iconColor="text-yellow-400"
          subtitle="Costo: $57,840 MXN"
        />
        <KPICard
          title="Ventas del mes"
          value="$284,500"
          icon={TrendingUp}
          iconColor="text-green-400"
          trend={{ value: "+12% vs mes anterior", positive: true }}
        />
        <KPICard
          title="Unidades activas"
          value="8 / 10"
          icon={Car}
          iconColor="text-[#CC2229]"
          subtitle="2 en mantenimiento"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Viajes por semana</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={viajesPorSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
              <XAxis dataKey="semana" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="viajes"
                stroke="#CC2229"
                strokeWidth={2}
                dot={{ fill: "#CC2229", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Consumo de Diesel por Unidad (L)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dieselPorUnidad}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
              <XAxis dataKey="unidad" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="litros" fill="#CC2229" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Trips Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Viajes recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {["Folio", "Unidad", "Operador", "M3", "Destino", "Estado", "Fecha"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {recentTrips.map((t) => (
                <tr key={t.folio} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{t.folio}</td>
                  <td className="px-4 py-3 text-gray-200 font-semibold">{t.unidad}</td>
                  <td className="px-4 py-3 text-gray-200">{t.operador}</td>
                  <td className="px-4 py-3 text-gray-200">{t.m3} m³</td>
                  <td className="px-4 py-3 text-gray-300">{t.destino}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.estado} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
