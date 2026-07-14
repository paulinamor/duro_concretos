"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getAllowedModuleSet, getStoredSession } from "@/lib/auth";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/reportes": "Reportes",
  "/perfil": "Mi Perfil",
  "/configuracion": "Configuración",
  "/transporte/programacion": "Programación",
  "/transporte/diesel": "Consumo de Diésel",
  "/transporte/mantenimiento": "Mantenimiento de Flota",
  "/transporte/seguros": "Seguro de Flota",
  "/operaciones/inventario": "Inventarios",
  "/efectivo": "Control de efectivo",
  "/transporte/operadores": "Empleados",
  "/transporte/unidades": "Flota vehicular",
  "/crm/clientes": "Base de Clientes",
  "/crm/pipeline": "Pipeline CRM",
  "/ventas/recibos-concreto": "Recibos de Concreto",
  "/finanzas/cxc": "Cuentas por Cobrar",
  "/finanzas/cxp": "Cuentas por Pagar",
  "/finanzas/estado-cuenta-clientes": "Estados de Cuenta",
};

const pageSections: Record<string, string> = {
  "/dashboard": "Inicio",
  "/reportes": "Reportes",
  "/perfil": "Sistema",
  "/configuracion": "Sistema",
  "/transporte/programacion": "Transporte",
  "/transporte/diesel": "Transporte",
  "/transporte/mantenimiento": "Transporte",
  "/transporte/seguros": "Transporte",
  "/transporte/operadores": "Recursos Humanos",
  "/transporte/unidades": "Transporte",
  "/operaciones/inventario": "Operación",
  "/efectivo": "Operación",
  "/crm/clientes": "CRM",
  "/crm/pipeline": "CRM",
  "/ventas/recibos-concreto": "Ventas",
  "/finanzas/cxc": "Finanzas",
  "/finanzas/cxp": "Finanzas",
  "/finanzas/estado-cuenta-clientes": "Finanzas",
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
  const section = pageSections[pathname] ?? "";

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
        <Header title={title} section={section} onMobileMenu={() => setSidebarOpen(true)} />
        <main id="duro-module-content" className="min-h-0 flex-1 overflow-y-auto bg-[#1A1A1A] p-3 lg:p-5">
          <div className="w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
