export interface Viaje {
  folio: string;
  fecha: string;
  unidad: string;
  operador: string;
  destino: string;
  m3: number;
  precioPorM3: number;
  total: number;
  estado: string;
}

export const viajesStorageKey = "duro_concretos_viajes";

export const viajesIniciales: Viaje[] = [
  { folio: "VJ-2026-142", fecha: "20/05/2026", unidad: "DC-03 · NMY-1042", operador: "Luis Ramírez", destino: "Monterrey Centro", m3: 7.5, precioPorM3: 1850, total: 13875, estado: "Completado" },
  { folio: "VJ-2026-141", fecha: "20/05/2026", unidad: "DC-07 · PMH-3310", operador: "Carlos Mendoza", destino: "San Nicolás", m3: 6.0, precioPorM3: 1850, total: 11100, estado: "En ruta" },
  { folio: "VJ-2026-140", fecha: "20/05/2026", unidad: "DC-01 · KLJ-8821", operador: "José García", destino: "Apodaca Industrial", m3: 8.0, precioPorM3: 1900, total: 15200, estado: "Completado" },
  { folio: "VJ-2026-139", fecha: "19/05/2026", unidad: "DC-05 · HJK-4459", operador: "Miguel Torres", destino: "García NL", m3: 5.5, precioPorM3: 1850, total: 10175, estado: "Cancelado" },
  { folio: "VJ-2026-138", fecha: "19/05/2026", unidad: "DC-02 · XPW-7734", operador: "Roberto Flores", destino: "Guadalupe NL", m3: 7.0, precioPorM3: 1900, total: 13300, estado: "Completado" },
  { folio: "VJ-2026-137", fecha: "19/05/2026", unidad: "DC-06 · TNB-2281", operador: "Alejandro Reyes", destino: "Santa Catarina", m3: 6.5, precioPorM3: 1850, total: 12025, estado: "Completado" },
  { folio: "VJ-2026-136", fecha: "18/05/2026", unidad: "DC-04 · RPL-5590", operador: "Fernando Castillo", destino: "Escobedo NL", m3: 8.5, precioPorM3: 1900, total: 16150, estado: "Completado" },
  { folio: "VJ-2026-135", fecha: "18/05/2026", unidad: "DC-08 · ZXC-9012", operador: "Eduardo López", destino: "Cadereyta", m3: 7.0, precioPorM3: 2000, total: 14000, estado: "Completado" },
  { folio: "VJ-2026-134", fecha: "17/05/2026", unidad: "DC-03 · NMY-1042", operador: "Luis Ramírez", destino: "Monterrey Oriente", m3: 6.0, precioPorM3: 1850, total: 11100, estado: "Completado" },
  { folio: "VJ-2026-133", fecha: "17/05/2026", unidad: "DC-01 · KLJ-8821", operador: "José García", destino: "Juárez NL", m3: 7.5, precioPorM3: 1900, total: 14250, estado: "Completado" },
  { folio: "VJ-2026-132", fecha: "16/05/2026", unidad: "DC-07 · PMH-3310", operador: "Carlos Mendoza", destino: "Monterrey Sur", m3: 5.0, precioPorM3: 1850, total: 9250, estado: "Pendiente" },
];

export function loadViajes() {
  if (typeof window === "undefined") return viajesIniciales;

  const raw = localStorage.getItem(viajesStorageKey);
  if (!raw) {
    saveViajes(viajesIniciales);
    return viajesIniciales;
  }

  try {
    const viajes = JSON.parse(raw) as Viaje[];
    if (viajes.length === 0) {
      saveViajes(viajesIniciales);
      return viajesIniciales;
    }
    return viajes;
  } catch {
    localStorage.removeItem(viajesStorageKey);
    saveViajes(viajesIniciales);
    return viajesIniciales;
  }
}

export function saveViajes(viajes: Viaje[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(viajesStorageKey, JSON.stringify(viajes));
  window.dispatchEvent(new CustomEvent("duro:viajes-updated"));
}

export function parseViajeDate(fecha: string) {
  const [day, month, year] = fecha.split("/").map(Number);
  return new Date(year, month - 1, day);
}
