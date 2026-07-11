import { drizzle } from "drizzle-orm/postgres-js";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { eq, and, sql, count, or, desc, asc } from "drizzle-orm";
import {
  users,
  leads,
  dailySends,
  sendSchedules,
  pushSubscriptions,
  userIntegrations,
  messageTemplates,
  type User,
  type InsertUser,
  type Lead,
  type InsertLead,
  type InsertDailySend,
  type SendSchedule,
  type InsertSendSchedule,
  type PushSubscription,
  type UserIntegration,
  type MessageTemplate,
} from "../drizzle/schema";

// ─── Conexão com o banco ──────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada. Defina a ligação ao PostgreSQL nas variáveis de ambiente.");
}

const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

if (!isTestEnvironment) {
  console.log("[DB] Connecting to database...");
  console.log("[DB] Host:", connectionString.replace(/:[^:@]+@/, ":***@").substring(0, 80));
}

const client = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  onnotice: (notice) => console.log("[DB] Notice:", notice.message),
  debug: (connection, query, params) => {
    // only log errors
  },
  onclose: (connId) => console.log("[DB] Connection closed:", connId),
  connect_timeout: 10,
});

if (!isTestEnvironment) {
  client`SELECT 1`.then(() => {
    console.log("[DB] Database connection successful.");
  }).catch((err) => {
    console.error("[DB] Database connection failed:", err.message);
  });
}

export const db = drizzle(client);

// ─── Helpers de usuário ───────────────────────────────────────────────────────
export async function getUserById(id: number): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertUser(data: InsertUser): Promise<User> {
  const existing = data.openId ? await getUserByOpenId(data.openId) : null;
  if (existing) {
    const updated = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return updated[0];
  }
  const inserted = await db.insert(users).values(data).returning();
  return inserted[0];
}

export async function createUser(data: InsertUser): Promise<User> {
  const inserted = await db.insert(users).values(data).returning();
  return inserted[0];
}

export async function updateUser(
  id: number,
  data: Partial<InsertUser>
): Promise<User | null> {
  const updated = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(asc(users.createdAt));
}

export async function getUserByResetToken(token: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Helpers de leads ─────────────────────────────────────────────────────────
export async function getLeadsByUser(
  userId: number,
  filters?: { layer?: "A" | "B" | "C"; status?: string; search?: string }
): Promise<Lead[]> {
  let query = db.select().from(leads).where(eq(leads.userId, userId)).$dynamic();

  if (filters?.layer) {
    query = query.where(
      and(eq(leads.userId, userId), eq(leads.layer, filters.layer))
    );
  }

  const results = await query.orderBy(desc(leads.createdAt));

  // Filter in memory for status and search (simpler than complex SQL)
  return results.filter((l) => {
    if (filters?.status && l.status !== filters.status) return false;
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      return (
        l.name.toLowerCase().includes(s) ||
        (l.company ?? "").toLowerCase().includes(s) ||
        l.whatsapp.includes(s)
      );
    }
    return true;
  });
}

export async function getLeadById(
  id: number,
  userId: number
): Promise<Lead | null> {
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertLeads(data: InsertLead[]): Promise<void> {
  if (data.length === 0) return;
  // Insert sem .returning() para máxima velocidade
  // O frontend já envia em lotes pequenos de 50, então inserimos tudo de uma vez
  await db.insert(leads).values(data);
}

export async function updateLead(
  id: number,
  userId: number,
  data: Partial<InsertLead>
): Promise<Lead | null> {
  const updated = await db
    .update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
    .returning();
  return updated[0] ?? null;
}

export async function deleteLeadsByUser(userId: number): Promise<void> {
  await db.delete(leads).where(eq(leads.userId, userId));
}

// ─── Helpers de envios diários ────────────────────────────────────────────────
export async function getDailySendCount(
  userId: number,
  date: string
): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(dailySends)
    .where(
      and(eq(dailySends.userId, userId), eq(dailySends.sentDate, date))
    );
  return rows[0]?.total ?? 0;
}

export async function registerDailySend(
  userId: number,
  leadId: number,
  touchNumber: number,
  sentDate: string
): Promise<void> {
  await db.insert(dailySends).values({ userId, leadId, touchNumber, sentDate });
}

// ─── Helpers de agendamento ───────────────────────────────────────────────────
export async function getScheduleByUser(
  userId: number
): Promise<SendSchedule | null> {
  const rows = await db
    .select()
    .from(sendSchedules)
    .where(eq(sendSchedules.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSchedule(
  userId: number,
  data: Partial<InsertSendSchedule>
): Promise<SendSchedule> {
  const existing = await getScheduleByUser(userId);
  if (existing) {
    const updated = await db
      .update(sendSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sendSchedules.userId, userId))
      .returning();
    return updated[0];
  }
  const inserted = await db
    .insert(sendSchedules)
    .values({ userId, ...data } as InsertSendSchedule)
    .returning();
  return inserted[0];
}

export async function getAllSchedules(): Promise<SendSchedule[]> {
  return db.select().from(sendSchedules);
}

export async function getScheduleByTaskUid(
  taskUid: string
): Promise<SendSchedule | null> {
  const rows = await db
    .select()
    .from(sendSchedules)
    .where(
      or(
        eq(sendSchedules.morningTaskUid, taskUid),
        eq(sendSchedules.lunchTaskUid, taskUid),
        eq(sendSchedules.afternoonTaskUid, taskUid),
        eq(sendSchedules.eveningTaskUid, taskUid)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── Fila distribuída por janela ──────────────────────────────────────────────
export async function getDistributedQueueForDay(
  userId: number,
  morningCount: number,
  lunchCount: number,
  afternoonCount: number,
  eveningCount: number
): Promise<{ morning: Lead[]; lunch: Lead[]; afternoon: Lead[]; evening: Lead[] }> {
  const total = morningCount + lunchCount + afternoonCount + eveningCount;
  if (total === 0) return { morning: [], lunch: [], afternoon: [], evening: [] };

  const today = new Date().toISOString().split("T")[0]!;

  // Busca leads já enviados hoje para evitar duplicidade
  const sentTodayRows = await db
    .select({ leadId: dailySends.leadId })
    .from(dailySends)
    .where(
      and(eq(dailySends.userId, userId), eq(dailySends.sentDate, today))
    );
  const sentTodayIds = new Set(sentTodayRows.map((r) => r.leadId));

  // Busca leads prontos para envio (status novo ou aguardando próximo toque)
  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.userId, userId))
    .orderBy(desc(leads.score), asc(leads.createdAt));

  const now = Date.now();
  const DAY = 86_400_000;

  const readyLeads = allLeads.filter((l) => {
    if (sentTodayIds.has(l.id)) return false;
    if (l.status === "respondeu" || l.status === "fechado" || l.status === "descartado") return false;
    // Verifica se o lead foi pulado hoje
    if ((l as any).skippedUntil) {
      const skippedDate = new Date((l as any).skippedUntil + "T00:00:00");
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      if (skippedDate > todayStart) return false;
    }
    if (l.status === "novo") return true;
    if (l.status === "toque1_enviado" && l.toque1SentAt) {
      return now - new Date(l.toque1SentAt).getTime() >= 3 * DAY;
    }
    if (l.status === "toque2_enviado" && l.toque2SentAt) {
      return now - new Date(l.toque2SentAt).getTime() >= 4 * DAY;
    }
    return false;
  });

  // Distribui sem sobreposição
  const morning = readyLeads.slice(0, morningCount);
  const lunch = readyLeads.slice(morningCount, morningCount + lunchCount);
  const afternoon = readyLeads.slice(
    morningCount + lunchCount,
    morningCount + lunchCount + afternoonCount
  );
  const evening = readyLeads.slice(
    morningCount + lunchCount + afternoonCount,
    morningCount + lunchCount + afternoonCount + eveningCount
  );

  return { morning, lunch, afternoon, evening };
}

// ─── Métricas do dashboard ────────────────────────────────────────────────────
export async function getMetrics(userId: number) {
  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.userId, userId));

  const total = allLeads.length;
  const byStatus = {
    novo: 0,
    toque1_enviado: 0,
    toque2_enviado: 0,
    toque3_enviado: 0,
    respondeu: 0,
    fechado: 0,
    descartado: 0,
  };

  for (const l of allLeads) {
    if (l.status in byStatus) {
      byStatus[l.status as keyof typeof byStatus]++;
    }
  }

  const respondeuCount = byStatus.respondeu + byStatus.fechado;
  const totalContacted =
    byStatus.toque1_enviado +
    byStatus.toque2_enviado +
    byStatus.toque3_enviado +
    respondeuCount;

  const responseRate =
    totalContacted > 0 ? Math.round((respondeuCount / totalContacted) * 100) : 0;

  // Taxa de resposta por camada
  const byLayer: Record<"A" | "B" | "C", { contacted: number; responded: number }> = {
    A: { contacted: 0, responded: 0 },
    B: { contacted: 0, responded: 0 },
    C: { contacted: 0, responded: 0 },
  };

  for (const l of allLeads) {
    const layer = l.layer as "A" | "B" | "C";
    if (l.status !== "novo" && l.status !== "descartado") {
      byLayer[layer].contacted++;
      if (l.status === "respondeu" || l.status === "fechado") {
        byLayer[layer].responded++;
      }
    }
  }

  const today = new Date().toISOString().split("T")[0]!;
  const todaySends = await getDailySendCount(userId, today);

  return {
    total,
    byStatus,
    responseRate,
    todaySends,
    dailyLimit: 30,
    byLayer: {
      A: {
        ...byLayer.A,
        rate:
          byLayer.A.contacted > 0
            ? Math.round((byLayer.A.responded / byLayer.A.contacted) * 100)
            : 0,
      },
      B: {
        ...byLayer.B,
        rate:
          byLayer.B.contacted > 0
            ? Math.round((byLayer.B.responded / byLayer.B.contacted) * 100)
            : 0,
      },
      C: {
        ...byLayer.C,
        rate:
          byLayer.C.contacted > 0
            ? Math.round((byLayer.C.responded / byLayer.C.contacted) * 100)
            : 0,
      },
    },
  };
}

// ─── Alias para compatibilidade ───────────────────────────────────────────────

// ─── Subscrições Web Push ───────────────────────────────────────────────────
type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function hashPushEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function upsertPushSubscription(
  userId: number,
  subscription: PushSubscriptionInput,
  userAgent?: string,
): Promise<PushSubscription> {
  const endpointHash = hashPushEndpoint(subscription.endpoint);
  const now = new Date();
  const rows = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpointHash,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 1000) ?? null,
      expiresAt: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpointHash,
      set: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 1000) ?? null,
        expiresAt: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0]!;
}

export async function getPushSubscriptionsByUser(userId: number): Promise<PushSubscription[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function removePushSubscription(userId: number, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpointHash, hashPushEndpoint(endpoint)),
      ),
    );
}

export async function removePushSubscriptionById(userId: number, id: number): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, id)));
}

export async function markPushSubscriptionUsed(userId: number, id: number): Promise<void> {
  await db
    .update(pushSubscriptions)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.id, id)));
}

export async function countPushSubscriptions(userId: number): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

// ─── Integrações externas ────────────────────────────────────────────────────
export async function getUserIntegration(
  userId: number,
  provider = "trello"
): Promise<UserIntegration | null> {
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, provider)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertUserIntegration(input: {
  userId: number;
  provider?: string;
  enabled: number;
  credentialsEncrypted: string;
  listId: string;
  listName?: string | null;
  lastError?: string | null;
  lastTestedAt?: Date | null;
}): Promise<UserIntegration> {
  const provider = input.provider ?? "trello";
  const now = new Date();
  const rows = await db
    .insert(userIntegrations)
    .values({
      userId: input.userId,
      provider,
      enabled: input.enabled,
      credentialsEncrypted: input.credentialsEncrypted,
      listId: input.listId,
      listName: input.listName ?? null,
      lastError: input.lastError ?? null,
      lastTestedAt: input.lastTestedAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userIntegrations.userId, userIntegrations.provider],
      set: {
        enabled: input.enabled,
        credentialsEncrypted: input.credentialsEncrypted,
        listId: input.listId,
        listName: input.listName ?? null,
        lastError: input.lastError ?? null,
        lastTestedAt: input.lastTestedAt ?? null,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0]!;
}

export async function updateUserIntegrationState(
  userId: number,
  provider: string,
  data: Partial<Pick<UserIntegration, "enabled" | "lastError" | "lastTestedAt" | "listName">>
): Promise<UserIntegration | null> {
  const rows = await db
    .update(userIntegrations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, provider)))
    .returning();
  return rows[0] ?? null;
}

// ─── Helpers de templates de mensagem ────────────────────────────────────────
export const DEFAULT_TEMPLATES: Record<number, string> = {
  1: "Oi, {firstName}! Aqui é a Michelle Bis, da InnoFlow e sou uma das embaixadoras do Clube dos Decisores (a antiga Cobertura Business, da qual você já participou). Estou falando com empresários selecionados da nossa rede, e a {company} me chamou atenção pela sua história. Trabalho com estruturação empresarial e ajudo empresas como a sua a descobrir onde estão perdendo dinheiro, eficiência e onde elas podem ganhar mais dinheiro. Seleciono 2 empresas por mês para uma mentoria gratuita de 60 minutos. Topa? É o nosso Pit Stop: você sai com uma visão clara dos gargalos do negócio, sem compromisso.",
  2: "{firstName}, duas perguntas que costumo fazer na mentoria e que fazem todo dono parar: você sabe quanto sua empresa vale hoje se aparecer um investidor? E se você precisasse se ausentar uma semana, ela andaria sozinha? Se alguma travou, é exatamente o que a gente destrava em 60 minutos. Quer um dos 2 horários que tenho essa semana?",
  3: "{firstName}, vou parar de te perturbar por aqui \uD83D\uDE04 Mas fica o convite: quando bater aquela dúvida de quanto sua empresa vale \u2014 ou se ela andaria sem você por uma semana \u2014 é só preencher o formulário no innoflow.com.br e você entra na fila da mentoria do próximo mês. Sucesso aí, e até os encontros do Clube dos Decisores! \uD83C\uDFF0",
};

export async function getMessageTemplates(userId: number): Promise<MessageTemplate[]> {
  return db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.userId, userId))
    .orderBy(asc(messageTemplates.toque));
}

export async function upsertMessageTemplate(
  userId: number,
  toque: number,
  text: string
): Promise<MessageTemplate> {
  const existing = await db
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.toque, toque)))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(messageTemplates)
      .set({ text, updatedAt: new Date() })
      .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.toque, toque)))
      .returning();
    return updated[0]!;
  }

  const inserted = await db
    .insert(messageTemplates)
    .values({ userId, toque, text })
    .returning();
  return inserted[0]!;
}

export type MessageTemplateAudio = {
  audioKey: string;
  audioUrl: string;
  audioFileName: string;
  audioMimeType: string;
  audioSize: number;
};

export async function upsertMessageTemplateAudio(
  userId: number,
  toque: number,
  audio: MessageTemplateAudio,
): Promise<MessageTemplate> {
  const existing = await db
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.toque, toque)))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(messageTemplates)
      .set({ ...audio, updatedAt: new Date() })
      .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.toque, toque)))
      .returning();
    return updated[0]!;
  }

  const inserted = await db
    .insert(messageTemplates)
    .values({
      userId,
      toque,
      text: DEFAULT_TEMPLATES[toque]!,
      ...audio,
    })
    .returning();
  return inserted[0]!;
}

export async function userOwnsMessageTemplateAudio(
  userId: number,
  audioKey: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: messageTemplates.id })
    .from(messageTemplates)
    .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.audioKey, audioKey)))
    .limit(1);
  return rows.length > 0;
}

export async function removeMessageTemplateAudio(
  userId: number,
  toque: number,
): Promise<MessageTemplate | null> {
  const updated = await db
    .update(messageTemplates)
    .set({
      audioKey: null,
      audioUrl: null,
      audioFileName: null,
      audioMimeType: null,
      audioSize: null,
      updatedAt: new Date(),
    })
    .where(and(eq(messageTemplates.userId, userId), eq(messageTemplates.toque, toque)))
    .returning();

  return updated[0] ?? null;
}

export { getLeadsByUser as getQueueForWindow };
