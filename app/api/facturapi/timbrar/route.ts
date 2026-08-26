import { NextRequest, NextResponse } from "next/server";
import { getFacturApiKey, FACTURAPI_BASE, type Empresa } from "@/lib/facturapi";

export interface TimbrarFacturaRequest {
  empresa?: Empresa;            // "duro" | "grupo_jc" — default "duro"
  tipo: "I" | "E" | "T";       // Ingreso | Egreso | Traslado
  clienteRfc: string;
  clienteNombre: string;
  clienteRegimenFiscal: string; // Clave SAT, ej. "601"
  clienteCodigoPostal: string;
  clienteEmail?: string;
  usoCFDI: string;              // Clave SAT, ej. "G03"
  metodoPago: "PUE" | "PPD";
  formaPago: string;            // Clave SAT, ej. "03" = transferencia
  serie?: string;
  conceptos: Array<{
    descripcion:   string;
    cantidad:      number;
    precio:        number;      // precio unitario SIN IVA
    claveProducto: string;      // clave SAT del producto/servicio
    claveUnidad:   string;      // clave SAT de unidad, ej. "H87" = pieza
    tasaIVA?:      number;      // default 0.16
  }>;
  cartaPorte?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body: TimbrarFacturaRequest = await req.json();

    let apiKey: string;
    try {
      apiKey = getFacturApiKey(body.empresa ?? "duro");
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }

    const items = body.conceptos.map((c) => ({
      quantity: c.cantidad,
      product: {
        description:  c.descripcion,
        price:        c.precio,
        tax_included: false,
        product_key:  c.claveProducto,
        unit_key:     c.claveUnidad,
        taxes: [{ type: "IVA", rate: c.tasaIVA ?? 0.16, factor: "Tasa" }],
      },
    }));

    const payload: Record<string, unknown> = {
      type:           body.tipo,
      payment_method: body.metodoPago,
      payment_form:   body.formaPago,
      use:            body.usoCFDI,
      serie:          body.serie,
      customer: {
        legal_name: body.clienteNombre,
        tax_id:     body.clienteRfc,
        tax_system: body.clienteRegimenFiscal,
        email:      body.clienteEmail,
        address:    { zip: body.clienteCodigoPostal },
      },
      items,
    };

    if (body.cartaPorte) {
      payload.complements = [{ type: "carta_porte", data: body.cartaPorte }];
    }

    const resp = await fetch(`${FACTURAPI_BASE}/invoices`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[timbrar] FacturAPI error:", data);
      return NextResponse.json({ error: data.message ?? "Error en FacturAPI", details: data }, { status: resp.status });
    }

    return NextResponse.json({
      uuid:          data.uuid,
      folio:         data.folio_number,
      serie:         data.series,
      fechaTimbrado: data.stamp?.date,
      total:         data.total,
      pdfUrl:        `${FACTURAPI_BASE}/invoices/${data.id}/pdf`,
      xmlUrl:        `${FACTURAPI_BASE}/invoices/${data.id}/xml`,
      id:            data.id,
    });
  } catch (err) {
    console.error("[timbrar]", err);
    return NextResponse.json({ error: "Error interno al timbrar factura" }, { status: 500 });
  }
}
