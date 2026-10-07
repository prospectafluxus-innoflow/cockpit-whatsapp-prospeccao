import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
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

const { db } = await import("../server/db");
const { users, fluxusCompanies, fluxusAssessments, fluxusAuditLogs } =
  await import("../drizzle/schema");
const { feedbackRevisions, feedbackEvaluations } = await import(
  "../drizzle/feedbackSchema"
);
const { feedbackRouter } = await import("../server/routers/feedback");
const { eq, and } = await import("drizzle-orm");
const versioning = await import("../shared/fluxusVersioning");
const { FEEDBACK_COMPETENCIES } = await import("../shared/feedback");
const bcrypt = await import("bcryptjs");
const suffix = randomUUID().slice(0, 8);
const password = randomUUID();
const passwordHash = await bcrypt.hash(password, 8);
let assertions = 0;
function pass(label: string) {
  assertions++;
  console.log(`OK ${assertions}: ${label}`);
}
async function denied(
  operation: Promise<unknown>,
  label: string,
  codes = [
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

try {
  const [company] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Teste EEC ${suffix}`,
      normalizedName: `teste-eec-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
    })
    .returning();
  const [otherCompany] = await db
    .insert(fluxusCompanies)
    .values({
      name: `Outra empresa ${suffix}`,
      normalizedName: `outra-${suffix}`,
      accessCodeHash: "test-only",
      active: 1,
    })
    .returning();
  async function createUser(
    label: string,
    companyId: number | null,
    platformAdmin = false
  ) {
    const [user] = await db
      .insert(users)
      .values({
        name: `Teste ${label}`,
        email: `${label}-${suffix}@persona-phase2.test`,
        passwordHash,
        accountType: companyId ? "fluxus" : "prospecting",
        companyId,
        approvalStatus: "approved",
        role: platformAdmin ? "admin" : "user",
        fluxusRole: "collaborator",
        jobTitle: "Função de teste",
      })
      .returning();
    return user!;
  }
  const tech = await createUser("tecnico", null, true);
  const admin = await createUser("administrador", company!.id);
  const manager = await createUser("gestor", company!.id);
  const otherManager = await createUser("gestor-outra-equipe", company!.id);
  const participant = await createUser("colaborador", company!.id);
  const pending = await createUser("persona-pendente", company!.id);
  const outsider = await createUser("outro-tenant", otherCompany!.id);
  function caller(user: typeof participant) {
    const ctx: TrpcContext = {
      user,
      req: { headers: {} } as Request,
      res: {} as Response,
    };
    return feedbackRouter.createCaller(ctx);
  }
  const technicalApi = caller(tech);
  const adminApi = caller(admin);
  const managerApi = caller(manager);
  const otherManagerApi = caller(otherManager);
  const collaboratorApi = caller(participant);
  const outsiderApi = caller(outsider);

  const initial = await adminApi.workspace();
  assert.equal(initial.enabled, false);
  pass("papel legado não concede acesso automaticamente");
  await technicalApi.bootstrapCompanyAdmin({
    companyId: company!.id,
    userId: admin.id,
  });
  assert.equal((await adminApi.workspace()).canReadContent, false);
  pass("bootstrap não concede leitura de conteúdo");
  for (const [person, role, read] of [
    [manager, "manager", true],
    [otherManager, "manager", true],
    [participant, "collaborator", false],
    [pending, "collaborator", false],
  ] as const) {
    await adminApi.setMembership({
      companyId: company!.id,
      userId: person.id,
      role,
      canReadFeedback: read,
    });
  }
  const department = (
    await adminApi.createDepartment({ companyId: company!.id, name: "Produto" })
  ).department;
  const secondDepartment = (
    await adminApi.createDepartment({
      companyId: company!.id,
      name: "Operações",
    })
  ).department;
  await adminApi.assignEmployee({
    companyId: company!.id,
    userId: participant.id,
    departmentId: department.id,
    managerUserId: manager.id,
    jobTitle: "Analista de teste",
  });
  await adminApi.assignEmployee({
    companyId: company!.id,
    userId: pending.id,
    departmentId: secondDepartment.id,
    managerUserId: otherManager.id,
  });
  await denied(
    adminApi.updateDepartment({
      id: department.id,
      name: "Produto",
      parentId: department.id,
      active: true,
    }),
    "hierarquia não aceita ciclos"
  );
  await denied(
    adminApi.assignEmployee({
      companyId: company!.id,
      userId: participant.id,
      departmentId: department.id,
      managerUserId: participant.id,
    }),
    "não aceita autogestão"
  );
  await denied(
    adminApi.updateSettings({
      companyId: company!.id,
      competencyIds: ["inventada"],
    }),
    "não aceita competências livres"
  );

  const completedAt = new Date();
  const answers = Object.fromEntries(
    versioning
      .getFluxusItemsForVersion(versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION)
      .map(item => [item.id, 4])
  );
  const result = versioning.calculateFluxusResultForVersion(
    versioning.CURRENT_FLUXUS_INSTRUMENT_VERSION,
    answers,
    completedAt
  );
  await db
    .insert(fluxusAssessments)
    .values({
      userId: participant.id,
      companyId: company!.id,
      status: "completed",
      instrumentVersion: result.instrumentVersion,
      formulaVersion: result.formulaVersion,
      answers,
      result,
      completedAt,
    });
  const settings = FEEDBACK_COMPETENCIES.map(item => item.id);
  await adminApi.updateSettings({
    companyId: company!.id,
    competencyIds: settings,
  });
  const cycle = (
    await adminApi.createCycle({
      companyId: company!.id,
      name: "C1",
      startsOn: "2027-01-01",
      endsOn: "2027-03-31",
    })
  ).cycle;
  await denied(
    adminApi.addParticipants({
      cycleId: cycle.id,
      participants: [{ userId: pending.id, evaluatorUserId: otherManager.id }],
    }),
    "Persona pendente não entra no ciclo"
  );
  await denied(
    adminApi.addParticipants({
      cycleId: cycle.id,
      participants: [
        { userId: participant.id, evaluatorUserId: otherManager.id },
      ],
    }),
    "avaliador fora da equipe é bloqueado"
  );
  await adminApi.addParticipants({
    cycleId: cycle.id,
    participants: [{ userId: participant.id, evaluatorUserId: manager.id }],
  });
  const metadataWorkspace = await adminApi.workspace();
  assert.equal(metadataWorkspace.feedbacks.length, 1);
  pass("administrador operacional vê participação sem abrir conteúdo");
  const id = metadataWorkspace.feedbacks[0]!.id;
  await denied(
    adminApi.get({ id }),
    "administrador sem permissão não lê conteúdo"
  );
  await denied(technicalApi.get({ id }), "admin técnico não bypassa conteúdo");
  await denied(outsiderApi.get({ id }), "isolamento entre empresas na leitura");
  await denied(collaboratorApi.get({ id }), "rascunho oculto ao colaborador");
  await adminApi.transitionCycle({ id: cycle.id, status: "active" });
  await denied(
    adminApi.removeParticipant({ cycleId: cycle.id, userId: participant.id }),
    "participantes de ciclo ativo não são removidos"
  );
  const blankItems = cycle.competencySnapshot.map(item => ({
    competencyId: item.id,
    score: null,
    evidence: "",
    effect: "",
    advice: "",
    notes: "",
  }));
  const savedBlank = await managerApi.saveDraft({
    id,
    revision: 0,
    items: blankItems,
  });
  await denied(
    managerApi.transition({
      id,
      revision: savedBlank.revision,
      status: "completed",
    }),
    "conclusão exige notas e EEC"
  );
  await denied(
    managerApi.saveDraft({ id, revision: 0, items: blankItems }),
    "revision obsoleta não sobrescreve rascunho"
  );
  function eec(score: number) {
    return cycle.competencySnapshot.map(item => ({
      competencyId: item.id,
      score,
      evidence: "Entrega observada no período acordado.",
      effect: "A equipe manteve o prazo combinado.",
      advice: "Manter a prática e alinhar prioridades no início da semana.",
      notes: "Contexto de teste, sem avaliação de pessoa real.",
    }));
  }
  const saved = await managerApi.saveDraft({
    id,
    revision: savedBlank.revision,
    items: eec(5),
  });
  const complete = await managerApi.transition({
    id,
    revision: saved.revision,
    status: "completed",
  });
  await denied(
    managerApi.transition({
      id,
      revision: complete.revision,
      status: "released",
    }),
    "não pode liberar sem devolutiva"
  );
  await denied(collaboratorApi.get({ id }), "concluir não libera feedback");
  const debrief = await managerApi.transition({
    id,
    revision: complete.revision,
    status: "debriefed",
  });
  const released = await managerApi.transition({
    id,
    revision: debrief.revision,
    status: "released",
  });
  await denied(
    managerApi.transition({
      id,
      revision: released.revision,
      status: "acknowledged",
    }),
    "gestor não registra ciência do colaborador"
  );
  const own = await collaboratorApi.get({ id });
  assert(own.feedback.firstViewedAt);
  assert.equal(own.feedback.acknowledgedAt, null);
  assert.equal(own.calculation.expected, settings.length * 5);
  pass("primeira visualização é separada da ciência e cálculo é correto");
  await collaboratorApi.comment({
    id,
    comment: "Quero contextualizar uma entrega; registro de teste.",
  });
  const acknowledged = await collaboratorApi.transition({
    id,
    revision: released.revision,
    status: "acknowledged",
  });
  const corrected = await managerApi.correct({
    id,
    revision: acknowledged.revision,
    reason: "Complementar contexto observado.",
    items: eec(5),
  });
  assert.equal(corrected.feedback.status, "completed");
  assert.equal(corrected.feedback.acknowledgedAt, null);
  assert.equal(corrected.feedback.firstViewedAt, null);
  pass("correção reinicia devolutiva, acesso e ciência");
  await denied(
    managerApi.transition({
      id,
      revision: corrected.revision,
      status: "released",
    }),
    "correção não libera sem nova devolutiva"
  );
  await denied(
    collaboratorApi.get({ id }),
    "novos itens da correção ficam ocultos até liberação"
  );
  assert.equal((await collaboratorApi.workspace()).pendingCorrections, 1);
  pass("colaborador recebe aviso sem novos itens da correção");
  const revisions = await db
    .select()
    .from(feedbackRevisions)
    .where(eq(feedbackRevisions.feedbackId, id));
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0]!.previousStatus, "acknowledged");
  assert(revisions[0]!.previousMetadata.acknowledgedAt);
  pass("revisão anterior e ciência estão preservadas");
  const renewedDebrief = await managerApi.transition({
    id,
    revision: corrected.revision,
    status: "debriefed",
  });
  const renewedRelease = await managerApi.transition({
    id,
    revision: renewedDebrief.revision,
    status: "released",
  });
  const renewedAck = await collaboratorApi.transition({
    id,
    revision: renewedRelease.revision,
    status: "acknowledged",
  });
  await managerApi.transition({
    id,
    revision: renewedAck.revision,
    status: "closed",
  });
  await adminApi.transitionCycle({ id: cycle.id, status: "closed" });
  pass(
    "ciclo completo: rascunho até encerramento com devolutiva e ciência explícitas"
  );

  // Quatro ciclos trimestrais, sem inventar uma quinta avaliação consolidada.
  for (const quarter of [2, 3, 4]) {
    const month = quarter * 3 - 2;
    const startsOn = `2027-${String(month).padStart(2, "0")}-01`;
    const endsOn = `2027-${String(quarter * 3).padStart(2, "0")}-${quarter === 2 || quarter === 3 ? "30" : "31"}`;
    const next = (
      await adminApi.createCycle({
        companyId: company!.id,
        name: `C${quarter}`,
        startsOn,
        endsOn,
      })
    ).cycle;
    const additions = await adminApi.addParticipants({
      cycleId: next.id,
      participants: [{ userId: participant.id, evaluatorUserId: manager.id }],
    });
    const nextId = additions.feedbacks[0]!.id;
    await adminApi.transitionCycle({ id: next.id, status: "active" });
    let current = await managerApi.saveDraft({
      id: nextId,
      revision: 0,
      items: eec(5),
    });
    for (const status of ["completed", "debriefed", "released"] as const)
      current = await managerApi.transition({
        id: nextId,
        revision: current.revision,
        status,
      });
    const ack = await collaboratorApi.transition({
      id: nextId,
      revision: current.revision,
      status: "acknowledged",
    });
    await managerApi.transition({
      id: nextId,
      revision: ack.revision,
      status: "closed",
    });
    await adminApi.transitionCycle({ id: next.id, status: "closed" });
  }
  const history = await collaboratorApi.history({ year: 2027 });
  assert.equal(history.consolidation.completedCycles, 4);
  assert.equal(history.consolidation.obtained, settings.length * 5 * 4);
  assert.equal(history.consolidation.comparable, true);
  assert.equal(history.consolidation.partial, false);
  pass("histórico real consolida os quatro ciclos e suas evidências");
  await denied(
    otherManagerApi.history({ participantUserId: participant.id, year: 2027 }),
    "histórico bloqueado fora do escopo"
  );
  await adminApi.updateSettings({
    companyId: company!.id,
    competencyIds: settings.slice(0, 6),
  });
  const future = (
    await adminApi.createCycle({
      companyId: company!.id,
      name: "Modelo futuro",
      startsOn: "2028-01-01",
      endsOn: "2028-03-31",
    })
  ).cycle;
  assert.equal(future.competencySnapshot.length, 6);
  assert.equal(
    (await managerApi.get({ id })).cycle.competencySnapshot.length,
    10
  );
  pass("nova seleção não reescreve competências de ciclos anteriores");
  await adminApi.transitionCycle({ id: future.id, status: "cancelled" });
  const plain = JSON.stringify(await managerApi.workspace());
  assert(
    !plain.includes("passwordHash") &&
      !plain.includes('"answers"') &&
      !plain.includes('"result"')
  );
  pass("workspace não retorna credenciais nem conteúdo Persona");
  const audit = await db
    .select({ action: fluxusAuditLogs.action })
    .from(fluxusAuditLogs)
    .where(
      and(
        eq(fluxusAuditLogs.companyId, company!.id),
        eq(fluxusAuditLogs.resourceType, "feedback_evaluation")
      )
    );
  assert(
    audit.some(row => row.action === "feedback.correct") &&
      audit.some(row => row.action === "feedback.transition.acknowledged")
  );
  pass("trilha de auditoria existe no fluxo integrado");
  await writeFile(
    process.env.FEEDBACK_TEST_FIXTURE_FILE ??
      "/tmp/persona-phase2-fixture.json",
    JSON.stringify({
      companyId: company!.id,
      cycleId: cycle.id,
      feedbackId: id,
      year: 2027,
      accounts: {
        technical: { email: tech.email, password },
        admin: { email: admin.email, password },
        manager: { email: manager.email, password },
        participant: { email: participant.email, password },
      },
    }),
    { mode: 0o600 }
  );
  console.log(
    `Fluxo integrado aprovado: ${assertions} verificações. Fixtures exclusivamente locais preservadas para inspeção visual.`
  );
} finally {
  await db.$client.end({ timeout: 5 });
}
