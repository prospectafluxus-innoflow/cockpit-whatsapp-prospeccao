import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import {
  getScheduleByTaskUid,
  getDistributedQueueForDay,
} from "./db";
import { notifyOwner } from "./_core/notification";

/**
 * Handler do Heartbeat para lembretes de prospecção.
 * Chamado automaticamente pelo cron nos horários configurados.
 * Identifica a janela pelo taskUid do cron (nunca pelo req.body).
 */
export async function sendReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);

    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const taskUid = user.taskUid;

    // Localiza a configuração de agendamento pelo taskUid
    const schedule = await getScheduleByTaskUid(taskUid);
    if (!schedule) {
      return res.json({ ok: true, skipped: "schedule-not-found", taskUid });
    }

    // Infere a janela pelo taskUid (nunca pelo req.body)
    let windowKey: "morning" | "lunch" | "afternoon" | "evening";
    if (schedule.morningTaskUid === taskUid) windowKey = "morning";
    else if (schedule.lunchTaskUid === taskUid) windowKey = "lunch";
    else if ((schedule as any).afternoonTaskUid === taskUid) windowKey = "afternoon";
    else windowKey = "evening";

    // Verifica se a janela está habilitada
    const enabledMap: Record<string, number | null | undefined> = {
      morning: schedule.morningEnabled,
      lunch: schedule.lunchEnabled,
      afternoon: (schedule as any).afternoonEnabled,
      evening: schedule.eveningEnabled,
    };
    if (!enabledMap[windowKey]) {
      return res.json({
        ok: true,
        skipped: "window-disabled",
        window: windowKey,
      });
    }

    // Distribui leads sem duplicidade entre as janelas
    const morningCount = schedule.morningEnabled
      ? (schedule.morningCount ?? 2)
      : 0;
    const lunchCount = schedule.lunchEnabled
      ? (schedule.lunchCount ?? 2)
      : 0;
    const afternoonCount = (schedule as any).afternoonEnabled
      ? ((schedule as any).afternoonCount ?? 2)
      : 0;
    const eveningCount = schedule.eveningEnabled
      ? (schedule.eveningCount ?? 2)
      : 0;

    const distributed = await getDistributedQueueForDay(
      schedule.userId,
      morningCount,
      lunchCount,
      afternoonCount,
      eveningCount
    );

    const windowLeads = distributed[windowKey as keyof typeof distributed];

    if (windowLeads.length === 0) {
      return res.json({
        ok: true,
        skipped: "no-leads-ready",
        window: windowKey,
      });
    }

    // Monta a notificação
    const windowLabel =
      windowKey === "morning"
        ? "Manhã ☀️"
        : windowKey === "lunch"
        ? "Almoço 🍽️"
        : windowKey === "afternoon"
        ? "Meio da tarde 🌅"
        : "Fim do dia 🌆";

    const leadList = windowLeads
      .map(
        (l, i) =>
          `${i + 1}. ${l.name}${l.company ? ` (${l.company})` : ""} — Camada ${l.layer}`
      )
      .join("\n");

    const title = `🎯 Hora de prospectar! — ${windowLabel}`;
    const content = `Você tem ${windowLeads.length} lead${
      windowLeads.length > 1 ? "s" : ""
    } na fila para esta janela:\n\n${leadList}\n\nAcesse o cockpit para enviar os toques agora!`;

    await notifyOwner({ title, content });

    return res.json({
      ok: true,
      window: windowKey,
      leadsNotified: windowLeads.length,
    });
  } catch (err: any) {
    console.error("[sendReminderHandler] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  }
}
