import { useEffect, useState } from "react";

type Props = {
  label?: string;
  dark?:  boolean; // true when container has a dark background
};

export default function ModuleLoading({ label = "Cargando datos…", dark = false }: Props) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-28">
      <svg className="h-9 w-9 animate-spin text-[#CC2229]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className={`text-sm text-center max-w-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
        {slow ? "Esto puede tomar unos segundos…" : label}
      </p>
    </div>
  );
}
