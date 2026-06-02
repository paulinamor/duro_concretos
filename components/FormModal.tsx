"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave?: (values: Record<string, string>) => void | false | string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export default function FormModal({
  title,
  open,
  onClose,
  onSave,
  children,
  footer,
}: FormModalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const savedSignaturesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function getFormValues() {
    const values: Record<string, string> = {};
    const fields = bodyRef.current?.querySelectorAll("label") ?? [];

    fields.forEach((label) => {
      const key = label.textContent?.trim();
      const container = label.parentElement;
      const control = container?.querySelector("input, select, textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;

      if (key && control) {
        values[key] = control.value;
      }
    });

    return values;
  }

  function showErrorToast(message: string) {
    window.dispatchEvent(
      new CustomEvent("duro:toast", {
        detail: {
          type: "error",
          title: "No se pudo guardar",
          message,
        },
      })
    );
  }

  function validateForm(values: Record<string, string>) {
    const optionalFields = ["observaciones", "comentario", "notas"];
    const missingField = Object.entries(values).find(([label, value]) => {
      const normalizedLabel = label.toLowerCase();
      return !optionalFields.some((field) => normalizedLabel.includes(field)) && !value.trim();
    });

    if (missingField) {
      showErrorToast(`Falta completar el campo "${missingField[0]}".`);
      return false;
    }

    const invalidEmail = Object.entries(values).find(([label, value]) => {
      const normalizedLabel = label.toLowerCase();
      return (
        (normalizedLabel.includes("correo") || normalizedLabel.includes("email")) &&
        value.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      );
    });

    if (invalidEmail) {
      showErrorToast(`El correo en "${invalidEmail[0]}" no tiene un formato válido.`);
      return false;
    }

    return true;
  }

  function handleFooterClick(event: React.MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || !event.currentTarget.contains(button) || button.disabled) return;

    const action = button.textContent?.trim().toLowerCase() ?? "";
    if (!action.includes("cancelar")) {
      const values = getFormValues();
      if (!validateForm(values)) return;

      const signature = JSON.stringify({ title, values });
      if (savedSignaturesRef.current.has(signature)) {
        showErrorToast("Este formulario ya se guardó con la misma información.");
        return;
      }

      const saveResult = onSave?.(values);
      if (saveResult === false || typeof saveResult === "string") {
        showErrorToast(typeof saveResult === "string" ? saveResult : "Este registro ya existe o tiene información repetida.");
        return;
      }

      savedSignaturesRef.current.add(signature);

      window.dispatchEvent(
        new CustomEvent("duro:toast", {
          detail: {
            type: "success",
            message: "La información ya aparece en la pantalla principal.",
          },
        })
      );
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar formulario"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#242424] border border-[#3A3A3A] rounded-xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#3A3A3A] bg-[#242424] px-6 py-4">
          <h3 className="text-white font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="p-6">{children}</div>
        <div onClickCapture={handleFooterClick} className="sticky bottom-0 flex justify-end gap-3 border-t border-[#3A3A3A] bg-[#242424] px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}
