import { NextRequest, NextResponse } from "next/server";
import { buildCfdiPayload, emitirCfdi, obtenerPdfBase64, type EmitirFacturaInput } from "@/lib/facturama";
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

    const body = await req.json() as EmitirFacturaInput;

    if (!body.emisorRfc || !body.emisorNombre || !body.emisorRegimen) {
      return NextResponse.json(
        { error: "Se requiere emisorRfc, emisorNombre y emisorRegimen (Multiemisor)" },
        { status: 400 },
      );
    }

    const payload = buildCfdiPayload(body);
    const result  = await emitirCfdi(payload);

    let pdfBase64: string | undefined;
    try { pdfBase64 = await obtenerPdfBase64(result.Id); } catch {}

    const cfdiData = withPlantaTag({
      uuid:          result.Uuid,
      facturamaId:   result.Id,
      serie:         result.Serie ?? (body.serie ?? process.env.FACTURAMA_SERIE ?? "A"),
      folio:         result.Folio ?? "",
      tipo:          body.tipoComprobante ?? "I",
      emisorRfc:     body.emisorRfc,
      emisorNombre:  body.emisorNombre,
      clienteNombre: body.clienteNombre,
      clienteRfc:    body.clienteRfc,
      clienteEmail:  body.clienteEmail ?? "",
      clienteCp:     body.clienteCp,
      clienteRegimenFiscal: body.clienteRegimenFiscal,
      usoCfdi:       body.usoCfdi,
      subtotal:      body.conceptos.reduce((s, c) => s + c.importe, 0),
      total:         result.Total,
      moneda:        body.moneda,
      metodoPago:    body.metodoPago,
      formaPago:     body.formaPago,
      conceptos:     body.conceptos,
      status:        "valid" as const,
      fechaTimbrado: result.Date,
      createdAt:     new Date().toISOString(),
    });

    await upsertDocument(COLLECTIONS.cfdiEmitidos, result.Uuid, cfdiData);

    return NextResponse.json({
      ok:          true,
      uuid:        result.Uuid,
      facturamaId: result.Id,
      folio:       result.Folio,
      total:       result.Total,
      pdfBase64,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
