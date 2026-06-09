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

const CUSTOM_SELECT_VALUE = "__duro_custom_select_value__";

function getCustomOptionKey(formTitle: string, fieldLabel: string) {
  return `duro_custom_options:${formTitle}:${fieldLabel}`;
}

function readCustomOptions(formTitle: string, fieldLabel: string) {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(getCustomOptionKey(formTitle, fieldLabel));
  if (!raw) return [];

  try {
    const options = JSON.parse(raw) as string[];
    return Array.isArray(options) ? options : [];
  } catch {
    localStorage.removeItem(getCustomOptionKey(formTitle, fieldLabel));
    return [];
  }
}

function saveCustomOption(formTitle: string, fieldLabel: string, value: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return;

  const current = readCustomOptions(formTitle, fieldLabel);
  if (current.some((item) => item.toLowerCase() === cleanValue.toLowerCase())) return;

  localStorage.setItem(
    getCustomOptionKey(formTitle, fieldLabel),
    JSON.stringify([...current, cleanValue]),
  );
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

  useEffect(() => {
    if (!open) return;

    const selects = Array.from(bodyRef.current?.querySelectorAll("select") ?? []) as HTMLSelectElement[];
    const cleanups: Array<() => void> = [];

    selects.forEach((select) => {
      const fieldLabel = select.parentElement?.querySelector("label")?.textContent?.trim();
      if (!fieldLabel) return;
      const labelText = fieldLabel;

      const existingValues = new Set(Array.from(select.options).map((option) => option.value.toLowerCase()));
      readCustomOptions(title, labelText).forEach((customOption) => {
        if (existingValues.has(customOption.toLowerCase())) return;

        const option = document.createElement("option");
        option.value = customOption;
        option.textContent = customOption;
        select.appendChild(option);
        existingValues.add(customOption.toLowerCase());
      });

      if (!Array.from(select.options).some((option) => option.value === CUSTOM_SELECT_VALUE)) {
        const option = document.createElement("option");
        option.value = CUSTOM_SELECT_VALUE;
        option.textContent = "Escribir nuevo...";
        select.appendChild(option);
      }

      function handleFocus() {
        select.dataset.previousValue = select.value;
      }

      function handleChange() {
        if (select.value !== CUSTOM_SELECT_VALUE) {
          select.dataset.previousValue = select.value;
          return;
        }

        const newValue = window.prompt(`Escribe una nueva opción para "${labelText}"`);
        const cleanValue = newValue?.trim();
        if (!cleanValue) {
          select.value = select.dataset.previousValue ?? select.options[0]?.value ?? "";
          return;
        }

        const duplicate = Array.from(select.options).some((option) => (
          option.value.toLowerCase() === cleanValue.toLowerCase()
        ));

        if (!duplicate) {
          const customOption = document.createElement("option");
          customOption.value = cleanValue;
          customOption.textContent = cleanValue;
          const customTrigger = Array.from(select.options).find((option) => option.value === CUSTOM_SELECT_VALUE);
          select.insertBefore(customOption, customTrigger ?? null);
          saveCustomOption(title, labelText, cleanValue);
        }

        select.value = cleanValue;
        select.dataset.previousValue = cleanValue;
      }

      select.addEventListener("focus", handleFocus);
      select.addEventListener("change", handleChange);
      cleanups.push(() => {
        select.removeEventListener("focus", handleFocus);
        select.removeEventListener("change", handleChange);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [open, title]);

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
    <div className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar formulario"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#181b20] shadow-2xl shadow-slate-900/15 dark:shadow-black/40">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#181b20]/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-500">Completa la información para actualizar el módulo.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-gray-400 transition-colors hover:bg-slate-100 dark:hover:bg-white/8 hover:text-slate-600 dark:hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={bodyRef} className="p-6">{children}</div>
        <div onClickCapture={handleFooterClick} className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#181b20]/95 px-6 py-4 backdrop-blur">
          {footer}
        </div>
      </div>
    </div>
  );
}
