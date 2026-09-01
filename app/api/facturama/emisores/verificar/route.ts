import { NextRequest, NextResponse } from "next/server";
import { X509Certificate } from "crypto";

// POST /api/facturama/emisores/verificar
// Body: { certificate: string (base64 del .cer) }
// Parsea el certificado SAT y extrae RFC, nombre y fechas de vigencia.
// NO registra nada en Facturama — es solo lectura del archivo.
export async function POST(req: NextRequest) {
  try {
    const { certificate } = await req.json() as { certificate: string };
    if (!certificate) {
      return NextResponse.json({ error: "certificate es requerido" }, { status: 400 });
    }

    const certBuffer = Buffer.from(certificate, "base64");
    const x509 = new X509Certificate(certBuffer);

    // El subject de los CSDs del SAT tiene este formato:
    // SERIALNUMBER=RFC\nCN=NOMBRE\nO=NOMBRE\nC=MX\n...
    const subjectParts: Record<string, string> = {};
    x509.subject.split("\n").forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      subjectParts[key] = val;
    });

    // RFC viene en SERIALNUMBER o en el OID 2.5.4.5
    const rfc    = subjectParts["SERIALNUMBER"] ?? subjectParts["2.5.4.5"] ?? "";
    // Nombre/razón social
    const nombre = subjectParts["O"] ?? subjectParts["CN"] ?? "";

    const validTo  = x509.validTo;
    const validFrom = x509.validFrom;

    const expired = new Date(validTo) < new Date();

    return NextResponse.json({
      ok: true,
      rfc,
      nombre,
      validFrom,
      validTo,
      expired,
      numeroCertificado: x509.serialNumber,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudo leer el certificado: ${msg}` },
      { status: 400 },
    );
  }
}
