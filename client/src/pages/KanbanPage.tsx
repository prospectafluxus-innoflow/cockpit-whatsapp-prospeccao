import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Building2, Star, GripVertical } from "lucide-react";

const COLUMNS = [
  "Novo",
  "Toque 1 Enviado",
  "Toque 2 Enviado",
  "Toque 3 Enviado",
  "Respondeu",
  "Fechado",
] as const;

type KanbanColumn = (typeof COLUMNS)[number];

const columnColors: Record<KanbanColumn, string> = {
  "Novo": "border-t-slate-400",
  "Toque 1 Enviado": "border-t-blue-400",
  "Toque 2 Enviado": "border-t-violet-400",
  "Toque 3 Enviado": "border-t-orange-400",
  "Respondeu": "border-t-emerald-400",
  "Fechado": "border-t-pink-400",
};

const columnBadge: Record<KanbanColumn, string> = {
  "Novo": "bg-slate-400/10 text-slate-400 border-slate-400/30",
  "Toque 1 Enviado": "bg-blue-400/10 text-blue-400 border-blue-400/30",
  "Toque 2 Enviado": "bg-violet-400/10 text-violet-400 border-violet-400/30",
  "Toque 3 Enviado": "bg-orange-400/10 text-orange-400 border-orange-400/30",
  "Respondeu": "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  "Fechado": "bg-pink-400/10 text-pink-400 border-pink-400/30",
};

const layerColors: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

export default function KanbanPage() {
  const utils = trpc.useUtils();
  const { data: kanban, isLoading } = trpc.leads.kanban.useQuery();
  const [dragging, setDragging] = useState<{ id: number; fromCol: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const moveKanban = trpc.leads.moveKanban.useMutation({
    onSuccess: () => utils.leads.kanban.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const handleDragStart = (leadId: number, fromCol: string) => {
    setDragging({ id: leadId, fromCol });
  };

  const handleDrop = (toCol: KanbanColumn) => {
    if (!dragging || dragging.fromCol === toCol) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    moveKanban.mutate({ leadId: dragging.id, column: toCol });
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Kanban CRM</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Visualize e mova seus leads entre as etapas do pipeline</p>
      </div>

      {/* Board */}
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map((col) => {
            const colLeads = kanban?.[col] ?? [];
            const isDragTarget = dragOver === col;

            return (
              <div
                key={col}
                className={`w-64 flex flex-col gap-3 transition-all`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col)}
              >
                {/* Column header */}
                <div className={`rounded-xl border border-t-2 ${columnColors[col]} border-border/60 bg-card p-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{col}</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${columnBadge[col]}`}>
                      {colLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div
                  className={`flex flex-col gap-2 min-h-[120px] rounded-xl transition-all ${
                    isDragTarget ? "bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  {isLoading
                    ? [1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                    : colLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id, col)}
                          onDragEnd={() => { setDragging(null); setDragOver(null); }}
                          className={`rounded-xl border border-border/60 bg-card p-3 cursor-grab active:cursor-grabbing transition-all hover:border-border hover:shadow-md ${
                            dragging?.id === lead.id ? "opacity-50 scale-95" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lead.name}</p>
                              {lead.company && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                                </div>
                              )}
                            </div>
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${layerColors[lead.layer]}`}>
                              {lead.layer}
                            </span>
                            {col === "Respondeu" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-blue-400/10 text-blue-400 border-blue-400/30">
                                {lead.toque3SentAt ? "Via T3" : lead.toque2SentAt ? "Via T2" : "Via T1"}
                              </span>
                            )}
                            <div className="flex items-center gap-1 ml-auto">
                              <Star className="h-3 w-3 text-amber-400" />
                              <span className="font-mono text-xs text-muted-foreground">{lead.score ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}

                  {!isLoading && colLeads.length === 0 && (
                    <div className={`rounded-xl border border-dashed border-border/40 p-4 text-center transition-all ${
                      isDragTarget ? "border-primary/40 bg-primary/5" : ""
                    }`}>
                      <p className="text-xs text-muted-foreground/50">
                        {isDragTarget ? "Soltar aqui" : "Sem leads"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
