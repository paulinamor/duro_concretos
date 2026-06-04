"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  PauseCircle,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import StatusBadge from "@/components/StatusBadge";
import {
  AutomationArea,
  AutomationRule,
  automationRules,
  ejecutarAutomatizacion,
} from "@/lib/automations";

const areaOptions: Array<"Todas" | AutomationArea> = [
  "Todas",
  "SAT",
  "Ventas",
  "Transporte",
  "Operaciones",
  "Finanzas",
  "Recursos Humanos",
];

export default function AutomatizacionesPage() {
  const [rules, setRules] = useState<AutomationRule[]>(automationRules);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<"Todas" | AutomationArea>("Todas");
  const [runningId, setRunningId] = useState("");

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return rules.filter((rule) => {
      return (
        (area === "Todas" || rule.area === area) &&
        (
          rule.name.toLowerCase().includes(term) ||
          rule.description.toLowerCase().includes(term) ||
          rule.area.toLowerCase().includes(term)
        )
      );
    });
  }, [rules, query, area]);

  const activas = rules.filter((rule) => rule.status === "Activa").length;
  const pausadas = rules.filter((rule) => rule.status === "Pausada").length;
  const errores = rules.filter((rule) => rule.status === "Error").length;

  async function handleRun(rule: AutomationRule) {
    setRunningId(rule.id);
    try {
      const updated = await ejecutarAutomatizacion(rule);
      setRules((current) => current.map((item) => item.id === rule.id ? updated : item));
    } finally {
      setRunningId("");
    }
  }

  function handleToggle(rule: AutomationRule) {
    setRules((current) =>
      current.map((item) =>
        item.id === rule.id
          ? { ...item, status: item.status === "Activa" ? "Pausada" : "Activa" }
          : item,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Procesos automáticos del ERP por área</p>
        </div>
        <button className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Settings2 size={16} />
          Nueva regla
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Reglas activas" value={String(activas)} icon={Zap} iconColor="text-green-400" />
        <KPICard title="Reglas pausadas" value={String(pausadas)} icon={PauseCircle} iconColor="text-orange-400" />
        <KPICard title="Errores" value={String(errores)} icon={RefreshCw} iconColor="text-red-400" />
        <KPICard title="Procesos cubiertos" value={String(rules.length)} icon={Bot} iconColor="text-[#CC2229]" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar automatización"
            className="w-80 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value as "Todas" | AutomationArea)}
          className="bg-[#1A1A1A] border border-[#3A3A3A] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
        >
          {areaOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} reglas</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((rule) => (
          <div key={rule.id} className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-[#CC2229] uppercase tracking-wider">{rule.area}</span>
                  <StatusBadge status={rule.status} />
                </div>
                <h3 className="text-white font-semibold">{rule.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{rule.description}</p>
              </div>
              <button
                onClick={() => handleToggle(rule)}
                className="p-2 rounded-lg bg-[#1A1A1A] border border-[#3A3A3A] text-gray-300 hover:text-white hover:border-[#CC2229] transition-colors"
                aria-label="Activar o pausar automatización"
              >
                {rule.status === "Activa" ? <PauseCircle size={16} /> : <Play size={16} />}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-3">
                <p className="text-gray-500 text-xs flex items-center gap-1"><Clock size={12} /> Frecuencia</p>
                <p className="text-white text-sm font-medium mt-1">{rule.frequency}</p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-3">
                <p className="text-gray-500 text-xs">Última ejecución</p>
                <p className="text-white text-sm font-medium mt-1">{rule.lastRun}</p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg p-3">
                <p className="text-gray-500 text-xs">Próxima ejecución</p>
                <p className="text-white text-sm font-medium mt-1">{rule.nextRun}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-[#3A3A3A]">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle2 size={15} className="text-green-400" />
                {rule.result}
              </div>
              <button
                onClick={() => handleRun(rule)}
                disabled={runningId === rule.id}
                className="flex items-center gap-2 bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#CC2229] disabled:opacity-60 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                {runningId === rule.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {runningId === rule.id ? "Ejecutando..." : rule.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
