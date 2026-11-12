import type {
  ComplementaryKind,
  ComplementaryValues,
  SaboteurKey,
} from "./fluxusComplementary";

export type ExecutiveComplementarySource = {
  id: number;
  revision: number;
  userId: number;
  assessmentId: number;
  kind: ComplementaryKind;
  sourceDate: string;
  confirmedAt: string;
  values: ComplementaryValues;
  context: string | null;
};
export type ExecutiveComplementaryBundle = {
  pq?: ExecutiveComplementarySource;
  saboteurs?: ExecutiveComplementarySource;
};
export type ManagerialPattern = {
  key: SaboteurKey;
  label: string;
  score: number;
  question: string;
  support: string;
};
export type ManagerialComplementaryReading = {
  sources: ExecutiveComplementaryBundle;
  summary: string;
  communication: { title: string; text: string; question: string };
  patterns: ManagerialPattern[];
  hasTies: boolean;
  actions: Array<{ title: string; text: string; question: string }>;
  followUp: string;
  notice: string;
};
export const MANAGERIAL_COMPLEMENTARY_NOTICE =
  "Leitura consultiva exploratória gerada a partir de autorrelatos distintos. Não há índice combinado, diagnóstico ou relação causal comprovada entre Persona, QP e Sabotadores. Confirme as hipóteses com a pessoa, o contexto e evidências observáveis. Não usar para decisões de contratação, promoção, remuneração ou desligamento.";
