import {
  EXECUTIVE_INTERPRETATION_NOTICE,
  type ExecutiveDocumentData,
  type ExecutiveNotes,
  type ExecutivePerson,
} from "@shared/fluxusExecutive";
import { buildExecutiveIndividual } from "@shared/fluxusExecutiveAnalysis";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
} from "@shared/fluxus";
import {
  FLUXUS_MOMENT_DIMENSIONS,
  FLUXUS_MOMENT_META,
  FLUXUS_SUSTAINABILITY_INDICATORS,
  FLUXUS_SUSTAINABILITY_META,
  type FluxusMomentDimension,
  type FluxusSustainabilityIndicator,
  type FluxusV2Result,
} from "@shared/fluxusV2";
import { FluxusPersonaLogo } from "./FluxusBrand";
import { FluxusExecutiveComplementary } from "./FluxusExecutiveComplementary";
import "./FluxusExecutiveDocument.model.css";

export type FluxusExecutiveDocumentProps = {
  data: ExecutiveDocumentData;
  notes: ExecutiveNotes;
  focusIndividual?: boolean;
};

const PROFILE_COLOR = "#12324f";
const FUNCTION_COLOR = "#f28c1b";
const ORANGE_COLOR = "#f28c1b";
const GRID_COLOR = "#cbd5e1";
const DARK_COLOR = "#12324f";

const formatScore = (value: number | null | undefined) =>
  Number.isFinite(value) ? (value as number).toFixed(1).replace(".", ",") : "—";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};

const formatDateList = (people: ExecutivePerson[]) => {
  const dates = Array.from(
    new Set(people.map(person => formatDate(person.completedAt)))
  );
  return dates.length <= 3
    ? dates.join(" · ")
    : `${dates.slice(0, 3).join(" · ")} · outras datas`;
};

const formatCycle = (person: ExecutivePerson) =>
  person.cycleLabel?.trim() || `Ciclo ${person.cycleNumber}`;

const textOrFallback = (value: string | null | undefined, fallback: string) =>
  value?.trim() || fallback;

const hasText = (value: string | null | undefined): value is string =>
  Boolean(value?.trim());

const signalText = (score: number) => {
  if (score >= 4.5) return "Favorável";
  if (score <= 3) return "Priorizar conversa";
  return "Acompanhar";
};

const signalClass = (score: number) => {
  if (score >= 4.5)
    return "persona-executive-signal persona-executive-signal--positive";
  if (score <= 3)
    return "persona-executive-signal persona-executive-signal--attention";
  return "persona-executive-signal persona-executive-signal--watch";
};

const indicatorDirection = (direction: "protective" | "risk") =>
  direction === "protective" ? "Fator protetivo" : "Indicador de risco";

function DocumentFooter({
  people,
  generatedAt,
}: {
  people: ExecutivePerson[];
  generatedAt: string;
}) {
  return (
    <footer className="persona-executive-footer fluxus-model-footer">
      <p>Confidencial · uso para desenvolvimento e conversas responsáveis.</p>
      <p>
        Fonte: respostas autorrelatadas concluídas · datas das respostas:{" "}
        {formatDateList(people)} · método: instrumento e fórmula 2.0.0-beta.2.
      </p>
      <p>
        Documento gerado em {formatDate(generatedAt)}. Sinais não são
        diagnóstico, ranking ou decisão isolada.
      </p>
    </footer>
  );
}

function Cover({ data, notes }: FluxusExecutiveDocumentProps) {
  const isTeam = data.mode === "team";
  const title = textOrFallback(
    notes.title,
    isTeam
      ? `Visão executiva · ${data.company.name}`
      : "Visão executiva · Perfil comportamental"
  );
  const audience = textOrFallback(
    notes.audience,
    isTeam
      ? "Gestão, RH e consultoria autorizada"
      : "Gestor(a), RH e participante autorizado(a)"
  );
  const author = textOrFallback(notes.author, "Fluxus Persona");
  const cycles = Array.from(new Set(data.people.map(formatCycle))).join(" · ");

  return (
    <section className="persona-executive-sheet persona-executive-cover">
      <div className="persona-executive-cover-brand">
        <FluxusPersonaLogo className="persona-executive-logo" />
        <span className="persona-executive-eyebrow">
          Visão executiva · Perfil comportamental
        </span>
      </div>
      <div className="persona-executive-cover-copy">
        <p className="persona-executive-kicker">
          {isTeam ? "Relatório de equipe" : "Ficha individual"}
        </p>
        <h1>{title}</h1>
        <p className="persona-executive-lede">
          Uma leitura exploratória de perfil, função percebida, momento atual e
          sustentabilidade do trabalho. Não é uma devolutiva EEC nem substitui
          uma conversa contextualizada.
        </p>
      </div>
      <dl className="persona-executive-cover-meta">
        <div>
          <dt>Empresa</dt>
          <dd>{data.company.name}</dd>
        </div>
        <div>
          <dt>Público</dt>
          <dd>{audience}</dd>
        </div>
        <div>
          <dt>Autoria</dt>
          <dd>{author}</dd>
        </div>
        <div>
          <dt>Ciclos avaliados</dt>
          <dd>{cycles || "Não informado"}</dd>
        </div>
      </dl>
      <p className="persona-executive-notice">
        {EXECUTIVE_INTERPRETATION_NOTICE}
      </p>
    </section>
  );
}

function HowToRead() {
  const blocks = [
    [
      "1",
      "Perfil comportamental",
      "Modo habitual autorrelatado, separado do momento atual.",
    ],
    [
      "2",
      "Função percebida",
      "Exigência que a própria pessoa percebe no trabalho; não é descrição oficial do cargo.",
    ],
    [
      "3",
      "Momento atual",
      "Condições relatadas neste ciclo: engajamento, carga, autonomia e outras dimensões de contexto.",
    ],
    [
      "4",
      "Sustentabilidade",
      "Índice e indicadores para orientar escuta e apoio, nunca diagnóstico ou julgamento de desempenho.",
    ],
  ];
  return (
    <section
      className="persona-executive-sheet persona-executive-section persona-executive-how-to-read"
      aria-labelledby="persona-executive-how-to-read-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Como ler</p>
        <h2 id="persona-executive-how-to-read-title">
          Quatro blocos que não devem ser confundidos
        </h2>
      </div>
      <div className="persona-executive-four-blocks">
        {blocks.map(([number, title, text]) => (
          <article className="persona-executive-four-block" key={number}>
            <span className="persona-executive-four-block-number">
              {number}
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <p className="persona-executive-method-note">
        Método: Fluxus Persona Beta 2 · instrumento e fórmula 2.0.0-beta.2 ·
        escala de 1 a 7. Os resultados são fotografias autorrelatadas do ciclo e
        devem ser confirmados com exemplos reais.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="persona-executive-metric">
      <span className="persona-executive-metric-label">{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function SignalDistribution({ counts }: { counts: Record<string, number> }) {
  const items = ["Sustentável", "Ponto de atenção", "Conversa prioritária"];
  return (
    <div
      className="persona-executive-signal-distribution"
      aria-label="Distribuição dos sinais"
    >
      {items.map(signal => (
        <div
          className="persona-executive-signal-distribution-item"
          key={signal}
        >
          <span
            className={signalClass(
              signal === "Sustentável"
                ? 5
                : signal === "Conversa prioritária"
                  ? 2
                  : 4
            )}
          >
            {signal}
          </span>
          <strong>{counts[signal] ?? 0}</strong>
          <small>pessoas</small>
        </div>
      ))}
    </div>
  );
}

function TeamPortrait({ data }: { data: ExecutiveDocumentData }) {
  const aggregate = data.aggregate;
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-portrait-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Retrato da equipe</p>
        <h2 id="persona-executive-portrait-title">
          O que aparece neste recorte
        </h2>
      </div>
      {aggregate ? (
        <>
          <div className="persona-executive-metrics-grid">
            <Metric
              label="Avaliações"
              value={`${aggregate.count}`}
              detail="Beta 2 concluídas"
            />
            <Metric
              label="Índice Fluxus médio"
              value={`${formatScore(aggregate.indexMean)} / 7`}
            />
            <Metric
              label="Engajamento médio"
              value={`${formatScore(aggregate.engagementMean)} / 7`}
            />
            <Metric
              label="Mínimo de respondentes"
              value={`${data.minimumRespondents}`}
              detail="governança do recorte"
            />
          </div>
          <div className="persona-executive-panel">
            <h3>Distribuição do sinal do ciclo</h3>
            <SignalDistribution counts={aggregate.signalCounts} />
          </div>
          <p className="persona-executive-reading">{aggregate.summary}</p>
        </>
      ) : (
        <div className="persona-executive-privacy-callout">
          <strong>Médias de equipe protegidas</strong>
          <p>
            {data.groupPrivacyNote ||
              `São necessárias pelo menos ${data.minimumRespondents} avaliações comparáveis para exibir médias.`}
          </p>
        </div>
      )}
    </section>
  );
}

function DepartmentComparison({ data }: { data: ExecutiveDocumentData }) {
  if (!data.departments.length) {
    return (
      <section
        className="persona-executive-sheet persona-executive-section"
        aria-labelledby="persona-executive-departments-title"
      >
        <div className="persona-executive-section-heading">
          <p className="persona-executive-kicker">Recortes válidos</p>
          <h2 id="persona-executive-departments-title">
            Comparação por departamento
          </h2>
        </div>
        <p className="persona-executive-privacy-callout">
          {data.groupPrivacyNote ||
            "Nenhum recorte departamental liberado para este conjunto."}
        </p>
      </section>
    );
  }
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-departments-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Recortes válidos</p>
        <h2 id="persona-executive-departments-title">
          Comparação por departamento
        </h2>
        <p>
          Exibida somente quando o backend confirma o mínimo de respondentes do
          grupo e do complemento.
        </p>
      </div>
      <div className="persona-executive-department-list">
        {data.departments.map(department => (
          <article
            className="persona-executive-department-card"
            key={department.label}
          >
            <div className="persona-executive-card-heading">
              <h3>{department.label}</h3>
              <span>{department.aggregate.count} avaliações</span>
            </div>
            <div className="persona-executive-bar-row">
              <span>Índice Fluxus médio</span>
              <div className="persona-executive-bar-track" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.max(0, Math.min(100, (department.aggregate.indexMean / 7) * 100))}%`,
                  }}
                />
              </div>
              <strong>{formatScore(department.aggregate.indexMean)} / 7</strong>
            </div>
            <p>{department.aggregate.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProfileFunctionMap({
  people,
  aggregate,
}: {
  people: ExecutivePerson[];
  aggregate: NonNullable<ExecutiveDocumentData["aggregate"]>;
}) {
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-map-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Mapa de perfis</p>
        <h2 id="persona-executive-map-title">Perfil × função percebida</h2>
        <p>
          Valores por eixo na escala de 1 a 7. A leitura indica adaptação
          percebida; não indica aptidão.
        </p>
      </div>
      <div className="persona-executive-table-wrap">
        <table className="persona-executive-table">
          <caption className="sr-only">
            Perfil natural e função percebida de cada pessoa selecionada
          </caption>
          <thead>
            <tr>
              <th scope="col">Pessoa</th>
              <th scope="col">Cargo / depto.</th>
              {FLUXUS_DIMENSIONS.map(dimension => (
                <th scope="col" key={dimension}>
                  {FLUXUS_DIMENSION_META[dimension].label}
                  <br />
                  <small>perfil / função</small>
                </th>
              ))}
              <th scope="col">Predominância</th>
            </tr>
          </thead>
          <tbody>
            {people.map(person => (
              <tr key={person.assessmentId}>
                <th scope="row">
                  {textOrFallback(person.name, "Participante")}
                </th>
                <td>
                  {textOrFallback(person.jobTitle, "Cargo não informado")}
                  <br />
                  <small>
                    {textOrFallback(
                      person.department,
                      "Departamento não informado"
                    )}
                  </small>
                </td>
                {FLUXUS_DIMENSIONS.map(dimension => {
                  const item = person.result.dimensions[dimension];
                  return (
                    <td key={dimension}>
                      {formatScore(item.natural)} /{" "}
                      {formatScore(item.funcaoPercebida)}
                    </td>
                  );
                })}
                <td>
                  {FLUXUS_DIMENSION_META[person.result.predominante].label}
                </td>
              </tr>
            ))}
            <tr className="persona-executive-table-summary">
              <th scope="row">Média do recorte</th>
              <td>—</td>
              {FLUXUS_DIMENSIONS.map(dimension => (
                <td key={dimension}>
                  {formatScore(aggregate.profiles[dimension].natural)} /{" "}
                  {formatScore(aggregate.profiles[dimension].function)}
                </td>
              ))}
              <td>Distribuição abaixo</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="persona-executive-predominance-list">
        {FLUXUS_DIMENSIONS.map(dimension => (
          <span key={dimension}>
            <strong>{FLUXUS_DIMENSION_META[dimension].label}</strong>:{" "}
            {aggregate.predominantCounts[dimension]} pessoa(s)
          </span>
        ))}
      </div>
    </section>
  );
}

function GapMap({ people }: { people: ExecutivePerson[] }) {
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-gap-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Leitura de adaptação</p>
        <h2 id="persona-executive-gap-title">
          Distâncias percebidas por pessoa
        </h2>
        <p>
          Diferenças assinadas mostram a exigência percebida menos o perfil
          natural. Use-as como pergunta, não como conclusão.
        </p>
      </div>
      <div className="persona-executive-gap-grid">
        {people.map(person => (
          <article
            className="persona-executive-gap-card"
            key={person.assessmentId}
          >
            <h3>{textOrFallback(person.name, "Participante")}</h3>
            {FLUXUS_DIMENSIONS.map(dimension => {
              const item = person.result.dimensions[dimension];
              return (
                <div className="persona-executive-gap-row" key={dimension}>
                  <span>{FLUXUS_DIMENSION_META[dimension].label}</span>
                  <strong>
                    {item.demanda > 0 ? "+" : ""}
                    {formatScore(item.demanda)}
                  </strong>
                  <small>
                    perfil {formatScore(item.natural)} · função{" "}
                    {formatScore(item.funcaoPercebida)}
                  </small>
                </div>
              );
            })}
          </article>
        ))}
      </div>
    </section>
  );
}

function MomentAggregate({ data }: { data: ExecutiveDocumentData }) {
  const aggregate = data.aggregate;
  if (!aggregate) return null;
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-moment-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Contexto do ciclo</p>
        <h2 id="persona-executive-moment-title">
          Momento atual e sustentabilidade
        </h2>
        <p>
          As médias abaixo descrevem condições relatadas, sem apagar as
          variações individuais.
        </p>
      </div>
      <div className="persona-executive-table-wrap">
        <table className="persona-executive-table persona-executive-table--moment">
          <caption className="sr-only">
            Médias das sete dimensões do momento atual
          </caption>
          <thead>
            <tr>
              <th scope="col">Dimensão</th>
              <th scope="col">Média / 7</th>
              <th scope="col">Leitura da média</th>
              <th scope="col">Definição</th>
            </tr>
          </thead>
          <tbody>
            {FLUXUS_MOMENT_DIMENSIONS.map(dimension => (
              <tr key={dimension}>
                <th scope="row">{FLUXUS_MOMENT_META[dimension].label}</th>
                <td>{formatScore(aggregate.moment[dimension])}</td>
                <td>
                  <span className={signalClass(aggregate.moment[dimension])}>
                    {signalText(aggregate.moment[dimension])}
                  </span>
                </td>
                <td>{FLUXUS_MOMENT_META[dimension].definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="persona-executive-indicator-grid">
        {FLUXUS_SUSTAINABILITY_INDICATORS.map(indicator => {
          const item = aggregate.indicators[indicator];
          const meta = FLUXUS_SUSTAINABILITY_META[indicator];
          return (
            <article
              className="persona-executive-indicator-card"
              key={indicator}
            >
              <div className="persona-executive-card-heading">
                <h3>{meta.label}</h3>
                <strong>{formatScore(item)} / 7</strong>
              </div>
              <p>
                {indicatorDirection(meta.direction)} ·{" "}
                {meta.direction === "risk"
                  ? "quanto maior, maior atenção"
                  : "quanto maior, mais protetivo"}
                .
              </p>
              <small>{meta.definition}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActionPlan({
  data,
  notes,
}: {
  data: ExecutiveDocumentData;
  notes: ExecutiveNotes;
}) {
  const aggregate = data.aggregate;
  return (
    <section
      className="persona-executive-sheet persona-executive-section"
      aria-labelledby="persona-executive-action-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Próximos passos</p>
        <h2 id="persona-executive-action-title">Plano de ação da equipe</h2>
        <p>
          As ações automáticas vêm das médias e sinais liberados pelo backend;
          responsáveis e prazos devem ser combinados pela equipe.
        </p>
      </div>
      {aggregate ? (
        <p className="persona-executive-reading">
          Base quantitativa: {aggregate.summary}
        </p>
      ) : null}
      <div className="persona-executive-action-list">
        {aggregate?.actions.length ? (
          aggregate.actions.map((action, index) => (
            <article
              className="persona-executive-action-card"
              key={`${action.title}-${index}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{action.title}</h3>
                <p>{action.text}</p>
                <small>Responsável e prazo: combinar na conversa.</small>
              </div>
            </article>
          ))
        ) : (
          <p className="persona-executive-privacy-callout">
            O plano automático fica protegido enquanto as médias da equipe não
            atingem o mínimo de respondentes.
          </p>
        )}
      </div>
      <ConsultantNotes
        entries={[
          { label: "Síntese da consultoria", value: notes.summary },
          { label: "Contexto informado", value: notes.context },
          { label: "Plano de ações da consultoria", value: notes.actions },
        ]}
      />
    </section>
  );
}

type ConsultantNoteEntry = {
  label: string;
  value: string | undefined;
};

function ConsultantNotes({ entries }: { entries: ConsultantNoteEntry[] }) {
  const filledEntries = entries.filter(entry => hasText(entry.value));
  if (!filledEntries.length) return null;
  return (
    <aside className="persona-executive-consultant-notes fluxus-model-notes">
      <h3>Complementos da consultoria (opcionais)</h3>
      {filledEntries.map(entry => (
        <NoteBlock key={entry.label} label={entry.label} value={entry.value} />
      ))}
    </aside>
  );
}

function NoteBlock({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  if (!hasText(value)) return null;
  return (
    <div className="persona-executive-note-block fluxus-model-note-block">
      <strong>{label}</strong>
      <p>{value}</p>
    </div>
  );
}

function ScoreBars({
  result,
  chartId,
}: {
  result: FluxusV2Result;
  chartId: string;
}) {
  const chartWidth = 560;
  const chartHeight = 280;
  const left = 42;
  const top = 22;
  const bottom = 44;
  const plotHeight = chartHeight - top - bottom;
  const groupWidth = (chartWidth - left - 16) / FLUXUS_DIMENSIONS.length;
  const barWidth = 28;
  const y = (score: number) =>
    top + plotHeight - (Math.max(1, Math.min(7, score)) / 7) * plotHeight;
  const height = (score: number) => top + plotHeight - y(score);
  return (
    <div className="persona-executive-chart-block fluxus-model-chart">
      <div
        className="persona-executive-chart-legend"
        aria-label="Legenda do gráfico"
      >
        <span>
          <i style={{ backgroundColor: PROFILE_COLOR }} /> Perfil natural
        </span>
        <span>
          <i style={{ backgroundColor: FUNCTION_COLOR }} /> Função percebida
        </span>
        <span>Escala: 1 a 7</span>
      </div>
      <svg
        className="persona-executive-chart-svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby={`${chartId}-title ${chartId}-desc`}
      >
        <title id={`${chartId}-title`}>
          Perfil natural versus função percebida
        </title>
        <desc id={`${chartId}-desc`}>
          Barras navy mostram o perfil natural e barras laranja mostram a função
          percebida nos quatro eixos, em escala de um a sete.
        </desc>
        {[1, 3, 5, 7].map(value => (
          <g key={value}>
            <line
              x1={left}
              y1={y(value)}
              x2={chartWidth - 12}
              y2={y(value)}
              stroke={GRID_COLOR}
              strokeDasharray="3 4"
            />
            <text
              x={left - 10}
              y={y(value) + 4}
              textAnchor="end"
              fill={DARK_COLOR}
              fontSize="12"
            >
              {value}
            </text>
          </g>
        ))}
        {FLUXUS_DIMENSIONS.map((dimension, index) => {
          const item = result.dimensions[dimension];
          const x = left + index * groupWidth + groupWidth / 2;
          return (
            <g key={dimension}>
              <rect
                x={x - barWidth - 3}
                y={y(item.natural)}
                width={barWidth}
                height={height(item.natural)}
                rx="3"
                fill={PROFILE_COLOR}
              />
              <rect
                x={x + 3}
                y={y(item.funcaoPercebida)}
                width={barWidth}
                height={height(item.funcaoPercebida)}
                rx="3"
                fill={FUNCTION_COLOR}
              />
              <text
                x={x}
                y={chartHeight - 21}
                textAnchor="middle"
                fill={DARK_COLOR}
                fontSize="12"
              >
                {FLUXUS_DIMENSION_META[dimension].shortLabel}
              </text>
              <text
                x={x}
                y={chartHeight - 6}
                textAnchor="middle"
                fill={DARK_COLOR}
                fontSize="11"
              >
                {formatScore(item.natural)} /{" "}
                {formatScore(item.funcaoPercebida)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="persona-executive-chart-data-table">
        {FLUXUS_DIMENSIONS.map(dimension => {
          const item = result.dimensions[dimension];
          return (
            <span key={dimension}>
              <strong>{FLUXUS_DIMENSION_META[dimension].label}</strong>: perfil{" "}
              {formatScore(item.natural)} · função{" "}
              {formatScore(item.funcaoPercebida)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const momentBarLabel = (dimension: FluxusMomentDimension) => {
  const labels: Record<FluxusMomentDimension, string> = {
    engajamento: "Engajamento",
    cargaSustentavel: "Carga sustentável",
    autonomia: "Autonomia",
    clareza: "Clareza de papel",
    apoioReconhecimento: "Apoio",
    relacoesSeguranca: "Relações",
    desenvolvimento: "Desenvolvimento",
  };
  return labels[dimension];
};

function IndividualMoment({ result }: { result: FluxusV2Result }) {
  return (
    <div
      className="persona-executive-moment-grid fluxus-model-moment-bars"
      role="list"
      aria-label="Sete dimensões do momento atual da pessoa"
    >
      {FLUXUS_MOMENT_DIMENSIONS.map(dimension => {
        const item = result.momento[dimension];
        const signalLabel =
          item.signal === "favoravel"
            ? "Favorável"
            : item.signal === "acompanhar"
              ? "Acompanhar"
              : "Priorizar conversa";
        const tone =
          item.signal === "favoravel"
            ? "fluxus-model-moment-row--good"
            : item.signal === "acompanhar"
              ? "fluxus-model-moment-row--watch"
              : "fluxus-model-moment-row--risk";
        return (
          <article
            className={`persona-executive-moment-card fluxus-model-moment-row ${tone}`}
            key={dimension}
            role="listitem"
            aria-label={`${FLUXUS_MOMENT_META[dimension].label}: ${formatScore(item.score)} / 7 · ${signalLabel}`}
          >
            <div className="fluxus-model-moment-label">
              <span title={FLUXUS_MOMENT_META[dimension].label}>
                {momentBarLabel(dimension)}
              </span>
              <strong>{formatScore(item.score)}</strong>
            </div>
            <div className="fluxus-model-moment-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.max(0, Math.min(100, (item.score / 7) * 100))}%`,
                }}
              />
            </div>
            <span className="fluxus-model-sr-only">{signalLabel}</span>
          </article>
        );
      })}
    </div>
  );
}

function IndividualIndicators({ result }: { result: FluxusV2Result }) {
  return (
    <section
      className="persona-executive-person-section persona-executive-person-indicators fluxus-model-detail-block"
      aria-labelledby="fluxus-model-indicators-title"
    >
      <div className="persona-executive-section-heading">
        <p className="persona-executive-kicker">Sustentabilidade</p>
        <h3 id="fluxus-model-indicators-title">
          Cinco indicadores para orientar apoio
        </h3>
      </div>
      <div className="persona-executive-indicator-grid persona-executive-indicator-grid--compact fluxus-model-indicators-grid">
        {FLUXUS_SUSTAINABILITY_INDICATORS.map(indicator => {
          const item = result.indicadores[indicator];
          const meta = FLUXUS_SUSTAINABILITY_META[indicator];
          return (
            <article
              className="persona-executive-indicator-card persona-executive-indicator-card--compact"
              key={indicator}
            >
              <div className="persona-executive-card-heading">
                <h4>{meta.label}</h4>
                <strong>{formatScore(item.score)} / 7</strong>
              </div>
              <p>
                {indicatorDirection(meta.direction)} ·{" "}
                {meta.direction === "risk"
                  ? "maior pontuação pede atenção"
                  : "maior pontuação é mais protetiva"}
                .
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function IndividualDetails({ person }: { person: ExecutivePerson }) {
  const { result } = person;
  return (
    <section
      className="persona-executive-sheet persona-executive-person-section fluxus-model-details-sheet"
      aria-labelledby={`fluxus-model-details-title-${person.assessmentId}`}
    >
      <div className="persona-executive-section-heading fluxus-model-details-heading">
        <p className="persona-executive-kicker">Folha detalhada</p>
        <h2 id={`fluxus-model-details-title-${person.assessmentId}`}>
          Indicadores e metadados da ficha
        </h2>
        <p>
          Pontuações completas do ciclo e referências de leitura; os valores
          seguem o resultado Beta 2 recebido e não são recalculados na
          apresentação.
        </p>
      </div>
      <div className="fluxus-model-details-grid">
        <IndividualIndicators result={result} />
        <section className="persona-executive-person-section fluxus-model-detail-block fluxus-model-metadata-block">
          <div className="persona-executive-section-heading">
            <p className="persona-executive-kicker">Contexto do ciclo</p>
            <h3>Metadados e medidas derivadas</h3>
          </div>
          <dl className="fluxus-model-metadata">
            <div>
              <dt>Data da resposta</dt>
              <dd>{formatDate(person.completedAt)}</dd>
            </div>
            <div>
              <dt>Ciclo</dt>
              <dd>{formatCycle(person)}</dd>
            </div>
            <div>
              <dt>Predominância autorrelatada</dt>
              <dd>{FLUXUS_DIMENSION_META[result.predominante].label}</dd>
            </div>
            <div>
              <dt>Maior demanda percebida</dt>
              <dd>
                {FLUXUS_DIMENSION_META[result.maiorDemanda].label} ·{" "}
                {formatScore(result.maiorGap)} ponto(s)
              </dd>
            </div>
            <div>
              <dt>Janela de referência</dt>
              <dd>{result.referenceWindow}</dd>
            </div>
            <div>
              <dt>Momento geral</dt>
              <dd>{formatScore(result.momentoGeral)} / 7</dd>
            </div>
            <div>
              <dt>Distância média de adaptação</dt>
              <dd>{formatScore(result.distanciaMediaAdaptacao)} ponto(s)</dd>
            </div>
            <div>
              <dt>Dimensões com demanda relevante</dt>
              <dd>{result.dimensoesComDemandaRelevante}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

function IndividualSheet({
  person,
  notes,
  data,
}: {
  person: ExecutivePerson;
  notes: ExecutiveNotes;
  data: ExecutiveDocumentData;
}) {
  const analysis = buildExecutiveIndividual(person.result);
  const individualNotes = notes.individuals[String(person.assessmentId)] ?? {
    summary: "",
    context: "",
    recommendations: "",
  };
  const name = textOrFallback(person.name, "Participante");
  const signalTone =
    person.result.sustentabilidade === "Sustentável"
      ? "fluxus-model-signal--good"
      : person.result.sustentabilidade === "Ponto de atenção"
        ? "fluxus-model-signal--watch"
        : "fluxus-model-signal--risk";
  return (
    <>
      <section
        className="persona-executive-sheet persona-executive-person-sheet fluxus-model-sheet"
        aria-labelledby={`persona-executive-person-${person.assessmentId}`}
      >
        <aside className="fluxus-model-rail">
          <p className="fluxus-model-rail__eyebrow">
            Perfil individual · {formatCycle(person)}
          </p>
          <h2 id={`persona-executive-person-${person.assessmentId}`}>{name}</h2>
          <p className="fluxus-model-rail__role">
            {textOrFallback(person.jobTitle, "Cargo não informado")}
            {hasText(person.department) ? ` · ${person.department}` : ""}
          </p>
          <div className={`fluxus-model-signal ${signalTone}`}>
            <strong>{person.result.sustentabilidade}</strong>
            <span>
              Índice {formatScore(person.result.indiceSustentabilidade)} / 7
            </span>
          </div>

          <section className="fluxus-model-rail__section">
            <p className="fluxus-model-rail__kicker">Aderência à função</p>
            <strong>{analysis.fitLabel}</strong>
            <p>{analysis.fitText}</p>
          </section>

          <section className="fluxus-model-rail__section">
            <p className="fluxus-model-rail__kicker">Pontos fortes</p>
            <ul>
              {(analysis.strengths.length
                ? analysis.strengths
                : [
                    "Nenhum fator protetivo foi destacado automaticamente neste recorte.",
                  ]
              ).map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="fluxus-model-rail__section">
            <p className="fluxus-model-rail__kicker">Pede atenção</p>
            <ul>
              {(analysis.attention.length
                ? analysis.attention
                : [
                    "Nenhuma atenção automática; ainda assim, ouvir a experiência concreta.",
                  ]
              ).map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="fluxus-model-content">
          <header className="fluxus-model-hero">
            <div>
              <p className="fluxus-model-content__kicker">
                Hipótese de leitura
              </p>
              <h3>Quem é, no trabalho</h3>
              <p>{analysis.summary}</p>
            </div>
            <FluxusPersonaLogo className="fluxus-model-logo" />
          </header>

          <div className="fluxus-model-visual-grid">
            <section className="fluxus-model-panel fluxus-model-profile-panel">
              <h3>Perfil × função percebida</h3>
              <p className="fluxus-model-panel__note">
                A função percebida não é cargo oficial e nenhuma pontuação
                comprova aptidão.
              </p>
              <ScoreBars
                result={person.result}
                chartId={`persona-executive-profile-chart-${person.assessmentId}`}
              />
            </section>
            <section className="fluxus-model-panel fluxus-model-moment-panel">
              <h3>Como está hoje</h3>
              <p className="fluxus-model-panel__note">
                Sete condições autorrelatadas do ciclo, em escala de 1 a 7.
              </p>
              <IndividualMoment result={person.result} />
            </section>
          </div>

          <section className="fluxus-model-actions">
            <div className="fluxus-model-actions__heading">
              <p className="fluxus-model-content__kicker">Desenvolvimento</p>
              <h3>Como desenvolver</h3>
            </div>
            <div className="persona-executive-action-list fluxus-model-action-grid">
              {analysis.actions.slice(0, 3).map((action, index) => (
                <article
                  className="persona-executive-action-card fluxus-model-action-card"
                  key={`${action.title}-${index}`}
                >
                  <span>{index + 1}</span>
                  <div>
                    <h4>{action.title}</h4>
                    <p>{action.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <IndividualDetails person={person} />
      <ConsultantNotes
        entries={[
          { label: "Síntese da consultoria", value: individualNotes.summary },
          { label: "Contexto informado", value: individualNotes.context },
          {
            label: "Recomendações da consultoria",
            value: individualNotes.recommendations,
          },
        ]}
      />
      <DocumentFooter people={[person]} generatedAt={data.generatedAt} />
      <FluxusExecutiveComplementary person={person} />
    </>
  );
}

function TeamDocument({ data, notes }: FluxusExecutiveDocumentProps) {
  return (
    <>
      <Cover data={data} notes={notes} />
      <HowToRead />
      <TeamPortrait data={data} />
      <DepartmentComparison data={data} />
      {data.aggregate ? (
        <ProfileFunctionMap people={data.people} aggregate={data.aggregate} />
      ) : null}
      <GapMap people={data.people} />
      <MomentAggregate data={data} />
      <ActionPlan data={data} notes={notes} />
      <section
        className="persona-executive-sheet persona-executive-section persona-executive-people-section"
        aria-labelledby="persona-executive-people-title"
      >
        <div className="persona-executive-section-heading">
          <p className="persona-executive-kicker">
            Fichas individuais autorizadas
          </p>
          <h2 id="persona-executive-people-title">
            Uma ficha por pessoa selecionada
          </h2>
          <p>
            As fichas são leituras individuais e não devem ser somadas para
            inferir desempenho coletivo.
          </p>
        </div>
        <div className="persona-executive-person-list">
          {data.people.map(person => (
            <IndividualSheet
              key={person.assessmentId}
              person={person}
              notes={notes}
              data={data}
            />
          ))}
        </div>
      </section>
      <DocumentFooter people={data.people} generatedAt={data.generatedAt} />
    </>
  );
}

export function FluxusExecutiveDocument({
  data,
  notes,
  focusIndividual = false,
}: FluxusExecutiveDocumentProps) {
  if (data.mode === "individual") {
    const person = data.people[0];
    if (!person) return null;
    return (
      <div
        className={`persona-executive-document persona-executive-document--individual persona-executive-document--model${focusIndividual ? " persona-executive-document--focus-individual" : ""}`}
      >
        {!focusIndividual ? <Cover data={data} notes={notes} /> : null}
        <IndividualSheet person={person} notes={notes} data={data} />
      </div>
    );
  }
  return (
    <div className="persona-executive-document persona-executive-document--team">
      <TeamDocument data={data} notes={notes} />
    </div>
  );
}

export default FluxusExecutiveDocument;

export const __executiveDocumentInternals = {
  formatScore,
  formatDate,
  signalText,
  indicatorDirection,
  PROFILE_COLOR,
  FUNCTION_COLOR,
  ORANGE_COLOR,
  GRID_COLOR,
  DARK_COLOR,
};

// Keep the dimension type referenced in this pure document module for consumers that augment the chart contract.
export type ExecutiveChartDimension = FluxusDimension;
export type ExecutiveChartMomentDimension = FluxusMomentDimension;
export type ExecutiveChartIndicator = FluxusSustainabilityIndicator;
