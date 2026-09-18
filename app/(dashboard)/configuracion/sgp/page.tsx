"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Eye, FileCode, Lock, Loader2, Send, Wifi, XCircle } from "lucide-react";
import AppSelect from "@/components/AppSelect";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TestResult {
  ok: boolean;
  status?: number;
  ms?: number;
  error?: string | null;
  parsed?: Record<string, unknown> | null;
  rawXml?: string | null;
  sentXml?: string | null;
}

// ─── XML de prueba por método ─────────────────────────────────────────────────

function xmlParaMetodo(metodo: string, hoy: string, plantaClave?: string, usuario?: string): string {
  const clave  = plantaClave ?? "";
  const emp    = usuario ?? "DUROCON";
  // First day of current month as default start date
  const fechaInicio = hoy.slice(0, 8) + "01";
  switch (metodo) {
    // ── Read methods: params match WSDL exactly (no pw_xml_data)
    case "SGPPeriodoActivo":
      return `<pw_empresa_clave>${emp}</pw_empresa_clave>\n<pw_planta_numero>${clave}</pw_planta_numero>`;
    case "SGPConsumosSinInterfazar":
      return `<pw_empresa_clave>${emp}</pw_empresa_clave>\n<pw_planta_numero>${clave}</pw_planta_numero>\n<pw_materias_primas><materias_primas/></pw_materias_primas>`;
    case "SGPPeriodoProduccionFrentesElementosResumen":
    case "SGPPeriodoProduccionFrentesElementosConsumos":
      return `<pw_empresa_clave>${emp}</pw_empresa_clave>\n<pw_planta_clave>${clave}</pw_planta_clave>\n<pw_fecha_inicio>${fechaInicio}</pw_fecha_inicio>\n<pw_fecha_fin>${hoy}</pw_fecha_fin>`;
    case "SGPPeriodoProduccionMovimientosMateriaPrima":
      return `<pw_empresa_clave>${emp}</pw_empresa_clave>\n<pw_planta_clave>${clave}</pw_planta_clave>\n<pw_fecha_inicio>${fechaInicio}</pw_fecha_inicio>\n<pw_fecha_fin>${hoy}</pw_fecha_fin>\n<pw_tipo_movimiento></pw_tipo_movimiento>`;
    case "LecaRecuperaDosificacion":
      return `<pw_empresa>${emp}</pw_empresa>\n<pw_planta>${clave}</pw_planta>\n<pw_usuario>${emp}</pw_usuario>`;
    case "SGPPeriodoProduccionMovimientosMateriaPrima":
      return `<pw_empresa_clave>${emp}</pw_empresa_clave>\n<pw_planta_clave>${clave}</pw_planta_clave>\n<pw_fecha_inicio>${fechaInicio}</pw_fecha_inicio>\n<pw_fecha_fin>${hoy}</pw_fecha_fin>\n<pw_tipo_movimiento></pw_tipo_movimiento>`;
    case "SGPSincronizaUnidadMedida":
      return `<unidad_medida>\n  <clave>M3</clave>\n  <descripcion>Metro Cúbico</descripcion>\n</unidad_medida>`;
    case "SGPSincronizaPuestos":
      return `<puesto>\n  <clave>OPERADOR</clave>\n  <descripcion>Operador de Revolvedora</descripcion>\n</puesto>`;
    case "SGPSincronizaPersonal":
      return `<personal>\n  <clave>TEST-001</clave>\n  <apellido_paterno>PRUEBA</apellido_paterno>\n  <apellido_materno>TEST</apellido_materno>\n  <nombres>CONEXION</nombres>\n  <puesto>OPERADOR</puesto>\n</personal>`;
    case "SGPSincronizaUnidadesRevolvedoras":
      return `<unidad>\n  <clave>CR-TEST</clave>\n  <descripcion>Revolvedora de Prueba</descripcion>\n  <placas>TEST-000</placas>\n  <numero_economico>CR-TEST</numero_economico>\n  <personal>TEST-001</personal>\n</unidad>`;
    case "SGPSincronizaMateriaPrima":
      return `<materia_prima>\n  <clave>FC200</clave>\n  <descripcion>Concreto FC 200</descripcion>\n  <unidad_dosif>M3</unidad_dosif>\n  <unidad_invent>M3</unidad_invent>\n  <familia>CE</familia>\n</materia_prima>`;
    case "SGPCrearPedido":
      return `<pedido>\n  <serie_erp>ERP</serie_erp>\n  <numero_erp>TEST-001</numero_erp>\n  <producto>FC200</producto>\n  <producto_descripcion>Concreto FC 200 - PRUEBA</producto_descripcion>\n  <cantidad_solicitada>1</cantidad_solicitada>\n  <metros_por_unidad>7</metros_por_unidad>\n  <fecha_suministro>${hoy}</fecha_suministro>\n  <hora_en_obra>08:00:00</hora_en_obra>\n  <nivel_a_colar></nivel_a_colar>\n  <bombeo_propio>N</bombeo_propio>\n  <bombeo_cliente>N</bombeo_cliente>\n  <intervalo_carga>30</intervalo_carga>\n  <cliente>\n    <numero_erp>CLI-TEST</numero_erp>\n    <fisica_moral>S</fisica_moral>\n    <razon_social>CLIENTE PRUEBA SA DE CV</razon_social>\n    <apellido_paterno></apellido_paterno>\n    <apellido_materno></apellido_materno>\n    <nombres></nombres>\n    <numero_interior></numero_interior>\n    <numero_exterior></numero_exterior>\n    <calle></calle>\n    <colonia></colonia>\n    <municipio></municipio>\n    <estado></estado>\n    <codigo_postal></codigo_postal>\n    <telefono>8100000000</telefono>\n  </cliente>\n  <obra>\n    <numero_erp>OBRA-TEST</numero_erp>\n    <descripcion>Obra de Prueba</descripcion>\n    <numero_interior></numero_interior>\n    <numero_exterior></numero_exterior>\n    <calle>Calle de Prueba</calle>\n    <colonia></colonia>\n    <municipio>Monterrey</municipio>\n    <estado>Nuevo León</estado>\n    <codigo_postal></codigo_postal>\n    <telefono></telefono>\n    <encargado></encargado>\n  </obra>\n  <frente>\n    <numero_erp></numero_erp>\n    <descripcion>Frente de Prueba</descripcion>\n    <telefono></telefono>\n    <encargado></encargado>\n  </frente>\n  <unidades_medida>\n    <unidad_medida><clave>M3</clave><descripcion>Metro Cúbico</descripcion></unidad_medida>\n  </unidades_medida>\n  <materias_primas>\n    <materia_prima>\n      <clave>FC200</clave>\n      <descripcion>Concreto FC 200</descripcion>\n      <unidad_dosif>M3</unidad_dosif>\n      <unidad_invent>M3</unidad_invent>\n      <familia>CE</familia>\n    </materia_prima>\n  </materias_primas>\n</pedido>`;
    case "SGPCerrarPedido":
    case "SGPCancelarPedido":
      return `<pedido>\n  <serie>ERP</serie>\n  <numero>TEST-001</numero>\n</pedido>`;
    case "SGPAjustarPedido":
      return `<pedido>\n  <serie>ERP</serie>\n  <numero>TEST-001</numero>\n  <cantidad>2</cantidad>\n</pedido>`;
    case "SGPReprogramarPedido":
      return `<pedido>\n  <serie>ERP</serie>\n  <numero>TEST-001</numero>\n  <fecha>${hoy}</fecha>\n  <hora>10:00</hora>\n</pedido>`;
    default:
      return "";
  }
}

const PASOS = [
  {
    titulo: "0 · Consultar dosificadora",
    desc: "Lee el estado actual del SGP sin enviar nada — período activo y remisiones pendientes.",
    metodos: ["SGPPeriodoActivo", "SGPConsumosSinInterfazar"],
    color: "text-violet-400",
    border: "border-violet-500/20",
  },
  {
    titulo: "1 · Conectividad",
    desc: "Confirma que el servicio responde con el usuario y clave correctos.",
    metodos: ["SGPSincronizaUnidadMedida"],
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    titulo: "2 · Catálogos",
    desc: "Envía puestos, personal, revolvedoras y materias primas al SGP.",
    metodos: ["SGPSincronizaPuestos", "SGPSincronizaPersonal", "SGPSincronizaUnidadesRevolvedoras", "SGPSincronizaMateriaPrima"],
    color: "text-amber-400",
    border: "border-amber-500/20",
  },
  {
    titulo: "3 · Pedido de prueba",
    desc: "Flujo completo: crear, ajustar y cancelar un pedido de prueba.",
    metodos: ["SGPCrearPedido", "SGPAjustarPedido", "SGPCerrarPedido", "SGPCancelarPedido", "SGPReprogramarPedido"],
    color: "text-emerald-400",
    border: "border-emerald-500/20",
  },
];

// ─── Helpers XML ─────────────────────────────────────────────────────────────

function extractInnerXml(soapXml: string): string {
  const m = soapXml.match(/<(?:\w+:)?Result[^>]*>([\s\S]*?)<\/(?:\w+:)?Result>/);
  const raw = m ? m[1] : soapXml;
  return raw
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function prettyXml(xml: string): string {
  if (!xml?.trim()) return "";
  const PAD = "  ";
  let indent = 0;
  const lines: string[] = [];
  xml.replace(/></g, ">\n<").split("\n").forEach((raw) => {
    const node = raw.trim();
    if (!node) return;
    if (node.startsWith("</")) { indent = Math.max(0, indent - 1); lines.push(PAD.repeat(indent) + node); }
    else if (node.endsWith("/>") || (node.includes("</") && !node.startsWith("<?"))) { lines.push(PAD.repeat(indent) + node); }
    else { lines.push(PAD.repeat(indent) + node); if (!node.startsWith("<?")) indent++; }
  });
  return lines.join("\n");
}

function parseXmlToRecords(xml: string): Array<Record<string, string>> {
  if (!xml?.trim()) return [];
  const outerTags = [...xml.matchAll(/<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g)].map(m => m[1]);
  const tagCounts: Record<string, number> = {};
  outerTags.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const listTag = sorted.find(([, c]) => c > 1)?.[0];

  const flatFields = (chunk: string): Record<string, string> => {
    const f: Record<string, string> = {};
    for (const m of chunk.matchAll(/<(\w+)[^>]*>([^<]*)<\/\1>/g)) {
      if (m[2].trim()) f[m[1]] = m[2].trim();
    }
    return f;
  };

  if (listTag) {
    const records: Array<Record<string, string>> = [];
    for (const m of xml.matchAll(new RegExp(`<${listTag}[^>]*>([\\s\\S]*?)<\\/${listTag}>`, "g"))) {
      records.push(flatFields(m[1]));
    }
    return records;
  }
  const single = flatFields(xml);
  return Object.keys(single).length > 0 ? [single] : [];
}

// ─── Componente resultado ─────────────────────────────────────────────────────

function Resultado({ result }: { result: TestResult }) {
  const [showSent, setShowSent] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const inner   = result.rawXml ? extractInnerXml(result.rawXml) : "";
  const pretty  = inner ? prettyXml(inner) : "";
  const records = inner ? parseXmlToRecords(inner) : [];
  const columns = records.length > 0
    ? Array.from(new Set(records.flatMap(r => Object.keys(r))))
    : [];

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${result.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>

      {/* Estado */}
      <div className="flex items-center gap-2">
        {result.ok ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-red-400" />}
        <span className={`text-xs font-semibold ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok ? "OK" : "Error"}
        </span>
        {records.length > 1 && (
          <span className="text-xs text-gray-500">{records.length} registros</span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          {result.status && <span>HTTP {result.status}</span>}
          {result.ms && <span>{result.ms} ms</span>}
        </div>
      </div>

      {result.error && (
        <pre className="text-xs text-red-300 whitespace-pre-wrap break-all font-mono bg-[#1A1A1A] rounded p-3 border border-red-500/20">
          {result.error}
        </pre>
      )}

      {/* Vista estructurada */}
      {result.ok && columns.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#3A3A3A]">
          {records.length === 1 ? (
            <table className="w-full text-xs">
              <tbody>
                {columns.map(col => (
                  <tr key={col} className="border-b border-[#3A3A3A] last:border-0">
                    <td className="py-1.5 px-3 text-gray-500 font-mono whitespace-nowrap w-2/5 bg-[#1A1A1A]/50">{col}</td>
                    <td className="py-1.5 px-3 text-gray-200 font-mono break-all">{records[0][col] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-[#3A3A3A] bg-[#1A1A1A]">
                    {columns.map(col => (
                      <th key={col} className="py-1.5 px-3 text-left text-gray-500 font-mono whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={i} className="border-b border-[#3A3A3A]/40 last:border-0 hover:bg-white/[0.02]">
                      {columns.map(col => (
                        <td key={col} className="py-1.5 px-3 text-gray-300 font-mono whitespace-nowrap">{rec[col] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result.ok && records.length === 0 && inner && (
        <p className="text-xs text-gray-500 italic">SGP respondió OK sin datos en el cuerpo.</p>
      )}

      {/* XML enviado */}
      {result.sentXml && (
        <div>
          <button onClick={() => setShowSent(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
            {showSent ? <ChevronUp size={11} /> : <ChevronDown size={11} />} XML enviado
          </button>
          {showSent && (
            <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-[#1A1A1A] border border-[#3A3A3A] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
              {result.sentXml}
            </pre>
          )}
        </div>
      )}

      {/* Respuesta XML — pretty printed */}
      {pretty && (
        <div>
          <button onClick={() => setShowRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
            {showRaw ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Respuesta XML
          </button>
          {showRaw && (
            <pre className="mt-1.5 max-h-72 overflow-auto rounded bg-[#1A1A1A] border border-[#3A3A3A] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
              {pretty}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SgpTestPage() {
  const hoy = new Date().toISOString().slice(0, 10);

  const [endpoint, setEndpoint] = useState("http://100.115.105.16:9000/SgpWebService/SgpWebService.asmx");
  const [usuario, setUsuario] = useState("");
  const [plantaClaveAllende, setPlantaClaveAllende] = useState("");
  const [plantaClavePesqueria, setPlantaClavePesqueria] = useState("");
  const [planta, setPlanta] = useState<"Allende" | "Pesquería">("Allende");
  const [locked, setLocked] = useState(false);
  const [escrituraHabilitada, setEscrituraHabilitada] = useState(false);

  const [loadingMetodo, setLoadingMetodo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, TestResult>>({});
  const [xmlEdits, setXmlEdits] = useState<Record<string, string>>({});

  type WsdlParam = { name: string; type: string };
  type WsdlMethod = { name: string; params: WsdlParam[] };
  const [wsdlMethods, setWsdlMethods] = useState<WsdlMethod[] | null>(null);
  const [wsdlRaw, setWsdlRaw] = useState<string | null>(null);
  const [loadingWsdl, setLoadingWsdl] = useState(false);
  const [showWsdl, setShowWsdl] = useState(false);
  const [showWsdlRaw, setShowWsdlRaw] = useState(false);

  async function fetchWsdl() {
    setLoadingWsdl(true);
    try {
      const res = await fetch("/api/sgp/wsdl");
      const data = await res.json() as { ok: boolean; methods?: WsdlMethod[]; rawWsdl?: string; error?: string };
      if (data.ok) {
        setWsdlMethods(data.methods ?? []);
        setWsdlRaw(data.rawWsdl ?? null);
        setShowWsdl(true);
      }
    } finally {
      setLoadingWsdl(false);
    }
  }

  // Carga credenciales desde .env.local al montar
  useEffect(() => {
    fetch("/api/sgp/config")
      .then((r) => r.json())
      .then((cfg: { endpoint: string; usuario: string; claveAllende: string; clavePesqueria: string; configured: boolean }) => {
        if (cfg.endpoint)       setEndpoint(cfg.endpoint);
        if (cfg.usuario)        setUsuario(cfg.usuario);
        if (cfg.claveAllende)   setPlantaClaveAllende(cfg.claveAllende);
        if (cfg.clavePesqueria) setPlantaClavePesqueria(cfg.clavePesqueria);
        if (cfg.configured)     setLocked(true);
        // Reset XML edits so templates regenerate with loaded credentials
        setXmlEdits({});
      })
      .catch(() => {});
  }, []);

  const plantaClave = planta === "Allende" ? plantaClaveAllende : plantaClavePesqueria;
  const credencialesOk = !!usuario.trim() && !!plantaClave.trim();

  const READ_METODOS = ["SGPPeriodoActivo", "SGPConsumosSinInterfazar", "SGPPeriodoProduccionFrentesElementosResumen", "SGPPeriodoProduccionFrentesElementosConsumos"];

  function handlePlantaChange(nueva: "Allende" | "Pesquería") {
    setPlanta(nueva);
    // Reset edited XML for read methods so templates regenerate with the new clave
    setXmlEdits(prev => {
      const next = { ...prev };
      READ_METODOS.forEach(m => delete next[m]);
      return next;
    });
  }

  function getXml(metodo: string) {
    return xmlEdits[metodo] ?? xmlParaMetodo(metodo, hoy, plantaClave, usuario);
  }

  async function probar(metodo: string) {
    if (!credencialesOk) return;
    setLoadingMetodo(metodo);
    try {
      const res = await fetch("/api/sgp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, usuario, plantaClave, planta, metodo, xmlData: getXml(metodo) }),
      });
      const data = await res.json() as TestResult;
      setResultados(prev => ({ ...prev, [metodo]: data }));
    } catch (err) {
      setResultados(prev => ({ ...prev, [metodo]: { ok: false, error: err instanceof Error ? err.message : "Error de red" } }));
    } finally {
      setLoadingMetodo(null);
    }
  }

  const inp = "w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229] focus:border-[#CC2229] font-mono transition-colors";
  const lbl = "block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide";

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
          <Wifi size={18} />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Prueba SGP — Sybil</h1>
          <p className="text-xs text-gray-600 font-mono">DOSIFICADORA · ALLENDE</p>
        </div>
        <button
          onClick={fetchWsdl}
          disabled={loadingWsdl}
          className="flex items-center gap-1.5 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer disabled:opacity-40"
        >
          {loadingWsdl ? <Loader2 size={11} className="animate-spin" /> : <FileCode size={11} />}
          Ver WSDL
        </button>
      </div>

      {/* Panel WSDL — firmas de métodos */}
      {showWsdl && (
        <div className="rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Firmas WSDL</p>
            <button onClick={() => setShowWsdl(false)} className="text-xs text-gray-600 hover:text-gray-300 cursor-pointer">Cerrar</button>
          </div>

          {wsdlMethods && wsdlMethods.length > 0 ? (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {wsdlMethods.map(m => (
                <div key={m.name} className="text-xs font-mono py-1.5 border-b border-[#2A2A2A] last:border-0">
                  <span className="text-violet-400">{m.name}</span>
                  <span className="text-gray-600">(</span>
                  <span className="text-gray-300">{m.params.map(p => `${p.type} ${p.name}`).join(", ") || "—"}</span>
                  <span className="text-gray-600">)</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No se encontraron métodos en el esquema — ver XML completo abajo.</p>
          )}

          {wsdlRaw && (
            <div>
              <button onClick={() => setShowWsdlRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 cursor-pointer">
                {showWsdlRaw ? <ChevronUp size={11}/> : <ChevronDown size={11}/>} XML completo
              </button>
              {showWsdlRaw && (
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-[#141414] border border-[#2A2A2A] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                  {wsdlRaw}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Banner modo seguro / escritura */}
      {!escrituraHabilitada ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
          <Eye size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">Modo solo lectura</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Las operaciones de escritura están bloqueadas. Usa <span className="text-emerald-400 font-medium">Paso 0 · Consultar</span> para revisar lo que hay en la dosificadora sin modificar nada.
            </p>
          </div>
          <button
            onClick={() => setEscrituraHabilitada(true)}
            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            Habilitar escritura
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Escritura habilitada</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Los pasos 1–3 envían datos reales a la dosificadora. El pedido de prueba se crea en el SGP real — cancélalo cuando termines.
            </p>
          </div>
          <button
            onClick={() => setEscrituraHabilitada(false)}
            className="shrink-0 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            Bloquear
          </button>
        </div>
      )}

      {/* Credenciales */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Credenciales</p>
          {locked && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Lock size={11} />
              <span>Cargadas desde .env.local</span>
            </div>
          )}
        </div>

        <div>
          <label className={lbl}>Endpoint</label>
          <input value={endpoint} onChange={e => !locked && setEndpoint(e.target.value)} readOnly={locked} className={`${inp} ${locked ? "opacity-60 cursor-default" : ""}`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Planta a probar</label>
            <AppSelect dark value={planta} onChange={e => handlePlantaChange(e.target.value as "Allende" | "Pesquería")}>
              <option value="Allende">Allende</option>
              <option value="Pesquería">Pesquería</option>
            </AppSelect>
          </div>
          <div>
            <label className={lbl}>Usuario (pw_usuario)</label>
            <input value={locked ? usuario.replace(/./g, "•") : usuario} onChange={e => !locked && setUsuario(e.target.value)} readOnly={locked} className={`${inp} ${locked ? "opacity-60 cursor-default font-mono" : ""}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Clave Allende</label>
            <input value={locked ? plantaClaveAllende.replace(/./g, "•") : plantaClaveAllende} onChange={e => !locked && setPlantaClaveAllende(e.target.value)} readOnly={locked} className={`${inp} ${locked ? "opacity-60 cursor-default font-mono" : ""}`} />
          </div>
          <div>
            <label className={lbl}>Clave Pesquería</label>
            <input value={locked ? (plantaClavePesqueria ? plantaClavePesqueria.replace(/./g, "•") : "—") : plantaClavePesqueria} onChange={e => !locked && setPlantaClavePesqueria(e.target.value)} readOnly={locked} className={`${inp} ${locked ? "opacity-60 cursor-default font-mono" : ""}`} />
          </div>
        </div>

        {!credencialesOk && !locked && (
          <p className="text-xs text-amber-500/80">Falta el usuario o la clave de planta para continuar.</p>
        )}
      </div>

      {/* Pasos */}
      {PASOS.map((paso, pasoIdx) => {
        const esEscritura = pasoIdx > 0;
        const bloqueado = esEscritura && !escrituraHabilitada;
        return (
        <div key={paso.titulo} className={`rounded-xl border ${paso.border} bg-[#242424] p-5 space-y-4 ${bloqueado ? "opacity-40 pointer-events-none select-none" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide ${paso.color}`}>{paso.titulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{paso.desc}</p>
            </div>
            {bloqueado && (
              <div className="flex items-center gap-1 text-[10px] text-gray-600 shrink-0">
                <Lock size={10} />
                <span>Solo lectura</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {paso.metodos.map(metodo => {
              const resultado = resultados[metodo];
              const cargando = loadingMetodo === metodo;
              const xml = getXml(metodo);

              return (
                <div key={metodo} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-300 flex-1">{metodo}</span>
                    {resultado && (
                      resultado.ok
                        ? <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                        : <XCircle size={13} className="text-red-400 shrink-0" />
                    )}
                    <button
                      onClick={() => probar(metodo)}
                      disabled={!credencialesOk || cargando || bloqueado}
                      className="flex items-center gap-1.5 rounded-lg bg-[#CC2229] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B01E24] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0"
                    >
                      {cargando ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      {cargando ? "…" : "Probar"}
                    </button>
                  </div>

                  {/* XML editable */}
                  <textarea
                    value={xml}
                    onChange={e => setXmlEdits(prev => ({ ...prev, [metodo]: e.target.value }))}
                    rows={xml.split("\n").length}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-xs text-gray-400 font-mono focus:outline-none focus:ring-1 focus:ring-[#CC2229] resize-none"
                  />

                  {resultado && <Resultado result={resultado} />}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
