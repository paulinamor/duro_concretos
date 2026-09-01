"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck, CalendarDays, Calculator, Download, FileCheck2,
  Loader2, Plus, ReceiptText, Search, Send, UsersRound, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import AppSelect from "@/components/AppSelect";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import type { DesglosePago, Periodicidad } from "@/lib/nomina/calcular";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type NominaStatus = "Timbrado" | "Pendiente" | "Error";

interface ReciboNomina {
  id?: string;
  folio: string;
  empleado: string;
  rfc: string;
  curp: string;
  nss: string;
  puesto: string;
  codigoPostal: string;
  salarioDiario: number;
  diasTrabajados: number;
  periodicidad: Periodicidad;
  fechaInicioPago: string;
  fechaFinPago: string;
  fechaPago: string;
  sueldoBruto: number;
  deducciones: number;
  neto: number;
  imss: number;
  isr: number;
  subsidio: number;
  uuid: string;
  facturamaId: string;
  status: NominaStatus;
  enviado: boolean;
  desglose?: DesglosePago;
}

const PERIODICIDADES: { value: Periodicidad; label: string; cfdi: string }[] = [
  { value: "semanal",    label: "Semanal",    cfdi: "02" },
  { value: "catorcenal", label: "Catorcenal", cfdi: "03" },
  { value: "quincenal",  label: "Quincenal",  cfdi: "03" },
  { value: "mensual",    label: "Mensual",    cfdi: "04" },
];

const statusTone: Record<NominaStatus, string> = {
  Timbrado: "aprobado",
  Pendiente: "pendiente",
  Error:     "cancelado",
};

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NominaPage() {
  const [recibos, setRecibos]       = useState<ReciboNomina[]>([]);
  const [query, setQuery]           = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [timbrandoId, setTimbrandoId] = useState<string | null>(null);

  useEffect(() => {
    getCollectionDocs<ReciboNomina>(COLLECTIONS.nomina).then(setRecibos);
  }, []);

  const totalEmpleados = recibos.length;
  const timbrados      = recibos.filter((r) => r.status === "Timbrado").length;
  const pendientes     = recibos.filter((r) => r.status !== "Timbrado").length;
  const totalNeto      = recibos.reduce((s, r) => s + r.neto, 0);

  const filtered = recibos.filter((r) => {
    const t = query.toLowerCase();
    return (
      r.empleado.toLowerCase().includes(t) ||
      r.rfc.toLowerCase().includes(t) ||
      r.folio.toLowerCase().includes(t)
    );
  });

  async function handleGuardar(recibo: ReciboNomina) {
    const id = Date.now().toString();
    const nuevo = { ...recibo, id, folio: `NOM-${id}` };
    setRecibos((prev) => [nuevo, ...prev]);
    await upsertDocument(COLLECTIONS.nomina, id, nuevo);
    setShowDrawer(false);
  }

  async function handleTimbrar(recibo: ReciboNomina) {
    if (!recibo.id) return;
    setTimbrandoId(recibo.id);
    try {
      const per = PERIODICIDADES.find((p) => p.value === recibo.periodicidad);
      const resp = await fetch("/api/facturama/timbrar-nomina", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleadoRfc:        recibo.rfc,
          empleadoCurp:       recibo.curp,
          empleadoNombre:     recibo.empleado,
          empleadoNss:        recibo.nss,
          empleadoCodigoPostal: recibo.codigoPostal,
          periodicidad:       per?.cfdi ?? "03",
          fechaPago:          recibo.fechaPago,
          fechaInicialPago:   recibo.fechaInicioPago,
          fechaFinalPago:     recibo.fechaFinPago,
          numDiasPagados:     recibo.diasTrabajados,
          totalSueldos:       recibo.sueldoBruto,
          totalExento:        0,
          totalISR:           recibo.isr,
          totalIMSS:          recibo.imss,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Error timbrado");

      const actualizado: ReciboNomina = {
        ...recibo,
        uuid:        data.uuid,
        facturamaId: data.facturamaId,
        status:      "Timbrado",
      };
      setRecibos((prev) => prev.map((r) => (r.id === recibo.id ? actualizado : r)));
      await upsertDocument(COLLECTIONS.nomina, recibo.id, actualizado);
    } catch (e) {
      console.error(e);
      const err: ReciboNomina = { ...recibo, status: "Error" };
      setRecibos((prev) => prev.map((r) => (r.id === recibo.id ? err : r)));
      await upsertDocument(COLLECTIONS.nomina, recibo.id, err);
    } finally {
      setTimbrandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-sm">Nómina timbrada y comprobantes electrónicos</p>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Calcular y timbrar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Empleados en nómina" value={String(totalEmpleados)}         icon={UsersRound}  iconColor="text-blue-400" />
        <KPICard title="Recibos timbrados"   value={`${timbrados}/${totalEmpleados}`} icon={BadgeCheck}  iconColor="text-green-400" />
        <KPICard title="Pendientes SAT"      value={String(pendientes)}              icon={FileCheck2}  iconColor="text-orange-400" />
        <KPICard title="Neto a pagar"        value={`$${fmt(totalNeto)}`}            icon={ReceiptText} iconColor="text-[#CC2229]" />
      </div>

      {/* Tabla */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Comprobantes de nómina</h3>
            <p className="text-xs text-gray-500 mt-0.5">XML/PDF timbrados por empleado</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar empleado o RFC"
              className="w-64 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio","Empleado","RFC","Periodo","Bruto","IMSS","ISR","Neto","Status","Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Sin recibos. Usa &quot;Calcular y timbrar&quot; para agregar.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.folio} className="hover:bg-[#1A1A1A] transition-colors">
                  <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{r.folio}</td>
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{r.empleado}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.rfc}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{r.fechaInicioPago} – {r.fechaFinPago}</td>
                  <td className="px-4 py-3 text-gray-300">${fmt(r.sueldoBruto)}</td>
                  <td className="px-4 py-3 text-orange-400">-${fmt(r.imss)}</td>
                  <td className="px-4 py-3 text-orange-400">-${fmt(r.isr)}</td>
                  <td className="px-4 py-3 text-white font-semibold">${fmt(r.neto)}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusTone[r.status]} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.status !== "Timbrado" && (
                        <button
                          onClick={() => handleTimbrar(r)}
                          disabled={timbrandoId === r.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#CC2229]/10 border border-[#CC2229]/30 text-[#CC2229] text-xs hover:bg-[#CC2229]/20 transition-colors disabled:opacity-50"
                        >
                          {timbrandoId === r.id ? <Loader2 size={11} className="animate-spin" /> : <BadgeCheck size={11} />}
                          Timbrar
                        </button>
                      )}
                      {r.facturamaId && (
                        <>
                          <a
                            href={`/api/facturama/download?id=${r.facturamaId}&format=pdf`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 hover:text-white hover:border-[#CC2229] transition-colors"
                            title="Descargar PDF"
                          >
                            <Download size={13} />
                          </a>
                          <a
                            href={`/api/facturama/download?id=${r.facturamaId}&format=xml`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 hover:text-white hover:border-blue-400/60 transition-colors"
                            title="Descargar XML"
                          >
                            <Send size={13} />
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer calcular + guardar */}
      {showDrawer && (
        <CalcularDrawer onClose={() => setShowDrawer(false)} onGuardar={handleGuardar} />
      )}
    </div>
  );
}

// ─── Drawer de cálculo ────────────────────────────────────────────────────────

interface CalcularDrawerProps {
  onClose: () => void;
  onGuardar: (r: ReciboNomina) => void;
}

function CalcularDrawer({ onClose, onGuardar }: CalcularDrawerProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    empleado:      "",
    rfc:           "",
    curp:          "",
    nss:           "",
    puesto:        "",
    codigoPostal:  "",
    salarioDiario: "",
    diasTrabajados: "15",
    periodicidad:  "quincenal" as Periodicidad,
    fechaInicioPago: today,
    fechaFinPago:    today,
    fechaPago:       today,
    percGravadasExtra: "0",
    percExentasExtra:  "0",
  });

  const [desglose, setDesglose]   = useState<DesglosePago | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setDesglose(null);
    setError(null);
  }

  async function calcular() {
    setCalculando(true);
    setError(null);
    try {
      const resp = await fetch("/api/nomina/calcular", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salarioDiario:             parseFloat(form.salarioDiario) || 0,
          diasTrabajados:            parseInt(form.diasTrabajados) || 0,
          periodicidad:              form.periodicidad,
          percepcionesGravadasExtra: parseFloat(form.percGravadasExtra) || 0,
          percepcionesExentasExtra:  parseFloat(form.percExentasExtra) || 0,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setDesglose(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al calcular");
    } finally {
      setCalculando(false);
    }
  }

  async function guardar() {
    if (!desglose) return;
    setGuardando(true);
    const recibo: ReciboNomina = {
      folio:           "",
      empleado:        form.empleado,
      rfc:             form.rfc.toUpperCase(),
      curp:            form.curp.toUpperCase(),
      nss:             form.nss,
      puesto:          form.puesto,
      codigoPostal:    form.codigoPostal,
      salarioDiario:   parseFloat(form.salarioDiario),
      diasTrabajados:  parseInt(form.diasTrabajados),
      periodicidad:    form.periodicidad,
      fechaInicioPago: form.fechaInicioPago,
      fechaFinPago:    form.fechaFinPago,
      fechaPago:       form.fechaPago,
      sueldoBruto:     desglose.totalPercepciones,
      deducciones:     desglose.totalDeducciones,
      neto:            desglose.netoAPagar,
      imss:            desglose.imssObrero,
      isr:             desglose.isrRetenido,
      subsidio:        desglose.subsidioEmpleo,
      uuid:            "",
      facturamaId:     "",
      status:          "Pendiente",
      enviado:         false,
      desglose,
    };
    onGuardar(recibo);
    setGuardando(false);
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-xl bg-white border-l border-gray-200 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Calculator size={18} />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold">Calcular nómina</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tablas SAT 2026 · Art. 96 LISR</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Datos del empleado */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Empleado</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Nombre completo</label>
                <input className={inp} value={form.empleado} onChange={(e) => set("empleado", e.target.value)} placeholder="Juan García López" />
              </div>
              <div>
                <label className={lbl}>RFC</label>
                <input className={`${inp} uppercase font-mono`} value={form.rfc} onChange={(e) => set("rfc", e.target.value)} placeholder="GALJ900101ABC" maxLength={13} />
              </div>
              <div>
                <label className={lbl}>CURP</label>
                <input className={`${inp} uppercase font-mono`} value={form.curp} onChange={(e) => set("curp", e.target.value)} placeholder="GALJ900101HNLRPN00" maxLength={18} />
              </div>
              <div>
                <label className={lbl}>NSS (IMSS)</label>
                <input className={inp} value={form.nss} onChange={(e) => set("nss", e.target.value)} placeholder="12345678901" maxLength={11} />
              </div>
              <div>
                <label className={lbl}>Puesto</label>
                <input className={inp} value={form.puesto} onChange={(e) => set("puesto", e.target.value)} placeholder="Operador" />
              </div>
              <div>
                <label className={lbl}>Código Postal fiscal</label>
                <input className={inp} value={form.codigoPostal} onChange={(e) => set("codigoPostal", e.target.value)} placeholder="66600" maxLength={5} />
              </div>
            </div>
          </div>

          {/* Datos de la nómina */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Datos del periodo</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Salario diario ($)</label>
                <input type="number" min="0" step="0.01" className={inp} value={form.salarioDiario} onChange={(e) => set("salarioDiario", e.target.value)} placeholder="315.04" />
              </div>
              <div>
                <label className={lbl}>Días trabajados</label>
                <input type="number" min="1" max="31" className={inp} value={form.diasTrabajados} onChange={(e) => set("diasTrabajados", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Periodicidad</label>
                <AppSelect value={form.periodicidad} onChange={(e) => set("periodicidad", e.target.value)}>
                  {PERIODICIDADES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </AppSelect>
              </div>
              <div>
                <label className={lbl}>Fecha de pago</label>
                <input type="date" className={inp} value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Inicio del periodo</label>
                <input type="date" className={inp} value={form.fechaInicioPago} onChange={(e) => set("fechaInicioPago", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Fin del periodo</label>
                <input type="date" className={inp} value={form.fechaFinPago} onChange={(e) => set("fechaFinPago", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Percepciones gravadas extra ($)</label>
                <input type="number" min="0" step="0.01" className={inp} value={form.percGravadasExtra} onChange={(e) => set("percGravadasExtra", e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Percepciones exentas extra ($)</label>
                <input type="number" min="0" step="0.01" className={inp} value={form.percExentasExtra} onChange={(e) => set("percExentasExtra", e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Botón calcular */}
          <button
            onClick={calcular}
            disabled={!form.salarioDiario || calculando}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-xl font-medium transition-colors disabled:opacity-50 border border-gray-200"
          >
            {calculando ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
            {calculando ? "Calculando…" : "Calcular con tablas SAT 2026"}
          </button>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Desglose */}
          {desglose && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                <CalendarDays size={12} className="text-[#CC2229]" />
                Desglose calculado · Tablas SAT 2026
              </p>

              <div className="space-y-1.5 text-sm">
                <Row label="Sueldo ordinario"       val={desglose.sueldoOrdinario}    />
                {desglose.percepcionesExentas > 0 && (
                  <Row label="Percepciones exentas"   val={desglose.percepcionesExentas} />
                )}
                <Row label="Total percepciones"     val={desglose.totalPercepciones}  bold />
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Deducciones</p>
                <Row label="IMSS obrero"            val={-desglose.imssObrero}        red />
                <Row label="ISR causado"            val={-desglose.isrCausado}        red />
                {desglose.subsidioEmpleo > 0 && (
                  <Row label="Subsidio al empleo"   val={desglose.subsidioEmpleo}     green />
                )}
                <Row label="ISR retenido"           val={-desglose.isrRetenido}       red />
                {desglose.infonavitDescuento > 0 && (
                  <Row label="INFONAVIT"            val={-desglose.infonavitDescuento} red />
                )}
                <Row label="Total deducciones"      val={-desglose.totalDeducciones}  bold red />
              </div>

              <div className="border-t border-gray-200 pt-3">
                <Row label="Neto a pagar" val={desglose.netoAPagar} bold big />
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cuotas patronales (informativas)</p>
                <Row label="IMSS patronal"         val={desglose.imssPatron}       />
                <Row label="INFONAVIT patronal"    val={desglose.infonavitPatron}  />
                <Row label="Costo total empleador" val={desglose.costoTotalPatron} bold />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!desglose || guardando}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#CC2229] hover:bg-[#B01E24] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-[#CC2229]/20"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : null}
            Guardar recibo
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, bold, red, green, big }: {
  label: string; val: number; bold?: boolean; red?: boolean; green?: boolean; big?: boolean;
}) {
  const color = red ? "text-red-600" : green ? "text-green-600" : "text-gray-900";
  return (
    <div className="flex justify-between items-center">
      <span className={`text-gray-500 ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`${color} ${bold ? "font-semibold" : ""} ${big ? "text-base" : ""}`}>
        ${Math.abs(val).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
