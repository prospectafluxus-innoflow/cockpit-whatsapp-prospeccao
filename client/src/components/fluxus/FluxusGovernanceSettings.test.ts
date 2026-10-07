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
  assignment: vi.fn(),
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
      feedback: {
        workspace: { invalidate: vi.fn() },
        companyAdministratorDirectory: { invalidate: vi.fn() },
      },
      fluxus: { adminCompany: { invalidate: vi.fn() } },
    }),
    feedback: {
      workspace: {
        useQuery: () => {
          throw new Error("O seletor não pode depender do workspace completo");
        },
      },
      companyAdministratorDirectory: { useQuery: () => mocks.query },
      setCompanyAdministrator: {
        useMutation: () => ({ mutateAsync: mocks.change, isPending: false }),
      },
      assignEmployee: {
        useMutation: () => ({ mutateAsync: mocks.assignment, isPending: false }),
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
const adminSelect = (html: string) => {
  const select = html.match(
    /<select[^>]*id="company-admin-5"[^>]*>[\s\S]*?<\/select>/
  )?.[0];
  expect(select).toBeDefined();
  return select!;
};
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  mocks.change.mockClear();
  mocks.assignment.mockClear();
  mocks.query.data = {
    enabled: true,
    companyId: 7,
    people: [{ id: 5, isCompanyAdmin: false }],
  };
  mocks.query.error = null;
  mocks.query.isLoading = false;
  mocks.query.isFetching = false;
});
describe("Administrador Sim/Não no cadastro existente", () => {
  it("mostra Não explicitamente ao lado do perfil Persona, sem ID nem alteração de acessos ao renderizar", () => {
    const html = render();
    expect(html).toContain("Pessoa de teste");
    expect(html).toContain("Administrador da empresa (Feedback)");
    expect(html).toContain('id="papeis-de-acesso"');
    expect(adminSelect(html)).toContain(
      '<option value="no" selected="">Não</option>'
    );
    expect(adminSelect(html)).not.toContain('disabled=""');
    expect(html).toMatch(/value="manager" selected=""/);
    expect(html).not.toContain("ID do usuário");
    expect(html).not.toContain('role="checkbox"');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("mostra Sim somente quando o papel persistido é de administrador", () => {
    mocks.query.data.people[0]!.isCompanyAdmin = true;
    expect(adminSelect(render())).toContain(
      '<option value="yes" selected="">Sim</option>'
    );
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("não mostra Sim ou Não como certeza quando a consulta falha", () => {
    mocks.query.error = new Error("Falha de consulta");
    const html = render();
    expect(html).toContain("Tentar novamente");
    expect(adminSelect(html)).toContain(
      '<option value="unknown" selected="">Indisponível</option>'
    );
    expect(adminSelect(html)).toContain('disabled=""');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("bloqueia dados de outra empresa, candidato ausente ou resposta sem estado booleano", () => {
    mocks.query.data.companyId = 9;
    expect(adminSelect(render())).toContain('value="unknown" selected=""');
    mocks.query.data.companyId = 7;
    mocks.query.data.people = [];
    expect(adminSelect(render())).toContain('value="unknown" selected=""');
    mocks.query.data.people = [{ id: 5, isCompanyAdmin: false }];
    Object.assign(mocks.query.data.people[0]!, { isCompanyAdmin: undefined });
    expect(adminSelect(render())).toContain('value="unknown" selected=""');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("mantém os papéis Persona e bloqueia administração quando a flag está desligada", () => {
    mocks.query.data.enabled = false;
    const html = render();
    expect(html).toContain("O módulo Feedback está desabilitado");
    expect(html).toContain("Perfil Persona");
    expect(adminSelect(html)).toContain('value="unknown" selected=""');
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("mostra Carregando sem selecionar Sim/Não enquanto o estado não está disponível", () => {
    mocks.query.isLoading = true;
    mocks.query.data.people = [];
    const html = adminSelect(render());
    expect(html).toContain(
      '<option value="unknown" selected="">Carregando…</option>'
    );
    expect(html).toContain('disabled=""');
    expect(mocks.change).not.toHaveBeenCalled();
  });
});
