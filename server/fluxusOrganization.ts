import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { feedbackAssignments } from "../drizzle/feedbackSchema";
import { users } from "../drizzle/schema";
import { db } from "./db";

/** Shared direct team. No feature-flag or company-wide fallback grants access. */
export async function getFluxusDirectTeamUserIds(
  managerUserId: number,
  companyId: number,
  now = new Date()
): Promise<Set<number>> {
  if (!Number.isInteger(managerUserId) || managerUserId <= 0) return new Set();
  if (!Number.isInteger(companyId) || companyId <= 0) return new Set();
  try {
    const [manager] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, managerUserId),
          eq(users.companyId, companyId),
          eq(users.accountType, "fluxus"),
          eq(users.fluxusRole, "manager"),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        )
      )
      .limit(1);
    if (!manager) return new Set();

    // Select across all managers before reducing. A superseded overlapping row
    // must not grant the former manager access to the same employee.
    const rows = await db
      .select({
        userId: feedbackAssignments.userId,
        managerUserId: feedbackAssignments.managerUserId,
      })
      .from(feedbackAssignments)
      .where(
        and(
          eq(feedbackAssignments.companyId, companyId),
          lte(feedbackAssignments.startsAt, now),
          or(
            isNull(feedbackAssignments.endsAt),
            gt(feedbackAssignments.endsAt, now)
          )
        )
      )
      .orderBy(
        desc(feedbackAssignments.startsAt),
        desc(feedbackAssignments.id)
      );
    const latest = new Map<number, number | null>();
    for (const row of rows)
      if (!latest.has(row.userId)) latest.set(row.userId, row.managerUserId);
    const assignedIds = Array.from(latest.entries())
      .filter(
        ([id, managerId]) => managerId === managerUserId && id !== managerUserId
      )
      .map(([id]) => id);
    if (assignedIds.length === 0) return new Set();
    const live = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, assignedIds),
          eq(users.companyId, companyId),
          eq(users.accountType, "fluxus"),
          eq(users.approvalStatus, "approved"),
          isNull(users.privacyDeletedAt)
        )
      );
    return new Set(live.map(person => person.id));
  } catch {
    // Missing schema or database failure cannot turn a team into the company.
    return new Set();
  }
}

export async function isFluxusDirectTeamUser(
  managerUserId: number,
  companyId: number,
  userId: number,
  now = new Date()
): Promise<boolean> {
  return (await getFluxusDirectTeamUserIds(managerUserId, companyId, now)).has(
    userId
  );
}
