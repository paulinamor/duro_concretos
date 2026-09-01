import { NextRequest, NextResponse } from "next/server";
import { obtenerCsd, eliminarCsd } from "@/lib/facturama";

// GET /api/facturama/emisores/[rfc] — info del CSD de un emisor
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ rfc: string }> },
) {
  try {
    const { rfc } = await params;
    const csd = await obtenerCsd(rfc.toUpperCase());
    return NextResponse.json({ ok: true, emisor: csd });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/facturama/emisores/[rfc] — elimina el CSD de un emisor
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ rfc: string }> },
) {
  try {
    const { rfc } = await params;
    await eliminarCsd(rfc.toUpperCase());
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
