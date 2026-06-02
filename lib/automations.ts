export type AutomationStatus = "Activa" | "Pausada" | "Error";
export type AutomationArea =
  | "SAT"
  | "Ventas"
  | "Transporte"
  | "Operaciones"
  | "Finanzas"
  | "Recursos Humanos";

export interface AutomationRule {
  id: string;
  name: string;
  area: AutomationArea;
  description: string;
  frequency: string;
  lastRun: string;
  nextRun: string;
  status: AutomationStatus;
  result: string;
  action: string;
}

export const automationRules: AutomationRule[] = [
  {
    id: "sat-cxc-cxp",
    name: "Descarga CFDI SAT CxC/CxP",
    area: "SAT",
    description: "Descarga CFDI emitidos y recibidos, clasifica CxC/CxP y actualiza saldos.",
    frequency: "Diario 06:00",
    lastRun: "24/05/2026 06:00",
    nextRun: "25/05/2026 06:00",
    status: "Activa",
    result: "18 CFDI procesados",
    action: "Descargar SAT",
  },
  {
    id: "gps-llegadas",
    name: "Horas de llegada por GPS",
    area: "Ventas",
    description: "Enlaza GPS de unidades con documentos de llegada/salida y marca diferencias.",
    frequency: "Cada 15 min",
    lastRun: "24/05/2026 15:45",
    nextRun: "24/05/2026 16:00",
    status: "Activa",
    result: "4 entregas validadas",
    action: "Enlazar GPS",
  },
  {
    id: "diesel-rendimiento",
    name: "Alerta de bajo rendimiento diesel",
    area: "Transporte",
    description: "Detecta unidades con rendimiento menor al mínimo y genera alerta de revisión.",
    frequency: "Diario 18:00",
    lastRun: "23/05/2026 18:00",
    nextRun: "24/05/2026 18:00",
    status: "Activa",
    result: "2 alertas abiertas",
    action: "Evaluar diesel",
  },
  {
    id: "mantenimiento-km",
    name: "Programación de mantenimiento por km",
    area: "Transporte",
    description: "Revisa kilometraje de unidades y crea pendientes cuando se acerca el servicio.",
    frequency: "Diario 07:00",
    lastRun: "24/05/2026 07:00",
    nextRun: "25/05/2026 07:00",
    status: "Activa",
    result: "1 servicio próximo",
    action: "Revisar unidades",
  },
  {
    id: "caja-reposicion",
    name: "Reposición automática de caja chica",
    area: "Operaciones",
    description: "Solicita reposición cuando el disponible cae por debajo del punto definido.",
    frequency: "Al detectar umbral",
    lastRun: "24/05/2026 12:10",
    nextRun: "Evento",
    status: "Activa",
    result: "Solicitud preparada",
    action: "Evaluar fondo",
  },
  {
    id: "estados-cliente",
    name: "Estados de cuenta por cliente",
    area: "Finanzas",
    description: "Genera estados de cuenta y marca saldos vencidos por cliente.",
    frequency: "Semanal lunes",
    lastRun: "20/05/2026 08:30",
    nextRun: "27/05/2026 08:30",
    status: "Activa",
    result: "4 estados generados",
    action: "Generar estados",
  },
  {
    id: "nomina-timbrada",
    name: "Timbrado y envío de nómina",
    area: "Recursos Humanos",
    description: "Prepara recibos, timbra nómina y envía comprobantes electrónicos.",
    frequency: "Quincenal",
    lastRun: "15/05/2026 17:00",
    nextRun: "31/05/2026 17:00",
    status: "Pausada",
    result: "Pendiente autorización",
    action: "Timbrar nómina",
  },
];

export async function ejecutarAutomatizacion(rule: AutomationRule) {
  await new Promise((resolve) => setTimeout(resolve, 650));

  return {
    ...rule,
    lastRun: new Date().toLocaleString("es-MX"),
    result: "Ejecución manual completada",
    status: "Activa" as const,
  };
}
