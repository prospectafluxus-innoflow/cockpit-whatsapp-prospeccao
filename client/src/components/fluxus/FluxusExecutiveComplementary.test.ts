import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyComplementaryValues,
  type ComplementaryValues,
} from "@shared/fluxusComplementary";
import type {
  ExecutiveComplementaryBundle,
  ExecutiveComplementarySource,
  ManagerialComplementaryReading,
} from "@shared/fluxusManagerialComplementary";
import type { ExecutivePerson } from "@shared/fluxusExecutive";
import { buildManagerialComplementary } from "@shared/fluxusManagerialComplementaryAnalysis";
import { FluxusExecutiveComplementary } from "./FluxusExecutiveComplementary";

vi.mock("@shared/fluxusManagerialComplementaryAnalysis", () => ({
  buildManagerialComplementary: vi.fn(),
}));

const mockedBuild = vi.mocked(buildManagerialComplementary);

/** Fixture sintético: não representa cliente, pessoa ou resultado real. */
const basePerson = (): ExecutivePerson =>
  ({
    userId: 41,
    name: "Pessoa sintética complementar",
    jobTitle: "Cargo sintético",
    department: "Departamento sintético",
    assessmentId: 410,
    cycleNumber: 2,
    cycleLabel: "Ciclo sintético",
    completedAt: "2026-11-01T12:00:00.000Z",
    result: {} as ExecutivePerson["result"],
  }) as ExecutivePerson;

function source(
  kind: "pq" | "saboteurs",
  values: ComplementaryValues,
  overrides: Partial<ExecutiveComplementarySource> = {}
): ExecutiveComplementarySource {
  return {
    id: kind === "pq" ? 701 : 702,
    revision: 3,
    userId: 41,
    assessmentId: 410,
    kind,
    sourceDate: "2026-11-02",
    confirmedAt: "2026-11-03T01:30:00.000Z",
    values,
    context: "Contexto sintético do titular.",
    ...overrides,
  };
}

function reading(
  sources: ExecutiveComplementaryBundle
): ManagerialComplementaryReading {
  return {
    sources,
    summary: "Resumo consultivo sintético.",
    communication: {
      title: "Comunicação sintética",
      text: "Texto de comunicação para validar em conversa.",
      question: "Qual exemplo concreto ajuda a confirmar esta hipótese?",
    },
    patterns: [
      {
        key: "stickler",
        label: "Insistente",
        score: 7.25,
        question: "O que estava acontecendo nesse momento?",
        support: "Apoio sintético para exploração.",
      },
      {
        key: "pleaser",
        label: "Prestativo",
        score: 6,
        question: "Que pedido precisa ser explicitado?",
        support: "Segundo padrão sintético.",
      },
      {
        key: "controller",
        label: "Controlador",
        score: 4.5,
        question: "O que pode ser combinado com autonomia?",
        support: "Terceiro padrão sintético.",
      },
      {
        key: "victim",
        label: "Vítima",
        score: 2,
        question: "Quarta pergunta que não deve aparecer.",
        support: "Quarto padrão que deve ser limitado.",
      },
    ],
    hasTies: true,
    actions: [
      {
        title: "Ação sintética um",
        text: "Combinado observável um.",
        question: "Como verificar este combinado?",
      },
      {
        title: "Ação sintética dois",
        text: "Combinado observável dois.",
        question: "Qual será o próximo passo?",
      },
      {
        title: "Ação sintética três",
        text: "Combinado observável três.",
        question: "Que evidência será observada?",
      },
      {
        title: "Ação sintética quatro",
        text: "Ação que não deve aparecer.",
        question: "Pergunta que não deve aparecer.",
      },
    ],
    followUp: "Retomar a conversa em uma data combinada.",
    notice: "Aviso consultivo sintético.",
  };
}

function renderComponent(person: ExecutivePerson) {
  return renderToStaticMarkup(
    React.createElement(FluxusExecutiveComplementary, { person })
  );
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  mockedBuild.mockReset();
});

describe("FluxusExecutiveComplementary", () => {
  it("não cria folhas sem fontes ou quando a análise não libera leitura", () => {
    const person = basePerson();
    expect(renderComponent(person)).toBe("");
    expect(mockedBuild).not.toHaveBeenCalled();

    const pq = source("pq", { ...emptyComplementaryValues(), pq: 64 });
    person.complementary = { pq };
    mockedBuild.mockReturnValue(null);

    expect(renderComponent(person)).toBe("");
  });

  it("mostra QP isolado sem criar Sabotadores ou pontuação ausente", () => {
    const person = basePerson();
    const pq = source("pq", { ...emptyComplementaryValues(), pq: 64 });
    person.complementary = { pq };
    mockedBuild.mockReturnValue(reading({ pq }));

    const markup = renderComponent(person);

    expect(markup).toContain("persona-executive-complementary-result--pq");
    expect(markup).toContain("64");
    expect(markup).toContain("/ 100");
    expect(markup).not.toContain(
      "persona-executive-complementary-result--saboteurs"
    );
  });

  it("mostra Sabotadores isolados, preserva decimais e mantém zero verdadeiro", () => {
    const person = basePerson();
    const values = {
      ...emptyComplementaryValues(),
      saboteurs: { stickler: 0, pleaser: 7.25 },
    };
    const saboteurs = source("saboteurs", values);
    person.complementary = { saboteurs };
    mockedBuild.mockReturnValue(reading({ saboteurs }));

    const markup = renderComponent(person);

    expect(markup).toContain(
      "persona-executive-complementary-result--saboteurs"
    );
    expect(markup).toContain("Insistente");
    expect(markup).toContain("0 / 10");
    expect(markup).toContain("7,25 / 10");
    expect(markup).not.toContain("persona-executive-complementary-result--pq");
  });

  it("mostra Crítico somente quando a fonte traz valores", () => {
    const person = basePerson();
    const values = {
      ...emptyComplementaryValues(),
      saboteurs: { stickler: 2 },
      critic: { self: 11 },
    };
    const saboteurs = source("saboteurs", values);
    person.complementary = { saboteurs };
    mockedBuild.mockReturnValue(reading({ saboteurs }));

    const markup = renderComponent(person);

    expect(markup).toContain("persona-executive-complementary-result--critic");
    expect(markup).toContain("11 / 15");
  });

  it("preserva datas date-only, contexto, avisos e encoding das strings", () => {
    const person = basePerson();
    const pq = source(
      "pq",
      { ...emptyComplementaryValues(), pq: 0 },
      {
        sourceDate: "2026-12-31",
        confirmedAt: "2027-01-01T00:15:00.000Z",
        context: "Linha 1\nLinha <do contexto>",
      }
    );
    person.complementary = { pq };
    const syntheticReading = reading({ pq });
    syntheticReading.notice = "<script>aviso</script> & limite";
    syntheticReading.summary = "<b>resumo</b>";
    mockedBuild.mockReturnValue(syntheticReading);

    const markup = renderComponent(person);

    expect(markup).toContain("31/12/2026");
    expect(markup).toContain("01/01/2027 · 00:15");
    expect(markup).not.toContain("30/12/2026");
    expect(markup).toContain("Linha &lt;do contexto&gt;");
    expect(markup).toContain("&lt;script&gt;aviso&lt;/script&gt; &amp; limite");
    expect(markup).toContain("&lt;b&gt;resumo&lt;/b&gt;");
    expect(markup).toContain("0");
  });

  it("preserva as opções de apoio em ordem fixa, limita ações e omite bundle inválido filtrado", () => {
    const person = basePerson();
    const pq = source("pq", { ...emptyComplementaryValues(), pq: 80 });
    person.complementary = { pq };
    mockedBuild.mockReturnValue(reading({ pq }));

    const markup = renderComponent(person);

    expect(
      markup.match(/persona-executive-complementary-pattern"/g)
    ).toHaveLength(4);
    expect(
      markup.match(/persona-executive-complementary-action"/g)
    ).toHaveLength(3);
    expect(markup).toContain("Próxima conversa");
    expect(markup).toContain("Catálogo em ordem fixa");

    mockedBuild.mockReturnValue(reading({}));
    expect(renderComponent(person)).toBe("");
  });

  it("não renderiza fonte quando a análise rejeita mismatch de usuário ou avaliação", () => {
    const person = basePerson();
    const mismatched = source(
      "pq",
      { ...emptyComplementaryValues(), pq: 90 },
      { userId: 999, assessmentId: 9990 }
    );
    person.complementary = { pq: mismatched };
    mockedBuild.mockReturnValue(null);

    expect(renderComponent(person)).toBe("");
  });
});
