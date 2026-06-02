export type MovimientoClienteTipo = "cargo" | "abono";

export interface ClienteEstadoCuenta {
  id: string;
  nombre: string;
  rfc: string;
  limiteCredito: number;
  diasCredito: number;
}

export interface MovimientoEstadoCuenta {
  id: string;
  fecha: string;
  vencimiento: string;
  tipo: MovimientoClienteTipo;
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
}

export interface EstadoCuentaCliente {
  cliente: ClienteEstadoCuenta;
  fechaInicio: string;
  fechaFin: string;
  saldoInicial: number;
  cargos: number;
  abonos: number;
  saldoFinal: number;
  vencido: number;
  porVencer: number;
  movimientos: Array<MovimientoEstadoCuenta & { saldo: number }>;
}

export const clientesEstadoCuenta: ClienteEstadoCuenta[] = [
  { id: "gal", nombre: "Grupo Alfa Logistica", rfc: "GAL890512H23", limiteCredito: 85000, diasCredito: 15 },
  { id: "con", nombre: "Constructora Norte", rfc: "CON920714T11", limiteCredito: 120000, diasCredito: 30 },
  { id: "ind", nombre: "Industrial Apodaca", rfc: "IND010806K91", limiteCredito: 95000, diasCredito: 15 },
  { id: "urb", nombre: "Urbanizadora Sierra", rfc: "URB990331P28", limiteCredito: 70000, diasCredito: 15 },
];

const movimientosPorCliente: Record<string, MovimientoEstadoCuenta[]> = {
  gal: [
    { id: "gal-001", fecha: "2026-05-01", vencimiento: "2026-05-16", tipo: "cargo", concepto: "Saldo anterior", referencia: "SALDO-ANT", cargo: 18400, abono: 0 },
    { id: "gal-002", fecha: "2026-05-12", vencimiento: "2026-05-27", tipo: "abono", concepto: "Pago transferencia", referencia: "PAG-2026-074", cargo: 0, abono: 12000 },
    { id: "gal-003", fecha: "2026-05-20", vencimiento: "2026-06-04", tipo: "cargo", concepto: "Concreto obra Centro", referencia: "FAC-2026-118", cargo: 25520, abono: 0 },
    { id: "gal-004", fecha: "2026-05-23", vencimiento: "2026-06-07", tipo: "cargo", concepto: "Concreto obra Norte", referencia: "FAC-2026-124", cargo: 18676, abono: 0 },
  ],
  con: [
    { id: "con-001", fecha: "2026-05-05", vencimiento: "2026-06-04", tipo: "cargo", concepto: "Suministro cimentacion", referencia: "FAC-2026-109", cargo: 42120, abono: 0 },
    { id: "con-002", fecha: "2026-05-16", vencimiento: "2026-06-15", tipo: "abono", concepto: "Pago parcial", referencia: "PAG-2026-081", cargo: 0, abono: 18000 },
    { id: "con-003", fecha: "2026-05-21", vencimiento: "2026-05-21", tipo: "cargo", concepto: "Concreto entrega especial", referencia: "FAC-2026-119", cargo: 17632, abono: 0 },
  ],
  ind: [
    { id: "ind-001", fecha: "2026-05-03", vencimiento: "2026-05-18", tipo: "cargo", concepto: "Servicio abril", referencia: "FAC-2026-101", cargo: 22360, abono: 0 },
    { id: "ind-002", fecha: "2026-05-11", vencimiento: "2026-05-11", tipo: "abono", concepto: "Pago SPEI", referencia: "PAG-2026-068", cargo: 0, abono: 22360 },
    { id: "ind-003", fecha: "2026-05-22", vencimiento: "2026-06-06", tipo: "cargo", concepto: "Concreto industrial", referencia: "FAC-2026-120", cargo: 16095, abono: 0 },
  ],
  urb: [
    { id: "urb-001", fecha: "2026-05-08", vencimiento: "2026-05-23", tipo: "cargo", concepto: "Urbanizacion etapa 2", referencia: "FAC-2026-113", cargo: 33176, abono: 0 },
    { id: "urb-002", fecha: "2026-05-19", vencimiento: "2026-05-19", tipo: "abono", concepto: "Pago caja", referencia: "PAG-2026-092", cargo: 0, abono: 15000 },
    { id: "urb-003", fecha: "2026-05-22", vencimiento: "2026-06-06", tipo: "cargo", concepto: "Concreto obra Sierra", referencia: "FAC-2026-121", cargo: 12876, abono: 0 },
  ],
};

export function generarEstadoCuentaCliente({
  clienteId,
  fechaInicio,
  fechaFin,
}: {
  clienteId: string;
  fechaInicio: string;
  fechaFin: string;
}): EstadoCuentaCliente {
  const cliente = clientesEstadoCuenta.find((item) => item.id === clienteId);

  if (!cliente) {
    throw new Error("Cliente no encontrado");
  }

  const movimientos = movimientosPorCliente[clienteId] ?? [];
  const movimientosPrevios = movimientos.filter((movimiento) => movimiento.fecha < fechaInicio);
  const movimientosPeriodo = movimientos
    .filter((movimiento) => movimiento.fecha >= fechaInicio && movimiento.fecha <= fechaFin)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const saldoInicial = movimientosPrevios.reduce((saldo, movimiento) => {
    return saldo + movimiento.cargo - movimiento.abono;
  }, 0);

  let saldo = saldoInicial;
  const movimientosConSaldo = movimientosPeriodo.map((movimiento) => {
    saldo += movimiento.cargo - movimiento.abono;
    return { ...movimiento, saldo };
  });

  const cargos = movimientosPeriodo.reduce((total, movimiento) => total + movimiento.cargo, 0);
  const abonos = movimientosPeriodo.reduce((total, movimiento) => total + movimiento.abono, 0);
  const hoy = new Date();
  const vencido = movimientosConSaldo
    .filter((movimiento) => movimiento.tipo === "cargo" && new Date(`${movimiento.vencimiento}T00:00:00`) < hoy)
    .reduce((total, movimiento) => total + movimiento.cargo, 0);

  return {
    cliente,
    fechaInicio,
    fechaFin,
    saldoInicial,
    cargos,
    abonos,
    saldoFinal: saldo,
    vencido,
    porVencer: Math.max(saldo - vencido, 0),
    movimientos: movimientosConSaldo,
  };
}
