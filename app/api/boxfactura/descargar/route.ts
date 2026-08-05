import { NextRequest, NextResponse } from "next/server";

// BoxFactura Descarga Masiva SAT
// Documentación: https://www.boxfactura.com/info/api-descarga-masiva

export interface DescargaMasivaRequest {
  tipo: "emitidas" | "recibidas";
  fechaInicio: string;   // YYYY-MM-DD
  fechaFin: string;      // YYYY-MM-DD
  rfc?: string;          // Si no se pasa, usa el RFC configurado en BoxFactura
}

export async function POST(req: NextRequest) {
  try {
    const body: DescargaMasivaRequest = await req.json();

    const apiKey = process.env.BOXFACTURA_API_KEY;
    const rfcEnv = process.env.BOXFACTURA_RFC;

    if (!apiKey) {
      return NextResponse.json({ error: "BOXFACTURA_API_KEY no configurada" }, { status: 500 });
    }

    const rfc = body.rfc ?? rfcEnv;
    if (!rfc) {
      return NextResponse.json({ error: "RFC no proporcionado ni configurado en env" }, { status: 400 });
    }

    // Solicitar descarga masiva a BoxFactura
    const resp = await fetch("https://api.boxfactura.com/v1/descarga-masiva/solicitar", {
      method:  "POST",
      headers: {
        "x-api-key":    apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rfc,
        tipo:         body.tipo === "emitidas" ? "CFDI_EMITIDOS" : "CFDI_RECIBIDOS",
        fecha_inicio: body.fechaInicio,
        fecha_fin:    body.fechaFin,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("[boxfactura/descargar] Error:", err);
      return NextResponse.json({ error: "Error en BoxFactura API", details: err }, { status: resp.status });
    }

    const data = await resp.json();

    // BoxFactura regresa un ID de solicitud — el procesamiento es asíncrono
    return NextResponse.json({
      solicitudId: data.id ?? data.solicitud_id,
      status:      data.status ?? "procesando",
      mensaje:     "Solicitud enviada. Consulta el estado con GET /api/boxfactura/descargar?id={solicitudId}",
    });
  } catch (err) {
    console.error("[boxfactura/descargar]", err);
    return NextResponse.json({ error: "Error interno al solicitar descarga masiva" }, { status: 500 });
  }
}

// Consultar estado de una solicitud de descarga
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const solicitudId = searchParams.get("id");

    if (!solicitudId) {
      return NextResponse.json({ error: "Parámetro id requerido" }, { status: 400 });
    }

    const apiKey = process.env.BOXFACTURA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "BOXFACTURA_API_KEY no configurada" }, { status: 500 });
    }

    const resp = await fetch(`https://api.boxfactura.com/v1/descarga-masiva/estado/${solicitudId}`, {
      headers: { "x-api-key": apiKey },
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: "Error consultando estado", details: err }, { status: resp.status });
    }

    const data = await resp.json();

    return NextResponse.json({
      solicitudId,
      status:   data.status,
      total:    data.total ?? 0,
      paquetes: data.paquetes ?? [],
      cfdis:    data.cfdis ?? [],
    });
  } catch (err) {
    console.error("[boxfactura/estado]", err);
    return NextResponse.json({ error: "Error consultando estado de descarga" }, { status: 500 });
  }
}
