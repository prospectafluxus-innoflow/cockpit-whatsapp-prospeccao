import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLUXUS_V2_ITEMS, calculateFluxusV2Result } from "@shared/fluxusV2";
import { buildExecutiveDocument } from "@shared/fluxusExecutiveAnalysis";
import {
  emptyExecutiveNotes,
  type ExecutiveNotes,
  type ExecutivePerson,
} from "@shared/fluxusExecutive";
import { FluxusExecutiveDocument } from "./FluxusExecutiveDocument";

/** Fixture sintético: não representa cliente, pessoa ou resposta real. */
function syntheticPerson(
  id: number,
  value = 5,
  department = "Departamento sintético"
): ExecutivePerson {
  return {
    userId: id,
    name: `Pessoa sintética ${id}`,
    jobTitle: "Cargo sintético",
    department,
    assessmentId: id * 10,
    cycleNumber: 2,
    cycleLabel: "Ciclo sintético Beta 2",
    completedAt: "2026-11-01T12:00:00.000Z",
    result: calculateFluxusV2Result(
      Object.fromEntries(FLUXUS_V2_ITEMS.map(item => [item.id, value])),
      new Date("2026-11-01T12:00:00.000Z")
    ),
  };
}

const syntheticCompany = { id: 991, name: "Empresa sintética para teste" };

beforeEach(() => {
  vi.stubGlobal("React", React);
});

function renderDocument(
  data: ReturnType<typeof buildExecutiveDocument>,
  notes: ExecutiveNotes = emptyExecutiveNotes()
) {
  return renderToStaticMarkup(
    React.createElement(FluxusExecutiveDocument, { data, notes })
  );
}

describe("FluxusExecutiveDocument", () => {
  it("usa as médias e contagens recebidas no agregado sem recalcular sinais no cliente", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "team",
      Array.from({ length: 5 }, (_, index) => syntheticPerson(index + 1)),
      5,
      new Date("2026-11-11T12:00:00.000Z")
    );
    if (!data.aggregate)
      throw new Error("Fixture sintético deveria liberar o agregado");
    data.aggregate = {
      ...data.aggregate,
      indexMean: 6.4,
      engagementMean: 6.2,
      signalCounts: {
        Sustentável: 1,
        "Ponto de atenção": 2,
        "Conversa prioritária": 2,
      },
    };

    const markup = renderDocument(data);

    expect(markup).toContain("6,4 / 7");
    expect(markup).toContain("6,2 / 7");
    expect(markup).toContain("<strong>1</strong><small>pessoas</small>");
    expect(markup).toContain("<strong>2</strong><small>pessoas</small>");
    expect(markup).toContain("Distribuição do sinal do ciclo");
  });

  it("mantém o método Beta 2, não expõe Beta 1 e não duplica ids dos gráficos", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "team",
      Array.from({ length: 5 }, (_, index) => syntheticPerson(index + 1)),
      5
    );

    const markup = renderDocument(data);

    expect(markup).toContain("2.0.0-beta.2");
    expect(markup).not.toContain("Beta 1");
    expect(markup).toContain("persona-executive-profile-chart-10-title");
    expect(markup).toContain("persona-executive-profile-chart-50-title");
    expect(markup).toContain("Cargo / depto.");
  });

  it("escapa complementos consultivos como texto e nunca renderiza editor dentro do documento", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "individual",
      [syntheticPerson(7)],
      5
    );
    const notes = emptyExecutiveNotes();
    notes.title = "<script>alert('x')</script>";
    notes.summary = "Contexto <img src=x onerror=alert(1)> & revisão";
    notes.individuals[String(data.people[0]!.assessmentId)] = {
      summary: "<b>não é HTML</b>",
      context: "<img src=x onerror=alert(1)>",
      recommendations: "<script>não executar</script>",
    };

    const markup = renderDocument(data, notes);

    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img src=x");
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).toContain("&lt;b&gt;não é HTML&lt;/b&gt;");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("<input");
  });

  it("em modo individual não expõe agregado, retrato ou tabela de equipe", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "individual",
      [syntheticPerson(8)],
      5
    );
    const markup = renderDocument(data);

    expect(data.aggregate).toBeNull();
    expect(data.departments).toHaveLength(0);
    expect(markup).toContain("Ficha individual");
    expect(markup).toContain("Quem é, no trabalho");
    expect(markup).not.toContain("Retrato da equipe");
    expect(markup).not.toContain("Média do recorte");
    expect(markup).toContain("Quem é, no trabalho");
  });

  it("compõe a ficha individual no modelo horizontal e omite notas vazias", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "individual",
      [syntheticPerson(9)],
      5
    );

    const markup = renderDocument(data);

    expect(markup).toContain("persona-executive-document--model");
    expect(markup).toContain("fluxus-model-sheet");
    expect(markup).toContain("fluxus-model-rail");
    expect(markup).toContain("fluxus-model-content");
    expect(markup).toContain("fluxus-model-profile-panel");
    expect(markup).toContain("fluxus-model-moment-panel");
    expect(markup).toContain("fluxus-model-details-sheet");
    expect(markup).toContain("fluxus-model-indicators-grid");
    expect(
      markup.match(
        /class="persona-executive-moment-card fluxus-model-moment-row /g
      )
    ).toHaveLength(7);
    expect(markup.match(/fluxus-model-action-card/g)).toHaveLength(3);
    expect(
      markup.match(
        /class="persona-executive-indicator-card persona-executive-indicator-card--compact/g
      )
    ).toHaveLength(5);
    expect(markup).not.toContain("persona-executive-person-overview");
    expect(markup).not.toContain("O que representa");
    expect(markup).not.toContain("persona-executive-consultant-notes");
  });

  it("com foco individual começa na ficha e mantém detalhes depois dela", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "individual",
      [syntheticPerson(11)],
      5
    );

    const markup = renderToStaticMarkup(
      React.createElement(FluxusExecutiveDocument, {
        data,
        notes: emptyExecutiveNotes(),
        focusIndividual: true,
      })
    );

    expect(markup).not.toContain("persona-executive-cover");
    expect(markup.indexOf("fluxus-model-sheet")).toBeGreaterThanOrEqual(0);
    expect(markup.indexOf("fluxus-model-sheet")).toBeLessThan(
      markup.indexOf("fluxus-model-details-sheet")
    );
    expect(markup).toContain("Cinco indicadores para orientar apoio");
    expect(markup).not.toContain("persona-executive-complementary");
  });

  it("preserva integralmente cada nota consultiva preenchida e não cria blocos vazios", () => {
    const data = buildExecutiveDocument(
      syntheticCompany,
      "individual",
      [syntheticPerson(10)],
      5
    );
    const notes = emptyExecutiveNotes();
    notes.individuals[String(data.people[0]!.assessmentId)] = {
      summary: "Linha um\nLinha dois com contexto longo.",
      context: "",
      recommendations: "",
    };

    const markup = renderDocument(data, notes);

    expect(markup).toContain("Complementos da consultoria (opcionais)");
    expect(markup).toContain("Linha um\nLinha dois com contexto longo.");
    expect(markup).toContain("Síntese da consultoria");
    expect(markup).not.toContain("Contexto informado");
    expect(markup).not.toContain("Recomendações da consultoria");
  });
});
