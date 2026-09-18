export const FLUXUS_INSTRUMENT_VERSION = "1.0.0-beta.1";
export const FLUXUS_FORMULA_VERSION = "1.0.0-beta.1";

export const FLUXUS_DIMENSIONS = [
  "realizador",
  "comunicador",
  "planejador",
  "analista",
] as const;
export type FluxusDimension = (typeof FLUXUS_DIMENSIONS)[number];
export type FluxusSection =
  | "comportamental"
  | "tendencias"
  | "funcao"
  | "energia";
export type FluxusIndicator = "energia" | "autorregulacao";

export const FLUXUS_DIMENSION_META: Record<
  FluxusDimension,
  {
    label: string;
    shortLabel: string;
    color: string;
    definition: string;
    high: string;
    low: string;
  }
> = {
  realizador: {
    label: "Realizador",
    shortLabel: "Ação",
    color: "#ef5350",
    definition:
      "Tendência a decidir, assumir iniciativa, defender posições e enfrentar obstáculos.",
    high: "Tende a assumir a frente, decidir com agilidade e sustentar posições diante de obstáculos.",
    low: "Tende a ponderar mais, reduzir exposição ao risco e buscar participação antes de avançar.",
  },
  comunicador: {
    label: "Comunicador",
    shortLabel: "Relação",
    color: "#f6b44c",
    definition:
      "Tendência a se expressar, estabelecer relações, influenciar e buscar interação social.",
    high: "Tende a se expressar com abertura, criar conexões e mobilizar pessoas pela comunicação.",
    low: "Tende a se comunicar de forma mais reservada, objetiva e seletiva nas interações.",
  },
  planejador: {
    label: "Planejador",
    shortLabel: "Ritmo",
    color: "#43a97b",
    definition:
      "Tendência a manter constância, estabilidade de ritmo, paciência e continuidade.",
    high: "Tende a valorizar continuidade, cooperação, previsibilidade e acompanhamento constante.",
    low: "Tende a preferir variedade, velocidade e mudanças frequentes no ritmo de trabalho.",
  },
  analista: {
    label: "Analista",
    shortLabel: "Critério",
    color: "#4f82d1",
    definition:
      "Tendência a utilizar critérios, detalhes, dados, métodos e padrões antes de agir.",
    high: "Tende a estruturar decisões com critérios, evidências, detalhes e padrões de qualidade.",
    low: "Tende a experimentar, simplificar critérios e decidir com maior flexibilidade diante de detalhes.",
  },
};

export type FluxusItem = {
  id: string;
  section: FluxusSection;
  dimension?: FluxusDimension;
  indicator?: FluxusIndicator;
  prompt: string;
};

export const FLUXUS_ITEMS: FluxusItem[] = [
  // Comportamental — manifestações observáveis
  {
    id: "C_R_01",
    section: "comportamental",
    dimension: "realizador",
    prompt: "Assumo a frente quando uma decisão precisa ser tomada.",
  },
  {
    id: "C_R_02",
    section: "comportamental",
    dimension: "realizador",
    prompt:
      "Defendo meu ponto de vista com firmeza, mesmo diante de discordância.",
  },
  {
    id: "C_R_03",
    section: "comportamental",
    dimension: "realizador",
    prompt: "Tomo iniciativa sem esperar instruções detalhadas.",
  },
  {
    id: "C_R_04",
    section: "comportamental",
    dimension: "realizador",
    prompt: "Sinto-me confortável ao enfrentar situações difíceis.",
  },
  {
    id: "C_R_05",
    section: "comportamental",
    dimension: "realizador",
    prompt:
      "Decido com agilidade quando as informações essenciais estão disponíveis.",
  },
  {
    id: "C_C_01",
    section: "comportamental",
    dimension: "comunicador",
    prompt: "Expresso minhas ideias com facilidade em grupos.",
  },
  {
    id: "C_C_02",
    section: "comportamental",
    dimension: "comunicador",
    prompt: "Crio conexão rapidamente com pessoas que ainda não conheço.",
  },
  {
    id: "C_C_03",
    section: "comportamental",
    dimension: "comunicador",
    prompt: "Sinto-me confortável ao apresentar ou conduzir conversas.",
  },
  {
    id: "C_C_04",
    section: "comportamental",
    dimension: "comunicador",
    prompt: "Uso entusiasmo para mobilizar outras pessoas.",
  },
  {
    id: "C_C_05",
    section: "comportamental",
    dimension: "comunicador",
    prompt: "Busco interação frequente durante o trabalho.",
  },
  {
    id: "C_P_01",
    section: "comportamental",
    dimension: "planejador",
    prompt: "Mantenho um ritmo constante mesmo em atividades repetitivas.",
  },
  {
    id: "C_P_02",
    section: "comportamental",
    dimension: "planejador",
    prompt: "Escuto com paciência antes de apresentar minha posição.",
  },
  {
    id: "C_P_03",
    section: "comportamental",
    dimension: "planejador",
    prompt: "Prefiro mudanças planejadas a alterações repentinas.",
  },
  {
    id: "C_P_04",
    section: "comportamental",
    dimension: "planejador",
    prompt: "Demonstro constância no acompanhamento de compromissos.",
  },
  {
    id: "C_P_05",
    section: "comportamental",
    dimension: "planejador",
    prompt: "Contribuo para preservar cooperação e continuidade no time.",
  },
  {
    id: "C_A_01",
    section: "comportamental",
    dimension: "analista",
    prompt: "Confiro detalhes antes de concluir uma entrega.",
  },
  {
    id: "C_A_02",
    section: "comportamental",
    dimension: "analista",
    prompt: "Utilizo critérios claros para tomar decisões.",
  },
  {
    id: "C_A_03",
    section: "comportamental",
    dimension: "analista",
    prompt: "Organizo as etapas antes de iniciar uma atividade complexa.",
  },
  {
    id: "C_A_04",
    section: "comportamental",
    dimension: "analista",
    prompt: "Valorizo padrões e procedimentos que reduzem erros.",
  },
  {
    id: "C_A_05",
    section: "comportamental",
    dimension: "analista",
    prompt: "Procuro evidências antes de aceitar uma conclusão.",
  },

  // Tendências — preferências e orientação habitual
  {
    id: "T_R_01",
    section: "tendencias",
    dimension: "realizador",
    prompt:
      "Quando surge um obstáculo, minha tendência inicial é agir para superá-lo.",
  },
  {
    id: "T_R_02",
    section: "tendencias",
    dimension: "realizador",
    prompt: "Aceito assumir responsabilidade por decisões que envolvem risco.",
  },
  {
    id: "T_R_03",
    section: "tendencias",
    dimension: "realizador",
    prompt: "Prefiro ter autonomia para definir o caminho de execução.",
  },
  {
    id: "T_R_04",
    section: "tendencias",
    dimension: "realizador",
    prompt: "Estabeleço metas desafiadoras para mim.",
  },
  {
    id: "T_R_05",
    section: "tendencias",
    dimension: "realizador",
    prompt: "Sustento conversas difíceis quando elas são necessárias.",
  },
  {
    id: "T_C_01",
    section: "tendencias",
    dimension: "comunicador",
    prompt:
      "Minha energia aumenta quando posso trocar ideias com outras pessoas.",
  },
  {
    id: "T_C_02",
    section: "tendencias",
    dimension: "comunicador",
    prompt: "Adapto minha linguagem para engajar diferentes públicos.",
  },
  {
    id: "T_C_03",
    section: "tendencias",
    dimension: "comunicador",
    prompt: "Costumo construir relacionamentos que facilitam o trabalho.",
  },
  {
    id: "T_C_04",
    section: "tendencias",
    dimension: "comunicador",
    prompt: "Falo abertamente sobre minhas ideias e percepções.",
  },
  {
    id: "T_C_05",
    section: "tendencias",
    dimension: "comunicador",
    prompt: "Sinto satisfação em representar um projeto ou uma equipe.",
  },
  {
    id: "T_P_01",
    section: "tendencias",
    dimension: "planejador",
    prompt: "Prefiro concluir uma etapa antes de iniciar muitas outras.",
  },
  {
    id: "T_P_02",
    section: "tendencias",
    dimension: "planejador",
    prompt: "Consigo manter foco e constância em processos de longo prazo.",
  },
  {
    id: "T_P_03",
    section: "tendencias",
    dimension: "planejador",
    prompt: "Ofereço suporte de maneira paciente quando alguém precisa.",
  },
  {
    id: "T_P_04",
    section: "tendencias",
    dimension: "planejador",
    prompt: "Valorizo previsibilidade para organizar meu melhor trabalho.",
  },
  {
    id: "T_P_05",
    section: "tendencias",
    dimension: "planejador",
    prompt:
      "Antes de aderir a uma mudança, procuro compreender como ela será implementada.",
  },
  {
    id: "T_A_01",
    section: "tendencias",
    dimension: "analista",
    prompt: "Tenho facilidade para perceber inconsistências.",
  },
  {
    id: "T_A_02",
    section: "tendencias",
    dimension: "analista",
    prompt:
      "Quando o impacto é relevante, analiso alternativas antes de decidir.",
  },
  {
    id: "T_A_03",
    section: "tendencias",
    dimension: "analista",
    prompt: "Registro informações importantes para garantir rastreabilidade.",
  },
  {
    id: "T_A_04",
    section: "tendencias",
    dimension: "analista",
    prompt: "Prefiro critérios verificáveis a impressões isoladas.",
  },
  {
    id: "T_A_05",
    section: "tendencias",
    dimension: "analista",
    prompt: "Reviso meu trabalho para confirmar qualidade e precisão.",
  },

  // Exigência da função percebida pelo colaborador
  {
    id: "F_R_01",
    section: "funcao",
    dimension: "realizador",
    prompt: "Tomar decisões rápidas e assumir a condução de situações.",
  },
  {
    id: "F_R_02",
    section: "funcao",
    dimension: "realizador",
    prompt: "Enfrentar conflitos e defender posições com firmeza.",
  },
  {
    id: "F_C_01",
    section: "funcao",
    dimension: "comunicador",
    prompt: "Apresentar ideias e influenciar pessoas com frequência.",
  },
  {
    id: "F_C_02",
    section: "funcao",
    dimension: "comunicador",
    prompt: "Construir relacionamentos e ampliar redes de contato.",
  },
  {
    id: "F_P_01",
    section: "funcao",
    dimension: "planejador",
    prompt: "Manter rotina, constância e previsibilidade.",
  },
  {
    id: "F_P_02",
    section: "funcao",
    dimension: "planejador",
    prompt: "Apoiar pessoas com paciência e cooperação.",
  },
  {
    id: "F_A_01",
    section: "funcao",
    dimension: "analista",
    prompt: "Seguir processos e padrões com rigor.",
  },
  {
    id: "F_A_02",
    section: "funcao",
    dimension: "analista",
    prompt: "Analisar dados e detalhes antes de agir.",
  },

  // Indicadores complementares — autorrelato contextual, sem finalidade clínica
  {
    id: "E_E_01",
    section: "energia",
    indicator: "energia",
    prompt: "Tenho disposição suficiente para o ritmo atual de trabalho.",
  },
  {
    id: "E_E_02",
    section: "energia",
    indicator: "energia",
    prompt: "Consigo iniciar tarefas sem depender de estímulo externo.",
  },
  {
    id: "E_E_03",
    section: "energia",
    indicator: "energia",
    prompt: "Recupero minha disposição após períodos de esforço.",
  },
  {
    id: "E_E_04",
    section: "energia",
    indicator: "energia",
    prompt:
      "Consigo alternar entre demandas sem perder totalmente minha energia.",
  },
  {
    id: "E_G_01",
    section: "energia",
    indicator: "autorregulacao",
    prompt: "Mantenho clareza para decidir quando estou sob pressão.",
  },
  {
    id: "E_G_02",
    section: "energia",
    indicator: "autorregulacao",
    prompt: "Faço uma pausa antes de reagir em situações de tensão.",
  },
  {
    id: "E_G_03",
    section: "energia",
    indicator: "autorregulacao",
    prompt: "Recupero-me emocionalmente após contratempos profissionais.",
  },
  {
    id: "E_G_04",
    section: "energia",
    indicator: "autorregulacao",
    prompt: "Consigo separar a emoção do momento da decisão que preciso tomar.",
  },
];

export const FLUXUS_TOTAL_ITEMS = FLUXUS_ITEMS.length;
export const FLUXUS_ITEM_IDS = new Set(FLUXUS_ITEMS.map(item => item.id));

export type FluxusBand = "Baixa" | "Moderada" | "Alta";
export type FluxusCoherence = "Convergente" | "Parcial" | "Investigar";

export type FluxusDimensionResult = {
  comportamental: number;
  tendencias: number;
  natural: number;
  funcaoPercebida: number;
  demanda: number;
  demandaAbsoluta: number;
  diferencaInstrumentos: number;
  coerencia: FluxusCoherence;
  faixaNatural: FluxusBand;
};

export type FluxusResult = {
  instrumentVersion: string;
  formulaVersion: string;
  dimensions: Record<FluxusDimension, FluxusDimensionResult>;
  predominante: FluxusDimension;
  maiorDemanda: FluxusDimension;
  distanciaMediaAdaptacao: number;
  maiorGap: number;
  dimensoesComDemandaRelevante: number;
  energia: { score: number; faixa: FluxusBand };
  autorregulacao: { score: number; faixa: FluxusBand };
  sustentabilidade: "Favorável" | "Acompanhar" | "Atenção prioritária";
  completedAt: string;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function fluxusBand(score: number): FluxusBand {
  if (score >= 5) return "Alta";
  if (score <= 3) return "Baixa";
  return "Moderada";
}

export function fluxusCoherence(difference: number): FluxusCoherence {
  if (difference <= 0.75) return "Convergente";
  if (difference <= 1.5) return "Parcial";
  return "Investigar";
}

function mean(values: number[]): number {
  if (!values.length)
    throw new Error("Não há respostas suficientes para calcular a média.");
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function sanitizeFluxusAnswers(
  answers: Record<string, number>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([id, value]) =>
        FLUXUS_ITEM_IDS.has(id) &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 7
    )
  );
}

export function getFluxusCompletion(answers: Record<string, number>) {
  const clean = sanitizeFluxusAnswers(answers);
  const completed = Object.keys(clean).length;
  return {
    completed,
    total: FLUXUS_TOTAL_ITEMS,
    percentage: Math.round((completed / FLUXUS_TOTAL_ITEMS) * 100),
    missingIds: FLUXUS_ITEMS.filter(item => clean[item.id] === undefined).map(
      item => item.id
    ),
  };
}

function answersFor(
  clean: Record<string, number>,
  predicate: (item: FluxusItem) => boolean
): number[] {
  return FLUXUS_ITEMS.filter(predicate)
    .map(item => clean[item.id]!)
    .filter(Number.isFinite);
}

export function calculateFluxusResult(
  answers: Record<string, number>,
  now = new Date()
): FluxusResult {
  const clean = sanitizeFluxusAnswers(answers);
  const completion = getFluxusCompletion(clean);
  if (completion.completed !== completion.total) {
    throw new Error(
      `Avaliação incompleta: faltam ${completion.total - completion.completed} respostas.`
    );
  }

  const dimensions = {} as Record<FluxusDimension, FluxusDimensionResult>;
  for (const dimension of FLUXUS_DIMENSIONS) {
    const comportamental = mean(
      answersFor(
        clean,
        item =>
          item.section === "comportamental" && item.dimension === dimension
      )
    );
    const tendencias = mean(
      answersFor(
        clean,
        item => item.section === "tendencias" && item.dimension === dimension
      )
    );
    const natural = mean([comportamental, tendencias]);
    const funcaoPercebida = mean(
      answersFor(
        clean,
        item => item.section === "funcao" && item.dimension === dimension
      )
    );
    const demanda = round(funcaoPercebida - natural);
    const diferencaInstrumentos = round(Math.abs(comportamental - tendencias));
    dimensions[dimension] = {
      comportamental,
      tendencias,
      natural,
      funcaoPercebida,
      demanda,
      demandaAbsoluta: round(Math.abs(demanda)),
      diferencaInstrumentos,
      coerencia: fluxusCoherence(diferencaInstrumentos),
      faixaNatural: fluxusBand(natural),
    };
  }

  const energia = mean(answersFor(clean, item => item.indicator === "energia"));
  const autorregulacao = mean(
    answersFor(clean, item => item.indicator === "autorregulacao")
  );
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

  let sustentabilidade: FluxusResult["sustentabilidade"] = "Favorável";
  if (distanciaMediaAdaptacao >= 1.5 && autorregulacao <= 3) {
    sustentabilidade = "Atenção prioritária";
  } else if (
    distanciaMediaAdaptacao >= 1.5 ||
    maiorGap >= 2 ||
    autorregulacao <= 3
  ) {
    sustentabilidade = "Acompanhar";
  }

  return {
    instrumentVersion: FLUXUS_INSTRUMENT_VERSION,
    formulaVersion: FLUXUS_FORMULA_VERSION,
    dimensions,
    predominante,
    maiorDemanda,
    distanciaMediaAdaptacao,
    maiorGap: round(maiorGap),
    dimensoesComDemandaRelevante,
    energia: { score: energia, faixa: fluxusBand(energia) },
    autorregulacao: {
      score: autorregulacao,
      faixa: fluxusBand(autorregulacao),
    },
    sustentabilidade,
    completedAt: now.toISOString(),
  };
}

export const FLUXUS_SECTION_META: Record<
  FluxusSection,
  {
    title: string;
    description: string;
    lowLabel: string;
    highLabel: string;
  }
> = {
  comportamental: {
    title: "Como você costuma agir",
    description:
      "Considere comportamentos que aparecem com frequência no seu trabalho atual.",
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
  tendencias: {
    title: "Suas preferências de atuação",
    description:
      "Considere o que tende a acontecer naturalmente, antes de adaptar-se às expectativas do ambiente.",
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
  funcao: {
    title: "Exigência percebida da função",
    description:
      "Avalie quanto sua função atual exige cada comportamento. Esta é sua percepção da função, não um perfil oficial do cargo.",
    lowLabel: "Quase nunca exige",
    highLabel: "Exige o tempo todo",
  },
  energia: {
    title: "Energia e autorregulação percebidas",
    description:
      "Responda considerando as últimas semanas. Estes indicadores são contextuais e não possuem finalidade clínica.",
    lowLabel: "Discordo totalmente",
    highLabel: "Concordo totalmente",
  },
};

export function getFluxusItemsBySection(section: FluxusSection) {
  return FLUXUS_ITEMS.filter(item => item.section === section);
}
