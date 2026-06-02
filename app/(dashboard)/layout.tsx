"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getStoredSession } from "@/lib/auth";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard operativo",
  "/perfil": "Mi Perfil",
  "/configuracion": "Autenticación y roles",
  "/automatizaciones": "Automatizaciones",
  "/transporte/viajes": "Control de viajes y choferes",
  "/transporte/pagos": "Pago por viaje / m³",
  "/transporte/diesel": "Consumo de diésel",
  "/transporte/mantenimiento": "Mantenimiento + refacciones",
  "/administracion/viajes-chofer": "Viajes por Chofer",
  "/operaciones/inventario": "Inventarios básicos",
  "/operaciones/efectivo": "Control de efectivo",
  "/operaciones/caja-chica": "Caja Chica",
  "/crm/pipeline": "CRM con pipeline de 5 etapas",
  "/crm/seguimiento": "Seguimiento de clientes y oportunidades",
  "/ventas/horas-llegada-salida": "Horas de Llegada y Salida",
  "/finanzas/cxc": "Cuentas por Cobrar",
  "/finanzas/cxp": "Cuentas por Pagar",
  "/finanzas/estado-cuenta-clientes": "Estados de Cuenta",
  "/recursos-humanos/nomina": "Recursos Humanos",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] ?? "ERP Duro Concretos";

  useEffect(() => {
    if (getStoredSession()) return;

    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: {
          type: "error",
          title: "Sesión requerida",
          message: "Inicia sesión con un usuario autorizado para entrar al ERP.",
        },
      }),
    );
    router.push("/");
  }, [router]);

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
