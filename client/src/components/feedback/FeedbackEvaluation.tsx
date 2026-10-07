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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  feedbackApi,
  type FeedbackDetail,
  type FeedbackItem,
  type FeedbackCompetency,
} from "@/lib/feedbackApi";
import {
  EEC_GUIDANCE,
  FEEDBACK_ACKNOWLEDGEMENT,
  FEEDBACK_COLLABORATOR_LABELS,
  FEEDBACK_PURPOSE,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TRANSITIONS,
  classifyFeedback,
  isFeedbackVisibleToParticipant,
  type FeedbackStatus,
} from "@shared/feedback";
import {
  ArrowLeft,
  ArrowRight,
  FilePenLine,
  LockKeyhole,
  MessageSquareText,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  InfoMetric,
  LoadingCards,
  PageHeader,
  QueryFailure,
  StatusBadge,
  errorMessage,
  formatDate,
  scoreDescription,
  scoreLabel,
} from "./FeedbackShared";

export function FeedbackEvaluationPage({ params }: { params: { id: string } }) {
  const feedbackId = Number(params.id);
  const query = feedbackApi.get.useQuery(
    { id: feedbackId },
    { retry: false, enabled: Number.isInteger(feedbackId) && feedbackId > 0 }
  );
  const data = query.data;
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const loadedIdentity = useRef<string | null>(null);
  const loadedRevision = useRef<number | null>(null);
  const dirtyDraft = useRef(false);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [ackConfirm, setAckConfirm] = useState(false);
  const [comment, setComment] = useState("");
  const saveDraft = feedbackApi.saveDraft.useMutation();
  const transition = feedbackApi.transition.useMutation();
  const correct = feedbackApi.correct.useMutation();
  const addComment = feedbackApi.comment.useMutation();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!data) return;
    const identity = `${data.feedback.id}:${data.cycle.id}`;
    const incomingRevision = data.feedback.revision;
    const nextItems =
      data.isParticipant &&
      !isFeedbackVisibleToParticipant(data.feedback.status)
        ? []
        : mergeEvaluationItems(data);
    if (loadedIdentity.current !== identity) {
      loadedIdentity.current = identity;
      loadedRevision.current = incomingRevision;
      dirtyDraft.current = false;
      setItems(nextItems);
      setRevisionConflict(false);
      setCorrectionReason("");
      setShowCorrection(false);
      setComment(data.feedback.participantComment ?? "");
      return;
    }
    if (loadedRevision.current !== incomingRevision) {
      if (dirtyDraft.current) {
        setRevisionConflict(true);
      } else {
        loadedRevision.current = incomingRevision;
        setItems(nextItems);
        setRevisionConflict(false);
      }
    }
  }, [data]);
  if (query.isLoading) return <LoadingCards count={5} />;
  if (query.error || !data)
    return (
      <QueryFailure
        error={query.error}
        onRetry={() => void query.refetch()}
        message="Não foi possível carregar esta avaliação."
      />
    );
  const status = data.feedback.status;
  const editable = data.canEdit && status === "draft";
  const canCorrect =
    data.canEdit &&
    ["completed", "debriefed", "released", "acknowledged"].includes(status);
  const complete =
    items.length === data.cycle.competencySnapshot.length &&
    items.every(
      item =>
        item.score !== null &&
        item.evidence.trim() &&
        item.effect.trim() &&
        item.advice.trim()
    );
  const updateItem = (competencyId: string, patch: Partial<FeedbackItem>) => {
    dirtyDraft.current = true;
    setRevisionConflict(false);
    setItems(current =>
      current.map(item =>
        item.competencyId === competencyId ? { ...item, ...patch } : item
      )
    );
  };
  const save = async () => {
    if (revisionConflict) {
      toast.error(
        "A avaliação mudou em outra sessão. Recarregue antes de salvar para não substituir alterações."
      );
      return;
    }
    try {
      await saveDraft.mutateAsync({
        id: feedbackId,
        revision: data.feedback.revision,
        items,
      });
      dirtyDraft.current = false;
      setRevisionConflict(false);
      toast.success("Rascunho salvo.");
      await query.refetch();
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Não foi possível salvar o rascunho. A revisão pode ter mudado."
        )
      );
    }
  };
  const changeStatus = async (
    nextStatus:
      | "completed"
      | "debriefed"
      | "released"
      | "acknowledged"
      | "closed"
  ) => {
    if (dirtyDraft.current) {
      toast.error(
        "Há alterações não salvas. Salve o rascunho antes de avançar para evitar conflito."
      );
      return;
    }
    if (nextStatus === "completed" && !complete) {
      toast.error(
        "Preencha nota, evidência, efeito e conselho para todas as competências."
      );
      return;
    }
    if (nextStatus === "released" && !releaseConfirm) {
      toast.error("Confirme a liberação explícita para o colaborador.");
      return;
    }
    if (nextStatus === "acknowledged" && !ackConfirm) {
      toast.error("Leia e confirme a declaração de ciência.");
      return;
    }
    try {
      await transition.mutateAsync({
        id: feedbackId,
        revision: data.feedback.revision,
        status: nextStatus,
      });
      toast.success(`Etapa atualizada: ${FEEDBACK_STATUS_LABELS[nextStatus]}.`);
      setReleaseConfirm(false);
      setAckConfirm(false);
      await query.refetch();
    } catch (error) {
      setRevisionConflict(true);
      toast.error(
        errorMessage(
          error,
          "Não foi possível avançar a etapa. Recarregue somente após conferir as alterações locais."
        )
      );
    }
  };
  const submitCorrection = async () => {
    if (!correctionReason.trim() || !complete) {
      toast.error(
        "Informe o motivo e preencha todos os itens antes de corrigir."
      );
      return;
    }
    try {
      await correct.mutateAsync({
        id: feedbackId,
        revision: data.feedback.revision,
        reason: correctionReason.trim(),
        items,
      });
      dirtyDraft.current = false;
      setRevisionConflict(false);
      toast.success(
        "Correção salva. A avaliação voltou para Concluída; registre uma nova devolutiva antes de liberar."
      );
      await query.refetch();
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Não foi possível corrigir a avaliação; a revisão pode ter mudado."
        )
      );
    }
  };
  const submitComment = async () => {
    try {
      await addComment.mutateAsync({ id: feedbackId, comment: comment.trim() });
      toast.success("Comentário registrado.");
      await query.refetch();
    } catch (error) {
      toast.error(
        errorMessage(error, "Não foi possível registrar o comentário.")
      );
    }
  };
  const next = FEEDBACK_TRANSITIONS[status][0];
  const participantView = data.isParticipant;
  const participantAwaitingRelease =
    participantView && !isFeedbackVisibleToParticipant(status);
  const visibleItems = participantAwaitingRelease ? [] : items;
  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(`/fluxus/feedback/ciclo/${data.cycle.id}`)}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao ciclo
      </Button>
      <PageHeader
        eyebrow="Feedback de desenvolvimento"
        title={
          participantView
            ? "Sua devolutiva"
            : `Avaliação de ${data.participant.name || "colaborador"}`
        }
        description={FEEDBACK_PURPOSE}
      >
        <StatusBadge status={status} />
      </PageHeader>
      {participantAwaitingRelease ? (
        <Alert className="border-primary/20 bg-primary/5">
          <MessageSquareText className="h-4 w-4" />
          <AlertTitle>Uma nova devolutiva está sendo preparada</AlertTitle>
          <AlertDescription>
            Esta avaliação recebeu uma correção. O conteúdo atualizado só
            aparecerá depois de uma nova conversa e da liberação pelo avaliador.
          </AlertDescription>
        </Alert>
      ) : participantView && status !== "draft" ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Informação protegida</AlertTitle>
          <AlertDescription>
            Você está vendo a versão liberada para sua conta. Rascunhos e
            versões anteriores não são expostos.
          </AlertDescription>
        </Alert>
      ) : null}
      {revisionConflict ? (
        <Alert variant="destructive">
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>A avaliação mudou enquanto você editava</AlertTitle>
          <AlertDescription>
            Suas alterações locais foram preservadas. Salve ou recarregue
            somente depois de revisar a outra versão; nada foi substituído
            silenciosamente.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoMetric label="Ciclo" value={data.cycle.name} />
        <InfoMetric
          label="Período"
          value={`${formatDate(data.cycle.startsOn)} – ${formatDate(data.cycle.endsOn)}`}
        />
        <InfoMetric
          label="Média atual"
          value={
            participantAwaitingRelease || data.calculation.average === null
              ? "—"
              : `${data.calculation.average.toFixed(2)} / 6`
          }
        />
      </div>
      {canCorrect && !participantView ? (
        <CorrectionPanel
          show={showCorrection}
          setShow={setShowCorrection}
          reason={correctionReason}
          setReason={setCorrectionReason}
          onSubmit={() => void submitCorrection()}
          pending={correct.isPending}
        />
      ) : null}
      <Tabs
        defaultValue={participantView ? "preview" : "editor"}
        className="space-y-5"
      >
        <TabsList>
          <TabsTrigger value="editor" disabled={participantView}>
            Editor EEC
          </TabsTrigger>
          <TabsTrigger value="preview">Preview do colaborador</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="space-y-5">
          {editable ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <p className="font-medium">Rascunho da avaliação</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Salve explicitamente para continuar depois. A conclusão só
                  aceita os quatro campos EEC de todas as competências.
                </p>
              </div>
              <Button
                onClick={() => void save()}
                disabled={saveDraft.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />{" "}
                {saveDraft.isPending ? "Salvando…" : "Salvar rascunho"}
              </Button>
            </div>
          ) : (
            <Alert>
              <LockKeyhole className="h-4 w-4" />
              <AlertTitle>
                {participantView
                  ? "Notas disponíveis após liberação"
                  : "Editor bloqueado nesta etapa"}
              </AlertTitle>
              <AlertDescription>
                {participantView
                  ? "As notas abaixo refletem a versão liberada pelo avaliador."
                  : "Use a correção com motivo para alterar uma avaliação após a conclusão; não há sobrescrita silenciosa."}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-5">
            {data.cycle.competencySnapshot.map(competency => (
              <EvaluationItemCard
                key={competency.id}
                competency={competency}
                item={
                  visibleItems.find(
                    current => current.competencyId === competency.id
                  ) ?? emptyItem(competency.id)
                }
                editable={editable || (showCorrection && canCorrect)}
                onChange={patch => updateItem(competency.id, patch)}
              />
            ))}
          </div>
          {data.canTransition && next ? (
            <TransitionActions
              status={status}
              next={next}
              complete={complete}
              releaseConfirm={releaseConfirm}
              setReleaseConfirm={setReleaseConfirm}
              ackConfirm={ackConfirm}
              setAckConfirm={setAckConfirm}
              onTransition={nextStatus => void changeStatus(nextStatus)}
              pending={transition.isPending}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="preview" className="space-y-5">
          <CollaboratorPreview
            data={data}
            items={visibleItems}
            restricted={participantAwaitingRelease}
          />
          <ParticipantComment
            data={data}
            comment={comment}
            setComment={setComment}
            onSubmit={() => void submitComment()}
            pending={addComment.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
function mergeEvaluationItems(data: FeedbackDetail) {
  return data.cycle.competencySnapshot.map(
    competency =>
      data.feedback.items.find(item => item.competencyId === competency.id) ??
      emptyItem(competency.id)
  );
}
function emptyItem(competencyId: string): FeedbackItem {
  return {
    competencyId,
    score: null,
    evidence: "",
    effect: "",
    advice: "",
    notes: "",
  };
}
function CorrectionPanel({
  show,
  setShow,
  reason,
  setReason,
  onSubmit,
  pending,
}: {
  show: boolean;
  setShow: (value: boolean) => void;
  reason: string;
  setReason: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Correção pós-conclusão</CardTitle>
            <CardDescription>
              Uma correção preserva a revisão anterior e volta a avaliação para
              Concluída. Registre uma nova devolutiva antes de liberar; o
              colaborador não vê os novos itens antes da liberação.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShow(!show)}>
            {show ? "Fechar" : "Corrigir"}
          </Button>
        </div>
      </CardHeader>
      {show ? (
        <CardContent className="space-y-3">
          <Label htmlFor="correction-reason">Motivo obrigatório</Label>
          <Textarea
            id="correction-reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Explique o que precisa ser corrigido e por quê."
            maxLength={5000}
          />
          <Button
            onClick={onSubmit}
            disabled={pending || !reason.trim()}
            className="gap-2"
          >
            <FilePenLine className="h-4 w-4" />{" "}
            {pending ? "Salvando correção…" : "Salvar correção"}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
function EvaluationItemCard({
  competency,
  item,
  editable,
  onChange,
}: {
  competency: FeedbackCompetency;
  item: FeedbackItem;
  editable: boolean;
  onChange: (patch: Partial<FeedbackItem>) => void;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">{competency.name}</CardTitle>
            <CardDescription>{competency.definition}</CardDescription>
          </div>
          <div className="min-w-44">
            <Label className="text-xs">Nota de 0 a 6</Label>
            <Select
              disabled={!editable}
              value={item.score === null ? "null" : String(item.score)}
              onValueChange={value =>
                onChange({ score: value === "null" ? null : Number(value) })
              }
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Sem nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Sem nota</SelectItem>
                {[0, 1, 2, 3, 4, 5, 6].map(score => (
                  <SelectItem key={score} value={String(score)}>
                    {score} · {scoreDescription(score)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {item.score !== null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {scoreLabel(item.score)}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <GuidedTextarea
          id={`${competency.id}-evidence`}
          label="Evidência observável"
          guidance={EEC_GUIDANCE.evidence}
          value={item.evidence}
          disabled={!editable}
          onChange={value => onChange({ evidence: value })}
        />
        <GuidedTextarea
          id={`${competency.id}-effect`}
          label="Efeito verificável"
          guidance={EEC_GUIDANCE.effect}
          value={item.effect}
          disabled={!editable}
          onChange={value => onChange({ effect: value })}
        />
        <GuidedTextarea
          id={`${competency.id}-advice`}
          label="Conselho e apoio"
          guidance={EEC_GUIDANCE.advice}
          value={item.advice}
          disabled={!editable}
          onChange={value => onChange({ advice: value })}
        />
        <div className="md:col-span-3">
          <Label htmlFor={`${competency.id}-notes`}>
            Anotações adicionais (opcional)
          </Label>
          <Textarea
            id={`${competency.id}-notes`}
            className="mt-2"
            value={item.notes}
            disabled={!editable}
            onChange={event => onChange({ notes: event.target.value })}
            maxLength={5000}
          />
        </div>
      </CardContent>
    </Card>
  );
}
function GuidedTextarea({
  id,
  label,
  guidance,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  guidance: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {guidance}
      </p>
      <Textarea
        id={id}
        className="mt-2 min-h-28"
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        maxLength={5000}
      />
    </div>
  );
}
function TransitionActions({
  status,
  next,
  complete,
  releaseConfirm,
  setReleaseConfirm,
  ackConfirm,
  setAckConfirm,
  onTransition,
  pending,
}: {
  status: FeedbackStatus;
  next: FeedbackStatus;
  complete: boolean;
  releaseConfirm: boolean;
  setReleaseConfirm: (value: boolean) => void;
  ackConfirm: boolean;
  setAckConfirm: (value: boolean) => void;
  onTransition: (
    status: "completed" | "debriefed" | "released" | "acknowledged" | "closed"
  ) => void;
  pending: boolean;
}) {
  const needsRelease = next === "released";
  const needsAck = next === "acknowledged";
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              Próxima etapa: {FEEDBACK_STATUS_LABELS[next]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Etapa atual: {FEEDBACK_STATUS_LABELS[status]}. Cada transição
              registra a revisão no backend.
            </p>
          </div>
          <Button
            onClick={() =>
              onTransition(
                next as
                  | "completed"
                  | "debriefed"
                  | "released"
                  | "acknowledged"
                  | "closed"
              )
            }
            disabled={
              pending ||
              (next === "completed" && !complete) ||
              (needsRelease && !releaseConfirm) ||
              (needsAck && !ackConfirm)
            }
            className="gap-2"
          >
            {pending ? "Avançando…" : "Avançar etapa"}{" "}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {next === "completed" && !complete ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Ainda faltam campos obrigatórios para concluir.
          </p>
        ) : null}
        {needsRelease ? (
          <label className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-background/60 p-3">
            <Checkbox
              checked={releaseConfirm}
              onCheckedChange={value => setReleaseConfirm(value === true)}
            />
            <span className="text-sm leading-relaxed">
              Confirmo que a devolutiva foi realizada e autorizo a liberação
              desta versão ao colaborador.
            </span>
          </label>
        ) : null}
        {needsAck ? (
          <label className="flex items-start gap-3 rounded-xl border border-primary/20 bg-background/60 p-3">
            <Checkbox
              checked={ackConfirm}
              onCheckedChange={value => setAckConfirm(value === true)}
            />
            <span className="text-sm leading-relaxed">
              Li a declaração de ciência:{" "}
              <strong>{FEEDBACK_ACKNOWLEDGEMENT}</strong>
            </span>
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
function CollaboratorPreview({
  data,
  items,
  restricted = false,
}: {
  data: FeedbackDetail;
  items: FeedbackItem[];
  restricted?: boolean;
}) {
  if (restricted) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl">
            A devolutiva está sendo revisada
          </CardTitle>
          <CardDescription>
            O avaliador registrará uma nova conversa antes de liberar novamente
            as notas e os quatro campos EEC.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">
              Uma devolutiva para apoiar seu desenvolvimento
            </CardTitle>
            <CardDescription>
              {data.cycle.name} · {formatDate(data.cycle.startsOn)} a{" "}
              {formatDate(data.cycle.endsOn)}
            </CardDescription>
          </div>
        </div>
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
          {FEEDBACK_PURPOSE}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.cycle.competencySnapshot.map(competency => {
          const item =
            items.find(current => current.competencyId === competency.id) ??
            emptyItem(competency.id);
          const classification =
            item.score === null ? null : classifyFeedback(item.score);
          return (
            <div
              key={competency.id}
              className="rounded-2xl border border-border/60 p-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">
                    {classification
                      ? FEEDBACK_COLLABORATOR_LABELS[classification]
                      : "Competência em avaliação"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {competency.name} · {competency.definition}
                  </p>
                </div>
                <Badge variant="secondary">{scoreLabel(item.score)}</Badge>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <PreviewBlock
                  title="O que foi observado"
                  value={item.evidence}
                />
                <PreviewBlock title="Qual foi o efeito" value={item.effect} />
                <PreviewBlock
                  title="Próximo passo e apoio"
                  value={item.advice}
                />
              </div>
              {item.notes ? (
                <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
                  <strong>Anotação adicional:</strong> {item.notes}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
        {value || "Ainda não informado."}
      </p>
    </div>
  );
}

function ParticipantComment({
  data,
  comment,
  setComment,
  onSubmit,
  pending,
}: {
  data: FeedbackDetail;
  comment: string;
  setComment: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  if (
    !data.isParticipant ||
    !isFeedbackVisibleToParticipant(data.feedback.status)
  )
    return null;
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Seu comentário (opcional)</CardTitle>
        <CardDescription>
          Compartilhe uma observação sobre a devolutiva sem alterar as notas
          registradas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={comment}
          onChange={event => setComment(event.target.value)}
          maxLength={5000}
          placeholder="O que você gostaria de registrar?"
        />
        <Button onClick={onSubmit} disabled={pending} className="gap-2">
          <MessageSquareText className="h-4 w-4" />{" "}
          {pending ? "Registrando…" : "Registrar comentário"}
        </Button>
      </CardContent>
    </Card>
  );
}
