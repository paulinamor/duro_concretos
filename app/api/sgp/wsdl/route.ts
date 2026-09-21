import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoint = process.env.SGP_ENDPOINT ?? "http://100.115.105.16:9000/SgpWebService/SgpWebService.asmx";
  const wsdlUrl = `${endpoint}?WSDL`;

  try {
    const res = await fetch(wsdlUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
    }
    const xml = await res.text();

    // ASMX WSDLs encode params inside XSD <s:element name="MethodName"><s:complexType><s:sequence>
    // e.g.: <s:element minOccurs="0" maxOccurs="1" name="input" type="s:string" />
    const methods: Array<{ name: string; params: Array<{ name: string; type: string }> }> = [];

    // Find all top-level elements that correspond to SGP methods (those ending in known prefixes or matching SGP/Leca pattern)
    const elemRegex = /<(?:s|xs):element\s+name="(SGP\w+|Leca\w+)"[^>]*>([\s\S]*?)<\/(?:s|xs):element>/g;
    for (const el of xml.matchAll(elemRegex)) {
      const methodName = el[1];
      const body = el[2];
      const params: Array<{ name: string; type: string }> = [];
      // Extract child elements from sequence
      const paramRegex = /<(?:s|xs):element\s+[^>]*name="([^"]+)"[^>]*type="([^"]+)"[^>]*/g;
      for (const p of body.matchAll(paramRegex)) {
        params.push({ name: p[1], type: p[2].replace(/^[^:]+:/, "") });
      }
      methods.push({ name: methodName, params });
    }

    return NextResponse.json({ ok: true, methods, rawWsdl: xml });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
