export type SalesClientStatus = "Activo" | "Prospecto" | "En riesgo" | "Inactivo";

export interface SalesClient {
  id: string;
  cliente: string;
  vendedor: string;
  contacto: string;
  telefono: string;
  correo: string;
  zona: string;
  obraPrincipal: string;
  volumenMensualM3: number;
  ventaMensual: number;
  saldoPendiente: number;
  ultimoContacto: string;
  proximaAccion: string;
  status: SalesClientStatus;
}

export interface SellerClientSummary {
  vendedor: string;
  clientes: number;
  activos: number;
  prospectos: number;
  enRiesgo: number;
  volumenMensualM3: number;
  ventaMensual: number;
  saldoPendiente: number;
}

const SALES_CLIENTS_KEY = "duro_concretos_sales_clients";

export const vendedoresBase = ["Ventas MTY", "Ana López", "Carlos Ortiz"];

export const salesClientsBase: SalesClient[] = [
  {
    id: "CLI-001",
    cliente: "Grupo Alfa Logistica",
    vendedor: "Ventas MTY",
    contacto: "Mariana Robles",
    telefono: "81 1200 8841",
    correo: "mariana@grupoalfa.mx",
    zona: "Apodaca",
    obraPrincipal: "Nave industrial Apodaca",
    volumenMensualM3: 100,
    ventaMensual: 185000,
    saldoPendiente: 32196,
    ultimoContacto: "2026-05-26",
    proximaAccion: "Confirmar volumen mensual",
    status: "Prospecto",
  },
  {
    id: "CLI-002",
    cliente: "Constructora Norte",
    vendedor: "Ana López",
    contacto: "Héctor Salinas",
    telefono: "81 1400 2210",
    correo: "hector@constructoranorte.mx",
    zona: "San Nicolás",
    obraPrincipal: "Plaza comercial San Nicolás",
    volumenMensualM3: 180,
    ventaMensual: 342000,
    saldoPendiente: 41752,
    ultimoContacto: "2026-05-27",
    proximaAccion: "Visita técnica",
    status: "Activo",
  },
  {
    id: "CLI-003",
    cliente: "Industrial Apodaca",
    vendedor: "Carlos Ortiz",
    contacto: "Daniel Garza",
    telefono: "81 1198 4432",
    correo: "daniel@industrialapodaca.mx",
    zona: "Apodaca",
    obraPrincipal: "Piso firme planta 2",
    volumenMensualM3: 120,
    ventaMensual: 228000,
    saldoPendiente: 16095,
    ultimoContacto: "2026-05-25",
    proximaAccion: "Enviar propuesta actualizada",
    status: "Activo",
  },
  {
    id: "CLI-004",
    cliente: "Urbanizadora Sierra",
    vendedor: "Ventas MTY",
    contacto: "Paola Treviño",
    telefono: "81 1770 9301",
    correo: "paola@urbanizadorasierra.mx",
    zona: "Monterrey",
    obraPrincipal: "Fraccionamiento etapa 3",
    volumenMensualM3: 256,
    ventaMensual: 512000,
    saldoPendiente: 31052,
    ultimoContacto: "2026-05-28",
    proximaAccion: "Negociar anticipo y crédito",
    status: "En riesgo",
  },
  {
    id: "CLI-005",
    cliente: "Residencial Cumbres",
    vendedor: "Ana López",
    contacto: "Jorge Medina",
    telefono: "81 1881 5540",
    correo: "jorge@residencialcumbres.mx",
    zona: "Cumbres",
    obraPrincipal: "Cimentación privada",
    volumenMensualM3: 48,
    ventaMensual: 96000,
    saldoPendiente: 0,
    ultimoContacto: "2026-05-26",
    proximaAccion: "Programar primer viaje",
    status: "Activo",
  },
  {
    id: "CLI-006",
    cliente: "Desarrollos Santa Catarina",
    vendedor: "Carlos Ortiz",
    contacto: "Sofía Ramos",
    telefono: "81 1663 2772",
    correo: "sofia@desarrollosstacatarina.mx",
    zona: "Santa Catarina",
    obraPrincipal: "Bodega logística",
    volumenMensualM3: 205,
    ventaMensual: 410000,
    saldoPendiente: 0,
    ultimoContacto: "2026-05-29",
    proximaAccion: "Confirmar resistencia",
    status: "Prospecto",
  },
];

export function loadSalesClients() {
  if (typeof window === "undefined") return salesClientsBase;

  const raw = localStorage.getItem(SALES_CLIENTS_KEY);
  if (!raw) {
    saveSalesClients(salesClientsBase);
    return salesClientsBase;
  }

  try {
    const clients = JSON.parse(raw) as SalesClient[];
    return clients.length > 0 ? clients : salesClientsBase;
  } catch {
    localStorage.removeItem(SALES_CLIENTS_KEY);
    saveSalesClients(salesClientsBase);
    return salesClientsBase;
  }
}

export function saveSalesClients(clients: SalesClient[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SALES_CLIENTS_KEY, JSON.stringify(clients));
  window.dispatchEvent(new CustomEvent("duro:sales-clients-updated"));
}

export function getSalesClientSummaries(clients: SalesClient[]): SellerClientSummary[] {
  const summaries = new Map<string, SellerClientSummary>();

  clients.forEach((client) => {
    const current = summaries.get(client.vendedor) ?? {
      vendedor: client.vendedor,
      clientes: 0,
      activos: 0,
      prospectos: 0,
      enRiesgo: 0,
      volumenMensualM3: 0,
      ventaMensual: 0,
      saldoPendiente: 0,
    };

    current.clientes += 1;
    current.activos += client.status === "Activo" ? 1 : 0;
    current.prospectos += client.status === "Prospecto" ? 1 : 0;
    current.enRiesgo += client.status === "En riesgo" ? 1 : 0;
    current.volumenMensualM3 += client.volumenMensualM3;
    current.ventaMensual += client.ventaMensual;
    current.saldoPendiente += client.saldoPendiente;

    summaries.set(client.vendedor, current);
  });

  return Array.from(summaries.values()).sort((a, b) => b.ventaMensual - a.ventaMensual);
}

export function getClientsBySeller(clients: SalesClient[], vendedor: string) {
  if (vendedor === "Todos") return clients;
  return clients.filter((client) => client.vendedor === vendedor);
}
