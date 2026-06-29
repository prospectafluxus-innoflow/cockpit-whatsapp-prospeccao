import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Sun,
  Coffee,
  Sunset,
  Cloud,
  Bell,
  BellOff,
  Clock,
  Users,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Building2,
  Star,
  Info,
} from "lucide-react";

type Lead = {
  id: number;
  name: string;
  firstName: string | null;
  company: string | null;
  whatsapp: string;
  score: number | null;
  layer: "A" | "B" | "C";
  status: string;
};

const layerColors: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  toque1_enviado: "Toque 1",
  toque2_enviado: "Toque 2",
  toque3_enviado: "Toque 3",
};

const windowMeta = {
  morning: {
    label: "Manhã",
    icon: Sun,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    activeBg: "bg-amber-400/20 border-amber-400/40",
    description: "Leads abordados logo no início do expediente",
    hourMin: 6,
    hourMax: 11,
  },
  lunch: {
    label: "Almoço",
    icon: Coffee,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
    activeBg: "bg-orange-400/20 border-orange-400/40",
    description: "Contatos no horário de pausa do cliente",
    hourMin: 11,
    hourMax: 14,
  },
  afternoon: {
    label: "Meio da tarde",
    icon: Cloud,
    color: "text-sky-400",
    bg: "bg-sky-400/10 border-sky-400/20",
    activeBg: "bg-sky-400/20 border-sky-400/40",
    description: "Abordagem no meio da tarde, pós-almoço",
    hourMin: 13,
    hourMax: 17,
  },
  evening: {
    label: "Fim do dia",
    icon: Sunset,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
    activeBg: "bg-purple-400/20 border-purple-400/40",
    description: "Abordagem no encerramento do expediente",
    hourMin: 15,
    hourMax: 20,
  },
} as const;

type WindowKey = keyof typeof windowMeta;

function LeadMiniCard({ lead }: { lead: Lead }) {
  const nextToque =
    lead.status === "novo" ? 1
    : lead.status === "toque1_enviado" ? 2
    : lead.status === "toque2_enviado" ? 3
    : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 hover:border-border/70 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">{lead.name}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border ${layerColors[lead.layer]}`}>
            {lead.layer}
          </Badge>
        </div>
        {lead.company && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{lead.company}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lead.score != null && lead.score > 0 && (
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 text-amber-400" />
            {lead.score}
          </div>
        )}
        {nextToque > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
            T{nextToque}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const utils = trpc.useUtils();

  const { data: schedule, isLoading: loadingSchedule } = trpc.schedule.get.useQuery();
  const { data: queueData, isLoading: loadingQueue } = trpc.schedule.getQueue.useQuery();

  const [form, setForm] = useState<{
    morningEnabled: boolean;
    morningHour: number;
    morningCount: number;
    lunchEnabled: boolean;
    lunchHour: number;
    lunchCount: number;
    afternoonEnabled: boolean;
    afternoonHour: number;
    afternoonCount: number;
    eveningEnabled: boolean;
    eveningHour: number;
    eveningCount: number;
  } | null>(null);

  // Inicializa o form quando os dados chegam
  const currentForm = form ?? (schedule ? {
    morningEnabled: !!schedule.morningEnabled,
    morningHour: schedule.morningHour,
    morningCount: schedule.morningCount,
    lunchEnabled: !!schedule.lunchEnabled,
    lunchHour: schedule.lunchHour,
    lunchCount: schedule.lunchCount,
    afternoonEnabled: !!((schedule as any).afternoonEnabled ?? 1),
    afternoonHour: (schedule as any).afternoonHour ?? 15,
    afternoonCount: (schedule as any).afternoonCount ?? 2,
    eveningEnabled: !!schedule.eveningEnabled,
    eveningHour: schedule.eveningHour,
    eveningCount: schedule.eveningCount,
  } : {
    morningEnabled: true, morningHour: 8, morningCount: 2,
    lunchEnabled: true, lunchHour: 12, lunchCount: 2,
    afternoonEnabled: true, afternoonHour: 15, afternoonCount: 2,
    eveningEnabled: true, eveningHour: 17, eveningCount: 2,
  });

  const saveMutation = trpc.schedule.save.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva!");
      utils.schedule.get.invalidate();
      utils.schedule.getQueue.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const activateMutation = trpc.schedule.activate.useMutation({
    onSuccess: () => {
      toast.success("Lembretes ativados! Você receberá notificações nos horários configurados.", { duration: 5000 });
      utils.schedule.get.invalidate();
    },
    onError: (e) => toast.error(`Erro ao ativar: ${e.message}. O site precisa estar publicado para ativar os lembretes.`),
  });

  const handleSave = () => {
    saveMutation.mutate({
      morningEnabled: currentForm.morningEnabled ? 1 : 0,
      morningHour: currentForm.morningHour,
      morningCount: currentForm.morningCount,
      lunchEnabled: currentForm.lunchEnabled ? 1 : 0,
      lunchHour: currentForm.lunchHour,
      lunchCount: currentForm.lunchCount,
      afternoonEnabled: currentForm.afternoonEnabled ? 1 : 0,
      afternoonHour: currentForm.afternoonHour,
      afternoonCount: currentForm.afternoonCount,
      eveningEnabled: currentForm.eveningEnabled ? 1 : 0,
      eveningHour: currentForm.eveningHour,
      eveningCount: currentForm.eveningCount,
    });
  };

  const handleActivate = () => {
    activateMutation.mutate();
  };

  const totalDailyLeads = (currentForm.morningEnabled ? currentForm.morningCount : 0)
    + (currentForm.lunchEnabled ? currentForm.lunchCount : 0)
    + (currentForm.afternoonEnabled ? currentForm.afternoonCount : 0)
    + (currentForm.eveningEnabled ? currentForm.eveningCount : 0);

  const hasActiveCrons = !!(schedule?.morningTaskUid || schedule?.lunchTaskUid || (schedule as any)?.afternoonTaskUid || schedule?.eveningTaskUid);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Agendamento Inteligente</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure janelas de envio e receba lembretes automáticos</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? "Salvando..." : "Salvar configuração"}
            </Button>
            <Button size="sm" onClick={handleActivate} disabled={activateMutation.isPending} className="gap-2">
              <Bell className="h-3.5 w-3.5" />
              {activateMutation.isPending ? "Ativando..." : hasActiveCrons ? "Reativar lembretes" : "Ativar lembretes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8 max-w-5xl">

        {/* Aviso informativo */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300/90 leading-relaxed">
            <strong className="text-blue-300">Como funciona:</strong> Configure os horários e quantidades abaixo. Clique em{" "}
            <strong>"Ativar lembretes"</strong> para receber notificações automáticas nos horários definidos. Ao receber a
            notificação, abra o cockpit — os leads sugeridos já estarão separados para você enviar em menos de 2 minutos.
            {!hasActiveCrons && (
              <span className="block mt-1 text-amber-300/80">
                ⚠️ Os lembretes só funcionam quando o site está <strong>publicado</strong>. Salve a configuração, publique o site e então clique em "Ativar lembretes".
              </span>
            )}
          </div>
        </div>

        {/* Resumo diário */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center">
            <div className="text-2xl font-bold font-mono text-foreground">{totalDailyLeads}</div>
            <div className="text-xs text-muted-foreground mt-1">leads/dia planejados</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center">
            <div className="text-2xl font-bold font-mono text-foreground">
              {[currentForm.morningEnabled, currentForm.lunchEnabled, currentForm.afternoonEnabled, currentForm.eveningEnabled].filter(Boolean).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">janelas ativas</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${hasActiveCrons ? "text-emerald-400" : "text-muted-foreground"}`}>
              {hasActiveCrons ? "ON" : "OFF"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">lembretes automáticos</div>
          </div>
        </div>

        {/* Configuração das janelas */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">Configuração das Janelas</h2>
          <div className="grid gap-4">
            {(["morning", "lunch", "afternoon", "evening"] as WindowKey[]).map((key) => {
              const meta = windowMeta[key];
              const Icon = meta.icon;
              const enabled = currentForm[`${key}Enabled` as keyof typeof currentForm] as boolean;
              const hour = currentForm[`${key}Hour` as keyof typeof currentForm] as number;
              const count = currentForm[`${key}Count` as keyof typeof currentForm] as number;
              const isActive = queueData?.activeWindow === key;

              return (
                <div
                  key={key}
                  className={`rounded-xl border p-5 transition-all ${
                    isActive ? meta.activeBg : enabled ? meta.bg : "bg-muted/20 border-border/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${enabled ? meta.bg : "bg-muted/40"}`}>
                        <Icon className={`h-5 w-5 ${enabled ? meta.color : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{meta.label}</span>
                          {isActive && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Ativa agora
                            </Badge>
                          )}
                          {hasActiveCrons && enabled && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                              <Bell className="h-2.5 w-2.5 mr-1" />
                              Agendado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => setForm({ ...currentForm, [`${key}Enabled`]: v })}
                    />
                  </div>

                  {enabled && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      {/* Horário */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Horário (BRT)
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={meta.hourMin}
                            max={meta.hourMax}
                            value={hour}
                            onChange={(e) => setForm({ ...currentForm, [`${key}Hour`]: Number(e.target.value) })}
                            className="flex-1 accent-current"
                          />
                          <span className="font-mono text-sm font-semibold w-12 text-right">
                            {String(hour).padStart(2, "0")}:00
                          </span>
                        </div>
                      </div>

                      {/* Quantidade */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">
                          <Users className="h-3 w-3 inline mr-1" />
                          Leads por janela
                        </Label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setForm({ ...currentForm, [`${key}Count`]: Math.max(1, count - 1) })}
                            className="w-7 h-7 rounded-lg border border-border/60 text-sm font-bold hover:bg-muted/40 transition-colors"
                          >−</button>
                          <span className="font-mono text-lg font-bold w-8 text-center">{count}</span>
                          <button
                            onClick={() => setForm({ ...currentForm, [`${key}Count`]: Math.min(5, count + 1) })}
                            className="w-7 h-7 rounded-lg border border-border/60 text-sm font-bold hover:bg-muted/40 transition-colors"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Fila do dia */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Fila Sugerida de Hoje</h2>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Seleção automática por prioridade
            </Badge>
          </div>

          {loadingQueue ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : !queueData ? (
            <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Importe uma planilha de leads para ver a fila sugerida</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(["morning", "lunch", "afternoon", "evening"] as WindowKey[]).map((key) => {
                const meta = windowMeta[key];
                const Icon = meta.icon;
                const windowData = queueData.windows[key];
                const isActive = queueData.activeWindow === key;

                if (!windowData.enabled) return null;

                return (
                  <div key={key} className={`rounded-xl border p-5 ${isActive ? meta.activeBg : meta.bg}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="font-semibold text-sm">{meta.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {String(windowData.hour).padStart(2, "0")}:00
                        </span>
                        {isActive && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            Janela ativa
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {windowData.leads.length} lead{windowData.leads.length !== 1 ? "s" : ""} sugerido{windowData.leads.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {windowData.leads.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground/60">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-400/40" />
                        Nenhum lead disponível para esta janela
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {windowData.leads.map((lead) => (
                          <LeadMiniCard key={lead.id} lead={lead as Lead} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Como funciona */}
        <section className="rounded-xl border border-border/40 bg-card/30 p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Como a seleção de leads funciona
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>O sistema seleciona automaticamente os leads mais prioritários para cada janela, priorizando <strong className="text-foreground">Camada A &gt; B &gt; C</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Dentro da mesma camada, leads com <strong className="text-foreground">toques mais urgentes</strong> aparecem primeiro (Toque 2 antes de Toque 1, Toque 1 antes de Novo)</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Apenas leads com toques <strong className="text-foreground">prontos para envio</strong> entram na fila (respeitando os prazos de 3 e 4 dias)</span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>A fila é <strong className="text-foreground">recalculada em tempo real</strong> — sempre reflete o estado atual dos seus leads</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
