"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transporte/viajes": "Viajes y Operadores",
  "/transporte/pagos": "Pago de Operadores",
  "/transporte/diesel": "Control de Diesel",
  "/transporte/mantenimiento": "Mantenimiento",
  "/operaciones/inventario": "Inventario",
  "/operaciones/efectivo": "Control de Efectivo",
  "/operaciones/caja-chica": "Caja Chica",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "ERP Duro Concretos";

  return (
    <div className="flex min-h-screen bg-[#1A1A1A]">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} onMobileMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
