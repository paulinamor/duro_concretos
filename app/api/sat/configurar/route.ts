import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Recibe .cer y .key como archivos (multipart FormData), los guarda como base64 en Firestore.
// La contraseña NO se guarda — se pide en cada sesión de descarga.

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

    // Validar que la e.firma sea válida antes de guardar
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
      return NextResponse.json({ error: `Error al leer la e.firma: ${(e as Error).message}` }, { status: 422 });
    }

    const db = getDb();
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
    return NextResponse.json({ error: "Error interno al guardar la configuración." }, { status: 500 });
  }
}
