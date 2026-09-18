import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MessageCircleMore,
  Music2,
  PauseCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Discovery = {
  accounts: Array<{
    id: string;
    name: string | null;
    phone_number: string | null;
    is_default: boolean;
    waba_id: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: unknown;
    whatsAppAccountId: string;
  }>;
  approvedTemplates: Array<{
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: unknown;
    whatsAppAccountId: string;
  }>;
};

type LeadRow = {
  id: number;
  name: string;
  firstName: string | null;
  company: string | null;
  whatsapp: string;
  layer: "A" | "B" | "C";
  status: string;
  whatsappOptInStatus: "unknown" | "opted_in" | "opted_out";
  whatsappOptInAt: Date | null;
  whatsappOptInSource: string | null;
  whatsappLastInboundAt: Date | null;
  hasOpenWindow: boolean;
};

type ConfigurationForm = {
  accountId: string;
  templateName: string;
  templateLanguage: string;
  dailyLimit: number;
  minIntervalSeconds: number;
  enabled: boolean;
  queuePaused: boolean;
};

const DEFAULT_FORM: ConfigurationForm = {
  accountId: "",
  templateName: "",
  templateLanguage: "pt_BR",
  dailyLimit: 20,
  minIntervalSeconds: 90,
  enabled: false,
  queuePaused: true,
};

function templateBodyText(components: unknown): string {
  const list = Array.isArray(components)
    ? components
    : components && typeof components === "object"
      ? Object.values(components as Record<string, unknown>)
      : [];
  for (const component of list) {
    if (!component || typeof component !== "object") continue;
    const item = component as Record<string, unknown>;
    if (String(item.type ?? "").toUpperCase() === "BODY" && typeof item.text === "string") {
      return item.text;
    }
  }
  return "";
}

function parameterCount(components: unknown): number {
  const indexes = (templateBodyText(components).match(/\{\{\d+\}\}/g) ?? [])
    .map(value => Number(value.replace(/\D/g, "")))
    .filter(Number.isFinite);
  return indexes.length ? Math.max(...indexes) : 0;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    sending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    sent: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    delivered: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    read: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    failed: "border-red-500/30 bg-red-500/10 text-red-300",
    received: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  };
  const labels: Record<string, string> = {
    sending: "Processando",
    sent: "Enviada",
    delivered: "Entregue",
    read: "Lida",
    failed: "Falhou",
    received: "Recebida",
  };
  return <Badge variant="outline" className={styles[status]}>{labels[status] ?? status}</Badge>;
}

export default function InnoFlowPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: overview, isLoading: loadingOverview } = trpc.wablast.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const { data: leads = [], isLoading: loadingLeads } = trpc.wablast.leads.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [form, setForm] = useState<ConfigurationForm>(DEFAULT_FORM);
  const [consentLead, setConsentLead] = useState<LeadRow | null>(null);
  const [consentSourceType, setConsentSourceType] = useState("form");
  const [consentSource, setConsentSource] = useState("");
  const [sendLead, setSendLead] = useState<LeadRow | null>(null);
  const [parameters, setParameters] = useState<string[]>([]);
  const [audioLead, setAudioLead] = useState<LeadRow | null>(null);
  const [audioTouch, setAudioTouch] = useState("1");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const settings = overview?.settings;
    if (!settings) return;
    setForm({
      accountId: settings.accountId ?? "",
      templateName: settings.templateName ?? "",
      templateLanguage: settings.templateLanguage ?? "pt_BR",
      dailyLimit: settings.dailyLimit,
      minIntervalSeconds: settings.minIntervalSeconds,
      enabled: settings.enabled === 1,
      queuePaused: settings.queuePaused === 1,
    });
  }, [overview?.settings]);

  const selectedTemplate = useMemo(() => discovery?.approvedTemplates.find(template =>
    template.name === form.templateName
    && template.language === form.templateLanguage
    && (!form.accountId || template.whatsAppAccountId === form.accountId)
  ) ?? null, [discovery, form.accountId, form.templateLanguage, form.templateName]);

  const visibleLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return leads as LeadRow[];
    return (leads as LeadRow[]).filter(lead =>
      lead.name.toLowerCase().includes(needle)
      || (lead.company ?? "").toLowerCase().includes(needle)
      || lead.whatsapp.includes(needle)
    );
  }, [leads, search]);

  const discover = trpc.wablast.discover.useMutation({
    onSuccess: data => {
      setDiscovery(data as Discovery);
      const account = data.accounts.find(item => item.id === form.accountId)
        ?? data.accounts.find(item => item.is_default)
        ?? data.accounts[0];
      const templates = data.approvedTemplates.filter(item => !account || item.whatsAppAccountId === account.id);
      const template = templates.find(item => item.name === form.templateName && item.language === form.templateLanguage)
        ?? templates[0];
      setForm(current => ({
        ...current,
        accountId: account?.id ?? current.accountId,
        templateName: template?.name ?? current.templateName,
        templateLanguage: template?.language ?? current.templateLanguage,
      }));
      toast.success("Conexão WaBlast consultada com segurança.");
    },
    onError: error => toast.error(error.message),
  });

  const saveConfiguration = trpc.wablast.saveConfiguration.useMutation({
    onSuccess: () => {
      toast.success("Configuração WaBlast salva.");
      utils.wablast.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setConsent = trpc.wablast.setConsent.useMutation({
    onSuccess: () => {
      toast.success("Consentimento atualizado.");
      setConsentLead(null);
      utils.wablast.leads.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const sendTemplate = trpc.wablast.sendTemplate.useMutation({
    onSuccess: data => {
      if (data.persistencePending) {
        toast.warning("A WaBlast aceitou a mensagem; o histórico será conciliado pelo webhook.");
      } else {
        toast.success("Mensagem entregue à API WaBlast para processamento.");
      }
      setSendLead(null);
      utils.wablast.overview.invalidate();
      utils.wablast.leads.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const sendAudio = trpc.wablast.sendAudio.useMutation({
    onSuccess: data => {
      if (data.persistencePending) {
        toast.warning("A WaBlast aceitou o áudio; o histórico será conciliado pelo webhook.");
      } else {
        toast.success("Áudio entregue à API WaBlast para processamento.");
      }
      setAudioLead(null);
      utils.wablast.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const accountTemplates = discovery?.approvedTemplates.filter(template =>
    !form.accountId || template.whatsAppAccountId === form.accountId
  ) ?? [];

  const openSendDialog = (lead: LeadRow) => {
    if (!selectedTemplate) {
      toast.error("Clique em Atualizar conexão para carregar o template aprovado.");
      return;
    }
    const count = parameterCount(selectedTemplate.components);
    const suggestions = [lead.firstName ?? lead.name.split(" ")[0] ?? lead.name, lead.company ?? ""];
    setParameters(Array.from({ length: count }, (_, index) => suggestions[index] ?? ""));
    setSendLead(lead);
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-8">
        <Card className="max-w-xl border-red-500/20">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Esta área é exclusiva da operação interna da InnoFlow.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircleMore className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-semibold tracking-tight">Área InnoFlow · WhatsApp API</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Operação oficial WaBlast, isolada do cockpit manual dos clientes</p>
          </div>
          <Button onClick={() => discover.mutate()} disabled={discover.isPending || !overview?.configured} className="gap-2">
            {discover.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar conexão
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Chave da API</CardDescription>
              <CardTitle className="flex items-center gap-2 text-base">
                {overview?.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Unplug className="h-4 w-4 text-red-400" />}
                {overview?.configured ? "Configurada" : "Não configurada"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Webhook assinado</CardDescription>
              <CardTitle className="flex items-center gap-2 text-base">
                {overview?.webhookConfigured ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                {overview?.webhookConfigured ? "Configurado" : "Pendente"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Envios pela API</CardDescription>
              <CardTitle className="flex items-center gap-2 text-base">
                {form.enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <PauseCircle className="h-4 w-4 text-amber-400" />}
                {form.enabled ? "Ativos" : "Bloqueados"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {!overview?.webhookConfigured && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <strong>Não faça piloto ainda.</strong> O envio pode ser testado somente depois de cadastrar o webhook
              <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5">{overview?.webhookUrl}</code>
              e guardar o segredo em <code className="rounded bg-black/20 px-1.5 py-0.5">WABLAST_WEBHOOK_SECRET</code>.
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configuração controlada</CardTitle>
            <CardDescription>A ativação não altera o cockpit atual e não inicia disparos automáticos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <Label>Conexão WhatsApp</Label>
              <Select value={form.accountId} onValueChange={accountId => setForm(current => ({ ...current, accountId, templateName: "" }))}>
                <SelectTrigger><SelectValue placeholder="Atualize a conexão" /></SelectTrigger>
                <SelectContent>
                  {discovery?.accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name ?? "Sem nome"} · {account.phone_number ?? account.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label>Template aprovado pela Meta</Label>
              <Select
                value={form.templateName ? `${form.templateName}|${form.templateLanguage}` : ""}
                onValueChange={value => {
                  const [templateName, templateLanguage] = value.split("|");
                  setForm(current => ({ ...current, templateName: templateName ?? "", templateLanguage: templateLanguage ?? "pt_BR" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um template aprovado" /></SelectTrigger>
                <SelectContent>
                  {accountTemplates.map(template => (
                    <SelectItem key={`${template.id}-${template.language}`} value={`${template.name}|${template.language}`}>
                      {template.name} · {template.language} · {template.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leads por período</Label>
              <Input type="number" min={1} max={50} value={form.dailyLimit} onChange={event => setForm(current => ({ ...current, dailyLimit: Number(event.target.value) }))} />
              <p className="text-xs text-muted-foreground">
                4 períodos: 08h, 12h, 15h e 19h · máximo diário atual: {form.dailyLimit * 4}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Intervalo mínimo (segundos)</Label>
              <Input type="number" min={30} max={3600} value={form.minIntervalSeconds} onChange={event => setForm(current => ({ ...current, minIntervalSeconds: Number(event.target.value) }))} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
              <div>
                <Label>Permitir envio unitário</Label>
                <p className="text-xs text-muted-foreground">Somente após confirmação manual</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={enabled => setForm(current => ({ ...current, enabled }))} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3">
              <div>
                <Label>Fila automática pausada</Label>
                <p className="text-xs text-muted-foreground">Mantenha ligada durante o piloto</p>
              </div>
              <Switch checked={form.queuePaused} onCheckedChange={queuePaused => setForm(current => ({ ...current, queuePaused }))} />
            </div>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <Button
                onClick={() => saveConfiguration.mutate(form)}
                disabled={!discovery || !form.accountId || !form.templateName || saveConfiguration.isPending}
              >
                {saveConfiguration.isPending ? "Salvando..." : "Salvar configuração"}
              </Button>
            </div>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-4 xl:col-span-4">
              {["Manhã · 08h", "Almoço · 12h", "Meio da tarde · 15h", "Noite · 19h"].map(period => (
                <div key={period} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">{period}</div>
                  <div className="mt-1 font-semibold">{form.dailyLimit} leads</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads e consentimento</CardTitle>
            <CardDescription>
              A marcação de opt-in deve corresponder a um consentimento real e comprovável. A API bloqueia leads sem consentimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, empresa ou WhatsApp" className="max-w-lg" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Consentimento</TableHead>
                  <TableHead>Janela de 24h</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeads ? (
                  <TableRow><TableCell colSpan={5}>Carregando leads...</TableCell></TableRow>
                ) : visibleLeads.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>Nenhum lead encontrado.</TableCell></TableRow>
                ) : visibleLeads.slice(0, 100).map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.company ?? "Sem empresa"} · Camada {lead.layer}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{lead.whatsapp}</TableCell>
                    <TableCell>
                      {lead.whatsappOptInStatus === "opted_in" ? (
                        <div>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Opt-in ativo</Badge>
                          <div className="mt-1 max-w-56 truncate text-[11px] text-muted-foreground" title={lead.whatsappOptInSource ?? ""}>{lead.whatsappOptInSource}</div>
                        </div>
                      ) : lead.whatsappOptInStatus === "opted_out" ? (
                        <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-300">Não contatar</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Não comprovado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.hasOpenWindow ? (
                        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300">Aberta</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Fechada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {lead.whatsappOptInStatus !== "opted_in" ? (
                          <Button variant="outline" size="sm" onClick={() => {
                            setConsentSourceType("form");
                            setConsentSource("");
                            setConsentLead(lead);
                          }}>Registrar opt-in</Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConsent.mutate({
                              leadId: lead.id,
                              status: "opted_out",
                              sourceType: "admin_block",
                              evidenceReference: "Bloqueio manual registrado na Área InnoFlow",
                            })}
                          >Bloquear</Button>
                        )}
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={!form.enabled || lead.whatsappOptInStatus !== "opted_in" || !selectedTemplate}
                          onClick={() => openSendDialog(lead)}
                        >
                          <Send className="h-3.5 w-3.5" /> Enviar
                        </Button>
                        {lead.hasOpenWindow && lead.whatsappOptInStatus === "opted_in" && (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAudioLead(lead)}>
                            <Music2 className="h-3.5 w-3.5" /> Áudio
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico WaBlast</CardTitle>
            <CardDescription>Status atualizados pelo webhook; os erros permanecem visíveis para auditoria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingOverview ? (
                  <TableRow><TableCell colSpan={6}>Carregando histórico...</TableCell></TableRow>
                ) : !overview?.history.length ? (
                  <TableRow><TableCell colSpan={6}>Nenhuma mensagem enviada pela nova área.</TableCell></TableRow>
                ) : overview.history.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{item.leadName ?? item.phone}</TableCell>
                    <TableCell>{item.direction === "inbound" ? "Recebida" : "Enviada"}</TableCell>
                    <TableCell>{item.messageType}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={item.errorMessage ?? item.bodyPreview ?? ""}>
                      {item.errorMessage ?? item.bodyPreview ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(consentLead)} onOpenChange={open => !open && setConsentLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar consentimento</DialogTitle>
            <DialogDescription>
              Confirme somente se {consentLead?.name} autorizou mensagens da InnoFlow neste número.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo da origem</Label>
              <Select value={consentSourceType} onValueChange={setConsentSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form">Formulário com aceite explícito</SelectItem>
                  <SelectItem value="event_registration">Inscrição com aceite de mensagens</SelectItem>
                  <SelectItem value="existing_customer">Cliente com autorização registrada</SelectItem>
                  <SelectItem value="written_request">Pedido escrito do contato</SelectItem>
                  <SelectItem value="other">Outra evidência verificável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referência da evidência</Label>
              <Input value={consentSource} onChange={event => setConsentSource(event.target.value)} placeholder="Ex.: formulário X, resposta registrada em 16/09/2026" />
              <p className="text-xs text-muted-foreground">Participar de um evento, por si só, não comprova consentimento para marketing.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentLead(null)}>Cancelar</Button>
            <Button
              disabled={!consentLead || consentSource.trim().length < 5 || setConsent.isPending}
              onClick={() => consentLead && setConsent.mutate({
                leadId: consentLead.id,
                status: "opted_in",
                sourceType: consentSourceType as "form" | "event_registration" | "existing_customer" | "written_request" | "other",
                evidenceReference: consentSource.trim(),
              })}
            >Confirmar opt-in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sendLead)} onOpenChange={open => !open && setSendLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar envio unitário</DialogTitle>
            <DialogDescription>
              A mensagem será enviada para {sendLead?.name} usando o template aprovado {form.templateName}.
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm whitespace-pre-wrap">
                {templateBodyText(selectedTemplate.components) || `Template ${selectedTemplate.name}`}
              </div>
              {parameters.map((value, index) => (
                <div className="space-y-2" key={index}>
                  <Label>Variável {`{{${index + 1}}}`}</Label>
                  <Input value={value} onChange={event => setParameters(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                </div>
              ))}
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Confira número, consentimento e variáveis. O clique abaixo realiza um envio real e pode gerar cobrança da Meta.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendLead(null)}>Cancelar</Button>
            <Button
              disabled={!sendLead || parameters.some(value => !value.trim()) || sendTemplate.isPending || !overview?.webhookConfigured}
              onClick={() => sendLead && sendTemplate.mutate({ leadId: sendLead.id, bodyParameters: parameters, confirmed: true })}
            >
              {sendTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar uma mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(audioLead)} onOpenChange={open => !open && setAudioLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar áudio na janela aberta</DialogTitle>
            <DialogDescription>
              O lead enviou mensagem nas últimas 24 horas. Escolha o áudio já configurado no Agendamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Áudio do toque</Label>
            <Select value={audioTouch} onValueChange={setAudioTouch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Toque 1</SelectItem>
                <SelectItem value="2">Toque 2</SelectItem>
                <SelectItem value="3">Toque 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAudioLead(null)}>Cancelar</Button>
            <Button
              disabled={!audioLead || !form.enabled || sendAudio.isPending || !overview?.webhookConfigured}
              onClick={() => audioLead && sendAudio.mutate({ leadId: audioLead.id, touchNumber: Number(audioTouch), confirmed: true })}
            >
              {sendAudio.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Music2 className="mr-2 h-4 w-4" />}
              Enviar áudio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
