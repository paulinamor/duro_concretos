"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Download, Loader2, Upload, X } from "lucide-react";
import { upsertDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag, getStoredSession } from "@/lib/auth";

// ─── Template columns ─────────────────────────────────────────────────────────

const TEMPLATE_COLS = [
  "DÍA",           // YYYY-MM-DD  (requerido)
  "HORA EN OBRA",  // HH:MM
  "CLIENTE",       // (requerido)
  "TELÉFONO",
  "DIRECCIÓN",
  "NOMBRE OBRA",
  "PARA USO",
  "M3 TOTALES",    // número (requerido)
  "RESISTENCIA",   // ej. 200, 250, 300
  "T/D BOM",       // T / D / BOM
  "EXTRAS",
  "PRECIO M3",     // número
  "$ M3 BOMBA",    // número
  "VENDEDOR",
  "CHOFER 1",      // nombre del chofer
  "CR 1",          // unidad/revolvedora
  "NOTAS",
];

const EXAMPLE_ROW = [
  "2026-10-21",
  "08:00",
  "Constructora Ejemplo S.A.",
  "81 1234 5678",
  "Av. Constitución 100, Monterrey",
  "Casa Habitación Lote 5",
  "Cimentación",
  "12",
  "250",
  "T",
  "",
  "1950",
  "",
  "Juan Pérez",
  "Carlos García",
  "CR-01",
  "Traer bomba adicional",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChoferEntry {
  id: string;
  chofer: string;
  cr: string;
  horaSalida: string;
  remision: string;
  numSello: string;
  horaLlegadaObra: string;
  horaInicioDescarga: string;
  horaFinalDescarga: string;
  horaSalidaObra: string;
  tiempoDescarga: string;
  m3: number | null;
}

interface ProgDoc {
  id: string;
  dia: string;
  vendedor: string;
  diaHoraPedido: string;
  muestras: string;
  cliente: string;
  telefono: string;
  direccion: string;
  paraUso: string;
  hora: string;
  hsr: string;
  choferes: ChoferEntry[];
  tiempoExtraDescarga: string;
  m3Totales: number | null;
  extras: string;
  tdBom: string;
  resistencia: string;
  color: string;
  m3Vacios: number | null;
  precioM3Vacio: number | null;
  precioM3: number | null;
  precioM3Bomba: number | null;
  factorBomba: number | null;
  aplicarFactorBomba: boolean;
  ltoAcelr: number | null;
  kiloFibra: number | null;
  m3Imper: number | null;
  aditivo: string;
  tuberiaExtra: number | null;
  permisosOC: number | null;
  totalXM3: number | null;
  total: number | null;
  recibo: string;
  recibos: string[];
  recibosMontos: Record<string, number>;
  credito: string;
  fact: string;
  pagado: string;
  montoPagado: number | null;
  metodoPago: string;
  fechaPago: string;
  notas: string;
  notasVendedor: string;
  nombreObra?: string;
  historial: Array<{ fase: string; fecha: string; tipo: "creacion"; usuario?: string }>;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  prog?: ProgDoc;
  errors: string[];
  warnings: string[];
  dupKey?: string;
}

interface ExistingProg {
  id?: string;
  dia: string;
  cliente: string;
  hora?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: string | undefined): number | null {
  if (!v) return null;
  const p = parseFloat(v.trim().replace(/,/g, ""));
  return isNaN(p) ? null : p;
}

function calcTotal(precioM3: number | null, m3: number | null, precioM3Bomba: number | null) {
  const txm3 = (precioM3 ?? 0) + (precioM3Bomba ?? 0);
  const total = txm3 * (m3 ?? 0);
  return { totalXM3: txm3 > 0 ? txm3 : null, total: total > 0 ? total : null };
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T12:00:00"));
}

function dupKey(dia: string, cliente: string): string {
  return `${dia}__${cliente.trim().toLowerCase()}`;
}

// ─── Download template ────────────────────────────────────────────────────────

function downloadTemplate() {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  // Data sheet
  const data = [TEMPLATE_COLS, EXAMPLE_ROW];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws["!cols"] = TEMPLATE_COLS.map((c) => ({
    wch: c === "DIRECCIÓN" || c === "NOMBRE OBRA" ? 30 : c === "CLIENTE" ? 28 : 16,
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Programaciones");

  // Instructions sheet
  const instrData = [
    ["INSTRUCCIONES DE LLENADO"],
    [""],
    ["COLUMNA", "TIPO", "REQUERIDO", "DESCRIPCIÓN / EJEMPLO"],
    ["DÍA", "Texto", "SÍ", "Fecha en formato YYYY-MM-DD. Ej: 2026-10-21"],
    ["HORA EN OBRA", "Texto", "No", "Hora de llegada a obra. Formato HH:MM. Ej: 08:00"],
    ["CLIENTE", "Texto", "SÍ", "Nombre del cliente tal como está registrado"],
    ["TELÉFONO", "Texto", "No", "Teléfono de contacto"],
    ["DIRECCIÓN", "Texto", "No", "Dirección completa de la obra"],
    ["NOMBRE OBRA", "Texto", "No", "Nombre corto de la obra / proyecto"],
    ["PARA USO", "Texto", "No", "Tipo de elemento: Cimentación, Losa, Columnas…"],
    ["M3 TOTALES", "Número", "SÍ", "Metros cúbicos solicitados. Ej: 12"],
    ["RESISTENCIA", "Texto", "No", "Resistencia del concreto: 200, 250, 300, 350…"],
    ["T/D BOM", "Texto", "No", "T = Tiro, D = Directo, BOM = Bomba"],
    ["EXTRAS", "Texto", "No", "Descripción de extras o aditivos"],
    ["PRECIO M3", "Número", "No", "Precio por metro cúbico. Ej: 1950"],
    ["$ M3 BOMBA", "Número", "No", "Cargo adicional por bomba. Ej: 350"],
    ["VENDEDOR", "Texto", "No", "Nombre del vendedor que tomó el pedido"],
    ["CHOFER 1", "Texto", "No", "Nombre del operador / chofer asignado"],
    ["CR 1", "Texto", "No", "Número de unidad (revolvedora). Ej: CR-01"],
    ["NOTAS", "Texto", "No", "Observaciones internas"],
    [""],
    ["NOTAS IMPORTANTES:"],
    ["• No elimines ni modifiques los encabezados de la primera fila"],
    ["• Una fila = una programación. Para varias cargas del mismo cliente en la misma fecha, agrega una fila por carga"],
    ["• El sistema detectará posibles duplicados (mismo día + cliente) y te avisará antes de importar"],
    ["• Puedes dejar columnas en blanco; solo DÍA, CLIENTE y M3 TOTALES son obligatorios"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  XLSX.writeFile(wb, "plantilla_carga_masiva.xlsx");
}

// ─── Parse uploaded file ──────────────────────────────────────────────────────

function parseFile(buffer: ArrayBuffer, existing: ExistingProg[]): ParsedRow[] {
  const XLSX = require("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames.find((n: string) => n.toLowerCase() !== "instrucciones") ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (raw.length < 2) return [];

  // Normalize headers
  const headers: string[] = (raw[0] as string[]).map((h) =>
    String(h).trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  );

  const col = (row: string[], name: string): string => {
    const normalizedName = name.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const idx = headers.indexOf(normalizedName);
    return idx >= 0 ? String(row[idx] ?? "").trim() : "";
  };

  const existingKeys = new Set(existing.map((p) => dupKey(p.dia, p.cliente)));
  const seenInBatch = new Set<string>();

  const results: ParsedRow[] = [];
  const ts = Date.now();

  for (let i = 1; i < raw.length; i++) {
    const row = (raw[i] as string[]).map((c) => String(c ?? "").trim());
    // Skip completely empty rows
    if (row.every((c) => !c)) continue;

    const rawMap: Record<string, string> = {};
    headers.forEach((h, idx) => { rawMap[h] = row[idx] ?? ""; });

    const errors: string[] = [];
    const warnings: string[] = [];

    const dia = col(row, "DÍA") || col(row, "DIA");
    const cliente = col(row, "CLIENTE");
    const m3Str = col(row, "M3 TOTALES");

    if (!dia) errors.push("DÍA es requerido");
    else if (!isValidDate(dia)) errors.push(`DÍA inválido: "${dia}" — debe ser YYYY-MM-DD`);

    if (!cliente) errors.push("CLIENTE es requerido");

    if (!m3Str) errors.push("M3 TOTALES es requerido");
    else if (n(m3Str) == null || (n(m3Str) ?? 0) <= 0) errors.push(`M3 TOTALES inválido: "${m3Str}"`);

    const hora = col(row, "HORA EN OBRA");
    if (hora && !/^\d{1,2}:\d{2}$/.test(hora)) warnings.push(`HORA EN OBRA "${hora}" no tiene formato HH:MM`);

    const precioM3 = n(col(row, "PRECIO M3"));
    if (!precioM3) warnings.push("Sin PRECIO M3 — el total quedará en $0");

    const precioM3Bomba = n(col(row, "$ M3 BOMBA"));
    const m3 = n(m3Str);

    let dupKeyStr: string | undefined;
    if (!errors.length && dia && cliente) {
      dupKeyStr = dupKey(dia, cliente);
      if (existingKeys.has(dupKeyStr)) {
        warnings.push("Posible duplicado: ya existe una programación para este cliente en esta fecha");
      } else if (seenInBatch.has(dupKeyStr)) {
        warnings.push("Posible duplicado: ya aparece esta combinación día+cliente en este archivo");
      }
      seenInBatch.add(dupKeyStr);
    }

    if (errors.length > 0) {
      results.push({ index: i, raw: rawMap, errors, warnings, dupKey: dupKeyStr });
      continue;
    }

    const id = `prog-${ts}-${i}`;
    const choferNombre = col(row, "CHOFER 1");
    const crNombre = col(row, "CR 1");
    const choferes: ChoferEntry[] = [{
      id: `c-${ts}-${i}`,
      chofer: choferNombre,
      cr: crNombre,
      horaSalida: "", remision: "", numSello: "",
      horaLlegadaObra: "", horaInicioDescarga: "",
      horaFinalDescarga: "", horaSalidaObra: "",
      tiempoDescarga: "", m3: null,
    }];

    const { totalXM3, total } = calcTotal(precioM3, m3, precioM3Bomba);
    const vendedor = col(row, "VENDEDOR");
    const session = getStoredSession();

    const prog: ProgDoc = {
      id,
      dia: dia!,
      vendedor,
      diaHoraPedido: new Date().toISOString().slice(0, 16),
      muestras: "",
      cliente: cliente!,
      telefono: col(row, "TELEFONO") || col(row, "TELÉFONO"),
      direccion: col(row, "DIRECCION") || col(row, "DIRECCIÓN"),
      paraUso: col(row, "PARA USO"),
      hora: hora || "",
      hsr: "",
      choferes,
      tiempoExtraDescarga: "",
      m3Totales: m3,
      extras: col(row, "EXTRAS"),
      tdBom: col(row, "T/D BOM"),
      resistencia: col(row, "RESISTENCIA"),
      color: "",
      m3Vacios: null, precioM3Vacio: null,
      precioM3,
      precioM3Bomba,
      factorBomba: null, aplicarFactorBomba: false,
      ltoAcelr: null, kiloFibra: null, m3Imper: null, aditivo: "",
      tuberiaExtra: null, permisosOC: null,
      totalXM3, total,
      recibo: "", recibos: [], recibosMontos: {},
      credito: "", fact: "", pagado: "",
      montoPagado: null, metodoPago: "", fechaPago: "",
      notas: col(row, "NOTAS"),
      notasVendedor: "",
      ...(col(row, "NOMBRE OBRA") ? { nombreObra: col(row, "NOMBRE OBRA") } : {}),
      historial: [{
        fase: "", fecha: new Date().toISOString(), tipo: "creacion",
        usuario: session?.name ?? session?.email ?? "Carga masiva",
      }],
    };

    results.push({ index: i, raw: rawMap, prog, errors: [], warnings, dupKey: dupKeyStr });
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  existingProgs: ExistingProg[];
  onImported: (count: number) => void;
}

type Step = "upload" | "preview" | "done";

export default function CargaMasivaModal({ open, onClose, existingProgs, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [parseError, setParseError] = useState("");
  const [skipDups, setSkipDups] = useState(true);

  const reset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setImporting(false);
    setImportedCount(0);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback((file: File) => {
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target!.result as ArrayBuffer;
        const parsed = parseFile(buffer, existingProgs);
        if (parsed.length === 0) {
          setParseError("No se encontraron filas de datos en el archivo. Verifica que uses la plantilla correcta.");
          return;
        }
        setRows(parsed);
        setStep("preview");
      } catch {
        setParseError("Error al leer el archivo. Asegúrate de usar el formato Excel (.xlsx) o CSV.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [existingProgs]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const validRows = rows.filter((r) => r.errors.length === 0 && (!skipDups || !r.warnings.some((w) => w.includes("duplicado"))));
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const dupRows = rows.filter((r) => r.errors.length === 0 && r.warnings.some((w) => w.includes("duplicado")));
  const warnRows = rows.filter((r) => r.errors.length === 0 && r.warnings.some((w) => !w.includes("duplicado")));
  const toImport = skipDups
    ? rows.filter((r) => r.errors.length === 0 && !r.warnings.some((w) => w.includes("duplicado")))
    : rows.filter((r) => r.errors.length === 0);

  async function handleImport() {
    if (!toImport.length) return;
    setImporting(true);
    let count = 0;
    try {
      for (const row of toImport) {
        const prog = row.prog!;
        const { id, ...rest } = prog;
        await upsertDocument(COLLECTIONS.programaciones, id, withPlantaTag(rest));
        count++;
      }
      setImportedCount(count);
      setStep("done");
      onImported(count);
    } catch (err) {
      setParseError(`Error al importar: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Carga masiva de programaciones</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "upload" && "Descarga la plantilla, llénala y súbela para importar múltiples registros"}
              {step === "preview" && `${rows.length} fila${rows.length !== 1 ? "s" : ""} encontrada${rows.length !== 1 ? "s" : ""} — revisa antes de importar`}
              {step === "done" && `Importación completada`}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <div className="p-6 space-y-6">
              {/* Download template */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Download size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Paso 1 — Descarga la plantilla</p>
                  <p className="text-xs text-gray-500 mt-1">Incluye los campos necesarios y una fila de ejemplo. Lee la hoja "Instrucciones" antes de llenarla.</p>
                  <button
                    onClick={downloadTemplate}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    Descargar plantilla (.xlsx)
                  </button>
                </div>
              </div>

              {/* Upload area */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Paso 2 — Sube el archivo llenado</p>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-[#CC2229]/60 hover:bg-red-50/30 transition-colors"
                >
                  <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Upload size={22} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Arrastra o haz clic para seleccionar</p>
                    <p className="text-xs text-gray-400 mt-1">Formatos aceptados: .xlsx, .xls, .csv</p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {parseError && (
                  <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    {parseError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === "preview" && (
            <div className="p-6 space-y-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                {toImport.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <CheckCircle size={12} /> {toImport.length} listas para importar
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                    <AlertTriangle size={12} /> {errorRows.length} con errores
                  </span>
                )}
                {dupRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                    <AlertTriangle size={12} /> {dupRows.length} posibles duplicados
                  </span>
                )}
                {warnRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-600">
                    {warnRows.length} con advertencias
                  </span>
                )}
              </div>

              {/* Dup toggle */}
              {dupRows.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDups}
                      onChange={(e) => setSkipDups(e.target.checked)}
                      className="h-4 w-4 accent-amber-600"
                    />
                    <span className="text-xs font-semibold text-amber-800">
                      Omitir los {dupRows.length} posibles duplicados (recomendado)
                    </span>
                  </label>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-8">#</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Estado</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Día</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Cliente</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Hora</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">M³</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Resist.</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Precio M³</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Total</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const hasErrors = row.errors.length > 0;
                      const isDup = !hasErrors && row.warnings.some((w) => w.includes("duplicado"));
                      const hasWarn = !hasErrors && row.warnings.some((w) => !w.includes("duplicado"));
                      const isSkipped = isDup && skipDups;

                      const bgClass = hasErrors
                        ? "bg-red-50"
                        : isSkipped
                        ? "bg-amber-50/60"
                        : isDup
                        ? "bg-amber-50"
                        : "bg-white";

                      const statusBadge = hasErrors ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-[10px]">
                          <AlertTriangle size={9} /> Error
                        </span>
                      ) : isSkipped ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold text-[10px]">
                          Omitir
                        </span>
                      ) : isDup ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold text-[10px]">
                          <AlertTriangle size={9} /> Dup.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                          <CheckCircle size={9} /> OK
                        </span>
                      );

                      const prog = row.prog;
                      const total = prog?.total;
                      const issues = [...row.errors, ...row.warnings];

                      return (
                        <tr key={row.index} className={`${bgClass} border-b border-gray-100 last:border-0`}>
                          <td className="px-3 py-2 text-gray-400">{row.index}</td>
                          <td className="px-3 py-2">{statusBadge}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {prog?.dia || row.raw["DÍA"] || row.raw["DIA"] || "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate" title={prog?.cliente || row.raw["CLIENTE"]}>
                            {prog?.cliente || row.raw["CLIENTE"] || "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{prog?.hora || row.raw["HORA EN OBRA"] || "—"}</td>
                          <td className="px-3 py-2 text-gray-800">{prog?.m3Totales != null ? prog.m3Totales : (row.raw["M3 TOTALES"] || "—")}</td>
                          <td className="px-3 py-2 text-gray-600">{prog?.resistencia || row.raw["RESISTENCIA"] || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {prog?.precioM3 ? `$${prog.precioM3.toLocaleString("es-MX")}` : "—"}
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-900">
                            {total ? `$${total.toLocaleString("es-MX")}` : "—"}
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {issues.length > 0 ? (
                              <ul className="space-y-0.5">
                                {issues.map((msg, i) => (
                                  <li key={i} className={`text-[10px] ${row.errors.includes(msg) ? "text-red-600" : "text-amber-600"}`}>
                                    {msg}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              <button
                onClick={reset}
                className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
              >
                ← Cargar otro archivo
              </button>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{importedCount} programación{importedCount !== 1 ? "es" : ""} importada{importedCount !== 1 ? "s" : ""}</p>
                <p className="text-sm text-gray-500 mt-1">Los registros ya están disponibles en la vista de programación</p>
              </div>
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: "#CC2229" }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && toImport.length > 0 && (
          <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4 bg-gray-50">
            <div className="text-xs text-gray-500">
              Se importarán <strong className="text-gray-900">{toImport.length}</strong> de {rows.length} filas
              {skipDups && dupRows.length > 0 && ` · ${dupRows.length} duplicado${dupRows.length !== 1 ? "s" : ""} omitido${dupRows.length !== 1 ? "s" : ""}`}
              {errorRows.length > 0 && ` · ${errorRows.length} con error${errorRows.length !== 1 ? "es" : ""} omitido${errorRows.length !== 1 ? "s" : ""}`}
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: "#CC2229" }}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Importando…" : `Importar ${toImport.length} programación${toImport.length !== 1 ? "es" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
