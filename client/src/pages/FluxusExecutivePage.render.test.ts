import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateFluxusV2Result, FLUXUS_V2_ITEMS } from "@shared/fluxusV2";
import { buildExecutiveDocument } from "@shared/fluxusExecutiveAnalysis";
import {
  emptyExecutiveNotes,
  type ExecutivePerson,
} from "@shared/fluxusExecutive";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  pending: false,
  directory: {} as any,
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.cursor++;
      return actual.useState(
        index < mocks.states.length ? mocks.states[index] : initial
      );
    },
  };
});
vi.mock("@/lib/trpc", () => ({
  trpc: {
    fluxusExecutive: {
      directory: {
        useQuery: () => ({ data: mocks.directory, isLoading: false }),
      },
      list: { useQuery: () => ({ data: [] }) },
      get: { useQuery: () => ({ data: undefined }) },
      preview: { useQuery: () => ({ data: undefined, isFetching: false }) },
      save: {
        useMutation: () => ({ isPending: mocks.pending, mutate: vi.fn() }),
      },
    },
    useUtils: () => ({ fluxusExecutive: { list: { invalidate: vi.fn() } } }),
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/admin/empresa/991/executiva", vi.fn()],
}));
vi.mock("@/components/fluxus/FluxusExecutiveDocument", () => ({
  FluxusExecutiveDocument: () =>
    React.createElement("article", null, "Documento sintético autorizado"),
}));
import FluxusExecutivePage from "./FluxusExecutivePage";

beforeEach(() => {
  vi.stubGlobal("React", React);
  mocks.cursor = 0;
  mocks.pending = false;
  const person: ExecutivePerson = {
    userId: 7,
    assessmentId: 70,
    name: "Pessoa de teste",
    jobTitle: "Função fictícia",
    department: "Grupo fictício",
    cycleNumber: 1,
    cycleLabel: "Ciclo sintético",
    completedAt: "2026-11-01T12:00:00Z",
    result: calculateFluxusV2Result(
      Object.fromEntries(FLUXUS_V2_ITEMS.map(item => [item.id, 5])),
      new Date("2026-11-01T12:00:00Z")
    ),
  };
  const selection = { companyId: 991, mode: "individual", assessmentIds: [70] };
  const notes = emptyExecutiveNotes();
  const data = buildExecutiveDocument(
    { id: 991, name: "Empresa sintética" },
    "individual",
    [person],
    5
  );
  mocks.states = [
    "individual",
    [70],
    selection,
    { data, notes, report: null, canEdit: true },
    notes,
    structuredClone(notes),
    null,
    null,
    "preview:test",
  ];
  mocks.directory = {
    company: data.company,
    people: [person],
    minimumRespondents: 5,
    truncated: false,
  };
});
function render() {
  return renderToStaticMarkup(
    React.createElement(FluxusExecutivePage, { params: { id: "991" } })
  );
}
function button(markup: string, label: string) {
  return (markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || []).find(
    value => value.includes(label)
  );
}
describe("ações da visão executiva com dados fictícios", () => {
  it("permite salvar a primeira prévia sem obrigar notas consultivas", () => {
    const markup = render();
    expect(button(markup, "Salvar relatório")).toBeDefined();
    expect(button(markup, "Salvar relatório")).not.toContain('disabled=""');
    expect(button(markup, "Imprimir / PDF")).not.toContain('disabled=""');
  });
  it("bloqueia salvar e imprimir quando o recorte mudou sem nova prévia", () => {
    mocks.states[1] = [80];
    const markup = render();
    expect(button(markup, "Salvar relatório")).toContain('disabled=""');
    expect(button(markup, "Imprimir / PDF")).toContain('disabled=""');
    expect(markup).toContain("não pode ser salva ou impressa");
  });
  it("bloqueia a edição e a impressão enquanto o salvamento está pendente", () => {
    mocks.pending = true;
    const markup = render();
    expect(markup).toMatch(/<fieldset[^>]*disabled=""/);
    expect(button(markup, "Imprimir / PDF")).toContain('disabled=""');
    expect(button(markup, "Salvando")).toContain('disabled=""');
  });
  it("preserva a leitura e impressão autorizadas sem expor campos de edição", () => {
    mocks.states[3] = { ...(mocks.states[3] as object), canEdit: false };
    const markup = render();
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Salvar relatório");
    expect(button(markup, "Imprimir / PDF")).not.toContain('disabled=""');
  });
});
