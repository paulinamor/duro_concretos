export type UserRole = "admin" | "operador";

export interface AppUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  modules?: "all" | string[];
  status?: "Activo" | "Inactivo";
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
const USERS_KEY = "duro_concretos_users";

export const moduleCatalog = [
  { href: "/configuracion", label: "Autenticación y roles" },
  { href: "/dashboard", label: "Dashboard operativo" },
  { href: "/reportes", label: "Reportes gerenciales" },
  { href: "/transporte/viajes", label: "Control de viajes y choferes" },
  { href: "/transporte/disponibilidad", label: "Disponibilidad de cargas" },
  { href: "/transporte/pagos", label: "Pago por viaje / m³" },
  { href: "/transporte/diesel", label: "Consumo de diésel" },
  { href: "/transporte/mantenimiento", label: "Mantenimiento + refacciones" },
  { href: "/operaciones/inventario", label: "Inventarios básicos" },
  { href: "/operaciones/efectivo", label: "Control de efectivo" },
  { href: "/crm/pipeline", label: "CRM con pipeline de 5 etapas" },
  { href: "/crm/seguimiento", label: "Seguimiento de clientes y oportunidades" },
  { href: "/crm/clientes-vendedor", label: "Clientes por vendedor" },
];

export const appUsers: AppUser[] = [
  {
    email: "admin@duroconcretos.mx",
    password: "Admin2026!",
    name: "Admin",
    role: "admin",
    modules: "all",
    status: "Activo",
  },
  {
    email: "operador@duroconcretos.mx",
    password: "Operador2026!",
    name: "Operador",
    role: "operador",
    modules: [
      "/configuracion",
      "/dashboard",
      "/reportes",
      "/transporte/viajes",
      "/transporte/disponibilidad",
      "/transporte/diesel",
      "/transporte/mantenimiento",
      "/operaciones/inventario",
      "/operaciones/efectivo",
      "/crm/seguimiento",
      "/crm/clientes-vendedor",
    ],
    status: "Activo",
  },
  {
    email: "paulina.morales@duroconcretos.mx",
    password: "Paulina2026!",
    name: "Paulina Morales",
    role: "admin",
    modules: "all",
    status: "Activo",
  },
];

export const accessProfiles: Record<UserRole, Array<{ module: string; access: "Completo" | "Registro" | "Consulta" | "Bloqueado" }>> = {
  admin: [
    { module: "Autenticación y roles", access: "Completo" },
    { module: "Dashboard operativo", access: "Completo" },
    { module: "Reportes gerenciales", access: "Completo" },
    { module: "Control de viajes y operadores", access: "Completo" },
    { module: "Disponibilidad de cargas", access: "Completo" },
    { module: "Pago por viaje / m³", access: "Completo" },
    { module: "Consumo de diésel", access: "Completo" },
    { module: "Mantenimiento + refacciones", access: "Completo" },
    { module: "Inventarios básicos", access: "Completo" },
    { module: "Control de efectivo", access: "Completo" },
    { module: "CRM con pipeline de 5 etapas", access: "Completo" },
    { module: "Seguimiento de clientes y oportunidades", access: "Completo" },
    { module: "Clientes por vendedor", access: "Completo" },
  ],
  operador: [
    { module: "Autenticación y roles", access: "Consulta" },
    { module: "Dashboard operativo", access: "Consulta" },
    { module: "Reportes gerenciales", access: "Consulta" },
    { module: "Control de viajes y operadores", access: "Registro" },
    { module: "Disponibilidad de cargas", access: "Consulta" },
    { module: "Pago por viaje / m³", access: "Bloqueado" },
    { module: "Consumo de diésel", access: "Registro" },
    { module: "Mantenimiento + refacciones", access: "Registro" },
    { module: "Inventarios básicos", access: "Registro" },
    { module: "Control de efectivo", access: "Registro" },
    { module: "CRM con pipeline de 5 etapas", access: "Bloqueado" },
    { module: "Seguimiento de clientes y oportunidades", access: "Consulta" },
    { module: "Clientes por vendedor", access: "Consulta" },
  ],
};

export function findUserByCredentials(email: string, password: string) {
  return getManagedUsers().find(
    (user) =>
      user.email.toLowerCase() === email.trim().toLowerCase() &&
      user.password === password &&
      (user.status ?? "Activo") === "Activo",
  );
}

export function isRegisteredEmail(email: string) {
  return getManagedUsers().some((user) => user.email.toLowerCase() === email.trim().toLowerCase());
}

export function getStoredSession() {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Pick<AppUser, "email" | "name" | "role" | "modules" | "status">;
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
    }),
  );
  window.dispatchEvent(new CustomEvent("duro:session-updated"));
}

export function getDefaultModulesForRole(role: UserRole) {
  if (role === "admin") return "all" as const;
  return [
    "/configuracion",
    "/dashboard",
    "/reportes",
    "/transporte/viajes",
    "/transporte/disponibilidad",
    "/transporte/diesel",
    "/transporte/mantenimiento",
    "/operaciones/inventario",
    "/operaciones/efectivo",
    "/crm/seguimiento",
    "/crm/clientes-vendedor",
  ];
}

export function getManagedUsers() {
  if (typeof window === "undefined") return appUsers;

  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    saveManagedUsers(appUsers);
    return appUsers;
  }

  try {
    const users = JSON.parse(raw) as AppUser[];
    return users.length > 0 ? users : appUsers;
  } catch {
    localStorage.removeItem(USERS_KEY);
    saveManagedUsers(appUsers);
    return appUsers;
  }
}

export function saveManagedUsers(users: AppUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
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
