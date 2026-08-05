"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Construction, FlaskConical, ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DevToolsOverlay from "@/components/DevToolsOverlay";
import {
  getAllowedModuleSet,
  getStoredSession,
  moduleCatalog,
  DEV_ONLY_ROUTES,
  DEVELOPER_EMAIL,
} from "@/lib/auth";
import {
  loadModuleStatuses,
  MODULE_STATUS_DEFAULTS,
  ModuleStatus,
} from "@/lib/moduleStatus";

const pageTitles: Record<string, string> = {
  "/dashboard":                        "Dashboard",
  "/reportes":                         "Reportes",
  "/perfil":                           "Mi Perfil",
  "/configuracion":                    "Configuración",
  "/transporte/programacion":          "Programación",
  "/transporte/diesel":                "Consumo de Diésel",
  "/transporte/mantenimiento":         "Mantenimiento de Flota",
  "/transporte/seguros":               "Seguro de Flota",
  "/operaciones/inventario":           "Inventarios",
  "/efectivo":                         "Control de efectivo",
  "/transporte/operadores":            "Empleados",
  "/transporte/unidades":              "Flota vehicular",
  "/crm/clientes":                     "Base de Clientes",
  "/crm/pipeline":                     "Pipeline CRM",
  "/ventas/programacion":              "Programación Ventas",
  "/ventas/recibos-concreto":          "Recibos de Concreto",
  "/finanzas/cxc":                     "Cuentas por Cobrar",
  "/finanzas/cxp":                     "Cuentas por Pagar",
  "/finanzas/estado-cuenta-clientes":  "Estados de Cuenta",
  "/recursos-humanos/nomina":          "Nómina",
  "/facturacion":                      "Facturación",
};

const pageSections: Record<string, string> = {
  "/dashboard":                        "Inicio",
  "/reportes":                         "Reportes",
  "/perfil":                           "Sistema",
  "/configuracion":                    "Sistema",
  "/transporte/programacion":          "Transporte",
  "/transporte/diesel":                "Transporte",
  "/transporte/mantenimiento":         "Transporte",
  "/transporte/seguros":               "Transporte",
  "/transporte/operadores":            "Recursos Humanos",
  "/transporte/unidades":              "Transporte",
  "/operaciones/inventario":           "Operación",
  "/efectivo":                         "Operación",
  "/crm/clientes":                     "CRM",
  "/crm/pipeline":                     "CRM",
  "/ventas/programacion":              "Ventas",
  "/ventas/recibos-concreto":          "Ventas",
  "/finanzas/cxc":                     "Finanzas",
  "/finanzas/cxp":                     "Finanzas",
  "/finanzas/estado-cuenta-clientes":  "Finanzas",
  "/recursos-humanos/nomina":          "Recursos Humanos",
  "/facturacion":                      "Facturación",
};

// ─── Pantalla de módulo bloqueado por estado ──────────────────────────────────

const STATUS_SCREEN: Record<"dev" | "wip", {
  icon:    React.ElementType;
  color:   string;
  badge:   string;
  badgeCls: string;
  title:   string;
  body:    string;
}> = {
  dev: {
    icon:     FlaskConical,
    color:    "text-amber-400",
    badge:    "DEV",
    badgeCls: "bg-amber-400/10 border-amber-400/30 text-amber-400",
    title:    "Módulo en desarrollo",
    body:     "Este módulo aún está siendo construido. Cuando esté listo aparecerá disponible para todos los usuarios.",
  },
  wip: {
    icon:     Construction,
    color:    "text-orange-400",
    badge:    "WIP",
    badgeCls: "bg-orange-400/10 border-orange-400/30 text-orange-400",
    title:    "Cargando datos",
    body:     "Este módulo está en configuración. El equipo está preparando la información para que puedas usarlo pronto.",
  },
};

function ModuleBlockedScreen({
  status,
  title,
  onBack,
}: {
  status: "dev" | "wip";
  title:  string;
  onBack: () => void;
}) {
  const cfg  = STATUS_SCREEN[status];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6 select-none">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${
        status === "dev" ? "bg-amber-400/10" : "bg-orange-400/10"
      }`}>
        <Icon size={36} className={cfg.color} />
      </div>

      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-4 ${cfg.badgeCls}`}>
        {cfg.badge}
      </span>

      <h2 className="text-white font-bold text-xl mb-2">{cfg.title}</h2>
      <p className="text-gray-500 text-sm max-w-sm mb-1">{cfg.body}</p>
      <p className="text-gray-600 text-xs mb-8">
        Módulo: <span className="font-mono text-gray-500">{title}</span>
      </p>

      <button
        onClick={onBack}
        className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Volver al inicio
      </button>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [statuses, setStatuses]         = useState<Record<string, ModuleStatus>>(MODULE_STATUS_DEFAULTS);
  const [session, setSession]           = useState<ReturnType<typeof getStoredSession>>(null);
  const pathname = usePathname();
  const router   = useRouter();

  const title   = pageTitles[pathname]   ?? "ERP Duro Concretos";
  const section = pageSections[pathname] ?? "";

  // Carga inicial — en useEffect para evitar hydration mismatch con localStorage
  useEffect(() => {
    setSession(getStoredSession());
    loadModuleStatuses().then(setStatuses);
  }, []);

  // Drag-to-scroll en tablas horizontales (comportamiento tipo Excel)
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
      startX = e.clientX; startLeft = el.scrollLeft;
    }
    function onMove(e: MouseEvent) {
      if (!down || !el) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true; el.scrollLeft = startLeft - dx; el.style.cursor = "grabbing";
    }
    function onUp() {
      if (!el) return;
      el.style.cursor = ""; down = false; el = null;
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
      window.dispatchEvent(new CustomEvent("duro:toast", {
        detail: { type: "error", title: "Sesión requerida", message: "Inicia sesión con un usuario autorizado para entrar al ERP." },
      }));
      router.push("/");
      return;
    }

    if (DEV_ONLY_ROUTES.has(pathname)) {
      if (session.role !== "admin") router.push("/dashboard");
      return;
    }

    const allowedModules = getAllowedModuleSet(session);
    const isAllowed = pathname === "/perfil" || pathname === "/finanzas/migrar-fechas" || allowedModules.has(pathname);
    if (isAllowed) return;

    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type: "error", title: "Módulo bloqueado", message: "Tu usuario no tiene acceso a este módulo." },
    }));
    const first = moduleCatalog.find((m) => allowedModules.has(m.href));
    router.push(first?.href ?? "/");
  }, [pathname, router]);

  // Determina si el módulo actual está bloqueado por su estado
  const isDeveloper   = session?.email === DEVELOPER_EMAIL;
  const moduleStatus  = statuses[pathname] as ModuleStatus | undefined;
  const isStatusBlocked = !isDeveloper && (moduleStatus === "dev" || moduleStatus === "wip");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        <DevToolsOverlay />
        <Header title={title} section={section} onMobileMenu={() => setSidebarOpen(true)} />
        <main id="duro-module-content" className="min-h-0 flex-1 overflow-y-auto bg-[#1A1A1A] p-3 lg:p-5">
          <div className="w-full min-w-0">
            {isStatusBlocked ? (
              <ModuleBlockedScreen
                status={moduleStatus as "dev" | "wip"}
                title={title}
                onBack={() => router.push("/dashboard")}
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
