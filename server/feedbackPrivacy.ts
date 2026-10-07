import { and, asc, eq, inArray } from "drizzle-orm";
import {
  developmentCycles,
  feedbackEvaluations,
} from "../drizzle/feedbackSchema";
import { db } from "./db";
import { isFeedbackEnabled } from "./feedbackDb";

/** Chamado somente pelo exportMyData autenticado, com os IDs da sessão, não do input. */
export async function exportReleasedFeedbackData(
  userId: number,
  companyId: number
) {
  if (!isFeedbackEnabled()) return [];
  return db
    .select({
      id: feedbackEvaluations.id,
      status: feedbackEvaluations.status,
      revision: feedbackEvaluations.revision,
      items: feedbackEvaluations.items,
      participantComment: feedbackEvaluations.participantComment,
      commentedAt: feedbackEvaluations.commentedAt,
      completedAt: feedbackEvaluations.completedAt,
      debriefedAt: feedbackEvaluations.debriefedAt,
      releasedAt: feedbackEvaluations.releasedAt,
      firstViewedAt: feedbackEvaluations.firstViewedAt,
      acknowledgedAt: feedbackEvaluations.acknowledgedAt,
      closedAt: feedbackEvaluations.closedAt,
      cycle: {
        id: developmentCycles.id,
        name: developmentCycles.name,
        startsOn: developmentCycles.startsOn,
        endsOn: developmentCycles.endsOn,
        status: developmentCycles.status,
        methodVersion: developmentCycles.methodVersion,
        templateVersion: developmentCycles.templateVersion,
        competencies: developmentCycles.competencySnapshot,
      },
    })
    .from(feedbackEvaluations)
    .innerJoin(
      developmentCycles,
      and(
        eq(developmentCycles.id, feedbackEvaluations.cycleId),
        eq(developmentCycles.companyId, companyId)
      )
    )
    .where(
      and(
        eq(feedbackEvaluations.companyId, companyId),
        eq(feedbackEvaluations.participantUserId, userId),
        inArray(feedbackEvaluations.status, [
          "released",
          "acknowledged",
          "closed",
        ])
      )
    )
    .orderBy(asc(developmentCycles.startsOn), asc(feedbackEvaluations.id));
}
