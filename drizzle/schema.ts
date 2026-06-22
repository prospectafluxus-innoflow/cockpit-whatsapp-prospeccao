import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  bigint,
  date,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Autenticação própria
  passwordHash: varchar("passwordHash", { length: 255 }),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Dados do lead
  name: varchar("name", { length: 255 }).notNull(),
  firstName: varchar("firstName", { length: 100 }),
  company: varchar("company", { length: 255 }),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  score: int("score").default(0),
  layer: mysqlEnum("layer", ["A", "B", "C"]).notNull().default("B"),

  // Dados extras da planilha
  size: varchar("size", { length: 100 }),        // Porte
  employees: int("employees"),                    // Funcionários
  investment: varchar("investment", { length: 100 }), // Investe em Mkt
  taxRegime: varchar("taxRegime", { length: 100 }), // Regime tributário
  participations: int("participations"),          // Participações
  lastEvent: varchar("lastEvent", { length: 100 }), // Último evento

  // Status e ciclo de abordagem
  status: mysqlEnum("status", [
    "novo",
    "toque1_enviado",
    "toque2_enviado",
    "toque3_enviado",
    "respondeu",
    "fechado",
    "descartado",
  ])
    .notNull()
    .default("novo"),

  // Kanban column (pode divergir do status em casos manuais)
  kanbanColumn: mysqlEnum("kanbanColumn", [
    "Novo",
    "Toque 1 Enviado",
    "Toque 2 Enviado",
    "Toque 3 Enviado",
    "Respondeu",
    "Fechado",
  ])
    .notNull()
    .default("Novo"),

  // Controle de toques
  toque1SentAt: timestamp("toque1SentAt"),
  toque2SentAt: timestamp("toque2SentAt"),
  toque3SentAt: timestamp("toque3SentAt"),
  respondedAt: timestamp("respondedAt"),

  // Notas e IA
  notes: text("notes"),
  lastAiSuggestion: text("lastAiSuggestion"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Envios diários ───────────────────────────────────────────────────────────
export const dailySends = mysqlTable("daily_sends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId").notNull(),
  touchNumber: int("touchNumber").notNull(), // 1, 2 ou 3
  sentDate: date("sentDate").notNull(),       // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailySend = typeof dailySends.$inferSelect;
export type InsertDailySend = typeof dailySends.$inferInsert;

// ─── Configuração de agendamento de lembretes ─────────────────────────────────
export const sendSchedules = mysqlTable("send_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),

  // Janela da manhã
  morningEnabled: int("morningEnabled").default(1).notNull(), // 0 ou 1
  morningHour: int("morningHour").default(8).notNull(),       // hora UTC-3
  morningCount: int("morningCount").default(2).notNull(),     // qtd de leads

  // Janela do almoço
  lunchEnabled: int("lunchEnabled").default(1).notNull(),
  lunchHour: int("lunchHour").default(12).notNull(),
  lunchCount: int("lunchCount").default(2).notNull(),

  // Janela do fim do dia
  eveningEnabled: int("eveningEnabled").default(1).notNull(),
  eveningHour: int("eveningHour").default(17).notNull(),
  eveningCount: int("eveningCount").default(2).notNull(),

  // UIDs dos jobs Heartbeat (para gerenciar os crons)
  morningTaskUid: varchar("morningTaskUid", { length: 65 }),
  lunchTaskUid: varchar("lunchTaskUid", { length: 65 }),
  eveningTaskUid: varchar("eveningTaskUid", { length: 65 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SendSchedule = typeof sendSchedules.$inferSelect;
export type InsertSendSchedule = typeof sendSchedules.$inferInsert;
