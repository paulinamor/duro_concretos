"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bot, CircleDollarSign, FileSpreadsheet, FileText, Fuel, LogOut, Settings, Truck, User, UserCircle, Wallet } from "lucide-react";
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

  function getModuleExportMarkup() {
    const content = document.getElementById("duro-module-content");
    if (!content) return "";

    const clone = content.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button, input, select, textarea, svg, [data-export-ignore]").forEach((node) => node.remove());
    return clone.innerHTML;
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportCurrentModuleExcel() {
    const markup = getModuleExportMarkup();
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <h1>${title}</h1>
          <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
          ${markup}
        </body>
      </html>
    `;
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "reporte"}.xls`;
    downloadFile(filename, html, "application/vnd.ms-excel;charset=utf-8");
  }

  function exportCurrentModulePdf() {
    const markup = getModuleExportMarkup();
    const printable = window.open("", "_blank", "width=1200,height=800");
    if (!printable) return;

    printable.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            .meta { margin: 0 0 20px; color: #6B7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #E5E7EB; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #111827; color: white; }
            div { break-inside: avoid; }
            [class] { box-shadow: none !important; }
            @media print { body { padding: 16px; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="meta">Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
          ${markup}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printable.document.close();
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
    <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#0B1220] px-4 py-3">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMobileMenu} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div ref={headerActionsRef} className="flex items-center gap-2">
        <div data-export-ignore className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={exportCurrentModuleExcel}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-green-500/50 hover:text-green-300"
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
          <button
            type="button"
            onClick={exportCurrentModulePdf}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-[#CC2229]/60 hover:text-[#CC2229]"
          >
            <FileText size={15} />
            PDF
          </button>
        </div>
        <div className="relative">
        <button
          onClick={() => {
            setNotificationsOpen((open) => !open);
            setUserMenuOpen(false);
          }}
          className="relative rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Notificaciones"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#CC2229] rounded-full" />
          )}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-950 font-semibold text-sm">Notificaciones</p>
                  <p className="text-slate-500 text-xs mt-0.5">Alertas operativas del ERP</p>
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
                      ? "border-slate-200 bg-slate-50 opacity-70"
                      : "border-slate-200 bg-white hover:border-[#CC2229]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      item.read ? "bg-slate-100 text-slate-500" : "bg-[#CC2229]/10 text-[#CC2229]"
                    }`}>
                      <item.icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-950">{item.title}</p>
                        {!item.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CC2229] shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.detail}</p>
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {item.tag}
                      </span>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4">
                  <p className="text-sm font-medium text-slate-950">Sin notificaciones activas</p>
                  <p className="mt-1 text-xs text-slate-500">Las alertas de módulos bloqueados no se muestran.</p>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <button
                onClick={() => setNotifications((current) => current.map((item) => (
                  enabledNotificationModules.has(item.href) ? { ...item, read: true } : item
                )))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-[#CC2229] hover:text-[#CC2229]"
              >
                Marcar todas como leídas
              </button>
            </div>
          </div>
        )}
        </div>
        <div className="relative border-l border-white/10 pl-2">
        <button
          onClick={() => {
            setUserMenuOpen((open) => !open);
            setNotificationsOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/10"
          aria-label="Menú de usuario"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CC2229] shadow-lg shadow-[#CC2229]/20">
            <User size={16} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">{displayName}</p>
            <p className="text-xs text-slate-300 mt-0.5">{displayRole}</p>
          </div>
        </button>
        {userMenuOpen && (
          <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-slate-950 text-sm font-semibold">{displayName}</p>
              <p className="text-slate-500 text-xs mt-0.5">{displayRole}</p>
            </div>
            <div className="p-1">
              <Link
                href="/perfil"
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                <UserCircle size={15} />
                Mi perfil
              </Link>
              <Link
                href="/configuracion"
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                <Settings size={15} />
                Configuración
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
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
