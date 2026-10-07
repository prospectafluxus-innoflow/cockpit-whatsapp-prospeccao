import { describe, expect, it } from "vitest";
import {
  evaluatorOptions,
  feedbackAccessUrl,
  resolveCycleEvaluator,
  type EvaluatorPerson,
} from "./feedbackEvaluator";

const employee: EvaluatorPerson = {
  id: 10,
  name: "Instrutor",
  eligible: true,
  assignmentId: 80,
  managerUserId: 20,
  hasFeedbackAccess: false,
  allowedEvaluatorIds: [20, 30],
};
const people: EvaluatorPerson[] = [
  employee,
  { id: 20, name: "Coordenador", eligible: false },
  { id: 30, name: "RH autorizado", eligible: false },
  { id: 40, name: "Outro gestor", eligible: true },
];

describe("avaliador do ciclo", () => {
  it("prefere gestor vigente sem exigir outra avaliação Persona do avaliador", () => {
    expect(resolveCycleEvaluator(employee, people, undefined)).toMatchObject({
      id: 20,
      name: "Coordenador",
      automatic: true,
      valid: true,
    });
  });
  it("preserva substituição explícita após refetch ou troca do gestor", () => {
    expect(
      resolveCycleEvaluator({ ...employee, managerUserId: 40 }, people, "30")
    ).toMatchObject({ id: 30, automatic: false, valid: true });
  });
  it("não usa escolha vazia como retorno silencioso ao gestor", () => {
    expect(resolveCycleEvaluator(employee, people, "").valid).toBe(false);
  });
  it("mostra gestor sem autorização e causa, sem promover seu papel", () => {
    const unavailable = people.map(person =>
      person.id === 20
        ? {
            ...person,
            evaluatorEligibilityReason:
              "A autorização de avaliação está desativada.",
          }
        : person
    );
    expect(
      resolveCycleEvaluator(
        { ...employee, allowedEvaluatorIds: [] },
        unavailable,
        undefined
      )
    ).toMatchObject({
      name: "Coordenador",
      valid: false,
      reason: "A autorização de avaliação está desativada.",
    });
  });
  it("não sugere pares, própria pessoa ou alguém ausente do diretório", () => {
    expect(
      evaluatorOptions(
        { ...employee, allowedEvaluatorIds: [10, 20, 30, 90] },
        people
      ).map(person => person.id)
    ).toEqual([20, 30]);
    expect(resolveCycleEvaluator(employee, people, "40").valid).toBe(false);
    expect(
      resolveCycleEvaluator(
        { ...employee, managerUserId: 90 },
        people,
        undefined
      ).valid
    ).toBe(false);
    expect(
      resolveCycleEvaluator(
        { ...employee, managerUserId: 10 },
        people,
        undefined
      ).valid
    ).toBe(false);
  });
  it("orienta ausência de vínculo ou análise pendente", () => {
    expect(
      resolveCycleEvaluator(
        { ...employee, assignmentId: null },
        people,
        undefined
      ).reason
    ).toContain("Atribuições");
    expect(
      resolveCycleEvaluator(
        {
          ...employee,
          eligible: false,
          eligibilityReason: "Persona incompleto",
        },
        people,
        undefined
      ).reason
    ).toBe("Persona incompleto");
  });
  it("gera atalho de configuração e retorno sem ação de escrita", () => {
    const url = feedbackAccessUrl(20, 4);
    expect(url).toContain("section=organization");
    expect(url).toContain("accessUserId=20");
    expect(url).toContain("returnCycleId=4");
    expect(feedbackAccessUrl(-20, 4)).not.toContain("accessUserId");
  });
});
