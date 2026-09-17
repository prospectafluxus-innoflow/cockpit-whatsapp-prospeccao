import {
  check,
  integer,
  index,
  uniqueIndex,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  real,
  serial,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const layerEnum = pgEnum("layer", ["A", "B", "C"]);
export const statusEnum = pgEnum("status", [
  "novo",
  "toque1_enviado",
  "toque2_enviado",
  "toque3_enviado",
  "respondeu",
  "fechado",
  "descartado",
]);
export const kanbanColumnEnum = pgEnum("kanban_column", [
  "Novo",
  "Toque 1 Enviado",
  "Toque 2 Enviado",
  "Toque 3 Enviado",
  "Respondeu",
  "Fechado",
]);
export const whatsappOptInStatusEnum = pgEnum("whatsapp_opt_in_status", [
  "unknown",
  "opted_in",
  "opted_out",
]);
export const wablastMessageStatusEnum = pgEnum("wablast_message_status", [
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "received",
]);
export const wablastMessageDirectionEnum = pgEnum("wablast_message_direction", [
  "outbound",
  "inbound",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  approvalStatus: approvalStatusEnum("approvalStatus").default("pending").notNull(),
  // WhatsApp do próprio usuário (para lembretes)
  whatsappOwn: varchar("whatsappOwn", { length: 30 }),
  // Autenticação própria
  passwordHash: varchar("passwordHash", { length: 255 }),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),

  // Dados do lead
  name: varchar("name", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 100 }),
  company: varchar("company", { length: 255 }),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  score: integer("score").default(0),
  layer: layerEnum("layer").notNull().default("B"),

  // Dados extras da planilha
  segment: varchar("segment", { length: 150 }),
  size: varchar("size", { length: 100 }),
  employees: integer("employees"),
  investment: varchar("investment", { length: 100 }),
  taxRegime: varchar("taxRegime", { length: 100 }),
  participations: integer("participations"),
  lastEvent: varchar("lastEvent", { length: 100 }),
  skippedUntil: date("skippedUntil"),

  // Status e ciclo de abordagem
  status: statusEnum("status").notNull().default("novo"),

  // Kanban column
  kanbanColumn: kanbanColumnEnum("kanbanColumn").notNull().default("Novo"),

  // Controle de toques
  toque1SentAt: timestamp("toque1SentAt"),
  toque2SentAt: timestamp("toque2SentAt"),
  toque3SentAt: timestamp("toque3SentAt"),
  respondedAt: timestamp("respondedAt"),

  // Notas e IA
  notes: text("notes"),
  lastAiSuggestion: text("lastAiSuggestion"),

  // Consentimento e janela de atendimento para a API oficial
  whatsappOptInStatus: whatsappOptInStatusEnum("whatsappOptInStatus").notNull().default("unknown"),
  whatsappOptInAt: timestamp("whatsappOptInAt"),
  whatsappOptInSource: varchar("whatsappOptInSource", { length: 255 }),
  whatsappOptOutAt: timestamp("whatsappOptOutAt"),
  whatsappConsentUpdatedAt: timestamp("whatsappConsentUpdatedAt"),
  whatsappLastInboundAt: timestamp("whatsappLastInboundAt"),

  // Sincronização opcional com o Trello
  trelloCardId: varchar("trelloCardId", { length: 64 }),
  trelloCardUrl: text("trelloCardUrl"),
  trelloSyncedAt: timestamp("trelloSyncedAt"),
  trelloSyncError: text("trelloSyncError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("leads_wablast_opted_in_phone_idx")
    .on(
      table.userId,
      sql`right(regexp_replace(${table.whatsapp}, '[^0-9]', '', 'g'), 11)`,
    )
    .where(sql`${table.whatsappOptInStatus} = 'opted_in'`),
  check("leads_whatsapp_consent_consistency", sql`
    (
      ${table.whatsappOptInStatus} = 'unknown'
      AND ${table.whatsappOptInAt} IS NULL
      AND ${table.whatsappOptInSource} IS NULL
      AND ${table.whatsappOptOutAt} IS NULL
      AND ${table.whatsappConsentUpdatedAt} IS NULL
    ) OR (
      ${table.whatsappOptInStatus} = 'opted_in'
      AND ${table.whatsappOptInAt} IS NOT NULL
      AND nullif(trim(${table.whatsappOptInSource}), '') IS NOT NULL
      AND ${table.whatsappOptOutAt} IS NULL
      AND ${table.whatsappConsentUpdatedAt} IS NOT NULL
    ) OR (
      ${table.whatsappOptInStatus} = 'opted_out'
      AND ${table.whatsappOptInAt} IS NULL
      AND ${table.whatsappOptInSource} IS NULL
      AND ${table.whatsappOptOutAt} IS NOT NULL
      AND ${table.whatsappConsentUpdatedAt} IS NOT NULL
    )
  `),
]);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Envios diários ───────────────────────────────────────────────────────────
export const dailySends = pgTable("daily_sends", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  leadId: integer("leadId").notNull(),
  touchNumber: integer("touchNumber").notNull(),
  sentDate: date("sentDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailySend = typeof dailySends.$inferSelect;
export type InsertDailySend = typeof dailySends.$inferInsert;

// ─── Configuração de agendamento ──────────────────────────────────────────────
export const sendSchedules = pgTable("send_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),

  morningEnabled: integer("morningEnabled").default(1).notNull(),
  morningHour: integer("morningHour").default(8).notNull(),
  morningCount: integer("morningCount").default(2).notNull(),

  lunchEnabled: integer("lunchEnabled").default(1).notNull(),
  lunchHour: integer("lunchHour").default(12).notNull(),
  lunchCount: integer("lunchCount").default(2).notNull(),

  eveningEnabled: integer("eveningEnabled").default(1).notNull(),
  eveningHour: integer("eveningHour").default(17).notNull(),
  eveningCount: integer("eveningCount").default(2).notNull(),

  afternoonEnabled: integer("afternoonEnabled").default(1).notNull(),
  afternoonHour: integer("afternoonHour").default(15).notNull(),
  afternoonCount: integer("afternoonCount").default(2).notNull(),

  morningTaskUid: varchar("morningTaskUid", { length: 65 }),
  lunchTaskUid: varchar("lunchTaskUid", { length: 65 }),
  afternoonTaskUid: varchar("afternoonTaskUid", { length: 65 }),
  eveningTaskUid: varchar("eveningTaskUid", { length: 65 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SendSchedule = typeof sendSchedules.$inferSelect;
export type InsertSendSchedule = typeof sendSchedules.$inferInsert;

// ─── Dispositivos inscritos em Web Push ──────────────────────────────────────
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    endpointHash: varchar("endpointHash", { length: 64 }).notNull().unique(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("userAgent"),
    expiresAt: timestamp("expiresAt"),
    lastUsedAt: timestamp("lastUsedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [index("push_subscriptions_user_id_idx").on(table.userId)]
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ─── Integrações externas do utilizador ──────────────────────────────────────
export const userIntegrations = pgTable(
  "user_integrations",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    provider: varchar("provider", { length: 32 }).notNull().default("trello"),
    enabled: integer("enabled").notNull().default(0),
    credentialsEncrypted: text("credentialsEncrypted").notNull(),
    listId: varchar("listId", { length: 64 }).notNull(),
    listName: varchar("listName", { length: 255 }),
    lastError: text("lastError"),
    lastTestedAt: timestamp("lastTestedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("user_integrations_user_provider_idx").on(table.userId, table.provider),
  ]
);

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = typeof userIntegrations.$inferInsert;

// ─── Templates de mensagem ────────────────────────────────────────────────────
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  toque: integer("toque").notNull(), // 1, 2 ou 3
  text: text("text").notNull(),
  audioKey: text("audioKey"),
  audioUrl: text("audioUrl"),
  audioFileName: varchar("audioFileName", { length: 255 }),
  audioMimeType: varchar("audioMimeType", { length: 100 }),
  audioSize: integer("audioSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

// ─── WaBlast: configuração privada da InnoFlow ────────────────────────────────
export const wablastSettings = pgTable(
  "wablast_settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    enabled: integer("enabled").notNull().default(0),
    queuePaused: integer("queuePaused").notNull().default(1),
    accountId: varchar("accountId", { length: 128 }),
    wabaId: varchar("wabaId", { length: 128 }),
    accountName: varchar("accountName", { length: 255 }),
    phoneNumber: varchar("phoneNumber", { length: 30 }),
    templateName: varchar("templateName", { length: 512 }),
    templateLanguage: varchar("templateLanguage", { length: 20 }).notNull().default("pt_BR"),
    dailyLimit: integer("dailyLimit").notNull().default(20),
    minIntervalSeconds: integer("minIntervalSeconds").notNull().default(90),
    lastConnectionCheckAt: timestamp("lastConnectionCheckAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("wablast_settings_account_id_idx").on(table.accountId),
    uniqueIndex("wablast_settings_waba_id_idx").on(table.wabaId),
  ]
);

export type WaBlastSetting = typeof wablastSettings.$inferSelect;
export type InsertWaBlastSetting = typeof wablastSettings.$inferInsert;

// ─── WaBlast: histórico de mensagens ─────────────────────────────────────────
export const wablastMessages = pgTable(
  "wablast_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    leadId: integer("leadId"),
    accountId: varchar("accountId", { length: 128 }).notNull(),
    direction: wablastMessageDirectionEnum("direction").notNull(),
    messageType: varchar("messageType", { length: 32 }).notNull(),
    status: wablastMessageStatusEnum("status").notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    touchNumber: integer("touchNumber"),
    templateName: varchar("templateName", { length: 512 }),
    templateLanguage: varchar("templateLanguage", { length: 20 }),
    bodyPreview: text("bodyPreview"),
    wablastMessageId: varchar("wablastMessageId", { length: 160 }),
    metaMessageId: text("metaMessageId"),
    intentKey: varchar("intentKey", { length: 160 }),
    idempotencyKey: varchar("idempotencyKey", { length: 160 }),
    errorCode: varchar("errorCode", { length: 128 }),
    errorMessage: text("errorMessage"),
    providerData: jsonb("providerData").$type<Record<string, unknown>>(),
    sentAt: timestamp("sentAt"),
    deliveredAt: timestamp("deliveredAt"),
    readAt: timestamp("readAt"),
    failedAt: timestamp("failedAt"),
    receivedAt: timestamp("receivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [
    index("wablast_messages_user_created_idx").on(table.userId, table.createdAt),
    index("wablast_messages_lead_idx").on(table.leadId),
    uniqueIndex("wablast_messages_provider_id_idx").on(table.accountId, table.wablastMessageId),
    uniqueIndex("wablast_messages_meta_id_idx").on(table.accountId, table.metaMessageId),
    uniqueIndex("wablast_messages_intent_idx").on(table.intentKey),
    uniqueIndex("wablast_messages_idempotency_idx").on(table.idempotencyKey),
  ]
);

export type WaBlastMessage = typeof wablastMessages.$inferSelect;
export type InsertWaBlastMessage = typeof wablastMessages.$inferInsert;

// ─── WaBlast: ledger imutável de consentimento ───────────────────────────────
export const wablastConsentEvents = pgTable(
  "wablast_consent_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    leadId: integer("leadId").notNull(),
    actorUserId: integer("actorUserId"),
    status: whatsappOptInStatusEnum("status").notNull(),
    sourceType: varchar("sourceType", { length: 64 }).notNull(),
    evidenceReference: text("evidenceReference"),
    providerEventId: varchar("providerEventId", { length: 160 }),
    eventAt: timestamp("eventAt").notNull(),
    applied: integer("applied").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("wablast_consent_events_lead_idx").on(table.userId, table.leadId, table.createdAt),
    uniqueIndex("wablast_consent_events_provider_event_idx").on(table.providerEventId),
    check("wablast_consent_events_valid_state", sql`
      (
        ${table.status} = 'opted_in'
        AND nullif(trim(${table.evidenceReference}), '') IS NOT NULL
        AND ${table.sourceType} <> 'admin_block'
      ) OR ${table.status} = 'opted_out'
    `),
  ]
);

export type WaBlastConsentEvent = typeof wablastConsentEvents.$inferSelect;

// ─── WaBlast: eventos processados para idempotência de webhooks ───────────────
export const wablastWebhookEvents = pgTable(
  "wablast_webhook_events",
  {
    eventId: varchar("eventId", { length: 160 }).primaryKey(),
    eventType: varchar("eventType", { length: 100 }).notNull(),
    accountId: varchar("accountId", { length: 128 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processingStatus: varchar("processingStatus", { length: 16 }).notNull().default("processing"),
    processingToken: varchar("processingToken", { length: 64 }).notNull(),
    processingStartedAt: timestamp("processingStartedAt").defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(1),
    processedAt: timestamp("processedAt"),
    processingError: text("processingError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("wablast_webhook_events_type_idx").on(table.eventType)]
);

export type WaBlastWebhookEvent = typeof wablastWebhookEvents.$inferSelect;
