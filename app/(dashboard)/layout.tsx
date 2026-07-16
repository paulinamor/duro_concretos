"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getAllowedModuleSet, getStoredSession, moduleCatalog } from "@/lib/auth";

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

  // Drag-to-scroll on all overflow-x containers (like Excel/Sheets)
  useEffect(() => {
    let down = false, startX = 0, startLeft = 0, moved = false;
    let el: HTMLElement | null = null;

    function findHScroll(t: HTMLElement | null): HTMLElement | null {
      while (t && t !== document.body) {
        const ox = getComputedStyle(t).overflowX;
        if ((ox === "auto" || ox === "scroll") && t.scrollWidth > t.clientWidth + 1) return t;
        t = t.parentElement;
      }
      return null;
    }

    function onDown(e: MouseEvent) {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("button,input,select,textarea,a,[role=button],[data-nodrag]")) return;
      el = findHScroll(t);
      if (!el) return;
      down = true; moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    }
    function onMove(e: MouseEvent) {
      if (!down || !el) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true;
      el.scrollLeft = startLeft - dx;
      el.style.cursor = "grabbing";
    }
    function onUp() {
      if (!el) return;
      el.style.cursor = "";
      down = false; el = null;
    }
    function onClick(e: MouseEvent) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }

    document.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      window.dispatchEvent(
        new CustomEvent("duro:toast", {
          detail: { type: "error", title: "Sesión requerida", message: "Inicia sesión con un usuario autorizado para entrar al ERP." },
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
        detail: { type: "error", title: "Módulo bloqueado", message: "Tu usuario no tiene acceso a este módulo." },
      }),
    );
    const first = moduleCatalog.find((m) => allowedModules.has(m.href));
    router.push(first?.href ?? "/");
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
