import { NextRequest, NextResponse } from "next/server";

// Proxy autenticado para descargar PDF/XML de FacturAPI.
// El browser no puede llamar a FacturAPI directamente porque requiere Bearer token.
// GET /api/facturapi/download?id={facturapiId}&format=pdf|xml

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.FACTURAPI_KEY;
    if (!apiKey) {
      return new NextResponse("FACTURAPI_KEY no configurada", { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id     = searchParams.get("id");
    const format = searchParams.get("format") ?? "pdf"; // "pdf" | "xml"

    if (!id) {
      return new NextResponse("Parámetro id requerido", { status: 400 });
    }
    if (format !== "pdf" && format !== "xml") {
      return new NextResponse("format debe ser pdf o xml", { status: 400 });
    }

    const upstream = await fetch(
      `https://www.facturapi.io/v2/invoices/${id}/${format}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!upstream.ok) {
      return new NextResponse(`Error FacturAPI: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = format === "pdf" ? "application/pdf" : "application/xml";
    const disposition = `attachment; filename="factura-${id}.${format}"`;

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": disposition,
        "Cache-Control":       "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[facturapi/download]", err);
    return new NextResponse("Error interno al descargar", { status: 500 });
  }
}
