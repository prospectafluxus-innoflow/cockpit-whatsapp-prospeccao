import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(databaseUrl.hostname) &&
    databaseUrl.pathname.startsWith("/persona_phase2_test"),
  "Este teste só funciona no PostgreSQL local descartável persona_phase2_test."
);
assert.equal(
  process.env.FLUXUS_FEEDBACK_ENABLED,
  "true",
  "Habilite FLUXUS_FEEDBACK_ENABLED=true somente no ambiente local de teste."
);
process.env.NODE_ENV = "test";

const { db } = await import("../server/db");
const { users, fluxusCompanies, fluxusAssessments, fluxusAuditLogs } =
  await import("../drizzle/schema");
const {
  developmentCycles,
  feedbackAssignments,
  feedbackDepartments,
  feedbackEvaluations,
  feedbackManagementScopes,
  feedbackMemberships,
  feedbackRevisions,
  feedbackSettings,
} = await import("../drizzle/feedbackSchema");
const { feedbackRouter } = await import("../server/routers/feedback");
const { and, eq, inArray } = await import("drizzle-orm");
const versioning = await import("../shared/fluxusVersioning");

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
        "BAD_REQUEST",
        "CONFLICT",
        "PRECONDITION_FAILED",
      ].includes(String(error.code))
  );
  pass(label);
}

const companyIds: number[] = [];
const userIds: number[] = [];
const assessmentIds: number[] = [];
const departmentIds: number[] = [];
const assignmentIds: number[] = [];
const scopeIds: number[] = [];
const cycleIds: number[] = [];
const evaluationIds: number[] = [];

try {
  const [company] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Feedback usability ${suffix}`,
      normalizedName: `feedback-usability-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
    })
    .returning();
  assert(company);
  companyIds.push(company.id);

  async function createUser(
    label: string,
    companyId: number | null,
    values: Partial<typeof users.$inferInsert> = {}
  ) {
    const [user] = await db
      .insert(users)
      .values({
        name: `Usabilidade ${label} ${suffix}`,
        email: `${label}-${suffix}@persona-phase2.test`,
        accountType: companyId ? "fluxus" : "prospecting",
        companyId,
        approvalStatus: "approved",
        role: "user",
        fluxusRole: "collaborator",
        jobTitle: "Pessoa de teste",
        ...values,
      })
      .returning();
    assert(user);
    userIds.push(user.id);
    return user;
  }

  const technical = await createUser("tecnico", null, { role: "admin" });
  const admin = await createUser("admin", company.id);
  const hr = await createUser("rh", company.id);
  const manager = await createUser("gestor", company.id);
  const supermanager = await createUser("supergestor", company.id);
  const participant = await createUser("participante", company.id);
  const overrideParticipant = await createUser("override", company.id);
  const noOptInParticipant = await createUser("sem-optin", company.id);
  const rollbackParticipant = await createUser("rollback", company.id);
  const outsider = await createUser("externo", null);
  const otherCompany = await db
    .insert(fluxusCompanies)
    .values({
      name: `Outro tenant ${suffix}`,
      normalizedName: `feedback-usability-other-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
    })
    .returning();
  assert(otherCompany[0]);
  companyIds.push(otherCompany[0].id);
  const outsideEvaluator = await createUser(
    "avaliador-externo",
    otherCompany[0].id
  );

  function caller(user: typeof admin) {
    return feedbackRouter.createCaller({
      user,
      req: { headers: {} } as Request,
      res: {} as Response,
    } satisfies TrpcContext);
  }
  const technicalApi = caller(technical);
  const adminApi = caller(admin);
  const hrApi = caller(hr);
  const managerApi = caller(manager);

  await technicalApi.bootstrapCompanyAdmin({
    companyId: company.id,
    userId: admin.id,
  });
  for (const [user, role, canReadFeedback] of [
    [hr, "hr", true],
    [manager, "manager", true],
    [supermanager, "supermanager", true],
    [participant, "collaborator", false],
  ] as const) {
    await adminApi.setMembership({
      companyId: company.id,
      userId: user.id,
      role,
      canReadFeedback,
    });
  }

  const root = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: `Área raiz ${suffix}`,
    })
  ).department;
  departmentIds.push(root.id);
  const child = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: `Área filha ${suffix}`,
      parentId: root.id,
    })
  ).department;
  departmentIds.push(child.id);

  async function assign(
    userId: number,
    departmentId: number | null,
    managerUserId: number | null
  ) {
    const result = await adminApi.assignEmployee({
      companyId: company.id,
      userId,
      departmentId,
      managerUserId,
    });
    if (result.assignment) assignmentIds.push(result.assignment.id);
    return result.assignment;
  }
  const participantAssignment = await assign(
    participant.id,
    root.id,
    manager.id
  );
  const overrideAssignment = await assign(
    overrideParticipant.id,
    child.id,
    manager.id
  );
  const noOptInAssignment = await assign(
    noOptInParticipant.id,
    root.id,
    manager.id
  );
  const rollbackAssignment = await assign(
    rollbackParticipant.id,
    root.id,
    manager.id
  );
  assert(
    participantAssignment &&
      overrideAssignment &&
      noOptInAssignment &&
      rollbackAssignment
  );

  const scope = (
    await adminApi.setManagementScope({
      companyId: company.id,
      userId: supermanager.id,
      departmentId: root.id,
      includeDescendants: true,
      active: true,
    })
  ).scope;
  assert(scope);
  scopeIds.push(scope.id);

  async function completeAssessment(userId: number) {
    const answers = Object.fromEntries(
      versioning
        .getFluxusItemsForVersion(versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION)
        .map(item => [item.id, 4])
    );
    const completedAt = new Date();
    const result = versioning.calculateFluxusResultForVersion(
      versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION,
      answers,
      completedAt
    );
    const [assessment] = await db
      .insert(fluxusAssessments)
      .values({
        userId,
        companyId: company.id,
        status: "completed",
        instrumentVersion: result.instrumentVersion,
        formulaVersion: result.formulaVersion,
        answers,
        result,
        completedAt,
      })
      .returning();
    assert(assessment);
    assessmentIds.push(assessment.id);
    return assessment;
  }
  await Promise.all(
    [
      participant,
      overrideParticipant,
      noOptInParticipant,
      rollbackParticipant,
    ].map(user => completeAssessment(user.id))
  );

  const initialWorkspace = await adminApi.workspace();
  const participantPerson = initialWorkspace.people.find(
    person => person.id === participant.id
  );
  const managerPerson = initialWorkspace.people.find(
    person => person.id === manager.id
  );
  const missingPerson = initialWorkspace.people.find(
    person => person.id === overrideParticipant.id
  );
  assert(participantPerson && managerPerson && missingPerson);
  assert.equal(participantPerson.membershipRole, "collaborator");
  assert.equal(participantPerson.feedbackCanRead, false);
  assert.equal(participantPerson.hasFeedbackAccess, true);
  assert.equal(participantPerson.assignmentId, participantAssignment.id);
  assert.equal(participantPerson.managerUserId, manager.id);
  assert.equal(participantPerson.departmentId, root.id);
  assert(participantPerson.allowedEvaluatorIds.includes(manager.id));
  assert(participantPerson.allowedEvaluatorIds.includes(supermanager.id));
  assert(participantPerson.allowedEvaluatorIds.includes(hr.id));
  assert(!participantPerson.allowedEvaluatorIds.includes(admin.id));
  assert.equal(managerPerson.evaluatorEligibilityReason, null);
  assert.equal(missingPerson.membershipRole, null);
  assert.equal(missingPerson.hasFeedbackAccess, false);
  assert.match(
    String(missingPerson.evaluatorEligibilityReason),
    /papel de Feedback/i
  );
  assert.equal(
    initialWorkspace.departments.find(department => department.id === child.id)
      ?.parentName,
    root.name
  );
  pass(
    "workspace retorna DTO de membership, vínculo, gestor, departamento, candidatos e nomes"
  );

  const managerWorkspace = await managerApi.workspace();
  assert.deepEqual(
    managerWorkspace.people.map(person => person.id).sort((a, b) => a - b),
    [
      manager.id,
      participant.id,
      overrideParticipant.id,
      noOptInParticipant.id,
      rollbackParticipant.id,
    ].sort((a, b) => a - b)
  );
  assert(
    managerWorkspace.people.every(
      person => person.allowedEvaluatorIds.length === 0
    )
  );
  pass("IDs de candidatos não vazam para gestor sem configuração");

  const cycle = (
    await adminApi.createCycle({
      companyId: company.id,
      name: `Ciclo default ${suffix}`,
      startsOn: "2028-01-01",
      endsOn: "2028-03-31",
    })
  ).cycle;
  cycleIds.push(cycle.id);
  const adminMembershipBefore = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.userId, admin.id),
        eq(feedbackMemberships.companyId, company.id)
      )
    );
  const participantAssessmentBefore = JSON.stringify(
    await db
      .select()
      .from(fluxusAssessments)
      .where(eq(fluxusAssessments.userId, participant.id))
  );
  const defaultAdded = await adminApi.addParticipants({
    cycleId: cycle.id,
    participants: [
      {
        userId: participant.id,
        expectedAssignmentId: participantAssignment.id,
      },
    ],
  });
  const defaultFeedback = defaultAdded.feedbacks[0]!;
  evaluationIds.push(defaultFeedback.id);
  assert.equal(defaultFeedback.evaluatorUserId, manager.id);
  pass("avaliador omitido resolve o gestor direto vigente dentro da transação");

  const cycleOverride = (
    await adminApi.createCycle({
      companyId: company.id,
      name: `Ciclo override ${suffix}`,
      startsOn: "2028-04-01",
      endsOn: "2028-06-30",
    })
  ).cycle;
  cycleIds.push(cycleOverride.id);
  const overrideAdded = await adminApi.addParticipants({
    cycleId: cycleOverride.id,
    participants: [
      {
        userId: overrideParticipant.id,
        evaluatorUserId: supermanager.id,
        expectedAssignmentId: overrideAssignment.id,
      },
    ],
    enrollParticipants: true,
  });
  const overrideFeedback = overrideAdded.feedbacks[0]!;
  evaluationIds.push(overrideFeedback.id);
  assert.equal(overrideFeedback.evaluatorUserId, supermanager.id);
  const overrideMembership = (
    await db
      .select()
      .from(feedbackMemberships)
      .where(
        and(
          eq(feedbackMemberships.userId, overrideParticipant.id),
          eq(feedbackMemberships.companyId, company.id)
        )
      )
  )[0];
  assert(overrideMembership);
  assert.equal(overrideMembership.role, "collaborator");
  assert.equal(overrideMembership.canReadFeedback, false);
  pass(
    "override usa supergestor com escopo e enrollment cria só Colaborador sem leitura"
  );

  await denied(
    adminApi.addParticipants({
      cycleId: cycleOverride.id,
      participants: [
        { userId: noOptInParticipant.id, evaluatorUserId: manager.id },
      ],
    }),
    "opt-in padrão falso bloqueia participante sem membership"
  );
  const noOptInMembership = await db
    .select()
    .from(feedbackMemberships)
    .where(eq(feedbackMemberships.userId, noOptInParticipant.id));
  assert.equal(noOptInMembership.length, 0);
  pass("negação sem opt-in não cria membership");

  await denied(
    hrApi.addParticipants({
      cycleId: cycleOverride.id,
      participants: [
        { userId: noOptInParticipant.id, evaluatorUserId: manager.id },
      ],
      enrollParticipants: true,
    }),
    "RH não contorna a criação de acesso reservada ao administrador da empresa"
  );
  assert.equal(
    (
      await db
        .select()
        .from(feedbackMemberships)
        .where(eq(feedbackMemberships.userId, noOptInParticipant.id))
    ).length,
    0
  );
  await denied(
    adminApi.addParticipants({
      cycleId: cycleOverride.id,
      participants: [
        {
          userId: noOptInParticipant.id,
          evaluatorUserId: noOptInParticipant.id,
        },
      ],
      enrollParticipants: true,
    }),
    "autovaliação é bloqueada sem conceder membership"
  );
  await denied(
    adminApi.addParticipants({
      cycleId: cycleOverride.id,
      participants: [
        { userId: noOptInParticipant.id, evaluatorUserId: outsideEvaluator.id },
      ],
      enrollParticipants: true,
    }),
    "avaliador de outro tenant é bloqueado sem conceder membership"
  );
  pass("self, tenant externo e avaliador não autorizado permanecem negados");

  const rollbackCycle = (
    await adminApi.createCycle({
      companyId: company.id,
      name: `Ciclo rollback ${suffix}`,
      startsOn: "2028-07-01",
      endsOn: "2028-09-30",
    })
  ).cycle;
  cycleIds.push(rollbackCycle.id);
  await denied(
    adminApi.addParticipants({
      cycleId: rollbackCycle.id,
      participants: [
        {
          userId: rollbackParticipant.id,
          evaluatorUserId: manager.id,
          expectedAssignmentId: rollbackAssignment.id,
        },
        {
          userId: noOptInParticipant.id,
          evaluatorUserId: outsideEvaluator.id,
          expectedAssignmentId: noOptInAssignment.id,
        },
      ],
      enrollParticipants: true,
    }),
    "falha em lote faz rollback completo do enrollment e da avaliação"
  );
  assert.equal(
    (
      await db
        .select()
        .from(feedbackMemberships)
        .where(eq(feedbackMemberships.userId, rollbackParticipant.id))
    ).length,
    0
  );
  assert.equal(
    (
      await db
        .select()
        .from(feedbackEvaluations)
        .where(eq(feedbackEvaluations.cycleId, rollbackCycle.id))
    ).length,
    0
  );
  pass("rollback preserva ausência de membership e avaliação no lote inválido");

  assert.deepEqual(
    await db
      .select()
      .from(feedbackMemberships)
      .where(
        and(
          eq(feedbackMemberships.userId, admin.id),
          eq(feedbackMemberships.companyId, company.id)
        )
      ),
    adminMembershipBefore
  );
  assert.equal(
    JSON.stringify(
      await db
        .select()
        .from(fluxusAssessments)
        .where(eq(fluxusAssessments.userId, participant.id))
    ),
    participantAssessmentBefore
  );
  pass("addParticipants não altera papéis, flags de avaliadores nem Persona");

  await denied(
    adminApi.addParticipants({
      cycleId: cycleOverride.id,
      participants: [
        {
          userId: participant.id,
          evaluatorUserId: manager.id,
          expectedAssignmentId: participantAssignment.id + 999999,
        },
      ],
    }),
    "snapshot de assignment divergente é rejeitado antes de resolver avaliador"
  );

  const namedRoot = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: `Arquivar raiz ${suffix}`,
    })
  ).department;
  departmentIds.push(namedRoot.id);
  const namedChild = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: `Arquivar filha ${suffix}`,
      parentId: namedRoot.id,
    })
  ).department;
  departmentIds.push(namedChild.id);
  await denied(
    adminApi.updateDepartment({
      id: namedRoot.id,
      name: namedRoot.name,
      parentId: null,
      active: false,
    }),
    "arquivamento bloqueia filhos ativos com mensagem acionável"
  );
  await adminApi.setManagementScope({
    companyId: company.id,
    userId: supermanager.id,
    departmentId: namedChild.id,
    includeDescendants: false,
    active: true,
  });
  const namedChildScope = (
    await db
      .select()
      .from(feedbackManagementScopes)
      .where(
        and(
          eq(feedbackManagementScopes.companyId, company.id),
          eq(feedbackManagementScopes.userId, supermanager.id),
          eq(feedbackManagementScopes.departmentId, namedChild.id)
        )
      )
  )[0];
  assert(namedChildScope);
  scopeIds.push(namedChildScope.id);
  await denied(
    adminApi.updateDepartment({
      id: namedChild.id,
      name: namedChild.name,
      parentId: namedRoot.id,
      active: false,
    }),
    "arquivamento bloqueia escopo vigente"
  );
  await adminApi.setManagementScope({
    companyId: company.id,
    userId: supermanager.id,
    departmentId: namedChild.id,
    includeDescendants: false,
    active: false,
  });
  const namedAssignment = await assign(
    rollbackParticipant.id,
    namedChild.id,
    manager.id
  );
  assert(namedAssignment);
  await denied(
    adminApi.updateDepartment({
      id: namedChild.id,
      name: namedChild.name,
      parentId: namedRoot.id,
      active: false,
    }),
    "arquivamento bloqueia assignment vigente"
  );
  await assign(rollbackParticipant.id, null, manager.id);
  const archived = (
    await adminApi.updateDepartment({
      id: namedChild.id,
      name: `Filha arquivada ${suffix}`,
      parentId: namedRoot.id,
      active: false,
    })
  ).department;
  assert.equal(archived.active, false);
  const restored = (
    await adminApi.updateDepartment({
      id: namedChild.id,
      name: `Filha restaurada ${suffix}`,
      parentId: namedRoot.id,
      active: true,
    })
  ).department;
  assert.equal(restored.active, true);
  assert.equal(restored.parentId, namedRoot.id);
  pass(
    "arquivamento é soft archive, preserva histórico e reativa pelo update existente"
  );

  const audit = await db
    .select({ action: fluxusAuditLogs.action })
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, company.id),
        eq(fluxusAuditLogs.action, "feedback.membership.enroll_participant")
      )
    );
  assert(audit.length >= 1);
  pass("enrollment aprovado deixa trilha de auditoria");

  const [hrBefore] = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.userId, hr.id),
        eq(feedbackMemberships.companyId, company.id)
      )
    )
    .orderBy(feedbackMemberships.id);
  assert(hrBefore);
  const hrUpdated = await adminApi.setMembership({
    companyId: company.id,
    userId: hr.id,
    role: "hr",
    canReadFeedback: true,
    expectedMembershipId: hrBefore.id,
  });
  await assert.rejects(
    adminApi.setMembership({
      companyId: company.id,
      userId: hr.id,
      role: "collaborator",
      canReadFeedback: false,
      expectedMembershipId: hrBefore.id,
    }),
    error =>
      Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "CONFLICT"
      )
  );
  const afterRace = (await adminApi.workspace()).people.find(
    person => person.id === hr.id
  );
  assert(
    afterRace &&
      afterRace.membershipId === hrUpdated.membership.id &&
      afterRace.membershipRole === "hr" &&
      afterRace.feedbackCanRead === true
  );
  pass("membership obsoleto é rejeitado e não revoga nem muda o papel atual");

  const reassigned = await adminApi.assignEmployee({
    companyId: company.id,
    userId: noOptInParticipant.id,
    departmentId: root.id,
    managerUserId: manager.id,
    jobTitle: "Cargo atualizado",
    expectedAssignmentId: noOptInAssignment.id,
  });
  assert(reassigned.assignment);
  await assert.rejects(
    adminApi.assignEmployee({
      companyId: company.id,
      userId: noOptInParticipant.id,
      departmentId: child.id,
      managerUserId: supermanager.id,
      jobTitle: "Campos antigos",
      expectedAssignmentId: noOptInAssignment.id,
    }),
    error =>
      Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "CONFLICT"
      )
  );
  pass(
    "vínculo obsoleto não sobrescreve departamento, cargo ou gestor após edição concorrente"
  );

  console.log(
    `Feedback usability aprovado: ${assertions} verificações reais locais.`
  );
} finally {
  // Todas as linhas abaixo pertencem somente às fixtures aleatórias desta execução.
  if (companyIds.length) {
    await db
      .delete(fluxusAuditLogs)
      .where(inArray(fluxusAuditLogs.companyId, companyIds));
    await db
      .delete(feedbackRevisions)
      .where(inArray(feedbackRevisions.companyId, companyIds));
    await db
      .delete(feedbackEvaluations)
      .where(inArray(feedbackEvaluations.companyId, companyIds));
    await db
      .delete(developmentCycles)
      .where(inArray(developmentCycles.companyId, companyIds));
    await db
      .delete(feedbackSettings)
      .where(inArray(feedbackSettings.companyId, companyIds));
    await db
      .delete(feedbackManagementScopes)
      .where(inArray(feedbackManagementScopes.companyId, companyIds));
    await db
      .delete(feedbackAssignments)
      .where(inArray(feedbackAssignments.companyId, companyIds));
    await db
      .delete(feedbackMemberships)
      .where(inArray(feedbackMemberships.companyId, companyIds));
    await db
      .delete(fluxusAssessments)
      .where(inArray(fluxusAssessments.companyId, companyIds));
    await db
      .delete(feedbackDepartments)
      .where(inArray(feedbackDepartments.companyId, companyIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await db
      .delete(fluxusCompanies)
      .where(inArray(fluxusCompanies.id, companyIds));
  }
  await db.$client.end({ timeout: 5 });
}
