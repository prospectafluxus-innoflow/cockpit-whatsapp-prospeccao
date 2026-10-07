import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.pathname.startsWith("/persona_phase2_test"),
  "Somente PostgreSQL local descartável."
);
assert.equal(process.env.FLUXUS_FEEDBACK_ENABLED, "true");
process.env.NODE_ENV = "test";
const fixture = JSON.parse(
  await readFile(
    process.env.FEEDBACK_TEST_FIXTURE_FILE ??
      "/tmp/persona-phase2-fixture.json",
    "utf8"
  )
);
const { db } = await import("../server/db");
const { users, fluxusCompanies, fluxusAuditLogs } = await import(
  "../drizzle/schema"
);
const { feedbackMemberships } = await import("../drizzle/feedbackSchema");
const { eq } = await import("drizzle-orm");
const { feedbackRouter } = await import("../server/routers/feedback");
const { setFeedbackEnabledResolverForTests } = await import(
  "../server/feedbackDb"
);
const [technical] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.technical.email))
  .limit(1);
assert(technical);
const caller = (user: TrpcContext["user"]) =>
  feedbackRouter.createCaller({
    user,
    req: { headers: {} } as Request,
    res: {} as Response,
  });
const api = caller(technical);
const suffix = randomUUID().slice(0, 8);
let assertions = 0;
const pass = (label: string) => console.log(`OK ${++assertions}: ${label}`);
const denied = async (operation: Promise<unknown>, code: string) =>
  assert.rejects(
    operation,
    e => typeof e === "object" && e !== null && "code" in e && e.code === code
  );
const createCompany = async (active: number) => {
  const [c] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Diretório ${suffix}-${active}`,
      normalizedName: `directory-${suffix}-${active}`,
      accessCodeHash: "test-only",
      active,
    })
    .returning();
  assert(c);
  return c;
};
const company = await createCompany(1);
const inactiveCompany = await createCompany(0);
const createUser = async (
  label: string,
  approvalStatus: "approved" | "pending" = "approved",
  companyId = company.id
) => {
  const [u] = await db
    .insert(users)
    .values({
      name: `Teste diretório ${label}`,
      email: `directory-${label}-${suffix}@persona-phase2.test`,
      role: "user",
      accountType: "fluxus",
      companyId,
      approvalStatus,
      fluxusRole: "manager",
    })
    .returning();
  assert(u);
  return u;
};
const regular = await createUser("regular");
const admin = await createUser("admin");
const expired = await createUser("expired");
const future = await createUser("future");
const pending = await createUser("pending", "pending");
const cross = await createUser("cross", "approved", fixture.companyId);
const now = Date.now();
await db.insert(feedbackMemberships).values([
  {
    companyId: company.id,
    userId: admin.id,
    role: "company_admin",
    canReadFeedback: false,
    createdBy: technical.id,
    startsAt: new Date(now - 10_000),
    endsAt: null,
  },
  {
    companyId: company.id,
    userId: expired.id,
    role: "company_admin",
    canReadFeedback: false,
    createdBy: technical.id,
    startsAt: new Date(now - 20_000),
    endsAt: new Date(now - 15_000),
  },
  {
    companyId: company.id,
    userId: future.id,
    role: "company_admin",
    canReadFeedback: false,
    createdBy: technical.id,
    startsAt: new Date(now + 86_400_000),
    endsAt: null,
  },
]);
try {
  const beforeMembers = await db
    .select({ id: feedbackMemberships.id })
    .from(feedbackMemberships)
    .where(eq(feedbackMemberships.companyId, company.id));
  const beforeAudits = await db
    .select({ id: fluxusAuditLogs.id })
    .from(fluxusAuditLogs)
    .where(eq(fluxusAuditLogs.companyId, company.id));
  const result = await api.companyAdministratorDirectory({
    companyId: company.id,
  });
  assert.equal(result.enabled, true);
  assert.equal(result.companyId, company.id);
  assert.deepEqual(Object.keys(result).sort(), [
    "companyId",
    "enabled",
    "people",
  ]);
  assert(
    result.people.every(
      p => Object.keys(p).sort().join(",") === "id,isCompanyAdmin"
    )
  );
  pass(
    "retorna somente empresa, habilitação e IDs/estado, sem conteúdo ou análises"
  );
  assert.equal(
    result.people.find(p => p.id === regular.id)?.isCompanyAdmin,
    false
  );
  assert.equal(
    result.people.find(p => p.id === admin.id)?.isCompanyAdmin,
    true
  );
  pass(
    "funciona com empresa sem ciclos e usuários sem Persona, sem assumir admin"
  );
  assert.equal(
    result.people.find(p => p.id === expired.id)?.isCompanyAdmin,
    false
  );
  assert.equal(
    result.people.find(p => p.id === future.id)?.isCompanyAdmin,
    false
  );
  pass("admin encerrado e futuro não contam como vigente");
  assert(!result.people.some(p => p.id === pending.id || p.id === cross.id));
  pass("filtra conta pendente e pessoa de outra empresa");
  await denied(
    caller(admin).companyAdministratorDirectory({ companyId: company.id }),
    "FORBIDDEN"
  );
  await denied(
    caller(null).companyAdministratorDirectory({ companyId: company.id }),
    "FORBIDDEN"
  );
  pass("administrador empresarial e anônimo não recebem o diretório técnico");
  await denied(
    api.companyAdministratorDirectory({ companyId: inactiveCompany.id }),
    "FORBIDDEN"
  );
  await denied(
    caller({
      ...technical,
      privacyDeletedAt: new Date(),
    }).companyAdministratorDirectory({ companyId: company.id }),
    "FORBIDDEN"
  );
  pass("empresa inativa e conta técnica inativa são bloqueadas");
  const afterMembers = await db
    .select({ id: feedbackMemberships.id })
    .from(feedbackMemberships)
    .where(eq(feedbackMemberships.companyId, company.id));
  const afterAudits = await db
    .select({ id: fluxusAuditLogs.id })
    .from(fluxusAuditLogs)
    .where(eq(fluxusAuditLogs.companyId, company.id));
  assert.deepEqual(afterMembers, beforeMembers);
  assert.deepEqual(afterAudits, beforeAudits);
  pass("consultar não cria vínculo nem auditoria de mudança de acesso");
  setFeedbackEnabledResolverForTests(() => false);
  const disabled = await api.companyAdministratorDirectory({
    companyId: company.id,
  });
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.people, []);
  pass("flag desligada retorna indisponibilidade sem dados de papéis");
  await denied(
    api.companyAdministratorDirectory({ companyId: inactiveCompany.id }),
    "FORBIDDEN"
  );
  await denied(
    api.companyAdministratorDirectory({ companyId: 2_000_000_000 }),
    "NOT_FOUND"
  );
  pass("flag desligada não ignora empresa inativa ou inexistente");
} finally {
  setFeedbackEnabledResolverForTests(null);
  await db.$client.end({ timeout: 5 });
}
console.log(`Diretório administrativo aprovado: ${assertions} verificações.`);
