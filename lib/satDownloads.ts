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

export async function descargarCfdiSat(
  request: SatDownloadRequest,
): Promise<SatDownloadResult> {
  return {
    kind: request.kind,
    downloadedAt: new Date().toISOString(),
    totalEncontrados: 0,
    cfdis: [],
  };
}

export function calcularDiasVencimiento(vencimiento: string) {
  const today = new Date();
  const dueDate = new Date(`${vencimiento}T00:00:00`);
  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}
