"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getActivePlanta } from "@/lib/auth";

/**
 * Muestra un banner de advertencia cuando la planta activa es "Todas"
 * y pasa `ok=false` al children para que el botón pueda deshabilitarse.
 *
 * Uso:
 *   <PlantaRequired>
 *     {(ok) => (
 *       <button disabled={!ok} onClick={() => ok && setShowDrawer(true)}>
 *         + Nuevo registro
 *       </button>
 *     )}
 *   </PlantaRequired>
 */
export default function PlantaRequired({
  children,
}: {
  children: (ok: boolean) => React.ReactNode;
}) {
  // null = not yet mounted (SSR). Avoid hydration mismatch by reading
  // localStorage only after mount.
  const [planta, setPlanta] = useState<string | null>(null);

  useEffect(() => {
    setPlanta(getActivePlanta());
    const sync = () => setPlanta(getActivePlanta());
    window.addEventListener("duro:session-updated", sync);
    return () => window.removeEventListener("duro:session-updated", sync);
  }, []);

  // Before mount: render children enabled (matches SSR output, no flash)
  if (planta === null) return <>{children(true)}</>;

  const ok = planta !== "Todas";

  return (
    <>
      {!ok && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            Selecciona{" "}
            <strong className="text-amber-300">Allende</strong> o{" "}
            <strong className="text-amber-300">Pesquería</strong> en el
            selector de planta para crear registros.
          </span>
        </div>
      )}
      {children(ok)}
    </>
  );
}
