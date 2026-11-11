import { z } from "zod";
import {
  executiveNotesSchema,
  executiveSelectionSchema,
} from "../../shared/fluxusExecutive";
import {
  getExecutiveDirectory,
  getExecutivePreview,
  listExecutiveReports,
  previewExecutive,
  saveExecutiveReport,
} from "../fluxusExecutiveDb";
import { protectedProcedure, router } from "../_core/trpc";

const companyInputSchema = z.object({
  companyId: z.number().int().positive().optional(),
});

export const fluxusExecutiveRouter = router({
  directory: protectedProcedure
    .input(companyInputSchema)
    .query(({ ctx, input }) =>
      getExecutiveDirectory(ctx.user, input.companyId)
    ),

  preview: protectedProcedure
    .input(executiveSelectionSchema)
    .query(({ ctx, input }) => previewExecutive(ctx.user, input)),

  save: protectedProcedure
    .input(
      z.object({
        selection: executiveSelectionSchema,
        notes: executiveNotesSchema,
        reportId: z.number().int().positive().optional(),
        expectedRevision: z.number().int().positive().optional(),
      })
    )
    .mutation(({ ctx, input }) => saveExecutiveReport(ctx.user, input)),

  get: protectedProcedure
    .input(z.object({ reportId: z.number().int().positive() }))
    .query(({ ctx, input }) => getExecutivePreview(ctx.user, input.reportId)),

  list: protectedProcedure
    .input(companyInputSchema)
    .query(({ ctx, input }) => listExecutiveReports(ctx.user, input.companyId)),
});
