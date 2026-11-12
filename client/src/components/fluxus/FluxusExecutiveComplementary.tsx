import type {
  ExecutiveComplementarySource,
  ManagerialComplementaryReading,
} from "@shared/fluxusManagerialComplementary";
import {
  CRITIC_LABELS,
  SABOTEUR_LABELS,
  type CriticKey,
  type SaboteurKey,
} from "@shared/fluxusComplementary";
import type { ExecutivePerson } from "@shared/fluxusExecutive";
import { buildManagerialComplementary } from "@shared/fluxusManagerialComplementaryAnalysis";
import "./FluxusExecutiveComplementary.css";

export type FluxusExecutiveComplementaryProps = {
  person: ExecutivePerson;
  idSuffix?: string;
};

const SABOTEUR_KEYS = Object.keys(SABOTEUR_LABELS) as SaboteurKey[];
const CRITIC_KEYS = Object.keys(CRITIC_LABELS) as CriticKey[];

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Renderiza datas externas sem usar Date: sourceDate e confirmedAt representam
 * o calendário da fonte e não devem sofrer conversão de fuso no navegador.
 */
export const formatComplementaryDate = (value: string | null | undefined) => {
  if (!value) return "Não informado";
  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return value;
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
};

export const formatComplementaryTimestamp = (
  value: string | null | undefined
) => {
  if (!value) return "Não informado";
  const date = formatComplementaryDate(value);
  const time = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
    ? value.slice(11, 16)
    : "";
  return time ? `${date} · ${time} UTC` : date;
};

export const formatComplementaryNumber = (value: number | null | undefined) => {
  if (!isFiniteNumber(value)) return "Não informado";
  return String(value).replace(".", ",");
};

const sourceLabel = (source: ExecutiveComplementarySource) =>
  source.kind === "pq" ? "QP" : "Sabotadores";

const sourceContext = (source: ExecutiveComplementarySource) =>
  source.context?.trim() ? (
    <p className="persona-executive-complementary-source-context">
      {source.context}
    </p>
  ) : null;

function SourceMeta({ source }: { source: ExecutiveComplementarySource }) {
  return (
    <article className="persona-executive-complementary-source">
      <dl>
        <div>
          <dt>Fonte autorizada</dt>
          <dd>{sourceLabel(source)}</dd>
        </div>
        <div>
          <dt>Data da fonte</dt>
          <dd>{formatComplementaryDate(source.sourceDate)}</dd>
        </div>
        <div>
          <dt>Confirmação</dt>
          <dd>{formatComplementaryTimestamp(source.confirmedAt)}</dd>
        </div>
      </dl>
      {sourceContext(source)}
    </article>
  );
}

function ScaleBadge({ scale }: { scale: string }) {
  return (
    <span className="persona-executive-complementary-scale">
      Escala {scale}
    </span>
  );
}

function QpResult({ source }: { source: ExecutiveComplementarySource }) {
  const value = source.values.pq;
  return (
    <article className="persona-executive-complementary-result persona-executive-complementary-result--pq">
      <div className="persona-executive-complementary-card-heading">
        <div>
          <p className="persona-executive-complementary-kicker">QP</p>
          <h3>Índice QP autorrelatado</h3>
        </div>
        <ScaleBadge scale="0–100" />
      </div>
      {isFiniteNumber(value) ? (
        <div
          className="persona-executive-complementary-pq-value"
          aria-label={`QP ${formatComplementaryNumber(value)} de 100`}
        >
          <strong>{formatComplementaryNumber(value)}</strong>
          <span>/ 100</span>
        </div>
      ) : (
        <p className="persona-executive-complementary-not-informed">
          Valor não informado na fonte autorizada.
        </p>
      )}
      <p className="persona-executive-complementary-helper">
        Resultado apresentado separadamente, sem combinação com Persona ou
        Sabotadores.
      </p>
    </article>
  );
}

function BarValue({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const hasValue = isFiniteNumber(value);
  const width = hasValue ? Math.max(0, Math.min(10, value)) * 10 : 0;
  const text = hasValue
    ? `${formatComplementaryNumber(value)} / 10`
    : "Não informado";
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="persona-executive-complementary-bar-cell">
        <div
          className="persona-executive-complementary-bar-track"
          aria-hidden="true"
        >
          <span style={{ width: `${width}%` }} />
        </div>
      </td>
      <td className="persona-executive-complementary-score">{text}</td>
    </tr>
  );
}

function SaboteurResults({ source }: { source: ExecutiveComplementarySource }) {
  return (
    <article className="persona-executive-complementary-result persona-executive-complementary-result--saboteurs">
      <div className="persona-executive-complementary-card-heading">
        <div>
          <p className="persona-executive-complementary-kicker">Sabotadores</p>
          <h3>Nove resultados autorrelatados</h3>
        </div>
        <ScaleBadge scale="0–10" />
      </div>
      <div className="persona-executive-complementary-table-wrap">
        <table className="persona-executive-complementary-score-table">
          <caption className="sr-only">
            Resultados dos nove Sabotadores na escala de zero a dez
          </caption>
          <thead>
            <tr>
              <th scope="col">Indicador</th>
              <th scope="col">Barra</th>
              <th scope="col">Pontuação</th>
            </tr>
          </thead>
          <tbody>
            {SABOTEUR_KEYS.map(key => (
              <BarValue
                key={key}
                label={SABOTEUR_LABELS[key]}
                value={source.values.saboteurs[key]}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="persona-executive-complementary-helper">
        Zero é uma pontuação válida; campo não informado permanece distinto de
        zero.
      </p>
    </article>
  );
}

function CriticResults({ source }: { source: ExecutiveComplementarySource }) {
  const hasCritic = CRITIC_KEYS.some(key =>
    isFiniteNumber(source.values.critic[key])
  );
  if (!hasCritic) return null;
  return (
    <article className="persona-executive-complementary-result persona-executive-complementary-result--critic">
      <div className="persona-executive-complementary-card-heading">
        <div>
          <p className="persona-executive-complementary-kicker">Crítico</p>
          <h3>Direções do autorrelato</h3>
        </div>
        <ScaleBadge scale="1–15" />
      </div>
      <div className="persona-executive-complementary-critic-grid">
        {CRITIC_KEYS.map(key => {
          const value = source.values.critic[key];
          if (!isFiniteNumber(value)) return null;
          return (
            <div key={key}>
              <span>{CRITIC_LABELS[key]}</span>
              <strong>{formatComplementaryNumber(value)} / 15</strong>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Question({ children }: { children: string }) {
  return (
    <p className="persona-executive-complementary-question">
      <strong>Pergunta para validar</strong>
      <span>{children}</span>
    </p>
  );
}

function ReadingGuide({
  reading,
  idSuffix,
  personName,
}: {
  reading: ManagerialComplementaryReading;
  personName: string;
  idSuffix: string;
}) {
  const patterns = reading.patterns;
  const actions = reading.actions.slice(0, 3);
  return (
    <section
      className="persona-executive-complementary-sheet persona-executive-complementary-sheet--guide"
      aria-labelledby={`persona-executive-complementary-guide-title-${idSuffix}`}
    >
      <header className="persona-executive-complementary-heading">
        <p className="persona-executive-complementary-kicker">
          Apoio ao desenvolvimento
        </p>
        <h2 id={`persona-executive-complementary-guide-title-${idSuffix}`}>
          Guia de apoio ao desenvolvimento
        </h2>
        <p className="persona-executive-complementary-lede">
          <strong>{personName}</strong> · Hipóteses para uma conversa
          responsável, sempre a confirmar com a pessoa e com exemplos
          observáveis.
        </p>
      </header>

      <p className="persona-executive-complementary-summary">
        {reading.summary}
      </p>

      <article className="persona-executive-complementary-conversation">
        <div>
          <p className="persona-executive-complementary-kicker">Comunicação</p>
          <h3>{reading.communication.title}</h3>
        </div>
        <p>{reading.communication.text}</p>
        <Question>{reading.communication.question}</Question>
      </article>

      {patterns.length ? (
        <section
          className="persona-executive-complementary-guide-section"
          aria-labelledby={`persona-executive-complementary-patterns-title-${idSuffix}`}
        >
          <div className="persona-executive-complementary-subheading">
            <p className="persona-executive-complementary-kicker">
              Para explorar
            </p>
            <h3
              id={`persona-executive-complementary-patterns-title-${idSuffix}`}
            >
              Opções de apoio e perguntas
            </h3>
          </div>
          <p className="persona-executive-complementary-helper">
            Catálogo em ordem fixa, não em ordem de importância. Os nomes vêm da
            fonte externa e não são rótulos da pessoa. Escolha o que faz sentido
            em conversa, não pela pontuação.
          </p>
          <div className="persona-executive-complementary-pattern-list">
            {patterns.map(pattern => (
              <article
                className="persona-executive-complementary-pattern"
                key={pattern.key}
              >
                <div className="persona-executive-complementary-pattern-heading">
                  <h4>{pattern.label}</h4>
                  <strong>
                    {formatComplementaryNumber(pattern.score)} / 10
                  </strong>
                </div>
                <p>{pattern.support}</p>
                <Question>{pattern.question}</Question>
              </article>
            ))}
          </div>
          {reading.hasTies ? (
            <p className="persona-executive-complementary-tie-note">
              Há pontuações empatadas entre padrões; use a conversa para decidir
              o que faz sentido explorar primeiro.
            </p>
          ) : null}
        </section>
      ) : null}

      {actions.length ? (
        <section
          className="persona-executive-complementary-guide-section"
          aria-labelledby={`persona-executive-complementary-actions-title-${idSuffix}`}
        >
          <div className="persona-executive-complementary-subheading">
            <p className="persona-executive-complementary-kicker">
              Combinados observáveis
            </p>
            <h3
              id={`persona-executive-complementary-actions-title-${idSuffix}`}
            >
              Ações de desenvolvimento
            </h3>
          </div>
          <div className="persona-executive-complementary-action-list">
            {actions.map((action, index) => (
              <article
                className="persona-executive-complementary-action"
                key={`${action.title}-${index}`}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h4>{action.title}</h4>
                  <p>{action.text}</p>
                  <Question>{action.question}</Question>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <aside className="persona-executive-complementary-notice">
        <strong>Limite de uso</strong>
        <p>{reading.notice}</p>
      </aside>
      <section
        className="persona-executive-complementary-follow-up"
        aria-labelledby={`persona-executive-complementary-follow-up-title-${idSuffix}`}
      >
        <p className="persona-executive-complementary-kicker">Acompanhamento</p>
        <h3 id={`persona-executive-complementary-follow-up-title-${idSuffix}`}>
          Próxima conversa
        </h3>
        <p>{reading.followUp}</p>
      </section>
    </section>
  );
}

export function FluxusExecutiveComplementary({
  person,
  idSuffix = String(person.assessmentId),
}: FluxusExecutiveComplementaryProps) {
  if (!person.complementary?.pq && !person.complementary?.saboteurs)
    return null;

  const reading = buildManagerialComplementary(person);
  if (!reading) return null;

  // A análise revalida titular, avaliação, consentimento e tipo. Nunca use o
  // bundle bruto aqui: ele pode conter uma fonte inválida ao lado de uma válida.
  const sources = reading.sources;
  if (!sources.pq && !sources.saboteurs) return null;
  const sourceList = [sources.pq, sources.saboteurs].filter(
    (source): source is ExecutiveComplementarySource => Boolean(source)
  );
  const hasSaboteurSource = Boolean(sources.saboteurs);

  return (
    <div className="persona-executive-complementary">
      <section
        className="persona-executive-complementary-sheet persona-executive-complementary-sheet--results"
        aria-labelledby={`persona-executive-complementary-results-title-${idSuffix}`}
      >
        <header className="persona-executive-complementary-heading">
          <p className="persona-executive-complementary-kicker">
            Resultados autorizados
          </p>
          <h2 id={`persona-executive-complementary-results-title-${idSuffix}`}>
            Resultados complementares autorizados
          </h2>
          <p className="persona-executive-complementary-lede">
            <strong>{person.name || "Participante"}</strong> · QP, Sabotadores e
            Crítico permanecem em suas escalas próprias. A fonte não altera o
            resultado Persona.
          </p>
        </header>

        <div className="persona-executive-complementary-source-grid">
          {sourceList.map(source => (
            <SourceMeta
              key={`${source.kind}-${source.id}-${source.revision}`}
              source={source}
            />
          ))}
        </div>

        <div className="persona-executive-complementary-result-grid">
          <div>
            {sources.pq ? <QpResult source={sources.pq} /> : null}
            {hasSaboteurSource ? (
              <CriticResults source={sources.saboteurs!} />
            ) : null}
          </div>
          {sources.saboteurs ? (
            <SaboteurResults source={sources.saboteurs} />
          ) : null}
        </div>

        <aside className="persona-executive-complementary-notice">
          <strong>Leitura responsável</strong>
          <p>{reading.notice}</p>
        </aside>
      </section>
      <ReadingGuide
        reading={reading}
        idSuffix={idSuffix}
        personName={person.name || "Participante"}
      />
    </div>
  );
}

export default FluxusExecutiveComplementary;

export const __executiveComplementaryInternals = {
  formatComplementaryDate,
  formatComplementaryTimestamp,
  formatComplementaryNumber,
};
