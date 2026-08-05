import { NextRequest, NextResponse } from "next/server";

// Documentación FacturAPI nómina:
// https://docs.facturapi.io/docs/guides/invoices/nomina/

export interface TimbrarNominaRequest {
  // Datos del empleado
  empleadoRfc: string;
  empleadoCurp: string;
  empleadoNombre: string;
  empleadoNss: string;            // Número de Seguridad Social
  empleadoCodigoPostal: string;
  // Datos de la nómina
  periodicidad: "01" | "02" | "03" | "04" | "05"; // 01=diario 02=semanal 03=quincenal 04=mensual 05=bimestral
  fechaPago: string;              // YYYY-MM-DD
  fechaInicialPago: string;
  fechaFinalPago: string;
  numDiasPagados: number;
  // Percepciones
  totalSueldos: number;           // gravado
  totalExento: number;
  // Deducciones
  totalISR: number;
  totalIMSS: number;
  totalInfonavit?: number;
  // Serie para el CFDI
  serie?: string;                 // default "NOM"
}

export async function POST(req: NextRequest) {
  try {
    const body: TimbrarNominaRequest = await req.json();

    const apiKey = process.env.FACTURAPI_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "FACTURAPI_KEY no configurada" }, { status: 500 });
    }

    // Construir el payload CFDI nómina para FacturAPI
    const payload = {
      type: "N",   // Nómina
      payment_method: "PUE",
      date: body.fechaPago,
      serie: body.serie ?? "NOM",
      customer: {
        legal_name: body.empleadoNombre,
        tax_id:     body.empleadoRfc,
        tax_system: "605",           // Sueldos y salarios e ingresos asimilados a salarios
        email:      undefined,
        address: { zip: body.empleadoCodigoPostal },
      },
      items: [
        {
          quantity: 1,
          product: {
            description:  "Pago de nómina",
            price:        body.totalSueldos + body.totalExento,
            tax_included: true,
            taxes:        [],
            product_key:  "84111505", // Clave SAT: Servicios de gestión de nómina y personal
            unit_key:     "ACT",
          },
        },
      ],
      complements: [
        {
          type: "nomina",
          data: {
            version:              "1.2",
            tipo_nomina:          "O",  // Ordinaria
            fecha_pago:           body.fechaPago,
            fecha_inicial_pago:   body.fechaInicialPago,
            fecha_final_pago:     body.fechaFinalPago,
            num_dias_pagados:     body.numDiasPagados,
            receptor: {
              curp:                body.empleadoCurp,
              num_seguridad_social: body.empleadoNss,
              tipo_contrato:       "01", // Contrato de trabajo por tiempo indeterminado
              sindicalizado:       false,
              tipo_jornada:        "01", // Diurna
              tipo_regimen:        "02", // Sueldos y salarios
              num_empleado:        "001",
              periodicidad_pago:   body.periodicidad,
              clave_ent_fed:       "NL", // Nuevo León — parametrizar si es necesario
              subcontratacion:     [],
            },
            percepciones: {
              total_sueldos:  body.totalSueldos,
              total_exento:   body.totalExento,
              total_gravado:  body.totalSueldos,
              percepcion: [
                {
                  tipo_percepcion: "001",  // Sueldos, salarios y asimilados
                  clave:           "001",
                  concepto:        "Sueldo",
                  importe_gravado: body.totalSueldos,
                  importe_exento:  body.totalExento,
                },
              ],
            },
            deducciones: {
              total_otras_deducciones: body.totalISR + (body.totalInfonavit ?? 0),
              total_impuestos_retenidos: body.totalIMSS,
              deduccion: [
                {
                  tipo_deduccion: "002",  // ISR
                  clave:          "002",
                  concepto:       "ISR",
                  importe:        body.totalISR,
                },
                {
                  tipo_deduccion: "001",  // IMSS
                  clave:          "001",
                  concepto:       "IMSS",
                  importe:        body.totalIMSS,
                },
                ...(body.totalInfonavit
                  ? [{
                      tipo_deduccion: "003",
                      clave:          "003",
                      concepto:       "INFONAVIT",
                      importe:        body.totalInfonavit,
                    }]
                  : []),
              ],
            },
          },
        },
      ],
    };

    const resp = await fetch("https://www.facturapi.io/v2/invoices", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("[timbrar-nomina] FacturAPI error:", data);
      return NextResponse.json({ error: data.message ?? "Error en FacturAPI", details: data }, { status: resp.status });
    }

    return NextResponse.json({
      uuid:      data.uuid,
      folio:     data.folio_number,
      serie:     data.series,
      fechaTimbrado: data.stamp?.date,
      pdfUrl:    `https://www.facturapi.io/v2/invoices/${data.id}/pdf`,
      xmlUrl:    `https://www.facturapi.io/v2/invoices/${data.id}/xml`,
      id:        data.id,
    });
  } catch (err) {
    console.error("[timbrar-nomina]", err);
    return NextResponse.json({ error: "Error interno al timbrar nómina" }, { status: 500 });
  }
}
