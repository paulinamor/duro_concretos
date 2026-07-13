"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Package, Plus, Search, X } from "lucide-react";
import { deleteDocument, getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import ClienteCombobox from "@/components/ClienteCombobox";
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

function todayISO() { return new Date().toISOString().slice(0, 10); }

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

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
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
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {initial ? `Folio #${String(initial.folio).padStart(4, "0")}` : `Folio #${String(nextFolio).padStart(4, "0")}`}
            </p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">
              {initial ? "Editar recibo" : "Nuevo recibo"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Concreto</p>
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

          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-200 px-4 py-3 hover:border-[#CC2229]/40 transition-colors">
            <div
              onClick={() => setForm((p) => ({ ...p, entregado: !p.entregado }))}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.entregado ? "bg-emerald-500" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.entregado ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Entregado</span>
          </label>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3 bg-white">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recibo | undefined>();

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
      return matchSearch && matchEntregado;
    });
  }, [recibos, search, filterEntregado]);

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

  function openNew() { setEditing(undefined); setShowForm(true); }
  function openEdit(r: Recibo) { setEditing(r); setShowForm(true); }

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? "bg-[#CC2229] text-white" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`;

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
        {[
          { label: "Total recibos", value: String(filtered.length) },
          { label: "Total m³", value: `${totalM3.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³` },
          { label: "Total importe", value: currency(totalImporte) },
          { label: "Pendientes entrega", value: String(pendientes) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar folio, cliente, resistencia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
          />
        </div>
        <div className="flex gap-1.5">
          {(["todos", "entregado", "pendiente"] as const).map((f) => (
            <button key={f} onClick={() => setFilterEntregado(f)} className={tabCls(filterEntregado === f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Folio", "Fecha", "Cliente", "Importe", "m³", "Precio", "Cemento", "Resistencia", "Tipo tiro", "Dirección obra", "Entregado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-gray-400">Sin resultados.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600">
                    #{String(r.folio).padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 max-w-[160px] truncate">{r.cliente || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{currency(r.importe)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.metros != null ? `${r.metros} m³` : "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{r.precio != null ? currency(r.precio) : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.cemento || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.resistencia || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.tipoDeTiro || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={r.direccionObra}>{r.direccionObra || "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEntregado(r)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        r.entregado
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      {r.entregado && <Check size={11} />}
                      {r.entregado ? "Entregado" : "Pendiente"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-xs text-gray-400 hover:text-[#CC2229] transition-colors font-medium"
                    >
                      Editar
                    </button>
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
    </div>
  );
}
