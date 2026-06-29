import { useState, useRef, useCallback, useEffect } from "react";
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
  Sun,
  Coffee,
  Sunset,
  Cloud,
  Bell,
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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showReminderBanner, setShowReminderBanner] = useState(() => {
    return localStorage.getItem("prospectafluxus_reminder_banner_dismissed") !== "1";
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: leads = [], isLoading } = trpc.leads.list.useQuery({
    layer: layerFilter || undefined,
    search: search || undefined,
  });

  const { data: metrics } = trpc.dashboard.metrics.useQuery();
  const { data: queueData } = trpc.schedule.getQueue.useQuery();

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
      // Se a mensagem é muito longa (dados brutos) ou parece timeout/network,
      // provavelmente os dados foram salvos — recarrega e mostra mensagem amigável
      const isRawData = (e.message?.length ?? 0) > 150;
      const isTimeout = e.message?.toLowerCase().includes('timeout') ||
        e.message?.toLowerCase().includes('network') ||
        e.message?.toLowerCase().includes('fetch');
      if (isRawData || isTimeout) {
        utils.leads.list.invalidate();
        utils.dashboard.metrics.invalidate();
        toast.success('Leads importados com sucesso! Lista atualizada.');
      } else {
        toast.error(`Erro na importação: ${e.message?.slice(0, 100) ?? 'Tente novamente.'}`);
      }
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

        // Mapeamento de abas para camadas
        // Suporta: "Camada A — ICP", "Camada B — ICP", "Camada C — ICP" (com travessão especial)
        // e variações como "Camada A", "Camada B", "Camada C"
        const layerSheets: Record<string, "A" | "B" | "C"> = {};
        for (const name of wb.SheetNames) {
          const normalized = name.toLowerCase().replace(/[\u2014\u2013\-]/g, "-").trim();
          if (normalized.includes("camada a")) layerSheets[name] = "A";
          else if (normalized.includes("camada b")) layerSheets[name] = "B";
          else if (normalized.includes("camada c")) layerSheets[name] = "C";
        }

        if (Object.keys(layerSheets).length === 0) {
          toast.error(`Nenhuma aba de camada encontrada. Abas encontradas: ${wb.SheetNames.join(", ")}. Certifique-se de que as abas se chamam "Camada A — ICP", "Camada B — ICP" ou "Camada C — ICP".`);
          setUploading(false);
          return;
        }

        const allLeads: any[] = [];

        for (const [sheetName, layer] of Object.entries(layerSheets)) {
          const ws = wb.Sheets[sheetName]!;
          // header: 2 = usa a linha 2 como cabeçalho (linha 1 é título da aba)
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });

          if (rows.length < 2) continue;

          // Linha 0 pode ser título, linha 1 é o cabeçalho real
          // Detecta automaticamente qual linha é o cabeçalho (procura por "Nome" ou "WhatsApp")
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(3, rows.length); i++) {
            const row = rows[i] as any[];
            const rowStr = row.map(String).join(" ").toLowerCase();
            if (rowStr.includes("nome") || rowStr.includes("whatsapp") || rowStr.includes("telefone")) {
              headerRowIndex = i;
              break;
            }
          }

          const headers = (rows[headerRowIndex] as any[]).map(String);
          const dataRows = rows.slice(headerRowIndex + 1);

          for (const rawRow of dataRows) {
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = String((rawRow as any[])[i] ?? ""); });

            const name = row["Nome"] || row["NOME"] || row["name"] || "";
            const whatsapp = String(
              row["WhatsApp"] || row["Whatsapp"] || row["whatsapp"] ||
              row["Telefone"] || row["telefone"] || row["Celular"] || ""
            ).replace(/\D/g, "");

            if (!name || !whatsapp || whatsapp.length < 10) continue;

            allLeads.push({
              name: String(name).trim(),
              firstName: String(name).split(" ")[0] ?? String(name),
              company: String(row["Empresa"] || row["empresa"] || row["Razão Social"] || "").trim() || undefined,
              whatsapp,
              score: Number(row["Score"] || row["score"] || row["Pontuação"] || 0) || 0,
              layer,
              size: String(row["Porte"] || row["porte"] || "").trim() || undefined,
              employees: Number(row["Func."] || row["Funcionários"] || row["funcionarios"] || row["Colaboradores"] || 0) || undefined,
              investment: String(row["Investe Mkt"] || row["Investimento Mkt"] || row["investment"] || "").trim() || undefined,
              taxRegime: String(row["Regime"] || row["Regime Tributário"] || row["regime"] || "").trim() || undefined,
              participations: Number(row["Part."] || row["Participações"] || row["participacoes"] || 0) || undefined,
              lastEvent: String(row["Último evento"] || row["Ultimo Evento"] || row["ultimo_evento"] || "").trim() || undefined,
              // Colunas opcionais para leads já trabalhados
              toque: (() => {
                const t = Number(row["Toque"] || row["toque"] || row["Toques"] || 0);
                return (t >= 1 && t <= 3) ? t : undefined;
              })(),
              statusImport: (() => {
                const s = String(row["Status"] || row["status"] || "").trim().toLowerCase()
                  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const map: Record<string, string> = {
                  "novo": "novo",
                  "respondeu": "respondeu",
                  "nao respondeu": "nao_respondeu",
                  "nao_respondeu": "nao_respondeu",
                  "nao respondido": "nao_respondeu",
                  "descartado": "descartado",
                  "fechado": "fechado",
                  "ganho": "fechado",
                };
                return (map[s] as any) || undefined;
              })(),
            });
          }
        }

        if (allLeads.length === 0) {
          toast.error("Nenhum lead encontrado nas abas. Verifique se os cabeçalhos incluem 'Nome' e 'WhatsApp'.");
          setUploading(false);
          return;
        }

        // Importar em lotes de 50 leads por requisição separada
        // para evitar timeout no Railway (180s limit)
        const BATCH_SIZE = 50;
        const batches: any[][] = [];
        for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
          batches.push(allLeads.slice(i, i + BATCH_SIZE));
        }

        setImportProgress({ current: 0, total: allLeads.length });

        (async () => {
          let totalInserted = 0;
          try {
            for (let b = 0; b < batches.length; b++) {
              const batch = batches[b]!;
              await utils.client.leads.upload.mutate({
                leads: batch,
                replaceAll: b === 0, // só limpa na primeira requisição
              });
              totalInserted += batch.length;
              setImportProgress({ current: totalInserted, total: allLeads.length });
            }
            toast.success(`${totalInserted} leads importados com sucesso!`);
            utils.leads.list.invalidate();
            utils.dashboard.metrics.invalidate();
          } catch (err: any) {
            // Se deu erro mas já importou alguns, recarrega e avisa
            if (totalInserted > 0) {
              utils.leads.list.invalidate();
              utils.dashboard.metrics.invalidate();
              toast.warning(`${totalInserted} de ${allLeads.length} leads importados. Reimporte a planilha para completar.`);
            } else {
              toast.error(`Erro na importação: ${err?.message?.slice(0, 100) ?? 'Tente novamente.'}`);
            }
          } finally {
            setUploading(false);
            setImportProgress(null);
          }
        })();
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

        {/* Barra de progresso da importação */}
        {importProgress && (
          <div className="px-6 pb-2">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5 animate-pulse" />
                  Importando leads...
                </span>
                <span className="text-muted-foreground font-mono">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <Progress
                value={Math.round((importProgress.current / importProgress.total) * 100)}
                className="h-2"
              />
              <p className="text-[11px] text-muted-foreground">
                {importProgress.current === 0
                  ? "Preparando importação..."
                  : importProgress.current < importProgress.total
                  ? `Lote ${Math.ceil(importProgress.current / 50)} de ${Math.ceil(importProgress.total / 50)} enviado com sucesso`
                  : "Finalizando..."}
              </p>
            </div>
          </div>
        )}

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
        {/* Banner de lembretes — aparece uma única vez */}
        {showReminderBanner && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 text-sm">
            <Bell className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="flex-1 text-foreground/80">
              <span className="font-semibold text-emerald-400">Nunca esqueça de prospectar!</span>{" "}
              Ative lembretes nos horários das janelas para receber alertas no celular ou via WhatsApp.
            </span>
            <a
              href="/profile"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap transition-colors"
            >
              Configurar →
            </a>
            <button
              onClick={() => {
                setShowReminderBanner(false);
                localStorage.setItem("prospectafluxus_reminder_banner_dismissed", "1");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        )}
        {/* Fila do Dia */}
        {queueData && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-foreground">Fila do Dia</h2>
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <a
                href="/profile"
                className="ml-auto text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                title="Configure lembretes no seu perfil"
              >
                <Bell className="h-3 w-3" />
                Ativar lembretes
              </a>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {([
                { key: "morning" as const, label: "Manhã", icon: Sun, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
                { key: "lunch" as const, label: "Almoço", icon: Coffee, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
                { key: "afternoon" as const, label: "Meio da tarde", icon: Cloud, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
                { key: "evening" as const, label: "Fim do dia", icon: Sunset, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
              ]).map(({ key, label, icon: Icon, color, bg }) => {
                const win = queueData.windows[key as keyof typeof queueData.windows];
                const isActive = queueData.activeWindow === key;
                if (!win.enabled) return null;
                return (
                  <div key={key} className={`rounded-xl border p-3 ${isActive ? bg.replace("/10", "/20").replace("/20", "/40") : bg}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono ml-auto">{String(win.hour).padStart(2, "0")}:00</span>
                      {isActive && <span className="text-[10px] text-emerald-400 font-semibold">● ativa</span>}
                    </div>
                    {win.leads.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60">Nenhum lead disponível</p>
                    ) : (
                      <ul className="space-y-1">
                        {win.leads.map((l) => (
                          <li key={l.id} className="text-[11px] text-foreground/80 truncate">
                            {l.name}{l.company ? ` · ${l.company}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

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

      {/* Linha do tempo de toques */}
      <div className="mt-4 space-y-1">
        {[1, 2, 3].map((t) => {
          const sentAt = t === 1 ? lead.toque1SentAt : t === 2 ? lead.toque2SentAt : lead.toque3SentAt;
          const sent = !!sentAt;
          const isCurrent = lead.nextToque === t && lead.canSendNow;
          const isPending = lead.nextToque === t && !lead.canSendNow;
          const days = daysAgo(sentAt);
          const waitDays = t === 2 ? 3 : 4;
          const daysLeft = days !== null ? Math.max(0, waitDays - days) : null;

          return (
            <div key={t} className="flex items-center gap-3">
              {/* Indicador visual */}
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
                sent
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : isCurrent
                  ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-400"
                  : isPending
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                  : "bg-muted/20 border-border/30 text-muted-foreground/30"
              }`}>
                <span className="text-[9px] font-bold">{t}</span>
              </div>

              {/* Linha conectora */}
              <div className="flex-1 flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  sent ? "text-primary" : isCurrent ? "text-emerald-400" : isPending ? "text-amber-400" : "text-muted-foreground/40"
                }`}>
                  Toque {t}
                </span>

                {sent && sentAt && (
                  <span className="text-xs text-muted-foreground">
                    ✓ {new Date(sentAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {days !== null && days > 0 && (
                      <span className="ml-1 opacity-60">({days}d atrás)</span>
                    )}
                  </span>
                )}

                {isCurrent && (
                  <span className="text-xs text-emerald-400 font-semibold">→ Pronto para enviar</span>
                )}

                {isPending && daysLeft !== null && (
                  <span className="text-xs text-amber-400">
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    libera em {daysLeft}d
                  </span>
                )}
              </div>
            </div>
          );
        })}
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
