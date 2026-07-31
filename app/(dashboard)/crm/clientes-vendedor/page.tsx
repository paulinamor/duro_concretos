"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Info, Mail, Phone, Search, Target, UserRound, UsersRound } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { useCollectionRaw } from "@/lib/useCollection";
import { COLLECTIONS } from "@/lib/db";
import type { Cliente } from "@/lib/crmClientes";

const STATUSES = ["Todos", "Activo", "Prospecto", "Inactivo", "Bloqueado"] as const;

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

export default function ClientesPorVendedorPage() {
  const clientes = useCollectionRaw<Cliente>(COLLECTIONS.clientes);

  const [seller, setSeller] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [query, setQuery] = useState("");

  const sellers = useMemo(() => {
    const unique = Array.from(
      new Set(clientes.map((c) => c.vendedorAsignado).filter(Boolean)),
    ).sort();
    return ["Todos", ...unique];
  }, [clientes]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return clientes.filter((c) => {
      if (seller !== "Todos" && c.vendedorAsignado !== seller) return false;
      if (status !== "Todos" && c.estatus !== status) return false;
      if (term) {
        return (
          c.razonSocial?.toLowerCase().includes(term) ||
          c.nombreComercial?.toLowerCase().includes(term) ||
          c.contacto?.toLowerCase().includes(term) ||
          c.municipio?.toLowerCase().includes(term) ||
          c.vendedorAsignado?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [clientes, seller, status, query]);

  const totalVentaAnio = filtered.reduce((sum, c) => sum + (c.totalComprasAnio ?? 0), 0);
  const totalM3 = filtered.reduce((sum, c) => sum + (c.m3Acumulados ?? 0), 0);
  const clientesBloqueados = filtered.filter(
    (c) => c.estatus === "Bloqueado" || (c.saldoPendiente ?? 0) > (c.limiteCredito ?? 0),
  ).length;

  const sellerSummaries = useMemo(() => {
    const map = new Map<
      string,
      { vendedor: string; clientes: number; totalComprasAnio: number; m3Acumulados: number; activos: number; bloqueados: number }
    >();
    for (const c of clientes) {
      const v = c.vendedorAsignado || "Sin asignar";
      const existing = map.get(v) ?? {
        vendedor: v,
        clientes: 0,
        totalComprasAnio: 0,
        m3Acumulados: 0,
        activos: 0,
        bloqueados: 0,
      };
      existing.clientes += 1;
      existing.totalComprasAnio += c.totalComprasAnio ?? 0;
      existing.m3Acumulados += c.m3Acumulados ?? 0;
      if (c.estatus === "Activo") existing.activos += 1;
      if (c.estatus === "Bloqueado" || (c.saldoPendiente ?? 0) > (c.limiteCredito ?? 0)) {
        existing.bloqueados += 1;
      }
      map.set(v, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.totalComprasAnio - a.totalComprasAnio);
  }, [clientes]);

  return (
    <div className="space-y-6">
      {/* Header notice */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#242424] px-4 py-2">
          <Info size={14} className="shrink-0 text-gray-500" />
          <span className="text-xs text-gray-400">
            Para registrar un nuevo cliente usa el módulo{" "}
            <span className="font-semibold text-white">Base de Clientes</span>
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Clientes filtrados" value={String(filtered.length)} icon={UsersRound} iconColor="text-[#CC2229]" />
        <KPICard title="Venta anual" value={currency(totalVentaAnio)} icon={CircleDollarSign} iconColor="text-green-400" iconBg="bg-green-500/10" />
        <KPICard title="m³ acumulados" value={`${totalM3.toLocaleString("es-MX")} m³`} icon={Target} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
        <KPICard title="En riesgo" value={String(clientesBloqueados)} icon={UserRound} iconColor="text-orange-400" iconBg="bg-orange-500/10" subtitle="Bloqueados o sobre límite" />
      </div>

      {/* Search + filter toolbar */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, contacto, vendedor o municipio"
            className="w-80 max-w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <select
          value={seller}
          onChange={(e) => setSeller(e.target.value)}
          className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {sellers.map((v) => <option key={v}>{v}</option>)}
        </select>
        <div className="flex items-center gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                status === s
                  ? "bg-[#CC2229] text-white"
                  : "bg-[#1A1A1A] text-gray-400 hover:text-white border border-[#3A3A3A]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">{filtered.length} clientes</span>
      </div>

      {/* Seller summary cards */}
      {sellerSummaries.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {sellerSummaries.map((summary) => (
            <button
              key={summary.vendedor}
              type="button"
              onClick={() => setSeller(seller === summary.vendedor ? "Todos" : summary.vendedor)}
              className={`rounded-xl border bg-[#242424] p-5 text-left transition-colors hover:border-[#CC2229]/60 cursor-pointer ${
                seller === summary.vendedor ? "border-[#CC2229]" : "border-[#3A3A3A]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vendedor</p>
                  <p className="text-base font-semibold text-white">{summary.vendedor}</p>
                </div>
                <span className="rounded-full bg-[#CC2229]/10 px-2.5 py-1 text-xs text-[#CC2229] shrink-0">
                  {summary.clientes} clientes
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">Venta anual</p>
                  <p className="text-sm font-semibold text-white">{currency(summary.totalComprasAnio)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Volumen m³</p>
                  <p className="text-sm font-semibold text-white">{summary.m3Acumulados.toLocaleString("es-MX")} m³</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Activos</p>
                  <p className="text-sm font-semibold text-green-400">{summary.activos}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">En riesgo</p>
                  <p className="text-sm font-semibold text-orange-400">{summary.bloqueados}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Clients table */}
      <div className="overflow-hidden rounded-xl border border-[#3A3A3A] bg-[#242424]">
        <div className="border-b border-[#3A3A3A] px-5 py-4">
          <h3 className="font-semibold text-white">Base de clientes por vendedor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                {["Cliente", "Vendedor", "Contacto", "Zona", "m³ acumulados", "Venta anual", "Saldo pendiente", "Última compra", "Estatus"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                    {clientes.length === 0 ? "Cargando clientes…" : "Sin resultados para los filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-[#2A2A2A]">
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-semibold text-white truncate">{c.razonSocial}</p>
                      {c.nombreComercial && c.nombreComercial !== c.razonSocial && (
                        <p className="text-xs text-gray-500 italic">{c.nombreComercial}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{c.vendedorAsignado || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-200 whitespace-nowrap">{c.contacto || "—"}</p>
                      {c.telefono && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><Phone size={10} />{c.telefono}</p>
                      )}
                      {c.email && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><Mail size={10} />{c.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{c.municipio || "—"}</td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{(c.m3Acumulados ?? 0).toLocaleString("es-MX")} m³</td>
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{currency(c.totalComprasAnio ?? 0)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${(c.saldoPendiente ?? 0) > 0 ? "text-amber-300" : "text-green-400"}`}>
                        {currency(c.saldoPendiente ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{c.ultimaCompra || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={c.estatus?.toLowerCase() ?? ""} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
