"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BadgeCheck, ChevronRight, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { upsertDocument, deleteDocument, getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pago {
  id: string;
  fecha: string;
  cliente: string;
  cantidad: number;
  tipoPago: string;
  banco: string;
  anticipo: boolean;
  observaciones: string;
  abonos: AbonoAplicado[];
  saldoAplicado: number;
  planta?: string;
  creadoEn: string;
}

interface AbonoAplicado {
  programacionId: string;
  folio: string;
  monto: number;
}

interface Prog {
  id: string;
  dia: string;
  cliente: string;
  folio?: string;
  total: number | null;
  montoPagado: number | null;
  nombreObra?: string;
  planta?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s?: string | null) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}
function currency(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const M = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d}-${M[parseInt(m)]}-${y}`;
}
function saldoPendiente(p: Prog) {
  return Math.max(0, (p.total ?? 0) - (p.montoPagado ?? 0));
}

const METODOS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta"] as const;
const BANCOS  = ["Banregio", "BBVA", "Santander", "HSBC", "Banamex", "Otro"] as const;

type View = "list" | "new" | "detail";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CobrosPage() {
  const [pagos, setPagos]       = useState<Pago[]>([]);
  const [progs, setProgs]       = useState<Prog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<View>("list");
  const [selected, setSelected] = useState<Pago | null>(null);

  const [q, setQ]                   = useState("");
  const [filterMes, setFilterMes]   = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [pagoAElim, setPagoAElim]   = useState<Pago | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, pr] = await Promise.all([
        getCollectionDocs<Pago>(COLLECTIONS.pagos),
        getCollectionDocs<Prog>(COLLECTIONS.programaciones),
      ]);
      setPagos(filterByPlanta(p).sort((a, b) => b.fecha.localeCompare(a.fecha)));
      setProgs(filterByPlanta(pr));
      setLoading(false);
    })();
  }, []);

  const clientes = useMemo(
    () => [...new Set(progs.map((p) => norm(p.cliente)).filter(Boolean))].sort(),
    [progs],
  );

  const pagosFiltrados = useMemo(() => pagos.filter((p) => {
    if (q && !norm(p.cliente).includes(norm(q))) return false;
    if (filterMes && !p.fecha.startsWith(filterMes)) return false;
    if (filterTipo && p.tipoPago !== filterTipo) return false;
    return true;
  }), [pagos, q, filterMes, filterTipo]);

  const mesActual = todayCST().slice(0, 7);
  const totalCobrado  = pagos.reduce((s, p) => s + p.cantidad, 0);
  const totalEsteMes  = pagos.filter((p) => p.fecha.startsWith(mesActual)).reduce((s, p) => s + p.cantidad, 0);

  function onPagoCreated(pago: Pago) {
    setPagos((prev) => [pago, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setSelected(pago);
    setView("detail");
  }

  async function handleEliminar(pago: Pago) {
    setEliminando(true);
    try {
      // Revertir montoPagado en cada programación afectada
      await Promise.all(
        pago.abonos.map(async (abono) => {
          const prog = progs.find((p) => p.id === abono.programacionId);
          if (!prog) return;
          const nuevo = Math.max(0, (prog.montoPagado ?? 0) - abono.monto);
          await upsertDocument(COLLECTIONS.programaciones, abono.programacionId, { montoPagado: nuevo });
          setProgs((prev) => prev.map((p) => p.id === abono.programacionId ? { ...p, montoPagado: nuevo } : p));
        })
      );
      await deleteDocument(COLLECTIONS.pagos, pago.id);
      setPagos((prev) => prev.filter((p) => p.id !== pago.id));
      setPagoAElim(null);
    } finally {
      setEliminando(false);
    }
  }

  function onAbonosUpdated(updated: Pago, progUpdates: { id: string; montoPagado: number }[]) {
    setPagos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
    setProgs((prev) =>
      prev.map((pr) => {
        const upd = progUpdates.find((u) => u.id === pr.id);
        return upd ? { ...pr, montoPagado: upd.montoPagado } : pr;
      }),
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-[#CC2229] border-t-transparent animate-spin" />
    </div>
  );

  if (view === "new") return (
    <NuevoPagoView clientes={clientes} progs={progs} onBack={() => setView("list")} onCreated={onPagoCreated} />
  );

  if (view === "detail" && selected) return (
    <DetallePagoView pago={selected} progs={progs} onBack={() => setView("list")} onUpdated={onAbonosUpdated} />
  );

  // ── LIST ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pagos</h1>
          <p className="text-xs text-gray-400 mt-0.5">Registro y aplicación de cobros a coladas</p>
        </div>
        <button
          onClick={() => setView("new")}
          className="flex items-center gap-2 px-4 py-2 bg-[#CC2229] hover:bg-[#B01E24] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
        >
          <Plus size={15} /> Nuevo Pago
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total cobrado", value: currency(totalCobrado) },
          { label: "Pagos registrados", value: pagos.length },
          { label: "Este mes", value: currency(totalEsteMes) },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 font-medium">{k.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60" />
        </div>
        <input type="month" value={filterMes} onChange={(e) => setFilterMes(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none text-gray-600" />
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none text-gray-600 cursor-pointer">
          <option value="">Tipo de pago</option>
          {METODOS.map((m) => <option key={m}>{m}</option>)}
        </select>
        {(q || filterMes || filterTipo) && (
          <button onClick={() => { setQ(""); setFilterMes(""); setFilterTipo(""); }}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {["Fecha","Cliente","Tipo de transferencia","Cuenta - Banco","Cantidad","Saldo","Anticipo",""].map((h) => (
                <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${h === "Cantidad" || h === "Saldo" ? "text-right" : h === "Anticipo" ? "text-center" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pagosFiltrados.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                {pagos.length === 0 ? "Sin pagos registrados" : "Sin resultados"}
              </td></tr>
            )}
            {pagosFiltrados.map((pago) => {
              const aplicado = pago.saldoAplicado >= pago.cantidad - 0.01;
              return (
                <tr key={pago.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5"><span className="text-[#CC2229] font-medium">{fmtDate(pago.fecha)}</span></td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => { setSelected(pago); setView("detail"); }}
                      className="font-medium text-gray-800 hover:text-[#CC2229] transition-colors cursor-pointer text-left">
                      {pago.cliente}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{pago.tipoPago || "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">{pago.banco || "—"}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{currency(pago.cantidad)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={aplicado ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {currency(pago.cantidad)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-medium ${pago.anticipo ? "text-blue-600" : "text-gray-400"}`}>
                      {pago.anticipo ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {aplicado && <BadgeCheck size={14} className="text-green-500" />}
                      <button onClick={() => setPagoAElim(pago)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => { setSelected(pago); setView("detail"); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#CC2229] hover:bg-red-50 transition-colors cursor-pointer">
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal confirmación eliminar */}
      {pagoAElim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !eliminando && setPagoAElim(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Eliminar pago</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pago de <strong>{pagoAElim.cliente}</strong> por <strong>{currency(pagoAElim.cantidad)}</strong> del {fmtDate(pagoAElim.fecha)}
                </p>
                {pagoAElim.abonos.length > 0 && (
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    Este pago tiene {pagoAElim.abonos.length} abono{pagoAElim.abonos.length > 1 ? "s" : ""} aplicado{pagoAElim.abonos.length > 1 ? "s" : ""}. El saldo de las remisiones se revertirá automáticamente.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button onClick={() => setPagoAElim(null)} disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors font-medium disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => handleEliminar(pagoAElim)} disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nuevo Pago ───────────────────────────────────────────────────────────────

function NuevoPagoView({ clientes, progs, onBack, onCreated }: {
  clientes: string[];
  progs: Prog[];
  onBack: () => void;
  onCreated: (pago: Pago) => void;
}) {
  const [fecha, setFecha]               = useState(todayCST());
  const [cliente, setCliente]           = useState("");
  const [cantidad, setCantidad]         = useState("");
  const [tipoPago, setTipoPago]         = useState("");
  const [banco, setBanco]               = useState("");
  const [anticipo, setAnticipo]         = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState("");

  // Coladas pendientes del cliente seleccionado
  const progsCliente = useMemo(() => {
    if (!cliente) return [];
    return progs
      .filter((p) => norm(p.cliente) === norm(cliente) && saldoPendiente(p) > 0.01)
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }, [progs, cliente]);

  const totalPendiente = progsCliente.reduce((s, p) => s + saldoPendiente(p), 0);

  // Auto-sugerir el total pendiente cuando se selecciona un cliente
  function handleClienteChange(v: string) {
    setCliente(v);
    setCantidad(""); // reset para que el usuario vea el resumen y decida
  }

  const needsBanco = tipoPago === "Transferencia" || tipoPago === "Cheque";

  async function handleSave() {
    if (!fecha || !cliente.trim() || !cantidad || parseFloat(cantidad) <= 0 || !tipoPago) {
      setErr("Completa los campos requeridos: cliente, cantidad y tipo de pago.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const id = `PAGO-${Date.now()}`;
      // Construir sin undefined — Firestore rechaza campos undefined
      const doc = {
        id,
        fecha,
        cliente: norm(cliente),
        cantidad: parseFloat(cantidad),
        tipoPago,
        banco: banco || "",
        anticipo,
        observaciones: observaciones.trim(),
        abonos: [] as AbonoAplicado[],
        saldoAplicado: 0,
        creadoEn: new Date().toISOString(),
      };
      const pago: Pago = withPlantaTag(doc);
      await upsertDocument(COLLECTIONS.pagos, id, pago);
      onCreated(pago);
    } catch (e) {
      setErr("Error al guardar. Intenta de nuevo.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-gray-400">Pagos</p>
          <h1 className="text-xl font-bold text-gray-900">Nuevo Pago</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Información general</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20" />
          </div>
          {/* Cliente */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Cliente <span className="text-[#CC2229]">*</span></label>
            <input
              list="cl-list"
              value={cliente}
              onChange={(e) => handleClienteChange(e.target.value)}
              placeholder="Seleccionar cliente…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20"
            />
            <datalist id="cl-list">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>

        {/* Resumen saldo cliente */}
        {cliente && progsCliente.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">{progsCliente.length} colada{progsCliente.length !== 1 ? "s" : ""} pendiente{progsCliente.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {progsCliente.map((p) => p.folio || p.id.slice(-6)).join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-600">Saldo total</p>
              <p className="text-lg font-bold text-amber-700">{currency(totalPendiente)}</p>
              <button
                type="button"
                onClick={() => setCantidad(totalPendiente.toFixed(2))}
                className="text-[11px] text-amber-700 underline cursor-pointer mt-0.5"
              >
                Usar este monto
              </button>
            </div>
          </div>
        )}
        {cliente && progsCliente.length === 0 && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
            Este cliente no tiene coladas pendientes de pago.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* Cantidad */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Cantidad <span className="text-[#CC2229]">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
              <input type="number" min="0" step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20" />
            </div>
          </div>
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de transacción <span className="text-[#CC2229]">*</span></label>
            <select value={tipoPago}
              onChange={(e) => { setTipoPago(e.target.value); if (e.target.value === "Efectivo" || e.target.value === "Tarjeta") setBanco(""); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 cursor-pointer">
              <option value="">Seleccionar…</option>
              {METODOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {/* Banco */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Cuenta bancaria {needsBanco && <span className="text-[#CC2229]">*</span>}
            </label>
            <select value={banco} onChange={(e) => setBanco(e.target.value)} disabled={!needsBanco}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <option value="">Seleccionar…</option>
              {BANCOS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Anticipo */}
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input type="checkbox" checked={anticipo} onChange={(e) => setAnticipo(e.target.checked)}
            className="w-4 h-4 rounded accent-[#CC2229] cursor-pointer" />
          <span className="text-sm text-gray-600">Anticipo</span>
        </label>

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
            placeholder="Notas adicionales…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 resize-none" />
        </div>

        {err && <p className="text-xs text-[#CC2229] font-medium">{err}</p>}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button onClick={onBack}
            className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors font-medium">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="py-2.5 rounded-xl bg-[#CC2229] text-white text-sm font-semibold hover:bg-[#B01E24] disabled:opacity-60 cursor-pointer transition-colors">
            {saving ? "Guardando…" : "Crear Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detalle Pago ─────────────────────────────────────────────────────────────

function DetallePagoView({ pago, progs, onBack, onUpdated }: {
  pago: Pago;
  progs: Prog[];
  onBack: () => void;
  onUpdated: (pago: Pago, progUpdates: { id: string; montoPagado: number }[]) => void;
}) {
  const [pagoLocal, setPagoLocal]       = useState<Pago>(pago);
  const [progsLocal, setProgsLocal]     = useState<Prog[]>(progs);
  const [remTab, setRemTab]             = useState<"pendientes" | "pagadas">("pendientes");
  const [selectedProgId, setSelectedId] = useState("");
  const [montoAbono, setMontoAbono]     = useState("");
  const [saving, setSaving]             = useState(false);

  const progsCliente = useMemo(
    () => progsLocal.filter((p) => norm(p.cliente) === norm(pagoLocal.cliente)).sort((a, b) => a.dia.localeCompare(b.dia)),
    [progsLocal, pagoLocal.cliente],
  );

  const aplicadosIds = new Set(pagoLocal.abonos.map((a) => a.programacionId));

  const pendientes = progsCliente.filter((p) => saldoPendiente(p) > 0.01 && !aplicadosIds.has(p.id));
  const pagadas    = progsCliente.filter((p) => aplicadosIds.has(p.id) || saldoPendiente(p) <= 0.01);

  const selectedProg = progsCliente.find((p) => p.id === selectedProgId);
  const saldoRem     = selectedProg ? saldoPendiente(selectedProg) : 0;
  const restante     = pagoLocal.cantidad - pagoLocal.saldoAplicado;

  function handleSelectProg(id: string) {
    setSelectedId(id);
    const prog = progsCliente.find((p) => p.id === id);
    if (!prog) return;
    setMontoAbono(Math.min(saldoPendiente(prog), restante).toFixed(2));
  }

  async function handleGuardar() {
    const monto = parseFloat(montoAbono);
    if (!selectedProgId || !monto || monto <= 0 || monto > restante + 0.001) return;
    setSaving(true);
    try {
      const nuevoAbono: AbonoAplicado = {
        programacionId: selectedProgId,
        folio: selectedProg?.folio ?? selectedProgId,
        monto,
      };
      const updatedAbonos = [...pagoLocal.abonos, nuevoAbono];
      const nuevoSaldo    = pagoLocal.saldoAplicado + monto;
      const updatedPago   = { ...pagoLocal, abonos: updatedAbonos, saldoAplicado: nuevoSaldo };

      const prog         = selectedProg!;
      const nuevoPagado  = (prog.montoPagado ?? 0) + monto;

      await Promise.all([
        upsertDocument(COLLECTIONS.pagos, pagoLocal.id, { abonos: updatedAbonos, saldoAplicado: nuevoSaldo }),
        upsertDocument(COLLECTIONS.programaciones, selectedProgId, {
          montoPagado: nuevoPagado,
          fechaPago: pagoLocal.fecha,
          metodoPago: pagoLocal.tipoPago,
        }),
      ]);

      // Update local progs
      setProgsLocal((prev) =>
        prev.map((p) => p.id === selectedProgId ? { ...p, montoPagado: nuevoPagado } : p),
      );
      setPagoLocal(updatedPago);
      onUpdated(updatedPago, [{ id: selectedProgId, montoPagado: nuevoPagado }]);
      setSelectedId("");
      setMontoAbono("");
    } finally {
      setSaving(false);
    }
  }

  const pct = pagoLocal.cantidad > 0 ? (pagoLocal.saldoAplicado / pagoLocal.cantidad) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-xs text-gray-400">Pagos / {fmtDate(pagoLocal.fecha)}</p>
          <h1 className="text-xl font-bold text-gray-900">
            Pago de cliente <span className="text-[#CC2229]">{pagoLocal.cliente}</span> por {currency(pagoLocal.cantidad)}
          </h1>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
        <span><span className="text-gray-400">Transacción:</span> <span className="font-medium text-gray-700">{pagoLocal.tipoPago || "—"}</span></span>
        <span><span className="text-gray-400">Banco:</span> <span className="font-medium text-gray-700">{pagoLocal.banco || "—"}</span></span>
        <span><span className="text-gray-400">Anticipo:</span> <span className="font-medium text-gray-700">{pagoLocal.anticipo ? "Sí" : "No"}</span></span>
        {pagoLocal.observaciones && (
          <span><span className="text-gray-400">Notas:</span> <span className="font-medium text-gray-700">{pagoLocal.observaciones}</span></span>
        )}
      </div>

      {/* Banner */}
      <div className="bg-[#CC2229] rounded-2xl p-5">
        <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest text-center mb-4">Pago a múltiples remisiones</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Cantidad de abono", val: currency(pagoLocal.cantidad) },
            { label: "Abonado", val: currency(pagoLocal.saldoAplicado) },
            { label: "Restante", val: currency(restante) },
          ].map((k) => (
            <div key={k.label}>
              <p className="text-[10px] text-white/60 uppercase tracking-widest mb-1">{k.label}</p>
              <p className="text-2xl font-bold text-white">{k.val}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-white transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Registro de pago */}
      {restante > 0.01 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Registro de pago</p>
          <div className="grid grid-cols-4 gap-3 items-end">
            {/* Remisión */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Remisión</label>
              <select value={selectedProgId} onChange={(e) => handleSelectProg(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 cursor-pointer">
                <option value="">Seleccionar…</option>
                {pendientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.folio || p.id.slice(-6)} · {fmtDate(p.dia)} · {currency(saldoPendiente(p))}
                  </option>
                ))}
              </select>
            </div>
            {/* Saldo remisión */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Saldo de la remisión</label>
              <input readOnly value={selectedProg ? currency(saldoRem) : ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-100 bg-gray-50 text-gray-500" />
            </div>
            {/* Monto + saldar completa */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Saldo restante de la remisión</label>
              <input readOnly value={selectedProg ? currency(Math.max(0, saldoRem - parseFloat(montoAbono || "0"))) : ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-100 bg-gray-50 text-gray-500" />
              {selectedProg && (
                <button onClick={() => setMontoAbono(Math.min(saldoRem, restante).toFixed(2))}
                  className="mt-1 text-[11px] text-[#CC2229] font-semibold hover:text-[#B01E24] cursor-pointer transition-colors">
                  Saldar completa
                </button>
              )}
            </div>
            {/* Restante + guardar */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Restante</label>
              <div className="flex gap-2 items-stretch">
                <input readOnly value={currency(Math.max(0, restante - parseFloat(montoAbono || "0")))}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-100 bg-gray-50 text-gray-500 min-w-0" />
                <button onClick={handleGuardar}
                  disabled={saving || !selectedProgId || !montoAbono || parseFloat(montoAbono) <= 0}
                  className="px-4 py-2 bg-[#CC2229] text-white text-sm font-semibold rounded-lg hover:bg-[#B01E24] disabled:opacity-50 cursor-pointer transition-colors whitespace-nowrap">
                  {saving ? "…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remisiones / Abonos */}
      <div className="grid grid-cols-2 gap-4">
        {/* Coladas cliente */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(["pendientes", "pagadas"] as const).map((t) => (
              <button key={t} onClick={() => setRemTab(t)}
                className={`flex-1 py-3 text-xs font-semibold transition-colors cursor-pointer capitalize ${remTab === t ? "bg-[#CC2229] text-white" : "text-gray-400 hover:bg-gray-50"}`}>
                {t === "pendientes" ? `Pendientes (${pendientes.length})` : `Pagadas (${pagadas.length})`}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {(remTab === "pendientes" ? pendientes : pagadas).length === 0 && (
              <li className="px-4 py-6 text-sm text-gray-400 text-center">Sin coladas</li>
            )}
            {(remTab === "pendientes" ? pendientes : pagadas).map((p) => {
              const sp = saldoPendiente(p);
              return (
                <li key={p.id} className="px-4 py-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-700 flex items-center gap-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${sp > 0.01 ? "bg-[#CC2229]" : "bg-green-400"}`} />
                        Remisión: {p.folio || p.id.slice(-6)}
                      </p>
                      <p className="text-gray-400 mt-0.5">Cantidad {currency(p.total ?? 0)}</p>
                      <p className="text-gray-400">Abonado {currency(p.montoPagado ?? 0)}</p>
                      <p className="text-gray-400">Restante {currency(sp)}</p>
                      {p.nombreObra && <p className="text-gray-300 mt-0.5">{p.nombreObra}</p>}
                    </div>
                    <p className="text-gray-300 shrink-0">{fmtDate(p.dia)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Abonos aplicados */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">Abonos</p>
          </div>
          <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {pagoLocal.abonos.length === 0 && (
              <li className="px-4 py-6 text-sm text-gray-400 text-center">Sin abonos registrados</li>
            )}
            {pagoLocal.abonos.map((a, i) => (
              <li key={i} className="px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Remisión: {a.folio}</p>
                <p className="text-sm font-bold text-green-600">{currency(a.monto)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
