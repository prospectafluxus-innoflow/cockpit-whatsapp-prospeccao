import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";

process.env.NODE_ENV = "test";
process.env.FLUXUS_FEEDBACK_ENABLED = "true";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(databaseUrl.hostname) &&
    databaseUrl.pathname.startsWith("/persona_phase2_test"),
  "Este teste só funciona no PostgreSQL local descartável persona_phase2_test."
);

const { db } = await import("../server/db");
const { users, fluxusCompanies, fluxusAuditLogs } = await import(
  "../drizzle/schema"
);
const {
  feedbackMemberships,
  feedbackDepartments,
  feedbackAssignments,
  feedbackSettings,
  developmentCycles,
} = await import("../drizzle/feedbackSchema");
const { feedbackRouter } = await import("../server/routers/feedback");
const { eq, inArray } = await import("drizzle-orm");

// Deliberately independent from server/db.ts: this reader cannot see uncommitted
// rows held by the application's transaction connection.
const reader = postgres(process.env.DATABASE_URL!, {
  ssl: false,
  max: 1,
  prepare: false,
  onnotice: () => {},
});

const suffix = randomUUID().slice(0, 8);
const createdCompanyIds: number[] = [];
const createdUserIds: number[] = [];
const createdDepartmentIds: number[] = [];
const createdAssignmentIds: number[] = [];
const createdCycleIds: number[] = [];
let assertions = 0;

function pass(label: string) {
  assertions += 1;
  console.log(`OK ${assertions}: ${label}`);
}

async function independentRows(table: string, id: number) {
  // Table is a constant selected by this script; id remains a bound parameter.
  return reader.unsafe(`SELECT * FROM "${table}" WHERE "id" = $1`, [id]);
}

async function assertCommitted(
  table: string,
  id: number,
  label: string,
  checks: Record<string, unknown> = {}
) {
  const rows = await independentRows(table, id);
  assert.equal(
    rows.length,
    1,
    `${label}: leitor independente não encontrou id=${id}`
  );
  for (const [column, expected] of Object.entries(checks))
    assert.deepEqual(rows[0]![column], expected, `${label}: coluna ${column}`);
  pass(`${label}: commit visível ao leitor Postgres independente`);
}

async function sequenceValue(sequence: string) {
  const rows = await reader.unsafe(
    `SELECT last_value, is_called FROM "${sequence}"`
  );
  assert.equal(rows.length, 1, `sequência ${sequence} não encontrada`);
  return Number(rows[0]!.last_value);
}

function caller(user: typeof users.$inferSelect) {
  const ctx: TrpcContext = {
    user,
    req: { headers: {} } as Request,
    res: {} as Response,
  };
  return feedbackRouter.createCaller(ctx);
}

try {
  const [company] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Persistência Feedback ${suffix}`,
      normalizedName: `persistencia-feedback-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
    })
    .returning();
  assert(company);
  createdCompanyIds.push(company.id);

  async function createUser(
    label: string,
    companyId: number | null,
    values: Partial<typeof users.$inferInsert> = {}
  ) {
    const [user] = await db
      .insert(users)
      .values({
        name: `Teste ${label} ${suffix}`,
        email: `${label}-${suffix}@feedback-persistence.test`,
        passwordHash: "test-only",
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

  const platformAdmin = await createUser("admin-plataforma", null, {
    role: "admin",
  });
  const admin = await createUser("admin-empresa", company.id);
  const manager = await createUser("gestor", company.id, {
    fluxusRole: "manager",
  });
  const employee = await createUser("colaborador", company.id);

  const platformApi = caller(platformAdmin);
  const adminApi = caller(admin);

  await platformApi.bootstrapCompanyAdmin({
    companyId: company.id,
    userId: admin.id,
  });
  const adminMembershipRows = await independentRows(
    "fluxus_feedback_memberships",
    (await adminApi.workspace()).membership!.id
  );
  assert.equal(adminMembershipRows.length, 1);
  pass("bootstrap de admin empresarial também foi commitado");

  const firstDepartment = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: "Infra",
      parentId: null,
    })
  ).department;
  createdDepartmentIds.push(firstDepartment.id);
  await assertCommitted(
    "fluxus_feedback_departments",
    firstDepartment.id,
    "primeiro departamento",
    { name: "Infra", companyId: company.id }
  );

  const secondDepartment = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: "Produto",
      parentId: null,
    })
  ).department;
  createdDepartmentIds.push(secondDepartment.id);
  await assertCommitted(
    "fluxus_feedback_departments",
    secondDepartment.id,
    "segundo departamento",
    { name: "Produto", companyId: company.id }
  );

  const childDepartment = (
    await adminApi.createDepartment({
      companyId: company.id,
      name: "SRE",
      parentId: firstDepartment.id,
    })
  ).department;
  createdDepartmentIds.push(childDepartment.id);
  await assertCommitted(
    "fluxus_feedback_departments",
    childDepartment.id,
    "terceiro departamento sucessivo",
    { name: "SRE", parentId: firstDepartment.id }
  );

  const updatedChild = (
    await adminApi.updateDepartment({
      id: childDepartment.id,
      name: "SRE e Observabilidade",
      parentId: secondDepartment.id,
      active: true,
    })
  ).department;
  await assertCommitted(
    "fluxus_feedback_departments",
    updatedChild.id,
    "atualização de departamento",
    { name: "SRE e Observabilidade", parentId: secondDepartment.id }
  );

  const managerMembership = (
    await adminApi.setMembership({
      companyId: company.id,
      userId: manager.id,
      role: "manager",
      canReadFeedback: true,
    })
  ).membership;
  await assertCommitted(
    "fluxus_feedback_memberships",
    managerMembership.id,
    "membership de gestor",
    { userId: manager.id, role: "manager", companyId: company.id }
  );

  const employeeMembership = (
    await adminApi.setMembership({
      companyId: company.id,
      userId: employee.id,
      role: "collaborator",
      canReadFeedback: false,
    })
  ).membership;
  await assertCommitted(
    "fluxus_feedback_memberships",
    employeeMembership.id,
    "membership de colaborador sucessivo",
    { userId: employee.id, role: "collaborator", companyId: company.id }
  );

  const assignment = (
    await adminApi.assignEmployee({
      companyId: company.id,
      userId: employee.id,
      departmentId: childDepartment.id,
      managerUserId: manager.id,
      jobTitle: "Analista de plataforma",
    })
  ).assignment;
  createdAssignmentIds.push(assignment.id);
  await assertCommitted(
    "fluxus_feedback_assignments",
    assignment.id,
    "atribuição de colaborador",
    {
      companyId: company.id,
      userId: employee.id,
      departmentId: childDepartment.id,
      managerUserId: manager.id,
    }
  );

  const cycleNames = ["Ciclo 1", "Ciclo 2", "Ciclo 3"];
  for (const [index, name] of cycleNames.entries()) {
    const cycle = (
      await adminApi.createCycle({
        companyId: company.id,
        name,
        startsOn: `202${7 + index}-01-01`,
        endsOn: `202${7 + index}-03-31`,
      })
    ).cycle;
    createdCycleIds.push(cycle.id);
    await assertCommitted(
      "fluxus_development_cycles",
      cycle.id,
      `criação sucessiva de ciclo ${index + 1}`,
      { companyId: company.id, name }
    );
  }

  const auditRows = await reader.unsafe(
    `SELECT "action", COUNT(*)::int AS count
       FROM "fluxus_audit_logs"
      WHERE "companyId" = $1
        AND "action" IN ('feedback.department.create','feedback.department.update',
                         'feedback.membership.change','feedback.assignment.change',
                         'feedback.cycle.create')
      GROUP BY "action"
      ORDER BY "action"`,
    [company.id]
  );
  assert.equal(
    Number(
      auditRows.find(row => row.action === "feedback.department.create")?.count
    ),
    3
  );
  assert.equal(
    Number(
      auditRows.find(row => row.action === "feedback.department.update")?.count
    ),
    1
  );
  assert.equal(
    Number(
      auditRows.find(row => row.action === "feedback.membership.change")?.count
    ),
    2
  );
  assert.equal(
    Number(
      auditRows.find(row => row.action === "feedback.assignment.change")?.count
    ),
    1
  );
  assert.equal(
    Number(
      auditRows.find(row => row.action === "feedback.cycle.create")?.count
    ),
    3
  );
  pass("auditoria de todas as mutações também está persistida");

  const departmentSequence = await sequenceValue(
    "fluxus_feedback_departments_id_seq"
  );
  const assignmentSequence = await sequenceValue(
    "fluxus_feedback_assignments_id_seq"
  );
  const cycleSequence = await sequenceValue("fluxus_development_cycles_id_seq");
  assert(departmentSequence >= Math.max(...createdDepartmentIds));
  assert(assignmentSequence >= Math.max(...createdAssignmentIds));
  assert(cycleSequence >= Math.max(...createdCycleIds));
  pass(
    `sequências coerentes após commit (departamentos=${departmentSequence}, assignments=${assignmentSequence}, ciclos=${cycleSequence})`
  );

  await assert.rejects(
    adminApi.assignEmployee({
      companyId: company.id,
      userId: employee.id,
      departmentId: childDepartment.id,
      managerUserId: manager.id,
      expectedAssignmentId: null,
    }),
    error =>
      Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "CONFLICT"
      )
  );
  const unchanged = await adminApi.assignEmployee({
    companyId: company.id,
    userId: employee.id,
    departmentId: childDepartment.id,
    managerUserId: manager.id,
    expectedAssignmentId: assignment.id,
  });
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.assignment.id, assignment.id);
  assert.equal(unchanged.assignment.jobTitle, "Analista de plataforma");
  pass(
    "edição desatualizada é negada e no-op preserva vínculo/cargo sem nova revisão"
  );

  const legacyManager = await createUser("gestor-legado", company.id, {
    fluxusRole: "manager",
  });
  const legacyEmployee = await createUser("colaborador-legado", company.id);
  const legacyBinding = await adminApi.assignEmployee({
    companyId: company.id,
    userId: legacyEmployee.id,
    departmentId: childDepartment.id,
    managerUserId: legacyManager.id,
    expectedAssignmentId: null,
  });
  createdAssignmentIds.push(legacyBinding.assignment.id);
  await assertCommitted(
    "fluxus_feedback_assignments",
    legacyBinding.assignment.id,
    "gestor Persona pode receber vínculo sem papel Feedback"
  );
  const implicitGrant =
    await reader`SELECT id FROM fluxus_feedback_memberships WHERE "companyId" = ${company.id} AND "userId" = ${legacyManager.id} LIMIT 1`;
  assert.equal(implicitGrant.length, 0);
  pass(
    "vincular gestor legado não cria papel nem permissão de leitura Feedback"
  );

  const originalTransaction = db.transaction;
  try {
    db.transaction = (async () => ({
      success: true,
      department: {
        id: 1_000_000_000,
        companyId: company.id,
        name: "Falso sucesso",
        parentId: null,
        active: true,
      },
    })) as typeof db.transaction;
    await assert.rejects(
      adminApi.createDepartment({
        companyId: company.id,
        name: "Falso sucesso",
        parentId: null,
      }),
      error =>
        Boolean(
          error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "PRECONDITION_FAILED"
        )
    );
    pass(
      "callback com sucesso sem registro persistido não produz sucesso de API"
    );
    const originalSelect = db.select;
    try {
      db.select = (() => {
        throw new Error("Falha temporária de consulta de confirmação");
      }) as typeof db.select;
      await assert.rejects(
        adminApi.createDepartment({
          companyId: company.id,
          name: "Confirmação indisponível",
          parentId: null,
        }),
        error =>
          Boolean(
            error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "PRECONDITION_FAILED" &&
              "message" in error &&
              String(error.message).includes("pode já estar salva")
          )
      );
      pass(
        "falha pós-commit informa incerteza e pede consulta antes de repetir"
      );
    } finally {
      db.select = originalSelect;
    }
  } finally {
    db.transaction = originalTransaction;
  }

  console.log(
    `Persistência local aprovada: ${assertions} verificações; somente banco local persona_phase2_test.`
  );
} finally {
  // FK-safe cleanup of only this run's random fixture. This is intentionally
  // application-side cleanup against the guarded local database.
  if (createdCompanyIds.length) {
    await db
      .delete(fluxusAuditLogs)
      .where(inArray(fluxusAuditLogs.companyId, createdCompanyIds));
    if (createdCycleIds.length)
      await db
        .delete(developmentCycles)
        .where(inArray(developmentCycles.id, createdCycleIds));
    if (createdAssignmentIds.length)
      await db
        .delete(feedbackAssignments)
        .where(inArray(feedbackAssignments.id, createdAssignmentIds));
    await db
      .delete(feedbackSettings)
      .where(inArray(feedbackSettings.companyId, createdCompanyIds));
    // Delete all memberships for this random company before deleting users,
    // including the membership created by bootstrapCompanyAdmin.
    await db
      .delete(feedbackMemberships)
      .where(inArray(feedbackMemberships.companyId, createdCompanyIds));
    if (createdDepartmentIds.length)
      await db
        .delete(feedbackDepartments)
        .where(inArray(feedbackDepartments.id, createdDepartmentIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    await db
      .delete(fluxusCompanies)
      .where(inArray(fluxusCompanies.id, createdCompanyIds));
  }
  await reader.end({ timeout: 5 });
  await db.$client.end({ timeout: 5 });
}
