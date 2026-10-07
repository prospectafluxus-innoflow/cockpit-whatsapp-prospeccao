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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  evaluatorOptions,
  feedbackAccessUrl,
  resolveCycleEvaluator,
} from "@/lib/feedbackEvaluator";
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
  const [enrolmentConfirmed, setEnrolmentConfirmed] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
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
    person =>
      person.eligible &&
      Boolean(person.assignmentId) &&
      !assignedIds.has(person.id)
  );
  const nextStatuses = CYCLE_TRANSITIONS[cycle.status].filter(
    (status): status is "active" | "closed" | "cancelled" =>
      status !== "planned"
  );
  const refresh = () => void query.refetch();
  const submitParticipants = async () => {
    setOperationError(null);
    if (query.isFetching || query.error || addParticipants.isPending) return;
    const selectableIds = selected.filter(userId => !assignedIds.has(userId));
    const selectedPeople = selectableIds.map(id =>
      data.people.find(person => person.id === id)
    );
    const invalid = selectedPeople.find(
      person =>
        !person ||
        !resolveCycleEvaluator(person, data.people, evaluators[person.id]).valid
    );
    if (
      !selectedPeople.length ||
      selectedPeople.some(person => !person) ||
      invalid
    ) {
      const message = invalid
        ? resolveCycleEvaluator(invalid, data.people, evaluators[invalid.id])
            .reason
        : "Selecione participantes com vínculo e avaliador autorizado.";
      setOperationError(message);
      toast.error(message);
      return;
    }
    const needsIndividualAccess = selectedPeople.some(
      person => !person?.hasFeedbackAccess
    );
    if (
      needsIndividualAccess &&
      (data.membership?.role !== "company_admin" || !enrolmentConfirmed)
    ) {
      const message =
        "Confirme o cadastro de acesso individual dos participantes sem papel no Feedback. Somente o administrador da empresa pode fazê-lo.";
      setOperationError(message);
      toast.error(message);
      return;
    }
    const participants = selectedPeople.map(person => ({
      userId: person!.id,
      evaluatorUserId:
        evaluators[person!.id] === undefined
          ? undefined
          : Number(evaluators[person!.id]),
      expectedAssignmentId: person!.assignmentId,
    }));
    try {
      await addParticipants.mutateAsync({
        cycleId,
        participants,
        enrollParticipants: needsIndividualAccess && enrolmentConfirmed,
      });
      setSelected([]);
      setEvaluators({});
      setEnrolmentConfirmed(false);
      const refreshed = await query.refetch();
      toast.success("Participantes e avaliadores salvos no ciclo.");
      if (refreshed.isError)
        setOperationError(
          "Atribuição gravada; não foi possível atualizar a lista. Atualize a página antes de repetir."
        );
    } catch (error) {
      const message = errorMessage(
        error,
        "Não foi possível atribuir os participantes."
      );
      setOperationError(message);
      toast.error(message);
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
          allPeople={data.people}
          assignedIds={assignedIds}
          selected={selected}
          setSelected={value => {
            setSelected(value);
            setEnrolmentConfirmed(false);
            setOperationError(null);
          }}
          evaluators={evaluators}
          setEvaluators={setEvaluators}
          onSubmit={() => void submitParticipants()}
          pending={addParticipants.isPending || query.isFetching}
          cycleId={cycleId}
          canEnrollParticipants={data.membership?.role === "company_admin"}
          enrolmentConfirmed={enrolmentConfirmed}
          setEnrolmentConfirmed={setEnrolmentConfirmed}
          operationError={operationError}
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
  allPeople,
  assignedIds,
  selected,
  setSelected,
  evaluators,
  setEvaluators,
  onSubmit,
  pending,
  cycleId,
  canEnrollParticipants,
  enrolmentConfirmed,
  setEnrolmentConfirmed,
  operationError,
}: {
  eligiblePeople: ReadonlyArray<FeedbackPerson>;
  allPeople: ReadonlyArray<FeedbackPerson>;
  assignedIds: ReadonlySet<number>;
  selected: number[];
  setSelected: (value: number[]) => void;
  evaluators: Record<number, string>;
  setEvaluators: (value: Record<number, string>) => void;
  onSubmit: () => void;
  pending: boolean;
  cycleId: number;
  canEnrollParticipants: boolean;
  enrolmentConfirmed: boolean;
  setEnrolmentConfirmed: (value: boolean) => void;
  operationError: string | null;
}) {
  const eligibleIds = new Set(eligiblePeople.map(person => person.id));
  const selectedPeople = allPeople.filter(
    person => selected.includes(person.id) && !assignedIds.has(person.id)
  );
  const missingAccess = selectedPeople.filter(
    person => !person.hasFeedbackAccess
  );
  const selectedInvalid = selectedPeople.some(
    person =>
      !resolveCycleEvaluator(person, allPeople, evaluators[person.id]).valid
  );
  const [changing, setChanging] = useState<Record<number, boolean>>({});
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Participantes e avaliadores</CardTitle>
        <CardDescription>
          O gestor direto já cadastrado é sugerido automaticamente. Use “Trocar
          avaliador” somente para uma exceção neste ciclo; isso não muda o
          gestor da pessoa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {operationError ? (
          <Alert variant="destructive">
            <AlertTitle>Status da inclusão</AlertTitle>
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Pessoa</TableHead>
                <TableHead>Elegibilidade</TableHead>
                <TableHead className="min-w-72">
                  Avaliador deste ciclo
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPeople.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhuma pessoa disponível.
                  </TableCell>
                </TableRow>
              ) : (
                allPeople.map(person => {
                  const alreadyAssigned = assignedIds.has(person.id);
                  const checked =
                    !alreadyAssigned && selected.includes(person.id);
                  const result = resolveCycleEvaluator(
                    person,
                    allPeople,
                    evaluators[person.id]
                  );
                  const options = evaluatorOptions(person, allPeople);
                  const openChange =
                    changing[person.id] || evaluators[person.id] !== undefined;
                  return (
                    <TableRow key={person.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={
                            pending ||
                            alreadyAssigned ||
                            !eligibleIds.has(person.id)
                          }
                          onCheckedChange={value =>
                            setSelected(
                              value === true && !alreadyAssigned
                                ? Array.from(new Set([...selected, person.id]))
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
                        {alreadyAssigned ? (
                          <Badge variant="secondary">Já no ciclo</Badge>
                        ) : !person.eligible ? (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            {person.eligibilityReason || "Persona pendente"}
                          </span>
                        ) : !person.assignmentId ? (
                          <div className="space-y-1 text-xs">
                            <p>Sem vínculo organizacional</p>
                            <Link
                              className="underline"
                              href={`/fluxus/feedback?section=organization&returnCycleId=${cycleId}`}
                            >
                              Cadastrar vínculo
                            </Link>
                          </div>
                        ) : (
                          <Badge variant="default">Persona concluído</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {alreadyAssigned ? (
                          <span className="text-xs text-muted-foreground">
                            Confira em Avaliações atribuídas.
                          </span>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium">
                                {result.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {result.automatic
                                  ? "Gestor direto cadastrado"
                                  : "Avaliador escolhido para este ciclo"}
                              </p>
                            </div>
                            {checked && result.reason ? (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                <p>{result.reason}</p>
                                <Link
                                  className="mt-1 inline-block underline"
                                  href={
                                    result.id
                                      ? feedbackAccessUrl(result.id, cycleId)
                                      : `/fluxus/feedback?section=organization&returnCycleId=${cycleId}`
                                  }
                                >
                                  {result.id
                                    ? "Configurar acesso deste avaliador"
                                    : "Configurar vínculo da pessoa"}
                                </Link>
                              </div>
                            ) : null}
                            {checked && !openChange ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setChanging({
                                    ...changing,
                                    [person.id]: true,
                                  })
                                }
                                disabled={pending}
                              >
                                Trocar avaliador
                              </Button>
                            ) : null}
                            {checked && openChange ? (
                              <div className="space-y-2">
                                {options.length ? (
                                  <Select
                                    value={
                                      evaluators[person.id] ??
                                      (result.valid && result.id
                                        ? String(result.id)
                                        : "")
                                    }
                                    onValueChange={value =>
                                      setEvaluators({
                                        ...evaluators,
                                        [person.id]: value,
                                      })
                                    }
                                    disabled={pending}
                                  >
                                    <SelectTrigger
                                      className="w-full"
                                      aria-label={`Avaliador de ${person.name || person.id}`}
                                    >
                                      <SelectValue placeholder="Selecione um avaliador autorizado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.map(candidate => (
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
                                  <p className="text-xs text-muted-foreground">
                                    Nenhum avaliador autorizado para esta
                                    pessoa. Ajuste Papéis e permissões; o
                                    vínculo não concede leitura automaticamente.
                                  </p>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => {
                                    const next = { ...evaluators };
                                    delete next[person.id];
                                    setEvaluators(next);
                                    setChanging({
                                      ...changing,
                                      [person.id]: false,
                                    });
                                  }}
                                >
                                  Usar gestor direto
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {missingAccess.length ? (
          <Alert>
            <AlertTitle>Acesso individual dos participantes</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {missingAccess
                  .map(person => person.name || `Usuário #${person.id}`)
                  .join(", ")}{" "}
                ainda não possuem papel no Feedback. O acesso Colaborador
                permite ver somente as próprias devolutivas liberadas, nunca
                notas de colegas.
              </p>
              {canEnrollParticipants ? (
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={enrolmentConfirmed}
                    onCheckedChange={value =>
                      setEnrolmentConfirmed(value === true)
                    }
                    disabled={pending}
                  />
                  <span>
                    Confirmo criar somente esse acesso individual para as
                    pessoas selecionadas ao adicioná-las ao ciclo.
                  </span>
                </label>
              ) : (
                <p>
                  O administrador da empresa precisa autorizar esse acesso em
                  Papéis e permissões.
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {selectedInvalid ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Resolva os avisos dos avaliadores selecionados antes de adicionar.
            Nenhuma autorização será ativada automaticamente.
          </p>
        ) : null}
        <Button
          onClick={onSubmit}
          disabled={
            pending ||
            !selected.length ||
            selectedInvalid ||
            (missingAccess.length > 0 &&
              (!canEnrollParticipants || !enrolmentConfirmed))
          }
          className="gap-2"
        >
          <UsersRound className="h-4 w-4" />
          {pending ? "Adicionando…" : "Adicionar participantes selecionados"}
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
