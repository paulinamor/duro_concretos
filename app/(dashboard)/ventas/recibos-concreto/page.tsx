"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Calculator, ChevronDown, DollarSign, MessageCircle, Package,
  Plus, Printer, ReceiptText, Save, Search, Trash2, X,
} from "lucide-react";
import {
  calculateConcreteReceiptTotal, ConcreteReceipt, ConcreteProducto,
  ConcreteAditivo, ConcreteExtraRow, concreteReceiptResistencias,
  defaultAditivos, formatReceiptDate, getTotalM3, getTotalM3Bombeado,
  makeProducto, makeExtraLibre, migrateReceipt, syncReceiptWithTrip,
} from "@/lib/concreteReceipts";
import { upsertDocument, deleteDocument, COLLECTIONS, getCollectionDocs } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";
import { useCollectionWithLoading, useCollectionRawWithLoading } from "@/lib/useCollection";
import type { Cliente } from "@/lib/crmClientes";
import { matchesQuery } from "@/lib/search";
import KPICard from "@/components/KPICard";
import AppSelect from "@/components/AppSelect";

interface Obra { id: string; cliente: string; nombre: string; direccion: string; }

const normCl = (s: string) => s.split("//")[0].trim().toUpperCase().replace(/\s+/g, " ");

function money(value: number | undefined | null) {
  return `$${(value ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moneyNum(value: number | undefined | null) {
  return (value ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getNextReceiptNumber(receipts: ConcreteReceipt[]) {
  if (receipts.length === 0) return 1;
  return receipts.reduce((max, item) => Math.max(max, item.receiptNumber), 0) + 1;
}

function createReceipt(receipts: ConcreteReceipt[]): ConcreteReceipt {
  const nextNumber = getNextReceiptNumber(receipts);
  return {
    id: `REC-${nextNumber}`,
    receiptNumber: nextNumber,
    cliente: "",
    direccionObra: "",
    productos: [makeProducto()],
    bombaAplicarMinimo: false,
    bombaMinimoM3: 15,
    bombaPrecioM3: 0,
    metrosVaciosCantidad: 0,
    metrosVaciosPrecio: 0,
    aditivos: defaultAditivos.map((a) => ({ ...a })),
    extrasLibres: [],
    anticipo: 0,
    nota: "",
    firmaCliente: "",
    recibidoPor: "",
    fecha: todayCST(),
    total: 0,
    resta: 0,
    viajeFolio: `VJ-2026-${nextNumber}`,
    enviarACobros: false,
  };
}

// ── Number input helper (empty string when zero for cleaner UX) ───────────────
function numVal(v: number): string | number { return v === 0 ? "" : v; }
function parseNum(s: string): number { return parseFloat(s) || 0; }

export default function RecibosConcretoPage() {
  const { data: allRemisiones, loading } = useCollectionWithLoading<ConcreteReceipt>(COLLECTIONS.remisiones);
  const savedReceipts = useMemo(() => allRemisiones.filter((r) => r.receiptNumber != null), [allRemisiones]);
  const { data: allRemisionesGlobal } = useCollectionRawWithLoading<ConcreteReceipt>(COLLECTIONS.remisiones);

  const [receipt, setReceipt] = useState<ConcreteReceipt>(() => createReceipt([]));
  const [isLoadedReceipt, setIsLoadedReceipt] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clienteSuggestions, setClienteSuggestions] = useState<string[]>([]);
  const [rawClientes, setRawClientes] = useState<{ razonSocial?: string; nombreComercial?: string }[]>([]);
  const [obrasData, setObrasData] = useState<Obra[]>([]);
  const [obraOpen, setObraOpen] = useState(false);
  const [obraQuery, setObraQuery] = useState("");
  const [obraNewOpen, setObraNewOpen] = useState(false);
  const [obraNewNombre, setObraNewNombre] = useState("");
  const [obraNewDireccion, setObraNewDireccion] = useState("");
  const obraContainerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [abonoReceiptId, setAbonoReceiptId] = useState<string | null>(null);
  const [abonoMonto, setAbonoMonto] = useState<string>("");
  const [printSize, setPrintSize] = useState<"full" | "half">("full");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  // null = imprimir desde el formulario activo; ConcreteReceipt = imprimir un guardado de la tabla
  const pendingPrintReceipt = useRef<ConcreteReceipt | null>(null);

  const nextReceiptNum = useMemo(
    () => getNextReceiptNumber(allRemisionesGlobal.filter((r) => r.receiptNumber != null)),
    [allRemisionesGlobal],
  );
  const effectiveReceiptNumber = isLoadedReceipt ? receipt.receiptNumber : nextReceiptNum;

  const totalM3KPI   = useMemo(() => savedReceipts.reduce((s, r) => s + getTotalM3(r), 0), [savedReceipts]);
  const totalFacturado = useMemo(() => savedReceipts.reduce((s, r) => s + calculateConcreteReceiptTotal(r).total, 0), [savedReceipts]);
  const totalPendiente = useMemo(() => savedReceipts.reduce((s, r) => s + calculateConcreteReceiptTotal(r).resta, 0), [savedReceipts]);

  const pendingReceipts = useMemo(() => {
    if (!receipt.cliente) return [];
    const clienteNorm = normCl(receipt.cliente);
    return savedReceipts.filter((r) => {
      if (normCl(r.cliente) !== clienteNorm) return false;
      if (isLoadedReceipt && r.id === receipt.id) return false;
      return calculateConcreteReceiptTotal(r).resta > 0;
    });
  }, [savedReceipts, receipt.cliente, isLoadedReceipt, receipt.id]);

  const filteredReceipts = useMemo(() => {
    const sorted = [...savedReceipts].sort((a, b) => b.receiptNumber - a.receiptNumber);
    if (!search.trim()) return sorted;
    return sorted.filter((r) => matchesQuery(search, [r.receiptNumber, r.cliente, r.direccionObra]));
  }, [savedReceipts, search]);

  useEffect(() => {
    Promise.all([
      getCollectionDocs<Cliente>(COLLECTIONS.clientes),
      getCollectionDocs<Obra>(COLLECTIONS.obras),
    ]).then(([clientes, obras]) => {
      const names = clientes.map((c) => c.razonSocial).filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
      setClienteSuggestions(Array.from(new Set(names)));
      setRawClientes(clientes);
      setObrasData(obras);
    });
  }, []);

  const obrasSugeridas = useMemo(() => {
    if (!receipt.cliente) return [];
    const clienteNorm = normCl(receipt.cliente);
    const clienteReg = rawClientes.find((c) => {
      const rs = normCl(c.razonSocial ?? ""); const nc = normCl(c.nombreComercial ?? "");
      return rs === clienteNorm || nc === clienteNorm;
    });
    const aliases = new Set<string>([clienteNorm]);
    if (clienteReg) { aliases.add(normCl(clienteReg.razonSocial ?? "")); aliases.add(normCl(clienteReg.nombreComercial ?? "")); }
    aliases.delete("");
    return obrasData.filter((o) => aliases.has(normCl(o.cliente))).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [obrasData, receipt.cliente, rawClientes]);

  const obrasFiltradas = useMemo(() => {
    if (!obraQuery.trim()) return obrasSugeridas;
    return obrasSugeridas.filter((o) => o.nombre.toLowerCase().includes(obraQuery.toLowerCase()));
  }, [obrasSugeridas, obraQuery]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (obraContainerRef.current && !obraContainerRef.current.contains(e.target as Node)) setObraOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function autoSaveObra(cliente: string, nombre: string, direccion: string) {
    if (!nombre.trim() || !cliente.trim()) return;
    const ya = obrasData.find((o) => normCl(o.cliente) === normCl(cliente) && o.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (ya) return;
    const id = `obra-${Date.now()}`;
    const doc: Obra = { id, cliente: cliente.trim().toUpperCase().replace(/\s+/g, " "), nombre: nombre.trim().toUpperCase().replace(/\s+/g, " "), direccion: direccion.trim() };
    await upsertDocument(COLLECTIONS.obras, id, doc);
    setObrasData((prev) => [...prev, doc]);
  }

  // ── Computed from receipt ──────────────────────────────────────────────────
  const totals         = useMemo(() => calculateConcreteReceiptTotal(receipt), [receipt]);
  const realTotal      = totals.total;
  const realResta      = totals.resta;
  const totalM3Receipt = useMemo(() => getTotalM3(receipt), [receipt]);
  const m3Bombeado     = useMemo(() => getTotalM3Bombeado(receipt), [receipt]);
  const hasBomba       = m3Bombeado > 0;
  const receiptDate    = formatReceiptDate(receipt.fecha);

  // ── Update helpers ────────────────────────────────────────────────────────
  function updateReceipt(partial: Partial<ConcreteReceipt>) {
    setReceipt((cur) => {
      const next = { ...cur, ...partial };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function updateProducto(id: string, partial: Partial<ConcreteProducto>) {
    setReceipt((cur) => {
      const productos = cur.productos.map((p) => p.id === id ? { ...p, ...partial } : p);
      const next = { ...cur, productos };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function addProducto() {
    setReceipt((cur) => {
      const productos = [...cur.productos, makeProducto()];
      const next = { ...cur, productos };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function removeProducto(id: string) {
    setReceipt((cur) => {
      if (cur.productos.length <= 1) return cur;
      const productos = cur.productos.filter((p) => p.id !== id);
      const next = { ...cur, productos };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function updateAditivo(index: number, partial: Partial<ConcreteAditivo>) {
    setReceipt((cur) => {
      const aditivos = cur.aditivos.map((a, i) => i === index ? { ...a, ...partial } : a);
      const next = { ...cur, aditivos };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function addExtraLibre() {
    setReceipt((cur) => ({ ...cur, extrasLibres: [...cur.extrasLibres, makeExtraLibre()] }));
  }

  function removeExtraLibre(id: string) {
    setReceipt((cur) => {
      const extrasLibres = cur.extrasLibres.filter((e) => e.id !== id);
      const next = { ...cur, extrasLibres };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  function updateExtraLibre(id: string, partial: Partial<ConcreteExtraRow>) {
    setReceipt((cur) => {
      const extrasLibres = cur.extrasLibres.map((e) => e.id === id ? { ...e, ...partial } : e);
      const next = { ...cur, extrasLibres };
      return { ...next, ...calculateConcreteReceiptTotal(next) };
    });
  }

  // ── Form actions ──────────────────────────────────────────────────────────
  function openNew() {
    setReceipt(createReceipt([]));
    setIsLoadedReceipt(false);
    setShowForm(true);
    setAbonoReceiptId(null);
    setAbonoMonto("");
  }

  function resetToNew() {
    setReceipt(createReceipt([]));
    setIsLoadedReceipt(false);
    setShowForm(false);
    setAbonoReceiptId(null);
    setAbonoMonto("");
  }

  function receiptError(): string | null {
    if (!receipt.cliente.trim()) return "Cliente es requerido.";
    const m3Total = getTotalM3(receipt);
    if (m3Total <= 0) return "Debe agregar al menos un producto con M³ mayor a 0.";
    return null;
  }

  async function persistReceipt(showToast = true) {
    const num = effectiveReceiptNumber;
    const id  = `REC-${num}`;
    const m3total = getTotalM3(receipt);
    const firstProd = receipt.productos?.[0];
    const { planta: _p, ...data } = receipt as ConcreteReceipt & { planta?: string };
    const nextReceipt: ConcreteReceipt = {
      ...data,
      id,
      receiptNumber: num,
      cliente: data.cliente.trim().toUpperCase().replace(/\s+/g, " "),
      total: realTotal,
      resta: realResta,
      viajeFolio: `VJ-2026-${num}`,
      // Persist summary fields for backward-compat display
      m3: m3total,
      resistencia: firstProd?.resistencia ?? "",
      precioPorM3: firstProd?.precioPorM3 ?? 0,
    };
    const { id: docId, ...saveData } = nextReceipt;
    await upsertDocument(COLLECTIONS.remisiones, docId, withPlantaTag(saveData));
    syncReceiptWithTrip(nextReceipt).catch((err) => console.error("syncTrip:", err));

    const progId = `recibo-${docId}`;
    if (nextReceipt.enviarACobros !== false) {
      upsertDocument(COLLECTIONS.programaciones, progId, withPlantaTag({
        dia: nextReceipt.fecha, cliente: nextReceipt.cliente,
        reciboFolio: `#${String(num).padStart(4, "0")}`, total: realTotal,
        montoPagado: nextReceipt.anticipo ?? 0, nombreObra: nextReceipt.direccionObra,
        origenRecibo: true, reciboId: docId,
      })).catch((err) => console.error("syncCobros:", err));
    } else {
      deleteDocument(COLLECTIONS.programaciones, progId).catch(() => {});
    }

    upsertDocument(COLLECTIONS.efectivo, `ef-${docId}`, withPlantaTag({
      folio: num, cliente: nextReceipt.cliente, importe: realTotal,
      fecha: nextReceipt.fecha, cemento: "Concreto premezclado",
      metros: m3total, precio: firstProd?.precioPorM3 ?? 0,
      resistencia: firstProd?.resistencia ?? "", tipoDeTiro: firstProd?.supplyType ?? "",
      direccionObra: nextReceipt.direccionObra, notas: nextReceipt.nota ?? "",
      entregado: false, origenConcreto: true, reciboConcreteId: docId,
    })).catch((err) => console.error("syncEfectivo:", err));

    if (!isLoadedReceipt && abonoReceiptId) {
      const montoAbono = parseFloat(abonoMonto);
      if (montoAbono > 0) {
        const target = savedReceipts.find((r) => r.id === abonoReceiptId);
        if (target) {
          const nuevoAbono = { fecha: nextReceipt.fecha, monto: montoAbono, reciboOrigenId: nextReceipt.id };
          const updatedAbonos = [...(target.abonos ?? []), nuevoAbono];
          const { resta: nuevaResta } = calculateConcreteReceiptTotal({ ...target, abonos: updatedAbonos });
          const { id: _tid, planta: _tp, ...targetSaveData } = target as ConcreteReceipt & { planta?: string };
          await upsertDocument(COLLECTIONS.remisiones, abonoReceiptId, withPlantaTag({ ...targetSaveData, abonos: updatedAbonos, resta: nuevaResta }));
        }
      }
    }

    // Apply abono to a previous receipt if the user registered one
    if (!isLoadedReceipt && abonoReceiptId) {
      const montoAbono = parseFloat(abonoMonto);
      if (montoAbono > 0) {
        const target = savedReceipts.find((r) => r.id === abonoReceiptId);
        if (target) {
          const nuevoAbono = { fecha: nextReceipt.fecha, monto: montoAbono, reciboOrigenId: nextReceipt.id };
          const updatedAbonos = [...(target.abonos ?? []), nuevoAbono];
          const { resta: nuevaResta } = calculateConcreteReceiptTotal({ ...target, abonos: updatedAbonos });
          const { id: _tid, planta: _tp, ...targetSaveData } = target as ConcreteReceipt & { planta?: string };
          await upsertDocument(COLLECTIONS.remisiones, abonoReceiptId, withPlantaTag({
            ...targetSaveData,
            abonos: updatedAbonos,
            resta: nuevaResta,
          }));
        }
      }
    }

    if (showToast) {
      window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Recibo guardado." } }));
    }
    return nextReceipt;
  }

  async function saveReceipt() {
    const err = receiptError();
    if (err) { window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: err } })); return; }
    setSaving(true);
    try { await persistReceipt(); resetToNew(); } finally { setSaving(false); }
  }

  async function printReceipt() {
    const err = receiptError();
    if (err) { window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: err } })); return; }
    setSaving(true);
    try {
      const saved = await persistReceipt(false);
      flushSync(() => { setReceipt(saved); setIsLoadedReceipt(true); });
      window.print();
      window.setTimeout(resetToNew, 0);
    } finally { setSaving(false); }
  }

  function getTicketAmounts(targetReceipt: ConcreteReceipt) {
    return calculateConcreteReceiptTotal(targetReceipt);
  }

  async function sendWhatsApp(targetReceipt = receipt, shouldSave = true) {
    let msgReceipt = targetReceipt;
    if (shouldSave) {
      const err = receiptError();
      if (err) { window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: err } })); return; }
      setSaving(true);
      try { msgReceipt = await persistReceipt(false); resetToNew(); } finally { setSaving(false); }
    }
    const { total, resta } = getTicketAmounts(msgReceipt);
    const m3 = getTotalM3(msgReceipt);
    const firstProd = msgReceipt.productos?.[0];
    const message = [
      `Recibo concreto premezclado No. ${msgReceipt.receiptNumber}`,
      `Cliente: ${msgReceipt.cliente}`,
      `Obra: ${msgReceipt.direccionObra}`,
      `M³: ${m3}`,
      firstProd ? `Resistencia: ${firstProd.resistencia}` : "",
      firstProd ? `Suministro: ${firstProd.supplyType}` : "",
      `Total: ${money(total)}`,
      `Resta: ${money(resta)}`,
      msgReceipt.nota ? `Nota: ${msgReceipt.nota}` : "",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function sendWhatsAppPdf(targetReceipt = receipt, shouldSave = true) {
    let msgReceipt = targetReceipt;
    if (shouldSave) {
      const err = receiptError();
      if (err) { window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "error", message: err } })); return; }
      setSaving(true);
      try { msgReceipt = await persistReceipt(false); flushSync(() => { setReceipt(msgReceipt); setIsLoadedReceipt(true); }); resetToNew(); } finally { setSaving(false); }
    } else {
      flushSync(() => { setReceipt(migrateReceipt({ ...msgReceipt })); setIsLoadedReceipt(true); });
    }

    const el = document.getElementById("printable-concrete-receipt");
    if (!el) return;

    // Temporarily move on-screen for capture
    const prevStyle = el.getAttribute("style") ?? "";
    el.setAttribute("style", prevStyle.replace("-left-[9999px]", "") + "; position: absolute; left: 0; top: 0; visibility: visible;");
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";

    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      const isHalf = printSize === "half";
      const pdfW = isHalf ? 139.7 : 279.4; // mm: 5.5in or 11in
      const pdfH = isHalf ? 215.9 : 215.9; // mm: 8.5in
      const pdf = new jsPDF({ orientation: isHalf ? "portrait" : "landscape", unit: "mm", format: isHalf ? [139.7, 215.9] : [279.4, 215.9] });

      const imgW = pdfW;
      const imgH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, imgW, Math.min(imgH, pdfH));

      const pdfBlob = pdf.output("blob");
      const fileName = `Recibo-${msgReceipt.receiptNumber ?? "00"}.pdf`;

      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [new File([pdfBlob], fileName, { type: "application/pdf" })] })) {
        await navigator.share({ files: [new File([pdfBlob], fileName, { type: "application/pdf" })], title: `Recibo #${msgReceipt.receiptNumber}` });
      } else {
        // Fallback: download PDF, then open WhatsApp
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        const { total, resta } = getTicketAmounts(msgReceipt);
        const textMsg = `Recibo concreto premezclado No. ${msgReceipt.receiptNumber}\nCliente: ${msgReceipt.cliente}\nTotal: ${money(total)}\nResta: ${money(resta)}\n📎 El PDF se descargó — adjúntalo en WhatsApp.`;
        setTimeout(() => window.open(`https://wa.me/?text=${encodeURIComponent(textMsg)}`, "_blank", "noopener,noreferrer"), 500);
      }
    } finally {
      el.setAttribute("style", prevStyle);
    }
  }

  async function deleteReceipt(id: string) {
    await deleteDocument(COLLECTIONS.remisiones, id);
    deleteDocument(COLLECTIONS.programaciones, `recibo-${id}`).catch(() => {});
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type: "success", message: "Recibo eliminado." } }));
  }

  function loadSavedReceipt(savedReceipt: ConcreteReceipt) {
    setReceipt(migrateReceipt({ ...savedReceipt }));
    setIsLoadedReceipt(true);
    setShowForm(true);
  }

  function printSavedReceipt(savedReceipt: ConcreteReceipt) {
    pendingPrintReceipt.current = savedReceipt;
    setShowPrintDialog(true);
  }

  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const inpSm = "bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 text-sm focus:outline-none focus:border-[#CC2229]/60 transition-colors";

  // ── Computed for print ────────────────────────────────────────────────────
  const subtotalConcreto = receipt.productos.reduce((s, p) => s + (p.m3 ?? 0) * (p.precioPorM3 ?? 0), 0);
  const metrosVaciosTotal = (receipt.metrosVaciosCantidad ?? 0) * (receipt.metrosVaciosPrecio ?? 0);
  const bombaM3Base = receipt.bombaAplicarMinimo ? Math.max(m3Bombeado, receipt.bombaMinimoM3 ?? 0) : m3Bombeado;
  const bombaImporte = hasBomba && (receipt.bombaPrecioM3 ?? 0) > 0 ? bombaM3Base * receipt.bombaPrecioM3 : 0;
  const aditivosActivos = (receipt.aditivos ?? []).filter((a) => a.checked && a.precio > 0 && a.dosis > 0);
  const extrasConImporte = (receipt.extrasLibres ?? []).filter((e) => e.concepto && parseFloat(e.precio) > 0);

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-concrete-receipt,
          #printable-concrete-receipt * { visibility: visible !important; }
          #printable-concrete-receipt {
            position: fixed !important; inset: 0 !important;
            width: 100vw !important; min-height: 100vh !important;
            background: white !important; color: black !important;
            padding: 0 !important;
          }
          @page { size: ${printSize === "half" ? "letter portrait" : "letter landscape"}; margin: 0; }
        }
        .print-th {
          background: #1e3a5f !important;
          color: white !important;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 5px 8px;
          text-align: left;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-sec {
          background: #1e3a5f !important;
          color: white !important;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          padding: 4px 8px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-td { font-size: 10px; padding: 4px 8px; border-bottom: 1px solid #ccc; vertical-align: middle; }
        .print-total-row { background: #e8eef5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-gray-500">Recibo de concreto premezclado — múltiples productos por recibo</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openNew}
            className="flex items-center gap-2 bg-[#CC2229] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#B01E24] transition-colors shadow-md shadow-[#CC2229]/20 cursor-pointer">
            <Plus size={16} /> Nuevo recibo
          </button>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <KPICard title="Total recibos"   value={loading ? "…" : String(savedReceipts.length)}  icon={ReceiptText} iconColor="text-[#CC2229]"  iconBg="bg-[#CC2229]/10" />
        <KPICard title="Total m³"        value={loading ? "…" : `${totalM3KPI.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`} icon={Package} iconColor="text-blue-400" iconBg="bg-blue-500/10" />
        <KPICard title="Total facturado" value={loading ? "…" : money(totalFacturado)} icon={DollarSign}  iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Pendiente cobro" value={loading ? "…" : money(totalPendiente)} icon={Calculator}  iconColor={totalPendiente > 0 ? "text-amber-400" : "text-emerald-400"} iconBg={totalPendiente > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"} />
      </div>

      {/* ── Saved receipts table ──────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden print:hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div>
            <h3 className="font-semibold text-white">Recibos guardados</h3>
            <p className="mt-0.5 text-xs text-gray-500">Consulta, edita, imprime o manda por WhatsApp.</p>
          </div>
          <div className="ml-auto relative min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input type="text" placeholder="Buscar folio, cliente, obra…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229] placeholder-gray-600" />
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
            <p className="text-sm text-gray-500">{search ? "Sin resultados para esa búsqueda." : "No hay recibos guardados aún."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["No.", "Fecha", "Cliente", "Obra", "M³", "Total", "Resta", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap bg-[#1A1A1A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredReceipts.map((savedReceipt) => {
                  const { total, resta } = getTicketAmounts(savedReceipt);
                  return (
                    <tr key={savedReceipt.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#CC2229]">#{String(savedReceipt.receiptNumber).padStart(4, "0")}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {savedReceipt.fecha ? new Date(savedReceipt.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">{savedReceipt.cliente || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate" title={savedReceipt.direccionObra}>{savedReceipt.direccionObra || "—"}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{getTotalM3(savedReceipt)} m³</td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{money(total)}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{money(resta)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => loadSavedReceipt(savedReceipt)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 border border-[#3A3A3A] hover:border-[#CC2229]/60 hover:text-white transition-colors cursor-pointer">
                            Editar
                          </button>
                          <button type="button" onClick={() => printSavedReceipt(savedReceipt)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer" aria-label="Imprimir">
                            <Printer size={14} />
                          </button>
                          <button type="button" onClick={() => sendWhatsAppPdf(savedReceipt, false)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-green-400 transition-colors cursor-pointer" aria-label="WhatsApp PDF">
                            <MessageCircle size={14} />
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(savedReceipt.id)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-[#CC2229] transition-colors cursor-pointer" aria-label="Eliminar">
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

      {/* ── Form drawer ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex print:hidden">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default" onClick={resetToNew} aria-label="Cerrar" />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden" style={{ colorScheme: "light" }}>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
                <ReceiptText size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{isLoadedReceipt ? "Editar recibo" : "Nuevo recibo"}</h2>
                <p className="text-xs text-gray-500">{loading ? "Cargando…" : `Recibo #${String(effectiveReceiptNumber).padStart(4, "0")}`}</p>
              </div>
              <button type="button" onClick={resetToNew} className="ml-auto rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Datos generales ── */}
              <section className="space-y-3">
                <p className={lbl + " border-b border-gray-100 pb-1.5 !mb-0"}>Datos generales</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>No. recibo</label>
                    <input type="number" value={loading ? "" : effectiveReceiptNumber} readOnly
                      className={`${inp} cursor-not-allowed opacity-50`} />
                  </div>
                  <div>
                    <label className={lbl}>Fecha</label>
                    <input type="date" value={receipt.fecha} onChange={(e) => updateReceipt({ fecha: e.target.value })}
                      className={`${inp} date-input-white`} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Nombre del cliente</label>
                  <AppSelect
                    value={receipt.cliente}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateReceipt({ cliente: v, direccionObra: v !== receipt.cliente ? "" : receipt.direccionObra });
                      setObraQuery("");
                      setObraOpen(false);
                      if (v !== receipt.cliente) { setAbonoReceiptId(null); setAbonoMonto(""); }
                    }}
                  >
                    <option value="">Seleccionar cliente…</option>
                    {clienteSuggestions.map((c) => <option key={c} value={c}>{c}</option>)}
                    {receipt.cliente && !clienteSuggestions.includes(receipt.cliente) && <option value={receipt.cliente}>{receipt.cliente}</option>}
                  </AppSelect>
                </div>
                {/* Obra */}
                <div ref={obraContainerRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`${lbl} mb-0`}>Obra</label>
                    {receipt.cliente && !obraNewOpen && (
                      <button type="button" onClick={() => { setObraNewOpen(true); setObraOpen(false); setObraNewNombre(""); setObraNewDireccion(""); }}
                        className="text-[11px] font-semibold text-[#CC2229] hover:text-[#B01E24] cursor-pointer transition-colors shrink-0">+ Nueva obra</button>
                    )}
                    {obraNewOpen && (
                      <button type="button" onClick={() => { setObraNewOpen(false); setObraQuery(""); }}
                        className="text-[11px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer transition-colors shrink-0">Cancelar</button>
                    )}
                  </div>
                  {obraNewOpen && (
                    <div className="rounded-xl border border-[#CC2229]/30 bg-red-50/40 p-3 space-y-2">
                      <input autoFocus value={obraNewNombre} onChange={(e) => setObraNewNombre(e.target.value)} placeholder="Nombre de la obra *"
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60" />
                      <input value={obraNewDireccion} onChange={(e) => setObraNewDireccion(e.target.value)} placeholder="Dirección (opcional)"
                        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#CC2229]/60" />
                      <button type="button" disabled={!obraNewNombre.trim()} onClick={() => {
                        if (!obraNewNombre.trim()) return;
                        const nombre = obraNewNombre.trim().toUpperCase().replace(/\s+/g, " ");
                        updateReceipt({ direccionObra: nombre });
                        autoSaveObra(receipt.cliente, nombre, obraNewDireccion);
                        setObraNewOpen(false); setObraQuery("");
                      }} className="w-full text-sm py-2 rounded-lg bg-[#CC2229] text-white hover:bg-[#B01E24] disabled:opacity-50 cursor-pointer transition-colors font-medium">
                        Guardar obra
                      </button>
                    </div>
                  )}
                  {!obraNewOpen && (
                    <div role="button" tabIndex={receipt.cliente ? 0 : -1}
                      onClick={() => { if (receipt.cliente) setObraOpen((v) => !v); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (receipt.cliente) setObraOpen((v) => !v); } }}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer select-none transition-colors ${obraOpen ? "border-[#CC2229]/60 ring-1 ring-[#CC2229]/20" : "border-gray-200 hover:border-gray-300"} ${!receipt.cliente ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white"}`}>
                      <span className={`flex-1 truncate ${receipt.direccionObra ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                        {receipt.direccionObra || (receipt.cliente ? "Seleccionar obra…" : "Selecciona un cliente primero")}
                      </span>
                      {receipt.direccionObra
                        ? <button type="button" onMouseDown={(e) => { e.stopPropagation(); updateReceipt({ direccionObra: "" }); setObraQuery(""); }} className="p-0.5 text-gray-300 hover:text-gray-500 cursor-pointer"><X size={11} /></button>
                        : <ChevronDown size={14} className={`text-gray-400 transition-transform ${obraOpen ? "rotate-180" : ""}`} />
                      }
                    </div>
                  )}
                  {obraOpen && !obraNewOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input autoFocus value={obraQuery} onChange={(e) => setObraQuery(e.target.value)} placeholder="Buscar obra…"
                          className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-[#CC2229]/60" />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {obrasFiltradas.length === 0
                          ? <p className="px-4 py-3 text-sm text-gray-400">{obrasSugeridas.length === 0 ? "Sin obras guardadas para este cliente" : "Sin resultados"}</p>
                          : obrasFiltradas.map((o) => (
                            <button key={o.id} type="button"
                              onMouseDown={(e) => { e.preventDefault(); updateReceipt({ direccionObra: o.nombre }); setObraOpen(false); setObraQuery(""); }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${receipt.direccionObra === o.nombre ? "text-[#CC2229] font-semibold bg-red-50" : "text-gray-800"}`}>
                              {o.nombre}
                              {o.direccion && <span className="ml-1 text-[11px] text-gray-400 truncate">· {o.direccion}</span>}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Abono a saldo pendiente ── */}
              {!isLoadedReceipt && pendingReceipts.length > 0 && (
                <section className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 border-b border-amber-100 pb-1.5">Saldo pendiente del cliente</p>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                    <p className="text-xs text-amber-700">Este cliente tiene <strong>{pendingReceipts.length}</strong> recibo{pendingReceipts.length !== 1 ? "s" : ""} con saldo pendiente. ¿Desea registrar un abono?</p>
                    <div>
                      <label className={lbl}>Recibo a abonar</label>
                      <AppSelect value={abonoReceiptId ?? ""} onChange={(e) => { setAbonoReceiptId(e.target.value || null); setAbonoMonto(""); }}>
                        <option value="">Sin abono</option>
                        {pendingReceipts.map((r) => (
                          <option key={r.id} value={r.id}>#{String(r.receiptNumber).padStart(4, "0")} — {money(calculateConcreteReceiptTotal(r).resta)} pendiente</option>
                        ))}
                      </AppSelect>
                    </div>
                    {abonoReceiptId && (
                      <div>
                        <label className={lbl}>Monto del abono</label>
                        <input type="number" min={0} value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)}
                          placeholder="$0.00" className={inp} onWheel={(e) => e.currentTarget.blur()} />
                        {(() => {
                          const target = pendingReceipts.find((r) => r.id === abonoReceiptId);
                          if (!target) return null;
                          const resta = calculateConcreteReceiptTotal(target).resta;
                          const m = parseFloat(abonoMonto) || 0;
                          if (m <= 0) return null;
                          if (m > resta) return <p className="mt-1 text-xs text-red-500">⚠ El monto supera el saldo pendiente ({money(resta)})</p>;
                          if (m === resta) return <p className="mt-1 text-xs text-emerald-600 font-semibold">✓ Cubre el total — el recibo quedará liquidado</p>;
                          return <p className="mt-1 text-xs text-amber-600">Saldo restante: {money(resta - m)}</p>;
                        })()}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── 1. Concreto (multi-producto) ── */}
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <p className={lbl + " !mb-0"}>① Concreto premezclado</p>
                  <button type="button" onClick={addProducto}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#CC2229] hover:text-[#B01E24] cursor-pointer transition-colors">
                    <Plus size={12} /> Agregar producto
                  </button>
                </div>
                {receipt.productos.map((p, idx) => (
                  <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Producto {idx + 1}</span>
                      {receipt.productos.length > 1 && (
                        <button type="button" onClick={() => removeProducto(p.id)} className="text-gray-300 hover:text-red-400 cursor-pointer transition-colors">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className={lbl}>Resistencia / especificación</label>
                        <AppSelect value={p.resistencia} onChange={(e) => updateProducto(p.id, { resistencia: e.target.value })}>
                          <option value="">Seleccionar…</option>
                          {concreteReceiptResistencias.map((r) => <option key={r} value={r}>{r}</option>)}
                          {p.resistencia && !concreteReceiptResistencias.includes(p.resistencia) && <option value={p.resistencia}>{p.resistencia}</option>}
                        </AppSelect>
                      </div>
                      <div>
                        <label className={lbl}>M³</label>
                        <input type="number" min={0} step="any" value={numVal(p.m3)} placeholder="0"
                          onChange={(e) => updateProducto(p.id, { m3: parseNum(e.target.value) })}
                          className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                      </div>
                      <div>
                        <label className={lbl}>Precio / m³</label>
                        <input type="number" min={0} step="any" value={numVal(p.precioPorM3)} placeholder="$0"
                          onChange={(e) => updateProducto(p.id, { precioPorM3: parseNum(e.target.value) })}
                          className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                      </div>
                      <div className="col-span-2">
                        <label className={lbl}>Tipo de suministro</label>
                        <div className="flex gap-3">
                          {(["Tiro directo", "Bombeado"] as const).map((t) => (
                            <label key={t} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" checked={p.supplyType === t} onChange={() => updateProducto(p.id, { supplyType: t })}
                                className="accent-[#CC2229]" />
                              <span className="text-sm text-gray-700">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {p.m3 > 0 && p.precioPorM3 > 0 && (
                      <p className="text-[11px] text-emerald-600 font-semibold text-right">
                        Importe: {money(p.m3 * p.precioPorM3)}
                      </p>
                    )}
                  </div>
                ))}
                {subtotalConcreto > 0 && (
                  <p className="text-xs font-bold text-gray-700 text-right pr-1">Subtotal concreto: {money(subtotalConcreto)}</p>
                )}
              </section>

              {/* ── 2. Metros vacíos ── */}
              <section className="space-y-2">
                <p className={lbl + " border-b border-gray-100 pb-1.5 !mb-0"}>② Metros vacíos <span className="font-normal normal-case tracking-normal text-gray-400">(solo si aplica)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Cantidad (m³)</label>
                    <input type="number" min={0} step="any" value={numVal(receipt.metrosVaciosCantidad)} placeholder="0"
                      onChange={(e) => updateReceipt({ metrosVaciosCantidad: parseNum(e.target.value) })}
                      className={inp} onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                  <div>
                    <label className={lbl}>Precio / m³</label>
                    <input type="number" min={0} step="any" value={numVal(receipt.metrosVaciosPrecio)} placeholder="$0"
                      onChange={(e) => updateReceipt({ metrosVaciosPrecio: parseNum(e.target.value) })}
                      className={inp} onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                </div>
                {metrosVaciosTotal > 0 && (
                  <p className="text-[11px] text-emerald-600 font-semibold text-right">Importe metros vacíos: {money(metrosVaciosTotal)}</p>
                )}
              </section>

              {/* ── 3. Servicio de bomba ── */}
              {hasBomba && (
                <section className="space-y-2">
                  <p className={lbl + " border-b border-gray-100 pb-1.5 !mb-0"}>③ Servicio de bomba</p>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                    <p className="text-xs text-blue-700">M³ bombeados detectados: <strong>{m3Bombeado}</strong> m³</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Precio / m³ de bombeo</label>
                        <input type="number" min={0} step="any" value={numVal(receipt.bombaPrecioM3)} placeholder="$0"
                          onChange={(e) => updateReceipt({ bombaPrecioM3: parseNum(e.target.value) })}
                          className={inp} onWheel={(e) => e.currentTarget.blur()} />
                      </div>
                      <div>
                        <label className={lbl}>Mínimo de bombeo (m³)</label>
                        <input type="number" min={0} step="any" value={numVal(receipt.bombaMinimoM3)} placeholder="15"
                          onChange={(e) => updateReceipt({ bombaMinimoM3: parseNum(e.target.value) })}
                          className={inp} onWheel={(e) => e.currentTarget.blur()} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={receipt.bombaAplicarMinimo}
                        onChange={(e) => updateReceipt({ bombaAplicarMinimo: e.target.checked })}
                        className="h-4 w-4 accent-[#CC2229]" />
                      <span className="text-sm text-gray-700 font-medium">Aplicar mínimo de bombeo</span>
                    </label>
                    {(receipt.bombaPrecioM3 ?? 0) > 0 && (
                      <p className="text-[11px] text-emerald-600 font-semibold">
                        Importe bomba: {money(bombaImporte)}
                        {receipt.bombaAplicarMinimo && m3Bombeado < (receipt.bombaMinimoM3 ?? 0) && (
                          <span className="text-gray-400 font-normal ml-1">(mín. {receipt.bombaMinimoM3} m³ × {money(receipt.bombaPrecioM3)})</span>
                        )}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* ── 4. Aditivos (dosificación/m³) ── */}
              <section className="space-y-2">
                <p className={lbl + " border-b border-gray-100 pb-1.5 !mb-0"}>④ Aditivos <span className="font-normal normal-case tracking-normal text-gray-400">(dosificación por m³)</span></p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                  {receipt.aditivos.map((a, idx) => {
                    const qty = totalM3Receipt * (a.dosis ?? 0);
                    const importe = qty * (a.precio ?? 0);
                    return (
                      <div key={a.name} className={`px-3 py-2.5 transition-colors ${a.checked ? "" : "opacity-50"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" checked={a.checked}
                            onChange={(e) => updateAditivo(idx, { checked: e.target.checked })}
                            className="h-4 w-4 accent-[#CC2229] cursor-pointer shrink-0" />
                          <span className="text-sm font-semibold text-gray-800">{a.name}</span>
                          {a.showUnit && a.unit && <span className="text-xs text-gray-400">({a.unit})</span>}
                          {a.checked && qty > 0 && (
                            <span className="ml-auto text-xs text-gray-500">= {qty.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {a.unit || "uds."}</span>
                          )}
                        </div>
                        {a.checked && (
                          <div className="grid grid-cols-3 gap-2 ml-6">
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Dosif.{a.unit ? `/${a.unit}/m³` : "/m³"}</p>
                              <input type="number" min={0} step="any" value={numVal(a.dosis)} placeholder="0"
                                onChange={(e) => updateAditivo(idx, { dosis: parseNum(e.target.value) })}
                                className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Precio/{a.unit || "ud."}</p>
                              <input type="number" min={0} step="any" value={numVal(a.precio)} placeholder="$0"
                                onChange={(e) => updateAditivo(idx, { precio: parseNum(e.target.value) })}
                                className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Importe</p>
                              <p className={`text-sm font-bold mt-2 ${importe > 0 ? "text-gray-900" : "text-gray-300"}`}>
                                {importe > 0 ? money(importe) : "—"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── 5. Extras libres ── */}
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <p className={lbl + " !mb-0"}>⑤ Extras</p>
                  <button type="button" onClick={addExtraLibre}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#CC2229] hover:text-[#B01E24] cursor-pointer transition-colors">
                    <Plus size={12} /> Agregar concepto
                  </button>
                </div>
                {receipt.extrasLibres.length === 0 && (
                  <p className="text-xs text-gray-400 py-2">Sin extras — usa el botón para agregar maniobras, tubería, tiempo extra, etc.</p>
                )}
                {receipt.extrasLibres.map((ex) => {
                  const qty = parseFloat(ex.cantidad) || 0;
                  const precio = parseFloat(ex.precio) || 0;
                  const importe = qty > 0 && precio > 0 ? qty * precio : 0;
                  return (
                    <div key={ex.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input value={ex.concepto} onChange={(e) => updateExtraLibre(ex.id, { concepto: e.target.value })}
                            placeholder="Concepto (ej. Maniobra especial, Tubería extra…)"
                            className={inpSm + " w-full"} />
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Cantidad</p>
                              <input type="number" min={0} step="any" value={ex.cantidad} placeholder="—"
                                onChange={(e) => updateExtraLibre(ex.id, { cantidad: e.target.value })}
                                className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Precio unitario</p>
                              <input type="number" min={0} step="any" value={ex.precio} placeholder="—"
                                onChange={(e) => updateExtraLibre(ex.id, { precio: e.target.value })}
                                className={inpSm + " w-full"} onWheel={(e) => e.currentTarget.blur()} />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-semibold text-gray-400 mb-1">Importe</p>
                              <p className={`text-sm font-bold mt-2 ${importe > 0 ? "text-gray-900" : "text-gray-300"}`}>
                                {importe > 0 ? money(importe) : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeExtraLibre(ex.id)}
                          className="mt-1 text-gray-300 hover:text-red-400 cursor-pointer transition-colors shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* ── Anticipo y nota ── */}
              <section className="space-y-3">
                <p className={lbl + " border-b border-gray-100 pb-1.5 !mb-0"}>Anticipo y observaciones</p>
                <div>
                  <label className={lbl}>Anticipo</label>
                  <input type="number" min={0} value={numVal(receipt.anticipo)} placeholder="$0.00"
                    onChange={(e) => updateReceipt({ anticipo: parseNum(e.target.value) })}
                    className={inp} onWheel={(e) => e.currentTarget.blur()} />
                </div>
                <div>
                  <label className={lbl}>Observaciones</label>
                  <textarea rows={2} value={receipt.nota} onChange={(e) => updateReceipt({ nota: e.target.value })}
                    className={`${inp} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Firma cliente</label>
                    <input value={receipt.firmaCliente} onChange={(e) => updateReceipt({ firmaCliente: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Recibido por (R:)</label>
                    <input value={receipt.recibidoPor} onChange={(e) => updateReceipt({ recibidoPor: e.target.value })} className={inp} />
                  </div>
                </div>
              </section>
            </div>

            {/* Toggle venta a crédito */}
            <div className="px-6 py-3 border-t border-gray-100">
              <button type="button" onClick={() => updateReceipt({ enviarACobros: receipt.enviarACobros === false ? true : false })}
                className="flex items-center justify-between w-full group">
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium text-gray-800">Venta a crédito</span>
                  <span className="text-[11px] text-gray-400">
                    {receipt.enviarACobros !== false ? "El saldo pendiente aparecerá en Cobros" : "Venta de contado"}
                  </span>
                </div>
                <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${receipt.enviarACobros !== false ? "bg-[#CC2229]" : "bg-gray-200"}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${receipt.enviarACobros !== false ? "translate-x-[18px]" : "translate-x-1"}`} />
                </div>
              </button>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3 px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Total</p>
                <p className="text-lg font-bold text-gray-900">{money(realTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Anticipo</p>
                <p className="text-lg font-bold text-blue-600">{money(receipt.anticipo)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Resta</p>
                <p className="text-lg font-bold text-[#CC2229]">{money(realResta)}</p>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3">
              <button type="button" onClick={() => sendWhatsAppPdf()} disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-green-500/60 hover:text-green-600 transition-colors disabled:opacity-40 cursor-pointer">
                <MessageCircle size={15} /> WhatsApp PDF
              </button>
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={saveReceipt} disabled={saving || loading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40">
                  <Save size={15} /> {saving ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={() => { pendingPrintReceipt.current = null; setShowPrintDialog(true); }} disabled={loading || saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20 cursor-pointer">
                  <Printer size={15} /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Diálogo de opciones de impresión ──────────────────────────────── */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center print:hidden"
          onClick={() => setShowPrintDialog(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-semibold text-base">Opciones de impresión</h3>
                <p className="text-gray-500 text-xs mt-0.5">Selecciona el formato</p>
              </div>
              <button type="button" onClick={() => setShowPrintDialog(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Opción 1 — 1 recibo por hoja */}
              <button type="button"
                onClick={() => {
                  const saved = pendingPrintReceipt.current;
                  pendingPrintReceipt.current = null;
                  setPrintSize("full");
                  setShowPrintDialog(false);
                  setTimeout(() => {
                    if (saved) { flushSync(() => { setReceipt(migrateReceipt({ ...saved })); setIsLoadedReceipt(true); }); window.print(); resetToNew(); }
                    else { printReceipt(); }
                  }, 80);
                }}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-[#3A3A3A] hover:border-[#CC2229]/60 hover:bg-[#CC2229]/5 transition-all cursor-pointer text-left">
                {/* Ícono: hoja landscape */}
                <div className="w-14 h-10 rounded border-2 border-gray-500 group-hover:border-[#CC2229]/70 transition-colors bg-[#242424] flex items-center justify-center">
                  <div className="w-9 h-6 rounded-sm border border-gray-600 bg-[#2A2A2A] flex flex-col gap-0.5 p-1">
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                    <div className="w-4/5 h-0.5 bg-gray-600 rounded" />
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                    <div className="w-3/5 h-0.5 bg-gray-600 rounded" />
                  </div>
                </div>
                <div>
                  <div className="text-white text-xs font-semibold">1 por hoja</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">Carta horizontal</div>
                </div>
              </button>

              {/* Opción 2 — 2 recibos por hoja */}
              <button type="button"
                onClick={() => {
                  const saved = pendingPrintReceipt.current;
                  pendingPrintReceipt.current = null;
                  setPrintSize("half");
                  setShowPrintDialog(false);
                  setTimeout(() => {
                    if (saved) { flushSync(() => { setReceipt(migrateReceipt({ ...saved })); setIsLoadedReceipt(true); }); window.print(); resetToNew(); }
                    else { printReceipt(); }
                  }, 80);
                }}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-[#3A3A3A] hover:border-[#CC2229]/60 hover:bg-[#CC2229]/5 transition-all cursor-pointer text-left">
                {/* Ícono: hoja portrait con línea de corte en medio */}
                <div className="w-10 h-14 rounded border-2 border-gray-500 group-hover:border-[#CC2229]/70 transition-colors bg-[#242424] flex flex-col items-center justify-around p-1 gap-0">
                  <div className="w-full flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                    <div className="w-4/5 h-0.5 bg-gray-600 rounded" />
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                  </div>
                  <div className="w-full border-t border-dashed border-gray-500" />
                  <div className="w-full flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                    <div className="w-4/5 h-0.5 bg-gray-600 rounded" />
                    <div className="w-full h-0.5 bg-gray-600 rounded" />
                  </div>
                </div>
                <div>
                  <div className="text-white text-xs font-semibold">2 por hoja</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">Original + copia</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PRINTABLE RECEIPT                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {(() => {
        // Contenido del recibo extraído como función local para reutilizar en modo 2-por-hoja
        const receiptBody = (copyLabel?: string) => (
          <div style={{ fontFamily: "Arial, sans-serif" }}>
            {/* Etiqueta de copia (solo en modo media hoja) */}
            {copyLabel && (
              <div style={{ textAlign: "right", fontSize: 8, fontWeight: 800, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                {copyLabel}
              </div>
            )}
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "stretch", marginBottom: 8, borderBottom: "3px solid #1e3a5f" }}>
              <div style={{ flex: 1, textAlign: "center", paddingBottom: 4 }}>
                <div style={{ fontSize: printSize === "half" ? 16 : 22, fontWeight: 900, color: "#1e3a5f", letterSpacing: "0.04em", lineHeight: 1 }}>
                  RECIBO DE CONCRETO PREMEZCLADO
                </div>
              </div>
              <div style={{ border: "2px solid #1e3a5f", borderRadius: 4, padding: "4px 14px", textAlign: "center", minWidth: 140 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e3a5f" }}>RECIBO No.</div>
                <div style={{ fontSize: printSize === "half" ? 16 : 22, fontWeight: 900, color: "#CC2229" }}>{String(effectiveReceiptNumber).padStart(4, "0")}</div>
              </div>
            </div>

            {/* Header info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8, fontSize: 11 }}>
              <div>
                <span style={{ fontWeight: 700 }}>CLIENTE: </span>
                <span style={{ borderBottom: "1px solid #333", display: "inline-block", minWidth: 200, paddingLeft: 4 }}>{receipt.cliente}</span>
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>FECHA: </span>
                <span style={{ borderBottom: "1px solid #333", display: "inline-block", minWidth: 140, paddingLeft: 4 }}>
                  Allende N.L., a {receiptDate.day} de {receiptDate.month} del {receiptDate.year}
                </span>
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>OBRA: </span>
                <span style={{ borderBottom: "1px solid #333", display: "inline-block", minWidth: 200, paddingLeft: 4 }}>{receipt.direccionObra}</span>
              </div>
            </div>

            {/* ① Concreto premezclado */}
            <div style={{ marginBottom: 6, border: "1px solid #ccc" }}>
              <div className="print-sec">① CONCRETO PREMEZCLADO</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["No.", "RESISTENCIA / ESPECIFICACIÓN", "TIPO DE SUMINISTRO", "CANTIDAD (m³)", "PRECIO UNITARIO", "IMPORTE"].map((h) => (
                      <th key={h} className="print-th" style={{ textAlign: h === "No." ? "center" : h === "IMPORTE" || h === "PRECIO UNITARIO" || h === "CANTIDAD (m³)" ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receipt.productos.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fb" }}>
                      <td className="print-td" style={{ textAlign: "center", fontWeight: 700 }}>{i + 1}</td>
                      <td className="print-td" style={{ fontWeight: 600 }}>{p.resistencia || "—"}</td>
                      <td className="print-td">{p.supplyType}</td>
                      <td className="print-td" style={{ textAlign: "right" }}>{(p.m3 ?? 0).toFixed(2)}</td>
                      <td className="print-td" style={{ textAlign: "right" }}>$ {moneyNum(p.precioPorM3)}</td>
                      <td className="print-td" style={{ textAlign: "right", fontWeight: 700 }}>$ {moneyNum((p.m3 ?? 0) * (p.precioPorM3 ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="print-total-row">
                    <td className="print-td" colSpan={5} style={{ textAlign: "right", fontWeight: 800, fontSize: 10 }}>SUBTOTAL CONCRETO:</td>
                    <td className="print-td" style={{ textAlign: "right", fontWeight: 800, fontSize: 11 }}>$ {moneyNum(subtotalConcreto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ② Metros vacíos */}
            {metrosVaciosTotal > 0 && (
              <div style={{ marginBottom: 6, border: "1px solid #ccc" }}>
                <div className="print-sec">② METROS VACÍOS</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["CONCEPTO", "CANTIDAD (m³)", "PRECIO UNITARIO", "IMPORTE"].map((h) => (
                        <th key={h} className="print-th" style={{ textAlign: h !== "CONCEPTO" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="print-td">Metros vacíos</td>
                      <td className="print-td" style={{ textAlign: "right" }}>{(receipt.metrosVaciosCantidad ?? 0).toFixed(2)}</td>
                      <td className="print-td" style={{ textAlign: "right" }}>$ {moneyNum(receipt.metrosVaciosPrecio)}</td>
                      <td className="print-td" style={{ textAlign: "right", fontWeight: 700 }}>$ {moneyNum(metrosVaciosTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ③ Servicio de bomba */}
            {hasBomba && bombaImporte > 0 && (
              <div style={{ marginBottom: 6, border: "1px solid #ccc" }}>
                <div className="print-sec">③ SERVICIO DE BOMBA</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["CONCEPTO", "PRECIO UNITARIO", "IMPORTE"].map((h) => (
                        <th key={h} className="print-th" style={{ textAlign: h !== "CONCEPTO" ? "right" : "left", width: h === "CONCEPTO" ? "60%" : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="print-td">Servicio de bomba</td>
                      <td className="print-td" style={{ textAlign: "right" }}>$ {moneyNum(bombaImporte)}</td>
                      <td className="print-td" style={{ textAlign: "right", fontWeight: 700 }}>$ {moneyNum(bombaImporte)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ④ Aditivos */}
            {aditivosActivos.length > 0 && (
              <div style={{ marginBottom: 6, border: "1px solid #ccc" }}>
                <div className="print-sec">④ ADITIVOS</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["CONCEPTO", "CANTIDAD (TOTAL)", "DOSIFICACIÓN / M³", "PRECIO UNITARIO", "IMPORTE"].map((h) => (
                        <th key={h} className="print-th" style={{ textAlign: h !== "CONCEPTO" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aditivosActivos.map((a, i) => {
                      const qty = totalM3Receipt * (a.dosis ?? 0);
                      const importe = qty * (a.precio ?? 0);
                      return (
                        <tr key={a.name} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fb" }}>
                          <td className="print-td">{a.name}{a.showUnit && a.unit ? ` (${a.unit})` : ""}</td>
                          <td className="print-td" style={{ textAlign: "right" }}>{qty.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                          <td className="print-td" style={{ textAlign: "right" }}>{(a.dosis ?? 0).toFixed(2)}</td>
                          <td className="print-td" style={{ textAlign: "right" }}>$ {moneyNum(a.precio)}</td>
                          <td className="print-td" style={{ textAlign: "right", fontWeight: 700 }}>$ {moneyNum(importe)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ⑤ Extras */}
            {extrasConImporte.length > 0 && (
              <div style={{ marginBottom: 6, border: "1px solid #ccc" }}>
                <div className="print-sec">⑤ EXTRAS</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["CONCEPTO", "CANTIDAD", "PRECIO UNITARIO", "IMPORTE"].map((h) => (
                        <th key={h} className="print-th" style={{ textAlign: h !== "CONCEPTO" ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extrasConImporte.map((ex, i) => {
                      const qty = parseFloat(ex.cantidad) || 0;
                      const precio = parseFloat(ex.precio) || 0;
                      const importe = qty * precio;
                      return (
                        <tr key={ex.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8f9fb" }}>
                          <td className="print-td">{ex.concepto}</td>
                          <td className="print-td" style={{ textAlign: "right" }}>{qty > 0 ? qty.toLocaleString("es-MX", { maximumFractionDigits: 2 }) : "—"}</td>
                          <td className="print-td" style={{ textAlign: "right" }}>{precio > 0 ? `$ ${moneyNum(precio)}` : "—"}</td>
                          <td className="print-td" style={{ textAlign: "right", fontWeight: 700 }}>$ {moneyNum(importe)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Observaciones + Totals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 8, marginBottom: 8 }}>
              <div style={{ border: "1px solid #ccc", padding: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", marginBottom: 4 }}>OBSERVACIONES:</div>
                <div style={{ fontSize: 11, minHeight: 32, borderBottom: "1px solid #ccc", marginBottom: 4 }}>{receipt.nota}</div>
                <div style={{ minHeight: 12 }} />
              </div>
              <div style={{ border: "1px solid #ccc" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", borderBottom: "2px solid #1e3a5f", padding: "6px 10px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1e3a5f" }}>TOTAL DEL SERVICIO:</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#1e3a5f" }}>$ {moneyNum(realTotal)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", borderBottom: "1px solid #ccc", padding: "5px 10px" }}>
                  <span style={{ fontSize: 10 }}>ANTICIPO(S):</span>
                  <span style={{ fontSize: 10 }}>$ {moneyNum(receipt.anticipo)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "6px 10px", background: "#1e3a5f" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "white" }}>RESTA / SALDO:</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "white" }}>$ {moneyNum(realResta)}</span>
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div style={{ border: "1px solid #ccc", padding: "5px 10px", marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: "#1e3a5f", textTransform: "uppercase", marginBottom: 3 }}>CONDICIONES DEL SERVICIO:</div>
              <ol style={{ fontSize: 7, paddingLeft: 14, margin: 0, lineHeight: 1.5, color: "#222" }}>
                <li><strong>Servicio de bombeo:</strong> El servicio está sujeto a un volumen mínimo de contratación. Cuando el volumen suministrado sea menor al mínimo establecido, se aplicará el cargo mínimo de bombeo correspondiente. CARGO POR SALIDA EN FALSO DE UNIDAD POR PARTE DEL CLIENTE.</li>
                <li><strong>Metros vacíos:</strong> Cuando la cantidad solicitada o programada no sea completada por causas atribuibles al cliente u obra, podrán aplicarse los cargos correspondientes conforme a las condiciones previamente acordadas.</li>
                <li><strong>Tiempos y maniobras adicionales:</strong> Los tiempos de espera, maniobras, tubería adicional y demás servicios extraordinarios podrán generar cargos adicionales cuando correspondan.</li>
                <li><strong>Conformidad:</strong> Con su firma, el cliente reconoce la recepción del suministro y/o servicios descritos en el presente recibo, así como los conceptos e importes señalados.</li>
                <li><strong>Saldo:</strong> La firma del presente recibo no implica liquidación cuando exista un saldo pendiente indicado en el mismo.</li>
              </ol>
            </div>

            {/* Signature line */}
            <div style={{ marginTop: 16, fontSize: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-end" }}>
                <div>
                  <div style={{ height: 28 }} />
                  <div style={{ borderBottom: "1px solid #333", paddingBottom: 2, color: "#555", fontStyle: "italic" }}>{receipt.firmaCliente}</div>
                  <div style={{ marginTop: 3, fontWeight: 700, textAlign: "center", fontSize: 9 }}>NOMBRE Y FIRMA DE CONFORMIDAD</div>
                </div>
                <div style={{ whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 700 }}>R: </span>
                  <span style={{ borderBottom: "1px solid #333", display: "inline-block", minWidth: 120, paddingLeft: 4, color: "#555", fontStyle: "italic" }}>{receipt.recibidoPor}</span>
                </div>
              </div>
            </div>
          </div>
        );

        return printSize === "half" ? (
          /* ── MODO MEDIA HOJA: 2 recibos por página (original + copia) ── */
          <div id="printable-concrete-receipt"
            className="fixed -left-[9999px] top-0 bg-white text-black print:static print:left-auto print:top-auto print:shadow-none"
            style={{ width: 760 }}>
            <div style={{ padding: "0.2in 0.25in" }}>
              {receiptBody("ORIGINAL — CLIENTE")}
            </div>
            {/* Línea de corte */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", color: "#bbb", fontSize: 9 }}>
              <div style={{ flex: 1, borderTop: "1.5px dashed #bbb" }} />
              <span>✂</span>
              <div style={{ flex: 1, borderTop: "1.5px dashed #bbb" }} />
            </div>
            <div style={{ padding: "0.2in 0.25in" }}>
              {receiptBody("COPIA — EMPRESA")}
            </div>
          </div>
        ) : (
          /* ── MODO HOJA COMPLETA: 1 recibo por página (landscape) ── */
          <div id="printable-concrete-receipt"
            className="fixed -left-[9999px] top-0 bg-white text-black print:static print:left-auto print:top-auto print:shadow-none"
            style={{ width: 980, padding: "0.3in 0.35in" }}>
            {receiptBody()}
          </div>
        );
      })()}

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center print:hidden">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar recibo</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar este recibo? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={() => { deleteReceipt(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
