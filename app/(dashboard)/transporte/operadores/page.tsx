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
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
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

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  apodo: string; nombre: string; fechaNacimiento: string; curp: string; rfc: string;
  direccion: string; puesto: string; fechaIngreso: string; sueldoBase: string;
  cuentaBBVA: string; baja: string; noSeguroSocial: string; vencimientoContrato: string;
  tipoLicencia: string; vencimientoLicencia: string; vencimientoCredencial: string;
  contactosEmergencia: string;
}

function emptyForm(): FormState {
  return { apodo: "", nombre: "", fechaNacimiento: "", curp: "", rfc: "", direccion: "",
    puesto: "", fechaIngreso: "", sueldoBase: "", cuentaBBVA: "", baja: "",
    noSeguroSocial: "", vencimientoContrato: "", tipoLicencia: "E",
    vencimientoLicencia: "", vencimientoCredencial: "", contactosEmergencia: "" };
}

function fromOperador(op: Operador): FormState {
  return {
    apodo: op.apodo ?? "", nombre: op.nombre ?? "", fechaNacimiento: op.fechaNacimiento ?? "",
    curp: op.curp ?? "", rfc: op.rfc ?? "", direccion: op.direccion ?? "",
    puesto: op.puesto ?? "", fechaIngreso: op.fechaIngreso ?? "",
    sueldoBase: op.sueldoBase ? String(op.sueldoBase) : "", cuentaBBVA: op.cuentaBBVA ?? "",
    baja: op.baja ?? "", noSeguroSocial: op.noSeguroSocial ?? "",
    vencimientoContrato: op.vencimientoContrato ?? "", tipoLicencia: op.tipoLicencia ?? "E",
    vencimientoLicencia: op.vencimientoLicencia ?? "", vencimientoCredencial: op.vencimientoCredencial ?? "",
    contactosEmergencia: op.contactosEmergencia ?? "",
  };
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
const sectionTitle = "flex items-center gap-3 mb-4";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className={sectionTitle}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function EmpleadoDrawer({ open, editing, onClose, onSave }: {
  open: boolean; editing: Operador | null;
  onClose: () => void; onSave: (f: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromOperador(editing) : emptyForm());
  }, [open, editing]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <HardHat size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `Editar — ${editing.apodo || editing.nombre}` : "Nuevo empleado"}
            </h2>
            <p className="text-xs text-gray-500">Solo el nombre es obligatorio</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Identificación */}
          <div>
            <SectionDivider label="Identificación" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Apodo</label>
                <input type="text" value={form.apodo} onChange={(e) => set("apodo", e.target.value)} placeholder="Ej. El Güero" className={inp} />
              </div>
              <div>
                <label className={lbl}>Nombre completo <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo" className={inp} />
              </div>
              <div>
                <label className={lbl}>Fecha de nacimiento</label>
                <input type="date" value={form.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Nº Seguro Social</label>
                <input type="text" value={form.noSeguroSocial} onChange={(e) => set("noSeguroSocial", e.target.value)} placeholder="IMSS" className={inp} />
              </div>
              <div>
                <label className={lbl}>CURP</label>
                <input type="text" value={form.curp} onChange={(e) => set("curp", e.target.value.toUpperCase())} placeholder="CURP" className={`${inp} uppercase`} />
              </div>
              <div>
                <label className={lbl}>RFC</label>
                <input type="text" value={form.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} placeholder="RFC" className={`${inp} uppercase`} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Dirección</label>
                <input type="text" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle, colonia, municipio" className={inp} />
              </div>
            </div>
          </div>

          {/* Laboral */}
          <div>
            <SectionDivider label="Laboral" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Puesto</label>
                <input type="text" value={form.puesto} onChange={(e) => set("puesto", e.target.value)} placeholder="Ej. Operador" className={inp} />
              </div>
              <div>
                <label className={lbl}>Fecha de ingreso</label>
                <input type="date" value={form.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Sueldo base</label>
                <input type="number" min="0" step="100" value={form.sueldoBase} onChange={(e) => set("sueldoBase", e.target.value)} placeholder="0" className={inp} />
              </div>
              <div>
                <label className={lbl}>Cuenta BBVA</label>
                <input type="text" value={form.cuentaBBVA} onChange={(e) => set("cuentaBBVA", e.target.value)} placeholder="Nº de cuenta" className={inp} />
              </div>
              <div>
                <label className={lbl}>Venc. contrato</label>
                <input type="date" value={form.vencimientoContrato} onChange={(e) => set("vencimientoContrato", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Fecha de baja <span className="normal-case font-normal text-gray-400 text-[9px]">(vacío = activo)</span></label>
                <input type="date" value={form.baja} onChange={(e) => set("baja", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Licencia */}
          <div>
            <SectionDivider label="Licencia y credencial" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Tipo licencia</label>
                <select value={form.tipoLicencia} onChange={(e) => set("tipoLicencia", e.target.value)} className={inp}>
                  {TIPOS_LICENCIA.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Venc. licencia</label>
                <input type="date" value={form.vencimientoLicencia} onChange={(e) => set("vencimientoLicencia", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Venc. credencial</label>
                <input type="date" value={form.vencimientoCredencial} onChange={(e) => set("vencimientoCredencial", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Emergencia */}
          <div>
            <SectionDivider label="Contactos de emergencia" />
            <textarea value={form.contactosEmergencia} onChange={(e) => set("contactosEmergencia", e.target.value)}
              rows={3} placeholder={"Juan García - 81 1234 5678\nMaría López - 81 9876 5432"}
              className={`${inp} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.nombre.trim()}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear empleado"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmpleadosPage() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"Todos" | "Activos" | "Baja">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Operador | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Operador | null>(null);

  useEffect(() => {
    getCollectionDocs<Operador>(COLLECTIONS.operadores)
      .then((op) => setOperadores(filterByPlanta(op)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return operadores.filter((op) => {
      const matchQuery = !term ||
        op.nombre.toLowerCase().includes(term) ||
        (op.apodo ?? "").toLowerCase().includes(term) ||
        (op.puesto ?? "").toLowerCase().includes(term) ||
        (op.rfc ?? "").toLowerCase().includes(term) ||
        (op.curp ?? "").toLowerCase().includes(term) ||
        (op.noSeguroSocial ?? "").toLowerCase().includes(term);
      const matchFiltro = filtro === "Todos" || (filtro === "Activos" && !op.baja) || (filtro === "Baja" && !!op.baja);
      return matchQuery && matchFiltro;
    });
  }, [operadores, query, filtro]);

  const totalActivos = operadoresActivos(operadores);
  const totalBaja = operadores.filter((op) => !!op.baja).length;
  const porVencer = docsProximos(operadores);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(op: Operador) { setEditing(op); setShowForm(true); }

  async function handleDelete(op: Operador) {
    setOperadores((c) => c.filter((x) => x.id !== op.id));
    await deleteDocument(COLLECTIONS.operadores, op.id);
    setConfirmDelete(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `${op.apodo || op.nombre} eliminado.` } }));
  }

  async function handleSave(f: FormState) {
    const id = editing?.id ?? `OP-${Date.now()}`;
    const next: Operador = {
      id, apodo: f.apodo.trim(), nombre: f.nombre.trim(),
      fechaNacimiento: f.fechaNacimiento, curp: f.curp.trim(), rfc: f.rfc.trim(),
      direccion: f.direccion.trim(), puesto: f.puesto.trim(), fechaIngreso: f.fechaIngreso,
      sueldoBase: Number(f.sueldoBase) || 0, cuentaBBVA: f.cuentaBBVA.trim(),
      baja: f.baja, noSeguroSocial: f.noSeguroSocial.trim(),
      vencimientoContrato: f.vencimientoContrato, tipoLicencia: f.tipoLicencia,
      vencimientoLicencia: f.vencimientoLicencia, vencimientoCredencial: f.vencimientoCredencial,
      contactosEmergencia: f.contactosEmergencia.trim(),
    };
    setOperadores((c) => editing ? c.map((op) => op.id === editing.id ? next : op) : [next, ...c]);
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.operadores, _id, withPlantaTag(data));
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: editing ? "Empleado actualizado." : "Empleado creado." } }));
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600" />
        </div>
        <div className="relative">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer">
            <option value="Todos">Todos</option>
            <option value="Activos">Activos</option>
            <option value="Baja">Dados de baja</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} empleados</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors cursor-pointer">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button type="button" onClick={exportPDF}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-[#CC2229] transition-colors cursor-pointer">
            <FileText size={15} /> PDF
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            <Plus size={15} /> Nuevo empleado
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Empleado", "Puesto", "Días ingreso", "Sueldo base", "Licencia", "Vto. credencial", "Vto. contrato", "Estatus", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500">Cargando empleados…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <p className="text-gray-500 text-sm">No se encontraron empleados.</p>
                    <button onClick={openCreate} className="mt-3 text-xs text-[#CC2229] hover:underline cursor-pointer">+ Crear primer empleado</button>
                  </td>
                </tr>
              ) : filtered.map((op) => {
                const dias = diasDesdeIngreso(op.fechaIngreso);
                const activo = !op.baja;
                return (
                  <tr key={op.id} className={`hover:bg-[#2A2A2A] transition-colors ${!activo ? "opacity-60" : ""}`}>
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
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300 mr-1.5">{op.tipoLicencia}</span>
                      )}
                      <span className={`text-xs ${vencimientoColor(op.vencimientoLicencia)}`}>{formatFecha(op.vencimientoLicencia)}</span>
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
                        : <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">Baja {formatFecha(op.baja)}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(op)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer" aria-label={`Editar ${op.nombre}`}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(op)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer" aria-label={`Eliminar ${op.nombre}`}>
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

      {/* Drawer */}
      <EmpleadoDrawer open={showForm} editing={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} aria-label="Cancelar" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">¿Eliminar empleado?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminará <strong>{confirmDelete.apodo || confirmDelete.nombre}</strong> de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
