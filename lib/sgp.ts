// SGP (Sistema de Gestión de Plantas) — Sybil Integraciones TI
// Endpoint: http://sybil.com.mx:9000/SgpWebService/SgpWebService.asmx
// SOAP 1.1 · ASP.NET Web Service (.asmx)
// Each method receives: pw_planta_clave, pw_xml_data, pw_usuario

const SGP_ENDPOINT =
  process.env.SGP_ENDPOINT ??
  "http://sybil.com.mx:9000/SgpWebService/SgpWebService.asmx";
const SGP_USUARIO = process.env.SGP_USUARIO ?? "";
const SGP_PLANTA_CLAVES: Record<string, string> = {
  Allende: process.env.SGP_PLANTA_CLAVE_ALLENDE ?? "",
  Pesquería: process.env.SGP_PLANTA_CLAVE_PESQUERIA ?? "",
};

export function isSgpConfigured(): boolean {
  return (
    !!SGP_USUARIO &&
    (!!SGP_PLANTA_CLAVES.Allende || !!SGP_PLANTA_CLAVES["Pesquería"])
  );
}

export function getPlantaClave(planta: string): string {
  return SGP_PLANTA_CLAVES[planta] ?? "";
}

// ─── SOAP Core ─────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(method: string, plantaClave: string, xmlData: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
xmlns:xsd="http://www.w3.org/2001/XMLSchema" \
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
<soap:Body>\
<${method} xmlns="http://SgpWebService.org/">\
<pw_planta_clave>${escapeXml(plantaClave)}</pw_planta_clave>\
<pw_xml_data><![CDATA[${xmlData}]]></pw_xml_data>\
<pw_usuario>${escapeXml(SGP_USUARIO)}</pw_usuario>\
</${method}>\
</soap:Body>\
</soap:Envelope>`;
}

/** Makes a SOAP call to the SGP web service. Returns the raw SOAP XML response. */
export async function sgpCall(
  method: string,
  xmlData: string,
  planta: string,
): Promise<string> {
  if (!isSgpConfigured()) {
    throw Object.assign(new Error("SGP no configurado"), { code: "SGP_NOT_CONFIGURED" });
  }
  const plantaClave = getPlantaClave(planta);
  if (!plantaClave) {
    throw Object.assign(
      new Error(`No hay clave SGP configurada para planta: ${planta}`),
      { code: "SGP_NO_PLANTA_CLAVE" },
    );
  }

  const envelope = buildSoapEnvelope(method, plantaClave, xmlData);

  const res = await fetch(SGP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"http://SgpWebService.org/${method}"`,
    },
    body: envelope,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(
      new Error(`SGP HTTP ${res.status}: ${body.slice(0, 300)}`),
      { code: "SGP_HTTP_ERROR" },
    );
  }

  return res.text();
}

// ─── XML Builders ──────────────────────────────────────────────────────────

export interface SgpProgramacion {
  // Identificación ERP
  serieErp: string;      // "ERP"
  numeroErp: string;     // folio
  // Producto (concreto)
  producto: string;      // clave del producto en SGP (ej. "FC200")
  productoDescripcion?: string;
  cantidadSolicitada: number;   // m3 totales
  metrosPorUnidad?: number;     // m3 por viaje de revolvedora
  // Fecha y hora
  fechaSuministro: string;  // YYYY-MM-DD
  horaEnObra: string;       // HH:MM:SS
  // Opciones de colado
  nivelAColar?: string;
  bombeoPropio?: "S" | "N";   // bomba propia
  bombeoCliente?: "S" | "N";  // bomba del cliente
  intervaloCarga?: number;     // minutos entre viajes
  // Cliente
  clienteNumeroErp?: string;
  clienteFisicaMoral?: "S" | "N";
  clienteRazonSocial: string;
  clienteTelefono?: string;
  // Obra
  obraNumeroErp?: string;
  obraDescripcion: string;
  obraDireccion?: string;
  obraMunicipio?: string;
  obraEstado?: string;
  obraEncargado?: string;
  // Frente
  frenteDescripcion?: string;
  // Planta
  planta: string;
}

/** Deriva bombeoPropio/bombeoCliente del campo tdBom del ERP */
export function tdBomToBombeo(tdBom: string): { bombeoPropio: "S" | "N"; bombeoCliente: "S" | "N" } {
  const v = tdBom.toUpperCase();
  if (v.includes("BOM")) return { bombeoPropio: "S", bombeoCliente: "N" };
  return { bombeoPropio: "N", bombeoCliente: "N" };
}

export function buildCrearPedidoXml(p: SgpProgramacion): string {
  const hora = p.horaEnObra.length === 5 ? `${p.horaEnObra}:00` : p.horaEnObra;
  return `<pedido>\
<serie_erp>${escapeXml(p.serieErp)}</serie_erp>\
<numero_erp>${escapeXml(p.numeroErp)}</numero_erp>\
<producto>${escapeXml(p.producto)}</producto>\
<producto_descripcion>${escapeXml(p.productoDescripcion ?? p.producto)}</producto_descripcion>\
<cantidad_solicitada>${p.cantidadSolicitada}</cantidad_solicitada>\
<metros_por_unidad>${p.metrosPorUnidad ?? ""}</metros_por_unidad>\
<fecha_suministro>${escapeXml(p.fechaSuministro)}</fecha_suministro>\
<hora_en_obra>${escapeXml(hora)}</hora_en_obra>\
<nivel_a_colar>${escapeXml(p.nivelAColar ?? "")}</nivel_a_colar>\
<bombeo_propio>${p.bombeoPropio ?? "N"}</bombeo_propio>\
<bombeo_cliente>${p.bombeoCliente ?? "N"}</bombeo_cliente>\
<intervalo_carga>${p.intervaloCarga ?? ""}</intervalo_carga>\
<cliente>\
<numero_erp>${escapeXml(p.clienteNumeroErp ?? "")}</numero_erp>\
<fisica_moral>${p.clienteFisicaMoral ?? "S"}</fisica_moral>\
<razon_social>${escapeXml(p.clienteRazonSocial)}</razon_social>\
<apellido_paterno></apellido_paterno>\
<apellido_materno></apellido_materno>\
<nombres></nombres>\
<numero_interior></numero_interior>\
<numero_exterior></numero_exterior>\
<calle></calle>\
<colonia></colonia>\
<municipio></municipio>\
<estado></estado>\
<codigo_postal></codigo_postal>\
<telefono>${escapeXml(p.clienteTelefono ?? "")}</telefono>\
</cliente>\
<obra>\
<numero_erp>${escapeXml(p.obraNumeroErp ?? "")}</numero_erp>\
<descripcion>${escapeXml(p.obraDescripcion)}</descripcion>\
<numero_interior></numero_interior>\
<numero_exterior></numero_exterior>\
<calle>${escapeXml(p.obraDireccion ?? "")}</calle>\
<colonia></colonia>\
<municipio>${escapeXml(p.obraMunicipio ?? "")}</municipio>\
<estado>${escapeXml(p.obraEstado ?? "")}</estado>\
<codigo_postal></codigo_postal>\
<telefono></telefono>\
<encargado>${escapeXml(p.obraEncargado ?? "")}</encargado>\
</obra>\
<frente>\
<numero_erp></numero_erp>\
<descripcion>${escapeXml(p.frenteDescripcion ?? "")}</descripcion>\
<telefono></telefono>\
<encargado></encargado>\
</frente>\
<unidades_medida>\
<unidad_medida><clave>M3</clave><descripcion>Metro Cúbico</descripcion></unidad_medida>\
</unidades_medida>\
<materias_primas>\
<materia_prima>\
<clave>${escapeXml(p.producto)}</clave>\
<descripcion>${escapeXml(p.productoDescripcion ?? p.producto)}</descripcion>\
<unidad_dosif>M3</unidad_dosif>\
<unidad_invent>M3</unidad_invent>\
<familia>CE</familia>\
</materia_prima>\
</materias_primas>\
</pedido>`;
}

export function buildCerrarPedidoXml(serie: string, numero: string): string {
  return `<pedido><serie>${escapeXml(serie)}</serie><numero>${escapeXml(numero)}</numero></pedido>`;
}

export function buildCancelarPedidoXml(serie: string, numero: string): string {
  return buildCerrarPedidoXml(serie, numero);
}

export function buildAjustarPedidoXml(
  serie: string,
  numero: string,
  cantidad: number,
): string {
  return `<pedido><serie>${escapeXml(serie)}</serie><numero>${escapeXml(numero)}</numero><cantidad>${cantidad}</cantidad></pedido>`;
}

export function buildReprogramarPedidoXml(
  serie: string,
  numero: string,
  fecha: string,
  hora: string,
): string {
  return `<pedido><serie>${escapeXml(serie)}</serie><numero>${escapeXml(numero)}</numero><fecha>${escapeXml(fecha)}</fecha><hora>${escapeXml(hora)}</hora></pedido>`;
}

// ─── Response Parser ────────────────────────────────────────────────────────

export interface SgpRemision {
  serie: string;
  numero: string;
  equipoClave: string;         // CR / revolvedora
  operador: string;            // chofer
  numeroViaje: string;
  fechaSalidaPlanta: string;   // "YYYY-MM-DD HH:MM:SS"
  fechaLlegoObra: string;
  fechaSalidaObra: string;
  fechaLlegoPlanta: string;
  cantidadRemisionada: number;
  estatus: string;             // "C" = Cerrada
  estatusDosificacion: string; // "D" = Dosificada
}

export interface SgpPedidoResponse {
  empresClave: string;
  serie: string;
  numero: string;
  clientClave: string;
  plantaGenera: string;
  cantidadSolicita: number;
  remisiones: SgpRemision[];
}

function extractTag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : "";
}

/** Parses a SOAP XML response from any SGP method. Returns null if no <pedido> found. */
export function parseSgpResponse(soapXml: string): SgpPedidoResponse | null {
  // Unwrap CDATA or encoded inner XML from SOAP result
  let inner = soapXml;
  const resultMatch = soapXml.match(/<(?:\w+:)?Result[^>]*>([\s\S]*?)<\/(?:\w+:)?Result>/);
  if (resultMatch) inner = resultMatch[1];
  // Decode HTML entities in case the response is entity-encoded
  inner = inner
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  const pedidoMatch = inner.match(/<pedido>([\s\S]*?)<\/pedido>/);
  if (!pedidoMatch) return null;
  const pedidoXml = pedidoMatch[1];

  const remisiones: SgpRemision[] = [];
  for (const m of pedidoXml.matchAll(/<remisiones>([\s\S]*?)<\/remisiones>/g)) {
    const r = m[1];
    remisiones.push({
      serie: extractTag(r, "remisi_serie"),
      numero: extractTag(r, "remisi_numero"),
      equipoClave: extractTag(r, "remisi_equipo_clave"),
      operador: extractTag(r, "remisi_person_operador"),
      numeroViaje: extractTag(r, "remisi_numero_viaje"),
      fechaSalidaPlanta: extractTag(r, "remisi_fecha_salida_planta"),
      fechaLlegoObra: extractTag(r, "remisi_fecha_llego_obra"),
      fechaSalidaObra: extractTag(r, "remisi_fecha_salida_obra"),
      fechaLlegoPlanta: extractTag(r, "remisi_fecha_llego_planta"),
      cantidadRemisionada: parseFloat(extractTag(r, "remisi_cantidad_remisionada")) || 0,
      estatus: extractTag(r, "remisi_estatus"),
      estatusDosificacion: extractTag(r, "remisi_estatus_dosificacion"),
    });
  }

  return {
    empresClave: extractTag(pedidoXml, "pedido_empres_clave"),
    serie: extractTag(pedidoXml, "pedido_serie"),
    numero: extractTag(pedidoXml, "pedido_numero"),
    clientClave: extractTag(pedidoXml, "pedido_client_clave"),
    plantaGenera: extractTag(pedidoXml, "pedido_planta_genera"),
    cantidadSolicita: parseFloat(extractTag(pedidoXml, "pedido_cantidad_solicita")) || 0,
    remisiones,
  };
}

/** Extracts an error message from a SOAP fault or SGP error response. */
export function parseSgpError(soapXml: string): string {
  const faultString = extractTag(soapXml, "faultstring");
  if (faultString) return faultString;
  const detail = extractTag(soapXml, "detail");
  if (detail) return detail;
  return "Error desconocido de SGP";
}
