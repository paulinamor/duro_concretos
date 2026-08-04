"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileDown,
  FileSpreadsheet,
  FileText,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Table2,
  Trash2,
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
import { todayCST } from "@/lib/dateUtils";

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

const todayISO = todayCST;

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

function abonosEnMes(abonos: Abono[] | undefined, mes: string): Abono[] {
  if (!abonos || mes === "todos") return abonos ?? [];
  return abonos.filter((a) => {
    const f = a.fecha?.includes("/") ? displayToISO(a.fecha) : (a.fecha ?? "");
    return f.startsWith(mes);
  });
}

function computeStatus(cuenta: Cuenta): Cuenta["status"] {
  // Derive the real amount paid: prefer montoPagado but fall back to sum of abonos
  // so that records imported via bulk-load (where montoPagado may be 0 but abonos
  // already contain the full payment) are not misclassified.
  //
  // Use Number() coercion to handle Firestore values that may arrive as strings,
  // and round to 2 decimal places to eliminate floating-point precision errors
  // that accumulate when multiple abono additions make montoPagado slightly less
  // than total (e.g. 121474.99999999999 instead of 121475), causing a non-zero
  // saldo that would incorrectly classify a fully-paid record as "Parcial".
  const total = Math.round(Number(cuenta.total) * 100) / 100;
  const sumaAbonos = Math.round((cuenta.abonos ?? []).reduce((sum, a) => sum + (Math.round(Number(a.monto) * 100) / 100), 0) * 100) / 100;
  const rawMontoPagado = Math.round(Number(cuenta.montoPagado ?? 0) * 100) / 100;
  const montoPagado = Math.max(rawMontoPagado, sumaAbonos);
  const saldo = Math.round((total - montoPagado) * 100) / 100;
  if (saldo <= 0.01) return "Pagado";
  if (montoPagado > 0) return "Parcial";
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
        vencimiento: initial?.vencimiento || isoToDisplay(form.fecha),
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

type ExhibicionForm = { fecha: string; monto: string; referencia: string };

function AbonoDrawer({
  cuenta,
  kind,
  onClose,
  onSave,
}: {
  cuenta: Cuenta | null;
  kind: SatDownloadKind;
  onClose: () => void;
  onSave: (cuenta: Cuenta, abonos: Abono[]) => Promise<void>;
}) {
  const [exhibiciones, setExhibiciones] = useState<ExhibicionForm[]>([
    { fecha: todayISO(), monto: "", referencia: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cuenta) setExhibiciones([{ fecha: todayISO(), monto: "", referencia: "" }]);
  }, [cuenta]);

  if (!cuenta || cuenta.estadoSAT === "Cancelado") return null;
  const c = cuenta;

  const total = Math.round(Number(c.total) * 100) / 100;
  const sumaAbonos = Math.round(
    (c.abonos ?? []).reduce((s, a) => s + Math.round(Number(a.monto) * 100) / 100, 0) * 100
  ) / 100;
  const rawPagado = Math.round(Number(c.montoPagado ?? 0) * 100) / 100;
  const realPagado = Math.max(rawPagado, sumaAbonos);
  const saldo = Math.round((total - realPagado) * 100) / 100;

  const totalNuevo = Math.round(
    exhibiciones.reduce((s, ex) => s + (parseFloat(ex.monto) || 0), 0) * 100
  ) / 100;

  function updateEx(i: number, k: keyof ExhibicionForm, v: string) {
    setExhibiciones((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [k]: v } : ex)));
  }
  function addExhibicion() {
    setExhibiciones((prev) => [...prev, { fecha: todayISO(), monto: "", referencia: "" }]);
  }
  function removeExhibicion(i: number) {
    if (exhibiciones.length <= 1) return;
    setExhibiciones((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const valid = exhibiciones.filter((ex) => parseFloat(ex.monto) > 0);
    if (valid.length === 0) return;
    setSaving(true);
    try {
      await onSave(
        c,
        valid.map((ex) => ({
          fecha: isoToDisplay(ex.fecha),
          monto: parseFloat(ex.monto),
          referencia: ex.referencia,
        })),
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const actionLabel = kind === "cxc" ? "Registrar cobro" : "Registrar pago";
  const multi = exhibiciones.length > 1;

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
          {/* Resumen de saldo */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total factura</span>
              <span className="font-semibold text-gray-900">{currency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ya {kind === "cxc" ? "cobrado" : "pagado"}</span>
              <span className="text-emerald-600 font-semibold">{currency(realPagado)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Saldo pendiente</span>
              <span className="font-bold text-[#CC2229]">{currency(saldo)}</span>
            </div>
          </div>

          {/* Exhibiciones */}
          <div className="space-y-3">
            {exhibiciones.map((ex, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                {multi && (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      Exhibición {i + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeExhibicion(i)}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div>
                  <label className={lbl}>Monto ($)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={ex.monto}
                    onChange={(e) => updateEx(i, "monto", e.target.value)}
                    placeholder="0.00" className={inp}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Fecha</label>
                    <input type="date" value={ex.fecha} onChange={(e) => updateEx(i, "fecha", e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Referencia</label>
                    <input type="text" value={ex.referencia} onChange={(e) => updateEx(i, "referencia", e.target.value)} placeholder="Opcional" className={inp} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Agregar exhibición */}
          <button
            type="button"
            onClick={addExhibicion}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-[#CC2229]/50 hover:text-[#CC2229] transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Agregar exhibición
          </button>

          {/* Total cuando hay más de 1 */}
          {multi && totalNuevo > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-800">
                Total a registrar ({exhibiciones.length} exhibiciones)
              </span>
              <span className="text-sm font-bold text-emerald-700">{currency(totalNuevo)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:text-gray-900 transition-colors cursor-pointer">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || totalNuevo <= 0}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
          >
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <CheckCircle2 size={15} />}
            {saving ? "Guardando..." : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Abono Drawer ────────────────────────────────────────────────────────

function EditAbonoDrawer({
  target,
  kind,
  onClose,
  onSave,
}: {
  target: { cuenta: Cuenta; index: number } | null;
  kind: SatDownloadKind;
  onClose: () => void;
  onSave: (cuenta: Cuenta, index: number, abono: Abono) => Promise<void>;
}) {
  const abono = target?.cuenta.abonos?.[target.index];
  const [form, setForm] = useState({ fecha: todayISO(), monto: "", referencia: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!abono) return;
    setForm({
      fecha: abono.fecha.includes("/") ? displayToISO(abono.fecha) : abono.fecha,
      monto: String(abono.monto),
      referencia: abono.referencia ?? "",
    });
  }, [target, abono]);

  if (!target || !abono) return null;
  const { cuenta, index } = target;

  // Saldo disponible = lo que queda + lo que tenía este abono
  const saldoDisponible = cuenta.total - (cuenta.montoPagado - abono.monto);
  const montoNum = parseFloat(form.monto) || 0;

  async function handleSave() {
    if (montoNum <= 0) return;
    setSaving(true);
    try {
      await onSave(cuenta, index, {
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
  const actionLabel = kind === "cxc" ? "Editar cobro" : "Editar pago";

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
              <span className="text-gray-500">Máximo permitido</span>
              <span className="text-amber-600 font-semibold">{currency(saldoDisponible)}</span>
            </div>
          </div>
          <div>
            <label className={lbl}>Fecha del {kind === "cxc" ? "cobro" : "pago"}</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inp} />
          </div>
          <div>
            <label className={lbl}>Monto ($)</label>
            <input type="number" min="0" step="0.01" max={saldoDisponible} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
            <p className="text-[10px] text-gray-400 mt-1">Máximo: {currency(saldoDisponible)}</p>
          </div>
          <div>
            <label className={lbl}>Referencia / No. transferencia</label>
            <input type="text" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="Opcional" className={inp} />
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:text-gray-900 transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || montoNum <= 0 || montoNum > saldoDisponible} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-60 cursor-pointer">
            {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Pencil size={15} />}
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
  onEditAbono,
  onDeleteAbono,
}: {
  cuenta: Cuenta;
  kind: SatDownloadKind;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAbono: (c: Cuenta) => void;
  onEdit: (c: Cuenta) => void;
  onDelete: (c: Cuenta) => void;
  onEditAbono: (c: Cuenta, index: number) => void;
  onDeleteAbono: (c: Cuenta, index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const saldo = cuenta.total - cuenta.montoPagado;
  const porcentaje = cuenta.total > 0 ? Math.min(100, (cuenta.montoPagado / cuenta.total) * 100) : 0;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${selected ? "bg-[#CC2229]/8" : expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="pl-3 pr-1 py-2.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(cuenta.id!, e.target.checked)}
            className="h-4 w-4 rounded border-[#4A4A4A] bg-[#2A2A2A] accent-[#CC2229] cursor-pointer"
          />
        </td>
        <td className="px-2 py-2.5 text-gray-500 text-xs whitespace-nowrap">{isoToDisplay(cuenta.fecha.includes("/") ? displayToISO(cuenta.fecha) : cuenta.fecha)}</td>
        <td className="px-2 py-2.5 text-[#CC2229] font-mono text-xs whitespace-nowrap">{cuenta.folio || "—"}</td>
        <td className="px-2 py-2.5 max-w-[200px]">
          <p className="text-white font-semibold text-sm truncate">{cuenta.contraparte}</p>
          {cuenta.rfc && <p className="text-gray-500 text-[10px] font-mono truncate">{cuenta.rfc}</p>}
        </td>
        <td className="px-2 py-2.5 text-white font-semibold tabular-nums text-sm whitespace-nowrap">{currency(cuenta.total)}</td>
        <td className="px-2 py-2.5 text-sm tabular-nums whitespace-nowrap">
          {(cuenta.total - cuenta.montoPagado) > 0
            ? <span className="font-semibold text-amber-400">{currency(cuenta.total - cuenta.montoPagado)}</span>
            : <span className="text-emerald-500 text-xs font-semibold">✓ Liquidada</span>
          }
        </td>
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-1.5 min-w-[72px]">
            <div className="flex-1 h-1.5 rounded-full bg-[#3A3A3A] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${porcentaje >= 100 ? "bg-emerald-500" : porcentaje > 0 ? "bg-amber-500" : "bg-[#3A3A3A]"}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 tabular-nums w-7 text-right">{Math.round(porcentaje)}%</span>
          </div>
        </td>
        <td className="px-2 py-2.5">
          {cuenta.status === "Pagado" ? (
            <StatusBadge status="completado" />
          ) : cuenta.status === "Parcial" ? (
            <StatusBadge status="revision" />
          ) : (
            <StatusBadge status="pendiente" />
          )}
        </td>
        <td className="px-2 py-2.5 text-gray-500 text-xs">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={9} className="px-5 pb-4 pt-3">
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
                {cuenta.concepto && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Concepto</p>
                    <p className="text-gray-300 text-xs max-w-[280px]">{cuenta.concepto}</p>
                  </div>
                )}
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
                  <div className="text-xs text-gray-500 space-y-1.5 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Abonos</p>
                    {cuenta.abonos.map((a, i) => (
                      <div key={i} className="flex items-center justify-end gap-2">
                        <p className="text-gray-400">
                          {a.fecha} · <span className="text-emerald-400 font-semibold">{currency(a.monto)}</span>
                          {a.referencia && <span className="text-gray-600"> · {a.referencia}</span>}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditAbono(cuenta, i); }}
                          title="Editar este abono"
                          className="shrink-0 text-gray-600 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteAbono(cuenta, i); }}
                          title="Revertir este abono"
                          className="shrink-0 text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
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
                  {cuenta.status !== "Pagado" && cuenta.estadoSAT !== "Cancelado" && (
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

// ─── Excel View ───────────────────────────────────────────────────────────────

// Fixed palette — 12 completely distinct pastels, one per calendar month (index 0=Jan…11=Dec).
// Each color sits in its own 30° hue sector so no two months ever look similar:
//   0  Ene → rojo-coral   (H≈0°)
//   1  Feb → naranja      (H≈30°)
//   2  Mar → amarillo     (H≈60°)
//   3  Abr → lima         (H≈90°)
//   4  May → verde        (H≈120°)
//   5  Jun → menta/teal   (H≈155°)
//   6  Jul → azul cielo   (H≈205°)
//   7  Ago → azul-violeta (H≈235°)
//   8  Sep → lavanda      (H≈265°)
//   9  Oct → violeta-rosa (H≈295°)
//  10  Nov → magenta      (H≈325°)
//  11  Dic → oro/ámbar    (neutro cálido — rompe el ciclo para evitar confusión con Enero)
const MONTH_COLORS: Record<number, { bg: string; hover: string; label: string }> = {
  0:  { bg: "#FFB3B3", hover: "#EE9E9E", label: "Enero" },
  1:  { bg: "#FFBE80", hover: "#EEAE6A", label: "Febrero" },
  2:  { bg: "#FFF4A0", hover: "#EEE388", label: "Marzo" },
  3:  { bg: "#C8F0A0", hover: "#B4DF8A", label: "Abril" },
  4:  { bg: "#A0E0A0", hover: "#8CCF8C", label: "Mayo" },
  5:  { bg: "#A0E0D0", hover: "#8CCFBB", label: "Junio" },
  6:  { bg: "#A0C8F0", hover: "#8CB4DF", label: "Julio" },
  7:  { bg: "#A0A8F0", hover: "#8C94DF", label: "Agosto" },
  8:  { bg: "#BCA0F0", hover: "#A88CDF", label: "Septiembre" },
  9:  { bg: "#D8A0F0", hover: "#C48CDF", label: "Octubre" },
  10: { bg: "#F0A0D8", hover: "#DF8CC4", label: "Noviembre" },
  11: { bg: "#E0CC88", hover: "#CFBB72", label: "Diciembre" },
};

// Derive which calendar month (0-11) an account was paid in.
// Uses the month of the LATEST abono with monto > 0.
// Returns null if no real payments exist (= row gets neutral/no color).
function paymentMonthIndex(cuenta: Cuenta): number | null {
  // Only consider abonos that represent an actual payment
  const realAbonos = (cuenta.abonos ?? []).filter((a) => Number(a.monto) > 0);
  if (realAbonos.length === 0) return null;
  const sorted = [...realAbonos].sort((a, b) => {
    const fa = a.fecha?.includes("/") ? displayToISO(a.fecha) : (a.fecha ?? "");
    const fb = b.fecha?.includes("/") ? displayToISO(b.fecha) : (b.fecha ?? "");
    return fb.localeCompare(fa); // descending → first is latest
  });
  const iso = sorted[0].fecha?.includes("/") ? displayToISO(sorted[0].fecha) : (sorted[0].fecha ?? "");
  const m = parseInt(iso.slice(5, 7), 10);
  return isNaN(m) ? null : m - 1; // 0-indexed
}

function ExcelTable({
  filtered,
  kind,
  onAbono,
  onEdit,
  onDelete,
  onDeleteAbono,
}: {
  filtered: Cuenta[];
  kind: SatDownloadKind;
  onAbono: (c: Cuenta) => void;
  onEdit: (c: Cuenta) => void;
  onDelete: (c: Cuenta) => void;
  onDeleteAbono: (c: Cuenta, index: number) => void;
}) {
  const isCxc = kind === "cxc";
  const contraparteLabel = isCxc ? "Nombre Receptor" : "Nombre Emisor";

  function rowStyle(cuenta: Cuenta): { backgroundColor: string } {
    if (cuenta.estadoSAT === "Cancelado") return { backgroundColor: "#BB6262" };
    const idx = paymentMonthIndex(cuenta);
    if (idx !== null) return { backgroundColor: MONTH_COLORS[idx].bg };
    return { backgroundColor: "#F5F5F5" }; // sin pago = neutro
  }

  // Build legend from payment months that actually appear in filtered data
  const paymentMonthsInView = useMemo(() => {
    const seen = new Map<number, string>(); // idx → label
    filtered.forEach((c) => {
      if (c.estadoSAT === "Cancelado") return;
      const idx = paymentMonthIndex(c);
      if (idx !== null && !seen.has(idx)) seen.set(idx, MONTH_COLORS[idx].label);
    });
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const rfcLabel = isCxc ? "RFC Receptor" : "RFC Emisor";
  const abonoLabel = isCxc ? "Abono" : "Pagado";
  // Columns matching original XLSX order:
  // Estado SAT | Tipo | Fecha Emision | Serie | Folio | RFC | Nombre | SubTotal | IVA 16% | Total | FormaDePago | COSEC. TC | Abono | Saldo | Actions
  const numCols = 15;

  return (
    <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">

      {/* ── Legend bar ─────────────────────────────────────────────────────────
          Shown ABOVE the table so it's always visible without scrolling.
          Color = month payment was received (latest abono date).              */}
      <div className="px-4 py-3 bg-[#EEF4FB] border-b-2 border-[#9FC5E8]">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#1E5FA6] mb-2">
          Color de fila = mes del último cobro / pago
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Payment months present in current view */}
          {paymentMonthsInView.map(([idx, label]) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded border border-black/15 px-2.5 py-1"
              style={{ backgroundColor: MONTH_COLORS[idx].bg }}
            >
              <span className="text-[11px] font-bold text-gray-800">{label}</span>
              <span className="text-[10px] text-gray-600">— cobrado/pagado</span>
            </div>
          ))}
          {paymentMonthsInView.length === 0 && (
            <span className="text-[10px] text-gray-400 italic self-center">Sin pagos registrados en esta vista</span>
          )}
          {/* Fixed indicators */}
          <div className="flex items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1 bg-[#F5F5F5] ml-auto">
            <span className="text-[11px] font-semibold text-gray-500">Sin pago</span>
            <span className="text-[10px] text-gray-400">— pendiente de cobro</span>
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#8a4444] px-2.5 py-1 bg-[#BB6262]">
            <span className="text-[11px] font-bold text-white">Cancelado SAT</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: "1200px" }}>
          <thead>
            <tr className="bg-[#CFE2F3] border-b-2 border-[#9FC5E8]">
              {[
                { label: "Estado SAT", right: false },
                { label: "Tipo", right: false },
                { label: "Fecha Emision", right: false },
                { label: "Serie", right: false },
                { label: "Folio", right: false },
                { label: rfcLabel, right: false },
                { label: contraparteLabel, right: false },
                { label: "SubTotal", right: true },
                { label: "IVA 16%", right: true },
                { label: "Total", right: true },
                { label: "FormaDePago", right: false },
                { label: "COSEC. TC", right: false },
                { label: abonoLabel, right: true },
                { label: "Saldo", right: true },
                { label: "", right: false },
              ].map(({ label, right }) => (
                <th
                  key={label}
                  className={`px-2 py-2 font-bold text-gray-800 whitespace-nowrap border-r border-[#A8C8E8] last:border-r-0 ${right ? "text-right" : "text-left"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={numCols} className="px-4 py-14 text-center text-gray-500">
                  Sin resultados para el filtro actual
                </td>
              </tr>
            ) : (() => {
              // Group by emission month (same as XLSX organizes by ENERO, FEBRERO, etc.)
              const groups: { month: string; items: Cuenta[] }[] = [];
              filtered.forEach((c) => {
                const iso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
                const month = iso.slice(0, 7);
                const last = groups[groups.length - 1];
                if (!last || last.month !== month) groups.push({ month, items: [c] });
                else last.items.push(c);
              });

              return groups.flatMap(({ month, items }) => {
                const monthLbl = mesLabel(`${month}-01`).toUpperCase();
                const grpTotal = items.reduce((s, c) => s + c.total, 0);
                const grpPagado = items.reduce((s, c) => s + c.montoPagado, 0);
                const grpSaldo = Math.round((grpTotal - grpPagado) * 100) / 100;

                return [
                  // Month group header — matches Excel's month grouping rows
                  <tr key={`grp-${month}`} className="bg-[#CFE2F3] border-y-2 border-[#9FC5E8]">
                    <td colSpan={numCols} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-gray-800 tracking-wide">{monthLbl}</span>
                        <div className="flex items-center gap-5 text-[10px] text-gray-600 font-medium">
                          <span>{items.length} {items.length === 1 ? "factura" : "facturas"}</span>
                          <span>Total: <strong className="text-gray-800">{currency(grpTotal)}</strong></span>
                          <span className="text-emerald-700">{isCxc ? "Cobrado" : "Pagado"}: <strong>{currency(grpPagado)}</strong></span>
                          <span className="text-red-700">Saldo: <strong>{currency(grpSaldo)}</strong></span>
                        </div>
                      </div>
                    </td>
                  </tr>,
                  // Data rows
                  ...items.map((c, i) => {
                    // Use same rounding logic as computeStatus to avoid FP display bugs
                    const total = Math.round(Number(c.total) * 100) / 100;
                    const sumaAbonos = Math.round(
                      (c.abonos ?? []).reduce((s, a) => s + Math.round(Number(a.monto) * 100) / 100, 0) * 100
                    ) / 100;
                    const rawPagado = Math.round(Number(c.montoPagado ?? 0) * 100) / 100;
                    const realPagado = Math.max(rawPagado, sumaAbonos);
                    const saldo = Math.round((total - realPagado) * 100) / 100;
                    // currency() rounds to 0 decimals, so anything < $0.50 displays "$0".
                    // Use the same threshold to avoid rows showing "$0 saldo" without "✓ Liquidada".
                    const isLiquidada = saldo < 0.50;
                    const esCancelada = c.estadoSAT === "Cancelado";
                    // Last real-payment abono index (for revert button)
                    const realAbonoIdx = (() => {
                      const ab = c.abonos ?? [];
                      for (let j = ab.length - 1; j >= 0; j--) {
                        if (Number(ab[j].monto) > 0) return j;
                      }
                      return -1;
                    })();
                    const pmIdx = paymentMonthIndex(c);
                    const rowTitle =
                      esCancelada
                        ? "Cancelado en el SAT"
                        : pmIdx !== null
                        ? `Último ${isCxc ? "cobro" : "pago"}: ${MONTH_COLORS[pmIdx].label}`
                        : `Sin ${isCxc ? "cobro" : "pago"} registrado`;
                    return (
                      <tr
                        key={c.id ?? `${month}-${i}`}
                        style={rowStyle(c)}
                        title={rowTitle}
                        className="border-b border-black/10 cursor-pointer transition-colors hover:brightness-95"
                        onClick={() => onEdit(c)}
                      >
                        {/* Estado SAT */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10 font-medium">
                          {c.estadoSAT}
                        </td>
                        {/* Tipo */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10">
                          {c.tipo || "Factura"}
                        </td>
                        {/* Fecha Emision */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10">
                          {isoToDisplay(c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha)}
                        </td>
                        {/* Serie */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10 text-center">
                          {c.serie || "F"}
                        </td>
                        {/* Folio */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10 font-mono font-semibold">
                          {c.folio || "—"}
                        </td>
                        {/* RFC */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10 font-mono">
                          {c.rfc || "—"}
                        </td>
                        {/* Nombre */}
                        <td className="px-2 py-1 border-r border-black/10 max-w-[180px]">
                          <p className="font-semibold truncate">{c.contraparte}</p>
                        </td>
                        {/* SubTotal */}
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap border-r border-black/10">
                          {currency(c.subtotal)}
                        </td>
                        {/* IVA 16% */}
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap border-r border-black/10">
                          {currency(c.iva)}
                        </td>
                        {/* Total */}
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap border-r border-black/10 font-semibold">
                          {currency(c.total)}
                        </td>
                        {/* FormaDePago */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10">
                          {c.formaPago || "—"}
                        </td>
                        {/* COSEC. TC */}
                        <td className="px-2 py-1 whitespace-nowrap border-r border-black/10">
                          {c.banco || "—"}
                        </td>
                        {/* Abono */}
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap border-r border-black/10">
                          {esCancelada ? "—" : realPagado > 0 ? currency(realPagado) : "—"}
                        </td>
                        {/* Saldo */}
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap border-r border-black/10 font-semibold">
                          {esCancelada
                            ? <span className="inline-flex items-center bg-[#7a2a2a] text-white text-[10px] font-bold px-2 py-0.5 rounded">Cancelada</span>
                            : isLiquidada
                            ? "✓ Liquidada"
                            : currency(saldo)}
                        </td>
                        {/* Actions */}
                        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {/* Cobrar: only when not cancelled and not fully paid */}
                            {!esCancelada && !isLiquidada && (
                              <button
                                onClick={() => onAbono(c)}
                                title={isCxc ? "Registrar cobro" : "Registrar pago"}
                                className="p-1 rounded text-gray-700 hover:bg-black/10 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                            {/* Revertir último cobro: for liquidadas with recorded abonos */}
                            {!esCancelada && isLiquidada && realAbonoIdx >= 0 && (
                              <button
                                onClick={() => onDeleteAbono(c, realAbonoIdx)}
                                title="Revertir último cobro"
                                className="p-1 rounded text-amber-700 hover:bg-black/10 transition-colors cursor-pointer"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => onEdit(c)}
                              title="Editar"
                              className="p-1 rounded text-gray-700 hover:bg-black/10 transition-colors cursor-pointer"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => onDelete(c)}
                              title="Eliminar"
                              className="p-1 rounded text-gray-700 hover:bg-black/10 transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                ];
              });
            })()}
          </tbody>
        </table>
      </div>
      {/* Footer count */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-t border-gray-200">
        <span className="text-[10px] text-gray-500">{filtered.length} {filtered.length === 1 ? "registro" : "registros"} · pasa el cursor sobre una fila para ver el mes de pago</span>
      </div>
    </div>
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
  const [editAbonoTarget, setEditAbonoTarget] = useState<{ cuenta: Cuenta; index: number } | null>(null);
  const [showCargaMasiva, setShowCargaMasiva] = useState(false);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterMes, setFilterMes] = useState("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"dark" | "excel">("excel");

  const rawCuentas = useCollection<Cuenta>(collection);
  const cuentas = useMemo(
    () => rawCuentas.map((c) => ({ ...c, status: computeStatus(c) })),
    [rawCuentas],
  );

  const rawClientes = useCollectionRaw<{ razonSocial?: string; nombreComercial?: string }>(COLLECTIONS.clientes);
  useEffect(() => {
    const nombres = rawClientes
      .flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean)) as string[];
    setClientesList(Array.from(new Set(nombres)).sort());
  }, [rawClientes]);

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
      // Filtro por status
      if (filterStatus !== "todos" && c.status.toLowerCase() !== filterStatus) return false;

      // Filtro por mes — siempre por fecha de EMISIÓN (devengado)
      if (filterMes !== "todos") {
        const iso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
        if (!iso.startsWith(filterMes)) return false;
      }

      // Búsqueda de texto
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
      const byFecha = toIso(b.fecha).localeCompare(toIso(a.fecha));
      if (byFecha !== 0) return byFecha;
      return b.folio.localeCompare(a.folio, undefined, { numeric: true });
    });
  }, [cuentas, query, filterStatus, filterMes]);

  // KPIs — facturas canceladas no cuentan en saldos ni conteos financieros
  const canceladas = filtered.filter((c) => c.estadoSAT === "Cancelado");
  const activas = filtered.filter((c) => c.estadoSAT !== "Cancelado");
  const totalFacturadoBruto = filtered.reduce((s, c) => s + c.total, 0);
  const totalCanceladas = canceladas.reduce((s, c) => s + c.total, 0);
  const totalFacturadoNeto = activas.reduce((s, c) => s + c.total, 0);
  const totalPendiente = activas.filter((c) => c.status !== "Pagado").reduce((s, c) => s + (c.total - c.montoPagado), 0);
  const totalCobrado = activas.reduce((s, c) => s + c.montoPagado, 0);

  // Cobrado en el período — suma de abonos de TODAS las cuentas activas (no canceladas).
  // Cuando hay mes filtrado: solo abonos cuya fecha cae en ese mes (aunque la factura sea de otro mes).
  // Cuando es "todos": suma de todos los abonos acumulados.
  const cuentasActivas = cuentas.filter((c) => c.estadoSAT !== "Cancelado");
  const cobradoEnMes = filterMes !== "todos"
    ? cuentasActivas.reduce((s, c) => s + abonosEnMes(c.abonos, filterMes).reduce((ss, a) => ss + Number(a.monto), 0), 0)
    : cuentasActivas.reduce((s, c) => s + (c.abonos ?? []).reduce((ss, a) => ss + Number(a.monto), 0), 0);

  // Desglose del cobrado en el mes filtrado:
  // cobradoMismoMes  = abonos con fecha en filterMes, de facturas EMITIDAS en filterMes
  // cobradoOtrosMeses = abonos con fecha en filterMes, de facturas emitidas en OTRO mes
  // Ambos usan cuentasActivas (todas las facturas) para no perder cobros de facturas de otros meses.
  // cobradoMismoMes + cobradoOtrosMeses == cobradoEnMes siempre que filterMes !== "todos".
  const cobradoMismoMes = filterMes !== "todos"
    ? cuentasActivas.reduce((s, c) => {
        const invIso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
        if (!invIso.startsWith(filterMes)) return s; // solo facturas emitidas en este mes
        return s + (c.abonos ?? [])
          .filter(a => {
            const iso = a.fecha?.includes("/") ? displayToISO(a.fecha) : (a.fecha ?? "");
            return iso.startsWith(filterMes) && Number(a.monto) > 0;
          })
          .reduce((ss, a) => ss + Number(a.monto), 0);
      }, 0)
    : 0;
  const cobradoOtrosMeses = filterMes !== "todos"
    ? cuentasActivas.reduce((s, c) => {
        const invIso = c.fecha.includes("/") ? displayToISO(c.fecha) : c.fecha;
        if (invIso.startsWith(filterMes)) return s; // solo facturas de OTROS meses
        return s + (c.abonos ?? [])
          .filter(a => {
            const iso = a.fecha?.includes("/") ? displayToISO(a.fecha) : (a.fecha ?? "");
            return iso.startsWith(filterMes) && Number(a.monto) > 0;
          })
          .reduce((ss, a) => ss + Number(a.monto), 0);
      }, 0)
    : 0;

  // Pendiente del período — saldo sin cobrar de facturas emitidas en el mes filtrado (activas, no pagadas)
  const pendienteDelMes = totalPendiente;

  const sinPagar = activas.filter((c) => c.status === "Pendiente").length;

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

  async function handleAbono(cuenta: Cuenta, abonos: Abono[]) {
    const montoTotal = Math.round(abonos.reduce((s, a) => s + Number(a.monto), 0) * 100) / 100;
    const nuevoMontoPagado = Math.round((Number(cuenta.montoPagado) + montoTotal) * 100) / 100;
    const nuevosAbonos = [...(cuenta.abonos ?? []), ...abonos];
    const updatedCuenta: Cuenta = {
      ...cuenta,
      montoPagado: nuevoMontoPagado,
      abonos: nuevosAbonos,
      status: computeStatus({ ...cuenta, montoPagado: nuevoMontoPagado, abonos: nuevosAbonos }),
    };
    const id = cuenta.id!;
    const { id: _cid, ...cuentaData } = updatedCuenta;
    await upsertDocument(collection, id, withPlantaTag(cuentaData));
    const label = abonos.length > 1
      ? `${abonos.length} exhibiciones · ${currency(montoTotal)}`
      : currency(abonos[0].monto);
    showToast("success", isCxc ? "Cobro registrado" : "Pago registrado", `${label} · ${cuenta.contraparte}`);
  }

  async function handleDeleteAbono(cuenta: Cuenta, index: number) {
    const abono = cuenta.abonos?.[index];
    if (!abono) return;
    if (!confirm(`¿Revertir el ${isCxc ? "cobro" : "pago"} de ${currency(abono.monto)} del ${abono.fecha}?`)) return;
    const nuevosAbonos = (cuenta.abonos ?? []).filter((_, i) => i !== index);
    const nuevoMontoPagado = Math.round(nuevosAbonos.reduce((sum, a) => sum + Number(a.monto), 0) * 100) / 100;
    const updatedCuenta: Cuenta = {
      ...cuenta,
      abonos: nuevosAbonos,
      montoPagado: nuevoMontoPagado,
      status: computeStatus({ ...cuenta, montoPagado: nuevoMontoPagado }),
    };
    const { id, ...data } = updatedCuenta;
    await upsertDocument(collection, id!, withPlantaTag(data));
    showToast("success", isCxc ? "Cobro revertido" : "Pago revertido", `${currency(abono.monto)} · ${cuenta.contraparte}`);
  }

  async function handleEditAbono(cuenta: Cuenta, index: number, updatedAbono: Abono) {
    const nuevosAbonos = [...(cuenta.abonos ?? [])];
    nuevosAbonos[index] = updatedAbono;
    const nuevoMontoPagado = Math.round(nuevosAbonos.reduce((sum, a) => sum + Number(a.monto), 0) * 100) / 100;
    const updatedCuenta: Cuenta = {
      ...cuenta,
      abonos: nuevosAbonos,
      montoPagado: nuevoMontoPagado,
      status: computeStatus({ ...cuenta, montoPagado: nuevoMontoPagado }),
    };
    const { id, ...data } = updatedCuenta;
    await upsertDocument(collection, id!, withPlantaTag(data));
    showToast("success", isCxc ? "Cobro actualizado" : "Pago actualizado", `${currency(updatedAbono.monto)} · ${cuenta.contraparte}`);
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

  function exportXLSX() {
    const XLSX = require("xlsx");
    const contraparteTitulo = isCxc ? "Receptor" : "Emisor";
    const rows = filtered.map((c) => {
      const saldo = c.total - c.montoPagado;
      const base: Record<string, string | number> = {
        "Estado SAT": c.estadoSAT ?? "",
        Tipo: c.tipo ?? "",
        Fecha: c.fecha,
        Folio: c.folio ?? "",
        [contraparteTitulo]: c.contraparte,
        RFC: c.rfc ?? "",
        "COSEC. TC": c.banco ?? "",
        Concepto: c.concepto ?? "",
        Subtotal: c.subtotal,
        IVA: c.iva,
        ...(kind === "cxp" && {
          "Retenido IVA": c.retenidoIVA ?? 0,
          "Retenido ISR": c.retenidoISR ?? 0,
          ISH: c.ish ?? 0,
          BANCO: c.bancoPago ?? "",
        }),
        Total: c.total,
        [isCxc ? "Cobrado" : "Pagado"]: c.montoPagado,
        Saldo: saldo,
        Status: c.status,
        Vencimiento: c.vencimiento,
        "Forma de pago": c.formaPago ?? "",
        Notas: c.notas ?? "",
        Abonos: (c.abonos ?? [])
          .map((a) => `${a.fecha} $${a.monto.toLocaleString("es-MX")}${a.referencia ? ` (${a.referencia})` : ""}`)
          .join(" | "),
      };
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isCxc ? "CxC" : "CxP");
    XLSX.writeFile(wb, `${isCxc ? "cxc" : "cxp"}-${todayCST()}.xlsx`);
  }

  const contraparteLabel = isCxc ? "Nombre Receptor" : "Nombre Emisor";

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{filtered.length} documentos</p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportXLSX}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 border border-[#3A3A3A] bg-[#1A1A1A] hover:border-emerald-500/50 hover:text-emerald-300 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown size={15} />
            Exportar Excel
          </button>
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

      {/* KPI Row 1 — resumen de facturación */}
      {(() => {
        const pctNeto = totalFacturadoBruto > 0 ? (totalFacturadoNeto / totalFacturadoBruto) * 100 : 100;
        const pctCancel = 100 - pctNeto;
        return (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181b20] px-6 py-5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/10">
                  <FileSpreadsheet size={15} className="text-violet-400" strokeWidth={2} />
                </div>
                <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                  Facturación{filterMes !== "todos" ? ` · ${filterMes.replace("-", " ")}` : ""}
                </span>
              </div>
              <span className="text-[0.65rem] font-semibold text-slate-400 dark:text-gray-600">
                {filtered.length} {filtered.length === 1 ? "documento" : "documentos"}
              </span>
            </div>

            {/* 3 métricas */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">Total emitido</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{currency(totalFacturadoBruto)}</p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">{filtered.length} {filtered.length === 1 ? "factura" : "facturas"}</p>
              </div>
              <div className="border-l border-slate-100 dark:border-white/8 pl-6">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-red-400 mb-2">Canceladas</p>
                <p className="text-2xl font-bold text-red-500 dark:text-red-400 leading-none tabular-nums">{currency(totalCanceladas)}</p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">
                  {canceladas.length} {canceladas.length === 1 ? "factura" : "facturas"}
                  {canceladas.length > 0 && (
                    <span className="ml-1.5 font-semibold text-red-400">({pctCancel.toFixed(1)}%)</span>
                  )}
                </p>
              </div>
              <div className="border-l border-slate-100 dark:border-white/8 pl-6">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-500 mb-2">Neto vigente</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">{currency(totalFacturadoNeto)}</p>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">
                  {activas.length} {activas.length === 1 ? "factura" : "facturas"}
                  {totalFacturadoBruto > 0 && (
                    <span className="ml-1.5 font-semibold text-emerald-500">({pctNeto.toFixed(1)}%)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Barra de progreso neto vs canceladas */}
            {totalFacturadoBruto > 0 && (
              <div className="mt-5">
                <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-white/8">
                  <div
                    className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${pctNeto}%` }}
                  />
                  {pctCancel > 0 && (
                    <div
                      className="h-full rounded-r-full bg-red-400"
                      style={{ width: `${pctCancel}%` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Row 2 — período */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* A — Emitido en el período */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181b20] p-5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <FileText size={15} className="text-violet-400" strokeWidth={2} />
              </div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                {isCxc ? "Emitido en el período" : "Registrado en el período"}
              </p>
            </div>
            <div className="relative group">
              <button className="h-5 w-5 rounded-full border border-slate-200 dark:border-white/15 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-help transition-colors">?</button>
              <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1E24] p-3 shadow-xl text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                {isCxc
                  ? "Suma del total de todas las facturas con fecha de emisión en este período. No incluye canceladas."
                  : "Suma del total de todas las facturas recibidas registradas en este período. No incluye canceladas."}
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{currency(totalFacturadoNeto)}</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">{activas.length} {activas.length === 1 ? "factura vigente" : "facturas vigentes"}</p>
        </div>

        {/* B — Cobrado / Pagado en el período */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181b20] p-5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <DollarSign size={15} className="text-blue-400" strokeWidth={2} />
              </div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                {isCxc ? "Cobrado en el período" : "Pagado en el período"}
              </p>
            </div>
            <div className="relative group">
              <button className="h-5 w-5 rounded-full border border-slate-200 dark:border-white/15 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-help transition-colors">?</button>
              <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1E24] p-3 shadow-xl text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                {filterMes !== "todos"
                  ? (isCxc
                      ? "Dinero que entró en este mes. Incluye pagos de facturas emitidas en otros meses."
                      : "Dinero que salió en este mes. Incluye pagos de facturas recibidas en otros meses.")
                  : (isCxc
                      ? "Suma de todos los pagos recibidos hasta hoy."
                      : "Suma de todos los pagos realizados hasta hoy.")}
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{currency(cobradoEnMes)}</p>
          {filterMes !== "todos" ? (
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-gray-500">
                  {isCxc ? "Cobrado en" : "Pagado en"} {mesLabel(`${filterMes}-01`)}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {currency(cobradoMismoMes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-gray-500">
                  De facturas de otros meses
                </span>
                <span className="text-[11px] font-semibold text-blue-500 dark:text-blue-400 tabular-nums">
                  {currency(cobradoOtrosMeses)}
                </span>
              </div>
              {(cobradoMismoMes + cobradoOtrosMeses) > 0 && (
                <div className="pt-1">
                  <div className="flex h-1 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-white/8">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(cobradoMismoMes / (cobradoMismoMes + cobradoOtrosMeses)) * 100}%` }}
                    />
                    <div className="h-full bg-blue-400 flex-1" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">
              {isCxc ? "Total cobrado acumulado" : "Total pagado acumulado"}
            </p>
          )}
        </div>

        {/* C — Pendiente de cobrar / pagar */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#181b20] p-5 shadow-[0_1px_8px_rgba(15,23,42,0.05)] dark:shadow-none">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${pendienteDelMes > 0 ? "bg-amber-500/10" : "bg-slate-100 dark:bg-white/5"}`}>
                <Clock size={15} className={pendienteDelMes > 0 ? "text-amber-400" : "text-slate-400"} strokeWidth={2} />
              </div>
              <p className="text-[0.7rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                {isCxc ? "Pendiente de cobrar" : "Pendiente de pagar"}
              </p>
            </div>
            <div className="relative group">
              <button className="h-5 w-5 rounded-full border border-slate-200 dark:border-white/15 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center cursor-help transition-colors">?</button>
              <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-56 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1E24] p-3 shadow-xl text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
                {filterMes !== "todos"
                  ? (isCxc
                      ? "Lo que aún no se ha cobrado de facturas emitidas en este período."
                      : "Lo que aún no se ha pagado de facturas recibidas en este período.")
                  : (isCxc
                      ? "Saldo pendiente de todas las facturas activas."
                      : "Saldo por pagar de todas las facturas activas.")}
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{currency(pendienteDelMes)}</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">
            {filterMes !== "todos"
              ? (isCxc ? "Saldo sin cobrar de facturas emitidas en este mes" : "Saldo sin pagar de facturas recibidas en este mes")
              : (isCxc ? "Saldo total por cobrar" : "Saldo total por pagar")}
          </p>
        </div>

        {/* D — Sin pagar */}
        <KPICard
          title={isCxc ? "Sin cobrar" : "Sin pagar"}
          value={String(sinPagar)}
          icon={AlertTriangle}
          iconColor={sinPagar > 0 ? "text-amber-400" : "text-gray-500"}
          subtitle={isCxc ? "Facturas pendientes de cobro" : "Facturas pendientes de pago"}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
          {[["todos", "Todos"], ["pendiente", "Pendiente"], ["parcial", "Parcial"], ["pagado", "Pagado"]].map(([v, l]) => (
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
        {/* View mode toggle */}
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          <button
            onClick={() => setViewMode("dark")}
            title="Vista oscura"
            className={`p-1.5 rounded transition-colors cursor-pointer ${viewMode === "dark" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}
          >
            <Table2 size={14} />
          </button>
          <button
            onClick={() => setViewMode("excel")}
            title="Vista Excel"
            className={`p-1.5 rounded transition-colors cursor-pointer ${viewMode === "excel" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"}`}
          >
            <FileSpreadsheet size={14} />
          </button>
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
      {viewMode === "excel" ? (
        <ExcelTable
          filtered={filtered}
          kind={kind}
          onAbono={setAbonoTarget}
          onEdit={(c) => { setEditing(c); setShowForm(true); }}
          onDelete={handleDelete}
          onDeleteAbono={handleDeleteAbono}
        />
      ) : (
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
                  {["Fecha", "Folio", contraparteLabel, "Total", "Saldo", "%", "Status", ""].map((h) => (
                    <th key={h} className="px-2 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-sm text-gray-600">
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
                    onEditAbono={(c, i) => setEditAbonoTarget({ cuenta: c, index: i })}
                    onDeleteAbono={handleDeleteAbono}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDrawer open={showForm} kind={kind} clientesList={clientesList} initial={editing ?? undefined} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />
      <AbonoDrawer cuenta={abonoTarget} kind={kind} onClose={() => setAbonoTarget(null)} onSave={handleAbono} />
      <EditAbonoDrawer target={editAbonoTarget} kind={kind} onClose={() => setEditAbonoTarget(null)} onSave={handleEditAbono} />
      <CargaMasivaModal open={showCargaMasiva} kind={kind} existingUuids={existingUuids} onClose={() => setShowCargaMasiva(false)} onConfirm={handleCargaMasiva} />
    </div>
  );
}
