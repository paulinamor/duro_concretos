"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Moon, Pencil, Plus, Search, Shield, Sun, Trash2, XCircle } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { authSecondary } from "@/lib/firebase";
import {
  getAllUserProfiles,
  upsertUserProfile,
  withoutUserProfileId,
  upsertDocument,
  getCollectionDocs,
  deleteDocument,
  COLLECTIONS,
  orderBy,
  type UserProfile,
  type SolicitudAutorizacion,
} from "@/lib/db";
import AppSelect from "@/components/AppSelect";
import StatusBadge from "@/components/StatusBadge";
import { getStoredTheme, setStoredTheme, type AppTheme } from "@/components/ThemeSync";
import {
  getStoredSession,
  moduleCatalog,
  recordAuthEvent,
  saveSession,
  type Planta,
  type UserRole,
} from "@/lib/auth";

type UserDraft = {
  uid: string | null;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: "Activo" | "Inactivo";
  modules: "all" | string[];
  planta: Planta;
  canAuthorize: boolean;
  permisos: Record<string, "r" | "w" | "rw">;
};

type Tab = "usuarios" | "autorizaciones" | "apariencia" | "ubicaciones";

type PlantaCoord = { lat: string; lng: string; label: string };

// cualquier admin puede gestionar usuarios

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>("usuarios");
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const isSuperAdmin = session?.role === "admin";

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLong, setLoadingLong] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>("dark");
  const [plantaCoords, setPlantaCoords] = useState<Record<string, PlantaCoord>>({
    Allende:  { lat: "25.4437", lng: "-100.0233", label: "Planta Allende" },
    Pesquería: { lat: "25.7544", lng: "-99.9904", label: "Planta Pesquería" },
  });
  const [savingCoords, setSavingCoords] = useState(false);


  useEffect(() => {
    getCollectionDocs<{ id: string; key: string; value: PlantaCoord }>(COLLECTIONS.configuracion)
      .then((docs) => {
        const coordsDocs = docs.filter((d) => d.key?.startsWith("planta_coords_"));
        if (coordsDocs.length > 0) {
          const loaded: Record<string, PlantaCoord> = {};
          coordsDocs.forEach((d) => {
            const name = d.key.replace("planta_coords_", "");
            loaded[name] = d.value;
          });
          setPlantaCoords((prev) => ({ ...prev, ...loaded }));
        }
      })
      .catch(() => {});
  }, []);

  async function saveCoords() {
    setSavingCoords(true);
    try {
      await Promise.all(
        Object.entries(plantaCoords).map(([name, coord]) =>
          upsertDocument(COLLECTIONS.configuracion, `planta_coords_${name}`, { key: `planta_coords_${name}`, value: coord })
        )
      );
      showToast("success", "Guardado", "Coordenadas de plantas actualizadas.");
    } catch {
      showToast("error", "Error", "No se pudieron guardar las coordenadas.");
    } finally {
      setSavingCoords(false);
    }
  }

  useEffect(() => {
    if (!loadingUsers) { setLoadingLong(false); return; }
    const t = setTimeout(() => setLoadingLong(true), 3000);
    return () => clearTimeout(t);
  }, [loadingUsers]);

  useEffect(() => {
    setSession(getStoredSession());
    setCurrentTheme(getStoredTheme());
    getAllUserProfiles()
      .then((list) => setProfiles(list.filter((p) => p.status !== "Inactivo")))
      .catch(() => {/* silently fail - show empty */})
      .finally(() => setLoadingUsers(false));

    function handleThemeChange(event: Event) {
      const theme = (event as CustomEvent<{ theme?: string }>).detail?.theme as AppTheme | undefined;
      if (theme === "dark" || theme === "light") setCurrentTheme(theme);
    }

    window.addEventListener("duro:theme-change", handleThemeChange);
    return () => window.removeEventListener("duro:theme-change", handleThemeChange);
  }, []);

  const filteredUsers = profiles.filter((p) => {
    const q = userSearch.trim().toLowerCase();
    return !q || p.nombre.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  function showToast(type: "success" | "error", title: string, message: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", { detail: { type, title, message } }));
  }

  function openCreateUser() {
    setUserDraft({
      uid: null,
      name: "",
      email: "",
      password: "",
      role: "operador",
      status: "Activo",
      modules: ["/dashboard"],
      planta: "Pesquería",
      canAuthorize: false,
      permisos: {},
    });
  }

  function openEditUser(profile: UserProfile) {
    setUserDraft({
      uid: profile.id,
      name: profile.nombre,
      email: profile.email,
      password: "",
      role: profile.role,
      status: profile.status,
      modules: profile.modules,
      planta: profile.planta ?? "Pesquería",
      canAuthorize: profile.canAuthorize ?? false,
      permisos: profile.permisos ?? {},
    });
  }

  function toggleDraftModule(href: string) {
    setUserDraft((current) => {
      if (!current || current.modules === "all") return current;
      const modules = current.modules.includes(href)
        ? current.modules.filter((m) => m !== href)
        : [...current.modules, href];
      return { ...current, modules };
    });
  }

  async function saveUserDraft() {
    if (!userDraft) return;

    if (!userDraft.name.trim() || !userDraft.email.trim()) {
      showToast("error", "Información incompleta", "Completa nombre y correo.");
      return;
    }
    if (!userDraft.uid && !userDraft.password.trim()) {
      showToast("error", "Información incompleta", "La contraseña es requerida para nuevos usuarios.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDraft.email.trim())) {
      showToast("error", "Correo inválido", "El correo no tiene formato válido.");
      return;
    }
    if (userDraft.modules !== "all" && userDraft.modules.length === 0) {
      showToast("error", "Sin módulos", "Selecciona al menos un módulo.");
      return;
    }

    const normalizedEmail = userDraft.email.trim().toLowerCase();

    if (!userDraft.uid) {
      // duplicate check
      const exists = profiles.some((p) => p.email.toLowerCase() === normalizedEmail);
      if (exists) {
        showToast("error", "Usuario repetido", "Ya existe un usuario con ese correo.");
        return;
      }
    }

    setSavingUser(true);
    try {
      let uid = userDraft.uid;

      if (!uid) {
        if (!authSecondary) {
          showToast("error", "Firebase sin configurar", "Faltan variables NEXT_PUBLIC_FIREBASE_* en este ambiente.");
          return;
        }
        // Create Firebase Auth account using secondary app (no sign-out of current admin)
        const credential = await createUserWithEmailAndPassword(
          authSecondary,
          normalizedEmail,
          userDraft.password,
        );
        uid = credential.user.uid;
      }

      const profileData: Omit<UserProfile, "id"> = {
        email: normalizedEmail,
        nombre: userDraft.name.trim(),
        role: userDraft.role,
        modules: userDraft.modules,
        status: userDraft.status,
        planta: userDraft.planta,
        createdAt: profiles.find((p) => p.id === uid)?.createdAt ?? new Date().toISOString(),
        canAuthorize: userDraft.canAuthorize,
        permisos: userDraft.permisos,
      };

      await upsertUserProfile(uid, profileData);

      // Refresh list
      const updated = await getAllUserProfiles();
      setProfiles(updated.filter((p) => p.status !== "Inactivo"));

      // Keep current session in sync if editing own profile
      if (session?.email?.toLowerCase() === normalizedEmail) {
        saveSession({
          email: normalizedEmail,
          password: "",
          name: profileData.nombre,
          role: profileData.role,
          modules: profileData.modules,
          status: profileData.status,
          planta: profileData.planta,
          canAuthorize: profileData.canAuthorize,
          permisos: profileData.permisos,
        });
        setSession(getStoredSession());
      }

      recordAuthEvent({
        type: "role_update",
        email: normalizedEmail,
        message: `Accesos actualizados: ${profileData.modules === "all" ? "todos los módulos" : `${(profileData.modules as string[]).length} módulos`}.`,
      });

      setUserDraft(null);
      showToast("success", "Usuario guardado", "Los accesos quedaron actualizados en Firebase.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const message =
        code === "auth/email-already-in-use"
          ? "Ya existe una cuenta con ese correo en Firebase Auth."
          : code === "auth/weak-password"
            ? "La contraseña debe tener al menos 6 caracteres."
            : "Error al guardar usuario. Intenta de nuevo.";
      showToast("error", "Error", message);
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(profile: UserProfile) {
    if (session?.email === profile.email) {
      showToast("error", "No disponible", "No puedes eliminar el usuario con sesión activa.");
      return;
    }
    try {
      // Soft-delete: mark Inactivo in Firestore (blocks login)
      await upsertUserProfile(profile.id, { ...withoutUserProfileId(profile), status: "Inactivo" });
      setProfiles((current) => current.filter((p) => p.id !== profile.id));
      showToast("success", "Usuario desactivado", "El usuario ya no puede iniciar sesión.");
    } catch {
      showToast("error", "Error", "No se pudo eliminar el usuario.");
    }
  }

  // ─── Autorizaciones ────────────────────────────────────────────────────────

  const [solicitudes, setSolicitudes] = useState<SolicitudAutorizacion[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  async function loadSolicitudes() {
    setLoadingSolicitudes(true);
    try {
      const docs = await getCollectionDocs<SolicitudAutorizacion>(
        COLLECTIONS.solicitudesAutorizacion,
        [orderBy("creadoEn", "desc")],
      );
      setSolicitudes(docs);
    } catch {
      showToast("error", "Error", "No se pudieron cargar las solicitudes.");
    } finally {
      setLoadingSolicitudes(false);
    }
  }

  useEffect(() => {
    if (activeTab === "autorizaciones") loadSolicitudes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function aprobarSolicitud(sol: SolicitudAutorizacion) {
    if (!sol.id) return;
    setProcesandoId(sol.id);
    try {
      await deleteDocument(COLLECTIONS.programaciones, sol.programacionId);
      await upsertDocument(COLLECTIONS.solicitudesAutorizacion, sol.id, {
        ...sol,
        status: "aprobada",
        resueltoPor: session?.email ?? "",
        resueltaEn: new Date().toISOString(),
      });
      setSolicitudes((prev) => prev.map((s) => s.id === sol.id ? { ...s, status: "aprobada" } : s));
      showToast("success", "Aprobada", `Programación ${sol.folio} eliminada correctamente.`);
    } catch {
      showToast("error", "Error", "No se pudo procesar la aprobación.");
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazarSolicitud(sol: SolicitudAutorizacion) {
    if (!sol.id || !comentarioRechazo.trim()) return;
    setProcesandoId(sol.id);
    try {
      await upsertDocument(COLLECTIONS.solicitudesAutorizacion, sol.id, {
        ...sol,
        status: "rechazada",
        resueltoPor: session?.email ?? "",
        resueltaEn: new Date().toISOString(),
        comentarioResolucion: comentarioRechazo.trim(),
      });
      setSolicitudes((prev) => prev.map((s) => s.id === sol.id ? { ...s, status: "rechazada" } : s));
      setRechazandoId(null);
      setComentarioRechazo("");
      showToast("success", "Rechazada", "La solicitud fue rechazada.");
    } catch {
      showToast("error", "Error", "No se pudo rechazar la solicitud.");
    } finally {
      setProcesandoId(null);
    }
  }

  function setDraftModulePermiso(href: string, permiso: "r" | "w" | "rw") {
    setUserDraft((current) => {
      if (!current) return current;
      return { ...current, permisos: { ...current.permisos, [href]: permiso } };
    });
  }

  function handleThemeSelect(theme: AppTheme) {
    setStoredTheme(theme);
    setCurrentTheme(theme);
    showToast("success", theme === "dark" ? "Modo claro activado" : "Modo noche activado", "El tema se aplicó correctamente.");
  }


  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-500">Plataforma</p>
        <p className="text-gray-500 text-sm mt-0.5">Gestión de usuarios, roles y preferencias del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#3A3A3A] bg-[#1A1A1A] p-1 w-fit">
        {(["usuarios", "autorizaciones", "apariencia", "ubicaciones"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === tab
                ? "bg-[#CC2229] text-white shadow-lg shadow-[#CC2229]/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "usuarios" ? "Usuarios y roles"
              : tab === "autorizaciones" ? "Autorizaciones"
              : tab === "apariencia" ? "Apariencia"
              : "Ubicaciones"}
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
            {isSuperAdmin && (
              <button
                onClick={openCreateUser}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#991A1E] cursor-pointer"
              >
                <Plus size={16} />
                Crear usuario ERP
              </button>
            )}
          </div>

          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center gap-4 py-28">
              <svg className="h-9 w-9 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-400 text-center max-w-xs">
                {loadingLong ? "Cargando información, esto puede tomar unos segundos…" : "Cargando…"}
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Nombre", "Correo", "Rol", "Planta", "Módulos", "Estatus", "Acciones"].map((header) => (
                    <th key={header} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                ) : filteredUsers.map((user) => {
                  const moduleCount = user.modules === "all"
                    ? "Todos"
                    : `${(user.modules as string[]).length} módulo${(user.modules as string[]).length === 1 ? "" : "s"}`;

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                      <td className="px-5 py-4 text-white font-medium">{user.nombre}</td>
                      <td className="px-5 py-4 text-gray-400">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "admin" ? "bg-amber-100 text-amber-800 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"}`}>
                          {user.role === "admin" ? "Administrador" : "Operador"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.planta === "Allende" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                          user.planta === "Pesquería" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {user.planta ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400">{moduleCount}</td>
                      <td className="px-5 py-4"><StatusBadge status={user.status} /></td>
                      <td className="px-5 py-4">
                        {isSuperAdmin ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditUser(user)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                              aria-label={`Editar ${user.nombre}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => deleteUser(user)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#1A1A1A] hover:text-[#CC2229] cursor-pointer"
                              aria-label={`Eliminar ${user.nombre}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">Sin acceso</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab: Autorizaciones */}
      {activeTab === "autorizaciones" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Solicitudes de autorización</p>
              <p className="text-gray-500 text-xs mt-0.5">Aprueba o rechaza acciones que requieren autorización de supervisor.</p>
            </div>
            <button
              onClick={loadSolicitudes}
              className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer border border-[#3A3A3A] rounded-lg px-3 py-1.5"
            >
              Actualizar
            </button>
          </div>

          {loadingSolicitudes ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <svg className="h-7 w-7 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-400">Cargando solicitudes…</p>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 rounded-xl border border-[#3A3A3A] bg-[#242424]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1A1A] text-gray-600">
                <Shield size={22} />
              </div>
              <p className="text-sm text-gray-400">Sin solicitudes pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {solicitudes.map((sol) => {
                const isPendiente = sol.status === "pendiente";
                const isAprobada = sol.status === "aprobada";
                const isRechazando = rechazandoId === sol.id;

                return (
                  <div
                    key={sol.id}
                    className={`rounded-xl border bg-[#242424] overflow-hidden ${
                      isPendiente ? "border-amber-500/40" : isAprobada ? "border-emerald-500/30" : "border-red-500/20"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3A3A3A]">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isPendiente ? "bg-amber-500/15 text-amber-400"
                        : isAprobada ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                      }`}>
                        {isPendiente ? <Clock size={15} /> : isAprobada ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          Eliminar programación {sol.folio}
                        </p>
                        <p className="text-xs text-gray-500">{sol.cliente} · {sol.dia}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        isPendiente ? "bg-amber-500/15 text-amber-400"
                        : isAprobada ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                      }`}>
                        {sol.status}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                        <div>
                          <span className="text-gray-600 uppercase tracking-widest text-[10px] font-semibold">Solicitante</span>
                          <p className="text-gray-300 mt-0.5">{sol.solicitanteNombre}</p>
                          <p className="text-gray-500">{sol.solicitanteEmail}</p>
                        </div>
                        <div>
                          <span className="text-gray-600 uppercase tracking-widest text-[10px] font-semibold">Fecha solicitud</span>
                          <p className="text-gray-300 mt-0.5">
                            {new Date(sol.creadoEn).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-600 uppercase tracking-widest text-[10px] font-semibold">Motivo</span>
                          <p className="text-gray-300 mt-0.5">{sol.motivo}</p>
                        </div>
                        {sol.comentarioResolucion && (
                          <div className="sm:col-span-2">
                            <span className="text-gray-600 uppercase tracking-widest text-[10px] font-semibold">Comentario resolución</span>
                            <p className="text-gray-300 mt-0.5">{sol.comentarioResolucion}</p>
                          </div>
                        )}
                        {sol.resueltoPor && (
                          <div>
                            <span className="text-gray-600 uppercase tracking-widest text-[10px] font-semibold">Resuelto por</span>
                            <p className="text-gray-300 mt-0.5">{sol.resueltoPor}</p>
                          </div>
                        )}
                      </div>

                      {/* Acciones solo si pendiente y usuario puede autorizar */}
                      {isPendiente && (session?.canAuthorize || session?.role === "admin") && (
                        <div className="pt-1 space-y-2">
                          {isRechazando ? (
                            <div className="space-y-2">
                              <textarea
                                value={comentarioRechazo}
                                onChange={(e) => setComentarioRechazo(e.target.value)}
                                placeholder="Motivo del rechazo (requerido)"
                                rows={2}
                                className="w-full resize-none rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => rechazarSolicitud(sol)}
                                  disabled={!comentarioRechazo.trim() || procesandoId === sol.id}
                                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer transition-colors"
                                >
                                  {procesandoId === sol.id && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                                  Confirmar rechazo
                                </button>
                                <button
                                  onClick={() => { setRechazandoId(null); setComentarioRechazo(""); }}
                                  className="rounded-lg border border-[#3A3A3A] px-3 py-1.5 text-xs text-gray-400 hover:text-white cursor-pointer transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => aprobarSolicitud(sol)}
                                disabled={procesandoId === sol.id}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                              >
                                {procesandoId === sol.id ? <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" /> : <CheckCircle2 size={13} />}
                                Aprobar y eliminar
                              </button>
                              <button
                                onClick={() => { setRechazandoId(sol.id ?? null); setComentarioRechazo(""); }}
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                              >
                                <XCircle size={13} />
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              {/* Claro: sidebar dark + contenido blanco */}
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F5F9] border border-slate-200/80">
                      <Sun size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Claro</p>
                      <p className="text-gray-500 text-xs">Fondo blanco · sidebar oscuro</p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 transition-colors ${
                    currentTheme === "dark"
                      ? "border-[#CC2229] bg-[#CC2229]"
                      : "border-[#3A3A3A]"
                  }`} />
                </div>
                {/* Preview: sidebar oscuro + contenido blanco */}
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
                      <Moon size={18} className="text-slate-300" />
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

      {/* Tab: Ubicaciones */}
      {activeTab === "ubicaciones" && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A]">
              <p className="text-sm font-semibold text-white">Coordenadas de plantas</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Se usan para mostrar rutas en el modal de rastreo de programaciones.
              </p>
            </div>
            <div className="p-5 space-y-6">
              {Object.entries(plantaCoords).map(([name, coord]) => (
                <div key={name}>
                  <p className="text-xs font-semibold text-gray-400 mb-3">{coord.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Latitud</label>
                      <input
                        type="text"
                        value={coord.lat}
                        onChange={(e) => setPlantaCoords((prev) => ({ ...prev, [name]: { ...prev[name], lat: e.target.value } }))}
                        className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229] font-mono"
                        placeholder="25.0000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Longitud</label>
                      <input
                        type="text"
                        value={coord.lng}
                        onChange={(e) => setPlantaCoords((prev) => ({ ...prev, [name]: { ...prev[name], lng: e.target.value } }))}
                        className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229] font-mono"
                        placeholder="-100.0000"
                      />
                    </div>
                  </div>
                  {coord.lat && coord.lng && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${coord.lat},${coord.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Ver en Maps ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[#3A3A3A] flex justify-end">
              <button
                onClick={saveCoords}
                disabled={savingCoords}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm font-medium text-white hover:bg-[#991A1E] disabled:opacity-60 cursor-pointer transition-colors"
              >
                {savingCoords && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {savingCoords ? "Guardando..." : "Guardar coordenadas"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-700">
            Puedes obtener las coordenadas abriendo Google Maps, haciendo clic derecho en la planta y copiando lat/lng.
          </p>
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
                <h3 className="text-white font-semibold">{userDraft.uid ? "Editar usuario ERP" : "Crear usuario ERP"}</h3>
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
                {!userDraft.uid && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={userDraft.password}
                      onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rol</label>
                  <AppSelect dark value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value as UserRole })}>
                    <option value="admin">Administrador</option>
                    <option value="operador">Operador</option>
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Planta</label>
                  <AppSelect dark value={userDraft.planta} onChange={(event) => setUserDraft({ ...userDraft, planta: event.target.value as Planta })}>
                    <option value="Pesquería">Pesquería</option>
                    <option value="Allende">Allende</option>
                    <option value="Todas">Todas (acceso completo)</option>
                  </AppSelect>
                  <p className="mt-1 text-xs text-gray-600">Define a qué planta pertenece este usuario.</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Estatus</label>
                  <AppSelect dark value={userDraft.status} onChange={(event) => setUserDraft({ ...userDraft, status: event.target.value as "Activo" | "Inactivo" })}>
                    <option>Activo</option>
                    <option>Inactivo</option>
                  </AppSelect>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Acceso</label>
                  <AppSelect dark value={userDraft.modules === "all" ? "all" : "custom"} onChange={(event) => setUserDraft({
                      ...userDraft,
                      modules: event.target.value === "all" ? "all" : ["/dashboard"],
                    })}>
                    <option value="custom">Módulos específicos</option>
                    <option value="all">Todos los módulos</option>
                  </AppSelect>
                </div>

                {/* canAuthorize toggle */}
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => setUserDraft({ ...userDraft, canAuthorize: !userDraft.canAuthorize })}
                    className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm text-left transition-all cursor-pointer ${
                      userDraft.canAuthorize
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                        : "border-[#3A3A3A] bg-[#1A1A1A] text-gray-400 hover:border-[#3A3A3A]"
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                      userDraft.canAuthorize ? "border-amber-400 bg-amber-500/30" : "border-gray-600"
                    }`}>
                      {userDraft.canAuthorize && (
                        <svg viewBox="0 0 10 8" className="h-3 w-3" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4l3 3 5-6" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Puede autorizar acciones</p>
                      <p className="text-xs text-gray-500 mt-0.5">Ve y resuelve solicitudes de eliminación y otras acciones sensibles</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-1">Módulos permitidos</h4>
                <p className="text-xs text-gray-500 mb-3">Para cada módulo activo puedes definir si el usuario puede leer, escribir o ambos.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {moduleCatalog.map((module) => {
                    const checked = userDraft.modules === "all" || (userDraft.modules as string[]).includes(module.href);
                    const disabled = userDraft.modules === "all";
                    const permiso: "r" | "w" | "rw" = (userDraft.permisos[module.href] as "r" | "w" | "rw") ?? "rw";
                    return (
                      <div
                        key={module.href}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                          checked
                            ? "border-[#CC2229]/60 bg-[#CC2229]/8"
                            : "border-[#3A3A3A] bg-[#1A1A1A]"
                        } ${disabled ? "opacity-60" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && toggleDraftModule(module.href)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all cursor-pointer ${
                            checked ? "border-[#CC2229] bg-[#CC2229]/30" : "border-gray-600"
                          }`}
                        >
                          {checked && (
                            <svg viewBox="0 0 10 8" className="h-3 w-3" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 4l3 3 5-6" stroke="#CC2229" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm font-medium ${checked ? "text-white" : "text-gray-500"}`}>
                          {module.label}
                        </span>
                        {checked && !disabled && (
                          <select
                            value={permiso}
                            onChange={(e) => setDraftModulePermiso(module.href, e.target.value as "r" | "w" | "rw")}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#CC2229] cursor-pointer"
                          >
                            <option value="rw">Ver y editar</option>
                            <option value="r">Solo ver</option>
                            <option value="w">Solo editar</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#3A3A3A] bg-[#242424] px-6 py-4">
              <button onClick={() => setUserDraft(null)} className="rounded-lg border border-[#3A3A3A] px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={saveUserDraft}
                disabled={savingUser}
                className="inline-flex items-center gap-2 rounded-lg bg-[#CC2229] px-4 py-2 text-sm text-white hover:bg-[#991A1E] disabled:opacity-60 cursor-pointer"
              >
                {savingUser && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {savingUser ? "Guardando..." : "Guardar usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
