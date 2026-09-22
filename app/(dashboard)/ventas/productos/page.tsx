"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, Search, Trash2, Upload, X, AlertTriangle, Edit2 } from "lucide-react";
import * as XLSX from "xlsx";
import { upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag, getStoredSession } from "@/lib/auth";
import { useCollectionWithLoading } from "@/lib/useCollection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Producto {
  id: string;
  codigo: string;
  descripcion: string;
  categoria?: string;
  planta?: string;
}

// ─── Category inference ───────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  "F'C":    "Concreto",
  "CONC":   "Concreto especial",
  "MORT":   "Mortero",
  "MRND":   "Mortero rinde",
  "ACEL":   "Acelerante",
  "SERV":   "Servicio",
  "BLOC":   "Block",
  "VARI":   "Varios",
  "FIBR":   "Fibra",
  "IMP":    "Impermeabilizante",
  "PIGM":   "Pigmento",
  "BOMB":   "Bombeo",
  "RENT":   "Renta",
  "FLTE":   "Flete",
  "SELLO":  "Sellador",
};

function inferCategoria(codigo: string): string {
  const upper = codigo.toUpperCase();
  for (const [prefix, cat] of Object.entries(CATEGORY_MAP)) {
    if (upper.startsWith(prefix)) return cat;
  }
  return "General";
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ProductoModal({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (codigo: string, descripcion: string) => Promise<void>;
  initial?: Producto | null;
}) {
  const [codigo, setCodigo]       = useState("");
  const [descripcion, setDescr]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  useEffect(() => {
    if (open) {
      setCodigo(initial?.codigo ?? "");
      setDescr(initial?.descripcion ?? "");
      setErr("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function handleSave() {
    if (!codigo.trim() || !descripcion.trim()) { setErr("Código y descripción son obligatorios."); return; }
    setSaving(true);
    try {
      await onSave(codigo.trim().toUpperCase(), descripcion.trim());
      onClose();
    } catch {
      setErr("No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]";
  const lbl = "block text-sm text-gray-600 mb-1 font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{initial ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onClose} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{err}</p>}
          <div>
            <label className={lbl}>Código <span className="text-[#CC2229]">*</span></label>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ACEL48H60%" className={`${inp} uppercase`} />
          </div>
          <div>
            <label className={lbl}>Descripción <span className="text-[#CC2229]">*</span></label>
            <textarea value={descripcion} onChange={(e) => setDescr(e.target.value)} rows={3} placeholder="Descripción completa del producto o servicio" className={`${inp} resize-none`} />
          </div>
          <p className="text-xs text-gray-400">Categoría: <span className="font-medium text-gray-600">{codigo.trim() ? inferCategoria(codigo.trim()) : "—"}</span></p>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { data: productos, loading } = useCollectionWithLoading<Producto>(COLLECTIONS.productos);

  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("Todas");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<Producto | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importMsg, setImportMsg]   = useState("");
  const fileRef                     = useRef<HTMLInputElement>(null);

  const session = getStoredSession();
  const isSuperadmin = session?.email === "leonardo@lpsoft.mx";

  // ─── Derived ──────────────────────────────────────────────────────────────

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria ?? inferCategoria(p.codigo)));
    return ["Todas", ...Array.from(set).sort()];
  }, [productos]);

  const filtered = useMemo(() => {
    return productos.filter((p) => {
      const cat = p.categoria ?? inferCategoria(p.codigo);
      if (catFilter !== "Todas" && cat !== catFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
    });
  }, [productos, search, catFilter]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of productos) {
      const c = p.categoria ?? inferCategoria(p.codigo);
      map[c] = (map[c] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [productos]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleSave(codigo: string, descripcion: string) {
    const categoria = inferCategoria(codigo);
    if (editTarget?.id) {
      await upsertDocument(COLLECTIONS.productos, editTarget.id, withPlantaTag({ codigo, descripcion, categoria }));
    } else {
      const id = `prod-${Date.now()}`;
      await upsertDocument(COLLECTIONS.productos, id, withPlantaTag({ codigo, descripcion, categoria }));
    }
    setEditTarget(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `Producto ${codigo} guardado.` } }));
  }


  async function handleDelete(id: string) {
    await deleteDocument(COLLECTIONS.productos, id);
    setDeleteId(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "info", message: "Producto eliminado." } }));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      let count = 0;
      for (const row of rows) {
        const codigo     = String(row["CODIGO"] ?? row["codigo"] ?? "").trim().toUpperCase();
        const descripcion = String(row["DESCRIPCIÓN"] ?? row["DESCRIPCION"] ?? row["descripcion"] ?? "").trim();
        if (!codigo || !descripcion) continue;
        const id       = `prod-${codigo.replace(/[^A-Z0-9]/g, "")}`;
        const categoria = inferCategoria(codigo);
        await upsertDocument(COLLECTIONS.productos, id, withPlantaTag({ codigo, descripcion, categoria }));
        count++;
      }
      setImportMsg(`${count} producto${count !== 1 ? "s" : ""} importado${count !== 1 ? "s" : ""} correctamente.`);
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: `${count} productos importados.` } }));
    } catch {
      setImportMsg("Error al leer el archivo. Asegúrate de que sea un .xlsx válido.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Cargando productos…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total productos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{productos.length}</p>
        </div>
        {byCategory.slice(0, 3).map(([cat, n]) => (
          <div key={cat} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">{cat}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{n}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o descripción…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 focus:border-[#CC2229]"
          />
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CC2229]/30 cursor-pointer"
        >
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>

        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <Upload size={14} />
          {importing ? "Importando…" : "Importar Excel"}
        </button>


        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-lg shadow-[#CC2229]/20 cursor-pointer whitespace-nowrap"
        >
          <Plus size={14} />
          Nuevo producto
        </button>
      </div>

      {importMsg && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${importMsg.startsWith("Error") ? "border-red-200 bg-red-50 text-red-600" : "border-green-200 bg-green-50 text-green-700"}`}>
          {importMsg}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Package size={32} className="opacity-30" />
            <p className="text-sm">{productos.length === 0 ? "Sin productos. Importa desde Excel o crea uno manualmente." : "Sin resultados para esta búsqueda."}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 text-xs">{p.codigo}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">{p.descripcion}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {p.categoria ?? inferCategoria(p.codigo)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditTarget(p); setModalOpen(true); }}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      {isSuperadmin && (
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{filtered.length} de {productos.length} producto{productos.length !== 1 ? "s" : ""}</p>

      {/* Product modal */}
      <ProductoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
      />

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Eliminar producto</p>
                <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
