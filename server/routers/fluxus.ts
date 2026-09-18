import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  FLUXUS_FORMULA_VERSION,
  FLUXUS_INSTRUMENT_VERSION,
  calculateFluxusResult,
  getFluxusCompletion,
  sanitizeFluxusAnswers,
} from "../../shared/fluxus";
import { createUser, getUserByEmail, getUserById, updateUser } from "../db";
import {
  completeFluxusAssessment,
  createFluxusCompany,
  getFluxusAssessmentById,
  getFluxusCompanyById,
  getFluxusCompanyByNormalizedName,
  getFluxusCompanyDashboard,
  getFluxusPlatformOverview,
  getOrCreateFluxusAssessment,
  normalizeCompanyName,
  saveFluxusAnswers,
  setFluxusCompanyActive,
  updateFluxusCompanyCode,
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
    .mutation(async ({ input }) => {
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
      return { success: true, name: user.name, companyName: company.name };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    requireFluxusAccount(ctx.user);
    const assessment = await getOrCreateFluxusAssessment(
      ctx.user.id,
      ctx.user.companyId!
    );
    const companyDashboard = await getFluxusCompanyDashboard(
      ctx.user.companyId!
    );
    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        jobTitle: ctx.user.jobTitle,
        department: ctx.user.department,
      },
      company: companyDashboard?.company ?? null,
      assessment: {
        id: assessment.id,
        status: assessment.status,
        answers: assessment.answers,
        result: assessment.result,
        instrumentVersion: assessment.instrumentVersion,
        formulaVersion: assessment.formulaVersion,
        completion: getFluxusCompletion(assessment.answers),
      },
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
      return { success: true, completion: getFluxusCompletion(answers) };
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

  adminOverview: adminProcedure.query(async () => getFluxusPlatformOverview()),

  adminCompany: adminProcedure
    .input(z.object({ companyId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const dashboard = await getFluxusCompanyDashboard(input.companyId);
      if (!dashboard)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      return dashboard;
    }),

  adminAssessment: adminProcedure
    .input(z.object({ assessmentId: z.number().int().positive() }))
    .query(async ({ input }) => {
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
      return { assessment, person, company };
    }),

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
