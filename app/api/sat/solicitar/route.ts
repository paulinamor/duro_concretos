import { NextRequest, NextResponse } from "next/server";
import { buildSatService } from "@/lib/sat-service";
// certB64/keyB64 vienen del cliente (tiene sesión autenticada y los leyó de Firestore)

export interface SolicitarBody {
  password: string;
  certB64: string;
  keyB64: string;
  fechaInicio: string;   // YYYY-MM-DD
  fechaFin: string;      // YYYY-MM-DD
  direccion: "emitidos" | "recibidos";
  tipo: "cfdi" | "metadata";
  tipoDocumento?: "ingreso" | "egreso" | "traslado" | "nomina" | "pago";
}

export async function POST(req: NextRequest) {
  try {
    const body: SolicitarBody = await req.json();
    const { password, certB64, keyB64, fechaInicio, fechaFin, direccion, tipo, tipoDocumento } = body;

    if (!password || !certB64 || !keyB64 || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
    }

    const service = await buildSatService(certB64, keyB64, password);

    const {
      QueryParameters, DateTimePeriod, DownloadType, RequestType, DocumentType,
    } = await import("@nodecfdi/sat-ws-descarga-masiva");

    const period = DateTimePeriod.createFromValues(
      `${fechaInicio} 00:00:00`,
      `${fechaFin} 23:59:59`,
    );

    let params = QueryParameters.create(period)
      .withDownloadType(new DownloadType(direccion === "emitidos" ? "issued" : "received"))
      .withRequestType(new RequestType(tipo === "cfdi" ? "xml" : "metadata"));

    if (tipoDocumento) {
      params = params.withDocumentType(new DocumentType(tipoDocumento));
    }

    const result = await service.query(params);

    if (!result.getStatus().isAccepted()) {
      return NextResponse.json({ error: `SAT rechazó la solicitud: ${result.getStatus().getMessage()}` }, { status: 422 });
    }

    const requestId = result.getRequestId();

    // El cliente guarda en Firestore con su sesión autenticada
    return NextResponse.json({
      requestId,
      // Datos para que el cliente construya el doc de Firestore
      direccion, tipo, tipoDocumento: tipoDocumento ?? null, fechaInicio, fechaFin,
    });
  } catch (err) {
    console.error("[sat/solicitar]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Error al solicitar descarga." }, { status: 500 });
  }
}
