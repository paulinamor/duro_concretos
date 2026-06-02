export type UserRole = "admin" | "operador";

export interface AppUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
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

export const appUsers: AppUser[] = [
  {
    email: "admin@duroconcretos.mx",
    password: "Admin2026!",
    name: "Admin",
    role: "admin",
  },
  {
    email: "operador@duroconcretos.mx",
    password: "Operador2026!",
    name: "Operador",
    role: "operador",
  },
];

export const accessProfiles: Record<UserRole, Array<{ module: string; access: "Completo" | "Registro" | "Consulta" | "Bloqueado" }>> = {
  admin: [
    { module: "Autenticación y roles", access: "Completo" },
    { module: "Dashboard operativo", access: "Completo" },
    { module: "Control de viajes y operadores", access: "Completo" },
    { module: "Pago por viaje / m³", access: "Completo" },
    { module: "Consumo de diésel", access: "Completo" },
    { module: "Mantenimiento + refacciones", access: "Completo" },
    { module: "Inventarios básicos", access: "Completo" },
    { module: "Control de efectivo", access: "Completo" },
    { module: "CRM con pipeline de 5 etapas", access: "Completo" },
    { module: "Seguimiento de clientes y oportunidades", access: "Completo" },
  ],
  operador: [
    { module: "Autenticación y roles", access: "Consulta" },
    { module: "Dashboard operativo", access: "Consulta" },
    { module: "Control de viajes y operadores", access: "Registro" },
    { module: "Pago por viaje / m³", access: "Bloqueado" },
    { module: "Consumo de diésel", access: "Registro" },
    { module: "Mantenimiento + refacciones", access: "Registro" },
    { module: "Inventarios básicos", access: "Registro" },
    { module: "Control de efectivo", access: "Registro" },
    { module: "CRM con pipeline de 5 etapas", access: "Bloqueado" },
    { module: "Seguimiento de clientes y oportunidades", access: "Consulta" },
  ],
};

export function findUserByCredentials(email: string, password: string) {
  return appUsers.find(
    (user) =>
      user.email.toLowerCase() === email.trim().toLowerCase() &&
      user.password === password,
  );
}

export function isRegisteredEmail(email: string) {
  return appUsers.some((user) => user.email.toLowerCase() === email.trim().toLowerCase());
}

export function getStoredSession() {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Pick<AppUser, "email" | "name" | "role">;
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
    }),
  );
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
