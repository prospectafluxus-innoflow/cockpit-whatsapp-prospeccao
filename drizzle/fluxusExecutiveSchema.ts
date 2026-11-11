import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { fluxusCompanies, users } from "./schema";
import type { ExecutiveNotes } from "../shared/fluxusExecutive";

export const fluxusExecutiveReports = pgTable(
  "fluxus_executive_reports",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id, { onDelete: "restrict" }),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    mode: varchar("mode", { length: 16 })
      .$type<"individual" | "team">()
      .notNull(),
    assessmentIds: integer("assessmentIds").array().notNull(),
    notes: jsonb("notes").$type<ExecutiveNotes>().notNull(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("fluxus_executive_reports_company_updated_idx").on(
      table.companyId,
      table.updatedAt
    ),
    check(
      "fluxus_executive_reports_mode_check",
      sql`${table.mode} IN ('individual', 'team')`
    ),
    check(
      "fluxus_executive_reports_revision_check",
      sql`${table.revision} > 0`
    ),
    check(
      "fluxus_executive_reports_assessment_ids_check",
      sql`cardinality(${table.assessmentIds}) BETWEEN 1 AND 200`
    ),
    check(
      "fluxus_executive_reports_individual_size_check",
      sql`${table.mode} <> 'individual' OR cardinality(${table.assessmentIds}) = 1`
    ),
  ]
);

export type FluxusExecutiveReport = typeof fluxusExecutiveReports.$inferSelect;
export type InsertFluxusExecutiveReport =
  typeof fluxusExecutiveReports.$inferInsert;
