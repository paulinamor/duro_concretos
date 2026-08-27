"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BadgeCheck, ChevronDown, ChevronRight,
  CreditCard, DollarSign, Eye, Search, Users, X,
} from "lucide-react";
import AppSelect from "@/components/AppSelect";
import KPICard from "@/components/KPICard";
import { upsertDocument, getCollectionDocs, COLLECTIONS } from "@/lib/db";
import { filterByPlanta, withPlantaTag } from "@/lib/auth";
import { todayCST } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prog {
  id: string;
  dia: string;
  cliente: string;
  folio?: string;
  total: number | null;
  montoPagado: number | null;
  fechaPago?: string;
  metodoPago?: string;
  nombreObra?: string;
  planta?: string;
}

interface AbonoForm {
  monto: string;
  fecha: string;
  metodo: string;
  banco: string;
  referencia: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s?: string | null) {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function currency(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const METODOS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta"];
const BANCOS  = ["BBVA", "Banregio", "Santander", "HSBC", "Banamex", "Otro"];

// Distribuye un monto entre programaciones pendientes (más antiguas primero)
function distribuir(progs: Prog[], monto: number) {
  const sorted = [...progs]
    .filter((p) => (p.total ?? 0) - (p.montoPagado ?? 0) > 0.01)
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const resultado: { id: string; montoPagado: number; fechaPago?: string }[] = [];
  let restante = monto;

  for (const p of sorted) {
    if (restante <= 0) break;
    const pendiente = (p.total ?? 0) - (p.montoPagado ?? 0);
    const aplicar   = Math.min(restante, pendiente);
    resultado.push({
      id: p.id,
      montoPagado: (p.montoPagado ?? 0) + aplicar,
    });
    restante -= aplicar;
  }

  return { resultado, sobrante: restante };
}

// ─── Drawer de abono ──────────────────────────────────────────────────────────

function AbonoDrawer({
  cliente, progs, onClose, onSaved,
}: {
  cliente: string;
  progs: Prog[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AbonoForm>({
    monto: "", fecha: todayCST(), metodo: "Efectivo", banco: "", referencia: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const totalPendiente = progs.reduce((s, p) => s + (p.total ?? 0) - (p.montoPagado ?? 0), 0);
  const monto = parseFloat(form.monto) || 0;
  const { resultado, sobrante } = useMemo(() => distribuir(progs, monto), [progs, monto]);
  const sobrepago = sobrante > 0.01;

  function set(k: keyof AbonoForm, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!monto || monto <= 0) { setError("Ingresa un monto válido."); return; }
    setSaving(true); setError("");
    try {
      for (const r of resultado) {
        await upsertDocument(COLLECTIONS.programaciones, r.id, withPlantaTag({
          montoPagado: r.montoPagado,
          fechaPago:   form.fecha,
          metodoPago:  form.metodo + (form.banco ? ` - ${form.banco}` : ""),
        }));
      }
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  const inp  = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#CC2229] focus:ring-1 focus:ring-[#CC2229]/20";
  const lbl  = "block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900">Registrar abono</p>
            <p className="text-xs text-gray-500 mt-0.5">{cliente}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-4">
          {/* Saldo pendiente */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">Total pendiente del cliente</span>
            <span className="text-base font-bold text-gray-900">{currency(totalPendiente)}</span>
          </div>

          {/* Monto */}
          <div>
            <label className={lbl}>Monto del abono <span className="text-[#CC2229]">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="0.00" className={`${inp} pl-7`}
                onWheel={(e) => e.currentTarget.blur()} />
            </div>
            {sobrepago && (
              <div className="mt-2 flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={13} />
                <span className="text-xs font-medium">Sobrepago de {currency(sobrante)} — excede el saldo pendiente</span>
              </div>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className={lbl}>Fecha de pago</label>
            <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} className={inp} />
          </div>

          {/* Método */}
          <div>
            <label className={lbl}>Método de pago</label>
            <AppSelect value={form.metodo} onChange={(e) => set("metodo", e.target.value)}>
              {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </AppSelect>
          </div>

          {/* Banco (solo si no es efectivo) */}
          {form.metodo !== "Efectivo" && (
            <div>
              <label className={lbl}>Banco</label>
              <AppSelect value={form.banco} onChange={(e) => set("banco", e.target.value)}>
                <option value="">Seleccionar…</option>
                {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
              </AppSelect>
            </div>
          )}

          {/* Referencia */}
          <div>
            <label className={lbl}>Referencia / Folio</label>
            <input value={form.referencia} onChange={(e) => set("referencia", e.target.value)}
              placeholder="Número de transferencia, cheque…" className={inp} />
          </div>

          {/* Distribución */}
          {monto > 0 && resultado.length > 0 && (
            <div>
              <label className={lbl}>Distribución automática</label>
              <div className="space-y-2">
                {resultado.map((r) => {
                  const prog = progs.find((p) => p.id === r.id)!;
                  const pendienteAntes = (prog.total ?? 0) - (prog.montoPagado ?? 0);
                  const aplicado = r.montoPagado - (prog.montoPagado ?? 0);
                  const quedaPendiente = pendienteAntes - aplicado;
                  return (
                    <div key={r.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">{prog.folio ?? prog.id} · {prog.nombreObra || fmtDate(prog.dia)}</span>
                        <span className="font-bold text-[#CC2229]">−{currency(aplicado)}</span>
                      </div>
                      <div className="flex justify-between mt-0.5 text-gray-400">
                        <span>Total: {currency(prog.total ?? 0)}</span>
                        <span>Queda: {quedaPendiente < 0.01 ? <span className="text-emerald-500 font-semibold">Saldado</span> : currency(quedaPendiente)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer">Cancelar</button>
          <button onClick={handleSave} disabled={saving || monto <= 0}
            className="flex-1 py-2.5 text-sm font-bold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl disabled:opacity-50 cursor-pointer">
            {saving ? "Guardando…" : "Registrar abono"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de cliente ──────────────────────────────────────────────────────────

function ClienteRow({
  cliente, progs, onAbono,
}: {
  cliente: string;
  progs: Prog[];
  onAbono: (cliente: string, progs: Prog[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const total     = progs.reduce((s, p) => s + (p.total ?? 0), 0);
  const pagado    = progs.reduce((s, p) => s + (p.montoPagado ?? 0), 0);
  const pendiente = total - pagado;
  const pct       = total > 0 ? (pagado / total) * 100 : 0;

  const statusColor = pendiente < 0.01 ? "text-emerald-500" : pendiente < total * 0.5 ? "text-amber-500" : "text-red-500";

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 shrink-0">
          <Users size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{cliente}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
              <div className="h-1.5 rounded-full bg-[#CC2229] transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{progs.length} coladas</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${statusColor}`}>{currency(pendiente)} pend.</p>
          <p className="text-[10px] text-gray-400">{currency(total)} total</p>
        </div>
        {pendiente > 0.01 && (
          <button
            onClick={(e) => { e.stopPropagation(); onAbono(cliente, progs); }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#CC2229] hover:bg-[#B01E24] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <CreditCard size={12} /> Abonar
          </button>
        )}
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {[...progs].sort((a, b) => a.dia.localeCompare(b.dia)).map((p) => {
            const pend = (p.total ?? 0) - (p.montoPagado ?? 0);
            const pagPct = (p.total ?? 0) > 0 ? ((p.montoPagado ?? 0) / (p.total ?? 0)) * 100 : 0;
            const badge = pend < 0.01
              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : (p.montoPagado ?? 0) > 0
              ? "bg-amber-50 text-amber-600 border-amber-100"
              : "bg-red-50 text-red-500 border-red-100";
            const label = pend < 0.01 ? "Pagado" : (p.montoPagado ?? 0) > 0 ? "Parcial" : "Pendiente";
            return (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">{p.folio ?? p.id}</span>
                    {p.nombreObra && <span className="text-xs text-gray-400 truncate max-w-[160px]">{p.nombreObra}</span>}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${badge}`}>{label}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(p.dia)}</p>
                  <div className="mt-1.5 bg-gray-100 rounded-full h-1 max-w-[100px]">
                    <div className="h-1 rounded-full bg-[#CC2229]" style={{ width: `${Math.min(pagPct, 100)}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-gray-900">{currency(p.total ?? 0)}</p>
                  {(p.montoPagado ?? 0) > 0 && <p className="text-emerald-500">−{currency(p.montoPagado ?? 0)}</p>}
                  {pend > 0.01 && <p className="text-red-500 font-semibold">{currency(pend)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CobrosPage() {
  const [progs,   setProgs]   = useState<Prog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState<"todos" | "pendiente" | "parcial" | "pagado">("pendiente");
  const [abono,   setAbono]   = useState<{ cliente: string; progs: Prog[] } | null>(null);
  const [tick,    setTick]    = useState(0);

  useEffect(() => {
    setLoading(true);
    getCollectionDocs<Prog>(COLLECTIONS.programaciones)
      .then((docs) => {
        const filtered = filterByPlanta(docs).filter((p) => (p.total ?? 0) > 0 && p.cliente?.trim());
        setProgs(filtered);
      })
      .finally(() => setLoading(false));
  }, [tick]);

  const grouped = useMemo(() => {
    const map = new Map<string, Prog[]>();
    for (const p of progs) {
      const k = norm(p.cliente);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }

    return Array.from(map.entries())
      .map(([cliente, ps]) => {
        const total     = ps.reduce((s, p) => s + (p.total ?? 0), 0);
        const pagado    = ps.reduce((s, p) => s + (p.montoPagado ?? 0), 0);
        const pendiente = total - pagado;
        return { cliente, progs: ps, total, pagado, pendiente };
      })
      .filter(({ cliente, pendiente, pagado, total }) => {
        const matchSearch = !search || cliente.includes(search.toUpperCase());
        const matchFiltro =
          filtro === "todos" ? true
          : filtro === "pendiente" ? pendiente >= total * 0.99
          : filtro === "parcial"   ? pendiente > 0.01 && pagado > 0.01
          : pendiente < 0.01;
        return matchSearch && matchFiltro;
      })
      .sort((a, b) => b.pendiente - a.pendiente);
  }, [progs, search, filtro]);

  const kpiTotal     = progs.reduce((s, p) => s + (p.total ?? 0), 0);
  const kpiPagado    = progs.reduce((s, p) => s + (p.montoPagado ?? 0), 0);
  const kpiPendiente = kpiTotal - kpiPagado;
  const kpiClientes  = new Set(progs.filter((p) => (p.total ?? 0) - (p.montoPagado ?? 0) > 0.01).map((p) => norm(p.cliente))).size;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total facturado"    value={currency(kpiTotal)}     icon={DollarSign}    iconColor="text-gray-400"    iconBg="bg-gray-500/10" />
        <KPICard title="Cobrado"            value={currency(kpiPagado)}    icon={BadgeCheck}    iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <KPICard title="Por cobrar"         value={currency(kpiPendiente)} icon={AlertTriangle} iconColor="text-red-400"     iconBg="bg-red-500/10" />
        <KPICard title="Clientes con deuda" value={String(kpiClientes)}    icon={Users}         iconColor="text-amber-400"   iconBg="bg-amber-500/10" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#CC2229]" />
        </div>
        <div className="flex gap-2">
          {(["pendiente", "parcial", "pagado", "todos"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer capitalize ${
                filtro === f ? "bg-[#CC2229] border-[#CC2229] text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
              {f === "todos" ? "Todos" : f === "pendiente" ? "Sin pagar" : f === "parcial" ? "Parcial" : "Pagados"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando…</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {search ? "Sin resultados" : "No hay registros"}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ cliente, progs: ps }) => (
            <ClienteRow key={cliente} cliente={cliente} progs={ps}
              onAbono={(c, p) => setAbono({ cliente: c, progs: p })} />
          ))}
        </div>
      )}

      {/* Drawer de abono */}
      {abono && (
        <AbonoDrawer
          cliente={abono.cliente}
          progs={abono.progs}
          onClose={() => setAbono(null)}
          onSaved={() => setTick((t) => t + 1)}
        />
      )}
    </div>
  );
}
