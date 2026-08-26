"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownCircle, Check, ChevronLeft, ChevronRight,
  ClipboardList, DollarSign, Package, Pencil, Plus, Printer, Search,
  Trash2, X,
} from "lucide-react";
import { deleteDocument, getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
import ClienteCombobox from "@/components/ClienteCombobox";
import KPICard from "@/components/KPICard";
import PlantaRequired from "@/components/PlantaRequired";
import type { Cliente } from "@/lib/crmClientes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recibo {
  id?: string;
  folio: number;
  cliente: string;
  importe: number | null;
  fecha: string;
  cemento: string;
  metros: number | null;
  precio: number | null;
  resistencia: string;
  tipoDeTiro: string;
  direccionObra: string;
  notas: string;
  entregado: boolean;
  planta?: string;
}

interface FormState {
  cliente: string;
  importe: string;
  fecha: string;
  cemento: string;
  metros: string;
  precio: string;
  resistencia: string;
  tipoDeTiro: string;
  direccionObra: string;
  notas: string;
  entregado: boolean;
}

export interface SalidaEfectivo {
  id?: string;
  folio: number;
  fecha: string;
  proveedor: string;
  importe: number | null;
  importeLetra: string;
  concepto: string;
  rubro: string;
  notas: string;
  planta?: string;
}

interface SalidaForm {
  fecha: string;
  proveedor: string;
  importe: string;
  concepto: string;
  rubro: string;
  notas: string;
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

export const RUBROS_EFECTIVO = [
  "Diésel",
  "Nómina",
  "Mantenimiento",
  "Materiales",
  "Combustible",
  "Alimentación",
  "Transporte",
  "Administrativo",
  "Servicios",
  "Herramientas",
  "Otros",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string): number | null {
  const p = parseFloat(v.replace(/,/g, ""));
  return isNaN(p) ? null : p;
}

function currency(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const todayISO = todayCST;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function adjMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function inMonth(fecha: string, ym: string) {
  return fecha?.startsWith(ym) ?? false;
}

function fmtFecha(s: string) {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Número en letra (español MXN) ────────────────────────────────────────────

const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO",
  "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO",
  "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function grupoEnLetras(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
  }
  const c = Math.floor(n / 100), resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${grupoEnLetras(resto)}`;
}

export function numeroEnLetras(monto: number): string {
  if (monto === 0) return "CERO PESOS 00/100 M.N.";
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  const centStr = String(centavos).padStart(2, "0");

  const millones = Math.floor(entero / 1_000_000);
  const miles    = Math.floor((entero % 1_000_000) / 1_000);
  const resto    = entero % 1_000;

  const partes: string[] = [];
  if (millones > 0) partes.push(`${grupoEnLetras(millones)} ${millones === 1 ? "MILLÓN" : "MILLONES"}`);
  if (miles > 0)    partes.push(`${miles === 1 ? "MIL" : `${grupoEnLetras(miles)} MIL`}`);
  if (resto > 0)    partes.push(grupoEnLetras(resto));

  return `${partes.join(" ")} PESOS ${centStr}/100 M.N.`;
}

// ─── Recibos concreto — form helpers ─────────────────────────────────────────

function emptyForm(): FormState {
  return { cliente: "", importe: "", fecha: todayISO(), cemento: "", metros: "", precio: "",
    resistencia: "", tipoDeTiro: "", direccionObra: "", notas: "", entregado: false };
}

function formFromRecibo(r: Recibo): FormState {
  return { cliente: r.cliente, importe: r.importe != null ? String(r.importe) : "", fecha: r.fecha,
    cemento: r.cemento, metros: r.metros != null ? String(r.metros) : "",
    precio: r.precio != null ? String(r.precio) : "", resistencia: r.resistencia,
    tipoDeTiro: r.tipoDeTiro, direccionObra: r.direccionObra, notas: r.notas, entregado: r.entregado };
}

// ─── FormDrawer (recibos concreto) ────────────────────────────────────────────

function FormDrawer({ open, onClose, onSave, initial, nextFolio, clientesList }: {
  open: boolean; onClose: () => void; onSave: (r: Recibo) => Promise<void>;
  initial?: Recibo; nextFolio: number; clientesList: string[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) return; setForm(initial ? formFromRecibo(initial) : emptyForm()); }, [open, initial]);

  const set = (k: keyof Omit<FormState, "entregado">, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";
  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const recibo: Recibo = {
        folio: initial?.folio ?? nextFolio, cliente: form.cliente.trim(), importe: n(form.importe),
        fecha: form.fecha, cemento: form.cemento.trim(), metros: n(form.metros), precio: n(form.precio),
        resistencia: form.resistencia.trim(), tipoDeTiro: form.tipoDeTiro.trim(),
        direccionObra: form.direccionObra.trim(), notas: form.notas.trim(), entregado: form.entregado,
      };
      await onSave(recibo);
      onClose();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-[#242424] border-l border-[#3A3A3A] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {initial ? `Folio #${String(initial.folio).padStart(4, "0")}` : `Folio #${String(nextFolio).padStart(4, "0")}`}
            </p>
            <h2 className="text-base font-bold text-white mt-0.5">{initial ? "Editar recibo" : "Nuevo recibo"}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ClienteCombobox label="Cliente" value={form.cliente} onChange={(v) => set("cliente", v)} options={clientesList} placeholder="Buscar cliente…" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Importe $</label>
            <input type="number" step="0.01" min="0" value={form.importe} onChange={(e) => set("importe", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
          </div>
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Concreto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Metros (m³)</label>
                <input type="number" step="0.5" min="0" value={form.metros} onChange={(e) => set("metros", e.target.value)} placeholder="0.0" className={inp} onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={lbl}>Precio $</label>
                <input type="number" step="0.01" min="0" value={form.precio} onChange={(e) => set("precio", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div>
                <label className={lbl}>Cemento</label>
                <input type="text" value={form.cemento} onChange={(e) => set("cemento", e.target.value)} placeholder="CPC 30, CPC 40…" className={inp} />
              </div>
              <div>
                <label className={lbl}>Resistencia</label>
                <input type="text" value={form.resistencia} onChange={(e) => set("resistencia", e.target.value)} placeholder="250, 300, 350…" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Tipo de tiro</label>
                <input type="text" value={form.tipoDeTiro} onChange={(e) => set("tipoDeTiro", e.target.value)} placeholder="Directo, bomba, etc." className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Dirección obra</label>
                <input type="text" value={form.direccionObra} onChange={(e) => set("direccionObra", e.target.value)} placeholder="Calle, número, colonia…" className={inp} />
              </div>
            </div>
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={3} placeholder="Observaciones adicionales…" className={`${inp} resize-none`} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-[#3A3A3A] px-4 py-3 hover:border-[#CC2229]/40 transition-colors">
            <div onClick={() => setForm((p) => ({ ...p, entregado: !p.entregado }))}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.entregado ? "bg-emerald-500" : "bg-[#3A3A3A]"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.entregado ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-gray-300">Entregado</span>
          </label>
        </form>

        <div className="border-t border-[#3A3A3A] px-6 py-4 flex justify-end gap-3 bg-[#242424]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20 disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SalidaDrawer ─────────────────────────────────────────────────────────────

function emptySalidaForm(): SalidaForm {
  return { fecha: todayISO(), proveedor: "", importe: "", concepto: "", rubro: RUBROS_EFECTIVO[0], notas: "" };
}

function SalidaDrawer({ open, onClose, onSave, initial, nextFolio }: {
  open: boolean; onClose: () => void; onSave: (s: SalidaEfectivo) => Promise<void>;
  initial?: SalidaEfectivo; nextFolio: number;
}) {
  const [form, setForm] = useState<SalidaForm>(emptySalidaForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial
      ? { fecha: initial.fecha, proveedor: initial.proveedor, importe: initial.importe != null ? String(initial.importe) : "",
          concepto: initial.concepto, rubro: initial.rubro, notas: initial.notas }
      : emptySalidaForm());
  }, [open, initial]);

  const set = (k: keyof SalidaForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const monto = n(form.importe) ?? 0;
  const letra = monto > 0 ? numeroEnLetras(monto) : "";

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";
  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
  const sel = `${inp} cursor-pointer`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.proveedor || !form.importe || !form.concepto) return;
    setSaving(true);
    try {
      const salida: SalidaEfectivo = {
        folio: initial?.folio ?? nextFolio,
        fecha: form.fecha,
        proveedor: form.proveedor.trim(),
        importe: n(form.importe),
        importeLetra: letra,
        concepto: form.concepto.trim(),
        rubro: form.rubro,
        notas: form.notas.trim(),
      };
      await onSave(salida);
      onClose();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-[#242424] border-l border-[#3A3A3A] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {initial ? `SE-${String(initial.folio).padStart(4, "0")}` : `SE-${String(nextFolio).padStart(4, "0")}`}
            </p>
            <h2 className="text-base font-bold text-white mt-0.5">{initial ? "Editar salida" : "Nueva salida de efectivo"}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Proveedor / Beneficiario</label>
              <input type="text" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Nombre de quien recibe el pago" className={inp} required />
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} required />
            </div>
            <div>
              <label className={lbl}>Rubro</label>
              <select value={form.rubro} onChange={(e) => set("rubro", e.target.value)} className={sel}>
                {RUBROS_EFECTIVO.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Importe $</label>
            <input type="number" step="0.01" min="0.01" value={form.importe} onChange={(e) => set("importe", e.target.value)} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} required />
            {letra && (
              <p className="mt-2 text-[11px] text-amber-400 font-medium leading-snug bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                {letra}
              </p>
            )}
          </div>

          <div>
            <label className={lbl}>Concepto</label>
            <textarea value={form.concepto} onChange={(e) => set("concepto", e.target.value)} rows={3} placeholder="Descripción del pago realizado…" className={`${inp} resize-none`} required />
          </div>

          <div>
            <label className={lbl}>Notas (opcional)</label>
            <input type="text" value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Referencia, número de factura, etc." className={inp} />
          </div>
        </form>

        <div className="border-t border-[#3A3A3A] px-6 py-4 flex justify-end gap-3 bg-[#242424]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.proveedor || !form.importe || !form.concepto}
            className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20 disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PrintRecibo (recibo imprimible de salida) ────────────────────────────────

function PrintRecibo({ salida, onClose }: { salida: SalidaEfectivo; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo SE-${String(salida.folio).padStart(4,"0")}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; background: #fff; color: #111; padding: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #CC2229; padding-bottom: 16px; margin-bottom: 24px; }
      .empresa { font-size: 20px; font-weight: 800; color: #CC2229; letter-spacing: -0.5px; }
      .empresa-sub { font-size: 11px; color: #666; margin-top: 2px; }
      .folio-box { text-align: right; }
      .folio-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #888; }
      .folio-num { font-size: 28px; font-weight: 900; color: #CC2229; font-family: monospace; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin-bottom: 20px; }
      .field label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; display: block; margin-bottom: 4px; font-weight: 700; }
      .field .val { font-size: 13px; color: #111; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; min-height: 24px; }
      .importe-box { background: #f9fafb; border: 2px solid #CC2229; border-radius: 8px; padding: 16px; margin: 20px 0; }
      .importe-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #888; font-weight: 700; }
      .importe-valor { font-size: 32px; font-weight: 900; color: #CC2229; margin: 4px 0; }
      .importe-letra { font-size: 11px; color: #444; font-style: italic; line-height: 1.5; margin-top: 6px; }
      .concepto-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
      .concepto-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-weight: 700; margin-bottom: 6px; }
      .concepto-val { font-size: 13px; color: #111; line-height: 1.6; }
      .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
      .firma { border-top: 1.5px solid #111; padding-top: 8px; text-align: center; }
      .firma-label { font-size: 10px; color: #555; }
      .footer { margin-top: 32px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 10px; }
      .rubro-badge { display: inline-block; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; border-radius: 99px; padding: 2px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      @media print { body { padding: 24px; } }
    </style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Barra de acción */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 rounded-t-2xl z-10">
          <p className="text-sm font-semibold text-gray-800">Vista previa del recibo</p>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#CC2229] hover:bg-[#B01E24] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
          </div>
        </div>

        {/* Contenido del recibo */}
        <div ref={printRef} className="px-10 py-8 text-gray-900">
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-[#CC2229] pb-5 mb-6">
            <div>
              <p className="text-2xl font-black text-[#CC2229] tracking-tight">DURO CONCRETOS</p>
              <p className="text-xs text-gray-500 mt-0.5">Recibo de Salida de Efectivo</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Folio</p>
              <p className="text-4xl font-black text-[#CC2229] font-mono">SE-{String(salida.folio).padStart(4, "0")}</p>
            </div>
          </div>

          {/* Datos */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
            {[
              { label: "Fecha", val: fmtFecha(salida.fecha) },
              { label: "Rubro", val: salida.rubro },
              { label: "Proveedor / Beneficiario", val: salida.proveedor },
              { label: "Notas", val: salida.notas || "—" },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-1 min-h-[22px]">{val}</p>
              </div>
            ))}
          </div>

          {/* Importe */}
          <div className="border-2 border-[#CC2229] rounded-xl p-5 my-5 bg-red-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Importe</p>
            <p className="text-4xl font-black text-[#CC2229]">{currency(salida.importe)}</p>
            <p className="text-xs text-gray-600 italic mt-2 leading-relaxed">{salida.importeLetra}</p>
          </div>

          {/* Concepto */}
          <div className="border border-gray-200 rounded-xl p-4 mb-8">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Concepto</p>
            <p className="text-sm text-gray-800 leading-relaxed">{salida.concepto}</p>
          </div>

          {/* Firmas */}
          <div className="grid grid-cols-2 gap-16 mt-12">
            {["Entregó", "Recibió"].map((f) => (
              <div key={f} className="border-t-2 border-gray-900 pt-2 text-center">
                <p className="text-xs text-gray-500">{f}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[9px] text-gray-300 mt-8 border-t border-gray-100 pt-4">
            Documento generado por Duro Concretos ERP · {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SalidasTab ───────────────────────────────────────────────────────────────

function SalidasTab({ formOpen, onFormClose }: { formOpen: boolean; onFormClose: () => void }) {
  const [salidas, setSalidas]         = useState<SalidaEfectivo[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filtroRubro, setFiltroRubro] = useState("Todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todo" | "mes">("mes");
  const [mes, setMes]                 = useState(currentMonth);
  const [editing, setEditing]         = useState<SalidaEfectivo | undefined>();
  const [printing, setPrinting]       = useState<SalidaEfectivo | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<SalidaEfectivo | undefined>();

  // showForm viene del padre (botón "Nueva salida" del header)
  const showForm = formOpen || editing !== undefined;

  useEffect(() => {
    getCollectionDocs<SalidaEfectivo>(COLLECTIONS.salidasEfectivo)
      .then((docs) => setSalidas(filterByPlanta(docs).sort((a, b) => b.folio - a.folio)))
      .finally(() => setLoading(false));
  }, []);

  const nextFolio = useMemo(() => {
    if (salidas.length === 0) return 1;
    return Math.max(...salidas.map((s) => s.folio ?? 0)) + 1;
  }, [salidas]);

  const filtered = useMemo(() => {
    return salidas.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.proveedor.toLowerCase().includes(q) || s.concepto.toLowerCase().includes(q) ||
        s.rubro.toLowerCase().includes(q) || String(s.folio).includes(q);
      const matchRubro = filtroRubro === "Todos" || s.rubro === filtroRubro;
      const matchPeriodo = filtroPeriodo === "todo" || inMonth(s.fecha, mes);
      return matchSearch && matchRubro && matchPeriodo;
    });
  }, [salidas, search, filtroRubro, filtroPeriodo, mes]);

  const totalSalidas = useMemo(() => filtered.reduce((s, r) => s + (r.importe ?? 0), 0), [filtered]);

  async function handleSave(s: SalidaEfectivo) {
    const isNew = !editing;
    const id = editing?.id ?? `se-${s.folio}-${Date.now()}`;
    const { id: _id, ...data } = { ...s, id };
    await upsertDocument(COLLECTIONS.salidasEfectivo, id, withPlantaTag(data));
    const saved: SalidaEfectivo = { ...s, id };
    setSalidas((prev) => isNew ? [saved, ...prev].sort((a, b) => b.folio - a.folio) : prev.map((p) => p.id === id ? saved : p));
  }

  async function handleDelete(s: SalidaEfectivo) {
    setSalidas((prev) => prev.filter((x) => x.id !== s.id));
    await deleteDocument(COLLECTIONS.salidasEfectivo, s.id!);
    setConfirmDelete(undefined);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Salida SE-${String(s.folio).padStart(4, "0")} eliminada.` } }));
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white hover:bg-[#3A3A3A]"}`;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Total salidas" value={String(filtered.length)} icon={ArrowDownCircle} iconColor="text-red-400" iconBg="bg-red-500/10" />
        <KPICard title="Total pagado" value={currency(totalSalidas)} icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Rubros activos" value={String(new Set(filtered.map((s) => s.rubro)).size)} icon={ClipboardList} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
      </div>

      {/* Filtros */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input type="text" placeholder="Buscar folio, proveedor, concepto, rubro…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600" />
        </div>

        {/* Rubro */}
        <select value={filtroRubro} onChange={(e) => setFiltroRubro(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer">
          <option value="Todos">Todos los rubros</option>
          {RUBROS_EFECTIVO.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Período */}
        <div className="flex items-center gap-1.5 bg-[#2A2A2A] rounded-xl p-1">
          <button onClick={() => setFiltroPeriodo("todo")} className={tabCls(filtroPeriodo === "todo")}>Todo</button>
          <button onClick={() => setFiltroPeriodo("mes")} className={tabCls(filtroPeriodo === "mes")}>Por mes</button>
        </div>

        {filtroPeriodo === "mes" && (
          <div className="flex items-center gap-1 border border-[#3A3A3A] rounded-xl overflow-hidden">
            <button onClick={() => setMes((m) => adjMonth(m, -1))} className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronLeft size={15} /></button>
            <span className="px-3 py-2 text-sm font-semibold text-gray-200 capitalize whitespace-nowrap min-w-[140px] text-center">{monthLabel(mes)}</span>
            <button onClick={() => setMes((m) => adjMonth(m, 1))} disabled={mes >= currentMonth()} className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Folio", "Fecha", "Proveedor", "Rubro", "Importe", "Concepto", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Sin resultados.</td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-300">SE-{String(s.folio).padStart(4, "0")}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtFecha(s.fecha)}</td>
                    <td className="px-4 py-3 font-semibold text-white max-w-[160px] truncate">{s.proveedor}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        {s.rubro}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{currency(s.importe)}</td>
                    <td className="px-4 py-3 text-gray-400 max-w-[240px]">
                      <p className="truncate">{s.concepto}</p>
                      {s.importeLetra && (
                        <p className="text-[10px] text-gray-600 truncate mt-0.5">{s.importeLetra}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPrinting(s)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer" title="Imprimir recibo">
                          <Printer size={14} />
                        </button>
                        <button onClick={() => { setEditing(s); }} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(s)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SalidaDrawer open={showForm} onClose={() => { onFormClose(); setEditing(undefined); }} onSave={handleSave} initial={editing} nextFolio={nextFolio} />

      {printing && <PrintRecibo salida={printing} onClose={() => setPrinting(undefined)} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(undefined)} />
          <div className="relative bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-white mb-1">¿Eliminar salida?</h3>
            <p className="text-sm text-gray-400 mb-5">
              Se eliminará <strong className="text-gray-200">SE-{String(confirmDelete.folio).padStart(4, "0")} — {confirmDelete.proveedor}</strong> de forma permanente.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(undefined)} className="px-4 py-2 text-sm text-gray-300 border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors cursor-pointer">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-xl transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainTab = "recibos" | "salidas";

export default function EfectivoPage() {
  const [mainTab, setMainTab]         = useState<MainTab>("recibos");
  const [recibos, setRecibos]         = useState<Recibo[]>([]);
  const [clientesList, setClientesList] = useState<string[]>([]);
  const [catalogoClientes, setCatalogoClientes] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [search, setSearch]           = useState("");
  const [filterEntregado, setFilterEntregado] = useState<"todos" | "entregado" | "pendiente">("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todo" | "mes">("mes");
  const [mes, setMes]                 = useState(currentMonth);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Recibo | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Recibo | undefined>();
  const [salidaFormOpen, setSalidaFormOpen] = useState(false);

  useEffect(() => {
    if (!loading) { setLoadingLong(false); return; }
    const t = setTimeout(() => setLoadingLong(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Recibo>(COLLECTIONS.efectivo),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<{ cliente?: string }>(COLLECTIONS.programaciones),
    ]).then(([docs, clientes, progs]) => {
      setRecibos(filterByPlanta(docs).sort((a, b) => b.folio - a.folio));
      const fromClientes = clientes.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean));
      const fromProgs = progs.map((p) => p.cliente).filter(Boolean) as string[];
      setClientesList(Array.from(new Set([...fromClientes, ...fromProgs])).sort());
      setCatalogoClientes(new Set(fromClientes.map((n) => n.trim().toLowerCase())));
    }).finally(() => setLoading(false));
  }, []);

  const nextFolio = useMemo(() => {
    if (recibos.length === 0) return 1;
    return Math.max(...recibos.map((r) => r.folio ?? 0)) + 1;
  }, [recibos]);

  const filtered = useMemo(() => {
    return recibos.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q || String(r.folio).includes(q) || r.cliente.toLowerCase().includes(q) ||
        r.direccionObra.toLowerCase().includes(q) || r.resistencia.toLowerCase().includes(q) || r.tipoDeTiro.toLowerCase().includes(q);
      const matchEntregado = filterEntregado === "todos" || (filterEntregado === "entregado" && r.entregado) || (filterEntregado === "pendiente" && !r.entregado);
      const matchPeriodo = filtroPeriodo === "todo" || inMonth(r.fecha, mes);
      return matchSearch && matchEntregado && matchPeriodo;
    });
  }, [recibos, search, filterEntregado, filtroPeriodo, mes]);

  const totalImporte = useMemo(() => filtered.reduce((s, r) => s + (r.importe ?? 0), 0), [filtered]);
  const totalM3 = useMemo(() => filtered.reduce((s, r) => s + (r.metros ?? 0), 0), [filtered]);
  const pendientes = useMemo(() => filtered.filter((r) => !r.entregado).length, [filtered]);

  async function handleSave(r: Recibo) {
    const isNew = !editing;
    const id = editing?.id ?? `rec-${r.folio}-${Date.now()}`;
    const normalized: Recibo = { ...r, cliente: r.cliente.trim().toUpperCase().replace(/\s+/g, " ") };
    const { id: _id, ...data } = { ...normalized, id };
    await upsertDocument(COLLECTIONS.efectivo, id, withPlantaTag(data));
    const saved: Recibo = { ...normalized, id };
    setRecibos((prev) => isNew ? [saved, ...prev].sort((a, b) => b.folio - a.folio) : prev.map((p) => p.id === id ? saved : p));
  }

  async function toggleEntregado(r: Recibo) {
    const updated: Recibo = { ...r, entregado: !r.entregado };
    const { id: _id, ...data } = updated;
    await upsertDocument(COLLECTIONS.efectivo, r.id!, withPlantaTag(data));
    setRecibos((prev) => prev.map((p) => p.id === r.id ? updated : p));
  }

  async function handleDelete(r: Recibo) {
    setRecibos((prev) => prev.filter((x) => x.id !== r.id));
    await deleteDocument(COLLECTIONS.efectivo, r.id!);
    setConfirmDelete(undefined);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Recibo #${String(r.folio).padStart(4, "0")} eliminado.` } }));
  }

  function openNew() { setEditing(undefined); setShowForm(true); }
  function openEdit(r: Recibo) { setEditing(r); setShowForm(true); }

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white hover:bg-[#3A3A3A]"}`;

  return (
    <div className="space-y-6">
      {/* Header con tabs principales */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#2A2A2A] rounded-xl p-1">
          <button onClick={() => setMainTab("recibos")} className={tabCls(mainTab === "recibos")}>
            Recibos concreto
          </button>
          <button onClick={() => setMainTab("salidas")} className={tabCls(mainTab === "salidas")}>
            Salidas de efectivo
          </button>
        </div>

        {mainTab === "recibos" && (
          <PlantaRequired>
            {(ok) => (
              <button onClick={() => ok && openNew()} disabled={!ok}
                title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
                className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                <Plus size={16} /> Nuevo recibo
              </button>
            )}
          </PlantaRequired>
        )}

        {mainTab === "salidas" && (
          <PlantaRequired>
            {(ok) => (
              <button onClick={() => ok && setSalidaFormOpen(true)} disabled={!ok}
                title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
                className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                <Plus size={16} /> Nueva salida
              </button>
            )}
          </PlantaRequired>
        )}
      </div>

      {/* ── Tab: Recibos concreto ─────────────────────────────────────────────── */}
      {mainTab === "recibos" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total recibos" value={String(filtered.length)} icon={ClipboardList} iconColor="text-[#CC2229]" iconBg="bg-[#CC2229]/10" />
            <KPICard title="Total m³" value={`${totalM3.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`} icon={Package} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
            <KPICard title="Total importe" value={currency(totalImporte)} icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
            <KPICard title="Pendientes entrega" value={String(pendientes)} icon={AlertTriangle} iconColor={pendientes > 0 ? "text-amber-400" : "text-emerald-400"} iconBg={pendientes > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"} />
          </div>

          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input type="text" placeholder="Buscar folio, cliente, resistencia…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600" />
            </div>
            <div className="flex items-center gap-1.5 bg-[#2A2A2A] rounded-xl p-1">
              <button onClick={() => setFiltroPeriodo("todo")} className={tabCls(filtroPeriodo === "todo")}>Todo</button>
              <button onClick={() => setFiltroPeriodo("mes")} className={tabCls(filtroPeriodo === "mes")}>Por mes</button>
            </div>
            {filtroPeriodo === "mes" && (
              <div className="flex items-center gap-1 border border-[#3A3A3A] rounded-xl overflow-hidden">
                <button onClick={() => setMes((m) => adjMonth(m, -1))} className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronLeft size={15} /></button>
                <span className="px-3 py-2 text-sm font-semibold text-gray-200 capitalize whitespace-nowrap min-w-[140px] text-center">{monthLabel(mes)}</span>
                <button onClick={() => setMes((m) => adjMonth(m, 1))} disabled={mes >= currentMonth()} className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={15} /></button>
              </div>
            )}
            <div className="flex gap-1.5">
              {(["todos", "entregado", "pendiente"] as const).map((f) => (
                <button key={f} onClick={() => setFilterEntregado(f)} className={tabCls(filterEntregado === f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-28">
                <svg className="h-9 w-9 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                  {loadingLong ? "Cargando información, esto puede tomar unos segundos…" : "Cargando…"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Folio", "Fecha", "Cliente", "Importe", "m³", "Precio", "Cemento", "Resistencia", "Tipo tiro", "Dirección obra", "Entregado", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-500">Sin resultados.</td></tr>
                    ) : filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-300">#{String(r.folio).padStart(4, "0")}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtFecha(r.fecha)}</td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="font-semibold text-white truncate">{r.cliente || "—"}</p>
                          {r.cliente && catalogoClientes.size > 0 && !catalogoClientes.has(r.cliente.trim().toLowerCase()) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Sin vínculo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{currency(r.importe)}</td>
                        <td className="px-4 py-3 text-gray-300">{r.metros != null ? `${r.metros} m³` : "—"}</td>
                        <td className="px-4 py-3 text-gray-300">{r.precio != null ? currency(r.precio) : "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{r.cemento || "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{r.resistencia || "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{r.tipoDeTiro || "—"}</td>
                        <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate" title={r.direccionObra}>{r.direccionObra || "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleEntregado(r)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${r.entregado ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25"}`}>
                            {r.entregado && <Check size={11} />}
                            {r.entregado ? "Entregado" : "Pendiente"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"><Pencil size={14} /></button>
                            <button onClick={() => setConfirmDelete(r)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <FormDrawer open={showForm} onClose={() => setShowForm(false)} onSave={handleSave} initial={editing} nextFolio={nextFolio} clientesList={clientesList} />

          {confirmDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(undefined)} />
              <div className="relative bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-base font-semibold text-white mb-1">¿Eliminar recibo?</h3>
                <p className="text-sm text-gray-400 mb-5">
                  Se eliminará <strong className="text-gray-200">#{String(confirmDelete.folio).padStart(4, "0")} — {confirmDelete.cliente || "sin cliente"}</strong> de forma permanente.
                </p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setConfirmDelete(undefined)} className="px-4 py-2 text-sm text-gray-300 border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors cursor-pointer">Cancelar</button>
                  <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-xl transition-colors cursor-pointer">Eliminar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Salidas de efectivo ──────────────────────────────────────────── */}
      {mainTab === "salidas" && <SalidasTab formOpen={salidaFormOpen} onFormClose={() => setSalidaFormOpen(false)} />}
    </div>
  );
}
