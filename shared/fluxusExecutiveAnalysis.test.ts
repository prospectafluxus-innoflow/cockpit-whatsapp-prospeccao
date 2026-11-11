import { describe, expect, it } from "vitest";
import { FLUXUS_V2_ITEMS, calculateFluxusV2Result } from "./fluxusV2";
import {
  buildExecutiveDocument,
  buildExecutiveIndividual,
} from "./fluxusExecutiveAnalysis";
import {
  executiveNotesSchema,
  executiveSelectionSchema,
  type ExecutivePerson,
} from "./fluxusExecutive";

function person(
  id: number,
  department = "Operações",
  value = 5
): ExecutivePerson {
  const result = calculateFluxusV2Result(
    Object.fromEntries(FLUXUS_V2_ITEMS.map(item => [item.id, value])),
    new Date("2026-11-01T12:00:00Z")
  );
  return {
    userId: id,
    name: `Pessoa de teste ${id}`,
    jobTitle: "Função fictícia",
    department,
    assessmentId: id * 10,
    cycleNumber: 1,
    cycleLabel: "Ciclo de teste",
    completedAt: "2026-11-01T12:00:00Z",
    result,
  };
}
const company = { id: 99, name: "Empresa de teste" };

describe("camada executiva Persona", () => {
  it("produz três ações e uma síntese responsável sem alterar os resultados", () => {
    const sample = person(1);
    const before = JSON.stringify(sample.result);
    const output = buildExecutiveIndividual(sample.result);
    expect(output.summary).toContain("No autorrelato");
    expect(output.summary).toContain(sample.result.sustentabilidade);
    expect(output.fitText).toContain("não inadequação");
    expect(output.actions).toHaveLength(3);
    expect(JSON.stringify(sample.result)).toBe(before);
  });
  it("não interpreta intensidade comportamental como competência ou promoção", () => {
    const output = buildExecutiveIndividual(person(1, "Operações", 7).result);
    expect(output.fitText).toContain(
      "não inadequação nem potencial comprovado"
    );
    expect(output.actions.map(action => action.text).join(" ")).not.toContain(
      "está apta"
    );
  });
  it("preserva o sinal canônico mesmo quando o índice é semelhante", () => {
    const sample = person(1);
    sample.result.sustentabilidade = "Conversa prioritária";
    const output = buildExecutiveIndividual(sample.result);
    expect(output.summary).toContain("Conversa prioritária");
    const data = buildExecutiveDocument(
      company,
      "team",
      Array.from({ length: 5 }, (_, index) => ({
        ...person(index + 1),
        result: sample.result,
      })),
      5
    );
    expect(data.aggregate?.signalCounts["Conversa prioritária"]).toBe(5);
  });
  it("não libera agregados abaixo de cinco, nem com política menor", () => {
    const data = buildExecutiveDocument(
      company,
      "team",
      [person(1), person(2), person(3), person(4)],
      3
    );
    expect(data.minimumRespondents).toBe(5);
    expect(data.aggregate).toBeNull();
    expect(data.departments).toEqual([]);
    expect(data.groupPrivacyNote).toContain("pelo menos 5");
  });
  it("respeita o mínimo superior configurado pela empresa", () => {
    const data = buildExecutiveDocument(
      company,
      "team",
      Array.from({ length: 7 }, (_, index) => person(index + 1)),
      8
    );
    expect(data.aggregate).toBeNull();
  });
  it("calcula médias a partir dos resultados, sem recalcular a metodologia", () => {
    const people = Array.from({ length: 5 }, (_, index) => person(index + 1));
    const data = buildExecutiveDocument(company, "team", people, 5);
    expect(data.aggregate?.indexMean).toBe(
      people[0].result.indiceSustentabilidade
    );
    expect(data.aggregate?.engagementMean).toBe(
      people[0].result.momento.engajamento.score
    );
    expect(
      Object.values(data.aggregate!.signalCounts).reduce((a, b) => a + b, 0)
    ).toBe(people.length);
    expect(
      Object.values(data.aggregate!.predominantCounts).reduce(
        (a, b) => a + b,
        0
      )
    ).toBe(people.length);
  });
  it("suprime partição 4/8 e seu complemento para evitar inferência", () => {
    const people = Array.from({ length: 12 }, (_, index) =>
      person(index + 1, index < 4 ? "Gestão" : "Instrução")
    );
    const data = buildExecutiveDocument(company, "team", people, 5);
    expect(data.aggregate?.count).toBe(12);
    expect(data.departments).toEqual([]);
    expect(data.groupPrivacyNote).toContain("complemento");
  });
  it("suprime toda a partição quando restaria um grupo pequeno dedutível", () => {
    const people = Array.from({ length: 11 }, (_, index) =>
      person(index + 1, index < 5 ? "A" : index < 10 ? "B" : "C")
    );
    expect(
      buildExecutiveDocument(company, "team", people, 5).departments
    ).toEqual([]);
  });
  it("libera apenas partições inteiramente válidas, com dados correspondentes", () => {
    const people = Array.from({ length: 10 }, (_, index) =>
      person(index + 1, index < 5 ? "A" : "B")
    );
    const data = buildExecutiveDocument(company, "team", people, 5);
    expect(data.departments.map(group => group.label)).toEqual(["A", "B"]);
    expect(data.departments.map(group => group.aggregate.count)).toEqual([
      5, 5,
    ]);
  });
  it("ficha individual não contém agregado de equipe", () => {
    const data = buildExecutiveDocument(company, "individual", [person(1)], 5);
    expect(data.aggregate).toBeNull();
    expect(data.departments).toEqual([]);
    expect(data.groupPrivacyNote).toBe("");
  });
  it("rejeita seleção duplicada por pessoa e tipos individuais com várias pessoas", () => {
    expect(() =>
      buildExecutiveDocument(company, "team", [person(1), person(1)], 5)
    ).toThrow("uma única avaliação");
    expect(() =>
      buildExecutiveDocument(company, "individual", [person(1), person(2)], 5)
    ).toThrow("Seleção inválida");
  });
  it("rejeita versões e indicadores incompatíveis", () => {
    const sample = person(1);
    sample.result.formulaVersion = "1.0.0-beta.1";
    expect(() => buildExecutiveIndividual(sample.result)).toThrow(
      "comparáveis"
    );
    const invalid = person(2);
    invalid.result.indiceSustentabilidade = NaN;
    expect(() => buildExecutiveIndividual(invalid.result)).toThrow("inválidos");
  });
  it("contrato valida duplicados, limites e textos opcionais", () => {
    expect(
      executiveSelectionSchema.safeParse({
        mode: "team",
        assessmentIds: [1, 1],
      }).success
    ).toBe(false);
    expect(
      executiveSelectionSchema.safeParse({
        mode: "individual",
        assessmentIds: [1, 2],
      }).success
    ).toBe(false);
    expect(
      executiveSelectionSchema.safeParse({
        mode: "team",
        assessmentIds: Array.from({ length: 201 }, (_, index) => index + 1),
      }).success
    ).toBe(false);
    expect(executiveNotesSchema.parse({}).summary).toBe("");
    expect(
      executiveNotesSchema.safeParse({ summary: "x".repeat(5001) }).success
    ).toBe(false);
  });
});
