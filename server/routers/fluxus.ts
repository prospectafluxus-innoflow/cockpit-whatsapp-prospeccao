import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  FLUXUS_DIMENSIONS,
  FLUXUS_FORMULA_VERSION,
  FLUXUS_INSTRUMENT_VERSION,
  calculateFluxusResult,
  getFluxusCompletion,
  sanitizeFluxusAnswers,
} from "../../shared/fluxus";
import { canAccessFluxusIndividualReport } from "../../shared/fluxusAccess";
import { createUser, getUserByEmail, getUserById, updateUser } from "../db";
import {
  completeFluxusAssessment,
  createFluxusCompany,
  createFluxusPrivacyRequest,
  getFluxusDebrief,
  getFluxusAssessmentById,
  getFluxusCompanyById,
  getFluxusCompanyByNormalizedName,
  getFluxusCompanyDashboard,
  getFluxusPlatformOverview,
  getOrCreateFluxusAssessment,
  listFluxusAssessmentsForUser,
  listFluxusAuditLogs,
  listFluxusConsents,
  listFluxusPrivacyRequests,
  normalizeCompanyName,
  recordFluxusAudit,
  recordFluxusConsent,
  revokeLatestFluxusConsent,
  saveFluxusAnswers,
  setFluxusUserRole,
  startNewFluxusAssessment,
  setFluxusCompanyActive,
  updateFluxusCompanyCode,
  updateFluxusCompanyGovernance,
  upsertFluxusDebrief,
} from "../fluxusDb";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";

const answersSchema = z.record(
  z.string().max(20),
  z.number().int().min(1).max(7)
);

const FLUXUS_PRIVACY_NOTICE_VERSION = "2026-09-01";

function hashRequestIp(req: { ip?: string; headers: Record<string, unknown> }) {
  const raw = String(req.ip || req.headers["x-forwarded-for"] || "unknown");
  const salt = process.env.SESSION_SECRET || "fluxus-audit";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex");
}

function safeCompany(company: Awaited<ReturnType<typeof getFluxusCompanyById>>) {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    active: company.active,
    reportVisibility: company.reportVisibility,
    minimumAggregateSize: company.minimumAggregateSize,
    retentionMonths: company.retentionMonths,
    processingPurpose: company.processingPurpose,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

function requireFluxusOrganizationAccess(user: {
  accountType?: string | null;
  companyId?: number | null;
  fluxusRole?: string | null;
}) {
  requireFluxusAccount(user);
  if (user.fluxusRole !== "manager" && user.fluxusRole !== "hr") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à gestão autorizada da empresa." });
  }
}

async function requireIndividualReportAccess(
  user: {
    id: number;
    role?: string | null;
    accountType?: string | null;
    companyId?: number | null;
    fluxusRole?: string | null;
  },
  companyId: number
) {
  const company = await getFluxusCompanyById(companyId);
  if (!company)
    throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });

  if (
    !canAccessFluxusIndividualReport(
      user,
      company.reportVisibility,
      companyId
    )
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A política de visibilidade da empresa não autoriza este acesso.",
    });
  }
  return company;
}

function groupSizeBand(value: number) {
  if (value < 5) return "insuficiente";
  if (value < 10) return "5–9";
  if (value < 20) return "10–19";
  if (value < 50) return "20–49";
  return "50+";
}

function cycleSummary(assessment: Awaited<ReturnType<typeof getFluxusAssessmentById>> extends infer T ? NonNullable<T> : never) {
  return {
    id: assessment.id,
    cycleNumber: assessment.cycleNumber,
    cycleLabel: assessment.cycleLabel,
    status: assessment.status,
    startedAt: assessment.startedAt,
    completedAt: assessment.completedAt,
    instrumentVersion: assessment.instrumentVersion,
    formulaVersion: assessment.formulaVersion,
    revision: assessment.revision,
    completion: getFluxusCompletion(assessment.answers),
    predominant: assessment.result?.predominante ?? null,
  };
}

function requireFluxusAccount(user: {
  accountType?: string | null;
  companyId?: number | null;
}) {
  if (user.accountType !== "fluxus" || !user.companyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Esta área é exclusiva para colaboradores vinculados à Fluxus Persona.",
    });
  }
}

function makeAccessCodeHint(code: string) {
  const compact = code.replace(/\s/g, "").toUpperCase();
  return compact.length <= 4 ? compact : `••••${compact.slice(-4)}`;
}

export const fluxusRouter = router({
  registerCollaborator: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(180),
        email: z.string().trim().toLowerCase().email().max(320),
        password: z
          .string()
          .min(8, "A senha deve ter ao menos 8 caracteres")
          .max(128),
        companyName: z.string().trim().min(2).max(255),
        companyCode: z.string().trim().min(4).max(64),
        jobTitle: z.string().trim().min(2).max(180),
        department: z.string().trim().max(180).optional(),
        privacyAccepted: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este e-mail já está cadastrado.",
        });
      }

      const normalizedName = normalizeCompanyName(input.companyName);
      const company = await getFluxusCompanyByNormalizedName(normalizedName);
      if (!company || company.active !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Empresa ou código de acesso inválido. Confira os dados recebidos da InnoFlow.",
        });
      }

      const validCompanyCode = await bcrypt.compare(
        input.companyCode.trim(),
        company.accessCodeHash
      );
      if (!validCompanyCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Empresa ou código de acesso inválido. Confira os dados recebidos da InnoFlow.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await createUser({
        name: input.name,
        email: input.email,
        passwordHash,
        loginMethod: "email",
        role: "user",
        accountType: "fluxus",
        companyId: company.id,
        jobTitle: input.jobTitle,
        department: input.department || null,
        approvalStatus: "approved",
        lastSignedIn: new Date(),
      });

      await getOrCreateFluxusAssessment(user.id, company.id);
      await recordFluxusConsent({
        userId: user.id,
        companyId: company.id,
        noticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION,
        purpose: company.processingPurpose,
        source: "registration",
        ipHash: hashRequestIp(ctx.req),
        userAgent: createHash("sha256")
          .update(ctx.req.get("user-agent") || "unknown")
          .digest("hex"),
      });
      await recordFluxusAudit({ actorUserId: user.id, subjectUserId: user.id, companyId: company.id, action: "consent.accept", resourceType: "privacy_notice", metadata: { noticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION } });
      return { success: true, name: user.name, companyName: company.name };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const assessment = await getOrCreateFluxusAssessment(
      ctx.user.id,
      ctx.user.companyId!
    );
    const [company, history] = await Promise.all([
      getFluxusCompanyById(ctx.user.companyId!),
      listFluxusAssessmentsForUser(ctx.user.id),
    ]);
    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        jobTitle: ctx.user.jobTitle,
        department: ctx.user.department,
        fluxusRole: ctx.user.fluxusRole,
      },
      company: safeCompany(company),
      assessment: {
        id: assessment.id,
        cycleNumber: assessment.cycleNumber,
        cycleLabel: assessment.cycleLabel,
        revision: assessment.revision,
        status: assessment.status,
        answers: assessment.answers,
        result: assessment.result,
        instrumentVersion: assessment.instrumentVersion,
        formulaVersion: assessment.formulaVersion,
        completion: getFluxusCompletion(assessment.answers),
      },
      history: history.map(cycleSummary),
      canStartNewCycle: assessment.status === "completed",
      privacyNoticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION,
    };
  }),

  saveDraft: protectedProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        answers: answersSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const current = await getOrCreateFluxusAssessment(
        ctx.user.id,
        ctx.user.companyId!
      );
      if (current.id !== input.assessmentId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Avaliação não pertence ao usuário autenticado.",
        });
      }
      if (current.status === "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta avaliação já foi concluída.",
        });
      }

      const answers = sanitizeFluxusAnswers(input.answers);
      const assessment = await saveFluxusAnswers(
        current.id,
        ctx.user.id,
        answers
      );
      if (!assessment)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Avaliação não encontrada.",
        });
      return { success: true, revision: assessment.revision, completion: getFluxusCompletion(answers) };
    }),

  complete: protectedProcedure
    .input(
      z.object({
        assessmentId: z.number().int().positive(),
        answers: answersSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const current = await getOrCreateFluxusAssessment(
        ctx.user.id,
        ctx.user.companyId!
      );
      if (current.id !== input.assessmentId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Avaliação não pertence ao usuário autenticado.",
        });
      }
      if (current.status === "completed" && current.result)
        return { success: true, result: current.result };

      const answers = sanitizeFluxusAnswers(input.answers);
      const completion = getFluxusCompletion(answers);
      if (completion.completed !== completion.total) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Complete todas as perguntas. Ainda faltam ${completion.total - completion.completed} respostas.`,
        });
      }

      const result = calculateFluxusResult(answers);
      const assessment = await completeFluxusAssessment(
        current.id,
        ctx.user.id,
        answers,
        result
      );
      if (!assessment)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Avaliação não encontrada.",
        });
      return { success: true, result };
    }),

  startNewCycle: protectedProcedure
    .input(z.object({ cycleLabel: z.string().trim().max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const assessment = await startNewFluxusAssessment(
        ctx.user.id,
        ctx.user.companyId!,
        input.cycleLabel
      );
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: ctx.user.id, companyId: ctx.user.companyId!, assessmentId: assessment.id, action: "assessment.cycle_start", resourceType: "assessment" });
      return { assessment: cycleSummary(assessment), answers: assessment.answers };
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const history = await listFluxusAssessmentsForUser(ctx.user.id);
    return history.map(cycleSummary);
  }),

  compareMyAssessments: protectedProcedure
    .input(
      z.object({
        baselineAssessmentId: z.number().int().positive(),
        currentAssessmentId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const [baseline, current] = await Promise.all([
        getFluxusAssessmentById(input.baselineAssessmentId),
        getFluxusAssessmentById(input.currentAssessmentId),
      ]);
      const valid = [baseline, current].every(
        item =>
          item &&
          item.userId === ctx.user.id &&
          item.companyId === ctx.user.companyId &&
          item.status === "completed" &&
          item.result
      );
      if (!valid || !baseline?.result || !current?.result)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ciclos concluídos não encontrados.",
        });
      const comparable =
        baseline.instrumentVersion === current.instrumentVersion &&
        baseline.formulaVersion === current.formulaVersion;
      return {
        comparable,
        baseline: cycleSummary(baseline),
        current: cycleSummary(current),
        dimensions: FLUXUS_DIMENSIONS.map(dimension => ({
          dimension,
          baseline: baseline.result!.dimensions[dimension].natural,
          current: current.result!.dimensions[dimension].natural,
          delta:
            Math.round(
              (current.result!.dimensions[dimension].natural -
                baseline.result!.dimensions[dimension].natural) *
                100
            ) / 100,
        })),
      };
    }),

  myAssessment: protectedProcedure
    .input(z.object({ assessmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const assessment = await getFluxusAssessmentById(input.assessmentId);
      if (!assessment || assessment.userId !== ctx.user.id || assessment.companyId !== ctx.user.companyId) throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada." });
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: ctx.user.id, companyId: ctx.user.companyId!, assessmentId: assessment.id, action: "assessment.read_self", resourceType: "assessment", ipHash: hashRequestIp(ctx.req) });
      return { assessment: { ...cycleSummary(assessment), answers: assessment.answers, result: assessment.result } };
    }),

  privacyCenter: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const [company, consents, requests, history] = await Promise.all([
      getFluxusCompanyById(ctx.user.companyId!),
      listFluxusConsents(ctx.user.id),
      listFluxusPrivacyRequests(ctx.user.id),
      listFluxusAssessmentsForUser(ctx.user.id),
    ]);
    return {
      noticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION,
      company: safeCompany(company),
      consents,
      requests,
      dataSummary: { assessments: history.length, completedAssessments: history.filter(item => item.status === "completed").length },
      sharing: [company?.name].filter(Boolean),
    };
  }),

  acceptCurrentPrivacyNotice: protectedProcedure.mutation(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const company = await getFluxusCompanyById(ctx.user.companyId!);
    if (!company)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Empresa não encontrada.",
      });
    const consent = await recordFluxusConsent({
      userId: ctx.user.id,
      companyId: company.id,
      noticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION,
      purpose: company.processingPurpose,
      source: "privacy_center",
      ipHash: hashRequestIp(ctx.req),
      userAgent: createHash("sha256")
        .update(ctx.req.get("user-agent") || "unknown")
        .digest("hex"),
    });
    await recordFluxusAudit({
      actorUserId: ctx.user.id,
      subjectUserId: ctx.user.id,
      companyId: company.id,
      action: "consent.accept",
      resourceType: "privacy_notice",
      metadata: { noticeVersion: FLUXUS_PRIVACY_NOTICE_VERSION },
      ipHash: hashRequestIp(ctx.req),
    });
    return { success: true, consentId: consent.id };
  }),

  requestPrivacyAction: protectedProcedure
    .input(z.object({ type: z.enum(["access", "correction", "deletion", "revocation"]), details: z.string().trim().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      const request = await createFluxusPrivacyRequest({ userId: ctx.user.id, companyId: ctx.user.companyId!, type: input.type, details: input.details || null });
      if (input.type === "revocation") await revokeLatestFluxusConsent(ctx.user.id);
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: ctx.user.id, companyId: ctx.user.companyId!, action: `privacy.${input.type}`, resourceType: "privacy_request", metadata: { requestId: request.id }, ipHash: hashRequestIp(ctx.req) });
      return { success: true, protocol: `FLX-${request.id.toString().padStart(6, "0")}`, status: request.status };
    }),

  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const [company, consents, requests, assessments] = await Promise.all([
      getFluxusCompanyById(ctx.user.companyId!),
      listFluxusConsents(ctx.user.id),
      listFluxusPrivacyRequests(ctx.user.id),
      listFluxusAssessmentsForUser(ctx.user.id),
    ]);
    await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: ctx.user.id, companyId: ctx.user.companyId!, action: "privacy.export", resourceType: "data_package", ipHash: hashRequestIp(ctx.req) });
    return {
      exportedAt: new Date().toISOString(),
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, jobTitle: ctx.user.jobTitle, department: ctx.user.department },
      company: safeCompany(company),
      consents,
      privacyRequests: requests,
      assessments: assessments.map(item => ({ ...cycleSummary(item), answers: item.answers, result: item.result })),
    };
  }),

  teamDashboard: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusOrganizationAccess(ctx.user);
    const dashboard = await getFluxusCompanyDashboard(ctx.user.companyId!);
    if (!dashboard) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
    await recordFluxusAudit({ actorUserId: ctx.user.id, companyId: ctx.user.companyId!, action: "dashboard.aggregate_read", resourceType: "company_dashboard", metadata: { released: dashboard.summary.canAggregate, minimum: Math.max(5, dashboard.company.minimumAggregateSize) }, ipHash: hashRequestIp(ctx.req) });
    return {
      company: safeCompany(dashboard.company),
      viewerRole: ctx.user.fluxusRole,
      privacy: { released: dashboard.summary.canAggregate, minimumRespondents: Math.max(5, dashboard.company.minimumAggregateSize), explanation: dashboard.summary.canAggregate ? "Métricas agregadas liberadas." : "Dados insuficientes para exibição agregada." },
      summary: dashboard.summary.canAggregate ? { completedBand: groupSizeBand(dashboard.summary.completed), completionRate: Math.round(dashboard.summary.completionRate / 5) * 5, averages: dashboard.summary.averages } : null,
    };
  }),

  individualReportDirectory: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusOrganizationAccess(ctx.user);
    await requireIndividualReportAccess(ctx.user, ctx.user.companyId!);
    const dashboard = await getFluxusCompanyDashboard(ctx.user.companyId!);
    if (!dashboard)
      throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
    return dashboard.people
      .filter(person => person.assessmentStatus === "completed" && person.assessmentId)
      .map(person => ({
        id: person.id,
        name: person.name,
        jobTitle: person.jobTitle,
        department: person.department,
        assessmentId: person.assessmentId!,
        completedAt: person.completedAt,
      }));
  }),

  updateMyProfile: protectedProcedure
    .input(
      z.object({
        jobTitle: z.string().trim().min(2).max(180),
        department: z.string().trim().max(180).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireFluxusAccount(ctx.user);
      await updateUser(ctx.user.id, {
        jobTitle: input.jobTitle,
        department: input.department || null,
      });
      return { success: true };
    }),

  adminOverview: adminProcedure.query(async () => {
    const overview = await getFluxusPlatformOverview();
    return { ...overview, companies: overview.companies.map(company => ({ id: company.id, name: company.name, active: company.active, accessCodeHint: company.accessCodeHint, collaborators: company.collaborators, completed: company.completed, inProgress: company.inProgress, completionRate: company.completionRate, reportVisibility: company.reportVisibility, minimumAggregateSize: company.minimumAggregateSize, retentionMonths: company.retentionMonths })) };
  }),

  adminCompany: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const dashboard = await getFluxusCompanyDashboard(input.companyId);
      if (!dashboard)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      return { ...dashboard, company: safeCompany(dashboard.company)!, summary: dashboard.summary.canAggregate ? dashboard.summary : { ...dashboard.summary, averages: null, predominantCount: null } };
    }),

  adminAssessment: protectedProcedure
    .input(z.object({ assessmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const assessment = await getFluxusAssessmentById(input.assessmentId);
      if (!assessment || !assessment.result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Relatório não encontrado.",
        });
      }
      const [person, company] = await Promise.all([
        getUserById(assessment.userId),
        getFluxusCompanyById(assessment.companyId),
      ]);
      await requireIndividualReportAccess(ctx.user, assessment.companyId);
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: assessment.userId, companyId: assessment.companyId, assessmentId: assessment.id, action: "assessment.read_admin", resourceType: "assessment", ipHash: hashRequestIp(ctx.req) });
      return {
        assessment: { ...cycleSummary(assessment), companyId: assessment.companyId, result: assessment.result },
        person: person ? { id: person.id, name: person.name, jobTitle: person.jobTitle, department: person.department, fluxusRole: person.fluxusRole } : null,
        company: safeCompany(company),
        debrief: await getFluxusDebrief(assessment.id),
      };
    }),

  saveDebrief: protectedProcedure
    .input(z.object({ assessmentId: z.number().int().positive(), status: z.enum(["not_started", "in_progress", "completed"]), evidenceExamples: z.string().max(5000).optional(), hypothesesTested: z.string().max(5000).optional(), agreedActions: z.string().max(5000).optional(), managerSupport: z.string().max(5000).optional(), followUpDate: z.string().date().optional(), participantNotes: z.string().max(5000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const assessment = await getFluxusAssessmentById(input.assessmentId);
      if (!assessment || !assessment.result) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });
      await requireIndividualReportAccess(ctx.user, assessment.companyId);
      const debrief = await upsertFluxusDebrief({ ...input, participantUserId: assessment.userId, facilitatorUserId: ctx.user.id, evidenceExamples: input.evidenceExamples || null, hypothesesTested: input.hypothesesTested || null, agreedActions: input.agreedActions || null, managerSupport: input.managerSupport || null, followUpDate: input.followUpDate || null, participantNotes: input.participantNotes || null });
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: assessment.userId, companyId: assessment.companyId, assessmentId: assessment.id, action: "debrief.save", resourceType: "debrief", metadata: { status: input.status } });
      return { success: true, debrief };
    }),

  updateCompanyGovernance: adminProcedure
    .input(z.object({ companyId: z.number().int().positive(), reportVisibility: z.enum(["participant_only", "participant_manager_hr", "participant_hr"]), minimumAggregateSize: z.number().int().min(5).max(25), retentionMonths: z.number().int().min(6).max(120), processingPurpose: z.string().trim().min(20).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...values } = input;
      const company = await updateFluxusCompanyGovernance(companyId, values);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
      await recordFluxusAudit({ actorUserId: ctx.user.id, companyId, action: "governance.update", resourceType: "company_policy", metadata: { reportVisibility: input.reportVisibility, minimumAggregateSize: input.minimumAggregateSize, retentionMonths: input.retentionMonths } });
      return { success: true, company: safeCompany(company) };
    }),

  setCollaboratorRole: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), companyId: z.number().int().positive(), fluxusRole: z.enum(["collaborator", "manager", "hr"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = await setFluxusUserRole(input.userId, input.companyId, input.fluxusRole);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não encontrado nesta empresa." });
      await recordFluxusAudit({ actorUserId: ctx.user.id, subjectUserId: input.userId, companyId: input.companyId, action: "membership.role_change", resourceType: "user_role", metadata: { fluxusRole: input.fluxusRole } });
      return { success: true };
    }),

  adminAuditLog: adminProcedure
    .input(z.object({ companyId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(100) }))
    .query(async ({ input }) => listFluxusAuditLogs(input.companyId, input.limit)),

  createCompany: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(255),
        accessCode: z
          .string()
          .trim()
          .min(8, "Use um código com ao menos 8 caracteres")
          .max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedName = normalizeCompanyName(input.name);
      if (await getFluxusCompanyByNormalizedName(normalizedName)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta empresa já está cadastrada.",
        });
      }
      const accessCodeHash = await bcrypt.hash(input.accessCode, 12);
      const company = await createFluxusCompany({
        name: input.name.trim(),
        normalizedName,
        accessCodeHash,
        accessCodeHint: makeAccessCodeHint(input.accessCode),
        createdBy: ctx.user.id,
      });
      return { success: true, company };
    }),

  resetCompanyCode: adminProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        accessCode: z.string().trim().min(8).max(64),
      })
    )
    .mutation(async ({ input }) => {
      const accessCodeHash = await bcrypt.hash(input.accessCode, 12);
      const company = await updateFluxusCompanyCode(
        input.companyId,
        accessCodeHash,
        makeAccessCodeHint(input.accessCode)
      );
      if (!company)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      return { success: true };
    }),

  setCompanyActive: adminProcedure
    .input(
      z.object({ companyId: z.number().int().positive(), active: z.boolean() })
    )
    .mutation(async ({ input }) => {
      const company = await setFluxusCompanyActive(
        input.companyId,
        input.active
      );
      if (!company)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      return { success: true };
    }),
});

export const fluxusVersions = {
  instrumentVersion: FLUXUS_INSTRUMENT_VERSION,
  formulaVersion: FLUXUS_FORMULA_VERSION,
};
