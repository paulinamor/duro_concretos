export type PipelineStage =
  | "Prospecto"
  | "Calificado"
  | "Cotización"
  | "Negociación"
  | "Cierre";

export interface CrmOpportunity {
  id: string;
  cliente: string;
  contacto: string;
  telefono: string;
  obra: string;
  etapa: PipelineStage;
  valorEstimado: number;
  m3Estimados: number;
  probabilidad: number;
  proximaAccion: string;
  fechaSeguimiento: string;
  responsable: string;
}

export type CustomerStatus = "Activo" | "Prospecto" | "En riesgo" | "Ganado";

export interface CrmFollowUp {
  id: string;
  cliente: string;
  contacto: string;
  oportunidad: string;
  etapa: PipelineStage;
  responsable: string;
  fecha: string;
  canal: "Llamada" | "WhatsApp" | "Visita" | "Correo";
  estadoCliente: CustomerStatus;
  prioridad: "Alta" | "Media" | "Baja";
  proximaAccion: string;
  ultimoComentario: string;
}

export const pipelineStages: PipelineStage[] = [
  "Prospecto",
  "Calificado",
  "Cotización",
  "Negociación",
  "Cierre",
];

export const crmOpportunities: CrmOpportunity[] = [
  { id: "CRM-001", cliente: "Grupo Alfa Logistica", contacto: "Mariana Robles", telefono: "81 1200 8841", obra: "Nave industrial Apodaca", etapa: "Prospecto", valorEstimado: 185000, m3Estimados: 100, probabilidad: 20, proximaAccion: "Llamada inicial", fechaSeguimiento: "2026-05-26", responsable: "Ventas MTY" },
  { id: "CRM-002", cliente: "Constructora Norte", contacto: "Héctor Salinas", telefono: "81 1400 2210", obra: "Plaza comercial San Nicolás", etapa: "Calificado", valorEstimado: 342000, m3Estimados: 180, probabilidad: 35, proximaAccion: "Visita técnica", fechaSeguimiento: "2026-05-27", responsable: "Ana López" },
  { id: "CRM-003", cliente: "Industrial Apodaca", contacto: "Daniel Garza", telefono: "81 1198 4432", obra: "Piso firme planta 2", etapa: "Cotización", valorEstimado: 228000, m3Estimados: 120, probabilidad: 55, proximaAccion: "Enviar propuesta", fechaSeguimiento: "2026-05-25", responsable: "Carlos Ortiz" },
  { id: "CRM-004", cliente: "Urbanizadora Sierra", contacto: "Paola Treviño", telefono: "81 1770 9301", obra: "Fraccionamiento etapa 3", etapa: "Negociación", valorEstimado: 512000, m3Estimados: 256, probabilidad: 70, proximaAccion: "Ajustar precio", fechaSeguimiento: "2026-05-28", responsable: "Ventas MTY" },
  { id: "CRM-005", cliente: "Residencial Cumbres", contacto: "Jorge Medina", telefono: "81 1881 5540", obra: "Cimentación privada", etapa: "Cierre", valorEstimado: 96000, m3Estimados: 48, probabilidad: 90, proximaAccion: "Programar primer viaje", fechaSeguimiento: "2026-05-26", responsable: "Ana López" },
  { id: "CRM-006", cliente: "Desarrollos Santa Catarina", contacto: "Sofía Ramos", telefono: "81 1663 2772", obra: "Bodega logística", etapa: "Cotización", valorEstimado: 410000, m3Estimados: 205, probabilidad: 50, proximaAccion: "Confirmar resistencia", fechaSeguimiento: "2026-05-29", responsable: "Carlos Ortiz" },
];

export const crmFollowUps: CrmFollowUp[] = [
  { id: "SEG-001", cliente: "Grupo Alfa Logistica", contacto: "Mariana Robles", oportunidad: "Nave industrial Apodaca", etapa: "Prospecto", responsable: "Ventas MTY", fecha: "2026-05-26", canal: "Llamada", estadoCliente: "Prospecto", prioridad: "Media", proximaAccion: "Confirmar volumen mensual", ultimoComentario: "Solicitó precios por resistencia y disponibilidad semanal." },
  { id: "SEG-002", cliente: "Constructora Norte", contacto: "Héctor Salinas", oportunidad: "Plaza comercial San Nicolás", etapa: "Calificado", responsable: "Ana López", fecha: "2026-05-27", canal: "Visita", estadoCliente: "Activo", prioridad: "Alta", proximaAccion: "Levantar requerimientos técnicos", ultimoComentario: "Cliente pide plan de entregas por etapas." },
  { id: "SEG-003", cliente: "Industrial Apodaca", contacto: "Daniel Garza", oportunidad: "Piso firme planta 2", etapa: "Cotización", responsable: "Carlos Ortiz", fecha: "2026-05-25", canal: "Correo", estadoCliente: "Activo", prioridad: "Alta", proximaAccion: "Enviar propuesta actualizada", ultimoComentario: "Falta confirmar bombeo y horario nocturno." },
  { id: "SEG-004", cliente: "Urbanizadora Sierra", contacto: "Paola Treviño", oportunidad: "Fraccionamiento etapa 3", etapa: "Negociación", responsable: "Ventas MTY", fecha: "2026-05-28", canal: "WhatsApp", estadoCliente: "En riesgo", prioridad: "Alta", proximaAccion: "Negociar anticipo y crédito", ultimoComentario: "Comparan precio con otro proveedor." },
  { id: "SEG-005", cliente: "Residencial Cumbres", contacto: "Jorge Medina", oportunidad: "Cimentación privada", etapa: "Cierre", responsable: "Ana López", fecha: "2026-05-26", canal: "Llamada", estadoCliente: "Ganado", prioridad: "Media", proximaAccion: "Programar primer suministro", ultimoComentario: "Aceptó cotización, pendiente orden de compra." },
];

export function getPipelineValueByStage(stage: PipelineStage) {
  return crmOpportunities
    .filter((opportunity) => opportunity.etapa === stage)
    .reduce((sum, opportunity) => sum + opportunity.valorEstimado, 0);
}
