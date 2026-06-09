export type EstatusOperador = "Activo" | "Inactivo" | "Vacaciones";

export interface Operador {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  curp: string;
  rfc: string;
  noLicencia: string;
  tipoLicencia: string;
  vencimientoLicencia: string;
  unidadAsignada: string;
  salarioDia: number;
  fechaIngreso: string;
  estatus: EstatusOperador;
  observaciones: string;
}

export const operadores: Operador[] = [
  {
    id: "OP-001",
    nombre: "Roberto Garza Treviño",
    telefono: "81 8234 5678",
    email: "r.garza@duroconcretos.mx",
    curp: "GATR850312HNLRZB02",
    rfc: "GATR850312AB3",
    noLicencia: "NL-2021-00451",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-08-15",
    unidadAsignada: "DC-01",
    salarioDia: 480,
    fechaIngreso: "2019-03-01",
    estatus: "Activo",
    observaciones: "",
  },
  {
    id: "OP-002",
    nombre: "Juan Carlos Méndez Flores",
    telefono: "81 9120 3344",
    email: "jc.mendez@duroconcretos.mx",
    curp: "MEFJ900610HNLNDL08",
    rfc: "MEFJ900610RT4",
    noLicencia: "NL-2022-01203",
    tipoLicencia: "E",
    vencimientoLicencia: "2027-02-28",
    unidadAsignada: "DC-02",
    salarioDia: 500,
    fechaIngreso: "2021-07-15",
    estatus: "Activo",
    observaciones: "",
  },
  {
    id: "OP-003",
    nombre: "Miguel Ángel Rodríguez Sáenz",
    telefono: "81 7743 9921",
    email: "ma.rodriguez@duroconcretos.mx",
    curp: "ROSM780820HNLDGM05",
    rfc: "ROSM780820EF7",
    noLicencia: "NL-2020-00887",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-06-30",
    unidadAsignada: "DC-03",
    salarioDia: 460,
    fechaIngreso: "2018-09-10",
    estatus: "Activo",
    observaciones: "Licencia próxima a vencer",
  },
  {
    id: "OP-004",
    nombre: "Ernesto Leal Villanueva",
    telefono: "81 6612 8854",
    email: "e.leal@duroconcretos.mx",
    curp: "LAVE820415HNLLLR00",
    rfc: "LAVE820415GH8",
    noLicencia: "NL-2023-00392",
    tipoLicencia: "E",
    vencimientoLicencia: "2028-03-15",
    unidadAsignada: "DC-04",
    salarioDia: 510,
    fechaIngreso: "2020-01-20",
    estatus: "Activo",
    observaciones: "",
  },
  {
    id: "OP-005",
    nombre: "Héctor Ramírez Castillo",
    telefono: "81 5538 7761",
    email: "h.ramirez@duroconcretos.mx",
    curp: "RACH870901HNLMSH09",
    rfc: "RACH870901JK2",
    noLicencia: "NL-2021-01876",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-11-22",
    unidadAsignada: "DC-05",
    salarioDia: 490,
    fechaIngreso: "2022-03-05",
    estatus: "Activo",
    observaciones: "",
  },
  {
    id: "OP-006",
    nombre: "Arturo Peña González",
    telefono: "81 4421 6609",
    email: "a.pena@duroconcretos.mx",
    curp: "PEGA940215HNLNNR07",
    rfc: "PEGA940215MN5",
    noLicencia: "NL-2022-02541",
    tipoLicencia: "E",
    vencimientoLicencia: "2027-07-10",
    unidadAsignada: "DC-06",
    salarioDia: 470,
    fechaIngreso: "2023-06-01",
    estatus: "Activo",
    observaciones: "",
  },
  {
    id: "OP-007",
    nombre: "Fernando Morales Ibarra",
    telefono: "81 3309 5578",
    email: "f.morales@duroconcretos.mx",
    curp: "MOIF760530HNLRBR04",
    rfc: "MOIF760530PQ9",
    noLicencia: "NL-2019-00213",
    tipoLicencia: "E",
    vencimientoLicencia: "2025-12-31",
    unidadAsignada: "",
    salarioDia: 450,
    fechaIngreso: "2015-11-18",
    estatus: "Vacaciones",
    observaciones: "Licencia vencida, pendiente renovar",
  },
  {
    id: "OP-008",
    nombre: "Luis Alberto Torres Serna",
    telefono: "81 2201 4437",
    email: "la.torres@duroconcretos.mx",
    curp: "TOSL810712HNLRRS01",
    rfc: "TOSL810712RS6",
    noLicencia: "NL-2021-00765",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-09-05",
    unidadAsignada: "",
    salarioDia: 440,
    fechaIngreso: "2017-04-22",
    estatus: "Inactivo",
    observaciones: "Baja temporal por lesión",
  },
];

export function operadoresActivos(list: Operador[]) {
  return list.filter((op) => op.estatus === "Activo").length;
}

export function licenciasProximas(list: Operador[], diasAviso = 90) {
  const hoy = new Date();
  const limite = new Date(hoy.getTime() + diasAviso * 24 * 60 * 60 * 1000);
  return list.filter((op) => {
    const venc = new Date(op.vencimientoLicencia);
    return venc <= limite;
  }).length;
}
