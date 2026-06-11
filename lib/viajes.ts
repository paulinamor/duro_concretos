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

export function parseViajeDate(fecha: string) {
  const [day, month, year] = fecha.split("/").map(Number);
  return new Date(year, month - 1, day);
}
