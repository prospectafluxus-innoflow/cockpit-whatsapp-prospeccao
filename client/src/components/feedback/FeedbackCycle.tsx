import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  feedbackApi,
  type FeedbackPerson,
  type FeedbackListEntry,
} from "@/lib/feedbackApi";
import {
  CYCLE_STATUS_LABELS,
  CYCLE_TRANSITIONS,
  type FeedbackStatus,
} from "@shared/feedback";
import type { DevelopmentCycle } from "../../../../drizzle/feedbackSchema";
import { ArrowLeft, ChevronRight, UsersRound, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  CycleStatusBadge,
  EmptyState,
  LoadingCards,
  PageHeader,
  QueryFailure,
  StatusBadge,
  canOpenFeedbackRecord,
  errorMessage,
  formatDate,
  InfoMetric,
} from "./FeedbackShared";

export function FeedbackCyclePage({ params }: { params: { id: string } }) {
  const cycleId = Number(params.id);
  const query = feedbackApi.workspace.useQuery(
    {},
    { retry: false, enabled: Number.isInteger(cycleId) && cycleId > 0 }
  );
  const data = query.data;
  const [selected, setSelected] = useState<number[]>([]);
  const [evaluators, setEvaluators] = useState<Record<number, string>>({});
  const [cycleConfirm, setCycleConfirm] = useState(false);
  const addParticipants = feedbackApi.addParticipants.useMutation();
  const transitionCycle = feedbackApi.transitionCycle.useMutation();
  const removeParticipant = feedbackApi.removeParticipant.useMutation();
  const [, navigate] = useLocation();
  if (query.isLoading) return <LoadingCards count={4} />;
  if (query.error || !data)
    return (
      <QueryFailure
        error={query.error}
        onRetry={() => void query.refetch()}
        message="Não foi possível carregar o ciclo."
      />
    );
  const cycle = data.cycles.find(item => item.id === cycleId);
  if (!cycle)
    return (
      <EmptyState
        icon={XCircle}
        title="Ciclo não encontrado"
        description="O ciclo pode ter sido removido, cancelado ou você não tem permissão para acessá-lo."
      />
    );
  const entries = data.feedbacks.filter(item => item.cycleId === cycleId);
  const assignedIds = new Set(entries.map(item => item.participantUserId));
  const eligiblePeople = data.people.filter(
    person => person.eligible && !assignedIds.has(person.id)
  );
  const candidatePeople = data.people.filter(
    person => person.evaluatorEligible
  );
  const nextStatuses = CYCLE_TRANSITIONS[cycle.status].filter(
    (status): status is "active" | "closed" | "cancelled" =>
      status !== "planned"
  );
  const refresh = () => void query.refetch();
  const submitParticipants = async () => {
    const selectableIds = selected.filter(userId => !assignedIds.has(userId));
    const participants = selectableIds
      .map(userId => ({ userId, evaluatorUserId: Number(evaluators[userId]) }))
      .filter(
        item =>
          Number.isInteger(item.evaluatorUserId) &&
          item.evaluatorUserId > 0 &&
          item.evaluatorUserId !== item.userId
      );
    if (!participants.length || participants.length !== selectableIds.length) {
      toast.error(
        "Selecione um avaliador válido e diferente para cada participante."
      );
      return;
    }
    try {
      await addParticipants.mutateAsync({ cycleId, participants });
      toast.success("Participantes atribuídos.");
      setSelected([]);
      setEvaluators({});
      refresh();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível atribuir os participantes.")
      );
    }
  };
  const submitCycleTransition = async (
    status: "active" | "closed" | "cancelled"
  ) => {
    if (!cycleConfirm) return;
    try {
      await transitionCycle.mutateAsync({ id: cycleId, status });
      toast.success(`Ciclo ${CYCLE_STATUS_LABELS[status].toLowerCase()}.`);
      setCycleConfirm(false);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível alterar o ciclo."));
    }
  };
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/fluxus/feedback")}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao workspace
      </Button>
      <PageHeader
        eyebrow={`Ciclo ${cycle.year}`}
        title={cycle.name}
        description={`Período de ${formatDate(cycle.startsOn)} a ${formatDate(cycle.endsOn)} · template v${cycle.templateVersion} · ${cycle.methodVersion}`}
      >
        <CycleStatusBadge status={cycle.status} />
      </PageHeader>
      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <InfoMetric
            label="Período"
            value={`${formatDate(cycle.startsOn)} – ${formatDate(cycle.endsOn)}`}
          />
          <InfoMetric
            label="Competências"
            value={String(cycle.competencySnapshot.length)}
          />
          <InfoMetric label="Atribuições" value={String(entries.length)} />
        </CardContent>
      </Card>
      {data.canConfigure ? (
        <CycleOperations
          cycle={cycle}
          nextStatuses={nextStatuses}
          cycleConfirm={cycleConfirm}
          setCycleConfirm={setCycleConfirm}
          onTransition={status => void submitCycleTransition(status)}
          transitionPending={transitionCycle.isPending}
        />
      ) : null}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Competências deste ciclo</CardTitle>
          <CardDescription>
            Snapshot fechado no momento da criação. Todas as notas seguem a
            escala inteira de 0 a 6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cycle.competencySnapshot.map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-border/60 p-4"
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {item.definition}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {data.canConfigure && cycle.status === "planned" ? (
        <ParticipantPicker
          eligiblePeople={eligiblePeople}
          candidatePeople={candidatePeople}
          allPeople={data.people}
          assignedIds={assignedIds}
          selected={selected}
          setSelected={setSelected}
          evaluators={evaluators}
          setEvaluators={setEvaluators}
          onSubmit={() => void submitParticipants()}
          pending={addParticipants.isPending}
        />
      ) : null}
      <CycleParticipants
        entries={entries}
        canConfigure={data.canConfigure}
        canReadContent={data.canReadContent}
        viewerUserId={data.membership?.userId}
        cycleStatus={cycle.status}
        onRemove={async userId => {
          if (
            !window.confirm(
              "Remover esta pessoa do ciclo planejado? A operação será auditada."
            )
          )
            return;
          try {
            await removeParticipant.mutateAsync({ cycleId, userId });
            toast.success("Participante removido.");
            refresh();
          } catch (error) {
            toast.error(
              errorMessage(error, "Não foi possível remover o participante.")
            );
          }
        }}
      />
    </div>
  );
}
function CycleOperations({
  cycle,
  nextStatuses,
  cycleConfirm,
  setCycleConfirm,
  onTransition,
  transitionPending,
}: {
  cycle: DevelopmentCycle;
  nextStatuses: readonly ("active" | "closed" | "cancelled")[];
  cycleConfirm: boolean;
  setCycleConfirm: (value: boolean) => void;
  onTransition: (status: "active" | "closed" | "cancelled") => void;
  transitionPending: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Operação do ciclo</CardTitle>
        <CardDescription>
          As transições são estritas; encerrar não força ciência do colaborador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map(status => (
            <Button
              key={status}
              variant={status === "cancelled" ? "destructive" : "outline"}
              disabled={transitionPending || !cycleConfirm}
              onClick={() => onTransition(status)}
            >
              {transitionPending ? "Aplicando…" : CYCLE_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
        {nextStatuses.length > 0 ? (
          <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <Checkbox
              checked={cycleConfirm}
              onCheckedChange={value => setCycleConfirm(value === true)}
            />
            <span className="text-sm leading-relaxed">
              Confirmo a alteração do ciclo <strong>{cycle.name}</strong> e
              entendo que a API validará participantes, elegibilidade e
              permissões.
            </span>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            Não há transições disponíveis para este estado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function ParticipantPicker({
  eligiblePeople,
  candidatePeople,
  allPeople,
  assignedIds,
  selected,
  setSelected,
  evaluators,
  setEvaluators,
  onSubmit,
  pending,
}: {
  eligiblePeople: ReadonlyArray<FeedbackPerson>;
  candidatePeople: ReadonlyArray<FeedbackPerson>;
  allPeople: ReadonlyArray<FeedbackPerson>;
  assignedIds: ReadonlySet<number>;
  selected: number[];
  setSelected: (value: number[]) => void;
  evaluators: Record<number, string>;
  setEvaluators: (value: Record<number, string>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const eligibleIds = new Set(eligiblePeople.map(person => person.id));
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Participantes elegíveis</CardTitle>
        <CardDescription>
          Elegibilidade exige avaliação Persona concluída e válida, assignment
          atual e vínculo na empresa. Motivos de inelegibilidade permanecem
          visíveis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Pessoa</TableHead>
                <TableHead>Elegibilidade</TableHead>
                <TableHead className="min-w-56">Avaliador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPeople.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhuma pessoa no escopo operacional.
                  </TableCell>
                </TableRow>
              ) : (
                allPeople.map(person => {
                  const alreadyAssigned = assignedIds.has(person.id);
                  const checked =
                    !alreadyAssigned && selected.includes(person.id);
                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={
                            alreadyAssigned || !eligibleIds.has(person.id)
                          }
                          onCheckedChange={value =>
                            setSelected(
                              value === true && !alreadyAssigned
                                ? [...selected, person.id]
                                : selected.filter(id => id !== person.id)
                            )
                          }
                          aria-label={`Selecionar ${person.name || person.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {person.name || `Usuário #${person.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {person.jobTitle || "Cargo não informado"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {alreadyAssigned ? (
                            <Badge variant="secondary">Já no ciclo</Badge>
                          ) : null}
                          {alreadyAssigned ? null : eligibleIds.has(
                              person.id
                            ) ? (
                            <Badge variant="default">Elegível</Badge>
                          ) : (
                            <span className="text-xs text-amber-700 dark:text-amber-300">
                              {person.eligibilityReason || "Não elegível"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {checked ? (
                          <Select
                            value={evaluators[person.id] || ""}
                            onValueChange={value =>
                              setEvaluators({
                                ...evaluators,
                                [person.id]: value,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Escolha o avaliador" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidatePeople
                                .filter(candidate => candidate.id !== person.id)
                                .map(candidate => (
                                  <SelectItem
                                    key={candidate.id}
                                    value={String(candidate.id)}
                                  >
                                    {candidate.name ||
                                      `Usuário #${candidate.id}`}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Selecione a pessoa primeiro
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <Button
          onClick={onSubmit}
          disabled={pending || selected.length === 0}
          className="gap-2"
        >
          <UsersRound className="h-4 w-4" />{" "}
          {pending ? "Atribuindo…" : "Atribuir selecionados"}
        </Button>
      </CardContent>
    </Card>
  );
}
function CycleParticipants({
  entries,
  canConfigure,
  canReadContent,
  viewerUserId,
  cycleStatus,
  onRemove,
}: {
  entries: Array<{
    id: number;
    participantUserId: number;
    evaluatorUserId: number;
    status: FeedbackStatus;
    revision: number;
    participantName: string | null;
    evaluatorName: string | null;
  }>;
  canConfigure: boolean;
  canReadContent: boolean;
  viewerUserId: number | null | undefined;
  cycleStatus: DevelopmentCycle["status"];
  onRemove: (userId: number) => void;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Avaliações atribuídas</CardTitle>
        <CardDescription>
          Itens completos só aparecem na página da avaliação quando a
          autorização do contrato permitir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="Ainda sem participantes"
            description="Adicione pessoas elegíveis ao ciclo planejado para começar."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Avaliador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Revisão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const canOpen = canOpenFeedbackRecord({
                    participantUserId: entry.participantUserId,
                    viewerUserId,
                    status: entry.status,
                    canReadContent,
                  });
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.participantName ||
                          `Usuário #${entry.participantUserId}`}
                      </TableCell>
                      <TableCell>
                        {entry.evaluatorName ||
                          `Usuário #${entry.evaluatorUserId}`}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell>{entry.revision}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canOpen ? (
                            <Link
                              href={`/fluxus/feedback/avaliacao/${entry.id}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                              >
                                <ChevronRight className="h-4 w-4" /> Abrir
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              title="A leitura de conteúdo não está autorizada para esta sessão."
                            >
                              Conteúdo restrito
                            </Button>
                          )}
                          {canConfigure && cycleStatus === "planned" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemove(entry.participantUserId)}
                            >
                              Remover
                            </Button>
                          ) : null}
                        </div>
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
  );
}
