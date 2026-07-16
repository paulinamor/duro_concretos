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
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import HScrollTable from "@/components/HScrollTable";
import { capacidadTotalM3, type EstatusUnidad, type Unidad } from "@/lib/unidades";
import { type Operador } from "@/lib/operadores";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";

const MARCAS = ["Mercedes-Benz", "Volvo", "Kenworth", "Scania", "Freightliner", "Otra"];
const ESTATUS_OPTIONS: EstatusUnidad[] = ["Activo", "Mantenimiento", "Baja"];
const CURRENT_TIME = new Date().getTime();

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  noEconomico: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: string;
  capacidadM3: string;
  kmActual: string;
  choferAsignado: string;
  estatus: EstatusUnidad;
  ultimoMantenimiento: string;
  proximoMantenimiento: string;
  seguroVigente: string;
  tarjetaCirculacion: string;
  verificacion: string;
  observaciones: string;
}

function emptyForm(): FormState {
  return {
    noEconomico: "",
    placa: "",
    marca: "Mercedes-Benz",
    modelo: "",
    anio: "",
    capacidadM3: "",
    kmActual: "",
    choferAsignado: "N/A",
    estatus: "Activo",
    ultimoMantenimiento: "",
    proximoMantenimiento: "",
    seguroVigente: "",
    tarjetaCirculacion: "",
    verificacion: "",
    observaciones: "",
  };
}

function fromUnidad(u: Unidad): FormState {
  return {
    noEconomico: u.noEconomico ?? "",
    placa: u.placa ?? "",
    marca: u.marca ?? "Mercedes-Benz",
    modelo: u.modelo ?? "",
    anio: u.anio ? String(u.anio) : "",
    capacidadM3: u.capacidadM3 != null ? String(u.capacidadM3) : "",
    kmActual: u.kmActual != null ? String(u.kmActual) : "",
    choferAsignado: u.choferAsignado || "N/A",
    estatus: u.estatus ?? "Activo",
    ultimoMantenimiento: u.ultimoMantenimiento && u.ultimoMantenimiento !== "—" ? u.ultimoMantenimiento : "",
    proximoMantenimiento: u.proximoMantenimiento && u.proximoMantenimiento !== "—" ? u.proximoMantenimiento : "",
    seguroVigente: u.seguroVigente && u.seguroVigente !== "—" ? u.seguroVigente : "",
    tarjetaCirculacion: u.tarjetaCirculacion && u.tarjetaCirculacion !== "—" ? u.tarjetaCirculacion : "",
    verificacion: u.verificacion && u.verificacion !== "—" ? u.verificacion : "",
    observaciones: u.observaciones ?? "",
  };
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
const sectionTitleClass = "flex items-center gap-3 mb-4";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className={sectionTitleClass}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function UnidadDrawer({ open, editing, operadoresList, onClose, onSave }: {
  open: boolean;
  editing: Unidad | null;
  operadoresList: Operador[];
  onClose: () => void;
  onSave: (f: FormState) => Promise<string | false | void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromUnidad(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.noEconomico.trim() || !form.placa.trim() || !form.marca.trim() || !form.modelo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onSave(form);
      if (typeof result === "string") {
        setError(result);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const isValid = form.noEconomico.trim() && form.placa.trim() && form.marca.trim() && form.modelo.trim();

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Truck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `Editar — ${editing.noEconomico}` : "Nueva unidad"}
            </h2>
            <p className="text-xs text-gray-500">No. económico, placa, marca y modelo son obligatorios</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Datos de la unidad */}
          <div>
            <SectionDivider label="Datos de la unidad" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>No. económico <span className="text-[#CC2229]">*</span></label>
                <input
                  type="text"
                  value={form.noEconomico}
                  onChange={(e) => set("noEconomico", e.target.value)}
                  placeholder="Ej. U-01"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Placa <span className="text-[#CC2229]">*</span></label>
                <input
                  type="text"
                  value={form.placa}
                  onChange={(e) => set("placa", e.target.value.toUpperCase())}
                  placeholder="Ej. ABC-1234"
                  className={`${inp} uppercase`}
                />
              </div>
              <div>
                <label className={lbl}>Marca <span className="text-[#CC2229]">*</span></label>
                <select value={form.marca} onChange={(e) => set("marca", e.target.value)} className={inp}>
                  {MARCAS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Modelo <span className="text-[#CC2229]">*</span></label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                  placeholder="Ej. Actros 2651"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Año</label>
                <input
                  type="number"
                  min="1990"
                  max="2100"
                  value={form.anio}
                  onChange={(e) => set("anio", e.target.value)}
                  placeholder="2024"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Capacidad m3</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.capacidadM3}
                  onChange={(e) => set("capacidadM3", e.target.value)}
                  placeholder="6"
                  className={inp}
                />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Km actual</label>
                <input
                  type="number"
                  min="0"
                  value={form.kmActual}
                  onChange={(e) => set("kmActual", e.target.value)}
                  placeholder="0"
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* Asignación */}
          <div>
            <SectionDivider label="Asignación" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Chofer asignado</label>
                <select value={form.choferAsignado} onChange={(e) => set("choferAsignado", e.target.value)} className={inp}>
                  <option value="N/A">N/A</option>
                  {operadoresList.filter((o) => !o.baja).map((o) => (
                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                  ))}
                </select>
                {operadoresList.filter((o) => !o.baja).length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">Sin operadores activos — agrégalos en Transporte → Operadores.</p>
                )}
              </div>
              <div>
                <label className={lbl}>Estatus</label>
                <select value={form.estatus} onChange={(e) => set("estatus", e.target.value as EstatusUnidad)} className={inp}>
                  {ESTATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Documentos y vencimientos */}
          <div>
            <SectionDivider label="Documentos y vencimientos" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Último mantenimiento</label>
                <input
                  type="date"
                  value={form.ultimoMantenimiento}
                  onChange={(e) => set("ultimoMantenimiento", e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Próximo mantenimiento</label>
                <input
                  type="date"
                  value={form.proximoMantenimiento}
                  onChange={(e) => set("proximoMantenimiento", e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Seguro vigente hasta</label>
                <input
                  type="date"
                  value={form.seguroVigente}
                  onChange={(e) => set("seguroVigente", e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Tarjeta circulación</label>
                <input
                  type="date"
                  value={form.tarjetaCirculacion}
                  onChange={(e) => set("tarjetaCirculacion", e.target.value)}
                  className={inp}
                />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Verificación</label>
                <input
                  type="date"
                  value={form.verificacion}
                  onChange={(e) => set("verificacion", e.target.value)}
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <SectionDivider label="Observaciones" />
            <textarea
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              rows={3}
              placeholder="Notas adicionales sobre la unidad..."
              className={`${inp} resize-none`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear unidad"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UnidadesPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusUnidad | "Todos">("Todos");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Unidad | null>(null);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Unidad>(COLLECTIONS.unidades),
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
    ]).then(([u, op]) => {
      setUnidades(filterByPlanta(u));
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
    setShowDrawer(true);
  }

  function openEdit(u: Unidad) {
    setEditing(u);
    setShowDrawer(true);
  }

  async function handleDelete(id: string) {
    setUnidades((current) => current.filter((u) => u.id !== id));
    await deleteDocument(COLLECTIONS.unidades, id);
  }

  async function handleSave(f: FormState): Promise<string | false | void> {
    const noEconomico = f.noEconomico.trim();
    const placa = f.placa.trim();
    const marca = f.marca.trim();
    const modelo = f.modelo.trim();

    if (!noEconomico || !placa || !marca || !modelo) return;

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
      anio: Number(f.anio) || 2024,
      capacidadM3: Number(f.capacidadM3) || 6,
      kmActual: Number(f.kmActual.replace(/,/g, "")) || 0,
      choferAsignado: f.choferAsignado === "N/A" ? "" : f.choferAsignado,
      estatus: f.estatus,
      ultimoMantenimiento: f.ultimoMantenimiento || "",
      proximoMantenimiento: f.proximoMantenimiento || "",
      seguroVigente: f.seguroVigente || "",
      tarjetaCirculacion: f.tarjetaCirculacion || "",
      verificacion: f.verificacion || "",
      observaciones: f.observaciones.trim(),
    };

    setUnidades((current) =>
      editing
        ? current.map((u) => (u.id === editing.id ? next : u))
        : [next, ...current],
    );
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.unidades, _id, withPlantaTag(data));
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: editing ? "Unidad actualizada." : "Unidad creada." },
    }));
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
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors cursor-pointer"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
        <button
          type="button"
          onClick={exportPDF}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-[#CC2229] transition-colors cursor-pointer"
        >
          <FileText size={15} />
          PDF
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus size={15} />
          Nueva unidad
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <HScrollTable>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#1A1A1A]">
              <tr className="border-b border-[#3A3A3A]">
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
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{u.anio && !isNaN(Number(u.anio)) ? u.anio : "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {u.capacidadM3 != null && !isNaN(Number(u.capacidadM3)) ? (
                        <>
                          <span className="text-blue-300 font-semibold">{u.capacidadM3}</span>
                          <span className="text-gray-600 text-xs ml-1">m3</span>
                        </>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{u.kmActual != null ? u.kmActual.toLocaleString() : "—"} km</td>
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
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                          aria-label={`Editar ${u.noEconomico}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer"
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
        </HScrollTable>
      </div>

      {/* Drawer */}
      <UnidadDrawer
        open={showDrawer}
        editing={editing}
        operadoresList={operadoresList}
        onClose={() => { setShowDrawer(false); setEditing(null); }}
        onSave={handleSave}
      />

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
