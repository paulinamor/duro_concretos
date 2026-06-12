"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getAllowedModuleSet, getStoredSession } from "@/lib/auth";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard operativo",
  "/reportes": "Reportes",
  "/perfil": "Mi Perfil",
  "/configuracion": "Configuración",
  "/automatizaciones": "Automatizaciones",
  "/transporte/viajes": "Control de viajes y choferes",
  "/transporte/disponibilidad": "Disponibilidad de cargas",
  "/transporte/pagos": "Pago por viaje / m³",
  "/transporte/diesel": "Consumo de diésel",
  "/transporte/mantenimiento": "Mantenimiento + refacciones",
  "/transporte/seguros": "Seguros de flota",
  "/administracion/viajes-chofer": "Viajes por Chofer",
  "/operaciones/inventario": "Inventarios",
  "/operaciones/efectivo": "Control de efectivo",
  "/operaciones/caja-chica": "Caja Chica",
  "/transporte/operadores": "Operadores",
  "/transporte/unidades": "Unidades · Flota vehicular",
  "/crm/clientes": "Base de clientes",
  "/crm/pipeline": "Pipeline CRM",
  "/crm/seguimiento": "Seguimiento de oportunidades",
  "/crm/clientes-vendedor": "Clientes por vendedor",
  "/ventas/recibos-concreto": "Recibos de concreto",
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
    const session = getStoredSession();
    if (!session) {
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
      return;
    }

    const allowedModules = getAllowedModuleSet(session);
    const isAllowed = pathname === "/perfil" || allowedModules.has(pathname);
    if (isAllowed) return;

    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: {
          type: "error",
          title: "Módulo bloqueado",
          message: "Tu usuario no tiene acceso a este módulo.",
        },
      }),
    );
    router.push("/dashboard");
  }, [pathname, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        <Header title={title} onMobileMenu={() => setSidebarOpen(true)} />
        <main id="duro-module-content" className="min-h-0 flex-1 overflow-y-auto bg-[#1A1A1A] p-3 lg:p-5">
          <div className="w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
