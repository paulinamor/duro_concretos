"use client";
import { useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Mirrors the fixed parseDate from CargaMasivaModal
function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // ISO format — but check for swapped month/day (e.g. "2026-31-07" from wrong prior migration)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    if (parseInt(m) > 12) return `${y}-${d}-${m}`; // swap: month was stored as day
    return s;
  }
  if (/^\d{5}$/.test(s)) {
    const d = new Date((Number(s) - 25569) * 86400000);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  const mDMY = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (mDMY) {
    const [, a, b, y] = mDMY;
    if (parseInt(a) > 12) return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    if (parseInt(b) > 12) return `${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
    return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  // 2-digit year: XLSX.js outputs M/D/YY (US, month first).
  // Excel "31/07/26" → XLSX "7/31/26" → month=7, day=31 → 2026-07-31.
  const mMDY2 = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (mMDY2) {
    const [, m, d, yy] = mMDY2;
    const fullYear = parseInt(yy) < 50 ? 2000 + parseInt(yy) : 1900 + parseInt(yy);
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function isBadDate(fecha: string): boolean {
  if (!fecha) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return true;
  // Also catch ISO-shaped but invalid dates where month > 12 (day/month swapped)
  const mm = parseInt(fecha.slice(5, 7), 10);
  return mm < 1 || mm > 12;
}

type BadRecord = { id: string; coleccion: string; fechaActual: string; fechaCorregida: string };

export default function MigrarFechasPage() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [bad, setBad] = useState<BadRecord[]>([]);
  const [done, setDone] = useState(false);
  const [reverted, setReverted] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function scan() {
    setScanning(true);
    setDone(false);
    setBad([]);
    setLog([]);
    if (!db) { setScanning(false); return; }
    const colecciones = ["cuentasPorPagar"];
    const found: BadRecord[] = [];
    for (const col of colecciones) {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const data = d.data() as { fecha?: string };
        const fecha = data.fecha ?? "";
        if (isBadDate(fecha)) {
          const corregida = parseDate(fecha);
          found.push({ id: d.id, coleccion: col, fechaActual: fecha, fechaCorregida: corregida });
        }
      }
    }
    setBad(found);
    setScanning(false);
  }

  async function fix() {
    setFixing(true);
    const lines: string[] = [];
    if (!db) { lines.push("Error: Firestore no disponible"); setLog(lines); setFixing(false); return; }
    for (const r of bad) {
      if (!r.fechaCorregida || r.fechaCorregida === r.fechaActual) {
        lines.push(`OMITIDO ${r.coleccion}/${r.id} — no se pudo corregir (${r.fechaActual})`);
        continue;
      }
      await updateDoc(doc(db, r.coleccion, r.id), { fecha: r.fechaCorregida });
      lines.push(`OK ${r.coleccion}/${r.id}: "${r.fechaActual}" → "${r.fechaCorregida}"`);
    }
    setLog(lines);
    setFixing(false);
    setDone(true);
  }

  async function revert() {
    setReverting(true);
    const lines: string[] = [];
    if (!db) { lines.push("Error: Firestore no disponible"); setLog(lines); setReverting(false); return; }
    for (const r of bad) {
      if (!r.fechaCorregida || r.fechaCorregida === r.fechaActual) continue;
      await updateDoc(doc(db, r.coleccion, r.id), { fecha: r.fechaActual });
      lines.push(`REVERTIDO ${r.coleccion}/${r.id}: "${r.fechaCorregida}" → "${r.fechaActual}"`);
    }
    setLog(lines);
    setReverting(false);
    setDone(false);
    setReverted(true);
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Migración de fechas malformadas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Corrige registros en CxC / CxP cuya fecha no está en formato ISO (YYYY-MM-DD).
          Causado por carga masiva con año de 2 dígitos (ej. 09/07/26).
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={scan}
          disabled={scanning || fixing}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded disabled:opacity-50"
        >
          {scanning ? "Escaneando…" : "1. Escanear"}
        </button>
        {bad.length > 0 && !done && (
          <button
            onClick={fix}
            disabled={fixing}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded disabled:opacity-50"
          >
            {fixing ? "Corrigiendo…" : `2. Corregir ${bad.length} registro(s)`}
          </button>
        )}
      </div>

      {bad.length > 0 && !done && (
        <div className="border rounded overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Colección</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Fecha actual</th>
                <th className="px-3 py-2 text-left">Fecha corregida</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bad.map((r) => (
                <tr key={r.id} className={!r.fechaCorregida || r.fechaCorregida === r.fechaActual ? "bg-red-50" : ""}>
                  <td className="px-3 py-1.5 text-gray-500">{r.coleccion}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.id.slice(0, 12)}…</td>
                  <td className="px-3 py-1.5 text-red-600">{r.fechaActual}</td>
                  <td className="px-3 py-1.5 text-green-700">{r.fechaCorregida || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bad.length === 0 && !scanning && !done && (
        <p className="text-sm text-gray-400">Presiona "Escanear" para buscar fechas malformadas.</p>
      )}

      {done && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-green-700">Migración completada.</p>
            {bad.length > 0 && (
              <button
                onClick={revert}
                disabled={reverting}
                className="px-3 py-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {reverting ? "Revirtiendo…" : "↩ Revertir"}
              </button>
            )}
          </div>
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {log.join("\n")}
          </pre>
        </div>
      )}

      {reverted && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-orange-600">Reversión completada — fechas restauradas al valor original.</p>
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap">
            {log.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
