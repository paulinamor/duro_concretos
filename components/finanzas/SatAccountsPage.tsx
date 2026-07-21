"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Link2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import ClienteCombobox from "@/components/ClienteCombobox";
import CargaMasivaModal from "@/components/finanzas/CargaMasivaModal";
import { upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";
import { useCollection, useCollectionRaw } from "@/lib/useCollection";
import type { SatDownloadKind } from "@/lib/satDownloads";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Cuenta {
  id?: string;
  // Datos CFDI / SAT
  estadoSAT: "Vigente" | "Cancelado" | "Sustituida";
  tipo: "Factura" | "Nota de Crédito" | "Complemento de Pago";
  serie: string;
  uuid: string;
  uuidRelacion: string;
  rfc: string;
  // Datos del documento
  fecha: string;
  folio: string;
  contraparte: string;
  concepto: string;
  subtotal: number;
  iva: number;
  total: number;
  formaPago: string;
  banco: string;       // COSEC. TC
  bancoPago?: string;  // BANCO (CxP: banco desde donde se paga)
  // CxP-específicos
  retenidoIVA?: number;
  retenidoISR?: number;
  ish?: number;
  // Cobro / pago
  montoPagado: number;
  vencimiento: string;
  status: "Pendiente" | "Parcial" | "Pagado" | "Vencido";
  notas?: string;
  abonos?: Abono[];
  programacionId?: string;
  planta?: string;
}

interface Abono {
  fecha: string;
  monto: number;
  referencia?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDisplay(iso: string) {
  if (!iso || !iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string) {
  if (!display || !display.includes("/")) return display;
  const [d, m, y] = display.split("/");
  return `${y}-${m}-${d}`;
}

function currency(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function diasVencimiento(vencimiento: string): number {
  const iso = vencimiento.includes("/") ? displayToISO(vencimiento) : vencimiento;
  const due = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

function computeStatus(cuenta: Cuenta): Cuenta["status"] {
  const saldo = cuenta.total - cuenta.montoPagado;
  if (saldo <= 0) return "Pagado";
  if (cuenta.montoPagado > 0) return "Parcial";
  if (diasVencimiento(cuenta.vencimiento) < 0) return "Vencido";
  return "Pendiente";
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(iso: string): string {
  const d = iso.includes("/") ? displayToISO(iso) : iso;
  const [y, m] = d.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
}

// ─── Form Drawer ──────────────────────────────────────────────────────────────

function FormDrawer({
  open,
  kind,
  clientesList,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  kind: SatDownloadKind;
  clientesList: string[];
  onClose: () => void;
  onSave: (data: Omit<Cuenta, "id" | "abonos" | "planta">) => Promise<void>;
  initial?: Cuenta;
}) {
  const isCxp = kind === "cxp";

  const emptyForm = () => ({
    estadoSAT: "Vigente" as Cuenta["estadoSAT"],
    tipo: "Factura" as Cuenta["tipo"],
    serie: "F",
    uuid: "",
    uuidRelacion: "",
    rfc: "",
    fecha: todayISO(),
    folio: "",
    contraparte: "",
    concepto: "",
    subtotal: "",
    iva: "",
    retenidoIVA: "",
    retenidoISR: "",
    ish: "",
    formaPago: "99 - Por definir",
    banco: "",
    bancoPago: "",
    vencimiento: "",
    notas: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        estadoSAT: initial.estadoSAT ?? "Vigente",
        tipo: initial.tipo ?? "Factura",
        serie: initial.serie ?? "F",
        uuid: initial.uuid ?? "",
        uuidRelacion: initial.uuidRelacion ?? "",
        rfc: initial.rfc ?? "",
        fecha: initial.fecha.includes("/") ? displayToISO(initial.fecha) : initial.fecha,
        folio: initial.folio ?? "",
        contraparte: initial.contraparte ?? "",
        concepto: initial.concepto ?? "",
        subtotal: String(initial.subtotal ?? ""),
        iva: String(initial.iva ?? ""),
        retenidoIVA: String(initial.retenidoIVA ?? ""),
        retenidoISR: String(initial.retenidoISR ?? ""),
        ish: String(initial.ish ?? ""),
        formaPago: initial.formaPago ?? "99 - Por definir",
        banco: initial.banco ?? "",
        bancoPago: initial.bancoPago ?? "",
        vencimiento: initial.vencimiento
          ? (initial.vencimiento.includes("/") ? displayToISO(initial.vencimiento) : initial.vencimiento)
          : "",
        notas: initial.notas ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, initial]);

  const subtotalNum = parseFloat(form.subtotal) || 0;
  const ivaNum = parseFloat(form.iva) || (isCxp ? 0 : subtotalNum * 0.16);
  const retenidoIVANum = parseFloat(form.retenidoIVA) || 0;
  const retenidoISRNum = parseFloat(form.retenidoISR) || 0;
  const ishNum = parseFloat(form.ish) || 0;
  const totalNum = subtotalNum + ivaNum - retenidoIVANum - retenidoISRNum - ishNum;

  async function handleSave() {
    if (!form.contraparte || totalNum <= 0) return;
    setSaving(true);
    try {
      await onSave({
        estadoSAT: form.estadoSAT,
        tipo: form.tipo,
        serie: form.serie,
        uuid: form.uuid,
        uuidRelacion: form.uuidRelacion,
        rfc: form.rfc,
        fecha: isoToDisplay(form.fecha),
        folio: form.folio,
        contraparte: form.contraparte,
        concepto: form.concepto,
        subtotal: subtotalNum,
        iva: ivaNum,
        ...(isCxp && { retenidoIVA: retenidoIVANum, retenidoISR: retenidoISRNum, ish: ishNum, bancoPago: form.bancoPago }),
        total: totalNum,
        formaPago: form.formaPago,
        banco: form.banco,
        montoPagado: initial?.montoPagado ?? 0,
        vencimiento: isoToDisplay(form.vencimiento || form.fecha),
        status: initial?.status ?? "Pendiente",
        notas: form.notas,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const contraparteLabel = kind === "cxc" ? "Nombre Receptor" : "Nombre Emisor";
  const rfcLabel = kind === "cxc" ? "RFC Receptor" : "RFC Emisor";
  const isEditing = !!initial;
  const title = isEditing
    ? (kind === "cxc" ? "Editar cuenta por cobrar" : "Editar cuenta por pagar")
    : (kind === "cxc" ? "Nueva cuenta por cobrar" : "Nueva cuenta por pagar");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">Completa los datos del documento</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Datos CFDI */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Datos CFDI / SAT</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Estado SAT</label>
              <select value={form.estadoSAT} onChange={(e) => setForm({ ...form, estadoSAT: e.target.value as Cuenta["estadoSAT"] })} className={inp}>
                <option>Vigente</option>
                <option>Cancelado</option>
                <option>Sustituida</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Cuenta["tipo"] })} className={inp}>
                <option>Factura</option>
                <option>Nota de Crédito</option>
                <option>Complemento de Pago</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Serie</label>
              <input type="text" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="F" className={inp} />
            </div>
            <div>
              <label className={lbl}>{rfcLabel}</label>
              <input type="text" value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })} placeholder={`RFC del ${isCxp ? "emisor" : "receptor"}`} className={`${inp} uppercase`} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>UUID (Folio fiscal)</label>
              <input type="text" value={form.uuid} onChange={(e) => setForm({ ...form, uuid: e.target.value.toUpperCase() })} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" className={`${inp} font-mono text-xs uppercase`} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>UUID Relación</label>
              <input type="text" value={form.uuidRelacion} onChange={(e) => setForm({ ...form, uuidRelacion: e.target.value.toUpperCase() })} placeholder="Solo si aplica (complemento de pago)" className={`${inp} font-mono text-xs uppercase`} />
            </div>
          </div>

          {/* Datos del documento */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-1">Documento</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha de emisión</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inp} />
            </div>
            <div>
              <label className={lbl}>Folio / # factura</label>
              <input type="text" value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="5884" className={inp} />
            </div>
          </div>
          <div>
            {kind === "cxc" ? (
              <ClienteCombobox
                label={contraparteLabel}
                required
                value={form.contraparte}
                onChange={(v) => setForm({ ...form, contraparte: v })}
                options={clientesList}
                placeholder="Buscar nombre receptor…"
              />
            ) : (
              <>
                <label className={lbl}>{contraparteLabel}</label>
                <input
                  type="text"
                  value={form.contraparte}
                  onChange={(e) => setForm({ ...form, contraparte: e.target.value })}
                  placeholder="Nombre del proveedor"
                  className={inp}
                />
              </>
            )}
          </div>
          <div>
            <label className={lbl}>Concepto</label>
            <input type="text" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Ej: Suministro de concreto fc=200" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Subtotal ($)</label>
              <input type="number" min="0" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <div>
              <label className={lbl}>IVA 16% ($)</label>
              <input type="number" min="0" step="0.01" value={form.iva} onChange={(e) => setForm({ ...form, iva: e.target.value })} placeholder={subtotalNum ? String(Math.round(subtotalNum * 0.16)) : "0.00"} className={inp} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            {isCxp && (
              <>
                <div>
                  <label className={lbl}>Retenido IVA ($)</label>
                  <input type="number" min="0" step="0.01" value={form.retenidoIVA} onChange={(e) => setForm({ ...form, retenidoIVA: e.target.value })} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                </div>
                <div>
                  <label className={lbl}>Retenido ISR ($)</label>
                  <input type="number" min="0" step="0.01" value={form.retenidoISR} onChange={(e) => setForm({ ...form, retenidoISR: e.target.value })} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                </div>
                <div>
                  <label className={lbl}>ISH ($)</label>
                  <input type="number" min="0" step="0.01" value={form.ish} onChange={(e) => setForm({ ...form, ish: e.target.value })} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                </div>
              </>
            )}
          </div>
          {totalNum > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">Total</span>
              <span className="text-lg font-bold text-gray-900">{currency(totalNum)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Forma de pago</label>
              <select value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })} className={inp}>
                <option>99 - Por definir</option>
                <option>01 - Efectivo</option>
                <option>03 - Transferencia electrónica</option>
                <option>04 - Tarjeta de crédito</option>
                <option>28 - Tarjeta de débito</option>
              </select>
            </div>
            <div>
              <label className={lbl}>COSEC. TC</label>
              <input type="text" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="BBVA 28/1" className={inp} />
            </div>
            {isCxp && (
              <div className="col-span-2">
                <label className={lbl}>BANCO</label>
                <input type="text" value={form.bancoPago} onChange={(e) => setForm({ ...form, bancoPago: e.target.value })} placeholder="bbva 02/12" className={inp} />
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>Fecha de vencimiento</label>
            <input type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} className={inp} />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <input type="text" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" className={inp} />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl transition-colors hover:text-gray-900 disabled:opacity-50 cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.contraparte || totalNum <= 0} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Guardando...</> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Abono Drawer ─────────────────────────────────────────────────────────────

function AbonoDrawer({
  cuenta,
  kind,
  onClose,
  onSave,
}: {
  cuenta: Cuenta | null;
  kind: SatDownloadKind;
  onClose: () => void;
  onSave: (cuenta: Cuenta, abono: Abono) => Promise<void>;
}) {
  const [form, setForm] = useState({ fecha: todayISO(), monto: "", referencia: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cuenta) setForm({ fecha: todayISO(), monto: "", referencia: "" });
  }, [cuenta]);

  if (!cuenta) return null;
  const c = cuenta;

  const saldo = c.total - c.montoPagado;
  const montoNum = parseFloat(form.monto) || 0;

  async function handleSave() {
    if (montoNum <= 0) return;
    setSaving(true);
    try {
      await onSave(c, {
        fecha: isoToDisplay(form.fecha),
        monto: montoNum,
        referencia: form.referencia,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const actionLabel = kind === "cxc" ? "Registrar cobro" : "Registrar pago";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white border-l border-gray-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{actionLabel}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{cuenta.contraparte} · {cuenta.folio || "Sin folio"}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total factura</span>
              <span className="font-semibold text-gray-900">{currency(cuenta.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ya {kind === "cxc" ? "cobrado" : "pagado"}</span>
              <span className="text-emerald-600 font-semibold">{currency(cuenta.montoPagado)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Saldo pendiente</span>
              <span className="font-bold text-[#CC2229]">{currency(saldo)}</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Fecha del {kind === "cxc" ? "cobro" : "pago"}</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inp} />
          </div>
          <div>
            <label className={lbl}>Monto ($)</label>
            <input type="number" min="0" step="0.01" max={saldo} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" className={inp} />
            <p className="text-[10px] text-gray-400 mt-1">Saldo máximo: {currency(saldo)}</p>
          </div>
          <div>
            <label className={lbl}>Referencia / No. transferencia</label>
            <input type="text" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Opcional" className={inp} />
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:text-gray-900 transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || montoNum <= 0 || montoNum > saldo} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-60 cursor-pointer">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? "Guardando..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function CuentaRow({
  cuenta,
  kind,
  selected,
  onSelect,
  onAbono,
  onEdit,
  onDelete,
}: {
  cuenta: Cuenta;
  kind: SatDownloadKind;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAbono: (c: Cuenta) => void;
  onEdit: (c: Cuenta) => void;
  onDelete: (c: Cuenta) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const saldo = cuenta.total - cuenta.montoPagado;
  const dias = diasVencimiento(cuenta.vencimiento);
  const porcentaje = cuenta.total > 0 ? Math.min(100, (cuenta.montoPagado / cuenta.total) * 100) : 0;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${selected ? "bg-[#CC2229]/8" : expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(cuenta.id!, e.target.checked)}
            className="h-4 w-4 rounded border-[#4A4A4A] bg-[#2A2A2A] accent-[#CC2229] cursor-pointer"
          />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`text-[10px] font-semibold ${cuenta.estadoSAT === "Vigente" ? "text-emerald-400" : cuenta.estadoSAT === "Cancelado" ? "text-red-400" : "text-amber-400"}`}>
            {cuenta.estadoSAT || "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{cuenta.tipo || "—"}</td>
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{cuenta.fecha}</td>
        <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{cuenta.folio || "—"}</td>
        <td className="px-4 py-3 text-white font-semibold text-sm">{cuenta.contraparte}</td>
        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{cuenta.rfc || "—"}</td>
        <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">{cuenta.banco || "—"}</td>
        <td className="px-4 py-3 text-gray-400 text-sm max-w-[160px] truncate">{cuenta.concepto || "—"}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{currency(cuenta.total)}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1 min-w-[100px]">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">{currency(cuenta.montoPagado)}</span>
              <span className="text-gray-500">{Math.round(porcentaje)}%</span>
            </div>
            <div className="h-1 rounded-full bg-[#3A3A3A] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${porcentaje >= 100 ? "bg-emerald-500" : porcentaje > 0 ? "bg-amber-500" : "bg-[#3A3A3A]"}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {cuenta.status === "Pagado" ? (
            <StatusBadge status="completado" />
          ) : cuenta.status === "Vencido" ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Vencido {Math.abs(dias)}d
            </span>
          ) : cuenta.status === "Parcial" ? (
            <StatusBadge status="en riesgo" />
          ) : dias <= 3 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Vence en {dias}d
            </span>
          ) : (
            <StatusBadge status="pendiente" />
          )}
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={13} className="px-5 pb-4 pt-3">
            <div className="flex flex-wrap gap-6 items-start justify-between">
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                {/* Fila 1: montos */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Subtotal</p>
                  <p className="text-gray-200">{currency(cuenta.subtotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">IVA</p>
                  <p className="text-gray-200">{currency(cuenta.iva)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Saldo</p>
                  <p className={saldo > 0 ? "text-[#CC2229] font-bold" : "text-emerald-400 font-bold"}>{currency(saldo)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Vencimiento</p>
                  <p className="text-gray-200">{cuenta.vencimiento}</p>
                </div>
                {/* Fila 2: datos CFDI */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Estado SAT</p>
                  <p className={`text-xs font-semibold ${cuenta.estadoSAT === "Vigente" ? "text-emerald-400" : cuenta.estadoSAT === "Cancelado" ? "text-red-400" : "text-amber-400"}`}>{cuenta.estadoSAT || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Tipo</p>
                  <p className="text-gray-300 text-xs">{cuenta.tipo || "—"}</p>
                </div>
                {cuenta.serie && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Serie</p>
                    <p className="text-gray-300 text-xs">{cuenta.serie}</p>
                  </div>
                )}
                {cuenta.rfc && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">RFC Receptor</p>
                    <p className="text-gray-300 text-xs font-mono">{cuenta.rfc}</p>
                  </div>
                )}
                {cuenta.formaPago && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Forma pago</p>
                    <p className="text-gray-300 text-xs">{cuenta.formaPago}</p>
                  </div>
                )}
                {cuenta.banco && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">COSEC. TC</p>
                    <p className="text-gray-200 text-xs font-semibold">{cuenta.banco}</p>
                  </div>
                )}
                {cuenta.uuid && (
                  <div className="w-full">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">UUID</p>
                    <p className="text-gray-500 text-[10px] font-mono break-all">{cuenta.uuid}</p>
                  </div>
                )}
                {cuenta.uuidRelacion && (
                  <div className="w-full">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">UUID Relación</p>
                    <p className="text-gray-500 text-[10px] font-mono break-all">{cuenta.uuidRelacion}</p>
                  </div>
                )}
                {cuenta.notas && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Notas</p>
                    <p className="text-gray-400 text-xs max-w-[260px]">{cuenta.notas}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                {cuenta.abonos && cuenta.abonos.length > 0 && (
                  <div className="text-xs text-gray-500 space-y-1 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Abonos</p>
                    {cuenta.abonos.map((a, i) => (
                      <p key={i} className="text-gray-400">
                        {a.fecha} · <span className="text-emerald-400 font-semibold">{currency(a.monto)}</span>
                        {a.referencia && <span className="text-gray-600"> · {a.referencia}</span>}
                      </p>
                    ))}
                  </div>
                )}
                {cuenta.programacionId && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 mb-1 w-fit">
                    <Link2 size={10} />
                    Origen: Programación
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  {cuenta.status !== "Pagado" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAbono(cuenta); }}
                      className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      {kind === "cxc" ? "Registrar cobro" : "Registrar pago"}
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(cuenta); }}
                    className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-blue-500/50 hover:text-blue-400 cursor-pointer"
                  >
                    <Pencil size={12} />
                    Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(cuenta); }}
                    className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-red-500/50 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SatAccountsPage({ kind }: { kind: SatDownloadKind }) {
  const isCxc = kind === "cxc";
  const collection = isCxc ? COLLECTIONS.cuentasPorCobrar : COLLECTIONS.cuentasPorPagar;

  const [clientesList, setClientesList] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cuenta | null>(null);
  const [abonoTarget, setAbonoTarget] = useState<Cuenta | null>(null);
  const [showCargaMasiva, setShowCargaMasiva] = useState(false);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterMes, setFilterMes] = useState("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rawCuentas = useCollection<Cuenta>(collection);
  const cuentas = useMemo(
    () => rawCuentas.map((c) => ({ ...c, status: computeStatus(c) })),
    [rawCuentas],
  );

  const rawProgramaciones = useCollectionRaw<{ cliente?: string }>(COLLECTIONS.programaciones);
  useEffect(() => {
    const unicos = Array.from(new Set(rawProgramaciones.map((p) => p.cliente).filter(Boolean))) as string[];
    setClientesList(unicos.sort());
  }, [rawProgramaciones]);

  function showToast(type: "success" | "error", title: string, msg: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message: msg } }));
  }

  const existingUuids = useMemo(
    () => new Set(cuentas.map((c) => c.uuid?.trim().toUpperCase()).filter((u): u is string => !!u)),
    [cuentas],
  );

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>();
    cuentas.forEach((c) => {
      const iso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
      set.add(iso.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [cuentas]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return cuentas.filter((c) => {
      if (filterStatus !== "todos" && c.status.toLowerCase() !== filterStatus) return false;
      if (filterMes !== "todos") {
        const iso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
        if (!iso.startsWith(filterMes)) return false;
      }
      if (!q) return true;
      return (
        c.contraparte.toLowerCase().includes(q) ||
        c.folio.toLowerCase().includes(q) ||
        (c.concepto ?? "").toLowerCase().includes(q) ||
        (c.uuid ?? "").toLowerCase().includes(q) ||
        (c.rfc ?? "").toLowerCase().includes(q) ||
        (c.banco ?? "").toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const toIso = (f: string) => f.includes("/") ? displayToISO(f) : f;
      return toIso(b.fecha).localeCompare(toIso(a.fecha));
    });
  }, [cuentas, query, filterStatus, filterMes]);

  // KPIs
  const totalPendiente = filtered.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0);
  const totalCobrado = filtered.reduce((s, c) => s + c.montoPagado, 0);
  const vencidos = filtered.filter((c) => c.status === "Vencido").length;
  const proximos = filtered.filter((c) => c.status === "Pendiente" && diasVencimiento(c.vencimiento) <= 7 && diasVencimiento(c.vencimiento) >= 0).length;

  async function handleSave(data: Omit<Cuenta, "id" | "abonos" | "planta">) {
    if (editing) {
      const updated: Cuenta = { ...editing, ...data };
      const { id: _id, ...rest } = updated;
      await upsertDocument(collection, editing.id!, withPlantaTag(rest));
      showToast("success", "Registro actualizado", `${data.contraparte} · ${data.folio || "Sin folio"}`);
      setEditing(null);
    } else {
      const id = Date.now().toString();
      await upsertDocument(collection, id, withPlantaTag({ ...data, abonos: [] }));
      showToast("success", isCxc ? "Cuenta por cobrar agregada" : "Cuenta por pagar agregada", `${data.contraparte} · ${data.folio || "Sin folio"}`);
    }
  }

  async function handleDelete(cuenta: Cuenta) {
    if (!confirm("¿Eliminar este registro?")) return;
    setSelected((s) => { const n = new Set(s); n.delete(cuenta.id!); return n; });
    await deleteDocument(collection, cuenta.id!);
    showToast("success", "Registro eliminado", `${cuenta.contraparte} · ${cuenta.folio || "Sin folio"}`);
  }

  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} registro${selected.size !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return;
    const ids = Array.from(selected);
    setSelected(new Set());
    await Promise.all(ids.map((id) => deleteDocument(collection, id)));
    showToast("success", "Registros eliminados", `${ids.length} documento${ids.length !== 1 ? "s" : ""} eliminado${ids.length !== 1 ? "s" : ""}`);
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((s) => { const n = new Set(s); checked ? n.add(id) : n.delete(id); return n; });
  }

  const filteredIds = filtered.map((c) => c.id!).filter(Boolean);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));

  function toggleSelectAll(checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      filteredIds.forEach((id) => checked ? n.add(id) : n.delete(id));
      return n;
    });
  }

  async function handleAbono(cuenta: Cuenta, abono: Abono) {
    const nuevoMontoPagado = cuenta.montoPagado + abono.monto;
    const nuevosAbonos = [...(cuenta.abonos ?? []), abono];
    const updatedCuenta: Cuenta = {
      ...cuenta,
      montoPagado: nuevoMontoPagado,
      abonos: nuevosAbonos,
      status: computeStatus({ ...cuenta, montoPagado: nuevoMontoPagado }),
    };
    const id = cuenta.id!;
    const { id: _cid, ...cuentaData } = updatedCuenta;
    await upsertDocument(collection, id, withPlantaTag(cuentaData));
    showToast("success", isCxc ? "Cobro registrado" : "Pago registrado", `${currency(abono.monto)} a ${cuenta.contraparte}`);
  }

  async function handleCargaMasiva(records: Omit<Cuenta, "id" | "planta">[]) {
    const items: Cuenta[] = records.map((r) => {
      const id = r.uuid?.trim()
        ? r.uuid.trim().replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()
        : Date.now().toString() + Math.random().toString(36).slice(2);
      return { ...r, id, abonos: r.abonos ?? [], status: computeStatus(r as Cuenta) };
    });
    await Promise.all(
      items.map((item) => {
        const { id, ...data } = item;
        return upsertDocument(collection, id!, withPlantaTag({ ...data }));
      })
    );
    showToast("success", "Carga masiva completada", `${items.length} registros importados`);
  }

  const contraparteLabel = isCxc ? "Nombre Receptor" : "Nombre Emisor";

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{filtered.length} documentos</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCargaMasiva(true)}
            className="flex items-center gap-2 border border-[#3A3A3A] bg-[#1A1A1A] hover:border-purple-500/50 hover:text-purple-300 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Sparkles size={15} />
            Carga masiva con IA
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            <Plus size={16} />
            {isCxc ? "Nueva cuenta por cobrar" : "Nueva cuenta por pagar"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={isCxc ? "Por cobrar" : "Por pagar"}
          value={currency(totalPendiente)}
          icon={isCxc ? TrendingUp : TrendingDown}
          iconColor={isCxc ? "text-emerald-400" : "text-[#CC2229]"}
          subtitle="Saldo pendiente"
        />
        <KPICard
          title={isCxc ? "Cobrado" : "Pagado"}
          value={currency(totalCobrado)}
          icon={DollarSign}
          iconColor="text-blue-400"
          subtitle="En periodo filtrado"
        />
        <KPICard
          title="Vencidos"
          value={String(vencidos)}
          icon={AlertTriangle}
          iconColor={vencidos > 0 ? "text-red-400" : "text-gray-500"}
          subtitle="Documentos sin pagar"
        />
        <KPICard
          title="Vencen pronto"
          value={String(proximos)}
          icon={Clock}
          iconColor={proximos > 0 ? "text-orange-400" : "text-gray-500"}
          subtitle="En los próximos 7 días"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
          {[["todos", "Todos"], ["pendiente", "Pendiente"], ["parcial", "Parcial"], ["vencido", "Vencido"], ["pagado", "Pagado"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${filterStatus === v ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {/* Month filter */}
        <select
          value={filterMes}
          onChange={(e) => setFilterMes(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
        >
          <option value="todos">Todos los meses</option>
          {mesesDisponibles.map((m) => (
            <option key={m} value={m}>{mesLabel(`${m}-01`)}</option>
          ))}
        </select>
        {/* Search */}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${contraparteLabel.toLowerCase()}, folio…`}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-56 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#CC2229]/40 rounded-xl px-4 py-2.5">
          <span className="text-sm text-gray-300 font-medium">{selected.size} seleccionado{selected.size !== 1 ? "s" : ""}</span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={13} /> Eliminar seleccionados
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer ml-auto"
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                <th className="pl-4 pr-2 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-[#4A4A4A] bg-[#2A2A2A] accent-[#CC2229] cursor-pointer"
                  />
                </th>
                {["SAT", "Tipo", "Fecha", "Folio", contraparteLabel, "RFC Receptor", "COSEC. TC", "Concepto", "Total", "Progreso", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-14 text-center text-sm text-gray-600">
                    {cuentas.length === 0
                      ? `Sin ${isCxc ? "cuentas por cobrar" : "cuentas por pagar"} registradas`
                      : "Sin resultados para el filtro actual"}
                  </td>
                </tr>
              ) : filtered.map((c, i) => (
                <CuentaRow
                  key={c.id ?? i}
                  cuenta={c}
                  kind={kind}
                  selected={selected.has(c.id!)}
                  onSelect={toggleSelect}
                  onAbono={setAbonoTarget}
                  onEdit={(c) => { setEditing(c); setShowForm(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDrawer open={showForm} kind={kind} clientesList={clientesList} initial={editing ?? undefined} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />
      <AbonoDrawer cuenta={abonoTarget} kind={kind} onClose={() => setAbonoTarget(null)} onSave={handleAbono} />
      <CargaMasivaModal open={showCargaMasiva} kind={kind} existingUuids={existingUuids} onClose={() => setShowCargaMasiva(false)} onConfirm={handleCargaMasiva} />
    </div>
  );
}
