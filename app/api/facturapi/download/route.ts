import { NextRequest, NextResponse } from "next/server";
import { getFacturApiKey, FACTURAPI_BASE, type Empresa } from "@/lib/facturapi";

// Proxy autenticado para descargar PDF/XML de FacturAPI.
// El browser no puede llamar a FacturAPI directamente porque requiere Bearer token.
// GET /api/facturapi/download?id={facturapiId}&format=pdf|xml&empresa=duro

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id      = searchParams.get("id");
    const format  = searchParams.get("format") ?? "pdf";
    const empresa = (searchParams.get("empresa") ?? "duro") as Empresa;

    if (!id) return new NextResponse("Parámetro id requerido", { status: 400 });
    if (format !== "pdf" && format !== "xml") return new NextResponse("format debe ser pdf o xml", { status: 400 });

    let apiKey: string;
    try {
      apiKey = getFacturApiKey(empresa);
    } catch (e) {
      return new NextResponse((e as Error).message, { status: 500 });
    }

    const upstream = await fetch(`${FACTURAPI_BASE}/invoices/${id}/${format}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!upstream.ok) {
      return new NextResponse(`Error FacturAPI: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = format === "pdf" ? "application/pdf" : "application/xml";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="factura-${id}.${format}"`,
        "Cache-Control":       "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[facturapi/download]", err);
    return new NextResponse("Error interno al descargar", { status: 500 });
  }
}
