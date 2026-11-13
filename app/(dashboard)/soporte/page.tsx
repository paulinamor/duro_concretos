"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Bug, CheckCircle2, ChevronDown, ChevronUp,
  CircleDot, Clock, HelpCircle, MessageSquarePlus, Plus,
  Send, Sparkles, Tag, Ticket, X,
} from "lucide-react";
import {
  COLLECTIONS, getCollectionDocs, upsertDocument,
  type Ticket as TicketDoc, type TicketStatus,
} from "@/lib/db";
import { getStoredSession, DEVELOPER_EMAIL } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
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

function NuevoTicketDrawer({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (t: Omit<TicketDoc, "id">) => Promise<void>;
}) {
  const [tipo, setTipo]         = useState<TicketDoc["tipo"]>("bug");
  const [titulo, setTitulo]     = useState("");
  const [desc, setDesc]         = useState("");
  const [prio, setPrio]         = useState<TicketDoc["prioridad"]>("media");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!open) return;
    setTipo("bug"); setTitulo(""); setDesc(""); setPrio("media"); setError("");
  }, [open]);

  async function handleSave() {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    if (!desc.trim())   { setError("La descripción es obligatoria."); return; }
    setSaving(true);
    try {
      await onSave({ tipo, titulo: titulo.trim(), descripcion: desc.trim(), prioridad: prio,
        status: "abierto", creadoEn: new Date().toISOString(), ruta: window.location.pathname,
      } as Omit<TicketDoc, "id">);
      onClose();
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ colorScheme: 'light' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-[#CC2229]" />
            <h2 className="font-semibold text-gray-900">Nuevo ticket de soporte</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Título <span className="text-red-500">*</span></label>
            <input
              value={titulo}
              onChange={(e) => { setTitulo(e.target.value); setError(""); }}
              placeholder="Describe brevemente el problema o solicitud"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Descripción detallada <span className="text-red-500">*</span></label>
            <textarea
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setError(""); }}
              rows={5}
              placeholder="Explica el problema con detalle: qué hiciste, qué esperabas, qué pasó en cambio. Incluye pasos para reproducir si es un bug."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
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
            {saving ? "Enviando…" : "Enviar ticket"}
          </button>
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
        <div className="border-t border-gray-100 bg-white px-5 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Descripción</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          {ticket.ruta && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Ruta</p>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-700">{ticket.ruta}</code>
            </div>
          )}

          {ticket.respuesta && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Respuesta del desarrollador</p>
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
