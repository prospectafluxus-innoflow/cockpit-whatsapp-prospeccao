import { and, asc, desc, eq } from "drizzle-orm";
import {
  fluxusAssessments,
  fluxusCompanies,
  users,
  type FluxusAssessment,
  type FluxusCompany,
  type InsertFluxusAssessment,
  type InsertFluxusCompany,
} from "../drizzle/schema";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_FORMULA_VERSION,
  FLUXUS_INSTRUMENT_VERSION,
  type FluxusDimension,
  type FluxusResult,
} from "../shared/fluxus";
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
  userId: number
): Promise<FluxusAssessment | null> {
  const rows = await db
    .select()
    .from(fluxusAssessments)
    .where(eq(fluxusAssessments.userId, userId))
    .orderBy(desc(fluxusAssessments.createdAt))
    .limit(1);
  return rows[0] ?? null;
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
  const current = await getCurrentFluxusAssessment(userId);
  if (current) return current;
  return createFluxusAssessment({
    userId,
    companyId,
    status: "draft",
    instrumentVersion: FLUXUS_INSTRUMENT_VERSION,
    formulaVersion: FLUXUS_FORMULA_VERSION,
    answers: {},
  });
}

export async function saveFluxusAnswers(
  assessmentId: number,
  userId: number,
  answers: Record<string, number>
) {
  const rows = await db
    .update(fluxusAssessments)
    .set({ answers, updatedAt: new Date() })
    .where(
      and(
        eq(fluxusAssessments.id, assessmentId),
        eq(fluxusAssessments.userId, userId)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function completeFluxusAssessment(
  assessmentId: number,
  userId: number,
  answers: Record<string, number>,
  result: FluxusResult
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
        eq(fluxusAssessments.userId, userId)
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
        userId: fluxusAssessments.userId,
        companyId: fluxusAssessments.companyId,
        status: fluxusAssessments.status,
      })
      .from(fluxusAssessments),
  ]);

  const latestByUser = new Map<
    number,
    { companyId: number; status: "draft" | "completed" }
  >();
  for (const assessment of assessments)
    latestByUser.set(assessment.userId, assessment);

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
  for (const assessment of assessments) {
    if (!latestByUser.has(assessment.userId))
      latestByUser.set(assessment.userId, assessment);
  }

  const people = collaborators.map(collaborator => {
    const assessment = latestByUser.get(collaborator.id) ?? null;
    return {
      ...collaborator,
      assessmentId: assessment?.id ?? null,
      assessmentStatus: (assessment?.status ?? "not_started") as
        | "draft"
        | "completed"
        | "not_started",
      completedAt: assessment?.completedAt ?? null,
      result: assessment?.result ?? null,
    };
  });

  const completedResults = people
    .map(person => person.result)
    .filter((result): result is FluxusResult => Boolean(result));
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

  return {
    company,
    people,
    summary: {
      collaborators: collaborators.length,
      completed: completedResults.length,
      inProgress: people.filter(person => person.assessmentStatus === "draft")
        .length,
      notStarted: people.filter(
        person => person.assessmentStatus === "not_started"
      ).length,
      completionRate: collaborators.length
        ? Math.round((completedResults.length / collaborators.length) * 100)
        : 0,
      averages,
      predominantCount,
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
