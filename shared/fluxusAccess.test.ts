import { describe, expect, it } from "vitest";
import { canAccessFluxusIndividualReport } from "./fluxusAccess";

const manager = {
  role: "user",
  accountType: "fluxus",
  companyId: 10,
  fluxusRole: "manager",
};
const hr = { ...manager, fluxusRole: "hr" };
const collaborator = { ...manager, fluxusRole: "collaborator" };
const admin = { role: "admin", accountType: "prospecting", companyId: null };

describe("política de visibilidade individual Fluxus", () => {
  it("permite gestor, RH e administração somente na política ampla", () => {
    expect(canAccessFluxusIndividualReport(manager, "participant_manager_hr", 10)).toBe(true);
    expect(canAccessFluxusIndividualReport(hr, "participant_manager_hr", 10)).toBe(true);
    expect(canAccessFluxusIndividualReport(admin, "participant_manager_hr", 10)).toBe(true);
  });

  it("permite apenas RH organizacional na política participante e RH", () => {
    expect(canAccessFluxusIndividualReport(hr, "participant_hr", 10)).toBe(true);
    expect(canAccessFluxusIndividualReport(manager, "participant_hr", 10)).toBe(false);
    expect(canAccessFluxusIndividualReport(admin, "participant_hr", 10)).toBe(false);
  });

  it("nega terceiros, colaboradores e qualquer leitura na política participante", () => {
    expect(canAccessFluxusIndividualReport(collaborator, "participant_manager_hr", 10)).toBe(false);
    expect(canAccessFluxusIndividualReport({ ...manager, companyId: 99 }, "participant_manager_hr", 10)).toBe(false);
    expect(canAccessFluxusIndividualReport(hr, "participant_only", 10)).toBe(false);
    expect(canAccessFluxusIndividualReport(admin, "participant_only", 10)).toBe(false);
  });

  it("bloqueia relatórios Beta 2 sem aprovação organizacional explícita", () => {
    const beta2Pending = { beta2Context: true, beta2Approved: false };
    expect(
      canAccessFluxusIndividualReport(
        manager,
        "participant_manager_hr",
        10,
        beta2Pending
      )
    ).toBe(false);
    expect(
      canAccessFluxusIndividualReport(
        admin,
        "participant_manager_hr",
        10,
        beta2Pending
      )
    ).toBe(false);
  });

  it("mantém a política de papel e empresa após aprovação Beta 2", () => {
    const beta2Approved = { beta2Context: true, beta2Approved: true };
    expect(
      canAccessFluxusIndividualReport(
        manager,
        "participant_manager_hr",
        10,
        beta2Approved
      )
    ).toBe(true);
    expect(
      canAccessFluxusIndividualReport(
        { ...manager, companyId: 99 },
        "participant_manager_hr",
        10,
        beta2Approved
      )
    ).toBe(false);
  });
});
