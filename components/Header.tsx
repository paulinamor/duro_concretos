"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bot, CircleDollarSign, Fuel, LogOut, Settings, Truck, User, UserCircle, Wallet } from "lucide-react";
import { MobileMenuButton } from "./Sidebar";
import { getAllowedModuleSet, getStoredSession } from "@/lib/auth";

interface HeaderProps {
  title: string;
  onMobileMenu: () => void;
}

export default function Header({ title, onMobileMenu }: HeaderProps) {
  const router = useRouter();
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [session, setSession] = useState(() => getStoredSession());
  const [notifications, setNotifications] = useState([
    { title: "Caja chica requiere reposición", detail: "Disponible bajo el punto definido", href: "/operaciones/caja-chica", read: false, icon: Wallet, tag: "Operaciones" },
    { title: "Unidad DC-02 próxima a servicio", detail: "Restan menos de 2,000 km", href: "/transporte/mantenimiento", read: false, icon: Truck, tag: "Transporte" },
    { title: "CxC pendiente de seguimiento", detail: "Grupo Alfa vence esta semana", href: "/finanzas/cxc", read: false, icon: CircleDollarSign, tag: "Finanzas" },
    { title: "Rendimiento bajo de diésel", detail: "DC-07 reportó 2.8 km/L", href: "/transporte/diesel", read: false, icon: Fuel, tag: "Transporte" },
    { title: "Automatización pausada", detail: "Timbrado de nómina requiere autorización", href: "/automatizaciones", read: false, icon: Bot, tag: "Sistema" },
  ]);
  const enabledNotificationModules = getAllowedModuleSet(session);
  const visibleNotifications = notifications.filter((item) => enabledNotificationModules.has(item.href));
  const unreadCount = visibleNotifications.filter((item) => !item.read).length;

  function markNotificationAsRead(title: string) {
    setNotifications((current) =>
      current.map((item) =>
        item.title === title ? { ...item, read: true } : item,
      ),
    );
    setNotificationsOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem("duro_concretos_session");
    sessionStorage.clear();
    setUserMenuOpen(false);
    router.push("/");
  }

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(getStoredSession());
    }

    function handleOutsideClick(event: MouseEvent) {
      if (
        headerActionsRef.current &&
        !headerActionsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    }

    window.addEventListener("duro:session-updated", handleSessionUpdate);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("duro:session-updated", handleSessionUpdate);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const displayName = session?.name ?? "Admin";
  const displayRole = session?.role === "operador" ? "Operador" : "Administrador";

  return (
    <header className="relative z-40 bg-[#242424] border-b border-[#3A3A3A] px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMobileMenu} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div ref={headerActionsRef} className="flex items-center gap-2">
        <div className="relative">
        <button
          onClick={() => {
            setNotificationsOpen((open) => !open);
            setUserMenuOpen(false);
          }}
          className="p-2 text-gray-400 hover:text-white transition-colors relative rounded-lg hover:bg-[#1A1A1A]"
          aria-label="Notificaciones"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#CC2229] rounded-full" />
          )}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-[#1A1A1A] px-4 py-4 border-b border-[#3A3A3A]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold text-sm">Notificaciones</p>
                  <p className="text-gray-500 text-xs mt-0.5">Alertas operativas del ERP</p>
                </div>
                <span className="rounded-full bg-[#CC2229]/15 px-2.5 py-1 text-xs font-semibold text-[#CC2229]">
                  {unreadCount} nuevas
                </span>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-2 space-y-2">
              {visibleNotifications.length > 0 ? visibleNotifications.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => markNotificationAsRead(item.title)}
                  className={`block rounded-lg border px-3 py-3 transition-colors ${
                    item.read
                      ? "border-[#3A3A3A] bg-[#1A1A1A]/60 opacity-60"
                      : "border-[#CC2229]/30 bg-[#1A1A1A] hover:border-[#CC2229]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      item.read ? "bg-[#242424] text-gray-500" : "bg-[#CC2229]/15 text-[#CC2229]"
                    }`}>
                      <item.icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        {!item.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CC2229] shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
                      <span className="mt-2 inline-flex rounded-full bg-[#242424] px-2 py-0.5 text-[11px] text-gray-400">
                        {item.tag}
                      </span>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-4">
                  <p className="text-sm font-medium text-white">Sin notificaciones activas</p>
                  <p className="mt-1 text-xs text-gray-500">Las alertas de módulos bloqueados no se muestran.</p>
                </div>
              )}
            </div>
            <div className="border-t border-[#3A3A3A] px-4 py-3">
              <button
                onClick={() => setNotifications((current) => current.map((item) => (
                  enabledNotificationModules.has(item.href) ? { ...item, read: true } : item
                )))}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-300 hover:border-[#CC2229] hover:text-white transition-colors"
              >
                Marcar todas como leídas
              </button>
            </div>
          </div>
        )}
        </div>
        <div className="relative pl-2 border-l border-[#3A3A3A]">
        <button
          onClick={() => {
            setUserMenuOpen((open) => !open);
            setNotificationsOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[#1A1A1A] transition-colors"
          aria-label="Menú de usuario"
        >
          <div className="w-8 h-8 bg-[#CC2229] rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">{displayName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{displayRole}</p>
          </div>
        </button>
        {userMenuOpen && (
          <div className="absolute right-0 mt-3 w-56 bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3A3A3A]">
              <p className="text-white text-sm font-semibold">{displayName}</p>
              <p className="text-gray-500 text-xs mt-0.5">{displayRole}</p>
            </div>
            <div className="p-1">
              <Link
                href="/perfil"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                <UserCircle size={15} />
                Mi perfil
              </Link>
              <Link
                href="/configuracion"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                <Settings size={15} />
                Configuración
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-[#1A1A1A] hover:text-white transition-colors"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
