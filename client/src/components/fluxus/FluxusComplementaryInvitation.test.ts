import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  availability: {
    enabled: true,
    eligible: true,
    reason: null,
    termsVersion: "2026-11-11.v1",
    user: { id: 7, name: "Pessoa", companyId: 10 },
    recipients: [],
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    fluxusComplementary: {
      availability: {
        useQuery: () => ({
          data: mocks.availability,
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/fluxus", vi.fn()],
}));

import FluxusComplementaryInvitation from "./FluxusComplementaryInvitation";

beforeEach(() => {
  mocks.availability = {
    enabled: true,
    eligible: true,
    reason: null,
    termsVersion: "2026-11-11.v1",
    user: { id: 7, name: "Pessoa", companyId: 10 },
    recipients: [],
  };
});

describe("convite de avaliações complementares", () => {
  it("é opcional e aparece somente quando enabled e eligible", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FluxusComplementaryInvitation)
    );
    expect(markup).toContain("Complementar meu autoconhecimento");
    expect(markup).toContain("Agora não");
  });

  it("não renderiza quando a disponibilidade está desligada", () => {
    mocks.availability.enabled = false;
    const markup = renderToStaticMarkup(
      React.createElement(FluxusComplementaryInvitation)
    );
    expect(markup).not.toContain("Complementar meu autoconhecimento");
  });

  it("não renderiza para quem ainda precisa concluir o Persona", () => {
    mocks.availability.eligible = false;
    const markup = renderToStaticMarkup(
      React.createElement(FluxusComplementaryInvitation)
    );
    expect(markup).not.toContain("Complementar meu autoconhecimento");
  });
});
