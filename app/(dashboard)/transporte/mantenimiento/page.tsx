"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Car, DollarSign, Plus, Wrench } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";

interface Mantenimiento {
  fecha: string;
  unidad: string;
  tipo: string;
  descripcion: string;
  costo: number;
  taller: string;
  status: string;
}

interface Refaccion {
  fecha: string;
  unidad: string;
  refaccion: string;
  cantidad: number;
  costoUnit: number;
  total: number;
  proveedor: string;
}

interface UnidadMantenimiento {
  unidad: string;
  kmActual: number;
  proximoServicioKm: number;
  proximoServicioFecha: string;
  ultimoServicio: string;
  condicion: string;
  responsable: string;
}

interface SeguroUnidad {
  tipo: string;
  alias: string;
  placas: string;
  estado: string;
  marca: string;
  nombre: string;
  modelo: string;
  anio: number;
  poliza: string;
  costoPoliza: number;
  vigencia: string;
  valorMercado: number;
  status: string;
}

const mantenimientosData: Mantenimiento[] = [
  { fecha: "18/05/2026", unidad: "DC-03", tipo: "Preventivo", descripcion: "Cambio de aceite y filtros", costo: 3200, taller: "Taller Monterrey", status: "Completado" },
  { fecha: "17/05/2026", unidad: "DC-09", tipo: "Correctivo", descripcion: "Reparación de frenos traseros", costo: 8500, taller: "Servitruck NL", status: "En proceso" },
  { fecha: "15/05/2026", unidad: "DC-05", tipo: "Preventivo", descripcion: "Revisión general + afinación", costo: 4800, taller: "Taller Monterrey", status: "Completado" },
  { fecha: "12/05/2026", unidad: "DC-10", tipo: "Correctivo", descripcion: "Cambio de bomba hidráulica", costo: 15200, taller: "Auto Partes NL", status: "Pendiente" },
  { fecha: "10/05/2026", unidad: "DC-02", tipo: "Preventivo", descripcion: "Cambio de llantas delanteras", costo: 9600, taller: "Llantera JC", status: "Completado" },
  { fecha: "08/05/2026", unidad: "DC-06", tipo: "Preventivo", descripcion: "Cambio de aceite motor y diferencial", costo: 3800, taller: "Taller Monterrey", status: "Completado" },
];

const refaccionesData: Refaccion[] = [
  { fecha: "18/05/2026", unidad: "DC-03", refaccion: "Filtro de aceite", cantidad: 2, costoUnit: 280, total: 560, proveedor: "Auto Partes NL" },
  { fecha: "17/05/2026", unidad: "DC-09", refaccion: "Pastillas de freno", cantidad: 4, costoUnit: 650, total: 2600, proveedor: "Servitruck NL" },
  { fecha: "15/05/2026", unidad: "DC-05", refaccion: "Bujías NGK", cantidad: 6, costoUnit: 180, total: 1080, proveedor: "Refaccionaria Sur" },
  { fecha: "12/05/2026", unidad: "DC-10", refaccion: "Bomba hidráulica", cantidad: 1, costoUnit: 12500, total: 12500, proveedor: "Hidráulicos MTY" },
  { fecha: "10/05/2026", unidad: "DC-02", refaccion: "Llanta 11R22.5", cantidad: 2, costoUnit: 4800, total: 9600, proveedor: "Llantera JC" },
  { fecha: "08/05/2026", unidad: "DC-06", refaccion: "Aceite 15W40 (cubeta)", cantidad: 2, costoUnit: 890, total: 1780, proveedor: "Lubricantes MX" },
];

const unidadesData: UnidadMantenimiento[] = [
  { unidad: "DC-01", kmActual: 124800, proximoServicioKm: 130000, proximoServicioFecha: "28/06/2026", ultimoServicio: "19/04/2026", condicion: "Normal", responsable: "José García" },
  { unidad: "DC-02", kmActual: 118400, proximoServicioKm: 120000, proximoServicioFecha: "12/06/2026", ultimoServicio: "10/05/2026", condicion: "Próximo servicio", responsable: "Roberto Flores" },
  { unidad: "DC-03", kmActual: 132100, proximoServicioKm: 137000, proximoServicioFecha: "30/06/2026", ultimoServicio: "18/05/2026", condicion: "Normal", responsable: "Luis Ramírez" },
  { unidad: "DC-09", kmActual: 98500, proximoServicioKm: 100000, proximoServicioFecha: "05/06/2026", ultimoServicio: "17/05/2026", condicion: "En taller", responsable: "Taller" },
  { unidad: "DC-10", kmActual: 142300, proximoServicioKm: 145000, proximoServicioFecha: "18/06/2026", ultimoServicio: "12/05/2026", condicion: "Pendiente", responsable: "Taller" },
];

const segurosUnidadesData: SeguroUnidad[] = [
  { tipo: "Revolvedora", alias: "105", placas: "HF5589F", estado: "Guerrero", marca: "Internacional", nombre: "AG Support", modelo: "Internacional", anio: 2005, poliza: "640698167-1", costoPoliza: 12886.46, vigencia: "02/09/2026", valorMercado: 1000000, status: "Qualitas Carlos Contreras" },
  { tipo: "Revolvedora", alias: "108", placas: "RJ-1241-B", estado: "Nuevo León", marca: "Kenworth T-460", nombre: "Duro", modelo: "6x4 ISL 330HP Chasis cabina STD.", anio: 2011, poliza: "971269209-1", costoPoliza: 17622.38, vigencia: "02/09/2026", valorMercado: 1500000, status: "Qualitas Carlos Contreras" },
  { tipo: "Revolvedora", alias: "110", placas: "RL-3576-A", estado: "Nuevo León", marca: "Kenworth T-460", nombre: "Duro", modelo: "6x4 ISL 330HP Chasis cabina STD.", anio: 2016, poliza: "1700069536 D 14", costoPoliza: 12941.12, vigencia: "02/09/2026", valorMercado: 1750000, status: "Qualitas Carlos Contreras" },
  { tipo: "Revolvedora", alias: "111", placas: "PW8840A", estado: "Nuevo León", marca: "Kenworth", nombre: "Erik", modelo: "T880", anio: 2019, poliza: "4019352-1", costoPoliza: 409357.03, vigencia: "09/09/2026", valorMercado: 2500000, status: "Seguro de financiera Unifin Qualitas" },
  { tipo: "Bomba", alias: "Bomba 03", placas: "GZ80Z5G", estado: "Guerrero", marca: "Mack", nombre: "Duro", modelo: "Putzmeister 36m M70", anio: 1999, poliza: "1700069536 ED 17", costoPoliza: 14833.84, vigencia: "02/09/2026", valorMercado: 3000000, status: "Qualitas Carlos Contreras" },
  { tipo: "Volteo", alias: "Camión volteo", placas: "PT-5620-B", estado: "Nuevo León", marca: "Kenworth", nombre: "AG Support", modelo: "White", anio: 1992, poliza: "1700069536", costoPoliza: 13404.87, vigencia: "02/09/2026", valorMercado: 400000, status: "Qualitas Carlos Contreras" },
  { tipo: "Vehículo", alias: "Beat", placas: "RRL431A", estado: "Nuevo León", marca: "Chevrolet", nombre: "Duro/Martín", modelo: "Chevrolet Beat Sedan LT", anio: 2018, poliza: "640884448", costoPoliza: 9161.44, vigencia: "05/05/2027", valorMercado: 111000, status: "Qualitas Sairy" },
  { tipo: "Vehículo", alias: "Hilux 4P", placas: "PR-4425-B", estado: "Nuevo León", marca: "Toyota", nombre: "Duro", modelo: "Hilux doble cabina", anio: 2023, poliza: "TFS000000306726", costoPoliza: 78945.01, vigencia: "01/10/2027", valorMercado: 500000, status: "Seguro con Toyota Financial" },
  { tipo: "Vehículo", alias: "Siena", placas: "SWM866R", estado: "Nuevo León", marca: "Toyota", nombre: "Duro", modelo: "Sienna XSE Minivan híbrida", anio: 2024, poliza: "06.0201049418000001", costoPoliza: 55109.77, vigencia: "01/01/2027", valorMercado: 1000000, status: "Seguro con Toyota Financial" },
  { tipo: "Maquinaria", alias: "Retroexcavadora", placas: "-", estado: "-", marca: "John Deere", nombre: "Duro", modelo: "Retro 310 SL", anio: 2015, poliza: "-", costoPoliza: 0, vigencia: "-", valorMercado: 1350000, status: "Pendiente póliza" },
];

export default function MantenimientoPage() {
  const insightsRef = useRef<HTMLDivElement>(null);
  const [mantenimientos, setMantenimientos] = useState(mantenimientosData);
  const [refacciones, setRefacciones] = useState(refaccionesData);
  const [activeTab, setActiveTab] = useState<"mantenimientos" | "refacciones" | "unidades" | "seguros">("mantenimientos");
  const [showForm, setShowForm] = useState(false);
  const [showHistorialCamion, setShowHistorialCamion] = useState(false);
  const [selectedUnidadHistorial, setSelectedUnidadHistorial] = useState(unidadesData[0]?.unidad ?? "DC-01");
  const [activeInsight, setActiveInsight] = useState<"costo" | "pendientes" | "taller" | "proximos" | null>(null);
  const costoMes = mantenimientos.reduce((s, m) => s + m.costo, 0);
  const mantenimientosPendientes = mantenimientos.filter(m => m.status === "Pendiente" || m.status === "En proceso");
  const unidadesTallerDetalle = unidadesData.filter((u) => u.condicion === "En taller" || u.condicion === "Pendiente");
  const proximosServiciosDetalle = unidadesData.filter((u) => u.condicion === "Próximo servicio");
  const pendientes = mantenimientosPendientes.length;
  const unidadesEnTaller = unidadesTallerDetalle.length;
  const proximosServicios = proximosServiciosDetalle.length;
  const historialMantenimientos = mantenimientos.filter((m) => m.unidad === selectedUnidadHistorial);
  const historialRefacciones = refacciones.filter((r) => r.unidad === selectedUnidadHistorial);
  const historialUnidad = unidadesData.find((u) => u.unidad === selectedUnidadHistorial);
  const costoHistorialMantenimiento = historialMantenimientos.reduce((sum, item) => sum + item.costo, 0);
  const costoHistorialRefacciones = historialRefacciones.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!insightsRef.current || insightsRef.current.contains(event.target as Node)) return;
      setActiveInsight(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleSave(values: Record<string, string>) {
    if (activeTab === "refacciones") {
      const cantidad = Number(values.Cantidad || 0);
      const costoUnit = Number(values["Costo unitario ($)"]?.replace(/[$,]/g, "") || 0);
      const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : "20/05/2026";

      setRefacciones((current) => [
        {
          fecha,
          unidad: values.Unidad || "DC-03",
          refaccion: values.Refacción || "Filtro de aceite",
          cantidad,
          costoUnit,
          total: cantidad * costoUnit,
          proveedor: values.Proveedor || "Auto Partes NL",
        },
        ...current,
      ]);
      return;
    }

    const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : "20/05/2026";
    setMantenimientos((current) => [
      {
        fecha,
        unidad: values.Unidad || "DC-03",
        tipo: values.Tipo || "Preventivo",
        descripcion: values.Descripción || "Cambio de aceite y filtros",
        costo: Number(values["Costo ($)"]?.replace(/[$,]/g, "") || 0),
        taller: values.Taller || "Taller Monterrey",
        status: values.Status || "Pendiente",
      },
      ...current,
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Mantenimiento</h1>
          <p className="text-gray-500 text-sm mt-0.5">Control de mantenimientos y refacciones</p>
        </div>
        {activeTab !== "seguros" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowHistorialCamion((value) => !value)}
              className="flex items-center gap-2 border border-[#3A3A3A] bg-[#1A1A1A] hover:border-[#CC2229] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Car size={16} />
              Ver historial por camión
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Registrar
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div ref={insightsRef} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            title="Costo mantenimiento mes"
            value={`$${costoMes.toLocaleString()}`}
            icon={DollarSign}
            iconColor="text-[#CC2229]"
            active={activeInsight === "costo"}
            onClick={() => setActiveInsight((current) => current === "costo" ? null : "costo")}
          />
          <KPICard
            title="Mantenimientos pendientes"
            value={String(pendientes)}
            icon={AlertTriangle}
            iconColor="text-orange-400"
            subtitle="Requieren atención"
            active={activeInsight === "pendientes"}
            onClick={() => setActiveInsight((current) => current === "pendientes" ? null : "pendientes")}
          />
          <KPICard
            title="Unidades en taller"
            value={String(unidadesEnTaller)}
            icon={Wrench}
            iconColor="text-red-400"
            active={activeInsight === "taller"}
            onClick={() => setActiveInsight((current) => current === "taller" ? null : "taller")}
          />
          <KPICard
            title="Próximos servicios"
            value={String(proximosServicios)}
            icon={Car}
            iconColor="text-blue-400"
            active={activeInsight === "proximos"}
            onClick={() => setActiveInsight((current) => current === "proximos" ? null : "proximos")}
          />
        </div>

        {activeInsight && (
          <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#3A3A3A]">
              <h3 className="text-white font-semibold">
                {activeInsight === "costo" && "Detalle de costo mantenimiento mes"}
                {activeInsight === "pendientes" && "Mantenimientos pendientes"}
                {activeInsight === "taller" && "Unidades en taller"}
                {activeInsight === "proximos" && "Próximos servicios"}
              </h3>
              <p className="text-gray-500 text-xs mt-1">Selecciona una tarjeta para ver cuáles unidades requieren atención.</p>
            </div>
            <div className="divide-y divide-[#3A3A3A]">
              {activeInsight === "costo" && mantenimientos.map((item) => (
                <div key={`${item.fecha}-${item.unidad}-${item.descripcion}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.unidad}</p>
                  <div>
                    <p className="text-sm text-gray-200">{item.descripcion}</p>
                    <p className="text-xs text-gray-500">{item.fecha} · {item.taller}</p>
                  </div>
                  <StatusBadge status={item.status} />
                  <p className="text-sm font-semibold text-white">${item.costo.toLocaleString()}</p>
                </div>
              ))}

              {activeInsight === "pendientes" && mantenimientosPendientes.map((item) => {
                const unidad = unidadesData.find((u) => u.unidad === item.unidad);
                return (
                  <div key={`${item.fecha}-${item.unidad}-${item.status}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 px-5 py-3">
                    <p className="text-sm font-semibold text-white">{item.unidad}</p>
                    <div>
                      <p className="text-sm text-gray-200">{item.descripcion}</p>
                      <p className="text-xs text-gray-500">Toca atender el {unidad?.proximoServicioFecha ?? item.fecha} · {item.taller}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                );
              })}

              {activeInsight === "taller" && unidadesTallerDetalle.map((item) => (
                <div key={item.unidad} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.unidad}</p>
                  <div>
                    <p className="text-sm text-gray-200">Responsable: {item.responsable}</p>
                    <p className="text-xs text-gray-500">Servicio programado para {item.proximoServicioFecha} · Último servicio {item.ultimoServicio}</p>
                  </div>
                  <StatusBadge status={item.condicion} />
                </div>
              ))}

              {activeInsight === "proximos" && proximosServiciosDetalle.map((item) => (
                <div key={item.unidad} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.unidad}</p>
                  <div>
                    <p className="text-sm text-gray-200">Le toca servicio el {item.proximoServicioFecha}</p>
                    <p className="text-xs text-gray-500">Km actual {item.kmActual.toLocaleString()} · Próximo servicio {item.proximoServicioKm.toLocaleString()} km</p>
                  </div>
                  <StatusBadge status={item.condicion} />
                </div>
              ))}

              {activeInsight === "proximos" && proximosServiciosDetalle.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-500">No hay próximos servicios registrados.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showForm}
        title={activeTab === "mantenimientos" ? "Registrar mantenimiento" : "Registrar refacción"}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">
              Cancelar
            </button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">
              Guardar
            </button>
          </>
        }
      >
        {activeTab === "mantenimientos" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {unidadesData.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Preventivo</option>
                <option>Correctivo</option>
                <option>Inspección</option>
                <option>Garantía</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Costo ($)</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[3200, 3800, 4800, 8500, 9600, 15200].map((costo) => <option key={costo}>${costo.toLocaleString()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Taller</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Taller Monterrey", "Servitruck NL", "Auto Partes NL", "Llantera JC", "Hidráulicos MTY"].map((taller) => <option key={taller}>{taller}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                <option>Pendiente</option>
                <option>En proceso</option>
                <option>Completado</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Cambio de aceite y filtros", "Reparación de frenos traseros", "Revisión general + afinación", "Cambio de bomba hidráulica", "Cambio de llantas delanteras"].map((descripcion) => <option key={descripcion}>{descripcion}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha</label>
              <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Unidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {unidadesData.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Refacción</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Filtro de aceite", "Pastillas de freno", "Bujías NGK", "Bomba hidráulica", "Llanta 11R22.5", "Aceite 15W40 (cubeta)"].map((refaccion) => <option key={refaccion}>{refaccion}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cantidad</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[1, 2, 4, 6, 8, 10].map((cantidad) => <option key={cantidad}>{cantidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Costo unitario ($)</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {[180, 280, 650, 890, 4800, 12500].map((costo) => <option key={costo}>${costo.toLocaleString()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Proveedor</label>
              <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
                {["Auto Partes NL", "Servitruck NL", "Refaccionaria Sur", "Hidráulicos MTY", "Llantera JC", "Lubricantes MX"].map((proveedor) => <option key={proveedor}>{proveedor}</option>)}
              </select>
            </div>
          </div>
        )}
      </FormModal>

      {showHistorialCamion && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Historial por camión</h3>
              <p className="text-gray-500 text-xs mt-1">Mantenimientos, refacciones y costos acumulados por unidad.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedUnidadHistorial}
                onChange={(event) => setSelectedUnidadHistorial(event.target.value)}
                className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
              >
                {unidadesData.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
              </select>
              <button
                onClick={() => setShowHistorialCamion(false)}
                className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
              >
                Cerrar historial
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#3A3A3A]">
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Unidad</p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedUnidadHistorial}</p>
              <p className="text-xs text-gray-500">{historialUnidad?.responsable ?? "Sin responsable"}</p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Último servicio</p>
              <p className="mt-2 text-lg font-semibold text-white">{historialUnidad?.ultimoServicio ?? "-"}</p>
              <p className="text-xs text-gray-500">{historialUnidad?.condicion ?? "Sin condición"}</p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Costo mantenimiento</p>
              <p className="mt-2 text-lg font-semibold text-white">${costoHistorialMantenimiento.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{historialMantenimientos.length} registros</p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Costo refacciones</p>
              <p className="mt-2 text-lg font-semibold text-white">${costoHistorialRefacciones.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{historialRefacciones.length} registros</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-[#3A3A3A]">
            <div className="p-5">
              <h4 className="text-white font-semibold mb-3">Mantenimientos</h4>
              <div className="space-y-3">
                {historialMantenimientos.length > 0 ? historialMantenimientos.map((item) => (
                  <div key={`${item.fecha}-${item.descripcion}-${item.costo}`} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.descripcion}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.fecha} · {item.tipo} · {item.taller}</p>
                    <p className="mt-2 text-sm font-semibold text-white">${item.costo.toLocaleString()}</p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">Sin mantenimientos registrados para esta unidad.</p>
                )}
              </div>
            </div>

            <div className="p-5">
              <h4 className="text-white font-semibold mb-3">Refacciones</h4>
              <div className="space-y-3">
                {historialRefacciones.length > 0 ? historialRefacciones.map((item) => (
                  <div key={`${item.fecha}-${item.refaccion}-${item.total}`} className="rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.refaccion}</p>
                      <span className="text-xs text-gray-400">{item.cantidad} pzas.</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.fecha} · {item.proveedor}</p>
                    <p className="mt-2 text-sm font-semibold text-white">${item.total.toLocaleString()}</p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500">Sin refacciones registradas para esta unidad.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("mantenimientos")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "mantenimientos"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Mantenimientos
        </button>
        <button
          onClick={() => setActiveTab("refacciones")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "refacciones"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Refacciones
        </button>
        <button
          onClick={() => setActiveTab("unidades")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "unidades"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Unidades
        </button>
        <button
          onClick={() => setActiveTab("seguros")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "seguros"
              ? "bg-[#CC2229] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Seguros
        </button>
      </div>

      {/* Mantenimientos Table */}
      {activeTab === "mantenimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Tipo", "Descripción", "Costo", "Taller", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {mantenimientos.map((m, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.fecha}</td>
                    <td className="px-4 py-3 text-white font-semibold">{m.unidad}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.tipo} /></td>
                    <td className="px-4 py-3 text-gray-200">{m.descripcion}</td>
                    <td className="px-4 py-3 text-white font-semibold">${m.costo.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{m.taller}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refacciones Table */}
      {activeTab === "refacciones" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Refacción", "Cantidad", "Costo Unit.", "Total", "Proveedor"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {refacciones.map((r, i) => (
                  <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.fecha}</td>
                    <td className="px-4 py-3 text-white font-semibold">{r.unidad}</td>
                    <td className="px-4 py-3 text-gray-200">{r.refaccion}</td>
                    <td className="px-4 py-3 text-gray-300">{r.cantidad}</td>
                    <td className="px-4 py-3 text-gray-300">${r.costoUnit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-white font-semibold">${r.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">{r.proveedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "unidades" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Control de unidades</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Unidad", "Km actual", "Próximo servicio", "Fecha servicio", "Km restantes", "Último servicio", "Condición", "Responsable"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {unidadesData.map((u) => {
                  const kmRestantes = u.proximoServicioKm - u.kmActual;
                  return (
                    <tr key={u.unidad} className="hover:bg-[#2A2A2A] transition-colors">
                      <td className="px-4 py-3 text-white font-semibold">{u.unidad}</td>
                      <td className="px-4 py-3 text-gray-300">{u.kmActual.toLocaleString()} km</td>
                      <td className="px-4 py-3 text-gray-300">{u.proximoServicioKm.toLocaleString()} km</td>
                      <td className="px-4 py-3 text-gray-300">{u.proximoServicioFecha}</td>
                      <td className={`px-4 py-3 font-semibold ${kmRestantes <= 2000 ? "text-orange-400" : "text-green-400"}`}>{kmRestantes.toLocaleString()} km</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.ultimoServicio}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.condicion} /></td>
                      <td className="px-4 py-3 text-gray-300">{u.responsable}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "seguros" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A]">
            <h3 className="text-white font-semibold">Listado de unidades y seguros</h3>
            <p className="text-gray-500 text-xs mt-1">Datos capturados del listado de equipos y pólizas.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Tipo", "Alias", "Placas", "Estado", "Marca", "Modelo", "Año", "Póliza", "Costo póliza", "Vigencia", "Valor mercado", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A3A3A]">
                {segurosUnidadesData.map((unidad) => (
                  <tr key={`${unidad.tipo}-${unidad.alias}-${unidad.placas}`} className="hover:bg-[#2A2A2A] transition-colors">
                    <td className="px-4 py-3 text-gray-300">{unidad.tipo}</td>
                    <td className="px-4 py-3 text-white font-semibold">{unidad.alias}</td>
                    <td className="px-4 py-3 text-gray-300">{unidad.placas}</td>
                    <td className="px-4 py-3 text-gray-400">{unidad.estado}</td>
                    <td className="px-4 py-3 text-gray-300">{unidad.marca}</td>
                    <td className="px-4 py-3 text-gray-300 min-w-64">{unidad.modelo}</td>
                    <td className="px-4 py-3 text-gray-400">{unidad.anio}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{unidad.poliza}</td>
                    <td className="px-4 py-3 text-white font-semibold">${unidad.costoPoliza.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-400">{unidad.vigencia}</td>
                    <td className="px-4 py-3 text-white">${unidad.valorMercado.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300 min-w-72">{unidad.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
