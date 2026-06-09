interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; dot: string; text: string }> = {
  completado:   { label: "Completado",   dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  activo:       { label: "Activo",       dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  entrada:      { label: "Entrada",      dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  ingreso:      { label: "Ingreso",      dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  aprobado:     { label: "Aprobado",     dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  completo:     { label: "Completo",     dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  normal:       { label: "Normal",       dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  "en ruta":    { label: "En ruta",      dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  pendiente:    { label: "Pendiente",    dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  revision:     { label: "Revisión",     dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  "en riesgo":  { label: "En riesgo",    dot: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400" },
  "stock bajo": { label: "Stock bajo",   dot: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400" },
  cancelado:    { label: "Cancelado",    dot: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
  correctivo:   { label: "Correctivo",   dot: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
  salida:       { label: "Salida",       dot: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
  egreso:       { label: "Egreso",       dot: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
  prospecto:    { label: "Prospecto",    dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400" },
  preventivo:   { label: "Preventivo",   dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400" },
  registro:     { label: "Registro",     dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400" },
  consulta:     { label: "Consulta",     dot: "bg-violet-500",  text: "text-violet-600 dark:text-violet-400" },
  inactivo:     { label: "Inactivo",     dot: "bg-slate-400",   text: "text-slate-500 dark:text-gray-400" },
  bloqueado:    { label: "Bloqueado",    dot: "bg-slate-400",   text: "text-slate-500 dark:text-gray-400" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = statusMap[key] ?? {
    label: status,
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-gray-400",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}
