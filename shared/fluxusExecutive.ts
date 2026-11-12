import { z } from "zod";
import type { FluxusDimension } from "./fluxus";
import type { ExecutiveComplementaryBundle } from "./fluxusManagerialComplementary";
import type {
  FluxusMomentDimension,
  FluxusSustainabilityIndicator,
  FluxusSustainabilitySignal,
  FluxusV2Result,
} from "./fluxusV2";

export const EXECUTIVE_MAX_PEOPLE = 200;
export const executiveSelectionSchema = z
  .object({
    companyId: z.number().int().positive().optional(),
    mode: z.enum(["individual", "team"]),
    assessmentIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(EXECUTIVE_MAX_PEOPLE),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.assessmentIds).size !== value.assessmentIds.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione cada avaliação apenas uma vez.",
        path: ["assessmentIds"],
      });
    if (value.mode === "individual" && value.assessmentIds.length !== 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O relatório individual deve conter uma pessoa.",
        path: ["assessmentIds"],
      });
  });
export const executiveIndividualNotesSchema = z.object({
  summary: z.string().max(5000).default(""),
  context: z.string().max(5000).default(""),
  recommendations: z.string().max(5000).default(""),
});
export const executiveNotesSchema = z.object({
  title: z.string().trim().max(180).default(""),
  audience: z.string().trim().max(240).default(""),
  author: z.string().trim().max(180).default(""),
  summary: z.string().max(5000).default(""),
  context: z.string().max(5000).default(""),
  actions: z.string().max(10000).default(""),
  individuals: z
    .record(z.string().regex(/^\d+$/), executiveIndividualNotesSchema)
    .refine(
      value => Object.keys(value).length <= EXECUTIVE_MAX_PEOPLE,
      "Quantidade de fichas excedida."
    )
    .default({}),
});
export type ExecutiveNotes = z.infer<typeof executiveNotesSchema>;
export type ExecutiveSelection = z.infer<typeof executiveSelectionSchema>;
export function emptyExecutiveNotes(): ExecutiveNotes {
  return executiveNotesSchema.parse({});
}
export type ExecutivePerson = {
  userId: number;
  name: string | null;
  jobTitle: string | null;
  department: string | null;
  assessmentId: number;
  cycleNumber: number;
  cycleLabel: string | null;
  completedAt: string;
  result: FluxusV2Result;
  complementary?: ExecutiveComplementaryBundle;
};
export type ExecutiveDirectoryEntry = Omit<
  ExecutivePerson,
  "result" | "complementary"
>;
export type ExecutiveAction = { title: string; text: string };
export type ExecutiveIndividualAnalysis = {
  summary: string;
  fitLabel: string;
  fitText: string;
  strengths: string[];
  attention: string[];
  actions: ExecutiveAction[];
};
export type ExecutiveAggregate = {
  count: number;
  indexMean: number;
  engagementMean: number;
  signalCounts: Record<FluxusSustainabilitySignal, number>;
  predominantCounts: Record<FluxusDimension, number>;
  profiles: Record<
    FluxusDimension,
    {
      natural: number;
      function: number;
      signedGap: number;
      absoluteGap: number;
    }
  >;
  moment: Record<FluxusMomentDimension, number>;
  indicators: Record<FluxusSustainabilityIndicator, number>;
  strongestMoment: FluxusMomentDimension;
  weakestMoment: FluxusMomentDimension;
  summary: string;
  actions: ExecutiveAction[];
};
export type ExecutiveDepartmentAggregate = {
  label: string;
  aggregate: ExecutiveAggregate;
};
export type ExecutiveDocumentData = {
  company: { id: number; name: string };
  mode: "individual" | "team";
  people: ExecutivePerson[];
  minimumRespondents: number;
  aggregate: ExecutiveAggregate | null;
  departments: ExecutiveDepartmentAggregate[];
  groupPrivacyNote: string;
  generatedAt: string;
};
export type ExecutiveSavedReport = {
  id: number;
  companyId: number;
  mode: "individual" | "team";
  assessmentIds: number[];
  notes: ExecutiveNotes;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ExecutivePreviewResponse = {
  data: ExecutiveDocumentData;
  notes: ExecutiveNotes;
  report: ExecutiveSavedReport | null;
  canEdit: boolean;
};
export type ExecutiveDirectoryResponse = {
  company: { id: number; name: string };
  people: ExecutiveDirectoryEntry[];
  minimumRespondents: number;
  limit: number;
  truncated: boolean;
};
export const EXECUTIVE_INTERPRETATION_NOTICE =
  "Resultados autorrelatados e exploratórios. Perfil não é competência; momento atual não é personalidade. A função é a exigência percebida pelo participante, não a descrição oficial do cargo. Sinais e diferenças orientam conversas: não são diagnóstico, ranking, aptidão nem base isolada para decisões de carreira ou desligamento.";
