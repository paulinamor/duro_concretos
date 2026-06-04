"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Phone,
  Plus,
  Search,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import FormModal from "@/components/FormModal";
import {
  crmOpportunities,
  pipelineStages,
  PipelineStage,
} from "@/lib/crmPipeline";

export default function CrmPipelinePage() {
  const [opportunities, setOpportunities] = useState(crmOpportunities);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  const probabilidadPorEtapa: Record<PipelineStage, number> = {
    Prospecto: 20,
    Calificado: 35,
    Cotización: 55,
    Negociación: 70,
    Cierre: 90,
  };

  const filtered = useMemo(() => {
    const term = query.toLowerCase();
    return opportunities.filter((opportunity) => {
      return (
        opportunity.cliente.toLowerCase().includes(term) ||
        opportunity.obra.toLowerCase().includes(term) ||
        opportunity.contacto.toLowerCase().includes(term)
      );
    });
  }, [opportunities, query]);

  const totalPipeline = opportunities.reduce((sum, item) => sum + item.valorEstimado, 0);
  const weightedPipeline = opportunities.reduce((sum, item) => sum + (item.valorEstimado * item.probabilidad / 100), 0);
  const totalM3 = opportunities.reduce((sum, item) => sum + item.m3Estimados, 0);
  const cierre = opportunities.filter((item) => item.etapa === "Cierre").length;

  function handleSave(values: Record<string, string>) {
    const next = opportunities.length + 1;
    const etapa = (values.Etapa || "Prospecto") as PipelineStage;

    setOpportunities((current) => [
      {
        id: `CRM-${String(next).padStart(3, "0")}`,
        cliente: values.Cliente || "Grupo Alfa Logistica",
        contacto: values.Contacto || "Mariana Robles",
        telefono: values.Teléfono || "81 1200 8841",
        obra: values.Obra || "Nave industrial Apodaca",
        etapa,
        valorEstimado: Number(values["Valor estimado"]?.replace(/[$,]/g, "") || 0),
        m3Estimados: Number(values["M3 estimados"]?.replace(" m3", "") || 0),
        probabilidad: probabilidadPorEtapa[etapa],
        proximaAccion: "Dar seguimiento comercial",
        fechaSeguimiento: values["Fecha seguimiento"] || "2026-05-26",
        responsable: values.Responsable || "Ventas MTY",
      },
      ...current,
    ]);
  }

  function handleDragStart(opportunityId: string) {
    setDraggedId(opportunityId);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, stage: PipelineStage) {
    event.preventDefault();
    setDragOverStage(stage);
  }

  function handleDrop(stage: PipelineStage) {
    if (!draggedId) return;

    setOpportunities((current) => {
      const dragged = current.find((item) => item.id === draggedId);
      if (!dragged) return current;

      const updated = {
        ...dragged,
        etapa: stage,
        probabilidad: probabilidadPorEtapa[stage],
      };

      return [
        updated,
        ...current.filter((item) => item.id !== draggedId),
      ];
    });

    setDraggedId(null);
    setDragOverStage(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStage(null);
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportPipelineExcel() {
    const rows = opportunities.map((item) => `
      <tr>
        <td>${item.id}</td>
        <td>${item.cliente}</td>
        <td>${item.obra}</td>
        <td>${item.contacto}</td>
        <td>${item.telefono}</td>
        <td>${item.etapa}</td>
        <td>${item.valorEstimado}</td>
        <td>${item.m3Estimados}</td>
        <td>${item.probabilidad}%</td>
        <td>${item.fechaSeguimiento}</td>
        <td>${item.responsable}</td>
        <td>${item.proximaAccion}</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Obra</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Etapa</th>
                <th>Valor estimado</th>
                <th>M3 estimados</th>
                <th>Probabilidad</th>
                <th>Fecha seguimiento</th>
                <th>Responsable</th>
                <th>Próxima acción</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadFile("reporte-crm-pipeline.xls", html, "application/vnd.ms-excel;charset=utf-8");
  }

  function exportPipelinePdf() {
    const rows = opportunities.map((item) => `
      <tr>
        <td>${item.id}</td>
        <td>${item.cliente}</td>
        <td>${item.obra}</td>
        <td>${item.etapa}</td>
        <td>$${item.valorEstimado.toLocaleString()}</td>
        <td>${item.probabilidad}%</td>
        <td>${item.fechaSeguimiento}</td>
        <td>${item.responsable}</td>
      </tr>
    `).join("");

    const printable = window.open("", "_blank", "width=1200,height=800");
    if (!printable) return;

    printable.document.write(`
      <html>
        <head>
          <title>Reporte CRM Pipeline</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 20px; color: #6B7280; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #111827; color: white; text-align: left; padding: 10px; }
            td { border-bottom: 1px solid #E5E7EB; padding: 10px; }
            .summary { display: flex; gap: 18px; margin: 18px 0 24px; }
            .summary div { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 12px; }
            .summary strong { display: block; font-size: 16px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>Reporte CRM Pipeline</h1>
          <p>Duro Concretos · ${new Date().toLocaleDateString("es-MX")}</p>
          <div class="summary">
            <div><span>Valor pipeline</span><strong>$${Math.round(totalPipeline).toLocaleString()}</strong></div>
            <div><span>Pipeline ponderado</span><strong>$${Math.round(weightedPipeline).toLocaleString()}</strong></div>
            <div><span>M3 estimados</span><strong>${totalM3.toLocaleString()} m3</strong></div>
            <div><span>Oportunidades</span><strong>${opportunities.length}</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Obra</th>
                <th>Etapa</th>
                <th>Valor</th>
                <th>Prob.</th>
                <th>Seguimiento</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printable.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-gray-500 text-sm mt-0.5">Pipeline comercial de 5 etapas</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#CC2229] hover:bg-[#991A1E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva oportunidad
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Valor pipeline" value={`$${Math.round(totalPipeline).toLocaleString()}`} icon={DollarSign} iconColor="text-[#CC2229]" />
        <KPICard title="Pipeline ponderado" value={`$${Math.round(weightedPipeline).toLocaleString()}`} icon={TrendingUp} iconColor="text-green-400" />
        <KPICard title="M3 estimados" value={`${totalM3.toLocaleString()} m3`} icon={Target} iconColor="text-blue-400" />
        <KPICard title="Oportunidades cierre" value={String(cierre)} icon={UsersRound} iconColor="text-orange-400" />
      </div>

      <div className="bg-[#242424] border border-[#3A3A3A] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, contacto u obra"
            className="w-96 max-w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]"
          />
        </div>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} oportunidades</span>
        <button
          type="button"
          onClick={exportPipelineExcel}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-green-500/50 hover:text-green-300"
        >
          <FileSpreadsheet size={15} />
          Excel
        </button>
        <button
          type="button"
          onClick={exportPipelinePdf}
          className="flex items-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-[#CC2229]/60 hover:text-[#CC2229]"
        >
          <FileText size={15} />
          PDF
        </button>
      </div>

      <FormModal
        open={showForm}
        title="Nueva oportunidad CRM"
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#3A3A3A] rounded-lg transition-colors">Cancelar</button>
            <button className="px-4 py-2 text-sm bg-[#CC2229] hover:bg-[#991A1E] text-white rounded-lg transition-colors">Guardar oportunidad</button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cliente</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {opportunities.map((item) => <option key={item.id}>{item.cliente}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contacto</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {opportunities.map((item) => <option key={`${item.id}-contacto`}>{item.contacto}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {opportunities.map((item) => <option key={`${item.id}-telefono`}>{item.telefono}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Obra</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {opportunities.map((item) => <option key={`${item.id}-obra`}>{item.obra}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Valor estimado</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[96000, 185000, 228000, 342000, 410000, 512000].map((valor) => <option key={valor}>${valor.toLocaleString()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">M3 estimados</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {[48, 100, 120, 180, 205, 256].map((m3) => <option key={m3}>{m3} m3</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Fecha seguimiento</label>
            <input type="date" className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Responsable</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {["Ventas MTY", "Ana López", "Carlos Ortiz"].map((responsable) => <option key={responsable}>{responsable}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Etapa</label>
            <select className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#CC2229]">
              {pipelineStages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </div>
        </div>
      </FormModal>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {pipelineStages.map((stage: PipelineStage) => {
          const stageItems = filtered.filter((opportunity) => opportunity.etapa === stage);
          return (
            <div
              key={stage}
              onDragOver={(event) => handleDragOver(event, stage)}
              onDragLeave={() => setDragOverStage((current) => current === stage ? null : current)}
              onDrop={() => handleDrop(stage)}
              className={`bg-[#242424] border rounded-xl min-h-[420px] transition-colors ${
                dragOverStage === stage
                  ? "border-[#CC2229] bg-[#CC2229]/10"
                  : "border-[#3A3A3A]"
              }`}
            >
              <div className="px-4 py-3 border-b border-[#3A3A3A]">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-white font-semibold text-sm">{stage}</h3>
                  <span className="text-xs text-gray-500">{stageItems.length}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">${stageItems.reduce((sum, item) => sum + item.valorEstimado, 0).toLocaleString()}</p>
              </div>
              <div className="p-3 space-y-3">
                {stageItems.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    draggable
                    onDragStart={() => handleDragStart(opportunity.id)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing bg-[#1A1A1A] border rounded-lg p-3 transition-colors ${
                      draggedId === opportunity.id
                        ? "border-[#CC2229] opacity-60"
                        : "border-[#3A3A3A] hover:border-[#CC2229]/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold text-sm">{opportunity.cliente}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{opportunity.obra}</p>
                      </div>
                      <span className="text-[#CC2229] text-xs font-mono">{opportunity.id}</span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-gray-400">
                      <p className="flex items-center gap-1"><Phone size={12} /> {opportunity.contacto}</p>
                      <p className="flex items-center gap-1"><CalendarDays size={12} /> {opportunity.fechaSeguimiento}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-md bg-[#242424] px-2 py-1">
                        <p className="text-gray-500 text-[11px]">Valor</p>
                        <p className="text-white text-xs font-semibold">${opportunity.valorEstimado.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md bg-[#242424] px-2 py-1">
                        <p className="text-gray-500 text-[11px]">Prob.</p>
                        <p className="text-green-400 text-xs font-semibold">{opportunity.probabilidad}%</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#3A3A3A]">
                      <p className="text-gray-500 text-[11px]">Próxima acción</p>
                      <p className="text-gray-300 text-xs mt-0.5">{opportunity.proximaAccion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
