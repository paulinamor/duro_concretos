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
  resistencia?: string;
  comentarios?: string;
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

export const crmOpportunities: CrmOpportunity[] = [];

export const crmFollowUps: CrmFollowUp[] = [];
