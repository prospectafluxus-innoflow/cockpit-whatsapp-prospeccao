import { and, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, leads, dailySends, InsertLead, Lead } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function getLeadsByUser(userId: number, filters?: {
  layer?: "A" | "B" | "C";
  status?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(leads).where(eq(leads.userId, userId));
  const result = await query;

  return result.filter((lead) => {
    if (filters?.layer && lead.layer !== filters.layer) return false;
    if (filters?.status && lead.status !== filters.status) return false;
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      if (!lead.name.toLowerCase().includes(s) && !(lead.company ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

export async function getLeadById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads)
    .where(and(eq(leads.id, id), eq(leads.userId, userId)))
    .limit(1);
  return result[0];
}

export async function insertLeads(data: InsertLead[]) {
  const db = await getDb();
  if (!db) return;
  if (data.length === 0) return;
  await db.insert(leads).values(data);
}

export async function updateLead(id: number, userId: number, data: Partial<Lead>) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.userId, userId)));
}

export async function deleteLeadsByUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(leads).where(eq(leads.userId, userId));
}

// ─── Daily Sends ──────────────────────────────────────────────────────────────
export async function getDailySendCount(userId: number, date: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(dailySends)
    .where(and(eq(dailySends.userId, userId), eq(dailySends.sentDate, new Date(date + "T00:00:00Z"))));
  return Number(result[0]?.count ?? 0);
}

export async function registerDailySend(userId: number, leadId: number, touchNumber: number, date: string) {
  const db = await getDb();
  if (!db) return;
  // sentDate column is `date` type — pass a Date object
  const dateObj = new Date(date + "T00:00:00Z");
  await db.insert(dailySends).values({ userId, leadId, touchNumber, sentDate: dateObj });
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────
export async function getMetrics(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const today = new Date().toISOString().split("T")[0];

  const allLeads = await db.select().from(leads).where(eq(leads.userId, userId));
  const todaySends = await getDailySendCount(userId, today!);

  const total = allLeads.length;
  const byLayer = { A: 0, B: 0, C: 0 };
  const byStatus: Record<string, number> = {};
  const respondedByLayer = { A: 0, B: 0, C: 0 };
  const totalByLayer = { A: 0, B: 0, C: 0 };

  for (const lead of allLeads) {
    byLayer[lead.layer]++;
    totalByLayer[lead.layer]++;
    byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    if (lead.status === "respondeu") respondedByLayer[lead.layer]++;
  }

  const responseRateByLayer = {
    A: totalByLayer.A > 0 ? Math.round((respondedByLayer.A / totalByLayer.A) * 100) : 0,
    B: totalByLayer.B > 0 ? Math.round((respondedByLayer.B / totalByLayer.B) * 100) : 0,
    C: totalByLayer.C > 0 ? Math.round((respondedByLayer.C / totalByLayer.C) * 100) : 0,
  };

  return {
    total,
    byLayer,
    byStatus,
    todaySends,
    dailyLimit: 30,
    responseRateByLayer,
  };
}
