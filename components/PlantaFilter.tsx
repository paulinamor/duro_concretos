"use client";
import { useEffect, useState } from "react";
import { getActivePlanta, setActivePlanta } from "@/lib/auth";
import type { Planta } from "@/lib/auth";

const OPCIONES: Planta[] = ["Todas", "Allende", "Pesquería"];

const activeCls: Record<Planta, string> = {
  Todas:     "bg-[#CC2229] text-white shadow shadow-red-900/40",
  Allende:   "bg-blue-600  text-white shadow shadow-blue-900/40",
  Pesquería: "bg-emerald-600 text-white shadow shadow-emerald-900/40",
};
const hoverCls: Record<Planta, string> = {
  Todas:     "hover:text-red-400",
  Allende:   "hover:text-blue-400",
  Pesquería: "hover:text-emerald-400",
};

interface Props {
  /** Controlled mode: pass value + onChange to manage locally (shows all-plant data). */
  value?: Planta;
  onChange?: (p: Planta) => void;
  /** When true, switching also updates the global session plantaActiva. Default: true when uncontrolled. */
  global?: boolean;
  /** Show "Todas" option (default true) */
  showTodas?: boolean;
}

export default function PlantaFilter({ value, onChange, global: isGlobal, showTodas = true }: Props) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [local, setLocal] = useState<Planta>(() => getActivePlanta());

  useEffect(() => {
    if (isControlled) return;
    const sync = () => setLocal(getActivePlanta());
    window.addEventListener("duro:session-updated", sync);
    return () => window.removeEventListener("duro:session-updated", sync);
  }, [isControlled]);

  const active = isControlled ? value : local;

  function handleClick(p: Planta) {
    if (isControlled) {
      onChange!(p);
    } else {
      setLocal(p);
    }
    if (!isControlled || isGlobal) {
      setActivePlanta(p);
    }
  }

  const opciones = showTodas ? OPCIONES : OPCIONES.filter((p) => p !== "Todas");

  return (
    <div className="flex items-center bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl p-1 gap-0.5 shrink-0">
      {opciones.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => handleClick(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
            active === p ? activeCls[p] : `text-gray-500 ${hoverCls[p]}`
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
