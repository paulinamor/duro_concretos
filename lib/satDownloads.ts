export type SatDownloadKind = "cxc" | "cxp";

export interface SatDownloadRequest {
  kind: SatDownloadKind;
  rfcEmpresa: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface SatCfdi {
  uuid: string;
  folio: string;
  fecha: string;
  rfcContraparte: string;
  razonSocial: string;
  subtotal: number;
  iva: number;
  total: number;
  metodoPago: "PUE" | "PPD";
  estatus: "Vigente" | "Cancelado";
  vencimiento: string;
}

export interface SatDownloadResult {
  kind: SatDownloadKind;
  downloadedAt: string;
  totalEncontrados: number;
  cfdis: SatCfdi[];
}

const mockSatCfdis: Record<SatDownloadKind, SatCfdi[]> = {
  cxc: [
    { uuid: "A93F-DC01-CXC", folio: "FAC-2026-118", fecha: "2026-05-20", rfcContraparte: "GAL890512H23", razonSocial: "Grupo Alfa Logistica", subtotal: 22000, iva: 3520, total: 25520, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-04" },
    { uuid: "B77D-DC02-CXC", folio: "FAC-2026-119", fecha: "2026-05-21", rfcContraparte: "CON920714T11", razonSocial: "Constructora Norte", subtotal: 15200, iva: 2432, total: 17632, metodoPago: "PUE", estatus: "Vigente", vencimiento: "2026-05-21" },
    { uuid: "C18A-DC03-CXC", folio: "FAC-2026-120", fecha: "2026-05-22", rfcContraparte: "IND010806K91", razonSocial: "Industrial Apodaca", subtotal: 13875, iva: 2220, total: 16095, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-06" },
    { uuid: "D42E-DC04-CXC", folio: "FAC-2026-121", fecha: "2026-05-22", rfcContraparte: "URB990331P28", razonSocial: "Urbanizadora Sierra", subtotal: 11100, iva: 1776, total: 12876, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-06" },
  ],
  cxp: [
    { uuid: "P11A-DC01-CXP", folio: "PROV-8812", fecha: "2026-05-18", rfcContraparte: "LUB850909G32", razonSocial: "Lubricantes MX", subtotal: 3833, iva: 613, total: 4446, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-02" },
    { uuid: "P22B-DC02-CXP", folio: "PROV-4460", fecha: "2026-05-19", rfcContraparte: "DIE760214Q54", razonSocial: "Diesel del Norte", subtotal: 4460, iva: 714, total: 5174, metodoPago: "PUE", estatus: "Vigente", vencimiento: "2026-05-19" },
    { uuid: "P33C-DC03-CXP", folio: "PROV-3200", fecha: "2026-05-20", rfcContraparte: "TMO910102F19", razonSocial: "Taller Monterrey", subtotal: 3200, iva: 512, total: 3712, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-04" },
    { uuid: "P44D-DC04-CXP", folio: "PROV-9600", fecha: "2026-05-21", rfcContraparte: "LLA800411N73", razonSocial: "Llantera JC", subtotal: 9600, iva: 1536, total: 11136, metodoPago: "PPD", estatus: "Vigente", vencimiento: "2026-06-05" },
  ],
};

export async function descargarCfdiSat(
  request: SatDownloadRequest,
): Promise<SatDownloadResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const cfdis = mockSatCfdis[request.kind].filter((cfdi) => {
    return cfdi.fecha >= request.fechaInicio && cfdi.fecha <= request.fechaFin;
  });

  return {
    kind: request.kind,
    downloadedAt: new Date().toISOString(),
    totalEncontrados: cfdis.length,
    cfdis,
  };
}

export function calcularDiasVencimiento(vencimiento: string) {
  const today = new Date();
  const dueDate = new Date(`${vencimiento}T00:00:00`);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}
