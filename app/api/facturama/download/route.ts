import { NextRequest, NextResponse } from "next/server";
import { facturamaFetch } from "@/lib/facturama";

// GET /api/facturama/download?id={facturamaId}&format=pdf|xml
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id     = searchParams.get("id");
  const format = searchParams.get("format") ?? "pdf";

  if (!id) return new NextResponse("Parámetro id requerido", { status: 400 });
  if (format !== "pdf" && format !== "xml") return new NextResponse("format debe ser pdf o xml", { status: 400 });

  try {
    const data = await facturamaFetch<{ Content: string }>(
      `/api-lite/3/cfdis/${id}/${format}/issued`,
    );
    const bytes       = Buffer.from(data.Content, "base64");
    const contentType = format === "pdf" ? "application/pdf" : "application/xml";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="factura-${id}.${format}"`,
        "Cache-Control":       "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
