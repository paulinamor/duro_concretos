import { NextResponse } from "next/server";
import { sgpCall, isSgpConfigured, parseSgpResponse, parseSgpError } from "@/lib/sgp";

export const dynamic = "force-dynamic";

// Lecturas de solo lectura al SGP — no modifican datos.
// Métodos útiles: SGPPeriodoActivo, SGPConsumosSinInterfazar,
// SGPPeriodoProduccionFrentesElementosResumen, SGPPeriodoProduccionFrentesElementosConsumos

export async function POST(req: Request) {
  const { metodo, planta, xmlData } = await req.json() as {
    metodo: string;
    planta: string;
    xmlData?: string;
  };

  if (!metodo || !planta) {
    return NextResponse.json({ ok: false, error: "Faltan metodo y planta" }, { status: 400 });
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  const t0 = Date.now();
  try {
    const rawXml = await sgpCall(metodo, xmlData ?? "<consulta/>", planta);
    const ms = Date.now() - t0;
    const parsed = parseSgpResponse(rawXml);
    return NextResponse.json({ ok: true, ms, rawXml, parsed });
  } catch (err) {
    const ms = Date.now() - t0;
    const raw = err instanceof Error ? err.message : String(err);
    const msg = raw.includes("<?xml") ? parseSgpError(raw) : raw;
    return NextResponse.json({ ok: false, ms, error: msg, rawXml: raw.includes("<?xml") ? raw : null });
  }
}
