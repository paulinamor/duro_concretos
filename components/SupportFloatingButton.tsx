"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertCircle, CheckCircle2, Headphones, ImagePlus,
  MessageSquarePlus, Send, X,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { COLLECTIONS, upsertDocument, type Ticket as TicketDoc } from "@/lib/db";
import { getStoredSession, moduleCatalog } from "@/lib/auth";
import AppSelect from "@/components/AppSelect";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

  let navegador = "Desconocido";
  const edgeM   = ua.match(/Edg\/(\d+)/);
  const chromeM = ua.match(/Chrome\/(\d+)/);
  const ffM     = ua.match(/Firefox\/(\d+)/);
  const safM    = ua.match(/Version\/(\d+).*Safari/);
  if (edgeM)                                    navegador = `Edge ${edgeM[1]}`;
  else if (chromeM && !ua.includes("Chromium")) navegador = `Chrome ${chromeM[1]}`;
  else if (ffM)                                 navegador = `Firefox ${ffM[1]}`;
  else if (safM)                                navegador = `Safari ${safM[1]}`;

  let so = "Desconocido";
  if (/iPhone/.test(ua))            so = "iPhone (iOS)";
  else if (/iPad/.test(ua))         so = "iPad (iPadOS)";
  else if (/Android/.test(ua))      so = `Android ${ua.match(/Android ([0-9.]+)/)?.[1] ?? ""}`.trim();
  else if (/Windows NT 10/.test(ua)) so = "Windows 10/11";
  else if (/Windows/.test(ua))      so = "Windows";
  else if (/Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([0-9_]+)/)?.[1]?.replace(/_/g, ".");
    so = v ? `macOS ${v}` : "macOS";
  }
  else if (/Linux/.test(ua))        so = "Linux";

  const pantalla = `${window.screen.width} × ${window.screen.height} px`;
  const viewport = `${window.innerWidth} × ${window.innerHeight} px`;
  const zona     = Intl.DateTimeFormat().resolvedOptions().timeZone;

  type NavConn = { effectiveType?: string; type?: string };
  const conn   = (navigator as unknown as { connection?: NavConn }).connection;
  const online = navigator.onLine ? "En línea" : "Sin conexión";
  const conexion = conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} · ${online}` : online;
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
    { href: "/transporte/flota-en-vivo",       label: "Flota en vivo GPS" },
    { href: "/transporte/verificacion-viajes", label: "Verificación de viajes" },
    { href: "/transporte/geocercas",           label: "Geocercas Samsara" },
    { href: "/transporte/seguros",             label: "Seguros de Flota" },
    { href: "/transporte/diesel",              label: "Consumo de Diésel" },
    { href: "/transporte/mantenimiento",       label: "Mantenimiento" },
  ]},
  { grupo: "Ventas & CRM", items: [
    { href: "/crm/clientes",        label: "Base de Clientes" },
    { href: "/crm/pipeline",        label: "Pipeline CRM" },
    { href: "/ventas/programacion", label: "Programación Ventas" },
    { href: "/ventas/obras",        label: "Catálogo de Obras" },
    { href: "/ventas/productos",    label: "Productos" },
  ]},
  { grupo: "Finanzas", items: [
    { href: "/facturacion",                     label: "Facturación CFDI" },
    { href: "/finanzas/cxc",                    label: "Cuentas por Cobrar" },
    { href: "/finanzas/cxp",                    label: "Cuentas por Pagar" },
    { href: "/finanzas/cobros",                 label: "Cobros" },
    { href: "/finanzas/estado-cuenta-clientes", label: "Estados de Cuenta" },
  ]},
  { grupo: "Operaciones", items: [
    { href: "/operaciones/inventario", label: "Inventarios" },
    { href: "/operaciones/caja-chica", label: "Caja Chica" },
  ]},
  { grupo: "Recursos Humanos", items: [
    { href: "/transporte/operadores",       label: "Empleados" },
    { href: "/recursos-humanos/asistencia", label: "Control de Asistencia" },
  ]},
  { grupo: "Sistema", items: [
    { href: "/configuracion", label: "Configuración" },
    { href: "/soporte",       label: "Soporte técnico" },
  ]},
] as const;

// ─── Modal ────────────────────────────────────────────────────────────────────

function NuevoTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = getStoredSession();

  const [tipo,     setTipo]     = useState<TicketDoc["tipo"]>("bug");
  const [titulo,   setTitulo]   = useState("");
  const [desc,     setDesc]     = useState("");
  const [prio,     setPrio]     = useState<TicketDoc["prioridad"]>("media");
  const [modulo,   setModulo]   = useState("");
  const [pasos,    setPasos]    = useState("");
  const [files,    setFiles]    = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sysInfo,  setSysInfo]  = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTipo("bug"); setTitulo(""); setDesc(""); setPrio("media");
    setModulo(typeof window !== "undefined" ? window.location.pathname : "");
    setPasos(""); setFiles([]); setPreviews([]); setError(""); setDone(false);
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
    setSaving(true); setError("");
    try {
      const id       = newId();
      const adjuntos = await uploadAttachments(files, id);
      const doc: Omit<TicketDoc, "id"> = {
        tipo,
        titulo:      titulo.trim(),
        descripcion: desc.trim(),
        prioridad:   prio,
        modulo:      modulo || (typeof window !== "undefined" ? window.location.pathname : ""),
        ...(pasos.trim() && { pasos: pasos.trim() }),
        ...(adjuntos.length > 0 && { adjuntos }),
        navegador:   sysInfo.navegador ?? "—",
        sistemaInfo: sysInfo,
        status:      "abierto",
        creadoEn:    new Date().toISOString(),
        ruta:        typeof window !== "undefined" ? window.location.pathname : "",
        autorEmail:  session?.email  ?? "",
        autorNombre: session?.name   ?? "",
        planta: (session as unknown as { plantaActiva?: string })?.plantaActiva ?? undefined,
      };
      await upsertDocument(COLLECTIONS.tickets, id, doc);

      fetch("/api/soporte", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...doc, id }),
      }).catch(() => {/* silent */});

      setDone(true);
      setTimeout(onClose, 2200);
    } catch {
      setError("Error al guardar el ticket. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
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

        {done ? (
          <div className="px-6 py-14 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={30} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">¡Ticket enviado!</h3>
            <p className="text-sm text-gray-500 max-w-xs">Tu solicitud fue registrada. El equipo te responderá en el menor tiempo posible.</p>
          </div>
        ) : (
          <>
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

              {/* Pasos */}
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

              {/* Adjuntos */}
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
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
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

              {/* Info automática */}
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
          </>
        )}
      </div>
    </div>
  );
}

// ─── Botón flotante ───────────────────────────────────────────────────────────

export default function SupportFloatingButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/soporte") return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Reportar un problema o solicitar soporte"
        aria-label="Abrir soporte técnico"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#CC2229] text-white shadow-xl hover:bg-[#B01E24] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
      >
        <Headphones size={22} />
      </button>
      <NuevoTicketModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
