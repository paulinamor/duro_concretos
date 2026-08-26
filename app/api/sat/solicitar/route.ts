import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getSatConfig, buildSatService } from "@/lib/sat-service";

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

export interface SolicitarBody {
  password: string;
  fechaInicio: string;   // YYYY-MM-DD
  fechaFin: string;      // YYYY-MM-DD
  direccion: "emitidos" | "recibidos";
  tipo: "cfdi" | "metadata";
  tipoDocumento?: "ingreso" | "egreso" | "traslado" | "nomina" | "pago";
}

export async function POST(req: NextRequest) {
  try {
    const body: SolicitarBody = await req.json();
    const { password, fechaInicio, fechaFin, direccion, tipo, tipoDocumento } = body;

    if (!password || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
    }

    const cfg = await getSatConfig();
    if (!cfg) return NextResponse.json({ error: "e.firma no configurada. Ve a Configuración > Descarga SAT." }, { status: 404 });

    const service = await buildSatService(cfg.certB64, cfg.keyB64, password);

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

    // Guardar en Firestore para historial
    const db = getDb();
    await setDoc(doc(db, "descargasSAT", requestId), {
      requestId,
      rfc:          cfg.rfc,
      status:       "pendiente",
      direccion,
      tipo,
      tipoDocumento: tipoDocumento ?? null,
      fechaInicio,
      fechaFin,
      packageIds:   [],
      solicitadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    });

    return NextResponse.json({ requestId, rfc: cfg.rfc });
  } catch (err) {
    console.error("[sat/solicitar]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Error al solicitar descarga." }, { status: 500 });
  }
}
