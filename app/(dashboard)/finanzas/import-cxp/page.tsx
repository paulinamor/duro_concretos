"use client";

import { useState } from "react";
import { getCollectionDocs, upsertDocument, deleteDocument } from "@/lib/db";
import { todayCST } from "@/lib/dateUtils";

// ── Data parsed from DURO R-2026_CXP_30_JUL.xlsx (hoja CXP, planta Allende) ──
const XLSX_DATA = [
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-01",vencimiento:"2026-07-01",serie:"B",folio:"B1823",uuid:"F98C0CBD-C710-472E-9C7B-F67D991C8B2B",uuidRelacion:"",rfc:"BPS181112J91",contraparte:"BATTERY POWER STOP",concepto:"",subtotal:6933.88,iva:1109.42,retenidoIVA:0,ish:0,total:8043.30,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:8043.30,status:"Pagado",abonos:[{fecha:"2026-07-01",monto:8043.30,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-08",vencimiento:"2026-07-08",serie:"F",folio:"F25505",uuid:"0BAB8140-043E-4255-838A-A0A23393FBBB",uuidRelacion:"",rfc:"CSA1502132J0",contraparte:"CARTUCHOS Y SERVICIOS ALLENDE",concepto:"",subtotal:600,iva:96,retenidoIVA:0,ish:0,total:696,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:696,status:"Pagado",abonos:[{fecha:"2026-07-08",monto:696,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-01",vencimiento:"2026-07-01",serie:"LI",folio:"LI86636",uuid:"F0F7CC27-2443-B045-898B-CDE36863F8C5",uuidRelacion:"",rfc:"FNO010821FN6",contraparte:"FERRETERIA DEL NORTE",concepto:"",subtotal:16743.48,iva:2678.96,retenidoIVA:0,ish:0,total:19422.44,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:19422.44,status:"Pagado",abonos:[{fecha:"2026-07-01",monto:19422.44,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-07",vencimiento:"2026-07-07",serie:"LI",folio:"LI86926",uuid:"698D0D08-4686-5E48-A718-C70CFC6BBD51",uuidRelacion:"",rfc:"FNO010821FN6",contraparte:"FERRETERIA DEL NORTE",concepto:"",subtotal:1315.15,iva:210.42,retenidoIVA:0,ish:0,total:1525.57,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:1525.57,status:"Pagado",abonos:[{fecha:"2026-07-07",monto:1525.57,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-14",vencimiento:"2026-07-14",serie:"LI",folio:"LI87134",uuid:"4CD45767-03B4-E745-BE4E-DFA7874F90E3",uuidRelacion:"",rfc:"FNO010821FN6",contraparte:"FERRETERIA DEL NORTE",concepto:"",subtotal:1714.43,iva:274.31,retenidoIVA:0,ish:0,total:1988.74,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:0,status:"Pendiente",abonos:[],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-20",vencimiento:"2026-07-20",serie:"LI",folio:"LI87359",uuid:"6F1C71C2-F871-7A44-8AF7-AF5EFC16F7D1",uuidRelacion:"",rfc:"FNO010821FN6",contraparte:"FERRETERIA DEL NORTE",concepto:"",subtotal:2485.22,iva:397.64,retenidoIVA:0,ish:0,total:2882.86,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:0,status:"Pendiente",abonos:[],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-06",vencimiento:"2026-07-06",serie:"EDC",folio:"EDC959288",uuid:"CA006C23-55D8-4349-AD11-B6FD7AF5DFA1",uuidRelacion:"",rfc:"GME080312617",contraparte:"GASNGO MEXICO",concepto:"",subtotal:10269.80,iva:1605.66,retenidoIVA:0,ish:0,total:11875.46,formaPago:"03 - Transferencia electrónica de fondos",banco:"",bancoPago:"",montoPagado:11875.46,status:"Pagado",abonos:[{fecha:"2026-07-06",monto:11875.46,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-13",vencimiento:"2026-07-13",serie:"EDC",folio:"EDC965905",uuid:"448D82D4-ABE8-4C27-A368-A838B3F2DE87",uuidRelacion:"",rfc:"GME080312617",contraparte:"GASNGO MEXICO",concepto:"",subtotal:5420.35,iva:845.99,retenidoIVA:0,ish:0,total:6266.34,formaPago:"03 - Transferencia electrónica de fondos",banco:"",bancoPago:"",montoPagado:6266.34,status:"Pagado",abonos:[{fecha:"2026-07-13",monto:6266.34,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-20",vencimiento:"2026-07-20",serie:"EDC",folio:"EDC972621",uuid:"E23E0C09-41A1-48D1-94C4-897B5663D0DC",uuidRelacion:"",rfc:"GME080312617",contraparte:"GASNGO MEXICO",concepto:"",subtotal:9167.57,iva:1432.64,retenidoIVA:0,ish:0,total:10600.21,formaPago:"03 - Transferencia electrónica de fondos",banco:"",bancoPago:"",montoPagado:0,status:"Pendiente",abonos:[],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-04-30",vencimiento:"2026-04-30",serie:"MERC-",folio:"MERC-7541901",uuid:"87406147-5650-8E48-9063-96F260626FBF",uuidRelacion:"",rfc:"EMS0912039N7",contraparte:"GETNET MEXICO SERVICIOS DE ADQUIRENCIA",concepto:"",subtotal:600,iva:96,retenidoIVA:0,ish:0,total:696,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:696,status:"Pagado",abonos:[{fecha:"2026-04-30",monto:696,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-06-30",vencimiento:"2026-06-30",serie:"MERC-",folio:"MERC-7807724",uuid:"404DE61A-6DF2-CC4D-8DAF-BCB136585E05",uuidRelacion:"",rfc:"EMS0912039N7",contraparte:"GETNET MEXICO SERVICIOS DE ADQUIRENCIA",concepto:"",subtotal:200,iva:32,retenidoIVA:0,ish:0,total:232,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:232,status:"Pagado",abonos:[{fecha:"2026-06-30",monto:232,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-06-30",vencimiento:"2026-06-30",serie:"AA",folio:"AA24936",uuid:"65618C92-179C-439E-AAC0-76368893F565",uuidRelacion:"",rfc:"GFL0809104D1",contraparte:"GLOBAL FINANCIAL LEASING",concepto:"",subtotal:447586.21,iva:71613.79,retenidoIVA:0,ish:0,total:519200,formaPago:"99 - Por definir",banco:"",bancoPago:"BBVA 30/06",montoPagado:295406.89,status:"Parcial",abonos:[{fecha:"2026-06-30",monto:295406.89,referencia:"BBVA 30/06"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-02",vencimiento:"2026-07-02",serie:"AA",folio:"AA24947",uuid:"678A56DE-F7DC-46E3-9F37-8272590E1F27",uuidRelacion:"",rfc:"GFL0809104D1",contraparte:"GLOBAL FINANCIAL LEASING",concepto:"",subtotal:197819.15,iva:31651.06,retenidoIVA:0,ish:0,total:229470.21,formaPago:"99 - Por definir",banco:"",bancoPago:"BBVA 21/07",montoPagado:76490.07,status:"Parcial",abonos:[{fecha:"2026-07-21",monto:76490.07,referencia:"BBVA 21/07"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-03-30",vencimiento:"2026-03-30",serie:"I",folio:"I9160",uuid:"6E6F0B9C-6402-466B-B359-5BBB3798AABB",uuidRelacion:"",rfc:"GSO120427I62",contraparte:"GRUPO SOLUFI",concepto:"",subtotal:5657.07,iva:905.13,retenidoIVA:0,ish:0,total:6562.20,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:6562.20,status:"Pagado",abonos:[{fecha:"2026-03-30",monto:6562.20,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-06-16",vencimiento:"2026-06-16",serie:"MI",folio:"MI397585",uuid:"0633D5E8-4D52-45C8-846E-2B10B25C7CAE",uuidRelacion:"",rfc:"ICI9411098G5",contraparte:"IMPULSO COMERCIAL INTERNACIONAL",concepto:"",subtotal:365.40,iva:58.46,retenidoIVA:0,ish:0,total:423.86,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:423.86,status:"Pagado",abonos:[{fecha:"2026-06-16",monto:423.86,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-08",vencimiento:"2026-07-08",serie:"A",folio:"A107",uuid:"4FC49557-4DC6-472B-A88A-5038759585B0",uuidRelacion:"",rfc:"LTE181129V77",contraparte:"LEV TECH",concepto:"",subtotal:2500,iva:400,retenidoIVA:0,ish:0,total:2900,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:2900,status:"Pagado",abonos:[{fecha:"2026-07-08",monto:2900,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
  { estadoSAT:"Vigente",tipo:"Factura",fecha:"2026-07-26",vencimiento:"2026-07-26",serie:"FMM",folio:"FMM140226070055291",uuid:"975F9163-FB9E-42F7-A1D2-736228750C69",uuidRelacion:"",rfc:"TME840315KT6",contraparte:"TELEFONOS DE MEXICO",concepto:"",subtotal:801.77,iva:118.33,retenidoIVA:0,ish:0,total:857.99,formaPago:"99 - Por definir",banco:"",bancoPago:"",montoPagado:857.99,status:"Pagado",abonos:[{fecha:"2026-07-26",monto:857.99,referencia:"xlsx-import"}],notas:"",planta:"Allende"},
] as const;

const COL = "cuentasPorPagar";
const $ = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Phase = "idle" | "backing-up" | "importing" | "done" | "error";

export default function ImportCxpPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [backupDone, setBackupDone] = useState(false);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function handleBackup() {
    setPhase("backing-up");
    addLog("Leyendo registros existentes en cuentasPorPagar…");
    try {
      const existing = await getCollectionDocs<Record<string, unknown>>(COL);
      const allendeExisting = existing.filter((r) => r.planta === "Allende");
      addLog(`Encontrados ${existing.length} total (${allendeExisting.length} de Allende).`);
      const json = JSON.stringify(existing, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-cuentasPorPagar-${todayCST()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog("✓ Backup descargado.");
      setBackupDone(true);
      setPhase("idle");
    } catch (e) {
      addLog(`✗ Error: ${e}`);
      setPhase("error");
    }
  }

  async function handleImport() {
    if (!backupDone) {
      addLog("⚠ Descarga el backup primero.");
      return;
    }
    setPhase("importing");
    addLog("Eliminando registros existentes de Allende…");
    try {
      const existing = await getCollectionDocs<{ id?: string; planta?: string }>(COL);
      const toDelete = existing.filter((r) => r.planta === "Allende" && r.id);
      for (const r of toDelete) {
        await deleteDocument(COL, r.id!);
      }
      addLog(`✓ Eliminados ${toDelete.length} registros anteriores.`);

      addLog("Importando 17 registros desde XLSX…");
      let ok = 0;
      for (const rec of XLSX_DATA) {
        const { uuid, ...rest } = rec;
        await upsertDocument(COL, uuid, rest);
        addLog(`  ✓ ${rec.folio} · ${rec.contraparte} · ${$(rec.total)} · ${rec.status}`);
        ok++;
      }
      addLog(`\n✅ Importación completa: ${ok}/17 registros.`);
      setPhase("done");
    } catch (e) {
      addLog(`✗ Error durante importación: ${e}`);
      setPhase("error");
    }
  }

  const statusColor: Record<string, string> = {
    Pagado: "text-emerald-400",
    Parcial: "text-amber-400",
    Pendiente: "text-red-400",
  };

  const totalXlsx = XLSX_DATA.reduce((s, r) => s + r.total, 0);
  const pagadoXlsx = XLSX_DATA.reduce((s, r) => s + r.montoPagado, 0);
  const pendienteXlsx = totalXlsx - pagadoXlsx;

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Finanzas · CxP</p>
          <h1 className="text-2xl font-bold">Importar desde XLSX</h1>
          <p className="text-sm text-gray-400 mt-1">
            Fuente: <span className="text-white font-mono">DURO R-2026_CXP_30_JUL.xlsx</span> · Hoja CXP · Planta Allende
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Registros", value: "17" },
            { label: "Total XLSX", value: $(totalXlsx) },
            { label: "Pendiente", value: $(pendienteXlsx) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#181b20] p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</p>
              <p className="text-xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Preview table */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
            Preview — 17 registros a importar
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-500">
                  <th className="px-4 py-2 text-left">Folio</th>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">Proveedor</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Pagado</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {XLSX_DATA.map((r) => (
                  <tr key={r.uuid} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 font-mono text-xs text-[#CC2229]">{r.folio}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{r.fecha.split("-").reverse().join("/")}</td>
                    <td className="px-4 py-2 text-white">{r.contraparte}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{$(r.total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-300">{r.montoPagado > 0 ? $(r.montoPagado) : "—"}</td>
                    <td className={`px-4 py-2 font-semibold text-xs ${statusColor[r.status] ?? "text-gray-400"}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center">
          <button
            onClick={handleBackup}
            disabled={phase === "backing-up" || phase === "importing"}
            className="px-5 py-2.5 rounded-xl border border-white/20 text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {phase === "backing-up" ? "Descargando…" : "1. Descargar Backup"}
          </button>
          <button
            onClick={handleImport}
            disabled={!backupDone || phase === "importing" || phase === "done"}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer
              ${backupDone && phase !== "importing" && phase !== "done"
                ? "bg-[#CC2229] hover:bg-[#aa1a20] text-white"
                : "bg-white/10 text-gray-500 cursor-not-allowed opacity-40"}`}
          >
            {phase === "importing" ? "Importando…" : phase === "done" ? "✓ Importado" : "2. Importar (reemplaza Allende)"}
          </button>
          {!backupDone && phase === "idle" && (
            <p className="text-xs text-gray-500">Descarga el backup primero para habilitar la importación.</p>
          )}
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-[#111] p-4 font-mono text-xs text-gray-300 space-y-0.5 max-h-80 overflow-y-auto">
            {log.map((line, i) => (
              <p key={i} className={line.startsWith("✅") ? "text-emerald-400 font-bold" : line.startsWith("✗") ? "text-red-400" : ""}>{line}</p>
            ))}
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 text-sm font-semibold">
            ✅ Importación completada. Ve a <a href="/finanzas/cxp" className="underline">Cuentas por Pagar</a> para verificar.
          </div>
        )}
      </div>
    </div>
  );
}
