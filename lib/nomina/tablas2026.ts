/**
 * Tablas fiscales SAT 2026
 * Fuente: Resolución Miscelánea Fiscal 2026 (DOF 28-dic-2025)
 * UMA: DOF 09-ene-2026, vigente 01-feb-2026
 * Salario mínimo: DOF 09-dic-2025, vigente 01-ene-2026
 * IMSS: Ley del Seguro Social + tablas publicadas 2026
 */

// ─── UMA 2026 (Unidad de Medida y Actualización) ────────────────────────────
export const UMA_2026 = {
  diario: 117.31,
  mensual: 3_566.22,
  anual: 42_794.64,
} as const;

// ─── Salario Mínimo 2026 ─────────────────────────────────────────────────────
export const SALARIO_MINIMO_2026 = {
  general: 315.04,      // diario nacional
  fronteraNorte: 440.87, // diario zona libre frontera norte
} as const;

// ─── ISR Tarifa mensual 2026 (Art. 96 LISR) ─────────────────────────────────
// Fuente: Anexo 8 RMF 2026, DOF 28-dic-2025
export interface TramoISR {
  limiteInferior: number;
  limiteSuperior: number; // Infinity para el último tramo
  cuotaFija: number;
  porcentajeExcedente: number; // en decimal, ej. 0.0192
}

export const TARIFA_ISR_MENSUAL_2026: TramoISR[] = [
  { limiteInferior: 0.01,       limiteSuperior: 746.04,      cuotaFija: 0.00,        porcentajeExcedente: 0.0192 },
  { limiteInferior: 746.05,     limiteSuperior: 6_332.05,    cuotaFija: 14.32,       porcentajeExcedente: 0.0640 },
  { limiteInferior: 6_332.06,   limiteSuperior: 11_128.01,   cuotaFija: 371.83,      porcentajeExcedente: 0.1088 },
  { limiteInferior: 11_128.02,  limiteSuperior: 12_935.82,   cuotaFija: 893.63,      porcentajeExcedente: 0.1600 },
  { limiteInferior: 12_935.83,  limiteSuperior: 15_487.71,   cuotaFija: 1_182.88,    porcentajeExcedente: 0.1792 },
  { limiteInferior: 15_487.72,  limiteSuperior: 31_236.49,   cuotaFija: 1_639.32,    porcentajeExcedente: 0.2136 },
  { limiteInferior: 31_236.50,  limiteSuperior: 49_233.00,   cuotaFija: 4_005.46,    porcentajeExcedente: 0.2352 },
  { limiteInferior: 49_233.01,  limiteSuperior: 93_993.90,   cuotaFija: 8_237.45,    porcentajeExcedente: 0.3000 },
  { limiteInferior: 93_993.91,  limiteSuperior: 125_325.20,  cuotaFija: 21_665.72,   porcentajeExcedente: 0.3200 },
  { limiteInferior: 125_325.21, limiteSuperior: 375_975.61,  cuotaFija: 31_691.85,   porcentajeExcedente: 0.3400 },
  { limiteInferior: 375_975.62, limiteSuperior: Infinity,    cuotaFija: 116_912.87,  porcentajeExcedente: 0.3500 },
];

// ─── Subsidio al Empleo mensual 2026 (Art. 1° Decreto subsidio) ─────────────
// Fuente: DOF 31-dic-2025
export interface TramoSubsidio {
  hasta: number;
  subsidio: number;
}

export const SUBSIDIO_EMPLEO_MENSUAL_2026: TramoSubsidio[] = [
  { hasta: 1_768.96,  subsidio: 407.02 },
  { hasta: 2_653.38,  subsidio: 406.83 },
  { hasta: 3_472.84,  subsidio: 406.62 },
  { hasta: 3_537.87,  subsidio: 392.77 },
  { hasta: 4_446.15,  subsidio: 382.46 },
  { hasta: 4_717.18,  subsidio: 354.23 },
  { hasta: 5_335.42,  subsidio: 324.87 },
  { hasta: 6_224.67,  subsidio: 294.63 },
  { hasta: 7_113.90,  subsidio: 253.54 },
  { hasta: 7_382.33,  subsidio: 217.61 },
  { hasta: Infinity,  subsidio: 0.00   },
];

// ─── IMSS Cuotas 2026 (Ley del Seguro Social) ───────────────────────────────
// Tasas sobre Salario Base de Cotización (SBC)

// Prestaciones en especie: cuota fija mensual por trabajador = % UMA mensual
export const IMSS_ENFERMEDAD_MATERNIDAD_CUOTA_FIJA_PATRON = UMA_2026.mensual * 0.204; // $727.50

export const IMSS_CUOTAS_2026 = {
  enfermedadMaternidad: {
    // Prestaciones en especie — cuota fija patronal (no % de SBC, sino fija por trabajador)
    especiePatronFijo: UMA_2026.mensual * 0.204,
    // Prestaciones en dinero — % de SBC
    dineroPatron:  0.0070,
    dineroObrero:  0.0025,
    // Excedente sobre 3 UMAs — % del excedente del SBC sobre 3 UMAs diarias
    excedentePatron: 0.0110,
    excedenteObrero: 0.0040,
    // Gastos médicos pensionados — % de SBC
    pensionadosPatron: 0.0105,
    pensionadosObrero: 0.00375,
  },
  invalidezVida: {
    patron: 0.0175,
    obrero: 0.00625,
  },
  // Retiro — solo patronal
  retiro: {
    patron: 0.0200,
    obrero: 0.0000,
  },
  // RCEV (Cesantía en edad avanzada y vejez) — obrero fijo + patronal escalonada por SBC
  rcev: {
    obrero: 0.01125,
    // Escala patronal por SBC diario relativo a UMA diaria
    patronEscala: [
      { hastaUMAs: 1.00, tasa: 0.03150 },
      { hastaUMAs: 1.50, tasa: 0.03676 },
      { hastaUMAs: 2.00, tasa: 0.04851 },
      { hastaUMAs: 2.50, tasa: 0.05556 },
      { hastaUMAs: 3.00, tasa: 0.06026 },
      { hastaUMAs: 3.50, tasa: 0.06361 },
      { hastaUMAs: 4.00, tasa: 0.06613 },
      { hastaUMAs: Infinity, tasa: 0.07513 },
    ],
  },
  // Guarderías y prestaciones sociales — solo patronal
  guarderias: {
    patron: 0.0100,
    obrero: 0.0000,
  },
  // Riesgos de trabajo — patronal variable según clase de riesgo
  riesgosTrabajoClases: {
    I:   0.0054355,
    II:  0.0113065,
    III: 0.0259640,
    IV:  0.0456860,
    V:   0.0758875,
  },
} as const;

// ─── INFONAVIT 2026 ──────────────────────────────────────────────────────────
export const INFONAVIT_2026 = {
  patron: 0.05, // 5% del salario diario integrado (SDI)
} as const;

// ─── Periodicidad: factores para convertir ISR mensual ──────────────────────
export const FACTOR_PERIODO: Record<string, number> = {
  diario:     30.4,
  semanal:    4.333,
  catorcenal: 2.167,
  quincenal:  2,
  mensual:    1,
} as const;
