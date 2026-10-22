/**
 * Cron endpoints for the Cloud Scheduler migration.
 *
 * Cloud Scheduler calls /api/cron/dispatch-reminders once per hour at minute
 * zero. The old /api/cron/send-reminder endpoint remains available for the
 * legacy runner; only the Google provider opts it into the shared ledger.
 */
import type { Request, Response } from "express";
import { getAllSchedules, getDistributedQueueForDay } from "./db";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";
import {
  claimReminder,
  markReminderFailed,
  markReminderNotDelivered,
  markReminderSent,
  sanitizeReminderError,
} from "./reminderDb";
import {
  getSaoPauloLocalParts,
  type ReminderWindow as SharedReminderWindow,
  type SaoPauloLocalParts,
} from "../shared/reminderTime";
import type { SendSchedule } from "../drizzle/schema";

export const REMINDER_WINDOWS = ["morning", "lunch", "afternoon", "evening"] as const;
export type ReminderWindow = SharedReminderWindow;

type DispatchOptions = {
  /** Internal test seam; HTTP requests never receive a custom time. */
  now?: Date;
  dryRun?: boolean;
  window?: ReminderWindow;
  requireMinuteZero?: boolean;
  useLedger?: boolean;
};

export type ReminderDispatchStats = {
  localDate: string;
  minute: number;
  due: number;
  wouldNotify: number;
  claimed: number;
  alreadyClaimed: number;
  sent: number;
  failed: number;
  notDelivered: number;
  noLeads: number;
  dryRun: boolean;
  skipped?: "minute-zero-only";
};

type WindowConfig = {
  enabled: number | null;
  hour: number | null;
  count: number | null;
};

const windowLabels: Record<ReminderWindow, string> = {
  morning: "Manhã ☀️",
  lunch: "Almoço 🍽️",
  afternoon: "Meio da tarde 🌅",
  evening: "Fim do dia 🌆",
};

function isGoogleSchedulerEnabled(): boolean {
  return process.env.REMINDER_SCHEDULER_PROVIDER === "google";
}

function getWindowConfig(schedule: SendSchedule, window: ReminderWindow): WindowConfig {
  switch (window) {
    case "morning":
      return {
        enabled: schedule.morningEnabled,
        hour: schedule.morningHour,
        count: schedule.morningCount,
      };
    case "lunch":
      return {
        enabled: schedule.lunchEnabled,
        hour: schedule.lunchHour,
        count: schedule.lunchCount,
      };
    case "afternoon":
      return {
        enabled: schedule.afternoonEnabled,
        hour: schedule.afternoonHour,
        count: schedule.afternoonCount,
      };
    case "evening":
      return {
        enabled: schedule.eveningEnabled,
        hour: schedule.eveningHour,
        count: schedule.eveningCount,
      };
  }
}

function emptyStats(local: SaoPauloLocalParts, dryRun: boolean): ReminderDispatchStats {
  return {
    localDate: local.localDate,
    minute: local.minute,
    due: 0,
    wouldNotify: 0,
    claimed: 0,
    alreadyClaimed: 0,
    sent: 0,
    failed: 0,
    notDelivered: 0,
    noLeads: 0,
    dryRun,
  };
}

function cockpitUrl(): string {
  const configured = process.env.APP_BASE_URL ?? "https://prospectafluxus-664809259352.us-west1.run.app";
  try {
    return new URL("/cockpit", configured).toString();
  } catch {
    return "https://prospectafluxus-664809259352.us-west1.run.app/cockpit";
  }
}

function notificationFor(
  schedule: SendSchedule,
  window: ReminderWindow,
  localDate: string,
  leads: Array<{ name: string; company: string | null; layer: string }>,
) {
  const leadList = leads
    .map((lead, index) => `${index + 1}. ${lead.name}${lead.company ? ` (${lead.company})` : ""} — Camada ${lead.layer}`)
    .join("\n");
  const title = `🎯 Hora de prospectar! — ${windowLabels[window]}`;
  const content = `Você tem ${leads.length > 1 ? `${leads.length} leads` : "1 lead"} na fila para esta janela:\n\n${leadList}\n\nAcesse o cockpit para enviar os toques agora!`;

  return {
    userId: schedule.userId,
    title,
    content,
    url: cockpitUrl(),
    tag: `prospectafluxus-reminder:${localDate}:${window}:${schedule.userId}`,
  };
}

async function recordDeliveryFailure(
  ledgerId: number,
  error: unknown,
  stats: ReminderDispatchStats,
): Promise<void> {
  try {
    await markReminderFailed(ledgerId, error);
  } catch (ledgerError) {
    console.error("[Reminder] ledger failure:", sanitizeReminderError(ledgerError));
  }
  stats.failed += 1;
}

/**
 * Dispatch due schedule windows. This function is the only path that calls
 * notifyOwner for the Cloud Scheduler route and is also reused by the legacy
 * single-window endpoint when the Google provider is enabled.
 */
export async function dispatchReminderWindows(options: DispatchOptions = {}): Promise<ReminderDispatchStats> {
  const now = options.now ?? new Date();
  const local = getSaoPauloLocalParts(now);
  const dryRun = options.dryRun === true;
  const stats = emptyStats(local, dryRun);

  if (options.requireMinuteZero && local.minute !== 0) {
    stats.skipped = "minute-zero-only";
    return stats;
  }

  const schedules = await getAllSchedules();
  const windows = options.window ? [options.window] : REMINDER_WINDOWS;
  const useLedger = options.useLedger ?? isGoogleSchedulerEnabled();

  for (const schedule of schedules) {
    for (const window of windows) {
      const config = getWindowConfig(schedule, window);
      if (!config.enabled) continue;
      // A legacy explicit-window call is intentionally not cadence-gated.
      if (!options.window && config.hour !== local.hour) continue;

      stats.due += 1;
      const morningCount = schedule.morningEnabled ? schedule.morningCount ?? 2 : 0;
      const lunchCount = schedule.lunchEnabled ? schedule.lunchCount ?? 2 : 0;
      const afternoonCount = schedule.afternoonEnabled ? schedule.afternoonCount ?? 2 : 0;
      const eveningCount = schedule.eveningEnabled ? schedule.eveningCount ?? 2 : 0;
      const distributed = await getDistributedQueueForDay(
        schedule.userId,
        morningCount,
        lunchCount,
        afternoonCount,
        eveningCount,
      );
      const leads = distributed[window];
      if (leads.length === 0) {
        stats.noLeads += 1;
        continue;
      }

      if (dryRun) {
        stats.wouldNotify += 1;
        continue;
      }

      let ledgerId: number | undefined;
      if (useLedger) {
        const claim = await claimReminder({
          userId: schedule.userId,
          localDate: local.localDate,
          window,
          claimedAt: now,
        });
        if (!claim.claimed) {
          stats.alreadyClaimed += 1;
          continue;
        }
        ledgerId = claim.ledgerId;
        stats.claimed += 1;
      }

      try {
        const delivered = await notifyOwner(notificationFor(schedule, window, local.localDate, leads));
        if (delivered) {
          if (ledgerId !== undefined) await markReminderSent(ledgerId, now);
          stats.sent += 1;
        } else {
          if (ledgerId !== undefined) await markReminderNotDelivered(ledgerId, now);
          stats.notDelivered += 1;
        }
      } catch (error) {
        if (ledgerId !== undefined) {
          await recordDeliveryFailure(ledgerId, error, stats);
        } else {
          stats.failed += 1;
          console.error("[Reminder] delivery failure:", sanitizeReminderError(error));
        }
      }
    }
  }

  return stats;
}

function hasCronSecret(req: Request): boolean {
  const cronSecret = ENV.cronSecret;
  if (!cronSecret) return false;
  const authorization = req.headers.authorization ?? "";
  const headerSecret = req.headers["x-cron-secret"];
  const xCronSecret = Array.isArray(headerSecret) ? headerSecret[0] ?? "" : headerSecret ?? "";
  return authorization === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
}

export async function cronDispatchRemindersHandler(req: Request, res: Response) {
  if (!hasCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!isGoogleSchedulerEnabled()) {
    return res.status(503).json({ error: "Google Cloud Scheduler provider is not active" });
  }
  if (req.body?.now !== undefined) {
    return res.status(400).json({ error: "now is only available to internal tests" });
  }
  if (req.body?.dryRun !== undefined && typeof req.body.dryRun !== "boolean") {
    return res.status(400).json({ error: "dryRun must be boolean" });
  }

  try {
    const stats = await dispatchReminderWindows({
      dryRun: req.body?.dryRun === true,
      requireMinuteZero: true,
      useLedger: true,
    });
    return res.json({ ok: true, provider: "google", ...stats });
  } catch (error) {
    console.error("[cronDispatchRemindersHandler] Error:", sanitizeReminderError(error));
    return res.status(500).json({ error: "Reminder dispatch failed" });
  }
}

export async function cronSendReminderHandler(req: Request, res: Response) {
  if (!hasCronSecret(req)) return res.status(401).json({ error: "Unauthorized" });

  const window = req.body?.window as ReminderWindow | undefined;
  if (!window || !REMINDER_WINDOWS.includes(window)) {
    return res.status(400).json({ error: "window deve ser morning, lunch, afternoon ou evening" });
  }

  try {
    const stats = await dispatchReminderWindows({
      window,
      // Railway/legacy deployments retain their previous behavior. The same
      // endpoint becomes ledger-backed only in the Google deployment.
      useLedger: isGoogleSchedulerEnabled(),
    });
    return res.json({ ok: true, window, ...stats });
  } catch (error) {
    console.error("[cronSendReminderHandler] Error:", sanitizeReminderError(error));
    return res.status(500).json({ error: "Reminder dispatch failed" });
  }
}
