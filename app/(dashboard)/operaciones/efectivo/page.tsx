"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardList, DollarSign, Pencil, Plus, Search, Trash2, X, AlertTriangle, Package } from "lucide-react";
import { deleteDocument, getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
import ClienteCombobox from "@/components/ClienteCombobox";
import KPICard from "@/components/KPICard";
import type { Cliente } from "@/lib/crmClientes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recibo {
  id?: string;
  folio: number;
  cliente: string;
  importe: number | null;
  fecha: string;
  cemento: string;
  metros: number | null;
  precio: number | null;
  resistencia: string;
  tipoDeTiro: string;
  direccionObra: string;
  notas: string;
  entregado: boolean;
  planta?: string;
}

interface FormState {
  cliente: string;
  importe: string;
  fecha: string;
  cemento: string;
  metros: string;
  precio: string;
  resistencia: string;
  tipoDeTiro: string;
  direccionObra: string;
  notas: string;
  entregado: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string): number | null {
  const p = parseFloat(v.replace(/,/g, ""));
  return isNaN(p) ? null : p;
}

function currency(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const todayISO = todayCST;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function adjMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function inMonth(fecha: string, ym: string) {
  return fecha?.startsWith(ym) ?? false;
}

function emptyForm(): FormState {
  return {
    cliente: "", importe: "", fecha: todayISO(),
    cemento: "", metros: "", precio: "",
    resistencia: "", tipoDeTiro: "", direccionObra: "",
    notas: "", entregado: false,
  };
}

function formFromRecibo(r: Recibo): FormState {
  return {
    cliente: r.cliente,
    importe: r.importe != null ? String(r.importe) : "",
    fecha: r.fecha,
    cemento: r.cemento,
    metros: r.metros != null ? String(r.metros) : "",
    precio: r.precio != null ? String(r.precio) : "",
    resistencia: r.resistencia,
    tipoDeTiro: r.tipoDeTiro,
    direccionObra: r.direccionObra,
    notas: r.notas,
    entregado: r.entregado,
  };
}

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({ open, onClose, onSave, initial, nextFolio, clientesList }: {
  open: boolean;
  onClose: () => void;
  onSave: (r: Recibo) => Promise<void>;
  initial?: Recibo;
  nextFolio: number;
  clientesList: string[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? formFromRecibo(initial) : emptyForm());
  }, [open, initial]);

  const set = (k: keyof Omit<FormState, "entregado">, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";
  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const recibo: Recibo = {
        folio: initial?.folio ?? nextFolio,
        cliente: form.cliente.trim(),
        importe: n(form.importe),
        fecha: form.fecha,
        cemento: form.cemento.trim(),
        metros: n(form.metros),
        precio: n(form.precio),
        resistencia: form.resistencia.trim(),
        tipoDeTiro: form.tipoDeTiro.trim(),
        direccionObra: form.direccionObra.trim(),
        notas: form.notas.trim(),
        entregado: form.entregado,
      };
      await onSave(recibo);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar" />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-[#242424] border-l border-[#3A3A3A] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {initial ? `Folio #${String(initial.folio).padStart(4, "0")}` : `Folio #${String(nextFolio).padStart(4, "0")}`}
            </p>
            <h2 className="text-base font-bold text-white mt-0.5">
              {initial ? "Editar recibo" : "Nuevo recibo"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Cliente + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ClienteCombobox
                label="Cliente"
                value={form.cliente}
                onChange={(v) => set("cliente", v)}
                options={clientesList}
                placeholder="Buscar cliente…"
              />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Importe */}
          <div>
            <label className={lbl}>Importe $</label>
            <input
              type="number" step="0.01" min="0"
              value={form.importe} onChange={(e) => set("importe", e.target.value)}
              placeholder="0.00" className={inp}
              onWheel={(e) => e.currentTarget.blur()}
            />
          </div>

          {/* Concreto */}
          <div className="pt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Concreto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Metros (m³)</label>
                <input
                  type="number" step="0.5" min="0"
                  value={form.metros} onChange={(e) => set("metros", e.target.value)}
                  placeholder="0.0" className={inp}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div>
                <label className={lbl}>Precio $</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.precio} onChange={(e) => set("precio", e.target.value)}
                  placeholder="0.00" className={inp}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div>
                <label className={lbl}>Cemento</label>
                <input type="text" value={form.cemento} onChange={(e) => set("cemento", e.target.value)} placeholder="CPC 30, CPC 40…" className={inp} />
              </div>
              <div>
                <label className={lbl}>Resistencia</label>
                <input type="text" value={form.resistencia} onChange={(e) => set("resistencia", e.target.value)} placeholder="250, 300, 350…" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Tipo de tiro</label>
                <input type="text" value={form.tipoDeTiro} onChange={(e) => set("tipoDeTiro", e.target.value)} placeholder="Directo, bomba, etc." className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Dirección obra</label>
                <input type="text" value={form.direccionObra} onChange={(e) => set("direccionObra", e.target.value)} placeholder="Calle, número, colonia…" className={inp} />
              </div>
            </div>
          </div>

          {/* Notas + Entregado */}
          <div>
            <label className={lbl}>Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              rows={3}
              placeholder="Observaciones adicionales…"
              className={`${inp} resize-none`}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-[#3A3A3A] px-4 py-3 hover:border-[#CC2229]/40 transition-colors">
            <div
              onClick={() => setForm((p) => ({ ...p, entregado: !p.entregado }))}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.entregado ? "bg-emerald-500" : "bg-[#3A3A3A]"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.entregado ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-gray-300">Entregado</span>
          </label>
        </form>

        {/* Footer */}
        <div className="border-t border-[#3A3A3A] px-6 py-4 flex justify-end gap-3 bg-[#242424]">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EfectivoPage() {
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [clientesList, setClientesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEntregado, setFilterEntregado] = useState<"todos" | "entregado" | "pendiente">("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todo" | "mes">("mes");
  const [mes, setMes] = useState(currentMonth);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recibo | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Recibo | undefined>();

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Recibo>(COLLECTIONS.efectivo),
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<{ cliente?: string }>(COLLECTIONS.programaciones),
    ]).then(([docs, clientes, progs]) => {
      setRecibos(filterByPlanta(docs).sort((a, b) => b.folio - a.folio));
      const fromClientes = clientes.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean));
      const fromProgs = progs.map((p) => p.cliente).filter(Boolean) as string[];
      setClientesList(Array.from(new Set([...fromClientes, ...fromProgs])).sort());
    }).finally(() => setLoading(false));
  }, []);

  const nextFolio = useMemo(() => {
    if (recibos.length === 0) return 1;
    return Math.max(...recibos.map((r) => r.folio ?? 0)) + 1;
  }, [recibos]);

  const filtered = useMemo(() => {
    return recibos.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        String(r.folio).includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.direccionObra.toLowerCase().includes(q) ||
        r.resistencia.toLowerCase().includes(q) ||
        r.tipoDeTiro.toLowerCase().includes(q);
      const matchEntregado =
        filterEntregado === "todos" ||
        (filterEntregado === "entregado" && r.entregado) ||
        (filterEntregado === "pendiente" && !r.entregado);
      const matchPeriodo = filtroPeriodo === "todo" || inMonth(r.fecha, mes);
      return matchSearch && matchEntregado && matchPeriodo;
    });
  }, [recibos, search, filterEntregado, filtroPeriodo, mes]);

  const totalImporte = useMemo(() => filtered.reduce((s, r) => s + (r.importe ?? 0), 0), [filtered]);
  const totalM3 = useMemo(() => filtered.reduce((s, r) => s + (r.metros ?? 0), 0), [filtered]);
  const pendientes = useMemo(() => filtered.filter((r) => !r.entregado).length, [filtered]);

  async function handleSave(r: Recibo) {
    const isNew = !editing;
    const id = editing?.id ?? `rec-${r.folio}-${Date.now()}`;
    const { id: _id, ...data } = { ...r, id };
    await upsertDocument(COLLECTIONS.efectivo, id, withPlantaTag(data));
    const saved: Recibo = { ...r, id };
    setRecibos((prev) =>
      isNew
        ? [saved, ...prev].sort((a, b) => b.folio - a.folio)
        : prev.map((p) => p.id === id ? saved : p)
    );
  }

  async function toggleEntregado(r: Recibo) {
    const updated: Recibo = { ...r, entregado: !r.entregado };
    const { id: _id, ...data } = updated;
    await upsertDocument(COLLECTIONS.efectivo, r.id!, withPlantaTag(data));
    setRecibos((prev) => prev.map((p) => p.id === r.id ? updated : p));
  }

  async function handleDelete(r: Recibo) {
    setRecibos((prev) => prev.filter((x) => x.id !== r.id));
    await deleteDocument(COLLECTIONS.efectivo, r.id!);
    setConfirmDelete(undefined);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Recibo #${String(r.folio).padStart(4, "0")} eliminado.` } }));
  }

  function openNew() { setEditing(undefined); setShowForm(true); }
  function openEdit(r: Recibo) { setEditing(r); setShowForm(true); }

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-[#CC2229] text-white" : "text-gray-400 hover:text-white hover:bg-[#3A3A3A]"}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-gray-500 text-sm">Registro de recibos de concreto</p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-[#CC2229]/20"
        >
          <Plus size={16} />
          Nuevo recibo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total recibos"
          value={String(filtered.length)}
          icon={ClipboardList}
          iconColor="text-[#CC2229]"
          iconBg="bg-[#CC2229]/10"
        />
        <KPICard
          title="Total m³"
          value={`${totalM3.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`}
          icon={Package}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <KPICard
          title="Total importe"
          value={currency(totalImporte)}
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <KPICard
          title="Pendientes entrega"
          value={String(pendientes)}
          icon={AlertTriangle}
          iconColor={pendientes > 0 ? "text-amber-400" : "text-emerald-400"}
          iconBg={pendientes > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}
        />
      </div>

      {/* Filters */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar folio, cliente, resistencia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600"
          />
        </div>

        {/* Período */}
        <div className="flex items-center gap-1.5 bg-[#2A2A2A] rounded-xl p-1">
          <button
            onClick={() => setFiltroPeriodo("todo")}
            className={tabCls(filtroPeriodo === "todo")}
          >
            Todo
          </button>
          <button
            onClick={() => setFiltroPeriodo("mes")}
            className={tabCls(filtroPeriodo === "mes")}
          >
            Por mes
          </button>
        </div>

        {/* Navegación de mes */}
        {filtroPeriodo === "mes" && (
          <div className="flex items-center gap-1 border border-[#3A3A3A] rounded-xl overflow-hidden">
            <button
              onClick={() => setMes((m) => adjMonth(m, -1))}
              className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 py-2 text-sm font-semibold text-gray-200 capitalize whitespace-nowrap min-w-[140px] text-center">
              {monthLabel(mes)}
            </span>
            <button
              onClick={() => setMes((m) => adjMonth(m, 1))}
              disabled={mes >= currentMonth()}
              className="px-2.5 py-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Estado entrega */}
        <div className="flex gap-1.5">
          {(["todos", "entregado", "pendiente"] as const).map((f) => (
            <button key={f} onClick={() => setFilterEntregado(f)} className={tabCls(filterEntregado === f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Folio", "Fecha", "Cliente", "Importe", "m³", "Precio", "Cemento", "Resistencia", "Tipo tiro", "Dirección obra", "Entregado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-500">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-500">Sin resultados.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-300">
                    #{String(r.folio).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white max-w-[160px] truncate">{r.cliente || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{currency(r.importe)}</td>
                  <td className="px-4 py-3 text-gray-300">{r.metros != null ? `${r.metros} m³` : "—"}</td>
                  <td className="px-4 py-3 text-gray-300">{r.precio != null ? currency(r.precio) : "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{r.cemento || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{r.resistencia || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{r.tipoDeTiro || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate" title={r.direccionObra}>{r.direccionObra || "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEntregado(r)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        r.entregado
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/25"
                      }`}
                    >
                      {r.entregado && <Check size={11} />}
                      {r.entregado ? "Entregado" : "Pendiente"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                        aria-label={`Editar recibo #${r.folio}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer"
                        aria-label={`Eliminar recibo #${r.folio}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        initial={editing}
        nextFolio={nextFolio}
        clientesList={clientesList}
      />

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(undefined)} aria-label="Cancelar" />
          <div className="relative bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-white mb-1">¿Eliminar recibo?</h3>
            <p className="text-sm text-gray-400 mb-5">
              Se eliminará el recibo{" "}
              <strong className="text-gray-200">#{String(confirmDelete.folio).padStart(4, "0")} — {confirmDelete.cliente || "sin cliente"}</strong>{" "}
              de forma permanente. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(undefined)}
                className="px-4 py-2 text-sm text-gray-300 border border-[#3A3A3A] rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-xl transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
