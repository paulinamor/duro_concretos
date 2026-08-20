import { NextResponse } from "next/server";
import { sgpCall, buildCerrarPedidoXml, parseSgpResponse, parseSgpError, isSgpConfigured } from "@/lib/sgp";

export async function POST(req: Request) {
  const { serie, numero, planta } = await req.json() as {
    serie: string;
    numero: string;
    planta: string;
  };

  if (!serie || !numero || !planta) {
    return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    const xmlData = buildCerrarPedidoXml(serie, numero);
    const soapXml = await sgpCall("SGPCerrarPedido", xmlData, planta);
    const parsed = parseSgpResponse(soapXml);
    return NextResponse.json({ ok: true, remisiones: parsed?.remisiones ?? [] });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[SGP] cerrar-pedido error:", raw);
    return NextResponse.json({ ok: false, error: parseSgpError(raw) }, { status: 502 });
  }
}
