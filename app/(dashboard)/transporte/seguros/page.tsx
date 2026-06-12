"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Plus, Search, Shield, ShieldOff, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Seguro {
  id?: string;
  unidadId: string;
  noEconomico: string;
  placa: string;
  aseguradora: string;
  noPoliza: string;
  tipoCobertura: string;
  vigenciaInicio: string;  // yyyy-mm-dd
  vigenciaFin: string;     // yyyy-mm-dd
  primaNeta: number | null;
  agente: string;
  observaciones: string;
}

interface FormState {
  aseguradora: string;
  noPoliza: string;
  tipoCobertura: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  primaNeta: string;
  agente: string;
  observaciones: string;
}

type VigenciaStatus = "vigente" | "por_vencer" | "vencido" | "sin_registro";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COBERTURAS = ["Amplia", "Limitada", "Responsabilidad civil", "Daños a terceros"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function vigenciaStatus(fechaFin: string | undefined): VigenciaStatus {
  if (!fechaFin) return "sin_registro";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  const diff = (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencido";
  if (diff <= 30) return "por_vencer";
  return "vigente";
}

function diasRestantes(fechaFin: string) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function emptyForm(): FormState {
  return {
    aseguradora: "", noPoliza: "", tipoCobertura: "Amplia",
    vigenciaInicio: todayISO(), vigenciaFin: "",
    primaNeta: "", agente: "", observaciones: "",
  };
}

const STATUS_CONFIG: Record<VigenciaStatus, { label: string; cls: string }> = {
  vigente:      { label: "Vigente",      cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  por_vencer:   { label: "Por vencer",   cls: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
  vencido:      { label: "Vencido",      cls: "bg-red-500/10 border-red-500/30 text-red-400" },
  sin_registro: { label: "Sin registro", cls: "bg-gray-500/10 border-gray-500/30 text-gray-500" },
};

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, unidad, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (s: Seguro) => Promise<void>;
  unidad: Unidad | null;
  existing?: Seguro;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          aseguradora: existing.aseguradora,
          noPoliza: existing.noPoliza,
          tipoCobertura: existing.tipoCobertura,
          vigenciaInicio: existing.vigenciaInicio,
          vigenciaFin: existing.vigenciaFin,
          primaNeta: existing.primaNeta != null ? String(existing.primaNeta) : "",
          agente: existing.agente,
          observaciones: existing.observaciones,
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, existing]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!unidad || !form.aseguradora.trim() || !form.noPoliza.trim() || !form.vigenciaFin) return;
    setSaving(true);
    try {
      await onSave({
        id: existing?.id,
        unidadId: unidad.id,
        noEconomico: unidad.noEconomico,
        placa: unidad.placa,
        aseguradora: form.aseguradora.trim(),
        noPoliza: form.noPoliza.trim(),
        tipoCobertura: form.tipoCobertura,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFin: form.vigenciaFin,
        primaNeta: form.primaNeta ? parseFloat(form.primaNeta) : null,
        agente: form.agente.trim(),
        observaciones: form.observaciones.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open || !unidad) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {existing ? "Editar póliza" : "Registrar seguro"}
            </h2>
            <p className="text-xs text-gray-500">
              {unidad.noEconomico} · {unidad.placa} · {unidad.marca} {unidad.modelo}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Póliza */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Póliza</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Aseguradora <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.aseguradora} onChange={(e) => set("aseguradora", e.target.value)} placeholder="GNP, MAPFRE, AXA…" className={inp} />
              </div>
              <div>
                <label className={lbl}>No. Póliza <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.noPoliza} onChange={(e) => set("noPoliza", e.target.value)} placeholder="POL-2026-000001" className={inp} />
              </div>
              <div>
                <label className={lbl}>Tipo de cobertura</label>
                <select value={form.tipoCobertura} onChange={(e) => set("tipoCobertura", e.target.value)} className={inp}>
                  {COBERTURAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Vigencia */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Vigencia</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Inicio</label>
                <input type="date" value={form.vigenciaInicio} onChange={(e) => set("vigenciaInicio", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Vencimiento <span className="text-[#CC2229]">*</span></label>
                <input type="date" value={form.vigenciaFin} onChange={(e) => set("vigenciaFin", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Financiero */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Datos financieros</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Prima neta $</label>
                <input type="number" step="0.01" min="0" value={form.primaNeta} onChange={(e) => set("primaNeta", e.target.value)} placeholder="0.00" className={inp} />
              </div>
              <div>
                <label className={lbl}>Agente / Broker</label>
                <input type="text" value={form.agente} onChange={(e) => set("agente", e.target.value)} placeholder="Nombre del agente" className={inp} />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className={lbl}>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder="Notas adicionales…" className={`${inp} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.aseguradora.trim() || !form.noPoliza.trim() || !form.vigenciaFin}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <Shield size={14} />
            {saving ? "Guardando…" : "Guardar póliza"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SegurosPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [seguros, setSeguros] = useState<Seguro[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<VigenciaStatus | "todos">("todos");
  const [drawerUnidad, setDrawerUnidad] = useState<Unidad | null>(null);
  const [drawerExisting, setDrawerExisting] = useState<Seguro | undefined>();
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then(setUnidades);
    getCollectionDocs<Seguro>(COLLECTIONS.seguros).then(setSeguros);
  }, []);

  // Map unidadId → latest seguro
  const seguroByUnidad = useMemo(() => {
    const map = new Map<string, Seguro>();
    seguros.forEach((s) => {
      const existing = map.get(s.unidadId);
      if (!existing || s.vigenciaFin > existing.vigenciaFin) map.set(s.unidadId, s);
    });
    return map;
  }, [seguros]);

  // Merged rows: one per unit
  const rows = useMemo(() => {
    return unidades.map((u) => ({
      unidad: u,
      seguro: seguroByUnidad.get(u.id),
      status: vigenciaStatus(seguroByUnidad.get(u.id)?.vigenciaFin),
    }));
  }, [unidades, seguroByUnidad]);

  // Filtered
  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus !== "todos") list = list.filter((r) => r.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.unidad.noEconomico.toLowerCase().includes(q) ||
        r.unidad.placa.toLowerCase().includes(q) ||
        r.unidad.marca.toLowerCase().includes(q) ||
        (r.seguro?.aseguradora ?? "").toLowerCase().includes(q) ||
        (r.seguro?.noPoliza ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filterStatus, search]);

  // KPIs
  const total = rows.length;
  const vigentes = rows.filter((r) => r.status === "vigente").length;
  const porVencer = rows.filter((r) => r.status === "por_vencer").length;
  const vencidas = rows.filter((r) => r.status === "vencido" || r.status === "sin_registro").length;

  const handleSave = async (s: Seguro) => {
    const id = s.id ?? `SEG-${s.unidadId}-${Date.now()}`;
    await upsertDocument(COLLECTIONS.seguros, id, { ...s, id: undefined });
    const withId = { ...s, id };
    setSeguros((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      return idx >= 0 ? prev.map((x, i) => (i === idx ? withId : x)) : [...prev, withId];
    });
  };

  function openDrawer(unidad: Unidad, existing?: Seguro) {
    setDrawerUnidad(unidad);
    setDrawerExisting(existing);
    setShowDrawer(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Seguros de flota</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pólizas de seguro por unidad · Catálogo maestro</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Unidades en flota" value={String(total)} icon={Shield} iconColor="text-blue-400" />
        <KPICard title="Pólizas vigentes" value={String(vigentes)} icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Por vencer (≤30 días)" value={String(porVencer)} icon={Clock} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <KPICard title="Vencidas / Sin póliza" value={String(vencidas)} icon={ShieldOff} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Unidad, placa, aseguradora…"
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as VigenciaStatus | "todos")}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
          >
            <option value="todos">Todos los estatus</option>
            <option value="vigente">Vigente</option>
            <option value="por_vencer">Por vencer</option>
            <option value="vencido">Vencido</option>
            <option value="sin_registro">Sin registro</option>
          </select>
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} unidades</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {["No. Econ.", "Placa", "Unidad", "Aseguradora", "No. Póliza", "Cobertura", "Vigencia inicio", "Vencimiento", "Prima neta", "Estatus", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-600">
                    No hay unidades que coincidan.
                  </td>
                </tr>
              ) : (
                filtered.map(({ unidad, seguro, status }) => {
                  const cfg = STATUS_CONFIG[status];
                  const dias = seguro?.vigenciaFin ? diasRestantes(seguro.vigenciaFin) : null;
                  return (
                    <tr key={unidad.id} className="hover:bg-[#1A1F2B] transition-colors">
                      <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-semibold whitespace-nowrap">
                        {unidad.noEconomico}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs font-mono whitespace-nowrap">
                        {unidad.placa}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-gray-200 text-sm">{unidad.marca} {unidad.modelo}</p>
                        <p className="text-gray-600 text-xs">{unidad.anio}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                        {seguro?.aseguradora || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                        {seguro?.noPoliza || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {seguro?.tipoCobertura || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {seguro?.vigenciaInicio || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {seguro?.vigenciaFin ? (
                          <div>
                            <p className={`text-xs font-medium ${status === "vencido" ? "text-red-400" : status === "por_vencer" ? "text-amber-400" : "text-gray-300"}`}>
                              {seguro.vigenciaFin}
                            </p>
                            {dias !== null && (
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : dias === 0 ? "Vence hoy" : `${dias} días`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs tabular-nums whitespace-nowrap">
                        {seguro?.primaNeta != null
                          ? `$${seguro.primaNeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cfg.cls}`}>
                          {status === "vencido" && <AlertTriangle size={10} />}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => openDrawer(unidad, seguro)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#252D3D] border border-[#3A3A3A] hover:border-[#CC2229]/40 rounded-lg transition-colors"
                        >
                          <Shield size={12} />
                          {seguro ? "Editar" : "Registrar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer summary */}
        {porVencer > 0 || vencidas > 0 ? (
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-gray-500">
              {porVencer > 0 && <span className="text-amber-400 font-medium">{porVencer} póliza{porVencer !== 1 ? "s" : ""} por vencer</span>}
              {porVencer > 0 && vencidas > 0 && " · "}
              {vencidas > 0 && <span className="text-red-400 font-medium">{vencidas} sin cobertura activa</span>}
            </p>
          </div>
        ) : null}
      </div>

      <FormDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
        unidad={drawerUnidad}
        existing={drawerExisting}
      />
    </div>
  );
}
