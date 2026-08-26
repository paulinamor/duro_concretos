// Empresas con timbrado activo en FacturAPI.
// Cada empresa tiene su propia organización y API key.
// Agregar una entrada aquí y la variable de entorno correspondiente para habilitar una empresa.

export type Empresa = "duro" | "grupo_jc";

export interface EmpresaInfo {
  nombre: string;
  rfc: string;
  envKey: string; // nombre de la variable de entorno que contiene la API key
}

export const EMPRESAS: Record<Empresa, EmpresaInfo> = {
  duro: {
    nombre: "Duro Concretos",
    rfc: process.env.FACTURAPI_RFC_DURO ?? "",
    envKey: "FACTURAPI_KEY_DURO",
  },
  grupo_jc: {
    nombre: "Grupo JC",
    rfc: process.env.FACTURAPI_RFC_GRUPO_JC ?? "",
    envKey: "FACTURAPI_KEY_GRUPO_JC",
  },
};

/** Returns the FacturAPI key for the given empresa, or throws if not configured. */
export function getFacturApiKey(empresa: Empresa = "duro"): string {
  const info = EMPRESAS[empresa];
  // Fall back to the legacy single-key env var for backwards compatibility
  const key = process.env[info.envKey] ?? (empresa === "duro" ? process.env.FACTURAPI_KEY : undefined);
  if (!key) {
    throw new Error(`FacturAPI key no configurada para empresa "${empresa}". Agrega ${info.envKey} a tu .env.local`);
  }
  return key;
}

export const FACTURAPI_BASE = "https://www.facturapi.io/v2";
