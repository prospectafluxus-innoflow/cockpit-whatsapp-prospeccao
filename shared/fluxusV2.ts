import {
  FLUXUS_DIMENSIONS,
  FLUXUS_DIMENSION_META,
  type FluxusBand,
  type FluxusDimension,
} from "./fluxus";

export const FLUXUS_V2_INSTRUMENT_VERSION = "2.0.0-beta.2";
export const FLUXUS_V2_FORMULA_VERSION = "2.0.0-beta.2";
export const FLUXUS_V2_REFERENCE_WINDOW = "últimas quatro semanas";

export const FLUXUS_V2_SECTIONS = [
  "comportamental",
  "momento",
  "funcao",
  "sustentabilidade",
] as const;
export type FluxusV2Section = (typeof FLUXUS_V2_SECTIONS)[number];

export const FLUXUS_MOMENT_DIMENSIONS = [
  "engajamento",
  "cargaSustentavel",
  "autonomia",
  "clareza",
  "apoioReconhecimento",
  "relacoesSeguranca",
  "desenvolvimento",
] as const;
export type FluxusMomentDimension =
  (typeof FLUXUS_MOMENT_DIMENSIONS)[number];

export const FLUXUS_SUSTAINABILITY_INDICATORS = [
  "energia",
  "recuperacao",
  "autorregulacao",
  "pressao",
  "desgaste",
] as const;
export type FluxusSustainabilityIndicator =
  (typeof FLUXUS_SUSTAINABILITY_INDICATORS)[number];

export type FluxusV2Item = {
  id: string;
  section: FluxusV2Section;
  prompt: string;
  dimension?: FluxusDimension;
  momentDimension?: FluxusMomentDimension;
  indicator?: FluxusSustainabilityIndicator;
  reverse?: boolean;
};

export const FLUXUS_MOMENT_META: Record<
  FluxusMomentDimension,
  { label: string; definition: string }
> = {
  engajamento: {
    label: "Engajamento e sentido",
    definition:
      "Conexão, interesse e percepção de significado no trabalho realizado neste ciclo.",
  },
  cargaSustentavel: {
    label: "Carga sustentável",
    definition:
      "Possibilidade de realizar o trabalho com prioridades, ritmo e volume administráveis.",
  },
  autonomia: {
    label: "Autonomia e controle",
    definition:
      "Espaço percebido para organizar o trabalho e participar das decisões que afetam a execução.",
  },
  clareza: {
    label: "Clareza de papel",
    definition:
      "Compreensão de prioridades, responsabilidades, critérios e expectativas atuais.",
  },
  apoioReconhecimento: {
    label: "Apoio e reconhecimento",
    definition:
      "Acesso a recursos, orientação, feedback e reconhecimento coerente com as contribuições.",
  },
  relacoesSeguranca: {
    label: "Relações e segurança para falar",
    definition:
      "Qualidade da cooperação e liberdade para pedir ajuda, discordar ou sinalizar problemas.",
  },
  desenvolvimento: {
    label: "Perspectiva e desenvolvimento",
    definition:
      "Oportunidade percebida de aprender, usar capacidades e conversar sobre próximos desafios.",
  },
};

export const FLUXUS_SUSTAINABILITY_META: Record<
  FluxusSustainabilityIndicator,
  { label: string; direction: "protective" | "risk"; definition: string }
> = {
  energia: {
    label: "Energia disponível",
    direction: "protective",
    definition: "Disposição percebida para iniciar e sustentar a jornada atual.",
  },
  recuperacao: {
    label: "Recuperação",
    direction: "protective",
    definition:
      "Capacidade percebida de recompor energia e desconectar após períodos de esforço.",
  },
  autorregulacao: {
    label: "Autorregulação sob pressão",
    direction: "protective",
    definition:
      "Capacidade percebida de manter clareza, pausar e buscar apoio diante de tensão.",
  },
  pressao: {
    label: "Pressão percebida",
    direction: "risk",
    definition:
      "Intensidade percebida de sobrecarga, urgência e conflito entre demandas.",
  },
  desgaste: {
    label: "Sinais de desgaste",
    direction: "risk",
    definition:
      "Frequência autorrelatada de esgotamento, distanciamento e dificuldade de recuperação.",
  },
};

const behavioralItems: FluxusV2Item[] = [
  { id: "B2_C_R_01", section: "comportamental", dimension: "realizador", prompt: "Assumo a frente quando uma decisão precisa ser tomada." },
  { id: "B2_C_R_02", section: "comportamental", dimension: "realizador", prompt: "Defendo meu ponto de vista com firmeza, mesmo diante de discordância." },
  { id: "B2_C_R_03", section: "comportamental", dimension: "realizador", prompt: "Tomo iniciativa sem esperar instruções detalhadas." },
  { id: "B2_C_R_04", section: "comportamental", dimension: "realizador", prompt: "Sinto-me confortável ao enfrentar situações difíceis." },
  { id: "B2_C_R_05", section: "comportamental", dimension: "realizador", prompt: "Decido com agilidade quando as informações essenciais estão disponíveis." },
  { id: "B2_C_C_01", section: "comportamental", dimension: "comunicador", prompt: "Expresso minhas ideias com facilidade em grupos." },
  { id: "B2_C_C_02", section: "comportamental", dimension: "comunicador", prompt: "Crio conexão rapidamente com pessoas que ainda não conheço." },
  { id: "B2_C_C_03", section: "comportamental", dimension: "comunicador", prompt: "Sinto-me confortável ao apresentar ou conduzir conversas." },
  { id: "B2_C_C_04", section: "comportamental", dimension: "comunicador", prompt: "Uso entusiasmo para mobilizar outras pessoas." },
  { id: "B2_C_C_05", section: "comportamental", dimension: "comunicador", prompt: "Busco interação frequente durante o trabalho." },
  { id: "B2_C_P_01", section: "comportamental", dimension: "planejador", prompt: "Mantenho um ritmo constante mesmo em atividades repetitivas." },
  { id: "B2_C_P_02", section: "comportamental", dimension: "planejador", prompt: "Escuto com paciência antes de apresentar minha posição." },
  { id: "B2_C_P_03", section: "comportamental", dimension: "planejador", prompt: "Prefiro mudanças planejadas a alterações repentinas." },
  { id: "B2_C_P_04", section: "comportamental", dimension: "planejador", prompt: "Demonstro constância no acompanhamento de compromissos." },
  { id: "B2_C_P_05", section: "comportamental", dimension: "planejador", prompt: "Contribuo para preservar cooperação e continuidade no time." },
  { id: "B2_C_A_01", section: "comportamental", dimension: "analista", prompt: "Confiro detalhes antes de concluir uma entrega." },
  { id: "B2_C_A_02", section: "comportamental", dimension: "analista", prompt: "Utilizo critérios claros para tomar decisões." },
  { id: "B2_C_A_03", section: "comportamental", dimension: "analista", prompt: "Organizo as etapas antes de iniciar uma atividade complexa." },
  { id: "B2_C_A_04", section: "comportamental", dimension: "analista", prompt: "Valorizo padrões e procedimentos que reduzem erros." },
  { id: "B2_C_A_05", section: "comportamental", dimension: "analista", prompt: "Procuro evidências antes de aceitar uma conclusão." },
];

const momentItems: FluxusV2Item[] = [
  { id: "B2_M_ENG_01", section: "momento", momentDimension: "engajamento", prompt: "Tenho sentido interesse genuíno pelas atividades que realizo." },
  { id: "B2_M_ENG_02", section: "momento", momentDimension: "engajamento", prompt: "Consigo perceber significado nas minhas entregas." },
  { id: "B2_M_ENG_03", section: "momento", momentDimension: "engajamento", prompt: "Tenho vontade de contribuir para os objetivos da equipe." },
  { id: "B2_M_CAR_01", section: "momento", momentDimension: "cargaSustentavel", prompt: "O volume de trabalho tem sido administrável." },
  { id: "B2_M_CAR_02", section: "momento", momentDimension: "cargaSustentavel", prompt: "Consigo distinguir e executar as prioridades mais importantes." },
  { id: "B2_M_CAR_03", section: "momento", momentDimension: "cargaSustentavel", prompt: "Interrupções e urgências têm tornado meu trabalho difícil de administrar.", reverse: true },
  { id: "B2_M_AUT_01", section: "momento", momentDimension: "autonomia", prompt: "Tenho espaço suficiente para organizar a forma como executo meu trabalho." },
  { id: "B2_M_AUT_02", section: "momento", momentDimension: "autonomia", prompt: "Participo das decisões que afetam diretamente minhas entregas." },
  { id: "B2_M_AUT_03", section: "momento", momentDimension: "autonomia", prompt: "Sei quais decisões posso tomar sem depender de nova autorização." },
  { id: "B2_M_CLA_01", section: "momento", momentDimension: "clareza", prompt: "Sei claramente o que se espera de mim neste momento." },
  { id: "B2_M_CLA_02", section: "momento", momentDimension: "clareza", prompt: "As prioridades do meu trabalho estão suficientemente claras." },
  { id: "B2_M_CLA_03", section: "momento", momentDimension: "clareza", prompt: "Conheço os critérios usados para avaliar a qualidade das minhas entregas." },
  { id: "B2_M_APO_01", section: "momento", momentDimension: "apoioReconhecimento", prompt: "Recebo apoio quando encontro obstáculos relevantes." },
  { id: "B2_M_APO_02", section: "momento", momentDimension: "apoioReconhecimento", prompt: "Tenho os recursos necessários para realizar meu trabalho." },
  { id: "B2_M_APO_03", section: "momento", momentDimension: "apoioReconhecimento", prompt: "Minhas contribuições são reconhecidas de forma coerente." },
  { id: "B2_M_REL_01", section: "momento", momentDimension: "relacoesSeguranca", prompt: "Posso pedir ajuda sem receio de ser desqualificado(a)." },
  { id: "B2_M_REL_02", section: "momento", momentDimension: "relacoesSeguranca", prompt: "Consigo discordar de forma respeitosa e ser ouvido(a)." },
  { id: "B2_M_REL_03", section: "momento", momentDimension: "relacoesSeguranca", prompt: "As relações de trabalho têm favorecido a cooperação." },
  { id: "B2_M_DES_01", section: "momento", momentDimension: "desenvolvimento", prompt: "Tenho oportunidades reais de aprender no trabalho atual." },
  { id: "B2_M_DES_02", section: "momento", momentDimension: "desenvolvimento", prompt: "Consigo utilizar capacidades importantes nas minhas atividades." },
  { id: "B2_M_DES_03", section: "momento", momentDimension: "desenvolvimento", prompt: "Consigo conversar com clareza sobre desenvolvimento e próximos desafios." },
];

const functionItems: FluxusV2Item[] = [
  { id: "B2_F_R_01", section: "funcao", dimension: "realizador", prompt: "Tomar decisões rápidas e assumir a condução de situações." },
  { id: "B2_F_R_02", section: "funcao", dimension: "realizador", prompt: "Enfrentar conflitos e defender posições com firmeza." },
  { id: "B2_F_C_01", section: "funcao", dimension: "comunicador", prompt: "Apresentar ideias e influenciar pessoas com frequência." },
  { id: "B2_F_C_02", section: "funcao", dimension: "comunicador", prompt: "Construir relacionamentos e ampliar redes de contato." },
  { id: "B2_F_P_01", section: "funcao", dimension: "planejador", prompt: "Manter rotina, constância e previsibilidade." },
  { id: "B2_F_P_02", section: "funcao", dimension: "planejador", prompt: "Apoiar pessoas com paciência e cooperação." },
  { id: "B2_F_A_01", section: "funcao", dimension: "analista", prompt: "Seguir processos e padrões com rigor." },
  { id: "B2_F_A_02", section: "funcao", dimension: "analista", prompt: "Analisar dados e detalhes antes de agir." },
];

const sustainabilityItems: FluxusV2Item[] = [
  { id: "B2_S_ENE_01", section: "sustentabilidade", indicator: "energia", prompt: "Tenho disposição suficiente para iniciar minha jornada de trabalho." },
  { id: "B2_S_ENE_02", section: "sustentabilidade", indicator: "energia", prompt: "Consigo sustentar minha energia nas atividades mais importantes." },
  { id: "B2_S_REC_01", section: "sustentabilidade", indicator: "recuperacao", prompt: "Consigo recuperar minha disposição após períodos mais intensos." },
  { id: "B2_S_REC_02", section: "sustentabilidade", indicator: "recuperacao", prompt: "Na maior parte dos dias, consigo me desconectar do trabalho no período de descanso." },
  { id: "B2_S_REG_01", section: "sustentabilidade", indicator: "autorregulacao", prompt: "Mantenho clareza para decidir quando estou sob pressão." },
  { id: "B2_S_REG_02", section: "sustentabilidade", indicator: "autorregulacao", prompt: "Consigo pausar antes de reagir em situações de tensão." },
  { id: "B2_S_PRE_01", section: "sustentabilidade", indicator: "pressao", prompt: "Tenho sentido que as demandas excedem os recursos ou o tempo disponíveis." },
  { id: "B2_S_PRE_02", section: "sustentabilidade", indicator: "pressao", prompt: "Tenho precisado reduzir pausas para acompanhar o trabalho." },
  { id: "B2_S_DES_01", section: "sustentabilidade", indicator: "desgaste", prompt: "Tenho terminado os dias de trabalho com sensação de esgotamento mental." },
  { id: "B2_S_DES_02", section: "sustentabilidade", indicator: "desgaste", prompt: "Tenho percebido maior distanciamento em relação ao meu trabalho." },
  { id: "B2_S_DES_03", section: "sustentabilidade", indicator: "desgaste", prompt: "Tenho sentido que o esforço exigido pelo trabalho se acumula de um dia para o outro." },
  { id: "B2_S_DES_04", section: "sustentabilidade", indicator: "desgaste", prompt: "Mesmo após períodos de descanso, continuo sentindo dificuldade para me recompor." },
];

export const FLUXUS_V2_ITEMS: FluxusV2Item[] = [
  ...behavioralItems,
  ...momentItems,
  ...functionItems,
  ...sustainabilityItems,
];
export const FLUXUS_V2_TOTAL_ITEMS = FLUXUS_V2_ITEMS.length;
export const FLUXUS_V2_ITEM_IDS = new Set(FLUXUS_V2_ITEMS.map(item => item.id));

export const FLUXUS_V2_SECTION_META: Record<
  FluxusV2Section,
  {
    title: string;
    description: string;
    lowLabel: string;
    highLabel: string;
  }
> = {
  comportamental: {
    title: "Bloco 1 · Perfil comportamental",
    description:
      "Responda pensando no modo como você costuma agir em diferentes situações de trabalho, e não apenas no momento atual.",
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
  momento: {
    title: "Bloco 2 · Momento atual",
    description: `Considere exclusivamente as ${FLUXUS_V2_REFERENCE_WINDOW}. Este bloco é autoral, inspirado na distinção entre perfil e contexto, mas não equivale ao PDA.`,
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
  funcao: {
    title: "Bloco 3A · Exigência percebida da função",
    description:
      "Avalie quanto sua função atual exige cada comportamento. Esta é sua percepção, não um perfil oficial do cargo.",
    lowLabel: "Quase nunca exige",
    highLabel: "Exige o tempo todo",
  },
  sustentabilidade: {
    title: "Bloco 3B · Índice Fluxus",
    description: `Considere as ${FLUXUS_V2_REFERENCE_WINDOW}. As respostas geram sinais de energia, recuperação, pressão e desgaste para orientar conversa e prevenção; não produzem diagnóstico clínico.`,
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
};

export type FluxusV2DimensionResult = {
  comportamental: number;
  natural: number;
  funcaoPercebida: number;
  demanda: number;
  demandaAbsoluta: number;
  faixaNatural: FluxusBand;
};

export type FluxusMomentResult = {
  score: number;
  faixa: FluxusBand;
  signal: "favoravel" | "acompanhar" | "priorizar_conversa";
};

export type FluxusSustainabilitySignal =
  | "Sustentável"
  | "Ponto de atenção"
  | "Conversa prioritária";

export type FluxusV2Result = {
  model: "fluxus_beta_2";
  instrumentVersion: string;
  formulaVersion: string;
  referenceWindow: string;
  dimensions: Record<FluxusDimension, FluxusV2DimensionResult>;
  predominante: FluxusDimension;
  maiorDemanda: FluxusDimension;
  distanciaMediaAdaptacao: number;
  maiorGap: number;
  dimensoesComDemandaRelevante: number;
  momento: Record<FluxusMomentDimension, FluxusMomentResult>;
  momentoGeral: number;
  indicadores: Record<
    FluxusSustainabilityIndicator,
    { score: number; faixa: FluxusBand; direction: "protective" | "risk" }
  >;
  indiceSustentabilidade: number;
  sustentabilidade: FluxusSustainabilitySignal;
  protectiveFactors: string[];
  attentionFactors: string[];
  completedAt: string;
};

const round = (value: number) => Math.round(value * 100) / 100;

function mean(values: number[]): number {
  if (!values.length)
    throw new Error("Não há respostas suficientes para calcular a média.");
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function fluxusV2Band(score: number): FluxusBand {
  if (score >= 5) return "Alta";
  if (score <= 3) return "Baixa";
  return "Moderada";
}

function normalizedValue(item: FluxusV2Item, value: number) {
  return item.reverse ? 8 - value : value;
}

export function sanitizeFluxusV2Answers(
  answers: Record<string, number>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([id, value]) =>
        FLUXUS_V2_ITEM_IDS.has(id) &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 7
    )
  );
}

export function getFluxusV2Completion(answers: Record<string, number>) {
  const clean = sanitizeFluxusV2Answers(answers);
  const completed = Object.keys(clean).length;
  return {
    completed,
    total: FLUXUS_V2_TOTAL_ITEMS,
    percentage: Math.round((completed / FLUXUS_V2_TOTAL_ITEMS) * 100),
    missingIds: FLUXUS_V2_ITEMS.filter(item => clean[item.id] === undefined).map(
      item => item.id
    ),
  };
}

function answersFor(
  clean: Record<string, number>,
  predicate: (item: FluxusV2Item) => boolean
): number[] {
  return FLUXUS_V2_ITEMS.filter(predicate)
    .map(item => {
      const value = clean[item.id]!;
      return Number.isFinite(value) ? normalizedValue(item, value) : NaN;
    })
    .filter(Number.isFinite);
}

function momentSignal(score: number): FluxusMomentResult["signal"] {
  if (score <= 3) return "priorizar_conversa";
  if (score < 4.5) return "acompanhar";
  return "favoravel";
}

export function calculateFluxusV2Result(
  answers: Record<string, number>,
  now = new Date()
): FluxusV2Result {
  const clean = sanitizeFluxusV2Answers(answers);
  const completion = getFluxusV2Completion(clean);
  if (completion.completed !== completion.total) {
    throw new Error(
      `Avaliação incompleta: faltam ${completion.total - completion.completed} respostas.`
    );
  }

  const dimensions = {} as Record<FluxusDimension, FluxusV2DimensionResult>;
  for (const dimension of FLUXUS_DIMENSIONS) {
    const comportamental = mean(
      answersFor(
        clean,
        item =>
          item.section === "comportamental" && item.dimension === dimension
      )
    );
    const funcaoPercebida = mean(
      answersFor(
        clean,
        item => item.section === "funcao" && item.dimension === dimension
      )
    );
    const demanda = round(funcaoPercebida - comportamental);
    dimensions[dimension] = {
      comportamental,
      natural: comportamental,
      funcaoPercebida,
      demanda,
      demandaAbsoluta: round(Math.abs(demanda)),
      faixaNatural: fluxusV2Band(comportamental),
    };
  }

  const momento = {} as Record<FluxusMomentDimension, FluxusMomentResult>;
  for (const dimension of FLUXUS_MOMENT_DIMENSIONS) {
    const score = mean(
      answersFor(clean, item => item.momentDimension === dimension)
    );
    momento[dimension] = {
      score,
      faixa: fluxusV2Band(score),
      signal: momentSignal(score),
    };
  }

  const indicadores = {} as FluxusV2Result["indicadores"];
  for (const indicator of FLUXUS_SUSTAINABILITY_INDICATORS) {
    const score = mean(answersFor(clean, item => item.indicator === indicator));
    indicadores[indicator] = {
      score,
      faixa: fluxusV2Band(score),
      direction: FLUXUS_SUSTAINABILITY_META[indicator].direction,
    };
  }

  const predominante = [...FLUXUS_DIMENSIONS].sort(
    (a, b) => dimensions[b].natural - dimensions[a].natural
  )[0]!;
  const maiorDemanda = [...FLUXUS_DIMENSIONS].sort(
    (a, b) => dimensions[b].demandaAbsoluta - dimensions[a].demandaAbsoluta
  )[0]!;
  const gaps = FLUXUS_DIMENSIONS.map(
    dimension => dimensions[dimension].demandaAbsoluta
  );
  const distanciaMediaAdaptacao = mean(gaps);
  const maiorGap = Math.max(...gaps);
  const dimensoesComDemandaRelevante = gaps.filter(gap => gap >= 1.5).length;
  const momentoGeral = mean(
    FLUXUS_MOMENT_DIMENSIONS.map(dimension => momento[dimension].score)
  );
  const protectiveAverage = mean([
    indicadores.energia.score,
    indicadores.recuperacao.score,
    indicadores.autorregulacao.score,
  ]);
  const riskAverage = mean([
    indicadores.pressao.score,
    indicadores.desgaste.score,
  ]);
  const indiceSustentabilidade = mean([
    momentoGeral,
    protectiveAverage,
    8 - riskAverage,
    Math.max(1, 7 - distanciaMediaAdaptacao),
  ]);

  const priorityCondition =
    indicadores.desgaste.score >= 5.5 ||
    (indicadores.pressao.score >= 5 && indicadores.recuperacao.score <= 3) ||
    (momento.engajamento.score <= 3 && indicadores.energia.score <= 3) ||
    (momento.cargaSustentavel.score <= 3 && indicadores.desgaste.score >= 5);
  const attentionCondition =
    indiceSustentabilidade < 4.5 ||
    indicadores.pressao.score >= 5 ||
    indicadores.desgaste.score >= 4.5 ||
    indicadores.energia.score <= 3 ||
    indicadores.recuperacao.score <= 3 ||
    distanciaMediaAdaptacao >= 1.5 ||
    maiorGap >= 1.5 ||
    FLUXUS_MOMENT_DIMENSIONS.some(
      dimension => momento[dimension].score <= 3
    );

  const sustentabilidade: FluxusSustainabilitySignal = priorityCondition
    ? "Conversa prioritária"
    : attentionCondition
      ? "Ponto de atenção"
      : "Sustentável";

  const protectiveFactors = [
    ...FLUXUS_MOMENT_DIMENSIONS.filter(
      dimension => momento[dimension].score >= 5
    ).map(dimension => FLUXUS_MOMENT_META[dimension].label),
    ...(["energia", "recuperacao", "autorregulacao"] as const)
      .filter(indicator => indicadores[indicator].score >= 5)
      .map(indicator => FLUXUS_SUSTAINABILITY_META[indicator].label),
  ];
  const attentionFactors = [
    ...FLUXUS_MOMENT_DIMENSIONS.filter(
      dimension => momento[dimension].score <= 3.5
    ).map(dimension => FLUXUS_MOMENT_META[dimension].label),
    ...(["energia", "recuperacao", "autorregulacao"] as const)
      .filter(indicator => indicadores[indicator].score <= 3.5)
      .map(indicator => FLUXUS_SUSTAINABILITY_META[indicator].label),
    ...(["pressao", "desgaste"] as const)
      .filter(indicator => indicadores[indicator].score >= 4.5)
      .map(indicator => FLUXUS_SUSTAINABILITY_META[indicator].label),
    ...(maiorGap >= 1.5
      ? [
          `Demanda de adaptação em ${FLUXUS_DIMENSION_META[maiorDemanda].label}`,
        ]
      : []),
  ];

  return {
    model: "fluxus_beta_2",
    instrumentVersion: FLUXUS_V2_INSTRUMENT_VERSION,
    formulaVersion: FLUXUS_V2_FORMULA_VERSION,
    referenceWindow: FLUXUS_V2_REFERENCE_WINDOW,
    dimensions,
    predominante,
    maiorDemanda,
    distanciaMediaAdaptacao,
    maiorGap: round(maiorGap),
    dimensoesComDemandaRelevante,
    momento,
    momentoGeral,
    indicadores,
    indiceSustentabilidade,
    sustentabilidade,
    protectiveFactors,
    attentionFactors,
    completedAt: now.toISOString(),
  };
}

export function getFluxusV2ItemsBySection(section: FluxusV2Section) {
  return FLUXUS_V2_ITEMS.filter(item => item.section === section);
}
