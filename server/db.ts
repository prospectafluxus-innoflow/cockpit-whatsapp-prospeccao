import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql, count, or, desc, asc } from "drizzle-orm";
import {
  users,
  leads,
  dailySends,
  sendSchedules,
  type User,
  type InsertUser,
  type Lead,
  type InsertLead,
  type InsertDailySend,
  type SendSchedule,
  type InsertSendSchedule,
} from "../drizzle/schema";

// ─── Conexão com o banco ──────────────────────────────────────────────────────
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/postgres";

console.log("[DB] Connecting to database...");
console.log("[DB] Host:", connectionString.replace(/:[^:@]+@/, ":***@").substring(0, 80));

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

client`SELECT 1`.then(() => {
  console.log("[DB] ✅ Database connection successful!");
}).catch((err) => {
  console.error("[DB] ❌ Database connection FAILED:", err.message);
  console.error("[DB] Error details:", JSON.stringify(err, null, 2));
});

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

export async function insertLeads(data: InsertLead[]): Promise<Lead[]> {
  if (data.length === 0) return [];
  return db.insert(leads).values(data).returning();
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
  eveningCount: number
): Promise<{ morning: Lead[]; lunch: Lead[]; evening: Lead[] }> {
  const total = morningCount + lunchCount + eveningCount;
  if (total === 0) return { morning: [], lunch: [], evening: [] };

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
  const evening = readyLeads.slice(
    morningCount + lunchCount,
    morningCount + lunchCount + eveningCount
  );

  return { morning, lunch, evening };
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
export { getLeadsByUser as getQueueForWindow };
