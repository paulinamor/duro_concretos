"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Database, Settings, ShieldCheck } from "lucide-react";
import FormModal from "@/components/FormModal";
import StatusBadge from "@/components/StatusBadge";
import {
  accessProfiles,
  appUsers,
  getAuthEvents,
  getStoredSession,
  recordAuthEvent,
  saveSession,
  type AuthEvent,
  type UserRole,
} from "@/lib/auth";

type ConfigSection = "Notificaciones" | "Seguridad" | "Datos de empresa" | "Preferencias";

type ConfigState = {
  notifications: {
    cajaChica: string;
    mantenimiento: string;
    cxc: string;
    automatizaciones: string;
  };
  security: {
    activeUser: string;
    role: "Admin" | "Operador";
    loginSeguro: string;
    passwordRecovery: string;
    sessionPolicy: string;
  };
  company: {
    razonSocial: string;
    rfc: string;
    moneda: string;
    fiscal: string;
  };
  preferences: {
    tema: string;
    modulos: string;
    vista: string;
    densidad: string;
  };
  audit: string[];
};

const STORAGE_KEY = "duro_concretos_configuracion";

const defaultConfig: ConfigState = {
  notifications: {
    cajaChica: "Activa",
    mantenimiento: "Activa",
    cxc: "Activa",
    automatizaciones: "Activa",
  },
  security: {
    activeUser: "admin@duroconcretos.mx",
    role: "Admin",
    loginSeguro: "Activo",
    passwordRecovery: "Activa",
    sessionPolicy: "Expira al cerrar sesión",
  },
  company: {
    razonSocial: "Duro Concretos S.A. de C.V.",
    rfc: "DUC000000XXX",
    moneda: "MXN",
    fiscal: "CFDI México",
  },
  preferences: {
    tema: "Oscuro",
    modulos: "Solo módulos aprobados",
    vista: "Dashboard operativo",
    densidad: "Compacta",
  },
  audit: ["Configuración inicial aprobada"],
};

const configItems: Array<{
  title: ConfigSection;
  icon: React.ElementType;
  description: string;
}> = [
  { title: "Notificaciones", icon: Bell, description: "Alertas de caja chica, mantenimiento, CxC y automatizaciones." },
  { title: "Seguridad", icon: ShieldCheck, description: "Permisos, sesión activa y políticas de acceso." },
  { title: "Datos de empresa", icon: Database, description: "RFC, razón social, moneda y configuración fiscal." },
  { title: "Preferencias", icon: Settings, description: "Tema, módulos visibles y configuración operativa." },
];

function loadConfig() {
  if (typeof window === "undefined") return defaultConfig;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultConfig;

  try {
    return { ...defaultConfig, ...JSON.parse(raw) } as ConfigState;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return defaultConfig;
  }
}

function applySessionToConfig(config: ConfigState) {
  const currentSession = getStoredSession();
  if (!currentSession) return config;

  const role: ConfigState["security"]["role"] = currentSession.role === "operador" ? "Operador" : "Admin";

  return {
    ...config,
    security: {
      ...config.security,
      activeUser: currentSession.email,
      role,
    },
  };
}

function persistConfig(config: ConfigState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(
    new CustomEvent("duro:theme-change", {
      detail: { theme: config.preferences.tema },
    }),
  );
}

function normalizedRole(role: string): UserRole {
  return role.toLowerCase() === "operador" ? "operador" : "admin";
}

export default function ConfiguracionPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection | null>(null);
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [config, setConfig] = useState(defaultConfig);
  const [authEvents, setAuthEvents] = useState<AuthEvent[]>([]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const loadedConfig = applySessionToConfig(loadConfig());
      setSession(getStoredSession());
      setConfig(loadedConfig);
      setAuthEvents(getAuthEvents());
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const activeSecurityCount = [
    config.security.loginSeguro,
    config.security.role,
    config.security.passwordRecovery,
  ].filter((value) => value !== "Inactivo" && value !== "Inactiva").length;

  const mainStatus = activeSecurityCount === 3 ? "Aprobado" : "Revisión";
  const activeRole = config.security.role === "Operador" ? "operador" : "admin";
  const visibleAccessProfile = accessProfiles[activeRole];
  const allowedModules = visibleAccessProfile.filter((item) => item.access !== "Bloqueado").length;
  const blockedModules = visibleAccessProfile.length - allowedModules;
  const failedLoginCount = authEvents.filter((event) => event.type === "login_failed").length;

  function updateConfig(nextConfig: ConfigState) {
    setConfig(nextConfig);
    persistConfig(nextConfig);
  }

  function addAudit(current: ConfigState, message: string) {
    return [message, ...current.audit].slice(0, 5);
  }

  function handleSave(values: Record<string, string>) {
    const stamp = new Date().toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (activeSection === "Notificaciones") {
      const next = {
        ...config,
        notifications: {
          cajaChica: values["Caja chica"],
          mantenimiento: values["Mantenimiento"],
          cxc: values["CxC"],
          automatizaciones: values["Automatizaciones"],
        },
      };
      updateConfig({ ...next, audit: addAudit(next, `Notificaciones actualizadas - ${stamp}`) });
      return;
    }

    if (activeSection === "Seguridad") {
      const selectedUser = appUsers.find((user) => user.email === values["Usuario activo"]);
      if (!selectedUser) return "Selecciona un usuario registrado.";

      const role = normalizedRole(values["Rol"]);
      const selectedRole: ConfigState["security"]["role"] = role === "operador" ? "Operador" : "Admin";
      const next = {
        ...config,
        security: {
          activeUser: selectedUser.email,
          role: selectedRole,
          loginSeguro: values["Login seguro"],
          passwordRecovery: values["Recuperación de contraseña"],
          sessionPolicy: values["Política de sesión"],
        },
      };

      const updatedUser = { ...selectedUser, role };
      saveSession(updatedUser);
      recordAuthEvent({
        type: "role_update",
        email: selectedUser.email,
        message: `Rol actualizado a ${selectedRole}.`,
      });
      setSession(getStoredSession());
      setAuthEvents(getAuthEvents());
      updateConfig({ ...next, audit: addAudit(next, `Seguridad actualizada para ${selectedUser.name} - ${stamp}`) });
      return;
    }

    if (activeSection === "Datos de empresa") {
      const next = {
        ...config,
        company: {
          razonSocial: values["Razón social"],
          rfc: values["RFC"],
          moneda: values["Moneda"],
          fiscal: values["Configuración fiscal"],
        },
      };
      updateConfig({ ...next, audit: addAudit(next, `Datos de empresa actualizados - ${stamp}`) });
      return;
    }

    const next = {
      ...config,
      preferences: {
        tema: values["Tema"],
        modulos: values["Módulos visibles"],
        vista: values["Vista inicial"],
        densidad: values["Densidad"],
      },
    };
    updateConfig({ ...next, audit: addAudit(next, `Preferencias actualizadas - ${stamp}`) });
  }

  function renderModalContent() {
    if (activeSection === "Notificaciones") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            ["Caja chica", config.notifications.cajaChica],
            ["Mantenimiento", config.notifications.mantenimiento],
            ["CxC", config.notifications.cxc],
            ["Automatizaciones", config.notifications.automatizaciones],
          ].map(([label, value]) => (
            <div key={label}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <select defaultValue={value} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Activa</option>
                <option>Pausada</option>
              </select>
            </div>
          ))}
        </div>
      );
    }

    if (activeSection === "Seguridad") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Usuario activo</label>
            <select defaultValue={config.security.activeUser} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {appUsers.map((user) => <option key={user.email}>{user.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rol</label>
            <select defaultValue={config.security.role} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Admin</option>
              <option>Operador</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Login seguro</label>
            <select defaultValue={config.security.loginSeguro} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Recuperación de contraseña</label>
            <select defaultValue={config.security.passwordRecovery} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Activa</option>
              <option>Inactiva</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-400 mb-1">Política de sesión</label>
            <select defaultValue={config.security.sessionPolicy} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Expira al cerrar sesión</option>
              <option>Expira cada 8 horas</option>
              <option>Requiere revisión manual</option>
            </select>
          </div>
        </div>
      );
    }

    if (activeSection === "Datos de empresa") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Razón social</label>
            <select defaultValue={config.company.razonSocial} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>Duro Concretos S.A. de C.V.</option>
              <option>Duro Concretos Planta Allende</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">RFC</label>
            <select defaultValue={config.company.rfc} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>DUC000000XXX</option>
              <option>DCA260101XXX</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Moneda</label>
            <select defaultValue={config.company.moneda} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>MXN</option>
              <option>USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Configuración fiscal</label>
            <select defaultValue={config.company.fiscal} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              <option>CFDI México</option>
              <option>SAT pendiente</option>
            </select>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tema</label>
          <select defaultValue={config.preferences.tema} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
            <option>Oscuro</option>
            <option>Claro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Módulos visibles</label>
          <select defaultValue={config.preferences.modulos} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
            <option>Solo módulos aprobados</option>
            <option>Todos los módulos</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Vista inicial</label>
          <select defaultValue={config.preferences.vista} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
            <option>Dashboard operativo</option>
            <option>Control de viajes y operadores</option>
            <option>CRM con pipeline de 5 etapas</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Densidad</label>
          <select defaultValue={config.preferences.densidad} className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
            <option>Compacta</option>
            <option>Cómoda</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Autenticación y roles</h1>
        <p className="text-gray-500 text-sm mt-0.5">Login seguro, roles admin/operador y recuperación de contraseña.</p>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold">Seguridad y autenticación</h3>
            <p className="text-xs text-gray-500 mt-0.5">Control de acceso del ERP para {session?.name ?? "usuario activo"}</p>
          </div>
          <StatusBadge status={mainStatus} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#3A3A3A]">
          {[
            { label: "Login seguro", detail: "Valida correo y contraseña antes de entrar", status: config.security.loginSeguro },
            { label: "Roles admin/operador", detail: `${config.security.role} con permisos aplicados`, status: "Activo" },
            { label: "Recuperación de contraseña", detail: "Valida correo registrado antes de enviar", status: config.security.passwordRecovery },
          ].map((item) => (
            <div key={item.label} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-white font-semibold text-sm">{item.label}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-gray-500 text-xs mt-2">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Usuario activo", value: session?.email ?? config.security.activeUser, detail: config.security.role },
          { label: "Módulos permitidos", value: `${allowedModules}`, detail: `${blockedModules} bloqueados por rol` },
          { label: "Recuperación", value: config.security.passwordRecovery, detail: "Ruta /users/password/new" },
          { label: "Intentos fallidos", value: `${failedLoginCount}`, detail: "Registrados en esta terminal" },
        ].map((item) => (
          <div key={item.label} className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
            <p className="text-xs text-gray-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Accesos por rol</h3>
              <p className="text-xs text-gray-500 mt-0.5">Lo que puede abrir o registrar el perfil {config.security.role}.</p>
            </div>
            <button
              onClick={() => setActiveSection("Seguridad")}
              className="text-sm border border-[#3A3A3A] bg-[#1A1A1A] hover:border-[#CC2229] text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Cambiar rol
            </button>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {visibleAccessProfile.map((item) => (
              <div key={item.module} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
                <p className="text-sm text-white">{item.module}</p>
                <StatusBadge status={item.access} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Pruebas rápidas</h3>
            <p className="text-xs text-gray-500 mt-0.5">Acciones conectadas al login y recuperación.</p>
          </div>
          <div className="p-5 space-y-3">
            <Link href="/" className="block rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-3 text-sm text-gray-300 hover:border-[#CC2229] hover:text-white transition-colors">
              Probar login seguro
            </Link>
            <Link href="/users/password/new" className="block rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-3 text-sm text-gray-300 hover:border-[#CC2229] hover:text-white transition-colors">
              Probar recuperación de contraseña
            </Link>
            <button
              onClick={() => setActiveSection("Seguridad")}
              className="w-full text-left rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-3 text-sm text-gray-300 hover:border-[#CC2229] hover:text-white transition-colors"
            >
              Ajustar usuario y rol activo
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configItems.map((item) => (
          <div key={item.title} className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
            <item.icon size={22} className="text-[#CC2229] mb-3" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold">{item.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{item.description}</p>
              </div>
              {item.title === "Seguridad" && <StatusBadge status={mainStatus} />}
            </div>
            <button
              onClick={() => setActiveSection(item.title)}
              className="mt-4 text-sm border border-[#3A3A3A] bg-[#1A1A1A] hover:border-[#CC2229] text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Configurar
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Estado actual</h3>
          <p className="text-xs text-gray-500 mt-0.5">Lo que guardes se refleja aquí y se conserva en esta sesión del navegador.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#3A3A3A]">
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Usuario</p>
            <p className="mt-2 text-sm font-semibold text-white">{config.security.activeUser}</p>
            <p className="text-xs text-gray-500">{config.security.role}</p>
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Empresa</p>
            <p className="mt-2 text-sm font-semibold text-white">{config.company.razonSocial}</p>
            <p className="text-xs text-gray-500">{config.company.rfc} · {config.company.moneda}</p>
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Preferencias</p>
            <p className="mt-2 text-sm font-semibold text-white">{config.preferences.vista}</p>
            <p className="text-xs text-gray-500">{config.preferences.tema} · {config.preferences.densidad}</p>
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-widest text-gray-500">Últimos ajustes</p>
            <ul className="mt-2 space-y-1">
              {config.audit.slice(0, 3).map((item, index) => (
                <li key={`${item}-${index}`} className="text-xs text-gray-400">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Bitácora de autenticación</h3>
          <p className="text-xs text-gray-500 mt-0.5">Intentos de login, recuperación y cambios de rol registrados localmente.</p>
        </div>
        <div className="divide-y divide-[#3A3A3A]">
          {(authEvents.length > 0 ? authEvents : [{ id: "empty", email: "Sin actividad reciente", message: "Todavía no hay eventos de autenticación registrados.", type: "login_success" as const, createdAt: "" }]).slice(0, 5).map((event) => (
            <div key={event.id} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2 px-5 py-3">
              <p className="text-xs text-gray-500">
                {event.createdAt ? new Date(event.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) : "Pendiente"}
              </p>
              <div>
                <p className="text-sm text-white">{event.email}</p>
                <p className="text-xs text-gray-500">{event.message}</p>
              </div>
              <StatusBadge status={event.type === "login_failed" ? "Revisión" : "Activo"} />
            </div>
          ))}
        </div>
      </div>

      <FormModal
        open={activeSection !== null}
        title={`Configurar ${activeSection ?? ""}`}
        onClose={() => setActiveSection(null)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setActiveSection(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Guardar configuración
            </button>
          </>
        }
      >
        {renderModalContent()}
      </FormModal>
    </div>
  );
}
