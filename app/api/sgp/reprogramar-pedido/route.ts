import { NextResponse } from "next/server";
import { sgpCall, buildReprogramarPedidoXml, parseSgpError, isSgpConfigured } from "@/lib/sgp";

export async function POST(req: Request) {
  const { serie, numero, planta, fecha, hora } = await req.json() as {
    serie: string;
    numero: string;
    planta: string;
    fecha: string; // YYYY-MM-DD
    hora: string;  // HH:MM
  };

  if (!serie || !numero || !planta || !fecha || !hora) {
    return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    const xmlData = buildReprogramarPedidoXml(serie, numero, fecha, hora);
    const soapXml = await sgpCall("SGPReprogramarPedido", xmlData, planta);
    return NextResponse.json({ ok: true, raw: soapXml.slice(0, 500) });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[SGP] reprogramar-pedido error:", raw);
    return NextResponse.json({ ok: false, error: parseSgpError(raw) }, { status: 502 });
  }
}
