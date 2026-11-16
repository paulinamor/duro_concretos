"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookUser,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  CloudDownload,
  CreditCard,
  DollarSign,
  FileDown,
  FileText,
  FlaskConical,
  Fuel,
  HardHat,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ScanEye,
  ShieldCheck,
  ShieldEllipsis,
  Terminal,
  Truck,
  UserRound,
  Wrench,
  X,
  Menu,
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
import pkg from "@/package.json";
import {
  ModuleStatus,
  loadModuleStatuses,
  saveModuleStatus,
  nextStatus,
  MODULE_STATUS_DEFAULTS,
} from "@/lib/moduleStatus";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  devOnly?: boolean;
  badge?: "beta";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── Navegación ───────────────────────────────────────────────────────────────

const topItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/reportes",  icon: BarChart3,       label: "Reportes" },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Programación",
    items: [
      { href: "/transporte/programacion",     icon: CalendarDays, label: "Programación" },
      { href: "/transporte/programacion-live", icon: Activity,     label: "Prog. en tiempo real" },
      { href: "/ventas/recibos-concreto",     icon: ReceiptText,  label: "Recibos de Concreto" },
      { href: "/ventas/remisiones",           icon: FileText,     label: "Remisiones" },
    ],
  },
  {
    label: "Transporte",
    items: [
      { href: "/transporte/flota-en-vivo",       icon: ScanEye,        label: "Flota en vivo" },
      { href: "/transporte/verificacion-viajes", icon: MapPin,         label: "Verificación viajes" },
      { href: "/transporte/geocercas",           icon: ShieldEllipsis, label: "Geocercas" },
      { href: "/transporte/seguros",             icon: Truck,          label: "Unidades y Seguros" },
      { href: "/transporte/diesel",              icon: Fuel,           label: "Consumo de Diésel" },
      { href: "/transporte/mantenimiento",       icon: Wrench,         label: "Mantenimiento de Flota" },
    ],
  },
  {
    label: "Ventas & CRM",
    items: [
      { href: "/crm/clientes",         icon: BookUser,          label: "Clientes" },
      { href: "/crm/pipeline",         icon: ChartNoAxesColumn, label: "Pipeline" },
      { href: "/ventas/programacion",  icon: CalendarDays,      label: "Programación Ventas" },
      { href: "/ventas/obras",         icon: MapPin,            label: "Catálogo de Obras" },
      { href: "/ventas/productos",     icon: Package,           label: "Productos" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/facturacion",                      icon: ReceiptText, label: "Facturas CFDI" },
      { href: "/finanzas/cxc",                     icon: FileDown,    label: "Cuentas x Cobrar" },
      { href: "/finanzas/cxp",                     icon: DollarSign,  label: "Cuentas x Pagar" },
      { href: "/finanzas/cobros",                  icon: CreditCard,  label: "Cobros" },
      { href: "/finanzas/estado-cuenta-clientes",  icon: FileText,    label: "Estados Cliente" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/operaciones/inventario", icon: Package,    label: "Inventarios" },
      { href: "/operaciones/caja-chica", icon: CreditCard, label: "Caja Chica" },
    ],
  },
  {
    label: "Recursos Humanos",
    items: [
      { href: "/transporte/operadores",       icon: HardHat,      label: "Empleados" },
      { href: "/recursos-humanos/asistencia", icon: CalendarDays, label: "Asistencia" },
      { href: "/recursos-humanos/nomina",     icon: FlaskConical, label: "Nómina", devOnly: true },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/configuracion",              icon: ShieldCheck,   label: "Configuración" },
      { href: "/soporte",                    icon: LifeBuoy,      label: "Soporte" },
      { href: "/configuracion/sat-descarga", icon: CloudDownload, label: "Descarga SAT", devOnly: true },
      { href: "/dev",                        icon: Terminal,      label: "Dev Tools",    devOnly: true },
    ],
  },
];

// ─── Badge de estado ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ModuleStatus, { label: string; cls: string }> = {
  live: { label: "●",   cls: "text-emerald-400/70 bg-emerald-400/10 border border-emerald-400/20" },
  wip:  { label: "WIP", cls: "text-orange-400/70 bg-orange-400/10 border border-orange-400/20" },
  dev:  { label: "DEV", cls: "text-amber-400/70 bg-amber-400/10 border border-amber-400/20" },
};

// ─── NavItem component ────────────────────────────────────────────────────────

function NavLink({
  href,
  icon: Icon,
  label,
  enabledSet,
  isAdmin,
  devOnly,
  status,
  isDevMode,
  isCollapsed,
  onStatusChange,
  onClick,
}: NavItem & {
  enabledSet:     Set<string>;
  isAdmin:        boolean;
  isDevMode:      boolean;
  isCollapsed:    boolean;
  status?:        ModuleStatus;
  onStatusChange: (href: string, next: ModuleStatus) => void;
  onClick?:       () => void;
}) {
  const pathname  = usePathname();
  const isActive  = pathname === href || pathname.startsWith(href + "/");

  if (devOnly && !isAdmin) return null;

  const isEnabled = enabledSet.has(href) && !DEV_ONLY_ROUTES.has(href) || DEV_ONLY_ROUTES.has(href);
  // "live" badge solo visible en dev mode; WIP y DEV siempre visibles
  const badge = status && STATUS_BADGE[status] ? STATUS_BADGE[status] : null;
  const showBadge = badge && (status !== "live" || isDevMode);

  function handleBadgeClick(e: React.MouseEvent) {
    if (!isDevMode || !onStatusChange) return;
    e.preventDefault();
    e.stopPropagation();
    onStatusChange(href, nextStatus(status ?? "live"));
  }

  const badgeEl = showBadge && !isCollapsed ? (
    <span
      onClick={handleBadgeClick}
      title={isDevMode ? `Cambiar a: ${nextStatus(status!)}` : badge.label}
      className={`ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.cls} ${isDevMode ? "cursor-pointer" : ""}`}
    >
      {badge.label}
    </span>
  ) : null;

  if (!isEnabled) {
    return (
      <div
        title={isCollapsed ? `${label} (bloqueado)` : undefined}
        className={`flex items-center gap-3 rounded-xl py-2 text-[0.83rem] text-slate-500 cursor-not-allowed select-none opacity-50 ${isCollapsed ? "justify-center px-0" : "px-3"}`}
      >
        <Icon size={18} className="shrink-0 text-slate-600" />
        {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
        {!isCollapsed && <Lock size={12} className="ml-auto shrink-0 text-slate-600" />}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl py-2 text-[0.83rem] font-medium transition-colors ${
        isCollapsed ? "justify-center px-0" : "px-3"
      } ${
        isActive
          ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {/* Indicador activo — barra roja lateral izquierda */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#CC2229]" />
      )}
      <Icon
        size={18}
        className={`shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
      />
      {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
      {badgeEl}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const COLLAPSE_KEY = "duro:sidebar-collapsed";
const ROLE_LABELS: Record<string, string> = {
  admin:         "Administrador",
  operaciones:   "Operaciones",
  administracion:"Administración",
  finanzas:      "Finanzas",
  ventas:        "Ventas",
  transporte:    "Transporte",
};

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?:    () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [session, setSession]           = useState<ReturnType<typeof getStoredSession>>(null);
  const [activePlanta, setActivePlantaState] = useState<Planta>("Todas");
  const [statuses, setStatuses]         = useState<Record<string, ModuleStatus>>(MODULE_STATUS_DEFAULTS);
  const [devMode, setDevMode]           = useState(false);
  const [devOpen, setDevOpen]           = useState(false);
  const [collapsed, setCollapsed]       = useState(false);

  const canSwitchPlanta = !session?.planta || session.planta === "Todas";
  const isAdmin         = session?.role === "admin";
  const isDeveloper     = session?.email === DEVELOPER_EMAIL;
  const enabledSet      = useMemo(() => getAllowedModuleSet(session), [session]);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* noop */ }
  }, []);

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

  function toggleCollapsed() {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSE_KEY, v ? "0" : "1"); } catch { /* noop */ }
      return !v;
    });
  }

  function handlePlantaChange(p: Planta) {
    setActivePlanta(p);
    setActivePlantaState(p);
    window.location.reload();
  }

  async function handleStatusChange(href: string, next: ModuleStatus) {
    setStatuses((prev) => ({ ...prev, [href]: next }));
    await saveModuleStatus(href, next);
  }

  function navLinkProps(item: NavItem) {
    return {
      ...item,
      enabledSet,
      isAdmin:        isAdmin || false,
      isDevMode:      devMode && isDeveloper,
      isCollapsed:    collapsed,
      onStatusChange: handleStatusChange,
      onClick:        onClose,
      status:         statuses[item.href] as ModuleStatus | undefined,
    };
  }

  const initials = session?.name
    ? session.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "U";

  const content = (
    <div className="flex flex-col h-full">

      {/* Gradiente de fondo — idéntico al JC */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_0%,rgba(204,34,41,0.20),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[rgba(204,34,41,0.08)] to-transparent" />

      {/* Marca */}
      <div className={`relative shrink-0 pb-3 pt-5 ${collapsed ? "px-3" : "px-4"}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)]">
            <Image
              src="/DC_LOGO-removebg-preview.png"
              alt="Duro Concretos"
              width={32}
              height={32}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[0.9rem] font-bold leading-tight tracking-tight text-white">
                Duro Concretos
              </p>
              <p className="truncate text-[0.66rem] font-medium text-slate-400">
                Sistema ERP
              </p>
            </div>
          )}
          {!collapsed && onClose && (
            <button
              onClick={onClose}
              className="ml-auto shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Planta switcher */}
      {canSwitchPlanta ? (
        <div className={`relative shrink-0 pb-3 ${collapsed ? "px-2" : "px-4"}`}>
          {!collapsed && (
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1.5 px-0.5">
              Planta activa
            </p>
          )}
          <div className={`flex ${collapsed ? "flex-col" : "flex-row"} gap-1`}>
            {(["Allende", "Pesquería", "Todas"] as Planta[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePlantaChange(p)}
                title={collapsed ? p : undefined}
                className={`rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  collapsed ? "py-1.5 px-0 w-full text-center" : "flex-1 py-1.5"
                } ${
                  activePlanta === p
                    ? "bg-[#CC2229] text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {collapsed ? p[0] : p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        !collapsed && (
          <div className="relative shrink-0 pb-3 px-5 flex items-center gap-2">
            <Building2 size={13} className="text-[#CC2229] shrink-0" />
            <span className="text-xs text-white font-semibold">Planta {session?.planta}</span>
          </div>
        )
      )}

      {/* Nav */}
      <nav className={`relative flex-1 overflow-y-auto pb-4 ${collapsed ? "px-2.5" : "px-3"}`}>

        {/* Items de inicio — sin grupo */}
        <div className="space-y-0.5 mb-2">
          {topItems.map((item) => <NavLink key={item.href} {...navLinkProps(item)} />)}
        </div>

        {/* Grupos */}
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((i) => i.devOnly ? isAdmin : true);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="pt-4 first:pt-1">
              {collapsed ? (
                <div className="mx-3 mb-2 h-px bg-white/[0.07]" />
              ) : (
                <p className="mb-1 px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => <NavLink key={item.href} {...navLinkProps(item)} />)}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Dev tools — solo developer */}
      {isDeveloper && !collapsed && (
        <div className="relative shrink-0 space-y-0.5 px-3 pt-1">
          <button
            onClick={() => setDevOpen((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              devOpen
                ? "border border-violet-400/30 bg-violet-500/20 text-violet-300"
                : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">
              {devMode ? "Dev mode activo" : "Dev tools"}
            </span>
            {devOpen && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />}
          </button>
          {devOpen && (
            <div className="space-y-0.5 pl-1">
              <button
                onClick={() => {
                  setDevMode((v) => !v);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
                  devMode ? "text-violet-300 hover:bg-violet-500/10" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${devMode ? "bg-violet-400 animate-pulse" : "bg-slate-600"}`} />
                {devMode ? "Desactivar dev mode" : "Activar dev mode"}
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("duro:devtool:open", { detail: { tool: "impersonate" } }))}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                Impersonar usuario
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("duro:devtool:open", { detail: { tool: "inspector" } }))}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ScanEye className="h-3.5 w-3.5 shrink-0" />
                Inspector de sesión
              </button>
            </div>
          )}
        </div>
      )}

      {/* Usuario + footer */}
      <div className={`relative shrink-0 pb-4 pt-2 ${collapsed ? "px-2.5" : "px-3"}`}>
        <div
          className={`flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5 ${
            collapsed ? "flex-col gap-2 px-0" : ""
          }`}
        >
          {/* Avatar con iniciales */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-[#CC2229] text-[0.7rem] font-bold text-white ring-1 ring-white/10">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight text-white">
                {session?.name || "Usuario"}
              </p>
              <p className="truncate text-[0.66rem] text-slate-400">
                {ROLE_LABELS[session?.role ?? ""] ?? session?.role ?? ""}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("duro_concretos_session");
              window.location.href = "/";
            }}
            title="Cerrar sesión"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className={`mt-2.5 flex items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          {!collapsed && (
            <a
              href="https://lpsoft.mx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.6rem] text-slate-600 transition hover:text-slate-400"
            >
              Software and Solutions LP
            </a>
          )}
          {!collapsed && (
            <span className="text-[0.6rem] font-mono text-slate-600">v{pkg.version}</span>
          )}
        </div>

        {/* Botón colapsar */}
        <div className={`mt-2 flex ${collapsed ? "justify-center" : "justify-end px-1"}`}>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            {collapsed
              ? <PanelLeftOpen className="h-3.5 w-3.5" />
              : <PanelLeftClose className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`duro-sidebar relative hidden min-h-screen shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#0B1220] text-slate-300 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-[264px]"
        }`}
      >
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={onClose} />
          <aside className="duro-sidebar relative flex min-h-screen w-[264px] max-w-[85vw] flex-col overflow-hidden border-r border-white/[0.06] bg-[#0B1220] text-slate-300">
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
