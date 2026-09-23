import { getCollectionDocs, COLLECTIONS } from "./db";

export interface IntegrityItem {
  id: string;
  desc: string;
}

export interface IntegrityResult {
  ok: boolean;
  count: number;
  items: IntegrityItem[];
  durationMs: number;
}

export interface IntegrityCheck {
  id: string;
  label: string;
  description: string;
  severity: "error" | "warning" | "info";
  run(): Promise<IntegrityResult>;
}

async function timed(fn: () => Promise<{ ok: boolean; count: number; items: IntegrityItem[] }>): Promise<IntegrityResult> {
  const t0 = Date.now();
  const res = await fn();
  return { ...res, durationMs: Date.now() - t0 };
}

export const INTEGRITY_CHECKS: IntegrityCheck[] = [
  {
    id: "rfc-duplicados",
    label: "RFC duplicados en clientes",
    description: "Detecta clientes con el mismo RFC registrado más de una vez.",
    severity: "error",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; razonSocial?: string; rfc?: string }>(COLLECTIONS.clientes);
      const rfcMap = new Map<string, string[]>();
      for (const d of docs) {
        const rfc = d.rfc?.trim().toUpperCase();
        if (!rfc || rfc === "XAXX010101000" || rfc === "XEXX010101000") continue;
        const existing = rfcMap.get(rfc) ?? [];
        existing.push(d.razonSocial ?? d.id ?? rfc);
        rfcMap.set(rfc, existing);
      }
      const items: IntegrityItem[] = [];
      for (const [rfc, names] of rfcMap) {
        if (names.length > 1) {
          items.push({ id: rfc, desc: `RFC ${rfc} aparece ${names.length}x: ${names.join(", ")}` });
        }
      }
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "programaciones-sin-cliente",
    label: "Programaciones sin cliente asignado",
    description: "Programaciones donde el campo cliente está vacío o ausente.",
    severity: "warning",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; cliente?: string; folio?: string; dia?: string }>(COLLECTIONS.programaciones);
      const items: IntegrityItem[] = docs
        .filter((d) => !d.cliente || d.cliente.trim() === "")
        .map((d) => ({ id: d.id ?? "—", desc: `Folio ${d.folio ?? "sin folio"} · ${d.dia ?? "sin fecha"} — sin cliente` }));
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "solicitudes-stale",
    label: "Solicitudes pendientes >7 días",
    description: "Solicitudes de autorización que llevan más de 7 días sin resolverse.",
    severity: "warning",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; tipo?: string; status?: string; creadoEn?: string; solicitanteEmail?: string }>(COLLECTIONS.solicitudesAutorizacion);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const items: IntegrityItem[] = docs
        .filter((d) => d.status === "pendiente" && d.creadoEn && new Date(d.creadoEn) < cutoff)
        .map((d) => ({
          id: d.id ?? "—",
          desc: `${d.tipo ?? "—"} · por ${d.solicitanteEmail ?? "—"} · desde ${d.creadoEn ? new Date(d.creadoEn).toLocaleDateString("es-MX") : "—"}`,
        }));
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "cfdis-sin-uuid",
    label: "CFDIs sin UUID timbrado",
    description: "Documentos en cfdiEmitidos sin UUID SAT (posible error de timbrado).",
    severity: "error",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; uuid?: string; folio?: string; clienteNombre?: string }>(COLLECTIONS.cfdiEmitidos);
      const items: IntegrityItem[] = docs
        .filter((d) => !d.uuid || d.uuid.trim() === "")
        .map((d) => ({ id: d.id ?? "—", desc: `Folio ${d.folio ?? "—"} · ${d.clienteNombre ?? "—"} — UUID ausente` }));
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "efectivo-folio-dup",
    label: "Recibos de efectivo con folio duplicado",
    description: "Recibos en la colección efectivo con el mismo número de folio.",
    severity: "error",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; folio?: string | number; planta?: string }>(COLLECTIONS.efectivo);
      const folioMap = new Map<string, string[]>();
      for (const d of docs) {
        const folio = String(d.folio ?? "").trim();
        if (!folio) continue;
        const key = `${folio}__${d.planta ?? "—"}`;
        const existing = folioMap.get(key) ?? [];
        existing.push(d.id ?? folio);
        folioMap.set(key, existing);
      }
      const items: IntegrityItem[] = [];
      for (const [key, ids] of folioMap) {
        if (ids.length > 1) {
          const [folio, planta] = key.split("__");
          items.push({ id: key, desc: `Folio ${folio} (${planta}) aparece ${ids.length}x` });
        }
      }
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "docs-sin-planta",
    label: "Documentos sin campo planta",
    description: "Verifica programaciones y efectivo sin campo planta (datos legacy no migrados).",
    severity: "info",
    run: () => timed(async () => {
      const [progs, efectivo] = await Promise.all([
        getCollectionDocs<{ id?: string; planta?: string; folio?: string }>(COLLECTIONS.programaciones),
        getCollectionDocs<{ id?: string; planta?: string; folio?: string }>(COLLECTIONS.efectivo),
      ]);
      const items: IntegrityItem[] = [
        ...progs.filter((d) => !d.planta || d.planta === "").map((d) => ({ id: d.id ?? "—", desc: `programaciones/${d.id ?? "—"} · folio ${d.folio ?? "—"}` })),
        ...efectivo.filter((d) => !d.planta || d.planta === "").map((d) => ({ id: `ef-${d.id}`, desc: `efectivo/${d.id ?? "—"} · folio ${d.folio ?? "—"}` })),
      ];
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "remisiones-sin-folio",
    label: "Remisiones sin folio",
    description: "Remisiones de despacho que no tienen número de folio asignado.",
    severity: "warning",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; folio?: string; fecha?: string; cliente?: string }>(COLLECTIONS.remisiones);
      const items: IntegrityItem[] = docs
        .filter((d) => !d.folio || String(d.folio).trim() === "")
        .map((d) => ({ id: d.id ?? "—", desc: `${d.id ?? "—"} · ${d.cliente ?? "—"} · ${d.fecha ?? "—"}` }));
      return { ok: items.length === 0, count: items.length, items };
    }),
  },

  {
    id: "productos-sin-codigo",
    label: "Productos sin código",
    description: "Productos del catálogo sin clave de producto asignada.",
    severity: "warning",
    run: () => timed(async () => {
      const docs = await getCollectionDocs<{ id?: string; codigo?: string; descripcion?: string }>(COLLECTIONS.productos);
      const items: IntegrityItem[] = docs
        .filter((d) => !d.codigo || d.codigo.trim() === "")
        .map((d) => ({ id: d.id ?? "—", desc: `${d.descripcion ?? "sin descripción"}` }));
      return { ok: items.length === 0, count: items.length, items };
    }),
  },
];
