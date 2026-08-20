import { NextResponse } from "next/server";
import { parseSgpResponse, parseSgpError } from "@/lib/sgp";

// Test endpoint — accepts credentials + pre-built XML in the request body.
// Only for debugging at /configuracion/sgp; does not touch Firestore.

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

  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${metodo} xmlns="http://SgpWebService.org/"><pw_planta_clave>${plantaClave}</pw_planta_clave><pw_xml_data><![CDATA[${inner}]]></pw_xml_data><pw_usuario>${usuario}</pw_usuario></${metodo}></soap:Body></soap:Envelope>`;

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
    const errorMsg = res.ok ? null : parseSgpError(rawXml);

    return NextResponse.json({
      ok: res.ok,
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
