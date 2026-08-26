import { NextRequest, NextResponse } from "next/server";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

// BoxFactura llama a este endpoint cuando termina de procesar la descarga masiva.
// Guarda el resultado en Firestore (collection: descargasSAT) para que el front lo consulte.

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      apiKey:    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

interface WebhookPayload {
  id_solicitud: string;
  rfc: string;
  cfdi_encontrados?: number;
  urls?: string[];
  paquetes?: string[];
  // Error fields (PortalCFDI)
  error?: string;
  error_message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WebhookPayload = await req.json();

    if (!body.id_solicitud) {
      return NextResponse.json({ error: "id_solicitud requerido" }, { status: 400 });
    }

    const isError = !!body.error;

    const db = getDb();
    await setDoc(
      doc(db, "descargasSAT", body.id_solicitud),
      {
        idSolicitud:     body.id_solicitud,
        rfc:             body.rfc,
        cfdiEncontrados: body.cfdi_encontrados ?? 0,
        urls:            body.urls ?? [],
        paquetes:        body.paquetes ?? [],
        status:          isError ? "error" : "listo",
        error:           body.error ?? null,
        errorMensaje:    body.error_message ?? null,
        actualizadoEn:   serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`[boxfactura/webhook] Solicitud ${body.id_solicitud}: ${isError ? `error ${body.error}` : `${body.cfdi_encontrados} CFDIs listos`}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[boxfactura/webhook]", err);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
}
