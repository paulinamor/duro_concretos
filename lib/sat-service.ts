// Helper para crear el servicio SAT de descarga masiva.
// Usa ESM-only @nodecfdi/sat-ws-descarga-masiva con dynamic import para compatibilidad con webpack.

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export interface SatEfirmaConfig {
  certB64: string;
  keyB64: string;
  rfc: string;
  vigente?: string;
}

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey:    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

export async function getSatConfig(): Promise<SatEfirmaConfig | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, "configuracion", "sat_efirma"));
  if (!snap.exists()) return null;
  const data = snap.data() as SatEfirmaConfig;
  return data.certB64 && data.keyB64 ? data : null;
}

export async function buildSatService(certB64: string, keyB64: string, password: string) {
  const {
    Fiel, FielRequestBuilder, HttpsWebClient, Service,
  } = await import("@nodecfdi/sat-ws-descarga-masiva");

  const certBinary = Buffer.from(certB64, "base64").toString("binary");
  const keyBinary  = Buffer.from(keyB64,  "base64").toString("binary");

  const fiel = Fiel.create(certBinary, keyBinary, password);
  if (!fiel.isValid()) throw new Error("e.firma inválida o expirada. Verifica el archivo .cer, .key y la contraseña.");

  const builder   = new FielRequestBuilder(fiel);
  const webClient = new HttpsWebClient();
  return new Service(builder, webClient);
}
