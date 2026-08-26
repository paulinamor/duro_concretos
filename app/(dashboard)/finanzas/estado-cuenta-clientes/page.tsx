"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText, RefreshCw, Search, UserRound } from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, COLLECTIONS } from "@/lib/db";
import AppSelect from "@/components/AppSelect";
import { filterByPlanta } from "@/lib/auth";
import type { Cuenta } from "@/components/finanzas/SatAccountsPage";
import type { Cliente } from "@/lib/crmClientes";
import { todayCST } from "@/lib/dateUtils";

function norm(s?: string | null) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

const todayISO = todayCST;
function firstOfMonth() { return todayCST().slice(0, 7) + "-01"; }

interface Programacion {
  id?: string;
  dia: string;
  cliente: string;
  total: number | null;
  m3Totales: number | null;
  folio?: string;
  montoPagado: number | null;
  fechaPago?: string;
  nombreObra?: string;
  planta?: string;
}

interface Movimiento {
  id: string;
  fecha: string;
  vencimiento: string;
  tipo: "cargo" | "abono";
  fuente: "cxc" | "programacion";
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo: number;
}

function fmt(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EstadoCuentaClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  // Canonical display names for the dropdown — built from financial sources
  const [clientesLista, setClientesLista] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [clienteNombre, setClienteNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState(firstOfMonth());
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [query, setQuery] = useState("");
  const [generadoEn, setGeneradoEn] = useState("");

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<Cuenta>(COLLECTIONS.cuentasPorCobrar),
      getCollectionDocs<Programacion>(COLLECTIONS.programaciones),
    ]).then(([cls, cxc, progs]) => {
      const filtCxC = filterByPlanta(cxc);
      const filtProgs = filterByPlanta(progs as (Programacion & { planta?: string })[]);
      setCuentas(filtCxC);
      setProgramaciones(filtProgs);
      setClientes(cls);

      // Build canonical name map: normKey → preferred display name.
      // CxC contraparte takes priority — it's the financial source of truth.
      // Programaciones override clientes. CxC overrides both.
      const nameMap = new Map<string, string>();

      cls.forEach((c) => {
        if (c.razonSocial?.trim()) nameMap.set(norm(c.razonSocial), c.razonSocial);
      });
      filtProgs
        .filter((p) => (p.total ?? 0) > 0 && p.cliente?.trim())
        .forEach((p) => nameMap.set(norm(p.cliente), p.cliente));
      filtCxC
        .filter((c) => c.contraparte?.trim())
        .forEach((c) => nameMap.set(norm(c.contraparte), c.contraparte));

      const lista = [...nameMap.values()].sort();
      setClientesLista(lista);

      // Auto-select first client that has CxC or programacion data
      const withActivity = new Set([
        ...filtCxC.map((c) => norm(c.contraparte)).filter(Boolean),
        ...filtProgs.filter((p) => (p.total ?? 0) > 0).map((p) => norm(p.cliente)).filter(Boolean),
      ]);
      const primero = lista.find((n) => withActivity.has(norm(n))) ?? lista[0] ?? "";
      if (primero) setClienteNombre(primero);
      setDataLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Match a clientes record using exact norm first, then prefix (handles truncated names)
  const clienteInfo = useMemo((): Cliente | null => {
    if (!clienteNombre) return null;
    const n = norm(clienteNombre);
    const exact = clientes.find((c) => norm(c.razonSocial) === n);
    if (exact) return exact;
    // Partial match: at least 12 chars in common at the start
    const prefix = n.slice(0, Math.min(n.length, 12));
    return clientes.find((c) => norm(c.razonSocial).startsWith(prefix)) ?? null;
  }, [clientes, clienteNombre]);

  const estadoCuenta = useMemo(() => {
    const empty = {
      movimientos: [] as Movimiento[],
      saldoInicial: 0, cargos: 0, abonos: 0, saldoFinal: 0, vencido: 0, porVencer: 0,
    };
    if (!clienteNombre) return empty;

    const clienteNorm = norm(clienteNombre);

    // CxC records — match on normalized contraparte
    const cuentasCliente = cuentas.filter((c) => norm(c.contraparte) === clienteNorm);

    // Programaciones not already covered by a CxC record
    const cxcProgIds = new Set(cuentasCliente.map((c) => c.programacionId).filter(Boolean));
    const progsCliente = programaciones.filter(
      (p) => norm(p.cliente) === clienteNorm && (p.total ?? 0) > 0 && !cxcProgIds.has(p.id),
    );

    const raw: Omit<Movimiento, "saldo">[] = [];

    // 1 — CxC: one cargo per document, one abono per payment entry
    for (const cuenta of cuentasCliente) {
      raw.push({
        id: `cxc-${cuenta.id}`,
        fecha: cuenta.fecha,
        vencimiento: cuenta.vencimiento ?? "",
        tipo: "cargo",
        fuente: "cxc",
        concepto: cuenta.concepto || cuenta.tipo,
        referencia: cuenta.folio || cuenta.uuid?.slice(0, 8) || (cuenta.id ?? ""),
        cargo: cuenta.total,
        abono: 0,
      });
      for (const ab of cuenta.abonos ?? []) {
        raw.push({
          id: `cxc-ab-${cuenta.id}-${ab.fecha}`,
          fecha: ab.fecha,
          vencimiento: cuenta.vencimiento ?? "",
          tipo: "abono",
          fuente: "cxc",
          concepto: `Pago — ${cuenta.concepto || cuenta.tipo}`,
          referencia: cuenta.folio || (cuenta.id ?? ""),
          cargo: 0,
          abono: ab.monto,
        });
      }
    }

    // 2 — Programaciones: cargo on day + abono if montoPagado recorded with fechaPago
    for (const prog of progsCliente) {
      const ref = prog.folio ?? prog.id ?? "";
      raw.push({
        id: `prog-${prog.id}`,
        fecha: prog.dia,
        vencimiento: prog.fechaPago || prog.dia,
        tipo: "cargo",
        fuente: "programacion",
        concepto: [
          "Pedido concreto",
          prog.m3Totales ? `${prog.m3Totales} m³` : null,
          prog.nombreObra ? `— ${prog.nombreObra}` : null,
        ].filter(Boolean).join(" "),
        referencia: ref,
        cargo: prog.total ?? 0,
        abono: 0,
      });
      if ((prog.montoPagado ?? 0) > 0 && prog.fechaPago) {
        raw.push({
          id: `prog-pago-${prog.id}`,
          fecha: prog.fechaPago,
          vencimiento: prog.fechaPago,
          tipo: "abono",
          fuente: "programacion",
          concepto: `Pago pedido${prog.nombreObra ? ` — ${prog.nombreObra}` : ""}`,
          referencia: ref,
          cargo: 0,
          abono: prog.montoPagado ?? 0,
        });
      }
    }

    raw.sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Saldo inicial = net of all movements before the selected period start
    const saldoInicial = raw
      .filter((m) => m.fecha < fechaInicio)
      .reduce((s, m) => s + m.cargo - m.abono, 0);

    // Period movements with running saldo
    const delPeriodo = raw.filter((m) => m.fecha >= fechaInicio && m.fecha <= fechaFin);
    let saldo = saldoInicial;
    const movimientos: Movimiento[] = delPeriodo.map((m) => {
      saldo += m.cargo - m.abono;
      return { ...m, saldo };
    });

    const cargos = delPeriodo.reduce((s, m) => s + m.cargo, 0);
    const abonos = delPeriodo.reduce((s, m) => s + m.abono, 0);

    // Vencido: overdue CxC saldo
    const hoy = new Date();
    const vencido = cuentasCliente
      .filter((c) => c.vencimiento && new Date(c.vencimiento + "T00:00:00") < hoy && (c.total - (c.montoPagado ?? 0)) > 0)
      .reduce((s, c) => s + c.total - (c.montoPagado ?? 0), 0);

    return { movimientos, saldoInicial, cargos, abonos, saldoFinal: saldo, vencido, porVencer: Math.max(saldo - vencido, 0) };
  }, [cuentas, programaciones, clienteNombre, fechaInicio, fechaFin]);

  const movimientosFiltrados = useMemo(() => {
    const term = query.toLowerCase();
    return estadoCuenta.movimientos.filter(
      (m) => m.concepto.toLowerCase().includes(term) || m.referencia.toLowerCase().includes(term),
    );
  }, [estadoCuenta.movimientos, query]);

  if (dataLoading) {
    return <div className="flex items-center justify-center py-32 text-gray-500 text-sm">Cargando datos…</div>;
  }
  if (clientesLista.length === 0) {
    return <div className="flex items-center justify-center py-32 text-gray-500 text-sm">No hay clientes registrados.</div>;
  }

  const rfcCliente =
    clienteInfo?.rfc ??
    cuentas.find((c) => norm(c.contraparte) === norm(clienteNombre))?.rfc ??
    "—";
  const limiteCred = clienteInfo?.limiteCredito ?? 0;
  const diasCred = clienteInfo?.diasCredito ?? 0;
  const m3Acum = clienteInfo?.m3Acumulados ?? 0;
  const saldoPend = clienteInfo?.saldoPendiente ?? estadoCuenta.saldoFinal;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Saldo inicial" value={fmt(estadoCuenta.saldoInicial)} icon={FileText} iconColor="text-blue-400" />
        <KPICard title="Cargos del periodo" value={fmt(estadoCuenta.cargos)} icon={Download} iconColor="text-[#CC2229]" />
        <KPICard title="Abonos del periodo" value={fmt(estadoCuenta.abonos)} icon={RefreshCw} iconColor="text-green-400" />
        <KPICard title="Saldo actual" value={fmt(estadoCuenta.saldoFinal)} icon={UserRound} iconColor="text-orange-400" />
      </div>

      {/* Filtros + tarjeta cliente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cliente</label>
              <AppSelect dark value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)}>
                {clientesLista.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </AppSelect>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha inicial</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha final</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {generadoEn
              ? `Último estado generado: ${generadoEn}`
              : "Selecciona un cliente y el período para ver su estado de cuenta."}
          </p>
        </div>

        {/* Tarjeta cliente */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5 space-y-3">
          <h3 className="text-white font-semibold">Datos del cliente</h3>
          <div className="space-y-2 text-sm">
            <Row label="RFC" value={<span className="font-mono text-xs text-white">{rfcCliente}</span>} />
            <Row
              label="Documentos"
              value={<span className="text-white">{estadoCuenta.movimientos.filter((m) => m.tipo === "cargo").length}</span>}
            />
            {m3Acum > 0 && (
              <Row label="m³ acumulados" value={<span className="text-white">{m3Acum.toLocaleString("es-MX")} m³</span>} />
            )}
            {diasCred > 0 && (
              <Row label="Días de crédito" value={<span className="text-white">{diasCred} días</span>} />
            )}
            {limiteCred > 0 && (
              <Row label="Límite crédito" value={<span className="text-white">{fmt(limiteCred)}</span>} />
            )}
          </div>
          <div className="border-t border-[#3A3A3A] pt-3 space-y-2 text-sm">
            <Row
              label="Vencido"
              value={
                <span className={estadoCuenta.vencido > 0 ? "text-red-400 font-semibold" : "text-gray-400"}>
                  {fmt(estadoCuenta.vencido)}
                </span>
              }
            />
            <Row
              label="Por vencer"
              value={
                <span className={estadoCuenta.porVencer > 0 ? "text-green-400 font-semibold" : "text-gray-400"}>
                  {fmt(estadoCuenta.porVencer)}
                </span>
              }
            />
            {limiteCred > 0 && (
              <Row
                label="Disponible"
                value={
                  <span className={limiteCred - saldoPend >= 0 ? "text-blue-400 font-semibold" : "text-red-400 font-semibold"}>
                    {fmt(Math.max(limiteCred - saldoPend, 0))}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Detalle del estado de cuenta</h3>
            <p className="text-xs text-gray-500 mt-0.5">{clienteNombre}</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto o referencia"
              className="w-72 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Fecha", "Referencia", "Concepto", "Fuente", "Cargo", "Abono", "Vence", "Saldo"].map((h) => (
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
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-600 text-sm">
                    Sin movimientos en el período seleccionado.
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{m.fecha}</td>
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs whitespace-nowrap">{m.referencia}</td>
                    <td className="px-4 py-3 text-gray-200 max-w-xs truncate">{m.concepto}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.fuente === "cxc"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {m.fuente === "cxc" ? "Factura" : "Pedido"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">
                      {m.cargo ? fmt(m.cargo) : "—"}
                    </td>
                    <td className="px-4 py-3 text-green-400 font-semibold whitespace-nowrap">
                      {m.abono ? fmt(m.abono) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{m.vencimiento || "—"}</td>
                    <td
                      className={`px-4 py-3 font-bold whitespace-nowrap ${
                        m.saldo > 0 ? "text-[#CC2229]" : "text-green-400"
                      }`}
                    >
                      {fmt(m.saldo)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {movimientosFiltrados.length > 0 && (
              <tfoot>
                <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                  <td className="px-4 py-3 text-white font-semibold" colSpan={7}>
                    Saldo final del período
                  </td>
                  <td
                    className={`px-4 py-3 font-bold text-base ${
                      estadoCuenta.saldoFinal > 0 ? "text-[#CC2229]" : "text-green-400"
                    }`}
                  >
                    {fmt(estadoCuenta.saldoFinal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3 text-gray-400">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
