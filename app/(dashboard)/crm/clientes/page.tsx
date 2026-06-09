"use client";

import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import StatusBadge from "@/components/StatusBadge";
import {
  clientes as initialClientes,
  estatusCliente,
  tiposCliente,
  vendedores,
  type CalificacionCliente,
  type Cliente,
  type EstatusCliente,
  type TipoCliente,
} from "@/lib/crmClientes";

const DIAS_CREDITO_OPTIONS = ["0", "15", "30", "45", "60", "90"];
const CALIFICACION_OPTIONS: CalificacionCliente[] = ["A", "B", "C"];

const calificacionBadge: Record<CalificacionCliente, string> = {
  A: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  B: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  C: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
};

const tipoBadge: Record<TipoCliente, string> = {
  Constructora: "bg-blue-500/10 text-blue-300",
  Gobierno: "bg-violet-500/10 text-violet-300",
  Particular: "bg-slate-500/10 text-gray-300",
  Inmobiliaria: "bg-orange-500/10 text-orange-300",
  Industrial: "bg-amber-500/10 text-amber-300",
};

export default function CrmClientesPage() {
  const [clientes, setClientes] = useState(initialClientes);
  const [query, setQuery] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusCliente | "Todos">("Todos");
  const [filtroTipo, setFiltroTipo] = useState<TipoCliente | "Todos">("Todos");
  const [filtroVendedor, setFiltroVendedor] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [detail, setDetail] = useState<Cliente | null>(null);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return clientes.filter((c) => {
      const matchQuery =
        !term ||
        c.razonSocial.toLowerCase().includes(term) ||
        c.nombreComercial.toLowerCase().includes(term) ||
        c.rfc.toLowerCase().includes(term) ||
        c.contacto.toLowerCase().includes(term) ||
        c.municipio.toLowerCase().includes(term);
      const matchEstatus = filtroEstatus === "Todos" || c.estatus === filtroEstatus;
      const matchTipo = filtroTipo === "Todos" || c.tipoCliente === filtroTipo;
      const matchVendedor = filtroVendedor === "Todos" || c.vendedorAsignado === filtroVendedor;
      return matchQuery && matchEstatus && matchTipo && matchVendedor;
    });
  }, [clientes, query, filtroEstatus, filtroTipo, filtroVendedor]);

  const totalActivos = clientes.filter((c) => c.estatus === "Activo").length;
  const totalCarteraAnio = clientes.reduce((sum, c) => sum + c.totalComprasAnio, 0);
  const totalSaldoPendiente = clientes.reduce((sum, c) => sum + c.saldoPendiente, 0);
  const nuevosEsteAnio = clientes.filter((c) => c.fechaAlta.startsWith("2026")).length;

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(c: Cliente) {
    setDetail(null);
    setEditing(c);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setClientes((current) => current.filter((c) => c.id !== id));
    if (detail?.id === id) setDetail(null);
  }

  function handleSave(values: Record<string, string>) {
    const razonSocial = values["Razón social"]?.trim();
    const rfc = values["RFC"]?.trim();
    const contacto = values["Contacto principal"]?.trim();

    if (!razonSocial || !rfc || !contacto) return false;

    const isDuplicate = clientes.some(
      (c) => c.rfc.toLowerCase() === rfc.toLowerCase() && c.id !== editing?.id,
    );
    if (isDuplicate) return "Ya existe un cliente con ese RFC.";

    const next: Cliente = {
      id: editing?.id ?? `CL-${String(clientes.length + 1).padStart(3, "0")}`,
      razonSocial,
      nombreComercial: values["Nombre comercial"] ?? razonSocial,
      rfc,
      domicilio: values["Domicilio"] ?? "",
      colonia: values["Colonia"] ?? "",
      municipio: values["Municipio"] ?? "",
      estado: values["Estado"] ?? "Nuevo León",
      cp: values["C.P."] ?? "",
      contacto,
      cargo: values["Cargo"] ?? "",
      telefono: values["Teléfono"] ?? "",
      email: values["Correo electrónico"] ?? "",
      tipoCliente: (values["Tipo de cliente"] as TipoCliente) ?? "Constructora",
      vendedorAsignado: values["Vendedor asignado"] ?? "Ventas MTY",
      limiteCredito: Number(values["Límite de crédito"]?.replace(/[$,]/g, "") ?? 0),
      saldoPendiente: Number(values["Saldo pendiente"]?.replace(/[$,]/g, "") ?? 0),
      diasCredito: Number(values["Días de crédito"] ?? 30),
      ultimaCompra: values["Última compra"] ?? "—",
      totalComprasAnio: 0,
      m3Acumulados: 0,
      estatus: (values["Estatus"] as EstatusCliente) ?? "Activo",
      calificacion: (values["Calificación"] as CalificacionCliente) ?? "B",
      fechaAlta: editing?.fechaAlta ?? new Date().toISOString().split("T")[0],
      notas: values["Notas"] ?? "",
    };

    setClientes((current) =>
      editing
        ? current.map((c) => (c.id === editing.id ? next : c))
        : [next, ...current],
    );
    setShowForm(false);
    setEditing(null);
  }

  function exportExcel() {
    const rows = clientes
      .map(
        (c) => `<tr>
          <td>${c.id}</td><td>${c.razonSocial}</td><td>${c.rfc}</td>
          <td>${c.municipio}, ${c.estado}</td><td>${c.tipoCliente}</td>
          <td>${c.contacto}</td><td>${c.telefono}</td><td>${c.email}</td>
          <td>${c.vendedorAsignado}</td><td>${c.limiteCredito}</td>
          <td>${c.saldoPendiente}</td><td>${c.diasCredito}</td>
          <td>${c.ultimaCompra}</td><td>${c.totalComprasAnio}</td>
          <td>${c.m3Acumulados}</td><td>${c.estatus}</td><td>${c.calificacion}</td>
        </tr>`,
      )
      .join("");
    const html = `<html><head><meta charset="UTF-8"/></head><body><table>
      <thead><tr>
        <th>ID</th><th>Razón Social</th><th>RFC</th><th>Ubicación</th><th>Tipo</th>
        <th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Vendedor</th>
        <th>Límite Crédito</th><th>Saldo</th><th>Días Crédito</th>
        <th>Última Compra</th><th>Compras Año</th><th>m3 Acumulados</th>
        <th>Estatus</th><th>Calificación</th>
      </tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes-duro-concretos.xls";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const creditoUtilizado = (c: Cliente) => {
    if (!c.limiteCredito) return 0;
    return Math.round((c.saldoPendiente / c.limiteCredito) * 100);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total clientes" value={String(clientes.length)} icon={Users} />
        <KPICard
          title="Clientes activos"
          value={String(totalActivos)}
          icon={UserCheck}
          iconColor="text-green-400"
          iconBg="bg-green-500/10"
        />
        <KPICard
          title="Cartera anual"
          value={`$${(totalCarteraAnio / 1000000).toFixed(1)}M`}
          icon={TrendingUp}
          iconColor="text-[#CC2229]"
          subtitle={`$${Math.round(totalSaldoPendiente).toLocaleString()} pendiente`}
        />
        <KPICard
          title="Nuevos en 2026"
          value={String(nuevosEsteAnio)}
          icon={BadgeDollarSign}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar razón social, RFC, contacto, municipio..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        {[
          { value: filtroEstatus, onChange: (v: string) => setFiltroEstatus(v as EstatusCliente | "Todos"), options: ["Todos los estatus", ...estatusCliente] },
          { value: filtroTipo, onChange: (v: string) => setFiltroTipo(v as TipoCliente | "Todos"), options: ["Todos los tipos", ...tiposCliente] },
          { value: filtroVendedor, onChange: (v: string) => setFiltroVendedor(v), options: ["Todos los vendedores", ...vendedores] },
        ].map(({ value, onChange, options }, idx) => (
          <div key={idx} className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {options.map((opt) => <option key={opt}>{opt}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        ))}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} clientes</span>
        <button
          type="button"
          onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Nuevo cliente
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Cal.", "Razón Social / RFC", "Municipio", "Tipo", "Contacto", "Vendedor", "Crédito", "Saldo", "Estatus", "Acciones"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-gray-500">
                    No se encontraron clientes con ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const pct = creditoUtilizado(c);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                      onClick={() => setDetail(c)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${calificacionBadge[c.calificacion]}`}>
                          {c.calificacion}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium whitespace-nowrap">{c.razonSocial}</p>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">{c.rfc}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-400 whitespace-nowrap text-xs">
                          <MapPin size={11} />
                          {c.municipio}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tipoBadge[c.tipoCliente]}`}>
                          {c.tipoCliente}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-300 whitespace-nowrap">{c.contacto}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{c.cargo}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-sm">{c.vendedorAsignado}</td>
                      <td className="px-4 py-3">
                        {c.limiteCredito > 0 ? (
                          <div>
                            <p className="text-gray-300 text-sm whitespace-nowrap">${c.limiteCredito.toLocaleString()}</p>
                            <div className="mt-1 h-1 w-20 rounded-full bg-[#1A1A1A] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">Contado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${c.saldoPendiente > 0 ? "text-amber-300" : "text-green-400"}`}>
                          ${c.saldoPendiente.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={c.estatus.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors"
                            aria-label={`Editar ${c.razonSocial}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors"
                            aria-label={`Eliminar ${c.razonSocial}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div
            className="relative h-full w-full max-w-xl overflow-y-auto bg-[#181b20] border-l border-[#3A3A3A] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#3A3A3A] bg-[#181b20]/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${calificacionBadge[detail.calificacion]}`}>
                  {detail.calificacion}
                </span>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm leading-tight truncate">{detail.razonSocial}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 font-mono">{detail.rfc}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/8 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status row */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.estatus.toLowerCase()} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge[detail.tipoCliente]}`}>
                  {detail.tipoCliente}
                </span>
                <span className="text-gray-500 text-xs ml-auto">Alta: {detail.fechaAlta}</span>
              </div>

              {/* Ubicación */}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Datos fiscales y domicilio</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-2.5">
                  <DetailRow icon={Building2} label="Nombre comercial" value={detail.nombreComercial} />
                  <DetailRow icon={MapPin} label="Domicilio" value={`${detail.domicilio}, Col. ${detail.colonia}`} />
                  <DetailRow icon={MapPin} label="Municipio / Estado / C.P." value={`${detail.municipio}, ${detail.estado} ${detail.cp}`} />
                </div>
              </div>

              {/* Contacto */}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Contacto</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-2.5">
                  <DetailRow icon={User} label="Nombre" value={`${detail.contacto}${detail.cargo ? ` · ${detail.cargo}` : ""}`} />
                  <DetailRow icon={Phone} label="Teléfono" value={detail.telefono} />
                  <DetailRow icon={Mail} label="Correo" value={detail.email} />
                </div>
              </div>

              {/* Comercial */}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Información comercial</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Compras año" value={`$${detail.totalComprasAnio.toLocaleString()}`} color="text-white" />
                    <StatBox label="m3 acumulados" value={`${detail.m3Acumulados.toLocaleString()} m3`} color="text-blue-300" />
                    <StatBox label="Última compra" value={detail.ultimaCompra} color="text-gray-300" />
                    <StatBox label="Vendedor" value={detail.vendedorAsignado} color="text-gray-300" />
                  </div>
                </div>
              </div>

              {/* Crédito */}
              {detail.limiteCredito > 0 && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Crédito</p>
                  <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <StatBox label="Límite de crédito" value={`$${detail.limiteCredito.toLocaleString()}`} color="text-white" />
                      <StatBox label="Saldo pendiente" value={`$${detail.saldoPendiente.toLocaleString()}`} color={detail.saldoPendiente > 0 ? "text-amber-300" : "text-green-400"} />
                      <StatBox label="Días de crédito" value={`${detail.diasCredito} días`} color="text-gray-300" />
                      <StatBox label="% utilizado" value={`${creditoUtilizado(detail)}%`} color={creditoUtilizado(detail) > 90 ? "text-red-400" : "text-gray-300"} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Crédito disponible</span>
                        <span>${Math.max(0, detail.limiteCredito - detail.saldoPendiente).toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#242424] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${creditoUtilizado(detail) > 90 ? "bg-red-500" : creditoUtilizado(detail) > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(creditoUtilizado(detail), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              {detail.notas && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Notas</p>
                  <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] px-4 py-3">
                    <p className="text-gray-300 text-sm leading-relaxed">{detail.notas}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => openEdit(detail)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-white transition-colors"
                >
                  <Pencil size={15} />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(detail.id)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <FormModal
        open={showForm}
        title={editing ? `Editar cliente — ${editing.razonSocial}` : "Nuevo cliente"}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        footer={
          <>
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Guardar cliente
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Datos fiscales */}
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Datos fiscales</p>
          </div>
          {[
            { label: "Razón social", defaultValue: editing?.razonSocial, span: "lg:col-span-2" },
            { label: "Nombre comercial", defaultValue: editing?.nombreComercial },
            { label: "RFC", defaultValue: editing?.rfc },
            { label: "Domicilio", defaultValue: editing?.domicilio },
            { label: "Colonia", defaultValue: editing?.colonia },
            { label: "Municipio", defaultValue: editing?.municipio },
            { label: "Estado", defaultValue: editing?.estado ?? "Nuevo León" },
            { label: "C.P.", defaultValue: editing?.cp },
          ].map(({ label, defaultValue, span }) => (
            <div key={label} className={span}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type="text"
                defaultValue={defaultValue ?? ""}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          ))}

          {/* Contacto */}
          <div className="sm:col-span-2 lg:col-span-3 pt-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Contacto</p>
          </div>
          {[
            { label: "Contacto principal", defaultValue: editing?.contacto },
            { label: "Cargo", defaultValue: editing?.cargo },
            { label: "Teléfono", defaultValue: editing?.telefono },
            { label: "Correo electrónico", type: "email", defaultValue: editing?.email },
          ].map(({ label, defaultValue, type }) => (
            <div key={label}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={type ?? "text"}
                defaultValue={defaultValue ?? ""}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          ))}

          {/* Comercial */}
          <div className="sm:col-span-2 lg:col-span-3 pt-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Clasificación y crédito</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo de cliente</label>
            <select
              defaultValue={editing?.tipoCliente ?? "Constructora"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {tiposCliente.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendedor asignado</label>
            <select
              defaultValue={editing?.vendedorAsignado ?? "Ventas MTY"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {vendedores.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Calificación</label>
            <select
              defaultValue={editing?.calificacion ?? "B"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {CALIFICACION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {[
            { label: "Límite de crédito", defaultValue: editing?.limiteCredito ? String(editing.limiteCredito) : "0" },
            { label: "Saldo pendiente", defaultValue: editing?.saldoPendiente ? String(editing.saldoPendiente) : "0" },
          ].map(({ label, defaultValue }) => (
            <div key={label}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type="text"
                defaultValue={defaultValue ?? ""}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Días de crédito</label>
            <select
              defaultValue={editing?.diasCredito ? String(editing.diasCredito) : "30"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {DIAS_CREDITO_OPTIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Estatus</label>
            <select
              defaultValue={editing?.estatus ?? "Activo"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {estatusCliente.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">Notas</label>
            <textarea
              defaultValue={editing?.notas ?? ""}
              rows={3}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] resize-none"
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-gray-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-[#181b20] px-3 py-2.5">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
