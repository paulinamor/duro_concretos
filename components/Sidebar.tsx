"use client";

import { useMemo, useState } from "react";
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
  Banknote,
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
} from "lucide-react";
import { getStoredSession } from "@/lib/auth";

const enabledModules = new Set([
  "/configuracion",
  "/dashboard",
  "/transporte/viajes",
  "/transporte/pagos",
  "/transporte/diesel",
  "/transporte/mantenimiento",
  "/operaciones/inventario",
  "/operaciones/efectivo",
  "/crm/pipeline",
  "/crm/seguimiento",
]);

const operatorModules = new Set([
  "/configuracion",
  "/dashboard",
  "/transporte/viajes",
  "/transporte/diesel",
  "/transporte/mantenimiento",
  "/operaciones/inventario",
  "/operaciones/efectivo",
  "/crm/seguimiento",
]);

const navItems = [
  {
    href: "/configuracion",
    icon: ShieldCheck,
    label: "Autenticación y roles",
  },
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard operativo",
  },
  {
    href: "/automatizaciones",
    icon: Bot,
    label: "Automatizaciones",
  },
];

const administracionItems = [
  { href: "/administracion/viajes-chofer", icon: UsersRound, label: "Viajes por Chofer" },
];

const transporteItems = [
  { href: "/transporte/viajes", icon: Truck, label: "Control de viajes y choferes" },
  { href: "/transporte/pagos", icon: DollarSign, label: "Pago por viaje / m³" },
  { href: "/transporte/diesel", icon: Fuel, label: "Consumo de diésel" },
  { href: "/transporte/mantenimiento", icon: Wrench, label: "Mantenimiento + refacciones" },
];

const operacionesItems = [
  { href: "/operaciones/inventario", icon: Package, label: "Inventarios básicos" },
  { href: "/operaciones/efectivo", icon: Banknote, label: "Control de efectivo" },
  { href: "/operaciones/caja-chica", icon: Wallet, label: "Caja Chica" },
];

const ventasItems = [
  { href: "/crm/pipeline", icon: ChartNoAxesColumn, label: "CRM con pipeline de 5 etapas" },
  { href: "/crm/seguimiento", icon: UsersRound, label: "Seguimiento de clientes y oportunidades" },
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
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 border-l-2 border-transparent cursor-not-allowed select-none opacity-60"
        aria-disabled="true"
        title="Módulo bloqueado"
      >
        <Icon size={18} className="text-gray-600" />
        <span className="truncate">{label}</span>
        <Lock size={13} className="ml-auto shrink-0 text-gray-600" />
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
        isActive
          ? "bg-[#CC2229]/15 text-[#CC2229] border-l-2 border-[#CC2229] pl-2.5"
          : "text-gray-400 hover:bg-[#1A1A1A] hover:text-white border-l-2 border-transparent"
      }`}
    >
      <Icon size={18} className={isActive ? "text-[#CC2229]" : "text-gray-500 group-hover:text-gray-300"} />
      <span className="truncate">{label}</span>
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
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
        locked
          ? "text-gray-600 cursor-not-allowed opacity-60"
          : "text-gray-500 hover:text-gray-400"
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
  const [role] = useState(() => getStoredSession()?.role ?? "admin");
  const [transporteOpen, setTransporteOpen] = useState(true);
  const [administracionOpen, setAdministracionOpen] = useState(true);
  const [operacionesOpen, setOperacionesOpen] = useState(true);
  const [ventasOpen, setVentasOpen] = useState(true);
  const [finanzasOpen, setFinanzasOpen] = useState(true);
  const [recursosHumanosOpen, setRecursosHumanosOpen] = useState(true);
  const enabledSet = useMemo(() => (role === "operador" ? operatorModules : enabledModules), [role]);
  const hasEnabledItems = (items: Array<{ href: string }>) => items.some((item) => enabledSet.has(item.href));
  const transporteLocked = !hasEnabledItems(transporteItems);
  const administracionLocked = !hasEnabledItems(administracionItems);
  const operacionesLocked = !hasEnabledItems(operacionesItems);
  const ventasLocked = !hasEnabledItems(ventasItems);
  const finanzasLocked = !hasEnabledItems(finanzasItems);
  const recursosHumanosLocked = !hasEnabledItems(recursosHumanosItems);

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#3A3A3A]">
        <div className="relative h-10 w-32">
          <Image
            src="/LOGO_DC.png"
            alt="Duro Concretos"
            fill
            style={{ objectFit: "contain", objectPosition: "left" }}
          />
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white lg:hidden">
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#3A3A3A] space-y-0.5">
        <p className="text-xs text-gray-600">v1.0.0 © 2026 Duro Concretos</p>
        <a href="https://lpsoft.mx" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-700 hover:text-[#CC2229] transition-colors">By Software and Solutions LP</a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#242424] border-r border-[#3A3A3A] min-h-screen shrink-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={onClose} />
          <aside className="relative flex flex-col w-56 bg-[#242424] border-r border-[#3A3A3A] min-h-screen">
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
      className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
    >
      <Menu size={22} />
    </button>
  );
}
