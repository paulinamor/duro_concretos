import { NextResponse } from "next/server";
import {
  sgpCall,
  buildCrearPedidoXml,
  parseSgpResponse,
  parseSgpError,
  isSgpConfigured,
  type SgpProgramacion,
} from "@/lib/sgp";

export async function POST(req: Request) {
  const body = await req.json() as { prog: SgpProgramacion };
  const { prog } = body;

  if (!prog?.numeroErp || !prog?.planta || !prog?.cantidadSolicitada) {
    return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    const xmlData = buildCrearPedidoXml(prog);
    const soapXml = await sgpCall("SGPCrearPedido", xmlData, prog.planta);

    // Decode entity-encoded inner XML from SOAP envelope
    const inner = soapXml
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

    // SGPCrearPedido returns <result><error>...</error><mensaje>...</mensaje><serie>...</serie><numero>...</numero></result>
    const errMatch = inner.match(/<error[^>]*>([^<]+)<\/error>/);
    if (errMatch && errMatch[1].trim()) {
      const msg = errMatch[1].trim();
      console.error("[SGP crear-pedido] SGP error:", msg);
      return NextResponse.json({ ok: false, error: msg, _rawXml: soapXml.slice(0, 2000) });
    }

    const extract = (name: string) =>
      inner.match(new RegExp(`<${name}[^>]*>([^<]*)<\\/${name}>`))?.[1]?.trim() ?? null;

    const sgpSerie  = extract("serie")  || extract("pedido_serie")  || null;
    const sgpNumero = extract("numero") || extract("pedido_numero") || null;

    // pw_mensaje devuelve "SERIE|NUMERO" cuando el SP incluye la línea de debug
    const mensaje = extract("mensaje") ?? "";
    const [sgpSerieFolio, sgpNumeroFolio] = mensaje.includes("|")
      ? mensaje.split("|")
      : [null, null];

    const serie  = sgpSerie  || sgpSerieFolio  || null;
    const numero = sgpNumero || sgpNumeroFolio || null;

    console.info(`[SGP crear-pedido] OK serie=${serie} numero=${numero}`);

    return NextResponse.json({
      ok: true,
      sgpSerie: serie,
      sgpNumero: numero,
      remisiones: parseSgpResponse(soapXml)?.remisiones ?? [],
      _rawXml: soapXml.slice(0, 2000),
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "SGP_NOT_CONFIGURED" || code === "SGP_NO_PLANTA_CLAVE") {
      return NextResponse.json({ ok: false, error: code }, { status: 200 });
    }
    const raw = err instanceof Error ? err.message : String(err);
    const sgpMsg = raw.includes("<?xml") ? parseSgpError(raw) : raw;
    console.error("[SGP] crear-pedido error:", raw);
    return NextResponse.json({ ok: false, error: sgpMsg }, { status: 502 });
  }
}
