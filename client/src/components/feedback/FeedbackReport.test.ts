import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_COMPETENCIES,
  type FeedbackStatus,
  type FeedbackItem,
} from "@shared/feedback";
import type { FeedbackDetail } from "@/lib/feedbackApi";

const mocks = vi.hoisted(() => ({
  detail: null as FeedbackDetail | null,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  navigate: vi.fn(),
}));

vi.mock("@/lib/feedbackApi", () => ({
  feedbackApi: {
    get: {
      useQuery: (_input: unknown, options: { enabled?: boolean }) => ({
        data: options.enabled ? mocks.detail : undefined,
        isLoading: mocks.isLoading,
        isFetching: mocks.isFetching,
        error: mocks.error,
        refetch: vi.fn(),
      }),
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/feedback/relatorio/1", mocks.navigate],
}));

import { FeedbackReportDocument, FeedbackReportPage } from "./FeedbackReport";

const competencies = FEEDBACK_COMPETENCIES.map(competency => ({
  ...competency,
}));

function makeItem(
  competencyId: string,
  score: number | null = 5,
  text: Partial<FeedbackItem> = {}
): FeedbackItem {
  return {
    competencyId,
    score,
    evidence: "Entrega documentada no período",
    effect: "Impacto verificável no prazo combinado",
    advice: "Manter a rotina de acompanhamento",
    notes: "",
    ...text,
  };
}

function makeItems(score: number | null = 5) {
  return competencies.map(competency => makeItem(competency.id, score));
}

function makeDetail({
  status = "released",
  isParticipant = false,
  items = makeItems(),
  participantComment = "Comentário registrado pelo colaborador.",
  participantName = "Ana Colaboradora",
}: {
  status?: FeedbackStatus;
  isParticipant?: boolean;
  items?: FeedbackItem[];
  participantComment?: string | null;
  participantName?: string | null;
} = {}): FeedbackDetail {
  return {
    feedback: {
      id: 1,
      companyId: 2,
      cycleId: 4,
      participantUserId: 7,
      evaluatorUserId: 9,
      personaAssessmentId: 11,
      assignmentId: 12,
      departmentId: null,
      status,
      items,
      revision: 3,
      completedAt: null,
      debriefedAt: null,
      releasedAt: null,
      firstViewedAt: null,
      acknowledgedAt: null,
      closedAt: null,
      participantComment,
      commentedAt: null,
      createdAt: new Date("2026-01-05T12:00:00.000Z"),
      updatedAt: new Date("2026-02-05T12:00:00.000Z"),
    },
    cycle: {
      id: 4,
      companyId: 2,
      name: "Ciclo Primeiro Trimestre",
      year: 2026,
      startsOn: "2026-01-05",
      endsOn: "2026-03-31",
      status: "active",
      templateVersion: 2,
      methodVersion: "innoflow-eec-1.0",
      competencySnapshot: competencies,
      createdBy: 9,
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      activatedAt: null,
      closedAt: null,
    },
    participant: {
      id: 7,
      name: participantName,
      jobTitle: "Analista de Operações",
    },
    evaluator: {
      id: 9,
      name: "Bruno Avaliador",
    },
    calculation: {
      obtained: 999,
      expected: 999,
      maximum: 999,
      difference: 0,
      average: 99,
      scoredCount: items.filter(item => item.score !== null).length,
      competencyCount: competencies.length,
      complete: items.length === competencies.length,
    },
    canEdit: false,
    canTransition: false,
    isParticipant,
  };
}

function renderDocument(
  data: FeedbackDetail = makeDetail(),
  items?: FeedbackItem[]
) {
  return renderToStaticMarkup(
    React.createElement(FeedbackReportDocument, { data, items })
  );
}

function renderPage(id = "1") {
  return renderToStaticMarkup(
    React.createElement(FeedbackReportPage, { params: { id } })
  );
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.detail = makeDetail();
  mocks.isLoading = false;
  mocks.isFetching = false;
  mocks.error = null;
  mocks.navigate.mockReset();
});

describe("FeedbackReportDocument", () => {
  it("calcula obtida, esperada, máxima e média para dez competências", () => {
    const markup = renderDocument();

    expect(markup).toContain("Pontuação obtida");
    expect(markup).toContain("50 pontos");
    expect(markup).toContain("Referência esperada");
    expect(markup).toContain("Pontuação máxima");
    expect(markup).toContain("60 pontos");
    expect(markup).toContain("Média");
    expect(markup).toContain("5,00 / 6");
    expect(markup).not.toContain("999");
    expect(markup).toContain("referência é 5 por competência");
    expect(markup).toContain("máximo é 6 por competência");
  });

  it("preserva zero como nota e como média, sem convertê-lo em sem nota", () => {
    const markup = renderDocument(makeDetail({ items: makeItems(0) }));

    expect(markup).toContain("0 pontos");
    expect(markup).toContain("0/6");
    expect(markup).toContain("0,00 / 6");
  });

  it("marca snapshot parcial, não conta ausências como zero e permite textos vazios", () => {
    const partialItems = competencies.slice(0, 5).map(competency =>
      makeItem(competency.id, 5, {
        evidence: "",
        effect: "",
        advice: "",
        notes: "",
      })
    );
    const markup = renderDocument(makeDetail({ items: partialItems }));

    expect(markup).toContain("25 pontos");
    expect(markup).toContain("parcial/incompleto");
    expect(markup).toContain("competência sem nota não é considerada zero");
    expect(markup).toContain("Sem nota");
    expect(markup).toContain("Não informado (opcional)");
    expect(markup).toContain("5,00 / 6");
  });

  it("exibe notas, EEC, avaliador, ciclo, período, revisão e método", () => {
    const items = makeItems();
    items[0] = makeItem(competencies[0]!.id, 6, {
      evidence: "Evidência observável específica",
      effect: "Efeito verificável específico",
      advice: "Conselho e apoio específico",
      notes: "Anotação adicional específica",
    });
    const markup = renderDocument(
      makeDetail({ items, participantComment: "Comentário específico" })
    );

    expect(markup).toContain("Ana Colaboradora");
    expect(markup).toContain("Analista de Operações");
    expect(markup).toContain("Bruno Avaliador");
    expect(markup).toContain("Ciclo Primeiro Trimestre");
    expect(markup).toContain("05/01/2026");
    expect(markup).toContain("31/03/2026");
    expect(markup).toContain("Revisão");
    expect(markup).toContain("3");
    expect(markup).toContain("innoflow-eec-1.0");
    expect(markup).toContain("Evidência observável específica");
    expect(markup).toContain("Efeito verificável específico");
    expect(markup).toContain("Conselho e apoio específico");
    expect(markup).toContain("Anotação adicional específica");
    expect(markup).toContain("Comentário específico");
    expect(markup).toContain("FLUXUS PERSONA · InnoFlow");
    expect(markup).toContain("Relatório de Feedback EEC");
  });

  it("escapa texto malicioso como texto HTML e não cria controles de edição", () => {
    const malicious = "<script>alert('x')</script>";
    const items = makeItems();
    items[0] = makeItem(competencies[0]!.id, 5, {
      evidence: malicious,
      effect: malicious,
      advice: malicious,
      notes: malicious,
    });
    const data = makeDetail({
      items,
      participantName: malicious,
      participantComment: malicious,
    });
    const markup = renderDocument(data);

    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("Editor EEC");
    expect(markup).not.toContain("Salvar rascunho");
  });

  it("protege participante com etapa concluída sem vazar relatório, cálculo ou impressão", () => {
    const markup = renderPage();
    mocks.detail = makeDetail({ status: "completed", isParticipant: true });
    const restrictedMarkup = renderPage();

    expect(markup).toContain("Relatório de Feedback EEC");
    expect(restrictedMarkup).toContain("Relatório indisponível");
    expect(restrictedMarkup).not.toContain("Relatório de Feedback EEC");
    expect(restrictedMarkup).not.toContain("Pontuação obtida");
    expect(restrictedMarkup).not.toContain("50 pontos");
    expect(restrictedMarkup).not.toContain("Imprimir / Salvar PDF");
    expect(restrictedMarkup).not.toContain("Ana Colaboradora");
  });

  it("permite prévia de gestor em concluído e visualização de participante em liberado", () => {
    mocks.detail = makeDetail({ status: "completed", isParticipant: false });
    const managerMarkup = renderPage();
    mocks.detail = makeDetail({ status: "released", isParticipant: true });
    const participantMarkup = renderPage();

    expect(managerMarkup).toContain(
      "Prévia para devolutiva — ainda não liberado ao colaborador"
    );
    expect(managerMarkup).toContain("Imprimir / Salvar PDF");
    expect(participantMarkup).toContain("Relatório de Feedback EEC");
    expect(participantMarkup).toContain("Imprimir / Salvar PDF");
  });

  it("não muta itens locais nem oferece gestão no documento", () => {
    const items = makeItems();
    const before = JSON.stringify(items);
    const markup = renderDocument(makeDetail({ items }), items);

    expect(JSON.stringify(items)).toBe(before);
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("Avançar etapa");
    expect(markup).not.toContain("Corrigir");
  });
});

describe("FeedbackReportPage", () => {
  it("não mostra impressão durante loading, erro ou id inválido", () => {
    mocks.isLoading = true;
    expect(renderPage()).not.toContain("Imprimir / Salvar PDF");

    mocks.isLoading = false;
    mocks.error = new Error("Falha sintética");
    expect(renderPage()).toContain("Não foi possível carregar este relatório.");
    expect(renderPage()).not.toContain("Imprimir / Salvar PDF");

    mocks.error = null;
    expect(renderPage("0")).toContain(
      "Não foi possível carregar este relatório."
    );
    expect(renderPage("0")).not.toContain("Imprimir / Salvar PDF");
  });

  it("mantém o botão de impressão desabilitado enquanto a consulta está buscando", () => {
    mocks.isFetching = true;
    const markup = renderPage();

    expect(markup).toContain("Imprimir / Salvar PDF");
    expect(markup).toMatch(
      /<button[^>]*disabled=""[^>]*>.*Imprimir \/ Salvar PDF/
    );
  });
});
