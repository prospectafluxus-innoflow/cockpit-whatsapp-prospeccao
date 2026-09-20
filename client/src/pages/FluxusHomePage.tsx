import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FluxusReportTabs } from "@/components/fluxus/FluxusReportTabs";
import { trpc } from "@/lib/trpc";
import { isFluxusV2Version } from "@shared/fluxusVersioning";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function FluxusHomePage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.fluxus.me.useQuery();
  const startCycle = trpc.fluxus.startNewCycle.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.fluxus.me.invalidate(),
        utils.fluxus.history.invalidate(),
      ]);
      navigate("/fluxus/avaliacao");
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-destructive">
          Não foi possível carregar sua área: {error?.message}
        </CardContent>
      </Card>
    );
  }

  const { user, company, assessment } = data;
  const completed = assessment.status === "completed" && assessment.result;
  const isBeta2 = isFluxusV2Version(assessment.instrumentVersion);

  if (completed) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-end gap-2 print:hidden">
          {data.canStartNewCycle ? (
            <Button
              onClick={() => startCycle.mutate({ cycleLabel: "Beta 2" })}
              disabled={startCycle.isPending}
              className="gap-2"
            >
              {startCycle.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Iniciar novo ciclo Beta 2
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => navigate("/fluxus/historico")}
            className="gap-2"
          >
            <History className="h-4 w-4" /> Histórico e evolução
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Salvar PDF do colaborador
          </Button>
        </div>
        <FluxusReportTabs
          result={assessment.result!}
          personName={user.name}
          companyName={company?.name}
          jobTitle={user.jobTitle}
          department={user.department}
          audience="participant"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-[#0d2721] px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Fluxus Persona {isBeta2 ? "Beta 2" : "Beta 1"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Olá, {user.name?.split(" ")[0] || "colaborador"}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50/70">
              {isBeta2
                ? "A avaliação separa seu perfil comportamental, seu momento atual e a sustentabilidade da relação com o trabalho. Responda com sinceridade e considere o período indicado em cada etapa."
                : "Sua avaliação conecta preferências naturais, tendências de atuação e a exigência percebida da sua função. Responda com base no que acontece com frequência, não no que parece ideal."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
            <p className="text-xs text-emerald-100/60">Empresa vinculada</p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <Building2 className="h-4 w-4 text-emerald-300" />{" "}
              {company?.name || "Empresa"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardContent className="p-0">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sua avaliação
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {assessment.completion.completed > 0
                        ? "Continuar de onde parou"
                        : "Iniciar Fluxus Persona"}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      São {assessment.completion.total} afirmações em quatro
                      etapas. O preenchimento leva aproximadamente {isBeta2 ? "15 a 20" : "12 a 18"}
                      minutos.
                    </p>
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Em andamento
                </span>
              </div>

              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {assessment.completion.completed} de{" "}
                    {assessment.completion.total} respostas
                  </span>
                  <strong className="text-foreground">
                    {assessment.completion.percentage}%
                  </strong>
                </div>
                <Progress
                  value={assessment.completion.percentage}
                  className="h-2.5"
                />
              </div>

              <Button
                onClick={() => navigate("/fluxus/avaliacao")}
                size="lg"
                className="mt-7 gap-2 rounded-xl"
              >
                {assessment.completion.completed > 0
                  ? "Continuar avaliação"
                  : "Começar agora"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid border-t border-border/60 bg-muted/30 sm:grid-cols-3">
              <Info
                icon={Clock3}
                title="12–18 minutos"
                text="Você pode salvar e continuar depois."
              />
              <Info
                icon={ShieldCheck}
                title="Acesso individual"
                text="Somente pessoas autorizadas consultam os relatórios."
              />
              <Info
                icon={CheckCircle2}
                title="Sem resposta certa"
                text="Escolha o que melhor representa sua realidade."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Antes de responder
            </p>
            <ul className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  Pense no trabalho atual.
                </strong>{" "}
                Considere situações recorrentes, não um episódio isolado.
              </li>
              <li>
                <strong className="text-foreground">
                  Evite a resposta ideal.
                </strong>{" "}
                O valor está na sinceridade e na devolutiva.
              </li>
              <li>
                <strong className="text-foreground">
                  Use o ponto 4 quando necessário.
                </strong>{" "}
                Ele representa uma posição intermediária real.
              </li>
              <li>
                <strong className="text-foreground">Leia os limites.</strong> O
                resultado é uma hipótese de desenvolvimento, não diagnóstico.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Clock3;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 border-border/60 p-5 sm:border-r last:border-r-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}
