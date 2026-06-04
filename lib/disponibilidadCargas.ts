export const choferesDisponibilidad = [
  "Luis Ramírez",
  "Carlos Mendoza",
  "José García",
  "Miguel Torres",
  "Roberto Flores",
  "Alejandro Reyes",
  "Fernando Castillo",
  "Eduardo López",
];

export const unidadesDisponibilidad = [
  "DC-01 · KLJ-8821",
  "DC-02 · XPW-7734",
  "DC-03 · NMY-1042",
  "DC-04 · RPL-5590",
  "DC-05 · HJK-4459",
  "DC-06 · TNB-2281",
  "DC-07 · PMH-3310",
  "DC-08 · ZXC-9012",
];

export const bloquesCarga15Min = Array.from({ length: 49 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 15;
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
});

export const disponibilidadProgramada = [
  { fecha: "20/05/2026", hora: "07:00", chofer: "Luis Ramírez", unidad: "DC-03 · NMY-1042", destino: "Monterrey Centro", estado: "En viaje", llegadaProgramada: "07:00", llegadaReal: "07:00", demoraMin: 0, tiempoEstimadoMin: 45 },
  { fecha: "20/05/2026", hora: "07:15", chofer: "Miguel Torres", unidad: "DC-05 · HJK-4459", destino: "San Pedro", estado: "Carga programada", llegadaProgramada: "07:15", llegadaReal: "07:15", demoraMin: 0, tiempoEstimadoMin: 55 },
  { fecha: "20/05/2026", hora: "07:30", chofer: "Eduardo López", unidad: "DC-08 · ZXC-9012", destino: "Cadereyta", estado: "Carga programada", llegadaProgramada: "07:30", llegadaReal: "07:42", demoraMin: 12, tiempoEstimadoMin: 80 },
  { fecha: "20/05/2026", hora: "08:00", chofer: "José García", unidad: "DC-01 · KLJ-8821", destino: "Apodaca Industrial", estado: "En viaje", llegadaProgramada: "08:00", llegadaReal: "08:18", demoraMin: 18, tiempoEstimadoMin: 50 },
  { fecha: "20/05/2026", hora: "08:15", chofer: "Alejandro Reyes", unidad: "DC-06 · TNB-2281", destino: "Santa Catarina", estado: "Carga programada", llegadaProgramada: "08:15", llegadaReal: "08:15", demoraMin: 0, tiempoEstimadoMin: 65 },
  { fecha: "20/05/2026", hora: "09:00", chofer: "Carlos Mendoza", unidad: "DC-07 · PMH-3310", destino: "San Nicolás", estado: "En ruta", llegadaProgramada: "09:00", llegadaReal: "09:09", demoraMin: 9, tiempoEstimadoMin: 40 },
  { fecha: "20/05/2026", hora: "10:00", chofer: "Roberto Flores", unidad: "DC-02 · XPW-7734", destino: "Guadalupe NL", estado: "Carga programada", llegadaProgramada: "10:00", llegadaReal: "10:00", demoraMin: 0, tiempoEstimadoMin: 50 },
  { fecha: "21/05/2026", hora: "08:00", chofer: "Alejandro Reyes", unidad: "DC-06 · TNB-2281", destino: "Santa Catarina", estado: "Carga programada", llegadaProgramada: "08:00", llegadaReal: "08:07", demoraMin: 7, tiempoEstimadoMin: 65 },
  { fecha: "21/05/2026", hora: "11:00", chofer: "Fernando Castillo", unidad: "DC-04 · RPL-5590", destino: "Escobedo NL", estado: "En viaje", llegadaProgramada: "11:00", llegadaReal: "11:00", demoraMin: 0, tiempoEstimadoMin: 55 },
];

export function formatInputDate(date: string) {
  if (!date) return "20/05/2026";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatTravelTime(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function calcularImpactoDemoras(fecha: string) {
  const cargasDia = disponibilidadProgramada
    .filter((item) => item.fecha === fecha)
    .sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));

  const disponibilidadPorRecurso = new Map<string, number>();

  return cargasDia.map((item) => {
    const horaProgramada = timeToMinutes(item.hora);
    const recursoChofer = `chofer:${item.chofer}`;
    const recursoUnidad = `unidad:${item.unidad}`;
    const disponibleChofer = disponibilidadPorRecurso.get(recursoChofer) ?? horaProgramada;
    const disponibleUnidad = disponibilidadPorRecurso.get(recursoUnidad) ?? horaProgramada;
    const nuevaSalidaMin = Math.max(horaProgramada, disponibleChofer, disponibleUnidad);
    const atrasoArrastreMin = Math.max(0, nuevaSalidaMin - horaProgramada);
    const llegadaRealMin = timeToMinutes(item.llegadaReal);
    const finEstimadoOriginalMin = horaProgramada + item.tiempoEstimadoMin;
    const finEstimadoRecalculadoMin = nuevaSalidaMin + item.tiempoEstimadoMin + item.demoraMin;
    const duracionBloqueMin = 15;
    const recursoLibreMin = Math.max(finEstimadoRecalculadoMin, llegadaRealMin + item.tiempoEstimadoMin) + duracionBloqueMin;

    disponibilidadPorRecurso.set(recursoChofer, recursoLibreMin);
    disponibilidadPorRecurso.set(recursoUnidad, recursoLibreMin);

    return {
      ...item,
      salidaOriginal: item.hora,
      salidaRecalculada: minutesToTime(nuevaSalidaMin),
      finEstimadoOriginal: minutesToTime(finEstimadoOriginalMin),
      finEstimadoRecalculado: minutesToTime(finEstimadoRecalculadoMin),
      atrasoArrastreMin,
      seAtrasa: atrasoArrastreMin > 0,
      motivoArrastre: atrasoArrastreMin > 0
        ? "El chofer o camión todavía viene ocupado por una demora anterior."
        : item.demoraMin > 0
          ? "Esta carga genera posible arrastre para las siguientes."
          : "Sin afectación.",
    };
  });
}
