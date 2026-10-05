"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, ChevronRight, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import type { ConcreteReceipt } from "@/lib/concreteReceipts";
import { calculateConcreteReceiptTotal } from "@/lib/concreteReceipts";
import type { RemisionDespacho } from "@/app/(dashboard)/ventas/remisiones/page";
import AppSelect from "@/components/AppSelect";
import { upsertDocument, deleteDocument, getCollectionDocs, COLLECTIONS, subscribeToCollection, where } from "@/lib/db";
import { currency } from "@/lib/formatters";
import { filterByPlanta, withPlantaTag, getStoredSession } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClienteDoc {
  id: string;
  razonSocial: string;
}

interface Pago {
  id: string;
  fecha: string;
  cliente: string;
  clienteId?: string;
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
  origenRecibo?: boolean;
  reciboId?: string;
  reciboFolio?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s?: string | null) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
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

const METODOS = ["Cheque", "Efectivo", "Tarjeta", "Transferencia"] as const;
const BANCOS  = ["Banamex", "Banregio", "BBVA", "HSBC", "Otro", "Santander"] as const;

type View = "list" | "new" | "detail";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CobrosPage() {
  const [pagos, setPagos]           = useState<Pago[]>([]);
  const [progs, setProgs]           = useState<Prog[]>([]);
  const [clientesList, setClientesList] = useState<ClienteDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<View>("list");
  const [selected, setSelected]     = useState<Pago | null>(null);

  const [pagoAElim, setPagoAElim]   = useState<Pago | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [prefillClienteId, setPrefillClienteId] = useState<string | null>(null);

  // Recibos de concreto globales — para calcular saldo correcto en el landing
  const [todosRecibos, setTodosRecibos]     = useState<ConcreteReceipt[]>([]);

  // Estado de Cuenta por cliente
  const [cuentaCliente, setCuentaCliente]   = useState("");
  const [cuentaRecibos, setCuentaRecibos]   = useState<ConcreteReceipt[]>([]);
  const [cuentaRemisiones, setCuentaRemisiones] = useState<RemisionDespacho[]>([]);
  const [cuentaLoading, setCuentaLoading]   = useState(false);
  const [cuentaTab, setCuentaTab]           = useState<"entregas" | "remisiones" | "programaciones" | "pagos">("entregas");
  const [saldarRemision, setSaldarRemision] = useState<RemisionDespacho | null>(null);

  useEffect(() => {
    let loadedPagos = false;
    let loadedProgs = false;
    let loadedClientes = false;
    function checkDone() {
      if (loadedPagos && loadedProgs && loadedClientes) setLoading(false);
    }

    // Server-side planta filter for Pesquería — Allende/Todas still do client-side filter
    const planta = getStoredSession()?.planta;
    const plantaQ = planta === "Pesquería" ? [where("planta", "==", "Pesquería")] : [];

    const unsubPagos = subscribeToCollection<Pago>(COLLECTIONS.pagos, (docs) => {
      setPagos(filterByPlanta(docs).sort((a, b) => b.fecha.localeCompare(a.fecha)));
      if (!loadedPagos) { loadedPagos = true; checkDone(); }
    }, plantaQ);
    const unsubProgs = subscribeToCollection<Prog>(COLLECTIONS.programaciones, (docs) => {
      setProgs(filterByPlanta(docs));
      if (!loadedProgs) { loadedProgs = true; checkDone(); }
    }, plantaQ);

    getCollectionDocs<ClienteDoc>(COLLECTIONS.clientes).then((cl) => {
      setClientesList(cl.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, "es")));
      loadedClientes = true;
      checkDone();
    });

    // Carga en background — recibos de concreto para calcular saldo real en el landing
    getCollectionDocs<ConcreteReceipt & { receiptNumber?: number }>(COLLECTIONS.remisiones).then((docs) => {
      setTodosRecibos(
        filterByPlanta(docs).filter(
          (d) => typeof d.receiptNumber === "number" && d.receiptNumber >= 1
        ) as ConcreteReceipt[]
      );
    });

    return () => { unsubPagos(); unsubProgs(); };
  }, []);


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

  async function loadCuentaCliente(nombre: string) {
    setCuentaCliente(nombre);
    setCuentaRecibos([]);
    setCuentaRemisiones([]);
    if (!nombre) return;
    setCuentaLoading(true);
    try {
      // Recibos guardan cliente en MAYÚSCULAS; progs puede tener case diferente.
      // Buscamos ambas variantes en una sola pasada sin índice compuesto.
      const nameU = nombre.trim().toUpperCase().replace(/\s+/g, " ");
      const variants = [nombre];
      if (nameU !== nombre) variants.push(nameU);
      const allResults = await Promise.all(
        variants.map((v) =>
          getCollectionDocs<ConcreteReceipt & RemisionDespacho & { tipo?: string; receiptNumber?: number }>(
            COLLECTIONS.remisiones, [where("cliente", "==", v)]
          )
        )
      );
      const seen = new Set<string>();
      const allDocs = allResults.flat().filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
      const recibos = allDocs.filter((r) => typeof r.receiptNumber === "number" && r.receiptNumber >= 1) as unknown as ConcreteReceipt[];
      const remisiones = allDocs.filter((r) => r.tipo === "despacho") as unknown as RemisionDespacho[];
      setCuentaRecibos(recibos.sort((a, b) => b.receiptNumber - a.receiptNumber));
      setCuentaRemisiones(remisiones.sort((a, b) => b.fecha.localeCompare(a.fecha)));
    } catch (e) {
      console.error("loadCuentaCliente:", e);
    } finally {
      setCuentaLoading(false);
    }
  }

  function handleSaldarRemision(remision: RemisionDespacho, data: { montoPagado: number; fechaPago: string; metodoPago: string }) {
    const updated = { ...remision, pagado: true, ...data };
    upsertDocument(COLLECTIONS.remisiones, remision.id!, { pagado: true, montoPagado: data.montoPagado, fechaPago: data.fechaPago, metodoPago: data.metodoPago })
      .then(() => setCuentaRemisiones((prev) => prev.map((r) => r.id === remision.id ? updated : r)))
      .catch(console.error);
    setSaldarRemision(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-[#CC2229] border-t-transparent animate-spin" />
    </div>
  );

  if (view === "new") return (
    <NuevoPagoView
      clientesList={clientesList}
      progs={progs}
      prefillClienteId={prefillClienteId ?? undefined}
      onBack={() => { setView("list"); setPrefillClienteId(null); }}
      onCreated={onPagoCreated}
    />
  );

  if (view === "detail" && selected) return (
    <DetallePagoView pago={selected} progs={progs} onBack={() => setView("list")} onUpdated={onAbonosUpdated} />
  );

  // ── LIST ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cobros</h1>
        <p className="text-xs text-gray-400 mt-0.5">Estado de cuenta por cliente</p>
      </div>

      <CuentaClienteView
        clientesList={clientesList}
        progs={progs}
        pagos={pagos}
        todosRecibos={todosRecibos}
        cuentaCliente={cuentaCliente}
        cuentaRecibos={cuentaRecibos}
        cuentaRemisiones={cuentaRemisiones}
        cuentaLoading={cuentaLoading}
        cuentaTab={cuentaTab}
        onSelectCliente={(n) => { loadCuentaCliente(n); setCuentaTab("entregas"); }}
        onCuentaTab={setCuentaTab}
        onNuevoPago={(cid) => { setPrefillClienteId(cid); setView("new"); }}
        onSaldarRemision={setSaldarRemision}
      />
      {saldarRemision && (
        <SaldarRemisionModal
          remision={saldarRemision}
          onClose={() => setSaldarRemision(null)}
          onConfirm={(data) => handleSaldarRemision(saldarRemision, data)}
        />
      )}

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

// ─── Saldar Remisión Modal ────────────────────────────────────────────────────

function SaldarRemisionModal({
  remision, onClose, onConfirm,
}: {
  remision: RemisionDespacho;
  onClose: () => void;
  onConfirm: (data: { montoPagado: number; fechaPago: string; metodoPago: string }) => void;
}) {
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("Transferencia");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    setLoading(true);
    await onConfirm({ montoPagado: m, fechaPago: fecha, metodoPago: metodo });
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Saldar Remisión</h3>
            <p className="text-xs text-gray-400 mt-0.5">No. {remision.noRemision} · {remision.m3} m³</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto Pagado</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-7 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#CC2229] focus:ring-1 focus:ring-[#CC2229]/20 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha de Pago</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#CC2229] focus:ring-1 focus:ring-[#CC2229]/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Método de Pago</label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#CC2229] focus:ring-1 focus:ring-[#CC2229]/20 transition-colors bg-white cursor-pointer"
            >
              {["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] disabled:opacity-60 rounded-xl transition-colors cursor-pointer">
              {loading ? "Guardando…" : "Confirmar Pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Estado de Cuenta por Cliente ────────────────────────────────────────────

function CuentaClienteView({
  clientesList, progs, pagos, todosRecibos, cuentaCliente, cuentaRecibos, cuentaRemisiones, cuentaLoading,
  cuentaTab, onSelectCliente, onCuentaTab, onNuevoPago, onSaldarRemision,
}: {
  clientesList: ClienteDoc[];
  progs: Prog[];
  pagos: Pago[];
  todosRecibos: ConcreteReceipt[];
  cuentaCliente: string;
  cuentaRecibos: ConcreteReceipt[];
  cuentaRemisiones: RemisionDespacho[];
  cuentaLoading: boolean;
  cuentaTab: "entregas" | "remisiones" | "programaciones" | "pagos";
  onSelectCliente: (nombre: string) => void;
  onCuentaTab: (t: "entregas" | "remisiones" | "programaciones" | "pagos") => void;
  onNuevoPago: (clienteId: string | null) => void;
  onSaldarRemision: (r: RemisionDespacho) => void;
}) {
  const [search, setSearch] = useState("");

  // Clientes únicos con actividad (progs, pagos o recibos con saldo pendiente)
  const clientesActivos = useMemo(() => {
    const names = new Set<string>();
    progs.forEach((p) => { if (p.cliente && !p.origenRecibo) names.add(p.cliente); });
    pagos.forEach((p) => { if (p.cliente) names.add(p.cliente); });
    todosRecibos.forEach((r) => {
      if (r.cliente && calculateConcreteReceiptTotal(r).resta > 0.01) names.add(r.cliente);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "es"));
  }, [progs, pagos, todosRecibos]);

  const clientesFiltrados = useMemo(() =>
    search ? clientesActivos.filter((c) => norm(c).includes(norm(search))) : clientesActivos,
    [clientesActivos, search],
  );

  // Datos para el dashboard de landing — dos modelos según tipo de cliente
  const clientesData = useMemo(() =>
    clientesFiltrados.map((nombre) => {
      const cp = progs.filter((p) => norm(p.cliente) === norm(nombre) && !p.origenRecibo);
      const clienteRecibos = todosRecibos.filter((r) => norm(r.cliente) === norm(nombre));
      const hasProgs = cp.length > 0;

      let cartera: number;
      let saldo: number;

      if (hasProgs) {
        // Modelo crédito: COMPRAS=progs, PAGOS=recibos(total)+pagos
        cartera = cp.reduce((s, p) => s + (p.total ?? 0), 0);
        const cobradoRecibos = clienteRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).total, 0);
        const cobradoPagos   = pagos.filter((p) => norm(p.cliente) === norm(nombre)).reduce((s, p) => s + p.cantidad, 0);
        saldo = Math.max(0, cartera - cobradoRecibos - cobradoPagos);
      } else {
        // Modelo efectivo parcial: cartera=recibo.total, saldo=recibo.resta
        cartera = clienteRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).total, 0);
        saldo   = clienteRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).resta, 0);
      }

      return { nombre, numProgs: cp.length, cartera, saldo };
    }),
    [clientesFiltrados, progs, todosRecibos, pagos],
  );
  const totalCartera   = useMemo(() => clientesData.reduce((s, c) => s + c.cartera, 0), [clientesData]);
  const totalPorCobrar = useMemo(() => clientesData.reduce((s, c) => s + c.saldo, 0), [clientesData]);
  const numConSaldo    = useMemo(() => clientesData.filter((c) => c.saldo > 0.01).length, [clientesData]);

  // Datos del cliente seleccionado
  const clienteProgs = useMemo(() =>
    progs.filter((p) => norm(p.cliente) === norm(cuentaCliente) && !p.origenRecibo),
    [progs, cuentaCliente],
  );
  const clientePagos = useMemo(() =>
    pagos.filter((p) => norm(p.cliente) === norm(cuentaCliente)).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [pagos, cuentaCliente],
  );

  // Modelo según tipo de cliente
  const esClienteRecibo = clienteProgs.length === 0; // sin programaciones → modelo efectivo parcial

  // Modelo crédito: COMPRAS=progs, PAGOS=recibos.total+pagos
  const totalCompras   = useMemo(() => clienteProgs.reduce((s, p) => s + (p.total ?? 0), 0), [clienteProgs]);
  const totalEfectivo  = useMemo(() => cuentaRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).total, 0), [cuentaRecibos]);
  const totalPagosAd   = useMemo(() => clientePagos.reduce((s, p) => s + p.cantidad, 0), [clientePagos]);

  // Modelo efectivo parcial: FACTURADO=recibos.total, COBRADO=recibos.anticipo, POR COBRAR=recibos.resta
  const totalFacturado = useMemo(() => cuentaRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).total, 0), [cuentaRecibos]);
  const totalCobrado   = useMemo(() => cuentaRecibos.reduce((s, r) => s + (r.anticipo ?? 0), 0), [cuentaRecibos]);
  const totalResta     = useMemo(() => cuentaRecibos.reduce((s, r) => s + calculateConcreteReceiptTotal(r).resta, 0), [cuentaRecibos]);

  const totalPagos = esClienteRecibo ? totalCobrado : (totalEfectivo + totalPagosAd);
  const compras    = esClienteRecibo ? totalFacturado : totalCompras;
  const saldo      = esClienteRecibo ? totalResta : Math.max(0, totalCompras - totalEfectivo - totalPagosAd);

  const clienteDoc = clientesList.find((c) => norm(c.razonSocial) === norm(cuentaCliente));

  if (!cuentaCliente) {
    return (
      <div className="space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Cartera total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{currency(totalCartera)}</p>
            <p className="text-xs text-gray-400 mt-1">{clientesActivos.length} clientes activos</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Por cobrar</p>
            <p className={`text-2xl font-bold mt-1 ${totalPorCobrar > 0 ? "text-red-600" : "text-green-600"}`}>{currency(totalPorCobrar)}</p>
            <p className="text-xs text-gray-400 mt-1">saldo pendiente acumulado</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Con saldo pendiente</p>
            <p className={`text-2xl font-bold mt-1 ${numConSaldo > 0 ? "text-amber-600" : "text-green-600"}`}>{numConSaldo}</p>
            <p className="text-xs text-gray-400 mt-1">{numConSaldo === 1 ? "cliente" : "clientes"} con deuda activa</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…"
            className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#CC2229]/60 bg-white" />
        </div>

        {/* Tabla de clientes */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {clientesData.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Sin clientes con actividad</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">Cliente</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Progs.</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Cartera</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Saldo</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientesData.map(({ nombre, numProgs, cartera, saldo: sd }) => (
                  <tr key={nombre} onClick={() => onSelectCliente(nombre)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#CC2229]/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#CC2229]">{nombre.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-gray-800">{nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-500 text-xs">{numProgs}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-700">{currency(cartera)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {sd > 0.01
                        ? <span className="inline-block font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-0.5 text-xs">{currency(sd)}</span>
                        : <span className="text-xs text-green-600 font-medium">Al corriente</span>}
                    </td>
                    <td className="pr-4 text-right">
                      <ChevronRight size={15} className="text-gray-300 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header cliente */}
      <div className="flex items-center gap-3">
        <button onClick={() => onSelectCliente("")}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer text-gray-500">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">{cuentaCliente}</h2>
          <p className="text-xs text-gray-400">Estado de cuenta</p>
        </div>
        <button
          onClick={() => onNuevoPago(clienteDoc?.id ?? null)}
          className="flex items-center gap-2 px-4 py-2 bg-[#CC2229] hover:bg-[#B01E24] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {/* Resumen COMPRAS / PAGOS / SALDO */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: esClienteRecibo ? "Facturado" : "Compras",
            value: currency(compras),
            color: "text-gray-900",
          },
          {
            label: esClienteRecibo ? "Cobrado" : "Pagos",
            value: currency(totalPagos),
            sub: esClienteRecibo
              ? `${cuentaRecibos.length} recibo${cuentaRecibos.length !== 1 ? "s" : ""}`
              : `${currency(totalEfectivo)} efectivo · ${currency(totalPagosAd)} adicional`,
            color: "text-green-700",
          },
          {
            label: "Saldo",
            value: currency(saldo),
            color: saldo > 0.01 ? "text-red-600" : "text-green-600",
            badge: saldo > 0.01 ? "Por cobrar" : "Al corriente",
          },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
            {k.badge && (
              <span className={`inline-block mt-2 text-xs font-semibold rounded-full px-2 py-0.5 ${saldo > 0.01 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                {k.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {([
          ["entregas",       `Efectivo (${cuentaRecibos.length})`],
          ["remisiones",     `Remisiones (${cuentaRemisiones.length})`],
          ["programaciones", `Programaciones (${clienteProgs.length})`],
          ["pagos",          `Pagos (${clientePagos.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => onCuentaTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer -mb-px ${cuentaTab === t ? "border-[#CC2229] text-[#CC2229]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Entregas (recibos de concreto) */}
      {cuentaTab === "entregas" && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {cuentaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#CC2229]" />
            </div>
          ) : cuentaRecibos.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Sin recibos de concreto para este cliente</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Folio","Fecha","m³","Precio/m³","Total","Anticipo","Resta"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${["Total","Anticipo","Resta","m³","Precio/m³"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cuentaRecibos.map((r) => {
                  const { total, resta } = calculateConcreteReceiptTotal(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#CC2229]">#{String(r.receiptNumber).padStart(4, "0")}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(r.fecha)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{r.m3}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{currency(r.precioPorM3)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{currency(total)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{currency(r.anticipo ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={resta > 0.01 ? "font-semibold text-amber-600" : "text-gray-400"}>{currency(resta)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Remisiones de despacho */}
      {cuentaTab === "remisiones" && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {cuentaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#CC2229]" />
            </div>
          ) : cuentaRemisiones.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Sin remisiones de despacho para este cliente</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["No.","Fecha","m³","Monto","Mezcla","Obra","CR","Estado","Pago",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cuentaRemisiones.map((r) => (
                  <tr key={r.id ?? r.noRemision} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#CC2229] text-xs">{r.noRemision}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.fecha}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.m3} m³</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 tabular-nums">{currency(r.monto ?? 0)}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.mezcla ? <span className="bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">{r.mezcla}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{r.obra || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{r.cr || "—"}</td>
                    <td className="px-4 py-3">
                      {r.status === "creada"
                        ? <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">Creada</span>
                        : <span className="bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.pagado
                        ? <span className="bg-green-50 border border-green-200 text-green-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">Saldada</span>
                        : <span className="bg-red-50 border border-red-200 text-red-600 rounded-full px-2 py-0.5 text-[11px] font-semibold">Por cobrar</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!r.pagado && r.monto && r.monto > 0 && (
                        <button onClick={() => onSaldarRemision(r)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-lg transition-colors cursor-pointer">
                          Saldar
                        </button>
                      )}
                      {!r.pagado && (!r.monto || r.monto === 0) && (
                        <span className="text-xs text-gray-400">Sin monto</span>
                      )}
                      {r.pagado && r.montoPagado && (
                        <span className="text-xs text-green-700 font-medium">{currency(r.montoPagado)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Programaciones */}
      {cuentaTab === "programaciones" && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {clienteProgs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Sin programaciones</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Fecha","Folio","Obra","Total","Pagado","Saldo","Recibo"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${["Total","Pagado","Saldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...clienteProgs].sort((a, b) => b.dia.localeCompare(a.dia)).map((p) => {
                  const sp = saldoPendiente(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-[#CC2229] font-medium">{fmtDate(p.dia)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.folio || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{p.nombreObra || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">{currency(p.total ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{currency(p.montoPagado ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={sp > 0.01 ? "font-semibold text-amber-600" : "text-gray-400"}>{currency(sp)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.reciboFolio || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Pagos adicionales */}
      {cuentaTab === "pagos" && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {clientePagos.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10">Sin pagos registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Fecha","Tipo","Banco","Cantidad","Anticipo"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${h === "Cantidad" ? "text-right" : h === "Anticipo" ? "text-center" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientePagos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-[#CC2229] font-medium">{fmtDate(p.fecha)}</td>
                    <td className="px-4 py-3 text-gray-600">{p.tipoPago || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.banco || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{currency(p.cantidad)}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className={p.anticipo ? "text-blue-600 font-medium" : "text-gray-300"}>
                        {p.anticipo ? "Sí" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Nuevo Pago ───────────────────────────────────────────────────────────────

function NuevoPagoView({ clientesList, progs, prefillClienteId, onBack, onCreated }: {
  clientesList: ClienteDoc[];
  progs: Prog[];
  prefillClienteId?: string;
  onBack: () => void;
  onCreated: (pago: Pago) => void;
}) {
  const [fecha, setFecha]               = useState(todayCST());
  const [clienteId, setClienteId]       = useState(prefillClienteId ?? "");
  const [cliente, setCliente]           = useState(() => {
    if (!prefillClienteId) return "";
    const found = clientesList.find((c) => c.id === prefillClienteId);
    return found ? norm(found.razonSocial) : "";
  });
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

  function handleClienteChange(id: string) {
    setClienteId(id);
    const found = clientesList.find((c) => c.id === id);
    setCliente(found ? norm(found.razonSocial) : "");
    setCantidad("");
  }

  const needsBanco = tipoPago === "Transferencia" || tipoPago === "Cheque";

  async function handleSave() {
    if (!fecha || !clienteId || !cantidad || parseFloat(cantidad) <= 0 || !tipoPago) {
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
        ...(clienteId ? { clienteId } : {}),
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
            <AppSelect value={clienteId} onChange={(e) => handleClienteChange(e.target.value)}>
              <option value="">Seleccionar cliente…</option>
              {clientesList.map((c) => (
                <option key={c.id} value={c.id}>{c.razonSocial}</option>
              ))}
            </AppSelect>
          </div>
        </div>

        {/* Resumen saldo cliente */}
        {cliente && progsCliente.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">{progsCliente.length} colada{progsCliente.length !== 1 ? "s" : ""} pendiente{progsCliente.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {progsCliente.map((p) => p.reciboFolio || p.folio || p.id.slice(-6)).join(", ")}
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
            <AppSelect value={tipoPago} onChange={(e) => { setTipoPago(e.target.value); if (e.target.value === "Efectivo" || e.target.value === "Tarjeta") setBanco(""); }}>
              <option value="">Seleccionar…</option>
              {METODOS.map((m) => <option key={m}>{m}</option>)}
            </AppSelect>
          </div>
          {/* Banco */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Cuenta bancaria {needsBanco && <span className="text-[#CC2229]">*</span>}
            </label>
            <AppSelect value={banco} onChange={(e) => setBanco(e.target.value)} disabled={!needsBanco}>
              <option value="">Seleccionar…</option>
              {BANCOS.map((b) => <option key={b}>{b}</option>)}
            </AppSelect>
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
              <AppSelect value={selectedProgId} onChange={(e) => handleSelectProg(e.target.value)}>
                <option value="">Seleccionar…</option>
                {pendientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reciboFolio || p.folio || p.id.slice(-6)} · {fmtDate(p.dia)} · {currency(saldoPendiente(p))}
                  </option>
                ))}
              </AppSelect>
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
                        Remisión: {p.reciboFolio || p.folio || p.id.slice(-6)}
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
