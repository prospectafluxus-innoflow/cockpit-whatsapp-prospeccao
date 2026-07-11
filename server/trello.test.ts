import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getUserIntegration: vi.fn(),
  getLeadById: vi.fn(),
  updateLead: vi.fn(),
  updateUserIntegrationState: vi.fn(),
}));

vi.mock("./integrationCrypto", () => ({
  decryptTrelloCredentials: vi.fn(() => ({ apiKey: "abc123", token: "token456" })),
}));

import * as db from "./db";
import { syncLeadToTrello } from "./trello";

const integration = {
  id: 1,
  userId: 7,
  provider: "trello",
  enabled: 1,
  credentialsEncrypted: "encrypted",
  listId: "list12345",
  listName: "Respondidos",
  lastError: null,
  lastTestedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const lead = {
  id: 91,
  userId: 7,
  name: "Ana Silva",
  firstName: "Ana",
  company: "Empresa Exemplo",
  whatsapp: "11999999999",
  score: 80,
  layer: "A",
  segment: "Tecnologia",
  size: null,
  employees: null,
  investment: null,
  taxRegime: null,
  participations: null,
  lastEvent: null,
  skippedUntil: null,
  status: "respondeu",
  kanbanColumn: "Respondeu",
  toque1SentAt: null,
  toque2SentAt: null,
  toque3SentAt: null,
  respondedAt: new Date("2026-01-02T10:00:00Z"),
  notes: "Pediu uma reunião.",
  lastAiSuggestion: null,
  trelloCardId: null,
  trelloCardUrl: null,
  trelloSyncedAt: null,
  trelloSyncError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sincronização de leads com o Trello", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserIntegration).mockResolvedValue(integration as any);
    vi.mocked(db.getLeadById).mockResolvedValue({ ...lead });
    vi.mocked(db.updateLead).mockResolvedValue(undefined as any);
    vi.mocked(db.updateUserIntegrationState).mockResolvedValue(integration as any);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não chama o Trello quando a integração está desativada", async () => {
    vi.mocked(db.getUserIntegration).mockResolvedValue({ ...integration, enabled: 0 } as any);

    await expect(syncLeadToTrello(7, 91)).resolves.toEqual({ status: "disabled" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("não cria outro cartão quando o lead já possui ID sincronizado", async () => {
    vi.mocked(db.getLeadById).mockResolvedValue({
      ...lead,
      trelloCardId: "card-existing",
      trelloCardUrl: "https://trello.com/c/existing",
    });

    await expect(syncLeadToTrello(7, 91)).resolves.toMatchObject({
      status: "already_synced",
      cardId: "card-existing",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reutiliza um cartão remoto com o marcador do lead em vez de duplicá-lo", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([{
      id: "card-remote",
      name: "Ana Silva",
      desc: "Marcador de sincronização: prospectafluxus-lead:7:91",
      url: "https://trello.com/c/remote",
    }]));

    await expect(syncLeadToTrello(7, 91)).resolves.toMatchObject({
      status: "matched",
      cardId: "card-remote",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.updateLead).toHaveBeenCalledWith(91, 7, expect.objectContaining({
      trelloCardId: "card-remote",
      trelloSyncError: null,
    }));
  });

  it("cria um único cartão com marcador e guarda o vínculo no lead", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({
        id: "card-new",
        name: "Ana Silva — Empresa Exemplo",
        desc: "prospectafluxus-lead:7:91",
        url: "https://trello.com/c/new",
      }));

    const result = await syncLeadToTrello(7, 91);

    expect(result).toMatchObject({ status: "created", cardId: "card-new" });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [createUrl, createInit] = vi.mocked(fetch).mock.calls[1]!;
    expect(String(createUrl)).toBe("https://api.trello.com/1/cards");
    expect(String(createUrl)).not.toContain("token456");
    expect(createInit?.method).toBe("POST");
    expect(String(createInit?.body)).toContain("prospectafluxus-lead:7:91");
    expect(db.updateLead).toHaveBeenCalledWith(91, 7, expect.objectContaining({
      trelloCardId: "card-new",
      trelloCardUrl: "https://trello.com/c/new",
      trelloSyncError: null,
    }));
  });

  it("reutiliza a mesma promessa para pedidos simultâneos do mesmo lead", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: "card-one", name: "Ana", desc: "", url: null }));

    const first = syncLeadToTrello(7, 91);
    const second = syncLeadToTrello(7, 91);

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("regista a falha sem rejeitar a operação local do lead", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401));

    const result = await syncLeadToTrello(7, 91);

    expect(result).toMatchObject({ status: "failed" });
    expect(db.updateLead).toHaveBeenCalledWith(91, 7, expect.objectContaining({
      trelloSyncError: expect.stringContaining("401"),
    }));
    expect(db.updateUserIntegrationState).toHaveBeenCalledWith(7, "trello", expect.objectContaining({
      lastError: expect.stringContaining("401"),
    }));
  });
});
