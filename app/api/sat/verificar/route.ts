import { NextRequest, NextResponse } from "next/server";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSatConfig, buildSatService } from "@/lib/sat-service";

// POST /api/sat/verificar  { requestId, password }
export async function POST(req: NextRequest) {
  try {
    const { requestId, password } = await req.json() as { requestId: string; password: string };

    if (!requestId || !password) {
      return NextResponse.json({ error: "requestId y password requeridos." }, { status: 400 });
    }

    const cfg = await getSatConfig();
    if (!cfg) return NextResponse.json({ error: "e.firma no configurada." }, { status: 404 });

    const service = await buildSatService(cfg.certB64, cfg.keyB64, password);
    const result  = await service.verify(requestId);

    const statusRequest = result.getStatusRequest();
    const satStatus     = statusRequest.isTypeOf("Finished") ? "listo"
      : statusRequest.isTypeOf("Failure") || statusRequest.isTypeOf("Rejected") || statusRequest.isTypeOf("Expired") ? "error"
      : "procesando";

    const packageIds = satStatus === "listo" ? result.getPackageIds() : [];

    // Actualizar Firestore
    if (!db) return NextResponse.json({ error: "Firebase no configurado." }, { status: 500 });
    await updateDoc(doc(db, "descargasSAT", requestId), {
      status:       satStatus,
      packageIds,
      actualizadoEn: serverTimestamp(),
    });

    return NextResponse.json({
      status:    satStatus,
      mensaje:   result.getStatus().getMessage(),
      packageIds,
    });
  } catch (err) {
    console.error("[sat/verificar]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Error al verificar." }, { status: 500 });
  }
}
