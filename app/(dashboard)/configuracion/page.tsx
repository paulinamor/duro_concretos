"use client";

import { useEffect, useState } from "react";
import { Moon, Pencil, Plus, Search, Sun, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { getStoredTheme, setStoredTheme, type AppTheme } from "@/components/ThemeSync";
import {
  getManagedUsers,
  getStoredSession,
  moduleCatalog,
  recordAuthEvent,
  saveManagedUsers,
  saveSession,
  type AppUser,
  type UserRole,
} from "@/lib/auth";

type UserDraft = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: "Activo" | "Inactivo";
  modules: "all" | string[];
};

type Tab = "usuarios" | "apariencia";

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [managedUsers, setManagedUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [editingUserEmail, setEditingUserEmail] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSession(getStoredSession());
      setManagedUsers(getManagedUsers());
      setCurrentTheme(getStoredTheme());
    });

    function handleThemeChange(event: Event) {
      const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme as AppTheme | undefined;
      if (theme === "dark" || theme === "light") setCurrentTheme(theme);
    }

    window.addEventListener("duro:theme-change", handleThemeChange);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("duro:theme-change", handleThemeChange);
    };
  }, []);

  const filteredUsers = managedUsers.filter((user) => {
    const query = userSearch.trim().toLowerCase();
    return !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  function showToast(type: "success" | "error", title: string, message: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message } }));
  }

  function openCreateUser() {
    setEditingUserEmail(null);
    setUserDraft({
      name: "",
      email: "",
      password: "",
      role: "operador",
      status: "Activo",
      modules: ["/dashboard", "/transporte/viajes"],
    });
  }

  function openEditUser(user: AppUser) {
    setEditingUserEmail(user.email);
    setUserDraft({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      status: user.status ?? "Activo",
      modules: user.modules ?? (user.role === "admin" ? "all" : ["/dashboard"]),
    });
  }

  function toggleDraftModule(href: string) {
    setUserDraft((current) => {
      if (!current || current.modules === "all") return current;
      const modules = current.modules.includes(href)
        ? current.modules.filter((module) => module !== href)
        : [...current.modules, href];

      return { ...current, modules };
    });
  }

  function saveUserDraft() {
    if (!userDraft) return;

    if (!userDraft.name.trim() || !userDraft.email.trim() || !userDraft.password.trim()) {
      showToast("error", "Información incompleta", "Completa nombre, correo y contraseña.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDraft.email.trim())) {
      showToast("error", "Correo inválido", "El correo del usuario no tiene formato válido.");
      return;
    }

    if (userDraft.modules !== "all" && userDraft.modules.length === 0) {
      showToast("error", "Sin módulos", "Selecciona al menos un módulo para este usuario.");
      return;
    }

    const normalizedEmail = userDraft.email.trim().toLowerCase();
    const duplicated = managedUsers.some((user) => user.email.toLowerCase() === normalizedEmail && user.email !== editingUserEmail);
    if (duplicated) {
      showToast("error", "Usuario repetido", "Ya existe un usuario con ese correo.");
      return;
    }

    const nextUser: AppUser = {
      name: userDraft.name.trim(),
      email: normalizedEmail,
      password: userDraft.password,
      role: userDraft.role,
      status: userDraft.status,
      modules: userDraft.modules,
    };
    const nextUsers = editingUserEmail
      ? managedUsers.map((user) => user.email === editingUserEmail ? nextUser : user)
      : [nextUser, ...managedUsers];

    setManagedUsers(nextUsers);
    saveManagedUsers(nextUsers);

    if (session?.email === editingUserEmail || session?.email === nextUser.email) {
      saveSession(nextUser);
      setSession(getStoredSession());
    }

    recordAuthEvent({
      type: "role_update",
      email: nextUser.email,
      message: `Accesos actualizados: ${nextUser.modules === "all" ? "todos los módulos" : `${(nextUser.modules ?? []).length} módulos`}.`,
    });

    setUserDraft(null);
    setEditingUserEmail(null);
    showToast("success", "Usuario guardado", "Los accesos por módulo quedaron actualizados.");
  }

  function deleteUser(email: string) {
    if (session?.email === email) {
      showToast("error", "No disponible", "No puedes eliminar el usuario con sesión activa.");
      return;
    }

    const nextUsers = managedUsers.filter((user) => user.email !== email);
    setManagedUsers(nextUsers);
    saveManagedUsers(nextUsers);
    showToast("success", "Usuario eliminado", "El usuario ya no puede iniciar sesión.");
  }

  function handleThemeSelect(theme: AppTheme) {
    setStoredTheme(theme);
    setCurrentTheme(theme);
    showToast("success", theme === "dark" ? "Modo oscuro activado" : "Modo noche activado", "El tema se aplicó correctamente.");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">Plataforma</p>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de usuarios, roles y preferencias del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] p-1 w-fit">
        {(["usuarios", "apariencia"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === tab
                ? "bg-[#CC2229] text-white shadow-lg shadow-[#CC2229]/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "usuarios" ? "Usuarios y roles" : "Apariencia"}
          </button>
        ))}
      </div>

      {/* Tab: Usuarios */}
      {activeTab === "usuarios" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xl">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              />
            </div>
            <button
              onClick={openCreateUser}
              className="inline-flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#991A1E] cursor-pointer"
            >
              <Plus size={16} />
              Crear usuario ERP
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Nombre", "Correo", "Rol", "Módulos", "Estatus", "Acciones"].map((header) => (
                    <th key={header} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredUsers.map((user) => {
                  const moduleCount = user.modules === "all"
                    ? "Todos"
                    : `${(user.modules ?? []).length} módulo${(user.modules ?? []).length === 1 ? "" : "s"}`;

                  return (
                    <tr key={user.email} className="hover:bg-[#2A2A2A] transition-colors">
                      <td className="px-5 py-4 text-white font-medium">{user.name}</td>
                      <td className="px-5 py-4 text-gray-400">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "admin" ? "bg-yellow-900/40 text-yellow-300" : "bg-gray-800 text-gray-300"}`}>
                          {user.role === "admin" ? "Administrador" : "Usuario"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-300">{moduleCount}</td>
                      <td className="px-5 py-4"><StatusBadge status={user.status ?? "Activo"} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditUser(user)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                            aria-label={`Editar ${user.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => deleteUser(user.email)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#1A1A1A] hover:text-[#CC2229] cursor-pointer"
                            aria-label={`Eliminar ${user.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Apariencia */}
      {activeTab === "apariencia" && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-6 space-y-5">
            <div>
              <p className="text-white font-semibold text-sm">Tema de la interfaz</p>
              <p className="text-gray-500 text-xs mt-1">El tema se guarda por navegador y aplica en todos los módulos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Oscuro: hybrid Grill Team */}
              <button
                onClick={() => handleThemeSelect("dark")}
                className={`group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer ${
                  currentTheme === "dark"
                    ? "border-[#CC2229] bg-[#CC2229]/5 shadow-lg shadow-[#CC2229]/10"
                    : "border-[#3A3A3A] hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1220] border border-white/10">
                      <Moon size={18} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Oscuro</p>
                      <p className="text-gray-500 text-xs">Sidebar dark · contenido claro</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 transition-colors ${
                    currentTheme === "dark"
                      ? "border-[#CC2229] bg-[#CC2229]"
                      : "border-[#3A3A3A]"
                  }`} />
                </div>
                {/* Preview: sidebar strip izquierda dark + contenido derecha claro */}
                <div className="rounded-lg overflow-hidden border border-white/10 pointer-events-none select-none flex h-16">
                  <div className="w-8 bg-[#0B1220] flex flex-col gap-1 p-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/20" />
                    <div className="h-1.5 w-full rounded-full bg-white/10" />
                    <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
                  </div>
                  <div className="flex-1 bg-[#F1F5F9] p-2 space-y-1.5">
                    <div className="h-2 w-full rounded bg-white border border-slate-200/80" />
                    <div className="flex gap-1">
                      <div className="h-5 w-10 rounded bg-[#CC2229]/80" />
                      <div className="h-5 flex-1 rounded bg-white border border-slate-200/80" />
                    </div>
                  </div>
                </div>
              </button>

              {/* Noche: todo oscuro */}
              <button
                onClick={() => handleThemeSelect("light")}
                className={`group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer ${
                  currentTheme === "light"
                    ? "border-[#CC2229] bg-[#CC2229]/5 shadow-lg shadow-[#CC2229]/10"
                    : "border-[#3A3A3A] hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111318] border border-white/10">
                      <Sun size={18} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Noche</p>
                      <p className="text-gray-500 text-xs">Todo oscuro · OLED</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 transition-colors ${
                    currentTheme === "light"
                      ? "border-[#CC2229] bg-[#CC2229]"
                      : "border-[#3A3A3A]"
                  }`} />
                </div>
                {/* Preview: todo oscuro */}
                <div className="rounded-lg overflow-hidden border border-white/10 pointer-events-none select-none flex h-16">
                  <div className="w-8 bg-[#0B1220] flex flex-col gap-1 p-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/20" />
                    <div className="h-1.5 w-full rounded-full bg-white/10" />
                    <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
                  </div>
                  <div className="flex-1 bg-[#111318] p-2 space-y-1.5">
                    <div className="h-2 w-full rounded bg-[#1A1A1A] border border-white/10" />
                    <div className="flex gap-1">
                      <div className="h-5 w-10 rounded bg-[#CC2229]/80" />
                      <div className="h-5 flex-1 rounded bg-[#242424] border border-white/10" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <p className="text-xs text-gray-600">
              El sidebar permanece oscuro en ambos modos.
            </p>
          </div>
        </div>
      )}

      {/* Modal usuario */}
      {userDraft && (
        <div className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Cerrar usuario"
            onClick={() => setUserDraft(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 my-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#3A3A3A] bg-[#242424] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#3A3A3A] bg-[#242424] px-6 py-4">
              <div>
                <h3 className="text-white font-semibold">{editingUserEmail ? "Editar usuario ERP" : "Crear usuario ERP"}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Asigna el rol y los módulos que puede abrir este usuario.</p>
              </div>
              <button onClick={() => setUserDraft(null)} className="text-gray-400 hover:text-white cursor-pointer">
                Cerrar
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                  <input
                    value={userDraft.name}
                    onChange={(event) => setUserDraft({ ...userDraft, name: event.target.value })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Correo</label>
                  <input
                    type="email"
                    value={userDraft.email}
                    onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
                  <input
                    value={userDraft.password}
                    onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rol</label>
                  <select
                    value={userDraft.role}
                    onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as UserRole })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  >
                    <option value="admin">Administrador</option>
                    <option value="operador">Usuario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Estatus</label>
                  <select
                    value={userDraft.status}
                    onChange={(event) => setUserDraft({ ...userDraft, status: event.target.value as "Activo" | "Inactivo" })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  >
                    <option>Activo</option>
                    <option>Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Acceso</label>
                  <select
                    value={userDraft.modules === "all" ? "all" : "custom"}
                    onChange={(event) => setUserDraft({
                      ...userDraft,
                      modules: event.target.value === "all" ? "all" : ["/dashboard"],
                    })}
                    className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                  >
                    <option value="custom">Módulos específicos</option>
                    <option value="all">Todos los módulos</option>
                  </select>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">Módulos permitidos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {moduleCatalog.map((module) => {
                    const checked = userDraft.modules === "all" || userDraft.modules.includes(module.href);
                    return (
                      <label
                        key={module.href}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors ${
                          checked ? "border-[#CC2229]/60 bg-[#CC2229]/10 text-white" : "border-[#3A3A3A] bg-[#1A1A1A] text-gray-400"
                        } ${userDraft.modules === "all" ? "opacity-70" : "cursor-pointer hover:border-[#CC2229]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={userDraft.modules === "all"}
                          onChange={() => toggleDraftModule(module.href)}
                          className="h-4 w-4 accent-[#CC2229]"
                        />
                        {module.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#3A3A3A] bg-[#242424] px-6 py-4">
              <button onClick={() => setUserDraft(null)} className="rounded-lg border border-[#3A3A3A] px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer">
                Cancelar
              </button>
              <button onClick={saveUserDraft} className="rounded-lg bg-[#CC2229] px-4 py-2 text-sm text-white hover:bg-[#991A1E] cursor-pointer">
                Guardar usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
