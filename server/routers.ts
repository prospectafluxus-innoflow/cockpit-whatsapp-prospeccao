import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getLeadsByUser,
  getLeadById,
  insertLeads,
  updateLead,
  deleteLeadsByUser,
  getDailySendCount,
  registerDailySend,
  getMetrics,
  getScheduleByUser,
  upsertSchedule,
  getQueueForWindow,
  getDistributedQueueForDay,
  getMessageTemplates,
  upsertMessageTemplate,
  upsertMessageTemplateAudio,
  removeMessageTemplateAudio,
  upsertPushSubscription,
  removePushSubscription,
  countPushSubscriptions,
  getUserIntegration,
  upsertUserIntegration,
  updateUserIntegrationState,
  DEFAULT_TEMPLATES,
} from "./db";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { invokeLLM } from "./_core/gemini";
import { authOwnRouter } from "./routers/authOwn";
import { storagePut } from "./storage";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  sendWebPushToUser,
} from "./_core/notification";
import {
  decryptTrelloCredentials,
  encryptTrelloCredentials,
  isIntegrationEncryptionConfigured,
} from "./integrationCrypto";
import {
  queueLeadTrelloSync,
  syncLeadToTrello,
  testTrelloList,
} from "./trello";

const DAILY_LIMIT = 30;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
]);

function audioExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  return extensions[mimeType] ?? "audio";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function canSendToque(lead: { status: string; toque1SentAt: Date | null; toque2SentAt: Date | null; toque3SentAt: Date | null; skippedUntil?: string | null }) {
  const now = Date.now();
  const DAY = 86_400_000;

  // Verifica se o lead foi pulado hoje
  if (lead.skippedUntil) {
    const skippedDate = new Date(lead.skippedUntil + "T00:00:00");
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (skippedDate > todayStart) return { can: false, toque: 0, skipped: true };
  }

  if (lead.status === "novo") return { can: true, toque: 1 };
  if (lead.status === "toque1_enviado" && lead.toque1SentAt) {
    const elapsed = now - new Date(lead.toque1SentAt).getTime();
    return { can: elapsed >= 3 * DAY, toque: 2 };
  }
  if (lead.status === "toque2_enviado" && lead.toque2SentAt) {
    const elapsed = now - new Date(lead.toque2SentAt).getTime();
    return { can: elapsed >= 4 * DAY, toque: 3 };
  }
  return { can: false, toque: 0 };
}

function buildWaLink(
  whatsapp: string,
  toque: number,
  lead: { name: string; firstName: string | null; company: string | null },
  customTemplates?: Record<number, string>
) {
  const firstName = lead.firstName ?? lead.name.split(" ")[0] ?? lead.name;
  const companyStr = lead.company ? ` da ${lead.company}` : "";

  // Usa template customizado se existir, senão usa o padrão
  const templates = customTemplates ?? DEFAULT_TEMPLATES;
  const rawTemplate = templates[toque] ?? DEFAULT_TEMPLATES[toque] ?? DEFAULT_TEMPLATES[1]!;

  // Substitui as variáveis {firstName} e {company}
  const message = rawTemplate
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{company\}/g, companyStr);

  const msg = encodeURIComponent(message);
  const phone = whatsapp.replace(/\D/g, "");
  return `https://wa.me/55${phone}?text=${msg}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  authOwn: authOwnRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Notificações Web Push ───────────────────────────────────────────────
  notifications: router({
    status: protectedProcedure.query(async ({ ctx }) => ({
      configured: isWebPushConfigured,
      publicKey: getVapidPublicKey(),
      devices: await countPushSubscriptions(ctx.user.id),
    })),

    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string().url().max(4096).refine(
          endpoint => new URL(endpoint).protocol === "https:",
          "O endpoint push deve utilizar HTTPS.",
        ),
        expirationTime: z.number().int().positive().nullable().optional(),
        keys: z.object({
          p256dh: z.string().min(20).max(1000),
          auth: z.string().min(8).max(500),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isWebPushConfigured) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Web Push ainda não está configurado no servidor.",
          });
        }

        await upsertPushSubscription(
          ctx.user.id,
          input,
          ctx.req.headers["user-agent"],
        );
        return { success: true };
      }),

    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string().url().max(4096) }))
      .mutation(async ({ ctx, input }) => {
        await removePushSubscription(ctx.user.id, input.endpoint);
        return { success: true };
      }),

    test: protectedProcedure.mutation(async ({ ctx }) => {
      if (!isWebPushConfigured) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Web Push ainda não está configurado no servidor.",
        });
      }

      const result = await sendWebPushToUser(ctx.user.id, {
        title: "ProspectaFluxus — Teste de alerta",
        content: "As notificações estão ativas neste dispositivo.",
        tag: `prospectafluxus-test-${Date.now()}`,
      });

      if (result.subscriptions === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Nenhum dispositivo está inscrito para receber alertas.",
        });
      }

      return result;
    }),
  }),

  // ─── Integração Trello ───────────────────────────────────────────────────
  trello: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const integration = await getUserIntegration(ctx.user.id, "trello");
      return {
        serverConfigured: isIntegrationEncryptionConfigured(),
        connected: Boolean(integration),
        enabled: integration?.enabled === 1,
        listId: integration?.listId ?? null,
        listName: integration?.listName ?? null,
        lastError: integration?.lastError ?? null,
        lastTestedAt: integration?.lastTestedAt ?? null,
      };
    }),

    save: protectedProcedure
      .input(z.object({
        apiKey: z.string().trim().max(256).optional(),
        token: z.string().trim().max(512).optional(),
        listId: z.string().trim().min(5).max(64).regex(/^[A-Za-z0-9]+$/, "ID da lista inválido."),
        enabled: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isIntegrationEncryptionConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "A cifragem de integrações ainda não está configurada no servidor.",
          });
        }

        const existing = await getUserIntegration(ctx.user.id, "trello");
        const hasNewApiKey = Boolean(input.apiKey);
        const hasNewToken = Boolean(input.token);
        if (hasNewApiKey !== hasNewToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a API key e o token em conjunto.",
          });
        }

        let credentialsEncrypted = existing?.credentialsEncrypted;
        if (hasNewApiKey && hasNewToken) {
          credentialsEncrypted = encryptTrelloCredentials(ctx.user.id, {
            apiKey: input.apiKey!,
            token: input.token!,
          });
        }
        if (!credentialsEncrypted) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a API key e o token do Trello na primeira configuração.",
          });
        }

        try {
          const credentials = decryptTrelloCredentials(ctx.user.id, credentialsEncrypted);
          const list = await testTrelloList(input.listId, credentials);
          await upsertUserIntegration({
            userId: ctx.user.id,
            provider: "trello",
            enabled: input.enabled ? 1 : 0,
            credentialsEncrypted,
            listId: list.id,
            listName: list.name,
            lastError: null,
            lastTestedAt: new Date(),
          });
          return { success: true, listName: list.name };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível validar o Trello.";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),

    test: protectedProcedure.mutation(async ({ ctx }) => {
      const integration = await getUserIntegration(ctx.user.id, "trello");
      if (!integration) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure o Trello primeiro." });
      }

      try {
        const credentials = decryptTrelloCredentials(ctx.user.id, integration.credentialsEncrypted);
        const list = await testTrelloList(integration.listId, credentials);
        await updateUserIntegrationState(ctx.user.id, "trello", {
          listName: list.name,
          lastError: null,
          lastTestedAt: new Date(),
        });
        return { success: true, listName: list.name };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível validar o Trello.";
        await updateUserIntegrationState(ctx.user.id, "trello", { lastError: message });
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

    setEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const integration = await updateUserIntegrationState(ctx.user.id, "trello", {
          enabled: input.enabled ? 1 : 0,
        });
        if (!integration) {
          throw new TRPCError({ code: "NOT_FOUND", message: "A integração Trello ainda não foi configurada." });
        }
        return { success: true };
      }),

    retryLead: protectedProcedure
      .input(z.object({ leadId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => syncLeadToTrello(ctx.user.id, input.leadId)),
  }),

  // ─── Leads ────────────────────────────────────────────────────────────────
  leads: router({
    list: protectedProcedure
      .input(z.object({
        layer: z.enum(["A", "B", "C"]).optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const rawLeads = await getLeadsByUser(ctx.user.id, input ?? {});
        const today = todayStr();
        const todaySends = await getDailySendCount(ctx.user.id, today);

        const customTemplates: Record<number, string> = { ...DEFAULT_TEMPLATES };
        const customAudio: Record<number, {
          url: string;
          fileName: string;
          mimeType: string;
          size: number;
        } | null> = { 1: null, 2: null, 3: null };

        try {
          const savedTemplates = await getMessageTemplates(ctx.user.id);
          for (const template of savedTemplates) {
            customTemplates[template.toque] = template.text;
            if (
              template.audioUrl &&
              template.audioFileName &&
              template.audioMimeType &&
              template.audioSize != null
            ) {
              customAudio[template.toque] = {
                url: template.audioUrl,
                fileName: template.audioFileName,
                mimeType: template.audioMimeType,
                size: template.audioSize,
              };
            }
          }
        } catch {
          // Usa textos padrão e nenhum áudio enquanto a migração não estiver aplicada.
        }

        return rawLeads.map((lead) => {
          const { can, toque } = canSendToque(lead);
          return {
            ...lead,
            nextToque: toque,
            canSendNow: can,
            waLink: can ? buildWaLink(lead.whatsapp, toque, lead, customTemplates) : null,
            audio: can ? customAudio[toque] ?? null : null,
          };
        });
      }),

    upload: protectedProcedure
      .input(z.object({
        leads: z.array(z.object({
          name: z.string(),
          firstName: z.string().optional(),
          company: z.string().optional(),
          whatsapp: z.string(),
          score: z.number().optional(),
          layer: z.enum(["A", "B", "C"]).optional(),
          segment: z.string().optional(),
          size: z.string().optional(),
          employees: z.number().optional(),
          investment: z.string().optional(),
          taxRegime: z.string().optional(),
          participations: z.number().optional(),
          lastEvent: z.string().optional(),
          // Colunas opcionais para leads já trabalhados
          toque: z.number().min(0).max(3).optional(),
          statusImport: z.enum(["novo", "respondeu", "nao_respondeu", "descartado", "fechado"]).optional(),
        })),
        replaceAll: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.replaceAll) {
          await deleteLeadsByUser(ctx.user.id);
        }

        const toqueStatusMap: Record<number, "novo" | "toque1_enviado" | "toque2_enviado" | "toque3_enviado"> = {
          0: "novo", 1: "toque1_enviado", 2: "toque2_enviado", 3: "toque3_enviado",
        };
        const toqueKanbanMap: Record<number, "Novo" | "Toque 1 Enviado" | "Toque 2 Enviado" | "Toque 3 Enviado"> = {
          0: "Novo", 1: "Toque 1 Enviado", 2: "Toque 2 Enviado", 3: "Toque 3 Enviado",
        };
        const statusImportMap: Record<string, { status: string; kanbanColumn: string }> = {
          novo:          { status: "novo",            kanbanColumn: "Novo" },
          respondeu:     { status: "respondeu",       kanbanColumn: "Respondeu" },
          nao_respondeu: { status: "toque3_enviado",  kanbanColumn: "Toque 3 Enviado" },
          descartado:    { status: "descartado",      kanbanColumn: "Toque 3 Enviado" },
          fechado:       { status: "fechado",         kanbanColumn: "Fechado" },
        };

        const now = new Date();
        const toInsert = input.leads.map((l) => {
          const toque = l.toque ?? 0;
          const statusImport = l.statusImport;

          let status: string = toqueStatusMap[toque] ?? "novo";
          let kanbanColumn: string = toqueKanbanMap[toque] ?? "Novo";
          if (statusImport && statusImportMap[statusImport]) {
            status = statusImportMap[statusImport]!.status;
            kanbanColumn = statusImportMap[statusImport]!.kanbanColumn;
          }

          // Datas retroativas para os toques já realizados
          const toque1SentAt = toque >= 1 ? new Date(now.getTime() - 7 * 86_400_000) : null;
          const toque2SentAt = toque >= 2 ? new Date(now.getTime() - 4 * 86_400_000) : null;
          const toque3SentAt = toque >= 3 ? new Date(now.getTime() - 1 * 86_400_000) : null;
          const respondedAt  = status === "respondeu" ? now : null;

          return {
            userId: ctx.user.id,
            name: l.name,
            firstName: l.firstName ?? l.name.split(" ")[0] ?? l.name,
            company: l.company ?? null,
            whatsapp: l.whatsapp,
            score: l.score ?? 0,
            layer: (l.layer ?? "B") as "A" | "B" | "C",
            segment: l.segment ?? null,
            size: l.size ?? null,
            employees: l.employees ?? null,
            investment: l.investment ?? null,
            taxRegime: l.taxRegime ?? null,
            participations: l.participations ?? null,
            lastEvent: l.lastEvent ?? null,
            status: status as any,
            kanbanColumn: kanbanColumn as any,
            toque1SentAt,
            toque2SentAt,
            toque3SentAt,
            respondedAt,
          };
        });

        await insertLeads(toInsert);
        return { inserted: toInsert.length } as { inserted: number };
      }),

    registerSend: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const today = todayStr();
        const count = await getDailySendCount(ctx.user.id, today);

        if (count >= DAILY_LIMIT) {
          throw new Error("Limite diário de 30 envios atingido.");
        }

        const lead = await getLeadById(input.leadId, ctx.user.id);
        if (!lead) throw new Error("Lead não encontrado.");

        const { can, toque } = canSendToque(lead);
        if (!can) throw new Error("Este toque ainda não está liberado.");

        const now = new Date();
        const statusMap: Record<number, "toque1_enviado" | "toque2_enviado" | "toque3_enviado"> = {
          1: "toque1_enviado",
          2: "toque2_enviado",
          3: "toque3_enviado",
        };
        const kanbanMap: Record<number, "Toque 1 Enviado" | "Toque 2 Enviado" | "Toque 3 Enviado"> = {
          1: "Toque 1 Enviado",
          2: "Toque 2 Enviado",
          3: "Toque 3 Enviado",
        };
        const sentAtMap: Record<number, Partial<typeof lead>> = {
          1: { toque1SentAt: now },
          2: { toque2SentAt: now },
          3: { toque3SentAt: now },
        };

        await updateLead(input.leadId, ctx.user.id, {
          status: statusMap[toque],
          kanbanColumn: kanbanMap[toque],
          ...sentAtMap[toque],
        });

        await registerDailySend(ctx.user.id, input.leadId, toque, today);

        return { success: true, toque, newCount: count + 1 };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        status: z.enum(["respondeu", "nao_respondeu", "descartado"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId, ctx.user.id);
        if (!lead) throw new Error("Lead não encontrado.");

        const updates: Record<string, unknown> = {
          notes: input.notes ?? lead.notes,
        };

        if (input.status === "respondeu") {
          // Marca como respondeu e move para coluna Respondeu no Kanban
          updates["status"] = "respondeu";
          updates["kanbanColumn"] = "Respondeu";
          updates["respondedAt"] = new Date();
        } else if (input.status === "nao_respondeu") {
          // Mantém o status atual do ciclo (não altera a fila)
          // Apenas registra a nota se houver
          // Não muda status nem kanbanColumn
        } else if (input.status === "descartado") {
          // Remove da fila ativa permanentemente
          updates["status"] = "descartado";
        }

        await updateLead(input.leadId, ctx.user.id, updates as any);
        if (input.status === "respondeu") {
          queueLeadTrelloSync(ctx.user.id, input.leadId);
        }
        return { success: true, trelloSyncQueued: input.status === "respondeu" };
      }),

    moveKanban: protectedProcedure
      .input(z.object({
        leadId: z.number(),
        column: z.enum(["Novo", "Toque 1 Enviado", "Toque 2 Enviado", "Toque 3 Enviado", "Respondeu", "Fechado"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const columnToStatus: Record<string, string> = {
          "Novo": "novo",
          "Toque 1 Enviado": "toque1_enviado",
          "Toque 2 Enviado": "toque2_enviado",
          "Toque 3 Enviado": "toque3_enviado",
          "Respondeu": "respondeu",
          "Fechado": "fechado",
        };
        await updateLead(input.leadId, ctx.user.id, {
          kanbanColumn: input.column,
          status: columnToStatus[input.column] as any,
          ...(input.column === "Respondeu" ? { respondedAt: new Date() } : {}),
        });
        if (input.column === "Respondeu") {
          queueLeadTrelloSync(ctx.user.id, input.leadId);
        }
        return { success: true, trelloSyncQueued: input.column === "Respondeu" };
      }),

    kanban: protectedProcedure.query(async ({ ctx }) => {
      const allLeads = await getLeadsByUser(ctx.user.id);
      const columns = ["Novo", "Toque 1 Enviado", "Toque 2 Enviado", "Toque 3 Enviado", "Respondeu", "Fechado"] as const;

      const result: Record<string, typeof allLeads> = {};
      for (const col of columns) result[col] = [];

      for (const lead of allLeads) {
        if (lead.status === "descartado") continue;
        const col = lead.kanbanColumn;
        if (result[col]) result[col]!.push(lead);
      }

      return result;
    }),

    aiSuggestion: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId, ctx.user.id);
        if (!lead) throw new Error("Lead não encontrado.");

        const prompt = `Você é um especialista em vendas consultivas B2B. 
Um lead acabou de responder sua mensagem de prospecção no WhatsApp.

Perfil do lead:
- Nome: ${lead.name}
- Empresa: ${lead.company ?? "não informado"}
- Porte: ${lead.size ?? "não informado"}
- Funcionários: ${lead.employees ?? "não informado"}
- Investimento em Marketing: ${lead.investment ?? "não informado"}
- Regime Tributário: ${lead.taxRegime ?? "não informado"}
- Score ICP: ${lead.score}/100
- Camada: ${lead.layer}

Escreva uma mensagem de follow-up curta, personalizada e natural para WhatsApp (máximo 3 parágrafos curtos). 
O objetivo é agendar uma conversa de 15-20 minutos. 
Use o primeiro nome do lead (${lead.firstName ?? lead.name.split(" ")[0]}).
Seja direto, humano e evite parecer um robô ou vendedor agressivo.
Responda APENAS com a mensagem, sem explicações adicionais.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um especialista em prospecção B2B via WhatsApp." },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const suggestion = typeof rawContent === "string" ? rawContent : "";
        await updateLead(input.leadId, ctx.user.id, { lastAiSuggestion: suggestion });

        return { suggestion };
      }),

    skipLead: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId, ctx.user.id);
        if (!lead) throw new Error("Lead não encontrado.");
        // Pula o lead até amanhã (não aparece na fila do dia)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0]!;
        await updateLead(input.leadId, ctx.user.id, { skippedUntil: tomorrowStr } as any);
        return { success: true };
      }),

    exportCSV: protectedProcedure.query(async ({ ctx }) => {
      const allLeads = await getLeadsByUser(ctx.user.id);
      const headers = ["ID", "Nome", "Empresa", "WhatsApp", "Score", "Camada", "Status", "Kanban", "Toque1", "Toque2", "Toque3", "Respondeu em", "Notas"];
      const rows = allLeads.map((l) => [
        l.id,
        l.name,
        l.company ?? "",
        l.whatsapp,
        l.score,
        l.layer,
        l.status,
        l.kanbanColumn,
        l.toque1SentAt ? new Date(l.toque1SentAt).toLocaleDateString("pt-BR") : "",
        l.toque2SentAt ? new Date(l.toque2SentAt).toLocaleDateString("pt-BR") : "",
        l.toque3SentAt ? new Date(l.toque3SentAt).toLocaleDateString("pt-BR") : "",
        l.respondedAt ? new Date(l.respondedAt).toLocaleDateString("pt-BR") : "",
        l.notes ?? "",
      ]);

      const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      return { csv };
    }),
  }),

  // ─── Dashboard ────────────────────────────────────────────────────────────
  // --- Schedule ---
  schedule: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const s = await getScheduleByUser(ctx.user.id);
      return s ?? {
        morningEnabled: 1, morningHour: 8, morningCount: 2,
        lunchEnabled: 1, lunchHour: 12, lunchCount: 2,
        afternoonEnabled: 1, afternoonHour: 15, afternoonCount: 2,
        eveningEnabled: 1, eveningHour: 17, eveningCount: 2,
        morningTaskUid: null, lunchTaskUid: null, afternoonTaskUid: null, eveningTaskUid: null,
      };
    }),

    getQueue: protectedProcedure.query(async ({ ctx }) => {
      const schedule = await getScheduleByUser(ctx.user.id);
      const now = new Date();
      const hourBRT = (now.getUTCHours() - 3 + 24) % 24;
      const morningH = schedule?.morningHour ?? 8;
      const lunchH = schedule?.lunchHour ?? 12;
      const afternoonH = (schedule as any)?.afternoonHour ?? 15;
      const eveningH = schedule?.eveningHour ?? 17;

      let activeWindow: "morning" | "lunch" | "afternoon" | "evening" | null = null;
      if (hourBRT >= morningH && hourBRT < morningH + 2) activeWindow = "morning";
      else if (hourBRT >= lunchH && hourBRT < lunchH + 2) activeWindow = "lunch";
      else if (hourBRT >= afternoonH && hourBRT < afternoonH + 2) activeWindow = "afternoon";
      else if (hourBRT >= eveningH && hourBRT < eveningH + 2) activeWindow = "evening";

      const morningCount = schedule?.morningCount ?? 2;
      const lunchCount = schedule?.lunchCount ?? 2;
      const afternoonCount = (schedule as any)?.afternoonCount ?? 2;
      const eveningCount = schedule?.eveningCount ?? 2;

      // Distribui leads sem duplicidade entre as janelas
      const distributed = await getDistributedQueueForDay(
        ctx.user.id,
        (schedule?.morningEnabled ?? 1) ? morningCount : 0,
        (schedule?.lunchEnabled ?? 1) ? lunchCount : 0,
        ((schedule as any)?.afternoonEnabled ?? 1) ? afternoonCount : 0,
        (schedule?.eveningEnabled ?? 1) ? eveningCount : 0
      );

      return {
        activeWindow,
        hourBRT,
        windows: {
          morning: { hour: morningH, count: morningCount, enabled: !!(schedule?.morningEnabled ?? 1), leads: distributed.morning },
          lunch: { hour: lunchH, count: lunchCount, enabled: !!(schedule?.lunchEnabled ?? 1), leads: distributed.lunch },
          afternoon: { hour: afternoonH, count: afternoonCount, enabled: !!((schedule as any)?.afternoonEnabled ?? 1), leads: distributed.afternoon },
          evening: { hour: eveningH, count: eveningCount, enabled: !!(schedule?.eveningEnabled ?? 1), leads: distributed.evening },
        },
      };
    }),

    save: protectedProcedure
      .input(z.object({
        morningEnabled: z.number().int().min(0).max(1),
        morningHour: z.number().int().min(6).max(11),
        morningCount: z.number().int().min(1).max(5),
        lunchEnabled: z.number().int().min(0).max(1),
        lunchHour: z.number().int().min(11).max(14),
        lunchCount: z.number().int().min(1).max(5),
        afternoonEnabled: z.number().int().min(0).max(1),
        afternoonHour: z.number().int().min(13).max(17),
        afternoonCount: z.number().int().min(1).max(5),
        eveningEnabled: z.number().int().min(0).max(1),
        eveningHour: z.number().int().min(15).max(20),
        eveningCount: z.number().int().min(1).max(5),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertSchedule(ctx.user.id, input);
        return { ok: true };
      }),

    activate: protectedProcedure.mutation(async ({ ctx }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const schedule = await getScheduleByUser(ctx.user.id);
      const toUtcH = (h: number) => (h + 3) % 24;

      const jobs = [
        { key: "morning" as const, enabled: !!(schedule?.morningEnabled ?? 1), hour: schedule?.morningHour ?? 8, uid: schedule?.morningTaskUid },
        { key: "lunch" as const, enabled: !!(schedule?.lunchEnabled ?? 1), hour: schedule?.lunchHour ?? 12, uid: schedule?.lunchTaskUid },
        { key: "afternoon" as const, enabled: !!((schedule as any)?.afternoonEnabled ?? 1), hour: (schedule as any)?.afternoonHour ?? 15, uid: (schedule as any)?.afternoonTaskUid },
        { key: "evening" as const, enabled: !!(schedule?.eveningEnabled ?? 1), hour: schedule?.eveningHour ?? 17, uid: schedule?.eveningTaskUid },
      ];

      const result: Record<string, string | null> = {};

      for (const job of jobs) {
        if (!job.enabled) {
          if (job.uid) { try { await updateHeartbeatJob(job.uid, { enable: false }, sessionToken); } catch {} }
          result[job.key] = job.uid ?? null;
          continue;
        }
        const cron = `0 0 ${toUtcH(job.hour)} * * *`;
        const label = job.key === "morning" ? "Manhã" : job.key === "lunch" ? "Almoço" : job.key === "afternoon" ? "Meio da tarde" : "Fim do dia";
        if (job.uid) {
          try { await updateHeartbeatJob(job.uid, { cron, enable: true }, sessionToken); } catch {}
          result[job.key] = job.uid;
        } else {
          const created = await createHeartbeatJob({
            name: `prospeccao-${job.key}-${ctx.user.id}`,
            cron,
            path: "/api/scheduled/send-reminder",
            payload: { window: job.key, userId: ctx.user.id },
            description: `Lembrete de prospecção - ${label}`,
          }, sessionToken);
          result[job.key] = created.taskUid;
        }
      }

      await upsertSchedule(ctx.user.id, {
        morningTaskUid: result.morning ?? undefined,
        lunchTaskUid: result.lunch ?? undefined,
        afternoonTaskUid: result.afternoon ?? undefined,
        eveningTaskUid: result.evening ?? undefined,
      } as any);

      return { ok: true, taskUids: result };
    }),
  }),

  // --- Dashboard ---
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return getMetrics(ctx.user.id);
    }),
  }),

  // ─── Templates de mensagem ────────────────────────────────────────────────────
  messageTemplates: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const result: Record<number, string> = { ...DEFAULT_TEMPLATES };
      const audio: Record<number, {
        url: string;
        fileName: string;
        mimeType: string;
        size: number;
      } | null> = { 1: null, 2: null, 3: null };

      try {
        const saved = await getMessageTemplates(ctx.user.id);
        for (const template of saved) {
          result[template.toque] = template.text;
          if (
            template.audioUrl &&
            template.audioFileName &&
            template.audioMimeType &&
            template.audioSize != null
          ) {
            audio[template.toque] = {
              url: template.audioUrl,
              fileName: template.audioFileName,
              mimeType: template.audioMimeType,
              size: template.audioSize,
            };
          }
        }
      } catch {
        // Mantém os textos padrão enquanto a migração ainda não tiver sido aplicada.
      }

      return {
        toque1: result[1]!,
        toque2: result[2]!,
        toque3: result[3]!,
        audio: {
          toque1: audio[1],
          toque2: audio[2],
          toque3: audio[3],
        },
      };
    }),

    save: protectedProcedure
      .input(z.object({
        toque: z.number().int().min(1).max(3),
        text: z.string().min(10).max(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const saved = await upsertMessageTemplate(ctx.user.id, input.toque, input.text);
        return { success: true, id: saved.id };
      }),

    uploadAudio: protectedProcedure
      .input(z.object({
        toque: z.number().int().min(1).max(3),
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        base64: z.string().min(4).max(Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 16),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ALLOWED_AUDIO_TYPES.has(input.mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Formato não suportado. Envie MP3, M4A, AAC, OGG, WEBM ou WAV.",
          });
        }

        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Conteúdo de áudio inválido." });
        }

        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.byteLength === 0 || buffer.byteLength > MAX_AUDIO_BYTES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O áudio deve ter no máximo 12 MB.",
          });
        }

        const safeOriginalName = input.fileName
          .replace(/[\\/]/g, "-")
          .replace(/[^a-zA-Z0-9À-ÿ._ -]/g, "")
          .slice(0, 255) || `audio-toque-${input.toque}.${audioExtension(input.mimeType)}`;
        const key = `users/${ctx.user.id}/message-audio/toque-${input.toque}/audio.${audioExtension(input.mimeType)}`;
        const stored = await storagePut(key, buffer, input.mimeType);
        const saved = await upsertMessageTemplateAudio(ctx.user.id, input.toque, {
          audioKey: stored.key,
          audioUrl: stored.url,
          audioFileName: safeOriginalName,
          audioMimeType: input.mimeType,
          audioSize: buffer.byteLength,
        });

        return {
          success: true,
          audio: {
            url: saved.audioUrl!,
            fileName: saved.audioFileName!,
            mimeType: saved.audioMimeType!,
            size: saved.audioSize!,
          },
        };
      }),

    removeAudio: protectedProcedure
      .input(z.object({ toque: z.number().int().min(1).max(3) }))
      .mutation(async ({ ctx, input }) => {
        await removeMessageTemplateAudio(ctx.user.id, input.toque);
        return { success: true };
      }),

    reset: protectedProcedure
      .input(z.object({ toque: z.number().int().min(1).max(3) }))
      .mutation(async ({ ctx, input }) => {
        await upsertMessageTemplate(ctx.user.id, input.toque, DEFAULT_TEMPLATES[input.toque]!);
        return { success: true, text: DEFAULT_TEMPLATES[input.toque]! };
      }),
  }),
});

export type AppRouter = typeof appRouter;
