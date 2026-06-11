"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  FileCheck2,
  FileText,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";

type NominaStatus = "Timbrado" | "Pendiente" | "Error";

interface ReciboNomina {
  folio: string;
  empleado: string;
  rfc: string;
  puesto: string;
  periodo: string;
  sueldoBruto: number;
  deducciones: number;
  neto: number;
  uuid: string;
  status: NominaStatus;
  enviado: boolean;
}


const statusTone: Record<NominaStatus, string> = {
  Timbrado: "aprobado",
  Pendiente: "pendiente",
  Error: "cancelado",
};

export default function NominaPage() {
  const [recibos, setRecibos] = useState<ReciboNomina[]>([]);

  useEffect(() => {
    getCollectionDocs<ReciboNomina>(COLLECTIONS.nomina).then(setRecibos);
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [periodo, setPeriodo] = useState("2026-05-15");
  const [query, setQuery] = useState("");

  const totalEmpleados = recibos.length;
  const timbrados = recibos.filter((r) => r.status === "Timbrado").length;
  const pendientes = recibos.filter((r) => r.status !== "Timbrado").length;
  const totalNeto = recibos.reduce((sum, r) => sum + r.neto, 0);
  const filtered = recibos.filter((recibo) => {
    const term = query.toLowerCase();
    return (
      recibo.empleado.toLowerCase().includes(term) ||
      recibo.rfc.toLowerCase().includes(term) ||
      recibo.folio.toLowerCase().includes(term)
    );
  });

  async function handleSave(values: Record<string, string>) {
    const fechaPeriodo = values.Periodo || periodo;
    const serie = values["Serie CFDI"] || "Pendiente";
    const id = Date.now().toString();
    const newRecibo: ReciboNomina = {
      folio: `NOM-${id}`,
      empleado: "Nuevo empleado",
      rfc: "RFC-PENDIENTE",
      puesto: values["Tipo de nómina"] || "Quincenal",
      periodo: fechaPeriodo,
      sueldoBruto: 0,
      deducciones: 0,
      neto: 0,
      uuid: serie,
      status: "Pendiente",
      enviado: false,
    };

    setRecibos((current) => [newRecibo, ...current]);
    await upsertDocument(COLLECTIONS.nomina, id, newRecibo);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Nómina timbrada y comprobantes electrónicos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Timbrar Nómina
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Empleados en nómina" value={String(totalEmpleados)} icon={UsersRound} iconColor="text-blue-400" />
        <KPICard title="Recibos timbrados" value={`${timbrados}/${totalEmpleados}`} icon={BadgeCheck} iconColor="text-green-400" />
        <KPICard title="Pendientes SAT" value={String(pendientes)} icon={FileCheck2} iconColor="text-orange-400" />
        <KPICard title="Neto a pagar" value={`$${totalNeto.toLocaleString()}`} icon={ReceiptText} iconColor="text-[#CC2229]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-white font-semibold">Proceso de timbrado</h3>
              <p className="text-xs text-gray-500 mt-0.5">Estatus del periodo seleccionado</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CalendarDays size={14} className="text-[#CC2229]" />
              {periodo}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { label: "Cálculo", value: "Completo", icon: FileText },
              { label: "Validación RFC", value: "Completo", icon: FileCheck2 },
              { label: "Timbrado SAT", value: `${timbrados} recibos`, icon: BadgeCheck },
              { label: "Envío email", value: "3 enviados", icon: Mail },
            ].map((step) => (
              <div key={step.label} className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-4">
                <step.icon size={18} className="text-[#CC2229] mb-3" />
                <p className="text-gray-400 text-xs">{step.label}</p>
                <p className="text-white font-semibold text-sm mt-1">{step.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Periodo de nómina</h3>
          <label className="block text-sm text-gray-400 mb-1">Fecha de cierre</label>
          <input
            type="date"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Percepción total</span>
              <span className="text-white">$62,986</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Deducciones</span>
              <span className="text-red-400">-$5,580</span>
            </div>
            <div className="flex justify-between border-t border-[#3A3A3A] pt-2 text-gray-400">
              <span>Total neto</span>
              <span className="text-[#CC2229] font-bold">${totalNeto.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <FormModal
        open={showForm}
        title="Timbrar nómina"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Generar timbrado
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Periodo</label>
            <input type="date" defaultValue={periodo} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo de nómina</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Quincenal</option>
              <option>Semanal</option>
              <option>Extraordinaria</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Serie CFDI</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>NOM - Nómina ordinaria</option>
              <option>EXT - Nómina extraordinaria</option>
              <option>FIN - Finiquito</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Timbrado de periodo regular</option>
              <option>Revisión previa por incidencias</option>
              <option>Periodo con recibos pendientes</option>
              <option>Enviar comprobantes al terminar</option>
            </select>
          </div>
        </div>
      </FormModal>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Comprobantes de nómina electrónicos</h3>
            <p className="text-xs text-gray-500 mt-0.5">XML/PDF timbrados por empleado</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empleado o RFC"
              className="w-64 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio", "Empleado", "RFC", "Puesto", "Periodo", "Neto", "UUID", "Status", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.map((recibo) => (
                <tr key={recibo.folio} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{recibo.folio}</td>
                  <td className="px-4 py-3 text-white font-medium">{recibo.empleado}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{recibo.rfc}</td>
                  <td className="px-4 py-3 text-gray-300">{recibo.puesto}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{recibo.periodo}</td>
                  <td className="px-4 py-3 text-white font-semibold">${recibo.neto.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{recibo.uuid}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusTone[recibo.status]} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 hover:text-white hover:border-[#CC2229] transition-colors" aria-label="Descargar comprobante">
                        <Download size={14} />
                      </button>
                      <button className="p-1.5 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 hover:text-white hover:border-[#CC2229] transition-colors" aria-label="Enviar comprobante">
                        <Send size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
