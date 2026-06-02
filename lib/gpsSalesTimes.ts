export interface GpsEvent {
  folio: string;
  lat: number;
  lng: number;
  llegadaGps: string;
  salidaGps: string;
  precisionMetros: number;
  fuente: "GPS unidad" | "App operador";
}

export interface VentaEntrega {
  folio: string;
  cliente: string;
  obra: string;
  unidad: string;
  operador: string;
  m3: number;
  horaProgramada: string;
  horaLlegadaManual: string;
  horaLlegadaGps?: string;
  horaSalidaManual: string;
  horaSalidaGps?: string;
  gpsLat?: number;
  gpsLng?: number;
  precisionMetros?: number;
  fuenteGps?: string;
  estado: "Validado" | "Pendiente" | "Diferencia";
  observaciones: string;
}

const gpsEvents: GpsEvent[] = [
  { folio: "VJ-2026-142", lat: 25.6866, lng: -100.3161, llegadaGps: "08:34", salidaGps: "09:12", precisionMetros: 18, fuente: "GPS unidad" },
  { folio: "VJ-2026-141", lat: 25.7410, lng: -100.3022, llegadaGps: "10:18", salidaGps: "11:03", precisionMetros: 22, fuente: "GPS unidad" },
  { folio: "VJ-2026-140", lat: 25.7812, lng: -100.1889, llegadaGps: "12:05", salidaGps: "12:47", precisionMetros: 16, fuente: "App operador" },
  { folio: "VJ-2026-139", lat: 25.8044, lng: -100.5862, llegadaGps: "14:31", salidaGps: "15:09", precisionMetros: 25, fuente: "GPS unidad" },
];

export const ventasEntregasBase: VentaEntrega[] = [
  { folio: "VJ-2026-142", cliente: "Grupo Alfa Logistica", obra: "Monterrey Centro", unidad: "DC-03", operador: "Luis Ramírez", m3: 7.5, horaProgramada: "08:30", horaLlegadaManual: "08:36", horaSalidaManual: "09:10", estado: "Pendiente", observaciones: "Descarga sin incidencia" },
  { folio: "VJ-2026-141", cliente: "Constructora Norte", obra: "San Nicolás", unidad: "DC-07", operador: "Carlos Mendoza", m3: 6.0, horaProgramada: "10:00", horaLlegadaManual: "10:25", horaSalidaManual: "11:05", estado: "Pendiente", observaciones: "Acceso con espera en caseta" },
  { folio: "VJ-2026-140", cliente: "Industrial Apodaca", obra: "Apodaca Industrial", unidad: "DC-01", operador: "José García", m3: 8.0, horaProgramada: "12:00", horaLlegadaManual: "12:04", horaSalidaManual: "12:45", estado: "Pendiente", observaciones: "Validar firma del residente" },
  { folio: "VJ-2026-139", cliente: "Urbanizadora Sierra", obra: "García NL", unidad: "DC-05", operador: "Miguel Torres", m3: 5.5, horaProgramada: "14:15", horaLlegadaManual: "14:39", horaSalidaManual: "15:15", estado: "Pendiente", observaciones: "Diferencia por tráfico reportado" },
];

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function statusFromDiff(manual: string, gps: string): VentaEntrega["estado"] {
  const diff = Math.abs(minutesFromTime(manual) - minutesFromTime(gps));
  return diff <= 5 ? "Validado" : "Diferencia";
}

export async function enlazarHorasGpsVentas(entregas: VentaEntrega[]) {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return entregas.map((entrega) => {
    const gps = gpsEvents.find((event) => event.folio === entrega.folio);

    if (!gps) {
      return entrega;
    }

    return {
      ...entrega,
      horaLlegadaGps: gps.llegadaGps,
      horaSalidaGps: gps.salidaGps,
      gpsLat: gps.lat,
      gpsLng: gps.lng,
      precisionMetros: gps.precisionMetros,
      fuenteGps: gps.fuente,
      estado: statusFromDiff(entrega.horaLlegadaManual, gps.llegadaGps),
    };
  });
}

export function calcularDiferenciaMinutos(manual: string, gps?: string) {
  if (!gps) return null;
  return minutesFromTime(manual) - minutesFromTime(gps);
}
