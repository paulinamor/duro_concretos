"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Download, FileText, Info, Link as LinkIcon, Printer, Save, Search, Settings, X,
} from "lucide-react";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, getDocument, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, getActivePlanta, withPlantaTag } from "@/lib/auth";
import { todayCST, currentMonthCST } from "@/lib/dateUtils";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemisionDespacho {
  id?: string;
  tipo: "despacho";
  status?: "pendiente" | "creada";
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: number;
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
  nextNoRemision: string;
  defaultPlanta: "Allende" | "Pesquería";
}

interface FormState {
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: string;
  mezcla: string;
  descripcion: string;
  planta: "Allende" | "Pesquería";
  horaSalidaPlanta: string;
  operador: string;
  cr: string;
  recibidoPor: string;
}

function RemisionDrawer({
  open, onClose, onSave, initial, completar, clientes, operadores, crOptions, nextNoRemision, defaultPlanta,
}: DrawerProps) {
  const empty = (): FormState => ({
    noRemision: nextNoRemision,
    fecha: todayCST(),
    cliente: "",
    obra: "",
    m3: "",
    mezcla: "",
    descripcion: "",
    planta: defaultPlanta,
    horaSalidaPlanta: "",
    operador: "",
    cr: "",
    recibidoPor: "",
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
        mezcla: initial.mezcla,
        descripcion: initial.descripcion ?? "",
        planta: initial.planta,
        horaSalidaPlanta: initial.horaSalidaPlanta,
        operador: initial.operador,
        cr: initial.cr,
        recibidoPor: initial.recibidoPor,
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
        mezcla: form.mezcla.trim(),
        descripcion: form.descripcion.trim(),
        planta: form.planta,
        horaSalidaPlanta: form.horaSalidaPlanta,
        operador: form.operador,
        cr: form.cr,
        unidad: form.cr,
        recibidoPor: form.recibidoPor.trim(),
        programacionId: initial?.programacionId,
        programacionFolio: initial?.programacionFolio,
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
          <div>
            <label className={lbl}>Planta</label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label>
              <input type="text" inputMode="numeric" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value.replace(/\D/g, ""))} placeholder="20806" className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className={lbl}>Cliente</label>
            <AppSelect value={form.cliente} onChange={(e) => set("cliente", e.target.value)}>
              <option value="">Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.razonSocial}>
                  {c.nombreComercial || c.razonSocial}
                </option>
              ))}
            </AppSelect>
          </div>

          <div>
            <label className={lbl}>Obra</label>
            <input type="text" value={form.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Nombre de la obra" className={inp} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>M³ <span className="text-[#CC2229]">*</span></label>
              <input type="number" step="0.5" min="0" value={form.m3} onChange={(e) => set("m3", e.target.value)} placeholder="7.0" className={inp} />
            </div>
            <div>
              <label className={lbl}>Código / Mezcla</label>
              <input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="F'C 200N2014R28D" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Descripción</label>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}

              className={inp + " resize-none"}
            />
          </div>

          <div>
            <label className={lbl}>Hora de salida de planta</label>
            <input type="time" value={form.horaSalidaPlanta} onChange={(e) => set("horaSalidaPlanta", e.target.value)} className={inp} />
          </div>

          {/* Operador */}
          <div>
            <label className={lbl}>Operador</label>
            <AppSelect value={form.operador} onChange={(e) => set("operador", e.target.value)}>
              <option value="">Sin asignar</option>
              {operadores.map((o) => (
                <option key={o.id} value={o.nombre}>{o.nombre}</option>
              ))}
            </AppSelect>
          </div>

          {/* CR */}
          <div>
            <label className={lbl}>CR</label>
            <AppSelect value={form.cr} onChange={(e) => set("cr", e.target.value)}>
              <option value="">— Sin CR —</option>
              {crOptions.map((cr) => (
                <option key={cr} value={cr}>{cr}</option>
              ))}
              {form.cr && !crOptions.includes(form.cr) && (
                <option value={form.cr}>{form.cr}</option>
              )}
            </AppSelect>
          </div>

          <div>
            <label className={lbl}>Recibido por</label>
            <input type="text" value={form.recibidoPor} onChange={(e) => set("recibidoPor", e.target.value)} placeholder="Nombre" className={inp} />
          </div>

          {initial?.programacionId && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <LinkIcon size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                Vinculada a programación{initial.programacionFolio ? ` ${initial.programacionFolio}` : ""}
              </p>
            </div>
          )}
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

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [plantaFilter, setPlantaFilter] = useState<"Todas" | "Allende" | "Pesquería">("Todas");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RemisionDespacho | undefined>(undefined);
  const [completarMode, setCompletarMode] = useState(false);
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
    getCollectionDocs<RemisionDespacho>(COLLECTIONS.remisiones).then((docs) => {
      const despacho = filterByPlanta(docs).filter((r) => r.tipo === "despacho");
      setRemisiones(despacho);
    });
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((docs) =>
      setClientes(docs.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial })))
    );
    getCollectionDocs<Operador>(COLLECTIONS.operadores).then((docs) =>
      setOperadores(docs.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre })))
    );
    getCollectionDocs<{ noEconomico?: string; tipoUnidad?: string }>(COLLECTIONS.seguros).then((docs) => {
      const crs = new Set<string>();
      docs
        .filter((d) => d.tipoUnidad === "Revolvedora" && d.noEconomico)
        .forEach((d) => crs.add(d.noEconomico!));
      setCrOptions([...crs].sort());
    });
    getDocument<EmpresaInfo>(COLLECTIONS.configuracion, "empresa-remisiones").then((doc) => {
      if (doc) { setEmpresa(doc); setEmpresaForm(doc); }
    }).catch(() => {});
  }, []);

  const nextNoRemision = useMemo(() => {
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  const filtered = useMemo(() => {
    let rows = remisiones.filter((r) => inMonth(r.fecha, month));
    if (plantaFilter !== "Todas") rows = rows.filter((r) => r.planta === plantaFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.noRemision.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.operador.toLowerCase().includes(q) ||
        r.cr.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => b.noRemision.localeCompare(a.noRemision, undefined, { numeric: true }));
  }, [remisiones, month, search, plantaFilter]);

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

  const handleSave = async (r: RemisionDespacho) => {
    const id = r.id ?? `rem-desp-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    const tagged = withPlantaTag(data) as RemisionDespacho;
    await upsertDocument(COLLECTIONS.remisiones, id, tagged as Parameters<typeof upsertDocument>[2]);
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...tagged, id };
      return idx >= 0 ? prev.map((x, i) => (i === idx ? updated : x)) : [updated, ...prev];
    });
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Remisión ${r.noRemision} guardada.` } }));
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
        <KPICard title="Total remisiones" value={String(filtered.length)} icon={FileText} iconColor="text-[#CC2229]" subtitle={monthLabel(month)} />
        <KPICard title="M³ totales" value={totalM3.toFixed(1)} icon={FileText} iconColor="text-sky-500" iconBg="bg-sky-500/10" subtitle={`Promedio ${filtered.length ? (totalM3 / filtered.length).toFixed(1) : "0"} m³`} />
        <KPICard title="Creadas" value={String(creadas)} icon={FileText} iconColor="text-emerald-500" iconBg="bg-emerald-500/10" subtitle="Remisiones completadas" />
        <KPICard title="Pendientes" value={String(pendientes)} icon={FileText} iconColor={pendientes > 0 ? "text-amber-500" : "text-gray-400"} iconBg={pendientes > 0 ? "bg-amber-500/10" : "bg-gray-500/10"} subtitle="Pendientes de completar" />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-gray-900">
            {filtered.length} remisión{filtered.length !== 1 ? "es" : ""}
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
                {["Fecha", "No. Remisión", "Cliente", "Obra", "M³", "Mezcla", "Operador", "CR", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
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
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-bold">{r.noRemision}</td>
                    <td className="px-4 py-3 text-gray-700 text-sm max-w-[160px] truncate">{r.cliente || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{r.obra || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-900 font-bold tabular-nums">{r.m3} m³</td>
                    <td className="px-4 py-3">
                      {r.mezcla
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">{r.mezcla}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm truncate max-w-[120px]">{r.operador || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.cr || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      {r.status === "creada"
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">Creada</span>
                        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.status !== "creada" && (
                          <button
                            onClick={() => { setEditing(r); setCompletarMode(true); setDrawerOpen(true); }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-lg transition-colors cursor-pointer"
                          >
                            Completar
                          </button>
                        )}
                        <button
                          onClick={() => { setEditing(r); setCompletarMode(false); setDrawerOpen(true); }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => openPreview(r)}
                          title="Vista previa / PDF"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer size={15} />
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
