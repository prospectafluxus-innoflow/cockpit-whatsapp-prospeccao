import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  fluxusAssessments,
  fluxusCompanies,
  users,
} from "./schema";
import type {
  ComplementaryKind,
  ComplementaryRecipient,
  ComplementaryValues,
} from "../shared/fluxusComplementary";

export const fluxusComplementaryKindEnum = pgEnum(
  "fluxus_complementary_kind",
  ["pq", "saboteurs"]
);
export const fluxusComplementaryStatusEnum = pgEnum(
  "fluxus_complementary_status",
  ["pending", "confirmed", "revoked"]
);

export const fluxusComplementaryReports = pgTable(
  "fluxus_complementary_reports",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id, { onDelete: "restrict" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assessmentId: integer("assessmentId")
      .notNull()
      .references(() => fluxusAssessments.id, { onDelete: "restrict" }),
    kind: fluxusComplementaryKindEnum("kind").$type<ComplementaryKind>().notNull(),
    status: fluxusComplementaryStatusEnum("status")
      .$type<"pending" | "confirmed" | "revoked">()
      .notNull()
      .default("pending"),
    revision: integer("revision").notNull().default(1),
    fileHash: varchar("fileHash", { length: 64 }),
    fileName: varchar("fileName", { length: 255 }),
    pdfCiphertext: text("pdfCiphertext"),
    sourceName: varchar("sourceName", { length: 255 }),
    sourceDate: date("sourceDate"),
    values: jsonb("values").$type<ComplementaryValues | null>(),
    warnings: jsonb("warnings")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    context: text("context"),
    recipientSnapshot: jsonb("recipientSnapshot")
      .$type<ComplementaryRecipient[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    termsVersion: varchar("termsVersion", { length: 80 }).notNull(),
    consentText: text("consentText").notNull(),
    consentedAt: timestamp("consentedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmedAt", { withTimezone: true }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => [
    index("fluxus_complementary_owner_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
    index("fluxus_complementary_company_status_idx").on(
      table.companyId,
      table.status,
      table.createdAt,
      table.id
    ),
    uniqueIndex("fluxus_complementary_owner_hash_active_idx")
      .on(table.userId, table.fileHash)
      .where(
        sql`${table.fileHash} IS NOT NULL AND ${table.status} <> 'revoked'`
      ),
    foreignKey({
      columns: [table.companyId, table.userId],
      foreignColumns: [users.companyId, users.id],
      name: "fluxus_complementary_owner_tenant_fk",
    }),
    foreignKey({
      columns: [table.companyId, table.userId, table.assessmentId],
      foreignColumns: [
        fluxusAssessments.companyId,
        fluxusAssessments.userId,
        fluxusAssessments.id,
      ],
      name: "fluxus_complementary_assessment_owner_tenant_fk",
    }),
    check(
      "fluxus_complementary_revision_check",
      sql`${table.revision} > 0`
    ),
    check(
      "fluxus_complementary_state_payload_check",
      sql`(
        (
          ${table.status} = 'pending'
          AND ${table.pdfCiphertext} IS NOT NULL
          AND ${table.fileHash} IS NOT NULL
          AND ${table.fileName} IS NOT NULL
          AND ${table.values} IS NULL
          AND ${table.confirmedAt} IS NULL
          AND ${table.revokedAt} IS NULL
        ) OR (
          ${table.status} = 'confirmed'
          AND ${table.pdfCiphertext} IS NOT NULL
          AND ${table.fileHash} IS NOT NULL
          AND ${table.fileName} IS NOT NULL
          AND ${table.values} IS NOT NULL
          AND ${table.confirmedAt} IS NOT NULL
          AND ${table.revokedAt} IS NULL
        ) OR (
          ${table.status} = 'revoked'
          AND ${table.pdfCiphertext} IS NULL
          AND ${table.fileHash} IS NULL
          AND ${table.fileName} IS NULL
          AND ${table.sourceName} IS NULL
          AND ${table.sourceDate} IS NULL
          AND ${table.values} IS NULL
          AND ${table.warnings} = '[]'::jsonb
          AND ${table.context} IS NULL
          AND ${table.confirmedAt} IS NULL
          AND ${table.revokedAt} IS NOT NULL
        )
      )`
    ),
  ]
);

export type FluxusComplementaryReport =
  typeof fluxusComplementaryReports.$inferSelect;
export type InsertFluxusComplementaryReport =
  typeof fluxusComplementaryReports.$inferInsert;
