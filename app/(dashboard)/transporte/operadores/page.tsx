"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  HardHat,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import FormSection from "@/components/FormSection";
import { diasDesdeIngreso, docsProximos, operadoresActivos, type Operador } from "@/lib/operadores";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";

const TIPOS_LICENCIA = ["E", "D", "C", "A", "B"];

function vencimientoColor(fecha: string) {
  if (!fecha) return "text-gray-500";
  const diff = new Date(fecha).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-400";
  if (days < 90) return "text-amber-400";
  return "text-gray-400";
}

function formatFecha(f: string) {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export default function EmpleadosPage() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"Todos" | "Activos" | "Baja">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Operador | null>(null);

  useEffect(() => {
    getCollectionDocs<Operador>(COLLECTIONS.operadores)
      .then((op) => setOperadores(filterByPlanta(op)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return operadores.filter((op) => {
      const matchQuery =
        !term ||
        op.nombre.toLowerCase().includes(term) ||
        (op.apodo ?? "").toLowerCase().includes(term) ||
        (op.puesto ?? "").toLowerCase().includes(term) ||
        (op.rfc ?? "").toLowerCase().includes(term) ||
        (op.curp ?? "").toLowerCase().includes(term) ||
        (op.noSeguroSocial ?? "").toLowerCase().includes(term);
      const matchFiltro =
        filtro === "Todos" ||
        (filtro === "Activos" && !op.baja) ||
        (filtro === "Baja" && !!op.baja);
      return matchQuery && matchFiltro;
    });
  }, [operadores, query, filtro]);

  const totalActivos = operadoresActivos(operadores);
  const totalBaja = operadores.filter((op) => !!op.baja).length;
  const porVencer = docsProximos(operadores);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(op: Operador) { setEditing(op); setShowForm(true); }

  async function handleDelete(id: string) {
    setOperadores((c) => c.filter((op) => op.id !== id));
    await deleteDocument(COLLECTIONS.operadores, id);
  }

  async function handleSave(values: Record<string, string>) {
    const nombre = values["Nombre completo"]?.trim();
    if (!nombre) return false;

    const id = editing?.id ?? `OP-${Date.now()}`;
    const next: Operador = {
      id,
      apodo: values["Apodo"]?.trim() ?? "",
      nombre,
      fechaNacimiento: values["Fecha de nacimiento"] ?? "",
      curp: values["CURP"]?.trim() ?? "",
      rfc: values["RFC"]?.trim() ?? "",
      direccion: values["Dirección"]?.trim() ?? "",
      puesto: values["Puesto"]?.trim() ?? "",
      fechaIngreso: values["Fecha de ingreso"] ?? "",
      sueldoBase: Number((values["Sueldo base"] ?? "0").replace(/[$,\s]/g, "")),
      cuentaBBVA: values["Cuenta BBVA"]?.trim() ?? "",
      baja: values["Fecha de baja"] ?? "",
      noSeguroSocial: values["Nº Seguro Social"]?.trim() ?? "",
      vencimientoContrato: values["Fecha venc. contrato"] ?? "",
      tipoLicencia: values["Tipo de licencia"] ?? "E",
      vencimientoLicencia: values["Fecha venc. licencia"] ?? "",
      vencimientoCredencial: values["Fecha venc. credencial"] ?? "",
      contactosEmergencia: values["Contactos de emergencia"]?.trim() ?? "",
    };

    setOperadores((c) =>
      editing ? c.map((op) => (op.id === editing.id ? next : op)) : [next, ...c],
    );
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.operadores, _id, withPlantaTag(data));
    setShowForm(false);
    setEditing(null);
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = operadores.map((op) =>
      `<tr><td>${op.apodo}</td><td>${op.nombre}</td><td>${op.puesto}</td><td>${op.fechaIngreso}</td>
      <td>${op.sueldoBase}</td><td>${op.baja || "Activo"}</td><td>${op.cuentaBBVA}</td>
      <td>${op.fechaNacimiento}</td><td>${op.curp}</td><td>${op.rfc}</td>
      <td>${op.noSeguroSocial}</td><td>${op.tipoLicencia}</td><td>${op.vencimientoLicencia}</td>
      <td>${op.vencimientoCredencial}</td><td>${op.vencimientoContrato}</td>
      <td>${diasDesdeIngreso(op.fechaIngreso)}</td></tr>`
    ).join("");
    downloadFile("empleados-duro-concretos.xls",
      `<html><head><meta charset="UTF-8"/></head><body><table>
      <thead><tr><th>Apodo</th><th>Nombre</th><th>Puesto</th><th>Fecha ingreso</th>
      <th>Sueldo base</th><th>Baja</th><th>Cuenta BBVA</th><th>Fecha nacimiento</th>
      <th>CURP</th><th>RFC</th><th>Nº IMSS</th><th>Tipo lic.</th><th>Vto. licencia</th>
      <th>Vto. credencial</th><th>Vto. contrato</th><th>Días ingreso</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportPDF() {
    const rows = operadores.map((op) =>
      `<tr><td>${op.apodo || op.nombre}</td><td>${op.nombre}</td><td>${op.puesto}</td>
      <td>${op.fechaIngreso}</td><td>$${op.sueldoBase.toLocaleString()}</td>
      <td>${op.tipoLicencia} · ${formatFecha(op.vencimientoLicencia)}</td>
      <td>${op.baja ? `Baja ${formatFecha(op.baja)}` : "Activo"}</td></tr>`
    ).join("");
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Empleados</title>
      <style>body{font-family:Arial;padding:24px;color:#111}h1{margin:0 0 4px;font-size:22px}
      p{margin:0 0 18px;color:#6B7280;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#111;color:#fff;text-align:left;padding:8px}
      td{border-bottom:1px solid #E5E7EB;padding:8px}@media print{button{display:none}}</style>
      </head><body>
      <h1>Registro de Empleados</h1>
      <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
      <table><thead><tr><th>Apodo</th><th>Nombre</th><th>Puesto</th><th>Ingreso</th>
      <th>Sueldo</th><th>Licencia</th><th>Estatus</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  }

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total empleados" value={String(operadores.length)} icon={Users} />
        <KPICard title="Activos" value={String(totalActivos)} icon={UserCheck}
          iconColor="text-green-400" iconBg="bg-green-500/10" />
        <KPICard title="Dados de baja" value={String(totalBaja)} icon={UserMinus}
          iconColor="text-red-400" iconBg="bg-red-500/10" />
        <KPICard title="Docs por vencer" value={String(porVencer)} icon={AlertCircle}
          iconColor={porVencer > 0 ? "text-amber-400" : "text-green-400"}
          iconBg={porVencer > 0 ? "bg-amber-500/10" : "bg-green-500/10"}
          subtitle="Licencia, credencial o contrato" />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, apodo, puesto, RFC, CURP..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
        </div>
        <div className="relative">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
            <option value="Todos">Todos</option>
            <option value="Activos">Activos</option>
            <option value="Baja">Dados de baja</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} empleados</span>
        <button type="button" onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors">
          <FileSpreadsheet size={15} /> Excel
        </button>
        <button type="button" onClick={exportPDF}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-[#CC2229] transition-colors">
          <FileText size={15} /> PDF
        </button>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> Nuevo empleado
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Empleado", "Puesto", "Días ingreso", "Sueldo base", "Licencia", "Vto. credencial", "Vto. contrato", "Baja", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500">Cargando empleados...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500">No se encontraron empleados.</td></tr>
              ) : filtered.map((op) => {
                const dias = diasDesdeIngreso(op.fechaIngreso);
                const activo = !op.baja;
                return (
                  <tr key={op.id} className={`transition-colors ${!activo ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                          <HardHat size={14} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium whitespace-nowrap">{op.apodo || op.nombre}</p>
                          {op.apodo && <p className="text-gray-500 text-xs whitespace-nowrap">{op.nombre}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap text-xs">{op.puesto || <span className="text-gray-600">—</span>}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-white font-semibold tabular-nums">{dias.toLocaleString()}</span>
                      <span className="text-gray-600 text-xs ml-1">días</span>
                    </td>
                    <td className="px-5 py-3 text-gray-200 whitespace-nowrap tabular-nums">
                      {op.sueldoBase ? `$${op.sueldoBase.toLocaleString("es-MX")}` : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {op.tipoLicencia && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300 mr-1.5">
                          {op.tipoLicencia}
                        </span>
                      )}
                      <span className={`text-xs ${vencimientoColor(op.vencimientoLicencia)}`}>
                        {formatFecha(op.vencimientoLicencia)}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-xs whitespace-nowrap ${vencimientoColor(op.vencimientoCredencial)}`}>
                      {formatFecha(op.vencimientoCredencial)}
                    </td>
                    <td className={`px-5 py-3 text-xs whitespace-nowrap ${vencimientoColor(op.vencimientoContrato)}`}>
                      {formatFecha(op.vencimientoContrato)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {activo
                        ? <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Activo</span>
                        : <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">Baja {formatFecha(op.baja)}</span>
                      }
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(op)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors" aria-label={`Editar ${op.nombre}`}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(op.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors" aria-label={`Eliminar ${op.nombre}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <FormModal
        open={showForm}
        title={editing ? `Editar — ${editing.apodo || editing.nombre}` : "Nuevo empleado"}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20">
              Guardar
            </button>
          </>
        }
      >
        <>
          <FormSection title="Identificación">
            <div>
              <label className={lbl}>Apodo</label>
              <input type="text" defaultValue={editing?.apodo ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Nombre completo</label>
              <input type="text" defaultValue={editing?.nombre ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha de nacimiento</label>
              <input type="date" defaultValue={editing?.fechaNacimiento ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>CURP</label>
              <input type="text" defaultValue={editing?.curp ?? ""} className={`${inp} uppercase`} />
            </div>
            <div>
              <label className={lbl}>RFC</label>
              <input type="text" defaultValue={editing?.rfc ?? ""} className={`${inp} uppercase`} />
            </div>
            <div>
              <label className={lbl}>Nº Seguro Social</label>
              <input type="text" defaultValue={editing?.noSeguroSocial ?? ""} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Dirección</label>
              <input type="text" defaultValue={editing?.direccion ?? ""} className={inp} />
            </div>
          </FormSection>

          <FormSection title="Laboral">
            <div>
              <label className={lbl}>Puesto</label>
              <input type="text" defaultValue={editing?.puesto ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha de ingreso</label>
              <input type="date" defaultValue={editing?.fechaIngreso ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Sueldo base</label>
              <input type="text" defaultValue={editing?.sueldoBase ? String(editing.sueldoBase) : ""} placeholder="Ej. 15000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Cuenta BBVA</label>
              <input type="text" defaultValue={editing?.cuentaBBVA ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha venc. contrato</label>
              <input type="date" defaultValue={editing?.vencimientoContrato ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha de baja <span className="normal-case font-normal text-gray-400">(vacío = activo)</span></label>
              <input type="date" defaultValue={editing?.baja ?? ""} className={inp} />
            </div>
          </FormSection>

          <FormSection title="Licencia y credencial">
            <div>
              <label className={lbl}>Tipo de licencia</label>
              <select defaultValue={editing?.tipoLicencia ?? "E"} className={inp}>
                {TIPOS_LICENCIA.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha venc. licencia</label>
              <input type="date" defaultValue={editing?.vencimientoLicencia ?? ""} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha venc. credencial</label>
              <input type="date" defaultValue={editing?.vencimientoCredencial ?? ""} className={inp} />
            </div>
          </FormSection>

          <FormSection title="Contactos de emergencia">
            <div className="sm:col-span-2">
              <label className={lbl}>Contactos <span className="normal-case font-normal text-gray-400">(nombre y teléfono, uno por línea)</span></label>
              <textarea defaultValue={editing?.contactosEmergencia ?? ""} rows={3}
                placeholder={"Juan García - 81 1234 5678\nMaría López - 81 9876 5432"}
                className={`${inp} resize-none`} />
            </div>
          </FormSection>
        </>
      </FormModal>
    </div>
  );
}
