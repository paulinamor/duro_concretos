import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Devuelve la configuración SGP desde las variables de entorno.
// Los valores se leen en el servidor — nunca se exponen en el bundle del cliente.
export async function GET() {
  const endpoint     = process.env.SGP_ENDPOINT      ?? "";
  const usuario      = process.env.SGP_USUARIO        ?? "";
  const claveAllende = process.env.SGP_PLANTA_CLAVE_ALLENDE   ?? "";
  const clavePesqueria = process.env.SGP_PLANTA_CLAVE_PESQUERIA ?? "";

  const configured = !!(usuario && (claveAllende || clavePesqueria));

  return NextResponse.json({ endpoint, usuario, claveAllende, clavePesqueria, configured });
}
