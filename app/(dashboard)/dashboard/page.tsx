"use client";

import { useEffect, useState } from "react";
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
} from "recharts";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { parseViajeDate, type Viaje } from "@/lib/viajes";

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function DashboardPage() {
  const [viajes, setViajes] = useState<Viaje[]>([]);

  useEffect(() => {
    getCollectionDocs<Viaje>(COLLECTIONS.viajes).then(setViajes);
  }, []);

  const totalM3 = viajes.filter(v => v.estado === "Completado").reduce((s, v) => s + v.m3, 0);
  const totalVentas = viajes.filter(v => v.estado === "Completado").reduce((s, v) => s + v.total, 0);
  const unidadesActivas = new Set(viajes.filter(v => v.estado !== "Cancelado").map(v => v.unidad)).size;

  // Group completed viajes by week (last 4 weeks)
  const now = new Date();
  const viajesPorSemana = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (3 - i) * 7 - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const count = viajes.filter(v => {
      const d = parseViajeDate(v.fecha);
      return d >= weekStart && d <= weekEnd;
    }).length;
    return { semana: `Sem ${i + 1}`, viajes: count };
  });

  const dieselPorUnidad: { unidad: string; litros: number }[] = [];

  const recentTrips = [...viajes]
    .sort((a, b) => b.folio.localeCompare(a.folio))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Viajes registrados"
          value={String(viajes.length)}
          icon={Truck}
          iconColor="text-green-400"
        />
        <KPICard
          title="M3 entregados"
          value={`${totalM3.toLocaleString()} m³`}
          icon={Fuel}
          iconColor="text-yellow-400"
        />
        <KPICard
          title="Ventas totales"
          value={`$${totalVentas.toLocaleString()}`}
          icon={TrendingUp}
          iconColor="text-green-400"
        />
        <KPICard
          title="Unidades activas"
          value={String(unidadesActivas)}
          icon={Car}
          iconColor="text-[#CC2229]"
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
              {recentTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sin viajes registrados.
                  </td>
                </tr>
              ) : recentTrips.map((t) => (
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
