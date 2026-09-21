import { NextRequest, NextResponse } from "next/server";

// PUT /api/facturama/logo
// Solo valida el payload. El cliente guarda el logo en Firestore directamente
// (el cliente tiene auth context; las API routes no tienen Firebase Admin SDK).
export async function PUT(req: NextRequest) {
  try {
    const { logoBase64, mimeType } = await req.json() as {
      logoBase64: string;
      mimeType: string;
    };

    if (!logoBase64 || !mimeType) {
      return NextResponse.json({ error: "Se requiere logoBase64 y mimeType" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
