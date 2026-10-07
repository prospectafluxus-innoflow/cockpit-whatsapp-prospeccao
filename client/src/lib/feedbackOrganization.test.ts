import { describe, expect, it } from "vitest";
import {
  departmentDescendantIds,
  departmentParentOptions,
  feedbackMembershipFingerprint,
  hydrateFeedbackMembership,
  isMembershipFormCurrent,
  parseOrganizationRouteIntent,
  scopeLabel,
} from "./feedbackOrganization";

const departments = [
  { id: 1, name: "Diretoria", parentId: null, active: true },
  { id: 2, name: "Operações", parentId: 1, active: true },
  { id: 3, name: "Campo", parentId: 2, active: true },
  { id: 4, name: "Arquivado", parentId: null, active: false },
];

describe("controles de organização do feedback", () => {
  it("hidrata o papel e a leitura salvos sem transformar papel em leitura", () => {
    expect(
      hydrateFeedbackMembership({
        id: 5,
        membershipRole: "manager",
        feedbackCanRead: false,
        hasFeedbackAccess: true,
      })
    ).toEqual({
      role: "manager",
      canReadFeedback: false,
      hasFeedbackAccess: true,
    });
    expect(hydrateFeedbackMembership({ id: 6, membershipRole: "hr" })).toEqual({
      role: "hr",
      canReadFeedback: false,
      hasFeedbackAccess: false,
    });
  });

  it("encontra descendentes e exclui a própria pessoa e toda a subárvore do pai", () => {
    expect([...departmentDescendantIds(departments, 1)]).toEqual([2, 3]);
    expect(
      departmentParentOptions(departments, 2).map(item => item.id)
    ).toEqual([1]);
    expect(
      departmentParentOptions(departments, 1).map(item => item.id)
    ).toEqual([]);
    expect(departmentParentOptions(departments).map(item => item.name)).toEqual(
      ["Campo", "Diretoria", "Operações"]
    );
  });

  it("bloqueia confirmação com seleção ou metadados invalidados por refetch", () => {
    const person = {
      id: 5,
      membershipId: 15,
      membershipRole: "manager" as const,
      feedbackCanRead: true,
      hasFeedbackAccess: true,
    };
    const fingerprint = feedbackMembershipFingerprint(person);
    expect(
      isMembershipFormCurrent({
        selectedUserId: 5,
        snapshotUserId: 5,
        snapshotFingerprint: fingerprint,
        person,
      })
    ).toBe(true);
    expect(
      isMembershipFormCurrent({
        selectedUserId: 5,
        snapshotUserId: 5,
        snapshotFingerprint: fingerprint,
        person: { ...person, feedbackCanRead: false },
      })
    ).toBe(false);
    expect(
      isMembershipFormCurrent({
        selectedUserId: 6,
        snapshotUserId: 5,
        snapshotFingerprint: fingerprint,
        person,
      })
    ).toBe(false);
  });

  it("aceita somente intenção de seleção da URL para quem pode configurar", () => {
    expect(
      parseOrganizationRouteIntent(
        "?section=organization&accessUserId=5&returnCycleId=4#papeis-feedback",
        true
      )
    ).toEqual({ section: "organization", accessUserId: 5, returnCycleId: 4 });
    expect(
      parseOrganizationRouteIntent(
        "?section=organization&accessUserId=-1&returnCycleId=abc",
        true
      )
    ).toEqual({ section: "organization" });
    expect(
      parseOrganizationRouteIntent(
        "?section=organization&accessUserId=5",
        false
      )
    ).toBeNull();
  });

  it("mantém o nome humano no resumo de escopo", () => {
    expect(scopeLabel(true, "Operações")).toBe("Operações e descendentes");
    expect(scopeLabel(false, "Campo")).toBe("Campo");
  });
});
