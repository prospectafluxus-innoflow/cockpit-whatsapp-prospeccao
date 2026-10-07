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
) as { companyId: number; accounts: { technical: { email: string } } };
const { db } = await import("../server/db");
const { users, fluxusAuditLogs } = await import("../drizzle/schema");
const { feedbackMemberships } = await import("../drizzle/feedbackSchema");
const { feedbackRouter } = await import("../server/routers/feedback");
const { eq } = await import("drizzle-orm");
const [technical] = await db
  .select()
  .from(users)
  .where(eq(users.email, fixture.accounts.technical.email))
  .limit(1);
assert(technical);
const api = feedbackRouter.createCaller({
  user: technical,
  req: { headers: {} } as Request,
  res: {} as Response,
} satisfies TrpcContext);
try {
  for (const role of ["manager", "supermanager", "hr"] as const) {
    const [person] = await db
      .insert(users)
      .values({
        companyId: fixture.companyId,
        accountType: "fluxus",
        name: "No-op de teste",
        email: `noop-${randomUUID()}@persona-phase2.test`,
        approvalStatus: "approved",
        role: "user",
        fluxusRole: "manager",
      })
      .returning();
    assert(person);
    await db
      .insert(feedbackMemberships)
      .values({
        companyId: fixture.companyId,
        userId: person.id,
        role,
        canReadFeedback: true,
        startsAt: new Date(Date.now() - 1000),
        endsAt: null,
        createdBy: technical.id,
      });
    const before = await db
      .select()
      .from(feedbackMemberships)
      .where(eq(feedbackMemberships.userId, person.id));
    const result = await api.setCompanyAdministrator({
      companyId: fixture.companyId,
      userId: person.id,
      isAdmin: false,
      expectedIsAdmin: false,
    });
    assert.equal(result.changed, false);
    assert.equal(result.membership?.role, role);
    assert.equal(result.membership?.canReadFeedback, true);
    const after = await db
      .select()
      .from(feedbackMemberships)
      .where(eq(feedbackMemberships.userId, person.id));
    assert.deepEqual(after, before);
    const audits = await db
      .select({ id: fluxusAuditLogs.id })
      .from(fluxusAuditLogs)
      .where(eq(fluxusAuditLogs.subjectUserId, person.id));
    assert.equal(audits.length, 0);
    const [profile] = await db
      .select({ fluxusRole: users.fluxusRole })
      .from(users)
      .where(eq(users.id, person.id))
      .limit(1);
    assert.equal(profile?.fluxusRole, "manager");
    console.log(
      `OK: ${role} preservado, incluindo leitura, histórico, perfil Persona e ausência de auditoria de alteração.`
    );
  }
} finally {
  await db.$client.end({ timeout: 5 });
}
