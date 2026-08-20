import { getDocument, upsertDocument, COLLECTIONS } from "./db";

export type ModuleStatus = "live" | "wip" | "dev";

// Estado inicial por módulo — developer puede sobreescribir desde el sidebar
export const MODULE_STATUS_DEFAULTS: Record<string, ModuleStatus> = {
  "/dashboard":                        "live",
  "/reportes":                         "live",
  "/transporte/programacion":          "live",
  "/transporte/seguros":               "live",
  "/transporte/diesel":                "live",
  "/transporte/mantenimiento":         "live",
  "/operaciones/inventario":           "live",
  "/crm/clientes":                     "live",
  "/crm/pipeline":                     "live",
  "/ventas/programacion":              "live",
  "/crm/seguimiento":                  "wip",
  "/ventas/recibos-concreto":          "live",
  "/finanzas/cxc":                     "live",
  "/finanzas/cxp":                     "live",
  "/finanzas/estado-cuenta-clientes":  "live",
  "/transporte/operadores":            "live",
  "/configuracion":                    "live",
  "/facturacion":                      "wip",
  "/recursos-humanos/nomina":          "dev",
};

const DOC_ID = "moduleStatuses";

export async function loadModuleStatuses(): Promise<Record<string, ModuleStatus>> {
  try {
    const saved = await getDocument<Record<string, ModuleStatus>>(
      COLLECTIONS.configuracion,
      DOC_ID,
    );
    if (saved) {
      const { id: _id, ...rest } = saved as Record<string, unknown>;
      return { ...MODULE_STATUS_DEFAULTS, ...(rest as Record<string, ModuleStatus>) };
    }
  } catch { /* fallback a defaults */ }
  return { ...MODULE_STATUS_DEFAULTS };
}

export async function saveModuleStatus(
  href: string,
  status: ModuleStatus,
): Promise<void> {
  await upsertDocument(COLLECTIONS.configuracion, DOC_ID, { [href]: status });
}

export const STATUS_CYCLE: ModuleStatus[] = ["live", "wip", "dev"];

export function nextStatus(current: ModuleStatus): ModuleStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}
