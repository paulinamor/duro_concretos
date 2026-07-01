export interface Operador {
  id: string;
  apodo: string;
  nombre: string;
  fechaNacimiento: string;
  curp: string;
  rfc: string;
  direccion: string;
  puesto: string;
  fechaIngreso: string;
  sueldoBase: number;
  cuentaBBVA: string;
  baja: string;           // fecha de baja, vacío = activo
  noSeguroSocial: string;
  vencimientoContrato: string;
  tipoLicencia: string;
  vencimientoLicencia: string;
  vencimientoCredencial: string;
  contactosEmergencia: string;
  planta?: string;
}

export const operadores: Operador[] = [
  {
    id: "OP-001",
    apodo: "Roberto",
    nombre: "Roberto Garza Treviño",
    fechaNacimiento: "1985-03-12",
    curp: "GATR850312HNLRZB02",
    rfc: "GATR850312AB3",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2019-03-01",
    sueldoBase: 14400,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-08-15",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-002",
    apodo: "JC",
    nombre: "Juan Carlos Méndez Flores",
    fechaNacimiento: "1990-06-10",
    curp: "MEFJ900610HNLNDL08",
    rfc: "MEFJ900610RT4",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2021-07-15",
    sueldoBase: 15000,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2027-02-28",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-003",
    apodo: "Migue",
    nombre: "Miguel Ángel Rodríguez Sáenz",
    fechaNacimiento: "1978-08-20",
    curp: "ROSM780820HNLDGM05",
    rfc: "ROSM780820EF7",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2018-09-10",
    sueldoBase: 13800,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-06-30",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-004",
    apodo: "Neto",
    nombre: "Ernesto Leal Villanueva",
    fechaNacimiento: "1982-04-15",
    curp: "LAVE820415HNLLLR00",
    rfc: "LAVE820415GH8",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2020-01-20",
    sueldoBase: 15300,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2028-03-15",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-005",
    apodo: "Héctor",
    nombre: "Héctor Ramírez Castillo",
    fechaNacimiento: "1987-09-01",
    curp: "RACH870901HNLMSH09",
    rfc: "RACH870901JK2",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2022-03-05",
    sueldoBase: 14700,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-11-22",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-006",
    apodo: "Arturo",
    nombre: "Arturo Peña González",
    fechaNacimiento: "1994-02-15",
    curp: "PEGA940215HNLNNR07",
    rfc: "PEGA940215MN5",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2023-06-01",
    sueldoBase: 14100,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2027-07-10",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-007",
    apodo: "Fer",
    nombre: "Fernando Morales Ibarra",
    fechaNacimiento: "1976-05-30",
    curp: "MOIF760530HNLRBR04",
    rfc: "MOIF760530PQ9",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2015-11-18",
    sueldoBase: 13500,
    cuentaBBVA: "",
    baja: "2025-12-31",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2025-12-31",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
  {
    id: "OP-008",
    apodo: "Luis",
    nombre: "Luis Alberto Torres Serna",
    fechaNacimiento: "1981-07-12",
    curp: "TOSL810712HNLRRS01",
    rfc: "TOSL810712RS6",
    direccion: "",
    puesto: "Operador",
    fechaIngreso: "2017-04-22",
    sueldoBase: 13200,
    cuentaBBVA: "",
    baja: "",
    noSeguroSocial: "",
    vencimientoContrato: "",
    tipoLicencia: "E",
    vencimientoLicencia: "2026-09-05",
    vencimientoCredencial: "",
    contactosEmergencia: "",
  },
];

export function operadoresActivos(list: Operador[]) {
  return list.filter((op) => !op.baja).length;
}

export function diasDesdeIngreso(fechaIngreso: string): number {
  if (!fechaIngreso) return 0;
  return Math.floor((Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24));
}

export function docsProximos(list: Operador[], diasAviso = 90) {
  const limite = Date.now() + diasAviso * 24 * 60 * 60 * 1000;
  return list.filter((op) => {
    if (op.baja) return false;
    const checkFechas = [op.vencimientoLicencia, op.vencimientoCredencial, op.vencimientoContrato];
    return checkFechas.some((f) => {
      if (!f) return false;
      const t = new Date(f).getTime();
      return t <= limite;
    });
  }).length;
}
