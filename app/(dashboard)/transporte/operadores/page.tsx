"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  HardHat,
  IdCard,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  UserCheck,
  Users,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import StatusBadge from "@/components/StatusBadge";
import { licenciasProximas, operadoresActivos, type EstatusOperador, type Operador } from "@/lib/operadores";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";

const TIPOS_LICENCIA = ["E", "D", "C", "A", "B"];
const ESTATUS_OPTIONS: EstatusOperador[] = ["Activo", "Inactivo", "Vacaciones"];
const CURRENT_TIME = new Date().getTime();

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusOperador | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Operador | null>(null);

  useEffect(() => {
    getCollectionDocs<Operador>(COLLECTIONS.operadores)
      .then(setOperadores)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return operadores.filter((op) => {
      const matchQuery =
        !term ||
        op.nombre.toLowerCase().includes(term) ||
        op.noLicencia.toLowerCase().includes(term) ||
        op.unidadAsignada.toLowerCase().includes(term);
      const matchEstatus = filtroEstatus === "Todos" || op.estatus === filtroEstatus;
      return matchQuery && matchEstatus;
    });
  }, [operadores, query, filtroEstatus]);

  const totalActivos = operadoresActivos(operadores);
  const totalInactivos = operadores.filter((op) => op.estatus === "Inactivo").length;
  const licPorVencer = licenciasProximas(operadores);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(op: Operador) {
    setEditing(op);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    setOperadores((current) => current.filter((op) => op.id !== id));
    await deleteDocument(COLLECTIONS.operadores, id);
  }

  async function handleSave(values: Record<string, string>) {
    const nombre = values["Nombre completo"]?.trim();
    const telefono = values["Teléfono"]?.trim();
    const email = values["Correo electrónico"]?.trim();
    const noLicencia = values["No. Licencia"]?.trim();

    if (!nombre || !telefono || !noLicencia) return false;

    const isDuplicate = operadores.some((op) =>
      op.noLicencia.toLowerCase() === noLicencia.toLowerCase() && op.id !== editing?.id,
    );
    if (isDuplicate) return "Ya existe un operador con ese número de licencia.";

    const id = editing?.id ?? `OP-${Date.now()}`;
    const next: Operador = {
      id,
      nombre,
      telefono,
      email: email ?? "",
      curp: values["CURP"] ?? "",
      rfc: values["RFC"] ?? "",
      noLicencia,
      tipoLicencia: values["Tipo licencia"] ?? "E",
      vencimientoLicencia: values["Vencimiento licencia"] ?? "",
      unidadAsignada: values["Unidad asignada"] ?? "",
      salarioDia: Number(values["Salario / día"]?.replace(/[$,]/g, "") ?? 0),
      fechaIngreso: values["Fecha ingreso"] ?? new Date().toISOString().split("T")[0],
      estatus: (values["Estatus"] as EstatusOperador) ?? "Activo",
      observaciones: values["Observaciones"] ?? "",
    };

    setOperadores((current) =>
      editing
        ? current.map((op) => (op.id === editing.id ? next : op))
        : [next, ...current],
    );
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.operadores, _id, data);
    setShowForm(false);
    setEditing(null);
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = operadores
      .map(
        (op) => `<tr>
          <td>${op.id}</td><td>${op.nombre}</td><td>${op.telefono}</td>
          <td>${op.email}</td><td>${op.curp}</td><td>${op.rfc}</td>
          <td>${op.noLicencia}</td><td>${op.tipoLicencia}</td>
          <td>${op.vencimientoLicencia}</td><td>${op.unidadAsignada}</td>
          <td>${op.salarioDia}</td><td>${op.fechaIngreso}</td><td>${op.estatus}</td>
        </tr>`,
      )
      .join("");
    downloadFile(
      "operadores-duro-concretos.xls",
      `<html><head><meta charset="UTF-8"/></head><body><table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>CURP</th><th>RFC</th>
        <th>No. Licencia</th><th>Tipo</th><th>Vencimiento</th><th>Unidad</th><th>Salario/día</th><th>Ingreso</th><th>Estatus</th></tr></thead>
        <tbody>${rows}</tbody></table></body></html>`,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportPDF() {
    const rows = operadores
      .map(
        (op) => `<tr>
          <td>${op.nombre}</td><td>${op.telefono}</td>
          <td>${op.noLicencia} (${op.tipoLicencia})</td><td>${op.vencimientoLicencia}</td>
          <td>${op.unidadAsignada || "—"}</td><td>${op.estatus}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Operadores</title>
      <style>body{font-family:Arial;padding:24px;color:#111}h1{margin:0 0 4px;font-size:22px}
      p{margin:0 0 18px;color:#6B7280;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#111;color:#fff;text-align:left;padding:8px}
      td{border-bottom:1px solid #E5E7EB;padding:8px}@media print{button{display:none}}</style>
      </head><body>
      <h1>Registro de Operadores</h1>
      <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
      <table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Licencia</th><th>Vencimiento</th><th>Unidad</th><th>Estatus</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  }

  const vencimientoColor = (fecha: string) => {
    if (!fecha) return "text-gray-500";
    const diff = new Date(fecha).getTime() - CURRENT_TIME;
    const days = diff / (1000 * 60 * 60 * 24);
    if (days < 0) return "text-red-400";
    if (days < 90) return "text-amber-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total operadores" value={String(operadores.length)} icon={Users} />
        <KPICard
          title="Activos"
          value={String(totalActivos)}
          icon={UserCheck}
          iconColor="text-green-400"
          iconBg="bg-green-500/10"
        />
        <KPICard
          title="Inactivos / Vacaciones"
          value={String(operadores.length - totalActivos)}
          icon={TrendingDown}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          subtitle={`${totalInactivos} inactivos`}
        />
        <KPICard
          title="Licencias por vencer"
          value={String(licPorVencer)}
          icon={AlertCircle}
          iconColor={licPorVencer > 0 ? "text-red-400" : "text-green-400"}
          iconBg={licPorVencer > 0 ? "bg-red-500/10" : "bg-green-500/10"}
          subtitle="Próximos 90 días"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, licencia, unidad..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <div className="relative">
          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value as EstatusOperador | "Todos")}
            className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            <option value="Todos">Todos los estatus</option>
            {ESTATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} operadores</span>
        <button
          type="button"
          onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
        <button
          type="button"
          onClick={exportPDF}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-[#CC2229] transition-colors"
        >
          <FileText size={15} />
          PDF
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Nuevo operador
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["ID", "Nombre", "Teléfono", "No. Licencia", "Tipo", "Vencimiento", "Unidad asignada", "Salario/día", "Ingreso", "Estatus", "Acciones"].map(
                  (h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-gray-500">
                    Cargando operadores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-gray-500">
                    No se encontraron operadores con ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-[#CC2229] whitespace-nowrap">{op.id}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                          <HardHat size={14} className="text-amber-400" />
                        </div>
                        <span className="text-white font-medium whitespace-nowrap">{op.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-gray-400 whitespace-nowrap">
                        <Phone size={12} />
                        {op.telefono}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-gray-300 whitespace-nowrap">
                        <IdCard size={12} className="text-gray-500" />
                        {op.noLicencia}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300 whitespace-nowrap">
                        Tipo {op.tipoLicencia}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-sm font-medium whitespace-nowrap ${vencimientoColor(op.vencimientoLicencia)}`}>
                      {op.vencimientoLicencia}
                    </td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">{op.unidadAsignada || <span className="text-gray-600">—</span>}</td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">${op.salarioDia.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{op.fechaIngreso}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusBadge status={op.estatus.toLowerCase()} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(op)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors"
                          aria-label={`Editar ${op.nombre}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(op.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors"
                          aria-label={`Eliminar ${op.nombre}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <FormModal
        open={showForm}
        title={editing ? `Editar operador — ${editing.nombre}` : "Nuevo operador"}
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
              Guardar operador
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Nombre completo", type: "text", defaultValue: editing?.nombre },
            { label: "Teléfono", type: "text", defaultValue: editing?.telefono },
            { label: "Correo electrónico", type: "email", defaultValue: editing?.email },
            { label: "CURP", type: "text", defaultValue: editing?.curp },
            { label: "RFC", type: "text", defaultValue: editing?.rfc },
            { label: "No. Licencia", type: "text", defaultValue: editing?.noLicencia },
          ].map(({ label, type, defaultValue }) => (
            <div key={label}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={type}
                defaultValue={defaultValue ?? ""}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tipo licencia</label>
            <select
              defaultValue={editing?.tipoLicencia ?? "E"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {TIPOS_LICENCIA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vencimiento licencia</label>
            <input
              type="date"
              defaultValue={editing?.vencimientoLicencia ?? ""}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Unidad asignada</label>
            <input
              type="text"
              defaultValue={editing?.unidadAsignada ?? ""}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Salario / día</label>
            <input
              type="text"
              defaultValue={editing?.salarioDia ? String(editing.salarioDia) : ""}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha ingreso</label>
            <input
              type="date"
              defaultValue={editing?.fechaIngreso ?? ""}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Estatus</label>
            <select
              defaultValue={editing?.estatus ?? "Activo"}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {ESTATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
            <textarea
              defaultValue={editing?.observaciones ?? ""}
              rows={2}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] resize-none"
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
