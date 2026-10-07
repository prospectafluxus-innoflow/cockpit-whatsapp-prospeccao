import { describe, expect, it, afterEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { feedbackRouter } from "./routers/feedback";
import { setFeedbackEnabledResolverForTests } from "./feedbackDb";

vi.mock("./db", () => ({ db: {} }));

function context(overrides: Record<string, unknown> = {}): TrpcContext {
  return {
    user: {
      id: 10,
      name: "Colaborador",
      role: "user",
      accountType: "fluxus",
      companyId: 7,
      approvalStatus: "approved",
      privacyDeletedAt: null,
      ...overrides,
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  setFeedbackEnabledResolverForTests(null);
});

describe("feedback rollout flag", () => {
  it("returns workspace vazio e não toca as tabelas novas quando desabilitado", async () => {
    setFeedbackEnabledResolverForTests(() => false);
    const result = await feedbackRouter
      .createCaller(context())
      .workspace({ companyId: 7 });
    expect(result).toEqual({
      enabled: false,
      moduleEnabled: false,
      unavailableReason: "module_disabled",
      companyId: 7,
      companyName: null,
      membership: null,
      canConfigure: false,
      canReadContent: false,
      catalog: [],
      settings: null,
      departments: [],
      people: [],
      assignments: [],
      scopes: [],
      cycles: [],
      feedbacks: [],
      pendingCorrections: 0,
    });
  });

  it("distingue empresa ausente de módulo desligado sem acessar banco", async () => {
    setFeedbackEnabledResolverForTests(() => true);
    const result = await feedbackRouter
      .createCaller(context({ companyId: null }))
      .workspace();
    expect(result).toMatchObject({
      enabled: false,
      moduleEnabled: true,
      unavailableReason: "company_missing",
      companyId: null,
      people: [],
      feedbacks: [],
    });
  });

  it("bloqueia mutação quando o módulo não está habilitado", async () => {
    setFeedbackEnabledResolverForTests(() => false);
    await expect(
      feedbackRouter.createCaller(context()).createCycle({
        companyId: 7,
        name: "Q1",
        startsOn: "2026-01-01",
        endsOn: "2026-03-31",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("bloqueia administração de pessoa quando o módulo não está habilitado", async () => {
    setFeedbackEnabledResolverForTests(() => false);
    await expect(
      feedbackRouter
        .createCaller(context({ role: "admin" }))
        .setCompanyAdministrator({
          companyId: 7,
          userId: 11,
          isAdmin: true,
          expectedIsAdmin: false,
        })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("exige conta aprovada mesmo quando a flag está ativa", async () => {
    setFeedbackEnabledResolverForTests(() => true);
    await expect(
      feedbackRouter
        .createCaller(context({ approvalStatus: "rejected" }))
        .workspace({ companyId: 7 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
