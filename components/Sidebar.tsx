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
  Wallet,
  ReceiptText,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  ClipboardClock,
  Bot,
  UsersRound,
  ChartNoAxesColumn,
  Lock,
  ShieldCheck,
  CalendarClock,
  BarChart3,
  HardHat,
  BookUser,
} from "lucide-react";
import { getAllowedModuleSet, getStoredSession } from "@/lib/auth";

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard operativo",
  },
  {
    href: "/reportes",
    icon: BarChart3,
    label: "Reportes",
  },
  {
    href: "/automatizaciones",
    icon: Bot,
    label: "Automatizaciones",
  },
];

const systemItems = [
  {
    href: "/configuracion",
    icon: ShieldCheck,
    label: "Configuración",
  },
];

const administracionItems = [
  { href: "/administracion/viajes-chofer", icon: UsersRound, label: "Viajes por Chofer" },
];

const transporteItems = [
  { href: "/transporte/viajes", icon: Truck, label: "Control de viajes y choferes" },
  { href: "/transporte/operadores", icon: HardHat, label: "Operadores" },
  { href: "/transporte/unidades", icon: Truck, label: "Unidades / Flota" },
  { href: "/transporte/disponibilidad", icon: CalendarClock, label: "Disponibilidad de cargas" },
  { href: "/transporte/pagos", icon: DollarSign, label: "Pago por viaje / m³" },
  { href: "/transporte/diesel", icon: Fuel, label: "Consumo de diésel" },
  { href: "/transporte/mantenimiento", icon: Wrench, label: "Mantenimiento + refacciones" },
  { href: "/transporte/seguros", icon: ShieldCheck, label: "Seguros de flota" },
];

const operacionesItems = [
  { href: "/operaciones/inventario", icon: Package, label: "Inventarios" },
  { href: "/operaciones/caja-chica", icon: Wallet, label: "Caja Chica" },
];

const ventasItems = [
  { href: "/crm/clientes", icon: BookUser, label: "Base de clientes" },
  { href: "/crm/pipeline", icon: ChartNoAxesColumn, label: "Pipeline CRM" },
  { href: "/crm/seguimiento", icon: UsersRound, label: "Seguimiento de oportunidades" },
  { href: "/crm/clientes-vendedor", icon: UsersRound, label: "Clientes por vendedor" },
  { href: "/ventas/recibos-concreto", icon: ReceiptText, label: "Recibos de concreto" },
  { href: "/ventas/horas-llegada-salida", icon: ClipboardClock, label: "Horas Llegada/Salida" },
];

const finanzasItems = [
  { href: "/finanzas/cxc", icon: FileDown, label: "Cuentas x Cobrar" },
  { href: "/finanzas/cxp", icon: DollarSign, label: "Cuentas x Pagar" },
  { href: "/finanzas/estado-cuenta-clientes", icon: FileText, label: "Estados Cliente" },
];

const recursosHumanosItems = [
  { href: "/recursos-humanos/nomina", icon: ReceiptText, label: "Nómina Timbrada" },
];

function NavLink({
  href,
  icon: Icon,
  label,
  enabledSet,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  enabledSet: Set<string>;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const isEnabled = enabledSet.has(href);

  if (!isEnabled) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none"
        aria-disabled="true"
        title="Módulo bloqueado"
      >
        <Icon size={18} className="text-slate-600" />
        <span className="min-w-0 flex-1 whitespace-normal leading-snug">{label}</span>
        <Lock size={13} className="ml-auto shrink-0 text-slate-600" />
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
    </Link>
  );
}

function SectionHeader({
  label,
  expanded,
  onToggle,
  locked = false,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  locked?: boolean;
}) {
  return (
    <button
      onClick={locked ? undefined : onToggle}
      disabled={locked}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
        locked
          ? "text-slate-600 cursor-not-allowed"
          : "text-slate-400 hover:text-white"
      }`}
      title={locked ? "Sección bloqueada" : undefined}
    >
      {label}
      {locked ? <Lock size={12} /> : expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [session, setSession] = useState(() => getStoredSession());
  const [transporteOpen, setTransporteOpen] = useState(true);
  const [administracionOpen, setAdministracionOpen] = useState(true);
  const [operacionesOpen, setOperacionesOpen] = useState(true);
  const [ventasOpen, setVentasOpen] = useState(true);
  const [finanzasOpen, setFinanzasOpen] = useState(true);
  const [recursosHumanosOpen, setRecursosHumanosOpen] = useState(true);
  const [sistemaOpen, setSistemaOpen] = useState(true);
  const enabledSet = useMemo(() => getAllowedModuleSet(session), [session]);
  const hasEnabledItems = (items: Array<{ href: string }>) => items.some((item) => enabledSet.has(item.href));
  const transporteLocked = !hasEnabledItems(transporteItems);
  const administracionLocked = !hasEnabledItems(administracionItems);
  const operacionesLocked = !hasEnabledItems(operacionesItems);
  const ventasLocked = !hasEnabledItems(ventasItems);
  const finanzasLocked = !hasEnabledItems(finanzasItems);
  const recursosHumanosLocked = !hasEnabledItems(recursosHumanosItems);
  const sistemaLocked = !hasEnabledItems(systemItems);

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(getStoredSession());
    }

    window.addEventListener("duro:session-updated", handleSessionUpdate);
    return () => window.removeEventListener("duro:session-updated", handleSessionUpdate);
  }, []);

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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Transporte"
            expanded={transporteOpen && !transporteLocked}
            locked={transporteLocked}
            onToggle={() => setTransporteOpen((v) => !v)}
          />
        </div>
        {transporteOpen && !transporteLocked &&
          transporteItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Administración"
            expanded={administracionOpen && !administracionLocked}
            locked={administracionLocked}
            onToggle={() => setAdministracionOpen((v) => !v)}
          />
        </div>
        {administracionOpen && !administracionLocked &&
          administracionItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Operaciones"
            expanded={operacionesOpen && !operacionesLocked}
            locked={operacionesLocked}
            onToggle={() => setOperacionesOpen((v) => !v)}
          />
        </div>
        {operacionesOpen && !operacionesLocked &&
          operacionesItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Ventas"
            expanded={ventasOpen && !ventasLocked}
            locked={ventasLocked}
            onToggle={() => setVentasOpen((v) => !v)}
          />
        </div>
        {ventasOpen && !ventasLocked &&
          ventasItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Finanzas"
            expanded={finanzasOpen && !finanzasLocked}
            locked={finanzasLocked}
            onToggle={() => setFinanzasOpen((v) => !v)}
          />
        </div>
        {finanzasOpen && !finanzasLocked &&
          finanzasItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Recursos Humanos"
            expanded={recursosHumanosOpen && !recursosHumanosLocked}
            locked={recursosHumanosLocked}
            onToggle={() => setRecursosHumanosOpen((v) => !v)}
          />
        </div>
        {recursosHumanosOpen && !recursosHumanosLocked &&
          recursosHumanosItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Sistema"
            expanded={sistemaOpen && !sistemaLocked}
            locked={sistemaLocked}
            onToggle={() => setSistemaOpen((v) => !v)}
          />
        </div>
        {sistemaOpen && !sistemaLocked &&
          systemItems.map((item) => (
            <NavLink key={item.href} {...item} enabledSet={enabledSet} onClick={onClose} />
          ))}
      </nav>

      {/* Footer */}
      <div className="space-y-0.5 border-t border-white/10 px-4 py-3">
        <p className="text-xs text-slate-500">v1.0.0 © 2026 Duro Concretos</p>
        <a href="https://lpsoft.mx" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-white transition-colors">By Software and Solutions LP</a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="duro-sidebar hidden min-h-screen w-72 shrink-0 flex-col border-r border-[#1E293B] bg-[#0B1220] lg:flex">
        {content}
      </aside>

      {/* Mobile overlay */}
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
