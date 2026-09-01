import { NextResponse } from "next/server";
import { facturamaFetch, facturamaBaseUrl, type FmCsdInfo } from "@/lib/facturama";

// GET /api/facturama/test
// Verifica conectividad con Facturama y lista los emisores registrados.
// Úsalo para confirmar que las credenciales funcionan antes de timbrar.
export async function GET() {
  const sandbox = process.env.FACTURAMA_SANDBOX === "true";

  if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
    return NextResponse.json({
      ok:    false,
      error: "Variables FACTURAMA_USER y FACTURAMA_PASSWORD no configuradas",
    }, { status: 503 });
  }

  try {
    const emisores = await facturamaFetch<FmCsdInfo[]>("/api-lite/csds");
    return NextResponse.json({
      ok:       true,
      sandbox,
      endpoint: facturamaBaseUrl,
      usuario:  process.env.FACTURAMA_USER,
      emisores: emisores ?? [],
      mensaje:  emisores?.length
        ? `${emisores.length} emisor(es) registrado(s)`
        : "Conectado. Aún no hay emisores — registra el primero en /api/facturama/emisores",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok:    false,
      sandbox,
      error: msg,
    }, { status: 500 });
  }
}
