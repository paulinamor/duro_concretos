"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Mail, Phone, Plus, Search, Target, UserRound, UsersRound } from "lucide-react";
import FormModal from "@/components/FormModal";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  getClientsBySeller,
  getSalesClientSummaries,
  loadSalesClients,
  saveSalesClients,
  SalesClientStatus,
  vendedoresBase,
} from "@/lib/salesClients";

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

export default function ClientesPorVendedorPage() {
  const [clients, setClients] = useState(() => loadSalesClients());
  const [seller, setSeller] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const sellers = ["Todos", ...Array.from(new Set([...vendedoresBase, ...clients.map((client) => client.vendedor)]))];
  const summaries = getSalesClientSummaries(clients);
  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return getClientsBySeller(clients, seller).filter((client) => (
      (status === "Todos" || client.status === status) &&
      (
        client.cliente.toLowerCase().includes(term) ||
        client.contacto.toLowerCase().includes(term) ||
        client.obraPrincipal.toLowerCase().includes(term) ||
        client.zona.toLowerCase().includes(term)
      )
    ));
  }, [clients, query, seller, status]);

  const totalVenta = filtered.reduce((sum, client) => sum + client.ventaMensual, 0);
  const totalM3 = filtered.reduce((sum, client) => sum + client.volumenMensualM3, 0);
  const saldoPendiente = filtered.reduce((sum, client) => sum + client.saldoPendiente, 0);
  const clientesRiesgo = filtered.filter((client) => client.status === "En riesgo").length;

  function handleSave(values: Record<string, string>) {
    const cliente = values.Cliente?.trim() || "";
    const vendedor = values.Vendedor || "Ventas MTY";
    const duplicate = clients.some((item) => (
      item.cliente.toLowerCase() === cliente.toLowerCase() &&
      item.vendedor === vendedor
    ));

    if (duplicate) {
      return "Este cliente ya está asignado a ese vendedor.";
    }

    const nextClient = {
      id: `CLI-${String(clients.length + 1).padStart(3, "0")}`,
      cliente,
      vendedor,
      contacto: values.Contacto || "Contacto comercial",
      telefono: values.Teléfono || "81 0000 0000",
      correo: values.Correo || "cliente@correo.mx",
      zona: values.Zona || "Monterrey",
      obraPrincipal: values["Obra principal"] || "Obra por definir",
      volumenMensualM3: Number(values["Volumen mensual m3"] || 0),
      ventaMensual: Number(values["Venta mensual"]?.replace(/[$,]/g, "") || 0),
      saldoPendiente: Number(values["Saldo pendiente"]?.replace(/[$,]/g, "") || 0),
      ultimoContacto: values["Último contacto"] || "2026-06-03",
      proximaAccion: values["Próxima acción"] || "Dar seguimiento comercial",
      status: (values.Estatus || "Prospecto") as SalesClientStatus,
    };

    const nextClients = [nextClient, ...clients];
    setClients(nextClients);
    saveSalesClients(nextClients);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Base de clientes asignados a cada vendedor</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#991A1E]"
        >
          <Plus size={16} />
          Registrar cliente
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Clientes filtrados" value={String(filtered.length)} icon={UsersRound} iconColor="text-[#CC2229]" />
        <KPICard title="Venta mensual" value={currency(totalVenta)} icon={CircleDollarSign} iconColor="text-green-400" />
        <KPICard title="Volumen mensual" value={`${totalM3.toLocaleString("es-MX")} m3`} icon={Target} iconColor="text-blue-400" />
        <KPICard title="Clientes en riesgo" value={String(clientesRiesgo)} icon={UserRound} iconColor="text-orange-400" subtitle={`${currency(saldoPendiente)} pendiente`} />
      </div>

      <div className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente, contacto, obra o zona"
              className="w-96 max-w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <select
            value={seller}
            onChange={(event) => setSeller(event.target.value)}
            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            {sellers.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            {["Todos", "Activo", "Prospecto", "En riesgo", "Inactivo"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <span className="ml-auto text-xs text-gray-500">{filtered.length} clientes</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {summaries.map((summary) => (
          <button
            key={summary.vendedor}
            type="button"
            onClick={() => setSeller(summary.vendedor)}
            className={`rounded-xl border bg-[#242424] p-5 text-left transition-colors hover:border-[#CC2229]/60 ${
              seller === summary.vendedor ? "border-[#CC2229]" : "border-[#3A3A3A]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-400">Vendedor</p>
                <p className="mt-1 text-lg font-semibold text-white">{summary.vendedor}</p>
              </div>
              <span className="rounded-full bg-[#CC2229]/10 px-2.5 py-1 text-xs text-[#CC2229]">
                {summary.clientes} clientes
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Venta mensual</p>
                <p className="font-semibold text-white">{currency(summary.ventaMensual)}</p>
              </div>
              <div>
                <p className="text-gray-500">Volumen</p>
                <p className="font-semibold text-white">{summary.volumenMensualM3.toLocaleString("es-MX")} m3</p>
              </div>
              <div>
                <p className="text-gray-500">Activos</p>
                <p className="font-semibold text-green-400">{summary.activos}</p>
              </div>
              <div>
                <p className="text-gray-500">En riesgo</p>
                <p className="font-semibold text-orange-400">{summary.enRiesgo}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <FormModal
        open={showForm}
        title="Registrar cliente por vendedor"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button className="rounded-lg border border-[#3A3A3A] px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white">Cancelar</button>
            <button className="rounded-lg bg-[#CC2229] px-4 py-2 text-sm text-white transition-colors hover:bg-[#991A1E]">Guardar cliente</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Cliente</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Vendedor</label>
            <select className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {vendedoresBase.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Estatus</label>
            <select className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["Prospecto", "Activo", "En riesgo", "Inactivo"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Contacto</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Teléfono</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Correo</label>
            <input type="email" className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Zona</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Obra principal</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Último contacto</label>
            <input type="date" className="date-input-white w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Volumen mensual m3</label>
            <select className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[48, 80, 100, 120, 180, 205, 256].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Venta mensual</label>
            <select className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[96000, 185000, 228000, 342000, 410000, 512000].map((item) => <option key={item}>${item.toLocaleString("es-MX")}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Saldo pendiente</label>
            <select className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[0, 16095, 31052, 32196, 41752].map((item) => <option key={item}>${item.toLocaleString("es-MX")}</option>)}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm text-gray-400">Próxima acción</label>
            <input className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
        </div>
      </FormModal>

      <div className="overflow-hidden rounded-xl border border-[#3A3A3A] bg-[#242424]">
        <div className="border-b border-[#3A3A3A] px-5 py-4">
          <h3 className="font-semibold text-white">Base de clientes por vendedor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                {["Cliente", "Vendedor", "Contacto", "Zona / obra", "Volumen", "Venta mensual", "Saldo", "Último contacto", "Estatus", "Próxima acción"].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.map((client) => (
                <tr key={client.id} className="transition-colors hover:bg-[#2A2A2A]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{client.cliente}</p>
                    <p className="text-xs text-[#CC2229]">{client.id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{client.vendedor}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-200">{client.contacto}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Phone size={11} /> {client.telefono}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Mail size={11} /> {client.correo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-200">{client.zona}</p>
                    <p className="text-xs text-gray-500">{client.obraPrincipal}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{client.volumenMensualM3.toLocaleString("es-MX")} m3</td>
                  <td className="px-4 py-3 font-semibold text-white">{currency(client.ventaMensual)}</td>
                  <td className="px-4 py-3 text-gray-300">{currency(client.saldoPendiente)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{client.ultimoContacto}</td>
                  <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{client.proximaAccion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
