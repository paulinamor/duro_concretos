import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  completado: { label: "Completado", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  "en ruta": { label: "En ruta", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  cancelado: { label: "Cancelado", className: "border-red-500/25 bg-red-500/10 text-red-300" },
  pendiente: { label: "Pendiente", className: "border-orange-500/25 bg-orange-500/10 text-orange-300" },
  activo: { label: "Activo", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  inactivo: { label: "Inactivo", className: "border-white/10 bg-white/5 text-gray-400" },
  prospecto: { label: "Prospecto", className: "border-blue-500/25 bg-blue-500/10 text-blue-300" },
  "en riesgo": { label: "En riesgo", className: "border-orange-500/25 bg-orange-500/10 text-orange-300" },
  preventivo: { label: "Preventivo", className: "border-blue-500/25 bg-blue-500/10 text-blue-300" },
  correctivo: { label: "Correctivo", className: "border-red-500/25 bg-red-500/10 text-red-300" },
  entrada: { label: "Entrada", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  salida: { label: "Salida", className: "border-red-500/25 bg-red-500/10 text-red-300" },
  "stock bajo": { label: "Stock bajo", className: "border-orange-500/25 bg-orange-500/10 text-orange-300" },
  normal: { label: "Normal", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  ingreso: { label: "Ingreso", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  egreso: { label: "Egreso", className: "border-red-500/25 bg-red-500/10 text-red-300" },
  aprobado: { label: "Aprobado", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  revision: { label: "Revisión", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  completo: { label: "Completo", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
  registro: { label: "Registro", className: "border-blue-500/25 bg-blue-500/10 text-blue-300" },
  consulta: { label: "Consulta", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  bloqueado: { label: "Bloqueado", className: "border-white/10 bg-white/5 text-gray-400" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = statusMap[key] ?? {
    label: status,
    className: "bg-gray-800 text-gray-300 border border-gray-600",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
