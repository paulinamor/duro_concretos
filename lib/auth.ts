export type UserRole = "admin" | "operador";
export type Planta = "Pesquería" | "Allende" | "Todas";

export interface AppUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  modules?: "all" | string[];
  status?: "Activo" | "Inactivo";
  planta?: Planta;
}

export type AuthEventType = "login_success" | "login_failed" | "password_recovery" | "role_update";

export interface AuthEvent {
  id: string;
  type: AuthEventType;
  email: string;
  message: string;
  createdAt: string;
}

const SESSION_KEY = "duro_concretos_session";
const AUTH_EVENTS_KEY = "duro_concretos_auth_events";

export const moduleCatalog = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reportes", label: "Reportes gerenciales" },
  { href: "/transporte/programacion", label: "Programación" },
  { href: "/transporte/operadores", label: "Empleados" },
  { href: "/transporte/unidades", label: "Unidades / Flota" },
  { href: "/transporte/diesel", label: "Consumo de Diésel" },
  { href: "/transporte/mantenimiento", label: "Mantenimiento de Flota" },
  { href: "/transporte/seguros", label: "Seguro de Flota" },
  { href: "/operaciones/inventario", label: "Inventarios" },
  { href: "/efectivo", label: "Control de efectivo" },
  { href: "/crm/clientes", label: "Base de Clientes" },
  { href: "/crm/pipeline", label: "Pipeline CRM" },
  { href: "/ventas/recibos-concreto", label: "Recibos de Concreto" },
  { href: "/finanzas/cxc", label: "Cuentas por Cobrar" },
  { href: "/finanzas/cxp", label: "Cuentas por Pagar" },
  { href: "/finanzas/estado-cuenta-clientes", label: "Estados de Cuenta" },
  { href: "/configuracion", label: "Autenticación y roles" },
];

export const accessProfiles: Record<UserRole, Array<{ module: string; access: "Completo" | "Registro" | "Consulta" | "Bloqueado" }>> = {
  admin: [
    { module: "Autenticación y roles", access: "Completo" },
    { module: "Dashboard", access:"Completo" },
    { module: "Reportes gerenciales", access: "Completo" },
    { module: "Control de viajes y operadores", access: "Completo" },
    { module: "Disponibilidad de cargas", access: "Completo" },
    { module: "Pago por viaje / m³", access: "Completo" },
    { module: "Consumo de Diésel", access: "Completo" },
    { module: "Mantenimiento + refacciones", access: "Completo" },
    { module: "Inventarios", access: "Completo" },
    { module: "Control de efectivo", access: "Completo" },
    { module: "CRM", access: "Completo" },
    { module: "Seguimiento de clientes y oportunidades", access: "Completo" },
    { module: "Clientes por vendedor", access: "Completo" },
    { module: "Recibos de Concreto", access: "Completo" },
  ],
  operador: [
    { module: "Autenticación y roles", access: "Consulta" },
    { module: "Dashboard", access:"Consulta" },
    { module: "Reportes gerenciales", access: "Consulta" },
    { module: "Control de viajes y operadores", access: "Registro" },
    { module: "Disponibilidad de cargas", access: "Consulta" },
    { module: "Pago por viaje / m³", access: "Bloqueado" },
    { module: "Consumo de Diésel", access: "Registro" },
    { module: "Mantenimiento + refacciones", access: "Registro" },
    { module: "Inventarios", access: "Registro" },
    { module: "Control de efectivo", access: "Registro" },
    { module: "CRM", access: "Bloqueado" },
    { module: "Seguimiento de clientes y oportunidades", access: "Consulta" },
    { module: "Clientes por vendedor", access: "Consulta" },
    { module: "Recibos de Concreto", access: "Registro" },
  ],
};

export function getStoredSession() {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Pick<AppUser, "email" | "name" | "role" | "modules" | "status" | "planta"> & { plantaActiva?: Planta };
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(user: AppUser) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role,
      modules: user.modules ?? getDefaultModulesForRole(user.role),
      status: user.status ?? "Activo",
      planta: user.planta ?? "Todas",
    }),
  );
  window.dispatchEvent(new CustomEvent("duro:session-updated"));
}

export function setActivePlanta(planta: Planta) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const session = JSON.parse(raw);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, plantaActiva: planta }));
    window.dispatchEvent(new CustomEvent("duro:session-updated"));
  } catch {
    // ignore
  }
}

export function getActivePlanta(): Planta {
  const session = getStoredSession();
  if (!session) return "Todas";
  return session.plantaActiva ?? session.planta ?? "Todas";
}

/** Records with no planta, empty string, or "Todas" are legacy Allende data. */
function isLegacyAllende(planta?: string) {
  return !planta || planta === "Todas";
}

export function filterByPlanta<T extends { planta?: string }>(docs: T[]): T[] {
  const active = getActivePlanta();
  if (active === "Todas") return docs;
  if (active === "Allende") return docs.filter((doc) => isLegacyAllende(doc.planta) || doc.planta === "Allende");
  return docs.filter((doc) => doc.planta === active); // Pesquería: exact match only
}

/** Returns the concrete plant for a new record — never "Todas". */
export function getCapturePlanta(): "Allende" | "Pesquería" {
  const session = getStoredSession();
  if (session?.planta && session.planta !== "Todas") return session.planta;
  const active = getActivePlanta();
  return active === "Todas" ? "Allende" : active;
}

export function withPlantaTag<T extends object>(data: T): T & { planta: string } {
  const active = getActivePlanta();
  if (active === "Todas") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("duro:toast", {
          detail: {
            type: "error",
            title: "Planta requerida",
            message: "Selecciona Allende o Pesquería en el selector antes de capturar datos.",
          },
        }),
      );
    }
    throw Object.assign(new Error("Selecciona una planta específica antes de guardar."), {
      code: "PLANTA_REQUERIDA",
    });
  }
  return { ...data, planta: getCapturePlanta() };
}

export function getDefaultModulesForRole(role: UserRole) {
  if (role === "admin") return "all" as const;
  return [
    "/dashboard",
    "/reportes",
    "/transporte/programacion",
    "/transporte/operadores",
    "/transporte/diesel",
    "/transporte/mantenimiento",
    "/transporte/seguros",
    "/operaciones/inventario",
    "/efectivo",
    "/ventas/recibos-concreto",
    "/finanzas/cxc",
    "/finanzas/cxp",
    "/finanzas/estado-cuenta-clientes",
    "/configuracion",
  ];
}

export function getAllowedModuleSet(user: Pick<AppUser, "role" | "modules"> | null) {
  const modules = user?.modules ?? getDefaultModulesForRole(user?.role ?? "admin");
  if (modules === "all") return new Set(moduleCatalog.map((module) => module.href));
  return new Set(modules);
}

export function getAuthEvents() {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(AUTH_EVENTS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as AuthEvent[];
  } catch {
    localStorage.removeItem(AUTH_EVENTS_KEY);
    return [];
  }
}

export function recordAuthEvent(event: Omit<AuthEvent, "id" | "createdAt">) {
  if (typeof window === "undefined") return;

  const nextEvent: AuthEvent = {
    ...event,
    id: `${Date.now()}-${event.type}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_EVENTS_KEY, JSON.stringify([nextEvent, ...getAuthEvents()].slice(0, 10)));
}
