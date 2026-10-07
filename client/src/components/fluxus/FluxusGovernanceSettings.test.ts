import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  change: vi.fn(),
  query: {
    data: {
      enabled: true,
      companyId: 7,
      people: [{ id: 5, isCompanyAdmin: false }],
    },
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      feedback: { workspace: { invalidate: vi.fn() } },
      fluxus: { adminCompany: { invalidate: vi.fn() } },
    }),
    feedback: {
      workspace: { useQuery: () => mocks.query },
      setCompanyAdministrator: {
        useMutation: () => ({ mutateAsync: mocks.change, isPending: false }),
      },
    },
    fluxus: {
      updateCompanyGovernance: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      setCollaboratorRole: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));
import { FluxusGovernanceSettings } from "./FluxusGovernanceSettings";
const company = {
  id: 7,
  name: "Empresa de teste",
  reportVisibility: "participant_only",
  beta2OrganizationAccessEnabled: false,
  minimumAggregateSize: 5,
  retentionMonths: 12,
  processingPurpose: "Devolutiva e desenvolvimento profissional responsáveis.",
};
const people = [
  {
    id: 5,
    name: "Pessoa de teste",
    email: "pessoa@example.test",
    fluxusRole: "manager" as const,
  },
];
const render = () =>
  renderToStaticMarkup(
    React.createElement(FluxusGovernanceSettings, { company, people })
  );
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  mocks.change.mockClear();
  mocks.query.data = {
    enabled: true,
    companyId: 7,
    people: [{ id: 5, isCompanyAdmin: false }],
  };
  mocks.query.error = null;
  mocks.query.isLoading = false;
  mocks.query.isFetching = false;
});
describe("Administrador no cadastro existente", () => {
  it("mostra a opção ao lado do perfil Persona sem exigir ID e sem alterar acessos ao renderizar", () => {
    const html = render();
    expect(html).toContain("Pessoa de teste");
    expect(html).toContain("Administrador da empresa");
    expect(html).toContain('id="papeis-de-acesso"');
    expect(html).toContain('data-state="unchecked"');
    expect(html).toMatch(/value="manager" selected=""/);
    expect(html).not.toContain("ID do usuário");
    expect(html).not.toContain("Confirmar bootstrap");
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("mostra marcado somente quando o papel persistido é de administrador", () => {
    mocks.query.data.people[0]!.isCompanyAdmin = true;
    expect(render()).toContain('data-state="checked"');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("não apresenta estado falso como certeza quando a consulta falha", () => {
    mocks.query.error = new Error("Falha de consulta");
    const html = render();
    expect(html).toContain("Tentar novamente");
    expect(html).toContain('data-state="indeterminate"');
    expect(html).toContain('data-disabled=""');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("bloqueia alteração para dados de outra empresa ou candidato ausente", () => {
    mocks.query.data.companyId = 9;
    expect(render()).toContain('data-state="indeterminate"');
    mocks.query.data.companyId = 7;
    mocks.query.data.people = [];
    expect(render()).toContain('data-state="indeterminate"');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("mantém os papéis Persona e bloqueia administração se a flag estiver desligada", () => {
    mocks.query.data.enabled = false;
    const html = render();
    expect(html).toContain("O módulo Feedback está desabilitado");
    expect(html).toContain("Perfil Persona");
    expect(html).toContain('data-state="indeterminate"');
    expect(mocks.change).not.toHaveBeenCalled();
  });
});
