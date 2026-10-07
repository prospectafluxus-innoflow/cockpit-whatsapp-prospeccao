import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.pathname.startsWith("/persona_phase2_test"),
  "Este teste só funciona no PostgreSQL local descartável persona_phase2_test."
);
assert.equal(
  process.env.FLUXUS_FEEDBACK_ENABLED,
  "true",
  "Habilite a flag apenas no ambiente de teste."
);
process.env.NODE_ENV = "test";

const fixture = JSON.parse(
  await readFile(
    process.env.FEEDBACK_TEST_FIXTURE_FILE ??
      "/tmp/persona-phase2-fixture.json",
    "utf8"
  )
) as {
  companyId: number;
  accounts: { technical: { email: string } };
};

const { db } = await import("../server/db");
const { users, fluxusAuditLogs, fluxusCompanies } = await import(
  "../drizzle/schema"
);
const { feedbackMemberships } = await import("../drizzle/feedbackSchema");
const { and, asc, eq } = await import("drizzle-orm");
const { feedbackRouter } = await import("../server/routers/feedback");
const { setFeedbackEnabledResolverForTests } = await import(
  "../server/feedbackDb"
);

const [technical] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.technical.email))
  .limit(1);
assert(technical, "A conta técnica da fixture não foi encontrada.");

const suffix = randomUUID().slice(0, 8);
let assertions = 0;
function pass(label: string) {
  assertions++;
  console.log(`OK ${assertions}: ${label}`);
}

function caller(user: TrpcContext["user"]) {
  return feedbackRouter.createCaller({
    user,
    req: { headers: {} } as Request,
    res: {} as Response,
  });
}

async function denied(
  operation: Promise<unknown>,
  label: string,
  codes = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "BAD_REQUEST",
    "PRECONDITION_FAILED",
  ]
) {
  await assert.rejects(
    operation,
    error =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      codes.includes(String(error.code))
  );
  pass(label);
}

async function createUser(
  label: string,
  companyId: number | null,
  values: Partial<typeof users.$inferInsert> = {}
) {
  const [user] = await db
    .insert(users)
    .values({
      name: `Teste onboarding ${label}`,
      email: `${label}-${suffix}@persona-phase2.test`,
      accountType: companyId ? "fluxus" : "prospecting",
      companyId,
      approvalStatus: "approved",
      role: "user",
      fluxusRole: "manager",
      jobTitle: "Função de teste",
      ...values,
    })
    .returning();
  assert(user);
  return user;
}

async function createCompany(label: string, active: number) {
  const [company] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Empresa onboarding ${label} ${suffix}`,
      normalizedName: `empresa-onboarding-${label}-${suffix}`,
      accessCodeHash: "test-only",
      active,
    })
    .returning();
  assert(company);
  return company;
}

const technicalApi = caller(technical);
const anonymousApi = caller(null);
const companyId = fixture.companyId;
const target = await createUser("admin-target", companyId);
const targetApi = caller(target);
const inactiveTarget = await createUser("inactive-target", companyId, {
  approvalStatus: "pending",
});
const otherCompany = await createCompany("cross-company", 1);
const crossCompanyTarget = await createUser(
  "cross-company-target",
  otherCompany.id
);
const inactiveCompany = await createCompany("inactive", 0);
const inactiveCompanyTarget = await createUser(
  "inactive-company-target",
  inactiveCompany.id
);

try {
  const [seedMembership] = await db
    .insert(feedbackMemberships)
    .values({
      companyId,
      userId: target.id,
      role: "manager",
      canReadFeedback: true,
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
      createdBy: technical.id,
    })
    .returning();
  assert(seedMembership);

  const initialWorkspace = await technicalApi.workspace({ companyId });
  const initialPerson = initialWorkspace.people.find(
    person => person.id === target.id
  );
  assert(initialPerson);
  assert.equal(initialPerson.isCompanyAdmin, false);
  assert.equal(initialPerson.eligible, false);
  pass("diretório expõe isCompanyAdmin e não exige Persona para listar");

  const activated = await technicalApi.setCompanyAdministrator({
    companyId,
    userId: target.id,
    isAdmin: true,
    expectedIsAdmin: false,
  });
  assert.equal(activated.success, true);
  assert.equal(activated.changed, true);
  assert.equal(activated.membership.role, "company_admin");
  assert.equal(activated.membership.canReadFeedback, false);
  pass("admin técnico ativa administrador sem conceder leitura");

  const technicalWorkspace = await technicalApi.workspace({ companyId });
  const technicalPerson = technicalWorkspace.people.find(
    person => person.id === target.id
  );
  assert(technicalPerson);
  assert.equal(technicalPerson.isCompanyAdmin, true);
  assert.equal(technicalPerson.eligible, false);
  assert.equal(technicalWorkspace.canReadContent, false);
  assert.deepEqual(technicalWorkspace.feedbacks, []);
  assert.deepEqual(technicalWorkspace.cycles, []);
  pass("admin ativado sem Persona concluído mantém conteúdo técnico vazio");

  const targetWorkspace = await targetApi.workspace();
  const targetPerson = targetWorkspace.people.find(
    person => person.id === target.id
  );
  assert(targetPerson);
  assert.equal(targetWorkspace.canReadContent, false);
  assert.equal(targetPerson.isCompanyAdmin, true);
  assert.equal(targetPerson.eligible, false);
  assert.equal(target.fluxusRole, "manager");
  pass(
    "membership de administrador mantém canRead false e papel Persona intacto"
  );

  const beforeNormalRole = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    )
    .orderBy(asc(feedbackMemberships.id));
  await denied(
    targetApi.setCompanyAdministrator({
      companyId,
      userId: target.id,
      isAdmin: false,
      expectedIsAdmin: true,
    }),
    "papel normal não chama a API administrativa",
    ["FORBIDDEN"]
  );
  const afterNormalRole = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    )
    .orderBy(asc(feedbackMemberships.id));
  assert.deepEqual(afterNormalRole, beforeNormalRole);
  pass("tentativa de papel normal não altera membership");

  const beforeStaleMemberships = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    )
    .orderBy(asc(feedbackMemberships.id));
  const beforeStaleAudits = await db
    .select({ id: fluxusAuditLogs.id })
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, companyId),
        eq(fluxusAuditLogs.subjectUserId, target.id)
      )
    );
  await denied(
    technicalApi.setCompanyAdministrator({
      companyId,
      userId: target.id,
      isAdmin: false,
      expectedIsAdmin: false,
    }),
    "expectedIsAdmin stale é rejeitado",
    ["CONFLICT"]
  );
  const afterStaleMemberships = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    )
    .orderBy(asc(feedbackMemberships.id));
  const afterStaleAudits = await db
    .select({ id: fluxusAuditLogs.id })
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, companyId),
        eq(fluxusAuditLogs.subjectUserId, target.id)
      )
    );
  assert.deepEqual(afterStaleMemberships, beforeStaleMemberships);
  assert.deepEqual(afterStaleAudits, beforeStaleAudits);
  pass("conflito de estado não produz mutação nem auditoria");

  const deactivated = await technicalApi.setCompanyAdministrator({
    companyId,
    userId: target.id,
    isAdmin: false,
    expectedIsAdmin: true,
  });
  assert.equal(deactivated.success, true);
  assert.equal(deactivated.changed, true);
  assert.equal(deactivated.membership.role, "collaborator");
  assert.equal(deactivated.membership.canReadFeedback, false);
  assert.equal(target.fluxusRole, "manager");
  pass("desativação cria collaborator sem alterar o papel Persona");

  const memberships = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    )
    .orderBy(asc(feedbackMemberships.startsAt), asc(feedbackMemberships.id));
  assert.equal(memberships.length, 3);
  assert.equal(memberships[0]!.role, "manager");
  assert(memberships[0]!.endsAt);
  assert.equal(memberships[1]!.role, "company_admin");
  assert(memberships[1]!.endsAt);
  assert.equal(memberships[2]!.role, "collaborator");
  assert.equal(memberships[2]!.canReadFeedback, false);
  assert(memberships[2]!.startsAt);
  assert(
    memberships[0]!.endsAt!.getTime() <= memberships[1]!.startsAt.getTime()
  );
  assert(
    memberships[1]!.endsAt!.getTime() <= memberships[2]!.startsAt.getTime()
  );
  const audits = await db
    .select()
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, companyId),
        eq(fluxusAuditLogs.subjectUserId, target.id)
      )
    )
    .orderBy(asc(fluxusAuditLogs.id));
  assert(
    audits.some(audit => audit.action === "feedback.company_admin.enable")
  );
  assert(
    audits.some(audit => audit.action === "feedback.company_admin.disable")
  );
  assert(
    audits.some(
      audit =>
        audit.action === "feedback.company_admin.enable" &&
        audit.metadata.previousRole === "manager"
    )
  );
  assert(audits.every(audit => audit.metadata.canReadFeedback === false));
  pass("histórico de timestamps e auditoria preservam os efeitos da troca");

  const beforeNoChange = {
    memberships: memberships.length,
    audits: audits.length,
  };
  const noChange = await technicalApi.setCompanyAdministrator({
    companyId,
    userId: target.id,
    isAdmin: false,
    expectedIsAdmin: false,
  });
  assert.equal(noChange.success, true);
  assert.equal(noChange.changed, false);
  const afterNoChangeMemberships = await db
    .select({ id: feedbackMemberships.id })
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, companyId),
        eq(feedbackMemberships.userId, target.id)
      )
    );
  const afterNoChangeAudits = await db
    .select({ id: fluxusAuditLogs.id })
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, companyId),
        eq(fluxusAuditLogs.subjectUserId, target.id)
      )
    );
  assert.equal(afterNoChangeMemberships.length, beforeNoChange.memberships);
  assert.equal(afterNoChangeAudits.length, beforeNoChange.audits);
  pass("estado já aplicado retorna sucesso sem novo histórico");

  await denied(
    technicalApi.setCompanyAdministrator({
      companyId,
      userId: inactiveTarget.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "conta alvo inativa é rejeitada",
    ["BAD_REQUEST"]
  );
  await denied(
    technicalApi.setCompanyAdministrator({
      companyId,
      userId: crossCompanyTarget.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "usuário de outra empresa é rejeitado",
    ["BAD_REQUEST"]
  );
  await denied(
    technicalApi.setCompanyAdministrator({
      companyId: inactiveCompany.id,
      userId: inactiveCompanyTarget.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "empresa inativa é rejeitada",
    ["FORBIDDEN"]
  );
  await denied(
    caller({
      ...technical,
      privacyDeletedAt: new Date(),
    }).setCompanyAdministrator({
      companyId,
      userId: target.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "conta técnica inativa é rejeitada",
    ["FORBIDDEN"]
  );
  pass("empresa, conta alvo, conta técnica e tenant incorretos são bloqueados");

  setFeedbackEnabledResolverForTests(() => false);
  await denied(
    technicalApi.setCompanyAdministrator({
      companyId,
      userId: target.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "flag desligada bloqueia a mutação",
    ["PRECONDITION_FAILED"]
  );
  await denied(
    anonymousApi.setCompanyAdministrator({
      companyId,
      userId: target.id,
      isAdmin: true,
      expectedIsAdmin: false,
    }),
    "usuário anônimo é bloqueado",
    ["UNAUTHORIZED", "FORBIDDEN"]
  );
  pass("flag off e anonimato não atravessam o endpoint");
} finally {
  setFeedbackEnabledResolverForTests(null);
  await db.$client.end({ timeout: 5 });
}

console.log(`Onboarding admin aprovado: ${assertions} verificações.`);
