"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Car, DollarSign, Plus, Wrench } from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import FormSection from "@/components/FormSection";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import { type Unidad } from "@/lib/unidades";

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

export default function MantenimientoPage() {
  const insightsRef = useRef<HTMLDivElement>(null);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [refacciones, setRefacciones] = useState<Refaccion[]>([]);
  const [unidades, setUnidades] = useState<UnidadMantenimiento[]>([]);
  const [activeTab, setActiveTab] = useState<"mantenimientos" | "refacciones" | "unidades">("mantenimientos");
  const [showForm, setShowForm] = useState(false);
  const [showHistorialCamion, setShowHistorialCamion] = useState(false);
  const [selectedUnidadHistorial, setSelectedUnidadHistorial] = useState("");
  const [activeInsight, setActiveInsight] = useState<"costo" | "pendientes" | "taller" | "proximos" | null>(null);
  const costoMes = mantenimientos.reduce((s, m) => s + m.costo, 0);
  const mantenimientosPendientes = mantenimientos.filter(m => m.status === "Pendiente" || m.status === "En proceso");
  const unidadesTallerDetalle = unidades.filter((u) => u.condicion === "En taller" || u.condicion === "Pendiente");
  const proximosServiciosDetalle = unidades.filter((u) => u.condicion === "Próximo servicio");
  const pendientes = mantenimientosPendientes.length;
  const unidadesEnTaller = unidadesTallerDetalle.length;
  const proximosServicios = proximosServiciosDetalle.length;
  const historialMantenimientos = mantenimientos.filter((m) => m.unidad === selectedUnidadHistorial);
  const historialRefacciones = refacciones.filter((r) => r.unidad === selectedUnidadHistorial);
  const historialUnidad = unidades.find((u) => u.unidad === selectedUnidadHistorial);
  const costoHistorialMantenimiento = historialMantenimientos.reduce((sum, item) => sum + item.costo, 0);
  const costoHistorialRefacciones = historialRefacciones.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    getCollectionDocs<Mantenimiento>(COLLECTIONS.mantenimientos).then(setMantenimientos);
    getCollectionDocs<Refaccion>(COLLECTIONS.refacciones).then(setRefacciones);
    getCollectionDocs<Unidad>(COLLECTIONS.unidades).then((data) => {
      const mapped: UnidadMantenimiento[] = data.map((u) => ({
        unidad: u.noEconomico,
        kmActual: u.kmActual,
        proximoServicioKm: 0,
        proximoServicioFecha: u.proximoMantenimiento ?? "",
        ultimoServicio: u.ultimoMantenimiento ?? "",
        condicion: u.estatus === "Mantenimiento" ? "En taller" : u.estatus === "Baja" ? "Baja" : "Al día",
        responsable: u.choferAsignado ?? "",
      }));
      setUnidades(mapped);
      if (mapped.length > 0) setSelectedUnidadHistorial(mapped[0].unidad);
    });
  }, []);

  function showToast(type: "success" | "error", title: string, message: string) {
    window.dispatchEvent(new CustomEvent("duro:toast", {
      detail: { type, title, message },
    }));
  }

  function markMantenimientoCompletado(target: Mantenimiento) {
    setMantenimientos((current) => current.map((item) => {
      const isSameRecord =
        item.fecha === target.fecha &&
        item.unidad === target.unidad &&
        item.descripcion === target.descripcion &&
        item.costo === target.costo;

      return isSameRecord ? { ...item, status: "Completado" } : item;
    }));
    showToast("success", "Mantenimiento completado", `${target.unidad} quedó marcado como completado.`);
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!insightsRef.current || insightsRef.current.contains(event.target as Node)) return;
      setActiveInsight(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleSave(values: Record<string, string>) {
    if (activeTab === "refacciones") {
      const cantidad = Number(values.Cantidad || 0);
      const costoUnit = Number(values["Costo unitario ($)"]?.replace(/[$,]/g, "") || 0);
      const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      const newRefaccion: Refaccion = {
        fecha,
        unidad: values.Unidad || "DC-03",
        refaccion: values.Refacción || "Filtro de aceite",
        cantidad,
        costoUnit,
        total: cantidad * costoUnit,
        proveedor: values.Proveedor || "Auto Partes NL",
      };
      setRefacciones((current) => [newRefaccion, ...current]);
      await upsertDocument(COLLECTIONS.refacciones, Date.now().toString(), newRefaccion);
      return;
    }

    const fecha = values.Fecha ? values.Fecha.split("-").reverse().join("/") : new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const newMantenimiento: Mantenimiento = {
      fecha,
      unidad: values.Unidad || "DC-03",
      tipo: values.Tipo || "Preventivo",
      descripcion: values.Descripción || "Cambio de aceite y filtros",
      costo: Number(values["Costo ($)"]?.replace(/[$,]/g, "") || 0),
      taller: values.Taller || "Taller Monterrey",
      status: values.Status || "Pendiente",
    };
    setMantenimientos((current) => [newMantenimiento, ...current]);
    await upsertDocument(COLLECTIONS.mantenimientos, Date.now().toString(), newMantenimiento);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Control de mantenimientos y refacciones</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowHistorialCamion((value) => !value)}
            className="flex items-center gap-2 border border-[#3A3A3A] bg-[#1A1A1A] hover:border-[#CC2229] text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Car size={16} />
            Ver historial por camión
          </button>
          {activeTab !== "unidades" && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Registrar
            </button>
          )}
        </div>
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
                const unidad = unidades.find((u) => u.unidad === item.unidad);
                return (
                <div key={`${item.fecha}-${item.unidad}-${item.status}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-2 px-5 py-3">
                  <p className="text-sm font-semibold text-white">{item.unidad}</p>
                  <div>
                    <p className="text-sm text-gray-200">{item.descripcion}</p>
                    <p className="text-xs text-gray-500">Toca atender el {unidad?.proximoServicioFecha ?? item.fecha} · {item.taller}</p>
                  </div>
                  <StatusBadge status={item.status} />
                  <button
                    onClick={() => markMantenimientoCompletado(item)}
                    className="inline-flex min-w-32 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-center text-sm font-medium leading-tight text-gray-200 transition-colors hover:border-[#CC2229] hover:text-white"
                  >
                    Marcar<br />completado
                  </button>
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
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors">
              Cancelar
            </button>
            <button className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20">
              Guardar
            </button>
          </>
        }
      >
        {(() => {
          const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";
          const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
          return activeTab === "mantenimientos" ? (
            <>
              <FormSection title="Servicio">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Unidad</label>
                  <select className={inp}>
                    {unidades.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tipo</label>
                  <select className={inp}>
                    <option>Preventivo</option>
                    <option>Correctivo</option>
                    <option>Inspección</option>
                    <option>Garantía</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Costo ($)</label>
                  <select className={inp}>
                    {[3200, 3800, 4800, 8500, 9600, 15200].map((costo) => <option key={costo}>${costo.toLocaleString()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Taller</label>
                  <select className={inp}>
                    {["Taller Monterrey", "Servitruck NL", "Auto Partes NL", "Llantera JC", "Hidráulicos MTY"].map((taller) => <option key={taller}>{taller}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp}>
                    <option>Pendiente</option>
                    <option>En proceso</option>
                    <option>Completado</option>
                  </select>
                </div>
              </FormSection>
              <div>
                <label className={lbl}>Descripción</label>
                <select className={inp}>
                  {["Cambio de aceite y filtros", "Reparación de frenos traseros", "Revisión general + afinación", "Cambio de bomba hidráulica", "Cambio de llantas delanteras"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </>
          ) : (
            <FormSection title="Refacción">
              <div>
                <label className={lbl}>Fecha</label>
                <input type="date" className={inp} />
              </div>
              <div>
                <label className={lbl}>Unidad</label>
                <select className={inp}>
                  {unidades.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Refacción</label>
                <select className={inp}>
                  {["Filtro de aceite", "Pastillas de freno", "Bujías NGK", "Bomba hidráulica", "Llanta 11R22.5", "Aceite 15W40 (cubeta)"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Cantidad</label>
                <select className={inp}>
                  {[1, 2, 4, 6, 8, 10].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Costo unitario ($)</label>
                <select className={inp}>
                  {[180, 280, 650, 890, 4800, 12500].map((c) => <option key={c}>${c.toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Proveedor</label>
                <select className={inp}>
                  {["Auto Partes NL", "Servitruck NL", "Refaccionaria Sur", "Hidráulicos MTY", "Llantera JC", "Lubricantes MX"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </FormSection>
          );
        })()}
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
                {unidades.map((unidad) => <option key={unidad.unidad}>{unidad.unidad}</option>)}
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
      </div>

      {/* Mantenimientos Table */}
      {activeTab === "mantenimientos" && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                  {["Fecha", "Unidad", "Tipo", "Descripción", "Costo", "Taller", "Status", "Acción"].map((h) => (
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
                    <td className="px-4 py-3">
                      {m.status === "Completado" ? (
                        <span className="text-sm text-gray-500">
                          Listo
                        </span>
                      ) : (
                        <button
                          onClick={() => markMantenimientoCompletado(m)}
                          className="inline-flex min-w-32 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-center text-sm font-medium leading-tight text-gray-200 transition-colors hover:border-[#CC2229] hover:text-white"
                        >
                          Marcar<br />completado
                        </button>
                      )}
                    </td>
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
                {unidades.map((u) => {
                  return (
                    <tr key={u.unidad} className="hover:bg-[#2A2A2A] transition-colors">
                      <td className="px-4 py-3 text-white font-semibold">{u.unidad}</td>
                      <td className="px-4 py-3 text-gray-300">{u.kmActual.toLocaleString()} km</td>
                      <td className="px-4 py-3 text-gray-500">—</td>
                      <td className="px-4 py-3 text-gray-300">{u.proximoServicioFecha || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">—</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.ultimoServicio || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.condicion} /></td>
                      <td className="px-4 py-3 text-gray-300">{u.responsable || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
