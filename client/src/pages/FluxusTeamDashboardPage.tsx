import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { FLUXUS_DIMENSIONS, FLUXUS_DIMENSION_META } from "@shared/fluxus";
import {
  BarChart3,
  Eye,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";

export default function FluxusTeamDashboardPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.fluxus.teamDashboard.useQuery();
  const canAccessIndividual = Boolean(
    data?.company?.reportVisibility === "participant_manager_hr" ||
      (data?.viewerRole === "hr" &&
        data?.company?.reportVisibility === "participant_hr")
  );
  const directory = trpc.fluxus.individualReportDirectory.useQuery(undefined, {
    enabled: canAccessIndividual,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-[520px] rounded-3xl" />;
  if (error || !data)
    return (
      <Card>
        <CardContent className="p-8 text-sm text-destructive">
          {error?.message || "Painel indisponível."}
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <UsersRound className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="outline">Visão de equipe protegida</Badge>
            <h1 className="mt-3 text-3xl font-semibold">
              {data.company?.name || "Equipe"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Resultados agregados para desenvolvimento coletivo. Não são
              avaliação de desempenho, diagnóstico, ranking ou base isolada para
              decisões de pessoas.
            </p>
          </div>
        </div>
      </section>

      {!data.privacy.released || !data.summary ? (
        <Card className="border-amber-500/30">
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <LockKeyhole className="h-10 w-10 text-amber-500" />
            <h2 className="mt-4 text-xl font-semibold">Dados agregados protegidos</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {data.privacy.explanation} O mínimo configurado é{" "}
              {data.privacy.minimumRespondents} avaliações concluídas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric icon={ShieldCheck} label="Privacidade" value="Agregado liberado" />
            <Metric
              icon={BarChart3}
              label="Participação"
              value={`${data.summary.completionRate}%`}
            />
            <Metric
              icon={UsersRound}
              label="Avaliações consideradas"
              value={data.summary.completedBand}
            />
          </div>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Médias do grupo — escala de 1 a 7</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {FLUXUS_DIMENSIONS.map(dimension => {
                const item = data.summary!.averages[dimension];
                return (
                  <div
                    key={dimension}
                    className="rounded-2xl border border-border/60 p-5"
                  >
                    <h3 className="font-semibold">
                      {FLUXUS_DIMENSION_META[dimension].label}
                    </h3>
                    <div className="mt-4 space-y-3">
                      <Bar
                        label="Tendência natural média"
                        value={item.natural}
                        color="#43a97b"
                      />
                      <Bar
                        label="Exigência percebida média"
                        value={item.funcao}
                        color="#4f82d1"
                      />
                      <Bar
                        label="Distância média percebida"
                        value={item.demanda}
                        color="#f6b44c"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Devolutivas individuais</CardTitle>
        </CardHeader>
        <CardContent>
          {!canAccessIndividual ? (
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              A política de visibilidade da empresa não libera relatórios
              individuais para o seu papel. O dashboard agregado permanece
              disponível quando o limiar de privacidade é atendido.
            </div>
          ) : directory.isLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : directory.data?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {directory.data.map(person => (
                <div
                  key={person.assessmentId}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-4"
                >
                  <div>
                    <p className="font-medium">{person.name || "Participante"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {person.jobTitle || "Cargo não informado"}
                      {person.department ? ` · ${person.department}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigate(`/fluxus/relatorio/${person.assessmentId}`)}
                  >
                    <Eye className="h-4 w-4" /> Abrir
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum relatório concluído disponível para devolutiva.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Icon className="h-6 w-6 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <strong>{value.toFixed(1)}</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, (value / 7) * 100))}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
