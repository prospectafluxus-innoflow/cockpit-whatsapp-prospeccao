/**
 * Migração: adiciona colunas afternoon à tabela send_schedules
 * Execute: node scripts/migrate-afternoon.mjs
 */
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.blqtjvftkamzofpltlrj:AAvanTI%231213@aws-1-us-west-2.pooler.supabase.com:6543/postgres";

console.log("[migrate] Connecting to database...");

const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 15,
});

try {
  await sql`
    ALTER TABLE "send_schedules" 
    ADD COLUMN IF NOT EXISTS "afternoonEnabled" integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "afternoonHour" integer NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS "afternoonCount" integer NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS "afternoonTaskUid" varchar(65)
  `;
  console.log("[migrate] ✅ Migration successful! Columns added to send_schedules.");
} catch (err) {
  console.error("[migrate] ❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
