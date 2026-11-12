import { describe, expect, it } from "vitest";
import { calculateFluxusV2Result, FLUXUS_V2_ITEMS } from "./fluxusV2";
import type { ExecutivePerson } from "./fluxusExecutive";
import type { ExecutiveComplementarySource } from "./fluxusManagerialComplementary";
import { SABOTEUR_LABELS } from "./fluxusComplementary";
import { buildManagerialComplementary } from "./fluxusManagerialComplementaryAnalysis";
function person(): ExecutivePerson {
  return {
    userId: 7,
    assessmentId: 70,
    name: "Pessoa fictícia",
    jobTitle: "Função",
    department: "Grupo",
    cycleNumber: 1,
    cycleLabel: "Teste",
    completedAt: "2026-11-01T12:00:00Z",
    result: calculateFluxusV2Result(
      Object.fromEntries(FLUXUS_V2_ITEMS.map(i => [i.id, 5])),
      new Date("2026-11-01T12:00:00Z")
    ),
  };
}
function source(kind: "pq" | "saboteurs"): ExecutiveComplementarySource {
  return {
    id: 1,
    revision: 2,
    userId: 7,
    assessmentId: 70,
    kind,
    sourceDate: "2026-11-11",
    confirmedAt: "2026-11-11T12:00:00Z",
    context: null,
    values:
      kind === "pq"
        ? { pq: 47, saboteurs: {}, critic: {} }
        : {
            pq: null,
            saboteurs: Object.fromEntries(
              Object.keys(SABOTEUR_LABELS).map(k => [k, 4.5])
            ),
            critic: { self: 8 },
          },
  };
}
describe("leitura gerencial complementar exploratória", () => {
  it("omite seção sem fontes e não cria resultados", () => {
    expect(buildManagerialComplementary(person())).toBeNull();
  });
  it("mantém PQ zero válido e não exige Sabotadores", () => {
    const p = person();
    const pq = source("pq");
    pq.values.pq = 0;
    p.complementary = { pq };
    const r = buildManagerialComplementary(p)!;
    expect(r.sources.pq?.values.pq).toBe(0);
    expect(r.sources.saboteurs).toBeUndefined();
    expect(r.summary).toContain("QP 0 / 100");
    expect(r.patterns).toEqual([]);
  });
  it("separa escalas e datas sem índice combinado ou causalidade", () => {
    const p = person();
    p.complementary = { pq: source("pq"), saboteurs: source("saboteurs") };
    const before = JSON.stringify(p);
    const r = buildManagerialComplementary(p)!;
    expect(r.notice).toContain("Não há índice combinado");
    expect(r.summary).toContain("não prova relação causal");
    expect(r.summary).toContain("2026-11-11");
    expect(JSON.stringify(p)).toBe(before);
  });
  it("preserva decimais e mantém ordem fixa sem priorizar as notas", () => {
    const p = person();
    p.complementary = { saboteurs: source("saboteurs") };
    const r = buildManagerialComplementary(p)!;
    expect(r.patterns).toHaveLength(9);
    expect(r.hasTies).toBe(false);
    expect(r.patterns.map(p => p.key)).toEqual(Object.keys(SABOTEUR_LABELS));
    expect(r.patterns[0].score).toBe(4.5);
    expect(r.patterns.every(p => p.question.endsWith("?"))).toBe(true);
    expect(r.sources.pq).toBeUndefined();
  });
  it("preserva zeros reais sem criar seleção de padrões por nota", () => {
    const p = person();
    const s = source("saboteurs");
    for (const key of Object.keys(s.values.saboteurs))
      s.values.saboteurs[key as keyof typeof s.values.saboteurs] = 0;
    p.complementary = { saboteurs: s };
    expect(
      buildManagerialComplementary(p)!.patterns.every(item => item.score === 0)
    ).toBe(true);
  });
  it("ignora fontes de outro titular, ciclo, tipo ou com escala inválida", () => {
    for (const patch of [
      { userId: 8 },
      { assessmentId: 80 },
      { kind: "saboteurs" },
      { sourceDate: "2026-02-30" },
      { revision: 0 },
    ]) {
      const p = person();
      p.complementary = {
        pq: { ...source("pq"), ...patch } as ExecutiveComplementarySource,
      };
      expect(buildManagerialComplementary(p)).toBeNull();
    }
    const p = person();
    const s = source("saboteurs");
    s.values.saboteurs.stickler = 11;
    p.complementary = { saboteurs: s };
    expect(buildManagerialComplementary(p)).toBeNull();
  });
  it("omite apenas a fonte inválida quando a outra permanece válida", () => {
    const p = person();
    p.complementary = {
      pq: source("pq"),
      saboteurs: { ...source("saboteurs"), userId: 99 },
    };
    const r = buildManagerialComplementary(p)!;
    expect(r.sources.pq).toBeDefined();
    expect(r.sources.saboteurs).toBeUndefined();
  });
  it("orienta apoio e acompanhamento sem disponibilidade fora da jornada", () => {
    const p = person();
    p.complementary = { pq: source("pq") };
    const r = buildManagerialComplementary(p)!;
    expect(r.communication.text).toContain("hipótese");
    expect(r.followUp).toContain(
      "Não pressupor disponibilidade fora da jornada"
    );
    expect(r.notice).toContain("Não usar para decisões");
    expect(r.followUp).toContain("Cópias já exportadas");
  });
});
