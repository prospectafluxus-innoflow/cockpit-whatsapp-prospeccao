import { describe, expect, it } from "vitest";
import { canConfirmCompanyAdministrator } from "./companyAdministrator";

const input = () => ({
  companyId: 7,
  selection: { companyId: 7, person: { id: 5 }, expectedIsAdmin: false },
  workspace: {
    enabled: true,
    companyId: 7,
    people: [{ id: 5, isCompanyAdmin: false }],
  },
  error: null as unknown,
  isFetching: false,
  isPending: false,
});
describe("Guard da confirmação de administrador", () => {
  it("permite confirmar somente a seleção válida da empresa atual", () => {
    expect(canConfirmCompanyAdministrator(input())).toBe(true);
    expect(
      canConfirmCompanyAdministrator({ ...input(), selection: null })
    ).toBe(false);
  });
  it("bloqueia confirmação quando o refetch falha mesmo mantendo dados em cache", () => {
    expect(
      canConfirmCompanyAdministrator({
        ...input(),
        error: new Error("Refetch falhou"),
      })
    ).toBe(false);
  });
  it("bloqueia consulta pendente, mutação pendente e módulo desabilitado", () => {
    expect(
      canConfirmCompanyAdministrator({ ...input(), isFetching: true })
    ).toBe(false);
    expect(
      canConfirmCompanyAdministrator({ ...input(), isPending: true })
    ).toBe(false);
    const data = input();
    data.workspace.enabled = false;
    expect(canConfirmCompanyAdministrator(data)).toBe(false);
  });
  it("bloqueia troca de empresa, candidato ausente e estado concorrente", () => {
    const data = input();
    data.workspace.companyId = 9;
    expect(canConfirmCompanyAdministrator(data)).toBe(false);
    data.workspace.companyId = 7;
    data.workspace.people = [];
    expect(canConfirmCompanyAdministrator(data)).toBe(false);
    data.workspace.people = [{ id: 5, isCompanyAdmin: true }];
    expect(canConfirmCompanyAdministrator(data)).toBe(false);
  });
});
