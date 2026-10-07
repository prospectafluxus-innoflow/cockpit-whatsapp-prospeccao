import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { TrpcContext } from "../server/_core/context";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert(
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.pathname.startsWith("/persona_phase2_test"),
  "Somente banco local descartável."
);
assert.equal(process.env.FLUXUS_FEEDBACK_ENABLED, "true");
process.env.NODE_ENV = "test";
const fixture = JSON.parse(
  await readFile(
    process.env.FEEDBACK_TEST_FIXTURE_FILE ??
      "/tmp/persona-phase2-fixture.json",
    "utf8"
  )
) as {
  companyId: number;
  feedbackId: number;
  accounts: {
    technical: { email: string };
    admin: { email: string };
    manager: { email: string };
    participant: { email: string };
  };
};
const { db } = await import("../server/db");
const { users, fluxusCompanies, fluxusAssessments } = await import(
  "../drizzle/schema"
);
const { feedbackMemberships } = await import("../drizzle/feedbackSchema");
const { feedbackRouter } = await import("../server/routers/feedback");
const { eq, and, isNull } = await import("drizzle-orm");
const [admin] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.admin.email));
const [manager] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.manager.email));
const [participant] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.participant.email));
assert(admin && manager && participant);
function caller(user: typeof admin) {
  return feedbackRouter.createCaller({
    user,
    req: { headers: {} } as Request,
    res: {} as Response,
  } satisfies TrpcContext);
}
const adminApi = caller(admin),
  managerApi = caller(manager),
  ownApi = caller(participant);
let checks = 0;
function pass(label: string) {
  console.log(`OK ${++checks}: ${label}`);
}
async function denied(operation: Promise<unknown>, label: string) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ["FORBIDDEN", "NOT_FOUND", "PRECONDITION_FAILED", "CONFLICT"].includes(
        String(error.code)
      )
  );
  pass(label);
}
try {
  const [technical] = await db
    .select()
    .from(users)
    .where(eq(users.email, fixture.accounts.technical.email));
  assert(technical);
  await denied(
    caller(technical).setMembership({
      companyId: fixture.companyId,
      userId: manager.id,
      role: "manager",
      canReadFeedback: true,
    }),
    "admin técnico não concede leitura real por atalho de membership"
  );
  const evaluator = (await adminApi.workspace()).people.find(
    person => person.id === manager.id
  );
  assert(evaluator?.evaluatorEligible && !evaluator.eligible);
  pass("avaliador válido não precisa ter Persona próprio concluído");
  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: manager.id,
    role: "manager",
    canReadFeedback: false,
  });
  await denied(
    managerApi.get({ id: fixture.feedbackId }),
    "gestor sem permissão não lê nem o feedback que avaliou"
  );
  const limited = await managerApi.workspace();
  assert(limited.people.every(person => person.id === manager.id));
  assert.equal(limited.feedbacks.length, 0);
  pass("diretório restrito sem permissão de conteúdo");
  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: manager.id,
    role: "collaborator",
    canReadFeedback: true,
  });
  await denied(
    managerApi.get({ id: fixture.feedbackId }),
    "papel rebaixado não mantém acesso por autoria histórica"
  );
  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: manager.id,
    role: "manager",
    canReadFeedback: true,
  });
  const [membership] = await db
    .select()
    .from(feedbackMemberships)
    .where(
      and(
        eq(feedbackMemberships.companyId, fixture.companyId),
        eq(feedbackMemberships.userId, manager.id),
        isNull(feedbackMemberships.endsAt)
      )
    );
  assert(membership);
  await db
    .update(feedbackMemberships)
    .set({ startsAt: new Date(Date.now() + 86400000) })
    .where(eq(feedbackMemberships.id, membership.id));
  await denied(
    managerApi.get({ id: fixture.feedbackId }),
    "membership futuro não concede acesso atual"
  );
  assert.equal((await managerApi.workspace()).enabled, false);
  pass("membership ainda não vigente mantém onboarding");
  await db
    .update(feedbackMemberships)
    .set({ startsAt: membership.startsAt })
    .where(eq(feedbackMemberships.id, membership.id));

  const root = (
    await adminApi.createDepartment({
      companyId: fixture.companyId,
      name: `Raiz segurança ${randomUUID().slice(0, 8)}`,
    })
  ).department;
  const child = (
    await adminApi.createDepartment({
      companyId: fixture.companyId,
      name: "Subdepartamento segurança",
      parentId: root.id,
    })
  ).department;
  const [supermanager] = await db
    .insert(users)
    .values({
      companyId: fixture.companyId,
      accountType: "fluxus",
      name: "Supergestor de teste",
      email: `super-${randomUUID()}@persona-phase2.test`,
      approvalStatus: "approved",
      role: "user",
    })
    .returning();
  assert(supermanager);
  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: supermanager.id,
    role: "supermanager",
    canReadFeedback: true,
  });
  const superApi = caller(supermanager);
  await adminApi.assignEmployee({
    companyId: fixture.companyId,
    userId: participant.id,
    departmentId: root.id,
    managerUserId: manager.id,
  });
  await denied(
    superApi.get({ id: fixture.feedbackId }),
    "supergestor sem escopo não lê individual"
  );
  await adminApi.setManagementScope({
    companyId: fixture.companyId,
    userId: supermanager.id,
    departmentId: root.id,
    includeDescendants: false,
    active: true,
  });
  assert.equal(
    (await superApi.get({ id: fixture.feedbackId })).feedback.id,
    fixture.feedbackId
  );
  pass("escopo sem descendentes inclui o próprio departamento");
  await adminApi.assignEmployee({
    companyId: fixture.companyId,
    userId: participant.id,
    departmentId: child.id,
    managerUserId: manager.id,
  });
  await denied(
    superApi.get({ id: fixture.feedbackId }),
    "escopo sem descendentes não inclui subdepartamento"
  );
  await adminApi.setManagementScope({
    companyId: fixture.companyId,
    userId: supermanager.id,
    departmentId: root.id,
    includeDescendants: true,
    active: true,
  });
  assert.equal(
    (await superApi.get({ id: fixture.feedbackId })).feedback.id,
    fixture.feedbackId
  );
  pass("escopo explicitamente hierárquico inclui descendente");
  await adminApi.setManagementScope({
    companyId: fixture.companyId,
    userId: supermanager.id,
    departmentId: root.id,
    includeDescendants: true,
    active: false,
  });
  await denied(
    superApi.get({ id: fixture.feedbackId }),
    "revogação de escopo remove acesso sem alterar autoria"
  );

  await adminApi.assignEmployee({
    companyId: fixture.companyId,
    userId: participant.id,
    departmentId: child.id,
    managerUserId: supermanager.id,
  });
  await denied(
    managerApi.get({ id: fixture.feedbackId }),
    "troca de gestor remove leitura do autor histórico fora do escopo atual"
  );
  await adminApi.assignEmployee({
    companyId: fixture.companyId,
    userId: participant.id,
    departmentId: child.id,
    managerUserId: manager.id,
  });

  const planned = (
    await adminApi.createCycle({
      companyId: fixture.companyId,
      name: `Pré-liberação ${randomUUID().slice(0, 8)}`,
      startsOn: "2028-04-01",
      endsOn: "2028-06-30",
    })
  ).cycle;
  const added = await adminApi.addParticipants({
    cycleId: planned.id,
    participants: [{ userId: participant.id, evaluatorUserId: manager.id }],
  });
  const privateId = added.feedbacks[0]!.id;
  const referenceId = added.feedbacks[0]!.personaAssessmentId;
  const [reference] = await db
    .select()
    .from(fluxusAssessments)
    .where(eq(fluxusAssessments.id, referenceId));
  assert(reference);
  const versioning = await import("../shared/fluxusVersioning");
  const newTime = new Date();
  const newResult = versioning.calculateFluxusResultForVersion(
    reference.instrumentVersion,
    reference.answers,
    newTime
  );
  await db
    .insert(fluxusAssessments)
    .values({
      userId: participant.id,
      companyId: fixture.companyId,
      status: "completed",
      cycleNumber: reference.cycleNumber + 1,
      instrumentVersion: reference.instrumentVersion,
      formulaVersion: reference.formulaVersion,
      answers: reference.answers,
      result: newResult,
      completedAt: newTime,
    });
  await adminApi.transitionCycle({ id: planned.id, status: "active" });
  pass(
    "novo Persona válido não invalida a referência válida registrada no ciclo"
  );
  const race = await Promise.allSettled([
    managerApi.saveDraft({ id: privateId, revision: 0, items: [] }),
    managerApi.saveDraft({ id: privateId, revision: 0, items: [] }),
  ]);
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(race.filter(result => result.status === "rejected").length, 1);
  pass("salvamentos simultâneos da mesma revisão não sobrescrevem dados");
  const { exportReleasedFeedbackData } = await import(
    "../server/feedbackPrivacy"
  );
  const exported = await exportReleasedFeedbackData(
    participant.id,
    fixture.companyId
  );
  assert(
    exported.some(row => row.id === fixture.feedbackId) &&
      !exported.some(row => row.id === privateId)
  );
  pass("exportação pessoal inclui liberados e não expõe rascunho");

  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: participant.id,
    role: "hr",
    canReadFeedback: true,
  });
  await denied(
    ownApi.get({ id: privateId }),
    "participante RH não vê próprio rascunho antes da liberação"
  );
  await adminApi.setMembership({
    companyId: fixture.companyId,
    userId: participant.id,
    role: "collaborator",
    canReadFeedback: false,
  });
  await adminApi.transitionCycle({ id: planned.id, status: "cancelled" });

  await db
    .update(fluxusCompanies)
    .set({ active: 0 })
    .where(eq(fluxusCompanies.id, fixture.companyId));
  await denied(
    ownApi.get({ id: fixture.feedbackId }),
    "empresa inativa bloqueia leitura operacional"
  );
  await db
    .update(fluxusCompanies)
    .set({ active: 1 })
    .where(eq(fluxusCompanies.id, fixture.companyId));
  await db
    .update(users)
    .set({ approvalStatus: "rejected" })
    .where(eq(users.id, participant.id));
  await denied(
    ownApi.get({ id: fixture.feedbackId }),
    "conta revogada é revalidada no banco, não só no contexto"
  );
  await db
    .update(users)
    .set({ approvalStatus: "approved" })
    .where(eq(users.id, participant.id));
  console.log(
    `Regressões de segurança aprovadas: ${checks} verificações locais.`
  );
} finally {
  // Somente fixtures locais: restaurar disponibilidade, mesmo se um assert falhar.
  await db
    .update(fluxusCompanies)
    .set({ active: 1 })
    .where(eq(fluxusCompanies.id, fixture.companyId));
  await db
    .update(users)
    .set({ approvalStatus: "approved" })
    .where(eq(users.id, participant.id));
  await db.$client.end({ timeout: 5 });
}
