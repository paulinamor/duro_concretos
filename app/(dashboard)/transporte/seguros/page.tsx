"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Download, Eye, File, FileText,
  FolderOpen, Image, Plus, Search, Shield, ShieldOff, Trash2, Upload,
  X, XCircle,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import HScrollTable from "@/components/HScrollTable";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS, where } from "@/lib/db";
import { todayCST } from "@/lib/dateUtils";
import { useCollectionRaw } from "@/lib/useCollection";
import type { Unidad, EstatusUnidad } from "@/lib/unidades";
import PlantaRequired from "@/components/PlantaRequired";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocItem = {
  id: string;
  nombre: string;
  categoria: string;
  url: string;
  mimeType: string;
  size: number;
  subidoEn: string; // ISO date
};

type StatusPoliza =
  | "Condicionada" | "Indefinida" | "Renovada"
  | "Con financiera" | "Sin seguro" | "Cotizar" | "Cancelada";

interface Seguro {
  id?: string;
  // Identificación de unidad (denormalizado para rapidez)
  unidadId: string;
  tipoUnidad: string;       // REVOLVEDORA, BOMBA, TRACTOCAMION, VOLTEO, VEHICULO…
  noEconomico: string;
  placa: string;
  estadoPlaca: string;
  marca: string;
  modelo: string;
  noSerie: string;
  anio: number | null;
  color: string;
  motor: string;
  // Tarjeta de circulación
  noTarjetaCirculacion: string;
  vigenciaTarjetaCirculacion: string; // ISO yyyy-mm-dd
  // Póliza de seguro
  aseguradora: string;
  noPoliza: string;
  statusPoliza: StatusPoliza;
  vigenciaInicio?: string;  // legacy — ya no se captura
  vigenciaFin: string;      // ISO yyyy-mm-dd
  costoPoliza: number | null;
  valorMercado: number | null;
  tenencia: string;         // año o "—"
  agente: string;
  observaciones: string;
  documentos?: DocItem[];
  planta?: string;
}

interface FormState {
  // ── Operativos (van a colección unidades) ──
  estatus: EstatusUnidad;
  capacidadM3: string;
  kmActual: string;
  choferAsignado: string;
  ultimoMantenimiento: string;
  proximoMantenimiento: string;
  verificacion: string;
  // ── Identificación ──
  tipoUnidad: string;
  noEconomico: string;
  placa: string;
  estadoPlaca: string;
  marca: string;
  modelo: string;
  noSerie: string;
  anio: string;
  color: string;
  motor: string;
  noTarjetaCirculacion: string;
  vigenciaTarjetaCirculacion: string;
  // ── Póliza ──
  aseguradora: string;
  noPoliza: string;
  statusPoliza: StatusPoliza;
  vigenciaFin: string;
  costoPoliza: string;
  valorMercado: string;
  tenencia: string;
  agente: string;
  observaciones: string;
}

type VigenciaStatus = "vigente" | "por_vencer" | "vencido" | "sin_registro";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_UNIDAD = [
  "Revolvedora", "Bomba", "Tractocamión", "Volteo", "Vehículo",
  "Maquinaria", "Remolque", "Plataforma", "Otro",
];

const RUBROS: { tipo: string; label: string }[] = [
  { tipo: "Revolvedora",  label: "Revolvedoras"  },
  { tipo: "Bomba",        label: "Bombas"         },
  { tipo: "Maquinaria",   label: "Maquinaria"     },
  { tipo: "Volteo",       label: "Volteos"        },
  { tipo: "Tractocamión", label: "Tractos"        },
  { tipo: "Plataforma",   label: "Plataformas"    },
  { tipo: "Remolque",     label: "Remolques"      },
  { tipo: "Vehículo",     label: "Vehículos"      },
  { tipo: "Otro",         label: "Otros"          },
];
const RUBRO_IDX = new Map(RUBROS.map(({ tipo }, i) => [tipo, i]));
const rubroLabel = (tipo: string) => RUBROS.find((r) => r.tipo === tipo)?.label ?? tipo;
function naturalCmp(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

const STATUS_POLIZA_OPTS: StatusPoliza[] = [
  "Condicionada", "Indefinida", "Renovada", "Con financiera",
  "Sin seguro", "Cotizar", "Cancelada",
];

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Guanajuato",
  "Guerrero","Hidalgo","Jalisco","México","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

const todayISO = todayCST;

function vigenciaStatus(fechaFin: string | undefined): VigenciaStatus {
  if (!fechaFin) return "sin_registro";
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  const diff = (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencido";
  if (diff <= 30) return "por_vencer";
  return "vigente";
}

function diasRestantes(fechaFin: string) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + "T00:00:00");
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function emptyForm(u?: Unidad): FormState {
  return {
    // Unit operational fields — from Unidad if editing existing unit
    estatus: u?.estatus ?? "Activo",
    capacidadM3: u?.capacidadM3 != null ? String(u.capacidadM3) : "",
    kmActual: u?.kmActual != null ? String(u.kmActual) : "",
    choferAsignado: u?.choferAsignado ?? "",
    ultimoMantenimiento: u?.ultimoMantenimiento ?? "",
    proximoMantenimiento: u?.proximoMantenimiento === "—" ? "" : (u?.proximoMantenimiento ?? ""),
    verificacion: u?.verificacion ?? "",
    // Unit identification — from Unidad
    tipoUnidad: "Revolvedora",
    noEconomico: u?.noEconomico ?? "",
    placa: u?.placa ?? "",
    estadoPlaca: "Nuevo León",
    marca: u?.marca ?? "",
    modelo: u?.modelo ?? "",
    noSerie: "",
    anio: u?.anio != null ? String(u.anio) : "",
    color: "",
    motor: "",
    noTarjetaCirculacion: u?.tarjetaCirculacion ?? "",
    vigenciaTarjetaCirculacion: "",
    // Seguro fields — always blank for new registration
    aseguradora: "",
    noPoliza: "",
    statusPoliza: "Condicionada",
    vigenciaFin: "",
    costoPoliza: "",
    valorMercado: "",
    tenencia: "",
    agente: "",
    observaciones: u?.observaciones ?? "",
  };
}

function formFromRecord(s: Seguro, u?: Unidad): FormState {
  return {
    estatus: u?.estatus ?? "Activo",
    capacidadM3: u?.capacidadM3 != null ? String(u.capacidadM3) : "",
    kmActual: u?.kmActual != null ? String(u.kmActual) : "",
    choferAsignado: u?.choferAsignado ?? "",
    ultimoMantenimiento: u?.ultimoMantenimiento ?? "",
    proximoMantenimiento: u?.proximoMantenimiento === "—" ? "" : (u?.proximoMantenimiento ?? ""),
    verificacion: u?.verificacion ?? "",
    tipoUnidad: s.tipoUnidad,
    noEconomico: s.noEconomico,
    placa: s.placa,
    estadoPlaca: s.estadoPlaca,
    marca: s.marca,
    modelo: s.modelo,
    noSerie: s.noSerie,
    anio: s.anio != null ? String(s.anio) : "",
    color: s.color,
    motor: s.motor,
    noTarjetaCirculacion: s.noTarjetaCirculacion,
    vigenciaTarjetaCirculacion: s.vigenciaTarjetaCirculacion,
    aseguradora: s.aseguradora,
    noPoliza: s.noPoliza,
    statusPoliza: s.statusPoliza,
    vigenciaFin: s.vigenciaFin,
    costoPoliza: s.costoPoliza != null && !isNaN(s.costoPoliza) ? String(s.costoPoliza) : "",
    valorMercado: s.valorMercado != null && !isNaN(s.valorMercado) ? String(s.valorMercado) : "",
    tenencia: s.tenencia,
    agente: s.agente,
    observaciones: s.observaciones,
  };
}

function exportXLSX(rows: Seguro[]) {
  const XLSX = require("xlsx");
  const today = new Date(); today.setHours(0,0,0,0);
  const data = rows.map((s) => ({
    "TIPO": s.tipoUnidad,
    "NO.ECO": s.noEconomico,
    "PLACA": s.placa,
    "ESTADO": s.estadoPlaca,
    "MARCA": s.marca,
    "MODELO": s.modelo,
    "SERIE": s.noSerie,
    "AÑO": s.anio ?? "",
    "COLOR": s.color,
    "MOTOR": s.motor,
    "NO.TC": s.noTarjetaCirculacion,
    "VIGENCIA TC": s.vigenciaTarjetaCirculacion,
    "ASEGURADORA": s.aseguradora,
    "NO.POLIZA": s.noPoliza,
    "STATUS POLIZA": s.statusPoliza,
    "VIGENCIA": s.vigenciaFin,
    "DIAS": s.vigenciaFin ? Math.ceil((new Date(s.vigenciaFin+"T00:00:00").getTime()-today.getTime())/(1000*60*60*24)) : "",
    "COSTO POLIZA": s.costoPoliza ?? "",
    "VALOR MERCADO": s.valorMercado ?? "",
    "TENENCIA": s.tenencia,
    "AGENTE": s.agente,
    "OBSERVACIONES": s.observaciones,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Seguros");
  XLSX.writeFile(wb, "seguros-flota.xlsx");
}

const STATUS_VIG: Record<VigenciaStatus, { label: string; cls: string }> = {
  vigente:      { label: "Vigente",      cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  por_vencer:   { label: "Por vencer",   cls: "bg-amber-500/10  border-amber-500/30  text-amber-400"   },
  vencido:      { label: "Vencido",      cls: "bg-red-500/10    border-red-500/30    text-red-400"     },
  sin_registro: { label: "Sin registro", cls: "bg-gray-500/10   border-gray-500/30   text-gray-500"    },
};

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── DocumentosDrawer ─────────────────────────────────────────────────────────

const DOC_CATS = [
  "Foto", "Tarjeta Circulación", "Póliza Seguro", "Verificación",
  "Permiso SCT", "Factura", "Otro",
];
const MAX_MB = 20;

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocIcon({ mimeType, size = 16 }: { mimeType: string; size?: number }) {
  if (isImage(mimeType)) return <Image size={size} />;
  if (mimeType === "application/pdf") return <FileText size={size} />;
  return <File size={size} />;
}

function DocumentosDrawer({
  open, onClose, seguro, unidadId, noEconomico, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  seguro: Seguro;
  unidadId: string;
  noEconomico: string;
  onSaved: (docs: DocItem[]) => Promise<void>;
}) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categoria, setCategoria] = useState("Foto");
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<Record<string, number>>({}); // filename → progress 0-100
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<DocItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDocs(seguro.documentos ?? []);
  }, [open, seguro]);

  async function uploadFiles(files: File[]) {
    if (!storage) return;
    for (const file of files) {
      if (file.size > MAX_MB * 1024 * 1024) {
        window.dispatchEvent(new CustomEvent("duro:toast", {
          detail: { type: "error", message: `${file.name} supera ${MAX_MB} MB.` },
        }));
        continue;
      }
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storageRef = ref(storage, `unidades/${unidadId}/docs/${filename}`);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploads((u) => ({ ...u, [filename]: pct }));
          },
          (err) => { reject(err); },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            const newDoc: DocItem = {
              id: filename,
              nombre: file.name,
              categoria,
              url,
              mimeType: file.type || "application/octet-stream",
              size: file.size,
              subidoEn: new Date().toISOString().slice(0, 10),
            };
            setDocs((prev) => {
              const updated = [...prev, newDoc];
              onSaved(updated);
              return updated;
            });
            setUploads((u) => { const n = { ...u }; delete n[filename]; return n; });
            resolve();
          }
        );
      });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  }

  async function deleteDoc(doc: DocItem) {
    setDeleting(doc.id);
    try {
      if (storage) {
        const storageRef = ref(storage, `unidades/${unidadId}/docs/${doc.id}`);
        await deleteObject(storageRef).catch(() => {});
      }
      const updated = docs.filter((d) => d.id !== doc.id);
      setDocs(updated);
      await onSaved(updated);
    } finally {
      setDeleting(null);
    }
  }

  const fotos = docs.filter((d) => isImage(d.mimeType));
  const archivos = docs.filter((d) => !isImage(d.mimeType));
  const uploadingCount = Object.keys(uploads).length;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[110] flex">
        <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FolderOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Documentos y Fotos</h2>
              <p className="text-xs text-gray-500">{noEconomico} · {docs.length} archivo{docs.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Upload zone */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  {DOC_CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                  dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <Upload size={22} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-600">Arrastra archivos o haz clic para subir</p>
                <p className="text-xs text-gray-400">Fotos, PDFs, documentos · Máx {MAX_MB} MB c/u</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => { if (e.target.files) uploadFiles(Array.from(e.target.files)); e.target.value = ""; }}
              />
            </div>

            {/* Upload progress */}
            {uploadingCount > 0 && (
              <div className="space-y-2">
                {Object.entries(uploads).map(([name, pct]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="truncate max-w-[280px]">{name}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fotos */}
            {fotos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Fotos ({fotos.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((doc) => (
                    <div key={doc.id} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={doc.url} alt={doc.nombre} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setLightbox(doc)}
                          className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => deleteDoc(doc)}
                          disabled={deleting === doc.id}
                          className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">{doc.categoria}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documentos */}
            {archivos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Documentos ({archivos.length})</p>
                <div className="space-y-2">
                  {archivos.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 text-blue-500">
                        <DocIcon mimeType={doc.mimeType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.nombre}</p>
                        <p className="text-[11px] text-gray-400">{doc.categoria} · {fmtSize(doc.size)} · {doc.subidoEn}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver"
                        >
                          <Eye size={14} />
                        </a>
                        <a
                          href={doc.url}
                          download={doc.nombre}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => deleteDoc(doc)}
                          disabled={deleting === doc.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {docs.length === 0 && uploadingCount === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                <FolderOpen size={32} className="text-gray-300" />
                <p className="text-sm">Sin archivos aún</p>
                <p className="text-xs">Sube fotos y documentos de esta unidad</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors cursor-pointer">
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.nombre}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
            <p className="text-white text-sm">{lightbox.nombre}</p>
            <p className="text-white/50 text-xs">{lightbox.categoria} · {fmtSize(lightbox.size)}</p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section divider helper ───────────────────────────────────────────────────

function Sec({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">{title}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, unidad, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (s: Seguro, u: Unidad) => Promise<void>;
  unidad: Unidad | null;
  existing?: Seguro;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(existing ? formFromRecord(existing, unidad ?? undefined) : emptyForm(unidad ?? undefined));
  }, [open, existing, unidad]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.noEconomico.trim()) {
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "error", title: "Campo requerido", message: "Ingresa el No. Económico de la unidad." },
      }));
      return;
    }
    setSaving(true);
    try {
      const unidadId = unidad?.id ?? existing?.unidadId ?? `UN-${Date.now()}`;
      const seguroId = existing?.id ?? `SEG-${unidadId}-${Date.now()}`;


      const unidadDoc: Unidad = {
        id: unidadId,
        noEconomico: form.noEconomico.trim().toUpperCase(),
        placa: form.placa.trim().toUpperCase(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        anio: form.anio ? parseInt(form.anio) : (unidad?.anio ?? 0),
        capacidadM3: form.capacidadM3 ? parseFloat(form.capacidadM3) : (unidad?.capacidadM3 ?? 0),
        kmActual: form.kmActual ? parseFloat(form.kmActual.replace(/,/g, "")) : (unidad?.kmActual ?? 0),
        choferAsignado: form.choferAsignado.trim(),
        estatus: form.estatus,
        ultimoMantenimiento: form.ultimoMantenimiento || "",
        proximoMantenimiento: form.proximoMantenimiento || "—",
        seguroVigente: form.vigenciaFin || "",
        tarjetaCirculacion: form.noTarjetaCirculacion.trim(),
        verificacion: form.verificacion || "",
        observaciones: form.observaciones.trim(),
      };

      const seguroDoc: Seguro = {
        id: seguroId,
        unidadId,
        tipoUnidad: form.tipoUnidad,
        noEconomico: form.noEconomico.trim(),
        placa: form.placa.trim(),
        estadoPlaca: form.estadoPlaca,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        noSerie: form.noSerie.trim(),
        anio: form.anio ? parseInt(form.anio) : null,
        color: form.color.trim(),
        motor: form.motor.trim(),
        noTarjetaCirculacion: form.noTarjetaCirculacion.trim(),
        vigenciaTarjetaCirculacion: form.vigenciaTarjetaCirculacion,
        aseguradora: form.aseguradora.trim(),
        noPoliza: form.noPoliza.trim(),
        statusPoliza: form.statusPoliza,
        vigenciaFin: form.vigenciaFin,
        costoPoliza: (() => { const v = parseFloat(form.costoPoliza.replace(/,/g, "")); return isNaN(v) ? null : v; })(),
        valorMercado: (() => { const v = parseFloat(form.valorMercado.replace(/,/g, "")); return isNaN(v) ? null : v; })(),
        tenencia: form.tenencia.trim(),
        agente: form.agente.trim(),
        observaciones: form.observaciones.trim(),
      };

      await onSave(seguroDoc, unidadDoc);
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "PLANTA_REQUERIDA") {
        window.dispatchEvent(new CustomEvent("duro:toast", {
          detail: {
            type: "error",
            title: "Error al guardar",
            message: err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.",
          },
        }));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {existing ? "Editar unidad" : "Nueva unidad"}
            </h2>
            <p className="text-xs text-gray-500">
              {form.noEconomico
                ? `${form.noEconomico} · ${form.placa} · ${form.marca} ${form.modelo}`.trim()
                : "Datos de la unidad y su póliza"}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Identificación */}
          <Sec title="Identificación de la unidad" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>No. Económico <span className="text-[#CC2229]">*</span></label>
              <input type="text" value={form.noEconomico} onChange={(e) => set("noEconomico", e.target.value)}
                placeholder="DC-01" className={inp} />
            </div>
            <div>
              <label className={lbl}>Tipo de unidad</label>
              <select value={form.tipoUnidad} onChange={(e) => set("tipoUnidad", e.target.value)} className={inp}>
                {TIPOS_UNIDAD.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Placa</label>
              <input type="text" value={form.placa} onChange={(e) => set("placa", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Estado placa</label>
              <select value={form.estadoPlaca} onChange={(e) => set("estadoPlaca", e.target.value)} className={inp}>
                {ESTADOS_MX.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Marca</label>
              <input type="text" value={form.marca} onChange={(e) => set("marca", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Modelo</label>
              <input type="text" value={form.modelo} onChange={(e) => set("modelo", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Año</label>
              <input type="number" value={form.anio} onChange={(e) => set("anio", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}># Serie</label>
              <input type="text" value={form.noSerie} onChange={(e) => set("noSerie", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Color</label>
              <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Motor</label>
              <input type="text" value={form.motor} onChange={(e) => set("motor", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Datos operativos */}
          <Sec title="Datos operativos" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Estatus</label>
              <select value={form.estatus} onChange={(e) => set("estatus", e.target.value as EstatusUnidad)} className={inp}>
                <option value="Activo">Activo</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Capacidad m³</label>
              <input type="number" value={form.capacidadM3} onChange={(e) => set("capacidadM3", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Km actual</label>
              <input type="text" value={form.kmActual} onChange={(e) => set("kmActual", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Chofer asignado</label>
              <input type="text" value={form.choferAsignado} onChange={(e) => set("choferAsignado", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Últ. mantenimiento</label>
              <input type="date" value={form.ultimoMantenimiento} onChange={(e) => set("ultimoMantenimiento", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Próx. mantenimiento</label>
              <input type="date" value={form.proximoMantenimiento} onChange={(e) => set("proximoMantenimiento", e.target.value)} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Verificación</label>
              <input type="date" value={form.verificacion} onChange={(e) => set("verificacion", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Tarjeta de Circulación */}
          <Sec title="Tarjeta de circulación" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>No. Tarjeta</label>
              <input type="text" value={form.noTarjetaCirculacion} onChange={(e) => set("noTarjetaCirculacion", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vigencia TC</label>
              <input type="date" value={form.vigenciaTarjetaCirculacion} onChange={(e) => set("vigenciaTarjetaCirculacion", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Póliza */}
          <Sec title="Póliza de seguro" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Aseguradora</label>
              <input type="text" value={form.aseguradora} onChange={(e) => set("aseguradora", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>No. Póliza</label>
              <input type="text" value={form.noPoliza} onChange={(e) => set("noPoliza", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status póliza</label>
              <select value={form.statusPoliza} onChange={(e) => set("statusPoliza", e.target.value as StatusPoliza)} className={inp}>
                {STATUS_POLIZA_OPTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Vigencia</label>
              <input type="date" value={form.vigenciaFin} onChange={(e) => set("vigenciaFin", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Costo póliza $</label>
              <input type="text" value={form.costoPoliza} onChange={(e) => set("costoPoliza", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Valor mercado $</label>
              <input type="text" value={form.valorMercado} onChange={(e) => set("valorMercado", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Tenencia (año)</label>
              <input type="text" value={form.tenencia} onChange={(e) => set("tenencia", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Agente / Contacto</label>
              <input type="text" value={form.agente} onChange={(e) => set("agente", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className={lbl}>Observaciones</label>
            <textarea rows={2} value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)}
              className={`${inp} resize-none`} />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <Shield size={14} />
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SegurosPage() {
  const unidades = useCollectionRaw<Unidad>(COLLECTIONS.unidades);
  const seguros = useCollectionRaw<Seguro>(COLLECTIONS.seguros);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<VigenciaStatus | "todos">("todos");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [drawerUnidad, setDrawerUnidad] = useState<Unidad | null>(null);
  const [drawerExisting, setDrawerExisting] = useState<Seguro | undefined>();
  const [showDrawer, setShowDrawer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Seguro | null>(null);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ unidad: Unidad; seguro?: Seguro } | null>(null);
  const [unitDeps, setUnitDeps] = useState<{ checking: boolean; mantenimientos: number; diesel: number; reparaciones: number; fallas: number } | null>(null);
  const [docsTarget, setDocsTarget] = useState<{ seguro: Seguro; unidadId: string; noEconomico: string } | null>(null);

  // Map unidadId → latest seguro (by vigenciaFin desc)
  const seguroByUnidad = useMemo(() => {
    const map = new Map<string, Seguro>();
    seguros.forEach((s) => {
      const ex = map.get(s.unidadId);
      if (!ex || (s.vigenciaFin || "") > (ex.vigenciaFin || "")) map.set(s.unidadId, s);
    });
    return map;
  }, [seguros]);

  // Standalone seguros (no matching unidad in DB — imported from Excel)
  const standaloneIds = useMemo(() => {
    const unitIds = new Set(unidades.map((u) => u.id));
    return seguros.filter((s) => s.unidadId && !unitIds.has(s.unidadId)).map((s) => s.id);
  }, [seguros, unidades]);

  // Merged rows
  const rows = useMemo(() => {
    const fromUnidades = unidades.map((u) => ({
      unidad: u,
      seguro: seguroByUnidad.get(u.id),
      status: vigenciaStatus(seguroByUnidad.get(u.id)?.vigenciaFin),
    }));
    // Also include standalone seguros (e.g. imported that have no unidad doc)
    const extra = seguros
      .filter((s) => standaloneIds.includes(s.id))
      .map((s) => ({
        unidad: null as unknown as Unidad,
        seguro: s,
        status: vigenciaStatus(s.vigenciaFin),
      }));
    return [...fromUnidades, ...extra];
  }, [unidades, seguroByUnidad, seguros, standaloneIds]);

  const tipos = useMemo(() => {
    const set = new Set(seguros.map((s) => s.tipoUnidad).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [seguros]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus !== "todos") list = list.filter((r) => r.status === filterStatus);
    if (filterTipo !== "Todos") list = list.filter((r) => r.seguro?.tipoUnidad === filterTipo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.unidad?.noEconomico ?? r.seguro?.noEconomico ?? "").toLowerCase().includes(q) ||
        (r.unidad?.placa ?? r.seguro?.placa ?? "").toLowerCase().includes(q) ||
        (r.unidad?.marca ?? r.seguro?.marca ?? "").toLowerCase().includes(q) ||
        (r.seguro?.aseguradora ?? "").toLowerCase().includes(q) ||
        (r.seguro?.noPoliza ?? "").toLowerCase().includes(q) ||
        (r.seguro?.agente ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filterStatus, filterTipo, search]);

  const groupedFiltered = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const ta = a.seguro?.tipoUnidad ?? "";
      const tb = b.seguro?.tipoUnidad ?? "";
      const ri = (RUBRO_IDX.get(ta) ?? 99) - (RUBRO_IDX.get(tb) ?? 99);
      if (ri !== 0) return ri;
      const ea = a.unidad?.noEconomico ?? a.seguro?.noEconomico ?? "";
      const eb = b.unidad?.noEconomico ?? b.seguro?.noEconomico ?? "";
      return naturalCmp(ea, eb);
    });
    const sections: Array<{ tipo: string; label: string; rows: typeof sorted }> = [];
    for (const row of sorted) {
      const tipo = row.seguro?.tipoUnidad ?? "—";
      const last = sections[sections.length - 1];
      if (last && last.tipo === tipo) last.rows.push(row);
      else sections.push({ tipo, label: rubroLabel(tipo), rows: [row] });
    }
    return sections;
  }, [filtered]);

  const total = rows.length;
  const vigentes = rows.filter((r) => r.status === "vigente").length;
  const porVencer = rows.filter((r) => r.status === "por_vencer").length;
  const sinCob = rows.filter((r) => r.status === "vencido" || r.status === "sin_registro").length;

  const handleSave = async (s: Seguro, u: Unidad) => {
    const { id: sId, ...sData } = s;
    const { id: uId, ...uData } = u;
    await Promise.all([
      upsertDocument(COLLECTIONS.seguros, sId!, sData),
      upsertDocument(COLLECTIONS.unidades, uId, uData),
    ]);
    // Real-time listener (useCollection) automatically reflects Firestore changes
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `Unidad ${s.noEconomico} guardada.` },
    }));
  };

  async function handleDocsUpdate(docs: DocItem[]) {
    if (!docsTarget) return;
    await upsertDocument(COLLECTIONS.seguros, docsTarget.seguro.id!, { documentos: docs });
    setDocsTarget((prev) => prev ? { ...prev, seguro: { ...prev.seguro, documentos: docs } } : null);
  }

  async function handleDelete(s: Seguro) {
    await deleteDocument(COLLECTIONS.seguros, s.id!);
    setConfirmDelete(null);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `Seguro de ${s.noEconomico} eliminado.` },
    }));
  }

  async function openDeleteUnit(unidad: Unidad, seguro?: Seguro) {
    setConfirmDeleteUnit({ unidad, seguro });
    setUnitDeps({ checking: true, mantenimientos: 0, diesel: 0, reparaciones: 0, fallas: 0 });
    const noEco = unidad.noEconomico;
    const [mantos, diesels, reps, falls] = await Promise.all([
      getCollectionDocs<{ id?: string }>(COLLECTIONS.mantenimientos, [where("unidad", "==", noEco)]),
      getCollectionDocs<{ id?: string }>(COLLECTIONS.diesel, [where("unidad", "==", noEco)]),
      getCollectionDocs<{ id?: string }>(COLLECTIONS.reparaciones, [where("unidad", "==", noEco)]),
      getCollectionDocs<{ id?: string }>(COLLECTIONS.fallas, [where("unidad", "==", noEco)]),
    ]);
    setUnitDeps({ checking: false, mantenimientos: mantos.length, diesel: diesels.length, reparaciones: reps.length, fallas: falls.length });
  }

  async function handleDeleteUnit() {
    if (!confirmDeleteUnit) return;
    const { unidad, seguro } = confirmDeleteUnit;
    await Promise.all([
      deleteDocument(COLLECTIONS.unidades, unidad.id),
      ...(seguro?.id ? [deleteDocument(COLLECTIONS.seguros, seguro.id)] : []),
    ]);
    setConfirmDeleteUnit(null);
    setUnitDeps(null);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `Unidad ${unidad.noEconomico} eliminada del sistema.` },
    }));
  }

  function openDrawer(unidad: Unidad | null, existing?: Seguro) {
    setDrawerUnidad(unidad);
    setDrawerExisting(existing);
    setShowDrawer(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Registro unificado de flota · Pólizas, datos operativos y tarjetas de circulación</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportXLSX(seguros)}
            disabled={seguros.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            Exportar Excel
          </button>
          <PlantaRequired>
            {(ok) => (
              <button
                onClick={() => ok && openDrawer(null)}
                disabled={!ok}
                title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
                className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
              >
                <Plus size={15} />
                Nuevo registro
              </button>
            )}
          </PlantaRequired>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Unidades registradas" value={String(total)} icon={Shield} iconColor="text-blue-400" />
        <KPICard title="Pólizas vigentes" value={String(vigentes)} icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Por vencer ≤30 días" value={String(porVencer)} icon={Clock} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <KPICard title="Sin cobertura activa" value={String(sinCob)} icon={ShieldOff} iconColor="text-red-400" iconBg="bg-red-500/10" />
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Placa, No. Eco, aseguradora, agente…"
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
            />
          </div>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
            {tipos.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as VigenciaStatus | "todos")}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60">
            <option value="todos">Todos los estatus</option>
            <option value="vigente">Vigente</option>
            <option value="por_vencer">Por vencer</option>
            <option value="vencido">Vencido</option>
            <option value="sin_registro">Sin registro</option>
          </select>
          <span className="text-xs text-gray-600 ml-auto">{filtered.length} unidades</span>
        </div>

        <HScrollTable maxHeight="calc(100vh - 320px)">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1A1A1A]">
                {[
                  "No. Eco.","Estatus","Placa","Marca / Modelo","Tarjeta Circ.",
                  "Aseguradora","No. Póliza","Status","Vence","Días","$ Póliza","Valor","Tenencia","",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-[#1A1A1A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-sm text-gray-600">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                groupedFiltered.flatMap(({ label, rows: groupRows }) => [
                  /* ── Rubro header ── */
                  <tr key={`hdr-${label}`}>
                    <td colSpan={14} className="px-4 pt-5 pb-1.5 border-t border-[#3A3A3A]">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3.5 rounded-full bg-[#CC2229]/70 shrink-0" />
                        <span className="text-[11px] font-semibold text-gray-200 tracking-wide">{label}</span>
                        <span className="text-[10px] text-gray-600 tabular-nums">{groupRows.length}</span>
                      </div>
                    </td>
                  </tr>,
                  ...groupRows.map(({ unidad, seguro, status }) => {
                  const cfg = STATUS_VIG[status];
                  const dias = seguro?.vigenciaFin ? diasRestantes(seguro.vigenciaFin) : null;
                  const placa = unidad?.placa ?? seguro?.placa ?? "—";
                  const marca = unidad?.marca ?? seguro?.marca ?? "—";
                  const modelo = unidad?.modelo ?? seguro?.modelo ?? "";
                  const noEco = unidad?.noEconomico ?? seguro?.noEconomico ?? "—";
                  return (
                    <tr key={unidad?.id ?? seguro?.id} className="border-b border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors">
                      {/* No. Eco */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[#CC2229]">{noEco}</span>
                      </td>
                      {/* Estatus */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {unidad?.estatus ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            unidad.estatus === "Activo"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : unidad.estatus === "Mantenimiento"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>{unidad.estatus}</span>
                        ) : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      {/* Placa */}
                      <td className="px-3 py-2.5 text-gray-300 text-xs font-mono whitespace-nowrap">{placa}</td>
                      {/* Marca / Modelo */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-gray-200 text-xs font-medium">{marca}</p>
                        {(modelo || seguro?.anio || unidad?.anio) && (
                          <p className="text-gray-600 text-[11px]">{modelo}{(seguro?.anio ?? unidad?.anio) ? ` · ${seguro?.anio ?? unidad?.anio}` : ""}</p>
                        )}
                      </td>
                      {/* Tarjeta Circ. (No + Vence apilados) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {seguro?.noTarjetaCirculacion
                          ? <>
                              <p className="text-gray-300 text-[11px] font-mono">{seguro.noTarjetaCirculacion}</p>
                              {seguro.vigenciaTarjetaCirculacion && <p className="text-gray-600 text-[10px]">Vence {seguro.vigenciaTarjetaCirculacion}</p>}
                            </>
                          : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      {/* Aseguradora */}
                      <td className="px-3 py-2.5 max-w-[160px] whitespace-nowrap">
                        {seguro?.aseguradora
                          ? <>
                              <p className="text-gray-200 text-xs truncate">{seguro.aseguradora}</p>
                              {seguro.agente && <p className="text-gray-600 text-[11px] truncate">{seguro.agente}</p>}
                            </>
                          : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      {/* No. Póliza */}
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {seguro?.noPoliza || <span className="text-gray-700">—</span>}
                      </td>
                      {/* Status póliza */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {seguro?.statusPoliza ? (
                          <span className={`text-[11px] font-medium ${
                            seguro.statusPoliza === "Sin seguro" || seguro.statusPoliza === "Cancelada" ? "text-red-400"
                            : seguro.statusPoliza === "Cotizar" ? "text-amber-400"
                            : "text-gray-400"
                          }`}>{seguro.statusPoliza}</span>
                        ) : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      {/* Vence póliza */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {seguro?.vigenciaFin ? (
                          <span className={`text-[11px] font-medium ${
                            status === "vencido" ? "text-red-400"
                            : status === "por_vencer" ? "text-amber-400"
                            : "text-gray-400"
                          }`}>{seguro.vigenciaFin}</span>
                        ) : <span className="text-gray-700 text-[11px]">—</span>}
                      </td>
                      {/* Días */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                          {dias !== null
                            ? (dias < 0 ? `−${Math.abs(dias)}d` : dias === 0 ? "Hoy" : `${dias}d`)
                            : cfg.label}
                        </span>
                      </td>
                      {/* $ Póliza */}
                      <td className="px-3 py-2.5 text-gray-400 text-[11px] tabular-nums whitespace-nowrap">
                        {seguro?.costoPoliza != null
                          ? `$${seguro.costoPoliza.toLocaleString("es-MX", { minimumFractionDigits: 0 })}`
                          : <span className="text-gray-700">—</span>}
                      </td>
                      {/* Valor */}
                      <td className="px-3 py-2.5 text-gray-400 text-[11px] tabular-nums whitespace-nowrap">
                        {seguro?.valorMercado != null
                          ? `$${seguro.valorMercado.toLocaleString("es-MX")}`
                          : <span className="text-gray-700">—</span>}
                      </td>
                      {/* Tenencia */}
                      <td className="px-3 py-2.5 text-gray-500 text-[11px] whitespace-nowrap">
                        {seguro?.tenencia || <span className="text-gray-700">—</span>}
                      </td>
                      {/* Acciones */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDrawer(unidad, seguro)}
                            title={seguro ? "Editar" : "Registrar seguro"}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              seguro
                                ? "text-gray-500 hover:text-white bg-[#1A1A1A] border-[#3A3A3A] hover:bg-[#2A2A2A] hover:border-[#CC2229]/40"
                                : "text-[#CC2229] bg-[#CC2229]/10 border-[#CC2229]/30 hover:bg-[#CC2229]/20"
                            }`}
                          >
                            <Shield size={12} />
                          </button>
                          {seguro && (
                            <button
                              onClick={() => setDocsTarget({ seguro, unidadId: unidad?.id ?? seguro.unidadId, noEconomico: unidad?.noEconomico ?? seguro.noEconomico })}
                              title="Documentos"
                              className="relative p-1.5 rounded-lg border text-gray-500 hover:text-blue-400 bg-[#1A1A1A] border-[#3A3A3A] hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors"
                            >
                              <FolderOpen size={12} />
                              {(seguro.documentos?.length ?? 0) > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-[8px] font-bold text-white flex items-center justify-center">
                                  {seguro.documentos!.length}
                                </span>
                              )}
                            </button>
                          )}
                          {seguro && (
                            <button
                              onClick={() => setConfirmDelete(seguro)}
                              title="Eliminar póliza"
                              className="p-1.5 rounded-lg border text-gray-700 hover:text-red-400 bg-[#1A1A1A] border-[#3A3A3A] hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          {unidad && (
                            <button
                              onClick={() => openDeleteUnit(unidad, seguro)}
                              title="Eliminar unidad"
                              className="p-1.5 rounded-lg border text-gray-700 hover:text-orange-400 bg-[#1A1A1A] border-[#3A3A3A] hover:bg-orange-500/10 hover:border-orange-500/30 transition-colors"
                            >
                              <XCircle size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }),
                ])
              )}
            </tbody>
          </table>
        </HScrollTable>

        {(porVencer > 0 || sinCob > 0) && (
          <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-gray-500">
              {porVencer > 0 && <span className="text-amber-400 font-medium">{porVencer} póliza{porVencer !== 1 ? "s" : ""} por vencer</span>}
              {porVencer > 0 && sinCob > 0 && " · "}
              {sinCob > 0 && <span className="text-red-400 font-medium">{sinCob} sin cobertura activa</span>}
            </p>
          </div>
        )}
      </div>

      <FormDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSave={handleSave}
        unidad={drawerUnidad}
        existing={drawerExisting}
      />

      {docsTarget && (
        <DocumentosDrawer
          open={!!docsTarget}
          onClose={() => setDocsTarget(null)}
          seguro={docsTarget.seguro}
          unidadId={docsTarget.unidadId}
          noEconomico={docsTarget.noEconomico}
          onSaved={handleDocsUpdate}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar seguro</h3>
            <p className="text-xs text-gray-500 mb-5">
              ¿Eliminar el registro de póliza de la unidad <span className="text-gray-300 font-medium">{confirmDelete.noEconomico}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteUnit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setConfirmDeleteUnit(null); setUnitDeps(null); }} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 mb-4">
              <XCircle size={20} className="text-orange-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar unidad del sistema</h3>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              {confirmDeleteUnit.unidad.noEconomico}
              {confirmDeleteUnit.unidad.placa ? <span className="text-gray-600"> · {confirmDeleteUnit.unidad.placa}</span> : ""}
            </p>

            {unitDeps?.checking ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
                <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                Verificando dependencias en otros módulos…
              </div>
            ) : unitDeps && (unitDeps.mantenimientos + unitDeps.diesel + unitDeps.reparaciones + unitDeps.fallas) > 0 ? (
              <div className="mb-5">
                <p className="text-xs text-amber-400 font-medium mb-3">Tiene registros ligados en otros módulos:</p>
                <div className="space-y-2 bg-[#242424] rounded-xl p-3 border border-[#3A3A3A]">
                  {unitDeps.mantenimientos > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Mantenimientos</span>
                      <span className="font-mono text-gray-300">{unitDeps.mantenimientos}</span>
                    </div>
                  )}
                  {unitDeps.diesel > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Cargas de diésel</span>
                      <span className="font-mono text-gray-300">{unitDeps.diesel}</span>
                    </div>
                  )}
                  {unitDeps.reparaciones > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Reparaciones</span>
                      <span className="font-mono text-gray-300">{unitDeps.reparaciones}</span>
                    </div>
                  )}
                  {unitDeps.fallas > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Fallas</span>
                      <span className="font-mono text-gray-300">{unitDeps.fallas}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-600 mt-3">Elimina o reasigna esos registros antes de borrar la unidad.</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mb-5">
                Sin registros ligados en otros módulos.{confirmDeleteUnit.seguro ? " Se eliminarán la unidad y su póliza de seguro." : " Se eliminará la unidad permanentemente."}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmDeleteUnit(null); setUnitDeps(null); }}
                className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUnit}
                disabled={
                  unitDeps?.checking ||
                  ((unitDeps?.mantenimientos ?? 0) + (unitDeps?.diesel ?? 0) + (unitDeps?.reparaciones ?? 0) + (unitDeps?.fallas ?? 0)) > 0
                }
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Eliminar unidad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
