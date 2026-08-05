"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  DollarSign,
  FileDown,
  FileText,
  Fuel,
  Wrench,
  Package,
  ReceiptText,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  Lock,
  ShieldCheck,
  BarChart3,
  HardHat,
  BookUser,
  CalendarDays,
  Building2,
  FlaskConical,
  ChartNoAxesColumn,
  Terminal,
  UserRound,
  ScanEye,
} from "lucide-react";
import {
  getAllowedModuleSet,
  getActivePlanta,
  getStoredSession,
  Planta,
  setActivePlanta,
  DEV_ONLY_ROUTES,
  DEVELOPER_EMAIL,
} from "@/lib/auth";
import {
  ModuleStatus,
  loadModuleStatuses,
  saveModuleStatus,
  nextStatus,
  MODULE_STATUS_DEFAULTS,
} from "@/lib/moduleStatus";

// ─── Items de navegación ──────────────────────────────────────────────────────

const navItems = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/reportes",   icon: BarChart3,        label: "Reportes" },
];

const systemItems = [
  { href: "/configuracion", icon: ShieldCheck, label: "Configuración" },
];

const administracionItems: { href: string; icon: React.ElementType; label: string }[] = [];

const transporteItems = [
  { href: "/transporte/programacion",  icon: CalendarDays, label: "Programación" },
  { href: "/transporte/seguros",       icon: Truck,        label: "Flota" },
  { href: "/transporte/diesel",        icon: Fuel,         label: "Consumo de Diésel" },
  { href: "/transporte/mantenimiento", icon: Wrench,       label: "Mantenimiento de Flota" },
];

const operacionesItems = [
  { href: "/operaciones/inventario", icon: Package, label: "Inventarios" },
];

const ventasItems = [
  { href: "/crm/clientes",            icon: BookUser,        label: "Base de Clientes" },
  { href: "/crm/pipeline",            icon: ChartNoAxesColumn, label: "Pipeline CRM" },
  { href: "/ventas/programacion",     icon: CalendarDays,    label: "Programación" },
  { href: "/ventas/recibos-concreto", icon: ReceiptText,     label: "Recibos de Concreto" },
];

const finanzasItems = [
  { href: "/finanzas/cxc",                    icon: FileDown,  label: "Cuentas x Cobrar" },
  { href: "/finanzas/cxp",                    icon: DollarSign, label: "Cuentas x Pagar" },
  { href: "/finanzas/estado-cuenta-clientes", icon: FileText,  label: "Estados Cliente" },
];

const facturacionItems = [
  { href: "/facturacion", icon: ReceiptText, label: "Facturas CFDI" },
];

const recursosHumanosItems = [
  { href: "/transporte/operadores",    icon: HardHat,      label: "Empleados" },
  { href: "/recursos-humanos/nomina",  icon: FlaskConical, label: "Nómina", devOnly: true },
];

// ─── Badge de estado ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ModuleStatus, { label: string; cls: string }> = {
  live: {
    label: "EN VIVO",
    cls:   "text-emerald-400/80 bg-emerald-400/10 border border-emerald-400/20",
  },
  wip: {
    label: "WIP",
    cls:   "text-orange-400/80 bg-orange-400/10 border border-orange-400/20",
  },
  dev: {
    label: "DEV",
    cls:   "text-amber-400/80 bg-amber-400/10 border border-amber-400/20",
  },
};

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({
  href,
  icon: Icon,
  label,
  enabledSet,
  isAdmin,
  devOnly,
  status,
  isDevMode,
  onStatusChange,
  onClick,
}: {
  href:           string;
  icon:           React.ElementType;
  label:          string;
  enabledSet:     Set<string>;
  isAdmin?:       boolean;
  devOnly?:       boolean;
  status?:        ModuleStatus;
  isDevMode?:     boolean;
  onStatusChange?: (href: string, next: ModuleStatus) => void;
  onClick?:       () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  if (devOnly && !isAdmin) return null;

  const isEnabled = enabledSet.has(href) && !DEV_ONLY_ROUTES.has(href) || DEV_ONLY_ROUTES.has(href);

  function handleBadgeClick(e: React.MouseEvent) {
    if (!isDevMode || !onStatusChange) return;
    e.preventDefault();
    e.stopPropagation();
    onStatusChange(href, nextStatus(status ?? "live"));
  }

  const badge = status ? STATUS_BADGE[status] : null;

  const badgeEl = badge ? (
    <span
      onClick={handleBadgeClick}
      title={isDevMode ? `Clic para cambiar a: ${nextStatus(status!)}` : badge.label}
      className={`ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.cls} ${
        isDevMode ? "cursor-pointer hover:opacity-100 transition-opacity" : ""
      }`}
    >
      {status === "live" ? "●" : badge.label}
    </span>
  ) : null;

  if (!isEnabled) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none"
        aria-disabled="true"
        title="Módulo bloqueado"
      >
        <Icon size={18} className="text-slate-600" />
        <span className="min-w-0 flex-1 whitespace-normal leading-snug">{label}</span>
        {badgeEl ?? <Lock size={13} className="ml-auto shrink-0 text-slate-600" />}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
        isActive
          ? "bg-[#CC2229] text-white shadow-lg shadow-[#CC2229]/20"
          : "text-white/90 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} className={isActive ? "text-white" : "text-slate-400 group-hover:text-white"} />
      <span className="min-w-0 flex-1 whitespace-normal leading-snug">{label}</span>
      {badgeEl}
    </Link>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  expanded,
  onToggle,
  locked = false,
}: {
  label:    string;
  expanded: boolean;
  onToggle: () => void;
  locked?:  boolean;
}) {
  return (
    <button
      onClick={locked ? undefined : onToggle}
      disabled={locked}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
        locked ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white"
      }`}
      title={locked ? "Sección bloqueada" : undefined}
    >
      {label}
      {locked ? <Lock size={12} /> : expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?:    () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [session, setSession]             = useState<ReturnType<typeof getStoredSession>>(null);
  const [activePlanta, setActivePlantaState] = useState<Planta>("Todas");
  const [statuses, setStatuses]           = useState<Record<string, ModuleStatus>>(MODULE_STATUS_DEFAULTS);
  const [devMode, setDevMode]             = useState(false);

  const canSwitchPlanta = !session?.planta || session.planta === "Todas";
  const isAdmin         = session?.role === "admin";
  const isDeveloper     = session?.email === DEVELOPER_EMAIL;

  const enabledSet = useMemo(() => getAllowedModuleSet(session), [session]);

  const hasEnabledItems = (items: Array<{ href: string; devOnly?: boolean }>) =>
    items.some((item) => (item.devOnly ? isAdmin : enabledSet.has(item.href)));

  const transporteLocked      = !hasEnabledItems(transporteItems);
  const administracionLocked  = !hasEnabledItems(administracionItems);
  const operacionesLocked     = !hasEnabledItems(operacionesItems);
  const ventasLocked          = !hasEnabledItems(ventasItems);
  const finanzasLocked        = !hasEnabledItems(finanzasItems);
  const facturacionLocked     = !hasEnabledItems(facturacionItems);
  const recursosHumanosLocked = !hasEnabledItems(recursosHumanosItems);
  const sistemaLocked         = !hasEnabledItems(systemItems);

  const [transporteOpen,      setTransporteOpen]      = useState(true);
  const [administracionOpen,  setAdministracionOpen]  = useState(true);
  const [operacionesOpen,     setOperacionesOpen]      = useState(true);
  const [ventasOpen,          setVentasOpen]           = useState(true);
  const [finanzasOpen,        setFinanzasOpen]         = useState(true);
  const [facturacionOpen,     setFacturacionOpen]      = useState(true);
  const [recursosHumanosOpen, setRecursosHumanosOpen] = useState(true);
  const [sistemaOpen,         setSistemaOpen]          = useState(true);

  // Carga inicial — debe correr solo en cliente para evitar hydration mismatch
  useEffect(() => {
    setSession(getStoredSession());
    setActivePlantaState(getActivePlanta());
    loadModuleStatuses().then(setStatuses);
  }, []);

  useEffect(() => {
    function onUpdate() {
      setSession(getStoredSession());
      setActivePlantaState(getActivePlanta());
    }
    window.addEventListener("duro:session-updated", onUpdate);
    return () => window.removeEventListener("duro:session-updated", onUpdate);
  }, []);

  function handlePlantaChange(p: Planta) {
    setActivePlanta(p);
    setActivePlantaState(p);
    window.location.reload();
  }

  async function handleStatusChange(href: string, next: ModuleStatus) {
    setStatuses((prev) => ({ ...prev, [href]: next }));
    await saveModuleStatus(href, next);
  }

  function navLinkProps(href: string) {
    return {
      enabledSet,
      isAdmin,
      status:         statuses[href] as ModuleStatus | undefined,
      isDevMode:      devMode && isDeveloper,
      onStatusChange: handleStatusChange,
      onClick:        onClose,
    };
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
            <Image
              src="/DC_LOGO-removebg-preview.png"
              alt="Duro Concretos"
              width={36}
              height={36}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Duro Concretos</p>
            <p className="text-xs text-slate-400 leading-tight">Sistema ERP</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Plant switcher */}
      <div className="px-3 py-2.5 border-b border-white/10">
        {canSwitchPlanta ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2 px-0.5">Planta activa</p>
            <div className="flex gap-1">
              {(["Allende", "Pesquería", "Todas"] as Planta[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePlantaChange(p)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    activePlanta === p
                      ? "bg-[#CC2229] text-white shadow-md shadow-[#CC2229]/30"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 px-0.5">
            <Building2 size={13} className="text-[#CC2229] shrink-0" />
            <span className="text-xs text-white font-semibold">Planta {session?.planta}</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Transporte" expanded={transporteOpen && !transporteLocked} locked={transporteLocked} onToggle={() => setTransporteOpen((v) => !v)} />
        </div>
        {transporteOpen && !transporteLocked && transporteItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Administración" expanded={administracionOpen && !administracionLocked} locked={administracionLocked} onToggle={() => setAdministracionOpen((v) => !v)} />
        </div>
        {administracionOpen && !administracionLocked && administracionItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Operaciones" expanded={operacionesOpen && !operacionesLocked} locked={operacionesLocked} onToggle={() => setOperacionesOpen((v) => !v)} />
        </div>
        {operacionesOpen && !operacionesLocked && operacionesItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Ventas" expanded={ventasOpen && !ventasLocked} locked={ventasLocked} onToggle={() => setVentasOpen((v) => !v)} />
        </div>
        {ventasOpen && !ventasLocked && ventasItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Finanzas" expanded={finanzasOpen && !finanzasLocked} locked={finanzasLocked} onToggle={() => setFinanzasOpen((v) => !v)} />
        </div>
        {finanzasOpen && !finanzasLocked && finanzasItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Facturación" expanded={facturacionOpen && !facturacionLocked} locked={facturacionLocked} onToggle={() => setFacturacionOpen((v) => !v)} />
        </div>
        {facturacionOpen && !facturacionLocked && facturacionItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Recursos Humanos" expanded={recursosHumanosOpen && !recursosHumanosLocked} locked={recursosHumanosLocked} onToggle={() => setRecursosHumanosOpen((v) => !v)} />
        </div>
        {recursosHumanosOpen && !recursosHumanosLocked && recursosHumanosItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader label="Sistema" expanded={sistemaOpen && !sistemaLocked} locked={sistemaLocked} onToggle={() => setSistemaOpen((v) => !v)} />
        </div>
        {sistemaOpen && !sistemaLocked && systemItems.map((item) => (
          <NavLink key={item.href} {...item} {...navLinkProps(item.href)} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-3 space-y-2">
        {/* Dev tools — solo visible para leonardo@lpsoft.mx */}
        {isDeveloper && (
          <div className="space-y-1">
            <button
              onClick={() => setDevMode((v) => !v)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                devMode
                  ? "bg-violet-500/20 border border-violet-400/30 text-violet-300"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Terminal size={13} />
              {devMode ? "Dev mode activo — clic en badge para cambiar" : "Dev tools"}
              {devMode && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
            </button>

            {devMode && (
              <div className="space-y-0.5 pl-1">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("duro:devtool:open", { detail: { tool: "impersonate" } }))}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <UserRound size={13} />
                  Impersonar usuario
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("duro:devtool:open", { detail: { tool: "inspector" } }))}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ScanEye size={13} />
                  Inspector de sesión
                </button>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500">v1.0.0 © 2026 Duro Concretos</p>
        <a href="https://lpsoft.mx" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-white transition-colors">
          By Software and Solutions LP
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside className="duro-sidebar hidden min-h-screen w-72 shrink-0 flex-col border-r border-[#1E293B] bg-[#0B1220] lg:flex">
        {content}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={onClose} />
          <aside className="duro-sidebar relative flex min-h-screen w-80 max-w-[85vw] flex-col border-r border-[#1E293B] bg-[#0B1220]">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
    >
      <Menu size={22} />
    </button>
  );
}
