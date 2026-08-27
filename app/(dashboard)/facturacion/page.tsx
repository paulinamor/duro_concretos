"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, CloudDownload,
  Download, Eye, EyeOff, FileDown, FileKey2, FileText, Loader2,
  Plus, Receipt, RefreshCw, Search, Send, ShieldCheck, Trash2, Upload, X, AlertCircle,
} from "lucide-react";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, getDocument, upsertDocument, COLLECTIONS } from "@/lib/db";
import { useCollectionRaw } from "@/lib/useCollection";
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

interface DescargaSAT {
  id:          string;
  requestId:   string;
  rfc:         string;
  status:      "pendiente" | "procesando" | "listo" | "error";
  direccion:   string;
  tipo:        string;
  fechaInicio: string;
  fechaFin:    string;
  packageIds:  string[];
  solicitadoEn?: { seconds: number } | string;
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
              <AppSelect value={tipo} onChange={(e) => setTipo(e.target.value as TipoCFDI)}>
                <option value="I">I — Ingreso</option>
                <option value="E">E — Egreso</option>
                <option value="T">T — Traslado</option>
              </AppSelect>
            </Field>
            <Field label="Serie">
              <input value={serie} onChange={(e) => setSerie(e.target.value)} className={inputCls} placeholder="A" />
            </Field>
            <Field label="Uso CFDI">
              <AppSelect value={uso} onChange={(e) => setUso(e.target.value)}>
                {USO_CFDI.map((u) => (
                  <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                ))}
              </AppSelect>
            </Field>
          </div>

          {/* Pago */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Método de pago">
              <AppSelect value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="PUE">PUE — Pago en una exhibición</option>
                <option value="PPD">PPD — Pago en parcialidades o diferido</option>
              </AppSelect>
            </Field>
            <Field label="Forma de pago">
              <AppSelect value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMA_PAGO.map((f) => (
                  <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>
                ))}
              </AppSelect>
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
                <AppSelect value={regimen} onChange={(e) => setRegimen(e.target.value)}>
                  {REGIMEN_FISCAL.map((r) => (
                    <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>
                  ))}
                </AppSelect>
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
                      <AppSelect value={c.tasaIVA} onChange={(e) => updConcepto(i, "tasaIVA", Number(e.target.value))}>
                        <option value={0.16}>16%</option>
                        <option value={0.08}>8%</option>
                        <option value={0}>0%</option>
                      </AppSelect>
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
                      <AppSelect value={c.claveUnidad} onChange={(e) => updConcepto(i, "claveUnidad", e.target.value)}>
                        {CLAVE_UNIDAD.map((u) => (
                          <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                        ))}
                      </AppSelect>
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

// ─── Tab: Descarga SAT (directo al SAT, sin BoxFactura) ──────────────────────

const satInp = "w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
const satLbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";

function fmtSatDate(ts?: { seconds: number } | string) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DescargaSATTab() {
  // ── Config e.firma ──────────────────────────────────────────────────────────
  const [satConfig,      setSatConfig]      = useState<{ rfc?: string; activo?: boolean; certB64?: string; keyB64?: string } | null>(null);
  const [loadingConfig,  setLoadingConfig]  = useState(true);
  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [cerFile,       setCerFile]       = useState<File | null>(null);
  const [keyFile,       setKeyFile]       = useState<File | null>(null);
  const [configPwd,     setConfigPwd]     = useState("");
  const [showConfigPwd, setShowConfigPwd] = useState(false);
  const [savingConfig,  setSavingConfig]  = useState(false);
  const [configMsg,     setConfigMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Contraseña de sesión ────────────────────────────────────────────────────
  const [sessionPwd,     setSessionPwd]     = useState("");
  const [showSessionPwd, setShowSessionPwd] = useState(false);

  // ── Nueva solicitud ─────────────────────────────────────────────────────────
  const [fechaInicio,   setFechaInicio]   = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [fechaFin,      setFechaFin]      = useState(() => new Date().toISOString().slice(0, 10));
  const [direccion,     setDireccion]     = useState<"emitidos" | "recibidos">("emitidos");
  const [tipoSolicitud, setTipoSolicitud] = useState<"cfdi" | "metadata">("cfdi");
  const [tipoDoc,       setTipoDoc]       = useState("");
  const [solicitando,   setSolicitando]   = useState(false);
  const [solicitudMsg,  setSolicitudMsg]  = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Verificación / descarga ─────────────────────────────────────────────────
  const [verificandoIds,  setVerificandoIds]  = useState<Set<string>>(new Set());
  const [verifyMsgs,      setVerifyMsgs]      = useState<Record<string, { ok: boolean; text: string }>>({});
  const [descargandoPkg, setDescargandoPkg] = useState<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionPwdRef = useRef(sessionPwd);
  const satConfigRef  = useRef(satConfig);
  const historialRef  = useRef<DescargaSAT[]>([]);

  useEffect(() => { sessionPwdRef.current = sessionPwd; }, [sessionPwd]);
  useEffect(() => { satConfigRef.current  = satConfig;  }, [satConfig]);

  // ── Historial ───────────────────────────────────────────────────────────────
  const historialRaw = useCollectionRaw<DescargaSAT>(COLLECTIONS.descargasSAT ?? "descargasSAT");
  const toSecs = (v?: { seconds: number } | string) =>
    !v ? 0 : typeof v === "string" ? new Date(v).getTime() / 1000 : v.seconds;
  const historial = [...(historialRaw ?? [])].sort((a, b) => toSecs(b.solicitadoEn) - toSecs(a.solicitadoEn));
  useEffect(() => { historialRef.current = historial; }, [historial]);

  useEffect(() => {
    getDocument<{ certB64: string; keyB64: string; rfc: string; activo: boolean }>(
      COLLECTIONS.configuracion, "sat_efirma"
    ).then((d) => {
      if (d?.certB64 && d?.keyB64) {
        setSatConfig({ rfc: d.rfc, activo: d.activo, certB64: d.certB64, keyB64: d.keyB64 });
      } else {
        setSatConfig(null);
      }
    }).catch(() => setSatConfig(null))
      .finally(() => setLoadingConfig(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Reanudar polling cuando hay contraseña + config + pendientes (incluyendo cuando historial carga por primera vez)
  const pollingStartedRef = useRef(false);
  useEffect(() => {
    if (!sessionPwd || !satConfig?.certB64 || !historialRaw) return;
    const pendientes = historial.filter(h => h.status === "pendiente");
    if (pendientes.length === 0) { pollingStartedRef.current = false; return; }
    if (pollingStartedRef.current) return;
    pollingStartedRef.current = true;
    pendientes.forEach(h => verificarConRefs(h.requestId));
    iniciarPollingGlobal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPwd, satConfig?.certB64, historialRaw]);

  async function handleGuardarConfig() {
    if (!cerFile || !keyFile || !configPwd) return;
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const form = new FormData();
      form.append("cer", cerFile);
      form.append("key", keyFile);
      form.append("password", configPwd);
      const resp = await fetch("/api/sat/configurar", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setConfigMsg({ type: "err", text: data.error });
      } else {
        // El route valida, el cliente guarda en Firestore (tiene sesión autenticada)
        await upsertDocument(COLLECTIONS.configuracion, "sat_efirma", {
          certB64: data.certB64, keyB64: data.keyB64, rfc: data.rfc, activo: true,
        });
        setConfigMsg({ type: "ok", text: `e.firma configurada · RFC ${data.rfc}` });
        setSatConfig({ rfc: data.rfc, activo: true, certB64: data.certB64, keyB64: data.keyB64 });
        setCerFile(null); setKeyFile(null); setConfigPwd("");
      }
    } catch {
      setConfigMsg({ type: "err", text: "Error de red al guardar la configuración." });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSolicitar() {
    if (!sessionPwd || !fechaInicio || !fechaFin || !satConfig?.certB64 || !satConfig?.keyB64) return;
    setSolicitando(true);
    setSolicitudMsg(null);
    try {
      const resp = await fetch("/api/sat/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionPwd,
          certB64: satConfig.certB64,
          keyB64: satConfig.keyB64,
          fechaInicio, fechaFin, direccion, tipo: tipoSolicitud, tipoDocumento: tipoDoc || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSolicitudMsg({ type: "err", text: data.error });
      } else {
        // Guardar historial en Firestore desde el cliente (tiene sesión autenticada)
        await upsertDocument(COLLECTIONS.descargasSAT, data.requestId, {
          requestId: data.requestId, rfc: satConfig.rfc,
          status: "pendiente", direccion, tipo: tipoSolicitud,
          tipoDocumento: tipoDoc || null, fechaInicio, fechaFin,
          packageIds: [], solicitadoEn: new Date().toISOString(),
        });
        setSolicitudMsg({ type: "ok", text: `Solicitud enviada · ID ${data.requestId}. El SAT puede tardar 2–10 min.` });
        iniciarPolling(data.requestId);
      }
    } catch {
      setSolicitudMsg({ type: "err", text: "Error de red al solicitar." });
    } finally {
      setSolicitando(false);
    }
  }

  async function verificarConRefs(requestId: string) {
    const pwd = sessionPwdRef.current;
    const cfg = satConfigRef.current;
    if (!pwd || !cfg?.certB64 || !cfg?.keyB64) return;
    setVerificandoIds(prev => new Set(prev).add(requestId));
    try {
      const resp = await fetch("/api/sat/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, password: pwd, certB64: cfg.certB64, keyB64: cfg.keyB64 }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setVerifyMsgs(m => ({ ...m, [requestId]: { ok: false, text: data.error ?? "Error al verificar." } }));
        return;
      }
      if (data.status) {
        await upsertDocument(COLLECTIONS.descargasSAT, requestId, {
          status: data.status, packageIds: data.packageIds ?? [],
        });
        const statusLabels: Record<string, string> = {
          listo: "Listo — descarga disponible",
          error: `Error SAT: ${data.mensaje ?? "solicitud rechazada"}`,
          procesando: `En proceso — ${data.mensaje ?? "el SAT está preparando el paquete"}`,
        };
        setVerifyMsgs(m => ({ ...m, [requestId]: { ok: data.status !== "error", text: statusLabels[data.status] ?? data.mensaje ?? data.status } }));
      }
    } catch (e) {
      setVerifyMsgs(m => ({ ...m, [requestId]: { ok: false, text: (e as Error).message ?? "Error de red." } }));
    } finally {
      setVerificandoIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  }

  function iniciarPollingGlobal() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      const pendientes = historialRef.current.filter(h => h.status === "pendiente");
      if (pendientes.length === 0) {
        clearInterval(pollRef.current!); pollRef.current = null; return;
      }
      pendientes.forEach(h => verificarConRefs(h.requestId));
    }, 30_000);
  }

  function iniciarPolling(_requestId: string) {
    iniciarPollingGlobal();
  }

  async function verificar(requestId: string) {
    await verificarConRefs(requestId);
  }

  async function descargarPaquete(packageId: string) {
    if (!sessionPwd || !satConfig?.certB64 || !satConfig?.keyB64) return;
    setDescargandoPkg(packageId);
    try {
      const resp = await fetch("/api/sat/descargar-paquete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, password: sessionPwd, certB64: satConfig.certB64, keyB64: satConfig.keyB64 }),
      });
      if (!resp.ok) { const e = await resp.json(); alert(e.error); return; }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `cfdi-${packageId}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargandoPkg(null);
    }
  }

  const statusBadge = (s: DescargaSAT["status"]) => {
    const cls: Record<DescargaSAT["status"], string> = {
      pendiente:  "bg-amber-500/10 text-amber-400",
      procesando: "bg-blue-500/10 text-blue-400",
      listo:      "bg-emerald-500/10 text-emerald-400",
      error:      "bg-red-500/10 text-red-400",
    };
    const labels: Record<DescargaSAT["status"], string> = {
      pendiente: "Pendiente", procesando: "Procesando…", listo: "Listo", error: "Error",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cls[s]}`}>
        {labels[s]}
      </span>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── e.firma ────────────────────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FileKey2 size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">e.firma del SAT</p>
            <p className="text-xs text-gray-500">Sube .cer y .key una sola vez</p>
          </div>
          {!loadingConfig && satConfig?.activo && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck size={13} /> Configurada · {satConfig.rfc}
            </span>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Archivo .cer", ref: cerRef, file: cerFile, set: setCerFile, accept: ".cer" },
              { label: "Archivo .key", ref: keyRef, file: keyFile, set: setKeyFile, accept: ".key" },
            ] as const).map((f) => (
              <div key={f.label}>
                <label className={satLbl}>{f.label}</label>
                <button
                  onClick={() => f.ref.current?.click()}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                    f.file ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-[#3A3A3A] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f.file ? <CheckCircle2 size={13} /> : <Upload size={13} />}
                  <span className="truncate">{f.file ? f.file.name : `Seleccionar ${f.accept}`}</span>
                </button>
                <input ref={f.ref} type="file" accept={f.accept} className="hidden"
                  onChange={(e) => f.set(e.target.files?.[0] ?? null)} />
              </div>
            ))}
          </div>

          <div>
            <label className={satLbl}>Contraseña de la llave privada</label>
            <div className="relative">
              <input
                type={showConfigPwd ? "text" : "password"}
                value={configPwd}
                onChange={(e) => setConfigPwd(e.target.value)}
                placeholder="Contraseña del archivo .key"
                className={satInp + " pr-10"}
              />
              <button onClick={() => setShowConfigPwd(!showConfigPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showConfigPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">La contraseña no se guarda. Se usa solo para validar la e.firma.</p>
          </div>

          {configMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${configMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {configMsg.type === "ok" ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <X size={13} className="shrink-0 mt-0.5" />}
              {configMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGuardarConfig}
              disabled={savingConfig || !cerFile || !keyFile || !configPwd}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {savingConfig ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              {savingConfig ? "Validando…" : "Guardar e.firma"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Nueva solicitud ─────────────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <CloudDownload size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nueva descarga del SAT</p>
            <p className="text-xs text-gray-500">El SAT puede tardar 2–10 minutos en preparar los paquetes</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={satLbl}>Contraseña de la e.firma <span className="text-[#CC2229]">*</span></label>
            <div className="relative">
              <input
                type={showSessionPwd ? "text" : "password"}
                value={sessionPwd}
                onChange={(e) => setSessionPwd(e.target.value)}
                placeholder="Necesaria para firmar cada solicitud al SAT"
                className={satInp + " pr-10"}
              />
              <button onClick={() => setShowSessionPwd(!showSessionPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showSessionPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={satLbl}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={satInp} />
            </div>
            <div>
              <label className={satLbl}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={satInp} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={satLbl}>Dirección</label>
              <AppSelect dark value={direccion} onChange={(e) => setDireccion(e.target.value as "emitidos" | "recibidos")}>
                <option value="emitidos">Emitidos</option>
                <option value="recibidos">Recibidos</option>
              </AppSelect>
            </div>
            <div>
              <label className={satLbl}>Tipo de solicitud</label>
              <AppSelect dark value={tipoSolicitud} onChange={(e) => setTipoSolicitud(e.target.value as "cfdi" | "metadata")}>
                <option value="cfdi">CFDI (XML)</option>
                <option value="metadata">Metadata</option>
              </AppSelect>
            </div>
            <div>
              <label className={satLbl}>Tipo de comprobante</label>
              <AppSelect dark value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                <option value="">Todos</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="traslado">Traslado</option>
                <option value="nomina">Nómina</option>
                <option value="pago">Pago</option>
              </AppSelect>
            </div>
          </div>

          {solicitudMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${solicitudMsg.type === "ok" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
              {solicitudMsg.type === "ok" ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <X size={13} className="shrink-0 mt-0.5" />}
              {solicitudMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSolicitar}
              disabled={solicitando || !sessionPwd || !fechaInicio || !fechaFin || !satConfig?.certB64}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {solicitando ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />}
              {solicitando ? "Enviando al SAT…" : "Solicitar descarga"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Historial ────────────────────────────────────────────────────────── */}
      {historial.length > 0 && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3A3A3A] text-gray-400">
              <FileText size={17} />
            </div>
            <p className="text-sm font-semibold text-white">Historial de descargas</p>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {historial.map((d) => (
              <div key={d.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(d.status)}
                    <span className="text-xs text-gray-400 font-mono">{d.requestId?.slice(0, 16)}…</span>
                    <span className="text-xs text-gray-500">{d.direccion} · {d.tipo}</span>
                    <span className="text-xs text-gray-600">{d.fechaInicio} → {d.fechaFin}</span>
                  </div>
                  {(d.status === "pendiente" || d.status === "procesando") && (
                    <button
                      onClick={() => verificar(d.requestId)}
                      disabled={!sessionPwd || verificandoIds.has(d.requestId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3A3A3A] text-gray-400 rounded-lg hover:border-blue-500/40 hover:text-blue-400 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <RefreshCw size={11} className={verificandoIds.has(d.requestId) ? "animate-spin" : ""} />
                      Verificar
                    </button>
                  )}
                </div>

                {d.status === "listo" && d.packageIds?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {d.packageIds.map((pkgId) => (
                      <button
                        key={pkgId}
                        onClick={() => descargarPaquete(pkgId)}
                        disabled={descargandoPkg === pkgId || !sessionPwd}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {descargandoPkg === pkgId ? <Loader2 size={11} className="animate-spin" /> : <ChevronDown size={11} />}
                        Paquete {pkgId.slice(-6)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-gray-600">{fmtSatDate(d.solicitadoEn)}</p>
                  {verifyMsgs[d.requestId] && (
                    <p className={`text-[10px] font-medium ${verifyMsgs[d.requestId].ok ? "text-emerald-400" : "text-red-400"}`}>
                      {verifyMsgs[d.requestId].text}
                    </p>
                  )}
                </div>
              </div>
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
