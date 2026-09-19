import { describe, expect, it } from "vitest";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_ITEMS,
  FLUXUS_TOTAL_ITEMS,
  calculateFluxusResult,
  fluxusBand,
  getFluxusDevelopmentPriorities,
  getFluxusCompletion,
  sanitizeFluxusAnswers,
} from "./fluxus";

function answersWith(defaultValue = 4) {
  return Object.fromEntries(FLUXUS_ITEMS.map(item => [item.id, defaultValue]));
}

describe("Fluxus Persona Beta 1.0", () => {
  it("mantém IDs únicos e a quantidade planejada por seção", () => {
    expect(new Set(FLUXUS_ITEMS.map(item => item.id)).size).toBe(
      FLUXUS_TOTAL_ITEMS
    );
    expect(
      FLUXUS_ITEMS.filter(item => item.section === "comportamental")
    ).toHaveLength(20);
    expect(
      FLUXUS_ITEMS.filter(item => item.section === "tendencias")
    ).toHaveLength(20);
    expect(FLUXUS_ITEMS.filter(item => item.section === "funcao")).toHaveLength(
      8
    );
    expect(
      FLUXUS_ITEMS.filter(item => item.section === "energia")
    ).toHaveLength(8);
  });

  it("preserva o ponto 4 como faixa moderada", () => {
    expect(fluxusBand(4)).toBe("Moderada");
    expect(fluxusBand(3)).toBe("Baixa");
    expect(fluxusBand(5)).toBe("Alta");
  });

  it("remove respostas inválidas e itens desconhecidos", () => {
    const clean = sanitizeFluxusAnswers({
      [FLUXUS_ITEMS[0]!.id]: 7,
      [FLUXUS_ITEMS[1]!.id]: 0,
      [FLUXUS_ITEMS[2]!.id]: 4.5,
      desconhecido: 4,
    });
    expect(clean).toEqual({ [FLUXUS_ITEMS[0]!.id]: 7 });
  });

  it("não calcula relatório com respostas incompletas", () => {
    const partial = { [FLUXUS_ITEMS[0]!.id]: 4 };
    expect(getFluxusCompletion(partial).completed).toBe(1);
    expect(() => calculateFluxusResult(partial)).toThrow(/incompleta/i);
  });

  it("calcula neutralidade sem criar falsa demanda", () => {
    const result = calculateFluxusResult(
      answersWith(4),
      new Date("2026-09-17T12:00:00Z")
    );
    for (const dimension of FLUXUS_DIMENSIONS) {
      expect(result.dimensions[dimension].natural).toBe(4);
      expect(result.dimensions[dimension].funcaoPercebida).toBe(4);
      expect(result.dimensions[dimension].demanda).toBe(0);
      expect(result.dimensions[dimension].faixaNatural).toBe("Moderada");
      expect(result.dimensions[dimension].coerencia).toBe("Convergente");
    }
    expect(result.distanciaMediaAdaptacao).toBe(0);
    expect(result.sustentabilidade).toBe("Favorável");
  });

  it("mantém visível a divergência entre instrumentos mesmo com média natural moderada", () => {
    const answers = answersWith(4);
    for (const item of FLUXUS_ITEMS) {
      if (item.dimension === "realizador" && item.section === "comportamental")
        answers[item.id] = 7;
      if (item.dimension === "realizador" && item.section === "tendencias")
        answers[item.id] = 1;
    }
    const result = calculateFluxusResult(answers);
    expect(result.dimensions.realizador.comportamental).toBe(7);
    expect(result.dimensions.realizador.tendencias).toBe(1);
    expect(result.dimensions.realizador.natural).toBe(4);
    expect(result.dimensions.realizador.diferencaInstrumentos).toBe(6);
    expect(result.dimensions.realizador.coerencia).toBe("Investigar");
  });

  it("calcula direção, magnitude e maior demanda separadamente", () => {
    const answers = answersWith(4);
    for (const item of FLUXUS_ITEMS) {
      if (
        item.dimension === "planejador" &&
        ["comportamental", "tendencias"].includes(item.section)
      )
        answers[item.id] = 2;
      if (item.dimension === "planejador" && item.section === "funcao")
        answers[item.id] = 6;
    }
    const result = calculateFluxusResult(answers);
    expect(result.dimensions.planejador.natural).toBe(2);
    expect(result.dimensions.planejador.funcaoPercebida).toBe(6);
    expect(result.dimensions.planejador.demanda).toBe(4);
    expect(result.maiorDemanda).toBe("planejador");
    expect(result.maiorGap).toBe(4);
    expect(result.dimensoesComDemandaRelevante).toBe(1);
  });

  it("transforma demanda positiva relevante em prioridade para intensificar", () => {
    const answers = answersWith(4);
    for (const item of FLUXUS_ITEMS) {
      if (
        item.dimension === "planejador" &&
        ["comportamental", "tendencias"].includes(item.section)
      )
        answers[item.id] = 2;
      if (item.dimension === "planejador" && item.section === "funcao")
        answers[item.id] = 6;
    }

    const priorities = getFluxusDevelopmentPriorities(
      calculateFluxusResult(answers)
    );

    expect(priorities).toHaveLength(1);
    expect(priorities[0]).toMatchObject({
      dimension: "planejador",
      direction: "intensificar",
      gap: 4,
    });
    expect(priorities[0]?.practice).toMatch(/prioridades/i);
    expect(priorities[0]?.managerSupport).toMatch(/acompanhamento/i);
  });

  it("transforma demanda negativa relevante em prioridade para modular", () => {
    const answers = answersWith(4);
    for (const item of FLUXUS_ITEMS) {
      if (
        item.dimension === "comunicador" &&
        ["comportamental", "tendencias"].includes(item.section)
      )
        answers[item.id] = 7;
      if (item.dimension === "comunicador" && item.section === "funcao")
        answers[item.id] = 3;
    }

    const priorities = getFluxusDevelopmentPriorities(
      calculateFluxusResult(answers)
    );

    expect(priorities[0]).toMatchObject({
      dimension: "comunicador",
      direction: "modular",
      gap: -4,
    });
    expect(priorities[0]?.behavior).toMatch(/objetiva/i);
  });

  it("não inventa prioridade quando os gaps estão abaixo do limite", () => {
    const priorities = getFluxusDevelopmentPriorities(
      calculateFluxusResult(answersWith(4))
    );
    expect(priorities).toEqual([]);
  });
});
