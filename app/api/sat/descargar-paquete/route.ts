import { NextRequest, NextResponse } from "next/server";
import { getSatConfig, buildSatService } from "@/lib/sat-service";

// POST /api/sat/descargar-paquete  { packageId, password }
// Devuelve el ZIP como base64 para que el cliente lo descargue directamente.

export async function POST(req: NextRequest) {
  try {
    const { packageId, password } = await req.json() as { packageId: string; password: string };

    if (!packageId || !password) {
      return NextResponse.json({ error: "packageId y password requeridos." }, { status: 400 });
    }

    const cfg = await getSatConfig();
    if (!cfg) return NextResponse.json({ error: "e.firma no configurada." }, { status: 404 });

    const service = await buildSatService(cfg.certB64, cfg.keyB64, password);
    const result  = await service.download(packageId);

    if (!result.getStatus().isAccepted()) {
      return NextResponse.json({ error: `SAT rechazó la descarga: ${result.getStatus().getMessage()}` }, { status: 422 });
    }

    const zipBase64 = result.getPackageContent();

    // Devuelve el ZIP directamente como binary para descarga en el browser
    const zipBytes = Buffer.from(zipBase64, "base64");
    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        "Content-Type":        "application/zip",
        "Content-Disposition": `attachment; filename="cfdi-${packageId}.zip"`,
        "Content-Length":      String(zipBytes.length),
      },
    });
  } catch (err) {
    console.error("[sat/descargar-paquete]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Error al descargar paquete." }, { status: 500 });
  }
}
