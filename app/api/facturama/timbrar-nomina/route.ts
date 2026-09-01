import { NextRequest, NextResponse } from "next/server";
import { facturamaFetch, facturamaBaseUrl, facturamaAuthHeader, type TimbrarNominaInput } from "@/lib/facturama";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FACTURAMA_USER || !process.env.FACTURAMA_PASSWORD) {
      return NextResponse.json({ error: "Facturama no configurado" }, { status: 503 });
    }

    const body = await req.json() as TimbrarNominaInput;

    if (!body.emisorRfc || !body.emisorNombre || !body.emisorRegimen) {
      return NextResponse.json(
        { error: "Se requiere emisorRfc, emisorNombre y emisorRegimen (Multiemisor)" },
        { status: 400 },
      );
    }

    const totalBruto = body.totalSueldos + body.totalExento;
    const deducciones = [
      { Key: "002", ConceptType: "002", Name: "ISR",  Amount: body.totalISR },
      { Key: "001", ConceptType: "001", Name: "IMSS", Amount: body.totalIMSS },
      ...(body.totalInfonavit
        ? [{ Key: "003", ConceptType: "003", Name: "INFONAVIT", Amount: body.totalInfonavit }]
        : []),
    ];

    const payload = {
      Serie: body.serie ?? "NOM",
      Date:  body.fechaPago,
      Type:  "N",
      PaymentMethod: "PUE",
      PaymentForm:   "99",
      Currency:      "MXN",
      Issuer: {
        Rfc:          body.emisorRfc,
        Name:         body.emisorNombre,
        FiscalRegime: body.emisorRegimen,
      },
      Receiver: {
        Rfc:          body.empleadoRfc,
        Name:         body.empleadoNombre,
        CfdiUse:      "CN01",
        TaxZipCode:   body.empleadoCodigoPostal,
        FiscalRegime: "605",
      },
      Items: [{
        ProductCode: "84111505",
        Description: "Pago de nómina",
        Unit:        "Actividad",
        UnitCode:    "ACT",
        UnitPrice:   totalBruto,
        Quantity:    1,
        Subtotal:    totalBruto,
        TaxObject:   "01",
        Total:       totalBruto,
      }],
      Payroll: {
        Type:               "O",
        PaymentDate:        body.fechaPago,
        InitialPaymentDate: body.fechaInicialPago,
        FinalPaymentDate:   body.fechaFinalPago,
        DaysPaid:           body.numDiasPagados,
        Employee: {
          Curp:                 body.empleadoCurp,
          SocialSecurityNumber: body.empleadoNss,
          ContractType:         "01",
          Periodicity:          body.periodicidad,
          FederalEntityKey:     "NL",
          PositionRisk:         "99",
          RegimenType:          "02",
          Unionized:            false,
          WorkShift:            "01",
          EmployeeNumber:       "001",
        },
        Earnings: [{
          Key:          "001",
          ConceptType:  "001",
          Name:         "Sueldo",
          TaxedAmount:  body.totalSueldos,
          ExemptAmount: body.totalExento,
        }],
        Deductions:    deducciones,
        OtherPayments: [],
      },
    };

    // Nómina usa /api/3/cfdis (no api-lite)
    const res = await fetch(`${facturamaBaseUrl}/api/3/cfdis`, {
      method: "POST",
      headers: {
        Authorization:  facturamaAuthHeader(),
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const errBody = await res.json();
        msg = errBody?.ModelState
          ? Object.values(errBody.ModelState).flat().join("; ")
          : errBody?.message ?? JSON.stringify(errBody);
      } catch {}
      return NextResponse.json({ error: `Facturama ${res.status}: ${msg}` }, { status: res.status });
    }

    const data = await res.json() as { Id: string; Uuid: string; Folio?: string; Date: string };

    let pdfBase64: string | undefined;
    try {
      const pdfRes = await facturamaFetch<{ Content: string }>(`/api-lite/3/cfdis/${data.Id}/pdf/issued`);
      pdfBase64 = pdfRes.Content;
    } catch {}

    return NextResponse.json({
      ok:          true,
      uuid:        data.Uuid,
      facturamaId: data.Id,
      folio:       data.Folio,
      pdfBase64,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
