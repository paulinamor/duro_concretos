import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import type { ConcreteReceipt } from "@/lib/concreteReceipts";

interface Obra {
  id: string;
  cliente: string;
  nombre: string;
  direccion: string;
}

function norm(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function esUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

function obraIdFrom(cliente: string, nombre: string) {
  const c = cliente.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30);
  const n = nombre.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30);
  return `obra-${c}-${n}`;
}

export interface ResultadoMigracion {
  total: number;
  nuevas: number;
  yaExistian: number;
  errores: string[];
  detalle: { fuente: string; cliente: string; nombre: string }[];
}

export async function migrarObras(): Promise<ResultadoMigracion> {
  const candidatos = new Map<string, { cliente: string; nombre: string; direccion: string; fuente: string }>();
  const errores: string[] = [];

  // ── 1. Programaciones: nombreObra + direccion ──────────────────────────────
  try {
    const progs = await getCollectionDocs<{
      cliente?: string; nombreObra?: string; direccion?: string;
    }>(COLLECTIONS.programaciones);

    for (const p of progs) {
      if (!p.cliente?.trim() || !p.nombreObra?.trim()) continue;
      const cliente = norm(p.cliente);
      const nombre = norm(p.nombreObra);
      const key = `${cliente}|${nombre}`;
      if (!candidatos.has(key)) {
        candidatos.set(key, { cliente, nombre, direccion: p.direccion?.trim() ?? "", fuente: "programaciones" });
      }
    }
  } catch (e) {
    errores.push(`programaciones: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2. Remisiones: direccionObra como nombre (si no es URL larga) ──────────
  try {
    const remisiones = await getCollectionDocs<ConcreteReceipt>(COLLECTIONS.remisiones);

    for (const r of remisiones) {
      if (!r.cliente?.trim() || !r.direccionObra?.trim()) continue;
      const direccionObra = r.direccionObra.trim();
      // Si es URL, la usamos como direccion pero no como nombre de obra
      // Si es texto corto (<= 80 chars y no URL), es el nombre de la obra
      const esNombre = !esUrl(direccionObra) && direccionObra.length <= 80;
      if (!esNombre) continue;

      const cliente = norm(r.cliente);
      const nombre = norm(direccionObra);
      const key = `${cliente}|${nombre}`;
      if (!candidatos.has(key)) {
        candidatos.set(key, { cliente, nombre, direccion: direccionObra, fuente: "remisiones" });
      }
    }
  } catch (e) {
    errores.push(`remisiones: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 3. Cargar obras ya existentes para no duplicar ─────────────────────────
  let yaExistentes = new Set<string>();
  try {
    const existentes = await getCollectionDocs<Obra>(COLLECTIONS.obras);
    for (const o of existentes) {
      if (o.cliente && o.nombre) {
        yaExistentes.add(`${norm(o.cliente)}|${norm(o.nombre)}`);
      }
    }
  } catch (e) {
    errores.push(`obras existentes: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 4. Guardar nuevas ──────────────────────────────────────────────────────
  let nuevas = 0;
  let yaExistian = 0;
  const detalle: { fuente: string; cliente: string; nombre: string }[] = [];

  for (const [key, candidato] of candidatos.entries()) {
    if (yaExistentes.has(key)) {
      yaExistian++;
      continue;
    }
    try {
      const id = obraIdFrom(candidato.cliente, candidato.nombre);
      const doc: Obra = { id, cliente: candidato.cliente, nombre: candidato.nombre, direccion: candidato.direccion };
      await upsertDocument(COLLECTIONS.obras, id, doc);
      nuevas++;
      detalle.push({ fuente: candidato.fuente, cliente: candidato.cliente, nombre: candidato.nombre });
    } catch (e) {
      errores.push(`${candidato.cliente}/${candidato.nombre}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { total: candidatos.size, nuevas, yaExistian, errores, detalle };
}
