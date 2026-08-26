import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Recibe .cer y .key como archivos (multipart FormData), los guarda como base64 en Firestore.
// La contraseña NO se guarda — se pide en cada sesión de descarga.

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const cerFile = form.get("cer") as File | null;
    const keyFile = form.get("key") as File | null;
    const password = (form.get("password") as string | null)?.trim() ?? "";

    if (!cerFile || !keyFile || !password) {
      return NextResponse.json({ error: "Se requieren los archivos .cer, .key y la contraseña." }, { status: 400 });
    }

    const certB64 = await fileToBase64(cerFile);
    const keyB64  = await fileToBase64(keyFile);

    // Validar e.firma antes de guardar
    const { Fiel } = await import("@nodecfdi/sat-ws-descarga-masiva");
    const certBinary = Buffer.from(certB64, "base64").toString("binary");
    const keyBinary  = Buffer.from(keyB64,  "base64").toString("binary");

    let rfc = "";
    try {
      const fiel = Fiel.create(certBinary, keyBinary, password);
      if (!fiel.isValid()) {
        return NextResponse.json({ error: "e.firma inválida o expirada. Verifica los archivos y la contraseña." }, { status: 422 });
      }
      rfc = fiel.getRfc();
    } catch (e) {
      return NextResponse.json({ error: `e.firma incorrecta: ${(e as Error).message}` }, { status: 422 });
    }

    if (!db) return NextResponse.json({ error: "Firebase no configurado." }, { status: 500 });
    await setDoc(doc(db, "configuracion", "sat_efirma"), {
      certB64,
      keyB64,
      rfc,
      activo: true,
      configuradoEn: serverTimestamp(),
    });

    return NextResponse.json({ ok: true, rfc });
  } catch (err) {
    console.error("[sat/configurar]", err);
    return NextResponse.json({ error: `Error al guardar: ${(err as Error).message}` }, { status: 500 });
  }
}
