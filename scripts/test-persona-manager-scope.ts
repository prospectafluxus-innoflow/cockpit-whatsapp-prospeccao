import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";

process.env.NODE_ENV = "test";
// Phase 1 must not depend on the Feedback feature flag. This also exercises
// the direct assignment query while phase 2 is disabled.
process.env.FLUXUS_FEEDBACK_ENABLED = "false";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(databaseUrl.hostname) &&
    databaseUrl.pathname.startsWith("/persona_phase2_test"),
  "Este teste só funciona no PostgreSQL local descartável persona_phase2_test."
);

const { db } = await import("../server/db");
const { fluxusAssessments, fluxusAuditLogs, fluxusCompanies, users } =
  await import("../drizzle/schema");
const { feedbackAssignments } = await import("../drizzle/feedbackSchema");
const { fluxusRouter } = await import("../server/routers/fluxus");
const { getFluxusDirectTeamUserIds } = await import(
  "../server/fluxusOrganization"
);
const versioning = await import("../shared/fluxusVersioning");
const { FLUXUS_DIMENSIONS } = await import("../shared/fluxus");
const { and, eq, inArray } = await import("drizzle-orm");

const suffix = randomUUID().slice(0, 8);
let assertions = 0;
function pass(label: string) {
  assertions += 1;
  console.log(`OK ${assertions}: ${label}`);
}
async function denied(operation: Promise<unknown>, label: string) {
  await assert.rejects(
    operation,
    error =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      [
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "BAD_REQUEST",
        "PRECONDITION_FAILED",
      ].includes(String(error.code))
  );
  pass(label);
}

const createdUserIds: number[] = [];
const createdCompanyIds: number[] = [];
const createdAssignmentIds: number[] = [];
const createdAssessmentIds: number[] = [];

try {
  const [company] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Escopo Persona ${suffix}`,
      normalizedName: `escopo-persona-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
      reportVisibility: "participant_manager_hr",
      beta2OrganizationAccessApprovedAt: new Date(),
      minimumAggregateSize: 5,
    })
    .returning();
  const [otherCompany] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Outro tenant Persona ${suffix}`,
      normalizedName: `outro-tenant-persona-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
      reportVisibility: "participant_manager_hr",
      beta2OrganizationAccessApprovedAt: new Date(),
    })
    .returning();
  assert(company && otherCompany);
  createdCompanyIds.push(company.id, otherCompany.id);

  async function createUser(
    label: string,
    companyId: number | null,
    values: Partial<typeof users.$inferInsert> = {}
  ) {
    const [user] = await db
      .insert(users)
      .values({
        name: `Teste ${label} ${suffix}`,
        email: `${label}-${suffix}@persona-manager-scope.test`,
        accountType: companyId ? "fluxus" : "prospecting",
        companyId,
        approvalStatus: "approved",
        role: "user",
        fluxusRole: "collaborator",
        jobTitle: "Função de teste",
        ...values,
      })
      .returning();
    assert(user);
    createdUserIds.push(user.id);
    return user;
  }

  const manager = await createUser("gestor", company.id, {
    fluxusRole: "manager",
  });
  const noAssignmentManager = await createUser(
    "gestor-sem-vinculo",
    company.id,
    {
      fluxusRole: "manager",
    }
  );
  const newManager = await createUser("novo-gestor", company.id, {
    fluxusRole: "manager",
  });
  const hr = await createUser("rh", company.id, { fluxusRole: "hr" });
  const directReports = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      createUser(`direto-${index + 1}`, company.id, {
        department: "Equipe direta",
      })
    )
  );
  const peer = await createUser("par-sem-vinculo", company.id);
  const owner = await createUser("dono-sem-vinculo", company.id);
  const outsider = await createUser("outro-tenant", otherCompany.id);
  const platformAdmin = await createUser("admin-plataforma", null, {
    role: "admin",
  });

  const answerTemplate = Object.fromEntries(
    versioning
      .getFluxusItemsForVersion(versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION)
      .map(item => [item.id, 1])
  );
  async function completeAssessment(userId: number, value: number) {
    const answers = Object.fromEntries(
      Object.keys(answerTemplate).map(key => [key, value])
    );
    const result = versioning.calculateFluxusResultForVersion(
      versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION,
      answers
    );
    const [assessment] = await db
      .insert(fluxusAssessments)
      .values({
        userId,
        companyId: userId === outsider.id ? otherCompany.id : company.id,
        status: "completed",
        cycleNumber: 1,
        instrumentVersion: versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION,
        formulaVersion: versioning.CURRENT_FLUXUS_FORMULA_VERSION,
        answers,
        result,
        completedAt: new Date(),
      })
      .returning();
    assert(assessment);
    createdAssessmentIds.push(assessment.id);
    return { assessment, result };
  }

  const directAssessments = await Promise.all(
    directReports.map(user => completeAssessment(user.id, 1))
  );
  const peerAssessment = await completeAssessment(peer.id, 7);
  const ownerAssessment = await completeAssessment(owner.id, 7);
  const outsiderAssessment = await completeAssessment(outsider.id, 7);
  await completeAssessment(manager.id, 1);

  async function assign(userId: number, managerUserId: number) {
    const [assignment] = await db
      .insert(feedbackAssignments)
      .values({
        companyId: company.id,
        userId,
        managerUserId,
        startsAt: new Date(Date.now() - 1_000),
        endsAt: null,
        createdBy: manager.id,
      })
      .returning();
    assert(assignment);
    createdAssignmentIds.push(assignment.id);
    return assignment;
  }
  for (const person of directReports) await assign(person.id, manager.id);

  function caller(user: typeof manager) {
    const ctx: TrpcContext = {
      user,
      req: { headers: {} } as Request,
      res: {} as Response,
    };
    return fluxusRouter.createCaller(ctx);
  }
  const managerApi = caller(manager);
  const noAssignmentManagerApi = caller(noAssignmentManager);
  const newManagerApi = caller(newManager);
  const hrApi = caller(hr);
  const collaboratorApi = caller(directReports[0]!);
  const platformApi = caller(platformAdmin);
  const teamIds = await getFluxusDirectTeamUserIds(manager.id, company.id);
  assert.deepEqual(
    [...teamIds].sort((a, b) => a - b),
    directReports.map(person => person.id).sort((a, b) => a - b)
  );
  pass("atribuição direta vigente é a única fonte e ignora a flag da fase 2");

  const directory = await managerApi.individualReportDirectory();
  assert.deepEqual(
    directory.map(person => person.id).sort((a, b) => a - b),
    directReports.map(person => person.id).sort((a, b) => a - b)
  );
  assert(
    !directory.some(person =>
      [peer.id, owner.id, manager.id].includes(person.id)
    )
  );
  pass("diretório do gestor contém somente a equipe direta atual");

  const dashboard = await managerApi.teamDashboard();
  assert(dashboard.summary);
  assert.equal(
    dashboard.summary.aggregateInstrumentVersion,
    versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION
  );
  assert.equal(
    dashboard.summary.aggregateFormulaVersion,
    versioning.CURRENT_FLUXUS_FORMULA_VERSION
  );
  const dimension = FLUXUS_DIMENSIONS[0]!;
  assert.equal(
    dashboard.summary.averages[dimension].natural,
    directAssessments[0]!.result.dimensions[dimension].natural
  );
  pass("agregado do gestor calcula só a equipe e mantém versões/anonimato");

  const emptyDashboard = await noAssignmentManagerApi.teamDashboard();
  assert.equal(emptyDashboard.summary, null);
  assert.deepEqual(
    await noAssignmentManagerApi.individualReportDirectory(),
    []
  );
  pass("gestor sem atribuições tem equipe vazia em diretório e agregado");

  await managerApi.adminAssessment({
    assessmentId: directAssessments[0]!.assessment.id,
  });
  pass("gestor lê relatório individual de integrante direto");
  await denied(
    managerApi.adminAssessment({ assessmentId: peerAssessment.assessment.id }),
    "peer sem vínculo é negado por URL direta"
  );
  await denied(
    managerApi.adminAssessment({ assessmentId: ownerAssessment.assessment.id }),
    "dono sem vínculo é negado por URL direta"
  );
  await denied(
    managerApi.adminAssessment({
      assessmentId: outsiderAssessment.assessment.id,
    }),
    "assessment de tenant errado é negado antes de qualquer escopo"
  );

  const own = await collaboratorApi.myAssessment({
    assessmentId: directAssessments[0]!.assessment.id,
  });
  assert.equal(own.assessment.id, directAssessments[0]!.assessment.id);
  pass("self-service do colaborador continua funcionando");

  const oldAssignment = await db
    .select()
    .from(feedbackAssignments)
    .where(
      and(
        eq(feedbackAssignments.companyId, company.id),
        eq(feedbackAssignments.userId, directReports[0]!.id),
        eq(feedbackAssignments.managerUserId, manager.id)
      )
    )
    .limit(1);
  assert(oldAssignment[0]);
  await db
    .update(feedbackAssignments)
    .set({ endsAt: new Date() })
    .where(eq(feedbackAssignments.id, oldAssignment[0]!.id));
  await assign(directReports[0]!.id, newManager.id);
  await denied(
    managerApi.adminAssessment({
      assessmentId: directAssessments[0]!.assessment.id,
    }),
    "troca de gestor revoga imediatamente o acesso do gestor antigo"
  );
  await newManagerApi.adminAssessment({
    assessmentId: directAssessments[0]!.assessment.id,
  });
  pass(
    "novo gestor recebe o vínculo atual sem transformar papel em acesso global"
  );

  const hrDirectory = await hrApi.individualReportDirectory();
  assert(hrDirectory.some(person => person.id === peer.id));
  assert(hrDirectory.some(person => person.id === owner.id));
  pass(
    "RH mantém o privilégio organizacional existente sem depender de atribuição direta"
  );

  await platformApi.adminAssessment({
    assessmentId: outsiderAssessment.assessment.id,
  });
  pass(
    "administrador de plataforma mantém o bypass existente da política individual"
  );

  console.log(`Escopo de gestor Persona aprovado: ${assertions} verificações.`);
} finally {
  // Delete only this run's random fixtures, in FK-safe order.
  if (createdCompanyIds.length > 0) {
    await db
      .delete(fluxusAuditLogs)
      .where(inArray(fluxusAuditLogs.companyId, createdCompanyIds));
    await db
      .delete(feedbackAssignments)
      .where(inArray(feedbackAssignments.id, createdAssignmentIds));
    await db
      .delete(fluxusAssessments)
      .where(inArray(fluxusAssessments.id, createdAssessmentIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db
      .delete(fluxusCompanies)
      .where(inArray(fluxusCompanies.id, createdCompanyIds));
  }
  await db.$client.end({ timeout: 5 });
}
