"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Satellite,
  Search,
  Trash2,
  Truck,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";
import { todayCST } from "@/lib/dateUtils";
import type { Unidad } from "@/lib/unidades";
import PlantaRequired from "@/components/PlantaRequired";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventoTipo = "Mantenimiento" | "Reparación" | "Falla";
type SubtipoMant = "Preventivo" | "Correctivo" | "Inspección";
type SeveridadFalla = "Alta" | "Media" | "Baja";

interface EventoRaw {
  id?: string;
  tipo: EventoTipo;
  unidad: string;
  fecha: string;
  descripcion: string;
  subtipo?: SubtipoMant;
  causa?: string;
  severidad?: SeveridadFalla;
  reportadoPor?: string;
  costo: number;
  taller?: string;
  status: string;
  notas?: string;
  planta?: string;
  km?: number;
  horasReparacion?: number;
  fotosFactura?: string[];
  fotosEvidencia?: string[];
}

interface Evento extends EventoRaw {
  id: string;
}

interface UnitSummary {
  unidad: Unidad;
  eventos: Evento[];
  costoTotal: number;
  pendientes: number;
  fallasActivas: number;
  ultimaFecha: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = todayCST;

function fmtFecha(f: string) {
  if (!f) return "—";
  // Handle ISO (YYYY-MM-DD) or legacy DD/MM/YYYY
  if (f.includes("-") && f.indexOf("-") === 4) {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }
  return f;
}

function currency(n: number) {
  if (!n) return "—";
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

function diasHasta(fecha: string): number | null {
  if (!fecha || fecha === "—") return null;
  let iso = fecha;
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    iso = `${y}-${m}-${d}`;
  }
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function diasDesde(fecha: string): number {
  if (!fecha) return 0;
  let iso = fecha;
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    iso = `${y}-${m}-${d}`;
  }
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

type UrgenciaColor = "rojo" | "ambar" | "verde" | "neutral";

function urgenciaUnidad(eventos: Evento[]): UrgenciaColor {
  const activos = eventos.filter((e) => e.status !== "Completado" && e.status !== "Resuelta");
  if (activos.length === 0) return "verde";
  const tieneFallaAlta = activos.some((e) => e.tipo === "Falla" && (e.severidad === "Alta" || e.status === "Reportada"));
  if (tieneFallaAlta) return "rojo";
  const tieneEnProceso = activos.some((e) => e.status === "En proceso");
  const tieneReparacionLarga = activos.some((e) => (e.tipo === "Reparación" || e.tipo === "Falla") && diasDesde(e.fecha) >= 2);
  if (tieneEnProceso || tieneReparacionLarga) return "ambar";
  return "neutral";
}

const TIPO_BADGE: Record<EventoTipo, string> = {
  "Mantenimiento": "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  "Reparación":   "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  "Falla":        "bg-red-500/15 text-red-300 border border-red-500/30",
};

const SUBTIPO_BADGE: Record<string, string> = {
  "Preventivo":  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "Correctivo":  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "Inspección":  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const SEV_BADGE: Record<string, string> = {
  "Alta":  "bg-red-500/15 text-red-400 border border-red-500/30",
  "Media": "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  "Baja":  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  "Completado": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "Resuelta":   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  "En proceso": "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  "Pendiente":  "bg-gray-500/15 text-gray-400 border border-gray-500/30",
  "Reportada":  "bg-red-500/15 text-red-400 border border-red-500/30",
};

// ─── Event Timeline Row ────────────────────────────────────────────────────────

function EventoRow({
  ev,
  onComplete,
  onEdit,
  onDelete,
}: {
  ev: Evento;
  onComplete: (ev: Evento) => void;
  onEdit: (ev: Evento) => void;
  onDelete: (ev: Evento) => void;
}) {
  const isDone = ev.status === "Completado" || ev.status === "Resuelta";
  const statusBadge = STATUS_BADGE[ev.status] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30";
  const dias = diasDesde(ev.fecha);
  const diasLabel = dias === 0 ? "Hoy" : `${dias}d abierto`;
  const diasColor = !isDone ? (dias > 5 ? "text-red-400" : dias > 2 ? "text-amber-400" : "text-gray-400") : "";

  return (
    <div className={`flex flex-wrap items-start gap-3 py-3.5 border-b border-[#2A2A2A] last:border-0 ${!isDone && ev.tipo === "Falla" && ev.severidad === "Alta" ? "bg-red-500/5 -mx-5 px-5" : ""}`}>
      {/* Date + días */}
      <div className="shrink-0 w-[90px]">
        <span className="text-xs text-gray-500 font-mono block">{fmtFecha(ev.fecha)}</span>
        {!isDone && <span className={`text-[10px] font-bold ${diasColor}`}>{diasLabel}</span>}
      </div>

      {/* Type + subtipo/severidad */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TIPO_BADGE[ev.tipo]}`}>
          {ev.tipo}
        </span>
        {ev.subtipo && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SUBTIPO_BADGE[ev.subtipo] ?? ""}`}>
            {ev.subtipo}
          </span>
        )}
        {ev.severidad && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SEV_BADGE[ev.severidad] ?? ""}`}>
            {ev.severidad}
          </span>
        )}
      </div>

      {/* Description + details */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${isDone ? "text-gray-500" : "text-white"}`}>{ev.descripcion}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0 mt-0.5">
          {ev.causa && <span className="text-xs text-gray-500">Causa: {ev.causa}</span>}
          {ev.taller && <span className="text-xs text-gray-500">Taller: {ev.taller}</span>}
          {ev.reportadoPor && <span className="text-xs text-gray-500">Reportó: {ev.reportadoPor}</span>}
          {ev.notas && <span className="text-xs text-gray-600 italic">{ev.notas}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {ev.km != null && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300">
              {ev.km.toLocaleString("es-MX")} km
            </span>
          )}
          {ev.horasReparacion != null && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300">
              <Wrench size={9} /> {ev.horasReparacion} h taller
            </span>
          )}
          {((ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0) > 0) && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-500">
              <Camera size={9} /> {(ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0)} foto{((ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0)) !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Cost */}
      <span className={`text-sm font-bold tabular-nums whitespace-nowrap shrink-0 ${isDone ? "text-gray-600" : ev.costo > 0 ? "text-white" : "text-gray-600"}`}>
        {currency(ev.costo)}
      </span>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge}`}>
          {ev.status}
        </span>
        {!isDone && (
          <button
            onClick={() => onComplete(ev)}
            className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            ✓ Cerrar
          </button>
        )}
        <button onClick={() => onEdit(ev)} className="p-1 text-gray-600 hover:text-blue-400 transition-colors cursor-pointer" aria-label="Editar">
          <Pencil size={11} />
        </button>
        <button onClick={() => onDelete(ev)} className="p-1 text-gray-600 hover:text-red-400 transition-colors cursor-pointer" aria-label="Eliminar">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Unit Card ─────────────────────────────────────────────────────────────────

function UnitCard({
  summary,
  onAddEvento,
  onComplete,
  onEdit,
  onDelete,
}: {
  summary: UnitSummary;
  onAddEvento: (unidad: string) => void;
  onComplete: (ev: Evento) => void;
  onEdit: (ev: Evento) => void;
  onDelete: (ev: Evento) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { unidad: u, eventos, costoTotal, pendientes, fallasActivas, ultimaFecha } = summary;

  const estatusColor =
    u.estatus === "Activo"       ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : u.estatus === "Mantenimiento" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-gray-500/15 text-gray-400 border-gray-500/30";

  const dias = diasHasta(u.proximoMantenimiento);
  const diasColor =
    dias === null   ? "text-gray-500"
    : dias < 0     ? "text-red-400 font-bold"
    : dias <= 30   ? "text-amber-400 font-semibold"
    : "text-gray-400";
  const diasLabel = dias === null
    ? "—"
    : dias < 0 ? `Vencido ${Math.abs(dias)}d`
    : `${dias}d`;

  // Sanitize NaN values from data
  const anioDisplay = u.anio && !isNaN(Number(u.anio)) ? u.anio : null;
  const capDisplay  = u.capacidadM3 != null && !isNaN(Number(u.capacidadM3)) ? `${u.capacidadM3} m³` : null;
  const subInfo     = [anioDisplay, capDisplay].filter(Boolean).join(" · ");

  const eventosActivos   = eventos.filter((e) => e.status !== "Completado" && e.status !== "Resuelta");
  const eventosEnTaller  = eventosActivos.filter((e) => e.tipo === "Reparación" || e.tipo === "Falla" || e.status === "En proceso");
  const diasEnTallerMax  = eventosEnTaller.length > 0 ? Math.max(...eventosEnTaller.map((e) => diasDesde(e.fecha))) : null;

  const urgencia = urgenciaUnidad(eventos);

  // Left urgency strip color
  const stripColor =
    urgencia === "rojo"  ? "bg-red-500"
    : urgencia === "ambar" ? "bg-amber-500"
    : urgencia === "verde" ? "bg-emerald-500/60"
    : "bg-[#3A3A3A]";

  // Card background tint
  const cardBg =
    urgencia === "rojo"  ? "bg-red-500/[0.04]"
    : urgencia === "ambar" ? "bg-amber-500/[0.03]"
    : "bg-[#242424]";

  // Truck icon color based on urgency
  const truckColor =
    urgencia === "rojo"  ? "text-red-400"
    : urgencia === "ambar" ? "text-amber-400"
    : urgencia === "verde" ? "text-emerald-400"
    : "text-[#CC2229]";

  const tallerBadge = diasEnTallerMax !== null ? (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
      diasEnTallerMax <= 2
        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
        : "bg-red-500/15 border-red-500/30 text-red-400"
    }`}>
      <Wrench size={9} />
      {diasEnTallerMax === 0 ? "Hoy en taller" : `${diasEnTallerMax}d en taller`}
    </span>
  ) : null;

  return (
    <div className={`border border-[#3A3A3A] rounded-xl overflow-hidden transition-all ${cardBg}`}>
      {/* Clickable header row */}
      <div
        className="flex items-center gap-0 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Left urgency strip */}
        <div className={`w-[3px] self-stretch shrink-0 ${stripColor}`} />

        {/* Main content */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 flex-1 min-w-0">

          {/* Unit identity */}
          <div className="flex items-center gap-3 w-[155px] shrink-0">
            <div className="h-10 w-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center shrink-0 border border-[#2A2A2A]">
              <Truck size={17} className={truckColor} />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{u.noEconomico}</p>
              <p className="text-gray-500 text-[11px] font-mono">{u.placa || "—"}</p>
            </div>
          </div>

          {/* Make / model / year */}
          <div className="hidden sm:block w-[175px] shrink-0 min-w-0">
            <p className="text-gray-200 text-sm font-medium truncate">{[u.marca, u.modelo].filter(Boolean).join(" ") || "—"}</p>
            {subInfo
              ? <p className="text-gray-500 text-[11px]">{subInfo}</p>
              : <p className="text-gray-600 text-[11px]">—</p>
            }
          </div>

          {/* Status + taller */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${estatusColor}`}>
              {u.estatus}
            </span>
            {tallerBadge}
            {fallasActivas > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 whitespace-nowrap">
                <AlertTriangle size={9} /> {fallasActivas} falla{fallasActivas > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Stats block */}
          <div className="flex items-stretch gap-0 ml-auto mr-2 divide-x divide-[#3A3A3A] text-center">
            {/* Intervenciones */}
            <div className="px-4 flex flex-col justify-center min-w-[70px]">
              <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Interv.</p>
              <p className="text-white font-bold text-lg leading-tight">{eventos.length}</p>
            </div>
            {/* Costo total */}
            {costoTotal > 0 ? (
              <div className="px-4 flex flex-col justify-center min-w-[90px]">
                <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Costo total</p>
                <p className="text-white font-bold tabular-nums">{currency(costoTotal)}</p>
              </div>
            ) : (
              <div className="px-4 flex flex-col justify-center min-w-[90px]">
                <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Costo total</p>
                <p className="text-gray-700 font-bold">—</p>
              </div>
            )}
            {/* Pendientes */}
            <div className="px-4 flex flex-col justify-center min-w-[65px]">
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${pendientes > 0 ? "text-amber-500/80" : "text-gray-500"}`}>Abiertos</p>
              <p className={`font-bold text-lg leading-tight ${pendientes > 0 ? "text-amber-400" : "text-gray-700"}`}>{pendientes}</p>
            </div>
            {/* Próximo servicio */}
            <div className="hidden md:flex px-4 flex-col justify-center min-w-[90px]">
              <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Próx. servicio</p>
              <p className={`font-semibold text-sm ${u.proximoMantenimiento && u.proximoMantenimiento !== "—" ? diasColor : "text-gray-700"}`}>
                {u.proximoMantenimiento && u.proximoMantenimiento !== "—" ? diasLabel : "—"}
              </p>
            </div>
            {/* Último registro */}
            <div className="hidden lg:flex px-4 flex-col justify-center min-w-[90px]">
              <p className="text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">Último reg.</p>
              <p className="text-gray-400 font-medium text-sm">{ultimaFecha ? fmtFecha(ultimaFecha) : "—"}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddEvento(u.noEconomico); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#CC2229]/10 hover:bg-[#CC2229]/20 text-[#CC2229] rounded-lg border border-[#CC2229]/20 transition-colors cursor-pointer"
            >
              <Plus size={12} /> Registrar
            </button>
            {expanded
              ? <ChevronDown size={15} className="text-gray-500" />
              : <ChevronRight size={15} className="text-gray-500" />}
          </div>
        </div>
      </div>

      {/* Expanded timeline */}
      {expanded && (
        <div className="border-t border-[#3A3A3A] bg-[#1D1D1D] px-5 py-1">
          {eventos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-600">Sin registros para esta unidad</p>
              <button
                onClick={() => onAddEvento(u.noEconomico)}
                className="mt-2 text-xs text-[#CC2229] hover:underline cursor-pointer"
              >
                Agregar primer registro
              </button>
            </div>
          ) : (
            <div className="py-1">
              {eventos.map((ev) => (
                <EventoRow key={ev.id} ev={ev} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Photo Upload Area ─────────────────────────────────────────────────────────

function PhotoUploadArea({
  label,
  fotos,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string;
  fotos: string[];
  uploading: boolean;
  onUpload: (files: FileList) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {fotos.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#CC2229]/40 hover:text-[#CC2229] transition-colors cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
        {uploading ? (
          <><span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-[#CC2229] animate-spin" /> Subiendo…</>
        ) : (
          <><ImagePlus size={16} /> Agregar fotos</>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </label>
    </div>
  );
}

// ─── Registration Drawer ───────────────────────────────────────────────────────

function RegistroDrawer({
  open,
  unidadesList,
  preselectedUnidad,
  onClose,
  onSave,
  editing,
}: {
  open: boolean;
  unidadesList: string[];
  preselectedUnidad: string;
  onClose: () => void;
  onSave: (ev: EventoRaw) => Promise<void>;
  editing?: Evento | null;
}) {
  const [tipo, setTipo] = useState<EventoTipo>("Mantenimiento");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fotosFactura, setFotosFactura] = useState<string[]>([]);
  const [fotosEvidencia, setFotosEvidencia] = useState<string[]>([]);
  const [uploadingCat, setUploadingCat] = useState<"factura" | "evidencia" | null>(null);
  const [samsaraKm, setSamsaraKm] = useState<number | null>(null);
  const [samsaraFound, setSamsaraFound] = useState<boolean | null>(null);
  const [fetchingSamsara, setFetchingSamsara] = useState(false);

  async function loadSamsaraKm(unidad: string) {
    if (!unidad) return;
    setFetchingSamsara(true);
    setSamsaraKm(null);
    setSamsaraFound(null);
    try {
      const [vRes, sRes] = await Promise.all([
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles"),
        fetch("/api/samsara?endpoint=%2Ffleet%2Fvehicles%2Fstats&types=obdOdometerMeters%2CgpsOdometerMeters"),
      ]);
      if (!vRes.ok || !sRes.ok) { setSamsaraFound(false); return; }
      const [vData, sData] = await Promise.all([vRes.json(), sRes.json()]);
      const match = (vData.data ?? []).find((v: { name: string }) =>
        v.name.trim().toLowerCase() === unidad.trim().toLowerCase()
      );
      if (!match) { setSamsaraFound(false); return; }
      const stat = (sData.data ?? []).find((s: { id: string }) => s.id === match.id);
      const odom = stat?.obdOdometerMeters?.[0]?.value ?? stat?.gpsOdometerMeters?.[0]?.value;
      if (odom == null) { setSamsaraFound(false); return; }
      setSamsaraKm(Math.round(odom / 1000));
      setSamsaraFound(true);
    } catch {
      setSamsaraFound(false);
    } finally {
      setFetchingSamsara(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const toISO = (f: string) => f.includes("/") ? f.split("/").reverse().join("-") : f;
      setTipo(editing.tipo);
      setForm({
        fecha: toISO(editing.fecha),
        unidad: editing.unidad,
        descripcion: editing.descripcion,
        costo: String(editing.costo || ""),
        taller: editing.taller ?? "",
        status: editing.status,
        notas: editing.notas ?? "",
        subtipo: editing.subtipo ?? "Preventivo",
        causa: editing.causa ?? "",
        severidad: editing.severidad ?? "Media",
        reportadoPor: editing.reportadoPor ?? "",
        km: editing.km != null ? String(editing.km) : "",
        horasReparacion: editing.horasReparacion != null ? String(editing.horasReparacion) : "",
      });
      setFotosFactura(editing.fotosFactura ?? []);
      setFotosEvidencia(editing.fotosEvidencia ?? []);
    } else {
      setTipo("Mantenimiento");
      setForm({ fecha: todayISO(), unidad: preselectedUnidad, status: "Pendiente", km: "" });
      setFotosFactura([]);
      setFotosEvidencia([]);
    }
    setSamsaraKm(null);
    setSamsaraFound(null);
  }, [open, preselectedUnidad, editing]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handlePhotoUpload(files: FileList, cat: "factura" | "evidencia") {
    if (!storage || !files.length) {
      if (!storage) {
        window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Firebase Storage no está activado. Contacta al administrador." } }));
      }
      return;
    }
    setUploadingCat(cat);
    const id = editing?.id ?? `evt-${Date.now()}`;
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const r = storageRef(storage, `mantenimiento/${id}/${cat}/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(r, file);
        urls.push(await getDownloadURL(snap.ref));
      }
      if (cat === "factura") setFotosFactura((p) => [...p, ...urls]);
      else setFotosEvidencia((p) => [...p, ...urls]);
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al subir fotos. Verifica la configuración de Firebase Storage." } }));
    } finally {
      setUploadingCat(null);
    }
  }

  async function handleSave() {
    if (!form.unidad || !form.descripcion) return;
    setSaving(true);
    try {
      const base: EventoRaw = {
        ...(editing?.id ? { id: editing.id } : {}),
        tipo,
        unidad: form.unidad,
        fecha: form.fecha ?? todayISO(),
        descripcion: form.descripcion ?? "",
        costo: parseFloat((form.costo ?? "0").replace(/[$,\s]/g, "")) || 0,
        taller: form.taller ?? "",
        status: form.status ?? "Pendiente",
        notas: form.notas ?? "",
        ...(form.km ? { km: parseFloat(form.km) } : {}),
        ...(form.horasReparacion ? { horasReparacion: parseFloat(form.horasReparacion) } : {}),
        ...(fotosFactura.length > 0 ? { fotosFactura } : {}),
        ...(fotosEvidencia.length > 0 ? { fotosEvidencia } : {}),
      };
      if (tipo === "Mantenimiento") base.subtipo = (form.subtipo as SubtipoMant) ?? "Preventivo";
      if (tipo === "Reparación") base.causa = form.causa ?? "";
      if (tipo === "Falla") {
        base.severidad = (form.severidad as SeveridadFalla) ?? "Media";
        base.reportadoPor = form.reportadoPor ?? "";
        base.status = form.status ?? "Reportada";
      }
      await onSave(base);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{editing ? "Editar registro" : "Nuevo registro"}</h2>
              <p className="text-xs text-gray-500">Mantenimiento · Reparación · Falla</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Tipo tabs */}
          <div>
            <label className={lbl}>Tipo de registro</label>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["Mantenimiento", "Reparación", "Falla"] as EventoTipo[]).map((t) => (
                <button key={t} type="button" onClick={() => { setTipo(t); set("status", t === "Falla" ? "Reportada" : "Pendiente"); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${tipo === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Unidad + Fecha + KM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Unidad</label>
              <AppSelect value={form.unidad ?? ""} onChange={(e) => set("unidad", e.target.value)}>
                <option value="">Seleccionar…</option>
                {unidadesList.map((u) => <option key={u}>{u}</option>)}
              </AppSelect>
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha ?? todayISO()} onChange={(e) => set("fecha", e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {tipo === "Falla" ? "KM al momento del paro" : "KM actual"}
              </label>
              {(form.unidad || preselectedUnidad) && (
                <button type="button"
                  onClick={() => loadSamsaraKm(form.unidad || preselectedUnidad)}
                  disabled={fetchingSamsara}
                  className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 hover:text-sky-700 disabled:opacity-50 cursor-pointer transition-colors">
                  {fetchingSamsara ? <Loader2 size={10} className="animate-spin" /> : <Satellite size={10} />}
                  GPS Samsara
                </button>
              )}
            </div>
            <input
              type="number"
              min={0}
              value={form.km ?? ""}
              onChange={(e) => set("km", e.target.value)}
              placeholder="Ej. 125000"
              className={inp}
            />
            {samsaraFound === true && samsaraKm != null && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] bg-sky-50 border border-sky-200 text-sky-700 rounded-full px-2.5 py-1 font-semibold">
                  <Satellite size={9} /> {samsaraKm.toLocaleString("es-MX")} km
                </span>
                <button type="button" onClick={() => set("km", String(samsaraKm))}
                  className="text-[10px] font-semibold text-[#CC2229] hover:underline cursor-pointer">
                  Usar
                </button>
              </div>
            )}
            {samsaraFound === false && (
              <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
                <Satellite size={9} /> No encontrada en Samsara
              </p>
            )}
          </div>

          {/* Horas en taller — solo para Reparación y Falla */}
          {(tipo === "Reparación" || tipo === "Falla") && (
            <div>
              <label className={lbl}>Horas en taller</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.horasReparacion ?? ""}
                onChange={(e) => set("horasReparacion", e.target.value)}
                placeholder="Ej. 8"
                className={inp}
              />
              <p className="mt-1 text-[10px] text-gray-400">Tiempo total que lleva o llevó la unidad fuera de operación</p>
            </div>
          )}

          {/* Tipo-specific fields */}
          {tipo === "Mantenimiento" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Subtipo</label>
                <AppSelect value={form.subtipo ?? "Preventivo"} onChange={(e) => set("subtipo", e.target.value)}>
                  <option>Preventivo</option>
                  <option>Correctivo</option>
                  <option>Inspección</option>
                </AppSelect>
              </div>
              <div>
                <label className={lbl}>Status</label>
                <AppSelect value={form.status ?? "Pendiente"} onChange={(e) => set("status", e.target.value)}>
                  <option>Pendiente</option>
                  <option>En proceso</option>
                  <option>Completado</option>
                </AppSelect>
              </div>
            </div>
          )}

          {tipo === "Reparación" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Causa / Motivo</label>
                <input type="text" value={form.causa ?? ""} onChange={(e) => set("causa", e.target.value)} placeholder="Ej. Desgaste por uso" className={inp} />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <AppSelect value={form.status ?? "Pendiente"} onChange={(e) => set("status", e.target.value)}>
                  <option>Pendiente</option>
                  <option>En proceso</option>
                  <option>Completado</option>
                </AppSelect>
              </div>
            </div>
          )}

          {tipo === "Falla" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Severidad</label>
                <AppSelect value={form.severidad ?? "Media"} onChange={(e) => set("severidad", e.target.value)}>
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </AppSelect>
              </div>
              <div>
                <label className={lbl}>Status</label>
                <AppSelect value={form.status ?? "Reportada"} onChange={(e) => set("status", e.target.value)}>
                  <option>Reportada</option>
                  <option>En proceso</option>
                  <option>Resuelta</option>
                </AppSelect>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={lbl}>Descripción</label>
            <input type="text" value={form.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)}
              placeholder={tipo === "Mantenimiento" ? "Ej. Cambio de aceite y filtros" : tipo === "Reparación" ? "Ej. Reparación de frenos traseros" : "Ej. Motor no enciende"}
              className={inp} />
          </div>

          {/* Costo + Taller */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Costo ($)</label>
              <input type="text" value={form.costo ?? ""} onChange={(e) => set("costo", e.target.value)} placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className={lbl}>{tipo === "Falla" ? "Reportado por" : "Taller / Proveedor"}</label>
              <input type="text"
                value={tipo === "Falla" ? (form.reportadoPor ?? "") : (form.taller ?? "")}
                onChange={(e) => set(tipo === "Falla" ? "reportadoPor" : "taller", e.target.value)}
                placeholder={tipo === "Falla" ? "Nombre del operador" : "Nombre del taller"}
                className={inp} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className={lbl}>Notas adicionales</label>
            <textarea value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} rows={2} className={`${inp} resize-none`} />
          </div>

          {/* Evidencia fotográfica */}
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Evidencia fotográfica</p>
            <PhotoUploadArea
              label="Fotos de factura"
              fotos={fotosFactura}
              uploading={uploadingCat === "factura"}
              onUpload={(files) => handlePhotoUpload(files, "factura")}
              onRemove={(i) => setFotosFactura((p) => p.filter((_, idx) => idx !== i))}
            />
            <PhotoUploadArea
              label="Evidencia de daños"
              fotos={fotosEvidencia}
              uploading={uploadingCat === "evidencia"}
              onUpload={(files) => handlePhotoUpload(files, "evidencia")}
              onRemove={(i) => setFotosEvidencia((p) => p.filter((_, idx) => idx !== i))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.unidad || !form.descripcion}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? (
              <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Guardando...</>
            ) : "Guardar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MantenimientoPage() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [query, setQuery] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [preselectedUnidad, setPreselectedUnidad] = useState("");
  const [viewMode, setViewMode] = useState<"unidades" | "cronologico">("unidades");
  const [quickFilter, setQuickFilter] = useState<"all" | "open" | "fallas">("all");
  const [editingEvento, setEditingEvento] = useState<Evento | null>(null);
  const [confirmDeleteEvento, setConfirmDeleteEvento] = useState<Evento | null>(null);

  useEffect(() => {
    if (!loading) { setLoadingLong(false); return; }
    const t = setTimeout(() => setLoadingLong(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    async function load() {
      const [us, mantsRaw, repsRaw, fallasRaw] = await Promise.all([
        getCollectionDocs<Unidad>(COLLECTIONS.unidades),
        getCollectionDocs<EventoRaw & { id?: string }>(COLLECTIONS.mantenimientos),
        getCollectionDocs<EventoRaw & { id?: string }>(COLLECTIONS.reparaciones),
        getCollectionDocs<EventoRaw & { id?: string }>(COLLECTIONS.fallas),
      ]);

      setUnidades(filterByPlanta(us));

      // Normalize legacy records (they didn't have tipo field)
      const normalized: Evento[] = [
        ...mantsRaw.map((m, i) => ({
          ...m,
          id: m.id ?? `m-${i}`,
          tipo: "Mantenimiento" as EventoTipo,
          costo: m.costo ?? 0,
        })),
        ...repsRaw.map((r, i) => ({
          ...r,
          id: r.id ?? `r-${i}`,
          tipo: "Reparación" as EventoTipo,
          costo: r.costo ?? 0,
        })),
        ...fallasRaw.map((f, i) => ({
          ...f,
          id: f.id ?? `f-${i}`,
          tipo: "Falla" as EventoTipo,
          costo: f.costo ?? 0,
        })),
      ];

      // Sort by date descending (handle both DD/MM/YYYY and YYYY-MM-DD)
      normalized.sort((a, b) => {
        const toISO = (f: string) => {
          if (!f) return "0000-00-00";
          if (f.includes("/")) { const [d, m, y] = f.split("/"); return `${y}-${m}-${d}`; }
          return f;
        };
        return toISO(b.fecha).localeCompare(toISO(a.fecha));
      });

      setEventos(filterByPlanta(normalized));
      setLoading(false);
    }
    load();
  }, []);

  // Build per-unit summaries
  const unitSummaries = useMemo<UnitSummary[]>(() => {
    return unidades.map((u) => {
      const evs = eventos.filter((e) => e.unidad === u.noEconomico);
      const costoTotal = evs.reduce((s, e) => s + (e.costo ?? 0), 0);
      const pendientes = evs.filter((e) => e.status === "Pendiente" || e.status === "En proceso" || e.status === "Reportada").length;
      const fallasActivas = evs.filter((e) => e.tipo === "Falla" && e.status !== "Resuelta").length;
      const ultimaFecha = evs[0]?.fecha ?? "";
      return { unidad: u, eventos: evs, costoTotal, pendientes, fallasActivas, ultimaFecha };
    });
  }, [unidades, eventos]);

  // Filter for search
  const filteredSummaries = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return unitSummaries;
    return unitSummaries.filter((s) =>
      s.unidad.noEconomico.toLowerCase().includes(q) ||
      s.unidad.placa.toLowerCase().includes(q) ||
      s.unidad.marca.toLowerCase().includes(q) ||
      s.unidad.modelo.toLowerCase().includes(q) ||
      s.eventos.some((e) => e.descripcion.toLowerCase().includes(q))
    );
  }, [unitSummaries, query]);

  const filteredEventos = useMemo(() => {
    let list = eventos;
    // Quick filter from KPI cards
    if (quickFilter === "open") list = list.filter((e) => !["Completado", "Resuelta"].includes(e.status));
    else if (quickFilter === "fallas") list = list.filter((e) => e.tipo === "Falla" && e.status !== "Resuelta");
    const q = query.toLowerCase();
    if (!q) return list;
    return list.filter((e) =>
      e.unidad.toLowerCase().includes(q) ||
      e.descripcion.toLowerCase().includes(q) ||
      (e.causa ?? "").toLowerCase().includes(q) ||
      (e.taller ?? "").toLowerCase().includes(q)
    );
  }, [eventos, query, quickFilter]);

  // KPIs
  const costoTotal = useMemo(() => eventos.reduce((s, e) => s + (e.costo ?? 0), 0), [eventos]);
  const pendientes = useMemo(() => eventos.filter((e) => !["Completado", "Resuelta"].includes(e.status)).length, [eventos]);
  const fallasActivas = useMemo(() => eventos.filter((e) => e.tipo === "Falla" && e.status !== "Resuelta").length, [eventos]);

  async function handleSave(ev: EventoRaw) {
    const isUpdate = !!ev.id;
    const id = ev.id ?? `evt-${Date.now()}`;
    const col = ev.tipo === "Mantenimiento" ? COLLECTIONS.mantenimientos : ev.tipo === "Reparación" ? COLLECTIONS.reparaciones : COLLECTIONS.fallas;
    const full: Evento = { ...ev, id };
    const sort = (arr: Evento[]) => arr.sort((a, b) => {
      const toISO = (f: string) => { if (f.includes("/")) { const [d, m, y] = f.split("/"); return `${y}-${m}-${d}`; } return f; };
      return toISO(b.fecha).localeCompare(toISO(a.fecha));
    });
    if (isUpdate) {
      setEventos((prev) => sort(prev.map((e) => e.id === id ? full : e)));
    } else {
      setEventos((prev) => sort([full, ...prev]));
    }
    await upsertDocument(col, id, withPlantaTag(ev));
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `${ev.tipo} ${isUpdate ? "actualizada" : "registrada"} para ${ev.unidad}.` } }));
  }

  async function handleDelete(ev: Evento) {
    setEventos((prev) => prev.filter((e) => e.id !== ev.id));
    const col = ev.tipo === "Mantenimiento" ? COLLECTIONS.mantenimientos : ev.tipo === "Reparación" ? COLLECTIONS.reparaciones : COLLECTIONS.fallas;
    await deleteDocument(col, ev.id);
    setConfirmDeleteEvento(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Registro de ${ev.unidad} eliminado.` } }));
  }

  async function handleComplete(ev: Evento) {
    const newStatus = ev.tipo === "Falla" ? "Resuelta" : "Completado";
    setEventos((prev) => prev.map((e) => e.id === ev.id ? { ...e, status: newStatus } : e));
    const col = ev.tipo === "Mantenimiento" ? COLLECTIONS.mantenimientos : ev.tipo === "Reparación" ? COLLECTIONS.reparaciones : COLLECTIONS.fallas;
    const { id, ...data } = ev;
    await upsertDocument(col, id, withPlantaTag({ ...data, status: newStatus }));
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `${ev.tipo} de ${ev.unidad} cerrada.` } }));
  }

  function openDrawer(unidad = "") {
    setPreselectedUnidad(unidad);
    setEditingEvento(null);
    setShowDrawer(true);
  }

  function openEdit(ev: Evento) {
    setEditingEvento(ev);
    setPreselectedUnidad(ev.unidad);
    setShowDrawer(true);
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total intervenciones" value={String(eventos.length)} icon={Wrench}
          iconColor="text-blue-400" iconBg="bg-blue-500/10"
          subtitle={`${unidades.length} unidades en flota`}
          active={quickFilter === "all" && viewMode === "cronologico"}
          onClick={() => { setViewMode("cronologico"); setQuickFilter("all"); }} />
        <KPICard title="Costo total acumulado" value={costoTotal > 0 ? `$${Math.round(costoTotal).toLocaleString("es-MX")}` : "—"} icon={DollarSign}
          iconColor="text-[#CC2229]" iconBg="bg-[#CC2229]/10"
          subtitle="Mantenimientos + reparaciones" />
        <KPICard title="Trabajos abiertos" value={String(pendientes)} icon={CheckCircle2}
          iconColor={pendientes > 0 ? "text-amber-400" : "text-gray-500"}
          iconBg={pendientes > 0 ? "bg-amber-500/10" : "bg-gray-500/10"}
          subtitle="Pendientes o en proceso"
          active={quickFilter === "open"}
          onClick={() => { setViewMode("cronologico"); setQuickFilter("open"); }} />
        <KPICard title="Fallas activas" value={String(fallasActivas)} icon={AlertTriangle}
          iconColor={fallasActivas > 0 ? "text-red-400" : "text-gray-500"}
          iconBg={fallasActivas > 0 ? "bg-red-500/10" : "bg-gray-500/10"}
          subtitle={fallasActivas > 0 ? "Sin resolver" : "Sin fallas activas"}
          active={quickFilter === "fallas"}
          onClick={() => { setViewMode("cronologico"); setQuickFilter("fallas"); }} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1">
          <button onClick={() => setViewMode("unidades")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${viewMode === "unidades" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}>
            Por unidad
          </button>
          <button onClick={() => setViewMode("cronologico")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${viewMode === "cronologico" ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white"}`}>
            Cronológico
          </button>
        </div>

        {/* Quick filter chip */}
        {quickFilter !== "all" && (
          <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full border text-xs font-semibold bg-[#CC2229]/10 border-[#CC2229]/40 text-[#CC2229]">
            {quickFilter === "open" ? "Trabajos abiertos" : "Fallas activas"}
            <button onClick={() => setQuickFilter("all")} className="p-0.5 rounded-full hover:bg-[#CC2229]/20 cursor-pointer transition-colors">
              <X size={11} />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar unidad, descripción..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-sm rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>

        <PlantaRequired>
          {(ok) => (
            <button
              onClick={() => ok && openDrawer()}
              disabled={!ok}
              title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
              className={`ml-auto flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
            >
              <Plus size={15} /> Nuevo registro
            </button>
          )}
        </PlantaRequired>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <svg className="h-9 w-9 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              {loadingLong ? "Cargando información, esto puede tomar unos segundos…" : "Cargando…"}
            </p>
          </div>
        </div>
      )}

      {/* Por unidad view */}
      {!loading && viewMode === "unidades" && (
        <div className="space-y-3">
          {filteredSummaries.length === 0 ? (
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl px-5 py-16 text-center text-gray-500 text-sm">
              {unidades.length === 0 ? "Sin unidades registradas en flota" : "Sin resultados para esa búsqueda"}
            </div>
          ) : filteredSummaries.map((s) => (
            <UnitCard
              key={s.unidad.id}
              summary={s}
              onAddEvento={openDrawer}
              onComplete={handleComplete}
              onEdit={openEdit}
              onDelete={setConfirmDeleteEvento}
            />
          ))}
        </div>
      )}

      {/* Cronológico view */}
      {!loading && viewMode === "cronologico" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-white">{filteredEventos.length} registro{filteredEventos.length !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Mantenimiento</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" />Reparación</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />Falla</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A]">
                  {[
                    { h: "Fecha reporte",  cls: "w-[110px]" },
                    { h: "Unidad",         cls: "w-[90px]" },
                    { h: "Tipo",           cls: "w-[130px]" },
                    { h: "Descripción",    cls: "" },
                    { h: "Días abierto",   cls: "w-[100px] text-center" },
                    { h: "KM",             cls: "w-[90px] text-right" },
                    { h: "Importe",        cls: "w-[100px] text-right" },
                    { h: "Status",         cls: "w-[110px]" },
                    { h: "",               cls: "w-[110px]" },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${cls}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {filteredEventos.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-14 text-center text-sm text-gray-600">Sin registros</td></tr>
                ) : filteredEventos.map((ev) => {
                  const isDone = ev.status === "Completado" || ev.status === "Resuelta";
                  const dias = diasDesde(ev.fecha);
                  const diasLabel = dias === 0 ? "Hoy" : `${dias} día${dias !== 1 ? "s" : ""}`;
                  const diasColor = !isDone ? (dias > 5 ? "text-red-400 font-bold" : dias > 2 ? "text-amber-400 font-semibold" : "text-gray-400") : "text-gray-700";
                  // Row highlight for urgent open events
                  const rowBg = !isDone && ev.tipo === "Falla" && ev.severidad === "Alta"
                    ? "bg-red-500/8 hover:bg-red-500/12"
                    : !isDone && (ev.status === "En proceso" || (ev.tipo === "Reparación" && dias > 1))
                    ? "bg-amber-500/5 hover:bg-amber-500/8"
                    : "hover:bg-[#2A2A2A]";

                  return (
                    <tr key={ev.id} className={`transition-colors ${rowBg} ${isDone ? "opacity-60" : ""}`}>
                      {/* Fecha */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-xs text-gray-300 font-mono">{fmtFecha(ev.fecha)}</p>
                        {ev.taller && <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[100px]">{ev.taller}</p>}
                        {ev.reportadoPor && <p className="text-[10px] text-gray-600 mt-0.5">Reportó: {ev.reportadoPor}</p>}
                      </td>
                      {/* Unidad */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-white font-bold text-sm">{ev.unidad}</p>
                      </td>
                      {/* Tipo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${TIPO_BADGE[ev.tipo]}`}>{ev.tipo}</span>
                          {ev.subtipo && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${SUBTIPO_BADGE[ev.subtipo] ?? ""}`}>{ev.subtipo}</span>}
                          {ev.severidad && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${SEV_BADGE[ev.severidad] ?? ""}`}>{ev.severidad}</span>}
                        </div>
                      </td>
                      {/* Descripción */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <p className={`text-sm font-medium leading-snug ${isDone ? "text-gray-500" : "text-gray-100"}`}>{ev.descripcion}</p>
                        {ev.causa && <p className="text-[10px] text-gray-500 mt-0.5">Causa: {ev.causa}</p>}
                        {ev.notas && <p className="text-[10px] text-gray-600 mt-0.5 italic">{ev.notas}</p>}
                        {((ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0) > 0) && (
                          <span className="flex items-center gap-1 text-[10px] text-gray-600 mt-0.5">
                            <Camera size={9} /> {(ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0)} foto{((ev.fotosFactura?.length ?? 0) + (ev.fotosEvidencia?.length ?? 0)) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      {/* Días abierto */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {!isDone
                          ? <span className={`text-sm ${diasColor}`}>{diasLabel}</span>
                          : <span className="text-gray-700 text-xs">—</span>}
                        {ev.horasReparacion != null && (
                          <p className="text-[10px] text-amber-400 mt-0.5 font-semibold">{ev.horasReparacion}h taller</p>
                        )}
                      </td>
                      {/* KM */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {ev.km != null
                          ? <span className="text-sm text-sky-300 font-mono font-semibold">{ev.km.toLocaleString("es-MX")}</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      {/* Importe */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={`text-sm font-bold tabular-nums ${ev.costo > 0 ? (isDone ? "text-gray-500" : "text-white") : "text-gray-700"}`}>
                          {currency(ev.costo)}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[ev.status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>
                          {ev.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {!isDone && (
                            <button onClick={() => handleComplete(ev)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                              <CheckCircle2 size={11} /> Cerrar
                            </button>
                          )}
                          <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer" aria-label="Editar">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setConfirmDeleteEvento(ev)} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer" aria-label="Eliminar">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredEventos.length > 0 && (
            <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center justify-between text-xs text-gray-600">
              <span>{filteredEventos.filter((e) => !["Completado","Resuelta"].includes(e.status)).length} abiertos · {filteredEventos.filter((e) => ["Completado","Resuelta"].includes(e.status)).length} cerrados</span>
              <span className="font-semibold text-white">Total acumulado: {currency(filteredEventos.reduce((s, e) => s + (e.costo ?? 0), 0))}</span>
            </div>
          )}
        </div>
      )}

      <RegistroDrawer
        open={showDrawer}
        unidadesList={unidades.filter((u) => u.estatus !== "Baja").map((u) => u.noEconomico).sort((a, b) => a.localeCompare(b, "es"))}
        preselectedUnidad={preselectedUnidad}
        onClose={() => { setShowDrawer(false); setPreselectedUnidad(""); setEditingEvento(null); }}
        onSave={handleSave}
        editing={editingEvento}
      />

      {confirmDeleteEvento && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteEvento(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 mb-4">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Eliminar registro</h3>
            <p className="text-xs text-gray-500 mb-5">
              ¿Eliminar <span className="text-gray-800 font-medium">{confirmDeleteEvento.descripcion}</span> de {confirmDeleteEvento.unidad}? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteEvento(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDeleteEvento)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
