import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import type {
  FeedbackCompetency,
  FeedbackItem,
  FeedbackStatus,
} from "@shared/feedback";

/** The feedback surface is the router itself; no parallel client contract is maintained. */
export const feedbackApi = trpc.feedback;

export type FeedbackOutputs = inferRouterOutputs<AppRouter>["feedback"];
export type FeedbackWorkspace = FeedbackOutputs["workspace"];
export type FeedbackDetail = FeedbackOutputs["get"];
export type FeedbackHistoryResponse = FeedbackOutputs["history"];
export type FeedbackListEntry = FeedbackWorkspace["feedbacks"][number];
export type FeedbackPerson = FeedbackWorkspace["people"][number];
export type FeedbackCalculation = FeedbackDetail["calculation"];
export type FeedbackMembership = NonNullable<FeedbackWorkspace["membership"]>;

export type { FeedbackCompetency, FeedbackItem, FeedbackStatus };
