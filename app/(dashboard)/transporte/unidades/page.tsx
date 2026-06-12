"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Gauge,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import FormSection from "@/components/FormSection";
import StatusBadge from "@/components/StatusBadge";
import { capacidadTotalM3, type EstatusUnidad, type Unidad } from "@/lib/unidades";
import { type Operador } from "@/lib/operadores";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";

const MARCAS = ["Mercedes-Benz", "Volvo", "Kenworth", "Scania", "Freightliner", "Otra"];
const ESTATUS_OPTIONS: EstatusUnidad[] = ["Activo", "Mantenimiento", "Baja"];
const CURRENT_TIME = new Date().getTime();

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusUnidad | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Unidad | null>(null);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Unidad>(COLLECTIONS.unidades),
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
    ]).then(([u, op]) => {
      setUnidades(u);
      setOperadoresList(op);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return unidades.filter((u) => {
      const matchQuery =
        !term ||
        u.noEconomico.toLowerCase().includes(term) ||
        u.placa.toLowerCase().includes(term) ||
        u.marca.toLowerCase().includes(term) ||
        u.choferAsignado.toLowerCase().includes(term);
      const matchEstatus = filtroEstatus === "Todos" || u.estatus === filtroEstatus;
      return matchQuery && matchEstatus;
    });
  }, [unidades, query, filtroEstatus]);

  const totalActivas = unidades.filter((u) => u.estatus === "Activo").length;
  const enMantenimiento = unidades.filter((u) => u.estatus === "Mantenimiento").length;
  const capacidadTotal = capacidadTotalM3(unidades);

  function proximoMantenimientoCount() {
    const hoy = new Date();
    const limite = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    return unidades.filter((u) => {
      if (!u.proximoMantenimiento || u.proximoMantenimiento === "—") return false;
      return new Date(u.proximoMantenimiento) <= limite;
    }).length;
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(u: Unidad) {
    setEditing(u);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    setUnidades((current) => current.filter((u) => u.id !== id));
    await deleteDocument(COLLECTIONS.unidades, id);
  }

  async function handleSave(values: Record<string, string>) {
    const noEconomico = values["No. económico"]?.trim();
    const placa = values["Placa"]?.trim();
    const marca = values["Marca"]?.trim();
    const modelo = values["Modelo"]?.trim();

    if (!noEconomico || !placa || !marca || !modelo) return false;

    const isDuplicate = unidades.some(
      (u) => u.placa.toLowerCase() === placa.toLowerCase() && u.id !== editing?.id,
    );
    if (isDuplicate) return "Ya existe una unidad con esa placa.";

    const id = editing?.id ?? `UN-${Date.now()}`;
    const next: Unidad = {
      id,
      noEconomico,
      placa: placa.toUpperCase(),
      marca,
      modelo,
      anio: Number(values["Año"] ?? 2024),
      capacidadM3: Number(values["Capacidad m3"] ?? 6),
      kmActual: Number(values["Km actual"]?.replace(/,/g, "") ?? 0),
      choferAsignado: values["Chofer asignado"] ?? "",
      estatus: (values["Estatus"] as EstatusUnidad) ?? "Activo",
      ultimoMantenimiento: values["Último mantenimiento"] ?? "",
      proximoMantenimiento: values["Próximo mantenimiento"] ?? "",
      seguroVigente: values["Seguro vigente hasta"] ?? "",
      tarjetaCirculacion: values["Tarjeta circulación"] ?? "",
      verificacion: values["Verificación"] ?? "",
      observaciones: values["Observaciones"] ?? "",
    };

    setUnidades((current) =>
      editing
        ? current.map((u) => (u.id === editing.id ? next : u))
        : [next, ...current],
    );
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.unidades, _id, data);
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
    const rows = unidades
      .map(
        (u) => `<tr>
          <td>${u.noEconomico}</td><td>${u.placa}</td><td>${u.marca} ${u.modelo}</td>
          <td>${u.anio}</td><td>${u.capacidadM3}</td><td>${u.kmActual.toLocaleString()}</td>
          <td>${u.choferAsignado}</td><td>${u.estatus}</td>
          <td>${u.ultimoMantenimiento}</td><td>${u.proximoMantenimiento}</td>
          <td>${u.seguroVigente}</td>
        </tr>`,
      )
      .join("");
    downloadFile(
      "unidades-duro-concretos.xls",
      `<html><head><meta charset="UTF-8"/></head><body><table>
        <thead><tr><th>No. Económico</th><th>Placa</th><th>Marca/Modelo</th><th>Año</th>
        <th>m3</th><th>Km</th><th>Chofer</th><th>Estatus</th>
        <th>Último Mtto</th><th>Próximo Mtto</th><th>Seguro</th></tr></thead>
        <tbody>${rows}</tbody></table></body></html>`,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportPDF() {
    const rows = unidades
      .map(
        (u) => `<tr>
          <td>${u.noEconomico}</td><td>${u.placa}</td>
          <td>${u.marca} ${u.modelo} (${u.anio})</td>
          <td>${u.capacidadM3} m3</td><td>${u.kmActual.toLocaleString()} km</td>
          <td>${u.choferAsignado || "—"}</td><td>${u.estatus}</td>
          <td>${u.proximoMantenimiento}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Flota Vehicular</title>
      <style>body{font-family:Arial;padding:24px;color:#111}h1{margin:0 0 4px;font-size:22px}
      p{margin:0 0 18px;color:#6B7280;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#111;color:#fff;text-align:left;padding:8px}
      td{border-bottom:1px solid #E5E7EB;padding:8px}@media print{button{display:none}}</style>
      </head><body>
      <h1>Flota Vehicular</h1>
      <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
      <table><thead><tr><th>No. Económico</th><th>Placa</th><th>Marca/Modelo/Año</th>
      <th>Capacidad</th><th>Km actual</th><th>Chofer</th><th>Estatus</th><th>Próx. Mtto</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  }

  const documentoVencimiento = (fecha: string) => {
    if (!fecha || fecha === "—") return "text-gray-500";
    const diff = new Date(fecha).getTime() - CURRENT_TIME;
    const days = diff / (1000 * 60 * 60 * 24);
    if (days < 0) return "text-red-400";
    if (days < 60) return "text-amber-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total unidades" value={String(unidades.length)} icon={Truck} />
        <KPICard
          title="Activas"
          value={String(totalActivas)}
          icon={Truck}
          iconColor="text-green-400"
          iconBg="bg-green-500/10"
        />
        <KPICard
          title="En mantenimiento"
          value={String(enMantenimiento)}
          icon={Wrench}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          subtitle={`${proximoMantenimientoCount()} próximos 30 días`}
        />
        <KPICard
          title="Capacidad activa"
          value={`${capacidadTotal} m3`}
          icon={Gauge}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          subtitle="Por viaje simultáneo"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar placa, no. económico, chofer..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <div className="relative">
          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value as EstatusUnidad | "Todos")}
            className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          >
            <option value="Todos">Todos los estatus</option>
            {ESTATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} unidades</span>
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
          Nueva unidad
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["No. Económico", "Placa", "Marca / Modelo", "Año", "m3", "Km actual", "Chofer", "Estatus", "Próx. Mtto", "Seguro", "Acciones"].map(
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
                    Cargando unidades...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-gray-500">
                    No se encontraron unidades con ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                          <Truck size={14} className="text-blue-400" />
                        </div>
                        <span className="text-white font-bold">{u.noEconomico}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="rounded-full bg-[#1A1A1A] border border-[#3A3A3A] px-2.5 py-0.5 text-xs font-mono text-gray-300">
                        {u.placa}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white whitespace-nowrap">{u.marca} {u.modelo}</td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{u.anio}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-blue-300 font-semibold">{u.capacidadM3}</span>
                      <span className="text-gray-600 text-xs ml-1">m3</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{u.kmActual.toLocaleString()} km</td>
                    <td className="px-5 py-3 text-gray-300 whitespace-nowrap">{u.choferAsignado || <span className="text-gray-600">—</span>}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusBadge status={u.estatus === "Mantenimiento" ? "en riesgo" : u.estatus === "Baja" ? "cancelado" : "activo"} />
                    </td>
                    <td className={`px-5 py-3 text-sm whitespace-nowrap ${documentoVencimiento(u.proximoMantenimiento)}`}>
                      {u.proximoMantenimiento}
                    </td>
                    <td className={`px-5 py-3 text-sm whitespace-nowrap ${documentoVencimiento(u.seguroVigente)}`}>
                      {u.seguroVigente}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors"
                          aria-label={`Editar ${u.noEconomico}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors"
                          aria-label={`Eliminar ${u.noEconomico}`}
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
        title={editing ? `Editar unidad — ${editing.noEconomico}` : "Nueva unidad"}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        footer={
          <>
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20">
              Guardar unidad
            </button>
          </>
        }
      >
        {(() => {
          const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
          const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
          return (
            <>
              <FormSection title="Datos de la unidad">
                {[
                  { label: "No. económico", defaultValue: editing?.noEconomico },
                  { label: "Placa", defaultValue: editing?.placa },
                  { label: "Modelo", defaultValue: editing?.modelo },
                  { label: "Año", defaultValue: editing?.anio ? String(editing.anio) : "" },
                  { label: "Capacidad m3", defaultValue: editing?.capacidadM3 ? String(editing.capacidadM3) : "" },
                  { label: "Km actual", defaultValue: editing?.kmActual ? String(editing.kmActual) : "" },
                ].map(({ label, defaultValue }) => (
                  <div key={label}>
                    <label className={lbl}>{label}</label>
                    <input type="text" defaultValue={defaultValue ?? ""} className={inp} />
                  </div>
                ))}
                <div>
                  <label className={lbl}>Marca</label>
                  <select defaultValue={editing?.marca ?? "Mercedes-Benz"} className={inp}>
                    {MARCAS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </FormSection>
              <FormSection title="Asignación">
                <div>
                  <label className={lbl}>Chofer asignado</label>
                  <select defaultValue={editing?.choferAsignado ?? ""} className={inp} data-catalog-locked="true">
                    <option value="">Sin asignar</option>
                    {operadoresList.filter((o) => o.estatus === "Activo").map((o) => (
                      <option key={o.id} value={o.nombre}>{o.nombre}</option>
                    ))}
                  </select>
                  {operadoresList.filter((o) => o.estatus === "Activo").length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">Sin operadores activos — agrégalos en Transporte → Operadores.</p>
                  )}
                </div>
                <div>
                  <label className={lbl}>Estatus</label>
                  <select defaultValue={editing?.estatus ?? "Activo"} className={inp}>
                    {ESTATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </FormSection>
              <FormSection title="Documentos y vencimientos">
                {[
                  { label: "Último mantenimiento", defaultValue: editing?.ultimoMantenimiento },
                  { label: "Próximo mantenimiento", defaultValue: editing?.proximoMantenimiento },
                  { label: "Seguro vigente hasta", defaultValue: editing?.seguroVigente },
                  { label: "Tarjeta circulación", defaultValue: editing?.tarjetaCirculacion },
                  { label: "Verificación", defaultValue: editing?.verificacion },
                ].map(({ label, defaultValue }) => (
                  <div key={label}>
                    <label className={lbl}>{label}</label>
                    <input type="date" defaultValue={defaultValue && defaultValue !== "—" ? defaultValue : ""} className={inp} />
                  </div>
                ))}
              </FormSection>
              <div>
                <label className={lbl}>Observaciones</label>
                <textarea defaultValue={editing?.observaciones ?? ""} rows={2} className={`${inp} resize-none`} />
              </div>
            </>
          );
        })()}
      </FormModal>

      {enMantenimiento > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">{enMantenimiento} unidad{enMantenimiento > 1 ? "es" : ""} en mantenimiento</p>
            <p className="text-xs text-gray-400 mt-1">
              {unidades.filter((u) => u.estatus === "Mantenimiento").map((u) => `${u.noEconomico} (${u.placa})`).join(" · ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
