"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X,
} from "lucide-react";
import ExcelView from "@/app/(dashboard)/transporte/programacion/ExcelView";
import type { ExcelProg } from "@/app/(dashboard)/transporte/programacion/ExcelView";
import ClienteCombobox from "@/components/ClienteCombobox";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Cliente } from "@/lib/crmClientes";

// ─── Types ────────────────────────────────────────────────────────────────────

type Programacion = ExcelProg & {
  factorBomba?: number | null;
  aplicarFactorBomba?: boolean;
  aditivo?: string;
  credito?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, d: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function addMonths(iso: string, m: number) {
  const dt = new Date(iso + "T12:00:00");
  dt.setMonth(dt.getMonth() + m);
  return dt.toISOString().slice(0, 10);
}

function weekRange(iso: string): [string, string] {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function periodLabel(mode: "dia" | "semana" | "mes", anchor: string) {
  if (mode === "dia")
    return new Date(anchor + "T12:00:00").toLocaleDateString("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  if (mode === "semana") {
    const [s, e] = weekRange(anchor);
    const fmt = (iso: string) =>
      new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    return `${fmt(s)} – ${fmt(e)} ${new Date(e + "T12:00:00").getFullYear()}`;
  }
  return new Date(anchor + "T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function n(v: string): number | null {
  const p = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(p) ? null : p;
}

// ─── Ventas form state ────────────────────────────────────────────────────────

type VForm = {
  dia: string;
  vendedor: string;
  cliente: string;
  telefono: string;
  direccion: string;
  paraUso: string;
  resistencia: string;
  tdBom: string;
  color: string;
  precioM3: string;
  precioM3Bomba: string;
  ltoAcelr: string;
  kiloFibra: string;
  m3Imper: string;
  tuberiaExtra: string;
  permisosOC: string;
  extras: string;
  recibo: string;
  fact: string;
  pagado: string;
  montoPagado: string;
  metodoPago: string;
  fechaPago: string;
  diaHoraPedido: string;
};

function emptyVForm(dia: string): VForm {
  return {
    dia, vendedor: "", cliente: "", telefono: "", direccion: "", paraUso: "",
    resistencia: "", tdBom: "", color: "", precioM3: "", precioM3Bomba: "",
    ltoAcelr: "", kiloFibra: "", m3Imper: "", tuberiaExtra: "", permisosOC: "",
    extras: "", recibo: "", fact: "", pagado: "", montoPagado: "", metodoPago: "",
    fechaPago: "", diaHoraPedido: "",
  };
}

function vformFromProg(p: Programacion): VForm {
  return {
    dia: p.dia,
    vendedor: p.vendedor,
    cliente: p.cliente,
    telefono: p.telefono,
    direccion: p.direccion,
    paraUso: p.paraUso,
    resistencia: p.resistencia,
    tdBom: p.tdBom,
    color: p.color,
    precioM3: p.precioM3 != null ? String(p.precioM3) : "",
    precioM3Bomba: p.precioM3Bomba != null ? String(p.precioM3Bomba) : "",
    ltoAcelr: p.ltoAcelr != null ? String(p.ltoAcelr) : "",
    kiloFibra: p.kiloFibra != null ? String(p.kiloFibra) : "",
    m3Imper: p.m3Imper != null ? String(p.m3Imper) : "",
    tuberiaExtra: p.tuberiaExtra != null ? String(p.tuberiaExtra) : "",
    permisosOC: p.permisosOC != null ? String(p.permisosOC) : "",
    extras: p.extras,
    recibo: p.recibo,
    fact: p.fact,
    pagado: p.pagado,
    montoPagado: p.montoPagado != null ? String(p.montoPagado) : "",
    metodoPago: p.metodoPago,
    fechaPago: p.fechaPago,
    diaHoraPedido: p.diaHoraPedido,
  };
}

// ─── VentasDrawer ─────────────────────────────────────────────────────────────

function VentasDrawer({
  open,
  prog,
  clientesList,
  onClose,
  onSave,
}: {
  open: boolean;
  prog: Programacion | null;
  clientesList: string[];
  onClose: () => void;
  onSave: (data: Partial<Programacion>, id?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<VForm>(emptyVForm(todayISO()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(prog ? vformFromProg(prog) : emptyVForm(todayISO()));
    }
  }, [open, prog]);

  function set(k: keyof VForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function showToast(type: "success" | "error", title: string, msg: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message: msg } }));
  }

  async function handleSave() {
    if (!form.cliente.trim()) {
      showToast("error", "Cliente requerido", "Selecciona o escribe el nombre del cliente.");
      return;
    }
    if (!form.dia) {
      showToast("error", "Fecha requerida", "Selecciona la fecha de la programación.");
      return;
    }
    setSaving(true);
    try {
      const ventasData: Partial<Programacion> = {
        dia: form.dia,
        vendedor: form.vendedor.trim(),
        diaHoraPedido: form.diaHoraPedido,
        cliente: form.cliente.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        paraUso: form.paraUso.trim(),
        resistencia: form.resistencia.trim(),
        tdBom: form.tdBom.trim(),
        color: form.color.trim(),
        extras: form.extras.trim(),
        precioM3: n(form.precioM3),
        precioM3Bomba: n(form.precioM3Bomba),
        ltoAcelr: n(form.ltoAcelr),
        kiloFibra: n(form.kiloFibra),
        m3Imper: n(form.m3Imper),
        tuberiaExtra: n(form.tuberiaExtra),
        permisosOC: n(form.permisosOC),
        recibo: form.recibo.trim(),
        fact: form.fact.trim(),
        pagado: form.pagado.trim(),
        montoPagado: form.pagado === "Parcial" ? (n(form.montoPagado) ?? null) : null,
        metodoPago: form.metodoPago.trim(),
        fechaPago: form.fechaPago,
      };
      await onSave(ventasData, prog?.id);
      onClose();
    } catch {
      showToast("error", "Error", "No se pudo guardar. Verifica tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const lbl = "block text-sm text-gray-600 mb-1 font-medium";
  const inp = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]";
  const sel = `${inp} cursor-pointer`;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {prog ? "Editar datos de venta" : "Nuevo pedido — Ventas"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Solo campos de ventas — logística la llena el equipo de despacho</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Identificación */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Día <span className="text-[#CC2229]">*</span></label>
                <input type="date" value={form.dia} onChange={(e) => set("dia", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Vendedor</label>
                <input value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} placeholder="Nombre" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Día y hora de pedido</label>
                <div className="flex gap-2">
                  {form.diaHoraPedido === "N/A" ? (
                    <div className={`${inp} flex-1 text-gray-400 bg-gray-50 cursor-default`}>N/A</div>
                  ) : (
                    <input type="datetime-local" value={form.diaHoraPedido} onChange={(e) => set("diaHoraPedido", e.target.value)} className={`${inp} flex-1`} />
                  )}
                  <button
                    type="button"
                    onClick={() => set("diaHoraPedido", form.diaHoraPedido === "N/A" ? "" : "N/A")}
                    className={`shrink-0 px-2.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${form.diaHoraPedido === "N/A" ? "bg-gray-200 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                  >
                    N/A
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <ClienteCombobox
                  label="Cliente"
                  required
                  value={form.cliente}
                  onChange={(v) => set("cliente", v)}
                  options={clientesList}
                  placeholder="Buscar o escribir cliente…"
                />
              </div>
              <div>
                <label className={lbl}>Teléfono</label>
                <input type="tel" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="81 0000 0000" className={inp} />
              </div>
              <div>
                <label className={lbl}>Para uso</label>
                <input value={form.paraUso} onChange={(e) => set("paraUso", e.target.value)} placeholder="Losa, zapata…" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Dirección</label>
                <input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Dirección de obra" className={inp} />
              </div>
            </div>
          </div>

          {/* Concreto */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">Concreto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Resistencia</label>
                <input value={form.resistencia} onChange={(e) => set("resistencia", e.target.value)} placeholder="200-20-14" className={inp} />
              </div>
              <div>
                <label className={lbl}>T/D BOM</label>
                <input value={form.tdBom} onChange={(e) => set("tdBom", e.target.value)} placeholder="T/D, BOMBA…" className={inp} />
              </div>
              <div>
                <label className={lbl}>Color</label>
                <input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div>
                <label className={lbl}>Extras</label>
                <input value={form.extras} onChange={(e) => set("extras", e.target.value)} placeholder="Fibra, impermeabilizante…" className={inp} />
              </div>
            </div>
          </div>

          {/* Precios */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">Precios</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Precio M3", key: "precioM3" as const },
                { label: "$ M3 Bomba", key: "precioM3Bomba" as const },
                { label: "$ Lto Acelr", key: "ltoAcelr" as const },
                { label: "$ Kilo Fibra", key: "kiloFibra" as const },
                { label: "$ M3 Imper", key: "m3Imper" as const },
                { label: "Tubería extra", key: "tuberiaExtra" as const },
                { label: "Permisos O/C", key: "permisosOC" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className={lbl}>{label}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder="0.00"
                    className={inp}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pago */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 pb-2 border-b border-gray-100">Facturación y pago</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Recibo</label>
                <input value={form.recibo} onChange={(e) => set("recibo", e.target.value)} placeholder="R001" className={inp} />
              </div>
              <div>
                <label className={lbl}>Factura</label>
                <input value={form.fact} onChange={(e) => set("fact", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div>
                <label className={lbl}>Pagado</label>
                <select value={form.pagado} onChange={(e) => set("pagado", e.target.value)} className={sel}>
                  <option value="">—</option>
                  <option>Sí</option>
                  <option>Parcial</option>
                  <option>No</option>
                </select>
              </div>
              {form.pagado === "Parcial" && (
                <div>
                  <label className={lbl}>Monto pagado</label>
                  <input type="number" step="0.01" value={form.montoPagado} onChange={(e) => set("montoPagado", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                </div>
              )}
              <div>
                <label className={lbl}>Método de pago</label>
                <select value={form.metodoPago} onChange={(e) => set("metodoPago", e.target.value)} className={sel}>
                  <option value="">—</option>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Fecha de pago</label>
                <input type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <CalendarDays size={14} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VentasProgramacionPage() {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [clientesList, setClientesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaActivo, setDiaActivo] = useState(todayISO);
  const [viewMode, setViewMode] = useState<"dia" | "semana" | "mes">("mes");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Programacion | null>(null);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Programacion>(COLLECTIONS.programaciones),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
    ]).then(([progs, clientes]) => {
      setProgramaciones(filterByPlanta(progs));
      const fromProgs = progs.map((p) => p.cliente).filter(Boolean);
      const fromClientes = clientes.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean));
      setClientesList(Array.from(new Set([...fromClientes, ...fromProgs])).sort());
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list: Programacion[];
    if (viewMode === "dia") {
      list = programaciones.filter((p) => p.dia === diaActivo);
    } else if (viewMode === "semana") {
      const [s, e] = weekRange(diaActivo);
      list = programaciones.filter((p) => (p.dia ?? "") >= s && (p.dia ?? "") <= e);
    } else {
      const mesKey = diaActivo.slice(0, 7);
      list = programaciones.filter((p) => (p.dia ?? "").startsWith(mesKey));
    }
    return list.sort((a, b) => {
      const dc = (a.dia ?? "").localeCompare(b.dia ?? "");
      return dc !== 0 ? dc : (a.hora ?? "").localeCompare(b.hora ?? "");
    });
  }, [programaciones, diaActivo, viewMode]);

  async function handleSave(data: Partial<Programacion>, existingId?: string) {
    if (existingId) {
      // Edit: merge ventas fields into existing programación
      const current = programaciones.find((p) => p.id === existingId);
      if (!current) return;
      const { id: _id, ...rest } = current;
      const merged = { ...rest, ...data };
      await upsertDocument(COLLECTIONS.programaciones, existingId, withPlantaTag(merged));
      setProgramaciones((prev) => prev.map((p) => p.id === existingId ? { ...p, ...data } : p));
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Guardado", message: "Datos de venta actualizados." } }));
    } else {
      // New: create programación with ventas fields, logistics empty
      const id = `prog-v-${Date.now()}`;
      const newProg: Programacion = {
        ...data,
        dia: data.dia ?? todayISO(),
        vendedor: data.vendedor ?? "",
        diaHoraPedido: data.diaHoraPedido ?? "",
        muestras: "",
        cliente: data.cliente ?? "",
        telefono: data.telefono ?? "",
        direccion: data.direccion ?? "",
        paraUso: data.paraUso ?? "",
        hora: "",
        hsr: "",
        choferes: [],
        tiempoExtraDescarga: "",
        m3Totales: null,
        extras: data.extras ?? "",
        tdBom: data.tdBom ?? "",
        resistencia: data.resistencia ?? "",
        color: data.color ?? "",
        m3Vacios: null,
        precioM3: data.precioM3 ?? null,
        precioM3Bomba: data.precioM3Bomba ?? null,
        ltoAcelr: data.ltoAcelr ?? null,
        kiloFibra: data.kiloFibra ?? null,
        m3Imper: data.m3Imper ?? null,
        tuberiaExtra: data.tuberiaExtra ?? null,
        permisosOC: data.permisosOC ?? null,
        totalXM3: null,
        total: null,
        recibo: data.recibo ?? "",
        fact: data.fact ?? "",
        pagado: data.pagado ?? "",
        montoPagado: data.montoPagado ?? null,
        metodoPago: data.metodoPago ?? "",
        fechaPago: data.fechaPago ?? "",
        id,
      };
      await upsertDocument(COLLECTIONS.programaciones, id, withPlantaTag(newProg));
      setProgramaciones((prev) => [newProg, ...prev]);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Pedido creado", message: `${data.cliente} — esperando asignación de despacho.` } }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">Ventas</p>
        <p className="text-gray-500 text-sm mt-0.5">
          Captura pedidos y datos de venta. El equipo de despacho completa la logística.
        </p>
      </div>

      {/* Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          {(["dia", "semana", "mes"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === m ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
            >
              {m === "dia" ? "Día" : m === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (viewMode === "dia") setDiaActivo((d) => addDays(d, -1));
              else if (viewMode === "semana") setDiaActivo((d) => addDays(d, -7));
              else setDiaActivo((d) => addMonths(d, -1));
            }}
            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
          {viewMode === "dia" ? (
            <input
              type="date"
              value={diaActivo}
              onChange={(e) => setDiaActivo(e.target.value)}
              className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          ) : (
            <span className="text-sm text-white font-medium px-1 capitalize">
              {periodLabel(viewMode, diaActivo)}
            </span>
          )}
          <button
            onClick={() => {
              if (viewMode === "dia") setDiaActivo((d) => addDays(d, 1));
              else if (viewMode === "semana") setDiaActivo((d) => addDays(d, 7));
              else setDiaActivo((d) => addMonths(d, 1));
            }}
            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => setDiaActivo(todayISO())}
            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Hoy
          </button>

          <button
            onClick={() => { setEditing(null); setShowDrawer(true); }}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            <Plus size={15} />
            Nuevo pedido
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex items-center gap-4 text-sm">
        <div className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2.5 flex items-center gap-2">
          <span className="text-gray-500 text-xs">Pedidos</span>
          <span className="text-white font-semibold">{filtered.length}</span>
        </div>
        <div className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2.5 flex items-center gap-2">
          <span className="text-gray-500 text-xs">Pagados</span>
          <span className="text-emerald-400 font-semibold">{filtered.filter((p) => p.pagado === "Sí").length}</span>
        </div>
        <div className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2.5 flex items-center gap-2">
          <span className="text-gray-500 text-xs">M³ totales</span>
          <span className="text-white font-semibold">
            {filtered.reduce((s, p) => s + (p.m3Totales ?? 0), 0).toLocaleString("es-MX")} m³
          </span>
        </div>
        <div className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2.5 flex items-center gap-2">
          <span className="text-gray-500 text-xs">Facturado</span>
          <span className="text-white font-semibold">
            {filtered.reduce((s, p) => s + (p.total ?? 0), 0) > 0
              ? `$${filtered.reduce((s, p) => s + (p.total ?? 0), 0).toLocaleString("es-MX")}`
              : "—"}
          </span>
        </div>
      </div>

      {/* Excel view */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600 text-sm">Cargando…</div>
      ) : (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <ExcelView
            rows={filtered}
            onEdit={(p) => { setEditing(p as unknown as Programacion); setShowDrawer(true); }}
          />
        </div>
      )}

      <VentasDrawer
        open={showDrawer}
        prog={editing}
        clientesList={clientesList}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
      />
    </div>
  );
}
