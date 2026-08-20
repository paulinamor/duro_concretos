"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  Calculator,
  DollarSign,
  MessageCircle,
  Package,
  Plus,
  Printer,
  ReceiptText,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateConcreteReceiptTotal,
  ConcreteExtra,
  ConcreteReceipt,
  ConcreteSupplyType,
  concreteReceiptObras,
  concreteReceiptResistencias,
  defaultConcreteExtras,
  formatReceiptDate,
  syncReceiptWithTrip,
} from "@/lib/concreteReceipts";
import { upsertDocument, deleteDocument, COLLECTIONS, getCollectionDocs } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
import { useCollectionWithLoading } from "@/lib/useCollection";
import type { Cliente } from "@/lib/crmClientes";
import KPICard from "@/components/KPICard";

function money(value: number | undefined | null) {
  return `$${(value ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getNextReceiptNumber(receipts: ConcreteReceipt[]) {
  if (receipts.length === 0) return 1;
  return receipts.reduce((max, item) => Math.max(max, item.receiptNumber), 0) + 1;
}

function createReceipt(receipts: ConcreteReceipt[]): ConcreteReceipt {
  const nextNumber = getNextReceiptNumber(receipts);
  const today = todayCST();

  return {
    id: `REC-${nextNumber}`,
    receiptNumber: nextNumber,
    cliente: "",
    direccionObra: "",
    m3: 0,
    resistencia: "",
    supplyType: "Tiro directo",
    servicioBomba: "",
    metrosVaciosCantidad: 0,
    metrosVaciosPrecio: 0,
    precioPorM3: 0,
    anticipo: 0,
    nota: "",
    firmaCliente: "",
    recibidoPor: "",
    fecha: today,
    extras: defaultConcreteExtras.map((extra) => ({ ...extra })),
    total: 0,
    resta: 0,
    viajeFolio: `VJ-2026-${nextNumber}`,
  };
}

export default function RecibosConcretoPage() {
  const { data: allRemisiones, loading } = useCollectionWithLoading<ConcreteReceipt>(COLLECTIONS.remisiones);
  const savedReceipts = useMemo(
    () => allRemisiones.filter((r) => r.receiptNumber != null),
    [allRemisiones],
  );

  const [receipt, setReceipt] = useState<ConcreteReceipt>(() => createReceipt([]));
  const [isLoadedReceipt, setIsLoadedReceipt] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clienteSuggestions, setClienteSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const nextReceiptNum = useMemo(() => getNextReceiptNumber(savedReceipts), [savedReceipts]);
  const effectiveReceiptNumber = isLoadedReceipt ? receipt.receiptNumber : nextReceiptNum;

  const totalM3 = useMemo(() => savedReceipts.reduce((s, r) => s + (r.m3 ?? 0), 0), [savedReceipts]);
  const totalFacturado = useMemo(() => savedReceipts.reduce((s, r) => s + (r.total ?? 0), 0), [savedReceipts]);
  const totalPendiente = useMemo(() => savedReceipts.reduce((s, r) => s + (r.resta ?? 0), 0), [savedReceipts]);

  const filteredReceipts = useMemo(() => {
    const sorted = [...savedReceipts].sort((a, b) => b.receiptNumber - a.receiptNumber);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (r) =>
        String(r.receiptNumber).includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.direccionObra.toLowerCase().includes(q),
    );
  }, [savedReceipts, search]);

  useEffect(() => {
    getCollectionDocs<Cliente>(COLLECTIONS.clientes).then((clientes) => {
      const names = clientes
        .map((c) => c.razonSocial)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
      setClienteSuggestions(Array.from(new Set(names)));
    });
  }, []);

  const totals = useMemo(() => calculateConcreteReceiptTotal(receipt), [receipt]);
  const receiptDate = formatReceiptDate(receipt.fecha);
  const realTotal = totals.total * 10;
  const realResta = totals.resta * 10;

  function updateReceipt(partial: Partial<ConcreteReceipt>) {
    setReceipt((current) => ({
      ...current,
      ...partial,
      ...calculateConcreteReceiptTotal({ ...current, ...partial }),
    }));
  }

  function updateExtra(index: number, partial: Partial<ConcreteExtra>) {
    setReceipt((current) => {
      const extras = current.extras.map((extra, extraIndex) =>
        extraIndex === index ? { ...extra, ...partial } : extra,
      );
      return {
        ...current,
        extras,
        ...calculateConcreteReceiptTotal({ ...current, extras }),
      };
    });
  }

  function openNew() {
    setReceipt(createReceipt([]));
    setIsLoadedReceipt(false);
    setShowForm(true);
  }

  function resetToNew() {
    setReceipt(createReceipt([]));
    setIsLoadedReceipt(false);
    setShowForm(false);
  }

  async function persistReceipt(showToast = true) {
    const num = effectiveReceiptNumber;
    const id = `REC-${num}`;
    const { planta: _p, ...data } = receipt as ConcreteReceipt & { planta?: string };
    const nextReceipt: ConcreteReceipt = {
      ...data,
      id,
      receiptNumber: num,
      cliente: data.cliente.trim().toUpperCase().replace(/\s+/g, " "),
      total: realTotal,
      resta: realResta,
      viajeFolio: `VJ-2026-${num}`,
    };
    const { id: docId, ...saveData } = nextReceipt;
    await upsertDocument(COLLECTIONS.remisiones, docId, withPlantaTag(saveData));
    syncReceiptWithTrip(nextReceipt).catch((err) => console.error("Error sincronizando viaje:", err));

    if (showToast) {
      window.dispatchEvent(
        new CustomEvent("duro:toast", {
          detail: { type: "success", message: "Recibo guardado y viaje pendiente creado." },
        }),
      );
    }
    return nextReceipt;
  }

  async function saveReceipt() {
    setSaving(true);
    try {
      await persistReceipt();
      resetToNew();
    } finally {
      setSaving(false);
    }
  }

  async function printReceipt() {
    setSaving(true);
    try {
      await persistReceipt(false);
      window.print();
      window.setTimeout(resetToNew, 0);
    } finally {
      setSaving(false);
    }
  }

  function getTicketAmounts(targetReceipt: ConcreteReceipt) {
    const total = targetReceipt.total ?? 0;
    const resta = targetReceipt.resta ?? 0;
    return { realTotal: total, realResta: resta };
  }

  async function sendWhatsApp(targetReceipt = receipt, shouldSave = true) {
    let messageReceipt = targetReceipt;
    if (shouldSave) {
      setSaving(true);
      try {
        messageReceipt = await persistReceipt(false);
        resetToNew();
      } finally {
        setSaving(false);
      }
    }
    const amounts = shouldSave ? { realTotal, realResta } : getTicketAmounts(messageReceipt);
    const message = [
      `Recibo concreto premezclado No. ${messageReceipt.receiptNumber}`,
      `Cliente: ${messageReceipt.cliente}`,
      `Obra: ${messageReceipt.direccionObra}`,
      `M3: ${messageReceipt.m3}`,
      `Resistencia: ${messageReceipt.resistencia}`,
      `Suministro: ${messageReceipt.supplyType}`,
      `Precio/m3: ${money(messageReceipt.precioPorM3)}`,
      `Total: ${money(amounts.realTotal)}`,
      `Resta: ${money(amounts.realResta)}`,
      `Nota: ${messageReceipt.nota || "Sin nota"}`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function deleteReceipt(id: string) {
    await deleteDocument(COLLECTIONS.remisiones, id);
    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: { type: "success", message: "Recibo eliminado." },
      }),
    );
  }

  function loadSavedReceipt(savedReceipt: ConcreteReceipt) {
    setReceipt({
      ...savedReceipt,
      total: savedReceipt.total / 10,
      resta: savedReceipt.resta / 10,
    });
    setIsLoadedReceipt(true);
    setShowForm(true);
  }

  function printSavedReceipt(savedReceipt: ConcreteReceipt) {
    flushSync(() => {
      setReceipt({ ...savedReceipt, total: savedReceipt.total / 10, resta: savedReceipt.resta / 10 });
      setIsLoadedReceipt(true);
    });
    window.print();
    resetToNew();
  }

  // ─── Shared input class ───────────────────────────────────────────────────────
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";
  const inp =
    "w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #printable-concrete-receipt,
          #printable-concrete-receipt * {
            visibility: visible !important;
          }

          #printable-concrete-receipt {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            min-height: 100vh !important;
            background: white !important;
            padding: 0.35in !important;
            color: black !important;
          }

          @page {
            size: letter landscape;
            margin: 0;
          }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-gray-500">Captura digital del recibo físico de concreto premezclado</p>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#B01E24] transition-colors shadow-md shadow-[#CC2229]/20 cursor-pointer"
        >
          <Plus size={16} />
          Nuevo recibo
        </button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <KPICard
          title="Total recibos"
          value={loading ? "…" : String(savedReceipts.length)}
          icon={ReceiptText}
          iconColor="text-[#CC2229]"
          iconBg="bg-[#CC2229]/10"
        />
        <KPICard
          title="Total m³"
          value={loading ? "…" : `${totalM3.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`}
          icon={Package}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <KPICard
          title="Total facturado"
          value={loading ? "…" : money(totalFacturado)}
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <KPICard
          title="Pendiente cobro"
          value={loading ? "…" : money(totalPendiente)}
          icon={Calculator}
          iconColor={totalPendiente > 0 ? "text-amber-400" : "text-emerald-400"}
          iconBg={totalPendiente > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}
        />
      </div>

      {/* ── Saved receipts table ──────────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden print:hidden">
        {/* Table header */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div>
            <h3 className="font-semibold text-white">Recibos guardados</h3>
            <p className="mt-0.5 text-xs text-gray-500">Consulta, edita, imprime o manda por WhatsApp.</p>
          </div>
          <div className="ml-auto relative min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar folio, cliente, obra…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <svg className="h-8 w-8 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-400">Cargando recibos…</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ReceiptText size={30} className="mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">
              {search ? "Sin resultados para esa búsqueda." : "No hay recibos guardados aún."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["No.", "Fecha", "Cliente", "Obra", "M³", "Total", "Resta", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap bg-[#1A1A1A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredReceipts.map((savedReceipt) => {
                  const amounts = getTicketAmounts(savedReceipt);
                  return (
                    <tr key={savedReceipt.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#CC2229]">
                        #{String(savedReceipt.receiptNumber).padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {savedReceipt.fecha
                          ? new Date(savedReceipt.fecha + "T12:00:00").toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">
                        {savedReceipt.cliente || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate" title={savedReceipt.direccionObra}>
                        {savedReceipt.direccionObra || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{savedReceipt.m3} m³</td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        {money(amounts.realTotal)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{money(amounts.realResta)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadSavedReceipt(savedReceipt)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 border border-[#3A3A3A] hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => printSavedReceipt(savedReceipt)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
                            aria-label="Imprimir"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => sendWhatsApp(savedReceipt, false)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-green-400 transition-colors cursor-pointer"
                            aria-label="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(savedReceipt.id)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer"
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

      {/* ── Form drawer ───────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex print:hidden">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            onClick={resetToNew}
            aria-label="Cerrar"
          />
          <div className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-[#242424] border-l border-[#3A3A3A] shadow-2xl overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A3A] shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  {loading ? "Cargando…" : `Recibo #${String(effectiveReceiptNumber).padStart(4, "0")}`}
                </p>
                <h2 className="text-base font-bold text-white mt-0.5">
                  {isLoadedReceipt ? "Editar recibo" : "Nuevo recibo"}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetToNew}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Sección: Datos generales */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Datos generales</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>No. recibo</label>
                    <input
                      type="number"
                      value={loading ? "" : effectiveReceiptNumber}
                      readOnly
                      placeholder={loading ? "Cargando…" : ""}
                      className={`${inp} cursor-not-allowed opacity-60`}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Fecha</label>
                    <input
                      type="date"
                      value={receipt.fecha}
                      onChange={(e) => updateReceipt({ fecha: e.target.value })}
                      className={`${inp} date-input-white`}
                    />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Nombre del cliente</label>
                  <input
                    list="concrete-clients"
                    value={receipt.cliente}
                    onChange={(e) => updateReceipt({ cliente: e.target.value })}
                    placeholder="Nombre o razón social"
                    className={inp}
                  />
                  <datalist id="concrete-clients">
                    {clienteSuggestions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className={lbl}>Dirección de la obra</label>
                  <input
                    list="concrete-obras"
                    value={receipt.direccionObra}
                    onChange={(e) => updateReceipt({ direccionObra: e.target.value })}
                    placeholder="Calle, número, colonia…"
                    className={inp}
                  />
                  <datalist id="concrete-obras">
                    {concreteReceiptObras.map((o) => <option key={o} value={o} />)}
                  </datalist>
                </div>
              </div>

              {/* Sección: Concreto */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Concreto</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>M³</label>
                    <input
                      type="number"
                      value={receipt.m3}
                      onChange={(e) => updateReceipt({ m3: Number(e.target.value) })}
                      className={inp}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Resistencia</label>
                    <input
                      list="concrete-resistencias"
                      value={receipt.resistencia}
                      onChange={(e) => updateReceipt({ resistencia: e.target.value })}
                      placeholder="F'C 250-20-14…"
                      className={inp}
                    />
                    <datalist id="concrete-resistencias">
                      {concreteReceiptResistencias.map((r) => <option key={r} value={r} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className={lbl}>Tipo de suministro</label>
                    <select
                      value={receipt.supplyType}
                      onChange={(e) => updateReceipt({ supplyType: e.target.value as ConcreteSupplyType })}
                      className={inp}
                    >
                      <option>Tiro directo</option>
                      <option>Bombeado</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Servicio de bomba</label>
                    <input
                      value={receipt.servicioBomba}
                      onChange={(e) => updateReceipt({ servicioBomba: e.target.value })}
                      className={inp}
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Precios */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Precios</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Metros vacíos</label>
                    <input
                      type="number"
                      value={receipt.metrosVaciosCantidad}
                      onChange={(e) => updateReceipt({ metrosVaciosCantidad: Number(e.target.value) })}
                      className={inp}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Precio metro vacío</label>
                    <input
                      type="number"
                      value={receipt.metrosVaciosPrecio}
                      onChange={(e) => updateReceipt({ metrosVaciosPrecio: Number(e.target.value) })}
                      className={inp}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Precio por m³</label>
                    <input
                      type="number"
                      value={receipt.precioPorM3}
                      onChange={(e) => updateReceipt({ precioPorM3: Number(e.target.value) })}
                      className={inp}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Anticipo</label>
                    <input
                      type="number"
                      value={receipt.anticipo}
                      onChange={(e) => updateReceipt({ anticipo: Number(e.target.value) })}
                      className={inp}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Aditivos y extras */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Aditivos y extras</p>
                <div className="rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] divide-y divide-[#3A3A3A]">
                  {receipt.extras.map((extra, index) => (
                    <div key={extra.name} className="grid grid-cols-[auto_1fr_90px_68px] items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={extra.checked}
                        onChange={(e) => updateExtra(index, { checked: e.target.checked })}
                        className="h-4 w-4 accent-[#CC2229] cursor-pointer"
                      />
                      <span className="text-sm text-gray-300">{extra.name}</span>
                      <input
                        type="number"
                        value={extra.price}
                        onChange={(e) =>
                          updateExtra(index, {
                            price: Number(e.target.value),
                            checked: Number(e.target.value) > 0 || extra.checked,
                          })
                        }
                        className="rounded-lg border border-[#3A3A3A] bg-[#242424] px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-[#CC2229]/60"
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                      <input
                        value={extra.quantity}
                        onChange={(e) => updateExtra(index, { quantity: e.target.value })}
                        placeholder={extra.unit}
                        className="rounded-lg border border-[#3A3A3A] bg-[#242424] px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-[#CC2229]/60"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección: Nota y firma */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Nota y firma</p>
                <div>
                  <label className={lbl}>Nota</label>
                  <textarea
                    rows={2}
                    value={receipt.nota}
                    onChange={(e) => updateReceipt({ nota: e.target.value })}
                    className={`${inp} resize-none`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Firma cliente</label>
                    <input
                      value={receipt.firmaCliente}
                      onChange={(e) => updateReceipt({ firmaCliente: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Recibido por (R:)</label>
                    <input
                      value={receipt.recibidoPor}
                      onChange={(e) => updateReceipt({ recibidoPor: e.target.value })}
                      className={inp}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Totals bar */}
            <div className="grid grid-cols-2 gap-4 px-6 py-3 border-t border-[#3A3A3A] bg-[#1A1A1A] shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total</p>
                <p className="text-xl font-bold text-white">{money(realTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Resta</p>
                <p className="text-xl font-bold text-gray-300">{money(realResta)}</p>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="flex items-center gap-3 border-t border-[#3A3A3A] px-6 py-4 bg-[#242424] shrink-0">
              <button
                type="button"
                onClick={() => sendWhatsApp()}
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-green-500/60 hover:text-green-400 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <MessageCircle size={15} />
                WhatsApp
              </button>
              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  onClick={saveReceipt}
                  disabled={saving || loading}
                  className="flex items-center gap-2 rounded-xl border border-[#3A3A3A] px-4 py-2.5 text-sm font-medium text-gray-300 hover:border-[#CC2229]/60 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Save size={15} />
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={printReceipt}
                  disabled={loading || saving}
                  className="flex items-center gap-2 rounded-xl bg-[#CC2229] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B01E24] transition-colors shadow-md shadow-[#CC2229]/20 disabled:opacity-40 cursor-pointer"
                >
                  <Printer size={15} />
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable receipt (off-screen, print-only) ────────────────────────── */}
      <div
        id="printable-concrete-receipt"
        className="fixed -left-[9999px] top-0 w-[1050px] bg-white p-6 text-black print:static print:left-auto print:top-auto print:w-auto print:shadow-none"
      >
        <div className="rounded-[18px] border-[4px] border-black p-4">
          <div className="grid grid-cols-[1fr_180px] gap-4">
            <h1 className="text-center text-3xl font-black tracking-wide">CONCRETO PREMEZCLADO</h1>
            <div className="rounded-md border-2 border-black px-3 py-2 text-center">
              <p className="text-sm font-black">RECIBO</p>
              <p className="text-xl font-black text-[#B91C1C]">No. {effectiveReceiptNumber}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_300px] gap-4 text-[17px] font-black uppercase">
            <div className="space-y-1">
              <p>
                Nombre del cliente: <span className="receipt-line handwritten">{receipt.cliente}</span>
              </p>
              <p>
                Dirección de la obra: <span className="receipt-line handwritten">{receipt.direccionObra}</span>
              </p>
              <p>
                M³: <span className="short-line handwritten">{receipt.m3}</span>
                <span className="ml-6">F&apos;C</span>{" "}
                <span className="medium-line handwritten">{receipt.resistencia.replace("F'C ", "")}</span>
              </p>
              <p>
                Servicio de bomba: <span className="receipt-line handwritten">{receipt.servicioBomba}</span>
              </p>
            </div>
            <div className="space-y-2">
              <p>Tipo de suministro:</p>
              <label className="flex items-center gap-2">
                <span className="receipt-box">{receipt.supplyType === "Tiro directo" ? "✓" : ""}</span>
                Tiro directo
              </label>
              <label className="flex items-center gap-2">
                <span className="receipt-box">{receipt.supplyType === "Bombeado" ? "✓" : ""}</span>
                Bombeado
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[420px_1fr] gap-8">
            <div className="border-2 border-black p-2">
              <h2 className="text-center text-xl font-black">ADITIVOS Y EXTRAS</h2>
              <div className="mt-1 space-y-1 text-[15px] font-black uppercase">
                {receipt.extras.map((extra) => (
                  <div key={extra.name} className="grid grid-cols-[28px_1fr_90px_70px] items-center gap-1">
                    <span className="receipt-box">{extra.checked ? "✓" : ""}</span>
                    <span>{extra.name}: $</span>
                    <span className="line-only handwritten">{extra.checked && extra.price ? extra.price : ""}</span>
                    <span className="line-only handwritten">{extra.quantity || extra.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 text-[18px] font-black uppercase">
              <p>
                Metros vacíos:
                <span className="short-line handwritten">{receipt.metrosVaciosCantidad || ""}</span>
                <span className="handwritten">{money(receipt.metrosVaciosPrecio)}</span>
                <span className="ml-2">C/U</span>
              </p>
              <p>
                Precio por m³:
                <span className="medium-line handwritten">{money(receipt.precioPorM3)}</span>
                Total:
                <span className="medium-line handwritten">{money(realTotal)}</span>
              </p>
              <p>
                Anticipo 1:
                <span className="medium-line handwritten">{receipt.anticipo ? money(receipt.anticipo) : ""}</span>
                Resta:
                <span className="medium-line handwritten">{money(realResta)}</span>
              </p>
              <p>
                Nota: <span className="receipt-line handwritten">{receipt.nota}</span>
              </p>
              <div className="pt-6 text-center">
                <p className="mx-auto w-72 border-b-2 border-black handwritten">{receipt.firmaCliente}</p>
                <p className="text-sm leading-tight">
                  Nombre y
                  <br />
                  firma del cliente
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_240px] items-end gap-4 text-[17px] font-black uppercase">
            <p>
              Allende, N.L. a
              <span className="short-line handwritten">{receiptDate.day}</span>
              de
              <span className="medium-line handwritten">{receiptDate.month}</span>
              del 20
              <span className="short-line handwritten">{receiptDate.year.slice(-2)}</span>
            </p>
            <p className="flex items-end gap-2 whitespace-nowrap">
              R: <span className="r-line handwritten">{receipt.recibidoPor}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Delete confirm modal ──────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center print:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDeleteId(null)}
          />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar recibo</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar este recibo? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deleteReceipt(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .receipt-line {
          display: inline-block;
          min-width: 320px;
          border-bottom: 2px solid #111;
          padding: 0 8px;
          text-transform: none;
        }

        .short-line {
          display: inline-block;
          min-width: 58px;
          border-bottom: 2px solid #111;
          padding: 0 6px;
          text-align: center;
          text-transform: none;
        }

        .medium-line {
          display: inline-block;
          min-width: 150px;
          border-bottom: 2px solid #111;
          padding: 0 6px;
          text-transform: none;
        }

        .r-line {
          display: inline-block;
          width: 185px;
          max-width: 185px;
          min-height: 24px;
          border-bottom: 2px solid #111;
          overflow: hidden;
          text-transform: none;
          white-space: nowrap;
        }

        .line-only {
          display: inline-block;
          min-height: 20px;
          border-bottom: 2px solid #111;
          text-transform: none;
        }

        .receipt-box {
          display: inline-flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border: 2px solid #111;
          font-size: 20px;
          line-height: 1;
        }

        .handwritten {
          color: #1e3a8a;
          font-family: "Comic Sans MS", "Bradley Hand", cursive;
          font-size: 1.1em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
