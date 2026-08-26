"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, CloudDownload, Eye, EyeOff, FileKey2, FileText, Loader2, RefreshCw, ShieldCheck, Upload, X } from "lucide-react";
import { useCollectionRaw } from "@/lib/useCollection";
import { COLLECTIONS } from "@/lib/db";
import AppSelect from "@/components/AppSelect";

interface DescargaSAT {
  id: string;
  requestId: string;
  rfc: string;
  status: "pendiente" | "procesando" | "listo" | "error";
  direccion: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  packageIds: string[];
  solicitadoEn?: { seconds: number };
}

interface SatConfig {
  rfc?: string;
  activo?: boolean;
}

const inp = "w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-all";
const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SatDescargaPage() {
  // ── Config e.firma ──────────────────────────────────────────────────────────
  const [satConfig, setSatConfig] = useState<SatConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const cerRef  = useRef<HTMLInputElement>(null);
  const keyRef  = useRef<HTMLInputElement>(null);
  const [cerFile,  setCerFile]  = useState<File | null>(null);
  const [keyFile,  setKeyFile]  = useState<File | null>(null);
  const [configPwd, setConfigPwd] = useState("");
  const [showConfigPwd, setShowConfigPwd] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Contraseña de sesión (para solicitar / verificar / descargar) ───────────
  const [sessionPwd,     setSessionPwd]     = useState("");
  const [showSessionPwd, setShowSessionPwd] = useState(false);

  // ── Nueva solicitud ─────────────────────────────────────────────────────────
  const [fechaInicio,   setFechaInicio]   = useState("");
  const [fechaFin,      setFechaFin]      = useState("");
  const [direccion,     setDireccion]     = useState<"emitidos" | "recibidos">("emitidos");
  const [tipoSolicitud, setTipoSolicitud] = useState<"cfdi" | "metadata">("cfdi");
  const [tipoDoc,       setTipoDoc]       = useState("");
  const [solicitando,   setSolicitando]   = useState(false);
  const [solicitudMsg,  setSolicitudMsg]  = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Verificación activa ──────────────────────────────────────────────────────
  const [verificandoId, setVerificandoId] = useState<string | null>(null);
  const [descargandoPkg, setDescargandoPkg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Historial ───────────────────────────────────────────────────────────────
  const historial = useCollectionRaw<DescargaSAT>(COLLECTIONS.descargasSAT ?? "descargasSAT");

  // Cargar config existente
  useEffect(() => {
    fetch("/api/sat/config-status")
      .then((r) => r.json())
      .then((d) => setSatConfig(d.config ?? null))
      .catch(() => setSatConfig(null))
      .finally(() => setLoadingConfig(false));
  }, []);

  async function handleGuardarConfig() {
    if (!cerFile || !keyFile || !configPwd) return;
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const form = new FormData();
      form.append("cer",      cerFile);
      form.append("key",      keyFile);
      form.append("password", configPwd);
      const resp = await fetch("/api/sat/configurar", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setConfigMsg({ type: "err", text: data.error });
      } else {
        setConfigMsg({ type: "ok", text: `e.firma configurada. RFC: ${data.rfc}` });
        setSatConfig({ rfc: data.rfc, activo: true });
        setCerFile(null); setKeyFile(null); setConfigPwd("");
      }
    } catch {
      setConfigMsg({ type: "err", text: "Error de red al guardar la configuración." });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSolicitar() {
    if (!sessionPwd || !fechaInicio || !fechaFin) return;
    setSolicitando(true);
    setSolicitudMsg(null);
    try {
      const resp = await fetch("/api/sat/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: sessionPwd, fechaInicio, fechaFin, direccion, tipo: tipoSolicitud, tipoDocumento: tipoDoc || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSolicitudMsg({ type: "err", text: data.error });
      } else {
        setSolicitudMsg({ type: "ok", text: `Solicitud enviada al SAT. ID: ${data.requestId}. Espera ~2-5 min y verifica el estado.` });
        iniciarPolling(data.requestId);
      }
    } catch {
      setSolicitudMsg({ type: "err", text: "Error de red al solicitar." });
    } finally {
      setSolicitando(false);
    }
  }

  function iniciarPolling(requestId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    setVerificandoId(requestId);
    // Primer check a los 30s, luego cada 30s
    pollRef.current = setInterval(() => verificar(requestId), 30_000);
  }

  async function verificar(requestId: string) {
    if (!sessionPwd) return;
    try {
      const resp = await fetch("/api/sat/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, password: sessionPwd }),
      });
      const data = await resp.json();
      if (data.status === "listo" || data.status === "error") {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setVerificandoId(null);
      }
    } catch { /* silent */ }
  }

  async function descargarPaquete(packageId: string) {
    if (!sessionPwd) return;
    setDescargandoPkg(packageId);
    try {
      const resp = await fetch("/api/sat/descargar-paquete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, password: sessionPwd }),
      });
      if (!resp.ok) {
        const e = await resp.json();
        alert(e.error);
        return;
      }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `cfdi-${packageId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargandoPkg(null);
    }
  }

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const sortedHistorial = [...(historial ?? [])].sort((a, b) => {
    const ta = a.solicitadoEn?.seconds ?? 0;
    const tb = b.solicitadoEn?.seconds ?? 0;
    return tb - ta;
  });

  const statusBadge = (s: DescargaSAT["status"]) => {
    const map = {
      pendiente:   "bg-amber-500/10 text-amber-400",
      procesando:  "bg-blue-500/10 text-blue-400",
      listo:       "bg-emerald-500/10 text-emerald-400",
      error:       "bg-red-500/10 text-red-400",
    };
    const labels = { pendiente: "Pendiente", procesando: "Procesando…", listo: "Listo", error: "Error" };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${map[s]}`}>{labels[s]}</span>;
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Sección 1: Configuración e.firma ────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
            <FileKey2 size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">e.firma del SAT</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sube tus archivos .cer y .key una sola vez</p>
          </div>
          {!loadingConfig && satConfig?.activo && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck size={14} /> Configurada · RFC {satConfig.rfc}
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Upload buttons */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Archivo .cer", ref: cerRef, file: cerFile, set: setCerFile, accept: ".cer" },
              { label: "Archivo .key", ref: keyRef, file: keyFile, set: setKeyFile, accept: ".key" },
            ] as const).map((f) => (
              <div key={f.label}>
                <label className={lbl}>{f.label}</label>
                <button
                  onClick={() => f.ref.current?.click()}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                    f.file ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5" : "border-[#3A3A3A] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f.file ? <CheckCircle2 size={14} /> : <Upload size={14} />}
                  <span className="truncate">{f.file ? f.file.name : `Seleccionar ${f.accept}`}</span>
                </button>
                <input ref={f.ref} type="file" accept={f.accept} className="hidden"
                  onChange={(e) => f.set(e.target.files?.[0] ?? null)} />
              </div>
            ))}
          </div>

          {/* Contraseña */}
          <div>
            <label className={lbl}>Contraseña de la llave privada</label>
            <div className="relative">
              <input
                type={showConfigPwd ? "text" : "password"}
                value={configPwd}
                onChange={(e) => setConfigPwd(e.target.value)}
                placeholder="Contraseña del archivo .key"
                className={inp + " pr-10"}
              />
              <button onClick={() => setShowConfigPwd(!showConfigPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showConfigPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">La contraseña se usa solo para validar. No se guarda en la base de datos.</p>
          </div>

          {configMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${configMsg.type === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {configMsg.type === "ok" ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <X size={14} className="shrink-0 mt-0.5" />}
              {configMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGuardarConfig}
              disabled={savingConfig || !cerFile || !keyFile || !configPwd}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {savingConfig ? "Validando…" : "Guardar e.firma"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sección 2: Nueva solicitud ───────────────────────────────────────── */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#3A3A3A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <CloudDownload size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Nueva descarga del SAT</h2>
            <p className="text-xs text-gray-500 mt-0.5">El SAT puede tardar 2–10 minutos en preparar los paquetes</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Contraseña de sesión */}
          <div>
            <label className={lbl}>Contraseña de la e.firma <span className="text-[#CC2229]">*</span></label>
            <div className="relative">
              <input
                type={showSessionPwd ? "text" : "password"}
                value={sessionPwd}
                onChange={(e) => setSessionPwd(e.target.value)}
                placeholder="Necesaria para firmar cada solicitud al SAT"
                className={inp + " pr-10"}
              />
              <button onClick={() => setShowSessionPwd(!showSessionPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer">
                {showSessionPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Periodo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fecha fin</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Tipo */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Dirección</label>
              <AppSelect value={direccion} onChange={(e) => setDireccion(e.target.value as "emitidos" | "recibidos")}>
                <option value="emitidos">Emitidos</option>
                <option value="recibidos">Recibidos</option>
              </AppSelect>
            </div>
            <div>
              <label className={lbl}>Tipo de solicitud</label>
              <AppSelect value={tipoSolicitud} onChange={(e) => setTipoSolicitud(e.target.value as "cfdi" | "metadata")}>
                <option value="cfdi">CFDI (XML)</option>
                <option value="metadata">Metadata</option>
              </AppSelect>
            </div>
            <div>
              <label className={lbl}>Tipo de comprobante</label>
              <AppSelect value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
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
              {solicitudMsg.type === "ok" ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <X size={14} className="shrink-0 mt-0.5" />}
              {solicitudMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSolicitar}
              disabled={solicitando || !sessionPwd || !fechaInicio || !fechaFin || !satConfig?.activo}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              {solicitando ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
              {solicitando ? "Enviando al SAT…" : "Solicitar descarga"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sección 3: Historial ─────────────────────────────────────────────── */}
      {sortedHistorial.length > 0 && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#3A3A3A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3A3A3A] text-gray-400">
              <FileText size={18} />
            </div>
            <h2 className="text-sm font-semibold text-white">Historial de descargas</h2>
          </div>

          <div className="divide-y divide-[#3A3A3A]">
            {sortedHistorial.map((d) => (
              <div key={d.id} className="px-6 py-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(d.status)}
                    <span className="text-xs text-gray-400 font-mono">{d.requestId?.slice(0, 16)}…</span>
                    <span className="text-xs text-gray-500">{d.direccion} · {d.tipo}</span>
                    <span className="text-xs text-gray-600">{d.fechaInicio} → {d.fechaFin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(d.status === "pendiente" || d.status === "procesando") && (
                      <button
                        onClick={() => verificar(d.requestId)}
                        disabled={!sessionPwd || verificandoId === d.requestId}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3A3A3A] text-gray-400 rounded-lg hover:border-blue-500/40 hover:text-blue-400 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <RefreshCw size={12} className={verificandoId === d.requestId ? "animate-spin" : ""} />
                        Verificar
                      </button>
                    )}
                  </div>
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

                <p className="text-[10px] text-gray-600">{fmtDate(d.solicitadoEn)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
