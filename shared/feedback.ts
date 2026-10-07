import { z } from "zod";

export const FEEDBACK_METHOD_VERSION = "innoflow-eec-1.0";
export const FEEDBACK_ROLES = [
  "collaborator",
  "manager",
  "supermanager",
  "hr",
  "company_admin",
] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];
export const CYCLE_STATUSES = [
  "planned",
  "active",
  "closed",
  "cancelled",
] as const;
export type DevelopmentCycleStatus = (typeof CYCLE_STATUSES)[number];
export const FEEDBACK_STATUSES = [
  "draft",
  "completed",
  "debriefed",
  "released",
  "acknowledged",
  "closed",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  draft: "Rascunho",
  completed: "Concluído pelo gestor",
  debriefed: "Devolutiva realizada",
  released: "Liberado ao colaborador",
  acknowledged: "Ciência registrada",
  closed: "Encerrado",
};
export const CYCLE_STATUS_LABELS: Record<DevelopmentCycleStatus, string> = {
  planned: "Planejado",
  active: "Ativo",
  closed: "Encerrado",
  cancelled: "Cancelado",
};
export const FEEDBACK_ROLE_LABELS: Record<FeedbackRole, string> = {
  collaborator: "Colaborador",
  manager: "Gestor",
  supermanager: "Supergestor",
  hr: "RH",
  company_admin: "Administrador da empresa",
};
export type FeedbackCompetency = {
  id: string;
  name: string;
  definition: string;
};
export const FEEDBACK_COMPETENCIES: readonly FeedbackCompetency[] = [
  {
    id: "productivity",
    name: "Produtividade",
    definition:
      "Realiza as entregas acordadas dentro dos prazos, considerando prioridades, recursos e contexto.",
  },
  {
    id: "organization",
    name: "Organização",
    definition:
      "Prioriza, documenta e organiza as atividades conforme os métodos e acordos de trabalho.",
  },
  {
    id: "activity_updates",
    name: "Retorno das Atividades",
    definition:
      "Comunica andamento, conclusões, dúvidas e impedimentos em tempo adequado.",
  },
  {
    id: "availability",
    name: "Disponibilidade",
    definition:
      "Responde às necessidades da equipe dentro da jornada e dos acordos de atendimento, comunicando impedimentos.",
  },
  {
    id: "proactivity",
    name: "Proatividade",
    definition:
      "Propõe melhorias e toma iniciativas pertinentes, com alinhamento e avaliação dos impactos.",
  },
  {
    id: "punctuality",
    name: "Pontualidade",
    definition:
      "Cumpre horários e compromissos efetivamente acordados, considerando o modelo de trabalho.",
  },
  {
    id: "teamwork",
    name: "Trabalho em Equipe",
    definition:
      "Coopera, compartilha conhecimento e coordena atividades e dependências com outras pessoas.",
  },
  {
    id: "communication",
    name: "Comunicação Clara e Objetiva",
    definition:
      "Comunica-se com clareza, objetividade e respeito, confirmando o entendimento quando necessário.",
  },
  {
    id: "quality",
    name: "Qualidade das Entregas",
    definition:
      "Entrega resultados adequados aos critérios acordados, prevenindo retrabalho evitável.",
  },
  {
    id: "accountability",
    name: "Responsabilidade e Compromisso",
    definition:
      "Assume demandas e resultados, acompanha até a conclusão, sinaliza riscos e cumpre combinados sem cobranças recorrentes.",
  },
];
export const competencyIdsSchema = z
  .array(z.string())
  .min(1)
  .max(10)
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Não repita competências." });
    if (ids.some(id => !FEEDBACK_COMPETENCIES.some(item => item.id === id)))
      ctx.addIssue({
        code: "custom",
        message: "Escolha somente competências do catálogo padronizado.",
      });
  });
export function competencySnapshot(
  ids: readonly string[]
): FeedbackCompetency[] {
  const valid = competencyIdsSchema.parse([...ids]);
  return valid.map(id => ({
    ...FEEDBACK_COMPETENCIES.find(item => item.id === id)!,
  }));
}
export const feedbackItemSchema = z.object({
  competencyId: z.string(),
  score: z.number().int().min(0).max(6).nullable(),
  evidence: z.string().trim().max(5000),
  effect: z.string().trim().max(5000),
  advice: z.string().trim().max(5000),
  notes: z.string().trim().max(5000).default(""),
});
export type FeedbackItem = z.infer<typeof feedbackItemSchema>;
export type FeedbackClassification =
  | "development"
  | "constructive"
  | "positive";
export function classifyFeedback(score: number): FeedbackClassification {
  z.number().int().min(0).max(6).parse(score);
  return score <= 3 ? "development" : score <= 5 ? "constructive" : "positive";
}
export const FEEDBACK_CLASSIFICATION_LABELS: Record<
  FeedbackClassification,
  string
> = {
  development: "Pontos a desenvolver",
  constructive: "Construtiva — satisfatória",
  positive: "Positiva — surpreendente",
};
export const FEEDBACK_COLLABORATOR_LABELS: Record<
  FeedbackClassification,
  string
> = {
  development: "Oportunidades de desenvolvimento",
  constructive: "Práticas consistentes",
  positive: "Destaques positivos",
};
export const FEEDBACK_ACKNOWLEDGEMENT =
  "Registrar ciência confirma que você teve acesso a este feedback. Não significa concordância integral nem renúncia de direitos.";
export const FEEDBACK_PURPOSE =
  "Este feedback registra observações sobre comportamentos e entregas no período indicado. Seu objetivo é reconhecer contribuições, esclarecer expectativas e orientar o desenvolvimento.";
export const EEC_GUIDANCE = {
  evidence:
    "Descreva o fato ou a entrega observada, com período e contexto. Evite rótulos pessoais e suposições sobre intenção.",
  effect:
    "Informe o impacto verificável, distinguindo observação de interpretação e considerando recursos e prioridades.",
  advice:
    "Oriente o que manter, desenvolver ou mudar. Informe o apoio que o gestor ou a empresa oferecerá, quando necessário.",
};
export function validateFeedbackItems(
  items: FeedbackItem[],
  snapshot: readonly FeedbackCompetency[],
  complete = false
): FeedbackItem[] {
  const parsed = z.array(feedbackItemSchema).max(10).parse(items);
  const allowed = new Set(snapshot.map(c => c.id));
  if (
    new Set(parsed.map(i => i.competencyId)).size !== parsed.length ||
    parsed.some(i => !allowed.has(i.competencyId))
  ) {
    throw new Error(
      "Os itens precisam corresponder às competências deste ciclo, sem duplicação."
    );
  }
  if (
    complete &&
    (parsed.length !== snapshot.length ||
      parsed.some(
        i => i.score === null || !i.evidence || !i.effect || !i.advice
      ))
  ) {
    throw new Error(
      "Preencha nota, evidência, efeito e conselho de todas as competências para concluir."
    );
  }
  return parsed;
}
export function calculateFeedback(
  items: readonly FeedbackItem[],
  competencyCount: number
) {
  if (
    !Number.isInteger(competencyCount) ||
    competencyCount < 1 ||
    competencyCount > 10
  )
    throw new Error("Quantidade de competências inválida.");
  if (
    items.length > competencyCount ||
    new Set(items.map(i => i.competencyId)).size !== items.length
  )
    throw new Error("Itens inválidos para o cálculo.");
  items.forEach(item => feedbackItemSchema.parse(item));
  const scored = items.filter(
    (i): i is FeedbackItem & { score: number } => i.score !== null
  );
  const obtained = scored.reduce((sum, i) => sum + i.score, 0);
  const complete = scored.length === competencyCount;
  return {
    obtained,
    expected: competencyCount * 5,
    maximum: competencyCount * 6,
    difference: complete ? competencyCount * 5 - obtained : null,
    average: scored.length
      ? Math.round((obtained / scored.length) * 100) / 100
      : null,
    scoredCount: scored.length,
    competencyCount,
    complete,
  };
}
export const FEEDBACK_TRANSITIONS: Record<
  FeedbackStatus,
  readonly FeedbackStatus[]
> = {
  draft: ["completed"],
  completed: ["debriefed"],
  debriefed: ["released"],
  released: ["acknowledged"],
  acknowledged: ["closed"],
  closed: [],
};
export const CYCLE_TRANSITIONS: Record<
  DevelopmentCycleStatus,
  readonly DevelopmentCycleStatus[]
> = {
  planned: ["active", "cancelled"],
  active: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};
export function isFeedbackVisibleToParticipant(status: FeedbackStatus) {
  return (
    status === "released" || status === "acknowledged" || status === "closed"
  );
}
export type FeedbackHistoryEntry = {
  id: number;
  cycleId: number;
  cycleName: string;
  cycleStart: string;
  cycleEnd: string;
  cycleStatus: DevelopmentCycleStatus;
  status: FeedbackStatus;
  methodVersion: string;
  competencies: FeedbackCompetency[];
  items: FeedbackItem[];
};
export function consolidateFeedback(
  entries: readonly FeedbackHistoryEntry[],
  plannedCount?: number
) {
  const completed = entries
    .filter(e => e.status !== "draft" && e.cycleStatus !== "cancelled")
    .sort(
      (a, b) =>
        a.cycleStart.localeCompare(b.cycleStart) || a.cycleId - b.cycleId
    );
  const summaries = completed.map(e => ({
    ...e,
    calculation: calculateFeedback(e.items, e.competencies.length),
  }));
  const reliable = summaries.filter(e => e.calculation.complete);
  const signature = (e: FeedbackHistoryEntry) =>
    `${e.methodVersion}:${[...e.competencies]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(c => `${c.id}:${c.definition}`)
      .join("|")}`;
  const comparable =
    reliable.length < 2 ||
    reliable.every(e => signature(e) === signature(reliable[0]!));
  const byCompetency = Array.from(
    new Set(reliable.flatMap(e => e.competencies.map(c => c.id)))
  ).map(id => {
    const records = reliable.flatMap(e => {
      const competency = e.competencies.find(c => c.id === id);
      const item = e.items.find(i => i.competencyId === id);
      return competency && item && item.score !== null
        ? [
            {
              feedbackId: e.id,
              cycleId: e.cycleId,
              cycleName: e.cycleName,
              methodVersion: e.methodVersion,
              definition: competency.definition,
              name: competency.name,
              ...item,
            },
          ]
        : [];
    });
    const compatible = records.every(
      r =>
        r.methodVersion === records[0]?.methodVersion &&
        r.definition === records[0]?.definition
    );
    return {
      competencyId: id,
      name: records[0]?.name ?? id,
      comparable: compatible,
      records,
      delta:
        compatible && records.length > 1
          ? records.at(-1)!.score! - records[0]!.score!
          : null,
    };
  });
  return {
    completedCycles: reliable.length,
    plannedCycles: plannedCount ?? entries.length,
    partial: reliable.length < (plannedCount ?? entries.length),
    comparable,
    obtained: reliable.reduce((sum, e) => sum + e.calculation.obtained, 0),
    expected: reliable.reduce((sum, e) => sum + e.calculation.expected, 0),
    maximum: reliable.reduce((sum, e) => sum + e.calculation.maximum, 0),
    cycles: summaries,
    competencies: byCompetency,
  };
}
