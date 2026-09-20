import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  fluxusAuditLogs,
  fluxusAssessments,
  fluxusCompanies,
  fluxusConsents,
  fluxusDebriefs,
  fluxusPrivacyRequests,
  users,
  type FluxusAssessment,
  type FluxusCompany,
  type InsertFluxusAssessment,
  type InsertFluxusCompany,
} from "../drizzle/schema";
import {
  FLUXUS_DIMENSIONS,
  type FluxusDimension,
} from "../shared/fluxus";
import {
  CURRENT_FLUXUS_FORMULA_VERSION,
  CURRENT_FLUXUS_INSTRUMENT_VERSION,
  isFluxusV2Result,
  prefillFluxusV2StableAnswers,
  type FluxusStoredResult,
} from "../shared/fluxusVersioning";
import { db } from "./db";

export function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export async function getFluxusCompanyByNormalizedName(normalizedName: string) {
  const rows = await db
    .select()
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.normalizedName, normalizedName))
    .limit(1);
  return rows[0] ?? null;
}

export async function getFluxusCompanyById(id: number) {
  const rows = await db
    .select()
    .from(fluxusCompanies)
    .where(eq(fluxusCompanies.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createFluxusCompany(
  data: InsertFluxusCompany
): Promise<FluxusCompany> {
  const rows = await db.insert(fluxusCompanies).values(data).returning();
  return rows[0]!;
}

export async function setFluxusCompanyActive(id: number, active: boolean) {
  const rows = await db
    .update(fluxusCompanies)
    .set({ active: active ? 1 : 0, updatedAt: new Date() })
    .where(eq(fluxusCompanies.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function updateFluxusCompanyCode(
  id: number,
  accessCodeHash: string,
  accessCodeHint: string | null
) {
  const rows = await db
    .update(fluxusCompanies)
    .set({ accessCodeHash, accessCodeHint, updatedAt: new Date() })
    .where(eq(fluxusCompanies.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function getCurrentFluxusAssessment(
  userId: number,
  companyId: number
): Promise<FluxusAssessment | null> {
  const rows = await db
    .select()
    .from(fluxusAssessments)
    .where(
      and(
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId)
      )
    )
    .orderBy(desc(fluxusAssessments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listFluxusAssessmentsForUser(
  userId: number,
  companyId: number
) {
  return db
    .select()
    .from(fluxusAssessments)
    .where(
      and(
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId)
      )
    )
    .orderBy(desc(fluxusAssessments.createdAt));
}

export async function startNewFluxusAssessment(
  userId: number,
  companyId: number,
  cycleLabel?: string
) {
  const current = await getCurrentFluxusAssessment(userId, companyId);
  if (current?.status === "draft") return current;
  const history = await listFluxusAssessmentsForUser(userId, companyId);
  const cycleNumber = history.reduce(
    (highest, assessment) => Math.max(highest, assessment.cycleNumber),
    0
  ) + 1;
  const prefilledAnswers = current
    ? prefillFluxusV2StableAnswers(
        current.instrumentVersion,
        current.answers
      )
    : {};
  try {
    return await createFluxusAssessment({
      userId,
      companyId,
      status: "draft",
      cycleNumber,
      cycleLabel: cycleLabel || null,
      prefilledFromAssessmentId: Object.keys(prefilledAnswers).length
        ? current?.id ?? null
        : null,
      instrumentVersion: CURRENT_FLUXUS_INSTRUMENT_VERSION,
      formulaVersion: CURRENT_FLUXUS_FORMULA_VERSION,
      answers: prefilledAnswers,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
    const concurrentDraft = await getCurrentFluxusAssessment(userId, companyId);
    if (concurrentDraft?.status === "draft") return concurrentDraft;
    throw error;
  }
}

export async function createFluxusAssessment(
  data: InsertFluxusAssessment
): Promise<FluxusAssessment> {
  const rows = await db.insert(fluxusAssessments).values(data).returning();
  return rows[0]!;
}

export async function getOrCreateFluxusAssessment(
  userId: number,
  companyId: number
) {
  const current = await getCurrentFluxusAssessment(userId, companyId);
  if (current) return current;
  return createFluxusAssessment({
    userId,
    companyId,
    status: "draft",
    instrumentVersion: CURRENT_FLUXUS_INSTRUMENT_VERSION,
    formulaVersion: CURRENT_FLUXUS_FORMULA_VERSION,
    answers: {},
  });
}

export async function saveFluxusAnswers(
  assessmentId: number,
  userId: number,
  companyId: number,
  answers: Record<string, number>
) {
  const rows = await db
    .update(fluxusAssessments)
    .set({
      answers,
      revision: sql`${fluxusAssessments.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fluxusAssessments.id, assessmentId),
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId),
        eq(fluxusAssessments.status, "draft")
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function completeFluxusAssessment(
  assessmentId: number,
  userId: number,
  companyId: number,
  answers: Record<string, number>,
  result: FluxusStoredResult
) {
  const completedAt = new Date(result.completedAt);
  const rows = await db
    .update(fluxusAssessments)
    .set({
      answers,
      result,
      status: "completed",
      completedAt,
      updatedAt: completedAt,
    })
    .where(
      and(
        eq(fluxusAssessments.id, assessmentId),
        eq(fluxusAssessments.userId, userId),
        eq(fluxusAssessments.companyId, companyId),
        eq(fluxusAssessments.status, "draft")
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function getFluxusAssessmentById(id: number) {
  const rows = await db
    .select()
    .from(fluxusAssessments)
    .where(eq(fluxusAssessments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateFluxusCompanyGovernance(
  id: number,
  values: {
    reportVisibility: "participant_only" | "participant_manager_hr" | "participant_hr";
    minimumAggregateSize: number;
    retentionMonths: number;
    processingPurpose: string;
  }
) {
  const rows = await db
    .update(fluxusCompanies)
    .set({
      ...values,
      beta2OrganizationAccessApprovedAt:
        values.reportVisibility === "participant_only" ? null : new Date(),
      beta2OrganizationAccessPurpose:
        values.reportVisibility === "participant_only"
          ? null
          : values.processingPurpose,
      updatedAt: new Date(),
    })
    .where(eq(fluxusCompanies.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function setFluxusUserRole(
  userId: number,
  companyId: number,
  fluxusRole: "collaborator" | "manager" | "hr"
) {
  const rows = await db
    .update(users)
    .set({ fluxusRole, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.companyId, companyId), eq(users.accountType, "fluxus")))
    .returning();
  return rows[0] ?? null;
}

export async function recordFluxusConsent(values: {
  userId: number;
  companyId: number;
  noticeVersion: string;
  purpose: string;
  source: string;
  ipHash?: string | null;
  userAgent?: string | null;
}) {
  const rows = await db.insert(fluxusConsents).values(values).returning();
  return rows[0]!;
}

export async function listFluxusConsents(userId: number) {
  return db.select().from(fluxusConsents).where(eq(fluxusConsents.userId, userId)).orderBy(desc(fluxusConsents.acceptedAt));
}

export async function revokeLatestFluxusConsent(userId: number) {
  const consents = await listFluxusConsents(userId);
  const active = consents.find(consent => !consent.revokedAt);
  if (!active) return null;
  const rows = await db.update(fluxusConsents).set({ revokedAt: new Date() }).where(eq(fluxusConsents.id, active.id)).returning();
  return rows[0] ?? null;
}

export async function createFluxusPrivacyRequest(values: {
  userId: number;
  companyId: number;
  type: "access" | "correction" | "deletion" | "revocation";
  details?: string | null;
}) {
  const rows = await db.insert(fluxusPrivacyRequests).values(values).returning();
  return rows[0]!;
}

export async function listFluxusPrivacyRequests(userId: number) {
  return db.select().from(fluxusPrivacyRequests).where(eq(fluxusPrivacyRequests.userId, userId)).orderBy(desc(fluxusPrivacyRequests.createdAt));
}

export async function recordFluxusAudit(values: {
  actorUserId?: number | null;
  subjectUserId?: number | null;
  companyId?: number | null;
  assessmentId?: number | null;
  action: string;
  resourceType: string;
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
}) {
  const rows = await db.insert(fluxusAuditLogs).values(values).returning();
  return rows[0]!;
}

export async function listFluxusAuditLogs(companyId: number, limit = 100) {
  return db.select().from(fluxusAuditLogs).where(eq(fluxusAuditLogs.companyId, companyId)).orderBy(desc(fluxusAuditLogs.createdAt)).limit(limit);
}

export async function getFluxusDebrief(assessmentId: number) {
  const rows = await db.select().from(fluxusDebriefs).where(eq(fluxusDebriefs.assessmentId, assessmentId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertFluxusDebrief(values: {
  assessmentId: number;
  participantUserId: number;
  facilitatorUserId: number;
  status: "not_started" | "in_progress" | "completed";
  evidenceExamples?: string | null;
  hypothesesTested?: string | null;
  agreedActions?: string | null;
  managerSupport?: string | null;
  followUpDate?: string | null;
  participantNotes?: string | null;
}) {
  const now = new Date();
  const existing = await getFluxusDebrief(values.assessmentId);
  if (existing) {
    const rows = await db.update(fluxusDebriefs).set({ ...values, startedAt: existing.startedAt ?? now, completedAt: values.status === "completed" ? now : null, updatedAt: now }).where(eq(fluxusDebriefs.id, existing.id)).returning();
    return rows[0]!;
  }
  const rows = await db.insert(fluxusDebriefs).values({ ...values, startedAt: now, completedAt: values.status === "completed" ? now : null }).returning();
  return rows[0]!;
}

export type FluxusCompanySummary = FluxusCompany & {
  collaborators: number;
  completed: number;
  inProgress: number;
  completionRate: number;
};

export async function listFluxusCompanySummaries(): Promise<
  FluxusCompanySummary[]
> {
  const [companies, collaborators, assessments] = await Promise.all([
    db.select().from(fluxusCompanies).orderBy(asc(fluxusCompanies.name)),
    db
      .select({ id: users.id, companyId: users.companyId })
      .from(users)
      .where(eq(users.accountType, "fluxus")),
    db
      .select({
        id: fluxusAssessments.id,
        userId: fluxusAssessments.userId,
        companyId: fluxusAssessments.companyId,
        status: fluxusAssessments.status,
        createdAt: fluxusAssessments.createdAt,
      })
      .from(fluxusAssessments)
      .orderBy(
        desc(fluxusAssessments.createdAt),
        desc(fluxusAssessments.id)
      ),
  ]);

  const latestByUser = new Map<
    number,
    { companyId: number; status: "draft" | "completed" }
  >();
  for (const assessment of assessments) {
    if (!latestByUser.has(assessment.userId))
      latestByUser.set(assessment.userId, assessment);
  }

  return companies.map(company => {
    const companyCollaborators = collaborators.filter(
      user => user.companyId === company.id
    );
    const statuses = companyCollaborators.map(
      user => latestByUser.get(user.id)?.status
    );
    const completed = statuses.filter(status => status === "completed").length;
    const inProgress = statuses.filter(status => status === "draft").length;
    return {
      ...company,
      collaborators: companyCollaborators.length,
      completed,
      inProgress,
      completionRate: companyCollaborators.length
        ? Math.round((completed / companyCollaborators.length) * 100)
        : 0,
    };
  });
}

function emptyDimensionTotals() {
  return Object.fromEntries(
    FLUXUS_DIMENSIONS.map(dimension => [
      dimension,
      { natural: 0, funcao: 0, demanda: 0 },
    ])
  ) as Record<
    FluxusDimension,
    { natural: number; funcao: number; demanda: number }
  >;
}

export async function getFluxusCompanyDashboard(companyId: number) {
  const company = await getFluxusCompanyById(companyId);
  if (!company) return null;

  const [collaborators, assessments] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        fluxusRole: users.fluxusRole,
        jobTitle: users.jobTitle,
        department: users.department,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(eq(users.companyId, companyId), eq(users.accountType, "fluxus"))
      )
      .orderBy(asc(users.name)),
    db
      .select()
      .from(fluxusAssessments)
      .where(eq(fluxusAssessments.companyId, companyId))
      .orderBy(desc(fluxusAssessments.createdAt)),
  ]);

  const latestByUser = new Map<number, FluxusAssessment>();
  const latestCompletedByUser = new Map<number, FluxusAssessment>();
  for (const assessment of assessments) {
    if (!latestByUser.has(assessment.userId))
      latestByUser.set(assessment.userId, assessment);
    if (
      assessment.status === "completed" &&
      !latestCompletedByUser.has(assessment.userId)
    )
      latestCompletedByUser.set(assessment.userId, assessment);
  }

  const peopleWithResults = collaborators.map(collaborator => {
    const assessment = latestByUser.get(collaborator.id) ?? null;
    const completedAssessment =
      latestCompletedByUser.get(collaborator.id) ?? null;
    return {
      ...collaborator,
      assessmentId: completedAssessment?.id ?? null,
      instrumentVersion: completedAssessment?.instrumentVersion ?? null,
      formulaVersion: completedAssessment?.formulaVersion ?? null,
      assessmentStatus: (assessment?.status ?? "not_started") as
        | "draft"
        | "completed"
        | "not_started",
      completedAt: completedAssessment?.completedAt ?? null,
      result: completedAssessment?.result ?? null,
    };
  });

  const allCompletedResults = peopleWithResults
    .map(person => person.result)
    .filter((result): result is FluxusStoredResult => Boolean(result));
  const completedResults = peopleWithResults
    .filter(
      person =>
        person.instrumentVersion === CURRENT_FLUXUS_INSTRUMENT_VERSION &&
        person.formulaVersion === CURRENT_FLUXUS_FORMULA_VERSION &&
        Boolean(person.result) &&
        isFluxusV2Result(person.result!) &&
        person.result!.instrumentVersion ===
          CURRENT_FLUXUS_INSTRUMENT_VERSION &&
        person.result!.formulaVersion === CURRENT_FLUXUS_FORMULA_VERSION
    )
    .map(person => person.result)
    .filter((result): result is FluxusStoredResult => Boolean(result));
  const totals = emptyDimensionTotals();
  const predominantCount = Object.fromEntries(
    FLUXUS_DIMENSIONS.map(dimension => [dimension, 0])
  ) as Record<FluxusDimension, number>;

  for (const result of completedResults) {
    predominantCount[result.predominante] += 1;
    for (const dimension of FLUXUS_DIMENSIONS) {
      totals[dimension].natural += result.dimensions[dimension].natural;
      totals[dimension].funcao += result.dimensions[dimension].funcaoPercebida;
      totals[dimension].demanda += result.dimensions[dimension].demandaAbsoluta;
    }
  }

  const divisor = completedResults.length || 1;
  const averages = Object.fromEntries(
    FLUXUS_DIMENSIONS.map(dimension => [
      dimension,
      {
        natural: Math.round((totals[dimension].natural / divisor) * 100) / 100,
        funcao: Math.round((totals[dimension].funcao / divisor) * 100) / 100,
        demanda: Math.round((totals[dimension].demanda / divisor) * 100) / 100,
      },
    ])
  ) as Record<
    FluxusDimension,
    { natural: number; funcao: number; demanda: number }
  >;

  const people = peopleWithResults.map(({ result: _result, ...person }) => person);
  return {
    company,
    people,
    summary: {
      collaborators: collaborators.length,
      completed: allCompletedResults.length,
      currentVersionCompleted: completedResults.length,
      inProgress: peopleWithResults.filter(person => person.assessmentStatus === "draft")
        .length,
      notStarted: peopleWithResults.filter(
        person => person.assessmentStatus === "not_started"
      ).length,
      completionRate: collaborators.length
        ? Math.round((allCompletedResults.length / collaborators.length) * 100)
        : 0,
      currentVersionCompletionRate: collaborators.length
        ? Math.round((completedResults.length / collaborators.length) * 100)
        : 0,
      aggregateInstrumentVersion: CURRENT_FLUXUS_INSTRUMENT_VERSION,
      aggregateFormulaVersion: CURRENT_FLUXUS_FORMULA_VERSION,
      averages,
      predominantCount,
      canAggregate: completedResults.length >= Math.max(5, company.minimumAggregateSize),
    },
  };
}

export async function getFluxusPlatformOverview() {
  const companies = await listFluxusCompanySummaries();
  return {
    companies,
    totals: {
      companies: companies.length,
      activeCompanies: companies.filter(company => company.active === 1).length,
      collaborators: companies.reduce(
        (sum, company) => sum + company.collaborators,
        0
      ),
      completed: companies.reduce((sum, company) => sum + company.completed, 0),
      inProgress: companies.reduce(
        (sum, company) => sum + company.inProgress,
        0
      ),
    },
  };
}
