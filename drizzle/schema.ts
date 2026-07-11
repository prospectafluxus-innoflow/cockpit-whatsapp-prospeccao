import {
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
} from "drizzle-orm/pg-core";

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

  // Sincronização opcional com o Trello
  trelloCardId: varchar("trelloCardId", { length: 64 }),
  trelloCardUrl: text("trelloCardUrl"),
  trelloSyncedAt: timestamp("trelloSyncedAt"),
  trelloSyncError: text("trelloSyncError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

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
