"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, BadgeCheck, BarChart3, Building2, CalendarDays, CheckCircle2, ChevronDown,
  CloudDownload, Download, Eye, EyeOff, FileDown, FileKey2, FileText, Loader2,
  Plus, Receipt, RefreshCw, Search, Send, ShieldCheck, Trash2, Upload, User, X,
} from "lucide-react";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import { getCollectionDocs, getDocument, upsertDocument, deleteDocument, COLLECTIONS, orderBy, limit } from "@/lib/db";
import { useCollectionRaw } from "@/lib/useCollection";
import { withPlantaTag, getStoredSession, DEVELOPER_EMAIL } from "@/lib/auth";

// ─── Catálogos SAT ────────────────────────────────────────────────────────────

// ─── Catálogos SAT completos ──────────────────────────────────────────────────

const USO_CFDI = [
  { clave: "G01",  desc: "Adquisición de mercancias" },
  { clave: "G02",  desc: "Devoluciones, descuentos o bonificaciones" },
  { clave: "G03",  desc: "Gastos en general" },
  { clave: "I01",  desc: "Construcciones" },
  { clave: "I02",  desc: "Mobilario y equipo de oficina por actividades" },
  { clave: "I03",  desc: "Equipo de transporte" },
  { clave: "I04",  desc: "Equipo de cómputo y accesorios" },
  { clave: "I05",  desc: "Dados, troqueles, moldes, matrices y herramental" },
  { clave: "I06",  desc: "Comunicaciones telefónicas" },
  { clave: "I07",  desc: "Comunicaciones satelitales" },
  { clave: "I08",  desc: "Otra maquinaria y equipo" },
  { clave: "D01",  desc: "Honorarios médicos, dentales y gastos hospitalarios" },
  { clave: "D02",  desc: "Gastos médicos por incapacidad o discapacidad" },
  { clave: "D03",  desc: "Gastos funerales" },
  { clave: "D04",  desc: "Donativos" },
  { clave: "D05",  desc: "Intereses reales pagados por créditos hipotecarios (casa habitación)" },
  { clave: "D06",  desc: "Aportaciones voluntarias al SAR" },
  { clave: "D07",  desc: "Primas por seguros de gastos médicos" },
  { clave: "D08",  desc: "Gastos de transportación escolar obligatoria" },
  { clave: "D09",  desc: "Depósitos en cuentas para el ahorro, primas de pensiones" },
  { clave: "D10",  desc: "Pagos por servicios educativos (colegiaturas)" },
  { clave: "S01",  desc: "Sin efectos fiscales" },
  { clave: "CP01", desc: "Pagos" },
  { clave: "CN01", desc: "Nómina" },
];

const FORMA_PAGO = [
  { clave: "01", desc: "Efectivo" },
  { clave: "02", desc: "Cheque nominativo" },
  { clave: "03", desc: "Transferencia electrónica de fondos" },
  { clave: "04", desc: "Tarjeta de crédito" },
  { clave: "05", desc: "Monedero electrónico" },
  { clave: "06", desc: "Dinero electrónico" },
  { clave: "08", desc: "Vales de despensa" },
  { clave: "12", desc: "Dación en pago" },
  { clave: "13", desc: "Pago por subrogación" },
  { clave: "14", desc: "Pago por consignación" },
  { clave: "15", desc: "Condonación" },
  { clave: "17", desc: "Compensación" },
  { clave: "23", desc: "Novación" },
  { clave: "24", desc: "Confusión" },
  { clave: "25", desc: "Remisión de deuda" },
  { clave: "26", desc: "Prescripción o caducidad" },
  { clave: "27", desc: "A satisfacción del acreedor" },
  { clave: "28", desc: "Tarjeta de débito" },
  { clave: "29", desc: "Tarjeta de servicios" },
  { clave: "30", desc: "Aplicación de anticipos" },
  { clave: "31", desc: "Intermediario pagos" },
  { clave: "99", desc: "Por definir" },
];

const REGIMEN_FISCAL = [
  { clave: "601", desc: "General de Ley Personas Morales" },
  { clave: "603", desc: "Personas Morales con Fines no Lucrativos" },
  { clave: "605", desc: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { clave: "606", desc: "Arrendamiento" },
  { clave: "607", desc: "Régimen de Enajenación o Adquisición de Bienes" },
  { clave: "608", desc: "Demás ingresos" },
  { clave: "609", desc: "Consolidación" },
  { clave: "610", desc: "Residentes en el Extranjero sin Establecimiento Permanente en México" },
  { clave: "611", desc: "Ingresos por Dividendos (socios y accionistas)" },
  { clave: "612", desc: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { clave: "614", desc: "Ingresos por intereses" },
  { clave: "615", desc: "Régimen de los ingresos por obtención de premios" },
  { clave: "616", desc: "Sin obligaciones fiscales" },
  { clave: "620", desc: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos" },
  { clave: "621", desc: "Incorporación Fiscal" },
  { clave: "622", desc: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { clave: "623", desc: "Opcional para Grupos de Sociedades" },
  { clave: "624", desc: "Coordinados" },
  { clave: "625", desc: "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { clave: "626", desc: "Régimen Simplificado de Confianza (RESICO)" },
];

const CLAVE_UNIDAD = [
  // Volumen / construcción
  { clave: "E48", desc: "Unidad de servicio (concreto)" },
  { clave: "MTQ", desc: "Metro cúbico" },
  { clave: "LTR", desc: "Litro" },
  { clave: "MLT", desc: "Mililitro" },
  { clave: "XBR", desc: "Barra" },
  { clave: "XTY", desc: "Tanque cilíndrico" },
  { clave: "R9",  desc: "Mil metros cúbicos" },
  // Longitud / área
  { clave: "MTR", desc: "Metro" },
  { clave: "CMT", desc: "Centímetro" },
  { clave: "MMT", desc: "Milímetro" },
  { clave: "KMT", desc: "Kilómetro" },
  { clave: "MTK", desc: "Metro cuadrado" },
  { clave: "CMK", desc: "Centímetro cuadrado" },
  { clave: "HAR", desc: "Hectárea" },
  // Masa / peso
  { clave: "KGM", desc: "Kilogramo" },
  { clave: "GRM", desc: "Gramo" },
  { clave: "MGM", desc: "Miligramo" },
  { clave: "TNE", desc: "Tonelada" },
  { clave: "LBR", desc: "Libra" },
  // Unidades contables
  { clave: "H87", desc: "Pieza" },
  { clave: "DZN", desc: "Docena" },
  { clave: "PR",  desc: "Par" },
  { clave: "SET", desc: "Conjunto" },
  { clave: "XBX", desc: "Caja" },
  { clave: "XPK", desc: "Paquete" },
  { clave: "XBG", desc: "Bolso" },
  { clave: "XJR", desc: "Tarro" },
  { clave: "XKI", desc: "Kit" },
  { clave: "XRO", desc: "Rollo" },
  { clave: "XCE", desc: "Cesto tejido" },
  // Tiempo / servicio
  { clave: "HUR", desc: "Hora" },
  { clave: "DAY", desc: "Día" },
  { clave: "WEE", desc: "Semana" },
  { clave: "MON", desc: "Mes" },
  { clave: "ANN", desc: "Año" },
  { clave: "ACT", desc: "Actividad" },
  { clave: "E51", desc: "Trabajo" },
  // Energía / eléctrico
  { clave: "KWH", desc: "Kilowatt hora" },
  { clave: "WTT", desc: "Watt" },
  { clave: "KWT", desc: "Kilowatt" },
  { clave: "AMP", desc: "Ampere" },
  // Otros
  { clave: "XUN", desc: "Unidad" },
];

const UNIDAD_NOMBRE: Record<string, string> = Object.fromEntries(
  [
    ["E48","Unidad de servicio"],["MTQ","Metro cúbico"],["LTR","Litro"],["MLT","Mililitro"],
    ["XBR","Barra"],["XTY","Tanque cilíndrico"],["R9","Mil metros cúbicos"],
    ["MTR","Metro"],["CMT","Centímetro"],["MMT","Milímetro"],["KMT","Kilómetro"],["MTK","Metro cuadrado"],["CMK","Centímetro cuadrado"],["HAR","Hectárea"],
    ["KGM","Kilogramo"],["GRM","Gramo"],["MGM","Miligramo"],["TNE","Tonelada"],["LBR","Libra"],
    ["H87","Pieza"],["DZN","Docena"],["PR","Par"],["SET","Conjunto"],["XBX","Caja"],["XPK","Paquete"],
    ["XBG","Bolso"],["XJR","Tarro"],["XKI","Kit"],["XRO","Rollo"],["XCE","Cesto tejido"],
    ["HUR","Hora"],["DAY","Día"],["WEE","Semana"],["MON","Mes"],["ANN","Año"],["ACT","Actividad"],["E51","Trabajo"],
    ["KWH","Kilowatt hora"],["WTT","Watt"],["KWT","Kilowatt"],["AMP","Ampere"],
    ["XUN","Unidad"],
  ]
);

function isValidRfc(rfc: string) {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(rfc.trim().toUpperCase());
}
function isValidCp(cp: string) {
  return /^\d{5}$/.test(cp.trim());
}

// Sugerencias de clave producto SAT (el campo acepta cualquier clave válida del SAT)
const CLAVE_PRODUCTO_SUGERIDAS = [
  // Construcción y concreto
  { clave: "30161801", desc: "Concreto premezclado" },
  { clave: "30161802", desc: "Concreto para pavimentos" },
  { clave: "30161700", desc: "Mortero y cemento" },
  { clave: "30161500", desc: "Mezclas de asfalto y alquitrán" },
  { clave: "30101500", desc: "Materiales de construcción - madera" },
  { clave: "30102100", desc: "Varilla y acero de construcción" },
  { clave: "30111500", desc: "Ladrillos y tabiques" },
  { clave: "30121500", desc: "Vidrio para construcción" },
  { clave: "30131600", desc: "Materiales de impermeabilización" },
  // Servicios de transporte
  { clave: "78102200", desc: "Servicios de transporte de carga por carretera" },
  { clave: "78101801", desc: "Servicio de transporte de materiales de construcción" },
  { clave: "78111500", desc: "Carga y descarga" },
  { clave: "78121500", desc: "Almacenamiento y bodega" },
  // Servicios profesionales y construcción
  { clave: "72131702", desc: "Servicios de construcción" },
  { clave: "72101500", desc: "Servicios de arquitectura" },
  { clave: "72101800", desc: "Servicios de ingeniería civil" },
  { clave: "72154300", desc: "Servicios de mantenimiento de maquinaria" },
  { clave: "72154200", desc: "Servicios de mantenimiento de equipo" },
  // Arrendamiento y renta
  { clave: "80131500", desc: "Arrendamiento de maquinaria y equipo" },
  { clave: "80131501", desc: "Renta de maquinaria pesada" },
  { clave: "80101600", desc: "Arrendamiento de inmuebles" },
  // Administración y servicios
  { clave: "84111506", desc: "Servicios de gestión administrativa" },
  { clave: "84131500", desc: "Servicios de contabilidad" },
  { clave: "84121500", desc: "Servicios de recursos humanos" },
  { clave: "43232100", desc: "Software y licencias" },
  // Combustibles y materiales
  { clave: "15101505", desc: "Diesel" },
  { clave: "15101507", desc: "Gasolina" },
  { clave: "15101512", desc: "Gas natural" },
  { clave: "15111500", desc: "Lubricantes y aceites" },
  // Maquinaria y herramientas
  { clave: "22101500", desc: "Herramientas de mano" },
  { clave: "23101500", desc: "Equipo de movimiento de tierra" },
  { clave: "23101512", desc: "Camiones de volteo y dump trucks" },
  { clave: "23101600", desc: "Grúas y equipo de elevación" },
  // Alimentos y productos generales
  { clave: "50161500", desc: "Alimentos preparados" },
  { clave: "50192100", desc: "Agua purificada" },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoCFDI = "I" | "E" | "T";
type MetodoPago = "PUE" | "PPD";
type StatusCFDI = "valid" | "cancelled" | "draft";

interface Concepto {
  descripcion:   string;
  cantidad:      number;
  precio:        number;
  claveProducto: string;
  claveUnidad:   string;
  tasaIVA:       number;
}

interface CfdiEmitido {
  id?:           string;
  uuid:          string;
  facturamaId:   string;
  tipo:          TipoCFDI;
  clienteNombre: string;
  clienteRfc:    string;
  folio:         number;
  serie:         string;
  total:         number;
  subtotal:      number;
  impuestos:     number;
  fechaTimbrado: string;
  status:        StatusCFDI;
  pdfUrl:        string;
  xmlUrl:        string;
  planta:        string;
  createdAt:     string;
  creadoPor?:    string;
  emisorRfc?:    string;
}

interface DescargaSAT {
  id:          string;
  requestId:   string;
  rfc:         string;
  status:      "pendiente" | "procesando" | "listo" | "error";
  direccion:   string;
  tipo:        string;
  fechaInicio: string;
  fechaFin:    string;
  packageIds:  string[];
  solicitadoEn?: { seconds: number } | string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fmtDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const TIPO_LABEL: Record<TipoCFDI, string> = { I: "Ingreso", E: "Egreso", T: "Traslado" };
const STATUS_TONE: Record<StatusCFDI | string, string> = { valid: "aprobado", cancelled: "cancelado", draft: "pendiente" };
const STATUS_LABEL: Record<StatusCFDI | string, string> = { valid: "Vigente", cancelled: "Cancelado", draft: "Borrador" };

const emptyConcepto = (): Concepto => ({
  descripcion: "", cantidad: 1, precio: 0,
  claveProducto: "30161801", claveUnidad: "E48", tasaIVA: 0.16,
});

// ─── Componente campo ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
const selectCls = `${inputCls} cursor-pointer`;

// ─── Modal Emitir CFDI ────────────────────────────────────────────────────────

function EmitirDrawer({
  open,
  onClose,
  onEmitido,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  onEmitido: (cfdi: CfdiEmitido) => void;
  userEmail: string;
}) {
  const [tipo, setTipo]       = useState<TipoCFDI>("I");
  const [serie, setSerie]     = useState("A");
  const [folio, setFolio]     = useState("1");
  const [metodo, setMetodo]   = useState<MetodoPago>("PUE");
  const [forma, setForma]     = useState("03");
  const [uso, setUso]         = useState("G03");

  const [rfc, setRfc]         = useState("");
  const [nombre, setNombre]   = useState("");
  const [regimen, setRegimen] = useState("601");
  const [cp, setCp]           = useState("");
  const [email, setEmail]     = useState("");

  const [conceptos, setConceptos] = useState<Concepto[]>([emptyConcepto()]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emisoresFm, setEmisoresFm] = useState<EmisorFm[]>([]);
  const [emisorRfcSel, setEmisorRfcSel] = useState("");
  const [rfcLookupLoading, setRfcLookupLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(""); setFieldErrors({});
    getCollectionDocs<EmisorFm>("emisoresFm")
      .then((docs) => setEmisoresFm(docs.filter((d) => d.activo !== false)))
      .catch(() => {});
    // Auto-increment folio
    getCollectionDocs<{ folio: number | string }>(COLLECTIONS.cfdiEmitidos, [orderBy("createdAt", "desc"), limit(1)])
      .then((docs) => {
        if (docs.length > 0) {
          const last = Number(docs[0].folio);
          if (!isNaN(last) && last > 0) setFolio(String(last + 1));
        }
      })
      .catch(() => {});
  }, [open]);

  async function lookupRfc(rfcVal: string) {
    const clean = rfcVal.trim().toUpperCase();
    if (clean.length < 12) return;
    setRfcLookupLoading(true);
    try {
      const clientes = await getCollectionDocs<{ rfc: string; nombre: string; regimenFiscal?: string; codigoPostal?: string }>(
        COLLECTIONS.clientes, [],
      );
      const match = clientes.find((c) => c.rfc?.toUpperCase() === clean);
      if (match) {
        if (match.nombre)         setNombre(match.nombre);
        if (match.regimenFiscal)  setRegimen(match.regimenFiscal);
        if (match.codigoPostal)   setCp(match.codigoPostal);
      }
    } catch { /* ignore */ } finally { setRfcLookupLoading(false); }
  }

  const subtotal  = conceptos.reduce((s, c) => s + c.cantidad * c.precio, 0);
  const totalIVA  = conceptos.reduce((s, c) => s + c.cantidad * c.precio * c.tasaIVA, 0);
  const total     = subtotal + totalIVA;

  function updConcepto(i: number, field: keyof Concepto, value: string | number) {
    setConceptos((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  async function handleTimbrar() {
    setError(""); setFieldErrors({});
    const fe: Record<string, string> = {};

    const emisorSel = emisoresFm.find((e) => e.rfc === emisorRfcSel);
    if (!emisorSel)         fe.emisor  = "Selecciona la empresa emisora";
    else if (!emisorSel.cp) fe.emisor  = "El emisor no tiene CP. Elimínalo y regístralo con CP.";

    if (!rfc.trim())                   fe.rfc    = "RFC requerido";
    else if (!isValidRfc(rfc))         fe.rfc    = "Formato de RFC inválido (ej. XAXX010101000)";
    if (!nombre.trim())                fe.nombre  = "Razón social requerida";
    if (!isValidCp(cp))                fe.cp     = "Código postal de 5 dígitos requerido";
    if (!folio.trim())                 fe.folio   = "Folio requerido";

    conceptos.forEach((c, i) => {
      if (!c.descripcion.trim()) fe[`desc_${i}`]   = "Descripción requerida";
      if (c.cantidad <= 0)       fe[`cant_${i}`]   = "Cantidad > 0";
      if (c.precio <= 0)         fe[`precio_${i}`] = "Precio > 0";
    });

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      setError("Corrige los campos marcados antes de timbrar.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/facturama/timbrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emisorRfc:    emisorSel!.rfc,
          emisorNombre: emisorSel!.nombre,
          emisorRegimen: emisorSel!.regimen,
          emisorCp:     emisorSel!.cp ?? "",
          tipoComprobante: tipo,
          serie,
          folio,
          metodoPago: metodo,
          formaPago:  metodo === "PPD" ? "99" : forma,
          usoCfdi: uso,
          clienteRfc:          rfc.trim().toUpperCase(),
          clienteNombre:       nombre.trim(),
          clienteRegimenFiscal: regimen,
          clienteCp:           cp.trim(),
          clienteEmail:        email.trim() || undefined,
          moneda: "MXN",
          conceptos: conceptos.map((c) => ({
            claveProdServ:  c.claveProducto,
            claveUnidad:    c.claveUnidad,
            descripcion:    c.descripcion.trim(),
            unidad:         UNIDAD_NOMBRE[c.claveUnidad] ?? c.claveUnidad,
            cantidad:       c.cantidad,
            precioUnitario: c.precio,
            importe:        Math.round(c.cantidad * c.precio * 100) / 100,
            objetoImp:      c.tasaIVA > 0 ? "02" : "01",
            impuestos: c.tasaIVA > 0 ? [{
              tipoImpuesto: "trasladado",
              base:         Math.round(c.cantidad * c.precio * 100) / 100,
              impuesto:     "002",
              factor:       "Tasa",
              tasa:         c.tasaIVA,
              importe:      Math.round(c.cantidad * c.precio * c.tasaIVA * 100) / 100,
            }] : [],
          })),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Error al timbrar"); return; }

      const nuevo: CfdiEmitido = withPlantaTag({
        uuid:          data.uuid,
        facturamaId:   data.facturamaId,
        tipo,
        clienteNombre: nombre,
        clienteRfc:    rfc,
        folio:         data.folio ?? "",
        serie,
        total,
        subtotal,
        impuestos:     totalIVA,
        fechaTimbrado: new Date().toISOString(),
        status:        "valid",
        pdfUrl:        `/api/facturama/download?id=${data.facturamaId}&format=pdf`,
        xmlUrl:        `/api/facturama/download?id=${data.facturamaId}&format=xml`,
        createdAt:     new Date().toISOString(),
        creadoPor:     userEmail || undefined,
        emisorRfc:     emisorSel!.rfc,
      });
      onEmitido(nuevo);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Send size={17} />
            </div>
            <h2 className="text-gray-900 font-semibold text-base">Emitir CFDI</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tipo, serie, folio y uso */}
          <div className="grid grid-cols-4 gap-4">
            <Field label="Tipo">
              <AppSelect value={tipo} onChange={(e) => setTipo(e.target.value as TipoCFDI)}>
                <option value="I">I — Ingreso</option>
                <option value="E">E — Egreso</option>
                <option value="T">T — Traslado</option>
              </AppSelect>
            </Field>
            <Field label="Serie">
              <input value={serie} onChange={(e) => setSerie(e.target.value)} className={inputCls} placeholder="A" />
            </Field>
            <div>
              <Field label="Folio *">
                <input
                  value={folio}
                  onChange={(e) => { setFolio(e.target.value.replace(/\D/g, "")); setFieldErrors((p) => ({ ...p, folio: "" })); }}
                  className={`${inputCls} ${fieldErrors.folio ? "border-red-400 ring-1 ring-red-200" : ""}`}
                  placeholder="1"
                />
              </Field>
              {fieldErrors.folio && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors.folio}</p>}
            </div>
            <Field label="Uso CFDI">
              <AppSelect value={uso} onChange={(e) => setUso(e.target.value)}>
                {USO_CFDI.map((u) => (
                  <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                ))}
              </AppSelect>
            </Field>
          </div>

          {/* Pago */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Método de pago">
              <AppSelect value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="PUE">PUE — Pago en una exhibición</option>
                <option value="PPD">PPD — Pago en parcialidades o diferido</option>
              </AppSelect>
            </Field>
            <Field label="Forma de pago">
              <AppSelect value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMA_PAGO.map((f) => (
                  <option key={f.clave} value={f.clave}>{f.clave} — {f.desc}</option>
                ))}
              </AppSelect>
            </Field>
          </div>

          {/* Emisor */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Empresa que emite</p>
            {emisoresFm.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
                <AlertCircle size={14} />
                Sin emisores registrados. Ve a la pestaña <strong className="mx-1">Emisores</strong> para registrar un CSD.
              </div>
            ) : (
              <div>
                <Field label="Empresa emisora *">
                  <AppSelect
                    value={emisorRfcSel}
                    onChange={(e) => { setEmisorRfcSel(e.target.value); setFieldErrors((p) => ({ ...p, emisor: "" })); }}
                    className={fieldErrors.emisor ? "border-red-400 ring-1 ring-red-200" : ""}
                  >
                    <option value="">— Seleccionar empresa —</option>
                    {emisoresFm.map((em) => (
                      <option key={em.rfc} value={em.rfc}>{em.rfc} — {em.nombre}</option>
                    ))}
                  </AppSelect>
                </Field>
                {fieldErrors.emisor && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors.emisor}</p>}
              </div>
            )}
          </div>

          {/* Cliente */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Datos del receptor</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Field label="RFC *">
                  <div className="relative">
                    <input
                      value={rfc}
                      onChange={(e) => { setRfc(e.target.value.toUpperCase()); setFieldErrors((p) => ({ ...p, rfc: "" })); }}
                      onBlur={(e) => lookupRfc(e.target.value)}
                      className={`${inputCls} uppercase font-mono pr-8 ${fieldErrors.rfc ? "border-red-400 ring-1 ring-red-200" : ""}`}
                      placeholder="XAXX010101000"
                      maxLength={13}
                    />
                    {rfcLookupLoading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                  </div>
                </Field>
                {fieldErrors.rfc && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors.rfc}</p>}
              </div>
              <div>
                <Field label="Nombre / Razón social *">
                  <input
                    value={nombre}
                    onChange={(e) => { setNombre(e.target.value); setFieldErrors((p) => ({ ...p, nombre: "" })); }}
                    className={`${inputCls} ${fieldErrors.nombre ? "border-red-400 ring-1 ring-red-200" : ""}`}
                    placeholder="Empresa S.A. de C.V."
                  />
                </Field>
                {fieldErrors.nombre && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors.nombre}</p>}
              </div>
              <Field label="Régimen fiscal *">
                <AppSelect value={regimen} onChange={(e) => setRegimen(e.target.value)}>
                  {REGIMEN_FISCAL.map((r) => (
                    <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>
                  ))}
                </AppSelect>
              </Field>
              <div>
                <Field label="Código postal *">
                  <input
                    value={cp}
                    onChange={(e) => { setCp(e.target.value.replace(/\D/g, "").slice(0, 5)); setFieldErrors((p) => ({ ...p, cp: "" })); }}
                    className={`${inputCls} font-mono ${fieldErrors.cp ? "border-red-400 ring-1 ring-red-200" : ""}`}
                    placeholder="64000"
                    maxLength={5}
                  />
                </Field>
                {fieldErrors.cp && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors.cp}</p>}
              </div>
              <Field label="Correo (opcional)">
                <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="cliente@empresa.com" type="email" />
              </Field>
            </div>
          </div>

          {/* Conceptos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Conceptos</p>
              <button
                onClick={() => setConceptos((p) => [...p, emptyConcepto()])}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Plus size={12} /> Agregar
              </button>
            </div>

            <div className="space-y-3">
              {conceptos.map((c, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1">
                      <Field label="Descripción *">
                        <input
                          value={c.descripcion}
                          onChange={(e) => { updConcepto(i, "descripcion", e.target.value); setFieldErrors((p) => ({ ...p, [`desc_${i}`]: "" })); }}
                          className={`${inputCls} ${fieldErrors[`desc_${i}`] ? "border-red-400 ring-1 ring-red-200" : ""}`}
                          placeholder="Suministro de concreto premezclado"
                        />
                      </Field>
                      {fieldErrors[`desc_${i}`] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{fieldErrors[`desc_${i}`]}</p>}
                    </div>
                    {conceptos.length > 1 && (
                      <button onClick={() => setConceptos((p) => p.filter((_, idx) => idx !== i))} className="mt-6 rounded p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Field label="Cantidad *">
                        <input
                          type="number" value={c.cantidad} min={0.01} step={0.01}
                          onChange={(e) => { updConcepto(i, "cantidad", Number(e.target.value)); setFieldErrors((p) => ({ ...p, [`cant_${i}`]: "" })); }}
                          className={`${inputCls} ${fieldErrors[`cant_${i}`] ? "border-red-400 ring-1 ring-red-200" : ""}`}
                        />
                      </Field>
                      {fieldErrors[`cant_${i}`] && <p className="mt-1 text-xs text-red-500">{fieldErrors[`cant_${i}`]}</p>}
                    </div>
                    <div>
                      <Field label="Precio unitario *">
                        <input
                          type="number" value={c.precio} min={0.01} step={0.01}
                          onChange={(e) => { updConcepto(i, "precio", Number(e.target.value)); setFieldErrors((p) => ({ ...p, [`precio_${i}`]: "" })); }}
                          className={`${inputCls} ${fieldErrors[`precio_${i}`] ? "border-red-400 ring-1 ring-red-200" : ""}`}
                        />
                      </Field>
                      {fieldErrors[`precio_${i}`] && <p className="mt-1 text-xs text-red-500">{fieldErrors[`precio_${i}`]}</p>}
                    </div>
                    <Field label="IVA (%)">
                      <AppSelect value={c.tasaIVA} onChange={(e) => updConcepto(i, "tasaIVA", Number(e.target.value))}>
                        <option value={0.16}>16%</option>
                        <option value={0.08}>8%</option>
                        <option value={0}>0% (Exento)</option>
                      </AppSelect>
                    </Field>
                    <Field label="Subtotal">
                      <div className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-500 font-mono">
                        {fmt(c.cantidad * c.precio)}
                      </div>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field label="Clave producto SAT *">
                      <input
                        list={`prod-list-${i}`}
                        value={c.claveProducto}
                        onChange={(e) => updConcepto(i, "claveProducto", e.target.value)}
                        className={inputCls}
                        placeholder="30161801"
                      />
                      <datalist id={`prod-list-${i}`}>
                        {CLAVE_PRODUCTO_SUGERIDAS.map((p) => (
                          <option key={p.clave} value={p.clave}>{p.clave} — {p.desc}</option>
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Clave unidad SAT *">
                      <AppSelect value={c.claveUnidad} onChange={(e) => updConcepto(i, "claveUnidad", e.target.value)}>
                        {CLAVE_UNIDAD.map((u) => (
                          <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>
                        ))}
                      </AppSelect>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA</span><span>{fmt(totalIVA)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={15} />{error}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleTimbrar}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#CC2229] py-2.5 text-sm font-semibold text-white hover:bg-[#B01E24] disabled:opacity-50 transition-colors shadow-lg shadow-[#CC2229]/20"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {loading ? "Timbrando…" : "Timbrar CFDI"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ─── Tab: Emisores Facturama ──────────────────────────────────────────────────

type EmisorFm = { id?: string; rfc: string; nombre: string; regimen: string; cp?: string; activo?: boolean };

const satInpDark = "w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
const satLblDark = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";

function EmisorasTab() {
  const [emisores,     setEmisores]     = useState<EmisorFm[]>([]);
  const [loadingList,  setLoadingList]  = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [fRfc,         setFRfc]         = useState("");
  const [fNombre,      setFNombre]      = useState("");
  const [fRegimen,     setFRegimen]     = useState("601");
  const [fCp,          setFCp]          = useState("");
  const [fPwd,         setFPwd]         = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [cerFile,      setCerFile]      = useState<File | null>(null);
  const [keyFile,      setKeyFile]      = useState<File | null>(null);
  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [saving,       setSaving]       = useState(false);
  const [deletingRfc,  setDeletingRfc]  = useState<string | null>(null);
  const [msg,          setMsg]          = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [certInfo,     setCertInfo]     = useState<{ rfc: string; nombre: string; validTo: string; validFrom: string; expired: boolean; numeroCertificado: string } | null>(null);
  const [verifying,    setVerifying]    = useState(false);

  useEffect(() => {
    getCollectionDocs<EmisorFm>("emisoresFm")
      .then((docs) => setEmisores(docs.filter((d) => d.activo !== false)))
      .finally(() => setLoadingList(false));
  }, []);

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.includes(",") ? r.split(",")[1] : r);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleCerUpload(file: File) {
    setCerFile(file); setCertInfo(null); setMsg(null);
    setVerifying(true);
    try {
      const certificate = await fileToBase64(file);
      const resp = await fetch("/api/facturama/emisores/verificar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificate }),
      });
      const data = await resp.json();
      if (!resp.ok) { setMsg({ type: "err", text: data.error ?? "Error al leer el certificado" }); return; }
      setCertInfo(data);
      if (data.rfc)    setFRfc(data.rfc);
      if (data.nombre) setFNombre(data.nombre);
    } catch {
      setMsg({ type: "err", text: "No se pudo leer el archivo .cer" });
    } finally { setVerifying(false); }
  }

  async function handleRegistrar() {
    if (!fRfc || !fNombre || !fCp || !cerFile || !keyFile || !fPwd) return;
    setSaving(true); setMsg(null);
    try {
      const certificate = await fileToBase64(cerFile);
      const privateKey  = await fileToBase64(keyFile);
      const rfcUp       = fRfc.toUpperCase();

      let resp = await fetch("/api/facturama/emisores", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc: rfcUp, certificate, privateKey, privateKeyPassword: fPwd }),
      });

      if (!resp.ok) {
        const d = await resp.json();
        if (d.code === "ALREADY_EXISTS") {
          resp = await fetch("/api/facturama/emisores", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rfc: rfcUp, certificate, privateKey, privateKeyPassword: fPwd, actualizar: true }),
          });
          if (!resp.ok) { setMsg({ type: "err", text: (await resp.json()).error ?? "Error al actualizar" }); return; }
        } else {
          setMsg({ type: "err", text: d.error ?? "Error al registrar" }); return;
        }
      }

      await upsertDocument("emisoresFm", rfcUp, { rfc: rfcUp, nombre: fNombre, regimen: fRegimen, cp: fCp, activo: true });
      setEmisores((prev) => [...prev.filter((e) => e.rfc !== rfcUp), { rfc: rfcUp, nombre: fNombre, regimen: fRegimen, cp: fCp, activo: true }]);
      setMsg({ type: "ok", text: `CSD de ${rfcUp} registrado exitosamente` });
      setShowForm(false); setFRfc(""); setFNombre(""); setFRegimen("601"); setFCp(""); setFPwd(""); setCerFile(null); setKeyFile(null);
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Error inesperado" });
    } finally { setSaving(false); }
  }

  async function handleEliminar(rfc: string) {
    setDeletingRfc(rfc);
    try {
      await fetch(`/api/facturama/emisores/${rfc}`, { method: "DELETE" });
      await upsertDocument("emisoresFm", rfc, { activo: false });
      setEmisores((prev) => prev.filter((e) => e.rfc !== rfc));
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setDeletingRfc(null); }
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Building2 size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Emisores registrados</p>
              <p className="text-xs text-gray-500">CSDs registrados para timbrar CFDIs</p>
            </div>
          </div>
          <button onClick={() => { setShowForm(true); setMsg(null); setCertInfo(null); setFRfc(""); setFNombre(""); setFRegimen("601"); setFCp(""); setFPwd(""); setCerFile(null); setKeyFile(null); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors cursor-pointer">
            <Plus size={14} /> Registrar emisor
          </button>
        </div>

        {loadingList ? (
          <div className="px-5 py-8 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : emisores.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-600 text-sm">
            No hay emisores registrados aún.
          </div>
        ) : (
          <div className="divide-y divide-[#3A3A3A]">
            {emisores.map((em) => (
              <div key={em.rfc} className="flex items-center justify-between px-5 py-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#3A3A3A] flex items-center justify-center text-gray-400">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white font-mono">{em.rfc}</p>
                    <p className="text-xs text-gray-500">{em.nombre} · Régimen {em.regimen}{em.cp ? ` · CP ${em.cp}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Activo</span>
                  <button onClick={() => handleEliminar(em.rfc)} disabled={deletingRfc === em.rfc}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3A3A3A] text-gray-500 hover:text-red-400 hover:border-red-400/40 rounded-lg transition-colors disabled:opacity-40 cursor-pointer">
                    {deletingRfc === em.rfc ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && !showForm && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
          {msg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {msg.text}
        </div>
      )}

      {showForm && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#3A3A3A]">
            <p className="text-sm font-semibold text-white">Registrar CSD</p>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-[#3A3A3A] transition-colors cursor-pointer"><X size={16} /></button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={satLblDark}>RFC del emisor *</label>
                <input value={fRfc} onChange={(e) => setFRfc(e.target.value.toUpperCase())} className={satInpDark + " font-mono uppercase"} placeholder="XAXX010101000" maxLength={13} autoComplete="off" />
              </div>
              <div>
                <label className={satLblDark}>Razón social *</label>
                <input value={fNombre} onChange={(e) => setFNombre(e.target.value)} className={satInpDark} placeholder="Empresa S.A. de C.V." autoComplete="off" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={satLblDark}>Régimen fiscal *</label>
                <AppSelect dark value={fRegimen} onChange={(e) => setFRegimen(e.target.value)}>
                  {REGIMEN_FISCAL.map((r) => <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>)}
                </AppSelect>
              </div>
              <div>
                <label className={satLblDark}>Código postal fiscal *</label>
                <input value={fCp} onChange={(e) => setFCp(e.target.value.replace(/\D/g, "").slice(0, 5))} className={satInpDark + " font-mono"} placeholder="64000" maxLength={5} autoComplete="off" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* .cer con verificación automática */}
              <div>
                <label className={satLblDark}>Archivo .cer *</label>
                <button onClick={() => cerRef.current?.click()}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                    certInfo && !certInfo.expired ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                    : certInfo?.expired ? "border-red-500/40 text-red-400 bg-red-500/5"
                    : cerFile ? "border-amber-500/40 text-amber-400 bg-amber-500/5"
                    : "border-[#3A3A3A] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}>
                  {verifying ? <Loader2 size={13} className="animate-spin" /> : certInfo && !certInfo.expired ? <CheckCircle2 size={13} /> : <Upload size={13} />}
                  <span className="truncate">{cerFile ? cerFile.name : "Seleccionar .cer"}</span>
                </button>
                <input ref={cerRef} type="file" accept=".cer" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCerUpload(f); }} />
              </div>
              {/* .key */}
              <div>
                <label className={satLblDark}>Archivo .key *</label>
                <button onClick={() => keyRef.current?.click()}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${keyFile ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-[#3A3A3A] text-gray-400 hover:border-gray-500 hover:text-gray-300"}`}>
                  {keyFile ? <CheckCircle2 size={13} /> : <Upload size={13} />}
                  <span className="truncate">{keyFile ? keyFile.name : "Seleccionar .key"}</span>
                </button>
                <input ref={keyRef} type="file" accept=".key" className="hidden"
                  onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            {/* Panel de verificación del .cer */}
            {certInfo && (
              <div className={`rounded-xl border px-4 py-3 space-y-1 text-xs ${certInfo.expired ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                <div className="flex items-center gap-2">
                  {certInfo.expired
                    ? <><AlertCircle size={13} className="text-red-400" /><span className="font-semibold text-red-400">Certificado vencido</span></>
                    : <><CheckCircle2 size={13} className="text-emerald-400" /><span className="font-semibold text-emerald-400">Certificado válido</span></>
                  }
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-400 mt-1">
                  <span>RFC detectado</span><span className="font-mono text-white">{certInfo.rfc || "—"}</span>
                  <span>Nombre</span><span className="text-white truncate">{certInfo.nombre || "—"}</span>
                  <span>Vigente desde</span><span className="text-white">{certInfo.validFrom ? new Date(certInfo.validFrom).toLocaleDateString("es-MX") : "—"}</span>
                  <span>Vigente hasta</span><span className={certInfo.expired ? "text-red-400 font-semibold" : "text-white"}>{certInfo.validTo ? new Date(certInfo.validTo).toLocaleDateString("es-MX") : "—"}</span>
                  <span>No. Certificado</span><span className="font-mono text-gray-500 text-[10px]">{certInfo.numeroCertificado}</span>
                </div>
              </div>
            )}

            <div>
              <label className={satLblDark}>Contraseña del CSD *</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={fPwd} onChange={(e) => setFPwd(e.target.value)}
                  placeholder="Contraseña del archivo .key" className={satInpDark + " pr-10"} autoComplete="new-password" />
                <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {msg && (
              <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {msg.type === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {msg.text}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setCertInfo(null); }} className="px-4 py-2 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:text-white transition-colors cursor-pointer">Cancelar</button>
              <button onClick={handleRegistrar}
                disabled={saving || !fRfc || !fNombre || !fCp || !cerFile || !keyFile || !fPwd || !certInfo || certInfo.expired || verifying}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                {saving ? "Registrando…" : "Registrar CSD"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Descarga SAT ────────────────────────────────────────────────────────

const satInp ="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
const satLbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";

function fmtSatDate(ts?: { seconds: number } | string) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DescargaSATTab() {
  // ── Config e.firma ──────────────────────────────────────────────────────────
  const [satConfig,      setSatConfig]      = useState<{ rfc?: string; activo?: boolean; certB64?: string; keyB64?: string } | null>(null);
  const [loadingConfig,  setLoadingConfig]  = useState(true);
  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [cerFile,       setCerFile]       = useState<File | null>(null);
  const [keyFile,       setKeyFile]       = useState<File | null>(null);
  const [configPwd,     setConfigPwd]     = useState("");
  const [showConfigPwd, setShowConfigPwd] = useState(false);
  const [savingConfig,  setSavingConfig]  = useState(false);
  const [configMsg,     setConfigMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Contraseña de sesión ────────────────────────────────────────────────────
  const [sessionPwd,     setSessionPwd]     = useState("");
  const [showSessionPwd, setShowSessionPwd] = useState(false);

  // ── Nueva solicitud ─────────────────────────────────────────────────────────
  const [fechaInicio,   setFechaInicio]   = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [fechaFin,      setFechaFin]      = useState(() => new Date().toISOString().slice(0, 10));
  const [direccion,     setDireccion]     = useState<"emitidos" | "recibidos">("emitidos");
  const [tipoSolicitud, setTipoSolicitud] = useState<"cfdi" | "metadata">("cfdi");
  const [tipoDoc,       setTipoDoc]       = useState("");
  const [solicitando,   setSolicitando]   = useState(false);
  const [solicitudMsg,  setSolicitudMsg]  = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Verificación / descarga ─────────────────────────────────────────────────
  const [verificandoIds,  setVerificandoIds]  = useState<Set<string>>(new Set());
  const [verifyMsgs,      setVerifyMsgs]      = useState<Record<string, { ok: boolean; text: string }>>({});
  const [descargandoPkg, setDescargandoPkg] = useState<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionPwdRef = useRef(sessionPwd);
  const satConfigRef  = useRef(satConfig);
  const historialRef  = useRef<DescargaSAT[]>([]);

  useEffect(() => { sessionPwdRef.current = sessionPwd; }, [sessionPwd]);
  useEffect(() => { satConfigRef.current  = satConfig;  }, [satConfig]);

  // ── Historial ───────────────────────────────────────────────────────────────
  const historialRaw = useCollectionRaw<DescargaSAT>(COLLECTIONS.descargasSAT ?? "descargasSAT");
  const toSecs = (v?: { seconds: number } | string) =>
    !v ? 0 : typeof v === "string" ? new Date(v).getTime() / 1000 : v.seconds;
  const historial = [...(historialRaw ?? [])].sort((a, b) => toSecs(b.solicitadoEn) - toSecs(a.solicitadoEn));
  useEffect(() => { historialRef.current = historial; }, [historial]);

  useEffect(() => {
    getDocument<{ certB64: string; keyB64: string; rfc: string; activo: boolean }>(
      COLLECTIONS.configuracion, "sat_efirma"
    ).then((d) => {
      if (d?.certB64 && d?.keyB64) {
        setSatConfig({ rfc: d.rfc, activo: d.activo, certB64: d.certB64, keyB64: d.keyB64 });
      } else {
        setSatConfig(null);
      }
    }).catch(() => setSatConfig(null))
      .finally(() => setLoadingConfig(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Reanudar polling cuando hay contraseña + config + pendientes (incluyendo cuando historial carga por primera vez)
  const pollingStartedRef = useRef(false);
  useEffect(() => {
    if (!sessionPwd || !satConfig?.certB64 || !historialRaw) return;
    const pendientes = historial.filter(h => h.status === "pendiente");
    if (pendientes.length === 0) { pollingStartedRef.current = false; return; }
    if (pollingStartedRef.current) return;
    pollingStartedRef.current = true;
    pendientes.forEach(h => verificarConRefs(h.requestId));
    iniciarPollingGlobal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPwd, satConfig?.certB64, historialRaw]);

  async function handleGuardarConfig() {
    if (!cerFile || !keyFile || !configPwd) return;
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const form = new FormData();
      form.append("cer", cerFile);
      form.append("key", keyFile);
      form.append("password", configPwd);
      const resp = await fetch("/api/sat/configurar", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setConfigMsg({ type: "err", text: data.error });
      } else {
        // El route valida, el cliente guarda en Firestore (tiene sesión autenticada)
        await upsertDocument(COLLECTIONS.configuracion, "sat_efirma", {
          certB64: data.certB64, keyB64: data.keyB64, rfc: data.rfc, activo: true,
        });
        setConfigMsg({ type: "ok", text: `e.firma configurada · RFC ${data.rfc}` });
        setSatConfig({ rfc: data.rfc, activo: true, certB64: data.certB64, keyB64: data.keyB64 });
        setCerFile(null); setKeyFile(null); setConfigPwd("");
      }
    } catch {
      setConfigMsg({ type: "err", text: "Error de red al guardar la configuración." });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSolicitar() {
    if (!sessionPwd || !fechaInicio || !fechaFin || !satConfig?.certB64 || !satConfig?.keyB64) return;
    setSolicitando(true);
    setSolicitudMsg(null);
    try {
      const resp = await fetch("/api/sat/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionPwd,
          certB64: satConfig.certB64,
          keyB64: satConfig.keyB64,
          fechaInicio, fechaFin, direccion, tipo: tipoSolicitud, tipoDocumento: tipoDoc || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSolicitudMsg({ type: "err", text: data.error });
      } else {
        // Guardar historial en Firestore desde el cliente (tiene sesión autenticada)
        await upsertDocument(COLLECTIONS.descargasSAT, data.requestId, {
          requestId: data.requestId, rfc: satConfig.rfc,
          status: "pendiente", direccion, tipo: tipoSolicitud,
          tipoDocumento: tipoDoc || null, fechaInicio, fechaFin,
          packageIds: [], solicitadoEn: new Date().toISOString(),
        });
        setSolicitudMsg({ type: "ok", text: `Solicitud enviada · ID ${data.requestId}. El SAT puede tardar 2–10 min.` });
        iniciarPolling(data.requestId);
      }
    } catch {
      setSolicitudMsg({ type: "err", text: "Error de red al solicitar." });
    } finally {
      setSolicitando(false);
    }
  }

  async function verificarConRefs(requestId: string) {
    const pwd = sessionPwdRef.current;
    const cfg = satConfigRef.current;
    if (!pwd || !cfg?.certB64 || !cfg?.keyB64) return;
    setVerificandoIds(prev => new Set(prev).add(requestId));
    try {
      const resp = await fetch("/api/sat/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, password: pwd, certB64: cfg.certB64, keyB64: cfg.keyB64 }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setVerifyMsgs(m => ({ ...m, [requestId]: { ok: false, text: data.error ?? "Error al verificar." } }));
        return;
      }
      if (data.status) {
        await upsertDocument(COLLECTIONS.descargasSAT, requestId, {
          status: data.status, packageIds: data.packageIds ?? [],
        });
        const statusLabels: Record<string, string> = {
          listo: "Listo — descarga disponible",
          error: `Error SAT: ${data.mensaje ?? "solicitud rechazada"}`,
          procesando: `En proceso — ${data.mensaje ?? "el SAT está preparando el paquete"}`,
        };
        setVerifyMsgs(m => ({ ...m, [requestId]: { ok: data.status !== "error", text: statusLabels[data.status] ?? data.mensaje ?? data.status } }));
      }
    } catch (e) {
      setVerifyMsgs(m => ({ ...m, [requestId]: { ok: false, text: (e as Error).message ?? "Error de red." } }));
    } finally {
      setVerificandoIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  }

  function iniciarPollingGlobal() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      const pendientes = historialRef.current.filter(h => h.status === "pendiente");
      if (pendientes.length === 0) {
        clearInterval(pollRef.current!); pollRef.current = null; return;
      }
      pendientes.forEach(h => verificarConRefs(h.requestId));
    }, 30_000);
  }

  function iniciarPolling(_requestId: string) {
    iniciarPollingGlobal();
  }

  async function verificar(requestId: string) {
    await verificarConRefs(requestId);
  }

  async function descargarPaquete(packageId: string) {
    if (!sessionPwd || !satConfig?.certB64 || !satConfig?.keyB64) return;
    setDescargandoPkg(packageId);
    try {
      const resp = await fetch("/api/sat/descargar-paquete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, password: sessionPwd, certB64: satConfig.certB64, keyB64: satConfig.keyB64 }),
      });
      if (!resp.ok) { const e = await resp.json(); alert(e.error); return; }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `cfdi-${packageId}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargandoPkg(null);
    }
  }

  const statusBadge = (s: DescargaSAT["status"]) => {
    const cls: Record<DescargaSAT["status"], string> = {
      pendiente:  "bg-amber-500/10 text-amber-400",
      procesando: "bg-blue-500/10 text-blue-400",
      listo:      "bg-emerald-500/10 text-emerald-400",
      error:      "bg-red-500/10 text-red-400",
    };
    const labels: Record<DescargaSAT["status"], string> = {
      pendiente: "Pendiente", procesando: "Procesando…", listo: "Listo", error: "Error",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cls[s]}`}>
        {labels[s]}
      </span>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── e.firma ────────────────────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FileKey2 size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">e.firma del SAT</p>
            <p className="text-xs text-gray-500">Sube .cer y .key una sola vez</p>
          </div>
          {!loadingConfig && satConfig?.activo && (
            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <ShieldCheck size={13} /> Configurada · {satConfig.rfc}
              </span>
              <button
                onClick={async () => {
                  await upsertDocument(COLLECTIONS.configuracion, "sat_efirma", { certB64: "", keyB64: "", rfc: "", activo: false });
                  setSatConfig(null);
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={11} /> Quitar
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Archivo .cer", ref: cerRef, file: cerFile, set: setCerFile, accept: ".cer" },
              { label: "Archivo .key", ref: keyRef, file: keyFile, set: setKeyFile, accept: ".key" },
            ] as const).map((f) => (
              <div key={f.label}>
                <label className={satLbl}>{f.label}</label>
                <button
                  onClick={() => f.ref.current?.click()}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                    f.file ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-[#3A3A3A] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f.file ? <CheckCircle2 size={13} /> : <Upload size={13} />}
                  <span className="truncate">{f.file ? f.file.name : `Seleccionar ${f.accept}`}</span>
                </button>
                <input ref={f.ref} type="file" accept={f.accept} className="hidden"
                  onChange={(e) => f.set(e.target.files?.[0] ?? null)} />
              </div>
            ))}
          </div>

          <div>
            <label className={satLbl}>Contraseña de la llave privada</label>
            <div className="relative">
              <input
                type={showConfigPwd ? "text" : "password"}
                value={configPwd}
                onChange={(e) => setConfigPwd(e.target.value)}
                placeholder="Contraseña del archivo .key"
                className={satInp + " pr-10"}
              />
              <button onClick={() => setShowConfigPwd(!showConfigPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showConfigPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-600 mt-1">La contraseña no se guarda. Se usa solo para validar la e.firma.</p>
          </div>

          {configMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${configMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {configMsg.type === "ok" ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <X size={13} className="shrink-0 mt-0.5" />}
              {configMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGuardarConfig}
              disabled={savingConfig || !cerFile || !keyFile || !configPwd}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {savingConfig ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              {savingConfig ? "Validando…" : "Guardar e.firma"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Nueva solicitud ─────────────────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <CloudDownload size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nueva descarga del SAT</p>
            <p className="text-xs text-gray-500">El SAT puede tardar 2–10 minutos en preparar los paquetes</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={satLbl}>Contraseña de la e.firma <span className="text-[#CC2229]">*</span></label>
            <div className="relative">
              <input
                type={showSessionPwd ? "text" : "password"}
                value={sessionPwd}
                onChange={(e) => setSessionPwd(e.target.value)}
                placeholder="Necesaria para firmar cada solicitud al SAT"
                className={satInp + " pr-10"}
              />
              <button onClick={() => setShowSessionPwd(!showSessionPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showSessionPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={satLbl}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={satInp} />
            </div>
            <div>
              <label className={satLbl}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={satInp} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={satLbl}>Dirección</label>
              <AppSelect dark value={direccion} onChange={(e) => setDireccion(e.target.value as "emitidos" | "recibidos")}>
                <option value="emitidos">Emitidos</option>
                <option value="recibidos">Recibidos</option>
              </AppSelect>
            </div>
            <div>
              <label className={satLbl}>Tipo de solicitud</label>
              <AppSelect dark value={tipoSolicitud} onChange={(e) => setTipoSolicitud(e.target.value as "cfdi" | "metadata")}>
                <option value="cfdi">CFDI (XML)</option>
                <option value="metadata">Metadata</option>
              </AppSelect>
            </div>
            <div>
              <label className={satLbl}>Tipo de comprobante</label>
              <AppSelect dark value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                <option value="">Todos</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="traslado">Traslado</option>
                <option value="nomina">Nómina</option>
                <option value="pago">Pago</option>
              </AppSelect>
            </div>
          </div>

          {solicitudMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${solicitudMsg.type === "ok" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
              {solicitudMsg.type === "ok" ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <X size={13} className="shrink-0 mt-0.5" />}
              {solicitudMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSolicitar}
              disabled={solicitando || !sessionPwd || !fechaInicio || !fechaFin || !satConfig?.certB64}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {solicitando ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />}
              {solicitando ? "Enviando al SAT…" : "Solicitar descarga"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Historial ────────────────────────────────────────────────────────── */}
      {historial.length > 0 && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3A3A3A] text-gray-400">
              <FileText size={17} />
            </div>
            <p className="text-sm font-semibold text-white">Historial de descargas</p>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {historial.map((d) => (
              <div key={d.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(d.status)}
                    <span className="text-xs text-gray-400 font-mono">{d.requestId?.slice(0, 16)}…</span>
                    <span className="text-xs text-gray-500">{d.direccion} · {d.tipo}</span>
                    <span className="text-xs text-gray-600">{d.fechaInicio} → {d.fechaFin}</span>
                  </div>
                  {(d.status === "pendiente" || d.status === "procesando") && (
                    <button
                      onClick={() => verificar(d.requestId)}
                      disabled={!sessionPwd || verificandoIds.has(d.requestId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3A3A3A] text-gray-400 rounded-lg hover:border-blue-500/40 hover:text-blue-400 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <RefreshCw size={11} className={verificandoIds.has(d.requestId) ? "animate-spin" : ""} />
                      Verificar
                    </button>
                  )}
                </div>

                {d.status === "listo" && d.packageIds?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {d.packageIds.map((pkgId) => (
                      <button
                        key={pkgId}
                        onClick={() => descargarPaquete(pkgId)}
                        disabled={descargandoPkg === pkgId || !sessionPwd}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {descargandoPkg === pkgId ? <Loader2 size={11} className="animate-spin" /> : <ChevronDown size={11} />}
                        Paquete {pkgId.slice(-6)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-gray-600">{fmtSatDate(d.solicitadoEn)}</p>
                  {verifyMsgs[d.requestId] && (
                    <p className={`text-[10px] font-medium ${verifyMsgs[d.requestId].ok ? "text-emerald-400" : "text-red-400"}`}>
                      {verifyMsgs[d.requestId].text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Descarga CFDIs vía Facturama ────────────────────────────────────────

interface FmListItem {
  Id: string; Serie: string; Folio: string; Date: string;
  CfdiType: string; Status: string; Total: number; Currency: string;
  Issuer: { Rfc: string; Name: string };
  Receiver: { Rfc: string; Name: string };
  Complement?: { TaxStamp?: { Uuid: string } };
}

function DescargaFacturamaTab() {
  const [emisores,     setEmisores]     = useState<EmisorFm[]>([]);
  const [rfcSel,       setRfcSel]       = useState("");
  const [fmList,       setFmList]       = useState<FmListItem[] | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    getCollectionDocs<EmisorFm>("emisoresFm")
      .then((d) => setEmisores(d.filter((e) => e.activo !== false)));
  }, []);

  async function buscar() {
    if (!rfcSel) return;
    setLoading(true); setError(""); setFmList(null);
    try {
      const resp = await fetch(`/api/facturama/listar?rfc=${encodeURIComponent(rfcSel)}&type=issued`);
      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Error al consultar CFDIs"); return; }
      setFmList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  const fmStatusTone: Record<string, string> = {
    active:    "aprobado",
    cancelled: "cancelado",
  };

  return (
    <div className="space-y-5">
      {/* Selector emisor */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <CloudDownload size={15} className="text-[#CC2229]" /> Consultar CFDIs por emisor
        </h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Emisor (RFC)</label>
            <select
              value={rfcSel}
              onChange={(e) => { setRfcSel(e.target.value); setFmList(null); setError(""); }}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#CC2229]/60 cursor-pointer"
            >
              <option value="">Selecciona un emisor…</option>
              {emisores.map((e) => (
                <option key={e.rfc} value={e.rfc}>{e.rfc} — {e.nombre}</option>
              ))}
            </select>
          </div>
          <button
            onClick={buscar}
            disabled={!rfcSel || loading}
            className="flex items-center gap-2 rounded-xl bg-[#CC2229] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a81b21] disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Consultar
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <p className="mt-3 text-xs text-gray-600">
          Muestra CFDIs vigentes registrados en el PAC para el RFC seleccionado. Los cancelados pueden no aparecer.
        </p>
      </div>

      {/* Resultados */}
      {fmList !== null && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A3A3A]">
            <span className="text-sm font-semibold text-white">{fmList.length} CFDI{fmList.length !== 1 ? "s" : ""} encontrados</span>
            <span className="text-xs text-gray-500">RFC: {rfcSel}</span>
          </div>
          {fmList.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-600 text-sm">
              Sin CFDIs activos para este RFC. Los cancelados no aparecen en este listado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                    {["Folio", "UUID", "Tipo", "Receptor", "RFC Receptor", "Total", "Fecha", "Estatus", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fmList.map((f) => {
                    const uuid = f.Complement?.TaxStamp?.Uuid ?? "";
                    return (
                      <tr key={f.Id} className="border-b border-[#2A2A2A] hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.Serie}{f.Folio}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500" title={uuid}>{uuid ? uuid.slice(0, 8) + "…" : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-white/5 border border-[#3A3A3A] px-2.5 py-0.5 text-xs text-gray-300">
                            {TIPO_LABEL[f.CfdiType as TipoCFDI] ?? f.CfdiType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white max-w-[160px] truncate" title={f.Receiver.Name}>{f.Receiver.Name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.Receiver.Rfc}</td>
                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(f.Total)}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(f.Date)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={fmStatusTone[f.Status?.toLowerCase()] ?? "pendiente"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <a
                              href={`/api/facturama/download?id=${f.Id}&format=pdf`}
                              target="_blank" rel="noopener noreferrer" title="Descargar PDF"
                              className="rounded p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              <FileText size={14} />
                            </a>
                            <a
                              href={`/api/facturama/download?id=${f.Id}&format=xml`}
                              target="_blank" rel="noopener noreferrer" title="Descargar XML"
                              className="rounded p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Control de folios (solo desarrollador) ───────────────────────────────

const DEV_FOLIOS_KEY = "dev_folios";

function FoliosDevTab({ cfdiList }: { cfdiList: CfdiEmitido[] }) {
  const sorted = [...cfdiList].sort(
    (a, b) => new Date(b.fechaTimbrado).getTime() - new Date(a.fechaTimbrado).getTime()
  );
  const erpUsados = sorted.length;
  const totalErogado = sorted.filter((f) => f.status === "valid").reduce((s, f) => s + f.total, 0);

  // Folios disponibles — configurado manualmente desde el portal del PAC
  const [foliosDisp, setFoliosDisp]       = useState<number | null>(null);
  const [editando, setEditando]           = useState(false);
  const [inputDisp, setInputDisp]         = useState("");
  const [guardandoDisp, setGuardandoDisp] = useState(false);

  useEffect(() => {
    getDocument<{ facturas?: number }>(COLLECTIONS.configuracion, DEV_FOLIOS_KEY)
      .then((d) => { if (d?.facturas != null) setFoliosDisp(d.facturas); })
      .catch(() => {});
  }, []);

  async function guardarFoliosDisp() {
    const n = parseInt(inputDisp, 10);
    if (isNaN(n) || n < 0) return;
    setGuardandoDisp(true);
    await upsertDocument(COLLECTIONS.configuracion, DEV_FOLIOS_KEY, { facturas: n });
    setFoliosDisp(n);
    setEditando(false);
    setGuardandoDisp(false);
  }

  // Limpieza de solicitudes SAT fallidas (BoxFactura)
  const satHistorial = useCollectionRaw<{ id?: string; requestId: string; status: string; direccion: string; tipo: string; fechaInicio: string; fechaFin: string; solicitadoEn?: unknown }>(COLLECTIONS.descargasSAT ?? "descargasSAT");
  const satErrores   = (satHistorial ?? []).filter((s) => s.status === "error");
  const [borrando, setBorrando] = useState(false);
  const [borradoMsg, setBorradoMsg] = useState("");

  async function borrarErrores() {
    if (satErrores.length === 0) return;
    setBorrando(true);
    setBorradoMsg("");
    try {
      await Promise.all(satErrores.map((s) => deleteDocument(COLLECTIONS.descargasSAT ?? "descargasSAT", s.requestId)));
      setBorradoMsg(`${satErrores.length} registro${satErrores.length > 1 ? "s" : ""} eliminado${satErrores.length > 1 ? "s" : ""}.`);
    } catch {
      setBorradoMsg("Error al eliminar.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Banner dev */}
      <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
        <Activity size={14} className="text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300">
          Panel exclusivo para <strong>leonardo@lpsoft.mx</strong>. Control de consumo de folios del PAC.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Folios disponibles en PAC — manual */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Disponibles en PAC</p>
            <button onClick={() => { setEditando(true); setInputDisp(String(foliosDisp ?? "")); }} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">editar</button>
          </div>
          {editando ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number" min="0" value={inputDisp}
                onChange={(e) => setInputDisp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardarFoliosDisp()}
                className="w-20 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-[#CC2229]"
                autoFocus
              />
              <button onClick={guardarFoliosDisp} disabled={guardandoDisp} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer">
                {guardandoDisp ? "…" : "OK"}
              </button>
              <button onClick={() => setEditando(false)} className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer">✕</button>
            </div>
          ) : (
            <>
              <p className={`text-2xl font-bold ${foliosDisp != null && foliosDisp <= 10 ? "text-red-400" : foliosDisp != null && foliosDisp <= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {foliosDisp != null ? foliosDisp : "—"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Actualiza desde el portal del PAC</p>
            </>
          )}
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Emitidos en ERP</p>
          <p className="text-2xl font-bold text-[#CC2229]">{erpUsados}</p>
          <p className="text-xs text-gray-600 mt-0.5">Desde este sistema</p>
        </div>
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Total facturado</p>
          <p className="text-xl font-bold text-white">{fmt(totalErogado)}</p>
          <p className="text-xs text-gray-600 mt-0.5">CFDIs vigentes</p>
        </div>
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Cancelados</p>
          <p className="text-2xl font-bold text-gray-400">{sorted.filter((f) => f.status === "cancelled").length}</p>
          <p className="text-xs text-gray-600 mt-0.5">En este ERP</p>
        </div>
      </div>

      {/* Tabla de consumo */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3A3A3A]">
          <BarChart3 size={14} className="text-[#CC2229]" />
          <span className="text-sm font-semibold text-white">Historial de consumo de folios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                {["#", "Folio", "UUID", "Emisor RFC", "Receptor", "Total", "Fecha", "Timbrado por", "Estatus"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-600">Sin CFDIs registrados aún.</td>
                </tr>
              )}
              {sorted.map((f, i) => (
                <tr key={f.uuid} className="border-b border-[#2A2A2A] hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-600">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.serie}{f.folio}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" title={f.uuid}>{f.uuid ? f.uuid.slice(0, 8) + "…" : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.emisorRfc ?? "—"}</td>
                  <td className="px-4 py-3 text-white max-w-[160px] truncate" title={f.clienteNombre}>
                    <div>{f.clienteNombre}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{f.clienteRfc}</div>
                  </td>
                  <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(f.total)}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(f.fechaTimbrado)}</td>
                  <td className="px-4 py-3">
                    {f.creadoPor ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={11} className="text-gray-600" />{f.creadoPor}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={STATUS_TONE[f.status] ?? "pendiente"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 && (
          <div className="border-t border-[#3A3A3A] px-4 py-2.5 text-xs text-gray-600">
            {sorted.length} folio{sorted.length !== 1 ? "s" : ""} consumido{sorted.length !== 1 ? "s" : ""} · Los CFDIs anteriores a este ERP no se reflejan aquí.
          </div>
        )}
      </div>

      {/* Limpieza de solicitudes SAT fallidas */}
      {satHistorial !== undefined && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3A3A3A]">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Trash2 size={14} className="text-red-400" /> Solicitudes SAT (BoxFactura legacy)
            </span>
            {satErrores.length > 0 && (
              <button
                onClick={borrarErrores}
                disabled={borrando}
                className="flex items-center gap-1.5 rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/50 disabled:opacity-40 transition-colors"
              >
                {borrando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Borrar {satErrores.length} error{satErrores.length > 1 ? "es" : ""}
              </button>
            )}
          </div>
          {(satHistorial ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-600">Sin registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                    {["Request ID", "Dirección", "Tipo", "Rango", "Fecha", "Estatus"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...(satHistorial ?? [])].sort((a, b) => {
                    const ts = (v: unknown) => {
                      if (!v) return 0;
                      if (typeof v === "string") return new Date(v).getTime();
                      if (typeof v === "object" && "seconds" in (v as Record<string,unknown>)) return ((v as {seconds:number}).seconds) * 1000;
                      return 0;
                    };
                    return ts(b.solicitadoEn) - ts(a.solicitadoEn);
                  }).map((s) => (
                    <tr key={s.requestId} className="border-b border-[#2A2A2A] hover:bg-white/5">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500" title={s.requestId}>{s.requestId.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 capitalize">{s.direccion}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{s.tipo}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{s.fechaInicio} → {s.fechaFin}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">
                        {(() => {
                          const v = s.solicitadoEn;
                          if (!v) return "—";
                          if (typeof v === "string") return new Date(v).toLocaleString("es-MX");
                          if (typeof v === "object" && "seconds" in (v as Record<string,unknown>)) return new Date(((v as {seconds:number}).seconds)*1000).toLocaleString("es-MX");
                          return "—";
                        })()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.status === "error"     ? "bg-red-500/10 text-red-400" :
                          s.status === "listo"     ? "bg-emerald-500/10 text-emerald-400" :
                          s.status === "procesando"? "bg-blue-500/10 text-blue-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {borradoMsg && (
            <div className="px-4 py-2.5 text-xs text-emerald-400 border-t border-[#3A3A3A]">{borradoMsg}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = "historial" | "emisores" | "descarga" | "folios";

export default function FacturacionPage() {
  const [tab, setTab]               = useState<Tab>("historial");
  const [cfdiList, setCfdiList]     = useState<CfdiEmitido[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [userEmail, setUserEmail]   = useState("");

  useEffect(() => {
    getCollectionDocs<CfdiEmitido>(COLLECTIONS.cfdiEmitidos).then(setCfdiList);
    const s = getStoredSession();
    if (s?.email) setUserEmail(s.email);
  }, []);

  const isDev = userEmail === DEVELOPER_EMAIL;

  const merged = [...cfdiList].sort(
    (a, b) => new Date(b.fechaTimbrado).getTime() - new Date(a.fechaTimbrado).getTime()
  );

  const filtered = merged.filter((f) => {
    const q = search.toLowerCase();
    return !q || f.clienteNombre.toLowerCase().includes(q) || f.clienteRfc.toLowerCase().includes(q) || f.uuid.includes(q);
  });

  const totalFacturado  = merged.filter((f) => f.status === "valid").reduce((s, f) => s + f.total, 0);
  const vigentes        = merged.filter((f) => f.status === "valid").length;
  const cancelados      = merged.filter((f) => f.status === "cancelled").length;

  const TABS: { key: Tab; label: string; icon: React.ElementType; devOnly?: boolean }[] = [
    { key: "historial", label: "CFDIs Emitidos", icon: FileText },
    { key: "emisores",  label: "Emisores",        icon: Building2 },
    { key: "descarga",  label: "Descarga CFDI",   icon: CloudDownload },
    { key: "folios",    label: "Folios",           icon: BarChart3, devOnly: true },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Total facturado"   value={fmt(totalFacturado)}     icon={Receipt}      iconColor="text-[#CC2229]" />
        <KPICard title="CFDIs vigentes"    value={String(vigentes)}         icon={BadgeCheck}   iconColor="text-green-400" />
        <KPICard title="CFDIs cancelados"  value={String(cancelados)}       icon={AlertCircle}  iconColor="text-red-400" />
        <KPICard title="Total emitidos"    value={String(merged.length)}    icon={FileDown}     iconColor="text-blue-400" />
      </div>

      {/* Tabs + acción */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-[#242424] border border-[#3A3A3A] rounded-xl p-1">
          {TABS.filter((t) => !t.devOnly || isDev).map(({ key, label, icon: Icon, devOnly }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? devOnly ? "bg-amber-600 text-white shadow" : "bg-[#CC2229] text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {tab === "historial" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, RFC o UUID…"
                className="bg-[#242424] border border-[#3A3A3A] rounded-xl pl-8 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#CC2229] w-64 transition-colors"
              />
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#CC2229] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a81b21] transition-colors"
            >
              <Plus size={15} /> Emitir CFDI
            </button>
          </div>
        )}
      </div>

      {/* Contenido tabs */}
      {tab === "historial" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                  {["Folio", "UUID", "Tipo", "Receptor", "RFC", "Total", "Fecha", "Estatus", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-600">
                      No hay CFDIs. Emite tu primera factura.
                    </td>
                  </tr>
                )}
                {filtered.map((f) => (
                  <tr key={f.uuid} className="border-b border-[#2A2A2A] hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.serie ?? ""}{f.folio ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500" title={f.uuid}>{f.uuid ? f.uuid.slice(0, 8) + "…" : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 border border-[#3A3A3A] px-2.5 py-0.5 text-xs text-gray-300">
                        {TIPO_LABEL[f.tipo as TipoCFDI] ?? f.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white max-w-[180px] truncate" title={f.clienteNombre}>{f.clienteNombre}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{f.clienteRfc}</td>
                    <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(f.total)}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(f.fechaTimbrado)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={STATUS_TONE[f.status] ?? "pendiente"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {f.facturamaId && (
                          <a
                            href={`/api/facturama/download?id=${f.facturamaId}&format=pdf`}
                            target="_blank" rel="noopener noreferrer" title="Descargar PDF"
                            className="rounded p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            <FileText size={14} />
                          </a>
                        )}
                        {f.facturamaId && (
                          <a
                            href={`/api/facturama/download?id=${f.facturamaId}&format=xml`}
                            target="_blank" rel="noopener noreferrer" title="Descargar XML"
                            className="rounded p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-[#3A3A3A] px-4 py-2.5 text-xs text-gray-600">
              {filtered.length} de {merged.length} CFDIs
            </div>
          )}
        </div>
      )}

      {tab === "emisores" && <EmisorasTab />}
      {tab === "descarga" && <DescargaFacturamaTab />}
      {tab === "folios"   && isDev && <FoliosDevTab cfdiList={cfdiList} />}

      {/* Drawer emitir */}
      <EmitirDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEmitido={(cfdi) => setCfdiList((prev) => [cfdi, ...prev])}
        userEmail={userEmail}
      />
    </div>
  );
}
