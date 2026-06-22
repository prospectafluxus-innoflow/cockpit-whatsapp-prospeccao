import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getLeadsByUser,
  getLeadById,
  insertLeads,
  updateLead,
  deleteLeadsByUser,
  getDailySendCount,
  registerDailySend,
  getMetrics,
} from "./db";
import { invokeLLM } from "./_core/llm";

const DAILY_LIMIT = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function canSendToque(lead: { status: string; toque1SentAt: Date | null; toque2SentAt: Date | null; toque3SentAt: Date | null }) {
  const now = Date.now();
  const DAY = 86_400_000;

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

function buildWaLink(whatsapp: string, toque: number, lead: { name: string; firstName: string | null; company: string | null }) {
  const firstName = lead.firstName ?? lead.name.split(" ")[0] ?? lead.name;
  const company = lead.company ? ` da ${lead.company}` : "";

  const messages: Record<number, string> = {
    1: `Olá ${firstName}! Tudo bem? Vi que você${company} tem atuado no mercado e gostaria de entender melhor como posso agregar valor ao seu negócio. Posso te chamar em 5 minutos?`,
    2: `Oi ${firstName}, tudo certo? Passando para retomar nosso contato. Tenho algumas ideias que podem fazer sentido para o seu negócio${company}. Tem um momento para conversar?`,
    3: `${firstName}, última tentativa de contato! Caso tenha interesse em conversar sobre como posso ajudar${company}, é só me responder. Abraço!`,
  };

  const msg = encodeURIComponent(messages[toque] ?? messages[1]!);
  const phone = whatsapp.replace(/\D/g, "");
  return `https://wa.me/55${phone}?text=${msg}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
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

        return rawLeads.map((lead) => {
          const { can, toque } = canSendToque(lead);
          return {
            ...lead,
            nextToque: toque,
            canSendNow: can,
            waLink: can ? buildWaLink(lead.whatsapp, toque, lead) : null,
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
          size: z.string().optional(),
          employees: z.number().optional(),
          investment: z.string().optional(),
          taxRegime: z.string().optional(),
          participations: z.number().optional(),
          lastEvent: z.string().optional(),
        })),
        replaceAll: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.replaceAll) {
          await deleteLeadsByUser(ctx.user.id);
        }

        const toInsert = input.leads.map((l) => ({
          userId: ctx.user.id,
          name: l.name,
          firstName: l.firstName ?? l.name.split(" ")[0] ?? l.name,
          company: l.company ?? null,
          whatsapp: l.whatsapp,
          score: l.score ?? 0,
          layer: (l.layer ?? "B") as "A" | "B" | "C",
          size: l.size ?? null,
          employees: l.employees ?? null,
          investment: l.investment ?? null,
          taxRegime: l.taxRegime ?? null,
          participations: l.participations ?? null,
          lastEvent: l.lastEvent ?? null,
        }));

        await insertLeads(toInsert);
        return { inserted: toInsert.length };
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
        return { success: true };
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
        });
        return { success: true };
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
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return getMetrics(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
