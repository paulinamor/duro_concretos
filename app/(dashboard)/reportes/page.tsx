import Link from "next/link";
import { BarChart3, CalendarClock, CircleDollarSign, FileText, TrendingUp, Truck } from "lucide-react";
import { automationRules } from "@/lib/automations";
import { clientesEstadoCuenta, generarEstadoCuentaCliente } from "@/lib/clientStatements";
import { crmOpportunities } from "@/lib/crmPipeline";
import { disponibilidadProgramada } from "@/lib/disponibilidadCargas";
import { getSalesClientSummaries, salesClientsBase } from "@/lib/salesClients";
import { viajesIniciales } from "@/lib/viajes";

function currency(value: number) {
  return `$${Math.round(value).toLocaleString("es-MX")}`;
}

const completedTrips = viajesIniciales.filter((item) => item.estado === "Completado");
const totalM3 = completedTrips.reduce((sum, item) => sum + item.m3, 0);
const totalVentas = completedTrips.reduce((sum, item) => sum + item.total, 0);
const pipelineTotal = crmOpportunities.reduce((sum, item) => sum + item.valorEstimado, 0);
const pipelinePonderado = crmOpportunities.reduce((sum, item) => sum + (item.valorEstimado * item.probabilidad / 100), 0);
const estadosCuenta = clientesEstadoCuenta.map((cliente) => generarEstadoCuentaCliente({
  clienteId: cliente.id,
  fechaInicio: "2026-05-01",
  fechaFin: "2026-06-30",
}));
const saldoClientes = estadosCuenta.reduce((sum, item) => sum + item.saldoFinal, 0);
const saldoVencido = estadosCuenta.reduce((sum, item) => sum + item.vencido, 0);
const demoras = disponibilidadProgramada.filter((item) => item.demoraMin > 0);
const minutosDemora = demoras.reduce((sum, item) => sum + item.demoraMin, 0);
const automatizacionesActivas = automationRules.filter((item) => item.status === "Activa").length;
const clientesPorVendedor = getSalesClientSummaries(salesClientsBase);
const ventaClientesVendedor = clientesPorVendedor.reduce((sum, item) => sum + item.ventaMensual, 0);

const reportCards = [
  {
    title: "Operación transporte",
    value: `${completedTrips.length} viajes`,
    detail: `${totalM3.toLocaleString("es-MX")} m³ entregados · ${currency(totalVentas)}`,
    icon: Truck,
    href: "/transporte/viajes",
  },
  {
    title: "Pipeline comercial",
    value: currency(pipelineTotal),
    detail: `${currency(pipelinePonderado)} ponderado · ${crmOpportunities.length} oportunidades`,
    icon: TrendingUp,
    href: "/crm/pipeline",
  },
  {
    title: "Clientes por vendedor",
    value: String(salesClientsBase.length),
    detail: `${currency(ventaClientesVendedor)} mensual · ${clientesPorVendedor.length} vendedores`,
    icon: TrendingUp,
    href: "/crm/clientes-vendedor",
  },
  {
    title: "Cuentas por cobrar",
    value: currency(saldoClientes),
    detail: `${currency(saldoVencido)} vencido · ${clientesEstadoCuenta.length} clientes`,
    icon: CircleDollarSign,
    href: "/finanzas/estado-cuenta-clientes",
  },
  {
    title: "Demoras operativas",
    value: `${demoras.length} eventos`,
    detail: `${minutosDemora} min acumulados en cargas programadas`,
    icon: CalendarClock,
    href: "/transporte/disponibilidad",
  },
];

export default function ReportesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Consolidados gerenciales del ERP</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {reportCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="min-w-0 overflow-hidden rounded-xl border border-[#3A3A3A] bg-[#242424] p-5 transition-colors hover:border-[#CC2229]/60"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-[#1A1A1A] p-2.5 text-[#CC2229]">
                <card.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-400">{card.title}</p>
                <p className="mt-1 max-w-full break-words text-[clamp(1.2rem,1.35vw,1.65rem)] font-bold leading-tight text-white [overflow-wrap:anywhere]">
                  {card.value}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{card.detail}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-xl border border-[#3A3A3A] bg-[#242424] overflow-hidden">
          <div className="border-b border-[#3A3A3A] px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-[#CC2229]" />
              <h3 className="font-semibold text-white">Reporte gerencial por área</h3>
            </div>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {[
              ["Transporte", `${completedTrips.length} viajes completados`, `${totalM3.toLocaleString("es-MX")} m³ entregados`],
              ["Ventas", `${crmOpportunities.length} oportunidades`, `${currency(pipelinePonderado)} pipeline ponderado`],
              ["Clientes por vendedor", `${salesClientsBase.length} clientes asignados`, `${currency(ventaClientesVendedor)} venta mensual`],
              ["Finanzas", `${clientesEstadoCuenta.length} clientes con crédito`, `${currency(saldoClientes)} saldo final`],
              ["Automatizaciones", `${automatizacionesActivas} activas`, `${automationRules.length} reglas configuradas`],
            ].map(([area, indicador, detalle]) => (
              <div key={area} className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] gap-2 px-5 py-4">
                <p className="font-semibold text-white">{area}</p>
                <p className="text-sm text-gray-300">{indicador}</p>
                <p className="text-sm text-gray-500">{detalle}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#3A3A3A] bg-[#242424] overflow-hidden">
          <div className="border-b border-[#3A3A3A] px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#CC2229]" />
              <h3 className="font-semibold text-white">Reportes disponibles</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">Estos consolidados se pueden exportar desde los botones Excel/PDF del encabezado.</p>
          </div>
          <div className="divide-y divide-[#3A3A3A]">
            {[
              ["Reporte operativo de viajes", "Viajes completados, m³ y total generado"],
              ["Reporte CRM gerencial", "Pipeline por etapa, valor ponderado y oportunidades"],
              ["Reporte de clientes por vendedor", "Cartera asignada, venta mensual, volumen y saldos por vendedor"],
              ["Reporte financiero de clientes", "Saldos finales, vencidos y por vencer"],
              ["Reporte de demoras", "Cargas tarde, minutos acumulados e impacto"],
              ["Reporte de automatizaciones", "Reglas activas, pausadas y próximos procesos"],
            ].map(([name, description]) => (
              <div key={name} className="px-5 py-4">
                <p className="font-semibold text-white">{name}</p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
