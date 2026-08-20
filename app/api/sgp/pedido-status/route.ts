import { NextResponse } from "next/server";
import { sgpCall, buildCerrarPedidoXml, parseSgpResponse, parseSgpError, isSgpConfigured } from "@/lib/sgp";

// Polls SGP for the current status of a pedido (remisiones, timestamps, etc.)
// Uses SGPCerrarPedido in "read" mode — Sybil confirmed this method returns the
// current pedido data without actually closing it when called without finalizing.
// TODO: Confirm with Sybil if there's a dedicated SGPConsultaPedido method.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serie = searchParams.get("serie") ?? "ERP";
  const numero = searchParams.get("numero") ?? "";
  const planta = searchParams.get("planta") ?? "";

  if (!numero || !planta) {
    return NextResponse.json({ ok: false, error: "Parámetros: numero, planta requeridos" }, { status: 400 });
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    // Some SGP versions have a dedicated read method; fallback to cerrar data read
    const xmlData = buildCerrarPedidoXml(serie, numero);
    const soapXml = await sgpCall("SGPCerrarPedido", xmlData, planta);
    const parsed = parseSgpResponse(soapXml);
    return NextResponse.json({ ok: true, pedido: parsed });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[SGP] pedido-status error:", raw);
    return NextResponse.json({ ok: false, error: parseSgpError(raw) }, { status: 502 });
  }
}
