"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Camera, CheckCircle2, Clock, Download,
  Edit2, FileText, Loader2, Plus, Receipt, RefreshCw, Search, Settings,
  ShieldCheck, Trash2, Wallet, X, XCircle,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import ModuleLoading from "@/components/ModuleLoading";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, upsertDocument, COLLECTIONS, getAllUserProfiles, UserProfile } from "@/lib/db";
import { filterByPlanta, getStoredSession } from "@/lib/auth";
import { normalizeKey } from "@/lib/duplicateCheck";
import DuplicateWarningModal from "@/components/DuplicateWarningModal";
import { todayCST } from "@/lib/dateUtils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CajaChicaConfig {
  id: string;
  nombre: string;
  planta: string;
  responsable: string;        // nombre para display
  responsableEmail?: string;  // email de la cuenta del sistema
  activa: boolean;
  fechaCreacion: string;
}

interface DistribucionCaja {
  id: string;
  fecha: string;
  monto: number;
  cajaId: string;
  cajaNombre: string;
  concepto: string;
  autorizadoPor: string;
}

type EstadoGasto = "Revision" | "Aprobado" | "Rechazado";

interface GastoCajaChica {
  folio: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  comprobante: string;
  noComprobante: string;
  comprobanteEstado: string;
  responsable: string;
  autorizadoPor: string;
  estado: EstadoGasto;
  cajaId?: string;
  fotoBase64?: string;
  // Rastreo completo
  creadoEn: string;
  aprobadoEn?: string;
  aprobadoPor?: string;
  rechazadoEn?: string;
  rechazadoPor?: string;
  motivoRechazo?: string;
}

interface GastoFormData {
  fecha: string;
  monto: string;
  entrega: string;
  descripcion: string;
  categoria: string;
  autoriza: string;
  noTicket: string;
  soporte: string;
  foto: string;
}

interface ReciboEfectivo  { importe: number | null; planta?: string; origenConcreto?: boolean; entregado: boolean; }
interface SalidaEfectivo  { importe: number | null; planta?: string; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const PIE_COLORS     = ["#CC2229", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
const PUNTO_REPO     = 1500;
const CATEGORIAS     = ["Consumibles", "Mantenimiento", "Oficina", "Representación", "Seguridad", "Transporte"];
const tooltipStyle   = { backgroundColor: "#242424", border: "1px solid #3A3A3A", borderRadius: "8px", color: "#fff" };

function isoToDisplay(iso: string) { return iso.split("-").reverse().join("/"); }
function displayToIso(display: string) { return display.split("/").reverse().join("-"); }

function isoNow() { return new Date().toISOString(); }

function comprimirImagen(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Error al cargar imagen")); };
    img.src = url;
  });
}

function GastoDrawer({ open, onClose, onSave, hoy }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: GastoFormData) => Promise<void>;
  hoy: string;
}) {
  const [fecha, setFecha]       = useState(hoy);
  const [monto, setMonto]       = useState("");
  const [entrega, setEntrega]   = useState("");
  const [descripcion, setDesc]  = useState("");
  const [categoria, setCat]     = useState("Consumibles");
  const [autoriza, setAutoriza] = useState("");
  const [noTicket, setTicket]   = useState("S/N");
  const [soporte, setSoporte]   = useState("SI");
  const [foto, setFoto]         = useState("");
  const [fotoErr, setFotoErr]   = useState("");
  const [saving, setSaving]     = useState(false);
  const fileRef                 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFecha(hoy); setMonto(""); setEntrega(""); setDesc("");
    setCat("Consumibles"); setAutoriza(""); setTicket("S/N");
    setSoporte("SI"); setFoto(""); setFotoErr(""); setSaving(false);
  }, [open, hoy]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoErr("");
    try { setFoto(await comprimirImagen(file)); }
    catch { setFotoErr("Error al procesar imagen. Intenta de nuevo."); }
    e.target.value = "";
  }

  async function handleGuardar() {
    if (!foto)                     { setFotoErr("La foto del ticket es obligatoria"); return; }
    if (!monto || Number(monto) <= 0) return;
    setSaving(true);
    try { await onSave({ fecha, monto, entrega, descripcion, categoria, autoriza, noTicket, soporte, foto }); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row sm:justify-end">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative w-full sm:w-[480px] max-w-full bg-white flex flex-col shadow-2xl sm:border-l border-t border-gray-200 rounded-t-2xl sm:rounded-none max-h-[92svh] sm:max-h-full sm:h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]"><Receipt size={17} /></div>
            <div>
              <h2 className="text-gray-900 font-semibold text-base leading-tight">Registrar gasto</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Foto del ticket obligatoria</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Foto del ticket — primero para que sea lo más fácil en celular */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Foto del ticket <span className="text-[#CC2229]">*</span>
            </p>
            {foto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={foto} alt="Ticket" className="w-full max-h-56 object-contain bg-gray-50" />
                <button onClick={() => { setFoto(""); setTimeout(() => fileRef.current?.click(), 50); }}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs px-3 py-1.5 rounded-lg border border-gray-200 shadow flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <Camera size={12} /> Cambiar foto
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className={`w-full flex flex-col items-center justify-center gap-3 py-9 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  fotoErr ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-[#CC2229] hover:bg-gray-50"
                }`}>
                <Camera size={30} className={fotoErr ? "text-red-400" : "text-gray-300"} />
                <div className="text-center">
                  <p className={`font-semibold text-sm ${fotoErr ? "text-red-500" : "text-gray-600"}`}>{fotoErr || "Tomar foto del ticket"}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Se abrirá la cámara de tu celular</p>
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Monto ($) *</label>
              <input type="number" min="0.01" step="0.01" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Descripción *</label>
            <input type="text" placeholder="¿En qué se gastó?" value={descripcion} onChange={e => setDesc(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Entrega a</label>
            <input type="text" placeholder="Nombre de quien recibe el efectivo" value={entrega} onChange={e => setEntrega(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Categoría</label>
            <AppSelect value={categoria} onChange={e => setCat(e.target.value)}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </AppSelect>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">No. Ticket</label>
              <input type="text" placeholder="S/N" value={noTicket} onChange={e => setTicket(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">¿Tiene soporte?</label>
              <AppSelect value={soporte} onChange={e => setSoporte(e.target.value)}>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </AppSelect>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Autoriza</label>
            <input type="text" placeholder="Nombre de quien autoriza" value={autoriza} onChange={e => setAutoriza(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors" />
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4 flex gap-3 bg-white">
          <button onClick={onClose}
            className="flex-1 py-3.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-3.5 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <>Registrar gasto</>}
          </button>
        </div>
      </aside>
    </div>
  );
}

function folioSecuencial(caja: CajaChicaConfig | undefined, gastosDeCaja: GastoCajaChica[]): string {
  const prefix = (caja?.nombre ?? "CC").slice(0, 3).toUpperCase().replace(/\s/g, "");
  const now    = new Date();
  const yyMM   = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mes    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const enMes  = gastosDeCaja.filter(g => {
    const partes = g.fecha.split("/"); // DD/MM/YYYY
    return partes.length === 3 ? `${partes[2]}-${partes[1]}` === mes : false;
  }).length;
  return `${prefix}-${yyMM}-${String(enMes + 1).padStart(3, "0")}`;
}

function exportCSV(gastos: GastoCajaChica[], nombre: string) {
  const cabecera = ["Folio", "Fecha", "Descripcion", "Entrega", "Soporte", "No.Ticket", "Categoria", "Monto", "Estado", "Autoriza", "Creado", "Aprobado", "Rechazado", "MotivoRechazo"];
  const filas = gastos.map(g => [
    g.folio, g.fecha, `"${g.descripcion}"`, g.responsable, g.comprobante, g.noComprobante,
    g.categoria, g.monto, g.estado, g.autorizadoPor,
    g.creadoEn ?? "", g.aprobadoEn ?? "", g.rechazadoEn ?? "", `"${g.motivoRechazo ?? ""}"`,
  ]);
  const csv = [cabecera, ...filas].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url;
  a.download = `${nombre.replace(/\s/g, "_")}_gastos.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CajaChicaPage() {
  const [cajasConfig, setCajasConfig]         = useState<CajaChicaConfig[]>([]);
  const [distribuciones, setDistribuciones]   = useState<DistribucionCaja[]>([]);
  const [gastos, setGastos]                   = useState<GastoCajaChica[]>([]);
  const [recibosEfectivo, setRecibosEfectivo] = useState<ReciboEfectivo[]>([]);
  const [salidasEfectivo, setSalidasEfectivo] = useState<SalidaEfectivo[]>([]);
  const [usuarios, setUsuarios]               = useState<UserProfile[]>([]);
  const [loading, setLoading]                 = useState(true);
  const session = getStoredSession();

  const [vistaActiva, setVistaActiva]         = useState<"principal" | string>("principal");
  const [showNuevaCaja, setShowNuevaCaja]     = useState(false);
  const [showEditarCaja, setShowEditarCaja]   = useState<CajaChicaConfig | null>(null);
  const [showDistribuir, setShowDistribuir]   = useState(false);
  const [showFormGasto, setShowFormGasto]     = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [showRechazar, setShowRechazar]       = useState<GastoCajaChica | null>(null);
  const [showArqueo, setShowArqueo]           = useState(false);
  const [arqueoFisico, setArqueoFisico]       = useState("");
  const [filterEstado, setFilterEstado]       = useState("Todos");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [filterDesde, setFilterDesde]         = useState("");
  const [filterHasta, setFilterHasta]         = useState("");
  const [query, setQuery]                     = useState("");
  const [detalleKPI, setDetalleKPI]           = useState<"entradas" | "egresos" | "saldo" | null>(null);
  const [duplicateWarn, setDuplicateWarn]     = useState<{
    field: string; value: string; detail?: string; proceed: () => void;
  } | null>(null);
  const [fotoModal, setFotoModal]             = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<CajaChicaConfig>(COLLECTIONS.cajasConfig),
      getCollectionDocs<DistribucionCaja>(COLLECTIONS.cajasDistribuciones),
      getCollectionDocs<GastoCajaChica>(COLLECTIONS.cajaChica),
      getCollectionDocs<ReciboEfectivo>(COLLECTIONS.efectivo),
      getCollectionDocs<SalidaEfectivo>(COLLECTIONS.salidasEfectivo),
      getAllUserProfiles(),
    ]).then(([configs, dists, gsts, recibos, salidas, users]) => {
      const isAdmin = session?.role === "admin";
      const myEmail = session?.email ?? "";
      // Admin ve todas las cajas; operador solo las asignadas a su cuenta
      const visibleConfigs = (configs as CajaChicaConfig[]).filter(c =>
        c.activa && (isAdmin || !c.responsableEmail || c.responsableEmail === myEmail)
      );
      setCajasConfig(visibleConfigs);
      setDistribuciones(dists);
      setGastos(gsts);
      setRecibosEfectivo(filterByPlanta(recibos));
      setSalidasEfectivo(filterByPlanta(salidas));
      setUsuarios((users as UserProfile[]).filter(u => u.status === "Activo"));
    }).finally(() => setLoading(false));
  }, []);

  // ── Caja Principal ─────────────────────────────────────────────────────────

  // Solo recibos con entregado=true (dinero físicamente cobrado)
  const totalEfectivoEntradas = useMemo(() => recibosEfectivo.filter(r => r.entregado).reduce((s, r) => s + (r.importe ?? 0), 0), [recibosEfectivo]);
  const totalEfectivoSalidas  = useMemo(() => salidasEfectivo.reduce((s, r) => s + (r.importe ?? 0), 0), [salidasEfectivo]);
  const totalDistribuido      = useMemo(() => distribuciones.reduce((s, d) => s + d.monto, 0), [distribuciones]);
  const saldoPrincipal        = totalEfectivoEntradas - totalEfectivoSalidas - totalDistribuido;

  // ── Caja activa ────────────────────────────────────────────────────────────

  const cajaActual        = cajasConfig.find(c => c.id === vistaActiva);
  const cajaGastos        = useMemo(() => gastos.filter(g => g.cajaId === vistaActiva), [gastos, vistaActiva]);
  const cajaDistribuciones = useMemo(() => distribuciones.filter(d => d.cajaId === vistaActiva), [distribuciones, vistaActiva]);
  const totalRecibidoCaja = cajaDistribuciones.reduce((s, d) => s + d.monto, 0);
  const totalGastadoCaja  = cajaGastos.filter(g => g.estado === "Aprobado").reduce((s, g) => s + g.monto, 0);
  const saldoCaja         = totalRecibidoCaja - totalGastadoCaja;
  const enRevision        = cajaGastos.filter(g => g.estado === "Revision");
  const enRechazo         = cajaGastos.filter(g => g.estado === "Rechazado");
  const compPendientes    = cajaGastos.filter(g => g.comprobanteEstado === "Pendiente" && g.estado === "Aprobado").length;
  const requiereRepo      = saldoCaja <= PUNTO_REPO && totalRecibidoCaja > 0;
  const diferArqueo       = arqueoFisico !== "" ? (parseFloat(arqueoFisico) || 0) - saldoCaja : null;

  // Sobrante corriente por fila (saldo tras cada gasto aprobado, cronológico)
  const sobrantePorFolio = useMemo(() => {
    const aprobados = [...cajaGastos]
      .filter(g => g.estado === "Aprobado")
      .sort((a, b) => {
        const fa = a.fecha.includes("/") ? displayToIso(a.fecha) : a.fecha;
        const fb = b.fecha.includes("/") ? displayToIso(b.fecha) : b.fecha;
        return fa.localeCompare(fb) || a.folio.localeCompare(b.folio);
      });
    const map = new Map<string, number>();
    let bal = totalRecibidoCaja;
    for (const g of aprobados) { bal -= g.monto; map.set(g.folio, bal); }
    return map;
  }, [cajaGastos, totalRecibidoCaja]);

  const categorias    = cajaGastos.reduce((acc: Record<string, number>, g) => {
    if (g.estado !== "Rechazado") acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto;
    return acc;
  }, {});
  const pieData       = Object.entries(categorias).map(([name, value]) => ({ name, value }));
  const categoriasFiltro = ["Todas", ...Array.from(new Set(cajaGastos.map(g => g.categoria)))];

  const filteredGastos = cajaGastos.filter(g => {
    const term   = query.toLowerCase();
    const fechaIso = g.fecha.includes("/") ? displayToIso(g.fecha) : g.fecha;
    const dentroDesde = !filterDesde || fechaIso >= filterDesde;
    const dentroHasta = !filterHasta || fechaIso <= filterHasta;
    return (
      (filterEstado === "Todos"    || g.estado    === filterEstado) &&
      (filterCategoria === "Todas" || g.categoria === filterCategoria) &&
      dentroDesde && dentroHasta &&
      (g.folio.toLowerCase().includes(term) ||
       g.descripcion.toLowerCase().includes(term) ||
       g.responsable.toLowerCase().includes(term))
    );
  });

  const distsFiltradas = useMemo(
    () => [...distribuciones].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [distribuciones],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleNuevaCaja(values: Record<string, string>) {
    if (!values.Nombre?.trim() || !values.Planta?.trim()) return;
    const email = values.Responsable || "";
    const userNombre = usuarios.find(u => u.email === email)?.nombre || email;
    const id = `caja-${Date.now()}`;
    const nueva: CajaChicaConfig = {
      id, nombre: values.Nombre.trim(), planta: values.Planta.trim(),
      responsable: userNombre, responsableEmail: email || undefined,
      activa: true, fechaCreacion: todayCST().slice(0, 10),
    };
    setCajasConfig(prev => [...prev, nueva]);
    await upsertDocument(COLLECTIONS.cajasConfig, id, nueva);
    setVistaActiva(id);
  }

  async function handleEditarCaja(values: Record<string, string>) {
    if (!showEditarCaja) return;
    const email = values.Responsable || showEditarCaja.responsableEmail || "";
    const userNombre = usuarios.find(u => u.email === email)?.nombre || email || showEditarCaja.responsable;
    const updated = {
      ...showEditarCaja,
      nombre:           values.Nombre?.trim()   || showEditarCaja.nombre,
      planta:           values.Planta?.trim()   || showEditarCaja.planta,
      responsable:      userNombre,
      responsableEmail: email || undefined,
    };
    setCajasConfig(prev => prev.map(c => c.id === updated.id ? updated : c));
    await upsertDocument(COLLECTIONS.cajasConfig, updated.id, updated);
  }

  async function handleEliminarCaja(caja: CajaChicaConfig) {
    if (!confirm(`¿Desactivar la caja "${caja.nombre}"? Los gastos se conservan.`)) return;
    setCajasConfig(prev => prev.filter(c => c.id !== caja.id));
    await upsertDocument(COLLECTIONS.cajasConfig, caja.id, { ...caja, activa: false });
    if (vistaActiva === caja.id) setVistaActiva("principal");
  }

  async function handleDistribuir(values: Record<string, string>) {
    const cajaId     = values["Caja destino"] || "";
    const cajaNombre = cajasConfig.find(c => c.id === cajaId)?.nombre ?? cajaId;
    const monto      = Number(values.Monto || 0);
    if (!cajaId || monto <= 0) return;
    const id   = `dist-${Date.now()}`;
    const dist: DistribucionCaja = {
      id, fecha: values.Fecha || todayCST().slice(0, 10), monto, cajaId, cajaNombre,
      concepto: values.Concepto?.trim() || "Reposición de fondo",
      autorizadoPor: values.Autoriza?.trim() || "",
    };
    setDistribuciones(prev => [dist, ...prev]);
    await upsertDocument(COLLECTIONS.cajasDistribuciones, id, dist);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `$${monto.toLocaleString()} distribuidos a ${cajaNombre}.` },
    }));
  }

  async function handleSaveGasto(data: GastoFormData, force = false) {
    const id      = Date.now().toString();
    const rawDate = data.fecha || todayCST().slice(0, 10);
    const fecha   = isoToDisplay(rawDate);
    const monto   = Number(data.monto || 0);

    if (!force) {
      const desc = normalizeKey(data.descripcion || "");
      const dup  = cajaGastos.find(g =>
        g.fecha === fecha && normalizeKey(g.descripcion) === desc && g.monto === monto,
      );
      if (dup) {
        setDuplicateWarn({
          field: "Descripción + Fecha + Monto",
          value: `${data.descripcion} — ${fecha} — $${monto.toLocaleString("es-MX")}`,
          detail: `Folio ${dup.folio}`,
          proceed: () => { setDuplicateWarn(null); void handleSaveGasto(data, true); },
        });
        return;
      }
    }

    const folio = folioSecuencial(cajaActual, cajaGastos);
    const newGasto: GastoCajaChica = {
      folio,
      fecha,
      descripcion:       data.descripcion?.trim()  || "",
      categoria:         data.categoria             || "Consumibles",
      monto,
      comprobante:       data.soporte               || "SI",
      noComprobante:     data.noTicket              || "S/N",
      comprobanteEstado: "Pendiente",
      responsable:       data.entrega?.trim()       || "",
      autorizadoPor:     data.autoriza?.trim()      || "",
      estado:            "Revision",
      cajaId:            vistaActiva,
      fotoBase64:        data.foto || undefined,
      creadoEn:          isoNow(),
    };

    setGastos(prev => [newGasto, ...prev]);
    try {
      await upsertDocument(COLLECTIONS.cajaChica, id, newGasto);
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `Gasto ${folio} registrado.` },
      }));
    } catch (e) {
      console.error(e);
      setGastos(prev => prev.filter(g => g.folio !== folio));
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "error", message: "Error al guardar. Intenta de nuevo." },
      }));
    }
  }

  async function handleAprobar(gasto: GastoCajaChica) {
    const updated: GastoCajaChica = {
      ...gasto,
      estado:           "Aprobado",
      comprobanteEstado: "Validado",
      aprobadoEn:        isoNow(),
      aprobadoPor:       "Admin",
    };
    setGastos(prev => prev.map(g => g.folio === gasto.folio ? updated : g));
    try {
      await upsertDocument(COLLECTIONS.cajaChica, gasto.folio.slice(gasto.folio.lastIndexOf("-") + 1), updated);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Gasto ${gasto.folio} aprobado.` } }));
    } catch (e) {
      console.error(e);
      setGastos(prev => prev.map(g => g.folio === gasto.folio ? gasto : g));
    }
  }

  async function handleRechazar(values: Record<string, string>) {
    if (!showRechazar) return;
    const motivo  = values["Motivo de rechazo"]?.trim() || "Sin motivo";
    const updated: GastoCajaChica = {
      ...showRechazar,
      estado:        "Rechazado",
      rechazadoEn:   isoNow(),
      rechazadoPor:  "Admin",
      motivoRechazo: motivo,
    };
    setGastos(prev => prev.map(g => g.folio === showRechazar.folio ? updated : g));
    const docId = showRechazar.folio.slice(showRechazar.folio.lastIndexOf("-") + 1);
    await upsertDocument(COLLECTIONS.cajaChica, docId, updated);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "warning", message: `Gasto ${showRechazar.folio} rechazado.` } }));
  }

  const hoy = todayCST().slice(0, 10);

  if (loading) return <ModuleLoading label="Cargando cajas…" />;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-sm">Control de efectivo y gastos menores</p>
        <div className="flex gap-2">
          {vistaActiva === "principal" ? (
            <button
              onClick={() => setShowDistribuir(true)}
              disabled={cajasConfig.length === 0}
              className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowRight size={14} />
              Distribuir a caja
            </button>
          ) : (
            <>
              <button
                onClick={() => exportCSV(filteredGastos, cajaActual?.nombre ?? "caja")}
                title="Exportar gastos a CSV"
                className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-green-600 text-gray-400 hover:text-green-400 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#3A3A3A] text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
                title="Configurar caja"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setShowFormGasto(true)}
                className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Registrar Gasto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs de cajas */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setVistaActiva("principal")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            vistaActiva === "principal"
              ? "bg-[#CC2229] border-[#CC2229] text-white"
              : "bg-[#242424] border-[#3A3A3A] text-gray-300 hover:border-[#CC2229]/60"
          }`}
        >
          <Wallet size={14} />
          Principal
          <span className={`text-xs rounded px-1.5 py-0.5 font-mono ${vistaActiva === "principal" ? "bg-white/20" : "bg-[#1A1A1A] text-gray-400"}`}>
            ${saldoPrincipal.toLocaleString()}
          </span>
        </button>

        {cajasConfig.map(c => {
          const rec  = distribuciones.filter(d => d.cajaId === c.id).reduce((s, d) => s + d.monto, 0);
          const gas  = gastos.filter(g => g.cajaId === c.id && g.estado === "Aprobado").reduce((s, g) => s + g.monto, 0);
          const sal  = rec - gas;
          const pend = gastos.filter(g => g.cajaId === c.id && g.estado === "Revision").length;
          return (
            <button
              key={c.id}
              onClick={() => { setVistaActiva(c.id); setFilterEstado("Todos"); setFilterCategoria("Todas"); setQuery(""); setFilterDesde(""); setFilterHasta(""); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                c.id === vistaActiva
                  ? "bg-[#CC2229] border-[#CC2229] text-white"
                  : "bg-[#242424] border-[#3A3A3A] text-gray-300 hover:border-[#CC2229]/60"
              }`}
            >
              <Wallet size={14} />
              {c.nombre}
              <span className={`text-xs rounded px-1.5 py-0.5 font-mono ${c.id === vistaActiva ? "bg-white/20" : "bg-[#1A1A1A] text-gray-400"}`}>
                ${sal.toLocaleString()}
              </span>
              {pend > 0 && (
                <span className="text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5 leading-none">{pend}</span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => setShowNuevaCaja(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-[#3A3A3A] text-gray-500 hover:border-[#CC2229]/60 hover:text-gray-300 text-sm transition-all"
        >
          <Plus size={14} />
          Nueva caja
        </button>
      </div>

      {/* ── Vista Principal ─────────────────────────────────────────────────── */}
      {vistaActiva === "principal" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Entradas */}
            <button type="button" onClick={() => setDetalleKPI(detalleKPI === "entradas" ? null : "entradas")}
              className={`bg-[#242424] border rounded-xl p-5 text-left transition-all cursor-pointer hover:border-green-500/40 ${detalleKPI === "entradas" ? "border-green-500/60 ring-1 ring-green-500/20" : "border-[#3A3A3A]"}`}>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Entradas de efectivo</p>
              <p className="text-green-400 font-bold text-2xl">${totalEfectivoEntradas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-gray-500 text-xs mt-1">{recibosEfectivo.filter(r => r.entregado).length} recibos entregados · toca para ver detalle</p>
            </button>
            {/* Egresos */}
            <button type="button" onClick={() => setDetalleKPI(detalleKPI === "egresos" ? null : "egresos")}
              className={`bg-[#242424] border rounded-xl p-5 text-left transition-all cursor-pointer hover:border-orange-500/40 ${detalleKPI === "egresos" ? "border-orange-500/60 ring-1 ring-orange-500/20" : "border-[#3A3A3A]"}`}>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total egresos</p>
              <p className="text-orange-400 font-bold text-2xl">${(totalEfectivoSalidas + totalDistribuido).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-gray-500 text-xs mt-1">
                Egresos: ${totalEfectivoSalidas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Cajas: ${totalDistribuido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </button>
            {/* Saldo */}
            <button type="button" onClick={() => setDetalleKPI(detalleKPI === "saldo" ? null : "saldo")}
              className={`bg-[#242424] border rounded-xl p-5 text-left transition-all cursor-pointer hover:border-blue-500/40 ${detalleKPI === "saldo" ? "border-blue-500/60 ring-1 ring-blue-500/20" : saldoPrincipal < 0 ? "border-red-800" : "border-[#3A3A3A]"}`}>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Saldo disponible</p>
              <p className={`font-bold text-2xl ${saldoPrincipal < 0 ? "text-red-400" : "text-white"}`}>
                ${saldoPrincipal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-gray-500 text-xs mt-1">Entradas − egresos − cajas · toca para ver fórmula</p>
            </button>
          </div>

          {/* Panel de detalle KPI */}
          {detalleKPI && (
            <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl p-5 text-sm">
              {detalleKPI === "entradas" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">¿De dónde vienen las entradas?</h4>
                    <button type="button" onClick={() => setDetalleKPI(null)} className="text-gray-500 hover:text-white text-xs cursor-pointer">✕ cerrar</button>
                  </div>
                  <p className="text-gray-400 mb-3 leading-relaxed">
                    Este monto viene del <span className="text-white font-medium">módulo de Efectivo</span>. Son todos los recibos de concreto que ya fueron cobrados y marcados como <span className="text-green-400 font-medium">entregados físicamente</span> a caja. Los recibos que aún no se entregan <strong>no</strong> se cuentan aquí.
                  </p>
                  <div className="flex items-center gap-4 bg-[#242424] rounded-lg p-3">
                    <div>
                      <p className="text-gray-500 text-xs">Recibos entregados</p>
                      <p className="text-green-400 font-bold text-lg">{recibosEfectivo.filter(r => r.entregado).length}</p>
                    </div>
                    <div className="w-px h-10 bg-[#3A3A3A]" />
                    <div>
                      <p className="text-gray-500 text-xs">Recibos pendientes (no cuentan)</p>
                      <p className="text-gray-400 font-bold text-lg">{recibosEfectivo.filter(r => !r.entregado).length}</p>
                    </div>
                    <div className="w-px h-10 bg-[#3A3A3A]" />
                    <div>
                      <p className="text-gray-500 text-xs">Total entregado</p>
                      <p className="text-green-400 font-bold text-lg">${totalEfectivoEntradas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs mt-3">Para ver el detalle de cada recibo entra al módulo <span className="text-gray-400">Efectivo → Control de efectivo</span>.</p>
                </div>
              )}

              {detalleKPI === "egresos" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">¿De dónde vienen los egresos?</h4>
                    <button type="button" onClick={() => setDetalleKPI(null)} className="text-gray-500 hover:text-white text-xs cursor-pointer">✕ cerrar</button>
                  </div>
                  <p className="text-gray-400 mb-4 leading-relaxed">
                    El total de egresos tiene <span className="text-white font-medium">dos fuentes</span>:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#242424] rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">① Egresos directos de efectivo</p>
                      <p className="text-orange-400 font-bold text-xl">${totalEfectivoSalidas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-gray-500 text-xs mt-1">{salidasEfectivo.length} movimientos registrados en el módulo de Efectivo</p>
                    </div>
                    <div className="bg-[#242424] rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">② Distribuido a cajas chicas</p>
                      <p className="text-orange-400 font-bold text-xl">${totalDistribuido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-gray-500 text-xs mt-1">{distribuciones.length} distribuciones a {cajasConfig.length} caja{cajasConfig.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {distribuciones.length > 0 && (
                    <>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Historial de distribuciones a cajas</p>
                      <div className="rounded-lg overflow-hidden border border-[#3A3A3A]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#242424]">
                              {["Fecha", "Caja destino", "Concepto", "Monto"].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...distribuciones].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((d, i) => (
                              <tr key={d.id} className={i % 2 === 0 ? "bg-[#1A1A1A]" : "bg-[#1E1E1E]"}>
                                <td className="px-3 py-2 text-gray-400">{isoToDisplay(d.fecha)}</td>
                                <td className="px-3 py-2 text-white font-medium">{d.cajaNombre}</td>
                                <td className="px-3 py-2 text-gray-400">{d.concepto}</td>
                                <td className="px-3 py-2 text-orange-400 font-semibold text-right">${d.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {detalleKPI === "saldo" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold">¿Cómo se calcula el saldo disponible?</h4>
                    <button type="button" onClick={() => setDetalleKPI(null)} className="text-gray-500 hover:text-white text-xs cursor-pointer">✕ cerrar</button>
                  </div>
                  <div className="bg-[#242424] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Entradas de efectivo (recibos entregados)</span>
                      <span className="text-green-400 font-semibold">+ ${totalEfectivoEntradas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Egresos directos de efectivo</span>
                      <span className="text-red-400 font-semibold">− ${totalEfectivoSalidas.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Distribuido a cajas chicas</span>
                      <span className="text-red-400 font-semibold">− ${totalDistribuido.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-[#3A3A3A] pt-3 flex items-center justify-between">
                      <span className="text-white font-bold">Saldo disponible en caja principal</span>
                      <span className={`font-bold text-lg ${saldoPrincipal < 0 ? "text-red-400" : "text-white"}`}>
                        = ${saldoPrincipal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {cajasConfig.length > 0 && (
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
                <h3 className="text-white font-semibold">Distribución por caja chica</h3>
                <button
                  onClick={() => setShowDistribuir(true)}
                  className="flex items-center gap-1.5 text-xs bg-[#CC2229] hover:bg-[#991A1E] text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ArrowRight size={12} />
                  Distribuir fondos
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Caja", "Planta", "Responsable", "Recibido", "Gastado", "En revisión", "Saldo", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {cajasConfig.map(c => {
                      const recibido  = distribuciones.filter(d => d.cajaId === c.id).reduce((s, d) => s + d.monto, 0);
                      const gastado   = gastos.filter(g => g.cajaId === c.id && g.estado === "Aprobado").reduce((s, g) => s + g.monto, 0);
                      const revision  = gastos.filter(g => g.cajaId === c.id && g.estado === "Revision").length;
                      const saldo     = recibido - gastado;
                      return (
                        <tr key={c.id} className="hover:bg-[#2A2A2A] transition-colors cursor-pointer" onClick={() => setVistaActiva(c.id)}>
                          <td className="px-4 py-3 text-white font-medium">{c.nombre}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{c.planta}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className="text-gray-300">{c.responsable || "—"}</span>
                            {c.responsableEmail && <p className="text-gray-600 text-[10px] mt-0.5">{c.responsableEmail}</p>}
                          </td>
                          <td className="px-4 py-3 text-green-400 font-mono text-xs">${recibido.toLocaleString()}</td>
                          <td className="px-4 py-3 text-red-400 font-mono text-xs">${gastado.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">
                            {revision > 0 ? <span className="text-orange-400">{revision} pendientes</span> : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold font-mono text-xs">
                            <span className={saldo < 0 ? "text-red-400" : saldo <= PUNTO_REPO ? "text-orange-400" : "text-white"}>
                              ${saldo.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500 hover:text-white transition-colors">Ver →</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cajasConfig.length === 0 && (
            <div className="bg-[#242424] border border-dashed border-[#3A3A3A] rounded-xl p-10 text-center">
              <Wallet className="mx-auto text-gray-600 mb-3" size={32} />
              <p className="text-gray-400 font-medium mb-1">Sin cajas chicas configuradas</p>
              <p className="text-gray-500 text-sm mb-4">Crea una caja chica para empezar a registrar gastos</p>
              <button
                onClick={() => setShowNuevaCaja(true)}
                className="inline-flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                Crear primera caja
              </button>
            </div>
          )}

          {distsFiltradas.length > 0 && (
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3A3A3A]">
                <h3 className="text-white font-semibold">Historial de distribuciones</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Fecha", "Caja destino", "Planta", "Monto", "Concepto", "Autoriza"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {distsFiltradas.map(d => (
                      <tr key={d.id} className="hover:bg-[#2A2A2A] transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{d.fecha}</td>
                        <td className="px-4 py-3 text-white">{d.cajaNombre}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{cajasConfig.find(c => c.id === d.cajaId)?.planta ?? "—"}</td>
                        <td className="px-4 py-3 text-green-400 font-semibold">${d.monto.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-300">{d.concepto}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{d.autorizadoPor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Vista Caja Chica ────────────────────────────────────────────────── */}
      {vistaActiva !== "principal" && cajaActual && (
        <>
          {/* Info de la caja + saldo */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="text-[#CC2229]" size={20} />
                  <h2 className="text-white font-bold text-xl">{cajaActual.nombre}</h2>
                  <span className="text-xs bg-[#1A1A1A] border border-[#3A3A3A] text-gray-400 rounded px-2 py-0.5">{cajaActual.planta}</span>
                </div>
                <p className="text-gray-500 text-xs">
                  Responsable: <span className="text-gray-300">{cajaActual.responsable || "—"}</span>
                  {cajaActual.responsableEmail && (
                    <span className="ml-1 text-gray-600">({cajaActual.responsableEmail})</span>
                  )}
                  {" · "}Creada: {cajaActual.fechaCreacion}
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-green-400 font-bold text-xl">${totalRecibidoCaja.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Recibido</p>
                </div>
                <div>
                  <p className="text-red-400 font-bold text-xl">${totalGastadoCaja.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Gastado</p>
                </div>
                <div>
                  <p className={`font-bold text-xl ${saldoCaja < 0 ? "text-red-400" : "text-white"}`}>
                    ${saldoCaja.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">Disponible</p>
                </div>
                {enRevision.length > 0 && (
                  <div>
                    <p className="text-orange-400 font-bold text-xl">{enRevision.length}</p>
                    <p className="text-gray-500 text-xs">En revisión</p>
                  </div>
                )}
              </div>
            </div>

            {totalRecibidoCaja > 0 && (
              <>
                <div className="w-full bg-[#1A1A1A] rounded-full h-2.5 overflow-hidden mt-4">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      totalGastadoCaja / totalRecibidoCaja >= 0.8 ? "bg-red-500"
                      : totalGastadoCaja / totalRecibidoCaja >= 0.6 ? "bg-orange-500" : "bg-[#CC2229]"
                    }`}
                    style={{ width: `${Math.min(100, Math.round((totalGastadoCaja / totalRecibidoCaja) * 100))}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1.5">
                  {Math.round((totalGastadoCaja / totalRecibidoCaja) * 100)}% del fondo utilizado
                </p>
              </>
            )}

            {requiereRepo && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-700 bg-orange-900/20 px-3 py-2 text-sm text-orange-300">
                <AlertTriangle size={14} />
                Fondo bajo — solicitar reposición desde Caja Principal
              </div>
            )}
            {totalRecibidoCaja === 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-900/20 px-3 py-2 text-sm text-blue-300">
                <ArrowRight size={14} />
                Esta caja aún no ha recibido fondos. Ve a Caja Principal → Distribuir fondos.
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard title="En revisión" value={String(enRevision.length)} icon={Clock} iconColor="text-orange-400"
              subtitle={`$${enRevision.reduce((s, g) => s + g.monto, 0).toLocaleString()} por revisar`}
              active={filterEstado === "Revision"} onClick={() => setFilterEstado(filterEstado === "Revision" ? "Todos" : "Revision")} />
            <KPICard title="Aprobados" value={String(cajaGastos.filter(g => g.estado === "Aprobado").length)} icon={CheckCircle2} iconColor="text-green-400"
              subtitle={`$${totalGastadoCaja.toLocaleString()} aprobados`}
              active={filterEstado === "Aprobado"} onClick={() => setFilterEstado(filterEstado === "Aprobado" ? "Todos" : "Aprobado")} />
            <KPICard title="Rechazados" value={String(enRechazo.length)} icon={XCircle} iconColor="text-red-400"
              subtitle="Con motivo registrado"
              active={filterEstado === "Rechazado"} onClick={() => setFilterEstado(filterEstado === "Rechazado" ? "Todos" : "Rechazado")} />
            <KPICard title="Arqueo" value={`$${saldoCaja.toLocaleString()}`} icon={ShieldCheck} iconColor="text-blue-400"
              subtitle={diferArqueo !== null ? (diferArqueo === 0 ? "✓ Cuadra" : `Diferencia: $${diferArqueo.toLocaleString()}`) : "Clic para registrar"}
              active={showArqueo} onClick={() => setShowArqueo(!showArqueo)} />
          </div>

          {/* Arqueo expandido */}
          {showArqueo && (
            <div className="bg-[#242424] border border-blue-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-400" />
                Arqueo de caja — {cajaActual.nombre}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Saldo calculado (sistema)</p>
                  <p className="text-white font-bold text-xl">${saldoCaja.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Efectivo físico contado ($)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={arqueoFisico}
                    onChange={e => setArqueoFisico(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#1A1A1A] border border-[#3A3A3A] focus:border-blue-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  />
                </div>
                <div>
                  {diferArqueo !== null && (
                    <div className={`rounded-lg p-3 ${diferArqueo === 0 ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"}`}>
                      <p className="text-xs text-gray-400 mb-0.5">Diferencia</p>
                      <p className={`font-bold text-lg ${diferArqueo === 0 ? "text-green-400" : "text-red-400"}`}>
                        {diferArqueo >= 0 ? "+" : ""}${diferArqueo.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {diferArqueo === 0 ? "Cuadra perfectamente" : diferArqueo > 0 ? "Sobrante" : "Faltante"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-gray-600 text-xs mt-3">El arqueo es informativo. Registra el físico para comparar con el sistema.</p>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 space-y-3">
            {/* Fila 1: búsqueda + conteo */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por folio, descripción o entrega…"
                  className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600"
                />
              </div>
              {(query || filterEstado !== "Todos" || filterCategoria !== "Todas" || filterDesde || filterHasta) && (
                <button onClick={() => { setQuery(""); setFilterEstado("Todos"); setFilterCategoria("Todas"); setFilterDesde(""); setFilterHasta(""); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#CC2229] transition-colors cursor-pointer">
                  <X size={12} /> Limpiar filtros
                </button>
              )}
              <span className="text-gray-500 text-xs ml-auto">{filteredGastos.length} de {cajaGastos.length} gastos</span>
            </div>
            {/* Fila 2: filtros categóricos */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Estado</span>
                <AppSelect dark value={filterEstado} onChange={e => setFilterEstado(e.target.value)} wrapperClassName="">
                  {["Todos", "Aprobado", "Revision", "Rechazado"].map(e => <option key={e}>{e}</option>)}
                </AppSelect>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Categoría</span>
                <AppSelect dark value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)} wrapperClassName="">
                  {categoriasFiltro.map(c => <option key={c}>{c}</option>)}
                </AppSelect>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Período</span>
                <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)}
                  className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
                <span className="text-gray-600 text-xs">—</span>
                <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)}
                  className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
              </div>
            </div>
          </div>

          {/* Gráfica + Tabla */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Gastos por categoría</h3>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Sin gastos</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
                    <Legend formatter={(v) => <span className="text-gray-300 text-xs">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {/* Mini resumen */}
              <div className="mt-4 space-y-2 border-t border-[#3A3A3A] pt-4">
                {Object.entries(categorias).sort((a, b) => b[1] - a[1]).map(([cat, tot]) => (
                  <div key={cat} className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">{cat}</span>
                    <span className="text-white font-mono">${tot.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between">
                <h3 className="text-white font-semibold">Gastos — {cajaActual.nombre}</h3>
                <button
                  onClick={() => exportCSV(filteredGastos, cajaActual.nombre)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-400 transition-colors"
                >
                  <Download size={12} />
                  Exportar CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Folio", "Fecha", "Descripción", "Entrega", "Soporte", "Monto", "Sobrante", "Cat.", "Estado", "Foto", ""].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {filteredGastos.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500 text-sm">Sin gastos con los filtros actuales</td></tr>
                    ) : filteredGastos.map(g => {
                      const sobrante = sobrantePorFolio.get(g.folio);
                      return (
                      <tr key={g.folio} className={`hover:bg-[#2A2A2A] transition-colors ${g.estado === "Rechazado" ? "opacity-60" : ""}`}>
                        <td className="px-3 py-3 text-[#CC2229] font-mono text-xs">{g.folio}</td>
                        <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{g.fecha}</td>
                        <td className="px-3 py-3 text-gray-200 max-w-[160px] truncate" title={g.descripcion}>{g.descripcion}</td>
                        <td className="px-3 py-3 text-gray-300 text-xs whitespace-nowrap">{g.responsable || "—"}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold ${g.comprobante === "NO" ? "text-red-400" : "text-green-400"}`}>
                            {g.comprobante || "SI"}
                          </span>
                          {g.noComprobante && g.noComprobante !== "S/N" && (
                            <p className="text-gray-600 text-xs">{g.noComprobante}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-white font-semibold whitespace-nowrap">${g.monto.toLocaleString()}</td>
                        <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                          {sobrante !== undefined
                            ? <span className={sobrante < 0 ? "text-red-400 font-semibold" : "text-gray-300"}>${sobrante.toLocaleString()}</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{g.categoria}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={g.estado} />
                          {g.estado === "Aprobado" && g.aprobadoEn && (
                            <p className="text-gray-600 text-xs mt-0.5">
                              {new Date(g.aprobadoEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                            </p>
                          )}
                          {g.estado === "Rechazado" && g.motivoRechazo && (
                            <p className="text-red-500 text-xs mt-0.5 max-w-[120px] truncate" title={g.motivoRechazo}>
                              {g.motivoRechazo}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {g.fotoBase64 ? (
                            <button onClick={() => setFotoModal(g.fotoBase64!)} className="cursor-pointer hover:opacity-80 transition-opacity">
                              <img src={g.fotoBase64} alt="ticket" className="w-8 h-8 rounded-lg object-cover border border-[#3A3A3A]" />
                            </button>
                          ) : <span className="text-gray-600 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          {g.estado === "Revision" && (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleAprobar(g)}
                                className="text-xs bg-[#1A1A1A] border border-[#3A3A3A] hover:border-green-500 hover:text-green-400 text-gray-300 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                ✓ Aprobar
                              </button>
                              <button
                                onClick={() => setShowRechazar(g)}
                                className="text-xs bg-[#1A1A1A] border border-[#3A3A3A] hover:border-red-500 hover:text-red-400 text-gray-400 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                ✗ Rechazar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                  {filteredGastos.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#1A1A1A] border-t border-[#3A3A3A]">
                        <td colSpan={5} className="px-3 py-2 text-xs text-gray-500 font-semibold">Total ({filteredGastos.length} gastos)</td>
                        <td className="px-3 py-2 text-white font-bold text-sm">
                          ${filteredGastos.reduce((s, g) => s + g.monto, 0).toLocaleString()}
                        </td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* ── Bitácora de movimientos ──────────────────────────────────────── */}
          {(() => {
            // Construir timeline unificado: distribuciones + gastos con sus eventos
            type Evento = { ts: string; tipo: "distribucion" | "gasto_creado" | "gasto_aprobado" | "gasto_rechazado"; label: string; monto: number; detalle?: string; color: string; };
            const eventos: Evento[] = [];

            cajaDistribuciones.forEach(d => {
              eventos.push({ ts: d.fecha, tipo: "distribucion", label: `Fondos recibidos de Caja Principal`, monto: d.monto, detalle: d.concepto ? `Concepto: ${d.concepto}` : undefined, color: "text-green-400" });
            });
            cajaGastos.forEach(g => {
              if (g.creadoEn) eventos.push({ ts: g.creadoEn, tipo: "gasto_creado",    label: `Gasto registrado — ${g.folio}`, monto: g.monto, detalle: g.descripcion, color: "text-gray-400" });
              if (g.aprobadoEn) eventos.push({ ts: g.aprobadoEn, tipo: "gasto_aprobado",  label: `Gasto aprobado — ${g.folio}`,    monto: g.monto, detalle: `Aprobado por: ${g.aprobadoPor || "—"}`, color: "text-blue-400" });
              if (g.rechazadoEn) eventos.push({ ts: g.rechazadoEn, tipo: "gasto_rechazado", label: `Gasto rechazado — ${g.folio}`,   monto: g.monto, detalle: g.motivoRechazo ? `Motivo: ${g.motivoRechazo}` : undefined, color: "text-red-400" });
            });
            eventos.sort((a, b) => b.ts.localeCompare(a.ts));

            if (eventos.length === 0) return null;

            const iconoEvento = (tipo: Evento["tipo"]) => {
              if (tipo === "distribucion")     return <span className="text-green-400 text-base">↓</span>;
              if (tipo === "gasto_creado")     return <span className="text-gray-400 text-base">·</span>;
              if (tipo === "gasto_aprobado")   return <span className="text-blue-400 text-base">✓</span>;
              if (tipo === "gasto_rechazado")  return <span className="text-red-400 text-base">✗</span>;
            };

            return (
              <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
                <details>
                  <summary className="px-5 py-4 cursor-pointer flex items-center justify-between hover:bg-[#2A2A2A] transition-colors list-none">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-gray-400" />
                      <span className="text-white font-semibold text-sm">Bitácora de movimientos</span>
                      <span className="text-xs text-gray-500 bg-[#1A1A1A] px-2 py-0.5 rounded-full">{eventos.length} eventos</span>
                    </div>
                    <span className="text-gray-600 text-xs">▸ expandir</span>
                  </summary>
                  <div className="border-t border-[#3A3A3A] divide-y divide-[#2A2A2A]">
                    {eventos.map((ev, i) => (
                      <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-[#2A2A2A] transition-colors">
                        <div className="mt-0.5 w-5 text-center shrink-0">{iconoEvento(ev.tipo)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-medium ${ev.color}`}>{ev.label}</span>
                            <span className={`text-xs font-semibold shrink-0 ${ev.tipo === "distribucion" ? "text-green-400" : "text-gray-300"}`}>
                              {ev.tipo === "distribucion" ? "+" : "−"}${ev.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {ev.detalle && <p className="text-gray-600 text-xs mt-0.5 truncate">{ev.detalle}</p>}
                          <p className="text-gray-700 text-[10px] mt-0.5">{new Date(ev.ts).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Modales ─────────────────────────────────────────────────────────── */}

      <FormModal
        open={showNuevaCaja} title="Nueva caja chica"
        onClose={() => setShowNuevaCaja(false)} onSave={handleNuevaCaja}
        footer={
          <>
            <button onClick={() => setShowNuevaCaja(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Crear caja</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nombre</label>
            <input type="text" placeholder="Ej. Caja Allende, Caja Oficina" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Planta</label>
            <AppSelect>{["Allende", "Pesquería"].map(p => <option key={p}>{p}</option>)}</AppSelect>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Responsable</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229] bg-white">
              <option value="">— Sin asignar (cualquier admin puede gestionarla) —</option>
              {usuarios.map(u => (
                <option key={u.email} value={u.email}>{u.nombre} · {u.email}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Solo esta cuenta podrá ver y gestionar los gastos de esta caja.</p>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={!!showEditarCaja} title="Editar caja chica"
        onClose={() => setShowEditarCaja(null)} onSave={handleEditarCaja}
        footer={
          <>
            <button onClick={() => setShowEditarCaja(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar cambios</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nombre</label>
            <input type="text" defaultValue={showEditarCaja?.nombre} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Planta</label>
            <AppSelect>{["Allende", "Pesquería"].map(p => <option key={p} selected={showEditarCaja?.planta === p}>{p}</option>)}</AppSelect>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Responsable</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229] bg-white">
              <option value="">— Sin asignar —</option>
              {usuarios.map(u => (
                <option key={u.email} value={u.email} selected={showEditarCaja?.responsableEmail === u.email}>
                  {u.nombre} · {u.email}
                </option>
              ))}
            </select>
            {showEditarCaja?.responsableEmail && (
              <p className="text-xs text-gray-400 mt-1">Cuenta actual: {showEditarCaja.responsableEmail}</p>
            )}
          </div>
        </div>
      </FormModal>

      <FormModal
        open={showDistribuir} title="Distribuir fondos a caja chica"
        onClose={() => setShowDistribuir(false)} onSave={handleDistribuir}
        footer={
          <>
            <button onClick={() => setShowDistribuir(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Distribuir</button>
          </>
        }
      >
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
          Saldo disponible en caja principal: <span className="font-bold text-gray-900">${saldoPrincipal.toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Caja destino</label>
            <AppSelect>{cajasConfig.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.planta}</option>)}</AppSelect>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Monto</label>
            <input type="number" min="1" step="0.01" placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Fecha</label>
            <input type="date" defaultValue={hoy} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Autoriza</label>
            <input type="text" placeholder="Nombre de quien autoriza" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Concepto</label>
            <input type="text" defaultValue="Reposición de fondo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
        </div>
      </FormModal>

      <GastoDrawer
        open={showFormGasto}
        onClose={() => setShowFormGasto(false)}
        onSave={async (data) => { await handleSaveGasto(data); setShowFormGasto(false); }}
        hoy={hoy}
      />

      {/* Modal rechazar gasto */}
      <FormModal
        open={!!showRechazar}
        title={`Rechazar gasto ${showRechazar?.folio ?? ""}`}
        onClose={() => setShowRechazar(null)}
        onSave={handleRechazar}
        footer={
          <>
            <button onClick={() => setShowRechazar(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">Confirmar rechazo</button>
          </>
        }
      >
        {showRechazar && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <p><span className="font-semibold">Gasto:</span> {showRechazar.descripcion}</p>
              <p><span className="font-semibold">Monto:</span> ${showRechazar.monto.toLocaleString()}</p>
              <p><span className="font-semibold">Entrega:</span> {showRechazar.responsable}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Motivo de rechazo <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                placeholder="Describe el motivo del rechazo para que quede registrado..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
            </div>
          </div>
        )}
      </FormModal>

      {vistaActiva !== "principal" && cajaActual && (
        <FormModal
          open={showSettings} title={`Configurar — ${cajaActual.nombre}`}
          onClose={() => setShowSettings(false)}
          footer={<button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cerrar</button>}
        >
          <div className="space-y-3">
            <button onClick={() => { setShowSettings(false); setShowEditarCaja(cajaActual); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-sm text-left transition-colors">
              <Edit2 size={16} className="text-gray-400" />
              Editar nombre, planta y responsable
            </button>
            <button onClick={() => { setShowSettings(false); void handleEliminarCaja(cajaActual); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 text-sm text-left transition-colors">
              <Trash2 size={16} />
              Desactivar esta caja
            </button>
          </div>
        </FormModal>
      )}

      {duplicateWarn && (
        <DuplicateWarningModal
          field={duplicateWarn.field} value={duplicateWarn.value} detail={duplicateWarn.detail}
          onCancel={() => setDuplicateWarn(null)} onConfirm={duplicateWarn.proceed}
        />
      )}

      {/* Lightbox foto ticket */}
      {fotoModal && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setFotoModal(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFotoModal(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white p-2 cursor-pointer">
              <X size={24} />
            </button>
            <img src={fotoModal} alt="Ticket" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
