import { describe, expect, it, vi } from "vitest";
import {
  assignmentForUser,
  hasHierarchySnapshot,
  managerCandidates,
  refreshAfterMutation,
  returnedRecordName,
  sameAssignmentSnapshot,
} from "./feedbackScope";

const person = {
  id: 10,
  isCompanyAdmin: false,
  managerEligible: true,
  managerUserId: 20,
  departmentId: 7,
  assignmentId: 33,
  jobTitle: "Instrutor",
};

describe("hierarquia compartilhada e salvamento verificável", () => {
  it("não interpreta uma consulta antiga/incompleta como vínculo vazio", () => {
    expect(hasHierarchySnapshot(undefined)).toBe(false);
    expect(hasHierarchySnapshot({ id: 10, isCompanyAdmin: false })).toBe(false);
    expect(hasHierarchySnapshot(person)).toBe(true);
    expect(
      hasHierarchySnapshot({
        ...person,
        managerUserId: null,
        assignmentId: null,
        departmentId: null,
        jobTitle: null,
      })
    ).toBe(true);
  });
  it("usa apenas candidatos elegíveis e exclui a própria pessoa", () => {
    const other = { ...person, id: 20 };
    expect(
      managerCandidates(
        [person, other, { ...person, id: 30, managerEligible: false }],
        10
      ).map(p => p.id)
    ).toEqual([20]);
  });
  it("bloqueia confirmação após troca de gestor ou de revisão do vínculo", () => {
    expect(sameAssignmentSnapshot(person, 33, 20)).toBe(true);
    expect(sameAssignmentSnapshot(person, 32, 20)).toBe(false);
    expect(sameAssignmentSnapshot(person, 33, 21)).toBe(false);
    expect(sameAssignmentSnapshot(undefined, null, null)).toBe(false);
  });
  it("carrega exatamente o vínculo salvo e preserva cargo/departamento", () => {
    const saved = {
      id: 33,
      userId: 10,
      managerUserId: 20,
      departmentId: 7,
      jobTitle: "Instrutor",
    };
    expect(assignmentForUser([saved], 10)).toBe(saved);
    expect(assignmentForUser([saved], 11)).toBeUndefined();
  });
  it("mostra o nome retornado em vez de supor o nome enviado", () => {
    expect(returnedRecordName({ id: 4, name: " Infra " }, "Departamento")).toBe(
      "Infra"
    );
    expect(returnedRecordName({ id: 4 }, "Vínculo")).toBe("Vínculo #4");
  });
  it("não repete uma mutação quando o refresh falha ou resolve com erro", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("Conexão"));
    expect(await refreshAfterMutation(refresh)).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      await refreshAfterMutation(async () => ({
        isError: true,
        error: new Error("Conexão"),
      }))
    ).toBe(false);
    expect(await refreshAfterMutation(async () => ({ isError: false }))).toBe(
      true
    );
  });
});
