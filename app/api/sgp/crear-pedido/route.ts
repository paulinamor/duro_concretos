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
    const parsed = parseSgpResponse(soapXml);

    return NextResponse.json({
      ok: true,
      sgpSerie: parsed?.serie ?? null,
      sgpNumero: parsed?.numero ?? null,
      remisiones: parsed?.remisiones ?? [],
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
