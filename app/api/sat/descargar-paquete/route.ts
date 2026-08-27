import { NextRequest, NextResponse } from "next/server";
import { buildSatService } from "@/lib/sat-service";

// POST /api/sat/descargar-paquete  { packageId, password, certB64, keyB64 }
// certB64/keyB64 vienen del cliente (tiene sesión autenticada y los leyó de Firestore)

export async function POST(req: NextRequest) {
  try {
    const { packageId, password, certB64, keyB64 } = await req.json() as {
      packageId: string; password: string; certB64: string; keyB64: string;
    };

    if (!packageId || !password || !certB64 || !keyB64) {
      return NextResponse.json({ error: "packageId, password, certB64 y keyB64 requeridos." }, { status: 400 });
    }

    const service = await buildSatService(certB64, keyB64, password);
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
