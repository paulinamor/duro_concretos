"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Target,
  UserRound,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import { crmFollowUps } from "@/lib/crmPipeline";

export default function CrmSeguimientoPage() {
  const [seguimientos, setSeguimientos] = useState(crmFollowUps);
  const [query, setQuery] = useState("");
  const [responsable, setResponsable] = useState("Todos");
  const [showForm, setShowForm] = useState(false);

  const responsables = ["Todos", ...Array.from(new Set(seguimientos.map((item) => item.responsable)))];
  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return seguimientos.filter((item) => {
      return (
        (responsable === "Todos" || item.responsable === responsable) &&
        (
          item.cliente.toLowerCase().includes(term) ||
          item.contacto.toLowerCase().includes(term) ||
          item.oportunidad.toLowerCase().includes(term) ||
          item.proximaAccion.toLowerCase().includes(term)
        )
      );
    });
  }, [query, responsable, seguimientos]);

  const accionesHoy = seguimientos.filter((item) => item.fecha === "2026-05-25").length;
  const altaPrioridad = seguimientos.filter((item) => item.prioridad === "Alta").length;
  const clientesRiesgo = seguimientos.filter((item) => item.estadoCliente === "En riesgo").length;

  function handleSave(values: Record<string, string>) {
    const next = seguimientos.length + 1;

    setSeguimientos((current) => [
      {
        id: `SEG-${String(next).padStart(3, "0")}`,
        cliente: values.Cliente || "Grupo Alfa Logistica",
        contacto: values.Contacto || "Mariana Robles",
        oportunidad: values.Oportunidad || "Nave industrial Apodaca",
        etapa: "Prospecto",
        responsable: values.Responsable || "Ventas MTY",
        fecha: values["Fecha seguimiento"] || "2026-05-26",
        canal: (values.Canal || "Llamada") as "Llamada" | "WhatsApp" | "Visita" | "Correo",
        estadoCliente: "Prospecto",
        prioridad: "Media",
        proximaAccion: values["Próxima acción"] || "Confirmar volumen mensual",
        ultimoComentario: values.Comentario || "Seguimiento registrado desde el formulario.",
      },
      ...current,
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Seguimiento CRM</h1>
          <p className="text-gray-500 text-sm mt-0.5">Clientes, oportunidades y próximas acciones comerciales</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Registrar seguimiento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Seguimientos abiertos" value={String(seguimientos.length)} icon={MessageSquare} iconColor="text-[#CC2229]" />
        <KPICard title="Acciones para hoy" value={String(accionesHoy)} icon={CalendarDays} iconColor="text-orange-400" />
        <KPICard title="Alta prioridad" value={String(altaPrioridad)} icon={Target} iconColor="text-red-400" />
        <KPICard title="Clientes en riesgo" value={String(clientesRiesgo)} icon={UserRound} iconColor="text-blue-400" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, contacto u oportunidad"
            className="w-96 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <select
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {responsables.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} seguimientos</span>
      </div>

      <FormModal
        open={showForm}
        title="Registrar seguimiento"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar seguimiento</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cliente</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {seguimientos.map((item) => <option key={item.id}>{item.cliente}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contacto</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {seguimientos.map((item) => <option key={item.contacto}>{item.contacto}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Oportunidad</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {seguimientos.map((item) => <option key={item.oportunidad}>{item.oportunidad}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Responsable</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {responsables.filter((item) => item !== "Todos").map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha seguimiento</label>
            <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Próxima acción</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {seguimientos.map((item) => <option key={item.proximaAccion}>{item.proximaAccion}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Canal</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["Llamada", "WhatsApp", "Visita", "Correo"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Comentario</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {seguimientos.map((item) => <option key={item.ultimoComentario}>{item.ultimoComentario}</option>)}
            </select>
          </div>
        </div>
      </FormModal>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Seguimientos de clientes y oportunidades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Cliente", "Contacto", "Oportunidad", "Etapa", "Canal", "Fecha", "Responsable", "Prioridad", "Estado", "Próxima acción"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.cliente}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-200">{item.contacto}</p>
                    <p className="text-gray-500 text-xs flex items-center gap-1"><Phone size={11} /> {item.canal}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{item.oportunidad}</td>
                  <td className="px-4 py-3 text-[#CC2229] text-xs font-semibold">{item.etapa}</td>
                  <td className="px-4 py-3 text-gray-300">{item.canal}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{item.fecha}</td>
                  <td className="px-4 py-3 text-gray-300">{item.responsable}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.prioridad === "Alta" ? "pendiente" : "normal"} /></td>
                  <td className="px-4 py-3"><StatusBadge status={item.estadoCliente} /></td>
                  <td className="px-4 py-3">
                    <p className="text-gray-200">{item.proximaAccion}</p>
                    <p className="text-gray-500 text-xs mt-1">{item.ultimoComentario}</p>
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
