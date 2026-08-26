"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CheckSquare, GitMerge, MapPin, Pencil, Plus, Search, Square, Trash2, X } from "lucide-react";
import { upsertDocument, deleteDocument, getCollectionDocs, COLLECTIONS, where } from "@/lib/db";
import { useCollectionWithLoading } from "@/lib/useCollection";
import type { Cliente } from "@/lib/crmClientes";
import { migrarObras, type ResultadoMigracion } from "@/lib/migraciones";
import AppSelect from "@/components/AppSelect";

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

interface Programacion {
  id: string;
  nombreObra?: string;
}

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

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

  // Fusionar duplicados (auto-detectados)
  const [showMerge, setShowMerge] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState("");
  const [keepId, setKeepId] = useState<Record<string, string>>({});

  // Fusión manual: selección libre de 2+ obras para unificar
  const [manualMergeIds, setManualMergeIds] = useState<Set<string>>(new Set());
  const [showManualMerge, setShowManualMerge] = useState(false);
  const [manualKeepId, setManualKeepId] = useState<string>("");

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

  // Grupos de duplicados — misma clave normalizada (cliente + nombre)
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Obra[]>();
    obras.forEach((o) => {
      const key = `${norm(o.cliente)}|||${norm(o.nombre)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return [...map.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({ key, group }));
  }, [obras]);

  // Inicializa keepId cuando abre el modal: conserva la que tenga dirección, si no la primera
  function openMerge() {
    const initial: Record<string, string> = {};
    duplicateGroups.forEach(({ key, group }) => {
      const withDir = group.find((o) => o.direccion?.trim());
      initial[key] = withDir?.id ?? group[0].id;
    });
    setKeepId(initial);
    setShowMerge(true);
  }

  async function handleMerge() {
    setMerging(true);
    let merged = 0;
    let progsUpdated = 0;
    try {
      for (const { key, group } of duplicateGroups) {
        const kId = keepId[key] ?? group[0].id;
        const keeper = group.find((o) => o.id === kId) ?? group[0];
        const discards = group.filter((o) => o.id !== keeper.id);

        for (const discard of discards) {
          // Actualizar programaciones que referencian el nombre descartado
          setMergeProgress(`Actualizando programaciones de "${discard.nombre}"…`);
          try {
            const progs = await getCollectionDocs<Programacion>(
              COLLECTIONS.programaciones,
              [where("nombreObra", "==", discard.nombre)],
            );
            for (const prog of progs) {
              await upsertDocument(COLLECTIONS.programaciones, prog.id, { nombreObra: keeper.nombre });
              progsUpdated++;
            }
          } catch {
            // Si no hay coincidencias exactas, continuar
          }

          // Eliminar obra duplicada
          setMergeProgress(`Eliminando duplicado "${discard.nombre}"…`);
          await deleteDocument(COLLECTIONS.obras, discard.id);
          merged++;
        }

        // Si el keeper no tiene dirección pero algún descartado sí tenía, recuperarla
        if (!keeper.direccion?.trim()) {
          const withDir = discards.find((d) => d.direccion?.trim());
          if (withDir) {
            await upsertDocument(COLLECTIONS.obras, keeper.id, { direccion: withDir.direccion });
          }
        }
      }

      setShowMerge(false);
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: {
          type: "success",
          message: `${merged} duplicado${merged !== 1 ? "s" : ""} eliminado${merged !== 1 ? "s" : ""}${progsUpdated > 0 ? ` · ${progsUpdated} programación${progsUpdated !== 1 ? "es" : ""} actualizada${progsUpdated !== 1 ? "s" : ""}` : ""}.`,
        },
      }));
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error durante la fusión." } }));
    } finally {
      setMerging(false);
      setMergeProgress("");
    }
  }

  function toggleManualSelect(id: string) {
    setManualMergeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openManualMerge() {
    const selected = obras.filter((o) => manualMergeIds.has(o.id));
    // Auto-selecciona como keeper la que tenga dirección, si no la primera
    const withDir = selected.find((o) => o.direccion?.trim());
    setManualKeepId(withDir?.id ?? selected[0]?.id ?? "");
    setShowManualMerge(true);
  }

  async function handleManualMerge() {
    const selected = obras.filter((o) => manualMergeIds.has(o.id));
    const keeper   = selected.find((o) => o.id === manualKeepId) ?? selected[0];
    const discards = selected.filter((o) => o.id !== keeper.id);
    setMerging(true);
    let progsUpdated = 0;
    try {
      for (const discard of discards) {
        setMergeProgress(`Actualizando programaciones de "${discard.nombre}"…`);
        try {
          const progs = await getCollectionDocs<Programacion>(
            COLLECTIONS.programaciones,
            [where("nombreObra", "==", discard.nombre)],
          );
          for (const prog of progs) {
            await upsertDocument(COLLECTIONS.programaciones, prog.id, { nombreObra: keeper.nombre });
            progsUpdated++;
          }
        } catch { /* sin coincidencias exactas */ }

        setMergeProgress(`Eliminando "${discard.nombre}"…`);
        await deleteDocument(COLLECTIONS.obras, discard.id);
      }
      // Copiar dirección al keeper si no tiene
      if (!keeper.direccion?.trim()) {
        const withDir = discards.find((d) => d.direccion?.trim());
        if (withDir) await upsertDocument(COLLECTIONS.obras, keeper.id, { direccion: withDir.direccion });
      }
      setShowManualMerge(false);
      setManualMergeIds(new Set());
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "success", message: `Obras fusionadas. ${progsUpdated} programación${progsUpdated !== 1 ? "es" : ""} actualizada${progsUpdated !== 1 ? "s" : ""}.` },
      }));
    } catch {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: "Error al fusionar." } }));
    } finally {
      setMerging(false);
      setMergeProgress("");
    }
  }

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
          {manualMergeIds.size >= 2 && (
            <button
              onClick={openManualMerge}
              className="flex items-center gap-2 border border-blue-500/40 text-blue-400 px-4 py-2 rounded-xl text-sm font-medium hover:border-blue-400 hover:bg-blue-500/5 transition-colors cursor-pointer"
            >
              <GitMerge size={15} />
              Fusionar selección ({manualMergeIds.size})
            </button>
          )}
          {manualMergeIds.size > 0 && manualMergeIds.size < 2 && (
            <span className="text-xs text-gray-500 px-3 py-2">Selecciona 1 más para fusionar</span>
          )}
          {duplicateGroups.length > 0 && (
            <button
              onClick={openMerge}
              className="flex items-center gap-2 border border-amber-500/40 text-amber-400 px-4 py-2 rounded-xl text-sm font-medium hover:border-amber-400 hover:bg-amber-500/5 transition-colors cursor-pointer"
            >
              <GitMerge size={15} />
              Fusionar duplicados ({duplicateGroups.length})
            </button>
          )}
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
        <AppSelect dark value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientesDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </AppSelect>
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
                  <th className="px-3 py-3 w-8" />
                  {["Cliente", "Nombre de obra", "Dirección / Maps", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.map((obra) => {
                  const selected = manualMergeIds.has(obra.id);
                  return (
                    <tr key={obra.id} className={`hover:bg-white/5 transition-colors ${selected ? "bg-blue-500/5" : ""}`}>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleManualSelect(obra.id)}
                          className={`p-0.5 rounded transition-colors cursor-pointer ${selected ? "text-blue-400" : "text-gray-600 hover:text-gray-400"}`}
                          title="Seleccionar para fusionar"
                        >
                          {selected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: fusionar duplicados */}
      {showMerge && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !merging && setShowMerge(false)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <GitMerge size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Fusionar duplicados</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{duplicateGroups.length} grupo{duplicateGroups.length !== 1 ? "s" : ""} con nombre similar · Elige cuál conservar</p>
                </div>
              </div>
              {!merging && (
                <button onClick={() => setShowMerge(false)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Grupos */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {duplicateGroups.map(({ key, group }) => (
                <div key={key} className="border border-[#3A3A3A] rounded-xl overflow-hidden">
                  <div className="bg-[#2A2A2A] px-4 py-2 border-b border-[#3A3A3A]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {group[0].cliente} — {group.length} variantes
                    </p>
                  </div>
                  <div className="divide-y divide-[#3A3A3A]">
                    {group.map((obra) => {
                      const isKeep = keepId[key] === obra.id;
                      return (
                        <button
                          key={obra.id}
                          onClick={() => setKeepId((prev) => ({ ...prev, [key]: obra.id }))}
                          disabled={merging}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${isKeep ? "bg-emerald-500/5" : "hover:bg-white/3"}`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${isKeep ? "border-emerald-400 bg-emerald-400" : "border-[#4A4A4A]"}`}>
                            {isKeep && <div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isKeep ? "text-emerald-400" : "text-white"}`}>
                              {obra.nombre}
                              {isKeep && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">conservar</span>}
                            </p>
                            {obra.direccion ? (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{obra.direccion}</p>
                            ) : (
                              <p className="text-xs text-gray-600 mt-0.5">Sin dirección</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#3A3A3A] px-6 py-4 space-y-3">
              {merging && mergeProgress && (
                <p className="text-xs text-amber-400 text-center">{mergeProgress}</p>
              )}
              <p className="text-xs text-gray-600 text-center">
                Las programaciones vinculadas al nombre descartado se actualizarán automáticamente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMerge(false)}
                  disabled={merging}
                  className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleMerge}
                  disabled={merging}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <GitMerge size={14} />
                  {merging ? "Fusionando…" : `Fusionar ${duplicateGroups.length} grupo${duplicateGroups.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal fusión manual */}
      {showManualMerge && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowManualMerge(false)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <GitMerge size={18} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Fusionar obras seleccionadas</h3>
                <p className="text-xs text-gray-500">Elige cuál conservar. Las demás se eliminarán y sus programaciones se remapearán.</p>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">¿Cuál obra conservar?</p>
            <div className="space-y-2 mb-5">
              {obras.filter((o) => manualMergeIds.has(o.id)).map((o) => (
                <label key={o.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${manualKeepId === o.id ? "border-blue-500/50 bg-blue-500/10" : "border-[#3A3A3A] hover:border-gray-500"}`}>
                  <input type="radio" name="keepId" value={o.id} checked={manualKeepId === o.id} onChange={() => setManualKeepId(o.id)} className="mt-0.5 accent-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-white">{o.nombre}</p>
                    <p className="text-xs text-gray-500">{o.cliente}{o.direccion ? ` · ${o.direccion}` : ""}</p>
                  </div>
                </label>
              ))}
            </div>

            {mergeProgress && (
              <p className="text-xs text-amber-400 mb-3">{mergeProgress}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowManualMerge(false)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handleManualMerge} disabled={merging || !manualKeepId}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                {merging ? "Fusionando…" : "Fusionar"}
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
