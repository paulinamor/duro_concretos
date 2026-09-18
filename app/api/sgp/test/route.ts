import { NextResponse } from "next/server";
import { parseSgpResponse, parseSgpError } from "@/lib/sgp";

// Test endpoint — accepts credentials + pre-built XML in the request body.
// Only for debugging at /configuracion/sgp; does not touch Firestore.

// Read-only methods have different SOAP signatures — NO pw_xml_data.
// Their parameters are defined explicitly in the WSDL (not a generic xml blob).
// The "xmlData" field from the UI is treated as a flat list of <param>value</param> elements
// that get inserted directly into the SOAP body.
const READ_METHODS = new Set([
  "SGPPeriodoActivo",
  "SGPConsumosSinInterfazar",
  "SGPPeriodoProduccionFrentesElementosResumen",
  "SGPPeriodoProduccionFrentesElementosConsumos",
  "SGPPeriodoProduccionMovimientosMateriaPrima",
  "LecaObtenCampo",
  "LecaProcesaLinea",
  "LecaRecuperaDosificacion",
]);

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEnvelope(metodo: string, plantaClave: string, usuario: string, xmlData: string): string {
  const ns = `xmlns="http://SgpWebService.org/"`;
  const wrap = (body: string) =>
    `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${metodo} ${ns}>${body}</${metodo}></soap:Body></soap:Envelope>`;

  if (READ_METHODS.has(metodo)) {
    // Extract <param>value</param> elements — value may be plain text or nested XML
    const params = [...xmlData.matchAll(/<(\w+)[^>]*>([\s\S]*?)<\/\1>/g)]
      .map(m => {
        const name = m[1];
        const val  = m[2].trim();
        // If value is XML, wrap in CDATA; otherwise entity-encode
        if (val.includes("<")) return `<${name}><![CDATA[${val}]]></${name}>`;
        return `<${name}>${esc(val)}</${name}>`;
      }).join("");
    return wrap(params || `<pw_empresa_clave>${esc(usuario)}</pw_empresa_clave>`);
  }
  // Write methods: standard pw_ params
  return wrap(
    `<pw_planta_clave>${esc(plantaClave)}</pw_planta_clave><pw_xml_data><![CDATA[${xmlData}]]></pw_xml_data><pw_usuario>${esc(usuario)}</pw_usuario>`
  );
}

function extractSgpAppError(xml: string): string | null {
  // SGP returns HTTP 200 but with <error> in the body for application-level failures
  const m = xml.match(/<(?:\w+:)?Result[^>]*>([\s\S]*?)<\/(?:\w+:)?Result>/);
  const inner = m
    ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    : xml;
  const errMatch = inner.match(/<error[^>]*>([^<]+)<\/error>/i);
  return errMatch ? errMatch[1].trim() : null;
}

export async function POST(req: Request) {
  const { endpoint, usuario, plantaClave, metodo, xmlData } = await req.json() as {
    endpoint: string;
    usuario: string;
    plantaClave: string;
    planta: string;
    metodo: string;
    xmlData: string;
  };

  if (!endpoint || !usuario || !plantaClave || !metodo) {
    return NextResponse.json({ ok: false, error: "Faltan campos" }, { status: 400 });
  }

  const inner = xmlData ?? "<catalogo/>";
  const envelope = buildEnvelope(metodo, plantaClave, usuario, inner);

  const t0 = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"http://SgpWebService.org/${metodo}"`,
      },
      body: envelope,
      signal: AbortSignal.timeout(20_000),
    });

    const rawXml = await res.text();
    const ms = Date.now() - t0;

    const parsed = parseSgpResponse(rawXml);

    // Check for HTTP error first, then for SGP application-level error in body
    let errorMsg = res.ok ? null : parseSgpError(rawXml);
    if (!errorMsg) errorMsg = extractSgpAppError(rawXml);

    return NextResponse.json({
      ok: res.ok && !errorMsg,
      status: res.status,
      ms,
      parsed,
      error: errorMsg,
      rawXml,
      sentXml: inner,
    });
  } catch (err) {
    const ms = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, ms, error: msg, rawXml: null, sentXml: inner });
  }
}
