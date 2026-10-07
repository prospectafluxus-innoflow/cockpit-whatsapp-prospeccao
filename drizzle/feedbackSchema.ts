import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  jsonb,
  timestamp,
  date,
  index,
  uniqueIndex,
  check,
  boolean,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { fluxusCompanies, users, fluxusAssessments } from "./schema";
import type {
  FeedbackRole,
  FeedbackCompetency,
  FeedbackItem,
  FeedbackStatus,
  DevelopmentCycleStatus,
} from "../shared/feedback";

export const feedbackMemberships = pgTable(
  "fluxus_feedback_memberships",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 24 }).$type<FeedbackRole>().notNull(),
    canReadFeedback: boolean("canReadFeedback").notNull().default(false),
    startsAt: timestamp("startsAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("endsAt", { withTimezone: true }),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id),
  },
  t => [
    uniqueIndex("feedback_memberships_current_idx")
      .on(t.companyId, t.userId)
      .where(sql`${t.endsAt} IS NULL`),
    check(
      "feedback_membership_role",
      sql`${t.role} IN ('collaborator','manager','supermanager','hr','company_admin')`
    ),
    check(
      "feedback_membership_period",
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`
    ),
  ]
);
export const feedbackDepartments = pgTable(
  "fluxus_feedback_departments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    parentId: integer("parentId").references(
      (): AnyPgColumn => feedbackDepartments.id
    ),
    name: varchar("name", { length: 180 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  t => [
    index("feedback_departments_company_idx").on(t.companyId),
    check(
      "feedback_department_not_self",
      sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`
    ),
  ]
);
export const feedbackAssignments = pgTable(
  "fluxus_feedback_assignments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    departmentId: integer("departmentId").references(
      () => feedbackDepartments.id
    ),
    managerUserId: integer("managerUserId").references(() => users.id),
    jobTitle: varchar("jobTitle", { length: 180 }),
    startsAt: timestamp("startsAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("endsAt", { withTimezone: true }),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id),
  },
  t => [
    uniqueIndex("feedback_assignments_current_idx")
      .on(t.companyId, t.userId)
      .where(sql`${t.endsAt} IS NULL`),
    check(
      "feedback_assignment_period",
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`
    ),
    check(
      "feedback_assignment_not_self",
      sql`${t.managerUserId} IS NULL OR ${t.managerUserId} <> ${t.userId}`
    ),
  ]
);
export const feedbackManagementScopes = pgTable(
  "fluxus_feedback_management_scopes",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    userId: integer("userId")
      .notNull()
      .references(() => users.id),
    departmentId: integer("departmentId")
      .notNull()
      .references(() => feedbackDepartments.id),
    includeDescendants: boolean("includeDescendants").notNull().default(true),
    startsAt: timestamp("startsAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("endsAt", { withTimezone: true }),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id),
  },
  t => [
    uniqueIndex("feedback_scopes_current_idx")
      .on(t.companyId, t.userId, t.departmentId)
      .where(sql`${t.endsAt} IS NULL`),
    check(
      "feedback_scope_period",
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`
    ),
  ]
);
export const feedbackSettings = pgTable("fluxus_feedback_settings", {
  companyId: integer("companyId")
    .primaryKey()
    .references(() => fluxusCompanies.id),
  competencyIds: jsonb("competencyIds").$type<string[]>().notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: integer("updatedBy")
    .notNull()
    .references(() => users.id),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const developmentCycles = pgTable(
  "fluxus_development_cycles",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    name: varchar("name", { length: 120 }).notNull(),
    year: integer("year").notNull(),
    startsOn: date("startsOn").notNull(),
    endsOn: date("endsOn").notNull(),
    status: varchar("status", { length: 16 })
      .$type<DevelopmentCycleStatus>()
      .notNull()
      .default("planned"),
    templateVersion: integer("templateVersion").notNull(),
    methodVersion: varchar("methodVersion", { length: 40 }).notNull(),
    competencySnapshot: jsonb("competencySnapshot")
      .$type<FeedbackCompetency[]>()
      .notNull(),
    createdBy: integer("createdBy")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activatedAt", { withTimezone: true }),
    closedAt: timestamp("closedAt", { withTimezone: true }),
  },
  t => [
    index("development_cycles_company_year_idx").on(t.companyId, t.year),
    uniqueIndex("development_cycles_company_name_idx").on(
      t.companyId,
      t.year,
      t.name
    ),
    check("development_cycle_dates", sql`${t.endsOn} >= ${t.startsOn}`),
    check(
      "development_cycle_status",
      sql`${t.status} IN ('planned','active','closed','cancelled')`
    ),
  ]
);
export const feedbackEvaluations = pgTable(
  "fluxus_feedback_evaluations",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    cycleId: integer("cycleId")
      .notNull()
      .references(() => developmentCycles.id),
    participantUserId: integer("participantUserId")
      .notNull()
      .references(() => users.id),
    evaluatorUserId: integer("evaluatorUserId")
      .notNull()
      .references(() => users.id),
    personaAssessmentId: integer("personaAssessmentId")
      .notNull()
      .references(() => fluxusAssessments.id),
    assignmentId: integer("assignmentId")
      .notNull()
      .references(() => feedbackAssignments.id),
    departmentId: integer("departmentId").references(
      () => feedbackDepartments.id
    ),
    status: varchar("status", { length: 20 })
      .$type<FeedbackStatus>()
      .notNull()
      .default("draft"),
    items: jsonb("items")
      .$type<FeedbackItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    revision: integer("revision").notNull().default(0),
    completedAt: timestamp("completedAt", { withTimezone: true }),
    debriefedAt: timestamp("debriefedAt", { withTimezone: true }),
    releasedAt: timestamp("releasedAt", { withTimezone: true }),
    firstViewedAt: timestamp("firstViewedAt", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledgedAt", { withTimezone: true }),
    closedAt: timestamp("closedAt", { withTimezone: true }),
    participantComment: text("participantComment"),
    commentedAt: timestamp("commentedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  t => [
    uniqueIndex("feedback_evaluations_participant_cycle_idx").on(
      t.cycleId,
      t.participantUserId
    ),
    index("feedback_evaluations_company_idx").on(t.companyId, t.cycleId),
    check(
      "feedback_evaluation_status",
      sql`${t.status} IN ('draft','completed','debriefed','released','acknowledged','closed')`
    ),
    check(
      "feedback_evaluator_not_self",
      sql`${t.participantUserId} <> ${t.evaluatorUserId}`
    ),
  ]
);
export const feedbackRevisions = pgTable(
  "fluxus_feedback_revisions",
  {
    id: serial("id").primaryKey(),
    feedbackId: integer("feedbackId")
      .notNull()
      .references(() => feedbackEvaluations.id),
    companyId: integer("companyId")
      .notNull()
      .references(() => fluxusCompanies.id),
    previousRevision: integer("previousRevision").notNull(),
    previousItems: jsonb("previousItems").$type<FeedbackItem[]>().notNull(),
    previousStatus: varchar("previousStatus", { length: 20 })
      .$type<FeedbackStatus>()
      .notNull(),
    previousMetadata: jsonb("previousMetadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    reason: text("reason").notNull(),
    actorUserId: integer("actorUserId")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  t => [index("feedback_revisions_feedback_idx").on(t.companyId, t.feedbackId)]
);

export type FeedbackMembership = typeof feedbackMemberships.$inferSelect;
export type FeedbackDepartment = typeof feedbackDepartments.$inferSelect;
export type FeedbackAssignment = typeof feedbackAssignments.$inferSelect;
export type FeedbackManagementScope =
  typeof feedbackManagementScopes.$inferSelect;
export type DevelopmentCycle = typeof developmentCycles.$inferSelect;
export type FeedbackEvaluation = typeof feedbackEvaluations.$inferSelect;
