import { upsertDocument } from "./db";
import { getStoredSession } from "./auth";

function getPlanta(): string {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("duro_concretos_session") : null;
    if (!raw) return "—";
    return JSON.parse(raw)?.plantaActiva ?? JSON.parse(raw)?.planta ?? "—";
  } catch {
    return "—";
  }
}

export async function logError(opts: {
  message: string;
  stack?: string;
  type: "runtime" | "unhandled_promise" | "network" | "react";
  context?: Record<string, unknown>;
}) {
  try {
    const session = getStoredSession();
    const id = `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await upsertDocument("errores", id, {
      message: opts.message.slice(0, 1000),
      ...(opts.stack ? { stack: opts.stack.slice(0, 3000) } : {}),
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      userEmail: session?.email ?? "anonymous",
      userName: session?.name ?? "anonymous",
      timestamp: new Date().toISOString(),
      type: opts.type,
      resolved: false,
      ...(opts.context ? { context: opts.context } : {}),
    });
  } catch {
    // silent — cannot log the logger's own errors
  }
}

export async function logAudit(opts: {
  action: "create" | "update" | "delete";
  collection: string;
  documentId: string;
  summary?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  try {
    const session = getStoredSession();
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await upsertDocument("auditLog", id, {
      action: opts.action,
      collection: opts.collection,
      documentId: opts.documentId,
      userEmail: session?.email ?? "anonymous",
      userName: session?.name ?? "anonymous",
      timestamp: new Date().toISOString(),
      planta: getPlanta(),
      summary: opts.summary ?? `${opts.action} ${opts.collection}/${opts.documentId}`,
      ...(opts.before ? { before: opts.before } : {}),
      ...(opts.after ? { after: opts.after } : {}),
    });
  } catch {
    // silent
  }
}
