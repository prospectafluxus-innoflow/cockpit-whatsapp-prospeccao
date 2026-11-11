import { Button } from "@/components/ui/button";
import {
  feedbackApi,
  type FeedbackDetail,
  type FeedbackItem,
} from "@/lib/feedbackApi";
import {
  FEEDBACK_ACKNOWLEDGEMENT,
  FEEDBACK_COLLABORATOR_LABELS,
  FEEDBACK_PURPOSE,
  FEEDBACK_STATUS_LABELS,
  calculateFeedback,
  classifyFeedback,
  isFeedbackVisibleToParticipant,
} from "@shared/feedback";
import { ArrowLeft, Printer, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { formatDate, LoadingCards, QueryFailure } from "./FeedbackShared";

export function FeedbackReportDocument({
  data,
  items,
}: {
  data: FeedbackDetail;
  items?: FeedbackItem[];
}) {
  if (
    data.isParticipant &&
    !isFeedbackVisibleToParticipant(data.feedback.status)
  ) {
    return (
      <article className="feedback-report-document">
        <FeedbackReportBlocked />
      </article>
    );
  }

  const reportItems = items ?? data.feedback.items;
  const calculation = calculateFeedback(
    reportItems,
    data.cycle.competencySnapshot.length
  );
  const status = data.feedback.status;
  const participantName = data.participant.name || "Não informado";
  const evaluatorName = data.evaluator.name || "Não informado";

  return (
    <article className="feedback-report-document">
      <header className="feedback-report-header">
        <p className="feedback-report-brand">FLUXUS PERSONA · InnoFlow</p>
        <h1>Relatório de Feedback EEC</h1>
        <p className="feedback-report-purpose">{FEEDBACK_PURPOSE}</p>
        <p className="feedback-report-status-note" role="status">
          {reportStatusNote(status)}
        </p>

        <dl className="feedback-report-metadata">
          <MetadataItem label="Colaborador" value={participantName} />
          <MetadataItem
            label="Cargo"
            value={data.participant.jobTitle || "Não informado"}
          />
          <MetadataItem label="Avaliador" value={evaluatorName} />
          <MetadataItem label="Ciclo" value={data.cycle.name} />
          <MetadataItem
            label="Período"
            value={`${formatDate(data.cycle.startsOn)} – ${formatDate(data.cycle.endsOn)}`}
          />
          <MetadataItem label="Etapa" value={FEEDBACK_STATUS_LABELS[status]} />
          <MetadataItem
            label="Revisão"
            value={String(data.feedback.revision)}
          />
          <MetadataItem label="Método" value={data.cycle.methodVersion} />
        </dl>
      </header>

      <section
        className="feedback-report-summary"
        aria-labelledby="feedback-report-summary-title"
      >
        <h2 id="feedback-report-summary-title">Resumo</h2>
        <div className="feedback-report-summary-grid">
          <ReportMetric
            label="Pontuação obtida"
            value={`${calculation.obtained} pontos`}
            detail={`${calculation.scoredCount} de ${calculation.competencyCount} competências com nota`}
          />
          <ReportMetric
            label="Referência esperada"
            value={`${calculation.expected} pontos`}
            detail={`5 por competência · ${calculation.competencyCount} competências`}
          />
          <ReportMetric
            label="Pontuação máxima"
            value={`${calculation.maximum} pontos`}
            detail={`6 por competência · ${calculation.competencyCount} competências`}
          />
          <ReportMetric
            label="Média"
            value={formatAverage(calculation.average)}
            detail="Média somente das competências com nota"
          />
        </div>
        <p className="feedback-report-summary-note">
          Escala: notas de 0 a 6. A referência é 5 por competência e o máximo é
          6 por competência. O cálculo é{" "}
          {calculation.complete ? "completo" : "parcial/incompleto"};
          competência sem nota não é considerada zero e não entra na média.
        </p>
      </section>

      <section
        className="feedback-report-table-section"
        aria-labelledby="feedback-report-table-title"
      >
        <h2 id="feedback-report-table-title">Leitura por competência</h2>
        <table className="feedback-report-table">
          <caption className="sr-only">
            Competência, nota e leitura do feedback
          </caption>
          <thead>
            <tr>
              <th scope="col">Competência</th>
              <th scope="col">Nota</th>
              <th scope="col">Leitura</th>
            </tr>
          </thead>
          <tbody>
            {data.cycle.competencySnapshot.map(competency => {
              const item = findItem(reportItems, competency.id);
              const classification =
                item.score === null ? null : classifyFeedback(item.score);
              return (
                <tr key={competency.id}>
                  <th scope="row">{competency.name}</th>
                  <td>{formatScore(item.score)}</td>
                  <td>
                    {classification
                      ? FEEDBACK_COLLABORATOR_LABELS[classification]
                      : "Sem nota"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section
        className="feedback-report-details"
        aria-labelledby="feedback-report-details-title"
      >
        <h2 id="feedback-report-details-title">EEC detalhado</h2>
        {data.cycle.competencySnapshot.map(competency => {
          const item = findItem(reportItems, competency.id);
          return (
            <section className="feedback-report-competency" key={competency.id}>
              <header>
                <h3>{competency.name}</h3>
                <p className="feedback-report-competency-definition">
                  {competency.definition}
                </p>
              </header>
              <div className="feedback-report-fields">
                <ReportField
                  label="Evidência observável"
                  value={item.evidence}
                />
                <ReportField label="Efeito verificável" value={item.effect} />
                <ReportField label="Conselho e apoio" value={item.advice} />
                <ReportField label="Anotações" value={item.notes} />
              </div>
            </section>
          );
        })}
      </section>

      {data.feedback.participantComment ? (
        <section
          className="feedback-report-field feedback-report-participant-comment"
          aria-labelledby="feedback-report-comment-title"
        >
          <h2 id="feedback-report-comment-title">Comentário do colaborador</h2>
          <p className="feedback-report-field-value whitespace-pre-wrap break-words">
            {data.feedback.participantComment}
          </p>
        </section>
      ) : null}

      <footer className="feedback-report-footer">
        <p>{FEEDBACK_PURPOSE}</p>
        <p>
          <strong>Declaração de ciência:</strong> {FEEDBACK_ACKNOWLEDGEMENT}
        </p>
        <p>
          <strong>Confidencialidade:</strong> este documento é confidencial e
          deve ser compartilhado somente com pessoas autorizadas.
        </p>
        <p>
          Registro informativo da revisão {data.feedback.revision}, pelo método{" "}
          {data.cycle.methodVersion}. A declaração acima não presume ciência
          registrada.
        </p>
      </footer>
    </article>
  );
}

export function FeedbackReportPage({ params }: { params: { id: string } }) {
  const feedbackId = Number(params.id);
  const validId = Number.isInteger(feedbackId) && feedbackId > 0;
  const query = feedbackApi.get.useQuery(
    { id: feedbackId },
    { retry: false, enabled: validId }
  );
  const data = query.data;
  const restricted = Boolean(
    data?.isParticipant && !isFeedbackVisibleToParticipant(data.feedback.status)
  );
  const [, navigate] = useLocation();
  const printReady = Boolean(
    validId &&
      data &&
      !query.isLoading &&
      !query.isFetching &&
      !query.error &&
      !restricted
  );

  useEffect(() => {
    if (
      !validId ||
      !data ||
      query.isLoading ||
      query.error ||
      restricted ||
      typeof document === "undefined"
    )
      return;

    const body = document.body;
    const previousDatasetValue = body.dataset.feedbackReport;
    const previousTitle = document.title;
    body.dataset.feedbackReport = "true";
    document.title = buildPdfTitle(data);

    return () => {
      if (previousDatasetValue === undefined) {
        delete body.dataset.feedbackReport;
      } else {
        body.dataset.feedbackReport = previousDatasetValue;
      }
      document.title = previousTitle;
    };
  }, [data, query.error, query.isLoading, restricted, validId]);

  const goBack = () =>
    navigate(`/fluxus/feedback/avaliacao/${data?.feedback.id ?? feedbackId}`);
  const print = () => {
    if (printReady && typeof window !== "undefined") window.print();
  };

  if (query.isLoading) return <LoadingCards count={5} />;
  if (query.error || !data) {
    return (
      <QueryFailure
        error={query.error}
        onRetry={() => void query.refetch()}
        message="Não foi possível carregar este relatório."
      />
    );
  }

  return (
    <div className="feedback-report-page">
      <div className="feedback-report-toolbar print:hidden">
        <Button variant="ghost" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar à avaliação
        </Button>
        {!restricted ? (
          <Button
            variant="outline"
            onClick={print}
            disabled={!printReady}
            className="gap-2"
          >
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        ) : null}
      </div>
      {restricted ? (
        <FeedbackReportBlocked />
      ) : (
        <FeedbackReportDocument data={data} />
      )}
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <dl className="feedback-report-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <dd className="feedback-report-metric-detail">{detail}</dd>
    </dl>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div className="feedback-report-field">
      <h4>{label}</h4>
      <p className="feedback-report-field-value whitespace-pre-wrap break-words">
        {value.trim() || "Não informado (opcional)"}
      </p>
    </div>
  );
}

function FeedbackReportBlocked() {
  return (
    <section className="feedback-report-blocked" role="alert">
      <ShieldAlert aria-hidden="true" />
      <h1>Relatório indisponível</h1>
      <p>
        Esta devolutiva ainda não foi liberada para visualização pelo
        colaborador.
      </p>
    </section>
  );
}

function findItem(items: readonly FeedbackItem[], competencyId: string) {
  return (
    items.find(item => item.competencyId === competencyId) ?? {
      competencyId,
      score: null,
      evidence: "",
      effect: "",
      advice: "",
      notes: "",
    }
  );
}

function formatScore(score: number | null) {
  return score === null ? "Sem nota" : `${score}/6`;
}

function formatAverage(average: number | null) {
  return average === null
    ? "Sem nota"
    : `${average.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} / 6`;
}

function reportStatusNote(status: FeedbackDetail["feedback"]["status"]) {
  if (status === "draft") return "Rascunho — não liberado";
  if (status === "completed" || status === "debriefed") {
    return "Prévia para devolutiva — ainda não liberado ao colaborador";
  }
  return "Relatório disponível para visualização autorizada";
}

function buildPdfTitle(data: FeedbackDetail) {
  const participant = data.participant.name?.trim() || "colaborador";
  const cycle = data.cycle.name?.trim() || "ciclo";
  return `Relatório de Feedback EEC — ${participant} — ${cycle}`;
}
