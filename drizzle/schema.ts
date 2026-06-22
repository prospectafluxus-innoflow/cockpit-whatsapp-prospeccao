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
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
