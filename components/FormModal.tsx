"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface FormModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSave?: (values: Record<string, string>) => void | false | string | Promise<void | false | string>;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const CUSTOM_SELECT_VALUE = "__duro_custom_select_value__";
const CUSTOM_INPUT_CLASS =
  "mt-2 hidden w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#CC2229]";

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

function getCustomInput(select: HTMLSelectElement) {
  return select.parentElement?.querySelector(
    `input[data-custom-select-for="${select.dataset.customFieldKey ?? ""}"]`,
  ) as HTMLInputElement | null;
}

function showCustomInput(select: HTMLSelectElement, show: boolean) {
  const input = getCustomInput(select);
  if (!input) return;

  input.classList.toggle("hidden", !show);
  input.disabled = !show;
  input.required = show;

  if (show) {
    input.focus();
  } else {
    input.value = "";
  }
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
      const customFieldKey = `${title}:${labelText}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      select.dataset.customFieldKey = customFieldKey;

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

      let customInput = getCustomInput(select);
      if (!customInput) {
        customInput = document.createElement("input");
        customInput.type = "text";
        customInput.disabled = true;
        customInput.className = CUSTOM_INPUT_CLASS;
        customInput.placeholder = `Escribe ${labelText.toLowerCase()}`;
        customInput.dataset.customSelectFor = customFieldKey;
        select.insertAdjacentElement("afterend", customInput);
      }

      function handleFocus() {
        select.dataset.previousValue = select.value;
      }

      function handleChange() {
        if (select.value !== CUSTOM_SELECT_VALUE) {
          select.dataset.previousValue = select.value;
          showCustomInput(select, false);
          return;
        }

        showCustomInput(select, true);
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
        if (control instanceof HTMLSelectElement && control.value === CUSTOM_SELECT_VALUE) {
          values[key] = getCustomInput(control)?.value.trim() ?? "";
        } else {
          values[key] = control.value;
        }
      }
    });

    return values;
  }

  function persistCustomSelectOptions(values: Record<string, string>) {
    const selects = Array.from(bodyRef.current?.querySelectorAll("select") ?? []) as HTMLSelectElement[];

    selects.forEach((select) => {
      if (select.value !== CUSTOM_SELECT_VALUE) return;

      const fieldLabel = select.parentElement?.querySelector("label")?.textContent?.trim();
      if (!fieldLabel) return;

      const customValue = values[fieldLabel]?.trim();
      if (!customValue) return;

      const duplicate = Array.from(select.options).some((option) => (
        option.value.toLowerCase() === customValue.toLowerCase()
      ));

      if (!duplicate) {
        const customOption = document.createElement("option");
        customOption.value = customValue;
        customOption.textContent = customValue;
        const customTrigger = Array.from(select.options).find((option) => option.value === CUSTOM_SELECT_VALUE);
        select.insertBefore(customOption, customTrigger ?? null);
      }

      saveCustomOption(title, fieldLabel, customValue);
      select.value = customValue;
      select.dataset.previousValue = customValue;
      showCustomInput(select, false);
    });
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

  async function handleFooterClick(event: React.MouseEvent<HTMLDivElement>) {
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

      const saveResult = await Promise.resolve(onSave?.(values));
      if (saveResult === false || typeof saveResult === "string") {
        showErrorToast(typeof saveResult === "string" ? saveResult : "Este registro ya existe o tiene información repetida.");
        return;
      }

      persistCustomSelectOptions(values);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Cerrar formulario"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 my-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-2xl shadow-gray-900/20">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 bg-white/98 px-7 py-5 backdrop-blur">
          <h3 className="text-[15px] font-semibold tracking-tight text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <div ref={bodyRef} className="px-7 py-6 space-y-6">{children}</div>
        <div onClickCapture={handleFooterClick} className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white/98 px-7 py-4 backdrop-blur">
          {footer}
        </div>
      </div>
    </div>
  );
}
