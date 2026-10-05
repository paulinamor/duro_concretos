"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Download, FileText, Info, Link as LinkIcon, Pencil, Printer, Save, Search, Settings, Trash2, X,
} from "lucide-react";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import ModuleLoading from "@/components/ModuleLoading";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, getDocument, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import DuplicateWarningModal from "@/components/DuplicateWarningModal";
import { filterByPlanta, getActivePlanta, withPlantaTag } from "@/lib/auth";
import { todayCST, currentMonthCST } from "@/lib/dateUtils";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";
import { matchesQuery } from "@/lib/search";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  categoria?: string;
}

export interface RemisionDespacho {
  id?: string;
  tipo: "despacho";
  status?: "pendiente" | "creada";
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: number;
  monto?: number;
  mezcla: string;
  descripcion?: string;
  planta: "Allende" | "Pesquería";
  horaSalidaPlanta: string;
  operador: string;
  cr: string;
  unidad: string;
  recibidoPor: string;
  programacionId?: string;
  programacionFolio?: string;
  creadoEn: string;
  extras?: { codigo: string; descripcion?: string; volumen: number; precioM3: number; total: number }[];
  // Saldo — se gestiona desde Finanzas → Cobros
  pagado?: boolean;
  montoPagado?: number;
  fechaPago?: string;
  metodoPago?: string;
}

interface EmpresaInfo {
  nombre: string;
  direccion: string;
  cp: string;
  telefono: string;
  email: string;
}

const EMPRESA_DEFAULT: EmpresaInfo = {
  nombre: "DURO CONCRETOS",
  direccion: "LAZARO CARDENAS 2225 PISO3INT-B DEL VALLE ORIENTE",
  cp: "66260",
  telefono: "8120000852",
  email: "Ofertas@duroconcretos.com",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function currentMonth() { return currentMonthCST(); }

function inMonth(fecha: string, month: string) {
  if (!fecha) return false;
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    return `${y}-${m}`.startsWith(month);
  }
  return fecha.startsWith(month);
}

function monthLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function fechaLarga(fecha: string) {
  const [d, mo, y] = fecha.split("/");
  if (!d || !mo || !y) return fecha;
  return new Date(Number(y), Number(mo) - 1, Number(d))
    .toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function RemisionPDFContent({ r, emp }: { r: RemisionDespacho; emp: EmpresaInfo }) {
  return (
    <div className="font-sans text-[11px] leading-tight bg-white p-8">
      {/* Header empresa */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/DC_LOGO-removebg-preview.png" alt={emp.nombre} style={{ height: 64, objectFit: "contain" }} />
        <div className="text-right leading-relaxed">
          <p style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.05em" }}>{emp.nombre}</p>
          <p className="text-gray-600">{emp.direccion}</p>
          <p className="text-gray-600">C.P. {emp.cp}</p>
          <p className="text-gray-600">Tel. {emp.telefono}</p>
          <p className="text-gray-600">{emp.email}</p>
        </div>
      </div>

      {/* Título + número */}
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#374151" }}>
          Remisión
        </p>
        <div style={{ border: "2px solid #1f2937", padding: "4px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>No. Remisión</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: "#CC2229", lineHeight: 1 }}>{r.noRemision}</p>
        </div>
      </div>

      {/* Info general */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #1f2937" }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px", width: "55%" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Cliente</span><br />
              <span style={{ fontWeight: 600, fontSize: 12 }}>{r.cliente}</span>
            </td>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Fecha</span><br />
              <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{fechaLarga(r.fecha)}</span>
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }} colSpan={2}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Obra / Destino</span><br />
              <span style={{ fontWeight: 600, fontSize: 12 }}>{r.obra || "—"}</span>
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>m³ pedidos</span><br />
              <span>—</span>
            </td>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>m³ entregados</span><br />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{r.m3}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Producto */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #1f2937", borderTop: "none" }}>
        <thead>
          <tr style={{ backgroundColor: "#f3f4f6" }}>
            <th style={{ border: "1px solid #1f2937", padding: "6px 10px", textAlign: "left", fontWeight: 700, textTransform: "uppercase", fontSize: 9, width: 80 }}>Cantidad</th>
            <th style={{ border: "1px solid #1f2937", padding: "6px 10px", textAlign: "left", fontWeight: 700, textTransform: "uppercase", fontSize: 9, width: 150 }}>Código</th>
            <th style={{ border: "1px solid #1f2937", padding: "6px 10px", textAlign: "left", fontWeight: 700, textTransform: "uppercase", fontSize: 9 }}>Descripción</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "10px", fontWeight: 600 }}>{r.m3} m³</td>
            <td style={{ border: "1px solid #1f2937", padding: "10px", fontFamily: "monospace" }}>{r.mezcla || "—"}</td>
            <td style={{ border: "1px solid #1f2937", padding: "10px" }}>
              {r.descripcion || (r.mezcla ? `Concreto premezclado ${r.mezcla}` : "—")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Datos operativos */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #1f2937", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px", width: "50%" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Planta</span><br />
              <span style={{ fontWeight: 600 }}>{r.planta?.toUpperCase()}</span>
            </td>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Hora salida de planta</span><br />
              <span style={{ fontWeight: 600 }}>{r.horaSalidaPlanta || "—"}</span>
            </td>
          </tr>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Operador</span><br />
              <span style={{ fontWeight: 600 }}>{r.operador || "—"}</span>
            </td>
            <td style={{ border: "1px solid #1f2937", padding: "6px 10px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Unidad / CR</span><br />
              <span style={{ fontWeight: 600 }}>{r.cr || "—"}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Firmas */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #1f2937", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ border: "1px solid #1f2937", padding: "8px 10px 40px", width: "50%" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Entregó</span><br />
              <span style={{ fontWeight: 600 }}>{r.operador || "—"}</span>
              <div style={{ marginTop: 48, borderTop: "1px solid #9ca3af", width: 160 }} />
              <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Firma</p>
            </td>
            <td style={{ border: "1px solid #1f2937", padding: "8px 10px 40px" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 9, color: "#6b7280" }}>Recibió</span><br />
              <span style={{ fontWeight: 600 }}>{r.recibidoPor || r.cliente}</span>
              <div style={{ marginTop: 48, borderTop: "1px solid #9ca3af", width: 160 }} />
              <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Firma</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function adjMonth(p: string, delta: number): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── RemisionDrawer ───────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (r: RemisionDespacho) => Promise<void>;
  initial?: RemisionDespacho;
  completar?: boolean;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  crOptions: string[];
  productos: Producto[];
  nextNoRemision: string;
  defaultPlanta: "Allende" | "Pesquería";
}

interface ExtraItem { codigo: string; descripcion?: string; volumen: string; precioM3: string; }

interface FormState {
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: string;
  monto: string;
  mezcla: string;
  descripcion: string;
  planta: "Allende" | "Pesquería";
  operador: string;
  cr: string;
  recibidoPor: string;
  extras: ExtraItem[];
}

function RemisionDrawer({
  open, onClose, onSave, initial, completar, clientes, operadores, crOptions, productos, nextNoRemision, defaultPlanta,
}: DrawerProps) {
  // Campos que vienen de la programación — solo lectura si ya están vinculados
  const fromProg = !!(initial?.programacionId);
  const empty = (): FormState => ({
    noRemision: nextNoRemision,
    fecha: todayCST(),
    cliente: "",
    obra: "",
    m3: "",
    monto: "",
    mezcla: "",
    descripcion: "",
    planta: defaultPlanta,
    operador: "",
    cr: "",
    recibidoPor: "",
    extras: [],
  });

  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        noRemision: initial.noRemision,
        fecha: initial.fecha.includes("/")
          ? initial.fecha.split("/").reverse().join("-")
          : initial.fecha,
        cliente: initial.cliente,
        obra: initial.obra,
        m3: String(initial.m3),
        monto: initial.monto != null ? String(initial.monto) : "",
        mezcla: initial.mezcla,
        descripcion: initial.descripcion ?? "",
        planta: initial.planta,
        operador: initial.operador,
        cr: initial.cr,
        recibidoPor: initial.recibidoPor,
        extras: (initial.extras ?? []).map((e) => ({ codigo: e.codigo, descripcion: e.descripcion, volumen: String(e.volumen), precioM3: String(e.precioM3) })),
      });
    } else {
      setForm({ ...empty(), noRemision: nextNoRemision });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, nextNoRemision]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.noRemision.trim() || !form.m3) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        tipo: "despacho",
        status: completar ? "creada" : (initial?.status ?? "creada"),
        noRemision: form.noRemision.trim(),
        fecha: isoToDisplay(form.fecha),
        cliente: form.cliente.trim(),
        obra: form.obra.trim(),
        m3: parseFloat(form.m3) || 0,
        extras: form.extras
          .filter((e) => e.codigo && parseFloat(e.volumen) > 0)
          .map((e) => {
            const vol = parseFloat(e.volumen); const pm3 = parseFloat(e.precioM3) || 0;
            return { codigo: e.codigo, ...(e.descripcion ? { descripcion: e.descripcion } : {}), volumen: vol, precioM3: pm3, total: Math.round(vol * pm3 * 100) / 100 };
          }),
        ...(form.monto ? { monto: parseFloat(form.monto) } : {}),
        mezcla: form.mezcla.trim(),
        descripcion: form.descripcion.trim(),
        planta: form.planta,
        horaSalidaPlanta: initial?.horaSalidaPlanta ?? "",
        operador: form.operador,
        cr: form.cr,
        unidad: form.cr,
        recibidoPor: form.recibidoPor.trim(),
        ...(initial?.programacionId     ? { programacionId:     initial.programacionId }     : {}),
        ...(initial?.programacionFolio  ? { programacionFolio:  initial.programacionFolio }  : {}),
        creadoEn: initial?.creadoEn ?? new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {completar ? "Completar remisión" : initial ? "Editar remisión" : "Nueva remisión"}
            </h2>
            <p className="text-xs text-gray-500">Planta {form.planta}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Planta */}
          {/* Banner de vinculación */}
          {fromProg && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <LinkIcon size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                Vinculada a programación{initial?.programacionFolio ? ` ${initial.programacionFolio}` : ""}
                {" · "}Los datos en gris vienen de la programación
              </p>
            </div>
          )}

          {/* Planta — solo lectura si viene de programación */}
          <div>
            <label className={lbl}>Planta</label>
            {fromProg ? (
              <div className={inp + " bg-gray-50 text-gray-500 pointer-events-none"}>{form.planta}</div>
            ) : (
              <div className="flex gap-2">
                {(["Allende", "Pesquería"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => set("planta", p)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                      form.planta === p
                        ? "bg-[#CC2229] border-[#CC2229] text-white"
                        : "bg-white border-gray-200 text-gray-500 hover:border-[#CC2229]/40"
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label>
              <input type="text" inputMode="numeric" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value.replace(/\D/g, ""))} placeholder="20806" className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha {fromProg && <span className="text-gray-400 normal-case">(de programación)</span>}</label>
              <input type="date" value={form.fecha} readOnly={fromProg} onChange={fromProg ? undefined : (e) => set("fecha", e.target.value)}
                className={inp + (fromProg ? " bg-gray-50 text-gray-500 cursor-default" : "")} />
            </div>
          </div>

          {/* Cliente — solo lectura si viene de programación */}
          <div>
            <label className={lbl}>Cliente</label>
            {fromProg ? (
              <div className={inp + " bg-gray-50 text-gray-500"}>{form.cliente || "—"}</div>
            ) : (
              <AppSelect value={form.cliente} onChange={(e) => set("cliente", e.target.value)}>
                <option value="">Seleccionar cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.razonSocial}>
                    {c.nombreComercial || c.razonSocial}
                  </option>
                ))}
              </AppSelect>
            )}
          </div>

          {/* Obra — solo lectura si viene de programación */}
          <div>
            <label className={lbl}>Obra</label>
            {fromProg ? (
              <div className={inp + " bg-gray-50 text-gray-500"}>{form.obra || "—"}</div>
            ) : (
              <input type="text" value={form.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Nombre de la obra" className={inp} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* M³ — solo lectura si viene de programación */}
            <div>
              <label className={lbl}>M³ <span className="text-[#CC2229]">*</span></label>
              <input type="number" step="0.5" min="0" value={form.m3}
                readOnly={fromProg} onChange={fromProg ? undefined : (e) => set("m3", e.target.value)}
                placeholder="7.0" className={inp + (fromProg ? " bg-gray-50 text-gray-500 cursor-default" : "")} />
            </div>
            <div>
              <label className={lbl}>Monto $</label>
              <input type="number" step="0.01" min="0" value={form.monto} onChange={(e) => set("monto", e.target.value)} placeholder="0.00" className={inp} />
            </div>
          </div>

          {/* Producto / Mezcla — dropdown del catálogo */}
          <div>
            <label className={lbl}>Producto / Mezcla</label>
            <AppSelect value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)}>
              <option value="">— Seleccionar producto —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.codigo}>{p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}</option>
              ))}
              {/* Mantiene el valor existente si no está en el catálogo */}
              {form.mezcla && !productos.some((p) => p.codigo === form.mezcla) && (
                <option value={form.mezcla}>{form.mezcla}</option>
              )}
            </AppSelect>
          </div>

          <div>
            <label className={lbl}>Descripción</label>
            <textarea rows={2} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} className={inp + " resize-none"} />
          </div>

          {/* Productos adicionales */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={lbl + " mb-0"}>Productos adicionales</label>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, extras: [...p.extras, { codigo: "", descripcion: "", volumen: "", precioM3: "" }] }))}
                className="text-xs font-semibold text-[#CC2229] hover:text-[#B01E24] cursor-pointer transition-colors">
                + Agregar
              </button>
            </div>
            {form.extras.length === 0 && (
              <p className="text-xs text-gray-400 py-1">Sin productos adicionales</p>
            )}
            {form.extras.map((ex, i) => {
              const vol = parseFloat(ex.volumen) || 0;
              const pm3 = parseFloat(ex.precioM3) || 0;
              const total = vol * pm3;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_28px] gap-1.5 items-center">
                    <AppSelect value={ex.codigo}
                      onChange={(e) => {
                        const prod = productos.find((p) => p.codigo === e.target.value);
                        setForm((p) => { const ex2 = [...p.extras]; ex2[i] = { ...ex2[i], codigo: e.target.value, descripcion: prod?.descripcion ?? "" }; return { ...p, extras: ex2 }; });
                      }}>
                      <option value="">— Producto —</option>
                      {productos.map((p) => <option key={p.id} value={p.codigo}>{p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}</option>)}
                    </AppSelect>
                    <button type="button"
                      onClick={() => setForm((p) => ({ ...p, extras: p.extras.filter((_, j) => j !== i) }))}
                      className="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center pl-0">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">m³</span>
                      <input type="number" step="0.5" min="0" placeholder="Volumen" value={ex.volumen}
                        onChange={(e) => setForm((p) => { const ex2 = [...p.extras]; ex2[i] = { ...ex2[i], volumen: e.target.value }; return { ...p, extras: ex2 }; })}
                        className={inp + " pl-8"} />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$/m³</span>
                      <input type="number" step="0.01" min="0" placeholder="Precio" value={ex.precioM3}
                        onChange={(e) => setForm((p) => { const ex2 = [...p.extras]; ex2[i] = { ...ex2[i], precioM3: e.target.value }; return { ...p, extras: ex2 }; })}
                        className={inp + " pl-9"} />
                    </div>
                    <div className="text-sm font-semibold text-gray-700 tabular-nums whitespace-nowrap pr-1">
                      = ${total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Operador — solo lectura si viene de programación */}
          <div>
            <label className={lbl}>Operador</label>
            {fromProg ? (
              <div className={inp + " bg-gray-50 text-gray-500"}>{form.operador || "—"}</div>
            ) : (
              <AppSelect value={form.operador} onChange={(e) => set("operador", e.target.value)}>
                <option value="">Sin asignar</option>
                {operadores.map((o) => (
                  <option key={o.id} value={o.nombre}>{o.nombre}</option>
                ))}
              </AppSelect>
            )}
          </div>

          {/* CR — solo lectura si viene de programación */}
          <div>
            <label className={lbl}>CR</label>
            {fromProg ? (
              <div className={inp + " bg-gray-50 text-gray-500"}>{form.cr || "—"}</div>
            ) : (
              <AppSelect value={form.cr} onChange={(e) => set("cr", e.target.value)}>
                <option value="">— Sin CR —</option>
                {crOptions.map((cr) => (
                  <option key={cr} value={cr}>{cr}</option>
                ))}
                {form.cr && !crOptions.includes(form.cr) && (
                  <option value={form.cr}>{form.cr}</option>
                )}
              </AppSelect>
            )}
          </div>

          <div>
            <label className={lbl}>Recibido por</label>
            <input type="text" value={form.recibidoPor} onChange={(e) => set("recibidoPor", e.target.value)} placeholder="Nombre" className={inp} />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.noRemision.trim() || !form.m3}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            {saving ? "Guardando…" : completar ? "Completar remisión" : initial ? "Guardar cambios" : "Crear remisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemisionesPage() {
  const [remisiones, setRemisiones] = useState<RemisionDespacho[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadores, setOperadores] = useState<Pick<Operador, "id" | "nombre">[]>([]);
  const [crOptions, setCrOptions] = useState<string[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [plantaFilter, setPlantaFilter] = useState<"Todas" | "Allende" | "Pesquería">("Todas");
  const [filterStatus, setFilterStatus] = useState<"" | "creada" | "pendiente">("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RemisionDespacho | undefined>(undefined);
  const [completarMode, setCompletarMode] = useState(false);
  const [duplicateWarn, setDuplicateWarn] = useState<{ field: string; value: string; detail?: string; proceed: () => void } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemisionDespacho | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [printTarget, setPrintTarget] = useState<RemisionDespacho | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaInfo>(EMPRESA_DEFAULT);
  const [empresaModal, setEmpresaModal] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<EmpresaInfo>(EMPRESA_DEFAULT);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  const defaultPlanta = useMemo((): "Allende" | "Pesquería" => {
    const ap = getActivePlanta();
    return ap === "Pesquería" ? "Pesquería" : "Allende";
  }, []);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<RemisionDespacho>(COLLECTIONS.remisiones),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<Operador>(COLLECTIONS.operadores),
      getCollectionDocs<{ noEconomico?: string; tipoUnidad?: string }>(COLLECTIONS.seguros),
      getDocument<EmpresaInfo>(COLLECTIONS.configuracion, "empresa-remisiones").catch(() => null),
      getCollectionDocs<Producto>(COLLECTIONS.productos),
    ]).then(([remDocs, clienteDocs, operDocs, segurosDocs, empresaDoc, productoDocs]) => {
      setRemisiones(filterByPlanta(remDocs).filter((r) => r.tipo === "despacho"));
      setClientes(clienteDocs.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial })));
      setOperadores(operDocs.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre })));
      const crs = new Set<string>();
      segurosDocs.filter((d) => d.tipoUnidad === "Revolvedora" && d.noEconomico).forEach((d) => crs.add(d.noEconomico!));
      setCrOptions([...crs].sort());
      if (empresaDoc) { setEmpresa(empresaDoc); setEmpresaForm(empresaDoc); }
      setProductos(productoDocs.sort((a, b) => a.codigo.localeCompare(b.codigo)));
    }).finally(() => setLoading(false));
  }, []);

  // Migración una vez: calcula monto para remisiones vinculadas a programación que no lo tienen
  const migrationRan = useRef(false);
  useEffect(() => {
    if (loading || migrationRan.current) return;
    const sinMonto = remisiones.filter((r) => r.programacionId && (!r.monto || r.monto === 0));
    if (sinMonto.length === 0) { migrationRan.current = true; return; }
    migrationRan.current = true;

    type ProgMin = { precioM3?: number | null; precioM3Bomba?: number | null; aplicarFactorBomba?: boolean; factorBomba?: number | null; color?: string | null; ltoAcelr?: number | null; kiloFibra?: number | null; m3Imper?: number | null; permisosOC?: number | null };
    const calcPrecioXm3 = (p: ProgMin) => {
      const f = p.aplicarFactorBomba ? (p.factorBomba ?? 1) : 1;
      return (p.precioM3 ?? 0) * f + (p.precioM3Bomba ?? 0) * f + (parseFloat(String(p.color ?? "")) || 0) + (p.ltoAcelr ?? 0) + (p.kiloFibra ?? 0) + (p.m3Imper ?? 0) + (p.permisosOC ?? 0);
    };

    const uniqueProgIds = [...new Set(sinMonto.map((r) => r.programacionId!))];
    Promise.all(uniqueProgIds.map((id) => getDocument<ProgMin>(COLLECTIONS.programaciones, id).then((p) => ({ id, prog: p })).catch(() => null)))
      .then((results) => {
        const progMap = new Map(results.filter(Boolean).map((r) => [r!.id, r!.prog]));
        const updates = sinMonto.flatMap((r) => {
          const prog = progMap.get(r.programacionId!);
          if (!prog || !r.id) return [];
          const precioXm3 = calcPrecioXm3(prog);
          if (precioXm3 <= 0) return [];
          const monto = Math.round(precioXm3 * (r.m3 ?? 0) * 100) / 100;
          if (monto <= 0) return [];
          return [{ id: r.id, monto }];
        });
        if (updates.length === 0) return;
        return Promise.all(updates.map(({ id, monto }) => upsertDocument(COLLECTIONS.remisiones, id, { monto })))
          .then(() => setRemisiones((prev) => prev.map((r) => {
            const u = updates.find((u) => u.id === r.id);
            return u ? { ...r, monto: u.monto } : r;
          })));
      }).catch(console.error);
  }, [loading, remisiones]);

  const nextNoRemision = useMemo(() => {
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  const filtered = useMemo(() => {
    let rows = remisiones.filter((r) => inMonth(r.fecha, month));
    if (plantaFilter !== "Todas") rows = rows.filter((r) => r.planta === plantaFilter);
    if (filterStatus === "creada") rows = rows.filter((r) => r.status === "creada");
    else if (filterStatus === "pendiente") rows = rows.filter((r) => r.status !== "creada");
    if (search) {
      rows = rows.filter((r) =>
        matchesQuery(search, [r.noRemision, r.cliente, r.operador, r.cr])
      );
    }
    return [...rows].sort((a, b) => b.noRemision.localeCompare(a.noRemision, undefined, { numeric: true }));
  }, [remisiones, month, search, plantaFilter, filterStatus]);

  const totalM3 = useMemo(() => filtered.reduce((s, r) => s + (Number(r.m3) || 0), 0), [filtered]);
  const creadas = useMemo(() => filtered.filter((r) => r.status === "creada").length, [filtered]);
  const pendientes = filtered.length - creadas;

  function openPreview(r: RemisionDespacho) {
    setPrintTarget(r);
    setPreviewOpen(true);
  }

  function doPrint() {
    setPreviewOpen(false);
    setTimeout(() => window.print(), 80);
  }

  async function downloadPDF() {
    if (!previewRef.current || !printTarget) return;
    setGeneratingPDF(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height / canvas.width) * imgW;
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH > pageH ? pageH : imgH);
      pdf.save(`remision-${printTarget.noRemision}.pdf`);
    } finally {
      setGeneratingPDF(false);
    }
  }

  async function saveEmpresa() {
    setSavingEmpresa(true);
    try {
      await upsertDocument(COLLECTIONS.configuracion, "empresa-remisiones", empresaForm as Parameters<typeof upsertDocument>[2]);
      setEmpresa(empresaForm);
      setEmpresaModal(false);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Datos de empresa actualizados." } }));
    } finally {
      setSavingEmpresa(false);
    }
  }

  const handleSave = async (r: RemisionDespacho, force = false) => {
    if (!force && !r.id) {
      const dup = remisiones.find((x) => x.noRemision === r.noRemision);
      if (dup) {
        setDuplicateWarn({
          field: "Número de remisión",
          value: `Remisión ${r.noRemision}`,
          detail: `${dup.cliente ?? ""} — ${dup.fecha ?? ""}`.replace(/^ — | — $/, ""),
          proceed: () => { setDuplicateWarn(null); void handleSave(r, true); },
        });
        return;
      }
    }
    const id = r.id ?? `rem-desp-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    const tagged = withPlantaTag(data) as RemisionDespacho;
    try {
      await upsertDocument(COLLECTIONS.remisiones, id, tagged as Parameters<typeof upsertDocument>[2]);

      // Si el número de remisión cambió y está vinculada a una programación,
      // actualiza el reciboFolio en la programación para mantener sincronía
      const folioAnterior = editing?.noRemision;
      const folioCambio = r.id && r.programacionId && folioAnterior && folioAnterior !== r.noRemision;
      if (folioCambio) {
        await upsertDocument(COLLECTIONS.programaciones, r.programacionId!, { reciboFolio: r.noRemision });
      }

      setRemisiones((prev) => {
        const idx = prev.findIndex((x) => x.id === r.id);
        const updated = { ...tagged, id };
        return idx >= 0 ? prev.map((x, i) => (i === idx ? updated : x)) : [updated, ...prev];
      });
      const msg = folioCambio
        ? `Remisión actualizada: ${folioAnterior} → ${r.noRemision} · Folio sincronizado en programación`
        : `Remisión ${r.noRemision} guardada.`;
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: msg } }));
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al guardar la remisión. Verifica tu conexión." } }));
    }
  };

  const handleDelete = async (r: RemisionDespacho) => {
    if (!r.id) return;
    setDeleting(true);
    try {
      await deleteDocument(COLLECTIONS.remisiones, r.id);

      // Si estaba vinculada a una programación, limpia el reciboFolio para que
      // la programación quede libre de volver a generar una remisión
      if (r.programacionId) {
        await upsertDocument(COLLECTIONS.programaciones, r.programacionId, {
          reciboFolio: null,
        });
      }

      setRemisiones((prev) => prev.filter((x) => x.id !== r.id));
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `Remisión ${r.noRemision} eliminada${r.programacionId ? " · Vínculo con programación liberado" : ""}.` },
      }));
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al eliminar." } }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-remision, #printable-remision * { visibility: visible !important; }
          #printable-remision {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            min-height: 100vh !important;
            background: white !important;
            padding: 0.4in !important;
            color: black !important;
          }
          @page { size: letter portrait; margin: 0; }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <button onClick={() => setMonth(adjMonth(month, -1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">‹</button>
          <span className="text-gray-800 text-sm font-medium capitalize min-w-[140px] text-center py-2 select-none">{monthLabel(month)}</span>
          <button onClick={() => setMonth(adjMonth(month, +1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">›</button>
        </div>

        {/* Planta filter */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
          {(["Todas", "Allende", "Pesquería"] as const).map((p) => (
            <button key={p} onClick={() => setPlantaFilter(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all cursor-pointer ${plantaFilter === p ? "bg-[#CC2229] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}>
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setEmpresaForm(empresa); setEmpresaModal(true); }}
            title="Datos de empresa para PDF"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <Settings size={14} /> Empresa
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total remisiones" value={String(filtered.length)} icon={FileText} iconColor="text-[#CC2229]" subtitle={monthLabel(month)} active={filterStatus === ""} onClick={() => setFilterStatus("")} />
        <KPICard title="M³ totales" value={totalM3.toFixed(1)} icon={FileText} iconColor="text-sky-500" iconBg="bg-sky-500/10" subtitle={`Promedio ${filtered.length ? (totalM3 / filtered.length).toFixed(1) : "0"} m³`} active={filterStatus === ""} onClick={() => setFilterStatus("")} />
        <KPICard title="Creadas" value={String(creadas)} icon={FileText} iconColor="text-emerald-500" iconBg="bg-emerald-500/10" subtitle="Remisiones completadas" active={filterStatus === "creada"} onClick={() => setFilterStatus("creada")} />
        <KPICard title="Pendientes" value={String(pendientes)} icon={FileText} iconColor={pendientes > 0 ? "text-amber-500" : "text-gray-400"} iconBg={pendientes > 0 ? "bg-amber-500/10" : "bg-gray-500/10"} subtitle="Pendientes de completar" active={filterStatus === "pendiente"} onClick={() => setFilterStatus("pendiente")} />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading && <ModuleLoading label="Cargando remisiones…" />}
        {!loading && (<>
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-gray-900">
            {filtered.length} {filtered.length !== 1 ? "remisiones" : "remisión"}
          </p>
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="No. remisión, cliente, operador…"
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg pl-7 pr-8 py-1.5 w-64 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Fecha", "No. Remisión", "Cliente", "Obra", "M³", "Monto", "Mezcla", "CR", "Estado", "Pago", ""].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">Sin remisiones para este período</p>
                      <p className="text-xs text-gray-400">Las remisiones se generan automáticamente desde Programación</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id ?? r.noRemision} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">{r.fecha}</td>
                    <td className="px-3 py-3 text-[#CC2229] font-mono text-xs font-bold">{r.noRemision}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs font-medium max-w-[130px] truncate">{r.cliente || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs max-w-[100px] truncate">{r.obra || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3 text-gray-900 font-bold tabular-nums text-xs whitespace-nowrap">{r.m3} m³</td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-gray-900 text-xs whitespace-nowrap">
                      {r.monto ? `$${r.monto.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {r.mezcla
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">{r.mezcla}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs font-mono">{r.cr || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3">
                      {r.status === "creada"
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">Creada</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">Pendiente</span>}
                    </td>
                    <td className="px-3 py-3">
                      {r.pagado
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 border border-green-200 text-green-700">Saldada</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">Pendiente</span>}
                    </td>
                    <td className="px-3 py-3 flex items-center gap-1.5">
                      {r.status !== "creada" ? (
                        <button
                          onClick={() => { setEditing(r); setCompletarMode(true); setDrawerOpen(true); }}
                          title="Completar remisión"
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-lg transition-colors cursor-pointer"
                        >
                          Completar
                        </button>
                      ) : (
                        <button
                          onClick={() => { setEditing(r); setCompletarMode(false); setDrawerOpen(true); }}
                          title="Editar remisión"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => openPreview(r)}
                        title="Vista previa / PDF"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        title="Eliminar remisión"
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>)}
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-blue-700">
          <span className="font-semibold">Vinculación con programación:</span> Al registrar una remisión en{" "}
          <Link href="/transporte/programacion" className="underline hover:text-blue-900">Transporte → Programación</Link>,
          la remisión queda vinculada automáticamente a la carga correspondiente.
        </p>
      </div>

      <RemisionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(undefined); setCompletarMode(false); }}
        onSave={handleSave}
        initial={editing}
        completar={completarMode}
        clientes={clientes}
        operadores={operadores}
        crOptions={crOptions}
        productos={productos}
        nextNoRemision={nextNoRemision}
        defaultPlanta={defaultPlanta}
      />

      {/* ── Empresa modal ────────────────────────────────────────────────────── */}
      {empresaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEmpresaModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10">
                <Settings size={17} className="text-[#CC2229]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Datos de empresa</h2>
                <p className="text-xs text-gray-500">Se usan en el encabezado del PDF de remisión</p>
              </div>
              <button onClick={() => setEmpresaModal(false)} className="ml-auto p-2 rounded-xl text-gray-400 hover:bg-gray-100 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {([
                ["nombre", "Nombre de empresa"],
                ["direccion", "Dirección"],
                ["cp", "Código postal"],
                ["telefono", "Teléfono"],
                ["email", "Correo electrónico"],
              ] as [keyof EmpresaInfo, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className={lbl}>{label}</label>
                  <input
                    type="text"
                    value={empresaForm[field]}
                    onChange={(e) => setEmpresaForm((p) => ({ ...p, [field]: e.target.value }))}
                    className={inp}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setEmpresaModal(false)} className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={saveEmpresa}
                disabled={savingEmpresa}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                {savingEmpresa ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista previa + descarga PDF ─────────────────────────────────────── */}
      {previewOpen && printTarget && (
        <div className="fixed inset-0 z-[300] flex flex-col print:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewOpen(false)} />

          {/* Toolbar */}
          <div className="relative z-10 flex items-center justify-between px-6 py-3 bg-[#1A1A1A] border-b border-[#3A3A3A] shrink-0">
            <p className="text-sm font-semibold text-white">
              Vista previa — Remisión <span className="text-[#CC2229]">{printTarget.noRemision}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={doPrint}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg hover:border-gray-500 transition-colors cursor-pointer"
              >
                <Printer size={14} /> Imprimir
              </button>
              <button
                onClick={downloadPDF}
                disabled={generatingPDF}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                <Download size={14} />
                {generatingPDF ? "Generando…" : "Descargar PDF"}
              </button>
              <button onClick={() => setPreviewOpen(false)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Paper preview */}
          <div className="relative z-10 flex-1 overflow-y-auto py-8 flex justify-center">
            <div
              ref={previewRef}
              className="w-[780px] shadow-2xl"
              style={{ background: "white" }}
            >
              <RemisionPDFContent r={printTarget} emp={empresa} />
            </div>
          </div>
        </div>
      )}

      {duplicateWarn && (
        <DuplicateWarningModal
          field={duplicateWarn.field}
          value={duplicateWarn.value}
          detail={duplicateWarn.detail}
          onCancel={() => setDuplicateWarn(null)}
          onConfirm={duplicateWarn.proceed}
        />
      )}

      {/* ── Modal confirmar eliminación ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-3">
              <Trash2 size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Eliminar remisión {deleteTarget.noRemision}</p>
                <p className="text-xs text-gray-500 mt-1">{deleteTarget.cliente} · {deleteTarget.fecha}</p>
                {deleteTarget.programacionId && (
                  <p className="text-xs text-amber-700 mt-2 font-medium">
                    Esta remisión está vinculada a una programación. El vínculo se liberará para que puedas generar una nueva remisión.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors font-medium disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <><Trash2 size={14} className="animate-pulse" /> Eliminando…</> : <><Trash2 size={14} /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden div for window.print() ────────────────────────────────────── */}
      <div
        id="printable-remision"
        ref={printRef}
        className="fixed -left-[9999px] top-0 w-[780px] bg-white text-black print:static print:left-auto print:top-auto print:w-auto"
      >
        {printTarget && <RemisionPDFContent r={printTarget} emp={empresa} />}
      </div>
    </div>
  );
}
