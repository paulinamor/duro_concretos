"use client";

import { Search, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Props = {
  /** "no-results" = buscaste algo y no hay coincidencias.
   *  "empty" = la colección está vacía (sin datos todavía). */
  type: "no-results" | "empty";
  /** Override the default message. */
  message?: string;
  /** Optional action button. */
  action?: { label: string; onClick: () => void };
  /** Custom icon — defaults to Search (no-results) or Inbox (empty). */
  icon?: LucideIcon;
  /** For dark-background table containers (sets text-gray-400 instead of text-gray-500). */
  dark?: boolean;
};

export default function EmptyState({ type, message, action, icon: Icon, dark = false }: Props) {
  const DefaultIcon = type === "no-results" ? Search : Inbox;
  const Ico = Icon ?? DefaultIcon;
  const defaultMsg =
    type === "no-results"
      ? "No se encontraron resultados para la búsqueda."
      : "Aún no hay registros. Crea el primero con el botón +";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${dark ? "bg-white/5" : "bg-slate-100"}`}>
        <Ico size={22} className={dark ? "text-gray-500" : "text-slate-400"} />
      </div>
      <p className={`text-sm max-w-xs ${dark ? "text-gray-400" : "text-slate-500"}`}>
        {message ?? defaultMsg}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-4 py-2 text-xs font-semibold text-white bg-[#CC2229] hover:bg-[#B01E24] rounded-lg transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
