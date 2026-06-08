import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  completado:    { label: "Completado",    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  activo:        { label: "Activo",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  entrada:       { label: "Entrada",       className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  ingreso:       { label: "Ingreso",       className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  aprobado:      { label: "Aprobado",      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  completo:      { label: "Completo",      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  normal:        { label: "Normal",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25" },
  "en ruta":     { label: "En ruta",       className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25" },
  pendiente:     { label: "Pendiente",     className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25" },
  revision:      { label: "Revisión",      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25" },
  "en riesgo":   { label: "En riesgo",     className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25" },
  "stock bajo":  { label: "Stock bajo",    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/25" },
  cancelado:     { label: "Cancelado",     className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25" },
  correctivo:    { label: "Correctivo",    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25" },
  salida:        { label: "Salida",        className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25" },
  egreso:        { label: "Egreso",        className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25" },
  prospecto:     { label: "Prospecto",     className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25" },
  preventivo:    { label: "Preventivo",    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25" },
  registro:      { label: "Registro",      className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25" },
  consulta:      { label: "Consulta",      className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25" },
  inactivo:      { label: "Inactivo",      className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10" },
  bloqueado:     { label: "Bloqueado",     className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = statusMap[key] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
