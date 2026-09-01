/**
 * Facturama API client — CFDI 4.0 Multiemisor
 *
 * Variables de entorno requeridas:
 *   FACTURAMA_USER        — usuario de la cuenta Facturama (tu RFC personal)
 *   FACTURAMA_PASSWORD    — contraseña de Facturama
 *   FACTURAMA_SANDBOX     — "true" para sandbox (omitir en producción)
 *   FACTURAMA_SERIE       — Serie por defecto (ej. "A")
 *
 * Multiemisor: el RFC emisor se pasa por request — no se fija en env vars.
 * Cada empresa registra su CSD vía POST /api/facturama/emisores.
 *
 * Docs: https://apisandbox.facturama.mx/Docs-multi
 */

// ─── URL base ─────────────────────────────────────────────────────────────────

export const facturamaBaseUrl =
  process.env.FACTURAMA_SANDBOX === "true"
    ? "https://apisandbox.facturama.mx"
    : "https://api.facturama.mx";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function facturamaAuthHeader(): string {
  const user = process.env.FACTURAMA_USER ?? "";
  const pass = process.env.FACTURAMA_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// ─── Cliente base ─────────────────────────────────────────────────────────────

export async function facturamaFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${facturamaBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: facturamaAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body?.ModelState
        ? Object.values(body.ModelState).flat().join("; ")
        : body?.message ?? body?.Message ?? JSON.stringify(body);
    } catch {}
    throw new Error(`Facturama ${res.status}: ${msg}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ─── Tipos Facturama ──────────────────────────────────────────────────────────

export type FmEmisor = {
  Rfc: string;
  Name: string;
  FiscalRegime: string;
};

export type FmReceptor = {
  Rfc: string;
  Name: string;
  CfdiUse: string;
  Email?: string;
  TaxZipCode: string;
  FiscalRegime: string;
};

export type FmTax = {
  Total: number;
  Name: "IVA" | "ISR";
  Base: number;
  Rate: number;
  IsRetention: boolean;
};

export type FmItem = {
  ProductCode: string;
  IdentificationNumber?: string;
  Description: string;
  Unit: string;
  UnitCode: string;
  UnitPrice: number;
  Quantity: number;
  Subtotal: number;
  TaxObject: "01" | "02" | "03" | "04";
  Taxes?: FmTax[];
  Total: number;
  Discount?: number;
};

export type FmCfdiPayload = {
  Serie?: string;
  Folio?: string;
  Date?: string;
  CfdiType?: "I" | "E" | "T" | "P" | "N";
  ExpeditionPlace: string;
  PaymentForm?: string;
  PaymentMethod?: "PUE" | "PPD";
  Currency: string;
  ExchangeRate?: number;
  Issuer: FmEmisor;
  Receiver: FmReceptor;
  Items: FmItem[];
};

export type FmCfdiResponse = {
  Id: string;
  CfdiType: string;
  Serie?: string;
  Folio?: string;
  Date: string;
  Uuid: string;
  Subtotal: number;
  Total: number;
};

// ─── Tipos Multiemisor CSD ────────────────────────────────────────────────────

export type FmCsdInput = {
  Rfc: string;
  Certificate: string;        // contenido del .cer en base64
  PrivateKey: string;         // contenido del .key en base64
  PrivateKeyPassword: string;
};

export type FmCsdInfo = {
  Rfc: string;
  ValidFrom?: string;
  ValidTo?: string;
  IsValid?: boolean;
  CertificateNumber?: string;
};

// ─── Tipos del ERP ────────────────────────────────────────────────────────────

export type ImpuestoConcepto = {
  tipoImpuesto: "trasladado" | "retenido";
  base: number;
  impuesto: "001" | "002" | "003";
  factor: "Tasa" | "Cuota" | "Exento";
  tasa: number;
  importe: number;
};

export type ConceptoFactura = {
  claveProdServ: string;
  claveUnidad: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  descuentoTipo?: "%" | "$";
  importe: number;
  objetoImp: "01" | "02" | "03" | "04";
  impuestos: ImpuestoConcepto[];
};

export type EmitirFacturaInput = {
  // Emisor (Multiemisor — obligatorio)
  emisorRfc: string;
  emisorNombre: string;
  emisorRegimen: string;
  emisorCp: string;           // CP del lugar de expedición (dirección fiscal del emisor)
  // Receptor
  clienteNombre: string;
  clienteRfc: string;
  clienteEmail?: string;
  clienteCp: string;
  clienteRegimenFiscal: string;
  usoCfdi: string;
  // Factura
  tipoComprobante?: string;
  serie?: string;
  folio?: string;
  fechaEmision?: string;
  moneda: "MXN" | "USD" | "EUR";
  tipoCambio?: number;
  metodoPago: "PUE" | "PPD";
  formaPago: string;
  conceptos: ConceptoFactura[];
};

export type TimbrarNominaInput = {
  // Emisor (Multiemisor — obligatorio)
  emisorRfc: string;
  emisorNombre: string;
  emisorRegimen: string;
  // Empleado
  empleadoRfc: string;
  empleadoCurp: string;
  empleadoNombre: string;
  empleadoNss: string;
  empleadoCodigoPostal: string;
  periodicidad: "01" | "02" | "03" | "04" | "05";
  fechaPago: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  numDiasPagados: number;
  totalSueldos: number;
  totalExento: number;
  totalISR: number;
  totalIMSS: number;
  totalInfonavit?: number;
  serie?: string;
};

// ─── Builder de payload ───────────────────────────────────────────────────────

const IMPUESTO_NAME: Record<string, "IVA" | "ISR"> = {
  "002": "IVA",
  "001": "ISR",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCfdiPayload(input: EmitirFacturaInput): FmCfdiPayload {
  const emisor: FmEmisor = {
    Rfc:          input.emisorRfc,
    Name:         input.emisorNombre,
    FiscalRegime: input.emisorRegimen,
  };

  const serie = input.serie ?? (process.env.FACTURAMA_SERIE ?? "A");
  const fecha = input.fechaEmision ?? new Date().toISOString().replace(/\.\d{3}Z$/, "");
  const tipo  = (input.tipoComprobante ?? "I").replace("F", "I") as "I" | "E" | "T";

  const items: FmItem[] = input.conceptos.map((c) => {
    let descuentoPesos = 0;
    if (c.descuento && c.descuento > 0) {
      descuentoPesos = c.descuentoTipo === "$"
        ? c.descuento
        : round2(c.importe * c.descuento / 100);
    }

    const taxes: FmTax[] = c.impuestos.map((t) => ({
      Total:       round2(t.importe),
      Name:        IMPUESTO_NAME[t.impuesto] ?? "IVA",
      Base:        round2(t.base),
      Rate:        t.tasa,
      IsRetention: t.tipoImpuesto === "retenido",
    }));

    return {
      ProductCode: c.claveProdServ,
      Description: c.descripcion,
      Unit:        c.unidad,
      UnitCode:    c.claveUnidad,
      UnitPrice:   c.precioUnitario,
      Quantity:    c.cantidad,
      Subtotal:    round2(c.importe),
      Discount:    descuentoPesos > 0 ? descuentoPesos : undefined,
      TaxObject:   c.objetoImp,
      Taxes:       taxes.length > 0 ? taxes : undefined,
      Total:       round2(c.importe - descuentoPesos + taxes.filter((t) => !t.IsRetention).reduce((s, t) => s + t.Total, 0)),
    };
  });

  return {
    Serie:          serie,
    Folio:          input.folio,
    Date:           fecha,
    CfdiType:       tipo,
    ExpeditionPlace: input.emisorCp,
    PaymentForm:    input.metodoPago === "PPD" ? "99" : input.formaPago,
    PaymentMethod:  input.metodoPago,
    Currency:       input.moneda,
    ExchangeRate:   input.moneda !== "MXN" ? input.tipoCambio : undefined,
    Issuer:         emisor,
    Receiver: {
      Rfc:          input.clienteRfc,
      Name:         input.clienteNombre,
      CfdiUse:      input.usoCfdi,
      Email:        input.clienteEmail,
      TaxZipCode:   input.clienteCp,
      FiscalRegime: input.clienteRegimenFiscal,
    },
    Items: items,
  };
}

// ─── API calls — CFDIs ────────────────────────────────────────────────────────

export async function emitirCfdi(payload: FmCfdiPayload): Promise<FmCfdiResponse> {
  return facturamaFetch<FmCfdiResponse>("/api-lite/3/cfdis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelarCfdi(
  facturamaId: string,
  motivo: "01" | "02" | "03" | "04" = "02",
): Promise<void> {
  await facturamaFetch(
    `/api-lite/3/cfdis/${facturamaId}?type=issued&motive=${motivo}`,
    { method: "DELETE" },
  );
}

export async function obtenerPdfBase64(facturamaId: string): Promise<string> {
  const res = await facturamaFetch<{ Content: string }>(
    `/api-lite/3/cfdis/${facturamaId}/pdf/issued`,
  );
  return res.Content;
}

export async function obtenerXmlBase64(facturamaId: string): Promise<string> {
  const res = await facturamaFetch<{ Content: string }>(
    `/api-lite/3/cfdis/${facturamaId}/xml/issued`,
  );
  return res.Content;
}

// ─── API calls — Multiemisor CSDs ─────────────────────────────────────────────

export async function registrarCsd(data: FmCsdInput): Promise<FmCsdInfo> {
  return facturamaFetch<FmCsdInfo>("/api-lite/csds", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function actualizarCsd(data: FmCsdInput): Promise<FmCsdInfo> {
  return facturamaFetch<FmCsdInfo>(`/api-lite/csds/${data.Rfc}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function listarCsds(): Promise<FmCsdInfo[]> {
  return facturamaFetch<FmCsdInfo[]>("/api-lite/csds");
}

export async function obtenerCsd(rfc: string): Promise<FmCsdInfo> {
  return facturamaFetch<FmCsdInfo>(`/api-lite/csds/${rfc}`);
}

export async function eliminarCsd(rfc: string): Promise<void> {
  await facturamaFetch(`/api-lite/csds/${rfc}`, { method: "DELETE" });
}

// ─── Catálogos SAT ────────────────────────────────────────────────────────────

export const SAT_FORMAS_PAGO = [
  { clave: "01", descripcion: "Efectivo" },
  { clave: "02", descripcion: "Cheque nominativo" },
  { clave: "03", descripcion: "Transferencia electrónica de fondos" },
  { clave: "04", descripcion: "Tarjeta de crédito" },
  { clave: "28", descripcion: "Tarjeta de débito" },
  { clave: "99", descripcion: "Por definir" },
] as const;

export const SAT_USOS_CFDI = [
  { clave: "G01", descripcion: "Adquisición de mercancías" },
  { clave: "G03", descripcion: "Gastos en general" },
  { clave: "I01", descripcion: "Construcciones" },
  { clave: "I03", descripcion: "Equipo de transporte" },
  { clave: "I08", descripcion: "Otra maquinaria y equipo" },
  { clave: "S01", descripcion: "Sin efectos fiscales" },
  { clave: "CP01", descripcion: "Pagos" },
] as const;

export const SAT_REGIMENES = [
  { clave: "601", descripcion: "General de Ley Personas Morales" },
  { clave: "603", descripcion: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", descripcion: "Sueldos y Salarios" },
  { clave: "606", descripcion: "Arrendamiento" },
  { clave: "612", descripcion: "Personas Físicas con Actividades Empresariales" },
  { clave: "616", descripcion: "Sin obligaciones fiscales" },
  { clave: "621", descripcion: "Incorporación Fiscal" },
  { clave: "626", descripcion: "Simplificado de Confianza" },
] as const;

export const SAT_CLAVES_UNIDAD = [
  { clave: "M3",  descripcion: "Metro cúbico" },
  { clave: "H87", descripcion: "Pieza" },
  { clave: "E48", descripcion: "Servicio" },
  { clave: "KGM", descripcion: "Kilogramo" },
  { clave: "LTR", descripcion: "Litro" },
  { clave: "ACT", descripcion: "Actividad" },
] as const;

export const SAT_PRODS_CONCRETO = [
  { clave: "30161801", descripcion: "Concreto premezclado" },
  { clave: "30161802", descripcion: "Mezcla de concreto" },
  { clave: "30111500", descripcion: "Materiales de construcción" },
  { clave: "72131702", descripcion: "Servicios de construcción" },
  { clave: "78102200", descripcion: "Servicios de transporte" },
  { clave: "84111506", descripcion: "Servicios de gestión" },
] as const;

export const SAT_MOTIVOS_CANCELACION = [
  { clave: "01", descripcion: "Comprobante emitido con errores con relación" },
  { clave: "02", descripcion: "Comprobante emitido con errores sin relación" },
  { clave: "03", descripcion: "No se llevó a cabo la operación" },
  { clave: "04", descripcion: "Operación nominativa relacionada en factura global" },
] as const;
