import { NextRequest, NextResponse } from "next/server";
import { getFacturApiKey, FACTURAPI_BASE, type Empresa } from "@/lib/facturapi";

// Lista facturas emitidas desde FacturAPI
// GET /api/facturapi/facturas?empresa=duro&page=1&limit=50&start_date=2026-01-01&end_date=2026-12-31&type=I

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empresa = (searchParams.get("empresa") ?? "duro") as Empresa;

    let apiKey: string;
    try {
      apiKey = getFacturApiKey(empresa);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }

    const page      = searchParams.get("page") ?? "1";
    const limit     = searchParams.get("limit") ?? "50";
    const startDate = searchParams.get("start_date");
    const endDate   = searchParams.get("end_date");
    const type      = searchParams.get("type");

    const params = new URLSearchParams({ page, limit });
    if (startDate) params.set("start_date", startDate);
    if (endDate)   params.set("end_date", endDate);
    if (type)      params.set("type", type);

    const resp = await fetch(`${FACTURAPI_BASE}/invoices?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      const err = await resp.json();
      return NextResponse.json({ error: err.message ?? "Error en FacturAPI" }, { status: resp.status });
    }

    const data = await resp.json();

    const facturas = (data.data ?? []).map((f: Record<string, unknown>) => ({
      id:            f.id,
      uuid:          (f.stamp as Record<string, unknown>)?.uuid ?? "",
      folio:         f.folio_number,
      serie:         f.series,
      tipo:          f.type,
      clienteNombre: (f.customer as Record<string, unknown>)?.legal_name ?? "",
      clienteRfc:    (f.customer as Record<string, unknown>)?.tax_id ?? "",
      total:         f.total,
      subtotal:      f.subtotal,
      impuestos:     (f.taxes as Record<string, unknown>)?.total_transferred ?? 0,
      fechaTimbrado: (f.stamp as Record<string, unknown>)?.date ?? f.created_at,
      status:        f.status,
      pdfUrl:        `${FACTURAPI_BASE}/invoices/${f.id}/pdf`,
      xmlUrl:        `${FACTURAPI_BASE}/invoices/${f.id}/xml`,
      empresa,
    }));

    return NextResponse.json({
      facturas,
      total:      data.total_results ?? facturas.length,
      page:       Number(page),
      totalPages: Math.ceil((data.total_results ?? facturas.length) / Number(limit)),
    });
  } catch (err) {
    console.error("[facturapi/facturas]", err);
    return NextResponse.json({ error: "Error interno al listar facturas" }, { status: 500 });
  }
}
