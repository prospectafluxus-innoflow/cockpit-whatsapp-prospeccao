import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  draftToValues,
  emptyDraft,
  formatCalendarDate,
  isCompleteComplementaryDraft,
  PendingEditor,
  type DraftValues,
} from "./FluxusComplementaryPage";

const mocks = vi.hoisted(() => ({
  availability: {
    enabled: true,
    eligible: true,
    reason: null,
    termsVersion: "2026-11-11.v1",
    user: { id: 7, name: "Pessoa", companyId: 10 },
    recipients: [{ id: 8, name: "Gestora", roleLabel: "Gestora" }],
  },
  mine: { reports: [], hasMore: false },
  shared: { reports: [], hasMore: false },
  mutation: () => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({ base64: "", fileName: "relatorio.pdf" })),
  }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      fluxusComplementary: {
        mine: { invalidate: vi.fn() },
        sharedWithMe: { invalidate: vi.fn() },
      },
    }),
    fluxusComplementary: {
      availability: {
        useQuery: () => ({
          data: mocks.availability,
          isLoading: false,
          error: null,
        }),
      },
      mine: {
        useQuery: () => ({
          data: mocks.mine,
          isLoading: false,
          isFetching: false,
          error: null,
        }),
      },
      sharedWithMe: {
        useQuery: () => ({
          data: mocks.shared,
          isLoading: false,
          isFetching: false,
          error: null,
        }),
      },
      get: {
        useQuery: () => ({
          data: undefined,
          isLoading: false,
          isFetching: false,
          error: null,
        }),
      },
      upload: { useMutation: mocks.mutation },
      confirm: { useMutation: mocks.mutation },
      revoke: { useMutation: mocks.mutation },
      download: { useMutation: mocks.mutation },
    },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus/complementares", vi.fn()],
}));

import FluxusComplementaryPage from "./FluxusComplementaryPage";

beforeEach(() => {
  mocks.availability.enabled = true;
  mocks.availability.eligible = true;
  mocks.mine = { reports: [], hasMore: false };
  mocks.shared = { reports: [], hasMore: false };
});

function renderPage() {
  return renderToStaticMarkup(React.createElement(FluxusComplementaryPage));
}

function renderPending(kind: "pq" | "saboteurs", canConfirm = true) {
  return renderToStaticMarkup(
    React.createElement(PendingEditor, {
      detail: {
        kind,
        status: "pending",
        sourceName: "Pessoa",
        fileName: "teste.pdf",
        warnings: [],
        recipients: [],
        context: "Contexto informado",
      } as any,
      draft: emptyDraft(),
      sourceDate: "2026-11-11",
      setSourceDate: vi.fn(),
      identityConfirmed: false,
      setIdentityConfirmed: vi.fn(),
      updateDraft: vi.fn() as any,
      onConfirm: vi.fn(),
      onDiscard: vi.fn(),
      onRevoke: vi.fn(),
      canConfirm,
      saving: false,
    })
  );
}

describe("página de avaliações complementares", () => {
  it("na conferência QP não apresenta campos de Sabotadores ou Crítico", () => {
    const markup = renderPending("pq");
    expect(markup).toContain("QP (0–100)");
    expect(markup).not.toContain(">Sabotadores</h3>");
    expect(markup).not.toContain(">Crítico</h3>");
    expect(markup).toContain("Confirmar somente para mim");
  });
  it("na conferência de Sabotadores não exige QP e permite retirar pendentes mesmo sem confirmar", () => {
    const markup = renderPending("saboteurs", false);
    expect(markup).toContain(">Sabotadores</h3>");
    expect(markup).not.toContain("QP (0–100)");
    expect(markup).toContain("Excluir importação pendente");
    expect(markup).toContain("Contexto informado no envio");
  });
  it("mantém o upload desabilitado enquanto o consentimento não foi marcado", () => {
    const markup = renderPage();
    expect(markup).toContain("Li e autorizo esta importação");
    expect(markup).toMatch(/type="checkbox"[^>]*persona-complementary-consent/);
    const uploadButton = markup.match(
      /<button[^>]*>[\s\S]*?Enviar para conferir<\/button>/
    )?.[0];
    expect(uploadButton).toContain('disabled=""');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer"');
    expect(markup).toContain("nenhum outro leitor — somente você");
    expect(markup).not.toContain(
      "Leitores escolhidos por mim: Gestora (Gestora)"
    );
  });

  it("preserva a lista própria e o acesso à rotina mesmo com a integração desligada", () => {
    mocks.availability.enabled = false;
    mocks.mine = {
      reports: [
        {
          id: 11,
          revision: 2,
          kind: "pq",
          status: "confirmed",
          ownerName: "Pessoa",
          sourceDate: "2026-11-10",
          createdAt: "2026-11-10T12:00:00.000Z",
          confirmedAt: "2026-11-10T12:05:00.000Z",
          recipientNames: [],
        },
      ],
      hasMore: false,
    };
    const markup = renderPage();
    expect(markup).toContain(
      "Aguardando validação de permissões e privacidade"
    );
    expect(markup).toContain("Meu relatório");
    expect(markup).toContain("Abrir detalhes");
    expect(markup).not.toContain("Importar um PDF seu");
  });

  it("não cria zeros quando campos não foram extraídos", () => {
    const values = draftToValues(emptyDraft());
    expect(values.pq).toBeNull();
    expect(Object.values(values.saboteurs)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(Object.values(values.critic)).toEqual([null, null, null]);
  });

  it("trata a data da fonte como calendário, sem conversão UTC", () => {
    expect(formatCalendarDate("2026-11-11")).toBe("11/11/2026");
  });

  it("exige apenas QP no relatório QP e aceita zero explícito", () => {
    expect(
      isCompleteComplementaryDraft({ ...emptyDraft(), pq: "47" }, "pq")
    ).toBe(true);
    expect(
      isCompleteComplementaryDraft({ ...emptyDraft(), pq: "0" }, "pq")
    ).toBe(true);
    expect(isCompleteComplementaryDraft(emptyDraft(), "pq")).toBe(false);
  });

  it("exige nove Sabotadores sem exigir QP ou Crítica e preserva decimais", () => {
    const draft: DraftValues = {
      ...emptyDraft(),
      saboteurs: Object.fromEntries(
        Object.keys(emptyDraft().saboteurs).map(key => [key, "6.5"])
      ) as DraftValues["saboteurs"],
    };
    expect(isCompleteComplementaryDraft(draft, "saboteurs")).toBe(true);
    expect(draftToValues(draft).saboteurs.hyperVigilant).toBe(6.5);
    expect(
      isCompleteComplementaryDraft(
        { ...draft, saboteurs: { ...draft.saboteurs, stickler: "" } },
        "saboteurs"
      )
    ).toBe(false);
    expect(
      isCompleteComplementaryDraft(
        { ...draft, critic: { ...draft.critic, self: "0" } },
        "saboteurs"
      )
    ).toBe(false);
  });
});
