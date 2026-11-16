"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Bug, CheckCircle2, ChevronDown, ChevronUp,
  CircleDot, Clock, HelpCircle, ImagePlus, MessageSquarePlus, Plus,
  Send, Sparkles, Tag, Ticket, X,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  COLLECTIONS, getCollectionDocs, upsertDocument,
  type Ticket as TicketDoc, type TicketStatus,
} from "@/lib/db";
import { getStoredSession, DEVELOPER_EMAIL, moduleCatalog } from "@/lib/auth";
import AppSelect from "@/components/AppSelect";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_META: Record<TicketDoc["tipo"], { label: string; icon: React.ElementType; cls: string }> = {
  bug:      { label: "Bug",        icon: Bug,            cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  mejora:   { label: "Mejora",     icon: Sparkles,       cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  pregunta: { label: "Pregunta",   icon: HelpCircle,     cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  otro:     { label: "Otro",       icon: Tag,            cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

const PRIORIDAD_META: Record<TicketDoc["prioridad"], { label: string; cls: string }> = {
  baja:     { label: "Baja",     cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  media:    { label: "Media",    cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  alta:     { label: "Alta",     cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  "crítica": { label: "Crítica", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const STATUS_META: Record<TicketStatus, { label: string; icon: React.ElementType; cls: string }> = {
  "abierto":    { label: "Abierto",     icon: CircleDot,    cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  "en-proceso": { label: "En proceso",  icon: Clock,        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  "resuelto":   { label: "Resuelto",    icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  "cerrado":    { label: "Cerrado",     icon: X,            cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function newId() {
  return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── NuevoTicketDrawer ────────────────────────────────────────────────────────

// ─── Grupos de módulos para el selector ───────────────────────────────────────

const MODULE_GROUPS = [
  { grupo: "Inicio", items: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/reportes",  label: "Reportes gerenciales" },
  ]},
  { grupo: "Programación", items: [
    { href: "/transporte/programacion",      label: "Programación" },
    { href: "/transporte/programacion-live", label: "Prog. en tiempo real" },
    { href: "/ventas/recibos-concreto",      label: "Recibos de Concreto" },
    { href: "/ventas/remisiones",            label: "Remisiones" },
  ]},
  { grupo: "Transporte", items: [
    { href: "/transporte/flota-en-vivo",         label: "Flota en vivo GPS" },
    { href: "/transporte/verificacion-viajes",   label: "Verificación de viajes" },
    { href: "/transporte/geocercas",             label: "Geocercas Samsara" },
    { href: "/transporte/seguros",               label: "Seguros de Flota" },
    { href: "/transporte/diesel",                label: "Consumo de Diésel" },
    { href: "/transporte/mantenimiento",         label: "Mantenimiento" },
  ]},
  { grupo: "Ventas & CRM", items: [
    { href: "/crm/clientes",        label: "Base de Clientes" },
    { href: "/crm/pipeline",        label: "Pipeline CRM" },
    { href: "/ventas/programacion", label: "Programación Ventas" },
    { href: "/ventas/obras",        label: "Catálogo de Obras" },
    { href: "/ventas/productos",    label: "Productos" },
  ]},
  { grupo: "Finanzas", items: [
    { href: "/facturacion",                      label: "Facturación CFDI" },
    { href: "/finanzas/cxc",                     label: "Cuentas por Cobrar" },
    { href: "/finanzas/cxp",                     label: "Cuentas por Pagar" },
    { href: "/finanzas/cobros",                  label: "Cobros" },
    { href: "/finanzas/estado-cuenta-clientes",  label: "Estados de Cuenta" },
  ]},
  { grupo: "Operaciones", items: [
    { href: "/operaciones/inventario", label: "Inventarios" },
    { href: "/operaciones/caja-chica", label: "Caja Chica" },
  ]},
  { grupo: "Recursos Humanos", items: [
    { href: "/transporte/operadores",         label: "Empleados" },
    { href: "/recursos-humanos/asistencia",   label: "Control de Asistencia" },
    { href: "/recursos-humanos/nomina",       label: "Nómina" },
  ]},
  { grupo: "Sistema", items: [
    { href: "/configuracion", label: "Configuración" },
    { href: "/soporte",       label: "Soporte técnico" },
  ]},
] as const;

function getModuloLabel(href: string) {
  for (const g of MODULE_GROUPS) {
    const item = g.items.find((i) => i.href === href);
    if (item) return item.label;
  }
  const found = moduleCatalog.find((m) => m.href === href);
  return found?.label ?? href;
}

const SYS_LABELS: Record<string, string> = {
  navegador: "Navegador",
  so:        "Sistema operativo",
  pantalla:  "Resolución pantalla",
  viewport:  "Tamaño ventana",
  zona:      "Zona horaria",
  conexion:  "Conexión",
  idioma:    "Idioma",
};

function collectSistemaInfo(): Record<string, string> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return {};
  const ua = navigator.userAgent;

  // Navegador + versión
  let navegador = "Desconocido";
  const edgeM   = ua.match(/Edg\/(\d+)/);
  const chromeM = ua.match(/Chrome\/(\d+)/);
  const ffM     = ua.match(/Firefox\/(\d+)/);
  const safM    = ua.match(/Version\/(\d+).*Safari/);
  if (edgeM)                            navegador = `Edge ${edgeM[1]}`;
  else if (chromeM && !ua.includes("Chromium")) navegador = `Chrome ${chromeM[1]}`;
  else if (ffM)                         navegador = `Firefox ${ffM[1]}`;
  else if (safM)                        navegador = `Safari ${safM[1]}`;

  // Sistema operativo
  let so = "Desconocido";
  if (/iPhone/.test(ua))       so = "iPhone (iOS)";
  else if (/iPad/.test(ua))    so = "iPad (iPadOS)";
  else if (/Android/.test(ua)) so = `Android ${ua.match(/Android ([0-9.]+)/)?.[1] ?? ""}`.trim();
  else if (/Windows NT 10/.test(ua)) so = "Windows 10/11";
  else if (/Windows/.test(ua)) so = "Windows";
  else if (/Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([0-9_]+)/)?.[1]?.replace(/_/g, ".");
    so = v ? `macOS ${v}` : "macOS";
  }
  else if (/Linux/.test(ua))   so = "Linux";

  // Pantalla y viewport
  const pantalla = `${window.screen.width} × ${window.screen.height} px`;
  const viewport = `${window.innerWidth} × ${window.innerHeight} px`;

  // Zona horaria
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Conexión
  type NavConn = { effectiveType?: string; type?: string };
  const conn = (navigator as unknown as { connection?: NavConn }).connection;
  const online = navigator.onLine ? "En línea" : "Sin conexión";
  const conexion = conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} · ${online}` : online;

  // Idioma
  const idioma = navigator.language;

  return { navegador, so, pantalla, viewport, zona, conexion, idioma };
}

async function uploadAttachments(files: File[], ticketId: string): Promise<string[]> {
  if (!storage || files.length === 0) return [];
  const urls: string[] = [];
  for (const file of files) {
    const path = `tickets/${ticketId}/${Date.now()}_${file.name}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, file);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

// ─── NuevoTicketDrawer ────────────────────────────────────────────────────────

function NuevoTicketDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (t: Omit<TicketDoc, "id">) => Promise<void>;
}) {
  const [tipo,    setTipo]    = useState<TicketDoc["tipo"]>("bug");
  const [titulo,  setTitulo]  = useState("");
  const [desc,    setDesc]    = useState("");
  const [prio,    setPrio]    = useState<TicketDoc["prioridad"]>("media");
  const [modulo,  setModulo]  = useState("");
  const [pasos,   setPasos]   = useState("");
  const [files,    setFiles]    = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sysInfo,  setSysInfo]  = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const fileInputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTipo("bug"); setTitulo(""); setDesc(""); setPrio("media");
    setModulo(window.location.pathname);
    setPasos(""); setFiles([]); setPreviews([]); setError("");
    setSysInfo(collectSistemaInfo());
  }, [open]);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const incoming = Array.from(selected).slice(0, 3 - files.length);
    setFiles((p) => [...p, ...incoming]);
    incoming.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }

  function removeFile(i: number) {
    setFiles((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    if (!desc.trim())   { setError("La descripción es obligatoria."); return; }
    setSaving(true);
    try {
      const tempId   = newId();
      const adjuntos = await uploadAttachments(files, tempId);
      await onSave({
        tipo,
        titulo:      titulo.trim(),
        descripcion: desc.trim(),
        prioridad:   prio,
        modulo:      modulo || window.location.pathname,
        ...(pasos.trim() && { pasos: pasos.trim() }),
        ...(adjuntos.length > 0 && { adjuntos }),
        navegador:   sysInfo.navegador ?? "—",
        sistemaInfo: sysInfo,
        status:      "abierto",
        creadoEn:    new Date().toISOString(),
        ruta:        window.location.pathname,
      } as Omit<TicketDoc, "id">);
      onClose();
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ colorScheme: "light" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#CC2229]/10 flex items-center justify-center">
              <MessageSquarePlus size={16} className="text-[#CC2229]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 leading-tight">Nuevo ticket de soporte</h2>
              <p className="text-[11px] text-gray-400 leading-tight">Tu solicitud llegará al equipo de desarrollo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de solicitud</label>
              <AppSelect value={tipo} onChange={(e) => setTipo(e.target.value as TicketDoc["tipo"])}>
                <option value="bug">Bug / Error</option>
                <option value="mejora">Mejora / Feature</option>
                <option value="pregunta">Pregunta</option>
                <option value="otro">Otro</option>
              </AppSelect>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prioridad</label>
              <AppSelect value={prio} onChange={(e) => setPrio(e.target.value as TicketDoc["prioridad"])}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="crítica">Crítica</option>
              </AppSelect>
            </div>
          </div>

          {/* Módulo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Módulo donde ocurrió <span className="font-normal text-gray-400">(auto-detectado)</span>
            </label>
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229] cursor-pointer"
            >
              <option value="">— Selecciona el módulo —</option>
              {MODULE_GROUPS.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map((item) => (
                    <option key={item.href} value={item.href}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Título del problema <span className="text-red-500">*</span>
            </label>
            <input
              value={titulo}
              onChange={(e) => { setTitulo(e.target.value); setError(""); }}
              placeholder="Ej: No se puede guardar una programación del día…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Descripción detallada <span className="text-red-500">*</span>
            </label>
            <textarea
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setError(""); }}
              rows={4}
              placeholder="Explica qué estabas haciendo, qué esperabas que pasara y qué ocurrió en cambio."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229] resize-none"
            />
          </div>

          {/* Pasos para reproducir — solo para bugs y preguntas */}
          {(tipo === "bug" || tipo === "pregunta") && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Pasos para reproducir <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={pasos}
                onChange={(e) => setPasos(e.target.value)}
                rows={3}
                placeholder={"1. Ir a Programación\n2. Hacer clic en 'Nueva programación'\n3. El sistema muestra error…"}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229] resize-none"
              />
            </div>
          )}

          {/* Adjuntar imágenes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Adjuntar imágenes / capturas <span className="text-gray-400 font-normal">(máx. 3)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group cursor-default">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {files.length < 3 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#CC2229] hover:bg-red-50/50 transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus size={20} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-semibold">Adjuntar</span>
                </button>
              )}
            </div>
          </div>

          {/* Info del sistema — auto-detectada */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Info del sistema (automática)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {Object.entries(sysInfo).map(([key, val]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{SYS_LABELS[key] ?? key}</span>
                  <span className="text-xs text-gray-700 truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-[11px] text-gray-400">El equipo responderá en el menor tiempo posible</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Send size={14} />
              {saving ? (files.length > 0 ? "Subiendo…" : "Enviando…") : "Enviar ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ResponderDrawer ──────────────────────────────────────────────────────────

function ResponderDrawer({
  ticket,
  onClose,
  onSave,
}: {
  ticket: TicketDoc | null;
  onClose: () => void;
  onSave: (id: string, respuesta: string, status: TicketStatus) => Promise<void>;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [status, setStatus]       = useState<TicketStatus>("resuelto");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setRespuesta(ticket.respuesta ?? "");
    setStatus(ticket.status === "abierto" || ticket.status === "en-proceso" ? "resuelto" : ticket.status);
  }, [ticket]);

  async function handleSave() {
    if (!ticket?.id) return;
    setSaving(true);
    try { await onSave(ticket.id, respuesta, status); onClose(); }
    finally { setSaving(false); }
  }

  if (!ticket) return null;
  const TipoIcon = TIPO_META[ticket.tipo].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ colorScheme: 'light' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TipoIcon size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 truncate max-w-[320px]">{ticket.titulo}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Descripción */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">Descripción del usuario</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-center">
              <p className="text-gray-400 mb-0.5">Autor</p>
              <p className="font-semibold text-gray-700 truncate">{ticket.autorNombre || ticket.autorEmail}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-center">
              <p className="text-gray-400 mb-0.5">Planta</p>
              <p className="font-semibold text-gray-700">{ticket.planta ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-center">
              <p className="text-gray-400 mb-0.5">Ruta</p>
              <p className="font-semibold text-gray-700 truncate">{ticket.ruta ?? "—"}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Respuesta / Resolución</label>
            <textarea
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={4}
              placeholder="Escribe aquí la respuesta para el usuario…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cambiar estado a</label>
            <AppSelect value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
              <option value="en-proceso">En proceso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </AppSelect>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Send size={14} />
            {saving ? "Guardando…" : "Guardar respuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  isDev,
  onResponder,
}: {
  ticket: TicketDoc;
  isDev: boolean;
  onResponder?: (t: TicketDoc) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const TipoIcon   = TIPO_META[ticket.tipo].icon;
  const StatusIcon = STATUS_META[ticket.status].icon;

  return (
    <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
      {/* Row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="mt-0.5 shrink-0">
          <TipoIcon size={16} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{ticket.titulo}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIPO_META[ticket.tipo].cls}`}>
              {TIPO_META[ticket.tipo].label}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_META[ticket.prioridad].cls}`}>
              {PRIORIDAD_META[ticket.prioridad].label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_META[ticket.status].cls}`}>
              <StatusIcon size={10} />
              {STATUS_META[ticket.status].label}
            </span>
            <span className="text-xs text-gray-500">{fmtDate(ticket.creadoEn)}</span>
            {isDev && <span className="text-xs text-gray-600">{ticket.autorNombre || ticket.autorEmail}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="mt-1 text-gray-500 shrink-0" /> : <ChevronDown size={14} className="mt-1 text-gray-500 shrink-0" />}
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-4">

          {/* Descripción */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Descripción</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
          </div>

          {/* Pasos para reproducir */}
          {ticket.pasos && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Pasos para reproducir</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{ticket.pasos}</p>
            </div>
          )}

          {/* Adjuntos */}
          {ticket.adjuntos && ticket.adjuntos.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Capturas adjuntas</p>
              <div className="flex flex-wrap gap-2">
                {ticket.adjuntos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-28 h-28 rounded-xl overflow-hidden border border-gray-200 hover:border-[#CC2229] transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Adjunto ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { label: "Autor",    val: ticket.autorNombre || ticket.autorEmail },
              { label: "Módulo",   val: ticket.modulo ? getModuloLabel(ticket.modulo) : (ticket.ruta ?? "—") },
              { label: "Planta",   val: ticket.planta ?? "—" },
              { label: "Navegador", val: ticket.navegador ?? "—" },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-gray-400 mb-0.5 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
                <p className="font-semibold text-gray-700 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Respuesta del dev */}
          {ticket.respuesta && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Respuesta del equipo</p>
              <p className="text-sm text-emerald-800 whitespace-pre-wrap">{ticket.respuesta}</p>
              {ticket.resueltaEn && (
                <p className="text-[10px] text-emerald-600 mt-2">{fmtDate(ticket.resueltaEn)}</p>
              )}
            </div>
          )}

          {isDev && onResponder && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => onResponder(ticket)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] transition-colors cursor-pointer"
              >
                <Send size={12} /> Responder / Actualizar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SoportePage() {
  const session = getStoredSession();
  const isDev   = session?.email === DEVELOPER_EMAIL;

  const [tickets, setTickets]       = useState<TicketDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [responding, setResponding] = useState<TicketDoc | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<TicketStatus | "todos">("todos");
  const [filtroTipo, setFiltroTipo]     = useState<TicketDoc["tipo"] | "todos">("todos");

  useEffect(() => {
    getCollectionDocs<TicketDoc>(COLLECTIONS.tickets)
      .then((docs) => setTickets(docs.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""))))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    let list = isDev ? tickets : tickets.filter((t) => t.autorEmail === session?.email);
    if (filtroStatus !== "todos") list = list.filter((t) => t.status === filtroStatus);
    if (filtroTipo   !== "todos") list = list.filter((t) => t.tipo === filtroTipo);
    return list;
  }, [tickets, filtroStatus, filtroTipo, isDev, session?.email]);

  const stats = useMemo(() => ({
    abiertos:   tickets.filter((t) => t.status === "abierto").length,
    enProceso:  tickets.filter((t) => t.status === "en-proceso").length,
    resueltos:  tickets.filter((t) => t.status === "resuelto").length,
    total:      tickets.length,
  }), [tickets]);

  async function handleNuevoTicket(data: Omit<TicketDoc, "id">) {
    const id = newId();
    const doc: Omit<TicketDoc, "id"> = {
      ...data,
      autorEmail:  session?.email  ?? "",
      autorNombre: session?.name   ?? "",
      planta: (session as { plantaActiva?: string })?.plantaActiva ?? undefined,
    };
    await upsertDocument(COLLECTIONS.tickets, id, doc);
    setTickets((prev) => [{ id, ...doc }, ...prev]);

    // Notificación por email — fire-and-forget
    fetch("/api/soporte", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...doc, id }),
    }).catch(() => {/* silent */});
  }

  async function handleResponder(id: string, respuesta: string, status: TicketStatus) {
    const now = new Date().toISOString();
    const patch = { respuesta, status, resueltoPor: session?.email ?? "", resueltaEn: now, actualizadoEn: now };
    await upsertDocument(COLLECTIONS.tickets, id, patch);
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket size={20} className="text-[#CC2229]" />
            Soporte técnico
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isDev ? "Bandeja de tickets de todos los usuarios" : "Reporta errores o solicita mejoras al desarrollador"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] transition-colors cursor-pointer"
        >
          <Plus size={15} /> Nuevo ticket
        </button>
      </div>

      {/* ── KPIs (solo dev) ────────────────────────────────────────────────── */}
      {isDev && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",      val: stats.total,     cls: "text-white" },
            { label: "Abiertos",   val: stats.abiertos,  cls: "text-sky-400" },
            { label: "En proceso", val: stats.enProceso, cls: "text-amber-400" },
            { label: "Resueltos",  val: stats.resueltos, cls: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-[#242424] border border-[#3A3A3A] rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(["todos", "abierto", "en-proceso", "resuelto", "cerrado"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
              filtroStatus === s
                ? "bg-[#CC2229] text-white border-[#CC2229]"
                : "bg-[#242424] text-gray-400 border-[#3A3A3A] hover:text-white hover:border-gray-500"
            }`}
          >
            {s === "todos" ? "Todos" : STATUS_META[s].label}
          </button>
        ))}
        <div className="ml-auto">
          <AppSelect
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TicketDoc["tipo"] | "todos")}
          >
            <option value="todos">Todos los tipos</option>
            <option value="bug">Bug</option>
            <option value="mejora">Mejora</option>
            <option value="pregunta">Pregunta</option>
            <option value="otro">Otro</option>
          </AppSelect>
        </div>
      </div>

      {/* ── Lista de tickets ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin h-7 w-7 rounded-full border-2 border-[#CC2229] border-t-transparent" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket size={32} className="mb-3 text-gray-600" />
          <p className="text-sm text-gray-500">
            {tickets.length === 0 ? "No hay tickets todavía." : "Sin resultados con los filtros actuales."}
          </p>
          {tickets.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#CC2229] text-white rounded-xl hover:bg-[#B01E24] transition-colors cursor-pointer"
            >
              <Plus size={14} /> Crear primer ticket
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              isDev={isDev}
              onResponder={isDev ? setResponding : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Drawers ─────────────────────────────────────────────────────────── */}
      <NuevoTicketDrawer open={showForm} onClose={() => setShowForm(false)} onSave={handleNuevoTicket} />
      <ResponderDrawer ticket={responding} onClose={() => setResponding(null)} onSave={handleResponder} />
    </div>
  );
}
