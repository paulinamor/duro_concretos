"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { upsertDocument, deleteDocument, getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { useCollectionWithLoading } from "@/lib/useCollection";
import type { Cliente } from "@/lib/crmClientes";
import { migrarObras, type ResultadoMigracion } from "@/lib/migraciones";

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

const emptyForm = (): { cliente: string; nombre: string; direccion: string } => ({
  cliente: "", nombre: "", direccion: "",
});

export default function CatalogoObrasPage() {
  const { data: obras, loading } = useCollectionWithLoading<Obra & { planta?: string }>(COLLECTIONS.obras);
  const [clientes, setClientes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migracionResult, setMigracionResult] = useState<ResultadoMigracion | null>(null);

  useEffect(() => {
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((docs) => {
      const names = docs.flatMap((c) => [c.razonSocial, c.nombreComercial].filter(Boolean)) as string[];
      setClientes(Array.from(new Set(names)).sort());
    });
  }, []);

  const clientesDisponibles = useMemo(() => {
    const from = obras.map((o) => o.cliente).filter(Boolean);
    return Array.from(new Set([...from, ...clientes])).sort();
  }, [obras, clientes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return obras.filter((o) => {
      if (filterCliente && o.cliente !== filterCliente) return false;
      if (q && !o.cliente.toLowerCase().includes(q) && !o.nombre.toLowerCase().includes(q) && !o.direccion.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.cliente.localeCompare(b.cliente, "es") || a.nombre.localeCompare(b.nombre, "es"));
  }, [obras, search, filterCliente]);

  function openNew() {
    setEditingObra(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(obra: Obra) {
    setEditingObra(obra);
    setForm({ cliente: obra.cliente, nombre: obra.nombre, direccion: obra.direccion });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingObra(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.cliente.trim() || !form.nombre.trim()) return;
    setSaving(true);
    try {
      const id = editingObra?.id ?? `obra-${Date.now()}`;
      const doc: Obra = {
        id,
        cliente: form.cliente.trim().toUpperCase().replace(/\s+/g, " "),
        nombre: form.nombre.trim().toUpperCase().replace(/\s+/g, " "),
        direccion: form.direccion.trim(),
      };
      await upsertDocument(COLLECTIONS.obras, id, doc);
      closeForm();
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: editingObra ? "Obra actualizada." : "Obra guardada en el catálogo." },
      }));
    } finally {
      setSaving(false);
    }
  }

  async function handleMigrar() {
    setMigrating(true);
    setMigracionResult(null);
    try {
      const resultado = await migrarObras();
      setMigracionResult(resultado);
      if (resultado.nuevas > 0) {
        window.dispatchEvent(new CustomEvent("duro:toast", {
          detail: { type: "success", message: `${resultado.nuevas} obra${resultado.nuevas !== 1 ? "s" : ""} importada${resultado.nuevas !== 1 ? "s" : ""} del historial.` },
        }));
      } else {
        window.dispatchEvent(new CustomEvent("duro:toast", {
          detail: { type: "success", message: "El catálogo ya está al día. No hay obras nuevas por importar." },
        }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "error", message: "Error durante la importación." },
      }));
    } finally {
      setMigrating(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteDocument(COLLECTIONS.obras, id);
    setConfirmDeleteId(null);
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Obra eliminada." } }));
  }

  const inp = "w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Obras y ubicaciones vinculadas por cliente</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMigrar}
            disabled={migrating}
            title="Importa obras desde el historial de pedidos y recibos existentes"
            className="flex items-center gap-2 border border-[#3A3A3A] text-gray-300 px-4 py-2 rounded-xl text-sm font-medium hover:border-blue-500/60 hover:text-blue-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <ArrowDownToLine size={15} />
            {migrating ? "Importando…" : "Importar del historial"}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#B01E24] transition-colors shadow-md shadow-[#CC2229]/20 cursor-pointer"
          >
            <Plus size={16} />
            Nueva obra
          </button>
        </div>
      </div>

      {/* Resultado de migración */}
      {migracionResult && (
        <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl p-4 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Resultado de importación</p>
            <button onClick={() => setMigracionResult(null)} className="text-gray-500 hover:text-white cursor-pointer"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-emerald-400">✓ {migracionResult.nuevas} obras nuevas importadas</span>
            {migracionResult.yaExistian > 0 && <span className="text-gray-500">{migracionResult.yaExistian} ya existían</span>}
            {migracionResult.errores.length > 0 && <span className="text-red-400">{migracionResult.errores.length} errores</span>}
          </div>
          {migracionResult.detalle.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
              {migracionResult.detalle.map((d, i) => (
                <p key={i} className="text-xs text-gray-500">
                  <span className="text-gray-400 font-medium">{d.cliente}</span> — {d.nombre}
                  <span className="ml-2 text-gray-600">({d.fuente})</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar obra, cliente, dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600"
          />
        </div>
        <select
          value={filterCliente}
          onChange={(e) => setFilterCliente(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          <option value="">Todos los clientes</option>
          {clientesDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} obra{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Tabla */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <svg className="h-7 w-7 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400">Cargando catálogo…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin size={32} className="mb-3 text-gray-600" />
            <p className="text-sm text-gray-500 mb-1">
              {search || filterCliente ? "Sin resultados." : "No hay obras en el catálogo."}
            </p>
            <p className="text-xs text-gray-600">
              {!search && !filterCliente && "Las obras se agregan automáticamente al crear pedidos, o manualmente con el botón de arriba."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Cliente", "Nombre de obra", "Dirección / Maps", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.map((obra) => (
                  <tr key={obra.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white max-w-[180px] truncate">{obra.cliente}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                        <MapPin size={13} className="text-[#CC2229] shrink-0" />
                        {obra.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[260px] truncate text-xs" title={obra.direccion}>
                      {obra.direccion
                        ? obra.direccion.startsWith("http")
                          ? <a href={obra.direccion} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Ver en Maps</a>
                          : obra.direccion
                        : <span className="text-gray-600">Sin dirección</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(obra)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          aria-label="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(obra.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#CC2229] hover:bg-[#CC2229]/10 transition-colors cursor-pointer"
                          aria-label="Eliminar"
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
        )}
      </div>

      {/* Drawer: nueva / editar obra */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default" onClick={closeForm} />
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-[#242424] border-l border-[#3A3A3A] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
                  <MapPin size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{editingObra ? "Editar obra" : "Nueva obra"}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Vinculada a un cliente</p>
                </div>
              </div>
              <button onClick={closeForm} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className={lbl}>Cliente <span className="text-[#CC2229]">*</span></label>
                <input
                  list="obras-clientes-list"
                  value={form.cliente}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                  placeholder="Nombre del cliente"
                  className={inp}
                />
                <datalist id="obras-clientes-list">
                  {clientesDisponibles.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className={lbl}>Nombre de la obra <span className="text-[#CC2229]">*</span></label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. PIEDRA ALTA, VISTA ENCINOS…"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Dirección o link de Maps</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                  placeholder="Dirección o link de Google Maps"
                  className={inp}
                />
                <p className="text-xs text-gray-600 mt-1">Al seleccionar esta obra en un pedido, la dirección se llenará automáticamente.</p>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#3A3A3A] px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={closeForm} className="px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.cliente.trim() || !form.nombre.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-[#CC2229]/20 cursor-pointer"
              >
                <MapPin size={14} />
                {saving ? "Guardando…" : editingObra ? "Actualizar" : "Guardar obra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar obra</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar esta obra del catálogo? No afecta pedidos existentes.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
