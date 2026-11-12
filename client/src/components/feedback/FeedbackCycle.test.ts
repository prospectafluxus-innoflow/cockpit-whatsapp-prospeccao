import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_COMPETENCIES } from "@shared/feedback";

const mocks = vi.hoisted(() => ({ workspace: {} as Record<string, any> }));
vi.mock("@/lib/feedbackApi", () => {
  const mutation = {
    useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  };
  return {
    feedbackApi: {
      workspace: {
        useQuery: () => ({
          data: mocks.workspace,
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
        }),
      },
      addParticipants: mutation,
      updateEvaluationEvaluator: mutation,
      transitionCycle: mutation,
      removeParticipant: mutation,
    },
  };
});
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/feedback/ciclo/4", vi.fn()],
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));
import { FeedbackCyclePage } from "./FeedbackCycle";

function render() {
  return renderToStaticMarkup(
    React.createElement(FeedbackCyclePage, { params: { id: "4" } })
  );
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.workspace = {
    canConfigure: true,
    canReadContent: false,
    membership: { userId: 8, role: "company_admin" },
    people: [],
    feedbacks: [],
    cycles: [
      {
        id: 4,
        name: "Feedback trimestral",
        year: 2026,
        status: "active",
        startsOn: "2026-10-01",
        endsOn: "2026-12-31",
        templateVersion: 1,
        methodVersion: "innoflow-eec-1.0",
        competencySnapshot: FEEDBACK_COMPETENCIES,
      },
    ],
  };
});
describe("participantes no mesmo ciclo trimestral", () => {
  it.each(["planned", "active"])(
    "mostra inclusão e atalho no ciclo %s",
    status => {
      mocks.workspace.cycles[0].status = status;
      const markup = render();
      expect(markup).toContain('href="#participantes-do-ciclo"');
      expect(markup).toContain('id="participantes-do-ciclo"');
      expect(markup).toContain("Participantes e avaliadores");
      expect(markup).toContain("Adicionar participantes selecionados");
      expect(markup).toContain("As avaliações já existentes não são alteradas");
      expect(markup).toContain("01/10/2026");
      expect(markup).toContain("31/12/2026");
    }
  );
  it.each(["closed", "cancelled"])(
    "não oferece inclusão no ciclo %s",
    status => {
      mocks.workspace.cycles[0].status = status;
      const markup = render();
      expect(markup).not.toContain('href="#participantes-do-ciclo"');
      expect(markup).not.toContain('id="participantes-do-ciclo"');
      expect(markup).toContain(
        "Este ciclo foi finalizado e não aceita novas inclusões"
      );
    }
  );
  it("não oferece inclusão sem permissão de configurar o ciclo", () => {
    mocks.workspace.canConfigure = false;
    const markup = render();
    expect(markup).not.toContain('id="participantes-do-ciclo"');
    expect(markup).not.toContain('href="#participantes-do-ciclo"');
    expect(markup).toContain(
      "Não há avaliações atribuídas disponíveis para seu acesso"
    );
  });
});
