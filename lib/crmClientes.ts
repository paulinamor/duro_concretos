export type TipoCliente = "Constructora" | "Gobierno" | "Particular" | "Inmobiliaria" | "Industrial";
export type EstatusCliente = "Activo" | "Inactivo" | "Prospecto" | "Bloqueado";
export type CalificacionCliente = "A" | "B" | "C";

export interface Cliente {
  id: string;
  razonSocial: string;
  nombreComercial: string;
  rfc: string;
  domicilio: string;
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  tipoCliente: TipoCliente;
  vendedorAsignado: string;
  limiteCredito: number;
  saldoPendiente: number;
  diasCredito: number;
  ultimaCompra: string;
  totalComprasAnio: number;
  m3Acumulados: number;
  estatus: EstatusCliente;
  calificacion: CalificacionCliente;
  fechaAlta: string;
  notas: string;
}

export const tiposCliente: TipoCliente[] = ["Constructora", "Gobierno", "Particular", "Inmobiliaria", "Industrial"];
export const estatusCliente: EstatusCliente[] = ["Activo", "Inactivo", "Prospecto", "Bloqueado"];
