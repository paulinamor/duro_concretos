"use client";
import { useEffect, useState } from "react";
import { getDocument, getCollectionDocs, COLLECTIONS, where, orderBy, limit } from "@/lib/db";

const FOLIO = 86;
const DOC_ID = `REC-${FOLIO}`;

interface RecoverResult {
  remision: Record<string, unknown> | null;
  programacion: Record<string, unknown> | null;
  auditEntries: Record<string, unknown>[];
  recentDeletes: Record<string, unknown>[];
}

export default function DevRecoverPage() {
  const [result, setResult] = useState<RecoverResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [remision, programacion, auditEntries, recentDeletes] = await Promise.all([
        getDocument<Record<string, unknown>>(COLLECTIONS.remisiones, DOC_ID).catch(() => null),
        getDocument<Record<string, unknown>>(COLLECTIONS.programaciones, `recibo-${DOC_ID}`).catch(() => null),
        getCollectionDocs<Record<string, unknown>>(COLLECTIONS.auditLog, [
          where("documentId", "==", DOC_ID),
          orderBy("timestamp", "desc"),
        ]).catch(() => []),
        getCollectionDocs<Record<string, unknown>>(COLLECTIONS.auditLog, [
          where("action", "==", "delete"),
          orderBy("timestamp", "desc"),
          limit(50),
        ]).catch(() => []),
      ]);
      setResult({ remision, programacion, auditEntries, recentDeletes });
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <p className="text-white text-lg">Buscando recibo #{String(FOLIO).padStart(4, "0")}…</p>
    </div>
  );

  const found = result?.remision || result?.programacion;

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-8 font-mono text-sm">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-white text-xl font-bold">Recuperación — Recibo #{String(FOLIO).padStart(4, "0")}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${found ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
            {found ? "DATOS ENCONTRADOS" : "NO ENCONTRADO"}
          </span>
        </div>

        {/* Remisión */}
        <Section title={`remisiones / ${DOC_ID}`} data={result?.remision} empty="Documento eliminado de Firestore" />

        {/* Programación espejo */}
        <Section title={`programaciones / recibo-${DOC_ID}`} data={result?.programacion} empty="También eliminado" />

        {/* Audit específico */}
        <div className="bg-[#242424] rounded-xl p-5 space-y-3">
          <h2 className="text-white font-bold">auditLog — entradas para {DOC_ID}</h2>
          {result?.auditEntries.length === 0
            ? <p className="text-yellow-400">Sin registros — las eliminaciones de recibos no estaban siendo auditadas.</p>
            : result?.auditEntries.map((e, i) => <EntryRow key={i} e={e} highlight />)
          }
        </div>

        {/* Deletes recientes */}
        <div className="bg-[#242424] rounded-xl p-5 space-y-3">
          <h2 className="text-white font-bold">auditLog — últimas 50 eliminaciones (cualquier módulo)</h2>
          {result?.recentDeletes.length === 0
            ? <p className="text-gray-400">Sin registros de eliminación.</p>
            : result?.recentDeletes.map((e, i) => <EntryRow key={i} e={e} />)
          }
        </div>

        <div className="bg-[#2A1A1A] border border-red-800 rounded-xl p-5 space-y-2">
          <h2 className="text-red-400 font-bold">Siguiente paso si los datos no aparecen arriba</h2>
          <p className="text-gray-300">1. Abre <span className="text-white">console.cloud.google.com</span> → proyecto <span className="text-white">dc-erp-99aea</span></p>
          <p className="text-gray-300">2. Ve a <span className="text-white">Logging → Explorador de registros</span></p>
          <p className="text-gray-300">3. Pega este filtro:</p>
          <pre className="bg-black text-green-400 p-3 rounded text-xs overflow-auto">{`protoPayload.resourceName:"remisiones/REC-86"
OR
protoPayload.resourceName:"recibo-REC-86"`}</pre>
          <p className="text-gray-300">4. Si hay registros de auditoría de GCP, mostrarán el email del usuario que eliminó el documento.</p>
          <p className="text-gray-400 text-xs mt-2">Nota: los audit logs de GCP solo están disponibles si Data Access audit logs están habilitados en IAM & Admin → Audit Logs del proyecto.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, data, empty }: { title: string; data: Record<string, unknown> | null | undefined; empty: string }) {
  return (
    <div className="bg-[#242424] rounded-xl p-5 space-y-2">
      <h2 className="text-white font-bold">{title}</h2>
      {data
        ? <pre className="text-green-300 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        : <p className="text-red-400">{empty}</p>
      }
    </div>
  );
}

function EntryRow({ e, highlight }: { e: Record<string, unknown>; highlight?: boolean }) {
  return (
    <div className={`rounded p-3 text-xs space-y-1 ${highlight ? "bg-[#3A1A1A]" : "bg-[#1A1A1A]"}`}>
      <div className="flex gap-4 flex-wrap">
        <span className="text-red-400 font-bold">{String(e.action ?? "?")}</span>
        <span className="text-yellow-300">{String(e.userEmail ?? "?")}</span>
        <span className="text-gray-400">{String(e.userName ?? "?")}</span>
        <span className="text-gray-500">{String(e.timestamp ?? "?")}</span>
      </div>
      <div className="text-gray-400">{String(e.collection ?? "?")}/{String(e.documentId ?? "?")}</div>
      {!!e.summary && <div className="text-gray-300">{String(e.summary)}</div>}
      {!!e.before && <pre className="text-blue-300 overflow-auto whitespace-pre-wrap">{JSON.stringify(e.before as Record<string, unknown>, null, 2)}</pre>}
    </div>
  );
}
