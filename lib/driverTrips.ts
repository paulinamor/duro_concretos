export interface DriverTrip {
  folio: string;
  fecha: string;
  unidad: string;
  operador: string;
  destino: string;
  m3: number;
  total: number;
  estado: string;
}

export interface DriverTripSummary {
  operador: string;
  viajesTotales: number;
  viajesCompletados: number;
  viajesPendientes: number;
  viajesCancelados: number;
  m3Entregados: number;
  totalGenerado: number;
  ultimoViaje: string;
}

export const driverTrips: DriverTrip[] = [
  { folio: "VJ-2026-142", fecha: "20/05/2026", unidad: "DC-03", operador: "Luis Ramírez", destino: "Monterrey Centro", m3: 7.5, total: 13875, estado: "Completado" },
  { folio: "VJ-2026-141", fecha: "20/05/2026", unidad: "DC-07", operador: "Carlos Mendoza", destino: "San Nicolás", m3: 6.0, total: 11100, estado: "En ruta" },
  { folio: "VJ-2026-140", fecha: "20/05/2026", unidad: "DC-01", operador: "José García", destino: "Apodaca Industrial", m3: 8.0, total: 15200, estado: "Completado" },
  { folio: "VJ-2026-139", fecha: "19/05/2026", unidad: "DC-05", operador: "Miguel Torres", destino: "García NL", m3: 5.5, total: 10175, estado: "Cancelado" },
  { folio: "VJ-2026-138", fecha: "19/05/2026", unidad: "DC-02", operador: "Roberto Flores", destino: "Guadalupe NL", m3: 7.0, total: 13300, estado: "Completado" },
  { folio: "VJ-2026-137", fecha: "19/05/2026", unidad: "DC-06", operador: "Alejandro Reyes", destino: "Santa Catarina", m3: 6.5, total: 12025, estado: "Completado" },
  { folio: "VJ-2026-136", fecha: "18/05/2026", unidad: "DC-04", operador: "Fernando Castillo", destino: "Escobedo NL", m3: 8.5, total: 16150, estado: "Completado" },
  { folio: "VJ-2026-135", fecha: "18/05/2026", unidad: "DC-08", operador: "Eduardo López", destino: "Cadereyta", m3: 7.0, total: 14000, estado: "Completado" },
  { folio: "VJ-2026-134", fecha: "17/05/2026", unidad: "DC-03", operador: "Luis Ramírez", destino: "Monterrey Oriente", m3: 6.0, total: 11100, estado: "Completado" },
  { folio: "VJ-2026-133", fecha: "17/05/2026", unidad: "DC-01", operador: "José García", destino: "Juárez NL", m3: 7.5, total: 14250, estado: "Completado" },
  { folio: "VJ-2026-132", fecha: "16/05/2026", unidad: "DC-07", operador: "Carlos Mendoza", destino: "Monterrey Sur", m3: 5.0, total: 9250, estado: "Pendiente" },
];

export function getDriverTripSummaries(trips: DriverTrip[]): DriverTripSummary[] {
  const summaries = new Map<string, DriverTripSummary>();

  trips.forEach((trip) => {
    const current = summaries.get(trip.operador) ?? {
      operador: trip.operador,
      viajesTotales: 0,
      viajesCompletados: 0,
      viajesPendientes: 0,
      viajesCancelados: 0,
      m3Entregados: 0,
      totalGenerado: 0,
      ultimoViaje: trip.fecha,
    };

    current.viajesTotales += 1;
    current.viajesCompletados += trip.estado === "Completado" ? 1 : 0;
    current.viajesPendientes += trip.estado === "Pendiente" || trip.estado === "En ruta" ? 1 : 0;
    current.viajesCancelados += trip.estado === "Cancelado" ? 1 : 0;
    current.m3Entregados += trip.estado === "Completado" ? trip.m3 : 0;
    current.totalGenerado += trip.estado === "Completado" ? trip.total : 0;
    current.ultimoViaje = trip.fecha > current.ultimoViaje ? trip.fecha : current.ultimoViaje;

    summaries.set(trip.operador, current);
  });

  return Array.from(summaries.values()).sort((a, b) => b.viajesTotales - a.viajesTotales);
}
