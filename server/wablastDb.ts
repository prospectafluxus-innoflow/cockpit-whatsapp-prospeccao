import { and, desc, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  leads,
  wablastConsentEvents,
  wablastMessages,
  wablastSettings,
  wablastWebhookEvents,
  type InsertWaBlastMessage,
  type InsertWaBlastSetting,
  type WaBlastMessage,
  type WaBlastSetting,
} from "../drizzle/schema";
import { db, withDatabaseAdvisoryLock } from "./db";

export async function getWaBlastSettings(userId: number): Promise<WaBlastSetting | null> {
  const rows = await db
    .select()
    .from(wablastSettings)
    .where(eq(wablastSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWaBlastSettingsByWebhookAccount(wabaId: string): Promise<WaBlastSetting | null> {
  const rows = await db
    .select()
    .from(wablastSettings)
    .where(eq(wablastSettings.wabaId, wabaId))
    .limit(2);
  if (rows.length > 1) throw new Error("Ownership WaBlast ambíguo para o WABA recebido.");
  return rows[0] ?? null;
}

export async function assertWaBlastAccountAvailable(input: {
  userId: number;
  accountId: string;
  wabaId: string;
}): Promise<void> {
  const rows = await db
    .select({ userId: wablastSettings.userId })
    .from(wablastSettings)
    .where(or(
      eq(wablastSettings.accountId, input.accountId),
      eq(wablastSettings.wabaId, input.wabaId),
    ))
    .limit(2);
  if (rows.some(row => row.userId !== input.userId)) {
    throw new Error("Esta conta WaBlast já pertence a outra operação no ProspectaFluxus.");
  }
}

export async function upsertWaBlastSettings(
  userId: number,
  data: Partial<InsertWaBlastSetting>,
): Promise<WaBlastSetting> {
  const now = new Date();
  const rows = await db
    .insert(wablastSettings)
    .values({ userId, ...data, updatedAt: now } as InsertWaBlastSetting)
    .onConflictDoUpdate({
      target: wablastSettings.userId,
      set: { ...data, updatedAt: now },
    })
    .returning();
  return rows[0]!;
}

export async function recordLeadWhatsAppConsent(input: {
  userId: number;
  leadId: number;
  actorUserId?: number | null;
  status: "unknown" | "opted_in" | "opted_out";
  sourceType: string;
  evidenceReference?: string | null;
  providerEventId?: string | null;
  eventAt?: Date;
}) {
  if (input.status === "unknown") {
    throw new Error("O estado unknown é inicial e não pode ser registrado como evento de consentimento.");
  }
  if (
    input.status === "opted_in"
    && (!input.evidenceReference?.trim() || input.sourceType === "admin_block")
  ) {
    throw new Error("Opt-in exige evidência verificável e uma origem válida.");
  }
  const eventAt = input.eventAt ?? new Date();
  return withDatabaseAdvisoryLock(input.userId, () => db.transaction(async tx => {
    if (input.providerEventId) {
      const existing = await tx
        .select({ id: wablastConsentEvents.id })
        .from(wablastConsentEvents)
        .where(eq(wablastConsentEvents.providerEventId, input.providerEventId))
        .limit(1);
      if (existing.length) {
        const leadRows = await tx
          .select()
          .from(leads)
          .where(and(eq(leads.id, input.leadId), eq(leads.userId, input.userId)))
          .limit(1);
        return leadRows[0] ?? null;
      }
    }

    const leadRows = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, input.leadId), eq(leads.userId, input.userId)))
      .limit(1);
    const current = leadRows[0];
    if (!current) return null;

    const currentEventAt = current.whatsappConsentUpdatedAt?.getTime() ?? 0;
    const incomingEventAt = eventAt.getTime();
    const sameMomentOptOutWins = incomingEventAt === currentEventAt && input.status === "opted_out";
    const shouldApply = incomingEventAt > currentEventAt || sameMomentOptOutWins;

    let lead = current;
    if (shouldApply) {
      if (input.status === "opted_in") {
        const lastEleven = current.whatsapp.replace(/\D/g, "").slice(-11);
        const duplicate = await tx
          .select({ id: leads.id })
          .from(leads)
          .where(and(
            eq(leads.userId, input.userId),
            ne(leads.id, input.leadId),
            sql`right(regexp_replace(${leads.whatsapp}, '[^0-9]', '', 'g'), 11) = ${lastEleven}`,
          ))
          .limit(1);
        if (duplicate[0]) {
          throw new Error("Outro lead possui o mesmo WhatsApp. Resolva a duplicidade antes de registrar opt-in.");
        }
      }
      const rows = await tx
        .update(leads)
        .set({
          whatsappOptInStatus: input.status,
          whatsappOptInAt: input.status === "opted_in" ? eventAt : null,
          whatsappOptInSource: input.status === "opted_in"
            ? input.evidenceReference?.slice(0, 255) ?? input.sourceType.slice(0, 255)
            : null,
          whatsappOptOutAt: input.status === "opted_out" ? eventAt : null,
          whatsappConsentUpdatedAt: eventAt,
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, input.leadId), eq(leads.userId, input.userId)))
        .returning();
      lead = rows[0] ?? current;
    }

    await tx.insert(wablastConsentEvents).values({
      userId: input.userId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      status: input.status,
      sourceType: input.sourceType.slice(0, 64),
      evidenceReference: input.evidenceReference?.slice(0, 2000) ?? null,
      providerEventId: input.providerEventId ?? null,
      eventAt,
      applied: shouldApply ? 1 : 0,
    });
    return lead;
  }));
}

export async function findLeadByPhone(userId: number, normalizedPhoneDigits: string) {
  const lastEleven = normalizedPhoneDigits.slice(-11);
  const optedInRows = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.userId, userId),
      eq(leads.whatsappOptInStatus, "opted_in"),
      sql`right(regexp_replace(${leads.whatsapp}, '[^0-9]', '', 'g'), 11) = ${lastEleven}`,
    ))
    .limit(2);
  if (optedInRows.length > 1) {
    throw new Error("Mais de um lead com opt-in ativo possui este WhatsApp; corrija a duplicidade.");
  }
  if (optedInRows[0]) return optedInRows[0];

  const rows = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.userId, userId),
      sql`right(regexp_replace(${leads.whatsapp}, '[^0-9]', '', 'g'), 11) = ${lastEleven}`,
    ))
    .limit(2);
  if (rows.length > 1) {
    throw new Error("Mais de um lead possui este WhatsApp; corrija a duplicidade antes de processar mensagens.");
  }
  return rows[0] ?? null;
}

export async function assertWaBlastOutboundPhoneUnambiguous(input: {
  userId: number;
  leadId: number;
  normalizedPhoneDigits: string;
}): Promise<void> {
  const lastEleven = input.normalizedPhoneDigits.slice(-11);
  const duplicate = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(
      eq(leads.userId, input.userId),
      ne(leads.id, input.leadId),
      sql`right(regexp_replace(${leads.whatsapp}, '[^0-9]', '', 'g'), 11) = ${lastEleven}`,
    ))
    .limit(1);
  if (duplicate[0]) {
    throw new Error("Outro lead possui o mesmo WhatsApp. Resolva a duplicidade antes de enviar.");
  }
}

export async function updateWaBlastLastInbound(
  userId: number,
  leadId: number,
  receivedAt: Date,
): Promise<void> {
  await db
    .update(leads)
    .set({
      whatsappLastInboundAt: sql`greatest(coalesce(${leads.whatsappLastInboundAt}, ${receivedAt}), ${receivedAt})`,
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
}

export async function reserveWaBlastOutbound(input: {
  message: InsertWaBlastMessage & { intentKey: string; idempotencyKey: string };
  periodStart: Date;
  periodLimit: number;
  periodLabel: string;
  minIntervalSeconds: number;
}): Promise<{ message: WaBlastMessage; created: boolean }> {
  return db.transaction(async tx => {
    const existing = await tx
      .select()
      .from(wablastMessages)
      .where(eq(wablastMessages.intentKey, input.message.intentKey))
      .limit(1);
    if (existing[0]) return { message: existing[0], created: false };

    const countRows = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(wablastMessages)
      .where(and(
        eq(wablastMessages.userId, input.message.userId),
        eq(wablastMessages.direction, "outbound"),
        gte(wablastMessages.createdAt, input.periodStart),
        sql`${wablastMessages.status} <> 'failed'`,
      ));
    const total = Number(countRows[0]?.total ?? 0);
    if (total >= input.periodLimit) {
      throw new Error(`Limite de ${input.periodLimit} envios do período ${input.periodLabel} atingido.`);
    }

    const lastRows = await tx
      .select()
      .from(wablastMessages)
      .where(and(
        eq(wablastMessages.userId, input.message.userId),
        eq(wablastMessages.direction, "outbound"),
        sql`${wablastMessages.status} <> 'failed'`,
      ))
      .orderBy(desc(wablastMessages.createdAt))
      .limit(1);
    const last = lastRows[0];
    if (last) {
      const elapsed = Date.now() - new Date(last.createdAt).getTime();
      const required = input.minIntervalSeconds * 1000;
      if (elapsed < required) {
        throw new Error(`Aguarde ${Math.ceil((required - elapsed) / 1000)}s antes do próximo envio.`);
      }
    }

    const inserted = await tx
      .insert(wablastMessages)
      .values(input.message)
      .onConflictDoNothing({ target: wablastMessages.intentKey })
      .returning();
    if (inserted[0]) return { message: inserted[0], created: true };

    const raced = await tx
      .select()
      .from(wablastMessages)
      .where(eq(wablastMessages.intentKey, input.message.intentKey))
      .limit(1);
    if (!raced[0]) throw new Error("Não foi possível reservar o envio WaBlast.");
    return { message: raced[0], created: false };
  });
}

export async function insertWaBlastMessageIfNew(
  data: InsertWaBlastMessage,
): Promise<WaBlastMessage | null> {
  const rows = await db
    .insert(wablastMessages)
    .values(data)
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

export async function updateWaBlastMessage(
  id: number,
  userId: number,
  data: Partial<InsertWaBlastMessage>,
): Promise<WaBlastMessage | null> {
  const rows = await db
    .update(wablastMessages)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(wablastMessages.id, id), eq(wablastMessages.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

function allowedPreviousStatuses(status: "sent" | "delivered" | "read" | "failed") {
  if (status === "sent") return ["sending", "sent"] as const;
  if (status === "delivered") return ["sending", "sent", "delivered"] as const;
  if (status === "read") return ["sending", "sent", "delivered", "read"] as const;
  return ["sending", "sent", "failed"] as const;
}

export async function applyWaBlastMessageStatus(input: {
  userId: number;
  accountId: string;
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  data: Partial<InsertWaBlastMessage>;
  phone?: string | null;
}): Promise<WaBlastMessage | null> {
  const rows = await db
    .update(wablastMessages)
    .set({ ...input.data, status: input.status, updatedAt: new Date() })
    .where(and(
      eq(wablastMessages.userId, input.userId),
      eq(wablastMessages.accountId, input.accountId),
      or(
        eq(wablastMessages.wablastMessageId, input.providerMessageId),
        eq(wablastMessages.metaMessageId, input.providerMessageId),
      ),
      inArray(wablastMessages.status, [...allowedPreviousStatuses(input.status)]),
    ))
    .returning();
  if (rows[0]) return rows[0];

  // Evento atrasado: a mensagem existe, mas já está num estado mais avançado.
  const exact = await db
    .select()
    .from(wablastMessages)
    .where(and(
      eq(wablastMessages.userId, input.userId),
      eq(wablastMessages.accountId, input.accountId),
      or(
        eq(wablastMessages.wablastMessageId, input.providerMessageId),
        eq(wablastMessages.metaMessageId, input.providerMessageId),
      ),
    ))
    .limit(1);
  if (exact[0] || !input.phone) return exact[0] ?? null;

  const candidates = await db
    .select()
    .from(wablastMessages)
    .where(and(
      eq(wablastMessages.userId, input.userId),
      eq(wablastMessages.accountId, input.accountId),
      eq(wablastMessages.phone, input.phone),
      eq(wablastMessages.direction, "outbound"),
      inArray(wablastMessages.status, ["sending", "sent", "delivered"]),
      gte(wablastMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ))
    .orderBy(desc(wablastMessages.createdAt))
    .limit(2);
  if (candidates.length !== 1) return null;

  const reconciled = await db
    .update(wablastMessages)
    .set({
      ...input.data,
      status: input.status,
      ...(input.providerMessageId.startsWith("msg_")
        ? { wablastMessageId: input.providerMessageId }
        : { metaMessageId: input.providerMessageId }),
      updatedAt: new Date(),
    })
    .where(and(
      eq(wablastMessages.id, candidates[0]!.id),
      inArray(wablastMessages.status, [...allowedPreviousStatuses(input.status)]),
    ))
    .returning();
  return reconciled[0] ?? null;
}

export async function listWaBlastMessageHistory(userId: number, limit = 100) {
  return db
    .select({
      id: wablastMessages.id,
      leadId: wablastMessages.leadId,
      leadName: leads.name,
      direction: wablastMessages.direction,
      messageType: wablastMessages.messageType,
      status: wablastMessages.status,
      phone: wablastMessages.phone,
      touchNumber: wablastMessages.touchNumber,
      templateName: wablastMessages.templateName,
      bodyPreview: wablastMessages.bodyPreview,
      errorCode: wablastMessages.errorCode,
      errorMessage: wablastMessages.errorMessage,
      sentAt: wablastMessages.sentAt,
      deliveredAt: wablastMessages.deliveredAt,
      readAt: wablastMessages.readAt,
      failedAt: wablastMessages.failedAt,
      receivedAt: wablastMessages.receivedAt,
      createdAt: wablastMessages.createdAt,
    })
    .from(wablastMessages)
    .leftJoin(leads, eq(wablastMessages.leadId, leads.id))
    .where(eq(wablastMessages.userId, userId))
    .orderBy(desc(wablastMessages.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function claimWaBlastWebhookEvent(input: {
  eventId: string;
  eventType: string;
  accountId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ claimed: boolean; duplicate: boolean; token: string | null }> {
  const now = new Date();
  const leaseExpiredAt = new Date(now.getTime() - 15 * 60 * 1000);
  const token = randomUUID();
  return db.transaction(async tx => {
    const inserted = await tx
      .insert(wablastWebhookEvents)
      .values({
        eventId: input.eventId,
        eventType: input.eventType,
        accountId: input.accountId ?? null,
        payload: input.payload,
        processingStatus: "processing",
        processingToken: token,
        processingStartedAt: now,
        attempts: 1,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) return { claimed: true, duplicate: false, token };

    const existing = await tx
      .select()
      .from(wablastWebhookEvents)
      .where(eq(wablastWebhookEvents.eventId, input.eventId))
      .limit(1);
    const event = existing[0];
    if (!event || event.processingStatus === "processed") {
      return { claimed: false, duplicate: true, token: null };
    }
    if (event.processingStatus === "processing" && event.processingStartedAt > leaseExpiredAt) {
      return { claimed: false, duplicate: true, token: null };
    }

    const reclaimed = await tx
      .update(wablastWebhookEvents)
      .set({
        processingStatus: "processing",
        processingToken: token,
        processingStartedAt: now,
        processingError: null,
        attempts: sql`${wablastWebhookEvents.attempts} + 1`,
      })
      .where(and(
        eq(wablastWebhookEvents.eventId, input.eventId),
        or(
          eq(wablastWebhookEvents.processingStatus, "failed"),
          lt(wablastWebhookEvents.processingStartedAt, leaseExpiredAt),
        ),
      ))
      .returning();
    return {
      claimed: Boolean(reclaimed[0]),
      duplicate: !reclaimed[0],
      token: reclaimed[0] ? token : null,
    };
  });
}

export async function finishWaBlastWebhookEvent(
  eventId: string,
  processingToken: string,
  processingError?: string | null,
): Promise<void> {
  await db
    .update(wablastWebhookEvents)
    .set({
      processingStatus: processingError ? "failed" : "processed",
      processedAt: processingError ? null : new Date(),
      processingError: processingError?.slice(0, 2000) ?? null,
    })
    .where(and(
      eq(wablastWebhookEvents.eventId, eventId),
      eq(wablastWebhookEvents.processingToken, processingToken),
      eq(wablastWebhookEvents.processingStatus, "processing"),
    ));
}
