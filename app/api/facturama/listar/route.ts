import { NextRequest, NextResponse } from "next/server";
import { facturamaFetch } from "@/lib/facturama";

// Campos que devuelve Facturama para CFDIs listados
export interface FmCfdiListItem {
  Id:             string;
  Serie:          string;
  Folio:          string;
  Date:           string;
  CfdiType:       string;
  Issuer: {
    Rfc:          string;
    Name:         string;
    FiscalRegime: string;
  };
  Receiver: {
    Rfc:          string;
    Name:         string;
  };
  Total:          number;
  Currency:       string;
  PaymentMethod:  string;
  Status:         string;
  Complement?: {
    TaxStamp?: {
      Uuid: string;
    };
  };
}

// GET /api/facturama/listar?rfc={rfc}&type=issued|received
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rfc  = searchParams.get("rfc");
  const type = searchParams.get("type") ?? "issued";

  if (type !== "issued" && type !== "received") {
    return NextResponse.json({ error: "type debe ser issued o received" }, { status: 400 });
  }

  try {
    const qs = rfc ? `?type=${type}&rfc=${encodeURIComponent(rfc)}` : `?type=${type}`;
    const data = await facturamaFetch<FmCfdiListItem[]>(`/api-lite/cfdis${qs}`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
