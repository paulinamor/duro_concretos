"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileDown,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  calcularDiasVencimiento,
  descargarCfdiSat,
  SatCfdi,
  SatDownloadKind,
} from "@/lib/satDownloads";

interface SatAccountsPageProps {
  kind: SatDownloadKind;
}

const labels = {
  cxc: {
    title: "Cuentas por Cobrar",
    subtitle: "CFDI emitidos descargados del SAT",
    action: "Descargar CxC del SAT",
    counterparty: "Cliente",
    amount: "Total por cobrar",
  },
  cxp: {
    title: "Cuentas por Pagar",
    subtitle: "CFDI recibidos descargados del SAT",
    action: "Descargar CxP del SAT",
    counterparty: "Proveedor",
    amount: "Total por pagar",
  },
};

export default function SatAccountsPage({ kind }: SatAccountsPageProps) {
  const copy = labels[kind];
  const [fechaInicio, setFechaInicio] = useState("2026-05-01");
  const [fechaFin, setFechaFin] = useState("2026-05-31");
  const [rfcEmpresa, setRfcEmpresa] = useState("DCO260101ABC");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastDownload, setLastDownload] = useState("");
  const [cfdis, setCfdis] = useState<SatCfdi[]>([]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return cfdis.filter((cfdi) => {
      return (
        cfdi.folio.toLowerCase().includes(term) ||
        cfdi.uuid.toLowerCase().includes(term) ||
        cfdi.rfcContraparte.toLowerCase().includes(term) ||
        cfdi.razonSocial.toLowerCase().includes(term)
      );
    });
  }, [cfdis, query]);

  const total = filtered.reduce((sum, cfdi) => sum + cfdi.total, 0);
  const vencidos = filtered.filter((cfdi) => calcularDiasVencimiento(cfdi.vencimiento) < 0).length;
  const ppd = filtered.filter((cfdi) => cfdi.metodoPago === "PPD").length;

  async function handleDescargarSat() {
    setLoading(true);
    try {
      const result = await descargarCfdiSat({
        kind,
        rfcEmpresa,
        fechaInicio,
        fechaFin,
      });
      setCfdis(result.cfdis);
      setLastDownload(new Date(result.downloadedAt).toLocaleString("es-MX"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{copy.title}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{copy.subtitle}</p>
        </div>
        <button
          onClick={handleDescargarSat}
          disabled={loading}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <FileDown size={16} />}
          {loading ? "Descargando..." : copy.action}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="CFDI encontrados" value={String(filtered.length)} icon={FileText} iconColor="text-blue-400" />
        <KPICard title={copy.amount} value={`$${total.toLocaleString()}`} icon={Download} iconColor="text-[#CC2229]" />
        <KPICard title="Crédito PPD" value={String(ppd)} icon={CalendarDays} iconColor="text-orange-400" />
        <KPICard title="Vencidos" value={String(vencidos)} icon={RefreshCw} iconColor="text-red-400" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">RFC empresa</label>
            <input
              value={rfcEmpresa}
              onChange={(e) => setRfcEmpresa(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
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
          <div>
            <label className="block text-sm text-gray-400 mb-1">Buscar CFDI</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Folio, RFC o UUID"
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {lastDownload ? `Última descarga: ${lastDownload}` : "Sin descarga en esta sesión"}
        </p>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">CFDI {kind === "cxc" ? "emitidos" : "recibidos"} desde SAT</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio", "Fecha", copy.counterparty, "RFC", "Metodo", "Vencimiento", "Total", "Estatus", "UUID"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    Descarga los CFDI del SAT para llenar esta tabla.
                  </td>
                </tr>
              ) : (
                filtered.map((cfdi) => (
                  <tr key={cfdi.uuid} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{cfdi.folio}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{cfdi.fecha}</td>
                    <td className="px-4 py-3 text-white font-medium">{cfdi.razonSocial}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{cfdi.rfcContraparte}</td>
                    <td className="px-4 py-3 text-gray-200">{cfdi.metodoPago}</td>
                    <td className="px-4 py-3 text-gray-300">{cfdi.vencimiento}</td>
                    <td className="px-4 py-3 text-white font-semibold">${cfdi.total.toLocaleString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={cfdi.estatus === "Vigente" ? "aprobado" : "cancelado"} /></td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cfdi.uuid}</td>
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
