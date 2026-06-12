"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Bot, ChevronDown, CircleDollarSign, FileSpreadsheet, FileText, Fuel, LogOut, MapPin, Settings, Truck, User, UserCircle, Wallet } from "lucide-react";
import { MobileMenuButton } from "./Sidebar";
import { getAllowedModuleSet, getActivePlanta, getStoredSession, setActivePlanta, type Planta } from "@/lib/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface HeaderProps {
  title: string;
  onMobileMenu: () => void;
}

export default function Header({ title, onMobileMenu }: HeaderProps) {
  const router = useRouter();
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const plantaRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [plantaOpen, setPlantaOpen] = useState(false);
  const [session, setSession] = useState(() => getStoredSession());
  const [plantaActiva, setPlantaActivaState] = useState<Planta>(() => getActivePlanta());
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

  async function handleLogout() {
    setUserMenuOpen(false);
    try {
      if (auth) await signOut(auth);
    } catch {
      // ignore sign-out errors
    }
    localStorage.removeItem("duro_concretos_session");
    sessionStorage.clear();
    router.push("/");
  }

  function cleanText(value: string) {
    return value.replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getModuleExportElement() {
    const content = document.getElementById("duro-module-content");
    if (!content) return null;

    const clone = content.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button, input, select, textarea, svg, [data-export-ignore], [id^='printable']").forEach((node) => node.remove());
    return clone;
  }

  function getTextLines(element: Element) {
    const rawLines = Array.from(element.querySelectorAll("h1, h2, h3, h4, p, li, span, td"))
      .map((node) => cleanText(node.textContent ?? ""))
      .filter(Boolean);

    return rawLines.filter((line, index) => rawLines.indexOf(line) === index);
  }

  function getReportCards(content: HTMLElement) {
    const candidates = Array.from(content.querySelectorAll("a, section, article, div"))
      .filter((element) => {
        const className = element.getAttribute("class") ?? "";
        const text = cleanText(element.textContent ?? "");
        return (
          text.length >= 6 &&
          text.length <= 360 &&
          !element.querySelector("table") &&
          /rounded|border|card|shadow|bg-\[/.test(className)
        );
      });

    return candidates
      .filter((element) => !candidates.some((other) => other !== element && element.contains(other)))
      .map((element) => {
        const lines = getTextLines(element).slice(0, 5);
        const [titleLine, ...detailLines] = lines;
        return {
          title: titleLine || cleanText(element.textContent ?? ""),
          details: detailLines.length > 0 ? detailLines : lines.slice(1),
        };
      })
      .filter((card) => card.title)
      .filter((card, index, all) => all.findIndex((item) => item.title === card.title && item.details.join("|") === card.details.join("|")) === index)
      .slice(0, 24);
  }

  function getReportListSections(content: HTMLElement) {
    return Array.from(content.querySelectorAll("section"))
      .filter((section) => !section.querySelector("table"))
      .map((section) => {
        const title = cleanText(section.querySelector("h2, h3")?.textContent ?? "");
        const body = Array.from(section.children).find((child) => (
          child !== section.querySelector("div") &&
          child.children.length >= 2 &&
          cleanText(child.textContent ?? "").length > 20
        ));
        const rowSource = body ?? section;
        const rows = Array.from(rowSource.children)
          .filter((child) => !child.querySelector("h2, h3"))
          .map((child) => getTextLines(child).slice(0, 4))
          .filter((lines) => lines.length >= 2);

        return {
          title,
          rows,
          columns: Math.max(2, ...rows.map((row) => row.length)),
        };
      })
      .filter((section) => section.title && section.rows.length > 0)
      .filter((section, index, all) => all.findIndex((item) => item.title === section.title) === index);
  }

  function getReportTables(content: HTMLElement) {
    return Array.from(content.querySelectorAll("table")).map((table, tableIndex) => {
      const nearestSection = table.closest("section, article, div");
      const sectionTitle = cleanText(nearestSection?.querySelector("h2, h3")?.textContent ?? "");
      const rows = Array.from(table.querySelectorAll("tr"))
        .map((row) => {
          const cells = Array.from(row.querySelectorAll("th, td"))
            .map((cell) => {
              const tag = cell.tagName.toLowerCase() === "th" ? "th" : "td";
              return `<${tag}>${escapeHtml(cleanText(cell.textContent ?? ""))}</${tag}>`;
            })
            .join("");

          return cells ? `<tr>${cells}</tr>` : "";
        })
        .join("");

      return {
        title: sectionTitle || `Tabla ${tableIndex + 1}`,
        rows,
      };
    }).filter((table) => table.rows);
  }

  function buildCardGrid(cards: Array<{ title: string; details: string[] }>, forExcel: boolean) {
    if (cards.length === 0) return "";

    if (forExcel) {
      const rows = [];
      for (let index = 0; index < cards.length; index += 3) {
        const group = cards.slice(index, index + 3);
        rows.push(`
          <tr>
            ${group.map((card) => `
              <td class="card-cell">
                <strong>${escapeHtml(card.title)}</strong>
                ${card.details.length > 0 ? `<br />${escapeHtml(card.details.join(" · "))}` : ""}
              </td>
            `).join("")}
            ${Array.from({ length: 3 - group.length }).map(() => "<td></td>").join("")}
          </tr>
        `);
      }

      return `
        <h2>Resumen del módulo</h2>
        <table class="cards-table">
          ${rows.join("")}
        </table>
      `;
    }

    return `
      <h2>Resumen del módulo</h2>
      <div class="cards-grid">
        ${cards.map((card) => `
          <div class="report-card">
            <p class="card-title">${escapeHtml(card.title)}</p>
            ${card.details.map((detail) => `<p class="card-detail">${escapeHtml(detail)}</p>`).join("")}
          </div>
        `).join("")}
      </div>
    `;
  }

  function buildProfessionalReportHtml(forExcel = false) {
    const content = getModuleExportElement();
    if (!content) return "";

    const exportedAt = new Date().toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const cards = getReportCards(content);
    const tables = getReportTables(content);
    const listSections = getReportListSections(content);
    const fallbackLines = getTextLines(content)
      .filter(Boolean)
      .filter((line, index, all) => all.indexOf(line) === index)
      .slice(0, 80);

    const tableMarkup = [
      ...listSections.map((section) => {
        const headers = section.columns === 2
          ? ["Concepto", "Detalle"]
          : Array.from({ length: section.columns }).map((_, index) => (
            index === 0 ? "Concepto" : `Dato ${index}`
          ));

        return `
          <section class="report-section">
            <h2>${escapeHtml(section.title)}</h2>
            <table class="data-table">
              <tr>
                ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
              </tr>
              ${section.rows.map((row) => `
                <tr>
                  ${Array.from({ length: section.columns }).map((_, index) => (
                    `<td>${escapeHtml(row[index] ?? "")}</td>`
                  )).join("")}
                </tr>
              `).join("")}
            </table>
          </section>
        `;
      }),
      ...tables.map((table) => `
      <section class="report-section">
        <h2>${escapeHtml(table.title)}</h2>
        <table class="data-table">${table.rows}</table>
      </section>
    `),
    ].join("");

    return `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              margin: 0;
              background: #F4F7FB;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              padding: 28px;
            }
            .report-shell {
              max-width: 1180px;
              margin: 0 auto;
            }
            .report-header {
              background: #0B1220;
              color: #FFFFFF;
              border-radius: 18px;
              padding: 24px 28px;
              margin-bottom: 22px;
            }
            .eyebrow {
              color: #CBD5E1;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 2px;
              margin: 0 0 8px;
              text-transform: uppercase;
            }
            h1 {
              font-size: 28px;
              line-height: 1.15;
              margin: 0;
            }
            .meta {
              color: #CBD5E1;
              font-size: 13px;
              margin: 8px 0 0;
            }
            h2 {
              color: #111827;
              font-size: 16px;
              margin: 24px 0 12px;
            }
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 14px;
              margin-bottom: 18px;
            }
            .report-card {
              background: #FFFFFF;
              border: 1px solid #D8E0EA;
              border-radius: 16px;
              padding: 18px;
              min-height: 96px;
              box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
              break-inside: avoid;
            }
            .card-title {
              color: #111827;
              font-size: 15px;
              font-weight: 700;
              margin: 0 0 8px;
            }
            .card-detail {
              color: #64748B;
              font-size: 13px;
              line-height: 1.35;
              margin: 3px 0;
            }
            .cards-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 10px;
              margin-bottom: 18px;
            }
            .card-cell {
              width: 33%;
              background: #FFFFFF;
              border: 1px solid #D8E0EA;
              color: #111827;
              padding: 14px;
              mso-number-format: "\\@";
              vertical-align: top;
            }
            .report-section {
              background: #FFFFFF;
              border: 1px solid #D8E0EA;
              border-radius: 16px;
              padding: 18px;
              margin-top: 18px;
              break-inside: avoid;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .data-table th {
              background: #0B1220;
              color: #FFFFFF;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .data-table td,
            .data-table th {
              border: 1px solid #D8E0EA;
              padding: 9px 10px;
              text-align: left;
              vertical-align: top;
              mso-number-format: "\\@";
            }
            .data-table td {
              background: #FFFFFF;
              color: #334155;
            }
            .data-table tr:nth-child(even) td {
              background: #F8FAFC;
            }
            .fallback-table {
              width: 100%;
              border-collapse: collapse;
              background: #FFFFFF;
            }
            .fallback-table th {
              background: #0B1220;
              color: #FFFFFF;
            }
            .fallback-table th,
            .fallback-table td {
              border: 1px solid #D8E0EA;
              padding: 9px 10px;
              text-align: left;
            }
            @media print {
              body {
                background: #FFFFFF;
                padding: 16px;
              }
              .report-header {
                border-radius: 0;
              }
              .cards-grid {
                grid-template-columns: repeat(3, 1fr);
              }
            }
          </style>
        </head>
        <body>
          <main class="report-shell">
            <header class="report-header">
              <p class="eyebrow">Duro Concretos · Reporte ${forExcel ? "Excel" : "PDF"}</p>
              <h1>${escapeHtml(title)}</h1>
              <p class="meta">Exportado ${escapeHtml(exportedAt)}</p>
            </header>
            ${buildCardGrid(cards, forExcel)}
            ${tableMarkup || `
              <section class="report-section">
                <h2>Información visible</h2>
                <table class="fallback-table">
                  <tr><th>Contenido</th></tr>
                  ${fallbackLines.map((line) => `<tr><td>${escapeHtml(line)}</td></tr>`).join("")}
                </table>
              </section>
            `}
          </main>
        </body>
      </html>
    `;
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
    const html = buildProfessionalReportHtml(true);
    if (!html) return;
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "reporte"}.xls`;
    downloadFile(filename, html, "application/vnd.ms-excel;charset=utf-8");
  }

  function exportCurrentModulePdf() {
    const html = buildProfessionalReportHtml(false);
    if (!html) return;
    const printable = window.open("", "_blank", "width=1200,height=800");
    if (!printable) return;

    printable.document.write(html.replace("</body>", "<script>window.onload = () => window.print();</script></body>"));
    printable.document.close();
  }

  useEffect(() => {
    function handleSessionUpdate() {
      setSession(getStoredSession());
      setPlantaActivaState(getActivePlanta());
    }

    function handleOutsideClick(event: MouseEvent) {
      if (
        headerActionsRef.current &&
        !headerActionsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
      if (
        plantaRef.current &&
        !plantaRef.current.contains(event.target as Node)
      ) {
        setPlantaOpen(false);
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
  const isMultiPlanta = session?.planta === "Todas";
  const plantaDisplay = isMultiPlanta ? plantaActiva : (session?.planta ?? null);
  const plantaColor = plantaDisplay === "Allende"
    ? "border-blue-500/60 text-blue-400"
    : plantaDisplay === "Pesquería"
      ? "border-emerald-500/60 text-emerald-400"
      : "border-slate-500/60 text-slate-400";

  function plantaItemActiveCls(p: Planta) {
    if (p === "Allende") return "bg-blue-500/15 text-blue-300";
    if (p === "Pesquería") return "bg-emerald-500/15 text-emerald-300";
    return "bg-white/8 text-slate-200";
  }

  return (
    <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#0B1220] px-4 py-3">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onMobileMenu} />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {plantaDisplay && (
          <div className="relative hidden sm:block" ref={plantaRef}>
            {isMultiPlanta ? (
              <>
                <button
                  onClick={() => { setPlantaOpen((v) => !v); setNotificationsOpen(false); setUserMenuOpen(false); }}
                  className={`flex items-center gap-1.5 rounded-full border bg-transparent px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/5 ${plantaColor}`}
                >
                  <MapPin size={11} />
                  {plantaDisplay}
                  <ChevronDown size={11} className={`transition-transform ${plantaOpen ? "rotate-180" : ""}`} />
                </button>
                {plantaOpen && (
                  <div className="absolute left-0 mt-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-[#0F172A] shadow-xl shadow-black/50">
                    <div className="px-3 py-2.5 border-b border-slate-700/60">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Vista de planta</p>
                    </div>
                    <div className="p-1.5 space-y-1">
                      {(["Todas", "Pesquería", "Allende"] as Planta[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => { setActivePlanta(p); setPlantaActivaState(p); setPlantaOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            plantaActiva === p
                              ? plantaItemActiveCls(p)
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          }`}
                        >
                          <MapPin size={13} className={plantaActiva === p ? "opacity-100" : "opacity-40"} />
                          {p}
                          {plantaActiva === p && (
                            <svg className="ml-auto w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${plantaColor}`}>
                <MapPin size={11} />
                {plantaDisplay}
              </span>
            )}
          </div>
        )}
      </div>
      <div ref={headerActionsRef} className="flex items-center gap-2">
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
