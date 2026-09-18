import { createHash } from "node:crypto";
import type { Lead, MessageTemplate, WaBlastSetting } from "../drizzle/schema";
import { getLeadById, getMessageTemplates, withDatabaseAdvisoryLock } from "./db";
import { storageGetSignedUrl } from "./storage";
import {
  isWaBlastConfigured,
  isWaBlastWebhookConfigured,
  listWaBlastAccounts,
  listWaBlastTemplates,
  normalizeE164Brazil,
  phoneDigits,
  safeWaBlastError,
  sendWaBlastAudio,
  sendWaBlastTemplate,
  syncWaBlastTemplates,
  uploadWaBlastMedia,
  type WaBlastSendResponse,
  type WaBlastTemplate,
  type WaBlastWebhookEnvelope,
} from "./wablast";
import {
  applyWaBlastMessageStatus,
  assertWaBlastOutboundPhoneUnambiguous,
  assertWaBlastAccountAvailable,
  claimWaBlastWebhookEvent,
  findLeadByPhone,
  finishWaBlastWebhookEvent,
  getWaBlastSettings,
  getWaBlastSettingsByWebhookAccount,
  insertWaBlastMessageIfNew,
  listWaBlastMessageHistory,
  recordLeadWhatsAppConsent,
  reserveWaBlastOutbound,
  updateWaBlastLastInbound,
  updateWaBlastMessage,
  upsertWaBlastSettings,
} from "./wablastDb";

const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

export type WaBlastSendWindow = {
  key: "morning" | "lunch" | "afternoon" | "evening";
  label: string;
  start: Date;
};

export function getWaBlastSendWindow(now = new Date()): WaBlastSendWindow | null {
  const inBrazil = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  const hour = inBrazil.getUTCHours();
  const window = hour >= 19
    ? { key: "evening" as const, label: "19h", hour: 19 }
    : hour >= 15
      ? { key: "afternoon" as const, label: "meio da tarde (15h)", hour: 15 }
      : hour >= 12
        ? { key: "lunch" as const, label: "almoço (12h)", hour: 12 }
        : hour >= 8
          ? { key: "morning" as const, label: "manhã (08h)", hour: 8 }
          : null;
  if (!window) return null;

  return {
    key: window.key,
    label: window.label,
    start: new Date(Date.UTC(
      inBrazil.getUTCFullYear(),
      inBrazil.getUTCMonth(),
      inBrazil.getUTCDate(),
      window.hour + 3,
    )),
  };
}

function requireWaBlastSendWindow(now = new Date()): WaBlastSendWindow {
  const window = getWaBlastSendWindow(now);
  if (!window) {
    throw new Error("Envios permitidos somente nos períodos das 08h, 12h, 15h e 19h (horário de Brasília).");
  }
  return window;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function idempotencyKeyForIntent(intentKey: string): string {
  return `pf_${sha256(intentKey)}`;
}

function normalizeReply(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.!?]+$/g, "");
}

function isOptOutReply(value: string): boolean {
  return [
    "NAO",
    "NAO QUERO",
    "PARAR",
    "PARE",
    "SAIR",
    "STOP",
    "CANCELAR",
  ].includes(normalizeReply(value));
}

function getInboundText(data: Record<string, unknown>): string {
  if (typeof data.text === "string") return data.text;
  if (data.button && typeof data.button === "object") {
    const button = data.button as Record<string, unknown>;
    if (typeof button.text === "string") return button.text;
  }
  if (data.interactive && typeof data.interactive === "object") {
    const interactive = data.interactive as Record<string, unknown>;
    if (interactive.reply && typeof interactive.reply === "object") {
      const reply = interactive.reply as Record<string, unknown>;
      if (typeof reply.title === "string") return reply.title;
    }
  }
  return "";
}

function templateBodyText(template: WaBlastTemplate): string {
  const components = Array.isArray(template.components)
    ? template.components
    : template.components && typeof template.components === "object"
      ? Object.values(template.components as Record<string, unknown>)
      : [];
  for (const component of components) {
    if (!component || typeof component !== "object") continue;
    const item = component as Record<string, unknown>;
    if (String(item.type ?? "").toUpperCase() === "BODY" && typeof item.text === "string") {
      return item.text;
    }
  }
  return "";
}

export function countTemplateBodyParameters(template: WaBlastTemplate): number {
  const matches = templateBodyText(template).match(/\{\{\d+\}\}/g) ?? [];
  const indexes = matches
    .map(value => Number(value.replace(/\D/g, "")))
    .filter(Number.isFinite);
  return indexes.length ? Math.max(...indexes) : 0;
}

function requireEnabledSettings(
  settings: Awaited<ReturnType<typeof getWaBlastSettings>>,
): WaBlastSetting & { accountId: string; wabaId: string; templateName: string } {
  if (!isWaBlastConfigured()) throw new Error("A chave da API WaBlast não está configurada no servidor.");
  if (!isWaBlastWebhookConfigured()) throw new Error("Configure o webhook assinado antes de realizar envios.");
  if (!settings) throw new Error("A Área InnoFlow ainda não foi configurada.");
  if (settings.enabled !== 1) throw new Error("Os envios WaBlast estão desativados.");
  if (!settings.accountId || !settings.wabaId || !settings.templateName) {
    throw new Error("Selecione a conexão e o template aprovado antes de enviar.");
  }
  return settings as WaBlastSetting & { accountId: string; wabaId: string; templateName: string };
}

function assertConsent(lead: Lead) {
  if (
    lead.whatsappOptInStatus !== "opted_in"
    || !lead.whatsappOptInAt
    || !lead.whatsappOptInSource?.trim()
  ) {
    throw new Error("Registre consentimento comprovável antes do envio.");
  }
}

function assertOpenServiceWindow(inboundAt: Date | null): Date {
  if (!inboundAt) throw new Error("Áudio exige uma mensagem recebida do lead nas últimas 24 horas.");
  const at = new Date(inboundAt);
  const age = Date.now() - at.getTime();
  if (!Number.isFinite(age) || age < -FUTURE_TOLERANCE_MS || age > DAY_MS) {
    throw new Error("A janela de atendimento de 24 horas está fechada.");
  }
  return at;
}

function eventTimestamp(event: WaBlastWebhookEnvelope): Date {
  const parsed = new Date(event.created_at);
  if (Number.isNaN(parsed.getTime())) throw new Error("Webhook WaBlast com created_at inválido.");
  if (parsed.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    throw new Error("Webhook WaBlast com created_at no futuro.");
  }
  return parsed;
}

async function recordProviderFailure(input: {
  messageId: number;
  userId: number;
  error: unknown;
}) {
  const safe = safeWaBlastError(input.error);
  const uncertain = safe.code === "TIMEOUT";
  await updateWaBlastMessage(input.messageId, input.userId, {
    status: uncertain ? "sending" : "failed",
    errorCode: safe.code,
    errorMessage: uncertain
      ? "Resposta ambígua: aguardando conciliação pelo webhook. Não reenvie."
      : safe.message,
    failedAt: uncertain ? null : new Date(),
  }).catch(persistenceError => {
    console.error("[WaBlast] Falha ao persistir erro do provedor:", persistenceError);
  });
  await upsertWaBlastSettings(input.userId, { lastError: safe.message }).catch(() => null);
}

async function persistProviderAcceptance(input: {
  messageId: number;
  userId: number;
  response: WaBlastSendResponse;
  extraProviderData?: Record<string, unknown>;
}) {
  try {
    const updated = await updateWaBlastMessage(input.messageId, input.userId, {
      status: "sent",
      wablastMessageId: input.response.id,
      metaMessageId: input.response.meta_message_id,
      sentAt: new Date(),
      providerData: {
        ...input.response,
        ...input.extraProviderData,
      },
      errorCode: null,
      errorMessage: null,
    });
    if (!updated) throw new Error("Registro reservado não encontrado após aceite do provedor.");
    await upsertWaBlastSettings(input.userId, { lastError: null }).catch(() => null);
    return false;
  } catch (error) {
    console.error(
      "[WaBlast] Provedor aceitou o envio, mas a persistência local falhou. O webhook fará a conciliação:",
      error,
    );
    return true;
  }
}

export async function getWaBlastAdminOverview(userId: number) {
  const settings = await getWaBlastSettings(userId);
  const history = await listWaBlastMessageHistory(userId, 100);
  return { configured: isWaBlastConfigured(), settings, history };
}

export async function testAndDiscoverWaBlast(userId: number) {
  if (!isWaBlastConfigured()) throw new Error("WABLAST_API_KEY não configurada no Railway.");
  const accounts = await listWaBlastAccounts();
  const current = await getWaBlastSettings(userId);
  const account = accounts.find(item => item.id === current?.accountId)
    ?? accounts.find(item => item.is_default)
    ?? accounts[0]
    ?? null;
  const templates = account ? await listWaBlastTemplates(account.id) : [];
  const approvedTemplates = templates.filter(item => item.status === "APPROVED");

  if (account) {
    await withDatabaseAdvisoryLock(userId, async () => {
      await assertWaBlastAccountAvailable({ userId, accountId: account.id, wabaId: account.waba_id });
      await upsertWaBlastSettings(userId, {
        accountId: account.id,
        wabaId: account.waba_id,
        accountName: account.name,
        phoneNumber: account.phone_number,
        lastConnectionCheckAt: new Date(),
        lastError: null,
      });
    });
  }
  return { accounts, templates, approvedTemplates };
}

export async function saveWaBlastConfiguration(input: {
  userId: number;
  accountId: string;
  templateName: string;
  templateLanguage: string;
  dailyLimit: number;
  minIntervalSeconds: number;
  enabled: boolean;
  queuePaused: boolean;
}) {
  // Desativar precisa vencer imediatamente qualquer novo envio, mesmo se a API externa estiver lenta.
  const currentSettings = await getWaBlastSettings(input.userId);
  if (!input.enabled && currentSettings?.enabled === 1) {
    return withDatabaseAdvisoryLock(input.userId, () => upsertWaBlastSettings(input.userId, {
      enabled: 0,
      queuePaused: input.queuePaused ? 1 : 0,
      dailyLimit: input.dailyLimit,
      minIntervalSeconds: input.minIntervalSeconds,
    }));
  }

  const accounts = await listWaBlastAccounts();
  const account = accounts.find(item => item.id === input.accountId);
  if (!account) throw new Error("A conexão WaBlast selecionada não existe.");
  await syncWaBlastTemplates(account.id).catch(() => null);
  const templates = await listWaBlastTemplates(account.id);
  const template = templates.find(item =>
    item.name === input.templateName
    && item.language === input.templateLanguage
    && item.status === "APPROVED"
  );
  if (!template) throw new Error("Selecione um template aprovado pela Meta.");

  return withDatabaseAdvisoryLock(input.userId, async () => {
    await assertWaBlastAccountAvailable({
      userId: input.userId,
      accountId: account.id,
      wabaId: account.waba_id,
    });
    return upsertWaBlastSettings(input.userId, {
      enabled: input.enabled ? 1 : 0,
      queuePaused: input.queuePaused ? 1 : 0,
      accountId: account.id,
      wabaId: account.waba_id,
      accountName: account.name,
      phoneNumber: account.phone_number,
      templateName: template.name,
      templateLanguage: template.language,
      dailyLimit: input.dailyLimit,
      minIntervalSeconds: input.minIntervalSeconds,
      lastConnectionCheckAt: new Date(),
      lastError: null,
    });
  });
}

export async function sendControlledWaBlastTemplate(input: {
  userId: number;
  leadId: number;
  bodyParameters: string[];
}) {
  const initialSettings = requireEnabledSettings(await getWaBlastSettings(input.userId));
  const initialLead = await getLeadById(input.leadId, input.userId);
  if (!initialLead) throw new Error("Lead não encontrado.");
  assertConsent(initialLead);

  const templates = await listWaBlastTemplates(initialSettings.accountId);
  const template = templates.find(item =>
    item.name === initialSettings.templateName
    && item.language === initialSettings.templateLanguage
    && item.status === "APPROVED"
  );
  if (!template) throw new Error("O template selecionado não está aprovado ou não foi encontrado.");
  const requiredParameters = countTemplateBodyParameters(template);
  if (input.bodyParameters.length !== requiredParameters) {
    throw new Error(`O template exige ${requiredParameters} variável(is) no corpo.`);
  }

  return withDatabaseAdvisoryLock(input.userId, async () => {
    const settings = requireEnabledSettings(await getWaBlastSettings(input.userId));
    const lead = await getLeadById(input.leadId, input.userId);
    if (!lead) throw new Error("Lead não encontrado.");
    assertConsent(lead);
    await assertWaBlastOutboundPhoneUnambiguous({
      userId: input.userId,
      leadId: lead.id,
      normalizedPhoneDigits: phoneDigits(lead.whatsapp),
    });
    if (
      settings.accountId !== initialSettings.accountId
      || settings.templateName !== template.name
      || settings.templateLanguage !== template.language
    ) {
      throw new Error("A configuração WaBlast mudou durante o preparo. Revise antes de enviar.");
    }

    const sendWindow = requireWaBlastSendWindow();
    const intentKey = `template:${input.userId}:${settings.accountId}:${lead.id}:initial`;
    const idempotencyKey = idempotencyKeyForIntent(intentKey);
    const reservation = await reserveWaBlastOutbound({
      message: {
        userId: input.userId,
        leadId: lead.id,
        accountId: settings.accountId,
        direction: "outbound",
        messageType: "template",
        status: "sending",
        phone: normalizeE164Brazil(lead.whatsapp),
        touchNumber: 1,
        templateName: template.name,
        templateLanguage: template.language,
        bodyPreview: templateBodyText(template).slice(0, 1000) || `Template ${template.name}`,
        intentKey,
        idempotencyKey,
      },
      periodStart: sendWindow.start,
      periodLimit: settings.dailyLimit,
      periodLabel: sendWindow.label,
      minIntervalSeconds: settings.minIntervalSeconds,
    });
    if (!reservation.created) {
      throw new Error("Este envio já foi reservado ou processado. Consulte o histórico; não reenvie.");
    }

    let response: WaBlastSendResponse;
    try {
      response = await sendWaBlastTemplate({
        to: lead.whatsapp,
        accountId: settings.accountId,
        templateName: template.name,
        language: template.language,
        bodyParameters: input.bodyParameters,
        idempotencyKey,
      });
    } catch (error) {
      await recordProviderFailure({ messageId: reservation.message.id, userId: input.userId, error });
      throw error;
    }

    const persistencePending = await persistProviderAcceptance({
      messageId: reservation.message.id,
      userId: input.userId,
      response,
    });
    return { ...response, persistencePending };
  });
}

function findAudioTemplate(
  templates: MessageTemplate[],
  touchNumber: number,
): MessageTemplate & { audioKey: string; audioFileName: string; audioMimeType: string } {
  const template = templates.find(item => item.toque === touchNumber);
  if (!template?.audioKey || !template.audioFileName || !template.audioMimeType) {
    throw new Error(`Nenhum áudio foi configurado para o toque ${touchNumber}.`);
  }
  return template as MessageTemplate & { audioKey: string; audioFileName: string; audioMimeType: string };
}

export async function sendControlledWaBlastAudio(input: {
  userId: number;
  leadId: number;
  touchNumber: number;
}) {
  const initialSettings = requireEnabledSettings(await getWaBlastSettings(input.userId));
  const initialLead = await getLeadById(input.leadId, input.userId);
  if (!initialLead) throw new Error("Lead não encontrado.");
  assertConsent(initialLead);
  assertOpenServiceWindow(initialLead.whatsappLastInboundAt);
  const template = findAudioTemplate(await getMessageTemplates(input.userId), input.touchNumber);

  return withDatabaseAdvisoryLock(input.userId, async () => {
    const settings = requireEnabledSettings(await getWaBlastSettings(input.userId));
    const lead = await getLeadById(input.leadId, input.userId);
    if (!lead) throw new Error("Lead não encontrado.");
    assertConsent(lead);
    await assertWaBlastOutboundPhoneUnambiguous({
      userId: input.userId,
      leadId: lead.id,
      normalizedPhoneDigits: phoneDigits(lead.whatsapp),
    });
    const inboundAt = assertOpenServiceWindow(lead.whatsappLastInboundAt);
    if (settings.accountId !== initialSettings.accountId) {
      throw new Error("A conexão WaBlast mudou durante o preparo. Revise antes de enviar.");
    }

    const sendWindow = requireWaBlastSendWindow();
    const intentKey = `audio:${input.userId}:${settings.accountId}:${lead.id}:${input.touchNumber}:${inboundAt.toISOString()}`;
    const idempotencyKey = idempotencyKeyForIntent(intentKey);
    const reservation = await reserveWaBlastOutbound({
      message: {
        userId: input.userId,
        leadId: lead.id,
        accountId: settings.accountId,
        direction: "outbound",
        messageType: "audio",
        status: "sending",
        phone: normalizeE164Brazil(lead.whatsapp),
        touchNumber: input.touchNumber,
        bodyPreview: template.audioFileName,
        intentKey,
        idempotencyKey,
      },
      periodStart: sendWindow.start,
      periodLimit: settings.dailyLimit,
      periodLabel: sendWindow.label,
      minIntervalSeconds: settings.minIntervalSeconds,
    });
    if (!reservation.created) {
      throw new Error("Este áudio já foi reservado para a janela atual. Consulte o histórico; não reenvie.");
    }

    let response: WaBlastSendResponse;
    let mediaId: string | null = null;
    try {
      const signedUrl = await storageGetSignedUrl(template.audioKey);
      const audioResponse = await fetch(signedUrl);
      if (!audioResponse.ok) throw new Error("Não foi possível ler o áudio guardado.");
      const bytes = new Uint8Array(await audioResponse.arrayBuffer());
      mediaId = await uploadWaBlastMedia({
        accountId: settings.accountId,
        bytes,
        fileName: template.audioFileName,
        mimeType: template.audioMimeType,
        idempotencyKey: `${idempotencyKey}_media`,
      });
      // O upload pode aproximar a janela do limite; releia o lead antes do POST real.
      const freshLead = await getLeadById(input.leadId, input.userId);
      if (!freshLead) throw new Error("Lead não encontrado após o upload do áudio.");
      assertConsent(freshLead);
      if (phoneDigits(freshLead.whatsapp) !== phoneDigits(lead.whatsapp)) {
        throw new Error("O WhatsApp do lead mudou durante o preparo. Confirme novamente o envio.");
      }
      await assertWaBlastOutboundPhoneUnambiguous({
        userId: input.userId,
        leadId: freshLead.id,
        normalizedPhoneDigits: phoneDigits(freshLead.whatsapp),
      });
      const freshInboundAt = assertOpenServiceWindow(freshLead.whatsappLastInboundAt);
      if (freshInboundAt.getTime() !== inboundAt.getTime()) {
        throw new Error("Uma nova mensagem chegou durante o preparo. Confirme novamente o envio do áudio.");
      }
      const freshWindow = requireWaBlastSendWindow();
      if (freshWindow.key !== sendWindow.key || freshWindow.start.getTime() !== sendWindow.start.getTime()) {
        throw new Error("O período de envio mudou durante o upload. Confirme novamente no novo período.");
      }
      response = await sendWaBlastAudio({
        to: freshLead.whatsapp,
        accountId: settings.accountId,
        mediaId,
        idempotencyKey,
      });
    } catch (error) {
      await recordProviderFailure({ messageId: reservation.message.id, userId: input.userId, error });
      throw error;
    }

    const persistencePending = await persistProviderAcceptance({
      messageId: reservation.message.id,
      userId: input.userId,
      response,
      extraProviderData: mediaId ? { media_id: mediaId } : undefined,
    });
    return { ...response, persistencePending };
  });
}

export async function getWaBlastEligibleLeads(userId: number) {
  const { getLeadsByUser } = await import("./db");
  const all = await getLeadsByUser(userId);
  return all.map(lead => ({
    id: lead.id,
    name: lead.name,
    firstName: lead.firstName,
    company: lead.company,
    whatsapp: lead.whatsapp,
    layer: lead.layer,
    status: lead.status,
    whatsappOptInStatus: lead.whatsappOptInStatus,
    whatsappOptInAt: lead.whatsappOptInAt,
    whatsappOptInSource: lead.whatsappOptInSource,
    whatsappLastInboundAt: lead.whatsappLastInboundAt,
    hasOpenWindow: Boolean(
      lead.whatsappLastInboundAt
      && Date.now() - new Date(lead.whatsappLastInboundAt).getTime() >= -FUTURE_TOLERANCE_MS
      && Date.now() - new Date(lead.whatsappLastInboundAt).getTime() <= DAY_MS
    ),
  }));
}

async function processMessageStatus(
  userId: number,
  accountId: string,
  event: WaBlastWebhookEnvelope,
  status: "sent" | "delivered" | "read" | "failed",
) {
  const messageId = typeof event.data.message_id === "string" ? event.data.message_id : "";
  if (!messageId) throw new Error(`Evento ${event.type} sem message_id.`);
  const at = eventTimestamp(event);
  const errors = Array.isArray(event.data.errors) ? event.data.errors : [];
  const firstError = errors[0] && typeof errors[0] === "object"
    ? errors[0] as Record<string, unknown>
    : null;
  const recipient = typeof event.data.to === "string"
    ? normalizeE164Brazil(event.data.to)
    : null;
  const updated = await applyWaBlastMessageStatus({
    userId,
    accountId,
    providerMessageId: messageId,
    status,
    phone: recipient,
    data: {
      ...(status === "sent" ? { sentAt: at } : {}),
      ...(status === "delivered" ? { deliveredAt: at } : {}),
      ...(status === "read" ? { readAt: at } : {}),
      ...(status === "failed" ? {
        failedAt: at,
        errorCode: typeof firstError?.code === "string" ? firstError.code : null,
        errorMessage: typeof firstError?.message === "string"
          ? firstError.message.slice(0, 1000)
          : "Falha informada pela Meta.",
      } : {}),
      providerData: event.data,
    },
  });
  if (!updated) throw new Error(`Mensagem local não encontrada para o evento ${event.type}.`);
}

async function processInboundMessage(
  userId: number,
  accountId: string,
  event: WaBlastWebhookEnvelope,
) {
  const from = typeof event.data.from === "string" ? event.data.from : "";
  const messageId = typeof event.data.message_id === "string" ? event.data.message_id : "";
  if (!from || !messageId) throw new Error("Mensagem recebida sem remetente ou message_id.");
  const lead = await findLeadByPhone(userId, phoneDigits(from));
  const text = getInboundText(event.data);
  const at = eventTimestamp(event);

  await insertWaBlastMessageIfNew({
    userId,
    leadId: lead?.id ?? null,
    accountId,
    direction: "inbound",
    messageType: typeof event.data.type === "string" ? event.data.type : "unknown",
    status: "received",
    phone: normalizeE164Brazil(from),
    bodyPreview: text.slice(0, 1000) || null,
    wablastMessageId: messageId,
    metaMessageId: messageId,
    providerData: event.data,
    receivedAt: at,
  });

  if (!lead) return;
  if (text && isOptOutReply(text)) {
    await recordLeadWhatsAppConsent({
      userId,
      leadId: lead.id,
      status: "opted_out",
      sourceType: "whatsapp_reply",
      evidenceReference: text,
      providerEventId: event.id,
      eventAt: at,
    });
  }

  // Campo exclusivo do canal oficial: não altera status, toque, Kanban, métricas ou Trello.
  await updateWaBlastLastInbound(userId, lead.id, at);
}

async function processPreferenceUpdate(userId: number, event: WaBlastWebhookEnvelope) {
  const waId = typeof event.data.wa_id === "string" ? event.data.wa_id : "";
  const value = typeof event.data.value === "string" ? event.data.value : "";
  if (!waId || !["stop", "resume", "signup"].includes(value)) return;
  const lead = await findLeadByPhone(userId, phoneDigits(waId));
  if (!lead) return;
  await recordLeadWhatsAppConsent({
    userId,
    leadId: lead.id,
    status: value === "stop" ? "opted_out" : "opted_in",
    sourceType: value === "signup" ? "whatsapp_signup" : "whatsapp_preference",
    evidenceReference: typeof event.data.detail === "string" ? event.data.detail : value,
    providerEventId: event.id,
    eventAt: eventTimestamp(event),
  });
}

export async function processWaBlastWebhook(event: WaBlastWebhookEnvelope) {
  const claim = await claimWaBlastWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    accountId: event.account_id ?? null,
    payload: event as unknown as Record<string, unknown>,
  });
  if (!claim.claimed) return { duplicate: claim.duplicate };
  if (!claim.token) throw new Error("Evento reivindicado sem token de processamento.");

  try {
    if (event.type === "endpoint.test") {
      await finishWaBlastWebhookEvent(event.id, claim.token);
      return { duplicate: false };
    }
    if (!event.account_id) throw new Error("Evento sem account_id (WABA ID)." );
    const settings = await getWaBlastSettingsByWebhookAccount(event.account_id);
    if (!settings?.accountId) throw new Error("Nenhuma configuração WaBlast corresponde ao WABA recebido.");

    if (event.type === "message.sent") await processMessageStatus(settings.userId, settings.accountId, event, "sent");
    else if (event.type === "message.delivered") await processMessageStatus(settings.userId, settings.accountId, event, "delivered");
    else if (event.type === "message.read") await processMessageStatus(settings.userId, settings.accountId, event, "read");
    else if (event.type === "message.failed") await processMessageStatus(settings.userId, settings.accountId, event, "failed");
    else if (event.type === "message.received") await processInboundMessage(settings.userId, settings.accountId, event);
    else if (event.type === "user.preferences_updated") await processPreferenceUpdate(settings.userId, event);

    await finishWaBlastWebhookEvent(event.id, claim.token);
    return { duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar webhook WaBlast.";
    await finishWaBlastWebhookEvent(event.id, claim.token, message);
    throw error;
  }
}

export function suggestedTemplateParameters(
  lead: Pick<Lead, "firstName" | "name" | "company">,
  count: number,
) {
  const candidates = [lead.firstName ?? lead.name.split(" ")[0] ?? lead.name, lead.company ?? ""];
  return Array.from({ length: count }, (_, index) => candidates[index] ?? "");
}
