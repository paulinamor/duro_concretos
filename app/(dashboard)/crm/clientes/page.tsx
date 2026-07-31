"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  GitMerge,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  estatusCliente,
  tiposCliente,
  type CalificacionCliente,
  type Cliente,
  type EstatusCliente,
  type TipoCliente,
} from "@/lib/crmClientes";
import { COLLECTIONS, deleteDocument, getCollectionDocs, upsertDocument } from "@/lib/db";

const DIAS_CREDITO_OPTIONS = ["0", "15", "30", "45", "60", "90"];
const CALIFICACION_OPTIONS: CalificacionCliente[] = ["A", "B", "C"];

const calificacionBadge: Record<CalificacionCliente, string> = {
  A: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  B: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  C: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
};

const tipoBadge: Record<TipoCliente, string> = {
  Constructora: "bg-blue-500/10 text-blue-300",
  Gobierno: "bg-violet-500/10 text-violet-300",
  Particular: "bg-slate-500/10 text-gray-300",
  Inmobiliaria: "bg-orange-500/10 text-orange-300",
  Industrial: "bg-amber-500/10 text-amber-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeNombre(s: string) {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function cascadeRename(oldName: string, newName: string) {
  if (!oldName || oldName === newName) return;
  const normOld = normalizeNombre(oldName);

  const updateField = async (coll: string, field: "cliente" | "contraparte") => {
    const docs = await getCollectionDocs<{ id: string; cliente?: string; contraparte?: string }>(coll);
    const matches = docs.filter((d) => normalizeNombre(d[field] ?? "") === normOld);
    await Promise.all(matches.map((d) => {
      const { id, ...rest } = d;
      return upsertDocument(coll, id, { ...rest, [field]: newName });
    }));
  };

  await Promise.all([
    updateField(COLLECTIONS.programaciones, "cliente"),
    updateField(COLLECTIONS.efectivo, "cliente"),
    updateField(COLLECTIONS.remisiones, "cliente"),
    updateField(COLLECTIONS.cuentasPorCobrar, "contraparte"),
    updateField(COLLECTIONS.cuentasPorPagar, "contraparte"),
  ]);
}

function mergeData(winner: Cliente, ...losers: Cliente[]): Partial<Cliente> {
  const all = [winner, ...losers];
  const notas = all.map((c) => c.notas).filter(Boolean).join(" | ");
  const ultimaCompra =
    all.map((c) => c.ultimaCompra ?? "").filter((v) => v && v !== "—").sort().at(-1) ?? winner.ultimaCompra;
  return {
    m3Acumulados: all.reduce((s, c) => s + (c.m3Acumulados ?? 0), 0),
    totalComprasAnio: all.reduce((s, c) => s + (c.totalComprasAnio ?? 0), 0),
    saldoPendiente: all.reduce((s, c) => s + (c.saldoPendiente ?? 0), 0),
    limiteCredito: Math.max(...all.map((c) => c.limiteCredito ?? 0)),
    notas,
    ultimaCompra,
  };
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface ClienteForm {
  razonSocial: string;
  nombreComercial: string;
  rfc: string;
  domicilio: string;
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  tipoCliente: TipoCliente;
  vendedorAsignado: string;
  calificacion: CalificacionCliente;
  diasCredito: string;
  limiteCredito: string;
  saldoPendiente: string;
  estatus: EstatusCliente;
  notas: string;
}

function emptyForm(): ClienteForm {
  return {
    razonSocial: "", nombreComercial: "", rfc: "", domicilio: "", colonia: "",
    municipio: "", estado: "Nuevo León", cp: "", contacto: "", cargo: "",
    telefono: "", email: "", tipoCliente: "Constructora",
    vendedorAsignado: "", calificacion: "B", diasCredito: "30",
    limiteCredito: "0", saldoPendiente: "0", estatus: "Activo", notas: "",
  };
}

function fromCliente(c: Cliente): ClienteForm {
  return {
    razonSocial: c.razonSocial ?? "",
    nombreComercial: c.nombreComercial ?? "",
    rfc: c.rfc ?? "",
    domicilio: c.domicilio ?? "",
    colonia: c.colonia ?? "",
    municipio: c.municipio ?? "",
    estado: c.estado ?? "Nuevo León",
    cp: c.cp ?? "",
    contacto: c.contacto ?? "",
    cargo: c.cargo ?? "",
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    tipoCliente: c.tipoCliente ?? "Constructora",
    vendedorAsignado: c.vendedorAsignado ?? "",
    calificacion: c.calificacion ?? "B",
    diasCredito: c.diasCredito ? String(c.diasCredito) : "30",
    limiteCredito: c.limiteCredito ? String(c.limiteCredito) : "0",
    saldoPendiente: c.saldoPendiente ? String(c.saldoPendiente) : "0",
    estatus: c.estatus ?? "Activo",
    notas: c.notas ?? "",
  };
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

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

function ClienteDrawer({ open, editing, onClose, onSave, errorMsg, vendedoresList = [] }: {
  open: boolean;
  editing: Cliente | null;
  onClose: () => void;
  onSave: (f: ClienteForm) => Promise<string | false | void>;
  errorMsg: string;
  vendedoresList?: string[];
}) {
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLocalError("");
    setForm(editing ? fromCliente(editing) : emptyForm());
  }, [open, editing]);

  const set = <K extends keyof ClienteForm>(k: K, v: ClienteForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.razonSocial.trim() || !form.rfc.trim() || !form.contacto.trim()) {
      setLocalError("Razón social, RFC y contacto son obligatorios.");
      return;
    }
    setSaving(true);
    setLocalError("");
    try {
      const result = await onSave(form);
      if (typeof result === "string") setLocalError(result);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const displayError = localError || errorMsg;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {editing ? `Editar — ${editing.razonSocial}` : "Nuevo cliente"}
            </h2>
            <p className="text-xs text-gray-500">Razón social, RFC y contacto son obligatorios</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {displayError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {displayError}
            </div>
          )}

          <div>
            <SectionDivider label="Datos fiscales" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Razón social <span className="text-[#CC2229]">*</span></label>
                <input
                  type="text"
                  value={form.razonSocial}
                  onChange={(e) => set("razonSocial", e.target.value.toUpperCase())}
                  placeholder="NOMBRE FISCAL COMPLETO"
                  className={`${inp} uppercase`}
                />
              </div>
              <div>
                <label className={lbl}>Nombre comercial</label>
                <input type="text" value={form.nombreComercial} onChange={(e) => set("nombreComercial", e.target.value)} placeholder="Nombre de marca" className={inp} />
              </div>
              <div>
                <label className={lbl}>RFC <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} placeholder="RFC" className={`${inp} uppercase`} />
              </div>
            </div>
          </div>

          <div>
            <SectionDivider label="Domicilio" />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Domicilio</label>
                <input type="text" value={form.domicilio} onChange={(e) => set("domicilio", e.target.value)} placeholder="Calle y número" className={inp} />
              </div>
              <div>
                <label className={lbl}>Colonia</label>
                <input type="text" value={form.colonia} onChange={(e) => set("colonia", e.target.value)} placeholder="Colonia" className={inp} />
              </div>
              <div>
                <label className={lbl}>Municipio</label>
                <input type="text" value={form.municipio} onChange={(e) => set("municipio", e.target.value)} placeholder="Municipio" className={inp} />
              </div>
              <div>
                <label className={lbl}>Estado</label>
                <input type="text" value={form.estado} onChange={(e) => set("estado", e.target.value)} placeholder="Estado" className={inp} />
              </div>
              <div>
                <label className={lbl}>C.P.</label>
                <input type="text" value={form.cp} onChange={(e) => set("cp", e.target.value)} placeholder="Código postal" className={inp} />
              </div>
            </div>
          </div>

          <div>
            <SectionDivider label="Contacto" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Contacto principal <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="Nombre del contacto" className={inp} />
              </div>
              <div>
                <label className={lbl}>Cargo</label>
                <input type="text" value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ej. Director de compras" className={inp} />
              </div>
              <div>
                <label className={lbl}>Teléfono</label>
                <input type="text" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="81 1234 5678" className={inp} />
              </div>
              <div>
                <label className={lbl}>Correo electrónico</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@empresa.com" className={inp} />
              </div>
            </div>
          </div>

          <div>
            <SectionDivider label="Clasificación y crédito" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo de cliente</label>
                <select value={form.tipoCliente} onChange={(e) => set("tipoCliente", e.target.value as TipoCliente)} className={inp}>
                  {tiposCliente.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Vendedor asignado</label>
                <input
                  list="vendedores-list"
                  type="text"
                  value={form.vendedorAsignado}
                  onChange={(e) => set("vendedorAsignado", e.target.value)}
                  placeholder="Nombre del vendedor"
                  className={inp}
                  autoComplete="off"
                />
                <datalist id="vendedores-list">
                  {vendedoresList.map((v) => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div>
                <label className={lbl}>Calificación</label>
                <select value={form.calificacion} onChange={(e) => set("calificacion", e.target.value as CalificacionCliente)} className={inp}>
                  {CALIFICACION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Días de crédito</label>
                <select value={form.diasCredito} onChange={(e) => set("diasCredito", e.target.value)} className={inp}>
                  {DIAS_CREDITO_OPTIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Límite de crédito</label>
                <input type="text" value={form.limiteCredito} onChange={(e) => set("limiteCredito", e.target.value)} placeholder="0" className={inp} />
              </div>
              <div>
                <label className={lbl}>Saldo pendiente</label>
                <input type="text" value={form.saldoPendiente} onChange={(e) => set("saldoPendiente", e.target.value)} placeholder="0" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Estatus</label>
                <select value={form.estatus} onChange={(e) => set("estatus", e.target.value as EstatusCliente)} className={inp}>
                  {estatusCliente.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <SectionDivider label="Notas" />
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              placeholder="Observaciones, condiciones especiales, etc."
              className={`${inp} resize-none`}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.razonSocial.trim() || !form.rfc.trim() || !form.contacto.trim()}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrmClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusCliente | "Todos">("Todos");
  const [filtroTipo, setFiltroTipo] = useState<TipoCliente | "Todos">("Todos");
  const [filtroVendedor, setFiltroVendedor] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [detail, setDetail] = useState<Cliente | null>(null);
  const [saveError, setSaveError] = useState("");
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [dedupKeep, setDedupKeep] = useState<Record<string, string>>({});
  const [normalizingAll, setNormalizingAll] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergePartner, setMergePartner] = useState<Cliente | null>(null);
  const [mergeWinnerId, setMergeWinnerId] = useState<string | null>(null);
  const [mergingClients, setMergingClients] = useState(false);

  useEffect(() => {
    getCollectionDocs<Cliente>(COLLECTIONS.clientes)
      .then(setClientes)
      .finally(() => setLoading(false));
  }, []);


  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return clientes.filter((c) => {
      const matchQuery =
        !term ||
        c.razonSocial.toLowerCase().includes(term) ||
        (c.nombreComercial ?? "").toLowerCase().includes(term) ||
        c.rfc.toLowerCase().includes(term) ||
        c.contacto.toLowerCase().includes(term) ||
        c.municipio.toLowerCase().includes(term);
      const matchEstatus = filtroEstatus === "Todos" || c.estatus === filtroEstatus;
      const matchTipo = filtroTipo === "Todos" || c.tipoCliente === filtroTipo;
      const matchVendedor = filtroVendedor === "Todos" || c.vendedorAsignado === filtroVendedor;
      return matchQuery && matchEstatus && matchTipo && matchVendedor;
    }).sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, "es", { sensitivity: "base" }));
  }, [clientes, query, filtroEstatus, filtroTipo, filtroVendedor]);

  const vendedoresActivos = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.vendedorAsignado).filter(Boolean))).sort(),
    [clientes],
  );

  const duplicadoGroups = useMemo(() => {
    const groups = new Map<string, Cliente[]>();
    clientes.forEach((c) => {
      const key = normalizeNombre(c.razonSocial);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    const result: { key: string; members: Cliente[] }[] = [];
    groups.forEach((members, key) => {
      if (members.length > 1) {
        result.push({ key, members: [...members].sort((a, b) => a.fechaAlta.localeCompare(b.fechaAlta)) });
      }
    });
    return result;
  }, [clientes]);

  const mergeSearchResults = useMemo(() => {
    if (!detail) return [];
    const term = mergeQuery.toLowerCase();
    return clientes
      .filter((c) => c.id !== detail.id && (
        !term ||
        c.razonSocial.toLowerCase().includes(term) ||
        (c.nombreComercial ?? "").toLowerCase().includes(term)
      ))
      .slice(0, 10);
  }, [clientes, detail, mergeQuery]);

  function openDedupModal() {
    const defaults: Record<string, string> = {};
    duplicadoGroups.forEach(({ key, members }) => { defaults[key] = members[0].id; });
    setDedupKeep(defaults);
    setShowDedupModal(true);
  }

  async function confirmDedup() {
    const toDelete: string[] = [];
    for (const { key, members } of duplicadoGroups) {
      const keepId = dedupKeep[key] ?? members[0].id;
      const winner = members.find((c) => c.id === keepId)!;
      const losers = members.filter((c) => c.id !== keepId);
      const merged = mergeData(winner, ...losers);
      const { id: wId, ...wData } = winner;
      await upsertDocument(COLLECTIONS.clientes, wId, { ...wData, ...merged });
      for (const loser of losers) {
        await cascadeRename(loser.razonSocial, winner.razonSocial);
        if (loser.nombreComercial && normalizeNombre(loser.nombreComercial) !== normalizeNombre(winner.razonSocial)) {
          await cascadeRename(loser.nombreComercial, winner.razonSocial);
        }
        toDelete.push(loser.id);
      }
    }
    await Promise.all(toDelete.map((id) => deleteDocument(COLLECTIONS.clientes, id)));
    const toDeleteSet = new Set(toDelete);
    setClientes((curr) =>
      curr.filter((c) => !toDeleteSet.has(c.id)).map((c) => {
        const group = duplicadoGroups.find((g) => g.members.some((m) => m.id === c.id));
        if (!group) return c;
        const keepId = dedupKeep[group.key] ?? group.members[0].id;
        if (c.id !== keepId) return c;
        return { ...c, ...mergeData(c, ...group.members.filter((m) => m.id !== keepId)) };
      }),
    );
    setShowDedupModal(false);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "success", message: `${toDelete.length} duplicado${toDelete.length !== 1 ? "s" : ""} fusionado${toDelete.length !== 1 ? "s" : ""} y referencias actualizadas.` },
    }));
  }

  async function normalizeAll() {
    const toUpdate = clientes.filter((c) => c.razonSocial !== c.razonSocial.toUpperCase());
    if (toUpdate.length === 0) {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "info", message: "Todos los nombres ya están en mayúsculas." } }));
      return;
    }
    setNormalizingAll(true);
    try {
      await Promise.all(toUpdate.map((c) => {
        const { id, ...data } = c;
        return upsertDocument(COLLECTIONS.clientes, id, { ...data, razonSocial: c.razonSocial.toUpperCase() });
      }));
      setClientes((curr) => curr.map((c) => ({ ...c, razonSocial: c.razonSocial.toUpperCase() })));
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `${toUpdate.length} nombre${toUpdate.length !== 1 ? "s" : ""} normalizado${toUpdate.length !== 1 ? "s" : ""}.` },
      }));
    } finally {
      setNormalizingAll(false);
    }
  }

  async function executeMerge() {
    if (!detail || !mergePartner || !mergeWinnerId) return;
    setMergingClients(true);
    try {
      const isDetailWinner = mergeWinnerId === detail.id;
      const winner = isDetailWinner ? detail : mergePartner;
      const loser = isDetailWinner ? mergePartner : detail;
      const merged = { ...winner, ...mergeData(winner, loser) };
      const { id: wId, ...wData } = merged;
      await upsertDocument(COLLECTIONS.clientes, wId, wData);
      await cascadeRename(loser.razonSocial, winner.razonSocial);
      if (loser.nombreComercial && normalizeNombre(loser.nombreComercial) !== normalizeNombre(winner.razonSocial)) {
        await cascadeRename(loser.nombreComercial, winner.razonSocial);
      }
      await deleteDocument(COLLECTIONS.clientes, loser.id);
      setClientes((curr) => curr.filter((c) => c.id !== loser.id).map((c) => c.id === winner.id ? merged : c));
      setDetail(isDetailWinner ? merged : null);
      setShowMergeModal(false);
      setMergePartner(null);
      setMergeQuery("");
      setMergeWinnerId(null);
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `"${loser.razonSocial}" fusionado en "${winner.razonSocial}". Referencias actualizadas.` },
      }));
    } finally {
      setMergingClients(false);
    }
  }

  const totalActivos = clientes.filter((c) => c.estatus === "Activo").length;
  const totalCarteraAnio = clientes.reduce((sum, c) => sum + c.totalComprasAnio, 0);
  const totalSaldoPendiente = clientes.reduce((sum, c) => sum + c.saldoPendiente, 0);
  const nuevosEsteAnio = clientes.filter((c) => c.fechaAlta.startsWith("2026")).length;

  function openCreate() { setSaveError(""); setEditing(null); setShowForm(true); }

  function openEdit(c: Cliente) { setSaveError(""); setDetail(null); setEditing(c); setShowForm(true); }

  async function handleDelete(id: string) {
    setClientes((current) => current.filter((c) => c.id !== id));
    if (detail?.id === id) setDetail(null);
    await deleteDocument(COLLECTIONS.clientes, id);
  }

  async function handleSave(f: ClienteForm): Promise<string | false | void> {
    const razonSocial = f.razonSocial.trim().toUpperCase();
    const rfc = f.rfc.trim().toUpperCase();
    const contacto = f.contacto.trim();
    if (!razonSocial || !rfc || !contacto) return false;

    const isDuplicateRFC = rfc.length > 3 && clientes.some(
      (c) => c.rfc.toUpperCase() === rfc && c.id !== editing?.id,
    );
    if (isDuplicateRFC) return "Ya existe un cliente con ese RFC.";

    const isDuplicateName = clientes.some(
      (c) => normalizeNombre(c.razonSocial) === normalizeNombre(razonSocial) && c.id !== editing?.id,
    );
    if (isDuplicateName) return "Ya existe un cliente con esa razón social.";

    const id = editing?.id ?? `CL-${Date.now()}`;
    const next: Cliente = {
      id,
      razonSocial,
      nombreComercial: f.nombreComercial || razonSocial,
      rfc,
      domicilio: f.domicilio,
      colonia: f.colonia,
      municipio: f.municipio,
      estado: f.estado || "Nuevo León",
      cp: f.cp,
      contacto,
      cargo: f.cargo,
      telefono: f.telefono,
      email: f.email,
      tipoCliente: f.tipoCliente,
      vendedorAsignado: f.vendedorAsignado,
      limiteCredito: Number(f.limiteCredito?.replace(/[$,]/g, "") ?? 0),
      saldoPendiente: Number(f.saldoPendiente?.replace(/[$,]/g, "") ?? 0),
      diasCredito: Number(f.diasCredito ?? 30),
      ultimaCompra: editing?.ultimaCompra ?? "—",
      totalComprasAnio: editing?.totalComprasAnio ?? 0,
      m3Acumulados: editing?.m3Acumulados ?? 0,
      estatus: f.estatus,
      calificacion: f.calificacion,
      fechaAlta: editing?.fechaAlta ?? new Date().toISOString().split("T")[0],
      notas: f.notas,
    };

    setClientes((current) =>
      editing ? current.map((c) => (c.id === editing.id ? next : c)) : [next, ...current],
    );
    const { id: _id, ...data } = next;
    await upsertDocument(COLLECTIONS.clientes, _id, data);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: editing ? "Cliente actualizado." : "Cliente creado." } }));
  }

  function exportExcel() {
    const rows = clientes.map((c) => `<tr>
      <td>${c.id}</td><td>${c.razonSocial}</td><td>${c.rfc}</td>
      <td>${c.municipio}, ${c.estado}</td><td>${c.tipoCliente}</td>
      <td>${c.contacto}</td><td>${c.telefono}</td><td>${c.email}</td>
      <td>${c.vendedorAsignado}</td><td>${c.limiteCredito}</td>
      <td>${c.saldoPendiente}</td><td>${c.diasCredito}</td>
      <td>${c.ultimaCompra}</td><td>${c.totalComprasAnio}</td>
      <td>${c.m3Acumulados}</td><td>${c.estatus}</td><td>${c.calificacion}</td>
    </tr>`).join("");
    const html = `<html><head><meta charset="UTF-8"/></head><body><table>
      <thead><tr>
        <th>ID</th><th>Razón Social</th><th>RFC</th><th>Ubicación</th><th>Tipo</th>
        <th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Vendedor</th>
        <th>Límite Crédito</th><th>Saldo</th><th>Días Crédito</th>
        <th>Última Compra</th><th>Compras Año</th><th>m3 Acumulados</th>
        <th>Estatus</th><th>Calificación</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "clientes-duro-concretos.xls";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const creditoUtilizado = (c: Cliente) => {
    if (!c.limiteCredito) return 0;
    return Math.round((c.saldoPendiente / c.limiteCredito) * 100);
  };

  function closeMergeModal() {
    setShowMergeModal(false); setMergePartner(null); setMergeQuery(""); setMergeWinnerId(null);
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total clientes" value={String(clientes.length)} icon={Users} />
        <KPICard title="Clientes activos" value={String(totalActivos)} icon={UserCheck} iconColor="text-green-400" iconBg="bg-green-500/10" />
        <KPICard
          title="Cartera anual"
          value={`$${(totalCarteraAnio / 1000000).toFixed(1)}M`}
          icon={TrendingUp}
          iconColor="text-[#CC2229]"
          subtitle={`$${Math.round(totalSaldoPendiente).toLocaleString()} pendiente`}
        />
        <KPICard title="Nuevos en 2026" value={String(nuevosEsteAnio)} icon={BadgeDollarSign} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
      </div>


      {/* Toolbar */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar razón social, nombre comercial, RFC, municipio..."
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        {[
          { value: filtroEstatus, onChange: (v: string) => setFiltroEstatus(v as EstatusCliente | "Todos"), options: ["Todos los estatus", ...estatusCliente] },
          { value: filtroTipo, onChange: (v: string) => setFiltroTipo(v as TipoCliente | "Todos"), options: ["Todos los tipos", ...tiposCliente] },
          { value: filtroVendedor, onChange: (v: string) => setFiltroVendedor(v), options: ["Todos los vendedores", ...vendedoresActivos] },
        ].map(({ value, onChange, options }, idx) => (
          <div key={idx} className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="appearance-none bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              {options.map((opt) => <option key={opt}>{opt}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        ))}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} clientes</span>
        {duplicadoGroups.length > 0 && (
          <button
            type="button"
            onClick={openDedupModal}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors"
          >
            <GitMerge size={14} />
            {duplicadoGroups.length} duplicado{duplicadoGroups.length !== 1 ? "s" : ""}
          </button>
        )}
        <button
          type="button"
          onClick={normalizeAll}
          disabled={normalizingAll}
          title="Convertir todas las razones sociales a mayúsculas"
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-400 hover:border-blue-500/40 hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          {normalizingAll ? "Normalizando…" : "Normalizar todo"}
        </button>
        <button
          type="button"
          onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-green-300 transition-colors"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Nuevo cliente
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#1A1A1A]">
              <tr className="border-b border-[#3A3A3A]">
                {["Razón Social / RFC", "Municipio", "Tipo", "Contacto", "Vendedor", "Crédito", "Saldo", "Estatus", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500">Cargando clientes...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-500">No se encontraron clientes con ese filtro.</td></tr>
              ) : (
                filtered.map((c) => {
                  const pct = creditoUtilizado(c);
                  return (
                    <tr key={c.id} className="transition-colors cursor-pointer hover:bg-[#2A2A2A]" onClick={() => setDetail(c)}>
                      <td className="px-4 py-3 max-w-[240px]">
                        <p className="text-white font-medium">{c.razonSocial}</p>
                        {c.nombreComercial && c.nombreComercial !== c.razonSocial && (
                          <p className="text-gray-400 text-xs italic mt-0.5">{c.nombreComercial}</p>
                        )}
                        <p className="text-gray-500 text-xs font-mono mt-0.5 whitespace-nowrap">{c.rfc}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs"><MapPin size={11} className="shrink-0" />{c.municipio}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tipoBadge[c.tipoCliente]}`}>{c.tipoCliente}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-300 whitespace-nowrap">{c.contacto}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{c.cargo}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-sm">{c.vendedorAsignado}</td>
                      <td className="px-4 py-3">
                        {c.limiteCredito > 0 ? (
                          <div>
                            <p className="text-gray-300 text-sm whitespace-nowrap">${c.limiteCredito.toLocaleString()}</p>
                            <div className="mt-1 h-1 w-20 rounded-full bg-[#1A1A1A] overflow-hidden">
                              <div className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">Contado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${c.saldoPendiente > 0 ? "text-amber-300" : "text-green-400"}`}>${c.saldoPendiente.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={c.estatus.toLowerCase()} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors" aria-label={`Editar ${c.razonSocial}`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors" aria-label={`Eliminar ${c.razonSocial}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="relative h-full w-full max-w-xl overflow-y-auto bg-[#181b20] border-l border-[#3A3A3A] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#3A3A3A] bg-[#181b20]/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shrink-0 ${calificacionBadge[detail.calificacion]}`}>{detail.calificacion}</span>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm leading-tight truncate">{detail.razonSocial}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 font-mono">{detail.rfc}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/8 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.estatus.toLowerCase()} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge[detail.tipoCliente]}`}>{detail.tipoCliente}</span>
                <span className="text-gray-500 text-xs ml-auto">Alta: {detail.fechaAlta}</span>
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Datos fiscales y domicilio</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-2.5">
                  <DetailRow icon={Building2} label="Nombre comercial" value={detail.nombreComercial} />
                  <DetailRow icon={MapPin} label="Domicilio" value={`${detail.domicilio}, Col. ${detail.colonia}`} />
                  <DetailRow icon={MapPin} label="Municipio / Estado / C.P." value={`${detail.municipio}, ${detail.estado} ${detail.cp}`} />
                </div>
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Contacto</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-2.5">
                  <DetailRow icon={User} label="Nombre" value={`${detail.contacto}${detail.cargo ? ` · ${detail.cargo}` : ""}`} />
                  <DetailRow icon={Phone} label="Teléfono" value={detail.telefono} />
                  <DetailRow icon={Mail} label="Correo" value={detail.email} />
                </div>
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Información comercial</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Compras año" value={`$${detail.totalComprasAnio.toLocaleString()}`} color="text-white" />
                    <StatBox label="m3 acumulados" value={`${detail.m3Acumulados.toLocaleString()} m3`} color="text-blue-300" />
                    <StatBox label="Última compra" value={detail.ultimaCompra} color="text-gray-300" />
                    <StatBox label="Vendedor" value={detail.vendedorAsignado} color="text-gray-300" />
                  </div>
                </div>
              </div>

              {detail.limiteCredito > 0 && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Crédito</p>
                  <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <StatBox label="Límite de crédito" value={`$${detail.limiteCredito.toLocaleString()}`} color="text-white" />
                      <StatBox label="Saldo pendiente" value={`$${detail.saldoPendiente.toLocaleString()}`} color={detail.saldoPendiente > 0 ? "text-amber-300" : "text-green-400"} />
                      <StatBox label="Días de crédito" value={`${detail.diasCredito} días`} color="text-gray-300" />
                      <StatBox label="% utilizado" value={`${creditoUtilizado(detail)}%`} color={creditoUtilizado(detail) > 90 ? "text-red-400" : "text-gray-300"} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Crédito disponible</span>
                        <span>${Math.max(0, detail.limiteCredito - detail.saldoPendiente).toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#242424] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${creditoUtilizado(detail) > 90 ? "bg-red-500" : creditoUtilizado(detail) > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(creditoUtilizado(detail), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detail.notas && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3">Notas</p>
                  <div className="rounded-xl border border-[#3A3A3A] bg-[#111318] px-4 py-3">
                    <p className="text-gray-300 text-sm leading-relaxed">{detail.notas}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 flex-wrap">
                <button onClick={() => openEdit(detail)} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm text-gray-300 hover:border-[#CC2229]/60 hover:text-white transition-colors">
                  <Pencil size={15} /> Editar
                </button>
                <button
                  onClick={() => { setMergePartner(null); setMergeQuery(""); setMergeWinnerId(null); setShowMergeModal(true); }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm text-gray-400 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
                >
                  <GitMerge size={15} /> Fusionar
                </button>
                <button onClick={() => handleDelete(detail.id)} className="flex items-center justify-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors">
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      <ClienteDrawer
        open={showForm}
        editing={editing}
        onClose={() => { setShowForm(false); setEditing(null); setSaveError(""); }}
        onSave={handleSave}
        errorMsg={saveError}
        vendedoresList={vendedoresActivos}
      />

      {/* Dedup modal */}
      {showDedupModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDedupModal(false)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#3A3A3A] shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10"><GitMerge size={18} className="text-amber-400" /></div>
              <div>
                <h3 className="text-sm font-semibold text-white">Revisar duplicados</h3>
                <p className="text-xs text-gray-500">Elige cuál conservar. Los datos numéricos se suman; el otro se elimina y sus referencias se actualizan.</p>
              </div>
              <button onClick={() => setShowDedupModal(false)} className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {duplicadoGroups.map(({ key, members }) => (
                <div key={key} className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#3A3A3A]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">{members.length} registros · mismo nombre normalizado</span>
                  </div>
                  <div className="divide-y divide-[#3A3A3A]">
                    {members.map((c) => {
                      const isKeep = dedupKeep[key] === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => setDedupKeep((prev) => ({ ...prev, [key]: c.id }))}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${isKeep ? "bg-emerald-500/5" : "hover:bg-white/[0.02]"}`}>
                          <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isKeep ? "border-emerald-500 bg-emerald-500" : "border-gray-600"}`}>
                            {isKeep && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isKeep ? "text-emerald-300" : "text-gray-300"}`}>
                              {c.razonSocial}
                              {isKeep && <span className="ml-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Conservar</span>}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-600">
                              {c.rfc && <span className="font-mono">{c.rfc}</span>}
                              {c.contacto && <span>{c.contacto}</span>}
                              {c.fechaAlta && <span>Alta: {c.fechaAlta}</span>}
                              <span className="text-blue-500/70">{c.m3Acumulados ?? 0} m3 · ${(c.totalComprasAnio ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                          {!isKeep && <Trash2 size={13} className="text-gray-700 mt-0.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-[#3A3A3A] flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Se eliminarán <span className="text-red-400 font-semibold">{duplicadoGroups.reduce((n, { key, members }) => n + members.filter((c) => c.id !== (dedupKeep[key] ?? members[0].id)).length, 0)} registros</span> · datos numéricos se suman al conservado
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDedupModal(false)} className="px-4 py-2 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">Cancelar</button>
                <button onClick={confirmDedup} className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">Confirmar y fusionar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual merge modal */}
      {showMergeModal && detail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMergeModal} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#3A3A3A] shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10"><GitMerge size={18} className="text-violet-400" /></div>
              <div>
                <h3 className="text-sm font-semibold text-white">Fusionar cliente</h3>
                <p className="text-xs text-gray-500">Busca el cliente a fusionar con <span className="text-white">{detail.razonSocial}</span></p>
              </div>
              <button onClick={closeMergeModal} className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {!mergePartner ? (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                      autoFocus
                      value={mergeQuery}
                      onChange={(e) => setMergeQuery(e.target.value)}
                      placeholder="Buscar cliente..."
                      className="w-full bg-[#242424] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                    />
                  </div>
                  <div className="space-y-1">
                    {mergeSearchResults.length === 0 && mergeQuery && (
                      <p className="text-center text-sm text-gray-500 py-4">Sin resultados</p>
                    )}
                    {mergeSearchResults.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setMergePartner(c); setMergeWinnerId(detail.id); }}
                        className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left hover:bg-[#242424] transition-colors cursor-pointer border border-transparent hover:border-[#3A3A3A]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">{c.razonSocial}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{c.rfc} · {c.municipio} · {c.m3Acumulados ?? 0} m3</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-600 mt-0.5 shrink-0" />
                      </button>
                    ))}
                    {!mergeQuery && <p className="text-center text-xs text-gray-600 py-3">Escribe para buscar clientes</p>}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">¿Cuál registro conservar? Los datos numéricos de ambos se sumarán en el ganador.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[detail, mergePartner].map((c) => {
                      const isWinner = mergeWinnerId === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => setMergeWinnerId(c.id)}
                          className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${isWinner ? "border-emerald-500/50 bg-emerald-500/5" : "border-[#3A3A3A] hover:border-gray-500"}`}>
                          <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isWinner ? "text-emerald-400" : "text-gray-600"}`}>
                            {isWinner ? "✓ Conservar" : "Eliminar"}
                          </div>
                          <p className={`text-sm font-semibold leading-tight ${isWinner ? "text-emerald-300" : "text-gray-400"}`}>{c.razonSocial}</p>
                          <p className="text-xs text-gray-600 font-mono mt-1">{c.rfc}</p>
                          <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                            <p>{c.m3Acumulados ?? 0} m3 · ${(c.totalComprasAnio ?? 0).toLocaleString()}</p>
                            <p>Saldo: ${(c.saldoPendiente ?? 0).toLocaleString()}</p>
                            {c.notas && <p className="italic truncate">{c.notas}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-xl bg-[#242424] border border-[#3A3A3A] px-4 py-3 text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-400">Resultado fusionado</p>
                    <p>m3: {((detail.m3Acumulados ?? 0) + (mergePartner.m3Acumulados ?? 0)).toLocaleString()}</p>
                    <p>Compras año: ${((detail.totalComprasAnio ?? 0) + (mergePartner.totalComprasAnio ?? 0)).toLocaleString()}</p>
                    <p>Saldo: ${((detail.saldoPendiente ?? 0) + (mergePartner.saldoPendiente ?? 0)).toLocaleString()}</p>
                  </div>
                  <button type="button" onClick={() => { setMergePartner(null); setMergeQuery(""); setMergeWinnerId(null); }} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Cambiar cliente</button>
                </>
              )}
            </div>

            {mergePartner && (
              <div className="shrink-0 px-6 py-4 border-t border-[#3A3A3A] flex items-center justify-end gap-3">
                <button onClick={closeMergeModal} className="px-4 py-2 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">Cancelar</button>
                <button onClick={executeMerge} disabled={mergingClients || !mergeWinnerId} className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50">
                  {mergingClients ? "Fusionando…" : "Confirmar fusión"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-gray-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-[#181b20] px-3 py-2.5">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
