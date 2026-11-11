import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusDimension,
} from "./fluxus";
import {
  FLUXUS_MOMENT_DIMENSIONS,
  FLUXUS_MOMENT_META,
  FLUXUS_SUSTAINABILITY_INDICATORS,
  FLUXUS_SUSTAINABILITY_META,
  FLUXUS_V2_FORMULA_VERSION,
  FLUXUS_V2_INSTRUMENT_VERSION,
  type FluxusMomentDimension,
  type FluxusV2Result,
} from "./fluxusV2";
import type {
  ExecutiveAction,
  ExecutiveAggregate,
  ExecutiveDocumentData,
  ExecutiveIndividualAnalysis,
  ExecutivePerson,
} from "./fluxusExecutive";

const round = (value: number) => Math.round(value * 100) / 100;
const format = (value: number) => value.toFixed(1).replace(".", ",");
const mean = (values: number[]) =>
  round(values.reduce((sum, value) => sum + value, 0) / values.length);

const MOMENT_ACTIONS: Record<FluxusMomentDimension, ExecutiveAction> = {
  engajamento: {
    title: "Conversar sobre sentido e reconhecimento",
    text: "Ouvir o que favorece ou reduz o interesse pelas atividades. Combinar um ajuste concreto de prioridades ou reconhecimento, sem atribuir a causa à pessoa antes da conversa.",
  },
  cargaSustentavel: {
    title: "Rever carga e prioridades",
    text: "Examinar volume, interrupções, prazos e recursos dentro da jornada acordada. Definir o que priorizar, redistribuir ou interromper e revisar os combinados.",
  },
  autonomia: {
    title: "Clarificar espaço de decisão",
    text: "Combinar quais decisões a pessoa pode tomar, quando consultar e qual apoio estará disponível. Ampliar autonomia gradualmente, com critérios claros.",
  },
  clareza: {
    title: "Alinhar responsabilidades",
    text: "Registrar responsabilidades, prioridades e critérios de qualidade em linguagem simples. Confirmar o entendimento e marcar uma conversa de acompanhamento.",
  },
  apoioReconhecimento: {
    title: "Combinar apoio e feedback",
    text: "Identificar os recursos e orientações necessários. Combinar uma frequência de feedback e formas de reconhecimento coerentes com as contribuições observadas.",
  },
  relacoesSeguranca: {
    title: "Fortalecer a cooperação",
    text: "Criar espaço seguro para pedir ajuda, discordar e sinalizar dificuldades. Definir combinados de comunicação respeitosa e acompanhamento sem retaliação.",
  },
  desenvolvimento: {
    title: "Construir um caminho de aprendizagem",
    text: "Ouvir os interesses da pessoa e identificar oportunidades reais de aprendizagem. Combinar uma ação possível, apoio e data para rever o progresso.",
  },
};

export function assertExecutiveBeta2(result: FluxusV2Result) {
  if (
    !result ||
    result.model !== "fluxus_beta_2" ||
    result.instrumentVersion !== FLUXUS_V2_INSTRUMENT_VERSION ||
    result.formulaVersion !== FLUXUS_V2_FORMULA_VERSION
  )
    throw new Error(
      "A visão executiva requer resultados Beta 2 com instrumento e fórmula comparáveis."
    );
  const values = [
    result.indiceSustentabilidade,
    ...FLUXUS_DIMENSIONS.flatMap(key => [
      result.dimensions[key]?.natural,
      result.dimensions[key]?.funcaoPercebida,
    ]),
    ...FLUXUS_MOMENT_DIMENSIONS.map(key => result.momento[key]?.score),
    ...FLUXUS_SUSTAINABILITY_INDICATORS.map(
      key => result.indicadores[key]?.score
    ),
  ];
  if (values.some(value => !Number.isFinite(value) || value < 1 || value > 7))
    throw new Error(
      "O resultado contém indicadores inválidos para a visão executiva."
    );
}

function sortedMoment(result: FluxusV2Result, ascending: boolean) {
  return [...FLUXUS_MOMENT_DIMENSIONS].sort(
    (a, b) =>
      (ascending ? 1 : -1) * (result.momento[a].score - result.momento[b].score)
  );
}

function adaptationAction(result: FluxusV2Result): ExecutiveAction | null {
  const key = [...FLUXUS_DIMENSIONS].sort(
    (a, b) =>
      result.dimensions[b].demandaAbsoluta -
      result.dimensions[a].demandaAbsoluta
  )[0]!;
  const item = result.dimensions[key];
  if (item.demandaAbsoluta < 1.5) return null;
  const dimension = FLUXUS_DIMENSION_META[key].label;
  const directions: Record<FluxusDimension, [string, string]> = {
    realizador: [
      "praticar decisões com critérios e alçadas combinadas",
      "combinar quando conduzir e quando compartilhar a decisão",
    ],
    comunicador: [
      "praticar comunicação estruturada, apresentação e alinhamentos",
      "ajustar a frequência de interação às necessidades reais do trabalho",
    ],
    planejador: [
      "usar rotinas curtas, planejamento e acompanhamento de compromissos",
      "combinar flexibilidade e revisão das rotinas quando o contexto muda",
    ],
    analista: [
      "usar checklists, critérios e revisão orientada para apoiar a análise",
      "ajustar o nível de detalhamento ao risco e ao prazo da entrega",
    ],
  };
  return {
    title: `Apoiar a adaptação em ${dimension}`,
    text: `A diferença percebida sugere conversar sobre como ${item.demanda > 0 ? directions[key][0] : directions[key][1]}. Confirmar essa hipótese com situações reais e com a voz do participante; não é medida de competência.`,
  };
}

export function buildExecutiveIndividual(
  result: FluxusV2Result
): ExecutiveIndividualAnalysis {
  assertExecutiveBeta2(result);
  const principal = FLUXUS_DIMENSION_META[result.predominante];
  const highest = sortedMoment(result, false)[0]!;
  const lowest = sortedMoment(result, true)[0]!;
  const gapDimension = [...FLUXUS_DIMENSIONS].sort(
    (a, b) =>
      result.dimensions[b].demandaAbsoluta -
      result.dimensions[a].demandaAbsoluta
  )[0]!;
  const gap = result.dimensions[gapDimension];
  const hasRelevantGap = FLUXUS_DIMENSIONS.some(
    key => result.dimensions[key].demandaAbsoluta >= 1.5
  );
  const fitLabel = hasRelevantGap
    ? "Ponto de adaptação para conversar"
    : result.distanciaMediaAdaptacao <= 0.75
      ? "Diferenças pequenas neste ciclo"
      : "Diferenças moderadas neste ciclo";
  const fitText = `Maior diferença em ${FLUXUS_DIMENSION_META[gapDimension].label}: perfil ${format(gap.natural)} e função percebida ${format(gap.funcaoPercebida)} (função − perfil: ${gap.demanda > 0 ? "+" : ""}${format(gap.demanda)}). A distância sugere esforço de adaptação, não inadequação nem potencial comprovado.`;
  const momentInterpretation =
    result.momento[lowest].signal === "favoravel"
      ? "As sete condições atuais estão na faixa favorável do instrumento; isso não elimina a necessidade de ouvir o contexto."
      : `${FLUXUS_MOMENT_META[lowest].label} é a condição com menor pontuação (${format(result.momento[lowest].score)} / 7) e merece uma conversa sobre contexto e apoio.`;
  const summary = `No autorrelato, ${principal.label} é a dimensão de maior intensidade (${format(result.dimensions[result.predominante].natural)} / 7). ${principal.definition} No momento atual, ${FLUXUS_MOMENT_META[highest].label} tem a maior pontuação (${format(result.momento[highest].score)} / 7). ${momentInterpretation} O sinal do Índice Fluxus é “${result.sustentabilidade}”; a leitura é exploratória e deve ser confirmada com a pessoa.`;
  const strengths = [
    ...sortedMoment(result, false)
      .filter(
        key =>
          result.momento[key].signal === "favoravel" &&
          result.momento[key].score >= 5
      )
      .slice(0, 3)
      .map(
        key =>
          `${FLUXUS_MOMENT_META[key].label}: ${format(result.momento[key].score)} / 7`
      ),
    ...(["energia", "recuperacao", "autorregulacao"] as const)
      .filter(key => result.indicadores[key].score >= 5)
      .map(
        key =>
          `${FLUXUS_SUSTAINABILITY_META[key].label}: ${format(result.indicadores[key].score)} / 7`
      ),
  ].slice(0, 4);
  const attention = [...result.attentionFactors];
  for (const key of sortedMoment(result, true)) {
    if (
      result.momento[key].signal !== "favoravel" &&
      !attention.includes(FLUXUS_MOMENT_META[key].label)
    )
      attention.push(FLUXUS_MOMENT_META[key].label);
  }
  const actions = sortedMoment(result, true)
    .filter(key => result.momento[key].signal !== "favoravel")
    .slice(0, 2)
    .map(key => MOMENT_ACTIONS[key]);
  if (result.sustentabilidade !== "Sustentável")
    actions.push({
      title: "Ouvir o contexto e cuidar da recuperação",
      text: "Conduzir uma conversa acolhedora sobre ritmo, pausas, recursos e recuperação. Revisar as condições de trabalho e, quando apropriado, orientar aos canais profissionais de apoio; o sinal não é diagnóstico.",
    });
  const adaptation = adaptationAction(result);
  if (adaptation) actions.push(adaptation);
  if (!actions.length)
    actions.push({
      title: "Preservar o que favorece o trabalho",
      text: `Confirmar o que sustenta ${FLUXUS_MOMENT_META[highest].label.toLowerCase()} e combinar como preservar essa condição. Ausência de alerta não substitui acompanhamento.`,
    });
  if (actions.length < 3)
    actions.push({
      title: "Escolher um próximo desafio",
      text: "Conversar sobre aspirações e evidências de trabalho. Escolher um objetivo de aprendizagem possível, sem deduzir aptidão ou promoção a partir do perfil.",
    });
  if (actions.length < 3)
    actions.push({
      title: "Rever os combinados",
      text: "Definir quem apoia, uma ação observável e uma data de revisão. Reavaliar a experiência no próximo ciclo sem tratar esta fotografia como permanente.",
    });
  return {
    summary,
    fitLabel,
    fitText,
    strengths,
    attention,
    actions: actions.slice(0, 3),
  };
}

export function aggregateExecutivePeople(
  people: ExecutivePerson[],
  minimumRespondents: number
): ExecutiveAggregate | null {
  const minimum = Math.max(5, minimumRespondents);
  if (people.length < minimum) return null;
  for (const person of people) assertExecutiveBeta2(person.result);
  const results = people.map(person => person.result);
  const moment = Object.fromEntries(
    FLUXUS_MOMENT_DIMENSIONS.map(key => [
      key,
      mean(results.map(result => result.momento[key].score)),
    ])
  ) as ExecutiveAggregate["moment"];
  const indicators = Object.fromEntries(
    FLUXUS_SUSTAINABILITY_INDICATORS.map(key => [
      key,
      mean(results.map(result => result.indicadores[key].score)),
    ])
  ) as ExecutiveAggregate["indicators"];
  const profiles = Object.fromEntries(
    FLUXUS_DIMENSIONS.map(key => [
      key,
      {
        natural: mean(results.map(result => result.dimensions[key].natural)),
        function: mean(
          results.map(result => result.dimensions[key].funcaoPercebida)
        ),
        signedGap: mean(results.map(result => result.dimensions[key].demanda)),
        absoluteGap: mean(
          results.map(result => result.dimensions[key].demandaAbsoluta)
        ),
      },
    ])
  ) as ExecutiveAggregate["profiles"];
  const signalCounts: ExecutiveAggregate["signalCounts"] = {
    Sustentável: 0,
    "Ponto de atenção": 0,
    "Conversa prioritária": 0,
  };
  const predominantCounts = Object.fromEntries(
    FLUXUS_DIMENSIONS.map(key => [key, 0])
  ) as ExecutiveAggregate["predominantCounts"];
  for (const result of results) {
    signalCounts[result.sustentabilidade] += 1;
    predominantCounts[result.predominante] += 1;
  }
  const order = [...FLUXUS_MOMENT_DIMENSIONS].sort(
    (a, b) => moment[a] - moment[b]
  );
  const weakestMoment = order[0]!;
  const strongestMoment = order[order.length - 1]!;
  const indexMean = mean(results.map(result => result.indiceSustentabilidade));
  const engagementMean = moment.engajamento;
  const summary = `Este recorte reúne ${people.length} avaliações Beta 2 concluídas. O Índice Fluxus médio é ${format(indexMean)} / 7 e o engajamento médio, ${format(engagementMean)} / 7. ${FLUXUS_MOMENT_META[strongestMoment].label} apresenta a maior média (${format(moment[strongestMoment])}); ${FLUXUS_MOMENT_META[weakestMoment].label}, a menor (${format(moment[weakestMoment])}). São descrições do autorrelato: as médias não determinam a causa nem substituem as conversas individuais.`;
  const actions = order
    .filter(key => moment[key] < 4.5)
    .slice(0, 3)
    .map(key => MOMENT_ACTIONS[key]);
  if (!actions.length)
    actions.push({
      title: "Preservar condições e ouvir variações",
      text: "As médias do momento atual estão na faixa favorável de referência. Investigar diferenças entre experiências, preservar os apoios e não supor que a média represente todas as pessoas.",
    });
  if (signalCounts["Conversa prioritária"] || signalCounts["Ponto de atenção"])
    actions.push({
      title: "Organizar conversas de acompanhamento",
      text: "Priorizar conversas acolhedoras com as pessoas que autorizaram a devolutiva. Investigar condições de trabalho e apoio sem transformar sinais em rótulos ou avaliação de desempenho.",
    });
  actions.push({
    title: "Registrar responsáveis e revisar os acordos",
    text: "Converter a conversa em ações observáveis, com responsáveis, apoio e data de revisão. O plano abaixo pode ser complementado pela consultoria; o sistema não presume decisões de gestão.",
  });
  return {
    count: people.length,
    indexMean,
    engagementMean,
    signalCounts,
    predominantCounts,
    profiles,
    moment,
    indicators,
    strongestMoment,
    weakestMoment,
    summary,
    actions: actions.slice(0, 4),
  };
}

export function buildExecutiveDocument(
  company: { id: number; name: string },
  mode: "individual" | "team",
  people: ExecutivePerson[],
  minimumRespondents: number,
  now = new Date()
): ExecutiveDocumentData {
  if (!people.length || (mode === "individual" && people.length !== 1))
    throw new Error("Seleção inválida para este tipo de relatório.");
  if (new Set(people.map(person => person.userId)).size !== people.length)
    throw new Error("Selecione uma única avaliação por pessoa.");
  for (const person of people) assertExecutiveBeta2(person.result);
  const minimum = Math.max(5, minimumRespondents);
  const aggregate =
    mode === "team" ? aggregateExecutivePeople(people, minimum) : null;
  const groups = new Map<string, ExecutivePerson[]>();
  for (const person of people) {
    const label = person.department?.trim() || "Departamento não informado";
    groups.set(label, [...(groups.get(label) ?? []), person]);
  }
  // Any suppressed remainder could be inferred by subtracting released groups from the total.
  // Therefore comparisons are released only when the entire partition satisfies the threshold.
  const releaseGroups =
    Boolean(aggregate) &&
    groups.size > 1 &&
    Array.from(groups.values()).every(
      group =>
        group.length >= minimum && people.length - group.length >= minimum
    );
  const departments = releaseGroups
    ? Array.from(groups.entries()).map(([label, group]) => ({
        label,
        aggregate: aggregateExecutivePeople(group, minimum)!,
      }))
    : [];
  const groupPrivacyNote =
    mode === "individual"
      ? ""
      : !aggregate
        ? `Médias e distribuição do grupo protegidas: são necessárias pelo menos ${minimum} avaliações comparáveis neste recorte. As fichas individuais abaixo seguem a autorização de leitura individual.`
        : groups.size <= 1
          ? "O recorte selecionado não contém departamentos distintos para comparação."
          : !releaseGroups
            ? `Comparativos por departamento protegidos: cada grupo e seu complemento precisam ter ao menos ${minimum} avaliações comparáveis. Nenhuma média de grupo pequeno é exibida.`
            : `Comparativos de departamentos liberados com mínimo de ${minimum} avaliações por grupo e complemento; médias indicativas, não ranking.`;
  return {
    company,
    mode,
    people,
    minimumRespondents: minimum,
    aggregate,
    departments,
    groupPrivacyNote,
    generatedAt: now.toISOString(),
  };
}
