import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  developmentCycles,
  feedbackAssignments,
  feedbackDepartments,
  feedbackEvaluations,
  feedbackManagementScopes,
  feedbackMemberships,
  feedbackRevisions,
  feedbackSettings,
  type DevelopmentCycle,
  type FeedbackAssignment,
  type FeedbackDepartment,
  type FeedbackEvaluation,
  type FeedbackManagementScope,
  type FeedbackMembership,
} from "../drizzle/feedbackSchema";
import {
  fluxusAssessments,
  fluxusAuditLogs,
  fluxusCompanies,
  users,
} from "../drizzle/schema";
import {
  CYCLE_TRANSITIONS,
  FEEDBACK_COMPETENCIES,
  FEEDBACK_METHOD_VERSION,
  FEEDBACK_ROLES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TRANSITIONS,
  competencyIdsSchema,
  competencySnapshot,
  calculateFeedback,
  consolidateFeedback,
  isFeedbackVisibleToParticipant,
  validateFeedbackItems,
  type DevelopmentCycleStatus,
  type FeedbackCompetency,
  type FeedbackHistoryEntry,
  type FeedbackItem,
  type FeedbackRole,
  type FeedbackStatus,
} from "../shared/feedback";
import {
  isFluxusV2Result,
  getFluxusCompletionForVersion,
  isSupportedFluxusVersion,
  type FluxusStoredResult,
} from "../shared/fluxusVersioning";
import { FLUXUS_FORMULA_VERSION } from "../shared/fluxus";
import { FLUXUS_V2_FORMULA_VERSION } from "../shared/fluxusV2";
import { db } from "./db";

const DEFAULT_COMPETENCY_IDS = FEEDBACK_COMPETENCIES.map(item => item.id);

let feedbackEnabledResolver: (() => boolean) | null = null;

export function setFeedbackEnabledResolverForTests(
  resolver: (() => boolean) | null
) {
  feedbackEnabledResolver = resolver;
}

export function isFeedbackEnabled() {
  return feedbackEnabledResolver
    ? feedbackEnabledResolver()
    : process.env.FLUXUS_FEEDBACK_ENABLED === "true";
}

export function requireFeedbackEnabled() {
  if (!isFeedbackEnabled())
    fail(
      "PRECONDITION_FAILED",
      "O módulo de feedback ainda não está habilitado."
    );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = {
  id: number;
  role?: string | null;
  companyId?: number | null;
  accountType?: string | null;
  approvalStatus?: string | null;
  privacyDeletedAt?: Date | null;
};

type UserDirectoryRow = {
  id: number;
  name: string | null;
  jobTitle: string | null;
  department: string | null;
};

export type FeedbackAccess = {
  company: { id: number; name: string; active: number };
  membership: FeedbackMembership | null;
  canConfigure: boolean;
  canReadContent: boolean;
  canOperateContent: boolean;
  platformAdmin: boolean;
};

function fail(
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "CONFLICT"
    | "PRECONDITION_FAILED",
  message: string
): never {
  throw new TRPCError({ code, message });
}

function nowDate() {
  return new Date();
}

function isPlatformAdmin(actor: Actor) {
  return actor.role === "admin";
}

function isActiveDateRange(
  row: { startsAt: Date; endsAt: Date | null },
  now = nowDate()
) {
  return (
    row.startsAt.getTime() <= now.getTime() &&
    (row.endsAt === null || row.endsAt.getTime() > now.getTime())
  );
}

function safeDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail("BAD_REQUEST", "Use datas ISO no formato AAAA-MM-DD.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail("BAD_REQUEST", "A data informada não é válida.");
  }
  return parsed;
}

function assertDateRange(startsOn: string, endsOn: string) {
  safeDateOnly(startsOn);
  safeDateOnly(endsOn);
  if (endsOn < startsOn)
    fail("BAD_REQUEST", "A data final deve ser igual ou posterior à inicial.");
}

function assertPositiveId(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0)
    fail("BAD_REQUEST", `${label} inválido.`);
}

function assertValidItems(
  items: FeedbackItem[],
  snapshot: readonly FeedbackCompetency[],
  complete = false
) {
  try {
    return validateFeedbackItems(items, snapshot, complete);
  } catch (error) {
    fail(
      "BAD_REQUEST",
      error instanceof Error ? error.message : "Itens de feedback inválidos."
    );
  }
}

function assessmentResultIsValid(assessment: {
  companyId: number;
  status: string;
  instrumentVersion: string;
  formulaVersion: string;
  answers: Record<string, number>;
  result: FluxusStoredResult | null;
  completedAt: Date | null;
}) {
  if (
    assessment.status !== "completed" ||
    !assessment.result ||
    !assessment.completedAt
  )
    return false;
  if (!isSupportedFluxusVersion(assessment.instrumentVersion)) return false;
  const expectedFormula = assessment.instrumentVersion.startsWith("2.")
    ? FLUXUS_V2_FORMULA_VERSION
    : FLUXUS_FORMULA_VERSION;
  if (assessment.formulaVersion !== expectedFormula) return false;
  if (
    assessment.result.instrumentVersion !== assessment.instrumentVersion ||
    assessment.result.formulaVersion !== assessment.formulaVersion
  )
    return false;
  if (assessment.result.completedAt !== assessment.completedAt.toISOString())
    return false;
  try {
    const completion = getFluxusCompletionForVersion(
      assessment.instrumentVersion,
      assessment.answers
    );
    if (completion.completed !== completion.total) return false;
  } catch {
    return false;
  }
  if (
    assessment.instrumentVersion.startsWith("2.") &&
    !isFluxusV2Result(assessment.result)
  )
    return false;
  if (
    assessment.instrumentVersion.startsWith("1.") &&
    "model" in (assessment.result as object)
  )
    return false;
  return true;
}

async function lock(
  tx: Tx,
  kind: "cycle" | "evaluation" | "company",
  id: number
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`feedback:${kind}:${id}`}))`
  );
}

async function insertAudit(
  tx: Tx,
  values: {
    actorUserId: number;
    subjectUserId?: number | null;
    companyId: number;
    action: string;
    resourceType: string;
    metadata?: Record<string, string | number | boolean | null>;
  }
) {
  await tx.insert(fluxusAuditLogs).values({
    actorUserId: values.actorUserId,
    subjectUserId: values.subjectUserId ?? null,
    companyId: values.companyId,
    action: values.action,
    resourceType: values.resourceType,
    metadata: values.metadata ?? {},
  });
}

async function getCompany(companyId: number) {
  const rows = await db
    .select({
      id: fluxusCompanies.id,
      name: fluxusCompanies.name,
      active: fluxusCompanies.active,
    })
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}

async function getCompanyTx(tx: Tx, companyId: number) {
  const rows = await tx
    .select({
      id: fluxusCompanies.id,
      name: fluxusCompanies.name,
      active: fluxusCompanies.active,
    })
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}

async function getCurrentMembership(
  userId: number,
  companyId: number,
  now = nowDate()
) {
  const rows = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.userId, userId),
        eq(feedbackMemberships.companyId, companyId),
        lte(feedbackMemberships.startsAt, now),
        or(
          isNull(feedbackMemberships.endsAt),
          gt(feedbackMemberships.endsAt, now)
        )
      )
    )
    .orderBy(desc(feedbackMemberships.startsAt), desc(feedbackMemberships.id))
    .limit(1);
  return rows[0] ?? null;
}

async function getCurrentMembershipTx(
  tx: Tx,
  userId: number,
  companyId: number,
  now = nowDate()
) {
  const rows = await tx
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.userId, userId),
        eq(feedbackMemberships.companyId, companyId),
        lte(feedbackMemberships.startsAt, now),
        or(
          isNull(feedbackMemberships.endsAt),
          gt(feedbackMemberships.endsAt, now)
        )
      )
    )
    .orderBy(desc(feedbackMemberships.startsAt), desc(feedbackMemberships.id))
    .limit(1);
  return rows[0] ?? null;
}

async function getLiveUser(userId: number, companyId?: number) {
  const conditions = [
    eq(users.id, userId),
    eq(users.approvalStatus, "approved" as const),
    isNull(users.privacyDeletedAt),
  ];
  if (companyId !== undefined) conditions.push(eq(users.companyId, companyId));
  const rows = await db
    .select({
      id: users.id,
      companyId: users.companyId,
      accountType: users.accountType,
      approvalStatus: users.approvalStatus,
      privacyDeletedAt: users.privacyDeletedAt,
    })
    .from(users)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

async function getLiveUserTx(tx: Tx, userId: number, companyId?: number) {
  const conditions = [
    eq(users.id, userId),
    eq(users.approvalStatus, "approved" as const),
    isNull(users.privacyDeletedAt),
  ];
  if (companyId !== undefined) conditions.push(eq(users.companyId, companyId));
  const rows = await tx
    .select({
      id: users.id,
      companyId: users.companyId,
      accountType: users.accountType,
      approvalStatus: users.approvalStatus,
      privacyDeletedAt: users.privacyDeletedAt,
    })
    .from(users)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

async function requireAccessTx(
  tx: Tx,
  actor: Actor,
  companyId: number,
  options: {
    content?: boolean;
    configure?: boolean;
    platformBootstrap?: boolean;
  } = {}
): Promise<FeedbackAccess> {
  assertPositiveId(companyId, "Empresa");
  const company = await getCompanyTx(tx, companyId);
  if (!company) fail("NOT_FOUND", "Empresa não encontrada.");
  if (company.active !== 1) fail("FORBIDDEN", "A empresa não está ativa.");
  const live = await getLiveUserTx(tx, actor.id);
  if (!live) fail("FORBIDDEN", "Esta conta não está ativa.");
  const platformAdmin = isPlatformAdmin(actor);
  if (!platformAdmin && live.companyId !== companyId)
    fail("FORBIDDEN", "Você só pode usar a empresa da sua conta.");
  const membership = await getCurrentMembershipTx(tx, actor.id, companyId);
  if (!membership && !platformAdmin)
    fail("FORBIDDEN", "Você não possui membership ativo nesta empresa.");
  if (options.platformBootstrap && !platformAdmin)
    fail(
      "FORBIDDEN",
      "Somente administrador da plataforma pode executar o bootstrap."
    );
  const role = membership?.role;
  const canConfigure = role === "company_admin" || role === "hr";
  const canReadContent = Boolean(
    membership?.canReadFeedback &&
      (role === "manager" ||
        role === "supermanager" ||
        role === "hr" ||
        role === "company_admin")
  );
  const canOperateContent = canReadContent;
  if (options.configure && !canConfigure && !platformAdmin)
    fail(
      "FORBIDDEN",
      "A operação exige administrador da empresa ou RH autorizado."
    );
  if (options.content && !canReadContent)
    fail(
      "FORBIDDEN",
      "A leitura organizacional exige canReadFeedback e escopo vigente."
    );
  return {
    company,
    membership,
    canConfigure,
    canReadContent,
    canOperateContent,
    platformAdmin,
  };
}

async function requireConfigTx(tx: Tx, actor: Actor, companyId: number) {
  const access = await requireAccessTx(tx, actor, companyId, {
    configure: true,
  });
  if (!access.membership && !access.platformAdmin)
    fail("FORBIDDEN", "Membership ativo exigido.");
  return access;
}

async function requireAccess(
  actor: Actor,
  companyId: number,
  options: {
    content?: boolean;
    configure?: boolean;
    platformBootstrap?: boolean;
    allowUnconfigured?: boolean;
  } = {}
): Promise<FeedbackAccess> {
  assertPositiveId(companyId, "Empresa");
  const company = await getCompany(companyId);
  if (!company) fail("NOT_FOUND", "Empresa não encontrada.");
  if (company.active !== 1) fail("FORBIDDEN", "A empresa não está ativa.");
  const live = await getLiveUser(actor.id);
  if (!live) fail("FORBIDDEN", "Esta conta não está ativa.");
  const platformAdmin = isPlatformAdmin(actor);
  if (!platformAdmin && live.companyId !== companyId)
    fail("FORBIDDEN", "Você só pode usar a empresa da sua conta.");
  const membership = await getCurrentMembership(actor.id, companyId);
  if (!membership && !platformAdmin && !options.allowUnconfigured)
    fail("FORBIDDEN", "Você não possui membership ativo nesta empresa.");
  if (options.platformBootstrap && !platformAdmin)
    fail(
      "FORBIDDEN",
      "Somente administrador da plataforma pode executar o bootstrap."
    );
  const role = membership?.role;
  const canConfigure = role === "company_admin" || role === "hr";
  const canReadContent = Boolean(
    membership?.canReadFeedback &&
      (role === "manager" ||
        role === "supermanager" ||
        role === "hr" ||
        role === "company_admin")
  );
  const canOperateContent = Boolean(
    membership?.canReadFeedback &&
      (role === "manager" ||
        role === "supermanager" ||
        role === "hr" ||
        role === "company_admin")
  );
  if (options.configure && !canConfigure && !platformAdmin)
    fail(
      "FORBIDDEN",
      "A operação exige administrador da empresa ou RH autorizado."
    );
  if (options.content && !canReadContent)
    fail(
      "FORBIDDEN",
      "A leitura organizacional exige canReadFeedback e escopo vigente."
    );
  return {
    company,
    membership,
    canConfigure,
    canReadContent,
    canOperateContent,
    platformAdmin,
  };
}

async function requireConfig(actor: Actor, companyId: number) {
  const access = await requireAccess(actor, companyId, { configure: true });
  if (!access.membership && !access.platformAdmin)
    fail("FORBIDDEN", "Membership ativo exigido.");
  return access;
}

async function getCurrentAssignments(companyId: number, now = nowDate()) {
  return db
    .select()
    .from(feedbackAssignments)
    .where(
      and(
        eq(feedbackAssignments.companyId, companyId),
        lte(feedbackAssignments.startsAt, now),
        or(
          isNull(feedbackAssignments.endsAt),
          gt(feedbackAssignments.endsAt, now)
        )
      )
    );
}

async function getCurrentAssignmentsTx(
  tx: Tx,
  companyId: number,
  now = nowDate()
) {
  return tx
    .select()
    .from(feedbackAssignments)
    .where(
      and(
        eq(feedbackAssignments.companyId, companyId),
        lte(feedbackAssignments.startsAt, now),
        or(
          isNull(feedbackAssignments.endsAt),
          gt(feedbackAssignments.endsAt, now)
        )
      )
    );
}

async function getCurrentDepartments(companyId: number) {
  return db
    .select()
    .from(feedbackDepartments)
    .where(eq(feedbackDepartments.companyId, companyId))
    .orderBy(asc(feedbackDepartments.name));
}

async function getCurrentDepartmentsTx(tx: Tx, companyId: number) {
  return tx
    .select()
    .from(feedbackDepartments)
    .where(eq(feedbackDepartments.companyId, companyId))
    .orderBy(asc(feedbackDepartments.name));
}

function departmentDescendants(
  departments: FeedbackDepartment[],
  departmentId: number,
  includeDescendants: boolean
) {
  const found = new Set<number>([departmentId]);
  if (!includeDescendants) return found;
  const children = new Map<number, number[]>();
  for (const department of departments) {
    if (department.parentId !== null)
      children.set(department.parentId, [
        ...(children.get(department.parentId) ?? []),
        department.id,
      ]);
  }
  const queue = [departmentId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of children.get(current) ?? []) {
      if (found.has(child)) continue;
      found.add(child);
      queue.push(child);
    }
  }
  return found;
}

async function descendants(
  companyId: number,
  departmentId: number,
  includeSelf = true
) {
  const departments = await getCurrentDepartments(companyId);
  return departmentDescendants(departments, departmentId, includeSelf);
}

async function hasScopeForDepartment(
  userId: number,
  companyId: number,
  departmentId: number | null,
  role: FeedbackRole | null
) {
  if (departmentId === null) return false;
  if (role === "hr" || role === "company_admin") return true;
  if (role !== "supermanager") return false;
  const now = nowDate();
  const scopes = await db
    .select()
    .from(feedbackManagementScopes)
    .where(
      and(
        eq(feedbackManagementScopes.companyId, companyId),
        eq(feedbackManagementScopes.userId, userId),
        lte(feedbackManagementScopes.startsAt, now),
        or(
          isNull(feedbackManagementScopes.endsAt),
          gt(feedbackManagementScopes.endsAt, now)
        )
      )
    );
  for (const scope of scopes) {
    const ids = await descendants(
      companyId,
      scope.departmentId,
      scope.includeDescendants
    );
    if (ids.has(departmentId)) return true;
  }
  return false;
}

async function hasScopeForDepartmentTx(
  tx: Tx,
  userId: number,
  companyId: number,
  departmentId: number | null,
  role: FeedbackRole | null
) {
  if (departmentId === null) return false;
  if (role === "hr" || role === "company_admin") return true;
  if (role !== "supermanager") return false;
  const now = nowDate();
  const [scopes, departments] = await Promise.all([
    tx
      .select()
      .from(feedbackManagementScopes)
      .where(
        and(
          eq(feedbackManagementScopes.companyId, companyId),
          eq(feedbackManagementScopes.userId, userId),
          lte(feedbackManagementScopes.startsAt, now),
          or(
            isNull(feedbackManagementScopes.endsAt),
            gt(feedbackManagementScopes.endsAt, now)
          )
        )
      ),
    getCurrentDepartmentsTx(tx, companyId),
  ]);
  return scopes.some(scope =>
    departmentDescendants(
      departments,
      scope.departmentId,
      scope.includeDescendants
    ).has(departmentId)
  );
}

const CONTENT_READER_ROLES: readonly FeedbackRole[] = [
  "manager",
  "supermanager",
  "hr",
  "company_admin",
];

async function canReadParticipant(
  actorId: number,
  companyId: number,
  participantUserId: number,
  evaluatorUserId?: number | null
) {
  const membership = await getCurrentMembership(actorId, companyId);
  if (
    !membership ||
    !membership.canReadFeedback ||
    !CONTENT_READER_ROLES.includes(membership.role)
  )
    return false;
  if (membership.role === "hr" || membership.role === "company_admin")
    return true;
  const assignments = await getCurrentAssignments(companyId);
  const assignment = assignments.find(
    item => item.userId === participantUserId
  );
  if (membership.role === "manager")
    return assignment?.managerUserId === actorId;
  if (membership.role === "supermanager")
    return hasScopeForDepartment(
      actorId,
      companyId,
      assignment?.departmentId ?? null,
      membership.role
    );
  return false;
}

async function canReadParticipantTx(
  tx: Tx,
  actorId: number,
  companyId: number,
  participantUserId: number,
  evaluatorUserId?: number | null
) {
  const membership = await getCurrentMembershipTx(tx, actorId, companyId);
  if (
    !membership ||
    !membership.canReadFeedback ||
    !CONTENT_READER_ROLES.includes(membership.role)
  )
    return false;
  if (membership.role === "hr" || membership.role === "company_admin")
    return true;
  const assignments = await getCurrentAssignmentsTx(tx, companyId);
  const assignment = assignments.find(
    item => item.userId === participantUserId
  );
  if (membership.role === "manager")
    return assignment?.managerUserId === actorId;
  if (membership.role === "supermanager")
    return hasScopeForDepartmentTx(
      tx,
      actorId,
      companyId,
      assignment?.departmentId ?? null,
      membership.role
    );
  return false;
}

async function canEvaluateParticipant(
  actorId: number,
  companyId: number,
  participantUserId: number,
  evaluatorUserId = actorId
) {
  if (actorId !== evaluatorUserId) return false;
  const membership = await getCurrentMembership(evaluatorUserId, companyId);
  if (
    !membership ||
    !membership.canReadFeedback ||
    !CONTENT_READER_ROLES.includes(membership.role)
  )
    return false;
  if (["hr", "company_admin"].includes(membership.role)) return true;
  const assignments = await getCurrentAssignments(companyId);
  const assignment = assignments.find(
    item => item.userId === participantUserId
  );
  if (membership.role === "manager")
    return assignment?.managerUserId === evaluatorUserId;
  if (membership.role === "supermanager")
    return hasScopeForDepartment(
      evaluatorUserId,
      companyId,
      assignment?.departmentId ?? null,
      membership.role
    );
  return false;
}

async function canEvaluateParticipantTx(
  tx: Tx,
  actorId: number,
  companyId: number,
  participantUserId: number,
  evaluatorUserId = actorId
) {
  if (actorId !== evaluatorUserId) return false;
  const membership = await getCurrentMembershipTx(
    tx,
    evaluatorUserId,
    companyId
  );
  if (
    !membership ||
    !membership.canReadFeedback ||
    !CONTENT_READER_ROLES.includes(membership.role)
  )
    return false;
  if (["hr", "company_admin"].includes(membership.role)) return true;
  const assignments = await getCurrentAssignmentsTx(tx, companyId);
  const assignment = assignments.find(
    item => item.userId === participantUserId
  );
  if (membership.role === "manager")
    return assignment?.managerUserId === evaluatorUserId;
  if (membership.role === "supermanager")
    return hasScopeForDepartmentTx(
      tx,
      evaluatorUserId,
      companyId,
      assignment?.departmentId ?? null,
      membership.role
    );
  return false;
}

async function getAssessmentEligibility(userId: number, companyId: number) {
  const rows = await db
    .select({
      id: fluxusAssessments.id,
      companyId: fluxusAssessments.companyId,
      status: fluxusAssessments.status,
      instrumentVersion: fluxusAssessments.instrumentVersion,
      formulaVersion: fluxusAssessments.formulaVersion,
      answers: fluxusAssessments.answers,
      result: fluxusAssessments.result,
      completedAt: fluxusAssessments.completedAt,
    })
    .from(fluxusAssessments)
    .where(
      and(
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId),
        eq(fluxusAssessments.status, "completed")
      )
    )
    .orderBy(desc(fluxusAssessments.completedAt), desc(fluxusAssessments.id))
    .limit(1);
  const assessment = rows[0] ?? null;
  if (!assessment)
    return {
      eligible: false,
      assessment: null,
      reason: "Nenhum Persona concluído foi encontrado.",
    };
  if (!assessmentResultIsValid(assessment))
    return {
      eligible: false,
      assessment: null,
      reason:
        "O Persona concluído está incompleto ou tem metadata inconsistente.",
    };
  return { eligible: true, assessment, reason: null };
}

async function getAssessmentEligibilityTx(
  tx: Tx,
  userId: number,
  companyId: number,
  assessmentId?: number
) {
  const rows = await tx
    .select({
      id: fluxusAssessments.id,
      companyId: fluxusAssessments.companyId,
      status: fluxusAssessments.status,
      instrumentVersion: fluxusAssessments.instrumentVersion,
      formulaVersion: fluxusAssessments.formulaVersion,
      answers: fluxusAssessments.answers,
      result: fluxusAssessments.result,
      completedAt: fluxusAssessments.completedAt,
    })
    .from(fluxusAssessments)
    .where(
      and(
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId),
        eq(fluxusAssessments.status, "completed"),
        assessmentId === undefined
          ? sql`true`
          : eq(fluxusAssessments.id, assessmentId)
      )
    )
    .orderBy(desc(fluxusAssessments.completedAt), desc(fluxusAssessments.id))
    .limit(1);
  const assessment = rows[0] ?? null;
  if (!assessment)
    return {
      eligible: false,
      assessment: null,
      reason: "Nenhum Persona concluído foi encontrado.",
    };
  if (!assessmentResultIsValid(assessment))
    return {
      eligible: false,
      assessment: null,
      reason:
        "O Persona concluído está incompleto ou tem metadata inconsistente.",
    };
  return { eligible: true, assessment, reason: null };
}

async function getDirectory(companyId: number) {
  const [directory, assignments, departments] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        jobTitle: users.jobTitle,
        department: users.department,
      })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.accountType, "fluxus"),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        )
      )
      .orderBy(asc(users.name), asc(users.id)),
    getCurrentAssignments(companyId),
    getCurrentDepartments(companyId),
  ]);
  const departmentById = new Map(
    departments.map(department => [department.id, department.name])
  );
  const assignmentByUser = new Map(
    assignments.map(assignment => [assignment.userId, assignment])
  );
  const people = await Promise.all(
    directory.map(async person => {
      const eligibility = await getAssessmentEligibility(person.id, companyId);
      const membership = await getCurrentMembership(person.id, companyId);
      const assignment = assignmentByUser.get(person.id);
      return {
        id: person.id,
        name: person.name,
        jobTitle: assignment?.jobTitle ?? person.jobTitle,
        department: assignment?.departmentId
          ? (departmentById.get(assignment.departmentId) ?? person.department)
          : person.department,
        eligible: eligibility.eligible,
        personaAssessmentId: eligibility.assessment?.id ?? null,
        eligibilityReason: eligibility.reason,
        isCompanyAdmin: membership?.role === "company_admin",
        evaluatorEligible: Boolean(
          membership?.canReadFeedback &&
            CONTENT_READER_ROLES.includes(membership.role)
        ),
      };
    })
  );
  return { directory, assignments, departments, people };
}

export async function companyAdministratorDirectory(
  actor: Actor,
  companyId: number
) {
  assertPositiveId(companyId, "Empresa");
  if (!isPlatformAdmin(actor))
    fail(
      "FORBIDDEN",
      "Somente administrador da plataforma pode consultar esta opção."
    );
  const [company, live] = await Promise.all([
    getCompany(companyId),
    getLiveUser(actor.id),
  ]);
  if (!company) fail("NOT_FOUND", "Empresa não encontrada.");
  if (company.active !== 1) fail("FORBIDDEN", "A empresa não está ativa.");
  if (!live) fail("FORBIDDEN", "Esta conta não está ativa.");
  // Keep the same primary-table access guards even with the module disabled,
  // while still avoiding any dependency on unmigrated feedback tables.
  if (!isFeedbackEnabled()) return { enabled: false, companyId, people: [] };
  const now = nowDate();
  const [directory, memberships] = await Promise.all([
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.accountType, "fluxus"),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        )
      )
      .orderBy(asc(users.id)),
    db
      .select({
        userId: feedbackMemberships.userId,
        role: feedbackMemberships.role,
      })
      .from(feedbackMemberships)
      .where(
        and(
          eq(feedbackMemberships.companyId, companyId),
          lte(feedbackMemberships.startsAt, now),
          or(
            isNull(feedbackMemberships.endsAt),
            gt(feedbackMemberships.endsAt, now)
          )
        )
      )
      .orderBy(
        desc(feedbackMemberships.startsAt),
        desc(feedbackMemberships.id)
      ),
  ]);
  // Match getCurrentMembership exactly, including overlapping legacy rows:
  // the most recent currently effective membership wins, not any old admin role.
  const currentRoles = new Map<number, string>();
  for (const membership of memberships) {
    if (!currentRoles.has(membership.userId))
      currentRoles.set(membership.userId, membership.role);
  }
  return {
    enabled: true,
    companyId,
    people: directory.map(person => ({
      id: person.id,
      isCompanyAdmin: currentRoles.get(person.id) === "company_admin",
    })),
  };
}

async function getSettings(companyId: number) {
  const rows = await db
    .select()
    .from(feedbackSettings)
    .where(eq(feedbackSettings.companyId, companyId))
    .limit(1);
  return rows[0]
    ? { competencyIds: rows[0].competencyIds, version: rows[0].version }
    : null;
}

function snapshotFromCycle(cycle: DevelopmentCycle) {
  const snapshot = cycle.competencySnapshot as FeedbackCompetency[];
  if (!Array.isArray(snapshot) || snapshot.length < 1)
    fail(
      "PRECONDITION_FAILED",
      "O snapshot de competências do ciclo está inválido."
    );
  return snapshot;
}

async function getCycle(cycleId: number) {
  const rows = await db
    .select()
    .from(developmentCycles)
    .where(eq(developmentCycles.id, cycleId))
    .limit(1);
  return rows[0] ?? null;
}

async function getEvaluation(id: number) {
  const rows = await db
    .select()
    .from(feedbackEvaluations)
    .where(eq(feedbackEvaluations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function requireEvaluationAccess(
  actor: Actor,
  evaluation: FeedbackEvaluation,
  mode: "read" | "edit" | "participant"
) {
  const company = await getCompany(evaluation.companyId);
  if (!company) fail("NOT_FOUND", "Feedback não encontrado.");
  if (company.active !== 1) fail("FORBIDDEN", "A empresa não está ativa.");
  const live = await getLiveUser(actor.id, evaluation.companyId);
  if (!live) fail("FORBIDDEN", "Esta conta não está ativa nesta empresa.");
  const membership = await getCurrentMembership(actor.id, evaluation.companyId);
  if (!membership) fail("FORBIDDEN", "Membership ativo exigido.");
  if (
    actor.id === evaluation.participantUserId &&
    !isFeedbackVisibleToParticipant(evaluation.status)
  )
    fail("NOT_FOUND", "Feedback ainda não liberado ao colaborador.");
  if (mode === "participant") {
    if (actor.id !== evaluation.participantUserId)
      fail("FORBIDDEN", "Somente o colaborador pode executar esta operação.");
    if (!isFeedbackVisibleToParticipant(evaluation.status))
      fail("NOT_FOUND", "Feedback ainda não liberado ao colaborador.");
    return membership;
  }
  if (
    actor.id === evaluation.participantUserId &&
    isFeedbackVisibleToParticipant(evaluation.status) &&
    mode === "read"
  )
    return membership;
  if (!membership.canReadFeedback)
    fail("FORBIDDEN", "A leitura de conteúdo exige canReadFeedback.");
  const allowed =
    mode === "read"
      ? await canReadParticipant(
          actor.id,
          evaluation.companyId,
          evaluation.participantUserId,
          evaluation.evaluatorUserId
        )
      : await canEvaluateParticipant(
          actor.id,
          evaluation.companyId,
          evaluation.participantUserId,
          evaluation.evaluatorUserId
        );
  if (!allowed)
    fail("FORBIDDEN", "Você não possui escopo vigente para este feedback.");
  return membership;
}

async function requireEvaluationAccessTx(
  tx: Tx,
  actor: Actor,
  evaluation: FeedbackEvaluation,
  mode: "read" | "edit" | "participant"
) {
  const company = await getCompanyTx(tx, evaluation.companyId);
  if (!company) fail("NOT_FOUND", "Feedback não encontrado.");
  if (company.active !== 1) fail("FORBIDDEN", "A empresa não está ativa.");
  const live = await getLiveUserTx(tx, actor.id, evaluation.companyId);
  if (!live) fail("FORBIDDEN", "Esta conta não está ativa nesta empresa.");
  const membership = await getCurrentMembershipTx(
    tx,
    actor.id,
    evaluation.companyId
  );
  if (!membership) fail("FORBIDDEN", "Membership ativo exigido.");
  if (
    actor.id === evaluation.participantUserId &&
    !isFeedbackVisibleToParticipant(evaluation.status)
  )
    fail("NOT_FOUND", "Feedback ainda não liberado ao colaborador.");
  if (mode === "participant") {
    if (actor.id !== evaluation.participantUserId)
      fail("FORBIDDEN", "Somente o colaborador pode executar esta operação.");
    if (!isFeedbackVisibleToParticipant(evaluation.status))
      fail("NOT_FOUND", "Feedback ainda não liberado ao colaborador.");
    return membership;
  }
  if (
    actor.id === evaluation.participantUserId &&
    isFeedbackVisibleToParticipant(evaluation.status) &&
    mode === "read"
  )
    return membership;
  if (!membership.canReadFeedback)
    fail("FORBIDDEN", "A leitura de conteúdo exige canReadFeedback.");
  const allowed =
    mode === "read"
      ? await canReadParticipantTx(
          tx,
          actor.id,
          evaluation.companyId,
          evaluation.participantUserId,
          evaluation.evaluatorUserId
        )
      : await canEvaluateParticipantTx(
          tx,
          actor.id,
          evaluation.companyId,
          evaluation.participantUserId,
          evaluation.evaluatorUserId
        );
  if (!allowed)
    fail("FORBIDDEN", "Você não possui escopo vigente para este feedback.");
  return membership;
}

function cycleStatus(status: string): DevelopmentCycleStatus {
  if ((CYCLE_TRANSITIONS as Record<string, unknown>)[status])
    return status as DevelopmentCycleStatus;
  fail("BAD_REQUEST", "Status de ciclo inválido.");
}

function feedbackStatus(status: string): FeedbackStatus {
  if ((FEEDBACK_TRANSITIONS as Record<string, unknown>)[status])
    return status as FeedbackStatus;
  fail("BAD_REQUEST", "Status de feedback inválido.");
}

export async function bootstrapCompanyAdmin(
  actor: Actor,
  companyId: number,
  userId: number
) {
  requireFeedbackEnabled();
  assertPositiveId(userId, "Usuário");
  return db.transaction(async tx => {
    await lock(tx, "company", companyId);
    await requireAccessTx(tx, actor, companyId, { platformBootstrap: true });
    const target = await getLiveUserTx(tx, userId, companyId);
    if (!target)
      fail("BAD_REQUEST", "Usuário ativo da empresa não encontrado.");
    const now = new Date();
    const current = await getCurrentMembershipTx(tx, userId, companyId, now);
    if (current)
      await tx
        .update(feedbackMemberships)
        .set({ endsAt: now })
        .where(eq(feedbackMemberships.id, current.id));
    const inserted = await tx
      .insert(feedbackMemberships)
      .values({
        companyId,
        userId,
        role: "company_admin",
        canReadFeedback: false,
        startsAt: now,
        endsAt: null,
        createdBy: actor.id,
      })
      .returning();
    const membership = inserted[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: userId,
      companyId,
      action: "feedback.membership.bootstrap",
      resourceType: "feedback_membership",
      metadata: { role: "company_admin", canReadFeedback: false },
    });
    return { success: true, membership };
  });
}

export async function setCompanyAdministrator(
  actor: Actor,
  input: {
    companyId: number;
    userId: number;
    isAdmin: boolean;
    expectedIsAdmin: boolean;
  }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.userId, "Usuário");
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    await requireAccessTx(tx, actor, input.companyId, {
      platformBootstrap: true,
    });
    const target = await getLiveUserTx(tx, input.userId, input.companyId);
    if (!target || target.accountType !== "fluxus")
      fail("BAD_REQUEST", "Usuário Fluxus ativo da empresa não encontrado.");

    const now = new Date();
    const current = await getCurrentMembershipTx(
      tx,
      input.userId,
      input.companyId,
      now
    );
    const currentIsAdmin = current?.role === "company_admin";
    if (currentIsAdmin !== input.expectedIsAdmin)
      fail(
        "CONFLICT",
        "O estado de administrador da empresa mudou. Atualize a lista e tente novamente."
      );

    if (currentIsAdmin === input.isAdmin)
      return { success: true, changed: false, membership: current };

    if (current)
      await tx
        .update(feedbackMemberships)
        .set({ endsAt: now })
        .where(eq(feedbackMemberships.id, current.id));

    const nextRole = input.isAdmin ? "company_admin" : "collaborator";
    const inserted = await tx
      .insert(feedbackMemberships)
      .values({
        companyId: input.companyId,
        userId: input.userId,
        role: nextRole,
        canReadFeedback: false,
        startsAt: now,
        endsAt: null,
        createdBy: actor.id,
      })
      .returning();
    const membership = inserted[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: input.userId,
      companyId: input.companyId,
      action: input.isAdmin
        ? "feedback.company_admin.enable"
        : "feedback.company_admin.disable",
      resourceType: "feedback_membership",
      metadata: {
        previousMembershipId: current?.id ?? null,
        previousRole: current?.role ?? null,
        previousCanReadFeedback: current?.canReadFeedback ?? null,
        role: nextRole,
        canReadFeedback: false,
        isAdmin: input.isAdmin,
      },
    });
    return { success: true, changed: true, membership };
  });
}

export async function setMembership(
  actor: Actor,
  input: {
    companyId: number;
    userId: number;
    role: FeedbackRole;
    canReadFeedback: boolean;
  }
) {
  requireFeedbackEnabled();
  if (!FEEDBACK_ROLES.includes(input.role))
    fail("BAD_REQUEST", "Papel de feedback inválido.");
  const targetId = input.userId;
  assertPositiveId(targetId, "Usuário");
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    const access = await requireAccessTx(tx, actor, input.companyId);
    if (access.membership?.role !== "company_admin")
      fail(
        "FORBIDDEN",
        "Somente administrador da empresa pode alterar papéis e permissões. A administração técnica utiliza o bootstrap sem leitura de conteúdo."
      );
    const target = await getLiveUserTx(tx, targetId, input.companyId);
    if (!target)
      fail("BAD_REQUEST", "Usuário ativo da empresa não encontrado.");
    const now = new Date();
    const current = await getCurrentMembershipTx(
      tx,
      targetId,
      input.companyId,
      now
    );
    if (current)
      await tx
        .update(feedbackMemberships)
        .set({ endsAt: now })
        .where(eq(feedbackMemberships.id, current.id));
    const inserted = await tx
      .insert(feedbackMemberships)
      .values({
        companyId: input.companyId,
        userId: targetId,
        role: input.role,
        canReadFeedback: input.canReadFeedback,
        startsAt: now,
        endsAt: null,
        createdBy: actor.id,
      })
      .returning();
    const membership = inserted[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: targetId,
      companyId: input.companyId,
      action: "feedback.membership.change",
      resourceType: "feedback_membership",
      metadata: {
        role: input.role,
        canReadFeedback: input.canReadFeedback,
        previousMembershipId: current?.id ?? null,
      },
    });
    return { success: true, membership };
  });
}

export async function createDepartment(
  actor: Actor,
  input: { companyId: number; name: string; parentId?: number | null }
) {
  requireFeedbackEnabled();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 180)
    fail("BAD_REQUEST", "Nome de departamento inválido.");
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    await requireConfigTx(tx, actor, input.companyId);
    if (input.parentId !== undefined && input.parentId !== null) {
      const parent = await tx
        .select({
          id: feedbackDepartments.id,
          companyId: feedbackDepartments.companyId,
          active: feedbackDepartments.active,
        })
        .from(feedbackDepartments)
        .where(eq(feedbackDepartments.id, input.parentId))
        .limit(1);
      if (
        !parent[0] ||
        parent[0].companyId !== input.companyId ||
        !parent[0].active
      )
        fail("BAD_REQUEST", "Departamento pai inválido.");
    }
    const rows = await tx
      .insert(feedbackDepartments)
      .values({
        companyId: input.companyId,
        name,
        parentId: input.parentId ?? null,
        active: true,
      })
      .returning();
    const department = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      companyId: input.companyId,
      action: "feedback.department.create",
      resourceType: "feedback_department",
      metadata: {
        departmentId: department.id,
        parentId: department.parentId,
        name: department.name,
      },
    });
    return { success: true, department };
  });
}

export async function updateDepartment(
  actor: Actor,
  input: { id: number; name: string; parentId: number | null; active: boolean }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.id, "Departamento");
  const currentRows = await db
    .select()
    .from(feedbackDepartments)
    .where(eq(feedbackDepartments.id, input.id))
    .limit(1);
  const current = currentRows[0];
  if (!current) fail("NOT_FOUND", "Departamento não encontrado.");
  const name = input.name.trim();
  if (name.length < 1 || name.length > 180)
    fail("BAD_REQUEST", "Nome de departamento inválido.");
  return db.transaction(async tx => {
    await lock(tx, "company", current.companyId);
    await requireConfigTx(tx, actor, current.companyId);
    const lockedCurrent = (
      await tx
        .select()
        .from(feedbackDepartments)
        .where(eq(feedbackDepartments.id, input.id))
        .limit(1)
    )[0];
    if (!lockedCurrent || lockedCurrent.companyId !== current.companyId)
      fail("NOT_FOUND", "Departamento não encontrado.");
    const all = await tx
      .select()
      .from(feedbackDepartments)
      .where(eq(feedbackDepartments.companyId, lockedCurrent.companyId));
    if (input.parentId !== null) {
      const parent = all.find(item => item.id === input.parentId);
      if (!parent || !parent.active)
        fail("BAD_REQUEST", "Departamento pai inválido.");
      const seen = new Set<number>();
      let cursor: number | null = input.parentId;
      while (cursor !== null) {
        if (cursor === input.id)
          fail("CONFLICT", "A hierarquia não pode conter ciclos.");
        if (seen.has(cursor))
          fail("CONFLICT", "A hierarquia existente contém um ciclo.");
        seen.add(cursor);
        cursor = all.find(item => item.id === cursor)?.parentId ?? null;
      }
    }
    const rows = await tx
      .update(feedbackDepartments)
      .set({ name, parentId: input.parentId, active: input.active })
      .where(eq(feedbackDepartments.id, lockedCurrent.id))
      .returning();
    const department = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      companyId: current.companyId,
      action: "feedback.department.update",
      resourceType: "feedback_department",
      metadata: {
        departmentId: input.id,
        parentId: input.parentId,
        active: input.active,
      },
    });
    return { success: true, department };
  });
}

async function assertManagerNoLoop(
  companyId: number,
  participantUserId: number,
  managerUserId: number,
  assignments: FeedbackAssignment[]
) {
  if (participantUserId === managerUserId)
    fail("BAD_REQUEST", "O colaborador não pode ser seu próprio gestor.");
  const byUser = new Map(assignments.map(item => [item.userId, item]));
  const seen = new Set<number>();
  let cursor: number | null = managerUserId;
  while (cursor !== null) {
    if (cursor === participantUserId)
      fail("CONFLICT", "A liderança informada criaria um ciclo.");
    if (seen.has(cursor))
      fail("CONFLICT", "A hierarquia existente contém um ciclo.");
    seen.add(cursor);
    cursor = byUser.get(cursor)?.managerUserId ?? null;
  }
}

export async function assignEmployee(
  actor: Actor,
  input: {
    companyId: number;
    userId: number;
    departmentId: number | null;
    managerUserId: number | null;
    jobTitle?: string;
  }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.userId, "Usuário");
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    await requireConfigTx(tx, actor, input.companyId);
    const target = await getLiveUserTx(tx, input.userId, input.companyId);
    if (!target)
      fail("BAD_REQUEST", "Usuário ativo da empresa não encontrado.");
    if (input.departmentId !== null) {
      const department = await tx
        .select({
          id: feedbackDepartments.id,
          companyId: feedbackDepartments.companyId,
          active: feedbackDepartments.active,
        })
        .from(feedbackDepartments)
        .where(eq(feedbackDepartments.id, input.departmentId))
        .limit(1);
      if (
        !department[0] ||
        department[0].companyId !== input.companyId ||
        !department[0].active
      )
        fail("BAD_REQUEST", "Departamento inválido.");
    }
    const assignments = await getCurrentAssignmentsTx(tx, input.companyId);
    if (input.managerUserId !== null) {
      const manager = await getLiveUserTx(
        tx,
        input.managerUserId,
        input.companyId
      );
      if (!manager)
        fail("BAD_REQUEST", "Gestor ativo da empresa não encontrado.");
      const managerMembership = await getCurrentMembershipTx(
        tx,
        input.managerUserId,
        input.companyId
      );
      if (
        !managerMembership ||
        !["manager", "supermanager", "company_admin", "hr"].includes(
          managerMembership.role
        )
      )
        fail("BAD_REQUEST", "O gestor não possui papel autorizado.");
      await assertManagerNoLoop(
        input.companyId,
        input.userId,
        input.managerUserId,
        assignments
      );
    }
    const now = new Date();
    const previous = assignments.find(item => item.userId === input.userId);
    if (previous)
      await tx
        .update(feedbackAssignments)
        .set({ endsAt: now })
        .where(eq(feedbackAssignments.id, previous.id));
    const rows = await tx
      .insert(feedbackAssignments)
      .values({
        companyId: input.companyId,
        userId: input.userId,
        departmentId: input.departmentId,
        managerUserId: input.managerUserId,
        jobTitle: input.jobTitle?.trim() || null,
        startsAt: now,
        endsAt: null,
        createdBy: actor.id,
      })
      .returning();
    const assignment = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: input.userId,
      companyId: input.companyId,
      action: "feedback.assignment.change",
      resourceType: "feedback_assignment",
      metadata: {
        assignmentId: assignment.id,
        departmentId: input.departmentId,
        managerUserId: input.managerUserId,
        previousAssignmentId: previous?.id ?? null,
      },
    });
    return { success: true, assignment };
  });
}

export async function setManagementScope(
  actor: Actor,
  input: {
    companyId: number;
    userId: number;
    departmentId: number;
    includeDescendants: boolean;
    active: boolean;
  }
) {
  requireFeedbackEnabled();
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    const access = await requireConfigTx(tx, actor, input.companyId);
    if (
      access.membership &&
      !["company_admin", "hr"].includes(access.membership.role) &&
      !access.platformAdmin
    )
      fail("FORBIDDEN", "Somente administrador ou RH pode alterar escopos.");
    const target = await getLiveUserTx(tx, input.userId, input.companyId);
    const department = await tx
      .select({
        id: feedbackDepartments.id,
        companyId: feedbackDepartments.companyId,
        active: feedbackDepartments.active,
      })
      .from(feedbackDepartments)
      .where(eq(feedbackDepartments.id, input.departmentId))
      .limit(1);
    const membership = await getCurrentMembershipTx(
      tx,
      input.userId,
      input.companyId
    );
    if (!target || !membership || membership.role !== "supermanager")
      fail(
        "BAD_REQUEST",
        "O usuário precisa ser supergestor ativo para receber escopo."
      );
    if (
      !department[0] ||
      department[0].companyId !== input.companyId ||
      !department[0].active
    )
      fail("BAD_REQUEST", "Departamento inválido.");
    const now = new Date();
    const current = await tx
      .select()
      .from(feedbackManagementScopes)
      .where(
        and(
          eq(feedbackManagementScopes.companyId, input.companyId),
          eq(feedbackManagementScopes.userId, input.userId),
          eq(feedbackManagementScopes.departmentId, input.departmentId),
          lte(feedbackManagementScopes.startsAt, now),
          or(
            isNull(feedbackManagementScopes.endsAt),
            gt(feedbackManagementScopes.endsAt, now)
          )
        )
      )
      .limit(1);
    if (current[0])
      await tx
        .update(feedbackManagementScopes)
        .set({ endsAt: now })
        .where(eq(feedbackManagementScopes.id, current[0].id));
    if (!input.active) {
      await insertAudit(tx, {
        actorUserId: actor.id,
        subjectUserId: input.userId,
        companyId: input.companyId,
        action: "feedback.scope.change",
        resourceType: "feedback_management_scope",
        metadata: {
          scopeId: current[0]?.id ?? null,
          departmentId: input.departmentId,
          includeDescendants: input.includeDescendants,
          active: false,
        },
      });
      return { success: true, scope: null };
    }
    const rows = await tx
      .insert(feedbackManagementScopes)
      .values({
        companyId: input.companyId,
        userId: input.userId,
        departmentId: input.departmentId,
        includeDescendants: input.includeDescendants,
        startsAt: now,
        endsAt: null,
        createdBy: actor.id,
      })
      .returning();
    const scope = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: input.userId,
      companyId: input.companyId,
      action: "feedback.scope.change",
      resourceType: "feedback_management_scope",
      metadata: {
        scopeId: scope.id,
        departmentId: input.departmentId,
        includeDescendants: input.includeDescendants,
        active: true,
      },
    });
    return { success: true, scope };
  });
}

export async function updateSettings(
  actor: Actor,
  input: { companyId: number; competencyIds: string[] }
) {
  requireFeedbackEnabled();
  const ids = competencyIdsSchema.parse(input.competencyIds);
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    await requireConfigTx(tx, actor, input.companyId);
    const current = await tx
      .select()
      .from(feedbackSettings)
      .where(eq(feedbackSettings.companyId, input.companyId))
      .limit(1);
    const version = (current[0]?.version ?? 0) + 1;
    const rows = current[0]
      ? await tx
          .update(feedbackSettings)
          .set({
            competencyIds: ids,
            version,
            updatedBy: actor.id,
            updatedAt: new Date(),
          })
          .where(eq(feedbackSettings.companyId, input.companyId))
          .returning()
      : await tx
          .insert(feedbackSettings)
          .values({
            companyId: input.companyId,
            competencyIds: ids,
            version: Math.max(1, version),
            updatedBy: actor.id,
          })
          .returning();
    const settings = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      companyId: input.companyId,
      action: "feedback.settings.update",
      resourceType: "feedback_settings",
      metadata: { version: settings.version, competencyCount: ids.length },
    });
    return {
      success: true,
      settings: {
        competencyIds: settings.competencyIds,
        version: settings.version,
      },
    };
  });
}

export async function createCycle(
  actor: Actor,
  input: { companyId: number; name: string; startsOn: string; endsOn: string }
) {
  requireFeedbackEnabled();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120)
    fail("BAD_REQUEST", "Nome de ciclo inválido.");
  assertDateRange(input.startsOn, input.endsOn);
  return db.transaction(async tx => {
    await lock(tx, "company", input.companyId);
    await requireConfigTx(tx, actor, input.companyId);
    const configured = await tx
      .select()
      .from(feedbackSettings)
      .where(eq(feedbackSettings.companyId, input.companyId))
      .limit(1);
    const ids = configured[0]?.competencyIds ?? DEFAULT_COMPETENCY_IDS;
    const version = configured[0]?.version ?? 1;
    const snapshot = competencySnapshot(ids);
    const rows = await tx
      .insert(developmentCycles)
      .values({
        companyId: input.companyId,
        name,
        year: Number(input.startsOn.slice(0, 4)),
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        status: "planned",
        templateVersion: version,
        methodVersion: FEEDBACK_METHOD_VERSION,
        competencySnapshot: snapshot,
        createdBy: actor.id,
      })
      .returning();
    const cycle = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      companyId: input.companyId,
      action: "feedback.cycle.create",
      resourceType: "development_cycle",
      metadata: {
        cycleId: cycle.id,
        year: cycle.year,
        templateVersion: version,
        competencyCount: snapshot.length,
      },
    });
    return { success: true, cycle };
  });
}

async function assertParticipantAndEvaluator(
  tx: Tx,
  companyId: number,
  participantUserId: number,
  evaluatorUserId: number
) {
  const participant = await getLiveUserTx(tx, participantUserId, companyId);
  const evaluator = await getLiveUserTx(tx, evaluatorUserId, companyId);
  if (!participant || !evaluator)
    fail("BAD_REQUEST", "Participante ou avaliador ativo não encontrado.");
  if (
    participant.accountType !== "fluxus" ||
    evaluator.accountType !== "fluxus"
  )
    fail("BAD_REQUEST", "Participante e avaliador precisam ter conta Fluxus.");
  if (participantUserId === evaluatorUserId)
    fail("BAD_REQUEST", "O avaliador não pode ser o próprio participante.");
  const participantMembership = await getCurrentMembershipTx(
    tx,
    participantUserId,
    companyId
  );
  if (!participantMembership)
    fail("BAD_REQUEST", "O participante precisa de membership vigente.");
  const assignmentRows = await getCurrentAssignmentsTx(tx, companyId);
  const assignment = assignmentRows.find(
    item => item.userId === participantUserId
  );
  if (!assignment)
    fail("BAD_REQUEST", "O participante precisa de assignment vigente.");
  const eligibility = await getAssessmentEligibilityTx(
    tx,
    participantUserId,
    companyId
  );
  if (!eligibility.eligible || !eligibility.assessment)
    fail(
      "BAD_REQUEST",
      eligibility.reason ?? "Participante inelegível para feedback."
    );
  const evaluatorAuthorized = await canEvaluateParticipantTx(
    tx,
    evaluatorUserId,
    companyId,
    participantUserId,
    evaluatorUserId
  );
  if (!evaluatorAuthorized)
    fail(
      "FORBIDDEN",
      "O avaliador não possui permissão e escopo vigente para este participante."
    );
  return { assignment, assessment: eligibility.assessment };
}

export async function addParticipants(
  actor: Actor,
  input: {
    cycleId: number;
    participants: Array<{ userId: number; evaluatorUserId: number }>;
  }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.cycleId, "Ciclo");
  if (input.participants.length < 1 || input.participants.length > 500)
    fail("BAD_REQUEST", "Informe entre 1 e 500 participantes.");
  const cycle = await getCycle(input.cycleId);
  if (!cycle) fail("NOT_FOUND", "Ciclo não encontrado.");
  return db.transaction(async tx => {
    await lock(tx, "company", cycle.companyId);
    await lock(tx, "cycle", input.cycleId);
    await requireConfigTx(tx, actor, cycle.companyId);
    const current = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, input.cycleId))
        .limit(1)
    )[0];
    if (!current || current.status !== "planned")
      fail(
        "CONFLICT",
        "Participantes só podem ser adicionados a ciclo planejado."
      );
    const uniqueUsers = new Set<number>();
    const prepared: Array<{
      userId: number;
      evaluatorUserId: number;
      assignment: FeedbackAssignment;
      assessmentId: number;
      departmentId: number | null;
    }> = [];
    for (const item of input.participants) {
      assertPositiveId(item.userId, "Participante");
      assertPositiveId(item.evaluatorUserId, "Avaliador");
      if (uniqueUsers.has(item.userId))
        fail("BAD_REQUEST", "Não repita participantes no lote.");
      uniqueUsers.add(item.userId);
      const result = await assertParticipantAndEvaluator(
        tx,
        current.companyId,
        item.userId,
        item.evaluatorUserId
      );
      const duplicate = await tx
        .select({ id: feedbackEvaluations.id })
        .from(feedbackEvaluations)
        .where(
          and(
            eq(feedbackEvaluations.cycleId, current.id),
            eq(feedbackEvaluations.participantUserId, item.userId)
          )
        )
        .limit(1);
      if (duplicate[0])
        fail("CONFLICT", "Um dos participantes já está no ciclo.");
      prepared.push({
        userId: item.userId,
        evaluatorUserId: item.evaluatorUserId,
        assignment: result.assignment,
        assessmentId: result.assessment.id,
        departmentId: result.assignment.departmentId,
      });
    }
    const inserted = [];
    for (const item of prepared) {
      const rows = await tx
        .insert(feedbackEvaluations)
        .values({
          companyId: current.companyId,
          cycleId: current.id,
          participantUserId: item.userId,
          evaluatorUserId: item.evaluatorUserId,
          personaAssessmentId: item.assessmentId,
          assignmentId: item.assignment.id,
          departmentId: item.departmentId,
          status: "draft",
          items: [],
          revision: 0,
        })
        .returning();
      inserted.push(rows[0]!);
      await insertAudit(tx, {
        actorUserId: actor.id,
        subjectUserId: item.userId,
        companyId: current.companyId,
        action: "feedback.participant.add",
        resourceType: "feedback_evaluation",
        metadata: {
          cycleId: current.id,
          feedbackId: rows[0]!.id,
          evaluatorUserId: item.evaluatorUserId,
        },
      });
    }
    return { success: true, feedbacks: inserted.map(safeEvaluation) };
  });
}

export async function removeParticipant(
  actor: Actor,
  cycleId: number,
  userId: number
) {
  requireFeedbackEnabled();
  const cycle = await getCycle(cycleId);
  if (!cycle) fail("NOT_FOUND", "Ciclo não encontrado.");
  return db.transaction(async tx => {
    await lock(tx, "company", cycle.companyId);
    await lock(tx, "cycle", cycleId);
    await requireConfigTx(tx, actor, cycle.companyId);
    const current = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, cycleId))
        .limit(1)
    )[0];
    if (!current || current.status !== "planned")
      fail("CONFLICT", "A remoção só é permitida em ciclo planejado.");
    const candidate = (
      await tx
        .select({ id: feedbackEvaluations.id })
        .from(feedbackEvaluations)
        .where(
          and(
            eq(feedbackEvaluations.cycleId, cycleId),
            eq(feedbackEvaluations.participantUserId, userId)
          )
        )
        .limit(1)
    )[0];
    if (!candidate) fail("NOT_FOUND", "Participante não encontrado no ciclo.");
    await lock(tx, "evaluation", candidate.id);
    const evaluation = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, candidate.id))
        .limit(1)
    )[0];
    if (!evaluation) fail("NOT_FOUND", "Participante não encontrado no ciclo.");
    if (evaluation.status !== "draft")
      fail("CONFLICT", "Somente avaliação em rascunho pode ser removida.");
    await tx
      .delete(feedbackEvaluations)
      .where(eq(feedbackEvaluations.id, evaluation.id));
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: userId,
      companyId: current.companyId,
      action: "feedback.participant.remove",
      resourceType: "feedback_evaluation",
      metadata: { cycleId, feedbackId: evaluation.id },
    });
    return { success: true };
  });
}

async function revalidateCycleParticipants(tx: Tx, cycle: DevelopmentCycle) {
  const evaluations = await tx
    .select()
    .from(feedbackEvaluations)
    .where(eq(feedbackEvaluations.cycleId, cycle.id));
  if (!evaluations.length)
    fail(
      "PRECONDITION_FAILED",
      "O ciclo precisa de participantes para ser ativado."
    );
  const assignmentRows = await getCurrentAssignmentsTx(tx, cycle.companyId);
  for (const evaluation of evaluations) {
    const eligibility = await getAssessmentEligibilityTx(
      tx,
      evaluation.participantUserId,
      cycle.companyId,
      evaluation.personaAssessmentId
    );
    if (!eligibility.eligible || !eligibility.assessment)
      fail(
        "PRECONDITION_FAILED",
        "A análise Persona registrada como referência deixou de ser válida."
      );
    const assignment = assignmentRows.find(
      item => item.userId === evaluation.participantUserId
    );
    if (!assignment || assignment.id !== evaluation.assignmentId)
      fail(
        "PRECONDITION_FAILED",
        "O assignment vigente de um participante mudou."
      );
    const participant = await getLiveUserTx(
      tx,
      evaluation.participantUserId,
      cycle.companyId
    );
    const evaluator = await getLiveUserTx(
      tx,
      evaluation.evaluatorUserId,
      cycle.companyId
    );
    const participantMembership = await getCurrentMembershipTx(
      tx,
      evaluation.participantUserId,
      cycle.companyId
    );
    if (
      !participant ||
      !evaluator ||
      participant.accountType !== "fluxus" ||
      evaluator.accountType !== "fluxus" ||
      !participantMembership
    )
      fail(
        "PRECONDITION_FAILED",
        "O participante ou avaliador não está mais apto para o ciclo."
      );
    if (
      !(await canEvaluateParticipantTx(
        tx,
        evaluation.evaluatorUserId,
        cycle.companyId,
        evaluation.participantUserId,
        evaluation.evaluatorUserId
      ))
    )
      fail(
        "PRECONDITION_FAILED",
        "Um avaliador não possui mais autorização vigente."
      );
  }
}

export async function transitionCycle(
  actor: Actor,
  input: { id: number; status: "active" | "closed" | "cancelled" }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.id, "Ciclo");
  const cycle = await getCycle(input.id);
  if (!cycle) fail("NOT_FOUND", "Ciclo não encontrado.");
  const target = cycleStatus(input.status);
  return db.transaction(async tx => {
    await lock(tx, "company", cycle.companyId);
    await lock(tx, "cycle", input.id);
    await requireConfigTx(tx, actor, cycle.companyId);
    const current = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, input.id))
        .limit(1)
    )[0];
    if (!current) fail("NOT_FOUND", "Ciclo não encontrado.");
    if (
      !(CYCLE_TRANSITIONS[current.status] as readonly string[]).includes(target)
    )
      fail(
        "CONFLICT",
        `Não é possível alterar ${current.status} para ${target}.`
      );
    if (target === "active") await revalidateCycleParticipants(tx, current);
    if (target === "closed") {
      const open = await tx
        .select({
          id: feedbackEvaluations.id,
          status: feedbackEvaluations.status,
        })
        .from(feedbackEvaluations)
        .where(
          and(
            eq(feedbackEvaluations.cycleId, input.id),
            ne(feedbackEvaluations.status, "closed")
          )
        );
      if (open.length)
        fail(
          "PRECONDITION_FAILED",
          "Todos os feedbacks precisam estar encerrados antes do ciclo."
        );
    }
    const now = new Date();
    const rows = await tx
      .update(developmentCycles)
      .set({
        status: target,
        activatedAt: target === "active" ? now : current.activatedAt,
        closedAt: target === "closed" ? now : current.closedAt,
      })
      .where(eq(developmentCycles.id, input.id))
      .returning();
    const updated = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      companyId: current.companyId,
      action: "feedback.cycle.transition",
      resourceType: "development_cycle",
      metadata: { cycleId: current.id, from: current.status, to: target },
    });
    return { success: true, cycle: updated };
  });
}

export async function saveDraft(
  actor: Actor,
  input: { id: number; revision: number; items: FeedbackItem[] }
) {
  requireFeedbackEnabled();
  assertPositiveId(input.id, "Feedback");
  const feedback = await getEvaluation(input.id);
  if (!feedback) fail("NOT_FOUND", "Feedback não encontrado.");
  return db.transaction(async tx => {
    await lock(tx, "company", feedback.companyId);
    await lock(tx, "cycle", feedback.cycleId);
    await lock(tx, "evaluation", input.id);
    const cycle = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, feedback.cycleId))
        .limit(1)
    )[0];
    const current = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, input.id))
        .limit(1)
    )[0];
    if (
      !cycle ||
      !current ||
      cycle.companyId !== feedback.companyId ||
      current.companyId !== cycle.companyId
    )
      fail("NOT_FOUND", "Feedback não encontrado.");
    await requireEvaluationAccessTx(tx, actor, current, "edit");
    if (cycle.status !== "active" || current.status !== "draft")
      fail("CONFLICT", "Somente rascunho de ciclo ativo pode ser salvo.");
    const items = assertValidItems(input.items, snapshotFromCycle(cycle));
    const rows = await tx
      .update(feedbackEvaluations)
      .set({
        items,
        revision: sql`${feedbackEvaluations.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedbackEvaluations.id, input.id),
          eq(feedbackEvaluations.companyId, feedback.companyId),
          eq(feedbackEvaluations.revision, input.revision),
          eq(feedbackEvaluations.status, "draft")
        )
      )
      .returning();
    if (!rows[0])
      fail(
        "CONFLICT",
        "O rascunho foi alterado por outra pessoa. Recarregue a avaliação."
      );
    const updated = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: updated.participantUserId,
      companyId: updated.companyId,
      action: "feedback.draft.save",
      resourceType: "feedback_evaluation",
      metadata: { feedbackId: updated.id, revision: updated.revision },
    });
    return {
      success: true,
      feedback: safeEvaluation(updated),
      revision: updated.revision,
    };
  });
}

export function safeEvaluation(evaluation: FeedbackEvaluation) {
  return {
    id: evaluation.id,
    companyId: evaluation.companyId,
    cycleId: evaluation.cycleId,
    participantUserId: evaluation.participantUserId,
    evaluatorUserId: evaluation.evaluatorUserId,
    personaAssessmentId: evaluation.personaAssessmentId,
    assignmentId: evaluation.assignmentId,
    departmentId: evaluation.departmentId,
    status: evaluation.status,
    items: evaluation.items,
    revision: evaluation.revision,
    completedAt: evaluation.completedAt,
    debriefedAt: evaluation.debriefedAt,
    releasedAt: evaluation.releasedAt,
    firstViewedAt: evaluation.firstViewedAt,
    acknowledgedAt: evaluation.acknowledgedAt,
    closedAt: evaluation.closedAt,
    participantComment: evaluation.participantComment,
    commentedAt: evaluation.commentedAt,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
  };
}

export function safeListEntry(
  evaluation: FeedbackEvaluation,
  participantName: string | null,
  evaluatorName: string | null
) {
  return {
    id: evaluation.id,
    cycleId: evaluation.cycleId,
    participantUserId: evaluation.participantUserId,
    evaluatorUserId: evaluation.evaluatorUserId,
    status: evaluation.status,
    revision: evaluation.revision,
    participantName,
    evaluatorName,
  };
}

async function nameMap(userIds: number[]) {
  if (!userIds.length)
    return new Map<number, { name: string | null; jobTitle: string | null }>();
  const rows = await db
    .select({ id: users.id, name: users.name, jobTitle: users.jobTitle })
    .from(users)
    .where(inArray(users.id, Array.from(new Set(userIds))));
  return new Map(
    rows.map(row => [row.id, { name: row.name, jobTitle: row.jobTitle }])
  );
}

async function visibleEvaluationList(
  actor: Actor,
  companyId: number,
  access: FeedbackAccess,
  evaluations: FeedbackEvaluation[]
) {
  const filtered: FeedbackEvaluation[] = [];
  for (const evaluation of evaluations) {
    if (actor.id === evaluation.participantUserId) {
      if (isFeedbackVisibleToParticipant(evaluation.status))
        filtered.push(evaluation);
      continue;
    }
    if (
      access.canReadContent &&
      (await canReadParticipant(
        actor.id,
        companyId,
        evaluation.participantUserId,
        evaluation.evaluatorUserId
      ))
    )
      filtered.push(evaluation);
    else if (
      !access.canReadContent &&
      access.canConfigure &&
      ["hr", "company_admin"].includes(access.membership?.role ?? "")
    )
      filtered.push(evaluation);
  }
  const names = await nameMap(
    filtered.flatMap(evaluation => [
      evaluation.participantUserId,
      evaluation.evaluatorUserId,
    ])
  );
  return filtered.map(evaluation =>
    safeListEntry(
      evaluation,
      names.get(evaluation.participantUserId)?.name ?? null,
      names.get(evaluation.evaluatorUserId)?.name ?? null
    )
  );
}

export async function workspace(
  actor: Actor,
  requestedCompanyId?: number | null
) {
  const companyId = requestedCompanyId ?? actor.companyId ?? null;
  const moduleEnabled = isFeedbackEnabled();
  const disabled = {
    enabled: false,
    moduleEnabled,
    unavailableReason: !moduleEnabled
      ? ("module_disabled" as const)
      : !companyId
        ? ("company_missing" as const)
        : ("membership_required" as const),
    companyId,
    membership: null,
    canConfigure: false,
    canReadContent: false,
    catalog: [],
    settings: null,
    departments: [],
    people: [],
    assignments: [],
    scopes: [],
    cycles: [],
    feedbacks: [],
    pendingCorrections: 0,
  };
  // Deliberately return before any feedback table query during rollout.
  if (!moduleEnabled) return disabled;
  if (!companyId) return disabled;
  const access = await requireAccess(actor, companyId, {
    allowUnconfigured: true,
  });
  if (!access.membership && !access.platformAdmin) return disabled;
  const directory = await getDirectory(companyId);
  const allEvaluations = await db
    .select()
    .from(feedbackEvaluations)
    .where(eq(feedbackEvaluations.companyId, companyId))
    .orderBy(desc(feedbackEvaluations.updatedAt), desc(feedbackEvaluations.id));
  const allCycles = await db
    .select()
    .from(developmentCycles)
    .where(eq(developmentCycles.companyId, companyId))
    .orderBy(desc(developmentCycles.startsOn), desc(developmentCycles.id));
  const now = nowDate();
  const allScopes = await db
    .select()
    .from(feedbackManagementScopes)
    .where(
      and(
        eq(feedbackManagementScopes.companyId, companyId),
        lte(feedbackManagementScopes.startsAt, now),
        or(
          isNull(feedbackManagementScopes.endsAt),
          gt(feedbackManagementScopes.endsAt, now)
        )
      )
    );

  if (access.platformAdmin) {
    return {
      enabled: true,
      moduleEnabled: true,
      unavailableReason: null,
      companyId,
      membership: null,
      canConfigure: false,
      canReadContent: false,
      catalog: [...FEEDBACK_COMPETENCIES],
      settings: await getSettings(companyId),
      departments: directory.departments,
      people: directory.people,
      assignments: directory.assignments,
      scopes: [],
      cycles: [],
      feedbacks: [],
      pendingCorrections: 0,
    };
  }

  const role = access.membership!.role;
  let allowedPeople = directory.people;
  let allowedAssignments = directory.assignments;
  let allowedScopes = access.canConfigure
    ? allScopes
    : allScopes.filter(scope => scope.userId === actor.id);
  let allowedEvaluations = allEvaluations;
  if (role === "collaborator") {
    allowedPeople = directory.people.filter(person => person.id === actor.id);
    allowedAssignments = directory.assignments.filter(
      assignment => assignment.userId === actor.id
    );
    allowedScopes = [];
    allowedEvaluations = allEvaluations.filter(
      evaluation =>
        evaluation.participantUserId === actor.id &&
        isFeedbackVisibleToParticipant(evaluation.status)
    );
  } else if (
    !access.canReadContent &&
    !(access.canConfigure && ["hr", "company_admin"].includes(role))
  ) {
    // A manager without content permission has only their own participant view.
    allowedPeople = directory.people.filter(person => person.id === actor.id);
    allowedAssignments = directory.assignments.filter(
      assignment => assignment.userId === actor.id
    );
    allowedScopes = [];
    allowedEvaluations = allEvaluations.filter(
      evaluation =>
        evaluation.participantUserId === actor.id &&
        isFeedbackVisibleToParticipant(evaluation.status)
    );
  } else if (!(role === "hr" || role === "company_admin")) {
    const visibleIds = new Set<number>();
    for (const person of directory.people) {
      if (
        person.id === actor.id ||
        (await canReadParticipant(actor.id, companyId, person.id))
      )
        visibleIds.add(person.id);
    }
    allowedPeople = directory.people.filter(person =>
      visibleIds.has(person.id)
    );
    allowedAssignments = directory.assignments.filter(assignment =>
      visibleIds.has(assignment.userId)
    );
    allowedEvaluations = allEvaluations.filter(
      evaluation =>
        visibleIds.has(evaluation.participantUserId) ||
        evaluation.evaluatorUserId === actor.id
    );
  }
  const cycleIds = new Set(
    allowedEvaluations.map(evaluation => evaluation.cycleId)
  );
  const cycles =
    access.canConfigure || role === "hr" || role === "company_admin"
      ? allCycles
      : allCycles.filter(cycle => cycleIds.has(cycle.id));
  const feedbacks = await visibleEvaluationList(
    actor,
    companyId,
    access,
    allowedEvaluations
  );
  const revisionRows = await db
    .select({
      feedbackId: feedbackRevisions.feedbackId,
      previousStatus: feedbackRevisions.previousStatus,
    })
    .from(feedbackRevisions)
    .where(
      and(
        eq(feedbackRevisions.companyId, companyId),
        inArray(feedbackRevisions.previousStatus, ["released", "acknowledged"])
      )
    );
  const evaluationById = new Map(
    allEvaluations.map(evaluation => [evaluation.id, evaluation])
  );
  const pendingCorrections = new Set(
    revisionRows
      .filter(revision => {
        const evaluation = evaluationById.get(revision.feedbackId);
        return (
          evaluation?.participantUserId === actor.id &&
          !isFeedbackVisibleToParticipant(evaluation.status)
        );
      })
      .map(revision => revision.feedbackId)
  ).size;
  return {
    enabled: true,
    moduleEnabled: true,
    unavailableReason: null,
    companyId,
    membership: access.membership,
    canConfigure: access.canConfigure,
    canReadContent: access.canReadContent,
    catalog: [...FEEDBACK_COMPETENCIES],
    settings:
      access.canConfigure || access.canReadContent
        ? await getSettings(companyId)
        : null,
    departments:
      access.canConfigure || role !== "collaborator"
        ? directory.departments
        : [],
    people: allowedPeople,
    assignments: allowedAssignments,
    scopes: allowedScopes,
    cycles,
    feedbacks,
    pendingCorrections,
  };
}

export async function getFeedback(actor: Actor, id: number) {
  requireFeedbackEnabled();
  const evaluation = await getEvaluation(id);
  if (!evaluation) fail("NOT_FOUND", "Feedback não encontrado.");
  let current: FeedbackEvaluation = evaluation;
  let cycle: DevelopmentCycle = undefined as never;
  let canEdit = false;
  let canTransition = false;
  await db.transaction(async tx => {
    await lock(tx, "company", evaluation.companyId);
    await lock(tx, "cycle", evaluation.cycleId);
    await lock(tx, "evaluation", id);
    const lockedCycle = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, evaluation.cycleId))
        .limit(1)
    )[0];
    const locked = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, id))
        .limit(1)
    )[0];
    if (
      !lockedCycle ||
      !locked ||
      lockedCycle.companyId !== evaluation.companyId ||
      locked.companyId !== lockedCycle.companyId
    )
      fail("NOT_FOUND", "Feedback não encontrado.");
    await requireEvaluationAccessTx(tx, actor, locked, "read");
    cycle = lockedCycle;
    if (
      actor.id === locked.participantUserId &&
      locked.firstViewedAt === null
    ) {
      const rows = await tx
        .update(feedbackEvaluations)
        .set({ firstViewedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(feedbackEvaluations.id, id),
            isNull(feedbackEvaluations.firstViewedAt)
          )
        )
        .returning();
      current = rows[0] ?? locked;
    } else current = locked;
    canEdit =
      cycle.status === "active" &&
      (await canEvaluateParticipantTx(
        tx,
        actor.id,
        current.companyId,
        current.participantUserId,
        current.evaluatorUserId
      )) &&
      ["draft", "completed", "debriefed", "released", "acknowledged"].includes(
        current.status
      );
    canTransition =
      actor.id === current.participantUserId
        ? current.status === "released"
        : await canEvaluateParticipantTx(
            tx,
            actor.id,
            current.companyId,
            current.participantUserId,
            current.evaluatorUserId
          );
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: current.participantUserId,
      companyId: current.companyId,
      action:
        actor.id === current.participantUserId
          ? "feedback.read_self"
          : "feedback.read_organizational",
      resourceType: "feedback_evaluation",
      metadata: { feedbackId: id, status: current.status },
    });
  });
  const names = await nameMap([
    current.participantUserId,
    current.evaluatorUserId,
  ]);
  let calculation;
  try {
    calculation = calculateFeedback(
      current.items,
      snapshotFromCycle(cycle).length
    );
  } catch {
    fail("PRECONDITION_FAILED", "O feedback armazenado está inválido.");
  }
  return {
    feedback: safeEvaluation(current),
    cycle,
    participant: {
      id: current.participantUserId,
      name: names.get(current.participantUserId)?.name ?? null,
      jobTitle: names.get(current.participantUserId)?.jobTitle ?? null,
    },
    evaluator: {
      id: current.evaluatorUserId,
      name: names.get(current.evaluatorUserId)?.name ?? null,
    },
    calculation,
    canEdit,
    canTransition,
    isParticipant: actor.id === current.participantUserId,
  };
}

export async function history(
  actor: Actor,
  input: { participantUserId?: number; year?: number }
) {
  requireFeedbackEnabled();
  const companyId = actor.companyId;
  if (!companyId)
    return { entries: [], consolidation: consolidateFeedback([], 0) };
  const access = await requireAccess(actor, companyId);
  const participantUserId = input.participantUserId ?? actor.id;
  assertPositiveId(participantUserId, "Participante");
  if (participantUserId !== actor.id) {
    if (
      !access.canReadContent ||
      !(await canReadParticipant(actor.id, companyId, participantUserId))
    )
      fail("FORBIDDEN", "Você não possui escopo para o histórico solicitado.");
  } else {
    const membership = await getCurrentMembership(actor.id, companyId);
    if (!membership) fail("FORBIDDEN", "Membership ativo exigido.");
  }
  if (
    input.year !== undefined &&
    (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2200)
  )
    fail("BAD_REQUEST", "Ano inválido.");
  const cycles = await db
    .select()
    .from(developmentCycles)
    .where(
      and(
        eq(developmentCycles.companyId, companyId),
        input.year === undefined
          ? sql`true`
          : eq(developmentCycles.year, input.year)
      )
    )
    .orderBy(asc(developmentCycles.startsOn), asc(developmentCycles.id));
  const cycleById = new Map(cycles.map(cycle => [cycle.id, cycle]));
  const evaluations = await db
    .select()
    .from(feedbackEvaluations)
    .where(
      and(
        eq(feedbackEvaluations.companyId, companyId),
        eq(feedbackEvaluations.participantUserId, participantUserId),
        inArray(
          feedbackEvaluations.cycleId,
          cycles.map(cycle => cycle.id)
        )
      )
    )
    .orderBy(asc(feedbackEvaluations.id));
  const entries: FeedbackHistoryEntry[] = evaluations
    .filter(
      evaluation =>
        participantUserId !== actor.id ||
        isFeedbackVisibleToParticipant(evaluation.status)
    )
    .map(evaluation => {
      const cycle = cycleById.get(evaluation.cycleId)!;
      return {
        id: evaluation.id,
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleStart: cycle.startsOn,
        cycleEnd: cycle.endsOn,
        cycleStatus: cycle.status,
        status: evaluation.status,
        methodVersion: cycle.methodVersion,
        competencies: snapshotFromCycle(cycle),
        items: evaluation.items,
      };
    });
  const plannedCount = cycles.filter(
    cycle =>
      cycle.status !== "cancelled" &&
      evaluations.some(evaluation => evaluation.cycleId === cycle.id)
  ).length;
  await db.transaction(async tx => {
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: participantUserId,
      companyId,
      action: "feedback.history.read",
      resourceType: "feedback_history",
      metadata: {
        participantUserId,
        year: input.year ?? null,
        entryCount: entries.length,
      },
    });
  });
  return { entries, consolidation: consolidateFeedback(entries, plannedCount) };
}

export async function correctFeedback(
  actor: Actor,
  input: { id: number; revision: number; reason: string; items: FeedbackItem[] }
) {
  requireFeedbackEnabled();
  const feedback = await getEvaluation(input.id);
  if (!feedback) fail("NOT_FOUND", "Feedback não encontrado.");
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > 2000)
    fail("BAD_REQUEST", "Informe o motivo da correção.");
  return db.transaction(async tx => {
    await lock(tx, "company", feedback.companyId);
    await lock(tx, "cycle", feedback.cycleId);
    await lock(tx, "evaluation", input.id);
    const cycle = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, feedback.cycleId))
        .limit(1)
    )[0];
    const locked = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, input.id))
        .limit(1)
    )[0];
    if (
      !cycle ||
      !locked ||
      cycle.companyId !== feedback.companyId ||
      locked.companyId !== cycle.companyId
    )
      fail("NOT_FOUND", "Feedback não encontrado.");
    await requireEvaluationAccessTx(tx, actor, locked, "edit");
    if (cycle.status !== "active")
      fail("CONFLICT", "A correção exige ciclo ativo.");
    if (locked.revision !== input.revision)
      fail(
        "CONFLICT",
        "O feedback foi alterado por outra pessoa. Recarregue a avaliação."
      );
    if (
      !["completed", "debriefed", "released", "acknowledged"].includes(
        locked.status
      )
    )
      fail("CONFLICT", "O status atual não permite correção.");
    const items = assertValidItems(input.items, snapshotFromCycle(cycle), true);
    await tx.insert(feedbackRevisions).values({
      feedbackId: locked.id,
      companyId: locked.companyId,
      previousRevision: locked.revision,
      previousItems: locked.items,
      previousStatus: locked.status,
      previousMetadata: {
        completedAt: locked.completedAt?.toISOString() ?? null,
        debriefedAt: locked.debriefedAt?.toISOString() ?? null,
        releasedAt: locked.releasedAt?.toISOString() ?? null,
        firstViewedAt: locked.firstViewedAt?.toISOString() ?? null,
        acknowledgedAt: locked.acknowledgedAt?.toISOString() ?? null,
        closedAt: locked.closedAt?.toISOString() ?? null,
        participantComment: locked.participantComment,
        commentedAt: locked.commentedAt?.toISOString() ?? null,
      },
      reason,
      actorUserId: actor.id,
    });
    const now = new Date();
    const rows = await tx
      .update(feedbackEvaluations)
      .set({
        items,
        status: "completed",
        revision: sql`${feedbackEvaluations.revision} + 1`,
        completedAt: now,
        debriefedAt: null,
        releasedAt: null,
        firstViewedAt: null,
        acknowledgedAt: null,
        closedAt: null,
        participantComment: null,
        commentedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(feedbackEvaluations.id, input.id),
          eq(feedbackEvaluations.revision, input.revision)
        )
      )
      .returning();
    if (!rows[0])
      fail("CONFLICT", "Não foi possível aplicar a correção concorrente.");
    const updated = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: updated.participantUserId,
      companyId: updated.companyId,
      action: "feedback.correct",
      resourceType: "feedback_evaluation",
      metadata: {
        feedbackId: updated.id,
        previousRevision: input.revision,
        revision: updated.revision,
        reason,
      },
    });
    return {
      success: true,
      feedback: safeEvaluation(updated),
      revision: updated.revision,
      correctionPendingRelease: true,
    };
  });
}

export async function commentFeedback(
  actor: Actor,
  input: { id: number; comment: string }
) {
  requireFeedbackEnabled();
  const feedback = await getEvaluation(input.id);
  if (!feedback) fail("NOT_FOUND", "Feedback não encontrado.");
  const comment = input.comment.trim();
  if (comment.length < 1 || comment.length > 5000)
    fail("BAD_REQUEST", "Comentário inválido.");
  return db.transaction(async tx => {
    await lock(tx, "company", feedback.companyId);
    await lock(tx, "cycle", feedback.cycleId);
    await lock(tx, "evaluation", input.id);
    const current = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, input.id))
        .limit(1)
    )[0];
    if (!current || current.companyId !== feedback.companyId)
      fail("NOT_FOUND", "Feedback não encontrado.");
    await requireEvaluationAccessTx(tx, actor, current, "participant");
    const rows = await tx
      .update(feedbackEvaluations)
      .set({
        participantComment: comment,
        commentedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedbackEvaluations.id, input.id),
          eq(feedbackEvaluations.participantUserId, actor.id),
          inArray(feedbackEvaluations.status, [
            "released",
            "acknowledged",
            "closed",
          ])
        )
      )
      .returning();
    if (!rows[0])
      fail("CONFLICT", "O feedback não está liberado para comentário.");
    const updated = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: actor.id,
      companyId: updated.companyId,
      action: "feedback.comment",
      resourceType: "feedback_evaluation",
      metadata: { feedbackId: updated.id },
    });
    return { success: true, feedback: safeEvaluation(updated) };
  });
}

export async function transitionFeedbackStatus(
  actor: Actor,
  input: {
    id: number;
    revision: number;
    status: "completed" | "debriefed" | "released" | "acknowledged" | "closed";
  }
) {
  requireFeedbackEnabled();
  const feedback = await getEvaluation(input.id);
  if (!feedback) fail("NOT_FOUND", "Feedback não encontrado.");
  const target = feedbackStatus(input.status);
  const participantAction = target === "acknowledged";
  return db.transaction(async tx => {
    await lock(tx, "company", feedback.companyId);
    await lock(tx, "cycle", feedback.cycleId);
    await lock(tx, "evaluation", input.id);
    const cycle = (
      await tx
        .select()
        .from(developmentCycles)
        .where(eq(developmentCycles.id, feedback.cycleId))
        .limit(1)
    )[0];
    const current = (
      await tx
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.id, input.id))
        .limit(1)
    )[0];
    if (
      !cycle ||
      !current ||
      current.companyId !== feedback.companyId ||
      cycle.companyId !== current.companyId
    )
      fail("NOT_FOUND", "Feedback não encontrado.");
    if (cycle.status !== "active")
      fail(
        "CONFLICT",
        "O ciclo precisa estar ativo para transicionar feedback."
      );
    await requireEvaluationAccessTx(
      tx,
      actor,
      current,
      participantAction ? "participant" : "edit"
    );
    if (participantAction && actor.id !== current.participantUserId)
      fail("FORBIDDEN", "Somente o colaborador pode registrar ciência.");
    if (!participantAction && actor.id === current.participantUserId)
      fail(
        "FORBIDDEN",
        "O colaborador não pode substituir o gestor nesta transição."
      );
    if (current.revision !== input.revision)
      fail(
        "CONFLICT",
        "O feedback foi alterado por outra pessoa. Recarregue a avaliação."
      );
    if (
      !(FEEDBACK_TRANSITIONS[current.status] as readonly string[]).includes(
        target
      )
    )
      fail(
        "CONFLICT",
        `Não é possível alterar ${FEEDBACK_STATUS_LABELS[current.status]} para ${FEEDBACK_STATUS_LABELS[target]}.`
      );
    if (target === "completed")
      assertValidItems(current.items, snapshotFromCycle(cycle), true);
    const now = new Date();
    const timestamps: Record<string, Date> = {};
    if (target === "completed") timestamps.completedAt = now;
    if (target === "debriefed") timestamps.debriefedAt = now;
    if (target === "released") timestamps.releasedAt = now;
    if (target === "acknowledged") timestamps.acknowledgedAt = now;
    if (target === "closed") timestamps.closedAt = now;
    const rows = await tx
      .update(feedbackEvaluations)
      .set({
        status: target,
        ...timestamps,
        revision: sql`${feedbackEvaluations.revision} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(feedbackEvaluations.id, input.id),
          eq(feedbackEvaluations.revision, input.revision)
        )
      )
      .returning();
    if (!rows[0])
      fail("CONFLICT", "Não foi possível transicionar por concorrência.");
    const updated = rows[0]!;
    await insertAudit(tx, {
      actorUserId: actor.id,
      subjectUserId: updated.participantUserId,
      companyId: updated.companyId,
      action: `feedback.transition.${target}`,
      resourceType: "feedback_evaluation",
      metadata: {
        feedbackId: updated.id,
        from: current.status,
        to: target,
        revision: updated.revision,
      },
    });
    return {
      success: true,
      feedback: safeEvaluation(updated),
      revision: updated.revision,
    };
  });
}

export const feedbackDb = {
  workspace,
  companyAdministratorDirectory,
  getFeedback,
  history,
  bootstrapCompanyAdmin,
  setCompanyAdministrator,
  setMembership,
  createDepartment,
  updateDepartment,
  assignEmployee,
  setManagementScope,
  updateSettings,
  createCycle,
  addParticipants,
  removeParticipant,
  transitionCycle,
  saveDraft,
  transition: transitionFeedbackStatus,
  correct: correctFeedback,
  comment: commentFeedback,
};
