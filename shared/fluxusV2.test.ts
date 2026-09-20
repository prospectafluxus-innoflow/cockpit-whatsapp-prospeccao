import { describe, expect, it } from "vitest";
import { FLUXUS_ITEMS } from "./fluxus";
import {
  FLUXUS_V2_ITEMS,
  FLUXUS_V2_TOTAL_ITEMS,
  calculateFluxusV2Result,
  getFluxusV2Completion,
  sanitizeFluxusV2Answers,
} from "./fluxusV2";
import {
  calculateFluxusResultForVersion,
  getFluxusCompletionForVersion,
  isFluxusV2Result,
  prefillFluxusV2StableAnswers,
} from "./fluxusVersioning";

function beta2Answers(defaultValue = 4) {
  return Object.fromEntries(
    FLUXUS_V2_ITEMS.map(item => [item.id, defaultValue])
  );
}

function legacyAnswers(defaultValue = 4) {
  return Object.fromEntries(FLUXUS_ITEMS.map(item => [item.id, defaultValue]));
}

describe("Fluxus Persona Beta 2", () => {
  it("mantém IDs únicos e a arquitetura planejada", () => {
    expect(new Set(FLUXUS_V2_ITEMS.map(item => item.id)).size).toBe(
      FLUXUS_V2_TOTAL_ITEMS
    );
    expect(FLUXUS_V2_ITEMS.filter(item => item.section === "comportamental")).toHaveLength(20);
    expect(FLUXUS_V2_ITEMS.filter(item => item.section === "momento")).toHaveLength(21);
    expect(FLUXUS_V2_ITEMS.filter(item => item.section === "funcao")).toHaveLength(8);
    expect(FLUXUS_V2_ITEMS.filter(item => item.section === "sustentabilidade")).toHaveLength(12);
    expect(FLUXUS_V2_TOTAL_ITEMS).toBe(61);
  });

  it("calcula o perfil sem misturá-lo ao momento atual", () => {
    const answers = beta2Answers(4);
    for (const item of FLUXUS_V2_ITEMS) {
      if (item.section === "comportamental" && item.dimension === "realizador")
        answers[item.id] = 7;
      if (item.section === "momento") answers[item.id] = 1;
    }
    const result = calculateFluxusV2Result(answers);
    expect(result.dimensions.realizador.natural).toBe(7);
    expect(result.momentoGeral).toBeLessThanOrEqual(2);
  });

  it("inverte somente o item contextual redigido em sentido de risco", () => {
    const favorable = beta2Answers(4);
    favorable.B2_M_CAR_01 = 7;
    favorable.B2_M_CAR_02 = 7;
    favorable.B2_M_CAR_03 = 1;
    expect(calculateFluxusV2Result(favorable).momento.cargaSustentavel.score).toBe(7);

    favorable.B2_M_CAR_03 = 7;
    expect(calculateFluxusV2Result(favorable).momento.cargaSustentavel.score).toBe(5);
  });

  it("sinaliza conversa prioritária sem emitir diagnóstico", () => {
    const answers = beta2Answers(4);
    for (const item of FLUXUS_V2_ITEMS) {
      if (item.indicator === "pressao" || item.indicator === "desgaste")
        answers[item.id] = 7;
      if (item.indicator === "energia" || item.indicator === "recuperacao")
        answers[item.id] = 2;
    }
    const result = calculateFluxusV2Result(answers);
    expect(result.sustentabilidade).toBe("Conversa prioritária");
    expect(result.attentionFactors).toContain("Sinais de desgaste");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("diagnóstico");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("burnout");
  });

  it("mantém uma leitura sustentável quando os fatores são favoráveis", () => {
    const answers = beta2Answers(6);
    for (const item of FLUXUS_V2_ITEMS) {
      if (item.indicator === "pressao" || item.indicator === "desgaste")
        answers[item.id] = 2;
    }
    const result = calculateFluxusV2Result(answers);
    expect(result.sustentabilidade).toBe("Sustentável");
    expect(result.indiceSustentabilidade).toBeGreaterThanOrEqual(5);
  });

  it("sinaliza um único gap relevante de perfil e função a partir de 1,5", () => {
    const belowThreshold = beta2Answers(4);
    belowThreshold.B2_F_R_01 = 5;
    belowThreshold.B2_F_R_02 = 5;
    expect(calculateFluxusV2Result(belowThreshold).maiorGap).toBe(1);
    expect(calculateFluxusV2Result(belowThreshold).sustentabilidade).toBe(
      "Sustentável"
    );

    const relevantGap = beta2Answers(4);
    relevantGap.B2_F_R_01 = 6;
    relevantGap.B2_F_R_02 = 6;
    const result = calculateFluxusV2Result(relevantGap);
    expect(result.maiorGap).toBe(2);
    expect(result.sustentabilidade).toBe("Ponto de atenção");
    expect(result.attentionFactors).toContain(
      "Demanda de adaptação em Realizador"
    );
  });

  it("não aceita respostas ou IDs da Beta 1 no rascunho Beta 2", () => {
    const legacyId = FLUXUS_ITEMS[0]!.id;
    const beta2Id = FLUXUS_V2_ITEMS[0]!.id;
    expect(sanitizeFluxusV2Answers({ [legacyId]: 7, [beta2Id]: 6 })).toEqual({
      [beta2Id]: 6,
    });
  });

  it("reaproveita somente perfil e função de um ciclo Beta 1", () => {
    const reusableLegacyItems = FLUXUS_ITEMS.filter(item =>
      ["comportamental", "funcao"].includes(item.section)
    );
    for (const legacyItem of reusableLegacyItems) {
      const beta2Item = FLUXUS_V2_ITEMS.find(
        item => item.id === `B2_${legacyItem.id}`
      );
      expect(beta2Item?.prompt).toBe(legacyItem.prompt);
    }
    const prefilled = prefillFluxusV2StableAnswers(
      "1.0.0-beta.1",
      legacyAnswers(6)
    );
    expect(Object.keys(prefilled)).toHaveLength(28);
    expect(Object.keys(prefilled).every(id => id.startsWith("B2_C_") || id.startsWith("B2_F_"))).toBe(true);
    expect(getFluxusV2Completion(prefilled).completed).toBe(28);
    expect(getFluxusV2Completion(prefilled).missingIds).toHaveLength(33);
  });

  it("preserva conclusão e cálculo de rascunhos Beta 1", () => {
    const legacy = legacyAnswers(4);
    const current = beta2Answers(4);
    expect(getFluxusCompletionForVersion("1.0.0-beta.1", legacy).completed).toBe(FLUXUS_ITEMS.length);
    expect(getFluxusCompletionForVersion("2.0.0-beta.2", current).completed).toBe(FLUXUS_V2_TOTAL_ITEMS);

    const legacyResult = calculateFluxusResultForVersion("1.0.0-beta.1", legacy);
    const beta2Result = calculateFluxusResultForVersion("2.0.0-beta.2", current);
    expect(isFluxusV2Result(legacyResult)).toBe(false);
    expect(isFluxusV2Result(beta2Result)).toBe(true);
  });

  it("rejeita versões futuras não registradas", () => {
    expect(() =>
      getFluxusCompletionForVersion("2.1.0", beta2Answers(4))
    ).toThrow(/não suportada/i);
  });

  it("rejeita a conclusão Beta 2 quando faltam respostas", () => {
    const partial = { [FLUXUS_V2_ITEMS[0]!.id]: 4 };
    expect(getFluxusV2Completion(partial).completed).toBe(1);
    expect(() => calculateFluxusV2Result(partial)).toThrow(/incompleta/i);
  });
});
