/**
 * cronHandler.ts — Endpoint para Render Cron Jobs
 *
 * Chamado pelos cron jobs do Render nos horários configurados.
 * Protegido pelo header Authorization: Bearer $CRON_SECRET
 *
 * Endpoint: POST /api/cron/send-reminder
 * Body: { "window": "morning" | "lunch" | "afternoon" | "evening" }
 */
import type { Request, Response } from "express";
import {
  getAllSchedules,
  getDistributedQueueForDay,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";

export async function cronSendReminderHandler(req: Request, res: Response) {
  try {
    // Verificar o CRON_SECRET para segurança
    const authHeader = req.headers.authorization ?? "";
    const cronSecret = ENV.cronSecret;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const window = req.body?.window as "morning" | "lunch" | "afternoon" | "evening" | undefined;
    if (!window || !["morning", "lunch", "afternoon", "evening"].includes(window)) {
      return res.status(400).json({ error: "window deve ser morning, lunch, afternoon ou evening" });
    }

    // Busca todas as configurações de agendamento ativas
    const schedules = await getAllSchedules();

    if (schedules.length === 0) {
      return res.json({ ok: true, skipped: "no-schedules", window });
    }

    const results = [];

    for (const schedule of schedules) {
      // Verifica se a janela está habilitada para este usuário
      const enabledMap: Record<string, number | null | undefined> = {
        morning: schedule.morningEnabled,
        lunch: schedule.lunchEnabled,
        afternoon: (schedule as any).afternoonEnabled,
        evening: schedule.eveningEnabled,
      };

      if (!enabledMap[window]) {
        results.push({ userId: schedule.userId, skipped: "window-disabled" });
        continue;
      }

      const morningCount = schedule.morningEnabled ? (schedule.morningCount ?? 2) : 0;
      const lunchCount = schedule.lunchEnabled ? (schedule.lunchCount ?? 2) : 0;
      const afternoonCount = (schedule as any).afternoonEnabled ? ((schedule as any).afternoonCount ?? 2) : 0;
      const eveningCount = schedule.eveningEnabled ? (schedule.eveningCount ?? 2) : 0;

      const distributed = await getDistributedQueueForDay(
        schedule.userId,
        morningCount,
        lunchCount,
        afternoonCount,
        eveningCount
      );

      const windowLeads = distributed[window as keyof typeof distributed];

      if (windowLeads.length === 0) {
        results.push({ userId: schedule.userId, skipped: "no-leads-ready" });
        continue;
      }

      // Monta a notificação
      const windowLabel =
        window === "morning"
          ? "Manhã ☀️"
          : window === "lunch"
          ? "Almoço 🍽️"
          : window === "afternoon"
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

      results.push({
        userId: schedule.userId,
        window,
        leadsNotified: windowLeads.length,
      });
    }

    return res.json({ ok: true, window, results });
  } catch (err: any) {
    console.error("[cronSendReminderHandler] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  }
}
