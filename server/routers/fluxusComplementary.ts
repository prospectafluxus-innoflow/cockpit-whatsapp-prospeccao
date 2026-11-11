import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  confirmComplementaryReport,
  downloadComplementaryReport,
  getComplementaryAvailability,
  getComplementaryDetail,
  listMine,
  listSharedWithMe,
  revokeComplementaryReport,
  uploadComplementaryReport,
} from "../fluxusComplementaryDb";
import { protectedProcedure, router } from "../_core/trpc";
import {
  COMPLEMENTARY_KINDS,
  COMPLEMENTARY_TERMS_VERSION,
} from "../../shared/fluxusComplementary";

const id = z.number().int().positive();
const pagination = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(20).default(10),
});
const privateProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ctx.res.set("Cache-Control", "private, no-store");
  const result = await next();
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Não foi possível concluir a operação com o relatório protegido. Tente novamente.",
    });
  }
  return result;
});
const uploadInput = z.object({
  kind: z.enum(COMPLEMENTARY_KINDS),
  fileName: z.string().trim().min(1).max(255),
  pdfBase64: z.string().min(1).max(7_000_000),
  consentAccepted: z.literal(true),
  termsVersion: z.literal(COMPLEMENTARY_TERMS_VERSION),
  consentText: z.string().min(1).max(5000),
  recipientUserIds: z
    .array(id)
    .max(10)
    .default([])
    .transform(ids => Array.from(new Set(ids))),
  context: z.string().trim().max(1000).optional(),
});
const confirmInput = z.object({
  reportId: id,
  expectedRevision: z.number().int().nonnegative(),
  sourceDate: z.string(),
  values: z.unknown(),
  identityConfirmed: z.literal(true),
});

export const fluxusComplementaryRouter = router({
  availability: privateProcedure.query(({ ctx }) =>
    getComplementaryAvailability(ctx.user.id)
  ),
  mine: privateProcedure
    .input(pagination.optional())
    .query(({ ctx, input }) => {
      const page = input ?? { offset: 0, limit: 10 };
      return listMine(ctx.user.id, page.offset, page.limit);
    }),
  sharedWithMe: privateProcedure
    .input(pagination.optional())
    .query(({ ctx, input }) => {
      const page = input ?? { offset: 0, limit: 10 };
      return listSharedWithMe(ctx.user.id, page.offset, page.limit);
    }),
  upload: privateProcedure.input(uploadInput).mutation(({ ctx, input }) =>
    uploadComplementaryReport({
      userId: ctx.user.id,
      kind: input.kind,
      fileName: input.fileName,
      pdfBase64: input.pdfBase64,
      consentAccepted: input.consentAccepted,
      termsVersion: input.termsVersion,
      consentText: input.consentText,
      recipientUserIds: input.recipientUserIds,
      context: input.context,
    })
  ),
  get: privateProcedure
    .input(z.object({ reportId: id }))
    .query(({ ctx, input }) =>
      getComplementaryDetail(ctx.user.id, input.reportId)
    ),
  confirm: privateProcedure.input(confirmInput).mutation(({ ctx, input }) =>
    confirmComplementaryReport({
      userId: ctx.user.id,
      reportId: input.reportId,
      expectedRevision: input.expectedRevision,
      sourceDate: input.sourceDate,
      values: input.values,
      identityConfirmed: input.identityConfirmed,
    })
  ),
  revoke: privateProcedure
    .input(
      z.object({
        reportId: id,
        expectedRevision: z.number().int().nonnegative(),
      })
    )
    .mutation(({ ctx, input }) =>
      revokeComplementaryReport({ ...input, userId: ctx.user.id })
    ),
  download: privateProcedure
    .input(z.object({ reportId: id }))
    .mutation(({ ctx, input }) =>
      downloadComplementaryReport(ctx.user.id, input.reportId)
    ),
});
