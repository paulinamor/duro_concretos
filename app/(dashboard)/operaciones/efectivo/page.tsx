"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Plus, WalletCards } from "lucide-react";
import { getCollectionDocs, upsertDocument, COLLECTIONS } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import FormModal from "@/components/FormModal";
import FormSection from "@/components/FormSection";

interface Transaccion {
  fecha: string;
  cliente: string;
  descripcion: string;
  tipo: string;
  monto: number;
  responsable: string;
  saldo: number;
}

const saldoInicial = 0;

function parseFecha(fecha: string) {
  if (fecha === "NO COLADO") return null;

  const parts = fecha.split("/");
  if (parts.length === 2) {
    const [month, year] = parts;
    return new Date(Number(`20${year}`), Number(month) - 1, 1);
  }

  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(Number(`20${year}`), Number(month) - 1, Number(day));
  }

  return null;
}

export default function EfectivoPage() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);

  useEffect(() => {
    getCollectionDocs<Transaccion>(COLLECTIONS.efectivo).then(setTransacciones);
  }, []);
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSaldos, setShowSaldos] = useState(true);
  const clientes = Array.from(new Set(transacciones.map((t) => t.cliente))).sort();
  const filteredTransacciones = transacciones.filter((t) => {
    const fecha = parseFecha(t.fecha);
    const matchesCliente = clienteFiltro === "todos" || t.cliente === clienteFiltro;
    const matchesInicio = !fechaInicio || (fecha ? fecha >= new Date(`${fechaInicio}T00:00:00`) : false);
    const matchesFin = !fechaFin || (fecha ? fecha <= new Date(`${fechaFin}T23:59:59`) : false);

    return matchesCliente && matchesInicio && matchesFin;
  });
  const ingresos = filteredTransacciones.filter(t => t.tipo === "Ingreso").reduce((s, t) => s + t.monto, 0);
  const egresos = filteredTransacciones.filter(t => t.tipo === "Egreso").reduce((s, t) => s + t.monto, 0);
  const saldoFinal = filteredTransacciones[filteredTransacciones.length - 1]?.saldo ?? saldoInicial;
  const saldoCalculado = saldoInicial + ingresos - egresos;
  const saldosPorProveedor = Object.values(filteredTransacciones.reduce<Record<string, { proveedor: string; ingresos: number; egresos: number; saldo: number }>>((acc, item) => {
    if (!acc[item.cliente]) {
      acc[item.cliente] = { proveedor: item.cliente, ingresos: 0, egresos: 0, saldo: 0 };
    }

    if (item.tipo === "Ingreso") {
      acc[item.cliente].ingresos += item.monto;
      acc[item.cliente].saldo += item.monto;
    } else {
      acc[item.cliente].egresos += item.monto;
      acc[item.cliente].saldo -= item.monto;
    }

    return acc;
  }, {})).sort((a, b) => b.saldo - a.saldo);
  const saldosPorResponsable = Object.values(filteredTransacciones.reduce<Record<string, { responsable: string; ingresos: number; egresos: number; saldo: number }>>((acc, item) => {
    if (!acc[item.responsable]) {
      acc[item.responsable] = { responsable: item.responsable, ingresos: 0, egresos: 0, saldo: 0 };
    }

    if (item.tipo === "Ingreso") {
      acc[item.responsable].ingresos += item.monto;
      acc[item.responsable].saldo += item.monto;
    } else {
      acc[item.responsable].egresos += item.monto;
      acc[item.responsable].saldo -= item.monto;
    }

    return acc;
  }, {})).sort((a, b) => b.saldo - a.saldo);

  async function handleSave(values: Record<string, string>) {
    const monto = Number(values["Monto ($)"]?.replace(/[$,]/g, "") || 0);
    const tipo = values.Tipo || "Ingreso";
    const saldoActual = transacciones[transacciones.length - 1]?.saldo ?? saldoInicial;
    const cliente = values.Proveedor || "Proveedor general";
    const descripcion = values.Descripción || "Cobro viaje";
    const id = Date.now().toString();
    const newTransaccion: Transaccion = {
      fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" }),
      cliente,
      descripcion,
      tipo,
      monto,
      responsable: values.Responsable || "Admin",
      saldo: tipo === "Ingreso" ? saldoActual + monto : saldoActual - monto,
    };

    setTransacciones((current) => [newTransaccion, ...current]);
    await upsertDocument(COLLECTIONS.efectivo, id, newTransaccion);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Seguimiento de ingresos y egresos diarios</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSaldos((value) => !value)}
            className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
          >
            <WalletCards size={16} />
            {showSaldos ? "Ocultar saldos" : "Ver saldos"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Registrar
          </button>
        </div>
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_auto] gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Proveedor</label>
            <select
              value={clienteFiltro}
              onChange={(event) => setClienteFiltro(event.target.value)}
              className="date-input-white w-full bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            >
              <option value="todos">Todos</option>
              {clientes.map((cliente) => <option key={cliente} value={cliente}>{cliente}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              className="date-input-white w-full bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setClienteFiltro("todos");
                setFechaInicio("");
                setFechaFin("");
              }}
              className="w-full rounded-lg border border-[#3A3A3A] bg-[#1A1A1A] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229] hover:text-white"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">Saldo inicial</p>
          <p className="text-xl font-bold text-white">${saldoInicial.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-green-900/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} className="text-green-400" /> Ingresos</p>
          <p className="text-xl font-bold text-green-400">${ingresos.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-red-900/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} className="text-red-400" /> Egresos</p>
          <p className="text-xl font-bold text-red-400">${egresos.toLocaleString()}</p>
        </div>
        <div className="bg-[#242424] border border-[#CC2229]/30 rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1 flex items-center gap-1"><DollarSign size={12} className="text-[#CC2229]" /> Saldo final</p>
          <p className="text-xl font-bold text-[#CC2229]">${saldoFinal.toLocaleString()}</p>
        </div>
      </div>

      {showSaldos && (
        <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3A3A3A] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Saldos de efectivo</h3>
              <p className="text-xs text-gray-500 mt-1">Resumen calculado con los filtros activos.</p>
            </div>
            <div className="rounded-lg border border-[#CC2229]/30 bg-[#CC2229]/10 px-4 py-2">
              <p className="text-xs text-gray-400">Saldo disponible</p>
              <p className="text-lg font-bold text-[#CC2229]">${saldoCalculado.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#3A3A3A]">
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Saldo inicial</p>
              <p className="mt-2 text-xl font-bold text-white">${saldoInicial.toLocaleString()}</p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Neto filtrado</p>
              <p className={`mt-2 text-xl font-bold ${saldoCalculado >= 0 ? "text-green-400" : "text-red-400"}`}>
                ${saldoCalculado.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">Ingresos menos egresos</p>
            </div>
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-gray-500">Saldo último movimiento</p>
              <p className="mt-2 text-xl font-bold text-white">${saldoFinal.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500">Según la columna Saldo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-[#3A3A3A]">
            <div className="p-5">
              <h4 className="text-white font-semibold mb-3">Saldo por proveedor</h4>
              <div className="overflow-x-auto rounded-lg border border-[#3A3A3A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Proveedor", "Ingresos", "Egresos", "Saldo"].map((header) => (
                        <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {saldosPorProveedor.map((item) => (
                      <tr key={item.proveedor}>
                        <td className="px-3 py-2 font-semibold text-white">{item.proveedor}</td>
                        <td className="px-3 py-2 text-green-400">${item.ingresos.toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-400">${item.egresos.toLocaleString()}</td>
                        <td className={`px-3 py-2 font-bold ${item.saldo >= 0 ? "text-white" : "text-red-400"}`}>${item.saldo.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5">
              <h4 className="text-white font-semibold mb-3">Saldo por responsable</h4>
              <div className="overflow-x-auto rounded-lg border border-[#3A3A3A]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                      {["Responsable", "Ingresos", "Egresos", "Saldo"].map((header) => (
                        <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3A3A3A]">
                    {saldosPorResponsable.map((item) => (
                      <tr key={item.responsable}>
                        <td className="px-3 py-2 font-semibold text-white">{item.responsable}</td>
                        <td className="px-3 py-2 text-green-400">${item.ingresos.toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-400">${item.egresos.toLocaleString()}</td>
                        <td className={`px-3 py-2 font-bold ${item.saldo >= 0 ? "text-white" : "text-red-400"}`}>${item.saldo.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <FormModal
        open={showForm}
        title="Registrar movimiento"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white border border-[#2A3142] rounded-xl transition-colors">Cancelar</button>
            <button className="px-5 py-2.5 text-sm font-medium bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors shadow-md shadow-[#CC2229]/20">Guardar</button>
          </>
        }
      >
        {(() => {
          const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5";
          const inp = "w-full bg-[#0F1115] border border-[#252D3D] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
          return (
            <FormSection title="Transacción">
              <div>
                <label className={lbl}>Tipo</label>
                <select className={inp}>
                  <option>Ingreso</option>
                  <option>Egreso</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Monto ($)</label>
                <select className={inp}>
                  {[850, 3200, 3375, 4050, 12025, 13300, 15200, 16150, 22000].map((m) => <option key={m}>${m.toLocaleString()}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Responsable</label>
                <select className={inp}>
                  {["Admin", "José García", "Luis Ramírez", "Roberto Flores", "Alejandro Reyes", "Fernando Castillo", "Carlos Mendoza"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Proveedor / Cliente</label>
                <select className={inp}>
                  {["Proveedor general", ...clientes].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Descripción</label>
                <select className={inp}>
                  {["Cobro viaje", "Cobro pendiente cliente", "Pago diesel", "Pago refacciones", "Gastos varios operación", "Saldo inicial del día"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </FormSection>
          );
        })()}
      </FormModal>

      {/* Transaction Table */}
      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#3A3A3A]">
          <h3 className="text-white font-semibold">Movimientos de efectivo</h3>
          <p className="text-xs text-gray-500 mt-1">{filteredTransacciones.length} movimientos encontrados</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
                {["Fecha", "Proveedor", "Descripción", "Tipo", "Monto", "Responsable", "Saldo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A3A3A]">
              {filteredTransacciones.map((t, i) => (
                <tr key={i} className="hover:bg-[#2A2A2A] transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.fecha}</td>
                  <td className="px-4 py-3 text-white font-semibold">{t.cliente}</td>
                  <td className="px-4 py-3 text-gray-200">{t.descripcion}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.tipo} /></td>
                  <td className={`px-4 py-3 font-semibold ${t.tipo === "Ingreso" ? "text-green-400" : "text-red-400"}`}>
                    {t.tipo === "Ingreso" ? "+" : "-"}${t.monto.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{t.responsable}</td>
                  <td className="px-4 py-3 text-white font-bold">${t.saldo.toLocaleString()}</td>
                </tr>
              ))}
              {filteredTransacciones.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    No hay movimientos con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
