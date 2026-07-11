import type { Lead } from "../drizzle/schema";
import * as db from "./db";
import {
  decryptTrelloCredentials,
  type TrelloCredentials,
} from "./integrationCrypto";

const TRELLO_API_BASE = "https://api.trello.com/1";
const REQUEST_TIMEOUT_MS = 12_000;
const inFlightSyncs = new Map<string, Promise<TrelloSyncResult>>();

type TrelloList = {
  id: string;
  name: string;
  closed?: boolean;
};

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url?: string;
  shortUrl?: string;
};

export type TrelloSyncResult =
  | { status: "disabled" | "not_found" | "not_responded" }
  | { status: "already_synced" | "matched" | "created"; cardId: string; cardUrl: string | null }
  | { status: "failed"; message: string };

function authorizationHeader(credentials: TrelloCredentials): string {
  if (!/^[A-Za-z0-9]+$/.test(credentials.apiKey) || !/^[A-Za-z0-9]+$/.test(credentials.token)) {
    throw new Error("A API key ou o token do Trello tem formato inválido.");
  }

  return `OAuth oauth_consumer_key="${credentials.apiKey}", oauth_token="${credentials.token}"`;
}

async function trelloRequest<T>(
  path: string,
  credentials: TrelloCredentials,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${TRELLO_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: authorizationHeader(credentials),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`O Trello respondeu com o código ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("O Trello demorou demasiado a responder.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testTrelloList(
  listId: string,
  credentials: TrelloCredentials
): Promise<TrelloList> {
  const list = await trelloRequest<TrelloList>(
    `/lists/${encodeURIComponent(listId)}?fields=name,closed`,
    credentials
  );

  if (list.closed) {
    throw new Error("A lista selecionada no Trello está arquivada.");
  }

  return list;
}

function leadMarker(userId: number, leadId: number): string {
  return `prospectafluxus-lead:${userId}:${leadId}`;
}

function cardName(lead: Lead): string {
  const company = lead.company?.trim();
  return company ? `${lead.name} — ${company}`.slice(0, 500) : lead.name.slice(0, 500);
}

function cardDescription(lead: Lead): string {
  const rows = [
    `Lead respondido no ProspectaFluxus.`,
    "",
    `Nome: ${lead.name}`,
    lead.company ? `Empresa: ${lead.company}` : null,
    `WhatsApp: ${lead.whatsapp}`,
    lead.segment ? `Segmento: ${lead.segment}` : null,
    lead.layer ? `Camada: ${lead.layer}` : null,
    lead.respondedAt ? `Respondido em: ${lead.respondedAt.toISOString()}` : null,
    lead.notes ? `Notas: ${lead.notes}` : null,
    "",
    `Marcador de sincronização: ${leadMarker(lead.userId, lead.id)}`,
  ].filter((row): row is string => Boolean(row));

  return rows.join("\n").slice(0, 16_384);
}

async function findExistingCard(
  listId: string,
  marker: string,
  credentials: TrelloCredentials
): Promise<TrelloCard | null> {
  const cards = await trelloRequest<TrelloCard[]>(
    `/lists/${encodeURIComponent(listId)}/cards?fields=id,name,desc,url,shortUrl&filter=open`,
    credentials
  );
  return cards.find(card => card.desc?.includes(marker)) ?? null;
}

async function createCard(
  listId: string,
  lead: Lead,
  credentials: TrelloCredentials
): Promise<TrelloCard> {
  return trelloRequest<TrelloCard>("/cards", credentials, {
    method: "POST",
    body: JSON.stringify({
      idList: listId,
      name: cardName(lead),
      desc: cardDescription(lead),
      pos: "top",
    }),
  });
}

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Falha inesperada ao sincronizar com o Trello.";
  return message.slice(0, 500);
}

async function performLeadSync(userId: number, leadId: number): Promise<TrelloSyncResult> {
  const integration = await db.getUserIntegration(userId, "trello");
  if (!integration || integration.enabled !== 1) {
    return { status: "disabled" };
  }

  const lead = await db.getLeadById(leadId, userId);
  if (!lead) return { status: "not_found" };
  if (lead.status !== "respondeu" && lead.kanbanColumn !== "Respondeu") {
    return { status: "not_responded" };
  }
  if (lead.trelloCardId) {
    return {
      status: "already_synced",
      cardId: lead.trelloCardId,
      cardUrl: lead.trelloCardUrl,
    };
  }

  try {
    const credentials = decryptTrelloCredentials(userId, integration.credentialsEncrypted);
    const marker = leadMarker(userId, lead.id);
    const existing = await findExistingCard(integration.listId, marker, credentials);
    const card = existing ?? await createCard(integration.listId, lead, credentials);
    const cardUrl = card.url ?? card.shortUrl ?? null;

    await db.updateLead(lead.id, userId, {
      trelloCardId: card.id,
      trelloCardUrl: cardUrl,
      trelloSyncedAt: new Date(),
      trelloSyncError: null,
    });
    await db.updateUserIntegrationState(userId, "trello", { lastError: null });

    return {
      status: existing ? "matched" : "created",
      cardId: card.id,
      cardUrl,
    };
  } catch (error) {
    const message = publicErrorMessage(error);
    await Promise.allSettled([
      db.updateLead(lead.id, userId, { trelloSyncError: message }),
      db.updateUserIntegrationState(userId, "trello", { lastError: message }),
    ]);
    return { status: "failed", message };
  }
}

export function syncLeadToTrello(userId: number, leadId: number): Promise<TrelloSyncResult> {
  const key = `${userId}:${leadId}`;
  const current = inFlightSyncs.get(key);
  if (current) return current;

  const sync = performLeadSync(userId, leadId).finally(() => {
    if (inFlightSyncs.get(key) === sync) inFlightSyncs.delete(key);
  });
  inFlightSyncs.set(key, sync);
  return sync;
}

export function queueLeadTrelloSync(userId: number, leadId: number): void {
  void syncLeadToTrello(userId, leadId).catch(error => {
    console.error("[Trello] Falha inesperada na fila de sincronização:", publicErrorMessage(error));
  });
}
