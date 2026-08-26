import { NextResponse } from "next/server";
import { getSatConfig } from "@/lib/sat-service";
// Uses lib/firebase via sat-service (no local getDb needed)

// GET /api/sat/config-status — devuelve si hay e.firma configurada y cuál RFC
export async function GET() {
  try {
    const cfg = await getSatConfig();
    if (!cfg) return NextResponse.json({ config: null });
    return NextResponse.json({
      config: { rfc: cfg.rfc, activo: true },
    });
  } catch {
    return NextResponse.json({ config: null });
  }
}
