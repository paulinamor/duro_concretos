"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, ExternalLink,
  MapPin, Package, Phone, Plus, Search, Truck, Users, X,
} from "lucide-react";
import AppSelect from "@/components/AppSelect";
import ClienteCombobox from "@/components/ClienteCombobox";
import PlantaRequired from "@/components/PlantaRequired";
import { upsertDocument, getCollectionDocs, COLLECTIONS, orderBy, limit } from "@/lib/db";
import { withPlantaTag, getStoredSession, getActivePlanta } from "@/lib/auth";
import { todayCST, localISODate } from "@/lib/dateUtils";
import { useCollection } from "@/lib/useCollection";
import { tiposCliente, type Cliente, type TipoCliente } from "@/lib/crmClientes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaseEntry {
  fase: string;
  fecha: string;
  nota?: string;
  usuario?: string;
}

interface Programacion {
  id?: string;
  dia: string;
  vendedor: string;
  diaHoraPedido: string;
  cliente: string;
  telefono: string;
  direccion: string;
  hora: string;
  m3Totales: number | null;
  extras: string;
  tdBom: string;
  resistencia: string;
  color: string;
  paraUso: string;
  precioM3: number | null;
  precioM3Bomba: number | null;
  factorBomba: number | null;
  aplicarFactorBomba: boolean;
  ltoAcelr: number | null;
  kiloFibra: number | null;
  m3Imper: number | null;
  aditivo: string;
  tuberiaExtra: number | null;
  permisosOC: number | null;
  m3Vacios: number | null;
  totalXM3: number | null;
  total: number | null;
  recibo: string;
  credito: string;
  fact: string;
  pagado: string;
  montoPagado: number | null;
  metodoPago: string;
  fechaPago: string;
  muestras: string;
  hsr: string;
  tiempoExtraDescarga: string;
  choferes: unknown[];
  notas?: string;
  nombreObra?: string;
  planta?: string;
  folio?: string;
  notasAcceso?: string;
  historial?: FaseEntry[];
  fase?: string;
  vehiculoSamsaraId?: string;
  exhibiciones?: "1" | "2";
  montoPago2?: number | null;
  fechaPago2?: string;
  metodoPago2?: string;
  sgpSerie?: string;
  sgpNumero?: string;
}

interface NuevoClienteForm {
  razonSocial: string;
  rfc: string;
  contacto: string;
  telefono: string;
  tipoCliente: TipoCliente;
  vendedorAsignado: string;
}

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

type VForm = {
  dia: string;
  horaEntrega: string;
  diaHoraPedido: string;
  cliente: string;
  telefono: string;
  obraNombre: string;
  direccion: string;
  m3Totales: string;
  resistencia: string;
  extras: string;
  tdBom: string;
  precioM3: string;
  precioM3Bomba: string;
};

function emptyForm(dia: string): VForm {
  return {
    dia, horaEntrega: "", diaHoraPedido: nowLocalISO(), cliente: "", telefono: "",
    obraNombre: "", direccion: "",
    m3Totales: "", resistencia: "", extras: "", tdBom: "",
    precioM3: "", precioM3Bomba: "",
  };
}

function formFromProg(p: Programacion): VForm {
  return {
    dia: p.dia,
    horaEntrega: p.hora ?? "",
    diaHoraPedido: p.diaHoraPedido ?? "",
    cliente: p.cliente,
    telefono: p.telefono,
    obraNombre: p.nombreObra ?? "",
    direccion: p.direccion,
    m3Totales: p.m3Totales != null ? String(p.m3Totales) : "",
    resistencia: p.resistencia ?? "",
    extras: p.extras ?? "",
    tdBom: p.tdBom ?? "",
    precioM3: p.precioM3 != null ? String(p.precioM3) : "",
    precioM3Bomba: p.precioM3Bomba != null ? String(p.precioM3Bomba) : "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = todayCST;
function nowLocalISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function isUrl(v: string) { return v.startsWith("http://") || v.startsWith("https://"); }

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const searchMatch = url.match(/\/maps\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (searchMatch) return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };
  return null;
}

function generarFolio(progs: Programacion[]): string {
  const year = new Date().getFullYear();
  const nums = progs
    .map((p) => p.folio?.match(/PROG-\d{4}-(\d+)/)?.[1])
    .filter(Boolean)
    .map((n) => parseInt(n!));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `PROG-${year}-${String(next).padStart(4, "0")}`;
}

function addDays(iso: string, d: number) {
  const dt = new Date(iso + "T12:00:00"); dt.setDate(dt.getDate() + d); return localISODate(dt);
}

function fmtDia(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function fmtHoraPedido(dt: string) {
  if (!dt || dt === "N/A") return "—";
  try { return new Date(dt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }); } catch { return dt; }
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function PedidoDrawer({
  open, prog, clientesList, obrasData, rawClientes, vendedorNombre, onClose, onSave, onSaveCliente, onSaveObra,
}: {
  open: boolean;
  prog: Programacion | null;
  clientesList: string[];
  obrasData: Obra[];
  rawClientes: Cliente[];
  vendedorNombre: string;
  onClose: () => void;
  onSave: (data: VForm, id?: string) => Promise<void>;
  onSaveCliente?: (f: NuevoClienteForm) => Promise<string>;
  onSaveObra?: (cliente: string, nombre: string, direccion: string) => void;
}) {
  const [form, setForm] = useState<VForm>(emptyForm(todayISO()));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<NuevoClienteForm>({
    razonSocial: "", rfc: "", contacto: "", telefono: "", tipoCliente: "Constructora", vendedorAsignado: "",
  });
  const [nuevoSaving, setNuevoSaving] = useState(false);
  const [nuevoError, setNuevoError] = useState("");
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);

  // Obra selector state
  const [obraOpen, setObraOpen] = useState(false);
  const [obraQuery, setObraQuery] = useState("");
  const [obraNewOpen, setObraNewOpen] = useState(false);
  const [obraNewNombre, setObraNewNombre] = useState("");
  const [obraNewDireccion, setObraNewDireccion] = useState("");
  const obraContainerRef = useRef<HTMLDivElement>(null);

  const obrasSugeridas = useMemo(() => {
    if (!form.cliente) return [];
    const clienteLower = form.cliente.toLowerCase();
    return obrasData
      .filter((o) => o.cliente.toLowerCase() === clienteLower)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [obrasData, form.cliente]);

  const creditoAlerta = useMemo(() => {
    if (!form.cliente) return null;
    const norm = form.cliente.trim().toUpperCase().replace(/\s+/g, " ");
    const cl = rawClientes.find(
      (c) => c.razonSocial.trim().toUpperCase().replace(/\s+/g, " ") === norm,
    );
    if (!cl) return null;
    if (cl.limiteCredito > 0 && cl.saldoPendiente > cl.limiteCredito) {
      return {
        tipo: "excedido" as const,
        msg: `Límite de crédito excedido · Saldo $${cl.saldoPendiente.toLocaleString("es-MX")} / Límite $${cl.limiteCredito.toLocaleString("es-MX")}`,
      };
    }
    if (cl.diasCredito > 0 && cl.ultimaCompra && cl.ultimaCompra !== "—") {
      const venc = new Date(cl.ultimaCompra + "T12:00:00");
      venc.setDate(venc.getDate() + cl.diasCredito);
      if (venc < new Date()) {
        return {
          tipo: "vencido" as const,
          msg: `Crédito ${cl.diasCredito} días · Vencido desde ${venc.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`,
        };
      }
    }
    return null;
  }, [form.cliente, rawClientes]);

  const obrasFiltradas = useMemo(() => {
    if (!obraQuery.trim()) return obrasSugeridas;
    const q = obraQuery.toLowerCase();
    return obrasSugeridas.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [obrasSugeridas, obraQuery]);

  // Click-outside cierra el selector de obras
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (obraContainerRef.current && !obraContainerRef.current.contains(e.target as Node)) {
        setObraOpen(false);
        setObraNewOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (open) {
      setForm(prog ? formFromProg(prog) : emptyForm(todayISO()));
      setNuevoOpen(false);
      setResolvedCoords(null);
      setObraOpen(false);
      setObraQuery("");
      setObraNewOpen(false);
      setObraNewNombre("");
      setObraNewDireccion("");
    }
  }, [open, prog]);

  useEffect(() => {
    const url = form.direccion;
    if (!isUrl(url) || extractCoordsFromUrl(url)) {
      setResolvedCoords(null);
      setResolvingUrl(false);
      return;
    }
    setResolvingUrl(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/maps/resolve?url=${encodeURIComponent(url)}`)
        .then((r) => r.json())
        .then((data) => { if (!cancelled) setResolvedCoords(data.coords ?? null); })
        .catch(() => { if (!cancelled) setResolvedCoords(null); })
        .finally(() => { if (!cancelled) setResolvingUrl(false); });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.direccion]);

  function set(k: keyof VForm, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    const missing: string[] = [];
    if (!form.cliente.trim()) missing.push("Cliente");
    if (!form.telefono.trim()) missing.push("Teléfono");
    if (!form.direccion.trim()) missing.push("Dirección / Obra");
    if (!form.m3Totales) missing.push("M³ solicitados");
    if (!form.horaEntrega) missing.push("Hora de entrega");
    if (!form.tdBom) missing.push("T / D / BOM");
    if (missing.length > 0) {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", title: "Campos requeridos", message: missing.join(" · ") } }));
      return;
    }
    setSaving(true);
    try {
      await onSave(form, prog?.id);
      onClose();
    } catch (err) {
      if ((err as { code?: string }).code !== "PLANTA_REQUERIDA") {
        window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", title: "Error", message: "No se pudo guardar." } }));
      }
    } finally { setSaving(false); }
  }

  function setNuevo<K extends keyof NuevoClienteForm>(k: K, v: NuevoClienteForm[K]) {
    setNuevoForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSaveNuevo() {
    if (!nuevoForm.razonSocial.trim() || !nuevoForm.rfc.trim() || !nuevoForm.contacto.trim()) {
      setNuevoError("Razón social, RFC y contacto son obligatorios.");
      return;
    }
    if (!onSaveCliente) return;
    setNuevoSaving(true);
    setNuevoError("");
    try {
      const razonSocial = await onSaveCliente(nuevoForm);
      setForm((f) => ({ ...f, cliente: razonSocial, telefono: nuevoForm.telefono }));
      setNuevoOpen(false);
    } catch {
      setNuevoError("No se pudo guardar el cliente.");
    } finally {
      setNuevoSaving(false);
    }
  }

  if (!open) return null;

  const inp = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]";
  const lbl = "block text-sm text-gray-600 mb-1 font-medium";

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">

        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{prog ? "Editar pedido" : "Nuevo pedido"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vendedor: <span className="font-medium text-gray-600">{vendedorNombre}</span></p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Fecha y hora del pedido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Día de entrega <span className="text-[#CC2229]">*</span></label>
              <input type="date" value={form.dia} onChange={(e) => set("dia", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Hora de entrega <span className="text-[#CC2229]">*</span></label>
              <input type="time" value={form.horaEntrega} onChange={(e) => set("horaEntrega", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Día y hora de registro — bloqueado */}
          <div>
            <label className={lbl}>Día y hora de registro de pedido</label>
            <div className={`${inp} bg-gray-50 text-gray-500 cursor-default select-none`}>
              {form.diaHoraPedido
                ? new Date(form.diaHoraPedido).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : <span className="text-gray-400">—</span>}
            </div>
          </div>

          {/* Cliente */}
          <ClienteCombobox
            label="Cliente" required value={form.cliente}
            onChange={(v) => {
              const norm = v.trim().toUpperCase().replace(/\s+/g, " ");
              setForm((f) => ({ ...f, cliente: norm, obraNombre: norm !== f.cliente ? "" : f.obraNombre, direccion: norm !== f.cliente ? "" : f.direccion }));
            }}
            options={clientesList} placeholder="Buscar cliente registrado…"
          />
          {creditoAlerta && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 border ${
              creditoAlerta.tipo === "excedido"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span className="text-xs font-medium">{creditoAlerta.msg}</span>
            </div>
          )}

          {/* Nombre de la obra — selector con dropdown */}
          <div ref={obraContainerRef} className="relative">
            <label className={lbl}>
              Nombre de la obra <span className="text-[#CC2229]">*</span>
              {obrasSugeridas.length > 0 && (
                <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-blue-400">
                  {obrasSugeridas.length} guardada{obrasSugeridas.length !== 1 ? "s" : ""}
                </span>
              )}
            </label>

            {/* Trigger */}
            <div
              role="button"
              tabIndex={form.cliente ? 0 : -1}
              onClick={() => { if (form.cliente) setObraOpen((v) => !v); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (form.cliente) setObraOpen((v) => !v); } }}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer select-none transition-colors ${
                obraOpen ? "border-[#CC2229]/60 ring-1 ring-[#CC2229]/20" : "border-gray-200 hover:border-gray-300"
              } ${!form.cliente ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}`}
            >
              <span className={`flex-1 truncate ${form.obraNombre ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                {form.obraNombre || (form.cliente ? "Seleccionar o agregar obra…" : "Selecciona un cliente primero")}
              </span>
              {form.obraNombre && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); set("obraNombre", ""); setObraQuery(""); }}
                  className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
              <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform duration-150 ${obraOpen ? "rotate-180" : ""}`} />
            </div>

            {/* Dropdown */}
            {obraOpen && (
              <div className="absolute z-[300] mt-1 w-full rounded-xl border border-gray-200 bg-white overflow-hidden"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)" }}>

                {/* Búsqueda */}
                {obrasSugeridas.length > 0 && (
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      value={obraQuery}
                      onChange={(e) => setObraQuery(e.target.value)}
                      placeholder="Buscar obra…"
                      className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
                    />
                  </div>
                )}

                {/* Lista de obras */}
                <ul className="max-h-52 overflow-y-auto py-1">
                  {obrasFiltradas.length === 0 && !obraNewOpen && (
                    <li className="px-4 py-3 text-sm text-gray-400 text-center">
                      {obrasSugeridas.length === 0 ? "Sin obras registradas para este cliente" : "Sin resultados"}
                    </li>
                  )}
                  {obrasFiltradas.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          set("obraNombre", o.nombre);
                          if (o.direccion) { set("direccion", o.direccion); setCopied(false); }
                          setObraOpen(false);
                          setObraQuery("");
                        }}
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer ${form.obraNombre === o.nombre ? "bg-gray-50" : ""}`}
                      >
                        <div className="text-sm font-medium text-gray-800">{o.nombre}</div>
                        {o.direccion && (
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            {isUrl(o.direccion) ? "Ubicación en Maps guardada" : o.direccion}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Footer: agregar nueva obra */}
                {!obraNewOpen && (
                  <div className="border-t border-gray-100 px-3 py-2">
                    <button
                      type="button"
                      onMouseDown={() => { setObraNewOpen(true); setObraNewNombre(obraQuery); setObraNewDireccion(""); }}
                      className="w-full text-left text-xs font-semibold text-[#CC2229] hover:text-[#B01E24] py-1 cursor-pointer transition-colors"
                    >
                      + Agregar nueva obra
                    </button>
                  </div>
                )}

                {/* Formulario inline: nueva obra */}
                {obraNewOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Nueva obra</p>
                    <input
                      value={obraNewNombre}
                      onChange={(e) => setObraNewNombre(e.target.value)}
                      placeholder="Nombre de la obra *"
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
                    />
                    <input
                      value={obraNewDireccion}
                      onChange={(e) => setObraNewDireccion(e.target.value)}
                      placeholder="Dirección o link de Maps"
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onMouseDown={() => setObraNewOpen(false)}
                        className="flex-1 text-sm py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!obraNewNombre.trim()}
                        onMouseDown={() => {
                          if (!obraNewNombre.trim()) return;
                          const nombre = obraNewNombre.trim().toUpperCase().replace(/\s+/g, " ");
                          const direccion = obraNewDireccion.trim();
                          set("obraNombre", nombre);
                          if (direccion) { set("direccion", direccion); setCopied(false); }
                          onSaveObra?.(form.cliente, nombre, direccion);
                          setObraOpen(false);
                          setObraNewOpen(false);
                          setObraQuery("");
                        }}
                        className="flex-1 text-sm py-1.5 rounded-lg bg-[#CC2229] text-white hover:bg-[#B01E24] disabled:opacity-50 cursor-pointer transition-colors font-medium"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <label className={lbl}>Teléfono <span className="text-[#CC2229]">*</span></label>
            <input type="tel" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="81 0000 0000" className={inp} />
          </div>

          {/* Dirección / Maps */}
          <div>
            <label className={lbl}>Dirección o link de Maps <span className="text-[#CC2229]">*</span></label>
            <input
              value={form.direccion}
              onChange={(e) => { set("direccion", e.target.value); setCopied(false); }}
              placeholder="Dirección o link de Google Maps"
              className={inp}
            />
            {isUrl(form.direccion) && (
              <>
                <div className="flex items-center gap-3 mt-1.5">
                  <a
                    href={form.direccion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium"
                  >
                    <ExternalLink size={12} /> Ver en Maps
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ url: form.direccion, title: "Ubicación de obra" }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(form.direccion);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 font-medium cursor-pointer transition-colors"
                  >
                    <Copy size={12} />
                    {copied ? "¡Copiado!" : "Compartir"}
                  </button>
                </div>

                {/* Mini mapa preview */}
                {(() => {
                  const directCoords = extractCoordsFromUrl(form.direccion);
                  const coords = directCoords ?? resolvedCoords;
                  if (resolvingUrl) {
                    return (
                      <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 py-5" style={{ height: 160 }}>
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-[#CC2229] animate-spin" />
                        <p className="text-xs text-gray-400">Verificando ubicación…</p>
                      </div>
                    );
                  }
                  if (coords) {
                    const { lat, lng } = coords;
                    const delta = 0.004;
                    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
                    return (
                      <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 relative" style={{ height: 160 }}>
                        <iframe
                          src={embedUrl}
                          width="100%"
                          height="100%"
                          className="w-full h-full border-0"
                          title="Vista previa de ubicación"
                          loading="lazy"
                        />
                        <a
                          href={form.direccion}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 bg-white/95 text-blue-600 text-[10px] font-semibold px-2 py-1 rounded-lg shadow-sm hover:bg-white transition-colors"
                        >
                          Abrir en Maps →
                        </a>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 py-5">
                      <MapPin size={22} className="text-gray-300" />
                      <p className="text-xs text-gray-400 text-center">No se pudo obtener la ubicación</p>
                      <a
                        href={form.direccion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Verificar en Google Maps
                      </a>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* M3 */}
          <div>
            <label className={lbl}>M³ solicitados <span className="text-[#CC2229]">*</span></label>
            <input type="number" step="0.5" min="0" value={form.m3Totales}
              onChange={(e) => set("m3Totales", e.target.value)} placeholder="0" className={inp}
              onWheel={(e) => e.currentTarget.blur()} />
          </div>

          {/* Resistencia */}
          <div>
            <label className={lbl}>Resistencia (f&apos;c)</label>
            <div className="flex flex-wrap gap-2">
              {["100", "150", "200", "250", "300", "350", "400"].map((r) => (
                <button key={r} type="button"
                  onClick={() => set("resistencia", form.resistencia === r ? "" : r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${form.resistencia === r ? "bg-[#CC2229] border-[#CC2229] text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {r}
                </button>
              ))}
              <input value={["100","150","200","250","300","350","400"].includes(form.resistencia) ? "" : form.resistencia}
                onChange={(e) => set("resistencia", e.target.value)}
                placeholder="Otro…" className="w-20 px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-[#CC2229]" />
            </div>
          </div>

          {/* T/D BOM */}
          <div>
            <label className={lbl}>T / D / BOM <span className="text-[#CC2229]">*</span></label>
            <div className="flex gap-2">
              {["Trompo", "Directo", "Bomba"].map((opt) => (
                <button key={opt} type="button" onClick={() => set("tdBom", form.tdBom === opt ? "" : opt)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${form.tdBom === opt ? "bg-[#CC2229] border-[#CC2229] text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div>
            <label className={lbl}>Extras</label>
            <input value={form.extras} onChange={(e) => set("extras", e.target.value)}
              placeholder="Fibra, impermeabilizante, acelerante…" className={inp} />
          </div>

          {/* Precios por m3 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Precio / m³ <span className="text-[#CC2229]">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.precioM3}
                  onChange={(e) => set("precioM3", e.target.value)}
                  placeholder="0.00" className={`${inp} pl-7`}
                  onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
            <div>
              <label className={lbl}>Precio / m³ Bomba</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.precioM3Bomba}
                  onChange={(e) => set("precioM3Bomba", e.target.value)}
                  placeholder="0.00" className={`${inp} pl-7`}
                  onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            <CalendarDays size={14} />
            {saving ? "Guardando…" : prog ? "Actualizar" : "Crear pedido"}
          </button>
        </div>

        {/* Overlay: registrar nuevo cliente */}
        {nuevoOpen && (
          <div className="absolute inset-0 z-[200] flex flex-col bg-white overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
              <button onClick={() => setNuevoOpen(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <ArrowLeft size={16} />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Registrar nuevo cliente</h2>
                <p className="text-xs text-gray-400">Razón social, RFC y contacto son obligatorios</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {nuevoError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {nuevoError}
                </div>
              )}
              <div>
                <label className={lbl}>Razón social <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={nuevoForm.razonSocial} onChange={(e) => setNuevo("razonSocial", e.target.value)} placeholder="Nombre fiscal completo" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>RFC <span className="text-[#CC2229]">*</span></label>
                  <input type="text" value={nuevoForm.rfc} onChange={(e) => setNuevo("rfc", e.target.value.toUpperCase())} placeholder="RFC" className={`${inp} uppercase`} />
                </div>
                <div>
                  <label className={lbl}>Tipo</label>
                  <AppSelect value={nuevoForm.tipoCliente} onChange={(e) => setNuevo("tipoCliente", e.target.value as TipoCliente)}>
                    {tiposCliente.map((t) => <option key={t}>{t}</option>)}
                  </AppSelect>
                </div>
              </div>
              <div>
                <label className={lbl}>Contacto principal <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={nuevoForm.contacto} onChange={(e) => setNuevo("contacto", e.target.value)} placeholder="Nombre del contacto" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Teléfono</label>
                  <input type="tel" value={nuevoForm.telefono} onChange={(e) => setNuevo("telefono", e.target.value)} placeholder="81 0000 0000" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Vendedor asignado</label>
                  <input type="text" value={nuevoForm.vendedorAsignado} onChange={(e) => setNuevo("vendedorAsignado", e.target.value)} placeholder="Vendedor" className={inp} />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
              <button onClick={() => setNuevoOpen(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSaveNuevo}
                disabled={nuevoSaving || !nuevoForm.razonSocial.trim() || !nuevoForm.rfc.trim() || !nuevoForm.contacto.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer"
              >
                <Users size={14} />
                {nuevoSaving ? "Registrando…" : "Registrar cliente"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VentasProgramacionPage() {
  const session = useMemo(() => getStoredSession(), []);
  const vendedorNombre = session?.name ?? "";

  // Limitar a 400 más recientes para evitar cargar toda la colección en memoria
  const allProgs = useCollection<Programacion>(
    COLLECTIONS.programaciones,
    [orderBy("dia", "desc"), limit(400)],
  );

  // Carga única — no real-time, para no disparar re-render de toda la página al guardar un cliente
  const [rawClientes, setRawClientes] = useState<Cliente[]>([]);
  useEffect(() => {
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then(setRawClientes);
  }, []);

  const [obrasData, setObrasData] = useState<Obra[]>([]);
  useEffect(() => {
    getCollectionDocs<Obra>(COLLECTIONS.obras).then(setObrasData);
  }, []);

  const [diaActivo, setDiaActivo] = useState(todayISO);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<Programacion | null>(null);

  // Feature 2: búsqueda por folio/cliente/dirección
  const [folioSearch, setFolioSearch] = useState("");

  // Feature 3: modal de cierre
  const [showCierre, setShowCierre] = useState(false);
  const [cierreProg, setCierreProg] = useState<Programacion | null>(null);
  const [cierreNotas, setCierreNotas] = useState("");
  const [cierreSaving, setCierreSaving] = useState(false);

  // Feature 4: modal de timeline
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineProg, setTimelineProg] = useState<Programacion | null>(null);


  // Asignar folios retroactivos a programaciones que no los tienen
  const retroactivoRan = useRef(false);
  useEffect(() => {
    if (retroactivoRan.current || allProgs.length === 0) return;
    retroactivoRan.current = true;
    const sinFolio = allProgs.filter((p) => !p.folio && p.id);
    if (sinFolio.length === 0) return;
    let maxNum = allProgs.reduce((max, p) => {
      const m = p.folio?.match(/PROG-\d{4}-(\d+)/);
      return m ? Math.max(max, parseInt(m[1])) : max;
    }, 0);
    const sorted = [...sinFolio].sort((a, b) => a.dia.localeCompare(b.dia));
    Promise.all(sorted.map((prog) => {
      maxNum++;
      const year = prog.dia?.slice(0, 4) ?? new Date().getFullYear().toString();
      const folio = `PROG-${year}-${String(maxNum).padStart(4, "0")}`;
      const { id, ...rest } = prog;
      // El doc ya tiene planta; no llamamos withPlantaTag para no requerir sesión con planta activa
      return upsertDocument(COLLECTIONS.programaciones, id!, { ...rest, folio });
    }));
  }, [allProgs]);

  const clientesList = useMemo(() => {
    const fromClientes = rawClientes
      .flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean))
      .map((n) => (n as string).trim().toUpperCase().replace(/\s+/g, " "));
    return Array.from(new Set(fromClientes)).sort();
  }, [rawClientes]);

  const catalogoNombres = useMemo(() => new Set(
    rawClientes.flatMap((c) => [c.razonSocial, c.nombreComercial ?? ""].filter(Boolean).map((n) => n.trim().toLowerCase())),
  ), [rawClientes]);

  // Solo los pedidos del vendedor activo
  const misPedidos = useMemo(() =>
    allProgs
      .filter((p) => p.vendedor === vendedorNombre)
      .sort((a, b) => b.dia.localeCompare(a.dia) || (a.diaHoraPedido ?? "").localeCompare(b.diaHoraPedido ?? "")),
    [allProgs, vendedorNombre]);

  // Feature 2: filtrado por folio/cliente/dirección
  const pedidosFiltrados = useMemo(() => {
    if (!folioSearch.trim()) return misPedidos;
    const q = folioSearch.toLowerCase();
    return misPedidos.filter((p) =>
      p.folio?.toLowerCase().includes(q) ||
      p.cliente?.toLowerCase().includes(q) ||
      p.direccion?.toLowerCase().includes(q),
    );
  }, [misPedidos, folioSearch]);

  // Disponibilidad del día activo (todos los pedidos de ese día, sin revelar datos de otros)
  const pedidosDia = useMemo(() =>
    allProgs.filter((p) => p.dia === diaActivo),
    [allProgs, diaActivo]);

  const misPedidosDia = useMemo(() =>
    misPedidos.filter((p) => p.dia === diaActivo),
    [misPedidos, diaActivo]);

  // ─── SGP helpers (fire-and-forget; don't block the UX) ───────────────────
  async function sgpCrearPedido(progId: string, folio: string, form: VForm, planta: string) {
    try {
      const res = await fetch("/api/sgp/crear-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prog: {
            serieErp: "ERP",
            numeroErp: folio,
            producto: "",
            productoDescripcion: form.extras.trim() || "Concreto",
            cantidadSolicitada: parseFloat(form.m3Totales) || 0,
            fechaSuministro: form.dia,
            horaEnObra: form.horaEntrega,
            bombeoPropio: form.tdBom.toUpperCase().includes("BOM") ? "S" : "N",
            bombeoCliente: "N",
            clienteRazonSocial: form.cliente.trim(),
            clienteTelefono: form.telefono.trim(),
            obraDescripcion: form.cliente.trim(),
            obraDireccion: form.direccion.trim(),
            frenteDescripcion: form.extras.trim(),
            planta,
          },
        }),
      });
      const data = await res.json() as { ok: boolean; sgpSerie?: string; sgpNumero?: string; error?: string };
      if (data.ok && data.sgpNumero) {
        await upsertDocument(COLLECTIONS.programaciones, progId, {
          sgpSerie: data.sgpSerie ?? "ERP",
          sgpNumero: data.sgpNumero,
        });
      } else if (!data.ok && data.error !== "SGP_NOT_CONFIGURED") {
        console.warn("[SGP] crear-pedido:", data.error);
      }
    } catch {
      console.warn("[SGP] crear-pedido: error de red");
    }
  }

  async function sgpCerrarPedido(prog: Programacion) {
    if (!prog.sgpSerie || !prog.sgpNumero || !prog.planta) return;
    try {
      await fetch("/api/sgp/cerrar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serie: prog.sgpSerie, numero: prog.sgpNumero, planta: prog.planta }),
      });
    } catch {
      console.warn("[SGP] cerrar-pedido: error de red");
    }
  }

  async function autoSaveObra(cliente: string, nombre: string, direccion: string) {
    if (!nombre.trim() || !cliente.trim()) return;
    const ya = obrasData.find(
      (o) => o.cliente.toLowerCase() === cliente.toLowerCase() && o.nombre.toLowerCase() === nombre.trim().toLowerCase(),
    );
    if (ya) return;
    const id = `obra-${Date.now()}`;
    const doc: Obra = {
      id,
      cliente: cliente.trim().toUpperCase().replace(/\s+/g, " "),
      nombre: nombre.trim().toUpperCase().replace(/\s+/g, " "),
      direccion: direccion.trim(),
    };
    await upsertDocument(COLLECTIONS.obras, id, doc);
    setObrasData((prev) => [...prev, doc]);
  }

  async function syncClienteM3(clienteNorm: string, deltam3: number, dia: string) {
    if (!deltam3) return;
    const found = rawClientes.find(
      (c) => c.razonSocial.trim().toUpperCase().replace(/\s+/g, " ") === clienteNorm,
    );
    if (!found?.id) return;
    const nuevosM3 = Math.max(0, (found.m3Acumulados ?? 0) + deltam3);
    await upsertDocument(COLLECTIONS.clientes, found.id, { m3Acumulados: nuevosM3, ultimaCompra: dia });
    setRawClientes((prev) =>
      prev.map((c) => (c.id === found.id ? { ...c, m3Acumulados: nuevosM3, ultimaCompra: dia } : c)),
    );
  }

  async function handleSaveCliente(f: NuevoClienteForm): Promise<string> {
    const id = `CL-${Date.now()}`;
    const razonSocial = f.razonSocial.trim().toUpperCase().replace(/\s+/g, " ");
    const doc = {
      razonSocial,
      nombreComercial: razonSocial,
      rfc: f.rfc.trim().toUpperCase(),
      domicilio: "", colonia: "", municipio: "", estado: "Nuevo León", cp: "",
      contacto: f.contacto.trim(),
      cargo: "",
      telefono: f.telefono.trim(),
      email: "",
      tipoCliente: f.tipoCliente,
      vendedorAsignado: f.vendedorAsignado.trim(),
      limiteCredito: 0,
      saldoPendiente: 0,
      diasCredito: 0,
      ultimaCompra: "—",
      totalComprasAnio: 0,
      m3Acumulados: 0,
      estatus: "Activo" as const,
      calificacion: "B" as const,
      fechaAlta: todayCST(),
      notas: "",
    };
    await upsertDocument(COLLECTIONS.clientes, id, withPlantaTag(doc));
    // Actualiza el estado local sin esperar re-fetch para no congelar la página
    setRawClientes((prev) => [...prev, { id, ...doc } as Cliente]);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `Cliente ${razonSocial} registrado.` },
    }));
    return razonSocial;
  }

  async function handleSave(form: VForm, existingId?: string) {
    const m3 = parseFloat(form.m3Totales) || null;
    const precioM3 = form.precioM3 ? parseFloat(form.precioM3) : null;
    const precioM3Bomba = form.precioM3Bomba ? parseFloat(form.precioM3Bomba) : null;
    if (existingId) {
      const current = allProgs.find((p) => p.id === existingId);
      if (!current) return;
      const { id: _id, ...rest } = current;
      const merged = {
        ...rest,
        diaHoraPedido: form.diaHoraPedido,
        dia: form.dia,
        cliente: form.cliente.trim().toUpperCase().replace(/\s+/g, " "),
        telefono: form.telefono.trim(),
        nombreObra: form.obraNombre.trim() || rest.nombreObra || "",
        direccion: form.direccion.trim(),
        m3Totales: m3,
        resistencia: form.resistencia.trim(),
        extras: form.extras.trim(),
        tdBom: form.tdBom.trim(),
        hora: form.horaEntrega.trim(),
        precioM3,
        precioM3Bomba,
      };
      await upsertDocument(COLLECTIONS.programaciones, existingId, withPlantaTag(merged));
      void syncClienteM3(merged.cliente, (m3 ?? 0) - (current.m3Totales ?? 0), form.dia);
      if (form.obraNombre.trim()) void autoSaveObra(form.cliente, form.obraNombre, form.direccion);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Guardado", message: "Pedido actualizado." } }));
    } else {
      const id = `prog-v-${Date.now()}`;
      const folio = generarFolio(allProgs);
      const newProg: Omit<Programacion, "id"> = {
        dia: form.dia,
        vendedor: vendedorNombre,
        diaHoraPedido: form.diaHoraPedido,
        cliente: form.cliente.trim().toUpperCase().replace(/\s+/g, " "),
        telefono: form.telefono.trim(),
        nombreObra: form.obraNombre.trim() || undefined,
        direccion: form.direccion.trim(),
        m3Totales: m3,
        resistencia: form.resistencia.trim(),
        extras: form.extras.trim(),
        tdBom: form.tdBom.trim(),
        hora: form.horaEntrega.trim(), hsr: "", muestras: "", tiempoExtraDescarga: "",
        color: "", paraUso: "", aditivo: "", credito: "",
        recibo: "", fact: "", pagado: "",
        metodoPago: "", fechaPago: "",
        choferes: [],
        m3Vacios: null,
        precioM3,
        precioM3Bomba,
        factorBomba: null, aplicarFactorBomba: false, ltoAcelr: null,
        kiloFibra: null, m3Imper: null, tuberiaExtra: null, permisosOC: null,
        totalXM3: null, total: null,
        montoPagado: null,
        folio,
        fase: "Creado",
        historial: [{ fase: "Creado", fecha: new Date().toISOString(), usuario: vendedorNombre }],
      };
      await upsertDocument(COLLECTIONS.programaciones, id, withPlantaTag(newProg));
      void syncClienteM3(newProg.cliente, m3 ?? 0, form.dia);
      if (form.obraNombre.trim()) void autoSaveObra(form.cliente, form.obraNombre, form.direccion);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", title: "Pedido creado", message: `${form.cliente} — en espera de asignación.` } }));
      // Fire-and-forget: sync to SGP in background (non-blocking)
      void sgpCrearPedido(id, folio, form, getActivePlanta());
    }
  }

  // Feature 3: función de cierre
  async function handleCierre() {
    if (!cierreProg?.id) return;
    setCierreSaving(true);
    try {
      const { id, ...rest } = cierreProg;
      const nuevaFase: FaseEntry = {
        fase: "Entregado",
        fecha: new Date().toISOString(),
        nota: cierreNotas.trim() || undefined,
        usuario: vendedorNombre,
      };
      const updated = {
        ...rest,
        fase: "Entregado",
        notasAcceso: cierreNotas.trim() || rest.notasAcceso,
        historial: [...(rest.historial ?? []), nuevaFase],
      };
      // El doc ya tiene planta; no usamos withPlantaTag para no requerir sesión con planta activa
      await upsertDocument(COLLECTIONS.programaciones, id!, updated);
      setShowCierre(false);
      setCierreProg(null);
      setCierreNotas("");
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `${cierreProg.folio ?? "Pedido"} cerrado como Entregado.` },
      }));
      void sgpCerrarPedido(cierreProg);
    } catch (err) {
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "error", message: err instanceof Error ? err.message : "Error al cerrar el pedido." },
      }));
    } finally {
      setCierreSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-sm" suppressHydrationWarning>
          Tus pedidos · <span className="text-white font-medium" suppressHydrationWarning>{vendedorNombre}</span>
        </p>
        <PlantaRequired>
          {(ok) => (
            <button
              onClick={() => { if (!ok) return; setEditing(null); setShowDrawer(true); }}
              disabled={!ok}
              title={!ok ? "Selecciona Allende o Pesquería primero" : undefined}
              className={`flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 ${ok ? "hover:bg-[#B01E24] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
            >
              <Plus size={15} /> Nuevo pedido
            </button>
          )}
        </PlantaRequired>
      </div>

      {/* Selector de día + disponibilidad */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setDiaActivo((d) => addDays(d, -1))}
            className="p-2 rounded-lg border border-[#3A3A3A] text-gray-400 hover:text-white hover:bg-[#3A3A3A] transition-colors cursor-pointer">
            <ChevronLeft size={15} />
          </button>
          <input type="date" value={diaActivo} onChange={(e) => setDiaActivo(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer" />
          <span className="text-gray-400 text-sm capitalize flex-1">{fmtDia(diaActivo)}</span>
          <button onClick={() => setDiaActivo((d) => addDays(d, 1))}
            className="p-2 rounded-lg border border-[#3A3A3A] text-gray-400 hover:text-white hover:bg-[#3A3A3A] transition-colors cursor-pointer">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => setDiaActivo(todayISO())}
            className="text-xs text-gray-500 hover:text-white border border-[#3A3A3A] rounded-lg px-3 py-2 transition-colors cursor-pointer">
            Hoy
          </button>
        </div>

        {/* Carga del día */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2">
            <Truck size={13} className="text-gray-500" />
            <span className="text-xs text-gray-400">Pedidos del día</span>
            <span className="text-sm font-semibold text-white">{pedidosDia.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2">
            <Package size={13} className="text-gray-500" />
            <span className="text-xs text-gray-400">M³ en agenda</span>
            <span className="text-sm font-semibold text-white">
              {pedidosDia.reduce((s, p) => s + (p.m3Totales ?? 0), 0).toLocaleString("es-MX")}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-lg px-3 py-2">
            <CalendarDays size={13} className="text-gray-500" />
            <span className="text-xs text-gray-400">Mis pedidos hoy</span>
            <span className="text-sm font-semibold text-amber-400">{misPedidosDia.length}</span>
          </div>
          {pedidosDia.length >= 8 && (
            <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              Día con alta demanda — confirma con programación
            </span>
          )}
        </div>
      </div>

      {/* Mis pedidos */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Todos mis pedidos</h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={folioSearch}
              onChange={(e) => setFolioSearch(e.target.value)}
              placeholder="Buscar folio, cliente o dirección..."
              className="w-72 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-600 text-sm bg-[#242424] border border-[#3A3A3A] rounded-xl">
            {folioSearch.trim()
              ? "Sin resultados para esa búsqueda."
              : "Sin pedidos registrados. Crea el primero con el botón de arriba."}
          </div>
        ) : (
          <div className="space-y-2">
            {pedidosFiltrados.map((p) => {
              const asignado = !!(p.hora && p.choferes && (p.choferes as unknown[]).length > 0);
              return (
                <div key={p.id}
                  className="bg-[#242424] border border-[#3A3A3A] rounded-xl px-4 py-3 flex items-start gap-4 hover:border-[#4A4A4A] transition-colors">
                  {/* Fecha */}
                  <div className="shrink-0 w-14 text-center">
                    <p className="text-[10px] text-gray-500 uppercase">{new Date(p.dia + "T12:00:00").toLocaleDateString("es-MX", { month: "short" })}</p>
                    <p className="text-xl font-bold text-white leading-none">{new Date(p.dia + "T12:00:00").getDate()}</p>
                    <p className="text-[10px] text-gray-500">{new Date(p.dia + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short" })}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Feature 2: folio clickeable que abre timeline */}
                    {p.folio && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setTimelineProg(p); setShowTimeline(true); }}
                        className="text-[10px] font-mono font-semibold text-[#CC2229] hover:text-[#FF3A42] transition-colors mb-0.5"
                      >
                        #{p.folio}
                      </button>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.cliente}</p>
                        {p.cliente && catalogoNombres.size > 0 && !catalogoNombres.has(p.cliente.trim().toLowerCase()) && (
                          <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            Sin vínculo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Feature 3: badge Entregado */}
                        {p.fase === "Entregado" && (
                          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Entregado
                          </span>
                        )}
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${asignado ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/15 text-amber-400 border border-amber-500/20"}`}>
                          {asignado ? "Asignado" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      {p.direccion && (
                        isUrl(p.direccion) ? (
                          <a
                            href={p.direccion}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <MapPin size={10} /> Ver ubicación
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{p.direccion}</span>
                        )
                      )}
                      {p.m3Totales != null && (
                        <span className="text-xs text-blue-400 font-semibold">{p.m3Totales} m³</span>
                      )}
                      {p.tdBom && (
                        <span className="text-xs text-gray-500">{p.tdBom}</span>
                      )}
                      {p.extras && (
                        <span className="text-xs text-gray-500 truncate max-w-[160px]">{p.extras}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {p.telefono && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Phone size={10} /> {p.telefono}
                        </span>
                      )}
                      {p.diaHoraPedido && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <Clock size={10} /> Pedido: {fmtHoraPedido(p.diaHoraPedido)}
                        </span>
                      )}
                      {/* Feature 2: badge de acceso especial */}
                      {p.notasAcceso && (
                        <span className="text-[10px] text-orange-400 flex items-center gap-1">
                          <AlertTriangle size={9} /> Acceso especial
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Feature 3: botón Cerrar */}
                    {p.fase !== "Entregado" && (
                      <button
                        onClick={() => { setCierreProg(p); setCierreNotas(p.notasAcceso ?? ""); setShowCierre(true); }}
                        className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg px-3 py-1.5 transition-colors cursor-pointer hover:border-emerald-500/50"
                      >
                        Cerrar
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(p); setShowDrawer(true); }}
                      className="shrink-0 text-xs text-gray-500 hover:text-white border border-[#3A3A3A] rounded-lg px-3 py-1.5 transition-colors cursor-pointer hover:border-[#4A4A4A]"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature 3: Modal de cierre */}
      {showCierre && cierreProg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCierre(false)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl w-full max-w-md flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Cerrar pedido</h3>
                <p className="text-xs text-gray-500 mt-0.5">{cierreProg.folio} · {cierreProg.cliente}</p>
              </div>
              <button onClick={() => setShowCierre(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Notas de acceso a la ubicación
              </label>
              <textarea
                value={cierreNotas}
                onChange={(e) => setCierreNotas(e.target.value)}
                rows={4}
                placeholder="Ej: Acceso difícil por rampa en terreno. Llegar 15 min antes. Portón derecho."
                className="w-full bg-[#242424] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229] resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">Se guardan para pedidos futuros a esta ubicación.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCierre(false)} className="flex-1 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">
                Cancelar
              </button>
              <button onClick={handleCierre} disabled={cierreSaving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50">
                {cierreSaving ? "Guardando…" : "Marcar como Entregado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: Modal de timeline */}
      {showTimeline && timelineProg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTimeline(false)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl w-full max-w-md flex flex-col shadow-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-white">Rastreo del pedido</h3>
                <p className="text-xs text-gray-500 mt-0.5">{timelineProg.folio} · {timelineProg.cliente}</p>
              </div>
              <button onClick={() => setShowTimeline(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
            </div>

            {/* Datos del pedido */}
            <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 text-xs text-gray-400 space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-gray-600 mb-0.5">Folio</p>
                  <p className="text-white font-mono font-semibold">{timelineProg.folio ?? "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-0.5">Fase actual</p>
                  <p className={timelineProg.fase === "Entregado" ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{timelineProg.fase ?? "Creado"}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-0.5">Cliente</p>
                  <p className="text-white">{timelineProg.cliente || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-0.5">Vendedor</p>
                  <p className="text-white">{timelineProg.vendedor || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-0.5">Día de entrega</p>
                  <p className="text-white">{timelineProg.dia || "—"}</p>
                </div>
                {timelineProg.hora && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Hora de llegada</p>
                    <p className="text-white font-semibold">{timelineProg.hora}</p>
                  </div>
                )}
                {timelineProg.m3Totales != null && (
                  <div>
                    <p className="text-gray-600 mb-0.5">m³ pedidos</p>
                    <p className="text-blue-400 font-semibold">{timelineProg.m3Totales} m³</p>
                  </div>
                )}
                {timelineProg.tdBom && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Tipo</p>
                    <p className="text-white">{timelineProg.tdBom}</p>
                  </div>
                )}
                {timelineProg.resistencia && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Resistencia</p>
                    <p className="text-white">{timelineProg.resistencia}</p>
                  </div>
                )}
                {timelineProg.precioM3 != null && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Precio / m³</p>
                    <p className="text-white">${timelineProg.precioM3.toLocaleString("es-MX")}</p>
                  </div>
                )}
                {timelineProg.total != null && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Total</p>
                    <p className="text-white font-semibold">${timelineProg.total.toLocaleString("es-MX")}</p>
                  </div>
                )}
                {timelineProg.pagado && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Pagado</p>
                    <p className={timelineProg.pagado === "Sí" ? "text-emerald-400 font-semibold" : "text-amber-400"}>{timelineProg.pagado}</p>
                  </div>
                )}
                {timelineProg.credito && (
                  <div>
                    <p className="text-gray-600 mb-0.5">Crédito</p>
                    <p className="text-white">{timelineProg.credito}</p>
                  </div>
                )}
                {timelineProg.exhibiciones && (
                  <div className="col-span-2 border-t border-[#3A3A3A] pt-2.5 mt-1">
                    <p className="text-gray-600 mb-1.5 font-semibold">{timelineProg.exhibiciones === "2" ? "Pago en 2 exhibiciones" : "Fecha de pago"}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-gray-600 mb-0.5">{timelineProg.exhibiciones === "2" ? "Exhibición 1 — Fecha" : "Fecha"}</p>
                        <p className="text-white">{timelineProg.fechaPago || "—"}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-0.5">{timelineProg.exhibiciones === "2" ? "Exhibición 1 — Método" : "Método"}</p>
                        <p className="text-white">{timelineProg.metodoPago || "—"}</p>
                      </div>
                      {timelineProg.exhibiciones === "2" && (
                        <>
                          {timelineProg.montoPagado != null && (
                            <div>
                              <p className="text-gray-600 mb-0.5">Exhibición 1 — Monto</p>
                              <p className="text-white">${timelineProg.montoPagado.toLocaleString("es-MX")}</p>
                            </div>
                          )}
                          {timelineProg.montoPago2 != null && (
                            <div>
                              <p className="text-gray-600 mb-0.5">Exhibición 2 — Monto</p>
                              <p className="text-white">${timelineProg.montoPago2.toLocaleString("es-MX")}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-600 mb-0.5">Exhibición 2 — Fecha</p>
                            <p className="text-white">{timelineProg.fechaPago2 || "—"}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-0.5">Exhibición 2 — Método</p>
                            <p className="text-white">{timelineProg.metodoPago2 || "—"}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {timelineProg.extras && (
                <div className="border-t border-[#3A3A3A] pt-2.5">
                  <p className="text-gray-600 mb-0.5">Extras</p>
                  <p className="text-gray-300">{timelineProg.extras}</p>
                </div>
              )}
              {Array.isArray(timelineProg.choferes) && (timelineProg.choferes as unknown[]).length > 0 && (
                <div className="border-t border-[#3A3A3A] pt-2.5">
                  <p className="text-gray-600 mb-1">Choferes / Unidades asignadas</p>
                  <div className="space-y-1">
                    {(timelineProg.choferes as { nombre?: string; unidad?: string; m3?: number }[]).map((c, i) => (
                      <p key={i} className="text-gray-300">
                        {c.nombre || `Chofer ${i + 1}`}{c.unidad ? ` · ${c.unidad}` : ""}{c.m3 ? ` · ${c.m3} m³` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {timelineProg.notas && (
                <div className="border-t border-[#3A3A3A] pt-2.5">
                  <p className="text-gray-600 mb-0.5">Notas generales</p>
                  <p className="text-gray-300">{timelineProg.notas}</p>
                </div>
              )}
              {timelineProg.vehiculoSamsaraId && (
                <div className="border-t border-[#3A3A3A] pt-2.5">
                  <p className="text-gray-600 mb-0.5">Unidad Samsara</p>
                  <p className="text-white font-mono">{timelineProg.vehiculoSamsaraId}</p>
                </div>
              )}
            </div>

            {/* Timeline de fases */}
            <div className="space-y-0">
              {(timelineProg.historial ?? [{ fase: "Creado", fecha: "", usuario: timelineProg.vendedor }]).map((entry, i) => {
                const isLast = i === (timelineProg.historial?.length ?? 1) - 1;
                const color = entry.fase === "Entregado" ? "text-emerald-400 border-emerald-500" :
                  entry.fase === "Cancelado" ? "text-red-400 border-red-500" :
                  entry.fase === "En camino" ? "text-blue-400 border-blue-500" : "text-amber-400 border-amber-500";
                return (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 bg-[#1A1A1A] ${color}`}>
                        <div className="w-2 h-2 rounded-full bg-current" />
                      </div>
                      {!isLast && <div className="w-0.5 flex-1 bg-[#3A3A3A] my-1" />}
                    </div>
                    <div className={`pb-4 ${isLast ? "" : ""}`}>
                      <p className={`text-sm font-semibold ${color.split(" ")[0]}`}>{entry.fase}</p>
                      {entry.fecha && <p className="text-xs text-gray-600 mt-0.5">{new Date(entry.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</p>}
                      {entry.usuario && <p className="text-xs text-gray-600">{entry.usuario}</p>}
                      {entry.nota && (
                        <div className="mt-1.5 bg-[#242424] border border-[#3A3A3A] rounded-lg px-3 py-2">
                          <p className="text-xs text-gray-300">{entry.nota}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Fase futura Samsara */}
              <div className="flex gap-4 opacity-30">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">GPS en tiempo real</p>
                  <p className="text-xs text-gray-600">Proximamente · Integracion Samsara</p>
                </div>
              </div>
            </div>

            {timelineProg.notasAcceso && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-orange-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Notas de acceso
                </p>
                <p className="text-xs text-gray-300">{timelineProg.notasAcceso}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <PedidoDrawer
        open={showDrawer}
        prog={editing}
        clientesList={clientesList}
        obrasData={obrasData}
        rawClientes={rawClientes}
        vendedorNombre={vendedorNombre}
        onClose={() => { setShowDrawer(false); setEditing(null); }}
        onSave={handleSave}
        onSaveCliente={handleSaveCliente}
        onSaveObra={(cliente, nombre, direccion) => void autoSaveObra(cliente, nombre, direccion)}
      />
    </div>
  );
}
