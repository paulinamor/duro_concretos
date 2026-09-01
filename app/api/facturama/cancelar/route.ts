import { NextRequest, NextResponse } from "next/server";
import { cancelarCfdi } from "@/lib/facturama";
import { upsertDocument, COLLECTIONS } from "@/lib/db";

// POST /api/facturama/cancelar
// Body: { facturamaId: string, uuid: string, motivo?: "01"|"02"|"03"|"04" }
export async function POST(req: NextRequest) {
  try {
    const { facturamaId, uuid, motivo = "02" } = await req.json() as {
      facturamaId: string;
      uuid: string;
      motivo?: "01" | "02" | "03" | "04";
    };

    if (!facturamaId || !uuid) {
      return NextResponse.json({ error: "facturamaId y uuid son requeridos" }, { status: 400 });
    }

    await cancelarCfdi(facturamaId, motivo);

    await upsertDocument(COLLECTIONS.cfdiEmitidos, uuid, {
      status:            "cancelled" as const,
      motivoCancelacion: motivo,
      canceladoEn:       new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
