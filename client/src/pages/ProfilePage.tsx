import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Smartphone,
  User,
  Phone,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Trello,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export default function ProfilePage() {
  const { data: profile, isLoading } = trpc.authOwn.getProfile.useQuery();
  const { data: schedule } = trpc.schedule.get.useQuery();
  const utils = trpc.useUtils();
  const { data: trelloStatus } = trpc.trello.status.useQuery();

  const [name, setName] = useState("");
  const [whatsappOwn, setWhatsappOwn] = useState("");
  const [saving, setSaving] = useState(false);
  const [trelloApiKey, setTrelloApiKey] = useState("");
  const [trelloToken, setTrelloToken] = useState("");
  const [trelloListId, setTrelloListId] = useState("");

  const {
    permission,
    isSupported,
    isGranted,
    isSubscribed,
    isConfigured,
    deviceCount,
    isWorking,
    requestPermission,
    scheduleNotifications,
    cancelNotifications,
    testNotification,
  } = useNotifications();

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setWhatsappOwn(profile.whatsappOwn ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (trelloStatus?.listId) setTrelloListId(trelloStatus.listId);
  }, [trelloStatus?.listId]);

  // Agenda notificações automaticamente quando permissão é concedida e schedule existe
  useEffect(() => {
    if (isGranted && schedule) {
      scheduleNotifications({
        morningEnabled: !!schedule.morningEnabled,
        morningHour: schedule.morningHour,
        morningCount: schedule.morningCount,
        lunchEnabled: !!schedule.lunchEnabled,
        lunchHour: schedule.lunchHour,
        lunchCount: schedule.lunchCount,
        afternoonEnabled: !!schedule.afternoonEnabled,
        afternoonHour: schedule.afternoonHour,
        afternoonCount: schedule.afternoonCount,
        eveningEnabled: !!schedule.eveningEnabled,
        eveningHour: schedule.eveningHour,
        eveningCount: schedule.eveningCount,
      });
    }
  }, [isGranted, schedule, scheduleNotifications]);

  const updateProfile = trpc.authOwn.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado!");
      utils.authOwn.getProfile.invalidate();
      setSaving(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setSaving(false);
    },
  });

  const saveTrello = trpc.trello.save.useMutation({
    onSuccess: async ({ listName }) => {
      setTrelloApiKey("");
      setTrelloToken("");
      await utils.trello.status.invalidate();
      toast.success(`Trello ligado à lista “${listName}”.`);
    },
    onError: error => toast.error(error.message),
  });

  const testTrello = trpc.trello.test.useMutation({
    onSuccess: async ({ listName }) => {
      await utils.trello.status.invalidate();
      toast.success(`Ligação confirmada com a lista “${listName}”.`);
    },
    onError: error => toast.error(error.message),
  });

  const toggleTrello = trpc.trello.setEnabled.useMutation({
    onSuccess: async () => {
      await utils.trello.status.invalidate();
      toast.success(trelloStatus?.enabled ? "Sincronização Trello pausada." : "Sincronização Trello ativada.");
    },
    onError: error => toast.error(error.message),
  });

  const handleSave = () => {
    const cleaned = whatsappOwn.replace(/\D/g, "");
    if (cleaned && (cleaned.length < 10 || cleaned.length > 15)) {
      toast.error("Número de WhatsApp inválido. Use somente dígitos (10-15 dígitos com DDD).");
      return;
    }
    setSaving(true);
    updateProfile.mutate({ name: name || undefined, whatsappOwn: cleaned || "" });
  };

  const handleActivateNotifications = async () => {
    try {
      const granted = await requestPermission();
      if (!granted) {
        toast.error("Permissão negada. Habilite as notificações nas configurações do navegador.");
        return;
      }
      toast.success("Dispositivo ativado! Você receberá lembretes mesmo com o navegador fechado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ativar os lembretes.");
    }
  };

  const handleDisableNotifications = async () => {
    try {
      await cancelNotifications();
      toast.info("Lembretes desativados neste dispositivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desativar os lembretes.");
    }
  };

  // Gera link wa.me para se mandar uma mensagem de lembrete
  const generateWhatsAppReminderLink = (windowLabel: string, hour: number, count: number) => {
    const cleaned = whatsappOwn.replace(/\D/g, "");
    if (!cleaned) return null;
    const msg = encodeURIComponent(
      `🔔 ProspectaFluxus — Lembrete de ${windowLabel}!\n\n` +
      `São ${hour}h — você tem ${count} lead${count > 1 ? "s" : ""} para prospectar agora.\n\n` +
      `👉 Acesse: ${window.location.origin}/cockpit`
    );
    return `https://wa.me/${cleaned}?text=${msg}`;
  };

  const windows = schedule
    ? [
        { label: "Manhã", emoji: "🌅", hour: schedule.morningHour, count: schedule.morningCount, enabled: !!schedule.morningEnabled },
        { label: "Almoço", emoji: "☕", hour: schedule.lunchHour, count: schedule.lunchCount, enabled: !!schedule.lunchEnabled },
        { label: "Meio da tarde", emoji: "⛅", hour: schedule.afternoonHour, count: schedule.afternoonCount, enabled: !!schedule.afternoonEnabled },
        { label: "Fim do dia", emoji: "🌇", hour: schedule.eveningHour, count: schedule.eveningCount, enabled: !!schedule.eveningEnabled },
      ].filter((w) => w.enabled)
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure seus dados e ative os lembretes de prospecção
        </p>
      </div>

      {/* Dados pessoais */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="bg-muted/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">E-mail</label>
            <Input
              value={profile?.email ?? ""}
              disabled
              className="bg-muted/20 text-muted-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-emerald-400" />
              Seu WhatsApp
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30">
                Para lembretes
              </Badge>
            </label>
            <Input
              value={whatsappOwn}
              onChange={(e) => setWhatsappOwn(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 11987654321 (somente números com DDD)"
              className="bg-muted/30"
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              Usado para gerar links de lembrete no WhatsApp. Não compartilhado com ninguém.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Notificações push */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            Lembretes no navegador
          </CardTitle>
          <CardDescription>
            Receba alertas automáticos nos horários das suas janelas de envio — mesmo com o navegador em segundo plano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Os lembretes aguardam a configuração segura das chaves Web Push no servidor.</span>
            </div>
          ) : !isSupported ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {isIos && !isStandalone
                  ? "No iPhone, abra este site no Safari, toque em Compartilhar → Adicionar à Tela de Início e depois ative os lembretes pelo ícone instalado."
                  : "Este navegador não oferece Web Push. Use Chrome ou Edge no computador/Android, ou instale o site pelo Safari no iPhone."}
              </span>
            </div>
          ) : isGranted && isSubscribed ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Este dispositivo está inscrito e receberá lembretes mesmo com o navegador fechado.
                  {deviceCount > 1 ? ` Há ${deviceCount} dispositivos ativos na sua conta.` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isWorking}
                  onClick={async () => {
                    try {
                      const ok = await testNotification();
                      if (ok) {
                        toast.success("Notificação de teste enviada para os seus dispositivos ativos.");
                      } else {
                        toast.error("Nenhum dispositivo confirmou a receção. Verifique as permissões do sistema.");
                      }
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o teste.");
                    }
                  }}
                  className="gap-2 text-xs"
                >
                  <Bell className="h-3 w-3" />
                  Testar notificação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isWorking}
                  onClick={handleDisableNotifications}
                  className="gap-2 text-xs text-muted-foreground"
                >
                  <BellOff className="h-3 w-3" />
                  Desativar neste dispositivo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ative este dispositivo para receber alertas no telemóvel ou computador quando chegar a hora de prospectar.
              </p>
              <Button disabled={isWorking || permission === "denied"} onClick={handleActivateNotifications} className="gap-2">
                <Bell className="h-4 w-4" />
                {isWorking ? "A ativar..." : "Ativar lembretes neste dispositivo"}
              </Button>
              {permission === "denied" && (
                <p className="text-xs text-red-400">
                  Permissão bloqueada. Abra as configurações deste site no navegador e permita notificações antes de tentar novamente.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lembretes via WhatsApp */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            Lembretes via WhatsApp
          </CardTitle>
          <CardDescription>
            Clique no botão do horário desejado para se mandar uma mensagem de lembrete no WhatsApp.
            {!whatsappOwn && (
              <span className="text-amber-400"> Cadastre seu número acima para habilitar.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma janela de envio configurada. Acesse a página de Agendamento para configurar.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {windows.map((win) => {
                const link = generateWhatsAppReminderLink(win.label, win.hour, win.count);
                return (
                  <a
                    key={win.label}
                    href={link ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={!link ? (e) => { e.preventDefault(); toast.warning("Cadastre seu WhatsApp acima primeiro."); } : undefined}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      link
                        ? "border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/10 cursor-pointer"
                        : "border-border/30 bg-muted/20 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-xl">{win.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{win.label}</p>
                      <p className="text-xs text-muted-foreground">{win.hour}h — {win.count} lead{win.count > 1 ? "s" : ""}</p>
                    </div>
                    {link && <ExternalLink className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integração Trello */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Trello className="h-4 w-4 text-sky-400" />
            Trello — leads respondidos
            {trelloStatus?.connected && (
              <Badge variant="outline" className={trelloStatus.enabled ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"}>
                {trelloStatus.enabled ? "Ativo" : "Pausado"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Ao marcar um lead como “Respondeu”, o sistema cria um único cartão na lista escolhida e evita duplicações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!trelloStatus?.serverConfigured ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>A integração aguarda a chave de cifragem segura no servidor.</span>
            </div>
          ) : (
            <>
              {trelloStatus.connected && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-sm text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Credenciais guardadas de forma cifrada. Lista atual: <strong>{trelloStatus.listName ?? trelloStatus.listId}</strong>.
                  </span>
                </div>
              )}

              {trelloStatus.lastError && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{trelloStatus.lastError}</span>
                </div>
              )}

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">API key do Trello</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={trelloApiKey}
                    onChange={event => setTrelloApiKey(event.target.value.trim())}
                    placeholder={trelloStatus.connected ? "Deixe vazio para manter a atual" : "Cole a API key"}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Token do Trello</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={trelloToken}
                    onChange={event => setTrelloToken(event.target.value.trim())}
                    placeholder={trelloStatus.connected ? "Deixe vazio para manter o atual" : "Cole o token"}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">ID da lista que receberá os leads</label>
                  <Input
                    value={trelloListId}
                    onChange={event => setTrelloListId(event.target.value.trim())}
                    placeholder="Ex.: 64f1a2b3c4d5e6f789012345"
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Obtenha a API key e autorize um token na página de administração do Trello. As credenciais nunca voltam a ser mostradas pelo sistema.{" "}
                <a
                  href="https://trello.com/power-ups/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  Abrir Trello <ExternalLink className="h-3 w-3" />
                </a>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => saveTrello.mutate({
                    apiKey: trelloApiKey || undefined,
                    token: trelloToken || undefined,
                    listId: trelloListId,
                    enabled: true,
                  })}
                  disabled={
                    saveTrello.isPending ||
                    !trelloListId ||
                    Boolean(trelloApiKey) !== Boolean(trelloToken) ||
                    (!trelloStatus.connected && (!trelloApiKey || !trelloToken))
                  }
                  className="gap-2"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveTrello.isPending ? "A validar..." : trelloStatus.connected ? "Guardar e validar" : "Ligar Trello"}
                </Button>

                {trelloStatus.connected && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => testTrello.mutate()}
                      disabled={testTrello.isPending}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${testTrello.isPending ? "animate-spin" : ""}`} />
                      Testar ligação
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toggleTrello.mutate({ enabled: !trelloStatus.enabled })}
                      disabled={toggleTrello.isPending}
                    >
                      {trelloStatus.enabled ? "Pausar sincronização" : "Ativar sincronização"}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dica iPhone */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/30 text-sm">
        <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">iPhone?</span> Para receber notificações no iOS, adicione o ProspectaFluxus à tela inicial: toque em{" "}
          <span className="font-medium text-foreground">Compartilhar → "Adicionar à Tela de Início"</span>. Depois ative os lembretes normalmente.
        </div>
      </div>
    </div>
  );
}
