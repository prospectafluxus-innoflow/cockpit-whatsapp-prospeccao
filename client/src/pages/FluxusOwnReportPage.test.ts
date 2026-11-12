import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ query: {} as any }));
vi.mock("@/lib/trpc", () => ({
  trpc: { fluxusExecutive: { myReport: { useQuery: () => mocks.query } } },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/meu-relatorio", vi.fn()],
}));
vi.mock("@/components/fluxus/FluxusExecutiveDocument", () => ({
  FluxusExecutiveDocument: ({
    focusIndividual,
  }: {
    focusIndividual?: boolean;
  }) =>
    React.createElement(
      "article",
      { "data-focused": String(focusIndividual) },
      "Ficha visual própria sintética"
    ),
}));
import FluxusOwnReportPage from "./FluxusOwnReportPage";

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.query = {
    data: {
      data: { people: [{ name: "Titular fictício" }] },
      notes: {},
      report: null,
      canEdit: false,
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  };
});
const render = () =>
  renderToStaticMarkup(React.createElement(FluxusOwnReportPage));
const printButton = (html: string) =>
  (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || []).find(button =>
    button.includes("Imprimir / PDF")
  );

describe("relatório integrado do próprio titular", () => {
  it("abre a ficha pronta, sem seleção de equipe ou notas de consultoria", () => {
    const html = render();
    expect(html).toContain('data-focused="true"');
    expect(html).toContain("Ficha visual própria sintética");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Salvar relatório");
    expect(html).toContain("não compartilha seus resultados com ninguém");
    expect(printButton(html)).not.toContain('disabled=""');
  });
  it("não exibe dados antigos quando a autorização atual falha", () => {
    mocks.query.error = { message: "Relatório próprio indisponível." };
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("Ficha visual própria sintética");
    expect(printButton(html)).toContain('disabled=""');
  });
  it("orienta durante o carregamento e bloqueia a impressão enquanto atualiza", () => {
    mocks.query.data = undefined;
    mocks.query.isLoading = true;
    mocks.query.isFetching = true;
    const html = render();
    expect(html).toContain("Preparando seu relatório");
    expect(printButton(html)).toContain('disabled=""');
  });
  it("tem entrada direta na home e no menu e revalida antes de imprimir", () => {
    expect(readFileSync("client/src/App.tsx", "utf8")).toContain(
      'path="/fluxus/meu-relatorio"'
    );
    expect(
      readFileSync("client/src/pages/FluxusHomePage.tsx", "utf8")
    ).toContain("Meu relatório integrado");
    expect(
      readFileSync("client/src/components/fluxus/FluxusLayout.tsx", "utf8")
    ).toContain('label: "Meu relatório"');
    const page = readFileSync(
      "client/src/pages/FluxusOwnReportPage.tsx",
      "utf8"
    );
    expect(page).toContain("query.refetch({ throwOnError: true })");
    expect(page.indexOf("query.refetch({ throwOnError: true })")).toBeLessThan(
      page.indexOf("window.print()")
    );
    expect(page).toContain(
      'classList.remove("persona-executive-print-revalidated")'
    );
  });
});
