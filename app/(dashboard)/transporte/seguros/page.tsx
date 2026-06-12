"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Download, Plus, Search,
  Shield, ShieldOff, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusPoliza =
  | "Condicionada" | "Indefinida" | "Renovada"
  | "Con financiera" | "Sin seguro" | "Cotizar" | "Cancelada";

interface Seguro {
  id?: string;
  // Identificación de unidad (denormalizado para rapidez)
  unidadId: string;
  tipoUnidad: string;       // REVOLVEDORA, BOMBA, TRACTOCAMION, VOLTEO, VEHICULO…
  noEconomico: string;
  placa: string;
  estadoPlaca: string;
  marca: string;
  modelo: string;
  noSerie: string;
  anio: number | null;
  color: string;
  motor: string;
  // Tarjeta de circulación
  noTarjetaCirculacion: string;
  vigenciaTarjetaCirculacion: string; // ISO yyyy-mm-dd
  // Póliza de seguro
  aseguradora: string;
  noPoliza: string;
  statusPoliza: StatusPoliza;
  vigenciaInicio: string;   // ISO yyyy-mm-dd
  vigenciaFin: string;      // ISO yyyy-mm-dd
  costoPoliza: number | null;
  valorMercado: number | null;
  tenencia: string;         // año o "—"
  agente: string;
  observaciones: string;
  planta?: string;
}

interface FormState {
  tipoUnidad: string;
  noEconomico: string;
  placa: string;
  estadoPlaca: string;
  marca: string;
  modelo: string;
  noSerie: string;
  anio: string;
  color: string;
  motor: string;
  noTarjetaCirculacion: string;
  vigenciaTarjetaCirculacion: string;
  aseguradora: string;
  noPoliza: string;
  statusPoliza: StatusPoliza;
  vigenciaInicio: string;
  vigenciaFin: string;
  costoPoliza: string;
  valorMercado: string;
  tenencia: string;
  agente: string;
  observaciones: string;
}

type VigenciaStatus = "vigente" | "por_vencer" | "vencido" | "sin_registro";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_UNIDAD = [
  "Revolvedora", "Bomba", "Tractocamión", "Volteo", "Vehículo",
  "Maquinaria", "Remolque", "Plataforma", "Otro",
];

const STATUS_POLIZA_OPTS: StatusPoliza[] = [
  "Condicionada", "Indefinida", "Renovada", "Con financiera",
  "Sin seguro", "Cotizar", "Cancelada",
];

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Guanajuato",
  "Guerrero","Hidalgo","Jalisco","México","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

function todayISO() { return new Date().toISOString().slice(0, 10); }

function vigenciaStatus(fechaFin: string | undefined): VigenciaStatus {
  if (!fechaFin) return "sin_registro";
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  const diff = (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencido";
  if (diff <= 30) return "por_vencer";
  return "vigente";
}

function diasRestantes(fechaFin: string) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function emptyForm(u?: Unidad): FormState {
  return {
    tipoUnidad: "Revolvedora",
    noEconomico: u?.noEconomico ?? "",
    placa: u?.placa ?? "",
    estadoPlaca: "Nuevo León",
    marca: u?.marca ?? "",
    modelo: u?.modelo ?? "",
    noSerie: "",
    anio: u?.anio ? String(u.anio) : "",
    color: "",
    motor: "",
    noTarjetaCirculacion: u?.tarjetaCirculacion ?? "",
    vigenciaTarjetaCirculacion: "",
    aseguradora: "",
    noPoliza: "",
    statusPoliza: "Condicionada",
    vigenciaInicio: todayISO(),
    vigenciaFin: "",
    costoPoliza: "",
    valorMercado: "",
    tenencia: "",
    agente: "",
    observaciones: "",
  };
}

function formFromSeguro(s: Seguro): FormState {
  return {
    tipoUnidad: s.tipoUnidad,
    noEconomico: s.noEconomico,
    placa: s.placa,
    estadoPlaca: s.estadoPlaca,
    marca: s.marca,
    modelo: s.modelo,
    noSerie: s.noSerie,
    anio: s.anio != null ? String(s.anio) : "",
    color: s.color,
    motor: s.motor,
    noTarjetaCirculacion: s.noTarjetaCirculacion,
    vigenciaTarjetaCirculacion: s.vigenciaTarjetaCirculacion,
    aseguradora: s.aseguradora,
    noPoliza: s.noPoliza,
    statusPoliza: s.statusPoliza,
    vigenciaInicio: s.vigenciaInicio,
    vigenciaFin: s.vigenciaFin,
    costoPoliza: s.costoPoliza != null ? String(s.costoPoliza) : "",
    valorMercado: s.valorMercado != null ? String(s.valorMercado) : "",
    tenencia: s.tenencia,
    agente: s.agente,
    observaciones: s.observaciones,
  };
}

function exportCSV(rows: Seguro[]) {
  const headers = [
    "TIPO","NO.ECO","PLACA","ESTADO","MARCA","MODELO","SERIE","AÑO","COLOR","MOTOR",
    "NO.TC","VIGENCIA TC","ASEGURADORA","NO.POLIZA","STATUS POLIZA",
    "VIGENCIA INI","VIGENCIA FIN","DIAS","COSTO POLIZA","VALOR MERCADO","TENENCIA","AGENTE","OBSERVACIONES",
  ];
  const today = new Date(); today.setHours(0,0,0,0);
  const lines = rows.map((s) => {
    const dias = s.vigenciaFin
      ? Math.ceil((new Date(s.vigenciaFin+"T00:00:00").getTime()-today.getTime())/(1000*60*60*24))
      : "";
    return [
      s.tipoUnidad, s.noEconomico, s.placa, s.estadoPlaca, s.marca, s.modelo,
      s.noSerie, s.anio??'', s.color, s.motor,
      s.noTarjetaCirculacion, s.vigenciaTarjetaCirculacion,
      s.aseguradora, s.noPoliza, s.statusPoliza,
      s.vigenciaInicio, s.vigenciaFin, dias,
      s.costoPoliza??'', s.valorMercado??'', s.tenencia, s.agente, s.observaciones,
    ].map((v) => `"${v}"`).join(",");
  });
  const blob = new Blob(["﻿"+[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob), download: "seguros-flota.csv",
  });
  a.click();
}

const STATUS_VIG: Record<VigenciaStatus, { label: string; cls: string }> = {
  vigente:      { label: "Vigente",      cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  por_vencer:   { label: "Por vencer",   cls: "bg-amber-500/10  border-amber-500/30  text-amber-400"   },
  vencido:      { label: "Vencido",      cls: "bg-red-500/10    border-red-500/30    text-red-400"     },
  sin_registro: { label: "Sin registro", cls: "bg-gray-500/10   border-gray-500/30   text-gray-500"    },
};

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── Section divider helper ───────────────────────────────────────────────────

function Sec({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">{title}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, unidad, existing, unidadesList,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (s: Seguro) => Promise<void>;
  unidad: Unidad | null;
  existing?: Seguro;
  unidadesList: Unidad[];
}) {
  const [selectedUnidadId, setSelectedUnidadId] = useState<string>("");
  const [form, setForm] = useState<FormState>(() => emptyForm(unidad ?? undefined));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setSelectedUnidadId(existing.unidadId ?? "");
      setForm(formFromSeguro(existing));
    } else {
      setSelectedUnidadId(unidad?.id ?? "");
      setForm(emptyForm(unidad ?? undefined));
    }
  }, [open, existing, unidad]);

  // When user picks a unit from the dropdown, auto-fill unit fields
  function handleUnitSelect(id: string) {
    setSelectedUnidadId(id);
    const u = unidadesList.find((u) => u.id === id);
    if (!u) return;
    setForm((prev) => ({
      ...prev,
      noEconomico: u.noEconomico,
      placa: u.placa,
      marca: u.marca,
      modelo: u.modelo,
      anio: String(u.anio),
      noTarjetaCirculacion: prev.noTarjetaCirculacion || u.tarjetaCirculacion || "",
    }));
  }

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!selectedUnidadId) return;
    setSaving(true);
    const resolvedUnidadId = selectedUnidadId;
    try {
      const id = existing?.id ?? `SEG-${(resolvedUnidadId || form.noEconomico || Date.now())}-${Date.now()}`;
      await onSave({
        id,
        unidadId: resolvedUnidadId,
        tipoUnidad: form.tipoUnidad,
        noEconomico: form.noEconomico.trim(),
        placa: form.placa.trim(),
        estadoPlaca: form.estadoPlaca,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        noSerie: form.noSerie.trim(),
        anio: form.anio ? parseInt(form.anio) : null,
        color: form.color.trim(),
        motor: form.motor.trim(),
        noTarjetaCirculacion: form.noTarjetaCirculacion.trim(),
        vigenciaTarjetaCirculacion: form.vigenciaTarjetaCirculacion,
        aseguradora: form.aseguradora.trim(),
        noPoliza: form.noPoliza.trim(),
        statusPoliza: form.statusPoliza,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFin: form.vigenciaFin,
        costoPoliza: form.costoPoliza ? parseFloat(form.costoPoliza.replace(/,/g, "")) : null,
        valorMercado: form.valorMercado ? parseFloat(form.valorMercado.replace(/,/g, "")) : null,
        tenencia: form.tenencia.trim(),
        agente: form.agente.trim(),
        observaciones: form.observaciones.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const selectedUnidad = unidadesList.find((u) => u.id === selectedUnidadId);

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
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
              {selectedUnidad
                ? `${selectedUnidad.noEconomico} · ${selectedUnidad.placa} · ${selectedUnidad.marca} ${selectedUnidad.modelo}`
                : "Selecciona una unidad de la flota"}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Unidad selector */}
          <div className="space-y-2">
            <label className={lbl}>Unidad <span className="text-[#CC2229]">*</span></label>
            <select
              value={selectedUnidadId}
              onChange={(e) => handleUnitSelect(e.target.value)}
              className={inp}
            >
              <option value="">— Seleccionar unidad —</option>
              {unidadesList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.noEconomico} · {u.placa} · {u.marca} {u.modelo}
                </option>
              ))}
            </select>
            {!selectedUnidadId && unidadesList.length === 0 && (
              <p className="text-[11px] text-red-400">
                No hay unidades registradas. Agrégalas primero en Transporte → Unidades.
              </p>
            )}
            {!selectedUnidadId && unidadesList.length > 0 && (
              <p className="text-[11px] text-gray-400">
                Si la unidad no aparece, regístrala primero en Transporte → Unidades.
              </p>
            )}
          </div>

          {/* Bloqueo — no unit selected */}
          {!selectedUnidadId && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <Shield size={22} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">Selecciona una unidad para continuar</p>
              <p className="text-xs text-gray-400 max-w-[240px]">
                Solo se pueden registrar seguros de unidades que ya están en el catálogo de flota.
              </p>
            </div>
          )}

          {/* Formulario — solo visible cuando hay unidad seleccionada */}
          {selectedUnidadId && (
            <>
              {/* Resumen de unidad — solo lectura */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                {([
                  ["No. Eco.", form.noEconomico],
                  ["Placa", form.placa],
                  ["Marca", form.marca],
                  ["Modelo", form.modelo],
                  ["Año", form.anio],
                ] as [string, string][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">{label}</span>
                    <span className="text-xs text-gray-700 truncate font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Campos adicionales de la unidad que pueden no estar en el catálogo */}
              <Sec title="Datos complementarios de la unidad" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Tipo de unidad</label>
                  <select value={form.tipoUnidad} onChange={(e) => set("tipoUnidad", e.target.value)} className={inp}>
                    {TIPOS_UNIDAD.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Estado placa</label>
                  <select value={form.estadoPlaca} onChange={(e) => set("estadoPlaca", e.target.value)} className={inp}>
                    {ESTADOS_MX.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}># Serie</label>
                  <input type="text" value={form.noSerie} onChange={(e) => set("noSerie", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Color</label>
                  <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} className={inp} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Motor</label>
                  <input type="text" value={form.motor} onChange={(e) => set("motor", e.target.value)} className={inp} />
                </div>
              </div>

              {/* Tarjeta de Circulación */}
              <Sec title="Tarjeta de circulación" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>No. Tarjeta de circulación</label>
                  <input type="text" value={form.noTarjetaCirculacion} onChange={(e) => set("noTarjetaCirculacion", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Vigencia TC</label>
                  <input type="date" value={form.vigenciaTarjetaCirculacion} onChange={(e) => set("vigenciaTarjetaCirculacion", e.target.value)} className={inp} />
                </div>
              </div>

              {/* Póliza */}
              <Sec title="Póliza de seguro" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Aseguradora / Agente</label>
                  <input type="text" value={form.aseguradora} onChange={(e) => set("aseguradora", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>No. Póliza</label>
                  <input type="text" value={form.noPoliza} onChange={(e) => set("noPoliza", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Status póliza</label>
                  <select value={form.statusPoliza} onChange={(e) => set("statusPoliza", e.target.value as StatusPoliza)} className={inp}>
                    {STATUS_POLIZA_OPTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Vigencia inicio</label>
                  <input type="date" value={form.vigenciaInicio} onChange={(e) => set("vigenciaInicio", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Vigencia fin</label>
                  <input type="date" value={form.vigenciaFin} onChange={(e) => set("vigenciaFin", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Costo póliza $</label>
                  <input type="text" value={form.costoPoliza} onChange={(e) => set("costoPoliza", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Valor mercado $</label>
                  <input type="text" value={form.valorMercado} onChange={(e) => set("valorMercado", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Tenencia (año)</label>
                  <input type="text" value={form.tenencia} onChange={(e) => set("tenencia", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Agente / Contacto</label>
                  <input type="text" value={form.agente} onChange={(e) => set("agente", e.target.value)} className={inp} />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className={lbl}>Observaciones</label>
                <textarea rows={2} value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} className={`${inp} resize-none`} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedUnidadId}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <Shield size={14} />
            {saving ? "Guardando…" : "Guardar registro"}
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
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [drawerUnidad, setDrawerUnidad] = useState<Unidad | null>(null);
  const [drawerExisting, setDrawerExisting] = useState<Seguro | undefined>();
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then((data) => setUnidades(filterByPlanta(data)));
    getCollectionDocs<Seguro>(COLLECTIONS.seguros).then((data) => setSeguros(filterByPlanta(data)));
  }, []);

  // Map unidadId → latest seguro (by vigenciaFin desc)
  const seguroByUnidad = useMemo(() => {
    const map = new Map<string, Seguro>();
    seguros.forEach((s) => {
      const ex = map.get(s.unidadId);
      if (!ex || (s.vigenciaFin || "") > (ex.vigenciaFin || "")) map.set(s.unidadId, s);
    });
    return map;
  }, [seguros]);

  // Standalone seguros (no matching unidad in DB — imported from Excel)
  const standaloneIds = useMemo(() => {
    const unitIds = new Set(unidades.map((u) => u.id));
    return seguros.filter((s) => s.unidadId && !unitIds.has(s.unidadId)).map((s) => s.id);
  }, [seguros, unidades]);

  // Merged rows
  const rows = useMemo(() => {
    const fromUnidades = unidades.map((u) => ({
      unidad: u,
      seguro: seguroByUnidad.get(u.id),
      status: vigenciaStatus(seguroByUnidad.get(u.id)?.vigenciaFin),
    }));
    // Also include standalone seguros (e.g. imported that have no unidad doc)
    const extra = seguros
      .filter((s) => standaloneIds.includes(s.id))
      .map((s) => ({
        unidad: null as unknown as Unidad,
        seguro: s,
        status: vigenciaStatus(s.vigenciaFin),
      }));
    return [...fromUnidades, ...extra];
  }, [unidades, seguroByUnidad, seguros, standaloneIds]);

  const tipos = useMemo(() => {
    const set = new Set(seguros.map((s) => s.tipoUnidad).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [seguros]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus !== "todos") list = list.filter((r) => r.status === filterStatus);
    if (filterTipo !== "Todos") list = list.filter((r) => r.seguro?.tipoUnidad === filterTipo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.unidad?.noEconomico ?? r.seguro?.noEconomico ?? "").toLowerCase().includes(q) ||
        (r.unidad?.placa ?? r.seguro?.placa ?? "").toLowerCase().includes(q) ||
        (r.unidad?.marca ?? r.seguro?.marca ?? "").toLowerCase().includes(q) ||
        (r.seguro?.aseguradora ?? "").toLowerCase().includes(q) ||
        (r.seguro?.noPoliza ?? "").toLowerCase().includes(q) ||
        (r.seguro?.agente ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filterStatus, filterTipo, search]);

  const total = rows.length;
  const vigentes = rows.filter((r) => r.status === "vigente").length;
  const porVencer = rows.filter((r) => r.status === "por_vencer").length;
  const sinCob = rows.filter((r) => r.status === "vencido" || r.status === "sin_registro").length;

  const handleSave = async (s: Seguro) => {
    const id = s.id!;
    await upsertDocument(COLLECTIONS.seguros, id, withPlantaTag({ ...s, id: undefined }));
    setSeguros((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      return idx >= 0 ? prev.map((x, i) => (i === idx ? s : x)) : [...prev, s];
    });
  };

  function openDrawer(unidad: Unidad | null, existing?: Seguro) {
    setDrawerUnidad(unidad);
    setDrawerExisting(existing);
    setShowDrawer(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Seguros de flota</h1>
          <p className="text-sm text-gray-500 mt-0.5">Catálogo maestro · Pólizas, tarjetas de circulación y valores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(seguros)}
            disabled={seguros.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={() => openDrawer(null)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            <Plus size={15} />
            Nuevo registro
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Unidades registradas" value={String(total)} icon={Shield} iconColor="text-blue-400" />
        <KPICard title="Pólizas vigentes" value={String(vigentes)} icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Por vencer ≤30 días" value={String(porVencer)} icon={Clock} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <KPICard title="Sin cobertura activa" value={String(sinCob)} icon={ShieldOff} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Placa, No. Eco, aseguradora, agente…"
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
            />
          </div>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
            {tipos.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as VigenciaStatus | "todos")}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
            <option value="todos">Todos los estatus</option>
            <option value="vigente">Vigente</option>
            <option value="por_vencer">Por vencer</option>
            <option value="vencido">Vencido</option>
            <option value="sin_registro">Sin registro</option>
          </select>
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} unidades</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {[
                  "Tipo","No. Eco.","Placa","Marca / Modelo","No. T.C.","Vence TC",
                  "Aseguradora / Agente","No. Póliza","Status póliza",
                  "Vence póliza","Días","Costo póliza","Valor mercado","Tenencia","",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-sm text-gray-600">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                filtered.map(({ unidad, seguro, status }) => {
                  const cfg = STATUS_VIG[status];
                  const dias = seguro?.vigenciaFin ? diasRestantes(seguro.vigenciaFin) : null;
                  const placa = unidad?.placa ?? seguro?.placa ?? "—";
                  const marca = unidad?.marca ?? seguro?.marca ?? "—";
                  const modelo = unidad?.modelo ?? seguro?.modelo ?? "";
                  const noEco = unidad?.noEconomico ?? seguro?.noEconomico ?? "—";
                  const tipo = seguro?.tipoUnidad ?? "—";
                  return (
                    <tr key={unidad?.id ?? seguro?.id} className="hover:bg-[#1A1F2B] transition-colors">
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{tipo}</td>
                      <td className="px-3 py-3 text-[#CC2229] font-mono text-xs font-semibold whitespace-nowrap">{noEco}</td>
                      <td className="px-3 py-3 text-gray-200 text-xs font-mono whitespace-nowrap">{placa}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-gray-200 text-xs">{marca}</p>
                        <p className="text-gray-600 text-[11px]">{modelo} {seguro?.anio ? `· ${seguro.anio}` : unidad?.anio ? `· ${unidad.anio}` : ""}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {seguro?.noTarjetaCirculacion || <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-[11px] whitespace-nowrap">
                        {seguro?.vigenciaTarjetaCirculacion || <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 max-w-[180px]">
                        <p className="text-gray-200 text-xs truncate">{seguro?.aseguradora || <span className="text-gray-700">—</span>}</p>
                        {seguro?.agente && <p className="text-gray-600 text-[11px] truncate">{seguro.agente}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {seguro?.noPoliza || <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {seguro?.statusPoliza ? (
                          <span className={`text-[11px] font-medium ${
                            seguro.statusPoliza === "Sin seguro" || seguro.statusPoliza === "Cancelada" ? "text-red-400"
                            : seguro.statusPoliza === "Cotizar" ? "text-amber-400"
                            : "text-gray-300"
                          }`}>{seguro.statusPoliza}</span>
                        ) : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {seguro?.vigenciaFin ? (
                          <p className={`text-[11px] font-medium ${
                            status === "vencido" ? "text-red-400"
                            : status === "por_vencer" ? "text-amber-400"
                            : "text-gray-300"
                          }`}>{seguro.vigenciaFin}</p>
                        ) : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {dias !== null ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                            {dias < 0 ? `−${Math.abs(dias)}d` : dias === 0 ? "Hoy" : `${dias}d`}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-300 text-[11px] tabular-nums whitespace-nowrap">
                        {seguro?.costoPoliza != null
                          ? `$${seguro.costoPoliza.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-300 text-[11px] tabular-nums whitespace-nowrap">
                        {seguro?.valorMercado != null
                          ? `$${seguro.valorMercado.toLocaleString("es-MX")}`
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-[11px] whitespace-nowrap">
                        {seguro?.tenencia || <span className="text-gray-700">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          onClick={() => openDrawer(unidad, seguro)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 hover:text-white bg-[#1A1A1A] hover:bg-[#252D3D] border border-[#3A3A3A] hover:border-[#CC2229]/40 rounded-lg transition-colors"
                        >
                          <Shield size={11} />
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

        {(porVencer > 0 || sinCob > 0) && (
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-gray-500">
              {porVencer > 0 && <span className="text-amber-400 font-medium">{porVencer} póliza{porVencer !== 1 ? "s" : ""} por vencer</span>}
              {porVencer > 0 && sinCob > 0 && " · "}
              {sinCob > 0 && <span className="text-red-400 font-medium">{sinCob} sin cobertura activa</span>}
            </p>
          </div>
        )}
      </div>

      <FormDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
        unidad={drawerUnidad}
        existing={drawerExisting}
        unidadesList={unidades}
      />
    </div>
  );
}
