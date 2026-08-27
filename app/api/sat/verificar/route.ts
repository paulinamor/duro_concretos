import { NextRequest, NextResponse } from "next/server";
import { buildSatService } from "@/lib/sat-service";
// certB64/keyB64 vienen del cliente (tiene sesión autenticada y los leyó de Firestore)

// POST /api/sat/verificar  { requestId, password, certB64, keyB64 }
export async function POST(req: NextRequest) {
  try {
    const { requestId, password, certB64, keyB64 } = await req.json() as {
      requestId: string; password: string; certB64: string; keyB64: string;
    };

    if (!requestId || !password || !certB64 || !keyB64) {
      return NextResponse.json({ error: "requestId, password, certB64 y keyB64 requeridos." }, { status: 400 });
    }

    const service = await buildSatService(certB64, keyB64, password);

    let result;
    try {
      result = await service.verify(requestId);
    } catch (libErr) {
      const msg = (libErr as Error).message ?? "";
      // La librería lanza este error cuando el SAT devuelve un HTTP error en lugar de SOAP
      if (msg.includes("getResponse") || msg.includes("not a function")) {
        return NextResponse.json({
          status: "error",
          mensaje: "El SAT devolvió una respuesta inesperada. La solicitud puede haber expirado.",
          packageIds: [],
        });
      }
      throw libErr;
    }

    const statusRequest = result.getStatusRequest();
    const satStatus     = statusRequest.isTypeOf("Finished") ? "listo"
      : statusRequest.isTypeOf("Failure") || statusRequest.isTypeOf("Rejected") || statusRequest.isTypeOf("Expired") ? "error"
      : "procesando";

    const packageIds = satStatus === "listo" ? result.getPackageIds() : [];

    return NextResponse.json({
      status:  satStatus,
      mensaje: result.getStatus().getMessage(),
      packageIds,
    });
  } catch (err) {
    console.error("[sat/verificar]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Error al verificar." }, { status: 500 });
  }
}
