"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Camera, Download, ExternalLink, FileSpreadsheet, FileText,
  HardHat, Loader2, Paperclip, Pencil, Plus, Search, Settings2, Trash2,
  UserCheck, UserMinus, Users, X,
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import PlantaRequired from "@/components/PlantaRequired";
import { diasDesdeIngreso, docsProximos, operadoresActivos, type DocEmpleado, type Operador } from "@/lib/operadores";
import { COLLECTIONS, deleteDocument, getDocument, subscribeToCollection, upsertDocument } from "@/lib/db";
import { normalizeKey } from "@/lib/duplicateCheck";
import DuplicateWarningModal from "@/components/DuplicateWarningModal";
import { matchesQuery } from "@/lib/search";
import EmptyState from "@/components/EmptyState";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_LICENCIA = ["A", "B", "C", "D", "E"];
const DEFAULT_PUESTOS = [
  "AUX. CONTABLE", "AYUDANTE GENERAL", "AUXILIAR DE LOGISTICA Y OPERACIONES",
  "JEFE DE PLANTA", "MAQUINISTA", "MECANICO", "OPERADOR DE BOMBA",
  "OPERADOR DE REVOLVEDORA", "OPERADOR TR", "OTRO",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vencimientoColor(fecha: string) {
  if (!fecha) return "text-gray-500";
  const days = (new Date(fecha).getTime() - Date.now()) / 86400000;
  if (days < 0) return "text-red-400";
  if (days < 90) return "text-amber-400";
  return "text-gray-400";
}

function vencimientoColorLight(fecha: string) {
  if (!fecha) return "text-slate-400";
  const days = (new Date(fecha).getTime() - Date.now()) / 86400000;
  if (days < 0) return "text-red-600";
  if (days < 90) return "text-amber-600";
  return "text-slate-700";
}

function formatFecha(f: string) {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

function edad(fechaNacimiento: string) {
  if (!fechaNacimiento) return null;
  return Math.floor((Date.now() - new Date(fechaNacimiento).getTime()) / (365.25 * 86400000));
}

async function uploadFile(path: string, file: File): Promise<string> {
  if (!storage) throw new Error("Storage no disponible");
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

async function deleteFile(path: string) {
  if (!storage || !path) return;
  try { await deleteObject(ref(storage, path)); } catch { /* ya no existe */ }
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  apodo: string; nombre: string; fechaNacimiento: string; curp: string; rfc: string;
  direccion: string; puesto: string; fechaIngreso: string; sueldoBase: string;
  cuentaBBVA: string; baja: string; noSeguroSocial: string; vencimientoContrato: string;
  tipoLicencia: string; vencimientoLicencia: string; vencimientoCredencial: string;
  contactosEmergencia: string; fotoUrl: string;
}

function emptyForm(): FormState {
  return {
    apodo: "", nombre: "", fechaNacimiento: "", curp: "", rfc: "", direccion: "",
    puesto: "", fechaIngreso: "", sueldoBase: "", cuentaBBVA: "", baja: "",
    noSeguroSocial: "", vencimientoContrato: "", tipoLicencia: "E",
    vencimientoLicencia: "", vencimientoCredencial: "", contactosEmergencia: "", fotoUrl: "",
  };
}

function fromOperador(op: Operador): FormState {
  return {
    apodo: op.apodo ?? "", nombre: op.nombre ?? "", fechaNacimiento: op.fechaNacimiento ?? "",
    curp: op.curp ?? "", rfc: op.rfc ?? "", direccion: op.direccion ?? "",
    puesto: op.puesto ?? "", fechaIngreso: op.fechaIngreso ?? "",
    sueldoBase: op.sueldoBase ? String(op.sueldoBase) : "", cuentaBBVA: op.cuentaBBVA ?? "",
    baja: op.baja ?? "", noSeguroSocial: op.noSeguroSocial ?? "",
    vencimientoContrato: op.vencimientoContrato ?? "", tipoLicencia: op.tipoLicencia ?? "E",
    vencimientoLicencia: op.vencimientoLicencia ?? "", vencimientoCredencial: op.vencimientoCredencial ?? "",
    contactosEmergencia: op.contactosEmergencia ?? "", fotoUrl: op.fotoUrl ?? "",
  };
}

// ─── Componentes comunes ──────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ─── Panel de perfil (vista) ──────────────────────────────────────────────────

function InfoRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 w-36 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-900 font-medium flex-1 ${className}`}>{value}</span>
    </div>
  );
}

function EmpleadoProfile({ op, onClose, onEdit }: { op: Operador; onClose: () => void; onEdit: () => void }) {
  const activo = !op.baja;
  const edadAnios = edad(op.fechaNacimiento);
  const antiguedad = diasDesdeIngreso(op.fechaIngreso);

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl overflow-hidden">

        {/* Header con foto */}
        <div className="shrink-0 bg-slate-900 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {op.fotoUrl ? (
                <img src={op.fotoUrl} alt={op.nombre} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center">
                  <HardHat size={32} className="text-amber-400" />
                </div>
              )}
              {activo
                ? <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900" />
                : <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-400 border-2 border-slate-900" />}
            </div>

            {/* Nombre y badges */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg leading-tight truncate">
                {op.apodo && op.apodo !== op.nombre ? op.apodo : op.nombre}
              </p>
              {op.apodo && op.apodo !== op.nombre && (
                <p className="text-slate-400 text-sm truncate mt-0.5">{op.nombre}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {op.puesto && (
                  <span className="text-xs bg-white/10 text-white rounded-full px-2.5 py-1">{op.puesto}</span>
                )}
                {activo
                  ? <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-1 font-semibold">Activo</span>
                  : <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 rounded-full px-2.5 py-1 font-semibold">Baja {formatFecha(op.baja)}</span>}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit}
                className="flex items-center gap-1.5 bg-[#CC2229] hover:bg-[#aa1a20] text-white text-xs font-semibold rounded-xl px-3 py-2 transition-colors cursor-pointer">
                <Pencil size={12} /> Editar
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer p-2">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/8 rounded-xl p-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">{antiguedad.toLocaleString()}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">días ingreso</p>
            </div>
            <div className="bg-white/8 rounded-xl p-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">{edadAnios ?? "—"}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">años</p>
            </div>
            <div className="bg-white/8 rounded-xl p-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">
                {op.sueldoBase ? `$${op.sueldoBase.toLocaleString("es-MX")}` : "—"}
              </p>
              <p className="text-slate-400 text-[10px] mt-0.5">sueldo base</p>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Identificación */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Identificación</p>
            <InfoRow label="Fecha de nacimiento" value={formatFecha(op.fechaNacimiento)} />
            <InfoRow label="Nº Seguro Social" value={op.noSeguroSocial} />
            <InfoRow label="CURP" value={op.curp} className="font-mono text-xs" />
            <InfoRow label="RFC" value={op.rfc} className="font-mono text-xs" />
            <InfoRow label="Dirección" value={op.direccion} />
          </div>

          {/* Laboral */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Laboral</p>
            <InfoRow label="Fecha de ingreso" value={formatFecha(op.fechaIngreso)} />
            <InfoRow label="Cuenta BBVA" value={op.cuentaBBVA} className="font-mono text-xs" />
            {op.vencimientoContrato && (
              <div className="flex items-start gap-3 py-2.5 border-b border-slate-100">
                <span className="text-xs text-slate-400 w-36 shrink-0 pt-0.5">Vto. contrato</span>
                <span className={`text-sm font-medium flex-1 ${vencimientoColorLight(op.vencimientoContrato)}`}>{formatFecha(op.vencimientoContrato)}</span>
              </div>
            )}
          </div>

          {/* Licencia */}
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Licencia y credencial</p>
            <div className="flex items-start gap-3 py-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-400 w-36 shrink-0 pt-0.5">Tipo licencia</span>
              <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-2.5 py-1 text-sm font-bold">
                Tipo {op.tipoLicencia || "—"}
              </span>
            </div>
            {op.vencimientoLicencia && (
              <div className="flex items-start gap-3 py-2.5 border-b border-slate-100">
                <span className="text-xs text-slate-400 w-36 shrink-0 pt-0.5">Vto. licencia</span>
                <span className={`text-sm font-medium flex-1 ${vencimientoColorLight(op.vencimientoLicencia)}`}>{formatFecha(op.vencimientoLicencia)}</span>
              </div>
            )}
            {op.vencimientoCredencial && (
              <div className="flex items-start gap-3 py-2.5">
                <span className="text-xs text-slate-400 w-36 shrink-0 pt-0.5">Vto. credencial</span>
                <span className={`text-sm font-medium flex-1 ${vencimientoColorLight(op.vencimientoCredencial)}`}>{formatFecha(op.vencimientoCredencial)}</span>
              </div>
            )}
          </div>

          {/* Contactos de emergencia */}
          {op.contactosEmergencia && (
            <div className="px-6 py-4 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Contactos de emergencia</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{op.contactosEmergencia}</p>
            </div>
          )}

          {/* Documentos */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Documentos</p>
            {(op.documentos ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">Sin documentos adjuntos</p>
            ) : (
              <div className="space-y-2">
                {(op.documentos ?? []).map((doc) => (
                  <div key={doc.path} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <FileText size={16} className="text-[#CC2229] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{doc.nombre}</p>
                      <p className="text-xs text-slate-400">{formatFecha(doc.fechaSubida)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#CC2229] hover:bg-slate-100 transition-colors cursor-pointer" title="Ver">
                        <ExternalLink size={14} />
                      </a>
                      <a href={doc.url} download={doc.nombre}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Descargar">
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer de edición ────────────────────────────────────────────────────────

function EmpleadoDrawer({ open, editing, onClose, onSave, puestosList }: {
  open: boolean; editing: Operador | null;
  onClose: () => void; onSave: (f: FormState, docs: DocEmpleado[]) => Promise<void>;
  puestosList: string[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [docs, setDocs] = useState<DocEmpleado[]>([]);
  const [saving, setSaving] = useState(false);
  const [nombreError, setNombreError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docNombre, setDocNombre] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromOperador(editing) : emptyForm());
    setDocs(editing?.documentos ? [...editing.documentos] : []);
    setNombreError(false);
    setDocNombre("");
  }, [open, editing]);

  const set = (k: keyof FormState, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "nombre") setNombreError(false);
  };

  const opId = editing?.id ?? `OP-${Date.now()}`;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const path = `operadores/${opId}/foto`;
      const url = await uploadFile(path, file);
      set("fotoUrl", url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[foto upload]", msg);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: `Error al subir la foto: ${msg}` } }));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docNombre.trim()) return;
    setUploadingDoc(true);
    try {
      const ts = Date.now();
      const path = `operadores/${opId}/docs/${ts}_${file.name}`;
      const url = await uploadFile(path, file);
      const newDoc: DocEmpleado = { nombre: docNombre.trim(), url, path, fechaSubida: new Date().toISOString().slice(0, 10) };
      setDocs((prev) => [...prev, newDoc]);
      setDocNombre("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[doc upload]", msg);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: `Error al subir el documento: ${msg}` } }));
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const removeDoc = async (doc: DocEmpleado) => {
    setDocs((prev) => prev.filter((d) => d.path !== doc.path));
    await deleteFile(doc.path);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setNombreError(true); return; }
    setSaving(true);
    try { await onSave(form, docs); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <HardHat size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `Editar — ${editing.apodo || editing.nombre}` : "Nuevo empleado"}
            </h2>
            <p className="text-xs text-gray-500">Solo el nombre es obligatorio</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Foto */}
          <div>
            <SectionDivider label="Foto del empleado" />
            <div className="flex items-center gap-4">
              <div
                onClick={() => photoInputRef.current?.click()}
                className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#CC2229]/60 transition-colors group"
              >
                {form.fotoUrl ? (
                  <img src={form.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <HardHat size={28} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {uploadingPhoto ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {form.fotoUrl ? "Cambiar foto" : "Agregar foto"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WEBP · máx. 5 MB</p>
                <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                  className="mt-2 text-xs text-[#CC2229] font-semibold hover:underline cursor-pointer disabled:opacity-50">
                  {uploadingPhoto ? "Subiendo…" : "Seleccionar archivo"}
                </button>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
          </div>

          {/* Identificación */}
          <div>
            <SectionDivider label="Identificación" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Apodo</label>
                <input type="text" value={form.apodo} onChange={(e) => set("apodo", e.target.value)} placeholder="Ej. El Güero" className={inp} />
              </div>
              <div>
                <label className={lbl}>Nombre completo <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo"
                  className={`${inp} ${nombreError ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`} />
                {nombreError && <p className="text-[11px] text-red-400 mt-1">Campo requerido</p>}
              </div>
              <div>
                <label className={lbl}>Fecha de nacimiento</label>
                <input type="date" value={form.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Nº Seguro Social</label>
                <input type="text" inputMode="numeric" value={form.noSeguroSocial}
                  onChange={(e) => set("noSeguroSocial", e.target.value.replace(/\D/g, ""))} placeholder="12345678901" className={inp} maxLength={11} />
              </div>
              <div>
                <label className={lbl}>CURP</label>
                <input type="text" value={form.curp} onChange={(e) => set("curp", e.target.value.toUpperCase())} placeholder="CURP" className={`${inp} uppercase`} />
              </div>
              <div>
                <label className={lbl}>RFC</label>
                <input type="text" value={form.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} placeholder="RFC" className={`${inp} uppercase`} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Dirección</label>
                <input type="text" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Calle, colonia, municipio" className={inp} />
              </div>
            </div>
          </div>

          {/* Laboral */}
          <div>
            <SectionDivider label="Laboral" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Puesto</label>
                <AppSelect value={form.puesto} onChange={(e) => set("puesto", e.target.value)}>
                  <option value="">Seleccionar puesto</option>
                  {puestosList.map((p) => <option key={p} value={p}>{p}</option>)}
                </AppSelect>
              </div>
              <div>
                <label className={lbl}>Fecha de ingreso</label>
                <input type="date" value={form.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Sueldo base</label>
                <input type="number" min="0" step="100" value={form.sueldoBase} onChange={(e) => set("sueldoBase", e.target.value)} placeholder="0" className={inp} />
              </div>
              <div>
                <label className={lbl}>Cuenta BBVA</label>
                <input type="text" inputMode="numeric" value={form.cuentaBBVA}
                  onChange={(e) => set("cuentaBBVA", e.target.value.replace(/\D/g, ""))} placeholder="Nº de cuenta" className={inp} maxLength={18} />
              </div>
              <div>
                <label className={lbl}>Venc. contrato</label>
                <input type="date" value={form.vencimientoContrato} onChange={(e) => set("vencimientoContrato", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Fecha de baja <span className="normal-case font-normal text-gray-400 text-[9px]">(vacío = activo)</span></label>
                <input type="date" value={form.baja} onChange={(e) => set("baja", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Licencia */}
          <div>
            <SectionDivider label="Licencia y credencial" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Tipo licencia</label>
                <AppSelect value={form.tipoLicencia} onChange={(e) => set("tipoLicencia", e.target.value)}>
                  {TIPOS_LICENCIA.map((t) => <option key={t}>{t}</option>)}
                </AppSelect>
              </div>
              <div>
                <label className={lbl}>Venc. licencia</label>
                <input type="date" value={form.vencimientoLicencia} onChange={(e) => set("vencimientoLicencia", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Venc. credencial</label>
                <input type="date" value={form.vencimientoCredencial} onChange={(e) => set("vencimientoCredencial", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Emergencia */}
          <div>
            <SectionDivider label="Contactos de emergencia" />
            <textarea value={form.contactosEmergencia} onChange={(e) => set("contactosEmergencia", e.target.value)}
              rows={3} placeholder={"Juan García - 81 1234 5678\nMaría López - 81 9876 5432"}
              className={`${inp} resize-none`} />
          </div>

          {/* Documentos PDF */}
          <div>
            <SectionDivider label="Papelería (PDFs)" />

            {/* Documentos existentes */}
            {docs.length > 0 && (
              <div className="space-y-2 mb-4">
                {docs.map((doc) => (
                  <div key={doc.path} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <FileText size={14} className="text-[#CC2229] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.nombre}</p>
                      <p className="text-xs text-gray-400">{formatFecha(doc.fechaSubida)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                        <ExternalLink size={13} />
                      </a>
                      <button onClick={() => void removeDoc(doc)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nuevo documento */}
            <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-500 font-medium">Agregar documento PDF</p>
              <div>
                <label className={lbl}>Nombre del documento</label>
                <input type="text" value={docNombre} onChange={(e) => setDocNombre(e.target.value)}
                  placeholder="Ej. Contrato 2026, INE, Comprobante domicilio…" className={inp} />
              </div>
              <button
                onClick={() => docNombre.trim() && docInputRef.current?.click()}
                disabled={!docNombre.trim() || uploadingDoc}
                className="flex items-center gap-2 w-full justify-center border border-gray-200 hover:border-[#CC2229]/50 text-gray-600 hover:text-[#CC2229] rounded-xl py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                {uploadingDoc ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                {uploadingDoc ? "Subiendo…" : "Seleccionar PDF"}
              </button>
              <input ref={docInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleDocChange} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.nombre.trim() || uploadingPhoto || uploadingDoc}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear empleado"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmpleadosPage() {
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<"Todos" | "Activos" | "Baja" | "DocsVencer">("Activos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Operador | null>(null);
  const [profileOp, setProfileOp] = useState<Operador | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Operador | null>(null);
  const [puestosList, setPuestosList] = useState<string[]>(DEFAULT_PUESTOS);
  const [showPuestosModal, setShowPuestosModal] = useState(false);
  const [puestosListDraft, setPuestosListDraft] = useState<string[]>([]);
  const [nuevoPuesto, setNuevoPuesto] = useState("");
  const [savingPuestos, setSavingPuestos] = useState(false);
  const [duplicateWarn, setDuplicateWarn] = useState<{ field: string; value: string; detail?: string; proceed: () => void } | null>(null);

  useEffect(() => {
    getDocument<{ lista: string[] }>(COLLECTIONS.configuracion, "puestos").then((doc) => {
      if (doc?.lista?.length) setPuestosList(doc.lista);
    });
  }, []);

  useEffect(() => {
    if (!loading) { setLoadingLong(false); return; }
    const t = setTimeout(() => setLoadingLong(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const unsub = subscribeToCollection<Operador>(COLLECTIONS.operadores, (ops) => {
      const seen = new Set<string>();
      setOperadores(ops.filter((op) => { if (seen.has(op.id)) return false; seen.add(op.id); return true; }));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => operadores.filter((op) => {
    const matchQuery = matchesQuery(query, [op.nombre, op.apodo, op.puesto, op.rfc, op.curp, op.noSeguroSocial]);
    const limite90 = Date.now() + 90 * 86400000;
    const tieneDocVencer = !op.baja && [op.vencimientoLicencia, op.vencimientoCredencial, op.vencimientoContrato].some(
      (f) => f && new Date(f).getTime() <= limite90
    );
    const matchFiltro = filtro === "Todos" || (filtro === "Activos" && !op.baja) || (filtro === "Baja" && !!op.baja) || (filtro === "DocsVencer" && tieneDocVencer);
    return matchQuery && matchFiltro;
  }), [operadores, query, filtro]);

  const totalActivos = operadoresActivos(operadores);
  const totalBaja    = operadores.filter((op) => !!op.baja).length;
  const porVencer    = docsProximos(operadores);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(op: Operador) { setEditing(op); setProfileOp(null); setShowForm(true); }
  function openProfile(op: Operador) { setProfileOp(op); }

  function openPuestosModal() { setPuestosListDraft([...puestosList]); setNuevoPuesto(""); setShowPuestosModal(true); }
  function addPuesto() {
    const val = nuevoPuesto.trim().toUpperCase();
    if (!val || puestosListDraft.includes(val)) return;
    setPuestosListDraft((prev) => [...prev, val].sort());
    setNuevoPuesto("");
  }

  async function savePuestos() {
    const pendingVal = nuevoPuesto.trim().toUpperCase();
    const base = (pendingVal && !puestosListDraft.includes(pendingVal)) ? [...puestosListDraft, pendingVal].sort() : puestosListDraft;
    setSavingPuestos(true);
    try {
      await upsertDocument(COLLECTIONS.configuracion, "puestos", { lista: base });
      setPuestosList(base); setPuestosListDraft(base); setNuevoPuesto(""); setShowPuestosModal(false);
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "No se pudo guardar el catálogo." } }));
    } finally { setSavingPuestos(false); }
  }

  async function handleDelete(op: Operador) {
    setOperadores((c) => c.filter((x) => x.id !== op.id));
    await deleteDocument(COLLECTIONS.operadores, op.id);
    setConfirmDelete(null);
    if (profileOp?.id === op.id) setProfileOp(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `${op.apodo || op.nombre} eliminado.` } }));
  }

  async function handleSave(f: FormState, docs: DocEmpleado[], force = false) {
    if (!force && !editing) {
      const norm = normalizeKey(f.nombre);
      const dup = operadores.find((op) => normalizeKey(op.nombre) === norm);
      if (dup) {
        setDuplicateWarn({ field: "Nombre del empleado", value: f.nombre.trim(), detail: dup.puesto || undefined, proceed: () => { setDuplicateWarn(null); void handleSave(f, docs, true); } });
        return;
      }
    }
    const id = editing?.id ?? `OP-${Date.now()}`;
    const next: Operador = {
      id, apodo: f.apodo.trim(), nombre: f.nombre.trim(),
      fechaNacimiento: f.fechaNacimiento, curp: f.curp.trim(), rfc: f.rfc.trim(),
      direccion: f.direccion.trim(), puesto: f.puesto.trim(), fechaIngreso: f.fechaIngreso,
      sueldoBase: Number(f.sueldoBase) || 0, cuentaBBVA: f.cuentaBBVA.trim(),
      baja: f.baja, noSeguroSocial: f.noSeguroSocial.trim(),
      vencimientoContrato: f.vencimientoContrato, tipoLicencia: f.tipoLicencia,
      vencimientoLicencia: f.vencimientoLicencia, vencimientoCredencial: f.vencimientoCredencial,
      contactosEmergencia: f.contactosEmergencia.trim(),
      fotoUrl: f.fotoUrl || undefined,
      documentos: docs.length > 0 ? docs : undefined,
    };
    const { id: _id, ...data } = next;
    try {
      await upsertDocument(COLLECTIONS.operadores, _id, data);
      if (profileOp?.id === id) setProfileOp(next);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: editing ? "Empleado actualizado." : "Empleado creado." } }));
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al guardar. Verifica tu conexión." } }));
    }
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([content], { type: mimeType })), download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function exportExcel() {
    const rows = operadores.map((op) =>
      `<tr><td>${op.apodo}</td><td>${op.nombre}</td><td>${op.puesto}</td><td>${op.fechaIngreso}</td>
      <td>${op.sueldoBase}</td><td>${op.baja || "Activo"}</td><td>${op.cuentaBBVA}</td>
      <td>${op.fechaNacimiento}</td><td>${op.curp}</td><td>${op.rfc}</td>
      <td>${op.noSeguroSocial}</td><td>${op.tipoLicencia}</td><td>${op.vencimientoLicencia}</td>
      <td>${op.vencimientoCredencial}</td><td>${op.vencimientoContrato}</td>
      <td>${diasDesdeIngreso(op.fechaIngreso)}</td></tr>`
    ).join("");
    downloadFile("empleados-duro-concretos.xls",
      `<html><head><meta charset="UTF-8"/></head><body><table>
      <thead><tr><th>Apodo</th><th>Nombre</th><th>Puesto</th><th>Fecha ingreso</th>
      <th>Sueldo base</th><th>Baja</th><th>Cuenta BBVA</th><th>Fecha nacimiento</th>
      <th>CURP</th><th>RFC</th><th>Nº IMSS</th><th>Tipo lic.</th><th>Vto. licencia</th>
      <th>Vto. credencial</th><th>Vto. contrato</th><th>Días ingreso</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  function exportPDF() {
    const rows = operadores.map((op) =>
      `<tr><td>${op.apodo || op.nombre}</td><td>${op.nombre}</td><td>${op.puesto}</td>
      <td>${op.fechaIngreso}</td><td>$${op.sueldoBase.toLocaleString()}</td>
      <td>${op.tipoLicencia} · ${formatFecha(op.vencimientoLicencia)}</td>
      <td>${op.baja ? `Baja ${formatFecha(op.baja)}` : "Activo"}</td></tr>`
    ).join("");
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Empleados</title>
      <style>body{font-family:Arial;padding:24px;color:#111}h1{margin:0 0 4px;font-size:22px}
      p{margin:0 0 18px;color:#6B7280;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#111;color:#fff;text-align:left;padding:8px}
      td{border-bottom:1px solid #E5E7EB;padding:8px}@media print{button{display:none}}</style>
      </head><body>
      <h1>Registro de Empleados</h1>
      <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
      <table><thead><tr><th>Apodo</th><th>Nombre</th><th>Puesto</th><th>Ingreso</th>
      <th>Sueldo</th><th>Licencia</th><th>Estatus</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total empleados"  value={String(operadores.length)} icon={Users}     active={filtro === "Todos"}      onClick={() => setFiltro("Todos")} />
        <KPICard title="Activos"          value={String(totalActivos)}       icon={UserCheck} iconColor="text-green-400"  iconBg="bg-green-500/10"  active={filtro === "Activos"}     onClick={() => setFiltro("Activos")} />
        <KPICard title="Dados de baja"    value={String(totalBaja)}          icon={UserMinus} iconColor="text-red-400"    iconBg="bg-red-500/10"    active={filtro === "Baja"}        onClick={() => setFiltro("Baja")} />
        <KPICard title="Docs por vencer"  value={String(porVencer)}          icon={AlertCircle}
          iconColor={porVencer > 0 ? "text-amber-400" : "text-green-400"}
          iconBg={porVencer > 0 ? "bg-amber-500/10" : "bg-green-500/10"}
          subtitle="Licencia, credencial o contrato"
          active={filtro === "DocsVencer"} onClick={() => setFiltro("DocsVencer")} />
      </div>

      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, apodo, puesto, RFC, CURP..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600" />
        </div>
        <AppSelect dark value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="Todos">Todos</option>
          <option value="Activos">Activos</option>
          <option value="Baja">Dados de baja</option>
          <option value="DocsVencer">Docs por vencer</option>
        </AppSelect>
        <span className="text-xs text-gray-500">{filtered.length} empleados</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={openPuestosModal} title="Gestionar catálogo de puestos"
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer">
            <Settings2 size={15} /> Puestos
          </button>
          <button type="button" onClick={exportExcel}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors cursor-pointer">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button type="button" onClick={exportPDF}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-[#CC2229] transition-colors cursor-pointer">
            <FileText size={15} /> PDF
          </button>
          <PlantaRequired>
            {(ok) => (
              <button onClick={() => ok && openCreate()} disabled={!ok}
                className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ok ? "hover:bg-[#991A1E] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                <Plus size={15} /> Nuevo empleado
              </button>
            )}
          </PlantaRequired>
        </div>
      </div>

      {/* Tabla */}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Empleado", "Puesto", "Días ingreso", "Sueldo base", "Licencia", "Vto. credencial", "Vto. contrato", "Estatus", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-0">
                    <EmptyState type={operadores.length === 0 ? "empty" : "no-results"}
                      action={operadores.length === 0 ? { label: "Crear primer empleado", onClick: openCreate } : undefined} dark />
                  </td></tr>
                ) : filtered.map((op) => {
                  const dias   = diasDesdeIngreso(op.fechaIngreso);
                  const activo = !op.baja;
                  const isSelected = profileOp?.id === op.id;
                  return (
                    <tr key={op.id}
                      onClick={() => openProfile(op)}
                      className={`transition-colors cursor-pointer ${!activo ? "opacity-60" : ""} ${isSelected ? "bg-[#CC2229]/8 border-l-2 border-l-[#CC2229]" : "hover:bg-[#2A2A2A]"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {op.fotoUrl ? (
                            <img src={op.fotoUrl} alt={op.nombre} className="h-8 w-8 rounded-full object-cover shrink-0 border border-[#3A3A3A]" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                              <HardHat size={14} className="text-amber-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium whitespace-nowrap">{op.apodo || op.nombre}</p>
                            {op.apodo && <p className="text-gray-500 text-xs whitespace-nowrap">{op.nombre}</p>}
                          </div>
                          {(op.documentos ?? []).length > 0 && (
                            <span title={`${op.documentos!.length} documento(s)`} className="flex items-center gap-0.5 text-[10px] text-gray-600">
                              <Paperclip size={9} />{op.documentos!.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-300 whitespace-nowrap text-xs">{op.puesto || <span className="text-gray-600">—</span>}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-white font-semibold tabular-nums">{dias.toLocaleString()}</span>
                        <span className="text-gray-600 text-xs ml-1">días</span>
                      </td>
                      <td className="px-5 py-3 text-gray-200 whitespace-nowrap tabular-nums">
                        {op.sueldoBase ? `$${op.sueldoBase.toLocaleString("es-MX")}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {op.tipoLicencia && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-300 mr-1.5">{op.tipoLicencia}</span>}
                        <span className={`text-xs ${vencimientoColor(op.vencimientoLicencia)}`}>{formatFecha(op.vencimientoLicencia)}</span>
                      </td>
                      <td className={`px-5 py-3 text-xs whitespace-nowrap ${vencimientoColor(op.vencimientoCredencial)}`}>{formatFecha(op.vencimientoCredencial)}</td>
                      <td className={`px-5 py-3 text-xs whitespace-nowrap ${vencimientoColor(op.vencimientoContrato)}`}>{formatFecha(op.vencimientoContrato)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {activo
                          ? <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Activo</span>
                          : <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">Baja {formatFecha(op.baja)}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(op)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setConfirmDelete(op)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Catálogo puestos */}
      {showPuestosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Catálogo de puestos</h2>
              <button onClick={() => setShowPuestosModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
              {puestosListDraft.map((p) => (
                <div key={p} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-800 font-mono">{p}</span>
                  <button onClick={() => setPuestosListDraft((prev) => prev.filter((x) => x !== p))} className="text-gray-400 hover:text-red-500 cursor-pointer"><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 flex gap-2">
              <input type="text" value={nuevoPuesto} onChange={(e) => setNuevoPuesto(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addPuesto()} placeholder="Nuevo puesto…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 uppercase focus:outline-none focus:ring-1 focus:ring-[#CC2229]/40" />
              <button onClick={addPuesto} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 cursor-pointer"><Plus size={15} /></button>
            </div>
            <div className="px-5 pb-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button onClick={() => setShowPuestosModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">Cancelar</button>
              <button onClick={() => void savePuestos()} disabled={savingPuestos}
                className="px-4 py-2 text-sm font-medium bg-[#CC2229] text-white rounded-lg hover:bg-[#B01E24] disabled:opacity-50 cursor-pointer">
                {savingPuestos ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de perfil */}
      {profileOp && (
        <EmpleadoProfile
          op={profileOp}
          onClose={() => setProfileOp(null)}
          onEdit={() => openEdit(profileOp)}
        />
      )}

      {/* Drawer de edición */}
      <EmpleadoDrawer
        open={showForm} editing={editing}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave} puestosList={puestosList}
      />

      {duplicateWarn && (
        <DuplicateWarningModal field={duplicateWarn.field} value={duplicateWarn.value} detail={duplicateWarn.detail}
          onCancel={() => setDuplicateWarn(null)} onConfirm={duplicateWarn.proceed} />
      )}

      {/* Confirmación eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">¿Eliminar empleado?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminará <strong>{confirmDelete.apodo || confirmDelete.nombre}</strong> de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">Cancelar</button>
              <button onClick={() => void handleDelete(confirmDelete)} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
