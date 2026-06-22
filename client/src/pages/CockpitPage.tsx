import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload,
  Search,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Download,
  Sparkles,
  Copy,
  Building2,
  Star,
  Clock,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";

const DAILY_LIMIT = 30;

type Lead = {
  id: number;
  name: string;
  firstName: string | null;
  company: string | null;
  whatsapp: string;
  score: number | null;
  layer: "A" | "B" | "C";
  status: string;
  kanbanColumn: string;
  nextToque: number;
  canSendNow: boolean;
  waLink: string | null;
  toque1SentAt: Date | null;
  toque2SentAt: Date | null;
  toque3SentAt: Date | null;
};

const layerColors: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  toque1_enviado: "Toque 1 Enviado",
  toque2_enviado: "Toque 2 Enviado",
  toque3_enviado: "Toque 3 Enviado",
  respondeu: "Respondeu",
  fechado: "Fechado",
  descartado: "Descartado",
};

function daysAgo(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export default function CockpitPage() {
  const [layerFilter, setLayerFilter] = useState<"" | "A" | "B" | "C">("");
  const [search, setSearch] = useState("");
  const [aiModal, setAiModal] = useState<{ open: boolean; lead: Lead | null; suggestion: string }>({
    open: false,
    lead: null,
    suggestion: "",
  });
  const [discardConfirm, setDiscardConfirm] = useState<Lead | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: leads = [], isLoading } = trpc.leads.list.useQuery({
    layer: layerFilter || undefined,
    search: search || undefined,
  });

  const { data: metrics } = trpc.dashboard.metrics.useQuery();

  const registerSend = trpc.leads.registerSend.useMutation({
    onSuccess: (data) => {
      toast.success(`Toque ${data.toque} registrado! (${data.newCount}/${DAILY_LIMIT} hoje)`);
      utils.leads.list.invalidate();
      utils.dashboard.metrics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.dashboard.metrics.invalidate();
      utils.leads.kanban.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const aiSuggestion = trpc.leads.aiSuggestion.useMutation({
    onSuccess: (data, vars) => {
      const lead = leads.find((l) => l.id === vars.leadId) ?? null;
      setAiModal({ open: true, lead, suggestion: data.suggestion });
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadLeads = trpc.leads.upload.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.inserted} leads importados com sucesso!`);
      utils.leads.list.invalidate();
      utils.dashboard.metrics.invalidate();
      setUploading(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const exportCSV = trpc.leads.exportCSV.useQuery(undefined, { enabled: false });

  const handleExport = async () => {
    const result = await utils.leads.exportCSV.fetch();
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cockpit-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        const layerSheets: Record<string, "A" | "B" | "C"> = {};
        for (const name of wb.SheetNames) {
          if (name.includes("Camada A") || name.toLowerCase().includes("icp")) layerSheets[name] = "A";
          else if (name.includes("Camada B") || name.toLowerCase().includes("quase")) layerSheets[name] = "B";
          else if (name.includes("Camada C") || name.toLowerCase().includes("academia")) layerSheets[name] = "C";
        }

        const allLeads: any[] = [];

        for (const [sheetName, layer] of Object.entries(layerSheets)) {
          const ws = wb.Sheets[sheetName]!;
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

          for (const row of rows) {
            const name = row["Nome"] || row["name"] || row["NOME"] || "";
            const whatsapp = String(row["WhatsApp"] || row["whatsapp"] || row["Telefone"] || row["telefone"] || "").replace(/\D/g, "");
            if (!name || !whatsapp || whatsapp.length < 10) continue;

            allLeads.push({
              name: String(name).trim(),
              firstName: String(name).split(" ")[0] ?? String(name),
              company: String(row["Empresa"] || row["empresa"] || "").trim() || undefined,
              whatsapp,
              score: Number(row["Score"] || row["score"] || 0) || 0,
              layer,
              size: String(row["Porte"] || row["porte"] || "").trim() || undefined,
              employees: Number(row["Func."] || row["Funcionários"] || row["funcionarios"] || 0) || undefined,
              investment: String(row["Investe Mkt"] || row["investment"] || "").trim() || undefined,
              taxRegime: String(row["Regime"] || row["regime"] || "").trim() || undefined,
              participations: Number(row["Part."] || row["participacoes"] || 0) || undefined,
              lastEvent: String(row["Último evento"] || row["ultimo_evento"] || "").trim() || undefined,
            });
          }
        }

        if (allLeads.length === 0) {
          toast.error("Nenhum lead encontrado. Verifique se a planilha tem abas com 'Camada A', 'Camada B' ou 'Camada C'.");
          setUploading(false);
          return;
        }

        uploadLeads.mutate({ leads: allLeads, replaceAll: true });
      } catch (err) {
        toast.error("Erro ao ler a planilha. Verifique o formato.");
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, [uploadLeads]);

  const handleSend = (lead: Lead) => {
    if (!lead.waLink) return;
    window.open(lead.waLink, "_blank");
    registerSend.mutate({ leadId: lead.id });
  };

  const handleResponded = (lead: Lead) => {
    updateStatus.mutate({ leadId: lead.id, status: "respondeu" });
    aiSuggestion.mutate({ leadId: lead.id });
    toast.info("Gerando sugestão de resposta com IA...");
  };

  const todaySends = metrics?.todaySends ?? 0;
  const sendProgress = Math.min((todaySends / DAILY_LIMIT) * 100, 100);
  const progressColor = todaySends >= 28 ? "text-red-400" : todaySends >= 22 ? "text-amber-400" : "text-emerald-400";

  const activeLeads = leads.filter((l) => !["respondeu", "fechado", "descartado"].includes(l.status));
  const respondedLeads = leads.filter((l) => l.status === "respondeu");
  const discardedLeads = leads.filter((l) => l.status === "descartado");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Cockpit de Prospecção</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus ciclos de abordagem via WhatsApp</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Limite diário */}
            <div className="hidden sm:flex flex-col items-end gap-1 min-w-[140px]">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm font-semibold ${progressColor}`}>{todaySends}</span>
                <span className="text-xs text-muted-foreground">/ {DAILY_LIMIT} hoje</span>
                {todaySends >= 28 && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
              </div>
              <Progress value={sendProgress} className="h-1.5 w-36" />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 hidden sm:flex">
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Importando..." : "Importar Planilha"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
          {(["", "A", "B", "C"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayerFilter(l)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                layerFilter === l
                  ? l === "A" ? "bg-emerald-400/20 border-emerald-400/60 text-emerald-300"
                    : l === "B" ? "bg-blue-400/20 border-blue-400/60 text-blue-300"
                    : l === "C" ? "bg-amber-400/20 border-amber-400/60 text-amber-300"
                    : "bg-primary/20 border-primary/60 text-primary"
                  : "bg-muted/40 border-border text-muted-foreground hover:border-border/80"
              }`}
            >
              {l === "" ? `Todos (${leads.length})` : `Camada ${l} (${leads.filter((x) => x.layer === l).length})`}
            </button>
          ))}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome ou empresa..."
              className="pl-9 h-8 text-sm bg-muted/30"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-6 py-6 space-y-8">
        {/* Leads ativos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Fila Ativa</h2>
            <Badge variant="secondary" className="font-mono text-xs">{activeLeads.length}</Badge>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : activeLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum lead na fila ativa</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Importe uma planilha para começar</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {activeLeads.map((lead, i) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={i}
                  todaySends={todaySends}
                  onSend={handleSend}
                  onResponded={handleResponded}
                  onNotResponded={() => updateStatus.mutate({ leadId: lead.id, status: "nao_respondeu" })}
                  onDiscard={() => setDiscardConfirm(lead)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Responderam */}
        {respondedLeads.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-emerald-400">Responderam</h2>
              <Badge className="font-mono text-xs bg-emerald-400/10 text-emerald-400 border-emerald-400/30">{respondedLeads.length}</Badge>
            </div>
            <div className="grid gap-3">
              {respondedLeads.map((lead, i) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={i}
                  todaySends={todaySends}
                  onSend={handleSend}
                  onResponded={handleResponded}
                  onNotResponded={() => {}}
                  onDiscard={() => setDiscardConfirm(lead)}
                  readonly
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal IA */}
      <Dialog open={aiModal.open} onOpenChange={(o) => setAiModal((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestão de Follow-up com IA
            </DialogTitle>
            <DialogDescription>
              Mensagem personalizada para {aiModal.lead?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 p-4 rounded-lg bg-muted/40 border border-border/60 text-sm leading-relaxed whitespace-pre-wrap">
            {aiSuggestion.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Gerando sugestão...
              </div>
            ) : (
              aiModal.suggestion
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                navigator.clipboard.writeText(aiModal.suggestion);
                toast.success("Mensagem copiada!");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
            {aiModal.lead && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  const phone = aiModal.lead!.whatsapp.replace(/\D/g, "");
                  const msg = encodeURIComponent(aiModal.suggestion);
                  window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Discard */}
      <AlertDialog open={!!discardConfirm} onOpenChange={(o) => !o && setDiscardConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {discardConfirm?.name} será removido da fila ativa e marcado como Descartado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (discardConfirm) {
                  updateStatus.mutate({ leadId: discardConfirm.id, status: "descartado" });
                  setDiscardConfirm(null);
                }
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────
function LeadCard({
  lead,
  index,
  todaySends,
  onSend,
  onResponded,
  onNotResponded,
  onDiscard,
  readonly = false,
}: {
  lead: Lead;
  index: number;
  todaySends: number;
  onSend: (l: Lead) => void;
  onResponded: (l: Lead) => void;
  onNotResponded: (l: Lead) => void;
  onDiscard: (l: Lead) => void;
  readonly?: boolean;
}) {
  const layerBorder = lead.layer === "A" ? "border-l-emerald-400" : lead.layer === "B" ? "border-l-blue-400" : "border-l-amber-400";
  const toqueDays = lead.status === "toque1_enviado" ? daysAgo(lead.toque1SentAt) : lead.status === "toque2_enviado" ? daysAgo(lead.toque2SentAt) : null;
  const limitReached = todaySends >= DAILY_LIMIT;

  return (
    <div
      className={`rounded-xl border border-border/60 border-l-4 ${layerBorder} bg-card p-5 animate-in-up`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">{lead.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${layerColors[lead.layer]}`}>
              Camada {lead.layer}
            </span>
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/40 border border-border/40">
              {statusLabels[lead.status] ?? lead.status}
            </span>
          </div>
          {lead.company && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{lead.company}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Star className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-sm font-semibold">{lead.score ?? 0}</span>
        </div>
      </div>

      {/* Toques */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {[1, 2, 3].map((t) => {
          const sent = t === 1 ? !!lead.toque1SentAt : t === 2 ? !!lead.toque2SentAt : !!lead.toque3SentAt;
          const isCurrent = lead.nextToque === t && lead.canSendNow;
          const isPending = lead.nextToque === t && !lead.canSendNow;
          return (
            <div
              key={t}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                sent
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : isCurrent
                  ? "bg-emerald-400/15 border-emerald-400/50 text-emerald-300 ring-1 ring-emerald-400/30"
                  : isPending
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                  : "bg-muted/30 border-border/40 text-muted-foreground/50"
              }`}
            >
              Toque {t}
              {sent && <span className="ml-1 opacity-60">✓</span>}
              {isCurrent && <span className="ml-1">→</span>}
            </div>
          );
        })}
        {toqueDays !== null && !lead.canSendNow && lead.nextToque > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {toqueDays}d — libera em{" "}
              {lead.nextToque === 2 ? Math.max(0, 3 - toqueDays) : Math.max(0, 4 - toqueDays)}d
            </span>
          </div>
        )}
      </div>

      {/* Ações */}
      {!readonly && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {lead.canSendNow && (
            <Button
              size="sm"
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => onSend(lead)}
              disabled={limitReached}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Enviar Toque {lead.nextToque}
              {limitReached && <AlertTriangle className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10"
            onClick={() => onResponded(lead)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Respondeu
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-muted-foreground"
            onClick={() => onNotResponded(lead)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Não respondeu
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={() => onDiscard(lead)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
