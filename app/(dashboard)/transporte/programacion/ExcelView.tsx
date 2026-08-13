"use client";

import { Fragment, useMemo } from "react";
import HScrollTable from "@/components/HScrollTable";

// ─── Types (mirror from page.tsx) ─────────────────────────────────────────────

export interface ChoferRow {
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

export interface ExcelProg {
  id?: string;
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
  choferes: ChoferRow[];
  tiempoExtraDescarga: string;
  m3Totales: number | null;
  extras: string;
  tdBom: string;
  resistencia: string;
  color: string;
  m3Vacios: number | null;
  precioM3: number | null;
  precioM3Bomba: number | null;
  ltoAcelr: number | null;
  kiloFibra: number | null;
  m3Imper: number | null;
  tuberiaExtra: number | null;
  permisosOC: number | null;
  totalXM3: number | null;
  total: number | null;
  recibo: string;
  fact: string;
  pagado: string;
  montoPagado: number | null;
  metodoPago: string;
  fechaPago: string;
  notas?: string;
  cxcId?: string;
  planta?: string;
  rowColor?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDiaLong(iso: string): string {
  return new Date(iso + "T12:00:00")
    .toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

function diaSemana(iso: string): string {
  return new Date(iso + "T12:00:00")
    .toLocaleDateString("es-MX", { weekday: "long" })
    .toUpperCase();
}

function shortDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

function moneyFmt(v: number | null | undefined): string {
  if (v == null) return "";
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcDescarga(inicio: string, fin: string): string {
  if (!inicio || !fin) return "";
  const [ih, im] = inicio.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);
  if (isNaN(ih) || isNaN(fh)) return "";
  const diff = fh * 60 + fm - (ih * 60 + im);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60),
    mn = diff % 60;
  return h > 0 ? `${h}:${String(mn).padStart(2, "0")}` : `0:${String(mn).padStart(2, "0")}`;
}

// ─── Status dots per chofer ───────────────────────────────────────────────────

const STAGE_LABELS = ["Sal.P", "Llg", "Ini", "Fin", "S.O"];
function ChoferStatus({ c }: { c: ChoferRow }) {
  const vals = [c.horaSalida, c.horaLlegadaObra, c.horaInicioDescarga, c.horaFinalDescarga, c.horaSalidaObra];
  const done = vals.filter(Boolean).length;
  return (
    <div className="flex items-center gap-[3px]" title={`${done}/5 etapas completas`}>
      {vals.map((v, i) => (
        <div
          key={i}
          title={STAGE_LABELS[i]}
          className={`w-[7px] h-[7px] rounded-sm ${v ? "bg-emerald-500" : "bg-red-500/40"}`}
        />
      ))}
    </div>
  );
}

// ─── Column widths (px) in render order ───────────────────────────────────────

const W = [
  180, // DÍA (sticky)
  90,  // VENDEDOR
  100, // DÍA PEDIDO
  78,  // H.PEDIDO
  65,  // MUEST.
  72,  // H.OBRA
  112, // CHOFER
  46,  // PROG. (status dots)
  50,  // CR
  65,  // H/SAL
  82,  // REMISIÓN
  72,  // #SELLO
  78,  // LLEGADA
  85,  // INICIO DSC
  82,  // FINAL DSC
  80,  // SAL.OBRA
  68,  // T.DESC
  58,  // HSR
  78,  // RECIBO
  65,  // FACT.
  170, // CLIENTE
  105, // TELÉFONO
  68,  // M3 TOT.
  50,  // M3
  110, // EXTRAS
  80,  // T/D BOM
  76,  // RESIS.
  100, // PARA USO
  170, // DIRECCIÓN
  88,  // PRECIO M3
  88,  // $/M3 BOM.
  65,  // COLOR
  90,  // T.EXT.DESC
  68,  // M3 VAC.
  90,  // $/LTO ACEL
  88,  // $/KG FIBRA
  88,  // $/M3 IMPER
  85,  // TUB.EXTRA
  92,  // PERMISOS O/C
  92,  // TOT X M3
  108, // TOTAL
  72,  // PAGADO
  95,  // MÉT.PAGO
  82,  // F.PAGO
];

const HEADERS: { label: string; color: string }[] = [
  { label: "VENDEDOR",      color: "text-amber-500/70" },
  { label: "DÍA PEDIDO",   color: "text-amber-500/70" },
  { label: "H. PEDIDO",    color: "text-amber-500/70" },
  { label: "MUEST.",       color: "text-blue-400/70" },
  { label: "H. OBRA",      color: "text-blue-400/70" },
  { label: "CHOFER",       color: "text-blue-400/70" },
  { label: "PROG.",        color: "text-gray-600" },
  { label: "CR",           color: "text-blue-400/70" },
  { label: "H/SAL",        color: "text-blue-400/70" },
  { label: "REMISIÓN",     color: "text-blue-400/70" },
  { label: "#SELLO",       color: "text-blue-400/70" },
  { label: "LLEGADA",      color: "text-blue-400/70" },
  { label: "INICIO DSC",   color: "text-blue-400/70" },
  { label: "FINAL DSC",    color: "text-blue-400/70" },
  { label: "SAL. OBRA",    color: "text-blue-400/70" },
  { label: "T.DESC",       color: "text-gray-500" },
  { label: "HSR",          color: "text-blue-400/70" },
  { label: "RECIBO",       color: "text-amber-500/70" },
  { label: "FACT.",        color: "text-amber-500/70" },
  { label: "CLIENTE",      color: "text-amber-500/70" },
  { label: "TELÉFONO",     color: "text-amber-500/70" },
  { label: "M3 TOT.",      color: "text-emerald-500/70" },
  { label: "M3",           color: "text-emerald-400/70" },
  { label: "EXTRAS",       color: "text-amber-500/70" },
  { label: "T/D BOM",      color: "text-amber-500/70" },
  { label: "RESIS.",       color: "text-amber-500/70" },
  { label: "PARA USO",     color: "text-amber-500/70" },
  { label: "DIRECCIÓN",    color: "text-amber-500/70" },
  { label: "PRECIO M3",    color: "text-amber-500/70" },
  { label: "$/M3 BOM.",    color: "text-amber-500/70" },
  { label: "COLOR",        color: "text-amber-500/70" },
  { label: "T.EXT.DESC.",  color: "text-blue-400/70" },
  { label: "M3 VAC.",      color: "text-blue-400/70" },
  { label: "$/LTO ACEL.",  color: "text-amber-500/70" },
  { label: "$/KG FIBRA",   color: "text-amber-500/70" },
  { label: "$/M3 IMPER.",  color: "text-amber-500/70" },
  { label: "TUB.EXTRA",    color: "text-amber-500/70" },
  { label: "PERMISOS O/C", color: "text-amber-500/70" },
  { label: "TOT X M3",     color: "text-gray-400" },
  { label: "TOTAL",        color: "text-gray-300" },
  { label: "PAGADO",       color: "text-amber-500/70" },
  { label: "MÉT. PAGO",    color: "text-amber-500/70" },
  { label: "F. PAGO",      color: "text-amber-500/70" },
];

const NCOLS = W.length; // 44

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExcelView({
  rows: programaciones,
  onEdit,
  fullscreen = false,
}: {
  rows: ExcelProg[];
  onEdit: (p: ExcelProg) => void;
  fullscreen?: boolean;
}) {
  // Group programaciones by date
  const groups = useMemo(() => {
    const map = new Map<string, ExcelProg[]>();
    for (const p of programaciones) {
      const k = p.dia || "sin-fecha";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [programaciones]);

  if (programaciones.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
        Sin registros en este período.
      </div>
    );
  }

  const th = "px-2 py-2 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap text-left bg-[#1A1A1A] border-b border-[#3A3A3A]";
  const td = "px-2 py-[5px] text-[11px] whitespace-nowrap border-b border-[#3A3A3A]";

  return (
    <HScrollTable className={fullscreen ? "h-full" : "max-h-[calc(100vh-270px)]"}>
      <table className="border-collapse" style={{ minWidth: `${W.reduce((a, b) => a + b, 0)}px` }}>
        <colgroup>
          {W.map((w, i) => (
            <col key={i} style={{ width: `${w}px`, minWidth: `${w}px` }} />
          ))}
        </colgroup>

        {/* ── Header ── */}
        <thead className="sticky top-0 z-20">
          <tr>
            {/* DÍA sticky */}
            <th className={`${th} sticky left-0 z-30 bg-[#1A1A1A] text-gray-500 border-r border-[#3A3A3A]`}>
              DÍA
            </th>
            {HEADERS.map(({ label, color }, i) => (
              i === 0
                ? <th key={label} className={`${th} ${color} sticky left-[180px] z-30 bg-[#1A1A1A] border-r border-[#3A3A3A]`}>{label}</th>
                : <th key={label} className={`${th} ${color}`}>{label}</th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {groups.map(([date, progs]) => (
            <Fragment key={date}>
              {/* Day header */}
              <tr className="bg-[#2A2A2A]">
                <td
                  colSpan={NCOLS}
                  className="sticky left-0 z-10 bg-[#2A2A2A] px-5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#CC2229] border-y border-[#3A3A3A]"
                >
                  {diaSemana(date)}&nbsp;&nbsp;·&nbsp;&nbsp;{formatDiaLong(date)}
                </td>
              </tr>

              {progs.flatMap((prog) => {
                const choferes = prog.choferes?.filter((c) => c.chofer) ?? [];
                const entries: (ChoferRow | null)[] =
                  choferes.length > 0 ? choferes : [null];

                const isPaid = prog.pagado === "Sí";
                const isPartial = prog.pagado === "Parcial";
                const borderL = isPaid
                  ? "border-l-2 border-l-emerald-500"
                  : isPartial
                  ? "border-l-2 border-l-amber-500"
                  : "";

                // Parse diaHoraPedido → date + time parts
                const dhp = prog.diaHoraPedido;
                const isNA = dhp === "N/A";
                const diaPedidoDisplay = isNA
                  ? "N/A"
                  : dhp
                  ? shortDate(dhp.split("T")[0])
                  : "";
                const horaPedidoDisplay = isNA
                  ? ""
                  : dhp
                  ? (dhp.split("T")[1] || "").slice(0, 5)
                  : "";

                const choferRows = entries.map((chofer, rowIdx) => {
                  const isFirst = rowIdx === 0;
                  const isLast = rowIdx === entries.length - 1;
                  const tDesc =
                    chofer
                      ? calcDescarga(
                          chofer.horaInicioDescarga,
                          chofer.horaFinalDescarga,
                        ) || chofer.tiempoDescarga
                      : "";

                  const rc = prog.rowColor || "";
                  const rowStyle = rc ? { backgroundColor: rc } : {};
                  const tx = rc ? "!text-[#F3F4F6]" : "";

                  return (
                    <tr
                      key={`${prog.id}-${rowIdx}`}
                      style={rowStyle}
                      className={`cursor-pointer ${rc ? "" : "transition-colors hover:bg-[#2A2A2A]"} ${borderL} ${isLast ? "border-b border-[#3A3A3A]" : ""}`}
                      onClick={() => onEdit(prog)}
                    >
                      {/* DÍA — sticky */}
                      <td
                        className={`${td} sticky left-0 z-10 bg-[#242424] border-r border-[#3A3A3A] text-[10px] text-gray-400 font-medium leading-tight ${tx}`}
                        style={rc ? { backgroundColor: rc } : undefined}
                      >
                        {isFirst ? formatDiaLong(prog.dia) : ""}
                      </td>

                      {/* VENDEDOR — sticky col 2 */}
                      <td
                        className={`${td} sticky left-[180px] z-10 bg-[#242424] text-amber-500 border-r border-[#3A3A3A] ${tx}`}
                        style={rc ? { backgroundColor: rc } : undefined}
                      >
                        {isFirst ? prog.vendedor : ""}
                      </td>
                      {/* DÍA PEDIDO */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? diaPedidoDisplay : ""}
                      </td>
                      {/* H.PEDIDO */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? horaPedidoDisplay : ""}
                      </td>
                      {/* MUEST. */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.muestras : ""}
                      </td>
                      {/* H.OBRA */}
                      <td className={`${td} font-mono text-gray-300 ${tx}`}>
                        {isFirst ? prog.hora : ""}
                      </td>

                      {/* CHOFER */}
                      <td className={`${td} text-white font-semibold ${tx}`}>
                        {chofer?.chofer ?? ""}
                      </td>
                      {/* PROG. status dots */}
                      <td className={`${td} ${tx}`}>
                        {chofer ? <ChoferStatus c={chofer} /> : ""}
                      </td>
                      {/* CR */}
                      <td className={`${td} font-mono text-gray-300 text-center ${tx}`}>
                        {chofer?.cr ?? ""}
                      </td>
                      {/* H/SAL */}
                      <td className={`${td} font-mono ${chofer && !chofer.horaSalida ? "text-red-500/50" : "text-gray-300"} ${tx}`}>
                        {chofer?.horaSalida || (chofer ? "—" : "")}
                      </td>
                      {/* REMISIÓN */}
                      <td className={`${td} font-mono text-gray-300 ${tx}`}>
                        {chofer?.remision ?? ""}
                      </td>
                      {/* #SELLO */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {chofer?.numSello ?? ""}
                      </td>
                      {/* LLEGADA */}
                      <td className={`${td} font-mono ${chofer && !chofer.horaLlegadaObra ? "text-red-500/50" : "text-gray-300"} ${tx}`}>
                        {chofer?.horaLlegadaObra || (chofer ? "—" : "")}
                      </td>
                      {/* INICIO DSC */}
                      <td className={`${td} font-mono ${chofer && !chofer.horaInicioDescarga ? "text-red-500/50" : "text-gray-300"} ${tx}`}>
                        {chofer?.horaInicioDescarga || (chofer ? "—" : "")}
                      </td>
                      {/* FINAL DSC */}
                      <td className={`${td} font-mono ${chofer && !chofer.horaFinalDescarga ? "text-red-500/50" : "text-gray-300"} ${tx}`}>
                        {chofer?.horaFinalDescarga || (chofer ? "—" : "")}
                      </td>
                      {/* SAL.OBRA */}
                      <td className={`${td} font-mono ${chofer && !chofer.horaSalidaObra ? "text-red-500/50" : "text-gray-300"} ${tx}`}>
                        {chofer?.horaSalidaObra || (chofer ? "—" : "")}
                      </td>
                      {/* T.DESC (calc) */}
                      <td className={`${td} font-mono text-emerald-400/90 text-center font-semibold ${tx}`}>
                        {tDesc}
                      </td>
                      {/* HSR */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? prog.hsr : ""}
                      </td>

                      {/* RECIBO */}
                      <td className={`${td} text-blue-400 font-semibold ${tx}`}>
                        {isFirst ? prog.recibo : ""}
                      </td>
                      {/* FACT. */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.fact : ""}
                      </td>
                      {/* CLIENTE */}
                      <td
                        className={`${td} text-white font-semibold ${tx}`}
                        style={{ maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {isFirst ? prog.cliente : ""}
                      </td>
                      {/* TELÉFONO */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? prog.telefono : ""}
                      </td>
                      {/* M3 TOT */}
                      <td className={`${td} text-emerald-400 font-bold text-center tabular-nums ${tx}`}>
                        {isFirst && prog.m3Totales != null ? prog.m3Totales : ""}
                      </td>
                      {/* M3 (per chofer) */}
                      <td className={`${td} text-emerald-300 font-semibold text-center tabular-nums ${tx}`}>
                        {chofer?.m3 != null ? chofer.m3 : ""}
                      </td>
                      {/* EXTRAS */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.extras : ""}
                      </td>
                      {/* T/D BOM */}
                      <td className={`${td} text-gray-300 ${tx}`}>
                        {isFirst ? prog.tdBom : ""}
                      </td>
                      {/* RESIS */}
                      <td className={`${td} text-[#CC2229] font-semibold ${tx}`}>
                        {isFirst ? prog.resistencia : ""}
                      </td>
                      {/* PARA USO */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.paraUso : ""}
                      </td>
                      {/* DIRECCIÓN */}
                      <td
                        className={`${td} text-gray-400 ${tx}`}
                        style={{ maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {isFirst ? prog.direccion : ""}
                      </td>
                      {/* PRECIO M3 */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.precioM3) : ""}
                      </td>
                      {/* $/M3 BOM */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.precioM3Bomba) : ""}
                      </td>
                      {/* COLOR */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? prog.color : ""}
                      </td>
                      {/* T.EXT.DESC */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.tiempoExtraDescarga : ""}
                      </td>
                      {/* M3 VAC */}
                      <td className={`${td} text-center tabular-nums text-gray-400 ${tx}`}>
                        {isFirst && prog.m3Vacios != null ? prog.m3Vacios : ""}
                      </td>
                      {/* $/LTO ACEL */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.ltoAcelr) : ""}
                      </td>
                      {/* $/KG FIBRA */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.kiloFibra) : ""}
                      </td>
                      {/* $/M3 IMPER */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.m3Imper) : ""}
                      </td>
                      {/* TUB.EXTRA */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.tuberiaExtra) : ""}
                      </td>
                      {/* PERMISOS O/C */}
                      <td className={`${td} font-mono tabular-nums text-gray-300 ${tx}`}>
                        {isFirst ? moneyFmt(prog.permisosOC) : ""}
                      </td>
                      {/* TOT X M3 */}
                      <td className={`${td} font-mono tabular-nums text-gray-200 font-semibold ${tx}`}>
                        {isFirst ? moneyFmt(prog.totalXM3) : ""}
                      </td>
                      {/* TOTAL */}
                      <td className={`${td} font-mono tabular-nums text-white font-bold text-[12px] ${tx}`}>
                        {isFirst ? moneyFmt(prog.total) : ""}
                      </td>
                      {/* PAGADO */}
                      <td className={`${td}`}>
                        {isFirst && prog.pagado ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              prog.pagado === "Sí"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : prog.pagado === "Parcial"
                                ? "bg-amber-500/15 text-amber-400"
                                : prog.pagado === "No"
                                ? "bg-red-500/15 text-red-400"
                                : "text-gray-600"
                            }`}
                          >
                            {prog.pagado}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                      {/* MÉT.PAGO */}
                      <td className={`${td} text-gray-400 ${tx}`}>
                        {isFirst ? prog.metodoPago : ""}
                      </td>
                      {/* F.PAGO */}
                      <td className={`${td} font-mono text-gray-400 ${tx}`}>
                        {isFirst ? prog.fechaPago : ""}
                      </td>
                    </tr>
                  );
                });

                const notaRow = prog.notas?.trim() ? (
                  <tr key={`${prog.id}-nota`} style={{ borderBottom: "1px solid #3A3A3A" }}>
                    <td
                      colSpan={NCOLS}
                      style={{
                        background: "rgba(251,191,36,0.13)",
                        borderLeft: "5px solid #F59E0B",
                        padding: "8px 20px",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "#F59E0B", color: "#000", fontWeight: 700,
                          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                          borderRadius: 4, padding: "2px 7px", flexShrink: 0,
                        }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          NOTA
                        </span>
                        <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                          {prog.notas}
                        </span>
                      </span>
                    </td>
                  </tr>
                ) : null;

                return notaRow ? [...choferRows, notaRow] : choferRows;
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </HScrollTable>
  );
}
