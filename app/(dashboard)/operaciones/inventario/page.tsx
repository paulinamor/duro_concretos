"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ChevronDown, ChevronUp, Download, FlaskConical,
  Package, Plus, Search, Truck, Users, X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import type { Cliente } from "@/lib/crmClientes";
import type { Operador } from "@/lib/operadores";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Remision {
  id?: string;
  fecha: string;          // dd/mm/yyyy
  noRemision: string;
  cliente: string;
  metros: number;
  mezcla: string;         // e.g. "250-20-14"
  cr: number | null;
  operador: string;
  // Materiales base (kg / L)
  cemento: number | null;
  grava: number | null;
  arena4: number | null;
  arena5: number | null;
  agua: number | null;
  aditivo: number | null;
  // Aditivos especiales
  acelerante: string;
  imper: string;
  fibra: number | null;
  color: string;
  ligsthone: string;
  planta?: string;
}

interface FormState {
  fecha: string;
  noRemision: string;
  cliente: string;
  metros: string;
  mezcla: string;
  cr: string;
  operador: string;
  cemento: string;
  grava: string;
  arena4: string;
  arena5: string;
  agua: string;
  aditivo: string;
  acelerante: string;
  imper: string;
  fibra: string;
  color: string;
  ligsthone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string) {
  const [d, m, y] = display.split("/");
  return `${y}-${m}-${d}`;
}

function emptyForm(): FormState {
  return {
    fecha: todayISO(), noRemision: "", cliente: "", metros: "",
    mezcla: "", cr: "", operador: "",
    cemento: "", grava: "", arena4: "", arena5: "", agua: "", aditivo: "",
    acelerante: "", imper: "", fibra: "", color: "", ligsthone: "",
  };
}

function n(v: string): number | null {
  const p = parseFloat(v);
  return isNaN(p) ? null : p;
}

function exportCSV(rows: Remision[]) {
  const headers = [
    "FECHA","REMISION","CLIENTE","METROS","CONCRETO","CR","OPERADOR",
    "CEMENTO","GRAVA","ARENA 4","ARENA 5","AGUA","ADITIVO",
    "ACELERANTE(AFA)","IMPER","FIBRA","COLOR","LIGSTHONE",
  ];
  const lines = rows.map((r) => [
    r.fecha, r.noRemision, r.cliente, r.metros, r.mezcla, r.cr ?? "",
    r.operador, r.cemento ?? "", r.grava ?? "", r.arena4 ?? "",
    r.arena5 ?? "", r.agua ?? "", r.aditivo ?? "", r.acelerante,
    r.imper, r.fibra ?? "", r.color, r.ligsthone,
  ].map((v) => `"${v}"`).join(","));
  const blob = new Blob(["﻿" + [headers.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "remisiones.csv" });
  a.click();
}

const tooltipStyle = { backgroundColor: "#1A1F2B", border: "1px solid #252D3D", borderRadius: "8px", color: "#fff", fontSize: "12px" };

const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";

// ─── FormDrawer ───────────────────────────────────────────────────────────────

function FormDrawer({
  open, onClose, onSave, initial, clientes, operadores, nextRemision,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (r: Remision) => Promise<void>;
  initial?: Remision;
  clientes: Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[];
  operadores: Pick<Operador, "id" | "nombre">[];
  nextRemision: string;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          fecha: initial.fecha ? displayToISO(initial.fecha) : todayISO(),
          noRemision: initial.noRemision,
          cliente: initial.cliente,
          metros: String(initial.metros),
          mezcla: initial.mezcla,
          cr: initial.cr != null ? String(initial.cr) : "",
          operador: initial.operador,
          cemento: initial.cemento != null ? String(initial.cemento) : "",
          grava: initial.grava != null ? String(initial.grava) : "",
          arena4: initial.arena4 != null ? String(initial.arena4) : "",
          arena5: initial.arena5 != null ? String(initial.arena5) : "",
          agua: initial.agua != null ? String(initial.agua) : "",
          aditivo: initial.aditivo != null ? String(initial.aditivo) : "",
          acelerante: initial.acelerante,
          imper: initial.imper,
          fibra: initial.fibra != null ? String(initial.fibra) : "",
          color: initial.color,
          ligsthone: initial.ligsthone,
        });
      } else {
        setForm({ ...emptyForm(), noRemision: nextRemision });
      }
    }
  }, [open, initial, nextRemision]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.fecha || !form.noRemision.trim() || !form.cliente.trim() || !form.metros || !form.operador.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        fecha: isoToDisplay(form.fecha),
        noRemision: form.noRemision.trim(),
        cliente: form.cliente.trim(),
        metros: parseFloat(form.metros) || 0,
        mezcla: form.mezcla.trim(),
        cr: n(form.cr),
        operador: form.operador.trim(),
        cemento: n(form.cemento),
        grava: n(form.grava),
        arena4: n(form.arena4),
        arena5: n(form.arena5),
        agua: n(form.agua),
        aditivo: n(form.aditivo),
        acelerante: form.acelerante.trim(),
        imper: form.imper.trim(),
        fibra: n(form.fibra),
        color: form.color.trim(),
        ligsthone: form.ligsthone.trim(),
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
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FlaskConical size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{initial ? "Editar remisión" : "Registrar remisión"}</h2>
            <p className="text-xs text-gray-500">Despacho de concreto</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Despacho */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Despacho</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Fecha <span className="text-[#CC2229]">*</span></label>
                <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>No. Remisión <span className="text-[#CC2229]">*</span></label>
                <input type="text" value={form.noRemision} onChange={(e) => set("noRemision", e.target.value)} placeholder="18945" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Cliente <span className="text-[#CC2229]">*</span></label>
                <select value={form.cliente} onChange={(e) => set("cliente", e.target.value)} className={inp}>
                  <option value="">Seleccionar cliente…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.razonSocial}>{c.nombreComercial || c.razonSocial}</option>
                  ))}
                </select>
                {clientes.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">Sin clientes registrados — agrégalos en CRM → Clientes.</p>
                )}
              </div>
              <div>
                <label className={lbl}>Metros m³ <span className="text-[#CC2229]">*</span></label>
                <input type="number" step="0.5" min="0" value={form.metros} onChange={(e) => set("metros", e.target.value)} placeholder="7.0" className={inp} />
              </div>
              <div>
                <label className={lbl}>Mezcla</label>
                <input type="text" value={form.mezcla} onChange={(e) => set("mezcla", e.target.value)} placeholder="250-20-14" className={inp} />
              </div>
              <div>
                <label className={lbl}>CR</label>
                <input type="number" value={form.cr} onChange={(e) => set("cr", e.target.value)} placeholder="350" className={inp} />
              </div>
              <div>
                <label className={lbl}>Operador <span className="text-[#CC2229]">*</span></label>
                <select value={form.operador} onChange={(e) => set("operador", e.target.value)} className={inp}>
                  <option value="">Seleccionar operador…</option>
                  {operadores.map((o) => (
                    <option key={o.id} value={o.nombre}>{o.nombre}</option>
                  ))}
                </select>
                {operadores.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">Sin operadores — agrégalos en Transporte → Operadores.</p>
                )}
              </div>
            </div>
          </div>

          {/* Materiales base */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Materiales base</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "cemento", label: "Cemento (kg)" },
                { key: "grava", label: "Grava (kg)" },
                { key: "arena4", label: "Arena 4 (kg)" },
                { key: "arena5", label: "Arena 5 (kg)" },
                { key: "agua", label: "Agua (L)" },
                { key: "aditivo", label: "Aditivo" },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className={lbl}>{label}</label>
                  <input type="number" step="0.001" min="0" value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="0" className={inp} />
                </div>
              ))}
            </div>
          </div>

          {/* Aditivos especiales */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 whitespace-nowrap">Aditivos especiales</span>
              <span className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Acelerante (AFA)</label>
                <input type="text" value={form.acelerante} onChange={(e) => set("acelerante", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div>
                <label className={lbl}>Impermeabilizante</label>
                <input type="text" value={form.imper} onChange={(e) => set("imper", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div>
                <label className={lbl}>Fibra (kg)</label>
                <input type="number" step="0.001" min="0" value={form.fibra} onChange={(e) => set("fibra", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div>
                <label className={lbl}>Color</label>
                <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="—" className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Ligsthone</label>
                <input type="text" value={form.ligsthone} onChange={(e) => set("ligsthone", e.target.value)} placeholder="—" className={inp} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.noRemision.trim() || !form.cliente.trim() || !form.metros || !form.operador.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            {saving ? "Guardando…" : "Guardar remisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TableRow({ r }: { r: Remision }) {
  const [expanded, setExpanded] = useState(false);

  const totalMat = [r.cemento, r.grava, r.arena4, r.arena5, r.agua, r.aditivo, r.fibra]
    .reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <>
      <tr
        className={`hover:bg-[#1A1F2B] transition-colors cursor-pointer ${expanded ? "bg-[#1A1F2B]" : ""}`}
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{r.fecha}</td>
        <td className="px-4 py-3 text-[#CC2229] font-mono text-xs font-semibold">{r.noRemision}</td>
        <td className="px-4 py-3 text-gray-200 text-sm max-w-[160px] truncate">{r.cliente}</td>
        <td className="px-4 py-3 text-white font-semibold tabular-nums">{r.metros} m³</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300">
            {r.mezcla || "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-300 text-sm">{r.operador}</td>
        <td className="px-4 py-3 text-gray-500 text-xs tabular-nums">
          {totalMat > 0 ? `${totalMat.toFixed(0)} kg` : "—"}
        </td>
        <td className="px-4 py-3">
          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#111318]">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "Cemento", value: r.cemento, unit: "kg" },
                { label: "Grava", value: r.grava, unit: "kg" },
                { label: "Arena 4", value: r.arena4, unit: "kg" },
                { label: "Arena 5", value: r.arena5, unit: "kg" },
                { label: "Agua", value: r.agua, unit: "L" },
                { label: "Aditivo", value: r.aditivo, unit: "" },
                { label: "Acelerante", value: r.acelerante || null, unit: "" },
                { label: "Imper.", value: r.imper || null, unit: "" },
                { label: "Fibra", value: r.fibra, unit: "kg" },
                { label: "Color", value: r.color || null, unit: "" },
                { label: "Ligsthone", value: r.ligsthone || null, unit: "" },
                { label: "CR", value: r.cr, unit: "" },
              ].map(({ label, value, unit }) => value != null ? (
                <div key={label} className="bg-[#0F1115] rounded-lg p-2.5 border border-[#252D3D]">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-200 font-mono">{value}{unit ? ` ${unit}` : ""}</p>
                </div>
              ) : null)}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [remisiones, setRemisiones] = useState<Remision[]>([]);
  const [clientesList, setClientesList] = useState<Pick<Cliente, "id" | "razonSocial" | "nombreComercial">[]>([]);
  const [operadoresList, setOperadoresList] = useState<Pick<Operador, "id" | "nombre">[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMezcla, setFilterMezcla] = useState("Todos");

  useEffect(() => {
    getCollectionDocs<Remision>(COLLECTIONS.remisiones).then((data) => setRemisiones(filterByPlanta(data)));
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((list) =>
      setClientesList(list.map((c) => ({ id: c.id, razonSocial: c.razonSocial, nombreComercial: c.nombreComercial })))
    );
    getCollectionDocs<Operador>(COLLECTIONS.operadores).then((list) =>
      setOperadoresList(list.filter((o) => o.estatus === "Activo").map((o) => ({ id: o.id, nombre: o.nombre })))
    );
  }, []);

  const nextRemision = useMemo(() => {
    if (remisiones.length === 0) return "1";
    const nums = remisiones.map((r) => parseInt(r.noRemision, 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [remisiones]);

  const handleSave = async (r: Remision) => {
    const id = r.id ?? `rem-${r.noRemision}-${Date.now()}`;
    await upsertDocument(COLLECTIONS.remisiones, id, withPlantaTag({ ...r, id: undefined }));
    setRemisiones((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const updated = { ...r, id };
      return idx >= 0 ? prev.map((x, i) => i === idx ? updated : x) : [updated, ...prev];
    });
  };

  const mezclas = useMemo(() => {
    const set = new Set(remisiones.map((r) => r.mezcla).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [remisiones]);

  const filtered = useMemo(() => {
    let rows = remisiones;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.cliente.toLowerCase().includes(q) || r.noRemision.includes(q) || r.operador.toLowerCase().includes(q));
    }
    if (filterMezcla !== "Todos") rows = rows.filter((r) => r.mezcla === filterMezcla);
    return rows;
  }, [remisiones, search, filterMezcla]);

  // KPIs
  const totalM3 = remisiones.reduce((s, r) => s + r.metros, 0);
  const uniqueClientes = new Set(remisiones.map((r) => r.cliente)).size;
  const totalCemento = remisiones.reduce((s, r) => s + (r.cemento ?? 0), 0);

  // Chart: m³ por día (last 14 days)
  const m3PorDia = useMemo(() => {
    const map = new Map<string, number>();
    remisiones.forEach((r) => {
      const iso = r.fecha ? displayToISO(r.fecha) : "";
      if (!iso) return;
      map.set(iso, (map.get(iso) ?? 0) + r.metros);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    return sorted.map(([fecha, metros]) => ({ fecha: fecha.slice(5).replace("-", "/"), metros: parseFloat(metros.toFixed(1)) }));
  }, [remisiones]);

  // Chart: remisiones por tipo mezcla
  const porMezcla = useMemo(() => {
    const map = new Map<string, number>();
    remisiones.forEach((r) => {
      const k = r.mezcla || "Sin especificar";
      map.set(k, (map.get(k) ?? 0) + r.metros);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([mezcla, metros]) => ({ mezcla, metros: parseFloat(metros.toFixed(1)) }));
  }, [remisiones]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Producción / Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registro de despachos por remisión</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg hover:border-[#CC2229]/60 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#B01E24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            <Plus size={16} />
            Nueva remisión
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total remisiones" value={String(remisiones.length)} icon={Package} iconColor="text-[#CC2229]" />
        <KPICard title="Total m³ despachados" value={`${totalM3.toFixed(1)} m³`} icon={FlaskConical} iconColor="text-blue-400" />
        <KPICard title="Clientes únicos" value={String(uniqueClientes)} icon={Users} iconColor="text-green-400" />
        <KPICard title="Cemento total (kg)" value={totalCemento > 0 ? totalCemento.toLocaleString("es-MX") : "—"} icon={Truck} iconColor="text-yellow-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">M³ despachados por día</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={m3PorDia}>
              <defs>
                <linearGradient id="gradM3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC2229" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#CC2229" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="fecha" stroke="#4B5563" tick={{ fontSize: 11 }} />
              <YAxis stroke="#4B5563" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Metros"]} />
              <Area type="monotone" dataKey="metros" stroke="#CC2229" strokeWidth={2} fill="url(#gradM3)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">M³ por tipo de mezcla</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={porMezcla} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" horizontal={false} />
              <XAxis type="number" stroke="#4B5563" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="mezcla" stroke="#4B5563" tick={{ fontSize: 11 }} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v) || 0} m³`, "Total"]} />
              <Bar dataKey="metros" fill="#CC2229" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center gap-3">
          <h3 className="text-white font-semibold text-sm flex-1">Remisiones</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, remisión, operador…"
              className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg pl-7 pr-3 py-1.5 w-52 focus:outline-none focus:border-[#CC2229]/60 placeholder-gray-600"
            />
          </div>
          <select
            value={filterMezcla}
            onChange={(e) => setFilterMezcla(e.target.value)}
            className="bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#CC2229]/60"
          >
            {mezclas.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A]">
                {["Fecha", "Remisión", "Cliente", "Metros", "Mezcla", "Operador", "Material total", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-600">
                    Sin remisiones registradas.
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <TableRow key={r.id ?? r.noRemision} r={r} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#3A3A3A] flex items-center justify-between">
          <p className="text-xs text-gray-600">
            {filtered.length} remisión{filtered.length !== 1 ? "es" : ""} · {filtered.reduce((s, r) => s + r.metros, 0).toFixed(1)} m³
          </p>
        </div>
      </div>

      <FormDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        clientes={clientesList}
        operadores={operadoresList}
        nextRemision={nextRemision}
      />
    </div>
  );
}
