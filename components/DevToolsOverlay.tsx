"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight, Copy, Eye, EyeOff, LogOut, Search,
  Shield, ShieldAlert, User, X, Check,
} from "lucide-react";
import {
  getStoredSession,
  getImpersonationOriginal,
  isImpersonating,
  startImpersonation,
  stopImpersonation,
  DEVELOPER_EMAIL,
} from "@/lib/auth";
import { getAllUserProfiles, UserProfile } from "@/lib/db";

// ─── Tipos de eventos del sidebar ────────────────────────────────────────────

type DevTool = "impersonate" | "inspector";

// ─── Banner de impersonación ──────────────────────────────────────────────────

function ImpersonationBanner() {
  const [active, setActive] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [original, setOriginal] = useState<ReturnType<typeof getImpersonationOriginal>>(null);

  useEffect(() => {
    setActive(isImpersonating());
    setSession(getStoredSession());
    setOriginal(getImpersonationOriginal());
    function onUpdate() {
      setActive(isImpersonating());
      setSession(getStoredSession());
      setOriginal(getImpersonationOriginal());
    }
    window.addEventListener("duro:session-updated", onUpdate);
    return () => window.removeEventListener("duro:session-updated", onUpdate);
  }, []);

  if (!active || !session) return null;

  return (
    <div className="flex items-center gap-3 bg-violet-600 px-4 py-2 text-xs text-white shrink-0">
      <ShieldAlert size={14} className="shrink-0" />
      <span>
        Viendo como <strong>{session.name}</strong>
        <span className="ml-1 opacity-70">({session.email} · {session.role})</span>
        {original && (
          <span className="ml-2 opacity-60">— tú eres {original.name}</span>
        )}
      </span>
      <button
        onClick={() => { stopImpersonation(); window.location.reload(); }}
        className="ml-auto flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 font-semibold hover:bg-white/30 transition-colors"
      >
        <LogOut size={12} /> Salir
      </button>
    </div>
  );
}

// ─── Modal: Impersonar usuario ────────────────────────────────────────────────

function ImpersonateModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers]   = useState<UserProfile[]>([]);
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUserProfiles()
      .then((u) => setUsers(u.filter((p) => p.status === "Activo")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      u.nombre?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  function impersonate(u: UserProfile) {
    startImpersonation({
      email:   u.email,
      name:    u.nombre,
      role:    u.role,
      modules: u.modules,
      planta:  u.planta,
    });
    onClose();
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1C1C1C] border border-[#3A3A3A] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
              <User size={15} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Impersonar usuario</p>
              <p className="text-[10px] text-gray-500">Solo tú puedes hacer esto</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#3A3A3A]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email o rol…"
              className="w-full bg-[#111] border border-[#3A3A3A] rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60 transition-colors"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <p className="text-center text-gray-500 text-sm py-8">Cargando usuarios…</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Sin resultados</p>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => impersonate(u)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-[#2A2A2A] last:border-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-gray-400 text-xs font-bold uppercase">
                {u.nombre?.slice(0, 2) ?? "??"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{u.nombre}</p>
                <p className="text-gray-500 text-xs truncate">{u.email}</p>
              </div>
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                u.role === "admin"
                  ? "bg-[#CC2229]/15 text-[#CC2229]"
                  : "bg-white/5 text-gray-400"
              }`}>
                {u.role}
              </span>
              <ChevronRight size={14} className="shrink-0 text-gray-600" />
            </button>
          ))}
        </div>

        {isImpersonating() && (
          <div className="px-4 py-3 border-t border-[#3A3A3A]">
            <button
              onClick={() => { stopImpersonation(); onClose(); window.location.reload(); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/30 py-2 text-sm text-violet-400 hover:bg-violet-500/25 transition-colors"
            >
              <LogOut size={14} /> Salir de impersonación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Inspector de sesión ───────────────────────────────────────────────

function SessionInspector({ onClose }: { onClose: () => void }) {
  const [session, setSession]         = useState<ReturnType<typeof getStoredSession>>(null);
  const [copied, setCopied]           = useState(false);
  const [showRaw, setShowRaw]         = useState(false);
  const [original, setOriginal]       = useState<ReturnType<typeof getImpersonationOriginal>>(null);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    setSession(getStoredSession());
    setOriginal(getImpersonationOriginal());
    setImpersonating(isImpersonating());
    function onUpdate() {
      setSession(getStoredSession());
      setOriginal(getImpersonationOriginal());
      setImpersonating(isImpersonating());
    }
    window.addEventListener("duro:session-updated", onUpdate);
    return () => window.removeEventListener("duro:session-updated", onUpdate);
  }, []);

  function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(session, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
      <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[#2A2A2A] last:border-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 shrink-0 pt-0.5">{label}</span>
        <span className={`text-sm text-white text-right break-all ${mono ? "font-mono text-xs text-gray-300" : ""}`}>
          {value}
        </span>
      </div>
    );
  }

  const modules = session?.modules === "all"
    ? "all (admin — acceso total)"
    : Array.isArray(session?.modules)
      ? `${session.modules.length} módulos`
      : "—";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-end">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-[#141414] border-l border-[#3A3A3A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3A3A3A]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
              <Eye size={15} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Inspector de sesión</p>
              <p className="text-[10px] text-gray-500">localStorage · duro_concretos_session</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Impersonation notice */}
        {impersonating && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/30 px-3 py-2.5">
            <ShieldAlert size={14} className="text-violet-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-300">Impersonando usuario</p>
              {original && (
                <p className="text-[10px] text-violet-400/70">Original: {original.name} ({original.role})</p>
              )}
            </div>
          </div>
        )}

        {/* Sesión actual */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Sesión activa
          </p>
          {session ? (
            <div className="bg-[#1C1C1C] border border-[#3A3A3A] rounded-xl px-4 divide-y divide-[#2A2A2A]">
              <Field label="Nombre"  value={session.name ?? "—"} />
              <Field label="Email"   value={session.email ?? "—"} mono />
              <Field label="Rol"     value={session.role ?? "—"} />
              <Field label="Módulos" value={modules} />
              <Field label="Planta"  value={session.planta ?? "—"} />
              {session.plantaActiva && (
                <Field label="Planta activa" value={session.plantaActiva} />
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Sin sesión activa</p>
          )}

          {/* Raw JSON toggle */}
          <div className="mt-4">
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showRaw ? <EyeOff size={12} /> : <Eye size={12} />}
              {showRaw ? "Ocultar" : "Ver"} JSON raw
            </button>
            {showRaw && (
              <pre className="mt-2 bg-[#0D0D0D] border border-[#3A3A3A] rounded-xl p-4 text-[11px] text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(session, null, 2)}
              </pre>
            )}
          </div>

          {/* Módulos detalle */}
          {Array.isArray(session?.modules) && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Módulos habilitados ({session.modules.length})
              </p>
              <div className="space-y-1">
                {session.modules.map((m: string) => (
                  <div key={m} className="flex items-center gap-2 text-xs">
                    <Shield size={10} className="text-emerald-500 shrink-0" />
                    <span className="font-mono text-gray-400">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#3A3A3A] px-4 py-3 flex gap-2">
          <button
            onClick={copyJSON}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-[#3A3A3A] py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? "Copiado" : "Copiar JSON"}
          </button>
          {impersonating && (
            <button
              onClick={() => { stopImpersonation(); onClose(); window.location.reload(); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/30 py-2 text-xs text-violet-400 hover:bg-violet-500/25 transition-colors"
            >
              <LogOut size={13} /> Salir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DevToolsOverlay (punto de entrada) ──────────────────────────────────────

function isDeveloperSession(): boolean {
  const session  = getStoredSession();
  const original = getImpersonationOriginal();
  // Autorizado si la sesión activa ES el developer, O si el original (pre-impersonación) lo es
  return (
    session?.email === DEVELOPER_EMAIL ||
    (isImpersonating() && original?.email === DEVELOPER_EMAIL)
  );
}

export default function DevToolsOverlay() {
  const [openTool, setOpenTool] = useState<DevTool | null>(null);

  useEffect(() => {
    function onEvent(e: Event) {
      if (!isDeveloperSession()) return; // gate de seguridad
      const tool = (e as CustomEvent<{ tool: DevTool }>).detail?.tool;
      if (tool) setOpenTool(tool);
    }
    window.addEventListener("duro:devtool:open", onEvent);
    return () => window.removeEventListener("duro:devtool:open", onEvent);
  }, []);

  return (
    <>
      <ImpersonationBanner />
      {openTool === "impersonate" && <ImpersonateModal  onClose={() => setOpenTool(null)} />}
      {openTool === "inspector"   && <SessionInspector  onClose={() => setOpenTool(null)} />}
    </>
  );
}
