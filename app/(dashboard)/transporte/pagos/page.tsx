"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DollarSign, FileText, TrendingUp, Upload, Users } from "lucide-react";
import KPICard from "@/components/KPICard";
import { loadViajes, parseViajeDate, type Viaje } from "@/lib/viajes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "todos" | "semanal" | "quincenal" | "mensual";
type DriverView = "con-viajes" | "todos";

const tarifasPorChofer: Record<string, number> = {
  "José García": 90,
};

const bonosPorChofer: Record<string, number> = {
  "Luis Ramírez": 500,
  "Carlos Mendoza": 300,
  "José García": 500,
  "Roberto Flores": 300,
  "Alejandro Reyes": 200,
};

const deduccionesPorChofer: Record<string, number> = {
  "Carlos Mendoza": 250,
  "Miguel Torres": 500,
  "Alejandro Reyes": 100,
};

const choferesBase = [
  "Luis Ramírez",
  "Carlos Mendoza",
  "José García",
  "Miguel Torres",
  "Roberto Flores",
  "Alejandro Reyes",
  "Fernando Castillo",
  "Eduardo López",
];

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

const periodLabels: Record<Period, string> = {
  todos: "Todos",
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

function getReferenceDate(viajes: Viaje[]) {
  return viajes.reduce((latest, viaje) => {
    const date = parseViajeDate(viaje.fecha);
    return date > latest ? date : latest;
  }, parseViajeDate(viajes[0]?.fecha ?? "01/01/2026"));
}

function isInPeriod(viaje: Viaje, period: Period, referenceDate: Date) {
  const date = parseViajeDate(viaje.fecha);

  if (period === "todos") return true;

  if (period === "mensual") {
    return date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear();
  }

  if (period === "quincenal") {
    const firstHalf = referenceDate.getDate() <= 15;
    const minDay = firstHalf ? 1 : 16;
    const maxDay = firstHalf ? 15 : 31;
    return (
      date.getMonth() === referenceDate.getMonth() &&
      date.getFullYear() === referenceDate.getFullYear() &&
      date.getDate() >= minDay &&
      date.getDate() <= maxDay
    );
  }

  const start = new Date(referenceDate);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function buildPagos(viajes: Viaje[], period: Period, driverView: DriverView) {
  const referenceDate = getReferenceDate(viajes);
  const viajesPagables = viajes.filter((viaje) => viaje.estado === "Completado" && isInPeriod(viaje, period, referenceDate));
  const grouped = viajesPagables.reduce((summary, viaje) => {
    const current = summary.get(viaje.operador) ?? { nombre: viaje.operador, viajes: 0, m3Total: 0 };
    summary.set(viaje.operador, {
      nombre: viaje.operador,
      viajes: current.viajes + 1,
      m3Total: current.m3Total + viaje.m3,
    });
    return summary;
  }, new Map<string, { nombre: string; viajes: number; m3Total: number }>());
  const allDrivers = driverView === "todos"
    ? Array.from(new Set([...choferesBase, ...viajes.map((viaje) => viaje.operador)]))
    : Array.from(grouped.keys());

  return allDrivers.map((driver) => {
    const item = grouped.get(driver) ?? { nombre: driver, viajes: 0, m3Total: 0 };
    const tarifaM3 = tarifasPorChofer[item.nombre] ?? 85;
    const subtotal = Math.round(item.m3Total * tarifaM3);
    const bonos = bonosPorChofer[item.nombre] ?? 0;
    const deducciones = deduccionesPorChofer[item.nombre] ?? 0;

    return {
      ...item,
      m3Total: Number(item.m3Total.toFixed(2)),
      tarifaM3,
      subtotal,
      bonos,
      deducciones,
      total: subtotal + bonos - deducciones,
    };
  });
}

export default function PagosPage() {
  const [period, setPeriod] = useState<Period>("todos");
  const [driverView, setDriverView] = useState<DriverView>("con-viajes");
  const [uploadedReceipts, setUploadedReceipts] = useState<Record<string, string>>({});
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const operadoresData = useMemo(() => buildPagos(viajes, period, driverView), [viajes, period, driverView]);
  const totalPagar = operadoresData.reduce((s, o) => s + o.total, 0);
  const pagoPromedio = operadoresData.length > 0 ? Math.round(totalPagar / operadoresData.length) : 0;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setViajes(loadViajes()));

    function refreshViajes() {
      setViajes(loadViajes());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === "duro_concretos_viajes") setViajes(loadViajes());
    }

    function handleFocus() {
      setViajes(loadViajes());
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("duro:viajes-updated", refreshViajes);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("duro:viajes-updated", refreshViajes);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function handleReceiptUpload(operador: string, file?: File) {
    if (!file) return;

    setUploadedReceipts((current) => ({
      ...current,
      [operador]: file.name,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Cálculo automático desde viajes completados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
            {(["todos", "semanal", "quincenal", "mensual"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-[#CC2229] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
            {[
              { value: "con-viajes", label: "Solo con viajes" },
              { value: "todos", label: "Todos los choferes" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDriverView(option.value as DriverView)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  driverView === option.value
                    ? "bg-[#CC2229] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
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
          <h3 className="text-white font-semibold">Detalle de pagos — {periodLabels[period]}</h3>
          <span className="text-xs text-gray-500">{period === "todos" ? "Todos los viajes completados" : "Periodo seleccionado"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Chofer", "Viajes", "M3 Total", "Tarifa/M3", "Subtotal", "Bonos", "Deducciones", "Total a Pagar", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {operadoresData.map((o) => {
                const receiptName = uploadedReceipts[o.nombre];

                return (
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
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 text-xs bg-[#1A1A1A] border px-2.5 py-1.5 rounded-lg transition-colors ${
                      receiptName
                        ? "border-green-700 text-green-400 hover:text-green-300"
                        : "border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white"
                    }`}>
                      {receiptName ? <CheckCircle2 size={12} /> : <Upload size={12} />}
                      {receiptName ? "Subido" : "Recibo"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.xml"
                        className="hidden"
                        onChange={(event) => handleReceiptUpload(o.nombre, event.target.files?.[0])}
                      />
                    </label>
                    {receiptName && (
                      <p className="mt-1 max-w-32 truncate text-[11px] text-gray-500" title={receiptName}>
                        <FileText size={10} className="mr-1 inline" />
                        {receiptName}
                      </p>
                    )}
                  </td>
                </tr>
              );
              })}
              {operadoresData.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>
                    No hay viajes completados en este periodo.
                  </td>
                </tr>
              )}
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
