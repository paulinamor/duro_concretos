type ValidationResult = { valid: boolean; errors: Record<string, string> };

/** Validate required string fields. Returns { valid, errors }. */
export function validateRequired(
  values: Record<string, string | number | null | undefined>,
  required: string[],
): ValidationResult {
  const errors: Record<string, string> = {};
  for (const field of required) {
    const val = values[field];
    if (val === null || val === undefined || String(val).trim() === "") {
      errors[field] = "Campo requerido";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Validate a single positive number field. */
export function validatePositive(
  values: Record<string, string | number | null | undefined>,
  field: string,
): string | null {
  const raw = values[field];
  if (raw === null || raw === undefined || String(raw).trim() === "") return "Campo requerido";
  const n = Number(String(raw).replace(/[$,]/g, ""));
  if (isNaN(n) || n <= 0) return "Debe ser mayor a 0";
  return null;
}

/** Validate a date string is not empty and is a valid date. */
export function validateDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return "Fecha requerida";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Fecha inválida";
  return null;
}

/** RFC format: 3-4 letters + 6 digits + optional 3 alphanumeric. */
export function validateRFC(value: string | null | undefined): string | null {
  if (!value?.trim()) return "RFC requerido";
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(value.trim())) return "Formato inválido (ej: ABCD123456XY0)";
  return null;
}

/** Run multiple validators and merge errors. */
export function mergeErrors(
  ...results: Array<{ field: string; error: string | null }>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { field, error } of results) {
    if (error) errors[field] = error;
  }
  return errors;
}
