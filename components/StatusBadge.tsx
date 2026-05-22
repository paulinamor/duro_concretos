interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  completado: { label: "Completado", className: "bg-green-900/40 text-green-400 border border-green-700" },
  "en ruta": { label: "En ruta", className: "bg-yellow-900/40 text-yellow-400 border border-yellow-700" },
  cancelado: { label: "Cancelado", className: "bg-red-900/40 text-red-400 border border-red-700" },
  pendiente: { label: "Pendiente", className: "bg-orange-900/40 text-orange-400 border border-orange-700" },
  activo: { label: "Activo", className: "bg-green-900/40 text-green-400 border border-green-700" },
  inactivo: { label: "Inactivo", className: "bg-gray-800 text-gray-400 border border-gray-700" },
  preventivo: { label: "Preventivo", className: "bg-blue-900/40 text-blue-400 border border-blue-700" },
  correctivo: { label: "Correctivo", className: "bg-red-900/40 text-red-400 border border-red-700" },
  entrada: { label: "Entrada", className: "bg-green-900/40 text-green-400 border border-green-700" },
  salida: { label: "Salida", className: "bg-red-900/40 text-red-400 border border-red-700" },
  "stock bajo": { label: "Stock bajo", className: "bg-orange-900/40 text-orange-400 border border-orange-700" },
  normal: { label: "Normal", className: "bg-green-900/40 text-green-400 border border-green-700" },
  ingreso: { label: "Ingreso", className: "bg-green-900/40 text-green-400 border border-green-700" },
  egreso: { label: "Egreso", className: "bg-red-900/40 text-red-400 border border-red-700" },
  aprobado: { label: "Aprobado", className: "bg-green-900/40 text-green-400 border border-green-700" },
  revision: { label: "Revisión", className: "bg-yellow-900/40 text-yellow-400 border border-yellow-700" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = statusMap[key] ?? {
    label: status,
    className: "bg-gray-800 text-gray-300 border border-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
