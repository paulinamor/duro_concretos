"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, FileCheck, FileDown, Sparkles, Upload, X } from "lucide-react";
import type { Cuenta } from "./SatAccountsPage";
import type { SatDownloadKind } from "@/lib/satDownloads";
import { localISODate } from "@/lib/dateUtils";

interface Props {
  open: boolean;
  kind: SatDownloadKind;
  existingUuids: Set<string>;
  onClose: () => void;
  onConfirm: (records: Omit<Cuenta, "id" | "planta">[]) => Promise<void>;
}

// ─── Column maps ──────────────────────────────────────────────────────────────

const COL_CXC: Record<string, keyof Omit<Cuenta, "id" | "planta" | "abonos">> = {
  "ESTADO SAT": "estadoSAT", "ESTADO_SAT": "estadoSAT", "ESTADOSAT": "estadoSAT",
  "TIPO": "tipo",
  "FECHA": "fecha", "FECHA EMISION": "fecha", "FECHA_EMISION": "fecha", "FECHA DE EMISION": "fecha",
  "SERIE": "serie",
  "FOLIO": "folio",
  "UUID": "uuid",
  "UUID RELACION": "uuidRelacion", "UUID_RELACION": "uuidRelacion", "UUID RELACIÓN": "uuidRelacion",
  "RFC RECEPTOR": "rfc", "RFC_RECEPTOR": "rfc", "RFC EMISOR": "rfc", "RFC_EMISOR": "rfc",
  "NOMBRE RECEPTOR": "contraparte", "NOMBRE_RECEPTOR": "contraparte",
  "NOMBRE DEL EMISOR": "contraparte", "NOMBRE EMISOR": "contraparte", "NOMBRE_EMISOR": "contraparte",
  "CONCEPTO": "concepto",
  "SUBTOTAL": "subtotal", "SUB TOTAL": "subtotal", "SUB_TOTAL": "subtotal",
  "IVA": "iva", "IVA 16%": "iva", "IVA16%": "iva",
  "TOTAL": "total",
  "FORMA DE PAGO": "formaPago", "FORMA_DE_PAGO": "formaPago", "FORMADEPAGO": "formaPago",
  "COSEC. TC": "banco", "COSEC TC": "banco", "COSEC_TC": "banco", "COSEC.TC": "banco",
  "VENCIMIENTO": "vencimiento",
};

const COL_CXP: Record<string, keyof Omit<Cuenta, "id" | "planta" | "abonos">> = {
  ...COL_CXC,
  "RFC EMISOR": "rfc", "RFC_EMISOR": "rfc",
  "NOMBRE EMISOR": "contraparte", "NOMBRE_EMISOR": "contraparte",
  "NOMBRE DEL EMISOR": "contraparte",
  "RETENIDO IVA": "retenidoIVA", "RETENIDO_IVA": "retenidoIVA", "RET IVA": "retenidoIVA",
  "RETENIDO ISR": "retenidoISR", "RETENIDO_ISR": "retenidoISR", "RET ISR": "retenidoISR",
  "ISH": "ish",
  "BANCO": "bancoPago",
};

const COLS_CXC = ["Estado SAT", "Tipo", "Fecha Emision", "Serie", "Folio", "UUID", "UUID Relacion", "RFC Emisor", "NOMBRE DEL EMISOR", "SubTotal", "IVA 16%", "Total", "FormaDePago", "COSEC. TC"];
const COLS_CXP = ["Estado SAT", "Tipo", "Fecha Emision", "Serie", "Folio", "UUID", "UUID Relacion", "RFC Emisor", "NOMBRE DEL EMISOR", "SubTotal", "IVA 16%", "Retenido IVA", "ISH", "Total", "FormaDePago", "COSEC. TC", "BANCO"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: unknown) {
  return String(s ?? "").trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove accents
    .replace(/\s+/g, " ");
}

function parseNum(v: unknown) {
  return parseFloat(String(v ?? "").replace(/[$,\s]/g, "")) || 0;
}

function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Excel serial number (5 digits)
  if (/^\d{5}$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  // 4-digit year: DD/MM/YYYY or MM/DD/YYYY
  const mDMY = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (mDMY) {
    const [, a, b, y] = mDMY;
    // If first part > 12 it must be the day → DD/MM/YYYY
    if (parseInt(a) > 12) return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    // If second part > 12 it must be the day → MM/DD/YYYY (XLSX.js US output)
    if (parseInt(b) > 12) return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    // Ambiguous: default to DD/MM/YYYY (Mexican convention)
    return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  // 2-digit year: XLSX.js reformats Excel date cells to M/D/YY (US format).
  // e.g. Excel DD/MM/YY "09/07/26" → XLSX outputs "7/9/26" → parse as M/D/YY.
  const mMDY2 = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (mMDY2) {
    const [, m, d, yy] = mMDY2;
    const fullYear = parseInt(yy) < 50 ? 2000 + parseInt(yy) : 1900 + parseInt(yy);
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function normalizeEstado(v: string): Cuenta["estadoSAT"] {
  const u = v.toUpperCase();
  if (u.includes("CANCEL")) return "Cancelado";
  if (u.includes("SUSTIT")) return "Sustituida";
  return "Vigente";
}

function normalizeTipo(v: string): Cuenta["tipo"] {
  const u = v.toUpperCase();
  if (u === "I" || u.includes("FACTURA")) return "Factura";
  if (u === "E" || u.includes("CREDITO") || u.includes("CRÉDITO")) return "Nota de Crédito";
  if (u === "P" || u.includes("PAGO")) return "Complemento de Pago";
  return "Factura";
}

function vencimientoDefault(fecha: string): string {
  if (!fecha) return "";
  const d = new Date(fecha + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + 30);
  return localISODate(d);
}

function currency(n: number) {
  return n?.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) ?? "—";
}

// ─── Parse Excel ──────────────────────────────────────────────────────────────

async function parseExcel(file: File, kind: SatDownloadKind): Promise<Omit<Cuenta, "id" | "planta">[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

  const colMap = kind === "cxc" ? COL_CXC : COL_CXP;
  const KEY = ["UUID", "FOLIO", "FECHA", "RFC"];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const r = (rows[i] || []).map(norm);
    if (KEY.some((k) => r.some((c) => c.includes(k)))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error("No se encontró encabezado. Verifica que el archivo tenga las columnas correctas.");

  const headers = rows[headerIdx].map(norm);
  const numFields = new Set<string>(["subtotal", "iva", "total", "retenidoIVA", "retenidoISR", "ish", "montoPagado"]);
  const records: Omit<Cuenta, "id" | "planta">[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !String(c ?? "").trim())) continue;

    const rec: Record<string, unknown> = {
      estadoSAT: "Vigente", tipo: "Factura", serie: "", uuid: "", uuidRelacion: "",
      rfc: "", contraparte: "", fecha: "", folio: "", concepto: "",
      subtotal: 0, iva: 0, total: 0, formaPago: "", banco: "",
      retenidoIVA: 0, retenidoISR: 0, ish: 0, bancoPago: "",
      montoPagado: 0, vencimiento: "", status: "Pendiente", notas: "",
    };

    headers.forEach((h, ci) => {
      const field = colMap[h];
      if (!field) return;
      const raw = row[ci];
      if (raw === undefined || raw === null || String(raw).trim() === "") return;
      if (field === "estadoSAT") rec[field] = normalizeEstado(String(raw));
      else if (field === "tipo") rec[field] = normalizeTipo(String(raw));
      else if (field === "fecha") rec[field] = parseDate(raw);
      else if (numFields.has(field)) rec[field] = parseNum(raw);
      else rec[field] = String(raw).trim();
    });

    if (!rec.fecha) continue;
    if (!rec.vencimiento) rec.vencimiento = vencimientoDefault(String(rec.fecha));

    records.push(rec as Omit<Cuenta, "id" | "planta">);
  }
  return records;
}

// ─── Download template ────────────────────────────────────────────────────────

function downloadTemplate(kind: SatDownloadKind) {
  const headers = kind === "cxc" ? COLS_CXC : COLS_CXP;
  const example = kind === "cxc"
    ? ["Vigente", "Factura", "2026-06-01", "A", "F-001", "UUID-0001-EJEMPLO", "", "RFC123456789", "Nombre del cliente", "10000", "1600", "11600", "03 - Transferencia electronica", "BBVA-001"]
    : ["Vigente", "Factura", "2026-06-01", "A", "F-001", "UUID-0001-EJEMPLO", "", "RFC123456789", "Nombre del proveedor", "10000", "1600", "0", "0", "11600", "03 - Transferencia electronica", "BBVA-001", "BANAMEX"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind === "cxc" ? "CXC" : "CXP");
  XLSX.writeFile(wb, `TEMPLATE_${kind.toUpperCase()}_DURO.xlsx`);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = "upload" | "preview" | "saving" | "done";

export default function CargaMasivaModal({ open, kind, existingUuids, onClose, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<Omit<Cuenta, "id" | "planta">[]>([]);
  const [dupeUuids, setDupeUuids] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isCxc = kind === "cxc";
  const cols = isCxc ? COLS_CXC : COLS_CXP;

  function reset() { setPhase("upload"); setFile(null); setRecords([]); setDupeUuids(new Set()); setProcessing(false); setError(""); }
  function handleClose() { reset(); onClose(); }

  async function handleAnalyze() {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const parsed = await parseExcel(file, kind);
      if (!parsed.length) throw new Error("No se encontraron registros. Verifica que el archivo tenga datos y el encabezado correcto.");
      const dupes = new Set(
        parsed
          .map((r) => r.uuid?.trim().toUpperCase())
          .filter((u): u is string => !!u && existingUuids.has(u)),
      );
      setDupeUuids(dupes);
      setRecords(parsed);
      setPhase("preview");
    } catch (e) {
      setError(String(e).replace("Error: ", ""));
    } finally {
      setProcessing(false);
    }
  }

  async function handleImport() {
    const toImport = records.filter((r) => {
      const u = r.uuid?.trim().toUpperCase();
      return !u || !dupeUuids.has(u);
    });
    setPhase("saving");
    try {
      await onConfirm(toImport);
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("preview");
    }
  }

  const newCount = records.length - dupeUuids.size;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-xl mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Carga masiva con IA</h2>
              <p className="text-xs text-slate-500">
                {isCxc ? "Cuentas por Cobrar" : "Cuentas por Pagar"} · importa desde Excel automáticamente
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* DONE */}
          {phase === "done" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{newCount} registros importados</h3>
                {dupeUuids.size > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{dupeUuids.size} duplicado{dupeUuids.size !== 1 ? "s" : ""} omitido{dupeUuids.size !== 1 ? "s" : ""}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">La carga masiva finalizó correctamente</p>
              </div>
            </div>
          )}

          {/* SAVING */}
          {phase === "saving" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-violet-700 font-medium">Guardando {records.length} registros…</p>
            </div>
          )}

          {/* UPLOAD */}
          {phase === "upload" && (
            <>
              {/* Template section */}
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-violet-800 uppercase tracking-wide">Template requerido</p>
                  <button
                    type="button"
                    onClick={() => downloadTemplate(kind)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-white border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Descargar template
                  </button>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-700">Columnas en el Excel:</p>
                  <div className="grid grid-cols-3 gap-1">
                    {cols.map((col) => (
                      <span key={col} className="font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-700 truncate">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 pt-0.5">La fila 1 debe ser el encabezado. El orden de columnas no importa.</p>
                </div>
              </div>

              {/* Drop zone */}
              <label className={`flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${file ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40"}`}>
                <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(""); } }} />
                {file ? (
                  <div className="text-center">
                    <FileCheck className="w-7 h-7 text-violet-500 mx-auto mb-1.5" />
                    <p className="text-sm font-medium text-violet-700">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-sm font-medium text-slate-600">Arrastra tu archivo aquí o haz clic</p>
                    <p className="text-xs text-slate-400 mt-0.5">.xlsx · .xls · .csv</p>
                  </div>
                )}
              </label>

              {processing && (
                <div className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-sm text-violet-700 font-medium">Leyendo archivo…</p>
                </div>
              )}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}

          {/* PREVIEW */}
          {phase === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-violet-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-800">{records.length} registros detectados</p>
                  <p className="text-xs text-violet-600">
                    {dupeUuids.size > 0
                      ? `${newCount} nuevos · ${dupeUuids.size} duplicado${dupeUuids.size !== 1 ? "s" : ""} (se omitirán)`
                      : "Sin duplicados · listos para importar"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-56">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {[isCxc ? "Nombre Receptor" : "Nombre Emisor", "RFC", "Folio", "Fecha", "SubTotal", "IVA", "Total", "SAT", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((r, i) => {
                        const isDupe = !!r.uuid?.trim() && dupeUuids.has(r.uuid.trim().toUpperCase());
                        return (
                          <tr key={i} className={isDupe ? "bg-amber-50/60 opacity-60" : "hover:bg-slate-50"}>
                            <td className="px-3 py-1.5 text-slate-700 max-w-[140px] truncate">{r.contraparte || "—"}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{r.rfc || "—"}</td>
                            <td className="px-3 py-1.5 text-slate-600">{r.folio || "—"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.fecha || "—"}</td>
                            <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{currency(r.subtotal)}</td>
                            <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{currency(r.iva)}</td>
                            <td className="px-3 py-1.5 tabular-nums font-semibold whitespace-nowrap">{currency(r.total)}</td>
                            <td className="px-3 py-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.estadoSAT === "Vigente" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                {r.estadoSAT}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              {isDupe && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Duplicado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          {phase === "done" ? (
            <button onClick={handleClose} className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
              Cerrar
            </button>
          ) : phase === "preview" ? (
            <>
              <button onClick={reset} className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                Cambiar archivo
              </button>
              <button
                onClick={handleImport}
                disabled={newCount === 0}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)", boxShadow: "0 0 14px rgba(139,92,246,0.35)" }}
              >
                <Sparkles className="w-4 h-4" />
                {newCount === 0 ? "Todo duplicado" : `Importar ${newCount} registro${newCount !== 1 ? "s" : ""}`}
              </button>
            </>
          ) : phase === "upload" ? (
            <>
              <button onClick={handleClose} className="px-5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button
                disabled={!file || processing}
                onClick={handleAnalyze}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: "linear-gradient(to right, #7c3aed, #4f46e5)", boxShadow: "0 0 14px rgba(139,92,246,0.35)" }}
              >
                <Sparkles className="w-4 h-4" />
                Analizar con IA
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
