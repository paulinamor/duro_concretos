export type EstatusUnidad = "Activo" | "Mantenimiento" | "Baja";

export interface Unidad {
  id: string;
  noEconomico: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number;
  capacidadM3: number;
  kmActual: number;
  choferAsignado: string;
  estatus: EstatusUnidad;
  ultimoMantenimiento: string;
  proximoMantenimiento: string;
  seguroVigente: string;
  tarjetaCirculacion: string;
  verificacion: string;
  observaciones: string;
}

export const unidades: Unidad[] = [
  {
    id: "UN-001",
    noEconomico: "DC-01",
    placa: "JFC-3241",
    marca: "Mercedes-Benz",
    modelo: "Actros 2644",
    anio: 2021,
    capacidadM3: 8,
    kmActual: 148200,
    choferAsignado: "Roberto Garza Treviño",
    estatus: "Activo",
    ultimoMantenimiento: "2026-04-10",
    proximoMantenimiento: "2026-07-10",
    seguroVigente: "2026-12-31",
    tarjetaCirculacion: "2027-01-15",
    verificacion: "2026-10-20",
    observaciones: "",
  },
  {
    id: "UN-002",
    noEconomico: "DC-02",
    placa: "HLC-8812",
    marca: "Volvo",
    modelo: "FMX 440",
    anio: 2020,
    capacidadM3: 7,
    kmActual: 201500,
    choferAsignado: "Juan Carlos Méndez Flores",
    estatus: "Activo",
    ultimoMantenimiento: "2026-03-22",
    proximoMantenimiento: "2026-06-22",
    seguroVigente: "2026-11-30",
    tarjetaCirculacion: "2026-08-05",
    verificacion: "2026-08-15",
    observaciones: "",
  },
  {
    id: "UN-003",
    noEconomico: "DC-03",
    placa: "PMN-5566",
    marca: "Kenworth",
    modelo: "T370",
    anio: 2019,
    capacidadM3: 6,
    kmActual: 289300,
    choferAsignado: "Miguel Ángel Rodríguez Sáenz",
    estatus: "Activo",
    ultimoMantenimiento: "2026-05-01",
    proximoMantenimiento: "2026-08-01",
    seguroVigente: "2027-01-20",
    tarjetaCirculacion: "2026-09-10",
    verificacion: "2026-09-30",
    observaciones: "Requiere revisión de frenos en próximo servicio",
  },
  {
    id: "UN-004",
    noEconomico: "DC-04",
    placa: "RNL-1023",
    marca: "Scania",
    modelo: "P 410",
    anio: 2022,
    capacidadM3: 8,
    kmActual: 89700,
    choferAsignado: "Ernesto Leal Villanueva",
    estatus: "Activo",
    ultimoMantenimiento: "2026-05-18",
    proximoMantenimiento: "2026-08-18",
    seguroVigente: "2027-03-15",
    tarjetaCirculacion: "2027-02-28",
    verificacion: "2027-01-10",
    observaciones: "",
  },
  {
    id: "UN-005",
    noEconomico: "DC-05",
    placa: "TGQ-7798",
    marca: "Freightliner",
    modelo: "114SD",
    anio: 2020,
    capacidadM3: 7,
    kmActual: 176400,
    choferAsignado: "Héctor Ramírez Castillo",
    estatus: "Activo",
    ultimoMantenimiento: "2026-04-28",
    proximoMantenimiento: "2026-07-28",
    seguroVigente: "2026-12-01",
    tarjetaCirculacion: "2026-10-05",
    verificacion: "2026-11-20",
    observaciones: "",
  },
  {
    id: "UN-006",
    noEconomico: "DC-06",
    placa: "VBT-4481",
    marca: "Mercedes-Benz",
    modelo: "Axor 2040",
    anio: 2018,
    capacidadM3: 6,
    kmActual: 324100,
    choferAsignado: "Arturo Peña González",
    estatus: "Mantenimiento",
    ultimoMantenimiento: "2026-06-02",
    proximoMantenimiento: "2026-09-02",
    seguroVigente: "2026-08-31",
    tarjetaCirculacion: "2026-07-20",
    verificacion: "2026-08-05",
    observaciones: "En taller — cambio de eje diferencial",
  },
  {
    id: "UN-007",
    noEconomico: "DC-07",
    placa: "KQR-9950",
    marca: "Volvo",
    modelo: "FMX 380",
    anio: 2017,
    capacidadM3: 6,
    kmActual: 398700,
    choferAsignado: "",
    estatus: "Baja",
    ultimoMantenimiento: "2025-11-10",
    proximoMantenimiento: "—",
    seguroVigente: "2025-12-31",
    tarjetaCirculacion: "2025-07-01",
    verificacion: "2025-09-15",
    observaciones: "Dado de baja por antigüedad y costo de reparaciones",
  },
];

export function capacidadTotalM3(list: Unidad[]) {
  return list
    .filter((u) => u.estatus === "Activo")
    .reduce((sum, u) => sum + u.capacidadM3, 0);
}
