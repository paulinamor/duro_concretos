"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, CalendarDays, Download, FileText, Loader2,
  Plus, RefreshCw, Search, Send, Trash2, X, FileDown,
  Receipt, CloudDownload, AlertCircle,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";

// ─── Catálogos SAT ────────────────────────────────────────────────────────────

const USO_CFDI = [
  { clave: "G01", desc: "Adquisición de mercancias" },
  { clave: "G02", desc: "Devoluciones, descuentos o bonificaciones" },
  { clave: "G03", desc: "Gastos en general" },
  { clave: "I01", desc: "Construcciones" },
  { clave: "I02", desc: "Mobilario y equipo de oficina" },
  { clave: "I04", desc: "Equipo de cómputo y accesorios" },
  { clave: "I06", desc: "Comunicaciones telefónicas" },
  { clave: "I08", desc: "Otra maquinaria y equipo" },
  { clave: "S01", desc: "Sin efectos fiscales" },
  { clave: "CP01", desc: "Pagos" },
];

const FORMA_PAGO = [
  { clave: "01", desc: "Efectivo" },
  { clave: "02", desc: "Cheque nominativo" },
  { clave: "03", desc: "Transferencia electrónica" },
  { clave: "04", desc: "Tarjeta de crédito" },
  { clave: "06", desc: "Dinero electrónico" },
  { clave: "28", desc: "Tarjeta de débito" },
  { clave: "99", desc: "Por definir" },
];

const REGIMEN_FISCAL = [
  { clave: "601", desc: "General de Ley Personas Morales" },
  { clave: "603", desc: "Personas Morales con fines no lucrativos" },
  { clave: "605", desc: "Sueldos y Salarios" },
  { clave: "606", desc: "Arrendamiento" },
  { clave: "612", desc: "Personas Físicas con Actividades Empresariales" },
  { clave: "616", desc: "Sin obligaciones fiscales" },
  { clave: "621", desc: "Incorporación Fiscal" },
  { clave: "625", desc: "Actividades a través de Plataformas Tecnológicas" },
  { clave: "626", desc: "Régimen Simplificado de Confianza" },
];

const CLAVE_UNIDAD = [
  { clave: "H87", desc: "Pieza" },
  { clave: "E48", desc: "Unidad de servicio" },
  { clave: "M3",  desc: "Metro cúbico" },
  { clave: "KGM", desc: "Kilogramo" },
  { clave: "TN",  desc: "Tonelada métrica" },
  { clave: "MTR", desc: "Metro" },
  { clave: "LTR", desc: "Litro" },
  { clave: "ACT", desc: "Actividad" },
];

// Claves producto más usadas en empresa de concreto/transporte
const CLAVE_PRODUCTO_SUGERIDAS = [
  { clave: "44121601", desc: "Concreto premezclado" },
  { clave: "78101800", desc: "Servicios de transporte de carga" },
  { clave: "80141600", desc: "Servicios de construcción" },
  { clave: "72154300", desc: "Servicios de mantenimiento de maquinaria" },
  { clave: "95121500", desc: "Servicios de construcción de edificios" },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoCFDI = "I" | "E" | "T";
type MetodoPago = "PUE" | "PPD";
type StatusCFDI = "valid" | "cancelled" | "draft";

interface Concepto {
  descripcion:   string;
  cantidad:      number;
  precio:        number;
  claveProducto: string;
  claveUnidad:   string;
  tasaIVA:       number;
}

interface CfdiEmitido {
  id?:           string;
  uuid:          string;
  facturapiId:   string;
  tipo:          TipoCFDI;
  clienteNombre: string;
  clienteRfc:    string;
  folio:         number;
  serie:         string;
  total:         number;
  subtotal:      number;
  impuestos:     number;
  fechaTimbrado: string;
  status:        StatusCFDI;
  pdfUrl:        string;
  xmlUrl:        string;
  planta:        string;
  createdAt:     string;
}

interface DescargaSolicitud {
  id?:         string;
  solicitudId: string;
  tipo:        "emitidas" | "recibidas";
  fechaInicio: string;
  fechaFin:    string;
  status:      "procesando" | "completado" | "error";
  total:       number;
  cfdis:       DescargaCfdi[];
  createdAt:   string;
}

interface DescargaCfdi {
  uuid:         string;
  rfcEmisor:    string;
  rfcReceptor:  string;
  nombreEmisor: string;
  total:        number;
  fecha:        string;
  tipo:         string;
  efecto:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const TIPO_LABEL: Record<TipoCFDI, string> = { I: "Ingreso", E: "Egreso", T: "Traslado" };
const STATUS_TONE: Record<StatusCFDI | string, string> = { valid: "aprobado", cancelled: "cancelado", draft: "pendiente" };
const STATUS_LABEL: Record<StatusCFDI | string, string> = { valid: "Vigente", cancelled: "Cancelado", draft: "Borrador" };

const emptyConcepto = (): Concepto => ({
  descripcion: "", cantidad: 1, precio: 0,
  claveProducto: "44121601", claveUnidad: "H87", tasaIVA: 0.16,
});

// ─── Componente campo ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

// ─── Modal Emitir CFDI ────────────────────────────────────────────────────────

function EmitirDrawer({
  open,
  onClose,
  onEmitido,
}: {
  open: boolean;
  onClose: () => void;
  onEmitido: (cfdi: CfdiEmitido) => void;
}) {
  const [tipo, setTipo]       = useState<TipoCFDI>("I");
  const [serie, setSerie]     = useState("A");
  const [metodo, setMetodo]   = useState<MetodoPago>("PUE");
  const [forma, setForma]     = useState("03");
  const [uso, setUso]         = useState("G03");

  const [rfc, setRfc]         = useState("");
  const [nombre, setNombre]   = useState("");
  const [regimen, setRegimen] = useState("601");
  const [cp, setCp]           = useState("");
  const [email, setEmail]     = useState("");

  const [conceptos, setConceptos] = useState<Concepto[]>([emptyConcepto()]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const subtotal  = conceptos.reduce((s, c) => s + c.cantidad * c.precio, 0);
  const totalIVA  = conceptos.reduce((s, c) => s + c.cantidad * c.precio * c.tasaIVA, 0);
  const total     = subtotal + totalIVA;

  function updConcepto(i: number, field: keyof Concepto, value: string | number) {
    setConceptos((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  async function handleTimbrar() {
    setError("");
    if (!rfc || !nombre || !cp) { setError("RFC, nombre y código postal son requeridos"); return; }
    if (conceptos.some((c) => !c.descripcion || c.cantidad <= 0)) { setError("Todos los conceptos deben tener descripción y cantidad"); return; }

    setLoading(true);
    try {
      const resp = await fetch("/api/facturapi/timbrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, serie, metodoPago: metodo, formaPago: forma, usoCFDI: uso,
          clienteRfc: rfc, clienteNombre: nombre, clienteRegimenFiscal: regimen,
          clienteCodigoPostal: cp, clienteEmail: email || undefined,
          conceptos,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Error al timbrar"); return; }

      const nuevo: CfdiEmitido = withPlantaTag({
        uuid:          data.uuid,
        facturapiId:   data.id,
        tipo,
        clienteNombre: nombre,
        clienteRfc:    rfc,
        folio:         data.folio,
        serie:         data.serie ?? serie,
        total,
        subtotal,
        impuestos:     totalIVA,
        fechaTimbrado: data.fechaTimbrado ?? new Date().toISOString(),
        status:        "valid",
        pdfUrl:        data.pdfUrl,
        xmlUrl:        data.xmlUrl,
        createdAt:     new Date().toISOString(),
      });

      await upsertDocument(COLLECTIONS.cfdiEmitidos, nuevo.uuid, nuevo);
      onEmitido(nuevo);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Send size={17} />
            </div>
            <h2 className="text-gray-900 font-semibold text-base">Emitir CFDI</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tipo y serie */}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo de comprobante">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCFDI)} className={selectCls}>
                <option value="I">I — Ingreso</option>
                <option value="E">E — Egreso</option>
                <option value="T">T — Traslado</option>
              </select>
            </Field>
            <Field label="Serie">
              <input value={serie} onChange={(e) => setSerie(e.target.value)} className={inputCls} placeholder="A" />
            </Field>
            <Field label="Uso CFDI">
              <select value={uso} onChange={(e) => setUso(e.target.value)} className={selectCls}>
                {USO_CFDI.map((u) => (
                  <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Pago */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Método de pago">
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className={selectCls}>
                <option value="PUE">PUE — Pago en una exhibición</option>
                <option value="PPD">PPD — Pago en parcialidades o diferido</option>
              </select>
            </Field>
            <Field label="Forma de pago">
              <select value={forma} onChange={(e) => setForma(e.target.value)} className={selectCls}>
                {FORMA_PAGO.map((f) => (
                  <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Cliente */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Datos del receptor</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="RFC *">
                <input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} className={`${inputCls} uppercase font-mono`} placeholder="XAXX010101000" maxLength={13} />
              </Field>
              <Field label="Nombre / Razón social *">
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} placeholder="Empresa S.A. de C.V." />
              </Field>
              <Field label="Régimen fiscal">
                <select value={regimen} onChange={(e) => setRegimen(e.target.value)} className={selectCls}>
                  {REGIMEN_FISCAL.map((r) => (
                    <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>
                  ))}
                </select>
              </Field>
              <Field label="Código postal *">
                <input value={cp} onChange={(e) => setCp(e.target.value)} className={inputCls} placeholder="64000" maxLength={5} />
              </Field>
              <Field label="Correo (opcional)">
                <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="cliente@empresa.com" type="email" />
              </Field>
            </div>
          </div>

          {/* Conceptos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Conceptos</p>
              <button
                onClick={() => setConceptos((p) => [...p, emptyConcepto()])}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Plus size={12} /> Agregar
              </button>
            </div>

            <div className="space-y-3">
              {conceptos.map((c, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1">
                      <Field label="Descripción *">
                        <input value={c.descripcion} onChange={(e) => updConcepto(i, "descripcion", e.target.value)} className={inputCls} placeholder="Suministro de concreto premezclado" />
                      </Field>
                    </div>
                    {conceptos.length > 1 && (
                      <button onClick={() => setConceptos((p) => p.filter((_, idx) => idx !== i))} className="mt-6 rounded p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Field label="Cantidad">
                      <input type="number" value={c.cantidad} min={1} onChange={(e) => updConcepto(i, "cantidad", Number(e.target.value))} className={inputCls} />
                    </Field>
                    <Field label="Precio unitario">
                      <input type="number" value={c.precio} min={0} step={0.01} onChange={(e) => updConcepto(i, "precio", Number(e.target.value))} className={inputCls} />
                    </Field>
                    <Field label="IVA (%)">
                      <select value={c.tasaIVA} onChange={(e) => updConcepto(i, "tasaIVA", Number(e.target.value))} className={selectCls}>
                        <option value={0.16}>16%</option>
                        <option value={0.08}>8%</option>
                        <option value={0}>0%</option>
                      </select>
                    </Field>
                    <Field label="Subtotal">
                      <div className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-500">
                        {fmt(c.cantidad * c.precio)}
                      </div>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field label="Clave producto SAT">
                      <input
                        list={`prod-list-${i}`}
                        value={c.claveProducto}
                        onChange={(e) => updConcepto(i, "claveProducto", e.target.value)}
                        className={inputCls}
                        placeholder="44121601"
                      />
                      <datalist id={`prod-list-${i}`}>
                        {CLAVE_PRODUCTO_SUGERIDAS.map((p) => (
                          <option key={p.clave} value={p.clave}>{p.desc}</option>
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Clave unidad SAT">
                      <select value={c.claveUnidad} onChange={(e) => updConcepto(i, "claveUnidad", e.target.value)} className={selectCls}>
                        {CLAVE_UNIDAD.map((u) => (
                          <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA</span><span>{fmt(totalIVA)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} />{error}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleTimbrar}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#CC2229] py-2.5 text-sm font-semibold text-white hover:bg-[#B01E24] disabled:opacity-50 transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {loading ? "Timbrando…" : "Timbrar CFDI"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─── Tab: Descarga SAT ────────────────────────────────────────────────────────

function DescargaSATTab() {
  const [tipo, setTipo]           = useState<"emitidas" | "recibidas">("emitidas");
  const [fechaInicio, setFechaI]  = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [fechaFin, setFechaF]     = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]     = useState(false);
  const [polling, setPolling]     = useState(false);
  const [solicitud, setSolicitud] = useState<DescargaSolicitud | null>(null);
  const [historial, setHistorial] = useState<DescargaSolicitud[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getCollectionDocs<DescargaSolicitud>(COLLECTIONS.descargasSAT).then(setHistorial);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  async function checkStatus(id: string, docId: string) {
    try {
      const resp = await fetch(`/api/boxfactura/descargar?id=${id}`);
      const data = await resp.json();
      if (data.status === "completado" || data.status === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPolling(false);
        const updated = { ...solicitud!, status: data.status, total: data.total, cfdis: data.cfdis ?? [] };
        setSolicitud(updated);
        await upsertDocument(COLLECTIONS.descargasSAT, docId, updated);
        setHistorial((prev) => prev.map((s) => s.id === docId ? { ...updated, id: docId } : s));
      }
    } catch { /* silencio en polling */ }
  }

  async function handleSolicitar() {
    setLoading(true);
    try {
      const resp = await fetch("/api/boxfactura/descargar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fechaInicio, fechaFin }),
      });
      const data = await resp.json();
      if (!resp.ok) { alert(data.error ?? "Error al solicitar descarga"); return; }

      const nueva: DescargaSolicitud = {
        solicitudId: data.solicitudId,
        tipo, fechaInicio, fechaFin,
        status: "procesando",
        total: 0, cfdis: [],
        createdAt: new Date().toISOString(),
      };
      const docId = `${Date.now()}-${data.solicitudId}`;
      await upsertDocument(COLLECTIONS.descargasSAT, docId, nueva);
      const conId = { ...nueva, id: docId };
      setSolicitud(conId);
      setHistorial((prev) => [conId, ...prev]);

      // Inicia polling cada 8 segundos
      setPolling(true);
      pollingRef.current = setInterval(() => checkStatus(data.solicitudId, docId), 8000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulario solicitud */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-4">Nueva solicitud de descarga masiva</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "emitidas" | "recibidas")}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors cursor-pointer">
              <option value="emitidas">CFDIs emitidos</option>
              <option value="recibidas">CFDIs recibidos</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaI(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Fecha fin</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaF(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSolicitar}
              disabled={loading || polling}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#CC2229] py-2.5 text-sm font-semibold text-white hover:bg-[#B01E24] disabled:opacity-50 transition-colors shadow-lg shadow-[#CC2229]/20"
            >
              {loading || polling ? <Loader2 size={15} className="animate-spin" /> : <CloudDownload size={15} />}
              {loading ? "Solicitando…" : polling ? "Procesando…" : "Solicitar"}
            </button>
          </div>
        </div>
        {polling && (
          <p className="text-xs text-amber-400 mt-3 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            La descarga se está procesando en el SAT. Verificando cada 8 seg…
          </p>
        )}
      </div>

      {/* Solicitud activa */}
      {solicitud && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              Descarga {solicitud.tipo} · {fmtDate(solicitud.fechaInicio)} – {fmtDate(solicitud.fechaFin)}
            </p>
            <StatusBadge status={
              solicitud.status === "completado" ? "aprobado" :
              solicitud.status === "error" ? "cancelado" : "pendiente"
            } />
          </div>
          {solicitud.status === "completado" && solicitud.cfdis.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[#3A3A3A]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                    {["UUID", "RFC Emisor", "RFC Receptor", "Total", "Fecha", "Tipo"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {solicitud.cfdis.map((c) => (
                    <tr key={c.uuid} className="border-b border-[#2A2A2A] hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{c.uuid.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-gray-300">{c.rfcEmisor}</td>
                      <td className="px-4 py-2.5 text-gray-300">{c.rfcReceptor}</td>
                      <td className="px-4 py-2.5 text-white font-medium">{fmt(c.total)}</td>
                      <td className="px-4 py-2.5 text-gray-400">{fmtDate(c.fecha)}</td>
                      <td className="px-4 py-2.5 text-gray-400">{c.efecto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {solicitud.status === "completado" && solicitud.cfdis.length === 0 && (
            <p className="text-sm text-gray-500">No se encontraron CFDIs en el rango seleccionado.</p>
          )}
        </div>
      )}

      {/* Historial de solicitudes */}
      {historial.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Solicitudes anteriores</p>
          <div className="space-y-2">
            {historial.map((s) => (
              <button
                key={s.id}
                onClick={() => setSolicitud(s)}
                className="w-full flex items-center justify-between bg-[#242424] border border-[#3A3A3A] rounded-xl px-4 py-3 hover:border-[#CC2229]/40 transition-colors text-left"
              >
                <div>
                  <p className="text-sm text-white capitalize">{s.tipo} · {fmtDate(s.fechaInicio)} – {fmtDate(s.fechaFin)}</p>
                  <p className="text-xs text-gray-500">{s.total} CFDIs · {fmtDate(s.createdAt)}</p>
                </div>
                <StatusBadge status={
                  s.status === "completado" ? "aprobado" :
                  s.status === "error" ? "cancelado" : "pendiente"
                } />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = "historial" | "descarga";

export default function FacturacionPage() {
  const [tab, setTab]               = useState<Tab>("historial");
  const [cfdiList, setCfdiList]     = useState<CfdiEmitido[]>([]);
  const [apiList, setApiList]       = useState<CfdiEmitido[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");

  // Carga desde Firestore
  useEffect(() => {
    getCollectionDocs<CfdiEmitido>(COLLECTIONS.cfdiEmitidos).then(setCfdiList);
  }, []);

  // Carga desde FacturAPI
  async function fetchApiFacturas() {
    setLoadingApi(true);
    try {
      const resp = await fetch("/api/facturapi/facturas?limit=100");
      if (resp.ok) {
        const data = await resp.json();
        setApiList(data.facturas ?? []);
      }
    } finally {
      setLoadingApi(false);
    }
  }

  useEffect(() => { fetchApiFacturas(); }, []);

  // Merge: FacturAPI es source of truth para status; Firestore para las que timbramos aquí
  const merged = (() => {
    const map = new Map<string, CfdiEmitido>();
    apiList.forEach((f) => map.set(f.uuid, f));
    cfdiList.forEach((f) => { if (!map.has(f.uuid)) map.set(f.uuid, f); });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.fechaTimbrado).getTime() - new Date(a.fechaTimbrado).getTime()
    );
  })();

  const filtered = merged.filter((f) => {
    const q = search.toLowerCase();
    return !q || f.clienteNombre.toLowerCase().includes(q) || f.clienteRfc.toLowerCase().includes(q) || f.uuid.includes(q);
  });

  const totalFacturado  = merged.filter((f) => f.status === "valid").reduce((s, f) => s + f.total, 0);
  const vigentes        = merged.filter((f) => f.status === "valid").length;
  const cancelados      = merged.filter((f) => f.status === "cancelled").length;

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "historial", label: "CFDIs Emitidos",  icon: FileText },
    { key: "descarga",  label: "Descarga SAT",    icon: CloudDownload },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Total facturado"   value={fmt(totalFacturado)}     icon={Receipt}      iconColor="text-[#CC2229]" />
        <KPICard title="CFDIs vigentes"    value={String(vigentes)}         icon={BadgeCheck}   iconColor="text-green-400" />
        <KPICard title="CFDIs cancelados"  value={String(cancelados)}       icon={AlertCircle}  iconColor="text-red-400" />
        <KPICard title="Total emitidos"    value={String(merged.length)}    icon={FileDown}     iconColor="text-blue-400" />
      </div>

      {/* Tabs + acción */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-[#242424] border border-[#3A3A3A] rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-[#CC2229] text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {tab === "historial" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, RFC o UUID…"
                className="bg-[#242424] border border-[#3A3A3A] rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CC2229] w-64 transition-colors"
              />
            </div>
            <button
              onClick={fetchApiFacturas}
              disabled={loadingApi}
              title="Sincronizar con FacturAPI"
              className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-2.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={loadingApi ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#CC2229] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a81b21] transition-colors"
            >
              <Plus size={15} /> Emitir CFDI
            </button>
          </div>
        )}
      </div>

      {/* Contenido tabs */}
      {tab === "historial" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                  {["Folio", "UUID", "Tipo", "Receptor", "RFC", "Total", "Fecha", "Estatus", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-600">
                      {loadingApi ? (
                        <div className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Cargando desde FacturAPI…</div>
                      ) : (
                        "No hay CFDIs. Emite tu primera factura."
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((f) => (
                  <tr key={f.uuid} className="border-b border-[#2A2A2A] hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.serie ?? ""}{f.folio ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500" title={f.uuid}>{f.uuid ? f.uuid.slice(0, 8) + "…" : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 border border-[#3A3A3A] px-2.5 py-0.5 text-xs text-gray-300">
                        {TIPO_LABEL[f.tipo as TipoCFDI] ?? f.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white max-w-[180px] truncate" title={f.clienteNombre}>{f.clienteNombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.clienteRfc}</td>
                    <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(f.total)}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(f.fechaTimbrado)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={STATUS_TONE[f.status] ?? "pendiente"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {f.facturapiId && (
                          <a
                            href={`/api/facturapi/download?id=${f.facturapiId}&format=pdf`}
                            target="_blank" rel="noopener noreferrer" title="Descargar PDF"
                            className="rounded p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                        {f.facturapiId && (
                          <a
                            href={`/api/facturapi/download?id=${f.facturapiId}&format=xml`}
                            target="_blank" rel="noopener noreferrer" title="Descargar XML"
                            className="rounded p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-[#3A3A3A] px-4 py-2.5 text-xs text-gray-600">
              {filtered.length} de {merged.length} CFDIs
            </div>
          )}
        </div>
      )}

      {tab === "descarga" && <DescargaSATTab />}

      {/* Drawer emitir */}
      <EmitirDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEmitido={(cfdi) => setCfdiList((prev) => [cfdi, ...prev])}
      />
    </div>
  );
}
