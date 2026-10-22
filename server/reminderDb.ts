import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  reminderDispatchLedger,
  type ReminderDispatchStatus,
} from "../drizzle/schema";
import type { ReminderWindow } from "../shared/reminderTime";

export type ReminderClaimInput = {
  userId: number;
  localDate: string;
  window: ReminderWindow;
  claimedAt?: Date;
};

export type ReminderClaim =
  | { claimed: true; ledgerId: number }
  | { claimed: false };

/**
 * Claims a delivery slot exactly once. The unique constraint plus
 * ON CONFLICT DO NOTHING is the concurrency boundary; no read-before-insert
 * is used here.
 */
export async function claimReminder(input: ReminderClaimInput): Promise<ReminderClaim> {
  const rows = await db
    .insert(reminderDispatchLedger)
    .values({
      userId: input.userId,
      localDate: input.localDate,
      window: input.window,
      status: "claimed",
      claimedAt: input.claimedAt ?? new Date(),
    })
    .onConflictDoNothing({
      target: [
        reminderDispatchLedger.userId,
        reminderDispatchLedger.localDate,
        reminderDispatchLedger.window,
      ],
    })
    .returning({ id: reminderDispatchLedger.id });

  const row = rows[0];
  return row ? { claimed: true, ledgerId: row.id } : { claimed: false };
}

export async function markReminderSent(ledgerId: number, sentAt = new Date()): Promise<void> {
  await updateLedger(ledgerId, "sent", {
    sentAt,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
  });
}

export async function markReminderNotDelivered(
  ledgerId: number,
  failedAt = new Date(),
): Promise<void> {
  await updateLedger(ledgerId, "not-delivered", {
    failedAt,
    errorCode: "not_delivered",
    errorMessage: "notification_channel_unavailable",
  });
}

export async function markReminderFailed(
  ledgerId: number,
  error: unknown,
  failedAt = new Date(),
): Promise<void> {
  await updateLedger(ledgerId, "failed", {
    failedAt,
    errorCode: "delivery_failed",
    errorMessage: sanitizeReminderError(error),
  });
}

/** Never persist raw provider errors, URLs, credentials, or lead data. */
export function sanitizeReminderError(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) {
      return `provider_status_${statusCode}`;
    }
  }
  return "delivery_error";
}

async function updateLedger(
  ledgerId: number,
  status: ReminderDispatchStatus,
  fields: {
    sentAt?: Date | null;
    failedAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  await db
    .update(reminderDispatchLedger)
    .set({
      status,
      ...fields,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reminderDispatchLedger.id, ledgerId),
        eq(reminderDispatchLedger.status, "claimed"),
      ),
    );
}
