import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { feedbackApi, type FeedbackHistoryResponse } from "@/lib/feedbackApi";
import { AlertTriangle, ArrowLeft, ArrowRight, History } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import {
  EmptyState,
  InfoMetric,
  LoadingCards,
  PageHeader,
  QueryFailure,
  StatusBadge,
  canOpenFeedbackRecord,
  formatDate,
} from "./FeedbackShared";

export function FeedbackHistoryPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [participantUserId, setParticipantUserId] = useState<string>("");
  const workspaceQuery = feedbackApi.workspace.useQuery({}, { retry: false });
  const historyQuery = feedbackApi.history.useQuery(
    {
      year,
      participantUserId: participantUserId
        ? Number(participantUserId)
        : undefined,
    },
    { retry: false }
  );
  const data = historyQuery.data;
  const people = workspaceQuery.data?.people ?? [];
  const selectedPerson = participantUserId
    ? people.find(person => person.id === Number(participantUserId))
    : null;
  const viewerUserId = workspaceQuery.data?.membership?.userId;
  const viewedParticipantUserId = participantUserId
    ? Number(participantUserId)
    : viewerUserId;
  const years = Array.from({ length: 6 }, (_, index) => currentYear - index);
  if (historyQuery.isLoading) return <LoadingCards count={4} />;
  if (historyQuery.error || !data)
    return (
      <QueryFailure
        error={historyQuery.error}
        onRetry={() => void historyQuery.refetch()}
        message="Não foi possível carregar o histórico de feedback."
      />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fluxus Feedback · EEC"
        title="Histórico e evolução"
        description="Registros liberados permanecem disponíveis para comparação responsável. Ciclos pendentes não são tratados como nota zero."
      >
        <Link href="/fluxus/feedback">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Workspace
          </Button>
        </Link>
      </PageHeader>
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="history-year">Ano</Label>
            <Select
              value={String(year)}
              onValueChange={value => setYear(Number(value))}
            >
              <SelectTrigger id="history-year" className="w-full lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(item => (
                  <SelectItem key={item} value={String(item)}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {workspaceQuery.data?.canReadContent && people.length > 0 ? (
            <div className="space-y-2 lg:min-w-72">
              <Label htmlFor="history-person">Pessoa no escopo</Label>
              <Select
                value={participantUserId || "self"}
                onValueChange={value =>
                  setParticipantUserId(value === "self" ? "" : value)
                }
              >
                <SelectTrigger id="history-person" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Minha visão</SelectItem>
                  {people.map(person => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name || `Usuário #${person.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Visão padrão: seus próprios registros liberados.
            </p>
          )}
          {selectedPerson ? (
            <Badge variant="outline" className="h-9 items-center">
              Escopo: {selectedPerson.name || `Usuário #${selectedPerson.id}`}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
      <HistorySummary consolidation={data.consolidation} />
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Ciclos disponíveis</CardTitle>
          <CardDescription>
            {data.entries.length} registro(s) retornado(s) para {year}.
            Pendentes e incompletos permanecem identificados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.entries.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhum registro liberado"
              description="Não há feedback liberado para este ano e escopo."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completude</TableHead>
                    <TableHead className="text-right">Evidências</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map(entry => {
                    const complete =
                      entry.items.length === entry.competencies.length &&
                      entry.items.every(item => item.score !== null);
                    const canOpenFeedback =
                      viewedParticipantUserId !== undefined &&
                      canOpenFeedbackRecord({
                        participantUserId: viewedParticipantUserId,
                        viewerUserId,
                        status: entry.status,
                        canReadContent:
                          workspaceQuery.data?.canReadContent ?? false,
                      });
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.cycleName}
                        </TableCell>
                        <TableCell>
                          {formatDate(entry.cycleStart)} –{" "}
                          {formatDate(entry.cycleEnd)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell>
                          {complete ? (
                            <span className="text-sm text-emerald-700 dark:text-emerald-300">
                              Completo
                            </span>
                          ) : (
                            <span className="text-sm text-amber-700 dark:text-amber-300">
                              Parcial
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canOpenFeedback ? (
                            <Link
                              href={`/fluxus/feedback/avaliacao/${entry.id}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                              >
                                <ArrowRight className="h-4 w-4" /> Abrir
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              Conteúdo restrito
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <HistoryCompetencies consolidation={data.consolidation} />
    </div>
  );
}

function HistorySummary({
  consolidation,
}: {
  consolidation: FeedbackHistoryResponse["consolidation"];
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Consolidação dos ciclos</CardTitle>
        <CardDescription>
          Somente ciclos completos e não cancelados entram nos totais numéricos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoMetric
            label="Ciclos completos"
            value={`${consolidation.completedCycles} / ${consolidation.plannedCycles}`}
          />
          <InfoMetric
            label="Obtido"
            value={`${consolidation.obtained} / ${consolidation.maximum}`}
          />
          <InfoMetric label="Esperado" value={String(consolidation.expected)} />
          <InfoMetric
            label="Comparabilidade"
            value={consolidation.comparable ? "Preservada" : "Revisar versões"}
          />
        </div>
        {consolidation.partial ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Há ciclos planejados sem resultado completo</AlertTitle>
            <AlertDescription>
              O consolidado não converte pendências em zero. Aguarde a conclusão
              ou consulte cada status antes de interpretar a evolução.
            </AlertDescription>
          </Alert>
        ) : null}
        {!consolidation.comparable ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Comparabilidade limitada</AlertTitle>
            <AlertDescription>
              Snapshots ou versões metodológicas diferentes foram preservados.
              Os registros continuam acessíveis, mas não recebem delta numérico
              como se fossem equivalentes.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HistoryCompetencies({
  consolidation,
}: {
  consolidation: FeedbackHistoryResponse["consolidation"];
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Competências e evidências</CardTitle>
        <CardDescription>
          Links abrem a avaliação correspondente para leitura contextual,
          conforme o escopo permitido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {consolidation.competencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem competências completas para consolidar.
          </p>
        ) : (
          <div className="space-y-3">
            {consolidation.competencies.map(item => (
              <div
                key={item.competencyId}
                className="rounded-2xl border border-border/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.records.length} registro(s) comparável(is)
                    </p>
                  </div>
                  {item.delta === null ? (
                    <Badge variant="outline">Sem delta</Badge>
                  ) : (
                    <Badge variant={item.delta >= 0 ? "default" : "secondary"}>
                      {item.delta > 0 ? "+" : ""}
                      {item.delta} ponto(s)
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {item.records.map(record => {
                    const cycle = consolidation.cycles.find(
                      candidate => candidate.id === record.cycleId
                    );
                    return (
                      <Link
                        key={`${record.feedbackId}-${record.cycleId}`}
                        href={`/fluxus/feedback/avaliacao/${record.feedbackId}`}
                        className="rounded-xl bg-muted/40 p-3 text-sm hover:bg-muted"
                      >
                        <p className="font-medium">{record.cycleName}</p>
                        <p className="mt-1 text-muted-foreground">
                          Nota {record.score}/6 · Período{" "}
                          {formatDate(cycle?.cycleStart)} –{" "}
                          {formatDate(cycle?.cycleEnd)}
                        </p>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed">
                          {record.evidence || "Sem evidência registrada."}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
