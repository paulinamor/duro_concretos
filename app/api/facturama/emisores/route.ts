import { NextRequest, NextResponse } from "next/server";
import { listarCsds, registrarCsd, actualizarCsd, type FmCsdInput } from "@/lib/facturama";

// GET /api/facturama/emisores — lista los CSDs registrados
export async function GET() {
  try {
    if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
      return NextResponse.json({ error: "Facturama no configurado" }, { status: 503 });
    }
    const csds = await listarCsds();
    return NextResponse.json({ ok: true, emisores: csds });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/facturama/emisores
// Body: { rfc, nombre, certificate (base64), privateKey (base64), privateKeyPassword, regimen }
// Registra o actualiza el CSD de un emisor en Facturama Multiemisor.
export async function POST(req: NextRequest) {
  try {
    if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
      return NextResponse.json({ error: "Facturama no configurado" }, { status: 503 });
    }

    const body = await req.json() as {
      rfc: string;
      certificate: string;
      privateKey: string;
      privateKeyPassword: string;
      actualizar?: boolean;
    };

    const { rfc, certificate, privateKey, privateKeyPassword, actualizar } = body;

    if (!rfc || !certificate || !privateKey || !privateKeyPassword) {
      return NextResponse.json(
        { error: "Se requiere rfc, certificate, privateKey y privateKeyPassword" },
        { status: 400 },
      );
    }

    const csdInput: FmCsdInput = {
      Rfc:                rfc.toUpperCase(),
      Certificate:        certificate,
      PrivateKey:         privateKey,
      PrivateKeyPassword: privateKeyPassword,
    };

    const result = actualizar
      ? await actualizarCsd(csdInput)
      : await registrarCsd(csdInput);

    return NextResponse.json({ ok: true, emisor: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Si el CSD ya existe, sugerir usar actualizar: true
    if (msg.includes("409") || msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("ya existe")) {
      return NextResponse.json(
        { error: "El RFC ya tiene un CSD registrado. Envía actualizar: true para reemplazarlo.", code: "ALREADY_EXISTS" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
