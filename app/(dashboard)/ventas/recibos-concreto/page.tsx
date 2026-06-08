"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, MessageCircle, Printer, ReceiptText, Save } from "lucide-react";
import {
  calculateConcreteReceiptTotal,
  ConcreteExtra,
  ConcreteReceipt,
  ConcreteSupplyType,
  concreteReceiptsBase,
  concreteReceiptClientes,
  concreteReceiptObras,
  concreteReceiptResistencias,
  defaultConcreteExtras,
  formatReceiptDate,
  loadConcreteReceipts,
  saveConcreteReceipts,
  syncReceiptWithTrip,
} from "@/lib/concreteReceipts";

function money(value: number) {
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getNextReceiptNumber(receipts: ConcreteReceipt[]) {
  const maxReceipt = receipts.reduce((max, item) => Math.max(max, item.receiptNumber), 156);
  return maxReceipt + 1;
}

function createReceipt(receipts: ConcreteReceipt[]): ConcreteReceipt {
  const nextNumber = getNextReceiptNumber(receipts);

  return {
    id: `REC-${nextNumber}`,
    receiptNumber: nextNumber,
    cliente: "Roberto Peña",
    direccionObra: "Vista Encinos",
    m3: 5,
    resistencia: "F'C 150-20-14 KG/CM²",
    supplyType: "Tiro directo",
    servicioBomba: "",
    metrosVaciosCantidad: 1,
    metrosVaciosPrecio: 800,
    precioPorM3: 245,
    anticipo: 0,
    nota: "2 / 06 / 26",
    firmaCliente: "",
    recibidoPor: "",
    fecha: "2026-06-02",
    extras: defaultConcreteExtras.map((extra) => ({ ...extra })),
    total: 1305,
    resta: 1305,
    viajeFolio: `VJ-2026-${nextNumber}`,
  };
}

export default function RecibosConcretoPage() {
  const [receipts, setReceipts] = useState(concreteReceiptsBase);
  const [receipt, setReceipt] = useState<ConcreteReceipt>(() => createReceipt(concreteReceiptsBase));

  const totals = useMemo(() => calculateConcreteReceiptTotal(receipt), [receipt]);
  const receiptDate = formatReceiptDate(receipt.fecha);
  const realTotal = totals.total * 10;
  const realResta = totals.resta * 10;
  const ticketTotal = totals.total;
  const ticketResta = totals.resta;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedReceipts = loadConcreteReceipts();
      setReceipts(storedReceipts);
      setReceipt(createReceipt(storedReceipts));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  function updateReceipt(partial: Partial<ConcreteReceipt>) {
    setReceipt((current) => ({
      ...current,
      ...partial,
      ...calculateConcreteReceiptTotal({ ...current, ...partial }),
    }));
  }

  function updateExtra(index: number, partial: Partial<ConcreteExtra>) {
    setReceipt((current) => {
      const extras = current.extras.map((extra, extraIndex) => (
        extraIndex === index ? { ...extra, ...partial } : extra
      ));
      return {
        ...current,
        extras,
        ...calculateConcreteReceiptTotal({ ...current, extras }),
      };
    });
  }

  function saveReceipt() {
    const nextReceipt = {
      ...receipt,
      total: realTotal,
      resta: realResta,
      viajeFolio: receipt.viajeFolio ?? `VJ-2026-${receipt.receiptNumber}`,
    };
    const nextReceipts = [nextReceipt, ...receipts.filter((item) => item.id !== nextReceipt.id)];
    setReceipts(nextReceipts);
    saveConcreteReceipts(nextReceipts);
    syncReceiptWithTrip(nextReceipt);
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: {
        type: "success",
        message: "Recibo guardado y viaje pendiente creado.",
      },
    }));
  }

  function printReceipt() {
    saveReceipt();
    window.print();
  }

  function sendWhatsApp() {
    saveReceipt();

    const message = [
      `Recibo concreto premezclado No. ${receipt.receiptNumber}`,
      `Cliente: ${receipt.cliente}`,
      `Obra: ${receipt.direccionObra}`,
      `M3: ${receipt.m3}`,
      `Resistencia: ${receipt.resistencia}`,
      `Suministro: ${receipt.supplyType}`,
      `Precio/m3: ${money(receipt.precioPorM3)}`,
      `Total: ${money(ticketTotal)}`,
      `Resta: ${money(ticketResta)}`,
      `Nota: ${receipt.nota || "Sin nota"}`,
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

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
            padding: 24px !important;
            color: black !important;
          }

          @page {
            size: letter landscape;
            margin: 0.35in;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-sm text-gray-500">Captura digital del recibo físico de concreto premezclado</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveReceipt}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
          >
            <Save size={16} />
            Guardar
          </button>
          <button
            type="button"
            onClick={sendWhatsApp}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-green-500/60 hover:text-green-300"
          >
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={printReceipt}
            className="flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#991A1E]"
          >
            <Printer size={16} />
            Imprimir recibo
          </button>
        </div>
      </div>

      <div className="max-w-5xl">
        <section className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-5 print:hidden">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText size={18} className="text-[#CC2229]" />
            <h3 className="font-semibold text-white">Llenar recibo</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">No. recibo</span>
              <input
                type="number"
                value={receipt.receiptNumber}
                onChange={(event) => updateReceipt({
                  receiptNumber: Number(event.target.value),
                  id: `REC-${event.target.value}`,
                  viajeFolio: `VJ-2026-${event.target.value}`,
                })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Fecha</span>
              <input
                type="date"
                value={receipt.fecha}
                onChange={(event) => updateReceipt({ fecha: event.target.value })}
                className="date-input-white w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm text-gray-400">Nombre del cliente</span>
              <input
                list="concrete-clients"
                value={receipt.cliente}
                onChange={(event) => updateReceipt({ cliente: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
              <datalist id="concrete-clients">
                {concreteReceiptClientes.map((cliente) => <option key={cliente} value={cliente} />)}
              </datalist>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm text-gray-400">Dirección de la obra</span>
              <input
                list="concrete-obras"
                value={receipt.direccionObra}
                onChange={(event) => updateReceipt({ direccionObra: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
              <datalist id="concrete-obras">
                {concreteReceiptObras.map((obra) => <option key={obra} value={obra} />)}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">M³</span>
              <input
                type="number"
                value={receipt.m3}
                onChange={(event) => updateReceipt({ m3: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Resistencia</span>
              <input
                list="concrete-resistencias"
                value={receipt.resistencia}
                onChange={(event) => updateReceipt({ resistencia: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
              <datalist id="concrete-resistencias">
                {concreteReceiptResistencias.map((resistencia) => <option key={resistencia} value={resistencia} />)}
              </datalist>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Tipo de suministro</span>
              <select
                value={receipt.supplyType}
                onChange={(event) => updateReceipt({ supplyType: event.target.value as ConcreteSupplyType })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              >
                <option>Tiro directo</option>
                <option>Bombeado</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Servicio de bomba</span>
              <input
                value={receipt.servicioBomba}
                onChange={(event) => updateReceipt({ servicioBomba: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Metros vacíos</span>
              <input
                type="number"
                value={receipt.metrosVaciosCantidad}
                onChange={(event) => updateReceipt({ metrosVaciosCantidad: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Precio metro vacío</span>
              <input
                type="number"
                value={receipt.metrosVaciosPrecio}
                onChange={(event) => updateReceipt({ metrosVaciosPrecio: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Precio por m³</span>
              <input
                type="number"
                value={receipt.precioPorM3}
                onChange={(event) => updateReceipt({ precioPorM3: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Anticipo</span>
              <input
                type="number"
                value={receipt.anticipo}
                onChange={(event) => updateReceipt({ anticipo: Number(event.target.value) })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-[#CC2229]" />
              <p className="font-semibold text-white">Aditivos y extras</p>
            </div>
            <div className="space-y-3">
              {receipt.extras.map((extra, index) => (
                <div key={extra.name} className="grid grid-cols-[auto_1fr_90px_70px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={extra.checked}
                    onChange={(event) => updateExtra(index, { checked: event.target.checked })}
                    className="h-4 w-4 accent-[#CC2229]"
                  />
                  <span className="text-sm text-gray-300">{extra.name}</span>
                  <input
                    type="number"
                    value={extra.price}
                    onChange={(event) => updateExtra(index, { price: Number(event.target.value), checked: Number(event.target.value) > 0 || extra.checked })}
                    className="rounded-md border border-[#3A3A3A] bg-[#242424] px-2 py-1 text-sm text-white"
                  />
                  <input
                    value={extra.quantity}
                    onChange={(event) => updateExtra(index, { quantity: event.target.value })}
                    placeholder={extra.unit}
                    className="rounded-md border border-[#3A3A3A] bg-[#242424] px-2 py-1 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="block col-span-2">
              <span className="mb-1 block text-sm text-gray-400">Nota</span>
              <textarea
                rows={2}
                value={receipt.nota}
                onChange={(event) => updateReceipt({ nota: event.target.value })}
                className="w-full resize-none rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Firma cliente</span>
              <input
                value={receipt.firmaCliente}
                onChange={(event) => updateReceipt({ firmaCliente: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">R:</span>
              <input
                value={receipt.recibidoPor}
                onChange={(event) => updateReceipt({ recibidoPor: event.target.value })}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-4">
            <div>
              <p className="text-xs text-gray-500">Total real interno</p>
              <p className="text-2xl font-bold text-white">{money(realTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total para imprimir / WhatsApp</p>
              <p className="text-2xl font-bold text-[#CC2229]">{money(ticketTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Resta real interna</p>
              <p className="text-lg font-bold text-gray-300">{money(realResta)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Resta para imprimir / WhatsApp</p>
              <p className="text-lg font-bold text-gray-300">{money(ticketResta)}</p>
            </div>
          </div>
        </section>

          <div id="printable-concrete-receipt" className="fixed -left-[9999px] top-0 w-[1050px] bg-white p-6 text-black print:static print:left-auto print:top-auto print:w-auto print:shadow-none">
            <div className="rounded-[18px] border-[4px] border-black p-4">
              <div className="grid grid-cols-[1fr_180px] gap-4">
                <h1 className="text-center text-3xl font-black tracking-wide">CONCRETO PREMEZCLADO</h1>
                <div className="rounded-md border-2 border-black px-3 py-2 text-center">
                  <p className="text-sm font-black">RECIBO</p>
                  <p className="text-xl font-black text-[#B91C1C]">No. {receipt.receiptNumber}</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-[1fr_300px] gap-4 text-[17px] font-black uppercase">
                <div className="space-y-1">
                  <p>Nombre del cliente: <span className="receipt-line handwritten">{receipt.cliente}</span></p>
                  <p>Dirección de la obra: <span className="receipt-line handwritten">{receipt.direccionObra}</span></p>
                  <p>
                    M³: <span className="short-line handwritten">{receipt.m3}</span>
                    <span className="ml-6">F&apos;C</span> <span className="medium-line handwritten">{receipt.resistencia.replace("F'C ", "")}</span>
                  </p>
                  <p>Servicio de bomba: <span className="receipt-line handwritten">{receipt.servicioBomba}</span></p>
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
                    <span className="medium-line handwritten">{money(ticketTotal)}</span>
                  </p>
                  <p>
                    Anticipo 1:
                    <span className="medium-line handwritten">{receipt.anticipo ? money(receipt.anticipo) : ""}</span>
                    Resta:
                    <span className="medium-line handwritten">{money(ticketResta)}</span>
                  </p>
                  <p>Nota: <span className="receipt-line handwritten">{receipt.nota}</span></p>
                  <div className="pt-6 text-center">
                    <p className="mx-auto w-72 border-b-2 border-black handwritten">{receipt.firmaCliente}</p>
                    <p className="text-sm leading-tight">Nombre y<br />firma del cliente</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_170px] items-end gap-4 text-[17px] font-black uppercase">
                <p>
                  Allende, N.L. a
                  <span className="short-line handwritten">{receiptDate.day}</span>
                  de
                  <span className="medium-line handwritten">{receiptDate.month}</span>
                  del 20
                  <span className="short-line handwritten">{receiptDate.year.slice(-2)}</span>
                </p>
                <p>R: <span className="receipt-line handwritten">{receipt.recibidoPor}</span></p>
              </div>
            </div>
          </div>
      </div>

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
          color: #1E3A8A;
          font-family: "Comic Sans MS", "Bradley Hand", cursive;
          font-size: 1.1em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
