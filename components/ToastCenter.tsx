"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type ToastPayload = {
  type?: "success" | "error";
  title?: string;
  message?: string;
};

export default function ToastCenter() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function handleToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      setToast({
        type: detail?.type ?? "success",
        title: detail?.title,
        message: detail?.message ?? "Se guardó correctamente",
      });
      window.clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setToast(null), 3500);
    }

    window.addEventListener("duro:toast", handleToast);

    return () => {
      window.removeEventListener("duro:toast", handleToast);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!toast) return null;

  const isError = toast.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  const title = toast.title ?? (isError ? "Revisa la información" : "Guardado correctamente");

  return (
    <div className="fixed right-4 top-4 z-[120] w-[calc(100vw-2rem)] max-w-sm" role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-white shadow-2xl ${isError ? "border-red-700/60 bg-[#2a1f1f]" : "border-green-700/50 bg-[#1f2a22]"}`}>
        <Icon className={`mt-0.5 shrink-0 ${isError ? "text-red-400" : "text-green-400"}`} size={20} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className={`mt-0.5 text-xs ${isError ? "text-red-100/80" : "text-green-100/80"}`}>{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => setToast(null)}
          className={`shrink-0 rounded-md p-1 transition-colors hover:bg-white/10 hover:text-white ${isError ? "text-red-100/70" : "text-green-100/70"}`}
          aria-label="Cerrar mensaje"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
