/**
 * Motor de cálculo de nómina — tablas SAT 2026
 * Cumple con: Art. 96 LISR, LSS, Decreto subsidio al empleo DOF 31-dic-2025
 */

import {
  UMA_2026,
  TARIFA_ISR_MENSUAL_2026,
  SUBSIDIO_EMPLEO_MENSUAL_2026,
  IMSS_CUOTAS_2026,
  INFONAVIT_2026,
  FACTOR_PERIODO,
  type TramoISR,
} from "./tablas2026";

export type Periodicidad = "diario" | "semanal" | "catorcenal" | "quincenal" | "mensual";
export type ClaseRiesgo = "I" | "II" | "III" | "IV" | "V";

export interface EntradaNomina {
  salarioDiario: number;         // salario diario ordinario
  diasTrabajados: number;
  periodicidad: Periodicidad;
  // percepciones adicionales gravadas (bonos, horas extra gravadas, etc.)
  percepcionesGravadasExtra?: number;
  // percepciones exentas (vales despensa ≤ 40% UMA, horas extra exentas, etc.)
  percepcionesExentasExtra?: number;
  claseRiesgo?: ClaseRiesgo;     // default "I"
  // salario diario integrado (SDI) — si no se pasa se calcula como salarioDiario × 1.0452 (factor integración mínimo)
  salarioDiarioIntegrado?: number;
  // Si el empleado tiene crédito INFONAVIT activo
  descuentoInfonavitMensual?: number;
}

export interface DesglosePago {
  // Percepciones
  sueldoOrdinario: number;
  percepcionesGravadas: number;
  percepcionesExentas: number;
  totalPercepciones: number;

  // Deducciones empleado
  imssObrero: number;
  isrCausado: number;
  subsidioEmpleo: number;
  isrRetenido: number;      // isrCausado - subsidioEmpleo (mínimo 0)
  infonavitDescuento: number;
  totalDeducciones: number;

  // Neto
  netoAPagar: number;

  // Cuotas patronales (informativas, no afectan neto del empleado)
  imssPatron: number;
  infonavitPatron: number;
  costoTotalPatron: number;

  // Detalle IMSS obrero
  imssDetalle: {
    enfermedadMaternidadDinero: number;
    enfermedadMaternidadExcedente: number;
    enfermedadMaternidadPensionados: number;
    invalidezVida: number;
    rcev: number;
  };

  // Para CFDI nómina
  baseCotizacionIMSS: number; // SBC mensual
  umaMensual: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcularISRMensual(ingresoMensualGravado: number): number {
  if (ingresoMensualGravado <= 0) return 0;
  const tramo = TARIFA_ISR_MENSUAL_2026.find(
    (t) => ingresoMensualGravado >= t.limiteInferior && ingresoMensualGravado <= t.limiteSuperior,
  ) as TramoISR;
  const excedente = ingresoMensualGravado - tramo.limiteInferior;
  return round2(tramo.cuotaFija + excedente * tramo.porcentajeExcedente);
}

function calcularSubsidioMensual(ingresoMensual: number): number {
  const tramo = SUBSIDIO_EMPLEO_MENSUAL_2026.find((t) => ingresoMensual <= t.hasta);
  return tramo ? tramo.subsidio : 0;
}

function calcularTasaRCEVPatron(sbcDiario: number): number {
  const multiplosUMA = sbcDiario / UMA_2026.diario;
  const escala = IMSS_CUOTAS_2026.rcev.patronEscala;
  const tramo = escala.find((e) => multiplosUMA <= e.hastaUMAs) ?? escala[escala.length - 1];
  return tramo.tasa;
}

// ─── Cálculo IMSS obrero ─────────────────────────────────────────────────────

function calcularIMSSObrero(sbcMensual: number): {
  total: number;
  detalle: DesglosePago["imssDetalle"];
} {
  const cuotas = IMSS_CUOTAS_2026;
  const tresUMAsMensual = UMA_2026.mensual * 3;

  const enfermedadDinero      = round2(sbcMensual * cuotas.enfermedadMaternidad.dineroObrero);
  const excedenteSBC          = Math.max(0, sbcMensual - tresUMAsMensual);
  const enfermedadExcedente   = round2(excedenteSBC * cuotas.enfermedadMaternidad.excedenteObrero);
  const pensionados            = round2(sbcMensual * cuotas.enfermedadMaternidad.pensionadosObrero);
  const invalidezVida          = round2(sbcMensual * cuotas.invalidezVida.obrero);
  const rcev                   = round2(sbcMensual * cuotas.rcev.obrero);

  const total = round2(enfermedadDinero + enfermedadExcedente + pensionados + invalidezVida + rcev);

  return {
    total,
    detalle: {
      enfermedadMaternidadDinero:      enfermedadDinero,
      enfermedadMaternidadExcedente:   enfermedadExcedente,
      enfermedadMaternidadPensionados: pensionados,
      invalidezVida,
      rcev,
    },
  };
}

// ─── Cálculo IMSS patronal ───────────────────────────────────────────────────

function calcularIMSSPatron(sbcMensual: number, sbcDiario: number, claseRiesgo: ClaseRiesgo): number {
  const cuotas = IMSS_CUOTAS_2026;
  const tresUMAsMensual = UMA_2026.mensual * 3;
  const excedenteSBC    = Math.max(0, sbcMensual - tresUMAsMensual);

  const cuotaFija        = cuotas.enfermedadMaternidad.especiePatronFijo;
  const dinero           = round2(sbcMensual * cuotas.enfermedadMaternidad.dineroPatron);
  const excedente        = round2(excedenteSBC * cuotas.enfermedadMaternidad.excedentePatron);
  const pensionados      = round2(sbcMensual * cuotas.enfermedadMaternidad.pensionadosPatron);
  const invalidezVida    = round2(sbcMensual * cuotas.invalidezVida.patron);
  const retiro           = round2(sbcMensual * cuotas.retiro.patron);
  const rcevPatronTasa   = calcularTasaRCEVPatron(sbcDiario);
  const rcev             = round2(sbcMensual * rcevPatronTasa);
  const guarderias       = round2(sbcMensual * cuotas.guarderias.patron);
  const riesgosTrabajo   = round2(sbcMensual * cuotas.riesgosTrabajoClases[claseRiesgo]);

  return round2(cuotaFija + dinero + excedente + pensionados + invalidezVida + retiro + rcev + guarderias + riesgosTrabajo);
}

// ─── Función principal ───────────────────────────────────────────────────────

export function calcularNomina(entrada: EntradaNomina): DesglosePago {
  const {
    salarioDiario,
    diasTrabajados,
    periodicidad,
    percepcionesGravadasExtra = 0,
    percepcionesExentasExtra  = 0,
    claseRiesgo               = "I",
    salarioDiarioIntegrado,
    descuentoInfonavitMensual  = 0,
  } = entrada;

  const factor = FACTOR_PERIODO[periodicidad];

  // ── Percepciones del periodo ─────────────────────────────────────────────
  const sueldoOrdinario       = round2(salarioDiario * diasTrabajados);
  const percepcionesGravadas  = round2(sueldoOrdinario + percepcionesGravadasExtra);
  const percepcionesExentas   = round2(percepcionesExentasExtra);
  const totalPercepciones     = round2(percepcionesGravadas + percepcionesExentas);

  // ── SBC (Salario Base de Cotización) ────────────────────────────────────
  // SBC mensual = salario diario integrado × 30.4
  const sdi            = salarioDiarioIntegrado ?? round2(salarioDiario * 1.0452);
  const sbcDiario      = sdi;
  const sbcMensual     = round2(sdi * 30.4);
  // SBC tiene tope de 25 UMAs
  const sbcMensualTop  = Math.min(sbcMensual, UMA_2026.mensual * 25);

  // ── IMSS obrero (mensual, proporcional al periodo) ───────────────────────
  const { total: imssObreroMensual, detalle: imssDetalleMensual } = calcularIMSSObrero(sbcMensualTop);
  const imssObrero = round2(imssObreroMensual / factor);
  const imssDetalle: DesglosePago["imssDetalle"] = {
    enfermedadMaternidadDinero:      round2(imssDetalleMensual.enfermedadMaternidadDinero / factor),
    enfermedadMaternidadExcedente:   round2(imssDetalleMensual.enfermedadMaternidadExcedente / factor),
    enfermedadMaternidadPensionados: round2(imssDetalleMensual.enfermedadMaternidadPensionados / factor),
    invalidezVida:                   round2(imssDetalleMensual.invalidezVida / factor),
    rcev:                            round2(imssDetalleMensual.rcev / factor),
  };

  // ── ISR (proyección mensual Art. 96 LISR) ───────────────────────────────
  // Ingreso gravado mensual proyectado
  const ingresoGravadoMensual   = round2(percepcionesGravadas * factor);
  // Base gravable = ingreso gravado - IMSS obrero mensual
  const baseGravableMensual     = Math.max(0, ingresoGravadoMensual - imssObreroMensual);

  const isrMensualCausado       = calcularISRMensual(baseGravableMensual);
  const subsidioMensual         = calcularSubsidioMensual(baseGravableMensual);
  const isrMensualRetenido      = Math.max(0, isrMensualCausado - subsidioMensual);

  // Proporcional al periodo
  const isrCausado              = round2(isrMensualCausado / factor);
  const subsidioEmpleo          = round2(subsidioMensual / factor);
  const isrRetenido             = round2(isrMensualRetenido / factor);

  // ── INFONAVIT descuento obrero ────────────────────────────────────────────
  const infonavitDescuento = round2(descuentoInfonavitMensual / factor);

  // ── Totales ──────────────────────────────────────────────────────────────
  const totalDeducciones = round2(imssObrero + isrRetenido + infonavitDescuento);
  const netoAPagar       = round2(totalPercepciones - totalDeducciones);

  // ── Costo patronal ────────────────────────────────────────────────────────
  const imssPatronMensual  = calcularIMSSPatron(sbcMensualTop, sbcDiario, claseRiesgo);
  const imssPatron         = round2(imssPatronMensual / factor);
  const infonavitPatron    = round2((sbcMensual * INFONAVIT_2026.patron) / factor);
  const costoTotalPatron   = round2(totalPercepciones + imssPatron + infonavitPatron);

  return {
    sueldoOrdinario,
    percepcionesGravadas,
    percepcionesExentas,
    totalPercepciones,
    imssObrero,
    isrCausado,
    subsidioEmpleo,
    isrRetenido,
    infonavitDescuento,
    totalDeducciones,
    netoAPagar,
    imssPatron,
    infonavitPatron,
    costoTotalPatron,
    imssDetalle,
    baseCotizacionIMSS: sbcMensual,
    umaMensual: UMA_2026.mensual,
  };
}
