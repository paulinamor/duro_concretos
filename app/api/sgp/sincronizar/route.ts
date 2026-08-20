import { NextResponse } from "next/server";
import { sgpCall, parseSgpError, isSgpConfigured } from "@/lib/sgp";

// Catalogs available: materiasPrimas | unidadesMedida | personal | puestos | revolvedoras
const METHOD_MAP: Record<string, string> = {
  materiasPrimas: "SGPSincronizaMateriaPrima",
  unidadesMedida: "SGPSincronizaUnidadMedida",
  personal: "SGPSincronizaPersonal",
  puestos: "SGPSincronizaPuestos",
  revolvedoras: "SGPSincronizaUnidadesRevolvedoras",
};

export async function POST(req: Request) {
  const { catalogo, planta } = await req.json() as {
    catalogo: string;
    planta: string;
  };

  if (!catalogo || !planta) {
    return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
  }

  const method = METHOD_MAP[catalogo];
  if (!method) {
    return NextResponse.json(
      { ok: false, error: `Catálogo desconocido: ${catalogo}. Opciones: ${Object.keys(METHOD_MAP).join(", ")}` },
      { status: 400 },
    );
  }

  if (!isSgpConfigured()) {
    return NextResponse.json({ ok: false, error: "SGP_NOT_CONFIGURED" }, { status: 200 });
  }

  try {
    // Sync methods typically receive empty XML or a simple wrapper
    const soapXml = await sgpCall(method, "<catalogo/>", planta);
    return NextResponse.json({ ok: true, catalogo, raw: soapXml.slice(0, 2000) });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`[SGP] sincronizar/${catalogo} error:`, raw);
    return NextResponse.json({ ok: false, error: parseSgpError(raw) }, { status: 502 });
  }
}
