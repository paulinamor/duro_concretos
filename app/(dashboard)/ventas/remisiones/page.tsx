"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Info, Link as LinkIcon, Plus, Search, X,
} from "lucide-react";
import Link from "next/link";
import KPICard from "@/components/KPICard";
import AppSelect from "@/components/AppSelect";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, getActivePlanta, withPlantaTag } from "@/lib/auth";
import { todayCST, currentMonthCST } from "@/lib/dateUtils";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemisionDespacho {
  id?: string;
  tipo: "despacho";
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: number;
  mezcla: string;
  planta: "Allende" | "Pesquería";
  horaSalidaPlanta: string;
  operador: string;
  cr: string;
  unidad: string;
  recibidoPor: string;
  programacionId?: string;
  programacionFolio?: string;
  creadoEn: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function currentMonth() { return currentMonthCST(); }

function inMonth(fecha: string, month: string) {
  if (!fecha) return false;
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    return `${y}-${m}`.startsWith(month);
  }
  return fecha.startsWith(month);
}

function monthLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function adjMonth(p: string, delta: number): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── RemisionDrawer ───────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (r: RemisionDespacho) => Promise<void>;
  initial?: RemisionDespacho;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  crOptions: string[];
  nextNoRemision: string;
  defaultPlanta: "Allende" | "Pesquería";
}

interface FormState {
  noRemision: string;
  fecha: string;
  cliente: string;
  obra: string;
  m3: string;
  mezcla: string;
  planta: "Allende" | "Pesquería";
  horaSalidaPlanta: string;
  operador: string;
  cr: string;
  unidad: string;
  recibidoPor: string;
}

function RemisionDrawer({
  open, onClose, onSave, initial, clientes, operadores, crOptions, nextNoRemision, defaultPlanta,
}: DrawerProps) {
  const empty = (): FormState => ({
    noRemision: nextNoRemision,
    fecha: todayCST(),
    cliente: "",
    obra: "",
    m3: "",
    mezcla: "",
    planta: defaultPlanta,
    horaSalidaPlanta: "",
    operador: "",
    cr: "",
    unidad: "",
    recibidoPor: "",
  });

  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        noRemision: initial.noRemision,
        fecha: initial.fecha.includes("/")
          ? initial.fecha.split("/").reverse().join("-")
          : initial.fecha,
        cliente: initial.cliente,
        obra: initial.obra,
        m3: String(initial.m3),
        mezcla: initial.mezcla,
        planta: initial.planta,
        horaSalidaPlanta: initial.horaSalidaPlanta,
        operador: initial.operador,
        cr: initial.cr,
        unidad: initial.unidad,
        recibidoPor: initial.recibidoPor,
      });
    } else {
      setForm({ ...empty(), noRemision: nextNoRemision });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, nextNoRemision]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.noRemision.trim() || !form.m3) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        tipo: "despacho",
        noRemision: form.noRemision.trim(),
        fecha: isoToDisplay(form.fecha),
        cliente: form.cliente.trim(),
        obra: form.obra.trim(),
        m3: parseFloat(form.m3) || 0,
        mezcla: form.mezcla.trim(),
        planta: form.planta,
        horaSalidaPlanta: form.horaSalidaPlanta,
        operador: form.operador,
        cr: form.cr,
        unidad: form.unidad.trim(),
        recibidoPor: form.recibidoPor.trim(),
        programacionId: initial?.programacionId,
        programacionFolio: initial?.programacionFolio,
        creadoEn: initial?.creadoEn ?? new Date().toISOString(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {initial ? "Editar remisión" : "Nueva remisión de despacho"}
            </h2>
            <p className="text-xs text-gray-500">Planta {form.planta}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Planta */}
          <div>
            <label className={lbl}>Planta</label>
            <div className="flex gap-2">
              {(["Allende", "Pesquería"] as const).map((p) => (
                <button key={p} type="button" onClick={() => set("planta", p)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    form.planta === p
                      ? "bg-[#CC2229] border-[#CC2229] text-white"
                      : "bg-white border-gray-200 text-gray-500 hover:border-[#CC2229]/40"
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label>
              <input type="text" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value)} placeholder="20806" className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className={lbl}>Cliente</label>
            <AppSelect value={form.cliente} onChange={(e) => set("cliente", e.target.value)}>
              <option value="">Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.razonSocial}>
                  {c.nombreComercial || c.razonSocial}
                </option>
              ))}
            </AppSelect>
          </div>

          <div>
            <label className={lbl}>Obra</label>
            <input type="text" value={form.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Nombre de la obra" className={inp} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>M³ <span className="text-[#CC2229]">*</span></label>
              <input type="number" step="0.5" min="0" value={form.m3} onChange={(e) => set("m3", e.target.value)} placeholder="7.0" className={inp} />
            </div>
            <div>
              <label className={lbl}>Código / Mezcla</label>
              <input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="F'C 200N2014R28D" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Hora de salida de planta</label>
            <input type="time" value={form.horaSalidaPlanta} onChange={(e) => set("horaSalidaPlanta", e.target.value)} className={inp} />
          </div>

          {/* Operador */}
          <div>
            <label className={lbl}>Operador</label>
            <AppSelect value={form.operador} onChange={(e) => set("operador", e.target.value)}>
              <option value="">Sin asignar</option>
              {operadores.map((o) => (
                <option key={o.id} value={o.nombre}>{o.nombre}</option>
              ))}
            </AppSelect>
          </div>

          {/* CR */}
          <div>
            <label className={lbl}>CR</label>
            <AppSelect value={form.cr} onChange={(e) => set("cr", e.target.value)}>
              <option value="">— Sin CR —</option>
              {crOptions.map((cr) => (
                <option key={cr} value={cr}>{cr}</option>
              ))}
              {form.cr && !crOptions.includes(form.cr) && (
                <option value={form.cr}>{form.cr}</option>
              )}
            </AppSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Unidad / No. Económico</label>
              <input type="text" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="DR 112" className={inp} />
            </div>
            <div>
              <label className={lbl}>Recibido por</label>
              <input type="text" value={form.recibidoPor} onChange={(e) => set("recibidoPor", e.target.value)} placeholder="Nombre" className={inp} />
            </div>
          </div>

          {initial?.programacionId && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <LinkIcon size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700 font-medium">
                Vinculada a programación{initial.programacionFolio ? ` ${initial.programacionFolio}` : ""}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.noRemision.trim() || !form.m3}
            className="px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear remisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemisionesPage() {
  const [remisiones, setRemisiones] = useState<RemisionDespacho[]>([]);
  const [clientes, setClientes] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadores, setOperadores] = useState<Pick<Operador, "id" | "nombre">[]>([]);
  const [crOptions, setCrOptions] = useState<string[]>([]);

  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [plantaFilter, setPlantaFilter] = useState<"Todas" | "Allende" | "Pesquería">("Todas");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RemisionDespacho | undefined>(undefined);

  const defaultPlanta = useMemo((): "Allende" | "Pesquería" => {
    const ap = getActivePlanta();
    return ap === "Pesquería" ? "Pesquería" : "Allende";
  }, []);

  useEffect(() => {
    getCollectionDocs<RemisionDespacho>(COLLECTIONS.remisiones).then((docs) => {
      const despacho = filterByPlanta(docs).filter((r) => r.tipo === "despacho");
      setRemisiones(despacho);
    });
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((docs) =>
      setClientes(docs.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial })))
    );
    getCollectionDocs<Operador>(COLLECTIONS.operadores).then((docs) =>
      setOperadores(docs.filter((o) => !o.baja).map((o) => ({ id: o.id, nombre: o.nombre })))
    );
    getCollectionDocs<{ id?: string; choferes?: { cr: string }[] }>(COLLECTIONS.programaciones).then((docs) => {
      const crs = new Set<string>();
      docs.forEach((p) => p.choferes?.forEach((c) => { if (c.cr) crs.add(c.cr); }));
      setCrOptions([...crs].sort());
    });
  }, []);

  const nextNoRemision = useMemo(() => {
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  const filtered = useMemo(() => {
    let rows = remisiones.filter((r) => inMonth(r.fecha, month));
    if (plantaFilter !== "Todas") rows = rows.filter((r) => r.planta === plantaFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.noRemision.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.operador.toLowerCase().includes(q) ||
        r.cr.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => b.noRemision.localeCompare(a.noRemision, undefined, { numeric: true }));
  }, [remisiones, month, search, plantaFilter]);

  const totalM3 = useMemo(() => filtered.reduce((s, r) => s + (r.m3 || 0), 0), [filtered]);
  const vinculadas = useMemo(() => filtered.filter((r) => r.programacionId).length, [filtered]);
  const sinVincular = filtered.length - vinculadas;

  const handleSave = async (r: RemisionDespacho) => {
    const id = r.id ?? `rem-desp-${r.noRemision}-${Date.now()}`;
    const { id: _id, ...data } = r;
    const tagged = withPlantaTag(data) as RemisionDespacho;
    await upsertDocument(COLLECTIONS.remisiones, id, tagged as Parameters<typeof upsertDocument>[2]);
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...tagged, id };
      return idx >= 0 ? prev.map((x, i) => (i === idx ? updated : x)) : [updated, ...prev];
    });
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Remisión ${r.noRemision} guardada.` } }));
  };

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <button onClick={() => setMonth(adjMonth(month, -1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">‹</button>
          <span className="text-gray-800 text-sm font-medium capitalize min-w-[140px] text-center py-2 select-none">{monthLabel(month)}</span>
          <button onClick={() => setMonth(adjMonth(month, +1))} className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-lg leading-none">›</button>
        </div>

        {/* Planta filter */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
          {(["Todas", "Allende", "Pesquería"] as const).map((p) => (
            <button key={p} onClick={() => setPlantaFilter(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all cursor-pointer ${plantaFilter === p ? "bg-[#CC2229] text-white shadow-md" : "text-gray-500 hover:text-gray-700"}`}>
              {p}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <button
            onClick={() => { setEditing(undefined); setDrawerOpen(true); }}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer"
          >
            <Plus size={15} /> Nueva Remisión
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Total remisiones" value={String(filtered.length)} icon={FileText} iconColor="text-[#CC2229]" subtitle={monthLabel(month)} />
        <KPICard title="M³ totales" value={totalM3.toFixed(1)} icon={FileText} iconColor="text-sky-500" iconBg="bg-sky-500/10" subtitle={`Promedio ${filtered.length ? (totalM3 / filtered.length).toFixed(1) : "0"} m³`} />
        <KPICard title="Vinculadas" value={String(vinculadas)} icon={FileText} iconColor="text-emerald-500" iconBg="bg-emerald-500/10" subtitle="Con programación asignada" />
        <KPICard title="Sin vincular" value={String(sinVincular)} icon={FileText} iconColor={sinVincular > 0 ? "text-amber-500" : "text-gray-400"} iconBg={sinVincular > 0 ? "bg-amber-500/10" : "bg-gray-500/10"} subtitle="Sin programación asignada" />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-gray-900">
            {filtered.length} remisión{filtered.length !== 1 ? "es" : ""}
          </p>
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="No. remisión, cliente, operador…"
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg pl-7 pr-8 py-1.5 w-64 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Fecha", "No. Remisión", "Cliente", "Obra", "M³", "Mezcla", "Operador", "CR", "Vinculada", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">Sin remisiones para este período</p>
                      <button onClick={() => { setEditing(undefined); setDrawerOpen(true); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#CC2229] hover:text-[#B01E24] cursor-pointer transition-colors">
                        <Plus size={13} /> Crear primera remisión
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id ?? r.noRemision} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.fecha}</td>
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-bold">{r.noRemision}</td>
                    <td className="px-4 py-3 text-gray-700 text-sm max-w-[160px] truncate">{r.cliente || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{r.obra || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-900 font-bold tabular-nums">{r.m3} m³</td>
                    <td className="px-4 py-3">
                      {r.mezcla
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700">{r.mezcla}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm truncate max-w-[120px]">{r.operador || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.cr || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">
                      {r.programacionId
                        ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">Vinculada</span>
                        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-700">Sin vincular</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setEditing(r); setDrawerOpen(true); }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-blue-700">
          <span className="font-semibold">Vinculación con programación:</span> Al registrar una remisión en{" "}
          <Link href="/transporte/programacion" className="underline hover:text-blue-900">Transporte → Programación</Link>,
          la remisión queda vinculada automáticamente a la carga correspondiente.
        </p>
      </div>

      <RemisionDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(undefined); }}
        onSave={handleSave}
        initial={editing}
        clientes={clientes}
        operadores={operadores}
        crOptions={crOptions}
        nextNoRemision={nextNoRemision}
        defaultPlanta={defaultPlanta}
      />
    </div>
  );
}
