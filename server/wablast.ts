import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.wablastmessage.com/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export type WaBlastAccount = {
  id: string;
  name: string | null;
  phone_number: string | null;
  is_default: boolean;
  waba_id: string;
};

export type WaBlastTemplate = {
  id: string;
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  status: "PENDING" | "APPROVED" | "REJECTED" | "QUALITY_POOR";
  components: unknown;
  metaId: string | null;
  whatsAppAccountId: string;
  syncedAt: string | null;
};

export type WaBlastSendResponse = {
  id: string;
  meta_message_id: string;
  to: string;
  status: "sent";
};

export type WaBlastWebhookEnvelope = {
  id: string;
  type: string;
  api_version: string;
  created_at: string;
  account_id?: string | null;
  data: Record<string, unknown>;
};

export class WaBlastApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "WaBlastApiError";
  }
}

export function isWaBlastConfigured(): boolean {
  return Boolean(process.env.WABLAST_API_KEY?.trim());
}

export function isWaBlastWebhookConfigured(): boolean {
  return Boolean(process.env.WABLAST_WEBHOOK_SECRET?.trim());
}

function getApiKey(): string {
  const key = process.env.WABLAST_API_KEY?.trim();
  if (!key) throw new Error("WABLAST_API_KEY não configurada no servidor.");
  return key;
}

async function parseApiResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function getErrorDetails(payload: unknown, fallback: string): { message: string; code?: string } {
  if (!payload || typeof payload !== "object") return { message: fallback };
  const record = payload as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object"
    ? record.error as Record<string, unknown>
    : null;
  const message = [record.message, record.error_description, nested?.message]
    .find(value => typeof value === "string" && value.trim()) as string | undefined;
  const code = [record.code, nested?.code]
    .find(value => typeof value === "string" && value.trim()) as string | undefined;
  return { message: message ?? fallback, code };
}

async function wablastRequest<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${getApiKey()}`);
    if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const payload = await parseApiResponse(response);
    if (!response.ok) {
      const details = getErrorDetails(payload, `WaBlast respondeu com HTTP ${response.status}.`);
      throw new WaBlastApiError(details.message, response.status, details.code, payload);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof WaBlastApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new WaBlastApiError("A API WaBlast não respondeu dentro do tempo esperado.", 504, "TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function listWaBlastAccounts(): Promise<WaBlastAccount[]> {
  return wablastRequest<WaBlastAccount[]>("/accounts");
}

export async function listWaBlastTemplates(accountId?: string): Promise<WaBlastTemplate[]> {
  const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  return wablastRequest<WaBlastTemplate[]>(`/templates${query}`);
}

export async function syncWaBlastTemplates(accountId?: string): Promise<{
  synced: number;
  updated: number;
  pruned: number;
}> {
  return wablastRequest("/templates/sync", {
    method: "POST",
    body: JSON.stringify(accountId ? { account_id: accountId } : {}),
  });
}

export async function sendWaBlastTemplate(input: {
  to: string;
  accountId?: string | null;
  templateName: string;
  language: string;
  bodyParameters?: string[];
  idempotencyKey: string;
}): Promise<WaBlastSendResponse> {
  const components = input.bodyParameters?.length
    ? [{
        type: "body",
        parameters: input.bodyParameters.map(text => ({ type: "text", text })),
      }]
    : undefined;

  return wablastRequest<WaBlastSendResponse>("/messages", {
    method: "POST",
    body: JSON.stringify({
      to: normalizeE164Brazil(input.to),
      type: "template",
      ...(input.accountId ? { account_id: input.accountId } : {}),
      template: {
        name: input.templateName,
        language: input.language,
        ...(components ? { components } : {}),
      },
    }),
  }, input.idempotencyKey);
}

export async function uploadWaBlastMedia(input: {
  accountId?: string | null;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  idempotencyKey: string;
}): Promise<string> {
  const query = input.accountId ? `?account_id=${encodeURIComponent(input.accountId)}` : "";
  const form = new FormData();
  const arrayBuffer = input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength,
  ) as ArrayBuffer;
  form.append("file", new Blob([arrayBuffer], { type: input.mimeType }), input.fileName);
  const response = await wablastRequest<{ media_id: string }>(`/media${query}`, {
    method: "POST",
    body: form,
  }, input.idempotencyKey);
  if (!response.media_id) throw new Error("A WaBlast não devolveu o identificador da mídia.");
  return response.media_id;
}

export async function sendWaBlastAudio(input: {
  to: string;
  accountId?: string | null;
  mediaId: string;
  idempotencyKey: string;
}): Promise<WaBlastSendResponse> {
  return wablastRequest<WaBlastSendResponse>("/messages", {
    method: "POST",
    body: JSON.stringify({
      to: normalizeE164Brazil(input.to),
      type: "audio",
      ...(input.accountId ? { account_id: input.accountId } : {}),
      media: { id: input.mediaId },
    }),
  }, input.idempotencyKey);
}

export function normalizeE164Brazil(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  if (!/^\d{10,15}$/.test(digits)) {
    throw new Error("Número de WhatsApp inválido. Use DDD + número.");
  }
  return `+${digits}`;
}

export function phoneDigits(phone: string): string {
  const normalized = normalizeE164Brazil(phone);
  return normalized.slice(1);
}

export function verifyWaBlastWebhookSignature(input: {
  rawBody: Buffer;
  webhookId?: string;
  webhookTimestamp?: string;
  webhookSignature?: string;
  secret?: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const {
    rawBody,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    secret = process.env.WABLAST_WEBHOOK_SECRET,
    nowMs = Date.now(),
    toleranceSeconds = 300,
  } = input;

  if (!webhookId || !webhookTimestamp || !webhookSignature || !secret?.startsWith("whsec_")) {
    return false;
  }

  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > toleranceSeconds) return false;

  const supplied = webhookSignature
    .split(" ")
    .flatMap(part => part.split(","))
    .map(part => part.trim())
    .filter(Boolean);
  const versionIndex = supplied.findIndex(part => part === "v1");
  const signature = versionIndex >= 0 ? supplied[versionIndex + 1] : undefined;
  if (!signature) return false;

  let secretBytes: Buffer;
  let suppliedBytes: Buffer;
  try {
    secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
    suppliedBytes = Buffer.from(signature, "base64");
  } catch {
    return false;
  }

  const signedContent = Buffer.concat([
    Buffer.from(`${webhookId}.${webhookTimestamp}.`, "utf8"),
    rawBody,
  ]);
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest();
  return suppliedBytes.length === expected.length && timingSafeEqual(suppliedBytes, expected);
}

export function safeWaBlastError(error: unknown): { message: string; code: string | null } {
  if (error instanceof WaBlastApiError) {
    return { message: error.message.slice(0, 1000), code: error.code ?? `HTTP_${error.status}` };
  }
  return {
    message: error instanceof Error ? error.message.slice(0, 1000) : "Falha desconhecida na WaBlast.",
    code: null,
  };
}
