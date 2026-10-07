import { z } from "zod";
import {
  CYCLE_STATUSES,
  FEEDBACK_ROLES,
  FEEDBACK_STATUSES,
  feedbackItemSchema,
  competencyIdsSchema,
} from "../../shared/feedback";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  addParticipants,
  assignEmployee,
  bootstrapCompanyAdmin,
  commentFeedback,
  correctFeedback,
  createCycle,
  createDepartment,
  feedbackDb,
  getFeedback,
  history,
  removeParticipant,
  requireFeedbackEnabled,
  saveDraft,
  setCompanyAdministrator,
  setManagementScope,
  setMembership,
  transitionCycle,
  transitionFeedbackStatus,
  updateDepartment,
  updateSettings,
  workspace,
} from "../feedbackDb";

const id = z.number().int().positive();
const enabledProcedure = protectedProcedure.use(async ({ next }) => {
  requireFeedbackEnabled();
  return next();
});
const enabledAdminProcedure = adminProcedure.use(async ({ next }) => {
  requireFeedbackEnabled();
  return next();
});

export const feedbackRouter = router({
  workspace: protectedProcedure
    .input(z.object({ companyId: id.optional() }).optional())
    .query(({ ctx, input }) => workspace(ctx.user, input?.companyId ?? null)),

  get: enabledProcedure
    .input(z.object({ id }))
    .query(({ ctx, input }) => getFeedback(ctx.user, input.id)),

  history: enabledProcedure
    .input(
      z
        .object({
          participantUserId: id.optional(),
          year: z.number().int().optional(),
        })
        .optional()
    )
    .query(({ ctx, input }) => history(ctx.user, input ?? {})),

  bootstrapCompanyAdmin: enabledAdminProcedure
    .input(z.object({ companyId: id, userId: id }))
    .mutation(({ ctx, input }) =>
      bootstrapCompanyAdmin(ctx.user, input.companyId, input.userId)
    ),

  setCompanyAdministrator: enabledAdminProcedure
    .input(
      z.object({
        companyId: id,
        userId: id,
        isAdmin: z.boolean(),
        expectedIsAdmin: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => setCompanyAdministrator(ctx.user, input)),

  setMembership: enabledProcedure
    .input(
      z.object({
        companyId: id,
        userId: id,
        role: z.enum(FEEDBACK_ROLES),
        canReadFeedback: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => setMembership(ctx.user, input)),

  createDepartment: enabledProcedure
    .input(
      z.object({
        companyId: id,
        name: z.string().trim().min(1).max(180),
        parentId: id.nullish(),
      })
    )
    .mutation(({ ctx, input }) =>
      createDepartment(ctx.user, { ...input, parentId: input.parentId ?? null })
    ),

  updateDepartment: enabledProcedure
    .input(
      z.object({
        id,
        name: z.string().trim().min(1).max(180),
        parentId: id.nullable(),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => updateDepartment(ctx.user, input)),

  assignEmployee: enabledProcedure
    .input(
      z.object({
        companyId: id,
        userId: id,
        departmentId: id.nullable(),
        managerUserId: id.nullable(),
        jobTitle: z.string().trim().max(180).optional(),
      })
    )
    .mutation(({ ctx, input }) => assignEmployee(ctx.user, input)),

  setManagementScope: enabledProcedure
    .input(
      z.object({
        companyId: id,
        userId: id,
        departmentId: id,
        includeDescendants: z.boolean(),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => setManagementScope(ctx.user, input)),

  updateSettings: enabledProcedure
    .input(z.object({ companyId: id, competencyIds: competencyIdsSchema }))
    .mutation(({ ctx, input }) => updateSettings(ctx.user, input)),

  createCycle: enabledProcedure
    .input(
      z.object({
        companyId: id,
        name: z.string().trim().min(1).max(120),
        startsOn: z.string(),
        endsOn: z.string(),
      })
    )
    .mutation(({ ctx, input }) => createCycle(ctx.user, input)),

  addParticipants: enabledProcedure
    .input(
      z.object({
        cycleId: id,
        participants: z
          .array(z.object({ userId: id, evaluatorUserId: id }))
          .min(1)
          .max(500),
      })
    )
    .mutation(({ ctx, input }) => addParticipants(ctx.user, input)),

  removeParticipant: enabledProcedure
    .input(z.object({ cycleId: id, userId: id }))
    .mutation(({ ctx, input }) =>
      removeParticipant(ctx.user, input.cycleId, input.userId)
    ),

  transitionCycle: enabledProcedure
    .input(z.object({ id, status: z.enum(["active", "closed", "cancelled"]) }))
    .mutation(({ ctx, input }) => transitionCycle(ctx.user, input)),

  saveDraft: enabledProcedure
    .input(
      z.object({
        id,
        revision: z.number().int().nonnegative(),
        items: z.array(feedbackItemSchema).max(10),
      })
    )
    .mutation(({ ctx, input }) => saveDraft(ctx.user, input)),

  transition: enabledProcedure
    .input(
      z.object({
        id,
        revision: z.number().int().nonnegative(),
        status: z.enum([
          "completed",
          "debriefed",
          "released",
          "acknowledged",
          "closed",
        ]),
      })
    )
    .mutation(({ ctx, input }) => transitionFeedbackStatus(ctx.user, input)),

  correct: enabledProcedure
    .input(
      z.object({
        id,
        revision: z.number().int().nonnegative(),
        reason: z.string().trim().min(1).max(2000),
        items: z.array(feedbackItemSchema).max(10),
      })
    )
    .mutation(({ ctx, input }) => correctFeedback(ctx.user, input)),

  comment: enabledProcedure
    .input(z.object({ id, comment: z.string().trim().min(1).max(5000) }))
    .mutation(({ ctx, input }) => commentFeedback(ctx.user, input)),
});

export { feedbackDb };
