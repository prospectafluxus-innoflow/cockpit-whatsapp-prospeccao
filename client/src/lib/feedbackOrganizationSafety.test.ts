import { describe, expect, it } from "vitest";
import {
  hasKnownFeedbackMembership,
  isMembershipFormCurrent,
  feedbackMembershipFingerprint,
  feedbackRoleReach,
  canConfirmFeedbackMembership,
} from "./feedbackOrganization";
import { fullAssignmentSnapshotMatches } from "./feedbackScope";

describe("confirmação segura de papéis e vínculos", () => {
  it("bloqueia DTO antigo, incompleto ou contraditório", () => {
    expect(hasKnownFeedbackMembership({ id: 5 })).toBe(false);
    expect(
      hasKnownFeedbackMembership({
        id: 5,
        membershipRole: "company_admin",
        feedbackCanRead: false,
        hasFeedbackAccess: true,
      })
    ).toBe(false);
    const missing = {
      id: 5,
      membershipRole: null,
      membershipId: null,
      feedbackCanRead: false,
      hasFeedbackAccess: false,
    };
    expect(hasKnownFeedbackMembership(missing)).toBe(true);
    const person = {
      id: 5,
      membershipId: 15,
      membershipRole: "company_admin" as const,
      feedbackCanRead: false,
      hasFeedbackAccess: true,
    };
    expect(hasKnownFeedbackMembership(person)).toBe(true);
    expect(
      isMembershipFormCurrent({
        selectedUserId: 5,
        snapshotUserId: 5,
        snapshotFingerprint: feedbackMembershipFingerprint(person),
        person: { ...person, membershipId: 16 },
      })
    ).toBe(false);
  });
  it("admin/RH têm alcance global mesmo com escopo antigo de departamentos", () => {
    expect(feedbackRoleReach("company_admin", ["TI"])).toBe("empresa inteira");
    expect(feedbackRoleReach("hr", ["TI"])).toBe("empresa inteira");
    expect(feedbackRoleReach("manager", ["TI"])).toBe("equipe direta");
    expect(feedbackRoleReach("supermanager", ["TI"])).toBe("TI");
    expect(feedbackRoleReach("supermanager", [])).toContain(
      "nenhum departamento"
    );
  });
  it("bloqueia confirmação durante refetch ou em empresa diferente", () => {
    const base = {
      current: true,
      queryBusy: false,
      companyId: 1,
      membershipCompanyId: 1,
      membershipRole: "company_admin" as const,
    };
    expect(canConfirmFeedbackMembership(base)).toBe(true);
    expect(canConfirmFeedbackMembership({ ...base, queryBusy: true })).toBe(
      false
    );
    expect(
      canConfirmFeedbackMembership({ ...base, membershipCompanyId: 2 })
    ).toBe(false);
    expect(
      canConfirmFeedbackMembership({ ...base, membershipRole: "hr" })
    ).toBe(false);
  });
  it("não usa vínculo novo de refetch para confirmar campos antigos", () => {
    const loaded = {
      id: 10,
      userId: 3,
      managerUserId: 5,
      departmentId: 7,
      jobTitle: "Instrutor",
    };
    expect(fullAssignmentSnapshotMatches(loaded, { ...loaded })).toBe(true);
    expect(
      fullAssignmentSnapshotMatches(loaded, {
        ...loaded,
        id: 11,
        managerUserId: 6,
      })
    ).toBe(false);
    expect(
      fullAssignmentSnapshotMatches(loaded, { ...loaded, departmentId: 8 })
    ).toBe(false);
    expect(
      fullAssignmentSnapshotMatches(loaded, {
        ...loaded,
        jobTitle: "Coordenador",
      })
    ).toBe(false);
    expect(fullAssignmentSnapshotMatches(null, undefined)).toBe(true);
    expect(fullAssignmentSnapshotMatches(null, loaded)).toBe(false);
  });
});
