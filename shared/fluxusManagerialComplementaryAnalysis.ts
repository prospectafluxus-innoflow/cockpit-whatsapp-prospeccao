import { SABOTEUR_LABELS, type SaboteurKey } from "./fluxusComplementary";
import { FLUXUS_DIMENSION_META, type FluxusDimension } from "./fluxus";
import { FLUXUS_MOMENT_DIMENSIONS, FLUXUS_MOMENT_META } from "./fluxusV2";
import type { ExecutivePerson } from "./fluxusExecutive";
import {
  MANAGERIAL_COMPLEMENTARY_NOTICE,
  type ExecutiveComplementaryBundle,
  type ExecutiveComplementarySource,
  type ManagerialComplementaryReading,
} from "./fluxusManagerialComplementary";

const keys = Object.keys(SABOTEUR_LABELS) as SaboteurKey[];
const finiteIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const score = (value: number) => String(value).replace(".", ",");
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function usable(
  source: ExecutiveComplementarySource | undefined,
  person: ExecutivePerson,
  kind: "pq" | "saboteurs"
) {
  if (
    !source ||
    source.kind !== kind ||
    source.userId !== person.userId ||
    source.assessmentId !== person.assessmentId ||
    !Number.isSafeInteger(source.id) ||
    source.id <= 0 ||
    !Number.isSafeInteger(source.revision) ||
    source.revision <= 0 ||
    !calendarDate(source.sourceDate) ||
    !Number.isFinite(Date.parse(source.confirmedAt)) ||
    !source.values
  )
    return false;
  if (kind === "pq") return finiteIn(source.values.pq, 0, 100);
  return (
    keys.every(key => finiteIn(source.values.saboteurs?.[key], 0, 10)) &&
    Object.values(source.values.critic ?? {}).every(
      value => value === null || finiteIn(value, 1, 15)
    )
  );
}
export function getManagerialComplementarySources(
  person: ExecutivePerson
): ExecutiveComplementaryBundle {
  const input = person.complementary;
  return {
    ...(usable(input?.pq, person, "pq") ? { pq: input!.pq! } : {}),
    ...(usable(input?.saboteurs, person, "saboteurs")
      ? { saboteurs: input!.saboteurs! }
      : {}),
  };
}
const communication: Record<
  FluxusDimension,
  { title: string; text: string; question: string }
> = {
  realizador: {
    title: "Objetivos e espaço de decisão",
    text: "Como hipótese de comunicação, experimentar objetivos, critérios de sucesso e alçadas claros. Ouvir como a pessoa prefere decidir e qual apoio precisa; o perfil não comprova capacidade ou preferência permanente.",
    question: "Que clareza e autonomia ajudam você a realizar suas entregas?",
  },
  comunicador: {
    title: "Troca e alinhamentos objetivos",
    text: "Como hipótese, experimentar conversas curtas de alinhamento e espaço para compartilhar ideias. Confirmar a preferência da pessoa e ajustar a frequência às necessidades reais, sem exigir exposição constante.",
    question: "Que forma de alinhamento e troca funciona melhor para você?",
  },
  planejador: {
    title: "Previsibilidade e preparação",
    text: "Como hipótese, antecipar mudanças e combinar rotinas e prioridades. Perguntar quanto tempo de preparação ajuda e onde a flexibilidade é necessária; não presumir resistência ou rigidez.",
    question: "Que combinados ajudam você a se preparar e lidar com mudanças?",
  },
  analista: {
    title: "Critérios e detalhe adequado",
    text: "Como hipótese, explicitar critérios e o nível de detalhe necessário em cada entrega. Combinar prazo e risco, ouvir dúvidas e evitar deduzir perfeccionismo ou competência a partir do perfil.",
    question:
      "Que critérios e informações são suficientes para você avançar com segurança?",
  },
};
const supports: Record<
  SaboteurKey,
  { title: string; text: string; question: string }
> = {
  stickler: {
    title: "Combinar qualidade suficiente",
    text: "Explorar exemplos em que revisar ajuda e em que prolonga a entrega. Combinar critérios de qualidade adequados ao risco, ao prazo e aos recursos disponíveis, sem atribuir o problema à pessoa.",
    question:
      "Que critério compartilhado ajudaria a concluir uma entrega com tranquilidade?",
  },
  pleaser: {
    title: "Negociar pedidos e limites",
    text: "Conversar sobre pedidos concorrentes e prioridades. O gestor pode ajudar a renegociar compromissos e distribuir apoio dentro da jornada, sem esperar que uma pessoa assuma todas as demandas.",
    question: "Que pedido ou compromisso precisamos renegociar juntos?",
  },
  hyperVigilant: {
    title: "Esclarecer dúvidas e oferecer apoio",
    text: "Explorar situações concretas de incerteza. Clarificar expectativas, recursos e quando pedir ajuda, sem interpretar o resultado como ansiedade ou diagnóstico.",
    question: "Que dúvida podemos esclarecer para facilitar o seu trabalho?",
  },
  restless: {
    title: "Proteger foco e prioridades",
    text: "Perguntar quais interrupções e mudanças de prioridade atrapalham. Experimentar blocos de foco e revisões curtas de prioridades dentro da jornada, com ajustes acordados.",
    question:
      "O que ajudaria você a concluir uma prioridade antes de iniciar outra?",
  },
  controller: {
    title: "Compartilhar decisões com clareza",
    text: "Explorar como distribuir responsabilidades e decisões. Combinar alçadas e pontos de acompanhamento com a equipe, sem rotular a pessoa ou presumir falta de confiança.",
    question:
      "Que decisão podemos compartilhar ou delegar com apoio e critérios claros?",
  },
  avoider: {
    title: "Criar espaço seguro para conversas",
    text: "Perguntar quais conversas ou pendências precisam de apoio. Preparar um próximo passo pequeno e uma comunicação respeitosa, sem pressionar por exposição pessoal ou confissão.",
    question: "Que conversa de trabalho posso ajudar você a preparar?",
  },
  hyperAchiever: {
    title: "Reconhecer contribuições sustentáveis",
    text: "Valorizar entregas observáveis, aprendizagem e cooperação, não somente volume. Rever metas e recursos reais e combinar um ritmo sustentável, sem associar valor pessoal à produtividade.",
    question:
      "Que contribuição merece reconhecimento e que condição precisamos melhorar?",
  },
  victim: {
    title: "Ouvir contexto e identificar recursos",
    text: "Ouvir situações concretas relatadas e identificar mudanças e apoios que a empresa pode oferecer. Evitar culpa, desqualificação ou tratar o nome do padrão como característica da pessoa.",
    question:
      "Que apoio ou mudança nas condições de trabalho faria diferença para você?",
  },
  hyperRational: {
    title: "Equilibrar evidências e escuta",
    text: "Explorar tanto as informações objetivas quanto a experiência de quem participa. O gestor pode modelar escuta e esclarecer critérios, sem presumir falta de empatia.",
    question:
      "Que evidência e que experiência de outra pessoa precisamos considerar juntos?",
  },
};

export function buildManagerialComplementary(
  person: ExecutivePerson
): ManagerialComplementaryReading | null {
  const sources = getManagerialComplementarySources(person);
  if (!sources.pq && !sources.saboteurs) return null;
  // Catálogo na ordem original: não escolher ou priorizar padrões pela nota.
  const patterns = sources.saboteurs
    ? keys.map(key => ({
        key,
        label: SABOTEUR_LABELS[key],
        score: sources.saboteurs!.values.saboteurs[key]!,
        question: supports[key].question,
        support: supports[key].text,
      }))
    : [];
  const hasTies = false;
  const lowest = [...FLUXUS_MOMENT_DIMENSIONS].sort(
    (a, b) => person.result.momento[a].score - person.result.momento[b].score
  )[0]!;
  const principal = FLUXUS_DIMENSION_META[person.result.predominante].label;
  const sourceSummary = [
    sources.pq
      ? `QP ${score(sources.pq.values.pq!)} / 100, aplicado em ${sources.pq.sourceDate}`
      : "",
    sources.saboteurs
      ? `padrões de autossabotagem em escala própria de 0 a 10, aplicados em ${sources.saboteurs.sourceDate}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
  const summary = `No Persona, ${principal} é a dimensão de maior intensidade autorrelatada; ${FLUXUS_MOMENT_META[lowest].label} tem ${score(person.result.momento[lowest].score)} / 7 neste ciclo. As fontes complementares autorizadas registram ${sourceSummary}. As datas e escalas são diferentes: esta leitura aproxima temas para conversa, não prova relação causal ou competência.`;
  const actions = [
    {
      title: "Escolher um experimento juntos",
      text: "A pessoa e o gestor escolhem um tema que faça sentido no trabalho real. Definam uma ação pequena e observável; a pontuação de um teste não escolhe a prioridade por vocês.",
      question:
        "Qual ajuste você gostaria de experimentar e o que indicará que ajudou?",
    },
    {
      title: "Combinar apoio e revisão",
      text: "Definam os recursos e o responsável pelo apoio. Combinem uma data de conversa para rever as condições e os resultados da ação dentro da jornada, sem cobrança de mudança psicológica.",
      question:
        "Que apoio cabe ao gestor oferecer e quando vamos rever o combinado?",
    },
  ];
  return {
    sources,
    summary,
    communication: communication[person.result.predominante],
    patterns,
    hasTies,
    actions,
    followUp:
      "Escolham um apoio e uma ação observável, definam quem fará o quê e combinem uma data de revisão. Na próxima conversa, verifiquem o que mudou nas condições e nas entregas; não meçam o valor da pessoa por esses testes. Não pressupor disponibilidade fora da jornada. Cópias já exportadas não podem ser recolhidas automaticamente após retirada do compartilhamento.",
    notice: MANAGERIAL_COMPLEMENTARY_NOTICE,
  };
}
