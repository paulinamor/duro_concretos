import { NextResponse } from "next/server";
import { parseSgpResponse } from "@/lib/sgp";

// Webhook endpoint — Sybil pushes the XML "regreso" here after processing a pedido.
// Sybil must be configured to POST to: https://<tu-dominio>/api/sgp/regreso
//
// Security: validate the shared secret in the Authorization header.
// Set SGP_WEBHOOK_SECRET in .env.local and give it to Sybil for the Authorization value.
//
// Firestore write: this route parses and returns the data. To persist it,
// add firebase-admin (npm i firebase-admin) and initialize with your service account.
// The parsed data contains remisiones with timestamps that auto-fill transporte/programacion.

const WEBHOOK_SECRET = process.env.SGP_WEBHOOK_SECRET ?? "";

export async function POST(req: Request) {
  // Validate shared secret if configured
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get("authorization") ?? req.headers.get("x-sgp-secret") ?? "";
    if (auth !== WEBHOOK_SECRET) {
      console.warn("[SGP] regreso: unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: string;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await req.json() as { xml?: string };
    body = json.xml ?? "";
  } else {
    body = await req.text();
  }

  if (!body) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const parsed = parseSgpResponse(body);
  if (!parsed) {
    console.warn("[SGP] regreso: could not parse pedido from body");
    return NextResponse.json({ error: "No se pudo parsear el XML" }, { status: 422 });
  }

  console.info(
    `[SGP] regreso: pedido ${parsed.serie}-${parsed.numero} | planta ${parsed.plantaGenera} | ${parsed.remisiones.length} remisiones`,
  );

  // TODO: Persist to Firestore using firebase-admin.
  // Match by sgpSerie + sgpNumero on the programaciones collection, then
  // update the chofer rows with the remision timestamps.
  //
  // Example (requires firebase-admin setup):
  // const snap = await adminDb.collection("programaciones")
  //   .where("sgpSerie", "==", parsed.serie)
  //   .where("sgpNumero", "==", parsed.numero)
  //   .limit(1).get();
  // if (!snap.empty) {
  //   await snap.docs[0].ref.update({ sgpRemisiones: parsed.remisiones });
  // }

  return NextResponse.json({ ok: true, pedido: parsed });
}
