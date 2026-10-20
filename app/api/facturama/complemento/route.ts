import { NextRequest, NextResponse } from "next/server";
import { buildComplementoPayload, emitirCfdi, obtenerPdfBase64, type EmitirComplementoInput } from "@/lib/facturama";
import { upsertDocument, COLLECTIONS } from "@/lib/db";
import { withPlantaTag } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
      return NextResponse.json(
        { error: "Facturama no configurado. Agrega FACTURAMA_USER y FACTURAMA_PASSWORD en .env.local" },
        { status: 503 },
      );
    }

    const body = await req.json() as EmitirComplementoInput;

    if (!body.emisorRfc || !body.clienteRfc || !body.facturaUuid || !body.monto) {
      return NextResponse.json(
        { error: "Se requiere emisorRfc, clienteRfc, facturaUuid y monto" },
        { status: 400 },
      );
    }

    const payload = buildComplementoPayload(body);
    const result = await emitirCfdi(payload);

    let pdfBase64: string | undefined;
    try { pdfBase64 = await obtenerPdfBase64(result.Id); } catch {}

    const cfdiData = withPlantaTag({
      uuid:          result.Uuid,
      facturamaId:   result.Id,
      serie:         result.Serie ?? (body.serie ?? "P"),
      folio:         result.Folio ?? "",
      tipo:          "P" as const,
      emisorRfc:     body.emisorRfc,
      emisorNombre:  body.emisorNombre,
      clienteNombre: body.clienteNombre,
      clienteRfc:    body.clienteRfc,
      subtotal:      0,
      total:         body.monto,
      moneda:        body.facturaCurrency,
      metodoPago:    "PUE",
      formaPago:     body.formaPago,
      status:        "valid" as const,
      fechaTimbrado: result.Date,
      createdAt:     new Date().toISOString(),
      facturaRelacionadaUuid: body.facturaUuid,
    });

    await upsertDocument(COLLECTIONS.cfdiEmitidos, result.Uuid, cfdiData);

    return NextResponse.json({
      ok:          true,
      uuid:        result.Uuid,
      facturamaId: result.Id,
      folio:       result.Folio,
      pdfBase64,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
