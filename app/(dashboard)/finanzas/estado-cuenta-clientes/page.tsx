"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search, UserRound } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { filterByPlanta } from "@/lib/auth";
import type { Cuenta } from "@/components/finanzas/SatAccountsPage";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface Movimiento {
  id: string;
  fecha: string;
  vencimiento: string;
  tipo: "cargo" | "abono";
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo: number;
}

export default function EstadoCuentaClientesPage() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [clienteNombre, setClienteNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth());
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [query, setQuery] = useState("");
  const [generadoEn, setGeneradoEn] = useState("");

  useEffect(() => {
    getCollectionDocs<Cuenta>(COLLECTIONS.cuentasPorCobrar).then((docs) => {
      const filtered = filterByPlanta(docs);
      setCuentas(filtered);
      // Auto-select first client alphabetically
      const nombres = [...new Set(filtered.map((c) => c.contraparte).filter(Boolean))].sort();
      if (nombres[0] && !clienteNombre) setClienteNombre(nombres[0]);
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientesUnicos = useMemo(() => {
    return [...new Set(cuentas.map((c) => c.contraparte).filter(Boolean))].sort();
  }, [cuentas]);

  const rfcCliente = useMemo(() => {
    return cuentas.find((c) => c.contraparte === clienteNombre)?.rfc ?? "—";
  }, [cuentas, clienteNombre]);

  const estadoCuenta = useMemo(() => {
    if (!clienteNombre) return { movimientos: [], saldoInicial: 0, cargos: 0, abonos: 0, saldoFinal: 0, vencido: 0, porVencer: 0 };

    const clienteCuentas = cuentas.filter((c) => c.contraparte === clienteNombre);

    // Saldo inicial: cargos/abonos de docs anteriores al período
    const previas = clienteCuentas.filter((c) => c.fecha < fechaInicio);
    const saldoInicial = previas.reduce((s, c) => s + c.total - (c.montoPagado ?? 0), 0);

    // Movimientos del período
    const delPeriodo = clienteCuentas
      .filter((c) => c.fecha >= fechaInicio && c.fecha <= fechaFin)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const rawMovimientos: Omit<Movimiento, "saldo">[] = [];
    for (const cuenta of delPeriodo) {
      rawMovimientos.push({
        id: `c-${cuenta.id}`,
        fecha: cuenta.fecha,
        vencimiento: cuenta.vencimiento,
        tipo: "cargo",
        concepto: cuenta.concepto || cuenta.tipo,
        referencia: cuenta.folio || cuenta.uuid?.slice(0, 8) || (cuenta.id ?? ""),
        cargo: cuenta.total,
        abono: 0,
      });
      for (const ab of cuenta.abonos ?? []) {
        rawMovimientos.push({
          id: `a-${cuenta.id}-${ab.fecha}`,
          fecha: ab.fecha,
          vencimiento: cuenta.vencimiento,
          tipo: "abono",
          concepto: `Pago — ${cuenta.concepto || cuenta.tipo}`,
          referencia: cuenta.folio || (cuenta.id ?? ""),
          cargo: 0,
          abono: ab.monto,
        });
      }
    }

    rawMovimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));

    let saldo = saldoInicial;
    const movimientos: Movimiento[] = rawMovimientos.map((m) => {
      saldo += m.cargo - m.abono;
      return { ...m, saldo };
    });

    const cargos = rawMovimientos.reduce((s, m) => s + m.cargo, 0);
    const abonos = rawMovimientos.reduce((s, m) => s + m.abono, 0);
    const hoy = new Date();
    const vencido = delPeriodo
      .filter((c) => new Date(c.vencimiento + "T00:00:00") < hoy && (c.total - (c.montoPagado ?? 0)) > 0)
      .reduce((s, c) => s + c.total - (c.montoPagado ?? 0), 0);

    return { movimientos, saldoInicial, cargos, abonos, saldoFinal: saldo, vencido, porVencer: Math.max(saldo - vencido, 0) };
  }, [cuentas, clienteNombre, fechaInicio, fechaFin]);

  const movimientosFiltrados = useMemo(() => {
    const term = query.toLowerCase();
    return estadoCuenta.movimientos.filter((m) =>
      m.concepto.toLowerCase().includes(term) || m.referencia.toLowerCase().includes(term)
    );
  }, [estadoCuenta.movimientos, query]);

  if (dataLoading) {
    return <div className="flex items-center justify-center py-32 text-gray-500 text-sm">Cargando datos…</div>;
  }

  if (clientesUnicos.length === 0) {
    return <div className="flex items-center justify-center py-32 text-gray-500 text-sm">No hay documentos en Cuentas por Cobrar.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-sm mt-0.5">Saldos, cargos, abonos y vencimientos de CxC</p>
        <button
          onClick={() => setGeneradoEn(new Date().toLocaleString("es-MX"))}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Generar estado
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Saldo inicial" value={`$${estadoCuenta.saldoInicial.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} icon={FileText} iconColor="text-blue-400" />
        <KPICard title="Cargos del periodo" value={`$${estadoCuenta.cargos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} icon={Download} iconColor="text-[#CC2229]" />
        <KPICard title="Abonos del periodo" value={`$${estadoCuenta.abonos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} icon={RefreshCw} iconColor="text-green-400" />
        <KPICard title="Saldo actual" value={`$${estadoCuenta.saldoFinal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} icon={UserRound} iconColor="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cliente</label>
              <select
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              >
                {clientesUnicos.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha inicial</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha final</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {generadoEn ? `Último estado generado: ${generadoEn}` : "Selecciona un cliente y el período para ver su estado de cuenta."}
          </p>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Datos del cliente</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3 text-gray-400">
              <span>RFC</span>
              <span className="text-white font-mono text-xs">{rfcCliente}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-400">
              <span>Documentos</span>
              <span className="text-white">{estadoCuenta.movimientos.filter((m) => m.tipo === "cargo").length}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-[#3A3A3A] pt-2 text-gray-400">
              <span>Vencido</span>
              <span className="text-red-400 font-semibold">${estadoCuenta.vencido.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between gap-3 text-gray-400">
              <span>Por vencer</span>
              <span className="text-green-400 font-semibold">${estadoCuenta.porVencer.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Detalle del estado de cuenta</h3>
            <p className="text-xs text-gray-500 mt-0.5">{clienteNombre}</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto o referencia"
              className="w-72 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Fecha", "Referencia", "Concepto", "Tipo", "Cargo", "Abono", "Vence", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-600 text-sm">
                    Sin movimientos en el período seleccionado.
                  </td>
                </tr>
              ) : movimientosFiltrados.map((m) => (
                <tr key={m.id} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.fecha}</td>
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{m.referencia}</td>
                  <td className="px-4 py-3 text-gray-200">{m.concepto}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.tipo === "cargo" ? "salida" : "entrada"} /></td>
                  <td className="px-4 py-3 text-white font-semibold">{m.cargo ? `$${m.cargo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">{m.abono ? `$${m.abono.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.vencimiento}</td>
                  <td className="px-4 py-3 text-white font-bold">${m.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            {movimientosFiltrados.length > 0 && (
              <tfoot>
                <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                  <td className="px-4 py-3 text-white font-semibold" colSpan={7}>Saldo final del período</td>
                  <td className="px-4 py-3 text-[#CC2229] font-bold text-base">${estadoCuenta.saldoFinal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
