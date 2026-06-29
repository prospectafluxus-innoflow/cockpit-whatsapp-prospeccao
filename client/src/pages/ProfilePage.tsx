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
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export default function ProfilePage() {
  const { data: profile, isLoading } = trpc.authOwn.getProfile.useQuery();
  const { data: schedule } = trpc.schedule.get.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [whatsappOwn, setWhatsappOwn] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    permission,
    isSupported,
    isGranted,
    requestPermission,
    scheduleNotifications,
    cancelNotifications,
    testNotification,
  } = useNotifications();

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setWhatsappOwn(profile.whatsappOwn ?? "");
    }
  }, [profile]);

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
    const granted = await requestPermission();
    if (granted) {
      toast.success("Notificações ativadas! Você receberá lembretes nos horários configurados.");
      if (schedule) {
        await scheduleNotifications({
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
        await testNotification();
      }
    } else {
      toast.error("Permissão negada. Habilite as notificações nas configurações do navegador.");
    }
  };

  const handleDisableNotifications = async () => {
    await cancelNotifications();
    toast.info("Lembretes desativados neste dispositivo.");
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
          {!isSupported ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-sm text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Seu navegador não suporta notificações push. Use Chrome no Android ou desktop.</span>
            </div>
          ) : isGranted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Notificações ativadas! Você receberá lembretes nos horários configurados.</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const ok = await testNotification();
                    if (ok) {
                      toast.success("Notificação enviada! Se não apareceu no canto da tela, verifique: Chrome → 🔒 cadeado na barra de endereço → Notificações → Permitir", {
                        duration: 10000,
                      });
                    } else {
                      toast.error("Notificação bloqueada. Clique para liberar no Chrome.", {
                        action: {
                          label: "Configurar Chrome",
                          onClick: () => {
                            // chrome:// URLs não abrem via JS — mostra instrução
                            toast.info("No Chrome: clique no 🔒 cadeado na barra de endereço → Notificações → Permitir", { duration: 10000 });
                          },
                        },
                        duration: 8000,
                      });
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
                  onClick={handleDisableNotifications}
                  className="gap-2 text-xs text-muted-foreground"
                >
                  <BellOff className="h-3 w-3" />
                  Desativar lembretes
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ative para receber um alerta no celular ou computador quando chegar a hora de prospectar.
              </p>
              <Button onClick={handleActivateNotifications} className="gap-2">
                <Bell className="h-4 w-4" />
                Ativar lembretes no navegador
              </Button>
              {permission === "denied" && (
                <p className="text-xs text-red-400">
                  Permissão bloqueada. Acesse as configurações do navegador e permita notificações para este site.
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
