import { NextRequest, NextResponse } from "next/server";
import { facturamaBaseUrl, facturamaAuthHeader, type TimbrarNominaInput } from "@/lib/facturama";

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

    const folioNum = body.folio ?? String(Date.now()).slice(-6);
    const dateWithTime = body.fechaPago.includes("T")
      ? body.fechaPago
      : `${body.fechaPago}T12:00:00`;

    const payload = {
      NameId:          "16",
      CfdiType:        "N",
      Serie:           body.serie ?? "NOM",
      Folio:           folioNum,
      Date:            dateWithTime,
      ExpeditionPlace: body.emisorCp,
      PaymentMethod:   "PUE",
      Currency:        "MXN",
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
      Complemento: {
        Payroll: {
          Type:               "O",
          PaymentDate:        body.fechaPago,
          InitialPaymentDate: body.fechaInicialPago,
          FinalPaymentDate:   body.fechaFinalPago,
          DaysPaid:           body.numDiasPagados,
          Issuer: {
            // Curp solo para Persona Física — omitir para Persona Moral (SAT rechaza el campo)
            ...(body.curpEmisor ? { Curp: body.curpEmisor } : {}),
            EmployerRegistration: body.registroPatronal ?? "",
          },
          Employee: {
            Curp:                      body.empleadoCurp,
            SocialSecurityNumber:      body.empleadoNss,
            StartDateLaborRelations:   body.fechaInicioLaboral ?? "2020-01-01",
            ContractType:              "01",
            Unionized:                 false,
            TypeOfJourney:             "01",
            RegimeType:                "02",
            EmployeeNumber:            body.empleadoNumero ?? "001",
            FrequencyPayment:          body.periodicidad,
            FederalEntityKey:          body.claveEntidadFed ?? "NLE",
            PositionRisk:              "1",
            BaseSalary:                body.salarioBase ?? body.totalSueldos / body.numDiasPagados,
            DailySalary:               body.salarioDiario ?? body.totalSueldos / body.numDiasPagados,
          },
          Perceptions: {
            Details: [{
              PerceptionType: "001",
              Code:           "P001",
              Description:    "Sueldo",
              TaxedAmount:    body.totalSueldos,
              ExemptAmount:   body.totalExento,
            }],
          },
          Deductions: {
            Details: [
              {
                DeduccionType: "001",
                Code:          "D001",
                Description:   "Seguridad social",
                Amount:        body.totalIMSS,
              },
              {
                DeduccionType: "002",
                Code:          "D002",
                Description:   "ISR retenido",
                Amount:        body.totalISR,
              },
              ...(body.totalInfonavit
                ? [{
                    DeduccionType: "003",
                    Code:          "D003",
                    Description:   "INFONAVIT",
                    Amount:        body.totalInfonavit,
                  }]
                : []),
            ],
          },
          // Requerido por SAT cuando RegimeType = "02"
          OtherPayments: [{
            OtherPaymentType: "002",
            Code:             "O002",
            Description:      "Subsidio para el empleo",
            Amount:           body.subsidioEmpleo ?? 0,
            EmploymentSubsidy: {
              SubsidizedAmount: body.subsidioEmpleo ?? 0,
            },
          }],
        },
      },
    };

    const res = await fetch(`${facturamaBaseUrl}/api-lite/3/cfdis`, {
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
      let fullErr: unknown;
      try {
        fullErr = await res.json();
        const e = fullErr as Record<string, unknown>;
        msg = e?.ModelState
          ? (Object.values(e.ModelState) as string[][]).flat().join("; ")
          : (e?.message as string) ?? JSON.stringify(fullErr);
      } catch {}
      return NextResponse.json({ error: `Facturama ${res.status}: ${msg}`, detail: fullErr }, { status: res.status });
    }

    const data = await res.json() as { Id: string; Uuid: string; Folio?: string; Date: string };

    let pdfBase64: string | undefined;
    try {
      const pdfRes = await fetch(
        `${facturamaBaseUrl}/Cfdi/pdf/issuedLite/${data.Id}`,
        { headers: { Authorization: facturamaAuthHeader() } },
      );
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json() as { Content: string };
        pdfBase64 = pdfData.Content;
      }
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
