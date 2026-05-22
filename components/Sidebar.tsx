"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  DollarSign,
  Fuel,
  Wrench,
  Package,
  Banknote,
  Wallet,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
];

const transporteItems = [
  { href: "/transporte/viajes", icon: Truck, label: "Viajes y Operadores" },
  { href: "/transporte/pagos", icon: DollarSign, label: "Pago Operadores" },
  { href: "/transporte/diesel", icon: Fuel, label: "Diesel" },
  { href: "/transporte/mantenimiento", icon: Wrench, label: "Mantenimiento" },
];

const operacionesItems = [
  { href: "/operaciones/inventario", icon: Package, label: "Inventario" },
  { href: "/operaciones/efectivo", icon: Banknote, label: "Control de Efectivo" },
  { href: "/operaciones/caja-chica", icon: Wallet, label: "Caja Chica" },
];

function NavLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

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
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest hover:text-gray-400 transition-colors"
    >
      {label}
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
    </button>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [transporteOpen, setTransporteOpen] = useState(true);
  const [operacionesOpen, setOperacionesOpen] = useState(true);

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
          <NavLink key={item.href} {...item} onClick={onClose} />
        ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Transporte"
            expanded={transporteOpen}
            onToggle={() => setTransporteOpen((v) => !v)}
          />
        </div>
        {transporteOpen &&
          transporteItems.map((item) => (
            <NavLink key={item.href} {...item} onClick={onClose} />
          ))}

        <div className="pt-4 pb-1">
          <SectionHeader
            label="Operaciones"
            expanded={operacionesOpen}
            onToggle={() => setOperacionesOpen((v) => !v)}
          />
        </div>
        {operacionesOpen &&
          operacionesItems.map((item) => (
            <NavLink key={item.href} {...item} onClick={onClose} />
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
