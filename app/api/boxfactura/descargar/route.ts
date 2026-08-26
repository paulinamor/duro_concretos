import { NextRequest, NextResponse } from "next/server";

// BoxFactura SAT Web Service API v1.0
// Docs: https://satws.bxf.mx/
// Auth: header BXFSATWS-API-KEY
// Respuesta es asíncrona — BoxFactura llama al webhook cuando termina.

export interface SolicitarDescargaRequest {
  direccion: "emisor" | "receptor";
  tipo?: "cfdi" | "metadata";
  fechaInicio: string;                // YYYY-MM-DD
  fechaFin: string;                   // YYYY-MM-DD
  tipoDocumento?: "ingreso" | "egreso" | "traslado" | "nomina" | "pago";
  estadoDocumento?: "todos" | "vigente" | "cancelado";
  usarPortalCfdi?: boolean;           // true = usa CIEC en lugar de e.firma webservice
}

function getCredenciales() {
  const apiKey = process.env.BOXFACTURA_API_KEY;
  const rfc    = process.env.BOXFACTURA_RFC_DURO;
  const cert   = process.env.BOXFACTURA_EFIRMA_CERT_DURO;
  const key    = process.env.BOXFACTURA_EFIRMA_KEY_DURO;
  const pwd    = process.env.BOXFACTURA_EFIRMA_PASSWORD_DURO;

  if (!apiKey || !rfc || !cert || !key || !pwd) return null;
  return {
    apiKey,
    rfc,
    efirmaCertB64: cert,
    efirmaKeyB64:  key,
    efirmaPassword: pwd,
    ciecPassword: process.env.BOXFACTURA_CIEC_DURO,
  };
}

function b64ToBlob(b64: string, filename: string): Blob {
  const bytes = Buffer.from(b64, "base64");
  return new File([bytes], filename, { type: "application/octet-stream" });
}

export async function POST(req: NextRequest) {
  try {
    const body: SolicitarDescargaRequest = await req.json();

    const creds = getCredenciales();
    if (!creds) {
      return NextResponse.json(
        { error: "Credenciales de e.firma no configuradas. Revisa las variables de entorno BOXFACTURA_*." },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const webhookUrl = `${appUrl}/api/boxfactura/webhook`;

    const fechaInicio = `${body.fechaInicio}T00:00:00`;
    const fechaFin    = `${body.fechaFin}T23:59:59`;

    const form = new FormData();
    form.append("rfc",          creds.rfc);
    form.append("direccion",    body.direccion);
    form.append("tipo",         body.tipo ?? "cfdi");
    form.append("fecha_inicial", fechaInicio);
    form.append("fecha_final",   fechaFin);
    form.append("webhook",       webhookUrl);

    if (body.tipoDocumento)   form.append("tipo_documento",    body.tipoDocumento);
    if (body.estadoDocumento) form.append("estado_documento",  body.estadoDocumento);

    // SAT sólo permite vigente al descargar como receptor
    if (body.direccion === "receptor" && body.tipo === "cfdi" && !body.estadoDocumento) {
      form.append("estado_documento", "vigente");
    }

    const endpoint = body.usarPortalCfdi
      ? "https://satws.bxf.mx/v1.0/portalcfdi/solicita"
      : "https://satws.bxf.mx/v1.0/solicita";

    if (body.usarPortalCfdi && creds.ciecPassword) {
      form.append("ciec_password", creds.ciecPassword);
    } else {
      form.append("efirma_cert",         b64ToBlob(creds.efirmaCertB64, "efirma.cer"));
      form.append("efirma_key",          b64ToBlob(creds.efirmaKeyB64,  "efirma.key"));
      form.append("efirma_key_password", creds.efirmaPassword);
    }

    const resp = await fetch(endpoint, {
      method:  "POST",
      headers: { "BXFSATWS-API-KEY": creds.apiKey },
      body:    form,
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("[boxfactura/descargar] Error:", data);
      return NextResponse.json(
        { error: data.mensaje ?? data.message ?? "Error en BoxFactura API", details: data },
        { status: resp.status },
      );
    }

    return NextResponse.json({
      idSolicitud:  data.id_solicitud,
      codigoStatus: data.codigo_status,
      mensaje:      data.mensaje ?? "Solicitud aceptada",
      rfc:          creds.rfc,
      direccion:    body.direccion,
      fechaInicio:  body.fechaInicio,
      fechaFin:     body.fechaFin,
      webhookUrl,
    });
  } catch (err) {
    console.error("[boxfactura/descargar]", err);
    return NextResponse.json({ error: "Error interno al solicitar descarga masiva" }, { status: 500 });
  }
}
