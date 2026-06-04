"use client";

import { useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search, UserRound } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  clientesEstadoCuenta,
  generarEstadoCuentaCliente,
} from "@/lib/clientStatements";

export default function EstadoCuentaClientesPage() {
  const [clienteId, setClienteId] = useState(clientesEstadoCuenta[0]?.id ?? "");
  const [fechaInicio, setFechaInicio] = useState("2026-05-01");
  const [fechaFin, setFechaFin] = useState("2026-05-31");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [generadoEn, setGeneradoEn] = useState("");

  const estadoCuenta = useMemo(() => {
    return generarEstadoCuentaCliente({ clienteId, fechaInicio, fechaFin });
  }, [clienteId, fechaInicio, fechaFin]);

  const movimientosFiltrados = estadoCuenta.movimientos.filter((movimiento) => {
    const term = query.toLowerCase();
    return (
      movimiento.concepto.toLowerCase().includes(term) ||
      movimiento.referencia.toLowerCase().includes(term)
    );
  });

  function handleGenerarEstado() {
    setLoading(true);
    setTimeout(() => {
      setGeneradoEn(new Date().toLocaleString("es-MX"));
      setLoading(false);
    }, 500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Saldos, cargos, abonos y vencimientos de CxC</p>
        </div>
        <button
          onClick={handleGenerarEstado}
          disabled={loading}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
          {loading ? "Generando..." : "Generar estado"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Saldo inicial" value={`$${estadoCuenta.saldoInicial.toLocaleString()}`} icon={FileText} iconColor="text-blue-400" />
        <KPICard title="Cargos del periodo" value={`$${estadoCuenta.cargos.toLocaleString()}`} icon={Download} iconColor="text-[#CC2229]" />
        <KPICard title="Abonos del periodo" value={`$${estadoCuenta.abonos.toLocaleString()}`} icon={RefreshCw} iconColor="text-green-400" />
        <KPICard title="Saldo actual" value={`$${estadoCuenta.saldoFinal.toLocaleString()}`} icon={UserRound} iconColor="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cliente</label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              >
                {clientesEstadoCuenta.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha inicial</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha final</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {generadoEn ? `Último estado generado: ${generadoEn}` : "Selecciona un cliente y genera su estado de cuenta."}
          </p>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Datos del cliente</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3 text-gray-400">
              <span>RFC</span>
              <span className="text-white font-mono text-xs">{estadoCuenta.cliente.rfc}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-400">
              <span>Días crédito</span>
              <span className="text-white">{estadoCuenta.cliente.diasCredito}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-400">
              <span>Límite crédito</span>
              <span className="text-white">${estadoCuenta.cliente.limiteCredito.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-[#3A3A3A] pt-2 text-gray-400">
              <span>Vencido</span>
              <span className="text-red-400 font-semibold">${estadoCuenta.vencido.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-400">
              <span>Por vencer</span>
              <span className="text-green-400 font-semibold">${estadoCuenta.porVencer.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Detalle del estado de cuenta</h3>
            <p className="text-xs text-gray-500 mt-0.5">{estadoCuenta.cliente.nombre}</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto o referencia"
              className="w-72 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Fecha", "Referencia", "Concepto", "Tipo", "Cargo", "Abono", "Vence", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {movimientosFiltrados.map((movimiento) => (
                <tr key={movimiento.id} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{movimiento.fecha}</td>
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{movimiento.referencia}</td>
                  <td className="px-4 py-3 text-gray-200">{movimiento.concepto}</td>
                  <td className="px-4 py-3"><StatusBadge status={movimiento.tipo === "cargo" ? "salida" : "entrada"} /></td>
                  <td className="px-4 py-3 text-white font-semibold">{movimiento.cargo ? `$${movimiento.cargo.toLocaleString()}` : "-"}</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">{movimiento.abono ? `$${movimiento.abono.toLocaleString()}` : "-"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{movimiento.vencimiento}</td>
                  <td className="px-4 py-3 text-white font-bold">${movimiento.saldo.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                <td className="px-4 py-3 text-white font-semibold" colSpan={7}>Saldo final</td>
                <td className="px-4 py-3 text-[#CC2229] font-bold text-base">${estadoCuenta.saldoFinal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
