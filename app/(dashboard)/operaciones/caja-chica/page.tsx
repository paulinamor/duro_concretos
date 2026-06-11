"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GastoCajaChica {
  folio: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  monto: number;
  comprobante: string;
  comprobanteEstado: string;
  responsable: string;
  autorizadoPor: string;
  estado: string;
}


const fondoTotal = 5000;
const puntoReposicion = 1500;
const PIE_COLORS = ["#CC2229", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const tooltipStyle = {
  backgroundColor: "#242424",
  border: "1px solid #3A3A3A",
  borderRadius: "8px",
  color: "#fff",
};

export default function CajaChicaPage() {
  const [gastos, setGastos] = useState<GastoCajaChica[]>([]);

  useEffect(() => {
    getCollectionDocs<GastoCajaChica>(COLLECTIONS.cajaChica).then(setGastos);
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [showReposicion, setShowReposicion] = useState(false);
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [query, setQuery] = useState("");

  const gastado = gastos.filter(g => g.estado === "Aprobado").reduce((s, g) => s + g.monto, 0);
  const disponible = fondoTotal - gastado;
  const porcentajeGastado = Math.round((gastado / fondoTotal) * 100);
  const comprobantesPendientes = gastos.filter(g => g.comprobanteEstado === "Pendiente").length;
  const gastosRevision = gastos.filter(g => g.estado === "Revision").length;
  const montoRevision = gastos.filter(g => g.estado === "Revision").reduce((s, g) => s + g.monto, 0);
  const requiereReposicion = disponible <= puntoReposicion;
  const categorias = gastos.reduce((acc: Record<string, number>, g) => {
    acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto;
    return acc;
  }, {});
  const pieData = Object.entries(categorias).map(([name, value]) => ({ name, value }));
  const categoriasFiltro = ["Todas", ...Array.from(new Set(gastos.map((g) => g.categoria)))];
  const estadosFiltro = ["Todos", "Aprobado", "Revision"];
  const filtered = gastos.filter((gasto) => {
    const term = query.toLowerCase();
    return (
      (filterEstado === "Todos" || gasto.estado === filterEstado) &&
      (filterCategoria === "Todas" || gasto.categoria === filterCategoria) &&
      (
        gasto.folio.toLowerCase().includes(term) ||
        gasto.descripcion.toLowerCase().includes(term) ||
        gasto.responsable.toLowerCase().includes(term) ||
        gasto.comprobante.toLowerCase().includes(term)
      )
    );
  });

  async function handleSave(values: Record<string, string>) {
    const id = Date.now().toString();
    const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const monto = Number(values["Monto ($)"]?.replace(/[$,]/g, "") || 0);
    const newGasto: GastoCajaChica = {
      folio: `CC-${id}`,
      fecha,
      descripcion: values.Descripción || "Material de limpieza oficina",
      categoria: values.Categoría || "Oficina",
      monto,
      comprobante: values["No. Comprobante"] || "Ticket",
      comprobanteEstado: values.Comprobante || "Pendiente",
      responsable: values.Responsable || "Admin",
      autorizadoPor: values.Autoriza || "Admin",
      estado: "Revision",
    };

    setGastos((current) => [newGasto, ...current]);
    await upsertDocument(COLLECTIONS.cajaChica, id, newGasto);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Control de gastos menores y fondo</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReposicion(true)}
            className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Reposición de Fondo
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Registrar Gasto
          </button>
        </div>
      </div>

      {/* Fund Status Card */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Estado del fondo</p>
            <h2 className="text-white font-bold text-2xl flex items-center gap-2">
              <Wallet className="text-[#CC2229]" size={24} />
              ${fondoTotal.toLocaleString()} MXN
            </h2>
            <p className="text-gray-500 text-xs mt-1">Fondo asignado mensual</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-red-400 font-bold text-xl">${gastado.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Gastado</p>
            </div>
            <div className="text-center">
              <p className="text-green-400 font-bold text-xl">${disponible.toLocaleString()}</p>
              <p className="text-gray-500 text-xs">Disponible</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#1A1A1A] rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-[#CC2229] transition-all duration-500"
            style={{ width: `${porcentajeGastado}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs mt-2">{porcentajeGastado}% del fondo utilizado</p>
        {requiereReposicion && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-orange-700 bg-orange-900/20 px-3 py-2 text-sm text-orange-300">
            <AlertTriangle size={16} />
            Fondo por debajo del punto de reposición (${puntoReposicion.toLocaleString()} MXN)
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Gastos en revisión" value={String(gastosRevision)} icon={Clock} iconColor="text-orange-400" subtitle={`$${montoRevision.toLocaleString()} pendientes`} />
        <KPICard title="Comprobantes pendientes" value={String(comprobantesPendientes)} icon={FileText} iconColor="text-yellow-400" />
        <KPICard title="Gastos aprobados" value={String(gastos.filter(g => g.estado === "Aprobado").length)} icon={CheckCircle2} iconColor="text-green-400" />
        <KPICard title="Arqueo del fondo" value="$5,000" icon={ShieldCheck} iconColor="text-blue-400" subtitle="Sin diferencias registradas" />
      </div>

      <FormModal
        open={showForm}
        title="Registrar gasto de caja chica"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar</button>
          </>
        }
      >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Categoría</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Oficina", "Consumibles", "Transporte", "Mantenimiento", "Representación", "Seguridad"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto ($)</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[120, 210, 340, 380, 450, 620, 700, 890].map((monto) => <option key={monto}>${monto.toLocaleString()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">No. Comprobante</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Ticket", "Factura", "Nota de venta", "Recibo interno"].map((comprobante) => <option key={comprobante}>{comprobante}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Responsable</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Ana López", "Carlos Ortiz", "José Martínez", "Admin"].map((responsable) => <option key={responsable}>{responsable}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Material de limpieza oficina", "Café y consumibles comedor", "Papelería e impresión", "Gasolina vehículo administrativo", "Herramientas menores", "Comida reunión con cliente"].map((descripcion) => <option key={descripcion}>{descripcion}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Autoriza</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Admin", "Dirección", "Mantenimiento", "Seguridad"].map((autoriza) => <option key={autoriza}>{autoriza}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Comprobante</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Validado</option>
                <option>Pendiente</option>
              </select>
            </div>
          </div>
      </FormModal>

      <FormModal
        open={showReposicion}
        title="Solicitar reposición de fondo"
        onClose={() => setShowReposicion(false)}
        footer={
          <>
            <button onClick={() => setShowReposicion(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Solicitar reposición</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fondo asignado</label>
            <input value={`$${fondoTotal.toLocaleString()}`} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Disponible</label>
            <input value={`$${disponible.toLocaleString()}`} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Monto a reponer</label>
            <input value={`$${gastado.toLocaleString()}`} readOnly className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">Observaciones</label>
            <input placeholder="Notas para autorización de reposición" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
        </div>
      </FormModal>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar folio, comprobante o responsable"
            className="w-72 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {estadosFiltro.map((estado) => <option key={estado}>{estado}</option>)}
        </select>
        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {categoriasFiltro.map((categoria) => <option key={categoria}>{categoria}</option>)}
        </select>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} gastos</span>
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie chart */}
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Gastos por categoría</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]} />
              <Legend formatter={(v) => <span className="text-gray-300 text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Gastos registrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Folio", "Fecha", "Descripción", "Categoría", "Monto", "Comprobante", "Responsable", "Autoriza", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {filtered.map((g) => (
                  <tr key={g.folio} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-[#CC2229] font-mono text-xs">{g.folio}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{g.fecha}</td>
                    <td className="px-4 py-3 text-gray-200">{g.descripcion}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{g.categoria}</td>
                    <td className="px-4 py-3 text-white font-semibold">${g.monto.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-gray-400 text-xs font-mono">{g.comprobante}</p>
                        <StatusBadge status={g.comprobanteEstado} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{g.responsable}</td>
                    <td className="px-4 py-3 text-gray-400">{g.autorizadoPor}</td>
                    <td className="px-4 py-3"><StatusBadge status={g.estado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-xs bg-[#1A1A1A] border border-[#3A3A3A] hover:border-green-500 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors">
                          Aprobar
                        </button>
                        <button className="text-xs bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors">
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
