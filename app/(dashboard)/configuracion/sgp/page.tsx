"use client";

import { useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, Loader2, Send, Wifi, XCircle } from "lucide-react";
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

function xmlParaMetodo(metodo: string, hoy: string): string {
  switch (metodo) {
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
    titulo: "1 · Conectividad",
    desc: "Verifica que el endpoint responde con tus credenciales.",
    metodos: ["SGPSincronizaUnidadMedida"],
    color: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    titulo: "2 · Catálogos",
    desc: "Sincroniza los catálogos base antes de crear pedidos.",
    metodos: ["SGPSincronizaPuestos", "SGPSincronizaPersonal", "SGPSincronizaUnidadesRevolvedoras", "SGPSincronizaMateriaPrima"],
    color: "text-amber-400",
    border: "border-amber-500/20",
  },
  {
    titulo: "3 · Pedido de prueba",
    desc: "Crea, ajusta y cancela un pedido de prueba.",
    metodos: ["SGPCrearPedido", "SGPAjustarPedido", "SGPCerrarPedido", "SGPCancelarPedido", "SGPReprogramarPedido"],
    color: "text-emerald-400",
    border: "border-emerald-500/20",
  },
];

// ─── Componente resultado ─────────────────────────────────────────────────────

function Resultado({ result }: { result: TestResult }) {
  const [showSent, setShowSent] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${result.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
      <div className="flex items-center gap-2">
        {result.ok ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-red-400" />}
        <span className={`text-xs font-semibold ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
          {result.ok ? "OK" : "Error"}
        </span>
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

      {result.sentXml && (
        <div>
          <button onClick={() => setShowSent(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
            {showSent ? <ChevronUp size={11} /> : <ChevronDown size={11} />} XML enviado
          </button>
          {showSent && (
            <pre className="mt-1.5 max-h-48 overflow-auto rounded bg-[#1A1A1A] border border-[#3A3A3A] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
              {result.sentXml}
            </pre>
          )}
        </div>
      )}

      {result.rawXml && (
        <div>
          <button onClick={() => setShowRaw(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
            {showRaw ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Respuesta XML
          </button>
          {showRaw && (
            <pre className="mt-1.5 max-h-48 overflow-auto rounded bg-[#1A1A1A] border border-[#3A3A3A] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
              {result.rawXml}
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

  const [endpoint, setEndpoint] = useState("http://sybil.com.mx:9000/SgpWebService/SgpWebService.asmx");
  const [usuario, setUsuario] = useState("");
  const [plantaClaveAllende, setPlantaClaveAllende] = useState("");
  const [plantaClavePesqueria, setPlantaClavePesqueria] = useState("");
  const [planta, setPlanta] = useState<"Allende" | "Pesquería">("Allende");

  const [loadingMetodo, setLoadingMetodo] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, TestResult>>({});
  const [xmlEdits, setXmlEdits] = useState<Record<string, string>>({});

  const plantaClave = planta === "Allende" ? plantaClaveAllende : plantaClavePesqueria;
  const credencialesOk = !!usuario.trim() && !!plantaClave.trim();

  function getXml(metodo: string) {
    return xmlEdits[metodo] ?? xmlParaMetodo(metodo, hoy);
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
        <div>
          <h1 className="text-sm font-semibold text-white">Prueba SGP — Sybil</h1>
          <p className="text-xs text-gray-600 font-mono">ENTORNO DE PRUEBAS</p>
        </div>
      </div>

      {/* Credenciales */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#242424] p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Credenciales</p>

        <div>
          <label className={lbl}>Endpoint</label>
          <input value={endpoint} onChange={e => setEndpoint(e.target.value)} className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Planta a probar</label>
            <AppSelect dark value={planta} onChange={e => setPlanta(e.target.value as "Allende" | "Pesquería")}>
              <option value="Allende">Allende</option>
              <option value="Pesquería">Pesquería</option>
            </AppSelect>
          </div>
          <div>
            <label className={lbl}>Usuario (pw_usuario)</label>
            <input value={usuario} onChange={e => setUsuario(e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Clave Allende</label>
            <input value={plantaClaveAllende} onChange={e => setPlantaClaveAllende(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Clave Pesquería</label>
            <input value={plantaClavePesqueria} onChange={e => setPlantaClavePesqueria(e.target.value)} className={inp} />
          </div>
        </div>

        {!credencialesOk && (
          <p className="text-xs text-amber-500/80">Llena usuario y clave de planta para habilitar las pruebas.</p>
        )}
      </div>

      {/* Pasos */}
      {PASOS.map(paso => (
        <div key={paso.titulo} className={`rounded-xl border ${paso.border} bg-[#242424] p-5 space-y-4`}>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide ${paso.color}`}>{paso.titulo}</p>
            <p className="text-xs text-gray-500 mt-0.5">{paso.desc}</p>
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
                      disabled={!credencialesOk || cargando}
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
      ))}
    </div>
  );
}
