"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Fuel,
  Plus,
  Search,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Unidad } from "@/lib/unidades";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "mantenimientos" | "reparaciones" | "fallas";

interface Mantenimiento {
  id?: string;
  fecha: string;
  unidad: string;
  tipo: string;
  descripcion: string;
  costo: number;
  taller: string;
  status: string;
  planta?: string;
}

interface Reparacion {
  id?: string;
  fecha: string;
  unidad: string;
  descripcion: string;
  causa: string;
  costo: number;
  taller: string;
  status: string;
  planta?: string;
}

interface Falla {
  id?: string;
  fecha: string;
  unidad: string;
  descripcion: string;
  severidad: string;
  reportadoPor: string;
  status: string;
  planta?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function currency(n: number) {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

const SEVERIDAD_COLORS: Record<string, string> = {
  Alta:  "bg-red-500/15 text-red-400 border border-red-500/30",
  Media: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  Baja:  "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

const TIPO_COLORS: Record<string, string> = {
  Preventivo:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  Correctivo:  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  "Inspección": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

// ─── Form Drawer ──────────────────────────────────────────────────────────────

function FormDrawer({
  open,
  tab,
  unidadesList,
  onClose,
  onSave,
}: {
  open: boolean;
  tab: Tab;
  unidadesList: string[];
  onClose: () => void;
  onSave: (data: Mantenimiento | Reparacion | Falla) => Promise<void>;
}) {
  const emptyM = () => ({ fecha: todayISO(), unidad: "", tipo: "Preventivo", descripcion: "", costo: "", taller: "", status: "Pendiente" });
  const emptyR = () => ({ fecha: todayISO(), unidad: "", descripcion: "", causa: "", costo: "", taller: "", status: "Pendiente" });
  const emptyF = () => ({ fecha: todayISO(), unidad: "", descripcion: "", severidad: "Media", reportadoPor: "", status: "Reportada" });

  const [fm, setFm] = useState(emptyM());
  const [fr, setFr] = useState(emptyR());
  const [ff, setFf] = useState(emptyF());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setFm(emptyM()); setFr(emptyR()); setFf(emptyF()); }
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      if (tab === "mantenimientos") {
        await onSave({
          fecha: isoToDisplay(fm.fecha),
          unidad: fm.unidad,
          tipo: fm.tipo,
          descripcion: fm.descripcion,
          costo: parseFloat(fm.costo) || 0,
          taller: fm.taller,
          status: fm.status,
        });
      } else if (tab === "reparaciones") {
        await onSave({
          fecha: isoToDisplay(fr.fecha),
          unidad: fr.unidad,
          descripcion: fr.descripcion,
          causa: fr.causa,
          costo: parseFloat(fr.costo) || 0,
          taller: fr.taller,
          status: fr.status,
        });
      } else {
        await onSave({
          fecha: isoToDisplay(ff.fecha),
          unidad: ff.unidad,
          descripcion: ff.descripcion,
          severidad: ff.severidad,
          reportadoPor: ff.reportadoPor,
          status: ff.status,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

  const titles: Record<Tab, string> = {
    mantenimientos: "Registrar mantenimiento",
    reparaciones: "Registrar reparación",
    fallas: "Registrar falla",
  };

  const icons: Record<Tab, React.ReactNode> = {
    mantenimientos: <Wrench size={18} />,
    reparaciones: <Fuel size={18} />,
    fallas: <Zap size={18} />,
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              {icons[tab]}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{titles[tab]}</h2>
              <p className="text-xs text-gray-500">Completa los datos del registro</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === "mantenimientos" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" value={fm.fecha} onChange={(e) => setFm({ ...fm, fecha: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Tipo</label>
                  <select value={fm.tipo} onChange={(e) => setFm({ ...fm, tipo: e.target.value })} className={inp}>
                    <option>Preventivo</option>
                    <option>Correctivo</option>
                    <option>Inspección</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Unidad</label>
                <select value={fm.unidad} onChange={(e) => setFm({ ...fm, unidad: e.target.value })} className={inp}>
                  <option value="">Seleccionar unidad…</option>
                  {unidadesList.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Descripción</label>
                <input type="text" value={fm.descripcion} onChange={(e) => setFm({ ...fm, descripcion: e.target.value })} placeholder="Ej: Cambio de aceite y filtros" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Costo ($)</label>
                  <input type="number" min="0" step="0.01" value={fm.costo} onChange={(e) => setFm({ ...fm, costo: e.target.value })} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={fm.status} onChange={(e) => setFm({ ...fm, status: e.target.value })} className={inp}>
                    <option>Pendiente</option>
                    <option>En proceso</option>
                    <option>Completado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Taller / Proveedor</label>
                <input type="text" value={fm.taller} onChange={(e) => setFm({ ...fm, taller: e.target.value })} placeholder="Nombre del taller" className={inp} />
              </div>
            </>
          )}

          {tab === "reparaciones" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" value={fr.fecha} onChange={(e) => setFr({ ...fr, fecha: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={fr.status} onChange={(e) => setFr({ ...fr, status: e.target.value })} className={inp}>
                    <option>Pendiente</option>
                    <option>En proceso</option>
                    <option>Completado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Unidad</label>
                <select value={fr.unidad} onChange={(e) => setFr({ ...fr, unidad: e.target.value })} className={inp}>
                  <option value="">Seleccionar unidad…</option>
                  {unidadesList.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Descripción de la reparación</label>
                <input type="text" value={fr.descripcion} onChange={(e) => setFr({ ...fr, descripcion: e.target.value })} placeholder="Ej: Reparación de frenos traseros" className={inp} />
              </div>
              <div>
                <label className={lbl}>Causa / Motivo</label>
                <input type="text" value={fr.causa} onChange={(e) => setFr({ ...fr, causa: e.target.value })} placeholder="Ej: Desgaste por uso" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Costo ($)</label>
                  <input type="number" min="0" step="0.01" value={fr.costo} onChange={(e) => setFr({ ...fr, costo: e.target.value })} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Taller / Proveedor</label>
                  <input type="text" value={fr.taller} onChange={(e) => setFr({ ...fr, taller: e.target.value })} placeholder="Nombre del taller" className={inp} />
                </div>
              </div>
            </>
          )}

          {tab === "fallas" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" value={ff.fecha} onChange={(e) => setFf({ ...ff, fecha: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Severidad</label>
                  <select value={ff.severidad} onChange={(e) => setFf({ ...ff, severidad: e.target.value })} className={inp}>
                    <option>Alta</option>
                    <option>Media</option>
                    <option>Baja</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Unidad</label>
                <select value={ff.unidad} onChange={(e) => setFf({ ...ff, unidad: e.target.value })} className={inp}>
                  <option value="">Seleccionar unidad…</option>
                  {unidadesList.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Descripción de la falla</label>
                <input type="text" value={ff.descripcion} onChange={(e) => setFf({ ...ff, descripcion: e.target.value })} placeholder="Ej: Motor no enciende" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Reportado por</label>
                  <input type="text" value={ff.reportadoPor} onChange={(e) => setFf({ ...ff, reportadoPor: e.target.value })} placeholder="Nombre del operador" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select value={ff.status} onChange={(e) => setFf({ ...ff, status: e.target.value })} className={inp}>
                    <option>Reportada</option>
                    <option>En proceso</option>
                    <option>Resuelta</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? (
              <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Guardando...</>
            ) : (
              <>Guardar registro</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Expandable row for mantenimientos / reparaciones ─────────────────────────

function MantRow({
  item,
  onComplete,
}: {
  item: Mantenimiento;
  onComplete: (item: Mantenimiento) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = item.status === "Completado";
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{item.fecha}</td>
        <td className="px-4 py-3 text-white font-semibold text-sm">{item.unidad}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLORS[item.tipo] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30"}`}>
            {item.tipo}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-200 text-sm">{item.descripcion}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{currency(item.costo)}</td>
        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
        <td className="px-4 py-3 text-gray-500 text-xs">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={7} className="px-5 pb-4 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Taller</p>
                  <p className="text-gray-200">{item.taller || "—"}</p>
                </div>
              </div>
              {!done && (
                <button
                  onClick={(e) => { e.stopPropagation(); onComplete(item); }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Marcar completado
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RepRow({
  item,
  onComplete,
}: {
  item: Reparacion;
  onComplete: (item: Reparacion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = item.status === "Completado";
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{item.fecha}</td>
        <td className="px-4 py-3 text-white font-semibold text-sm">{item.unidad}</td>
        <td className="px-4 py-3 text-gray-200 text-sm">{item.descripcion}</td>
        <td className="px-4 py-3 text-gray-400 text-sm">{item.causa || "—"}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{currency(item.costo)}</td>
        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
        <td className="px-4 py-3 text-gray-500 text-xs">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={7} className="px-5 pb-4 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Taller</p>
                <p className="text-gray-200">{item.taller || "—"}</p>
              </div>
              {!done && (
                <button
                  onClick={(e) => { e.stopPropagation(); onComplete(item); }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Marcar completado
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FallaRow({
  item,
  onResolve,
}: {
  item: Falla;
  onResolve: (item: Falla) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const resolved = item.status === "Resuelta";
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${expanded ? "bg-[#1A1A1A]" : "hover:bg-[#1A1A1A]"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{item.fecha}</td>
        <td className="px-4 py-3 text-white font-semibold text-sm">{item.unidad}</td>
        <td className="px-4 py-3 text-gray-200 text-sm">{item.descripcion}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERIDAD_COLORS[item.severidad] ?? "bg-gray-500/15 text-gray-400 border border-gray-500/30"}`}>
            {item.severidad}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm">{item.reportadoPor || "—"}</td>
        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
        <td className="px-4 py-3 text-gray-500 text-xs">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>
      {expanded && !resolved && (
        <tr className="bg-[#111318]">
          <td colSpan={7} className="px-5 pb-4 pt-3">
            <div className="flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); onResolve(item); }}
                className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 cursor-pointer"
              >
                <CheckCircle2 size={14} /> Marcar resuelta
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MantenimientoPage() {
  const [activeTab, setActiveTab] = useState<Tab>("mantenimientos");
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");

  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [reparaciones, setReparaciones] = useState<Reparacion[]>([]);
  const [fallas, setFallas] = useState<Falla[]>([]);
  const [unidadesList, setUnidadesList] = useState<string[]>([]);

  useEffect(() => {
    getCollectionDocs<Mantenimiento>(COLLECTIONS.mantenimientos).then((d) => setMantenimientos(filterByPlanta(d)));
    getCollectionDocs<Reparacion>(COLLECTIONS.reparaciones).then((d) => setReparaciones(filterByPlanta(d)));
    getCollectionDocs<Falla>(COLLECTIONS.fallas).then((d) => setFallas(filterByPlanta(d)));
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then((d) =>
      setUnidadesList(d.map((u) => u.noEconomico).filter(Boolean))
    );
  }, []);

  function showToast(type: "success" | "error", title: string, msg: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message: msg } }));
  }

  // KPIs
  const costoTotal = useMemo(() =>
    mantenimientos.reduce((s, m) => s + m.costo, 0) +
    reparaciones.reduce((s, r) => s + r.costo, 0),
    [mantenimientos, reparaciones]
  );
  const pendientes = useMemo(() =>
    mantenimientos.filter((m) => m.status !== "Completado").length +
    reparaciones.filter((r) => r.status !== "Completado").length,
    [mantenimientos, reparaciones]
  );
  const fallasActivas = useMemo(() => fallas.filter((f) => f.status !== "Resuelta").length, [fallas]);
  const fallasAltas = useMemo(() => fallas.filter((f) => f.severidad === "Alta" && f.status !== "Resuelta").length, [fallas]);

  // Filtered lists
  const filteredM = useMemo(() => {
    const q = query.toLowerCase();
    return !q ? mantenimientos : mantenimientos.filter((m) =>
      m.unidad.toLowerCase().includes(q) || m.descripcion.toLowerCase().includes(q) || m.taller.toLowerCase().includes(q)
    );
  }, [mantenimientos, query]);

  const filteredR = useMemo(() => {
    const q = query.toLowerCase();
    return !q ? reparaciones : reparaciones.filter((r) =>
      r.unidad.toLowerCase().includes(q) || r.descripcion.toLowerCase().includes(q) || r.causa.toLowerCase().includes(q)
    );
  }, [reparaciones, query]);

  const filteredF = useMemo(() => {
    const q = query.toLowerCase();
    return !q ? fallas : fallas.filter((f) =>
      f.unidad.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q) || f.reportadoPor.toLowerCase().includes(q)
    );
  }, [fallas, query]);

  async function handleSave(data: Mantenimiento | Reparacion | Falla) {
    const id = Date.now().toString();
    if (activeTab === "mantenimientos") {
      const item = { ...(data as Mantenimiento), id };
      setMantenimientos((p) => [item, ...p]);
      await upsertDocument(COLLECTIONS.mantenimientos, id, withPlantaTag(data as Mantenimiento));
      showToast("success", "Mantenimiento registrado", `${item.unidad} agregado.`);
    } else if (activeTab === "reparaciones") {
      const item = { ...(data as Reparacion), id };
      setReparaciones((p) => [item, ...p]);
      await upsertDocument(COLLECTIONS.reparaciones, id, withPlantaTag(data as Reparacion));
      showToast("success", "Reparación registrada", `${item.unidad} agregado.`);
    } else {
      const item = { ...(data as Falla), id };
      setFallas((p) => [item, ...p]);
      await upsertDocument(COLLECTIONS.fallas, id, withPlantaTag(data as Falla));
      showToast("success", "Falla registrada", `${item.unidad} agregado.`);
    }
  }

  function completeMantenimiento(target: Mantenimiento) {
    setMantenimientos((p) => p.map((m) =>
      m.id === target.id || (m.fecha === target.fecha && m.unidad === target.unidad && m.descripcion === target.descripcion)
        ? { ...m, status: "Completado" }
        : m
    ));
    showToast("success", "Completado", `Mantenimiento de ${target.unidad} marcado.`);
  }

  function completeReparacion(target: Reparacion) {
    setReparaciones((p) => p.map((r) =>
      r.id === target.id || (r.fecha === target.fecha && r.unidad === target.unidad && r.descripcion === target.descripcion)
        ? { ...r, status: "Completado" }
        : r
    ));
    showToast("success", "Completado", `Reparación de ${target.unidad} marcada.`);
  }

  function resolveFalla(target: Falla) {
    setFallas((p) => p.map((f) =>
      f.id === target.id || (f.fecha === target.fecha && f.unidad === target.unidad && f.descripcion === target.descripcion)
        ? { ...f, status: "Resuelta" }
        : f
    ));
    showToast("success", "Resuelta", `Falla de ${target.unidad} marcada como resuelta.`);
  }

  const tabLabels: Record<Tab, string> = {
    mantenimientos: "Mantenimientos",
    reparaciones: "Reparaciones",
    fallas: "Fallas",
  };

  const currentCount = activeTab === "mantenimientos" ? filteredM.length : activeTab === "reparaciones" ? filteredR.length : filteredF.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{currentCount} registros en {tabLabels[activeTab].toLowerCase()}</p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer"
        >
          <Plus size={16} />
          Registrar {activeTab === "mantenimientos" ? "mantenimiento" : activeTab === "reparaciones" ? "reparación" : "falla"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Costo total"
          value={currency(costoTotal)}
          icon={DollarSign}
          iconColor="text-[#CC2229]"
          subtitle="Mantenimientos + reparaciones"
        />
        <KPICard
          title="Trabajos pendientes"
          value={String(pendientes)}
          icon={Wrench}
          iconColor={pendientes > 0 ? "text-amber-400" : "text-gray-500"}
          subtitle="Sin completar"
        />
        <KPICard
          title="Fallas activas"
          value={String(fallasActivas)}
          icon={Zap}
          iconColor={fallasActivas > 0 ? "text-orange-400" : "text-gray-500"}
          subtitle={fallasAltas > 0 ? `${fallasAltas} de alta severidad` : "Sin fallas activas"}
        />
        <KPICard
          title="Total registros"
          value={String(mantenimientos.length + reparaciones.length + fallas.length)}
          icon={AlertTriangle}
          iconColor="text-blue-400"
          subtitle="Historial completo"
        />
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
          {(["mantenimientos", "reparaciones", "fallas"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setQuery(""); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-[#CC2229] text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar unidad o descripción..."
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-52 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Mantenimientos table */}
      {activeTab === "mantenimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Tipo", "Descripción", "Costo", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredM.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-600">
                    {mantenimientos.length === 0 ? "Sin mantenimientos registrados" : "Sin resultados"}
                  </td></tr>
                ) : filteredM.map((m, i) => (
                  <MantRow key={m.id ?? i} item={m} onComplete={completeMantenimiento} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reparaciones table */}
      {activeTab === "reparaciones" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Descripción", "Causa", "Costo", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredR.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-600">
                    {reparaciones.length === 0 ? "Sin reparaciones registradas" : "Sin resultados"}
                  </td></tr>
                ) : filteredR.map((r, i) => (
                  <RepRow key={r.id ?? i} item={r} onComplete={completeReparacion} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fallas table */}
      {activeTab === "fallas" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Descripción", "Severidad", "Reportó", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredF.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-600">
                    {fallas.length === 0 ? "Sin fallas registradas" : "Sin resultados"}
                  </td></tr>
                ) : filteredF.map((f, i) => (
                  <FallaRow key={f.id ?? i} item={f} onResolve={resolveFalla} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDrawer
        open={showForm}
        tab={activeTab}
        unidadesList={unidadesList}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
      />
    </div>
  );
}
