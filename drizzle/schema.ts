import {
  integer,
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
  size: varchar("size", { length: 100 }),
  employees: integer("employees"),
  investment: varchar("investment", { length: 100 }),
  taxRegime: varchar("taxRegime", { length: 100 }),
  participations: integer("participations"),
  lastEvent: varchar("lastEvent", { length: 100 }),

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

  morningTaskUid: varchar("morningTaskUid", { length: 65 }),
  lunchTaskUid: varchar("lunchTaskUid", { length: 65 }),
  eveningTaskUid: varchar("eveningTaskUid", { length: 65 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SendSchedule = typeof sendSchedules.$inferSelect;
export type InsertSendSchedule = typeof sendSchedules.$inferInsert;
