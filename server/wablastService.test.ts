import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getLeadById: vi.fn(),
  getMessageTemplates: vi.fn(),
  getLeadsByUser: vi.fn(),
  withDatabaseAdvisoryLock: vi.fn(async (_lockKey: number, callback: () => Promise<unknown>) => callback()),
}));

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./wablast", () => ({
  isWaBlastConfigured: vi.fn(() => true),
  isWaBlastWebhookConfigured: vi.fn(() => true),
  listWaBlastAccounts: vi.fn(),
  listWaBlastTemplates: vi.fn(),
  normalizeE164Brazil: vi.fn((phone: string) => phone.startsWith("+") ? phone : `+55${phone}`),
  phoneDigits: vi.fn((phone: string) => phone.replace(/\D/g, "")),
  safeWaBlastError: vi.fn((error: unknown) => ({
    message: error instanceof Error ? error.message : "falha",
    code: null,
  })),
  sendWaBlastAudio: vi.fn(),
  sendWaBlastTemplate: vi.fn(),
  syncWaBlastTemplates: vi.fn(),
  uploadWaBlastMedia: vi.fn(),
}));

vi.mock("./wablastDb", () => ({
  applyWaBlastMessageStatus: vi.fn(),
  assertWaBlastAccountAvailable: vi.fn(),
  assertWaBlastOutboundPhoneUnambiguous: vi.fn(),
  claimWaBlastWebhookEvent: vi.fn(),
  findLeadByPhone: vi.fn(),
  finishWaBlastWebhookEvent: vi.fn(),
  getWaBlastSettings: vi.fn(),
  getWaBlastSettingsByWebhookAccount: vi.fn(),
  insertWaBlastMessageIfNew: vi.fn(),
  listWaBlastMessageHistory: vi.fn(),
  recordLeadWhatsAppConsent: vi.fn(),
  reserveWaBlastOutbound: vi.fn(),
  updateWaBlastLastInbound: vi.fn(),
  updateWaBlastMessage: vi.fn(),
  upsertWaBlastSettings: vi.fn(),
}));

import * as coreDb from "./db";
import * as provider from "./wablast";
import * as wablastDb from "./wablastDb";
import * as storage from "./storage";
import {
  sendControlledWaBlastAudio,
  sendControlledWaBlastTemplate,
} from "./wablastService";

const settings = {
  id: 1,
  userId: 7,
  enabled: 1,
  queuePaused: 1,
  accountId: "ckv_innoflow",
  wabaId: "3403626433138093",
  accountName: "InnoFlow Soluções Inteligentes",
  phoneNumber: "+5511940888074",
  templateName: "convite_workshop",
  templateLanguage: "pt_BR",
  dailyLimit: 20,
  minIntervalSeconds: 90,
  lastConnectionCheckAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const lead = {
  id: 91,
  userId: 7,
  name: "Ana Silva",
  firstName: "Ana",
  company: "Empresa Exemplo",
  whatsapp: "11999990000",
  status: "novo",
  whatsappOptInStatus: "opted_in",
  whatsappOptInAt: new Date("2026-09-16T12:00:00Z"),
  whatsappOptInSource: "Formulário workshop #123",
  whatsappLastInboundAt: new Date(),
} as any;

const approvedTemplate = {
  id: "tpl_1",
  name: "convite_workshop",
  language: "pt_BR",
  category: "MARKETING",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Olá {{1}}" }],
  metaId: "meta_tpl_1",
  whatsAppAccountId: "ckv_innoflow",
  syncedAt: null,
} as any;

const reservation = {
  id: 501,
  userId: 7,
  leadId: 91,
  accountId: "ckv_innoflow",
  direction: "outbound",
  messageType: "template",
  status: "sending",
  phone: "+5511999990000",
  intentKey: "intent",
  idempotencyKey: "idem",
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

describe("serviço WaBlast seguro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(wablastDb.getWaBlastSettings).mockResolvedValue(settings as any);
    vi.mocked(coreDb.getLeadById).mockResolvedValue({ ...lead });
    vi.mocked(provider.listWaBlastTemplates).mockResolvedValue([approvedTemplate]);
    vi.mocked(wablastDb.reserveWaBlastOutbound).mockResolvedValue({
      message: reservation,
      created: true,
    });
    vi.mocked(provider.sendWaBlastTemplate).mockResolvedValue({
      id: "msg_1",
      meta_message_id: "wamid.1",
      to: "+5511999990000",
      status: "sent",
    });
    vi.mocked(wablastDb.updateWaBlastMessage).mockResolvedValue({ ...reservation, status: "sent" });
    vi.mocked(wablastDb.upsertWaBlastSettings).mockResolvedValue(settings as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não chama o provedor quando a intenção já foi reservada", async () => {
    vi.mocked(wablastDb.reserveWaBlastOutbound).mockResolvedValue({
      message: reservation,
      created: false,
    });

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).rejects.toThrow(/já foi reservado/i);
    expect(provider.sendWaBlastTemplate).not.toHaveBeenCalled();
  });

  it("não reserva nem envia quando outro lead compartilha o WhatsApp", async () => {
    vi.mocked(wablastDb.assertWaBlastOutboundPhoneUnambiguous)
      .mockRejectedValueOnce(new Error("Outro lead possui o mesmo WhatsApp."));

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).rejects.toThrow(/mesmo WhatsApp/i);
    expect(wablastDb.reserveWaBlastOutbound).not.toHaveBeenCalled();
    expect(provider.sendWaBlastTemplate).not.toHaveBeenCalled();
  });

  it("cancela o envio se um opt-out vencer enquanto a mensagem é preparada", async () => {
    vi.mocked(coreDb.getLeadById)
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({
        ...lead,
        whatsappOptInStatus: "opted_out",
        whatsappOptInAt: null,
        whatsappOptInSource: null,
        whatsappOptOutAt: new Date(),
      });

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).rejects.toThrow(/consentimento comprovável/i);
    expect(wablastDb.reserveWaBlastOutbound).not.toHaveBeenCalled();
    expect(provider.sendWaBlastTemplate).not.toHaveBeenCalled();
  });

  it("cancela o envio se a integração for desativada durante o preparo", async () => {
    vi.mocked(wablastDb.getWaBlastSettings)
      .mockResolvedValueOnce(settings as any)
      .mockResolvedValueOnce({ ...settings, enabled: 0 } as any);

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).rejects.toThrow(/desativados/i);
    expect(wablastDb.reserveWaBlastOutbound).not.toHaveBeenCalled();
    expect(provider.sendWaBlastTemplate).not.toHaveBeenCalled();
  });

  it("não transforma aceite real do provedor em falha quando a persistência local falha", async () => {
    vi.mocked(coreDb.getLeadById)
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({ ...lead });
    vi.mocked(wablastDb.updateWaBlastMessage).mockRejectedValueOnce(new Error("banco indisponível"));

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).resolves.toMatchObject({
      id: "msg_1",
      persistencePending: true,
    });
    expect(provider.sendWaBlastTemplate).toHaveBeenCalledTimes(1);
    expect(wablastDb.updateWaBlastMessage).toHaveBeenCalledTimes(1);
  });

  it("não envia áudio se o WhatsApp mudar durante o upload", async () => {
    vi.mocked(coreDb.getLeadById)
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({ ...lead, whatsapp: "11888880000" });
    vi.mocked(coreDb.getMessageTemplates).mockResolvedValue([{
      toque: 1,
      audioKey: "audio/key",
      audioFileName: "convite.ogg",
      audioMimeType: "audio/ogg",
    } as any]);
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("https://storage.test/audio");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    vi.mocked(provider.uploadWaBlastMedia).mockResolvedValue("media_1");

    await expect(sendControlledWaBlastAudio({
      userId: 7,
      leadId: 91,
      touchNumber: 1,
    })).rejects.toThrow(/WhatsApp do lead mudou/i);
    expect(provider.sendWaBlastAudio).not.toHaveBeenCalled();
  });

  it("não envia áudio se surgir duplicidade durante o upload", async () => {
    vi.mocked(coreDb.getLeadById)
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({ ...lead })
      .mockResolvedValueOnce({ ...lead });
    vi.mocked(coreDb.getMessageTemplates).mockResolvedValue([{
      toque: 1,
      audioKey: "audio/key",
      audioFileName: "convite.ogg",
      audioMimeType: "audio/ogg",
    } as any]);
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("https://storage.test/audio");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    vi.mocked(provider.uploadWaBlastMedia).mockResolvedValue("media_1");
    vi.mocked(wablastDb.assertWaBlastOutboundPhoneUnambiguous)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Outro lead possui o mesmo WhatsApp."));

    await expect(sendControlledWaBlastAudio({
      userId: 7,
      leadId: 91,
      touchNumber: 1,
    })).rejects.toThrow(/mesmo WhatsApp/i);
    expect(provider.sendWaBlastAudio).not.toHaveBeenCalled();
  });

  it("bloqueia template e áudio quando o opt-in não possui evidência completa", async () => {
    vi.mocked(coreDb.getLeadById).mockResolvedValue({
      ...lead,
      whatsappOptInAt: null,
      whatsappOptInSource: null,
    });

    await expect(sendControlledWaBlastTemplate({
      userId: 7,
      leadId: 91,
      bodyParameters: ["Ana"],
    })).rejects.toThrow(/consentimento comprovável/i);
    await expect(sendControlledWaBlastAudio({
      userId: 7,
      leadId: 91,
      touchNumber: 1,
    })).rejects.toThrow(/consentimento comprovável/i);
  });

  it("mantém o cockpit manual fora da implementação oficial", () => {
    const source = readFileSync(new URL("./wablastService.ts", import.meta.url), "utf8");
    expect(source).not.toContain("registerDailySend");
    expect(source).not.toContain("queueLeadTrelloSync");
    expect(source).not.toContain("kanbanColumn");
    expect(source).not.toContain("toque1SentAt");
    expect(source).not.toContain('status: "respondeu"');
  });

  it("a migração cria ownership único, intenção única e ledger de consentimento", () => {
    const migration = readFileSync(
      new URL("../drizzle/0008_modern_hairball.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain('CREATE TABLE "wablast_consent_events"');
    expect(migration).toContain('CREATE UNIQUE INDEX "wablast_messages_intent_idx"');
    expect(migration).toContain('CREATE UNIQUE INDEX "wablast_settings_account_id_idx"');
    expect(migration).toContain('CREATE UNIQUE INDEX "wablast_settings_waba_id_idx"');
    expect(migration).toContain('CREATE UNIQUE INDEX "leads_wablast_opted_in_phone_idx"');
    expect(migration).toContain('CONSTRAINT "leads_whatsapp_consent_consistency"');
    expect(migration).toContain('CONSTRAINT "wablast_consent_events_valid_state"');
  });
});
