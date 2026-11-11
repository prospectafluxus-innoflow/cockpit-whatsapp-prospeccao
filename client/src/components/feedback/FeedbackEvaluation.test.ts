import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_ACKNOWLEDGEMENT,
  FEEDBACK_COMPETENCIES,
} from "@shared/feedback";

const mocks = vi.hoisted(() => ({ detail: {} as Record<string, unknown> }));
vi.mock("@/lib/feedbackApi", () => {
  const mutation = {
    useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  };
  return {
    feedbackApi: {
      get: {
        useQuery: () => ({
          data: mocks.detail,
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
      saveDraft: mutation,
      transition: mutation,
      correct: mutation,
      comment: mutation,
    },
  };
});
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/feedback/avaliacao/1", vi.fn()],
}));
import { FeedbackEvaluationPage } from "./FeedbackEvaluation";

function render() {
  return renderToStaticMarkup(
    React.createElement(FeedbackEvaluationPage, { params: { id: "1" } })
  );
}

beforeEach(() => {
  // Vitest's standalone config has no Vite React plugin for the classic JSX transform.
  vi.stubGlobal("React", React);
  mocks.detail = {
    feedback: {
      id: 1,
      status: "released",
      revision: 1,
      items: [
        {
          competencyId: FEEDBACK_COMPETENCIES[0]!.id,
          score: 5,
          evidence: "Entrega registrada",
          effect: "",
          advice: "",
          notes: "",
        },
      ],
      participantComment: null,
    },
    cycle: {
      id: 1,
      name: "Ciclo de teste",
      status: "active",
      startsOn: "2026-10-01",
      endsOn: "2026-12-31",
      competencySnapshot: FEEDBACK_COMPETENCIES.slice(0, 1),
      methodVersion: "innoflow-eec-1.0",
    },
    participant: { id: 7, name: "Participante de teste" },
    evaluator: { id: 8, name: "Avaliador de teste" },
    isParticipant: true,
    canEdit: false,
    canTransition: true,
    calculation: { average: null },
  };
});

describe("ciência na devolutiva do colaborador", () => {
  it("exibe a ciência e o avanço na aba acessível, mantendo o editor bloqueado", () => {
    const markup = render();
    expect(markup).toContain("Sua devolutiva");
    const editorButton = markup.match(/<button[^>]*>Editor EEC<\/button>/)?.[0];
    expect(editorButton).toBeDefined();
    expect(editorButton).toContain('disabled=""');
    expect(markup).toContain(FEEDBACK_ACKNOWLEDGEMENT);
    expect(markup).toContain("Próxima etapa: Ciência registrada");
    expect(markup).toContain("Avançar etapa");
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Avançar etapa/);
    expect(markup).not.toContain("Rascunho da avaliação");
    expect(markup).toContain("Ver relatório / PDF");
    expect(markup).toContain("Pontuação obtida");
  });

  it("não oferece transição sem autorização da resposta do servidor", () => {
    mocks.detail.canTransition = false;
    expect(render()).not.toContain("Avançar etapa");
  });

  it("não expõe a ciência nem itens quando uma correção aguarda nova liberação", () => {
    mocks.detail.feedback = {
      id: 1,
      status: "completed",
      revision: 2,
      items: [],
      participantComment: null,
    };
    mocks.detail.canTransition = false;
    const markup = render();
    expect(markup).toContain("Uma nova devolutiva está sendo preparada");
    expect(markup).not.toContain(FEEDBACK_ACKNOWLEDGEMENT);
    expect(markup).not.toContain("Avançar etapa");
    expect(markup).not.toContain("Ver relatório / PDF");
    expect(markup).not.toContain("Pontuação obtida");
  });

  it("não oferece ciência em ciclo inativo mesmo com permissão obsoleta", () => {
    mocks.detail.cycle = {
      ...(mocks.detail.cycle as Record<string, unknown>),
      status: "cancelled",
    };
    expect(render()).not.toContain("Avançar etapa");
  });
});

describe("textos opcionais no editor EEC", () => {
  it("identifica os textos como opcionais e mantém a exigência das notas", () => {
    mocks.detail.feedback = {
      id: 1,
      status: "draft",
      revision: 0,
      items: [],
      participantComment: null,
    };
    mocks.detail.cycle = {
      ...(mocks.detail.cycle as Record<string, unknown>),
      competencySnapshot: [
        { id: "quality", name: "Qualidade", definition: "Entregas adequadas" },
      ],
    };
    mocks.detail.isParticipant = false;
    mocks.detail.canEdit = true;
    const markup = render();
    expect(markup).toContain("Evidência observável (opcional)");
    expect(markup).toContain("Efeito verificável (opcional)");
    expect(markup).toContain("Conselho e apoio (opcional)");
    expect(markup).toContain("Nota de 0 a 6 (obrigatória)");
    expect(markup).toContain("Faltam notas para concluir");
    expect(markup).not.toContain("aceita os quatro campos EEC");
  });
});
