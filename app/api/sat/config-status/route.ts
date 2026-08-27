import { NextResponse } from "next/server";

// El cliente lee la config de Firestore directamente (tiene sesión autenticada).
// Este endpoint ya no es necesario — se mantiene por compatibilidad pero devuelve 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}
