import {
  FLUXUS_FORMULA_VERSION as FLUXUS_V1_FORMULA_VERSION,
  FLUXUS_INSTRUMENT_VERSION as FLUXUS_V1_INSTRUMENT_VERSION,
  FLUXUS_ITEMS,
  FLUXUS_SECTION_META,
  calculateFluxusResult,
  getFluxusCompletion,
  sanitizeFluxusAnswers,
  type FluxusResult,
  type FluxusSection,
} from "./fluxus";
import {
  FLUXUS_V2_FORMULA_VERSION,
  FLUXUS_V2_INSTRUMENT_VERSION,
  FLUXUS_V2_ITEMS,
  FLUXUS_V2_SECTIONS,
  FLUXUS_V2_SECTION_META,
  calculateFluxusV2Result,
  getFluxusV2Completion,
  sanitizeFluxusV2Answers,
  type FluxusV2Result,
  type FluxusV2Section,
} from "./fluxusV2";

export const CURRENT_FLUXUS_INSTRUMENT_VERSION = FLUXUS_V2_INSTRUMENT_VERSION;
export const CURRENT_FLUXUS_FORMULA_VERSION = FLUXUS_V2_FORMULA_VERSION;

export type FluxusStoredResult = FluxusResult | FluxusV2Result;
export type FluxusVersionedSection = FluxusSection | FluxusV2Section;
export type FluxusVersionedItem = {
  id: string;
  section: FluxusVersionedSection;
  prompt: string;
};
export type FluxusVersionedSectionMeta = {
  title: string;
  description: string;
  lowLabel: string;
  highLabel: string;
};

export function isFluxusV2Version(version?: string | null): boolean {
  return version === FLUXUS_V2_INSTRUMENT_VERSION;
}

export function isFluxusV1Version(version?: string | null): boolean {
  return !version || version === FLUXUS_V1_INSTRUMENT_VERSION;
}

export function isSupportedFluxusVersion(version?: string | null): boolean {
  return isFluxusV1Version(version) || isFluxusV2Version(version);
}

function resolveFluxusVersion(version?: string | null): "v1" | "v2" {
  if (version === FLUXUS_V2_INSTRUMENT_VERSION) return "v2";
  if (isFluxusV1Version(version)) return "v1";
  throw new Error(`Versão de instrumento Fluxus não suportada: ${version}`);
}

export function isFluxusV2Result(
  result: FluxusStoredResult
): result is FluxusV2Result {
  return (
    "model" in result &&
    result.model === "fluxus_beta_2" &&
    result.instrumentVersion === FLUXUS_V2_INSTRUMENT_VERSION &&
    result.formulaVersion === FLUXUS_V2_FORMULA_VERSION
  );
}

export function getFluxusDefinition(version?: string | null) {
  if (resolveFluxusVersion(version) === "v2") {
    return {
      instrumentVersion: FLUXUS_V2_INSTRUMENT_VERSION,
      formulaVersion: FLUXUS_V2_FORMULA_VERSION,
      sections: [...FLUXUS_V2_SECTIONS] as FluxusVersionedSection[],
      items: FLUXUS_V2_ITEMS,
      sectionMeta: FLUXUS_V2_SECTION_META,
    };
  }
  return {
    instrumentVersion: FLUXUS_V1_INSTRUMENT_VERSION,
    formulaVersion: FLUXUS_V1_FORMULA_VERSION,
    sections: [
      "comportamental",
      "tendencias",
      "funcao",
      "energia",
    ] as FluxusVersionedSection[],
    items: FLUXUS_ITEMS,
    sectionMeta: FLUXUS_SECTION_META,
  };
}

export function getFluxusItemsForVersion(
  version: string | null | undefined,
  section?: FluxusVersionedSection
): FluxusVersionedItem[] {
  const definition = getFluxusDefinition(version);
  const items: FluxusVersionedItem[] = definition.items;
  return section ? items.filter(item => item.section === section) : items;
}

export function getFluxusSectionsForVersion(
  version: string | null | undefined
): FluxusVersionedSection[] {
  return getFluxusDefinition(version).sections;
}

export function getFluxusSectionMetaForVersion(
  version: string | null | undefined,
  section: FluxusVersionedSection
): FluxusVersionedSectionMeta {
  const definition = getFluxusDefinition(version);
  return definition.sectionMeta[
    section as keyof typeof definition.sectionMeta
  ] as FluxusVersionedSectionMeta;
}

export function sanitizeFluxusAnswersForVersion(
  version: string | null | undefined,
  answers: Record<string, number>
) {
  return resolveFluxusVersion(version) === "v2"
    ? sanitizeFluxusV2Answers(answers)
    : sanitizeFluxusAnswers(answers);
}

export function getFluxusCompletionForVersion(
  version: string | null | undefined,
  answers: Record<string, number>
) {
  return resolveFluxusVersion(version) === "v2"
    ? getFluxusV2Completion(answers)
    : getFluxusCompletion(answers);
}

export function calculateFluxusResultForVersion(
  version: string | null | undefined,
  answers: Record<string, number>,
  now = new Date()
): FluxusStoredResult {
  return resolveFluxusVersion(version) === "v2"
    ? calculateFluxusV2Result(answers, now)
    : calculateFluxusResult(answers, now);
}

export function prefillFluxusV2StableAnswers(
  sourceVersion: string | null | undefined,
  sourceAnswers: Record<string, number>
): Record<string, number> {
  if (resolveFluxusVersion(sourceVersion) === "v2") {
    return sanitizeFluxusV2Answers(
      Object.fromEntries(
        FLUXUS_V2_ITEMS.filter(item =>
          ["comportamental", "funcao"].includes(item.section)
        )
          .filter(item => sourceAnswers[item.id] !== undefined)
          .map(item => [item.id, sourceAnswers[item.id]!])
      )
    );
  }

  const mapped = Object.fromEntries(
    FLUXUS_ITEMS.filter(item =>
      ["comportamental", "funcao"].includes(item.section)
    )
      .filter(item => sourceAnswers[item.id] !== undefined)
      .map(item => [`B2_${item.id}`, sourceAnswers[item.id]!])
  );
  return sanitizeFluxusV2Answers(mapped);
}
