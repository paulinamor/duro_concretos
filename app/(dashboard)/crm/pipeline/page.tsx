"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Pencil,
  Phone,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import {
  pipelineStages,
  PipelineStage,
  type CrmOpportunity,
} from "@/lib/crmPipeline";
import { getCollectionDocs, upsertDocument, deleteDocument, COLLECTIONS } from "@/lib/db";

type Opp = CrmOpportunity;

interface OppForm {
  cliente: string; obra: string; contacto: string; telefono: string;
  valorEstimado: string; m3Estimados: string; fechaSeguimiento: string;
  responsable: string; etapa: PipelineStage; proximaAccion: string;
}

const emptyOppForm = (): OppForm => ({
  cliente: "", obra: "", contacto: "", telefono: "",
  valorEstimado: "", m3Estimados: "",
  fechaSeguimiento: new Date().toISOString().slice(0, 10),
  responsable: "", etapa: "Prospecto", proximaAccion: "",
});

const probabilidadPorEtapa: Record<PipelineStage, number> = {
  Prospecto: 20, Calificado: 35, Cotización: 55, Negociación: 70, Cierre: 90,
};

function OppDrawer({ open, onClose, onSave, editing }: {
  open: boolean;
  onClose: () => void;
  onSave: (form: OppForm, id?: string) => void;
  editing?: Opp | null;
}) {
  const [form, setForm] = useState<OppForm>(emptyOppForm);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        cliente: editing.cliente, obra: editing.obra,
        contacto: editing.contacto, telefono: editing.telefono,
        valorEstimado: String(editing.valorEstimado),
        m3Estimados: String(editing.m3Estimados),
        fechaSeguimiento: editing.fechaSeguimiento,
        responsable: editing.responsable,
        etapa: editing.etapa,
        proximaAccion: editing.proximaAccion,
      });
    } else {
      setForm(emptyOppForm());
    }
  }, [open, editing]);

  const set = (k: keyof OppForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const inp = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#CC2229]/60 focus:ring-1 focus:ring-[#CC2229]/20 transition-colors";
  const lbl = "block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CC2229]/10 text-[#CC2229]">
              <Target size={18} />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">{editing ? "Editar oportunidad" : "Nueva oportunidad"}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Cliente</label>
              <input type="text" value={form.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nombre del cliente" className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Obra / Proyecto</label>
              <input type="text" value={form.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Nombre del proyecto" className={inp} />
            </div>
            <div>
              <label className={lbl}>Contacto</label>
              <input type="text" value={form.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="Nombre" className={inp} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input type="text" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="81 xxxx xxxx" className={inp} />
            </div>
            <div>
              <label className={lbl}>Valor estimado $</label>
              <input type="number" value={form.valorEstimado} onChange={(e) => set("valorEstimado", e.target.value)} placeholder="0" className={inp} />
            </div>
            <div>
              <label className={lbl}>M3 estimados</label>
              <input type="number" value={form.m3Estimados} onChange={(e) => set("m3Estimados", e.target.value)} placeholder="0" className={inp} />
            </div>
            <div>
              <label className={lbl}>Etapa</label>
              <select value={form.etapa} onChange={(e) => set("etapa", e.target.value as PipelineStage)} className={inp}>
                {pipelineStages.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fecha seguimiento</label>
              <input type="date" value={form.fechaSeguimiento} onChange={(e) => set("fechaSeguimiento", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Responsable</label>
              <input type="text" value={form.responsable} onChange={(e) => set("responsable", e.target.value)} placeholder="Ej. Ventas MTY" className={inp} />
            </div>
            <div>
              <label className={lbl}>Próxima acción</label>
              <input type="text" value={form.proximaAccion} onChange={(e) => set("proximaAccion", e.target.value)} placeholder="Ej. Llamar para cotizar" className={inp} />
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">Cancelar</button>
          <button
            onClick={() => { if (form.cliente) { onSave(form, editing?.id); onClose(); } }}
            disabled={!form.cliente}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#CC2229] hover:bg-[#B01E24] text-white rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-[#CC2229]/20"
          >
            <Target size={14} />
            {editing ? "Actualizar" : "Guardar oportunidad"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrmPipelinePage() {
  const [opportunities, setOpportunities] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opp | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  useEffect(() => {
    getCollectionDocs<Opp>(COLLECTIONS.pipeline).then((docs) => {
      setOpportunities(docs);
      setLoading(false);
    });
  }, []);

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

  async function handleSave(form: OppForm, existingId?: string) {
    const id = existingId ?? `crm-${Date.now()}`;
    const doc: Opp = {
      id,
      cliente: form.cliente, obra: form.obra, contacto: form.contacto,
      telefono: form.telefono, valorEstimado: Number(form.valorEstimado) || 0,
      m3Estimados: Number(form.m3Estimados) || 0, etapa: form.etapa,
      probabilidad: probabilidadPorEtapa[form.etapa],
      fechaSeguimiento: form.fechaSeguimiento, responsable: form.responsable,
      proximaAccion: form.proximaAccion || "Dar seguimiento comercial",
    };
    await upsertDocument(COLLECTIONS.pipeline, id, doc);
    setOpportunities((cur) =>
      existingId ? cur.map((o) => o.id === id ? doc : o) : [doc, ...cur]
    );
  }

  async function handleDelete(id: string) {
    await deleteDocument(COLLECTIONS.pipeline, id);
    setOpportunities((cur) => cur.filter((o) => o.id !== id));
    setConfirmDeleteId(null);
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
    const dragged = opportunities.find((item) => item.id === draggedId);
    if (!dragged) { setDraggedId(null); setDragOverStage(null); return; }
    const updated = { ...dragged, etapa: stage, probabilidad: probabilidadPorEtapa[stage] };
    upsertDocument(COLLECTIONS.pipeline, dragged.id, updated);
    setOpportunities((cur) => [updated, ...cur.filter((item) => item.id !== draggedId)]);
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

      <OppDrawer
        open={showForm}
        onClose={() => { setShowForm(false); setEditingOpp(null); }}
        onSave={handleSave}
        editing={editingOpp}
      />

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
                    <div className="mt-3 pt-2 border-t border-[#2A2A2A] flex justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingOpp(opportunity); setShowForm(true); }}
                        className="p-1.5 text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                        aria-label="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(opportunity.id); }}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-[#1A1A1A] border border-[#3A3A3A] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Eliminar oportunidad</h3>
            <p className="text-xs text-gray-500 mb-5">¿Eliminar esta oportunidad del pipeline? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-[#3A3A3A] rounded-xl hover:border-gray-500 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
